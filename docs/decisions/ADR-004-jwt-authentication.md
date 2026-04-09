# ADR-004：JWT 使用者驗證系統

**日期：** 2026-04-09
**狀態：** 已採納

## 背景

系統初版所有 API 無任何保護，任何人知道 URL 即可讀寫資料。
需要加入使用者驗證機制，讓主系統僅限登入後使用。

## 決策

採用 **JWT（JSON Web Token）** 無狀態驗證，搭配 `jsonwebtoken` 套件。

### 密碼儲存策略：bcrypt(SHA256(plaintext))

```
密碼明文 → SHA256（固定輸出 64 hex chars）→ bcrypt（ROUNDS=12）→ 儲存 hash
```

原因：bcrypt 有 72-byte 輸入截斷問題，先 SHA256 可確保任意長度密碼都能完整雜湊。

### 路由保護策略

```typescript
// routes/index.ts
router.post('/auth/login', login);           // 公開
router.post('/auth/forgot-password', forgotPassword); // 公開
router.use(requireAuth);                     // ← 一道門保護所有後續路由
router.post('/auth/register', register);     // 需 JWT + admin 角色
// ...其他所有路由...
```

`router.use(requireAuth)` 放在現有路由前，日後新增路由不會遺漏保護。

### 前端 Token 管理

`api/client.ts` 以模組層級變數 `_authToken` 儲存 token，
`get()` / `post()` 自動注入 `Authorization: Bearer <token>`。
401 時呼叫 `_onUnauthorized` callback 自動登出，清除 storage 並回到登入頁。

Token 持久化：
- Remember Me 勾選 → `localStorage`（關閉瀏覽器後保留）
- 未勾選 → `sessionStorage`（關閉分頁後清除）

## 帳號管理政策

- 帳號由管理員透過 API 建立（`POST /api/auth/register` 需 admin JWT）
- 不提供公開自助註冊，登入頁右側說明「請洽倉儲管理部門」
- 角色分三級：`admin` / `operator` / `viewer`
- `admin` 帳號不可透過 API 建立（`userRole` 強制限為 operator/viewer），防止權限升級

## 預設管理員帳號

```
username: admin
password: Admin@1234
```

密碼雜湊需以 `bcrypt(SHA256("Admin@1234"))` 手動插入 `users` 表。

## 後果

**正面：**
- 無狀態，Backend 水平擴展不需 session store
- Token 含 userId / username / role，middleware 直接讀取，無需 DB 查詢
- 前端自動登出機制，token 過期時 UX 完整

**負面：**
- Token 8h 有效，無法即時撤銷（登出只是前端清除，token 本身仍有效）
- JWT_SECRET 若洩漏需立即輪換，所有 session 同時失效
