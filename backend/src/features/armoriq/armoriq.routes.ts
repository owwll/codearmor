import { Router } from 'express';
import { getStatus, getAgents, getHowItWorks } from './armoriq.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/status',       getStatus);
router.get('/agents',       getAgents);
router.get('/how-it-works', getHowItWorks);

export default router;
