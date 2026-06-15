import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

export interface LocalSession {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    plan: string;
  };
}

function getConfigPath(): string {
  const home = os.homedir();
  return path.resolve(path.join(home, '.codearmor', 'config.json'));
}

export function saveSession(session: LocalSession): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(session, null, 2), 'utf-8');
    logger.info('ConfigManager', 'Session saved successfully');
  } catch (err) {
    logger.error('ConfigManager', 'Failed to save local session config', err);
  }
}

export function getSession(): LocalSession | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as LocalSession;
  } catch (err) {
    logger.error('ConfigManager', 'Failed to read local session config', err);
    return null;
  }
}

export function clearSession(): void {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    logger.info('ConfigManager', 'Session cleared successfully');
  } catch (err) {
    logger.error('ConfigManager', 'Failed to delete local session config', err);
  }
}
