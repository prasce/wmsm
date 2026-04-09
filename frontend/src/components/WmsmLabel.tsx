import { LabelData } from '../utils/printLabels';

export default function WmsmLabel({ d }: { d: LabelData }) {
  return (
    <div className="wmsm-label">
      <div className="wl-row2">
        <div className="wl-cell">
          <span className="wl-key">品號：</span>
          <span className="wl-val">{d.product_code || '—'}</span>
        </div>
        <div className="wl-cell">
          <span className="wl-key">品名：</span>
          <span className="wl-val">{d.product_name || '—'}</span>
        </div>
      </div>
      <div className="wl-row2">
        <div className="wl-cell">
          <span className="wl-key">箱內總箱入數：</span>
          <span className="wl-val">
            {d.box_qty || '—'}
            {d.is_tail && <span style={{ fontSize: '10px', color: '#b45309', marginLeft: 4 }}>（尾數箱）</span>}
          </span>
        </div>
        <div className="wl-cell">
          <span className="wl-key">箱數總數位數（根據實際數值）：</span>
          <span className="wl-val">{d.total_boxes || '—'}</span>
        </div>
      </div>
      <div className="wl-box-breakdown">
        {d.is_tail ? (
          <div className="wl-breakdown-row wl-tail">
            <span className="wl-key">⚠ 尾數箱：</span>
            <span className="wl-val-sm">本箱 {d.box_qty} 個（未滿箱，每箱標準 {d.qty_per_box} 個）</span>
          </div>
        ) : (
          <div className="wl-breakdown-row">
            <span className="wl-key">整　　箱：</span>
            <span className="wl-val-sm">本箱 {d.box_qty} 個（整箱）</span>
          </div>
        )}
      </div>
      <div className="wl-remark">
        備註：第 <strong style={{ fontSize: '15px' }}>{d.box_no}</strong> 箱／共{' '}
        <strong style={{ fontSize: '15px' }}>{d.total_boxes}</strong> 箱
      </div>
      <div className="wl-remark-blank" />
      <div className="wl-row3">
        <div className="wl-cell">
          <span className="wl-key">製造日期：</span>
          <span className="wl-val">{d.mfg_date || '—'}</span>
        </div>
        <div className="wl-cell">
          <span className="wl-key">保存期限：</span>
          <span className="wl-val">
            {d.shelf_days !== ''
              ? (typeof d.shelf_days === 'number' ? `${d.shelf_days} 天` : d.shelf_days)
              : '—'}
          </span>
        </div>
        <div className="wl-cell">
          <span className="wl-key">有效日期：</span>
          <span className="wl-val">{d.exp_date || '—'}</span>
        </div>
      </div>
      <div className="wl-sub">（三擇一填寫）</div>
    </div>
  );
}
