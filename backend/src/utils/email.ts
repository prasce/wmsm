import nodemailer from 'nodemailer';
import pool from '../db';

// ── 冷卻機制：同一操作員 30 分鐘內不重複發信 ────────────────
const COOLDOWN_MS = 30 * 60 * 1000;
const lastNotifiedAt = new Map<string, number>();

// ── Gmail Transporter（lazy singleton）────────────────────────
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  });
  return _transporter;
}

// ── 查詢收件人（supervisor / admin 且 email 已設定）──────────
interface EmailRecipient { email: string; display_name: string; }

async function fetchRecipients(): Promise<EmailRecipient[]> {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query<EmailRecipient>(
      `SELECT email, display_name
       FROM users
       WHERE active = TRUE
         AND role IN ('admin', 'supervisor')
         AND email IS NOT NULL
         AND email <> ''`
    );
    return result.rows;
  } catch (err) {
    console.error('[email/fetchRecipients Error]', err);
    return [];
  } finally {
    client?.release();
  }
}

// ── 確認項目 key → 中文標題（與前端 CHECK_ITEMS 同步）────────
const ITEM_LABEL: Record<string, string> = {
  po_find:   '採購單查詢（FIND）功能欄位符合需求',
  auto_name: '品號自動帶入品名功能符合需求',
  expiry:    '效期三則二計算規則符合實際作業',
  item_cols: '品項明細表欄位完整（單箱數、總進貨、總箱數、列印張數）',
  print_dlg: '列印前確認視窗內容清楚（含張數、條碼機名稱）',
  excel_tpl: 'Excel 範本欄位符合實際填寫習慣',
  err_msg:   '匯入驗證的錯誤提示訊息清楚易懂',
  err_stop:  '有錯誤時停止列印的機制符合實際需求',
  label:     '標籤欄位內容符合實際貼標需求',
  history:   '列印歷史紀錄的查詢欄位及重複列印標示符合稽核需求',
};

const ROLE_ZH: Record<string, string> = {
  admin:      '系統管理員',
  supervisor: '主管簽核',
  operator:   '倉儲人員',
  viewer:     '唯讀',
};

// ── HTML 郵件組裝 ────────────────────────────────────────────
export interface DraftNotifyParams {
  savedBy:     string;
  savedRole:   string;
  savedAt:     string;
  checkItems:  Record<string, boolean>;
  itemRemarks: Record<string, string>;
}

