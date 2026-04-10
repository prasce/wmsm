import { useState } from 'react';
import { AuthUser, ROLE_LABEL, UserRole } from '../types';
import ChangePasswordModal from './ChangePasswordModal';

const ROLE_COLOR: Record<UserRole, { bg: string; color: string }> = {
  admin:      { bg: '#c0392b22', color: '#c0392b' },
  supervisor: { bg: '#8e44ad22', color: '#8e44ad' },
  operator:   { bg: 'rgba(255,255,255,.15)', color: '#fff' },
  viewer:     { bg: 'rgba(255,255,255,.1)',  color: 'rgba(255,255,255,.75)' },
};

interface TopBarProps {
  user: AuthUser;
  onLogout: () => void;
  onToast: (msg: string) => void;
}

export default function TopBar({ user, onLogout, onToast }: TopBarProps) {
  const roleStyle = ROLE_COLOR[user.role];
  const [showChangePwd, setShowChangePwd] = useState(false);

  return (
    <>
      <div style={{
        background: 'var(--g1)', padding: '0 28px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px', height: '34px', background: 'rgba(255,255,255,.15)',
            borderRadius: '8px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px',
          }}>🏷</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '.03em' }}>
              MIS 倉儲管理系統
            </div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '11px', marginTop: '1px' }}>
              WMSM 麥頭印標作業
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'var(--warn)', color: '#7c2d00', fontWeight: 700,
            fontSize: '11px', padding: '4px 10px', borderRadius: '20px',
          }}>📋 實務確認版</div>

          {/* 角色徽章 */}
          <div style={{
            background: roleStyle.bg, color: roleStyle.color,
            fontSize: '11px', padding: '4px 10px', borderRadius: '20px',
            fontWeight: 700, border: '1px solid rgba(255,255,255,.2)',
          }}>
            {ROLE_LABEL[user.role]}
          </div>

          {/* 帳號名稱 + 點擊開啟變更密碼 */}
          <button
            onClick={() => setShowChangePwd(true)}
            title="點擊變更密碼"
            style={{
              background: 'rgba(255,255,255,.12)', color: '#fff',
              fontSize: '12px', padding: '5px 12px', borderRadius: '20px',
              border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.22)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.12)'; }}
          >
            👤 {user.displayName} 🔑
          </button>

          <button
            onClick={onLogout}
            style={{
              background: 'rgba(255,255,255,.15)',
              border: '1px solid rgba(255,255,255,.3)',
              color: '#fff', fontSize: '12px', padding: '5px 12px',
              borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            登出
          </button>
        </div>
      </div>

      {showChangePwd && (
        <ChangePasswordModal
          onClose={() => setShowChangePwd(false)}
          onSuccess={(msg) => { onToast(`✓ ${msg}`); }}
        />
      )}
    </>
  );
}
