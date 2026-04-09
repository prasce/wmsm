import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { ImportBatchItem, ImportPreviewResult } from '../../types';
import { printLabels, LabelData } from '../../utils/printLabels';
import WmsmLabel from '../../components/WmsmLabel';

function labelDataList030(items: ImportBatchItem[]): LabelData[] {
  const result: LabelData[] = [];
  for (const item of items.filter((x) => x.row_status !== 'error')) {
    const qpb = item.qty_per_box ?? 0;
    const tq  = item.total_qty   ?? 0;
    const totalBoxes = qpb > 0 && tq > 0 ? Math.ceil(tq / qpb) : (item.total_boxes ?? 0);
    const remainder  = qpb > 0 && tq > 0 ? tq % qpb : 0;
    for (let n = 1; n <= totalBoxes; n++) {
      const isTail = remainder > 0 && n === totalBoxes;
      result.push({
        product_code: item.product_code ?? '',
        product_name: item.product_name ?? '',
        qty_per_box:  qpb,
        box_qty:      isTail ? remainder : qpb,
        box_no:       n,
        total_boxes:  totalBoxes,
        is_tail:      isTail,
        mfg_date:     item.mfg_date ?? '',
        exp_date:     item.exp_date ?? '',
        shelf_days:   item.shelf_days ?? '',   // 自動計算天數（有效日期 − 製造日期）
      });
    }
  }
  return result;
}

interface Props { onToast: (msg: string) => void; operator?: string; }

