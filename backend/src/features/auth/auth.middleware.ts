import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        role: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}

const UNAUTHORIZED = { error: 'Unauthorized' };

/**
 * requireAuth — enforcing JWT authentication via headers.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  // Check Bearer authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    res.status(401).json(UNAUTHORIZED);
    return;
  }

  const secret = process.env.JWT_SECRET || 'codearmor-dev-secret';

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      userId: string;
      username: string;
      role: string;
      iat?: number;
      exp?: number;
    };

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.warn('AuthMiddleware', 'Token expired', { error: (err as Error).message });
    } else if (err instanceof jwt.JsonWebTokenError) {
      logger.warn('AuthMiddleware', 'Invalid token', { error: (err as Error).message });
    } else {
      logger.error('AuthMiddleware', 'Unexpected JWT error', err);
    }
    res.status(401).json(UNAUTHORIZED);
  }
}

/**
 * requireAdmin — enforcing admin role check after authentication.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }
    next();
  });
}
