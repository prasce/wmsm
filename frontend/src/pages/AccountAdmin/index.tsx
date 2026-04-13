import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { UserAccount, UserRole, ROLE_LABEL } from '../../types';
import ChangePasswordModal from '../../components/ChangePasswordModal';

interface Props { onToast: (msg: string) => void; }

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'supervisor', label: '主管簽核' },
  { value: 'operator',   label: '倉儲人員' },
  { value: 'viewer',     label: '唯讀' },
];

const ROLE_COLOR: Record<UserRole, string> = {
  admin:      '#c0392b',
  supervisor: '#8e44ad',
  operator:   '#1a5c35',
  viewer:     '#555',
};

const EMPTY_FORM = { username: '', password: '', display_name: '', role: 'operator' as UserRole };

export default function AccountAdmin({ onToast }: Props) {
  const [users, setUsers]         = useState<UserAccount[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formErr, setFormErr]     = useState('');
  const [editId, setEditId]       = useState<number | null>(null);
  const [editForm, setEditForm]   = useState<{ display_name: string; role: UserRole; email: string }>({ display_name: '', role: 'operator', email: '' });
  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listUsers();
      if (res.success && res.data) setUsers(res.data);
      else onToast(`✗ ${res.error ?? '載入失敗'}`);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleCreate() {
    if (!form.username.trim() || !form.password || !form.display_name.trim()) {
      setFormErr('帳號、顯示名稱與密碼均為必填');
      return;
    }
    if (form.password.length < 8) {
      setFormErr('密碼至少 8 個字元');
      return;
    }
    setFormErr('');
    const res = await api.register(form.username.trim(), form.password, form.display_name.trim(), form.role);
    if (res.success) {
      onToast(`✓ 帳號「${form.display_name}」建立成功`);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      loadUsers();
    } else {
      setFormErr(res.error ?? '建立失敗');
    }
  }

  async function handleUpdate(id: number) {
    const res = await api.updateUser(id, {
      display_name: editForm.display_name,
      role: editForm.role,
      email: editForm.email.trim() || null,
    });
    if (res.success) {
      onToast('✓ 帳號已更新');
      setEditId(null);
      loadUsers();
    } else {
      onToast(`✗ ${res.error ?? '更新失敗'}`);
    }
  }

  async function handleToggle(u: UserAccount) {
    const label = u.active ? '停用' : '啟用';
    const res = await api.toggleUserActive(u.id);
    if (res.success) {
      onToast(`✓ 帳號「${u.display_name}」已${label}`);
      loadUsers();
    } else {
      onToast(`✗ ${res.error ?? `${label}失敗`}`);
    }
  }

  return (
    <div>
      <div className="page-title">
        <h2><span className="module-tag">管理</span> 帳號管理</h2>
        <p>建立、編輯及停用系統使用者帳號。admin 帳號不可透過此介面修改角色或停用。</p>
      </div>

      {/* 角色說明 */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header"><div className="card-title">角色權限說明</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {(['admin', 'supervisor', 'operator', 'viewer'] as UserRole[]).map((r) => (
              <div key={r} style={{
                border: `1.5px solid ${ROLE_COLOR[r]}22`,
                borderRadius: '8px', padding: '12px',
                background: `${ROLE_COLOR[r]}08`,
              }}>
                <div style={{ fontWeight: 700, color: ROLE_COLOR[r], marginBottom: '6px' }}>
                  {ROLE_LABEL[r]}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.6 }}>
                  {r === 'admin'      && '全部功能 + 帳號管理（種子帳號，不可由 API 建立）'}
                  {r === 'supervisor' && '查看所有資料 + UAT 確認簽核'}
                  {r === 'operator'   && '查看 + 建立列印作業 + Excel 匯入'}
                  {r === 'viewer'     && '唯讀：僅可查看標籤與列印紀錄'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 帳號列表 */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">使用者帳號列表</div>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(true); setFormErr(''); }}>
            ＋ 新增帳號
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading
            ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--soft)' }}>載入中...</div>
            : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>帳號</th>
                    <th>顯示名稱</th>
                    <th>角色</th>
                    <th>通知 Email</th>
                    <th>狀態</th>
                    <th>最後登入</th>
                    <th>建立日期</th>
                    <th style={{ width: '180px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{u.username}</td>
                      <td>
                        {editId === u.id ? (
                          <input
                            type="text"
                            value={editForm.display_name}
                            style={{ width: '120px' }}
                            onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                          />
                        ) : u.display_name}
                      </td>
                      <td>
                        {editId === u.id && u.role !== 'admin' ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                            style={{ fontSize: '12px' }}
                          >
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            background: `${ROLE_COLOR[u.role]}18`,
                            color: ROLE_COLOR[u.role],
                            padding: '2px 8px', borderRadius: '10px',
                            fontSize: '11px', fontWeight: 700,
                          }}>
                            {ROLE_LABEL[u.role]}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {editId === u.id ? (
                          <input
                            type="email"
                            value={editForm.email}
                            placeholder="通知信箱（選填）"
                            style={{ width: '160px', fontSize: '12px' }}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          />
                        ) : (
                          <span style={{ color: u.email ? '#1a5c35' : 'var(--soft)' }}>
                            {u.email ?? '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          color: u.active ? 'var(--g1)' : 'var(--err)',
                          fontWeight: 600, fontSize: '12px',
                        }}>
                          {u.active ? '● 啟用' : '○ 停用'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--soft)' }}>
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--soft)' }}>
                        {new Date(u.created_at).toLocaleDateString('zh-TW')}
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <span style={{ fontSize: '12px', color: 'var(--soft)' }}>（受保護）</span>
                        ) : editId === u.id ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(u.id)}>儲存</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>取消</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => {
                              setEditId(u.id);
                              setEditForm({ display_name: u.display_name, role: u.role, email: u.email ?? '' });
                            }}>編輯</button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ color: '#1a5c35' }}
                              onClick={() => setResetTarget(u)}
                            >
                              🔑 重設密碼
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: u.active ? 'var(--err)' : 'var(--g1)' }}
                              onClick={() => handleToggle(u)}
                            >
                              {u.active ? '停用' : '啟用'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      </div>

      {/* 新增帳號 Modal */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: '420px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--g1)', marginBottom: '18px' }}>
              新增使用者帳號
            </div>

            {formErr && (
              <div style={{ color: 'var(--err)', background: '#fff5f5', border: '1px solid #f5c6c6',
                borderRadius: '6px', padding: '8px 12px', fontSize: '13px', marginBottom: '14px' }}>
                {formErr}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <div className="field-label">帳號（登入用）<span style={{ color: 'var(--err)' }}>*</span></div>
                <input type="text" value={form.username} placeholder="英數字，不可重複"
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="field">
                <div className="field-label">顯示名稱 <span style={{ color: 'var(--err)' }}>*</span></div>
                <input type="text" value={form.display_name} placeholder="例：王小明"
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              <div className="field">
                <div className="field-label">密碼 <span style={{ color: 'var(--err)' }}>*</span></div>
                <input type="password" value={form.password} placeholder="至少 8 個字元"
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="field">
                <div className="field-label">角色</div>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="field-hint">admin 帳號不可透過此介面建立</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate}>建立帳號</button>
            </div>
          </div>
        </div>
      )}

      {/* 管理員重設他人密碼 Modal */}
      {resetTarget && (
        <ChangePasswordModal
          targetId={resetTarget.id}
          targetName={resetTarget.display_name}
          onClose={() => setResetTarget(null)}
          onSuccess={(msg) => { onToast(`✓ ${msg}`); setResetTarget(null); }}
        />
      )}
    </div>
  );
}