function buildHtml(p: DraftNotifyParams): string {
  const savedAtLocal = new Date(p.savedAt).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12:   false,
  });

  const TOTAL     = Object.keys(ITEM_LABEL).length;
  const doneCount = Object.values(p.checkItems).filter(Boolean).length;

  const itemRows = Object.keys(ITEM_LABEL).map((key) => {
    const done   = !!p.checkItems[key];
    const remark = p.itemRemarks[key]?.trim() ?? '';
    return `
      <tr>
        <td style="padding:8px 10px;font-size:14px;border-bottom:1px solid #eee;text-align:center;width:36px;">
          <span style="color:${done ? '#1a5c35' : '#bbb'};font-weight:700;">${done ? '✓' : '○'}</span>
        </td>
        <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid #eee;color:#333;">
          ${ITEM_LABEL[key]}
        </td>
        <td style="padding:8px 10px;font-size:12px;color:#555;border-bottom:1px solid #eee;white-space:pre-wrap;max-width:160px;">
          ${remark || '<span style="color:#ccc;">—</span>'}
        </td>
      </tr>`;
  }).join('');

  const metaRows = [
    ['送簽人員', p.savedBy],
    ['角色',     ROLE_ZH[p.savedRole] ?? p.savedRole],
    ['儲存時間', savedAtLocal],
    ['已確認項目', `${doneCount} / ${TOTAL} 項`],
  ].map(([label, val]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:8px 0;border-bottom:1px solid #d1f0df;font-size:13px;">
      <span style="color:#555;">${label}</span>
      <span style="font-weight:700;color:#1a5c35;">${val}</span>
    </div>`).join('');

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f6f8;
             font-family:'Microsoft JhengHei',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f6f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- 頁首 -->
        <tr>
          <td style="background:#1a5c35;padding:24px 32px;">
            <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:.04em;">
              麥頭印標系統
            </div>
            <div style="font-size:13px;color:#a8d5b5;margin-top:4px;">
              UAT 確認進度待審通知
            </div>
          </td>
        </tr>

        <!-- 說明文字 -->
        <tr>
          <td style="padding:24px 32px 16px;">
            <p style="margin:0;font-size:14px;color:#333;line-height:1.8;">
              您好，以下人員已儲存 UAT 確認進度，
              <strong>請登入系統查閱並完成最終簽核。</strong>
            </p>
          </td>
        </tr>

        <!-- 送簽資訊卡 -->
        <tr>
          <td style="padding:0 32px 20px;">
            <div style="background:#f0faf4;border:1.5px solid #b7e4c7;
                        border-radius:8px;padding:16px 20px;">
              ${metaRows}
            </div>
          </td>
        </tr>

        <!-- 確認項目表格 -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:10px;">
              確認項目明細
            </div>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #eee;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#f8f8f8;">
                  <th style="padding:8px 10px;font-size:12px;color:#666;
                             text-align:center;width:36px;">狀態</th>
                  <th style="padding:8px 10px;font-size:12px;color:#666;
                             text-align:left;">確認項目</th>
                  <th style="padding:8px 10px;font-size:12px;color:#666;
                             text-align:left;width:160px;">意見備註</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- 前往系統按鈕 -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="${appUrl}/#confirm"
               style="display:inline-block;padding:12px 32px;
                      background:#1a5c35;color:#fff;text-decoration:none;
                      border-radius:8px;font-size:14px;font-weight:700;
                      letter-spacing:.04em;">
              前往系統進行簽核
            </a>
          </td>
        </tr>

        <!-- 頁尾 -->
        <tr>
          <td style="padding:16px 32px;background:#f8f8f8;
                     border-top:1px solid #eee;font-size:11px;
                     color:#999;text-align:center;line-height:1.8;">
            此郵件由麥頭印標系統自動發送，請勿直接回覆。<br>
            人工智慧交流群 · WMSM System Training
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── 公開介面：fire-and-forget，永不阻塞呼叫端 ──────────────
export function sendDraftNotification(params: DraftNotifyParams): void {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[email] EMAIL_USER or EMAIL_PASS not configured — skipping notification');
    return;
  }

  // 30 分鐘冷卻（per 操作員）
  const now  = Date.now();
  const last = lastNotifiedAt.get(params.savedBy) ?? 0;
  if (now - last < COOLDOWN_MS) {
    console.info(`[email] Cooldown active for ${params.savedBy}, skipping (${Math.round((COOLDOWN_MS - (now - last)) / 60000)} min left)`);
    return;
  }

  (async () => {
    try {
      const recipients = await fetchRecipients();
      if (recipients.length === 0) {
        console.warn('[email] No active supervisor/admin with email configured — skipping');
        return;
      }

      const toList  = recipients.map((r) => `"${r.display_name}" <${r.email}>`).join(', ');
      const dateStr = new Date(params.savedAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

      await getTransporter().sendMail({
        from:    process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
        to:      toList,
        subject: `【麥頭印標】UAT 確認進度待審 — ${params.savedBy}（${dateStr}）`,
        html:    buildHtml(params),
      });

      // 發信成功後才更新冷卻時間
      lastNotifiedAt.set(params.savedBy, Date.now());
      console.info(`[email] Draft notification sent to ${recipients.length} recipient(s): ${toList}`);
    } catch (err) {
      console.error('[email/sendDraftNotification Error]', err);
    }
  })();
}
