import { Router, Request, Response } from 'express';
import { startScan, getScan, listScans } from './scan.controller';
import { scanEvents } from './orchestrator';
import { requireAuth } from '../auth/auth.middleware';
import * as queries from '../../db/queries';

const router = Router();

// Enforce authentication on all scan endpoints
router.use(requireAuth);

/**
 * POST /api/scan
 * Body: { projectPath: string, projectName?: string }
 */
router.post('/', startScan);

/**
 * GET /api/scan/list
 */
router.get('/list', listScans);

/**
 * GET /api/scan/:id
 */
router.get('/:id', getScan);

/**
 * GET /api/scan/:id/stream
 */
router.get('/:id/stream', async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).end();
    return;
  }

  try {
    const scan = await queries.getScanById(req.params.id);
    if (!scan) {
      res.status(404).end();
      return;
    }

    if (user.role !== 'admin' && scan.userId !== user.userId) {
      res.status(403).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onProgress = (event: any) => {
      if (event.scanId === req.params.id) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.phase === 'COMPLETE' || event.phase === 'FAILED') {
          cleanup();
        }
      }
    };

    scanEvents.on('progress', onProgress);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      scanEvents.off('progress', onProgress);
      scanEvents.removeAllListeners('progress_' + req.params.id);
      res.end();
    };

    req.on('close', cleanup);
  } catch (err) {
    res.status(500).end();
  }
});

export default router;
