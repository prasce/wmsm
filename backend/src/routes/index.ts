import { Router } from 'express';
import multer from 'multer';
import { getProductByCode, searchProducts } from '../controllers/products';
import { getPurchaseOrder } from '../controllers/purchaseOrders';
import { createPrintJob, getPrintHistory, getPrintStats, getOperators } from '../controllers/printJobs';
import { previewImport, executeImport } from '../controllers/imports';
import { saveUATConfirmation } from '../controllers/uat';
import { login, register, forgotPassword } from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── 公開路由（不需 Token）────────────────────────────────────
router.post('/auth/login',           login);
router.post('/auth/forgot-password', forgotPassword);

// ── 以下所有路由均需要 JWT ──────────────────────────────────
router.use(requireAuth);

// 帳號管理（需要 admin 角色，由 auth controller 內部檢查）
router.post('/auth/register', register);

// 商品
router.get('/products/search', searchProducts);
router.get('/products/:code', getProductByCode);

// 採購單
router.get('/purchase-orders/:poNo', getPurchaseOrder);

// 列印
router.post('/print-jobs', createPrintJob);
router.get('/print-history', getPrintHistory);
router.get('/print-stats', getPrintStats);
router.get('/operators', getOperators);

// Excel 匯入
router.post('/import/preview', upload.single('file'), previewImport);
router.post('/import/execute', executeImport);

// UAT
router.post('/uat/confirm', saveUATConfirmation);

export default router;
