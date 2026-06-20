import { armorIQ } from '../../armoriq/armoriq-client';
import { logger } from '../../utils/logger';

const ARMORIQ_API_KEY = process.env.ARMORIQ_API_KEY || '';

export class ArmorIQService {
  static async verifyIntent(actionType: string, payload: any, userEmail?: string) {
    if (!ARMORIQ_API_KEY || ARMORIQ_API_KEY === 'mock') {
      return { allowed: true, reason: 'unconfigured' };
    }

    if (userEmail) {
      armorIQ.forUser(userEmail);
    }

    try {
      const planCapture = armorIQ.capturePlan({
        planType: actionType,
        projectId: payload.projectName || payload.projectPath,
        agentManifest: ['scan_start'],
        totalFiles: 0,
        allowedOperations: ['scan_start'],
        forbiddenOperations: [],
        timestamp: new Date().toISOString(),
      });

      return await armorIQ.verifyIntent(planCapture);
    } catch (error: any) {
      logger.error('ArmorIQService', `Intent verification failed for ${actionType}`, error as object);
      return { allowed: false, reason: error.message || 'ArmorIQ verification failed' };
    }
  }
}
