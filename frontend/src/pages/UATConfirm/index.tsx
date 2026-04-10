import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { AuthUser, ROLE_LABEL } from '../../types';

interface Props { onToast: (msg: string) => void; user: AuthUser; }

// ── 確認項目定義 ─────────────────────────────────────────────
const CHECK_ITEMS: { key: string; section: string; title: string; desc: string }[] = [
  { key: 'po_find',   section: 'WMSM020 套印作業', title: '採購單查詢（FIND）功能欄位符合需求',         desc: '採購單號格式、供應商自動帶入、進貨日期等基本資訊是否正確' },
  { key: 'auto_name', section: 'WMSM020 套印作業', title: '品號自動帶入品名功能符合需求',               desc: '輸入品號後，品名是否能正確自動帶入' },
  { key: 'expiry',    section: 'WMSM020 套印作業', title: '效期三則二計算規則符合實際作業',             desc: '製造日期/有效日期/保存期限三填二的自動計算邏輯是否與日常作業一致' },
  { key: 'item_cols', section: 'WMSM020 套印作業', title: '品項明細表欄位完整（單箱數、總進貨、總箱數、列印張數）', desc: '表格欄位是否涵蓋進貨作業所需的所有資訊' },
  { key: 'print_dlg', section: 'WMSM020 套印作業', title: '列印前確認視窗內容清楚（含張數、條碼機名稱）', desc: '執行列印前的確認框是否提供足夠資訊讓人員核對' },
  { key: 'excel_tpl', section: 'WMSM030 Excel 匯入', title: 'Excel 範本欄位符合實際填寫習慣',         desc: '欄位順序是否與倉儲人員習慣的填寫順序一致' },
  { key: 'err_msg',   section: 'WMSM030 Excel 匯入', title: '匯入驗證的錯誤提示訊息清楚易懂',         desc: '錯誤說明是否讓非技術人員也能看懂' },
  { key: 'err_stop',  section: 'WMSM030 Excel 匯入', title: '有錯誤時停止列印的機制符合實際需求',     desc: '只有警告時可繼續列印、有錯誤時必須修正的機制是否符合作業規範' },
  { key: 'label',     section: '標籤與紀錄', title: '標籤欄位內容符合實際貼標需求',                   desc: '標籤上的品號、品名、效期、條碼、數量等資訊是否完整且位置合適' },
  { key: 'history',   section: '標籤與紀錄', title: '列印歷史紀錄的查詢欄位及重複列印標示符合稽核需求', desc: '紀錄中的時間、人員、品號、張數及重複列印標示是否滿足管理追蹤需求' },
];

const SECTIONS = [...new Set(CHECK_ITEMS.map((i) => i.section))];

// 各模組對應的導覽提示
const SECTION_HINT: Record<string, string> = {
  'WMSM020 套印作業':  '可於左側選單「麥頭標籤套印」操作後回此頁填寫意見',
  'WMSM030 Excel 匯入': '可於左側選單「Excel 批次匯入」操作後回此頁填寫意見',
  '標籤與紀錄':        '可於左側選單「標籤樣式確認」及「列印紀錄查詢」確認後填寫意見',
};

