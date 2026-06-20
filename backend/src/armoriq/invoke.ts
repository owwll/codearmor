import type { IntentToken } from '@armoriq/sdk';
import { armorIQ } from './armoriq-client';
import { logger } from '../utils/logger';

const MCP_NAME = process.env.ARMORIQ_MCP_NAME || 'codearmor-mcp';

export async function invokeFileRead(
  filePath: string,
  token: IntentToken,
  agentId: string
): Promise<boolean> {
  try {
    const userEmail = token.rawToken?.userEmail as string | undefined;

    const result = await armorIQ.invoke(
      MCP_NAME,
      'read_file',
      token,
      { filePath, agentId },
      userEmail
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
