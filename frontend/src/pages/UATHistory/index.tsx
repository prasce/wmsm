import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { UATHistoryItem } from '../../types';

const RESULT_LABEL: Record<string, string> = {
  pass:             '通過',
  conditional_pass: '條件通過',
  fail:             '不通過',
};

const RESULT_COLOR: Record<string, string> = {
  pass:             '#22c55e',
  conditional_pass: '#f59e0b',
  fail:             '#ef4444',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function CheckedCount({ items }: { items: Record<string, boolean> }) {
  const vals = Object.values(items);
  const done = vals.filter(Boolean).length;
  return <span>{done} / {vals.length}</span>;
}

function DetailRow({ row }: { row: UATHistoryItem }) {
  const checkKeys = Object.keys(row.check_items);

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0 16px 16px', background: '#f8fafb' }}>
        <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.8 }}>
          <strong>確認項目明細：</strong>
          <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse' }}>
            <tbody>
              {checkKeys.map((key) => (
                <tr key={key} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '4px 8px', width: '40px', textAlign: 'center' }}>
                    {row.check_items[key]
                      ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>
                      : <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#374151' }}>{key}</td>
                  <td style={{ padding: '4px 8px', color: '#6b7280' }}>
                    {row.item_remarks[key] || '（無意見）'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {row.remarks && (
            <div style={{ marginTop: '10px' }}>
              <strong>整體備註：</strong> {row.remarks}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function UATHistory() {
  const [items, setItems]       = useState<UATHistoryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter]     = useState<'all' | 'pass' | 'conditional_pass' | 'fail'>('all');

  useEffect(() => {
    void (async () => {
      const res = await api.getUATHistory();
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        setError(res.error ?? '載入失敗');
      }
      setLoading(false);
    })();
  }, []);

  const displayed = filter === 'all' ? items : items.filter((i) => i.result === filter);

  return (
    <div style={{ maxWidth: '900px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>簽核記錄</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
        顯示最近 100 筆 UAT 確認簽核紀錄，點選列可展開逐項確認明細。
      </p>

      {/* 篩選列 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['all', 'pass', 'conditional_pass', 'fail'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{
              padding: '5px 14px', borderRadius: '6px', fontSize: '12px',
              border: filter === v ? 'none' : '1px solid #e5e7eb',
              background: filter === v ? (v === 'all' ? '#374151' : RESULT_COLOR[v]) : '#fff',
              color: filter === v ? '#fff' : '#374151',
              cursor: 'pointer', fontWeight: filter === v ? 600 : 400,
            }}
          >
            {v === 'all' ? '全部' : RESULT_LABEL[v]}
            {v !== 'all' && (
              <span style={{ marginLeft: '6px', opacity: .8 }}>
                ({items.filter((i) => i.result === v).length})
              </span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af', alignSelf: 'center' }}>
          共 {displayed.length} 筆
        </span>
      </div>

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>載入中…</div>
      )}
      {error && (
        <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '8px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {!loading && !error && displayed.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
          尚無簽核紀錄
        </div>
      )}

      {!loading && !error && displayed.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                {['簽核日期', '簽核人', '部門', '結果', '確認項 ✓/總數', '意見數', '簽核時間'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row) => {
                const isOpen = expanded === row.id;
                const remarkCount = Object.values(row.item_remarks).filter(Boolean).length;
                return (
                  <>
                    <tr
                      key={row.id}
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                      style={{
                        borderBottom: isOpen ? 'none' : '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: isOpen ? '#f0f9ff' : 'transparent',
                        transition: 'background .1s',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.confirm_date}</td>
                      <td style={{ padding: '10px 14px' }}>{row.confirmer_name}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{row.department || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px', borderRadius: '12px',
                          fontSize: '11px', fontWeight: 700,
                          background: RESULT_COLOR[row.result] + '22',
                          color: RESULT_COLOR[row.result],
                        }}>
                          {RESULT_LABEL[row.result]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <CheckedCount items={row.check_items} />
                      </td>
                      <td style={{ padding: '10px 14px', color: remarkCount > 0 ? '#4b5563' : '#d1d5db' }}>
                        {remarkCount > 0 ? `${remarkCount} 則` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: '11.5px' }}>
                        {fmt(row.created_at)}
                        <span style={{ marginLeft: '6px', opacity: .6 }}>{isOpen ? '▲' : '▼'}</span>
                      </td>
                    </tr>
                    {isOpen && <DetailRow key={`${row.id}-detail`} row={row} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