export default function UATConfirm({ onToast, user }: Props) {
  const canSign = user.role === 'admin' || user.role === 'supervisor';

  const [checked,      setChecked]      = useState<Record<string, boolean>>({});
  const [itemRemarks,  setItemRemarks]  = useState<Record<string, string>>({});
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [confirmer,    setConfirmer]    = useState(user.displayName);
  const [dept,         setDept]         = useState(ROLE_LABEL[user.role] ?? user.role);
  const [confirmDate,  setConfirmDate]  = useState(new Date().toISOString().slice(0, 10));
  const [result,       setResult]       = useState('');
  const [remarks,      setRemarks]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [draftInfo,    setDraftInfo]    = useState<{ saved_by: string; saved_role: string; saved_at: string } | null>(null);
  const [submitted,    setSubmitted]    = useState<{ confirmer: string; dept: string; date: string; result: string } | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 進入頁面自動載入最新草稿 ─────────────────────────
  useEffect(() => {
    api.getLatestUATDraft().then((res) => {
      if (res.success && res.data) {
        const d = res.data;
        setChecked(d.check_items ?? {});
        setItemRemarks(d.item_remarks ?? {});
        setDraftInfo({ saved_by: d.saved_by, saved_role: d.saved_role, saved_at: d.saved_at });
      }
    });
  }, []);

  // ── 自動暫存（勾選/意見變動後 3 秒觸發）────────────────
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const hasData = Object.values(checked).some(Boolean) ||
                      Object.values(itemRemarks).some((v) => v.trim());
      if (hasData) doSaveDraft(false);
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, itemRemarks]);

  async function doSaveDraft(showToast = true) {
    setSaving(true);
    try {
      const res = await api.saveUATDraft(checked, itemRemarks);
      if (res.success) {
        setDraftInfo({ saved_by: user.displayName, saved_role: user.role, saved_at: new Date().toISOString() });
        if (showToast) onToast('✓ 確認進度已暫存');
      } else {
        if (showToast) onToast(`✗ 暫存失敗：${res.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const doneCount  = Object.values(checked).filter(Boolean).length;
  const totalCount = CHECK_ITEMS.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  const toggle = (key: string) =>
    setChecked((c) => ({ ...c, [key]: !c[key] }));

  const toggleExpand = (key: string) =>
    setExpandedKeys((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const checkAll = (section: string) => {
    const keys = CHECK_ITEMS.filter((i) => i.section === section).map((i) => i.key);
    const allChecked = keys.every((k) => checked[k]);
    setChecked((c) => {
      const next = { ...c };
      keys.forEach((k) => { next[k] = !allChecked; });
      return next;
    });
  };

  const sectionDone = (section: string) =>
    CHECK_ITEMS.filter((i) => i.section === section).every((i) => checked[i.key]);

  const handleSubmit = async () => {
    if (!confirmer || !confirmDate || !result) {
      onToast('✗ 確認人員、日期、結果為必填');
      return;
    }
    setLoading(true);
    try {
      const res = await api.saveUATConfirmation({
        confirmer_name: confirmer,
        department: dept,
        confirm_date: confirmDate,
        result,
        check_items: checked,
        item_remarks: itemRemarks,
        remarks,
      });
      if (res.success) {
        onToast('✅ UAT 簽核已儲存');
        // 清空表單並顯示成功畫面
        setSubmitted({ confirmer, dept, date: confirmDate, result });
        setChecked({});
        setItemRemarks({});
        setExpandedKeys(new Set());
        setRemarks('');
        setResult('');
        setConfirmDate(new Date().toISOString().slice(0, 10));
        setDraftInfo(null);
      } else {
        onToast(`✗ ${res.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const RESULT_LABEL_MAP: Record<string, string> = {
    pass:             '✅ 確認通過',
    conditional_pass: '⚠ 有條件通過',
    fail:             '❌ 需修改後重新確認',
  };

  // ── 簽核完成畫面 ────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--g1)', marginBottom: '8px' }}>
          UAT 簽核已完成
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--mid)', marginBottom: '32px' }}>
          本次確認紀錄已儲存至資料庫，可至「簽核記錄」頁面查詢。
        </p>
        <div style={{
          background: '#fff', borderRadius: '12px', border: '2px solid var(--g2)',
          padding: '24px 32px', marginBottom: '28px', textAlign: 'left',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--soft)', marginBottom: '16px', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            簽核摘要
          </div>
          {[
            ['簽核人員', submitted.confirmer],
            ['部門 / 職稱', submitted.dept || '—'],
            ['確認日期', submitted.date],
            ['確認結果', RESULT_LABEL_MAP[submitted.result] ?? submitted.result],
            ['確認項目', `${doneCount === 0 ? totalCount : doneCount} / ${totalCount} 項`],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--faint)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--soft)' }}>{label}</span>
              <span style={{ fontWeight: 600, color: 'var(--dark)' }}>{val}</span>
            </div>
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setSubmitted(null)}
          style={{ minWidth: '200px' }}
        >
          開始新一輪確認
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">
        <h2>✅ 實務單位確認簽核</h2>
        <p>由作業人員逐項操作確認並填寫意見，再由主管審閱後完成簽核。</p>
      </div>

      {/* 草稿狀態列 */}
      {draftInfo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 16px', marginBottom: '12px',
          background: '#f0fdf4', borderRadius: '8px', border: '1px solid var(--g2)',
          fontSize: '12px', color: 'var(--g1)',
        }}>
          <span>✓ 已載入草稿</span>
          <span style={{ color: 'var(--soft)' }}>|</span>
          <span style={{ color: 'var(--mid)' }}>
            由 <strong>{draftInfo.saved_by}</strong>（{ROLE_LABEL[draftInfo.saved_role as keyof typeof ROLE_LABEL] ?? draftInfo.saved_role}）
            儲存於 {new Date(draftInfo.saved_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-outline btn-sm"
            style={{ fontSize: '11px' }}
            onClick={() => doSaveDraft(true)}
            disabled={saving}
          >
            {saving ? '暫存中...' : '💾 立即暫存'}
          </button>
        </div>
      )}

      {/* 整體進度條 */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--mid)', marginBottom: '6px' }}>
                <span>整體確認進度</span>
                <span style={{ fontWeight: 700, color: progressPct === 100 ? 'var(--g1)' : 'var(--mid)' }}>
                  {doneCount} / {totalCount} 項已確認
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--faint)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  background: progressPct === 100 ? 'var(--g1)' : progressPct > 50 ? 'var(--g2)' : '#f39c12',
                  width: `${progressPct}%`, transition: 'width .3s',
                }} />
              </div>
            </div>
            <div style={{
              padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
              background: progressPct === 100 ? '#e8f8ef' : '#fffbf0',
              color: progressPct === 100 ? 'var(--g1)' : '#b7791f',
            }}>
              {progressPct === 100 ? '✓ 全部完成' : `${progressPct}%`}
            </div>
            {!draftInfo && (
              <button
                className="btn btn-outline btn-sm"
                style={{ fontSize: '11px' }}
                onClick={() => doSaveDraft(true)}
                disabled={saving || doneCount === 0}
              >
                {saving ? '暫存中...' : '💾 暫存進度'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 一、作業人員確認區 ────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-title">一、作業人員確認區</div>
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
              background: '#e8f0fe', color: '#3c4d9c', fontWeight: 600,
            }}>operator / supervisor 填寫</span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ fontSize: '12.5px', color: 'var(--mid)', marginBottom: '16px', padding: '10px 14px', background: 'var(--g3)', borderRadius: '6px', borderLeft: '3px solid var(--g2)' }}>
            請實際操作各功能後，勾選確認並在項目下方填寫意見（如欄位名稱建議、畫面調整需求等）。
          </div>

          {SECTIONS.map((sec) => {
            const secItems = CHECK_ITEMS.filter((i) => i.section === sec);
            const allDone = sectionDone(sec);
            return (
              <div key={sec} style={{ marginBottom: '20px' }}>
                {/* Section header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px', background: allDone ? '#e8f8ef' : '#f8f9fa',
                  borderRadius: '6px', marginBottom: '8px',
                  border: `1px solid ${allDone ? 'var(--g2)' : 'var(--faint)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: allDone ? 'var(--g1)' : 'var(--mid)', letterSpacing: '.04em' }}>
                      {allDone ? '✓ ' : ''}{sec.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--soft)' }}>
                      {secItems.filter((i) => checked[i.key]).length} / {secItems.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--soft)' }}>{SECTION_HINT[sec]}</span>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '11px', padding: '2px 10px' }}
                      onClick={() => checkAll(sec)}
                    >
                      {allDone ? '全部取消' : '全部勾選'}
                    </button>
                  </div>
                </div>

                {/* Check items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {secItems.map((item) => {
                    const isChecked  = !!checked[item.key];
                    const isExpanded = expandedKeys.has(item.key);
                    const hasRemark  = !!(itemRemarks[item.key]?.trim());
                    return (
                      <div key={item.key} style={{
                        border: `1px solid ${isChecked ? 'var(--g2)' : 'var(--faint)'}`,
                        borderRadius: '8px', overflow: 'hidden',
                        background: isChecked ? '#f6fdf9' : '#fff',
                        transition: 'all .15s',
                      }}>
                        {/* Item row */}
                        <div
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 14px', cursor: 'pointer' }}
                          onClick={() => toggle(item.key)}
                        >
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                            border: `2px solid ${isChecked ? 'var(--g1)' : 'var(--soft)'}`,
                            background: isChecked ? 'var(--g1)' : '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '13px', marginTop: '1px',
                            transition: 'all .15s',
                          }}>
                            {isChecked ? '✓' : ''}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: isChecked ? 'var(--g1)' : 'var(--dark)', marginBottom: '3px' }}>
                              {item.title}
                              {hasRemark && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#8e44ad', fontWeight: 400 }}>💬 有意見</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--soft)' }}>{item.desc}</div>
                          </div>
                          {/* 意見按鈕 */}
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px', flexShrink: 0, color: hasRemark ? '#8e44ad' : 'var(--soft)' }}
                            onClick={(e) => { e.stopPropagation(); toggleExpand(item.key); }}
                          >
                            {isExpanded ? '收起意見' : '填寫意見'}
                          </button>
                        </div>

                        {/* Expanded remark area */}
                        {isExpanded && (
                          <div style={{ padding: '0 14px 12px 46px', borderTop: '1px solid var(--faint)', paddingTop: '10px' }}>
                            <textarea
                              style={{ width: '100%', height: '72px', resize: 'vertical', fontSize: '12.5px' }}
                              placeholder={`請填寫此項目的意見或建議，例如：\n• 欄位名稱建議改為「${item.title.slice(0, 8)}…」\n• 希望增加 XXX 功能`}
                              value={itemRemarks[item.key] ?? ''}
                              onChange={(e) => setItemRemarks((r) => ({ ...r, [item.key]: e.target.value }))}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 二、主管簽核區 ───────────────────────────────────── */}
      <div className="card" style={{ border: canSign ? '2px solid var(--g2)' : '2px solid var(--faint)' }}>
        <div className="card-header" style={{ background: canSign ? '#f0faf4' : '#f8f9fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-title">二、主管簽核區</div>
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600,
              background: canSign ? '#e8f8ef' : '#fee2e2', color: canSign ? 'var(--g1)' : '#c0392b',
            }}>
              {canSign ? '✓ 您有簽核權限' : '⚠ 僅主管（supervisor / admin）可提交簽核'}
            </span>
          </div>
        </div>
        <div className="card-body">

          {/* 意見確認項目摘要（供主管查閱） */}
          {Object.entries(itemRemarks).some(([, v]) => v.trim()) && (
            <div style={{ marginBottom: '20px', padding: '14px', background: '#f8f4ff', borderRadius: '8px', border: '1px solid #d6bcfa' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b46c1', marginBottom: '10px' }}>
                📋 作業人員已填寫意見摘要（共 {Object.values(itemRemarks).filter((v) => v.trim()).length} 項）
              </div>
              {CHECK_ITEMS.filter((i) => itemRemarks[i.key]?.trim()).map((i) => (
                <div key={i.key} style={{ marginBottom: '8px', padding: '8px 12px', background: '#fff', borderRadius: '6px', border: '1px solid #e9d8fd' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#553c9a', marginBottom: '3px' }}>{i.title}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--dark)', whiteSpace: 'pre-wrap' }}>{itemRemarks[i.key]}</div>
                </div>
              ))}
            </div>
          )}

          {/* 總體意見 */}
          <div className="card-header" style={{ padding: '0 0 8px 0', marginBottom: '12px', borderBottom: '1px solid var(--faint)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mid)' }}>📝 主管總體意見（選填）</div>
          </div>
          <textarea
            style={{ width: '100%', height: '100px', resize: 'vertical', marginBottom: '16px' }}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="可填寫整體評估意見，例如：&#10;• 整體功能符合需求，已知問題由開發團隊修正後再確認&#10;• 列印標籤欄位需調整"
            disabled={!canSign}
          />

          {/* 簽核欄位 */}
          <div className="form-row-3" style={{ marginBottom: '14px' }}>
            <div className="field">
              <div className="field-label">確認人員 <span className="req">*</span></div>
              <input type="text" value={confirmer} onChange={(e) => setConfirmer(e.target.value)}
                placeholder="簽核主管姓名" disabled={!canSign} />
            </div>
            <div className="field">
              <div className="field-label">部門 / 職稱</div>
              <input type="text" value={dept} onChange={(e) => setDept(e.target.value)}
                placeholder="例：倉儲部 / 組長" disabled={!canSign} />
            </div>
            <div className="field">
              <div className="field-label">確認日期 <span className="req">*</span></div>
              <input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)}
                disabled={!canSign} />
            </div>
          </div>
          <div className="form-row-2" style={{ marginBottom: '16px' }}>
            <div className="field">
              <div className="field-label">確認結果 <span className="req">*</span></div>
              <select value={result} onChange={(e) => setResult(e.target.value)} disabled={!canSign}>
                <option value="">── 請選擇 ──</option>
                <option value="pass">✅ 確認通過，可進行下一步開發</option>
                <option value="conditional_pass">⚠ 有條件通過，依意見修改後不需再確認</option>
                <option value="fail">❌ 需修改後重新確認</option>
              </select>
            </div>
          </div>

          {canSign ? (
            <div className="btn-bar">
              <div style={{ fontSize: '12px', color: 'var(--soft)' }}>
                已確認 {doneCount}/{totalCount} 項，{Object.values(itemRemarks).filter((v) => v.trim()).length} 項有填寫意見
              </div>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                💾 儲存簽核
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                padding: '14px 18px', background: '#fffbf0', borderRadius: '8px',
                border: '1px solid #f6d860', color: '#92600a', fontSize: '13px', lineHeight: 1.7,
              }}>
                ⚠ 您目前的角色為「{ROLE_LABEL[user.role]}」，僅可填寫確認項目與意見。<br />
                系統每 3 秒自動暫存，您也可手動點擊「立即暫存」。<br />
                <strong>完成填寫後，請通知主管（supervisor / admin）登入此頁完成最終簽核。</strong>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => doSaveDraft(true)}
                disabled={saving || doneCount === 0}
                style={{ alignSelf: 'flex-start' }}
              >
                {saving ? '暫存中...' : `💾 儲存確認進度（${doneCount}/${totalCount} 項已確認）`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
