import { Router } from 'express';
import { login, me, signup, logout, status, callback, upgrade } from './auth.controller';
import { requireAuth } from './auth.middleware';

const router = Router();

// Public auth endpoints
router.post('/signup', signup);
router.post('/login', login);
router.get('/status', status);
router.get('/callback', callback);
router.post('/logout', logout);

// Protected auth endpoints
router.get('/me', requireAuth, me);
router.post('/upgrade', requireAuth, upgrade);

export default router;
