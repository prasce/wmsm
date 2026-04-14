import { Request, Response } from 'express';
import pool from '../db';
import { ApiResponse, UATConfirmRequest } from '../types';
import { sendDraftNotification } from '../utils/email';

// POST /api/uat/confirm — 正式簽核（supervisor / admin only）
export async function saveUATConfirmation(req: Request, res: Response): Promise<void> {
  const body = req.body as UATConfirmRequest;

  if (!body.confirmer_name || !body.confirm_date || !body.result) {
    res.status(400).json({ success: false, error: '確認人員、日期、結果為必填' } satisfies ApiResponse);
    return;
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO uat_confirmations
         (confirmer_name, department, confirm_date, result, check_items, item_remarks, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, created_at`,
      [
        body.confirmer_name,
        body.department ?? '',
        body.confirm_date,
        body.result,
        JSON.stringify(body.check_items ?? {}),
        JSON.stringify(body.item_remarks ?? {}),
        body.remarks ?? '',
      ]
    );
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'UAT 簽核已儲存',
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[UAT/saveConfirmation Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// POST /api/uat/draft — 儲存草稿（任何已登入者）
// notify: true 時（手動暫存）向主管 / admin 發送郵件通知；false（自動暫存）不發信
export async function saveDraft(req: Request, res: Response): Promise<void> {
  const { check_items, item_remarks, notify } = req.body as {
    check_items?: Record<string, boolean>;
    item_remarks?: Record<string, string>;
    notify?: boolean;
  };

  let client;
  try {
    client = await pool.connect();
    // 每次暫存前先清除同一使用者的舊草稿，避免 DB 無限成長
    await client.query('DELETE FROM uat_drafts WHERE saved_by = $1', [req.user!.displayName]);
    const result = await client.query<{ id: number; saved_at: string }>(
      `INSERT INTO uat_drafts (saved_by, saved_role, check_items, item_remarks)
       VALUES ($1, $2, $3, $4)
       RETURNING id, saved_at`,
      [
        req.user!.displayName,
        req.user!.role,
        JSON.stringify(check_items ?? {}),
        JSON.stringify(item_remarks ?? {}),
      ]
    );
    const row = result.rows[0];

    // 先回傳 response，不等候郵件
    res.status(201).json({
      success: true,
      data: row,
      message: '確認進度已暫存',
    } satisfies ApiResponse);

    // 手動暫存才觸發郵件通知（fire-and-forget）
    if (notify === true) {
      sendDraftNotification({
        savedBy:     req.user!.displayName,
        savedRole:   req.user!.role,
        savedAt:     row.saved_at,
        checkItems:  check_items  ?? {},
        itemRemarks: item_remarks ?? {},
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[UAT/saveDraft Error]', msg);
    // 資料表不存在時給出明確提示
    const userMsg = msg.includes('relation') && msg.includes('does not exist')
      ? 'uat_drafts 資料表尚未建立，請執行 Migration 005'
      : '伺服器錯誤，請稍後再試';
    res.status(500).json({ success: false, error: userMsg } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// GET /api/uat/history — 查詢簽核紀錄（任何已登入者）
// 支援分頁：?page=1&limit=20（limit 上限 100，預設 20）
export async function getUATHistory(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const offset = (page - 1) * limit;

  let client;
  try {
    client = await pool.connect();
    const dataResult = await client.query(
      `SELECT id, confirmer_name, department, confirm_date, result,
              check_items, item_remarks, remarks, created_at
       FROM uat_confirmations
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await client.query(
      'SELECT COUNT(*)::int AS total FROM uat_confirmations'
    );
    res.json({
      success: true,
      data: dataResult.rows,
      meta: { total: countResult.rows[0].total, page, limit },
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[UAT/getHistory Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// GET /api/uat/draft/latest — 取得最新草稿（任何已登入者）
// 設計決策：回傳全域最新一筆（不限使用者），以便主管登入後能直接看到操作員填寫的進度。
// UAT 視為單一共享表單，同時間只有一份進行中的確認作業。
export async function getLatestDraft(req: Request, res: Response): Promise<void> {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT id, saved_by, saved_role, check_items, item_remarks, saved_at
       FROM uat_drafts
       ORDER BY saved_at DESC
       LIMIT 1`
    );
    if ((result.rowCount ?? 0) === 0) {
      res.json({ success: true, data: null } satisfies ApiResponse);
      return;
    }
    res.json({ success: true, data: result.rows[0] } satisfies ApiResponse);
  } catch (err) {
    console.error('[UAT/getLatestDraft Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}
