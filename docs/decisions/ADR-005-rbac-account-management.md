# ADR-005：角色型存取控制（RBAC）與帳號管理政策

**日期：** 2026-04-10
**狀態：** 已採納

## 背景

系統初期僅有 JWT 驗證（requireAuth），無角色區分。所有登入使用者皆可執行
列印、匯入、UAT 簽核等操作，不符合倉儲實務中職責分離的需求：
- 主管應可查看與簽核，但不應操作列印
- 倉儲人員應可列印，但不應管理帳號
- 唯讀用戶（稽核、觀察）只需查看紀錄

## 決策

### 角色定義

| 角色 | 說明 |
|------|------|
| `admin` | 全部功能 + 帳號管理（種子帳號，DB 直接建立，不可由 API 建立）|
| `supervisor` | 查看所有資料 + UAT 確認簽核 |
| `operator` | 查看 + 建立列印作業 + Excel 匯入 |
| `viewer` | 唯讀，僅可查看標籤與列印紀錄 |

### 實作方式

**後端：**
- `UserRole` type 定義於 `middleware/auth.ts`
- `requireRole(...roles)` middleware：回傳 403 若角色不符
- `routes/index.ts` 各路由依需求組合 `requireAuth` + `requireRole`
- DB CHECK constraint（Migration 003）確保資料層也不會存入非法角色值

**前端：**
- `SideBar` 接收 `userRole` prop，隱藏無權限的選單項目
- `TopBar` 顯示角色徽章（四色對應四角色）
- API 403 由後端攔截；前端選單隱藏提供友善體驗但不是安全邊界

### 帳號管理政策

1. **不提供公開自助註冊** — 登入頁右側明示「請洽倉儲管理部門」
2. **admin 帳號不可由 API 建立** — `allowedRoles` 陣列排除 `admin`
3. **admin 帳號不可被停用或變更角色** — controller 層防護
4. **不可停用自己的帳號** — `toggleActive` 比對 `targetId === operatorId`

### 密碼管理

| 情境 | API | 驗證方式 |
|------|-----|---------|
| 使用者自行變更 | `POST /api/auth/change-password` | 需提供目前密碼 |
| 管理員重設他人 | `POST /api/users/:id/reset-password` | admin only，不需舊密碼 |

前端 `ChangePasswordModal` 元件同時支援兩種情境，並內建密碼強度指示器。

## 後果

**正面：**
- 職責分離，減少操作失誤風險
- 單一 `requireRole` middleware 可組合使用，易擴充
- 前端選單根據角色自動調整，使用者不會看到無法使用的功能

**負面：**
- 前端選單隱藏不等於安全，所有存取控制仍需後端 middleware 把關
- 角色新增時需同步更新：DB CHECK / UserRole type / ROLE_LABEL / SideBar ITEMS / routes

## 替代方案考量

- **ABAC（屬性型）**：過於複雜，倉儲場景不需要細粒度資源權限
- **單一角色（admin/user）**：無法區分主管簽核與倉儲操作的職責
