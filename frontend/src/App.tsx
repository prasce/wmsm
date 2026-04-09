import { useState, useCallback, useEffect } from 'react';
import TopBar from './components/TopBar';
import StepNav from './components/StepNav';
import SideBar from './components/SideBar';
import Toast from './components/Toast';
import LoginPage from './pages/Login';
import WMSM020 from './pages/WMSM020';
import WMSM030 from './pages/WMSM030';
import LabelPreview from './pages/LabelPreview';
import PrintHistory from './pages/PrintHistory';
import UATConfirm from './pages/UATConfirm';
import { ModuleId, AuthUser } from './types';
import { setAuthToken, setUnauthorizedHandler } from './api/client';

const TOKEN_KEY = 'wmsm_auth_token';
const USER_KEY  = 'wmsm_auth_user';

function loadPersistedSession(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!token || !userJson) return null;
  try {
    return { token, user: JSON.parse(userJson) as AuthUser };
  } catch {
    return null;
  }
}

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const session = loadPersistedSession();
    if (session) setAuthToken(session.token);
    return session?.user ?? null;
  });

  const [current, setCurrent] = useState<ModuleId>('m020');
  const [toast, setToast]     = useState('');

  const showToast = useCallback((msg: string) => setToast(msg), []);

  // 註冊自動登出 handler（401 時觸發）
  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      setAuthUser(null);
      setToast('Session 已過期，請重新登入');
    });
  }, []);

  function handleLogin(user: AuthUser, token: string, remember: boolean): void {
    setAuthToken(token);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
    setAuthUser(user);
  }

  function handleLogout(): void {
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setAuthUser(null);
    setCurrent('m020');
  }

  // ── Guard：未登入顯示登入頁 ──────────────────────────────
  if (!authUser) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  return (
    <>
      <TopBar user={authUser} onLogout={handleLogout} />
      <StepNav current={current} onSwitch={setCurrent} />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 100px)' }}>
        <SideBar current={current} onSwitch={setCurrent} />

        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', maxWidth: '1100px' }}>
          {current === 'm020'    && <WMSM020 onToast={showToast} onSwitchHistory={() => setCurrent('history')} operator={authUser.displayName} />}
          {current === 'm030'    && <WMSM030 onToast={showToast} operator={authUser.displayName} />}
          {current === 'label'   && <LabelPreview />}
          {current === 'history' && <PrintHistory />}
          {current === 'confirm' && <UATConfirm onToast={showToast} user={authUser} />}
        </div>
      </div>

      {/* 底部導覽列 */}
      <div style={{
        background: 'var(--white)', borderTop: '2px solid var(--g2)',
        padding: '18px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', bottom: 0,
        boxShadow: '0 -2px 12px rgba(0,0,0,.06)',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--mid)' }}>
          實務確認版 v1.0 &nbsp;|&nbsp; <strong style={{ color: 'var(--g1)' }}>WMSM 麥頭印標系統</strong> &nbsp;|&nbsp; 僅供確認用途
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const modules: ModuleId[] = ['m020','m030','label','history','confirm'];
            const idx = modules.indexOf(current);
            if (idx > 0) setCurrent(modules[idx - 1]);
          }}>‹ 上一頁</button>
          <button className="btn btn-primary btn-sm" onClick={() => {
            const modules: ModuleId[] = ['m020','m030','label','history','confirm'];
            const idx = modules.indexOf(current);
            if (idx < modules.length - 1) setCurrent(modules[idx + 1]);
          }}>下一頁 ›</button>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
