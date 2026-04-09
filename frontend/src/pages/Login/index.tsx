import { useState, FormEvent, CSSProperties } from 'react';
import { api } from '../../api/client';
import { AuthUser } from '../../types';

interface LoginPageProps {
  onLogin: (user: AuthUser, token: string, remember: boolean) => void;
}

type LoginView = 'login' | 'forgotPassword';

// ── Inline styles（不污染 globals.css）──────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: '#f0faf4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
    padding: '20px',
    position: 'relative',   // Fix I3: 讓 absolute logo 定位正確
  } as CSSProperties,
  card: {
    display: 'flex',
    width: '860px',
    maxWidth: '100%',
    minHeight: '520px',
    borderRadius: '16px',
    boxShadow: '0 8px 48px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    background: '#fff',
  } as CSSProperties,
  leftPanel: {
    flex: 1,
    padding: '52px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  } as CSSProperties,
  rightPanel: {
    width: '320px',
    background: '#36c973',
    padding: '52px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  } as CSSProperties,
  heading: {
    fontSize: '26px',
    fontWeight: 700,
    color: '#36c973',
    marginBottom: '6px',
    textAlign: 'center',
  } as CSSProperties,
  divider: {
    width: '48px',
    height: '3px',
    background: '#36c973',
    borderRadius: '2px',
    margin: '0 auto 12px',
  } as CSSProperties,
  subtext: {
    textAlign: 'center',
    color: '#888',
    fontSize: '13px',
    marginBottom: '28px',
  } as CSSProperties,
  inputWrap: {
    marginBottom: '20px',
  } as CSSProperties,
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#1a5c35',
    fontWeight: 600,
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as CSSProperties,
  input: {
    border: 'none',
    borderBottom: '1.5px solid #c8dcc8',
    borderRadius: 0,
    padding: '8px 4px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    background: 'transparent',
    color: '#1a5c35',
  } as CSSProperties,
  rowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    fontSize: '13px',
  } as CSSProperties,
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#555',
    cursor: 'pointer',
  } as CSSProperties,
  forgotLink: {
    color: '#1a5c35',
    textDecoration: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '13px',
    fontFamily: 'inherit',
  } as CSSProperties,
  signInBtn: {
    background: '#36c973',
    color: '#fff',
    border: 'none',
    borderRadius: '20px',
    padding: '11px 0',
    width: '100%',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    transition: 'background 0.2s',
  } as CSSProperties,
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '12px',
    color: '#bbb',
  } as CSSProperties,
  footerLink: {
    color: '#aaa',
    cursor: 'pointer',
    textDecoration: 'underline',
  } as CSSProperties,
  errorMsg: {
    color: '#c0392b',
    fontSize: '13px',
    marginBottom: '12px',
    padding: '8px 12px',
    background: '#fff5f5',
    borderRadius: '6px',
    border: '1px solid #f5c6c6',
  } as CSSProperties,
  circle1: {
    position: 'absolute',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    top: '-60px',
    right: '-60px',
    pointerEvents: 'none',
  } as CSSProperties,
  circle2: {
    position: 'absolute',
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    bottom: '-40px',
    left: '-40px',
    pointerEvents: 'none',
  } as CSSProperties,
};

// ── 登入表單 ─────────────────────────────────────────────────
function LoginForm({ onLogin, onForgot }: {
  onLogin: (user: AuthUser, token: string, remember: boolean) => void;
  onForgot: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('請輸入帳號與密碼');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      if (res.success && res.data) {
        onLogin(res.data.user, res.data.token, rememberMe);
      } else {
        setError(res.error ?? '登入失敗，請稍後再試');
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 style={s.heading}>Sign into Account</h2>
      <div style={s.divider} />
      <p style={s.subtext}>or use your username account</p>

      {error && <div style={s.errorMsg}>{error}</div>}

      <div style={s.inputWrap}>
        <label style={s.label} htmlFor="login-username">Username</label>
        <input
          id="login-username"
          style={s.input}
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          disabled={loading}
        />
      </div>

      <div style={s.inputWrap}>
        <label style={s.label} htmlFor="login-password">Password</label>
        <input
          id="login-password"
          style={s.input}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
        />
      </div>

      <div style={s.rowBetween}>
        <label style={s.checkboxLabel}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          Remember me
        </label>
        <button type="button" style={s.forgotLink} onClick={onForgot}>
          Forgot Password?
        </button>
      </div>

      <button type="submit" style={s.signInBtn} disabled={loading}>
        {loading ? '登入中...' : 'Sign In'}
      </button>

      <div style={s.footer}>
        <span style={s.footerLink}>Privacy Policy</span>
        {' · '}
        <span style={s.footerLink}>Terms & Conditions</span>
      </div>
    </form>
  );
}

// ── 忘記密碼（Stub）─────────────────────────────────────────
function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={s.heading}>Forgot Password</h2>
      <div style={s.divider} />
      <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.7, margin: '24px 0' }}>
        請聯絡系統管理員<br />重置您的密碼。
      </p>
      <button
        type="button"
        style={{ ...s.signInBtn, width: 'auto', padding: '10px 32px' }}
        onClick={onBack}
      >
        返回登入
      </button>
    </div>
  );
}

// ── 主組件 ───────────────────────────────────────────────────
export default function LoginPage({ onLogin }: LoginPageProps) {
  const [view, setView] = useState<LoginView>('login');

  return (
    <div style={s.page}>
      {/* Logo */}
      <div style={{ position: 'absolute', top: '28px', left: '40px', fontWeight: 700, color: '#1a5c35', fontSize: '15px' }}>
        🏷 MIS 倉儲管理系統
      </div>

      <div style={s.card}>
        {/* 左側白色區塊 */}
        <div style={s.leftPanel}>
          {view === 'login' && (
            <LoginForm
              onLogin={onLogin}
              onForgot={() => setView('forgotPassword')}
            />
          )}
          {view === 'forgotPassword' && (
            <ForgotPasswordView onBack={() => setView('login')} />
          )}
        </div>

        {/* 右側綠色區塊 */}
        <div style={s.rightPanel}>
          {/* 裝飾圓圈 */}
          <div style={s.circle1} />
          <div style={s.circle2} />

          <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: 700, marginBottom: '16px', position: 'relative' }}>
            Hello, Friend!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: 1.7, marginBottom: '32px', position: 'relative' }}>
            Fill up personal information and<br />start journey with us.
          </p>
          {/* Fix W1: 帳號由管理員建立，不提供公開自助註冊 */}
          <div style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            lineHeight: 1.6,
            padding: '12px 16px',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            position: 'relative',
          }}>
            帳號由系統管理員建立<br />請洽倉儲管理部門
          </div>
        </div>
      </div>
    </div>
  );
}
