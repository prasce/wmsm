import { Router } from 'express';
import multer from 'multer';
import { getProductByCode, searchProducts } from '../controllers/products';
import { getPurchaseOrder } from '../controllers/purchaseOrders';
import { createPrintJob, getPrintHistory, getPrintStats, getOperators } from '../controllers/printJobs';
import { previewImport, executeImport } from '../controllers/imports';
import { saveUATConfirmation, saveDraft, getLatestDraft, getUATHistory } from '../controllers/uat';
import { login, register, forgotPassword, changePassword } from '../controllers/auth';
import { listUsers, updateUser, toggleActive, resetPassword } from '../controllers/users';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── 公開路由（不需 Token）────────────────────────────────────
router.post('/auth/login',           login);
router.post('/auth/forgot-password', forgotPassword);

// ── 以下所有路由均需要 JWT ──────────────────────────────────
router.use(requireAuth);

// ── 帳號管理（admin only）──────────────────────────────────
router.post  ('/auth/register',             requireRole('admin'), register);
router.post  ('/auth/change-password',      changePassword);                          // 任何已登入者
router.get   ('/users',                     requireRole('admin'), listUsers);
router.patch ('/users/:id',                 requireRole('admin'), updateUser);
router.patch ('/users/:id/toggle-active',   requireRole('admin'), toggleActive);
router.post  ('/users/:id/reset-password',  requireRole('admin'), resetPassword);

// ── 商品（所有已登入角色）──────────────────────────────────
router.get('/products/search', searchProducts);
router.get('/products/:code',  getProductByCode);

// ── 採購單（所有已登入角色）────────────────────────────────
router.get('/purchase-orders/:poNo', getPurchaseOrder);

// ── 列印（supervisor 可操作，便於簽核前親自驗證功能；viewer 唯讀）
router.post('/print-jobs',   requireRole('admin', 'supervisor', 'operator'), createPrintJob);
router.get ('/print-history', getPrintHistory);
router.get ('/print-stats',   getPrintStats);
router.get ('/operators',     getOperators);

// ── Excel 匯入（supervisor / operator / admin）──────────────
router.post('/import/preview', upload.single('file'), requireRole('admin', 'supervisor', 'operator'), previewImport);
router.post('/import/execute', requireRole('admin', 'supervisor', 'operator'), executeImport);

// ── UAT 草稿（任何已登入者可存取）
router.post('/uat/draft',         saveDraft);
router.get ('/uat/draft/latest',  getLatestDraft);
// ── UAT 正式簽核（supervisor / admin only）
router.post('/uat/confirm',       requireRole('admin', 'supervisor'), saveUATConfirmation);
// ── UAT 簽核紀錄查詢（任何已登入者）
router.get ('/uat/history',       getUATHistory);

export default router;
