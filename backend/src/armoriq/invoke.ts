import type { IntentToken } from '@armoriq/sdk';
import { armorIQ } from './armoriq-client';
import { logger } from '../utils/logger';

/**
 * Checks with ArmorIQ whether an agent has permission to read a specific file
 * before the agent accesses it.
 *
 * Routes through the SDK's armorIQ.invoke() which forwards the request to
 * the ArmorIQ proxy for policy enforcement via the signed IntentToken.
 */
export async function invokeFileRead(
  filePath: string,
  token: IntentToken,
  agentId: string
): Promise<boolean> {
  try {
    const result = await armorIQ.invoke(
      /* mcp    */ 'codearmor-mcp',
      /* action */ 'read_file',
      /* token  */ token,
      /* params */ { filePath, agentId }
    );

    if (!result.allowed) {
      logger.warn(agentId, `Access denied: ${filePath}. Reason: ${result.reason ?? 'Unauthorized'}`);
    }

    return result.allowed;
  } catch (err) {
    logger.error(agentId, `Error invoking file read for ${filePath}`, err);
    return false;
  }
}
