import { DelegationToken } from '../types/agent.types';
import { armorIQ } from './armoriq-client';
import { logger } from '../utils/logger';

/**
 * Checks with ArmorIQ if an agent has permission to read a specific file before reading it.
 */
export async function invokeFileRead(filePath: string, token: DelegationToken, agentId: string): Promise<boolean> {
  try {
    const result = await armorIQ.invoke({ token, operation: 'read_file', target: filePath });
    if (!result.allowed) {
      logger.warn(agentId, `Access denied: ${filePath}. Reason: ${result.reason || 'Unauthorized'}`);
    }
    return result.allowed;
  } catch (err) {
    logger.error(agentId, `Error invoking file read for ${filePath}`, err);
    return false;
  }
}
