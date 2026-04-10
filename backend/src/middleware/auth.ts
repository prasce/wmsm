import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';

export type UserRole = 'admin' | 'supervisor' | 'operator' | 'viewer';

export interface AuthPayload {
  userId: number;
  username: string;
  displayName: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未登入或 Token 已過期' } satisfies ApiResponse);
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token 無效或已過期，請重新登入' } satisfies ApiResponse);
  }
}

/** 角色守衛：只允許指定角色通過 */
export const requireRole = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: '權限不足，無法執行此操作' } satisfies ApiResponse);
      return;
    }
    next();
  };