export default function WMSM030({ onToast, operator = '倉儲人員' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]               = useState<ImportPreviewResult | null>(null);
  const [loading, setLoading]               = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [printItems, setPrintItems]         = useState<ImportBatchItem[]>([]);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      onToast('✗ 僅支援 .xlsx 格式');
      return;
    }
    setLoading(true);
    try {
      const res = await api.previewImport(file);
      if (res.success && res.data) {
        setPreview(res.data);
        onToast(`📂 已解析 ${res.data.total_rows} 筆，請確認預覽結果`);
      } else {
        onToast(`✗ ${res.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // 確認列印：呼叫後端 executeImport，成功後開啟標籤預覽
  const executePrint = async () => {
    if (!preview) return;
    setLoading(true);
    const itemsSnapshot = preview.items;
    try {
      const res = await api.executeImport(preview.batch_no, operator);
      if (res.success) {
        onToast(res.message ?? `🖨 批次轉檔完成，共 ${res.data?.total_copies} 張`);
        setShowConfirm(false);
        setPreview(null);
        setPrintItems(itemsSnapshot);
        setShowLabelPreview(true);
      } else {
        onToast(`✗ ${res.error}`);
        setShowConfirm(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // 開啟列印視窗（每頁一張，8cm×11cm）
  const handlePrint = () => {
    const err = printLabels(labelDataList030(printItems));
    if (err) onToast(err);
  };

  const hasError = preview ? preview.err_rows > 0 : false;
  const labels   = labelDataList030(printItems);

  return (
    <div>
      <div className="uat-notice">
        <div style={{ fontSize: '20px', flexShrink: 0 }}>📋</div>
        <div className="uat-notice-text">
          <strong>實務確認說明：</strong>此畫面為 WMSM030 Excel 批次匯入作業。適用於進貨數量多、需大量列印時。
        </div>
      </div>
      <div className="page-title">
        <h2><span className="module-tag">WMSM030</span> 進貨麥頭標籤 Excel 批次匯入</h2>
        <p>適用情境：一次進貨多個品項（建議 5 筆以上），預先在 Excel 填好資料後，一次上傳批次列印。</p>
      </div>

      <div className="step-guide">
        {['下載 Excel 範本','填好資料後上傳','確認預覽','執行轉檔列印'].map((s, i) => (
          <div key={i} className={`sg-step ${i === 0 ? 'done' : i === 1 ? 'current' : ''}`}>
            <div className="sg-num">步驟 {i+1}</div>
            <div className="sg-title">{s}</div>
          </div>
        ))}
      </div>

      <div className="tip">
        <div className="tip-icon">📥</div>
        <div className="tip-text">
          <strong>第一次使用請先下載範本：</strong>點擊「下載 Excel 範本」，按照範本格式填寫，再回來上傳。
          範本內有每個欄位的說明，請勿刪除標題列或改變欄位順序。
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📤 上傳 Excel 檔案</div>
          {/* 下載範本：直接指向 /public 靜態檔案 */}
          <a
            href="/WMSM030_template.xlsx"
            download="WMSM030_上傳範本.xlsx"
            className="btn btn-ghost btn-sm"
            style={{ textDecoration: 'none' }}
          >⬇ 下載 Excel 範本</a>
        </div>
        <div className="card-body">
          <input ref={inputRef} type="file" accept=".xlsx" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          <div className="dropzone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon">{loading ? '⏳' : '📂'}</div>
            <div className="dropzone-text">
              {loading ? '解析中...' : '點此選擇檔案，或將 Excel 拖放至此'}
            </div>
            <div className="dropzone-sub">支援格式：.xlsx &nbsp;|&nbsp; 建議不超過 500 筆</div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔍 匯入預覽</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-ok">✓ 正常 {preview.ok_rows} 筆</span>
              {preview.warn_rows > 0 && <span className="badge badge-warn">⚠ 警告 {preview.warn_rows} 筆</span>}
              {preview.err_rows > 0  && <span className="badge badge-err">✗ 錯誤 {preview.err_rows} 筆</span>}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="import-tbl">
              <thead>
                <tr>
                  <th>列#</th><th>狀態</th><th>品號</th><th>對照號</th><th>品名</th>
                  <th>單箱數</th><th>總進貨</th><th>總箱數</th>
                  <th>製造日期</th><th>有效日期</th><th>保存期限（天）</th><th>列印張數（=總箱數）</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item) => (
                  <tr key={item.row_no} className={`row-${item.row_status}`}>
                    <td>{item.row_no}</td>
                    <td>
                      {item.row_status === 'ok'    && <span className="badge badge-ok">✓ 正常</span>}
                      {item.row_status === 'warn'  && <span className="badge badge-warn">⚠ 警告</span>}
                      {item.row_status === 'error' && <span className="badge badge-err">✗ 錯誤</span>}
                    </td>
                    <td className="mono" style={{ color: item.row_status === 'error' ? 'var(--err)' : undefined }}>
                      {item.product_code}
                    </td>
                    <td className="mono">{item.ref_code || '—'}</td>
                    <td>{item.product_name || <span style={{ color: 'var(--soft)' }}>（品號不存在）</span>}</td>
                    <td>{item.qty_per_box}</td>
                    <td>{item.total_qty}</td>
                    <td className="auto-calc">{item.total_boxes}</td>
                    <td>{item.mfg_date || '—'}</td>
                    <td>{item.exp_date || '—'}</td>
                    <td className="auto-calc">
                      {item.shelf_days != null ? `${item.shelf_days.toLocaleString()} 天` : '—'}
                    </td>
                    <td className="auto-calc">{item.total_boxes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.err_rows > 0 && (
            <div style={{ padding: '14px 18px', background: 'var(--errbg)', borderTop: '1px solid var(--errbd)' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--err)', marginBottom: '6px' }}>✗ 錯誤清單（需修正後才可執行列印）</div>
              {preview.items.filter((i) => i.row_status === 'error').map((item) =>
                item.messages.filter((m) => m.type === 'error').map((m, mi) => (
                  <div key={`${item.row_no}-${mi}`} style={{ fontSize: '12px', color: '#7f1d1d' }}>
                    第 {item.row_no} 列：{m.message}
                  </div>
                ))
              )}
            </div>
          )}

          {preview.warn_rows > 0 && (
            <div style={{ padding: '14px 18px', background: 'var(--warnbg)', borderTop: '1px solid var(--warnbd)' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>⚠ 警告清單（可繼續執行，但請確認）</div>
              {preview.items.filter((i) => i.row_status === 'warn').map((item) =>
                item.messages.filter((m) => m.type === 'warn').map((m, mi) => (
                  <div key={`${item.row_no}-${mi}`} style={{ fontSize: '12px', color: '#78350f' }}>
                    第 {item.row_no} 列：{m.message}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="btn-bar">
        <button
          className="btn btn-primary"
          disabled={!preview || hasError || loading}
          onClick={() => setShowConfirm(true)}
        >
          🖨 轉檔結轉列印{hasError ? '（有錯誤，請先修正）' : ''}
        </button>
        <button className="btn btn-ghost" onClick={() => { setPreview(null); }}>🔄 重新上傳</button>
      </div>

      {/* ── 確認列印 Modal ── */}
      {showConfirm && preview && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--g1)', marginBottom: '12px' }}>🖨 確認轉檔列印</div>
            <div style={{ fontSize: '13.5px', color: 'var(--mid)', lineHeight: 1.8, marginBottom: '20px' }}>
              即將列印 <strong style={{ color: 'var(--g1)', fontSize: '16px' }}>
                {labelDataList030(preview.items).length}
              </strong> 張標籤，共 {preview.ok_rows + preview.warn_rows} 筆有效品項。<br />
              {preview.warn_rows > 0 && <span style={{ color: '#b45309' }}>（含 {preview.warn_rows} 筆警告列，將一併列印）</span>}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>取消</button>
              <button className="btn btn-primary" onClick={executePrint} disabled={loading}>
                {loading ? '處理中...' : '✓ 確認列印'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 標籤預覽 Modal（與 WMSM020 相同體驗）── */}
      {showLabelPreview && (
        <div className="modal-overlay" onClick={() => setShowLabelPreview(false)}>
          <div className="modal-wide no-print" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--g1)' }}>
                🏷 麥頭標籤預覽（共 {labels.length} 張）
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline btn-sm" onClick={handlePrint}>🖨 列印此頁</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowLabelPreview(false)}>✕ 關閉</button>
              </div>
            </div>
            <div className="print-area" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {labels.length === 0
                ? <div style={{ color: 'var(--soft)', fontSize: '13px' }}>尚無可列印的品項</div>
                : labels.map((d, i) => <WmsmLabel key={i} d={d} />)
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
