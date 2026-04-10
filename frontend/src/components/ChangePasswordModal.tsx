import { useState } from 'react';
import { api } from '../api/client';

interface Props {
  /** 自行變更：不傳 targetId；管理員重設他人：傳 targetId */
  targetId?: number;
  targetName?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function ChangePasswordModal({ targetId, targetName, onClose, onSuccess }: Props) {
  const isSelf = targetId === undefined;

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit() {
    setError('');
    if (newPwd.length < 8) {
      setError('新密碼至少 8 個字元');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('新密碼與確認密碼不一致');
      return;
    }
    if (isSelf && !currentPwd) {
      setError('請輸入目前密碼');
      return;
    }

    setLoading(true);
    try {
      const res = isSelf
        ? await api.changePassword(currentPwd, newPwd)
        : await api.resetUserPassword(targetId!, newPwd);

      if (res.success) {
        onSuccess(res.message ?? '密碼已變更');
        onClose();
      } else {
        setError(res.error ?? '操作失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  }

  const EyeBtn = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--soft)', fontSize: '14px', padding: '2px',
      }}
    >{show ? '🙈' : '👁'}</button>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: '380px' }}>
        <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--g1)', marginBottom: '6px' }}>
          {isSelf ? '變更密碼' : `重設密碼：${targetName}`}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--soft)', marginBottom: '18px' }}>
          {isSelf
            ? '請輸入目前密碼與新密碼進行變更。'
            : '管理員重設密碼不需驗證目前密碼，使用者下次登入須使用新密碼。'}
        </div>

        {error && (
          <div style={{
            color: 'var(--err)', background: '#fff5f5',
            border: '1px solid #f5c6c6', borderRadius: '6px',
            padding: '8px 12px', fontSize: '13px', marginBottom: '14px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSelf && (
            <div className="field">
              <div className="field-label">目前密碼 <span style={{ color: 'var(--err)' }}>*</span></div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  style={{ width: '100%', paddingRight: '32px' }}
                  placeholder="請輸入目前密碼"
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  disabled={loading}
                />
                <EyeBtn show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />
              </div>
            </div>
          )}

          <div className="field">
            <div className="field-label">新密碼 <span style={{ color: 'var(--err)' }}>*</span></div>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                style={{ width: '100%', paddingRight: '32px' }}
                placeholder="至少 8 個字元"
                onChange={(e) => setNewPwd(e.target.value)}
                disabled={loading}
              />
              <EyeBtn show={showNew} onToggle={() => setShowNew(!showNew)} />
            </div>
            {/* 強度指示 */}
            {newPwd.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{
                      flex: 1, height: '3px', borderRadius: '2px',
                      background: i <= pwdStrength(newPwd) ? strengthColor(newPwd) : 'var(--faint)',
                      transition: 'background .2s',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: strengthColor(newPwd) }}>
                  {strengthLabel(newPwd)}
                </div>
              </div>
            )}
          </div>

          <div className="field">
            <div className="field-label">確認新密碼 <span style={{ color: 'var(--err)' }}>*</span></div>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPwd}
                style={{
                  width: '100%', paddingRight: '32px',
                  borderColor: confirmPwd && confirmPwd !== newPwd ? 'var(--err)' : undefined,
                }}
                placeholder="再次輸入新密碼"
                onChange={(e) => setConfirmPwd(e.target.value)}
                disabled={loading}
              />
              <EyeBtn show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
            </div>
            {confirmPwd && confirmPwd !== newPwd && (
              <div style={{ fontSize: '11px', color: 'var(--err)', marginTop: '3px' }}>密碼不一致</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '處理中...' : isSelf ? '確認變更' : '重設密碼'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 密碼強度輔助 ──────────────────────────────────────────
function pwdStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.max(score, pwd.length > 0 ? 1 : 0);
}

function strengthColor(pwd: string): string {
  const s = pwdStrength(pwd);
  return s <= 1 ? '#e74c3c' : s === 2 ? '#e67e22' : s === 3 ? '#f1c40f' : '#27ae60';
}

function strengthLabel(pwd: string): string {
  const s = pwdStrength(pwd);
  return s <= 1 ? '強度：弱' : s === 2 ? '強度：普通' : s === 3 ? '強度：良好' : '強度：強';
}
