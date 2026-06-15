import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as queries from '../../db/queries';
import { logger } from '../../utils/logger';
import { saveSession, getSession, clearSession } from '../../utils/config';

const INVALID_CREDENTIALS = { error: 'Invalid credentials' };

/**
 * POST /api/auth/signup
 * Body: { username, password }
 */
export async function signup(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string' ||
      !username.trim() || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const existing = await queries.getUserByUsername(username.trim());
    if (existing) {
      res.status(400).json({ error: 'Username is already taken' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `user_${crypto.randomUUID().substring(0, 8)}`;

    const user = await queries.createUser({
      id: userId,
      username: username.trim(),
      passwordHash,
      role: 'user',
      plan: 'free',
    });

    logger.info('AuthController', `User registered successfully`, { username: user.username });
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        plan: user.plan
      }
    });
  } catch (err) {
    logger.error('AuthController', 'Signup error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string' ||
      !username.trim() || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const user = await queries.getUserByUsername(username.trim());

    if (!user) {
      await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000000');
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json(INVALID_CREDENTIALS);
      return;
    }

    const secret = process.env.JWT_SECRET || 'codearmor-dev-secret';
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: '30d', algorithm: 'HS256' } // Longer expiry for extensions
    );

    await queries.updateLastLogin(user.id);

    logger.info('AuthController', `Login successful`, { username: user.username, role: user.role });

    res.json({
      token,
      user: {
        id:       user.id,
        username: user.username,
        role:     user.role,
        plan:     user.plan,
      },
    });
  } catch (err) {
    logger.error('AuthController', 'Login error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/auth/status
 * Queries local config file and verifies session against database
 */
export async function status(_req: Request, res: Response): Promise<void> {
  try {
    const session = getSession();
    if (!session) {
      res.json({ authenticated: false });
      return;
    }

    const user = await queries.getUserById(session.user.id);
    if (!user) {
      clearSession();
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      token: session.token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        plan: user.plan,
        scansToday: user.scansToday
      }
    });
  } catch (err) {
    logger.error('AuthController', 'Status verification error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/auth/callback
 * Target of webapp redirect to send token to local backend
 */
export async function callback(req: Request, res: Response): Promise<void> {
  const { token } = req.query ?? {};

  if (typeof token !== 'string') {
    res.status(400).send('<h1>Invalid Callback Token</h1>');
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'codearmor-dev-secret';
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      userId: string;
      username: string;
      role: string;
    };

    const user = await queries.getUserById(decoded.userId);
    if (!user) {
      res.status(404).send('<h1>User not found in system</h1>');
      return;
    }

    saveSession({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        plan: user.plan
      }
    });

    // Provide a beautiful styled success screen
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>CodeArmor Login Success</title>
        <style>
          body {
            background-color: #030712;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 40px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            max-width: 400px;
          }
          h1 { color: #00f5ff; font-size: 24px; margin-bottom: 16px; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
          .shield { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="shield">🛡️</div>
          <h1>Login Successful!</h1>
          <p>You have successfully authenticated VS Code with CodeArmor.</p>
          <p>You may now close this browser window and return to VS Code.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    logger.error('AuthController', 'Callback processing error', err);
    res.status(401).send('<h1>Authentication failed: Invalid or expired token</h1>');
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  clearSession();
  res.json({ success: true });
}

/**
 * GET /api/auth/me
 */
export function me(req: Request, res: Response): void {
  res.json({
    user: {
      userId:   req.user!.userId,
      username: req.user!.username,
      role:     req.user!.role,
    },
  });
}

/**
 * POST /api/auth/upgrade
 * Simulates purchasing a pro plan
 */
export async function upgrade(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await queries.upgradeUserToPro(userId);
    res.json({ success: true, plan: 'pro' });
  } catch (err) {
    logger.error('AuthController', 'Upgrade error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
