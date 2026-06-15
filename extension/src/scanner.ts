import * as http from 'http';
import * as vscode from 'vscode';
import { ProgressEvent, ScanResult } from './types';

const SCAN_TIMEOUT_MS = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal promise-based HTTP helpers supporting JWT authentication headers
// ─────────────────────────────────────────────────────────────────────────────

function httpGet(url: string, token?: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    http.get({
      hostname: opts.hostname,
      port:     opts.port,
      path:     opts.pathname + opts.search,
      headers,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

function httpPost(url: string, data: object, token?: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const opts = new URL(url);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(payload)),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: opts.hostname,
      port:     opts.port,
      path:     opts.pathname + opts.search,
      method:   'POST',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ScannerService
// ─────────────────────────────────────────────────────────────────────────────

export class ScannerService {
  private backendPort: number;
  public  currentScanId: string | undefined;
  public  isScanning = false;
  private token?: string;

  constructor() {
    const cfg = vscode.workspace.getConfiguration('codearmor');
    this.backendPort = cfg.get<number>('backendPort', 3847);
  }

  private base(): string {
    return `http://localhost:${this.backendPort}`;
  }

  // ── Auth & Health status checks ───────────────────────────────────────────

  async checkBackendHealth(): Promise<boolean> {
    try {
      const { statusCode, body } = await httpGet(`${this.base()}/api/health`);
      if (statusCode !== 200) return false;
      const json = JSON.parse(body);
      return json.status === 'ok';
    } catch {
      return false;
    }
  }

  async checkAuthStatus(): Promise<{ authenticated: boolean; user?: any }> {
    try {
      const { statusCode, body } = await httpGet(`${this.base()}/api/auth/status`);
      if (statusCode !== 200) return { authenticated: false };
      
      const json = JSON.parse(body);
      if (json.authenticated && json.token) {
        this.token = json.token;
        return { authenticated: true, user: json.user };
      }
      
      this.token = undefined;
      return { authenticated: false };
    } catch {
      this.token = undefined;
      return { authenticated: false };
    }
  }

  async logout(): Promise<boolean> {
    try {
      const { statusCode } = await httpPost(`${this.base()}/api/auth/logout`, {});
      this.token = undefined;
      return statusCode === 200;
    } catch {
      return false;
    }
  }

  async waitForBackend(maxAttempts = 10, delayMs = 1000): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const healthy = await this.checkBackendHealth();
      if (healthy) return;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw new Error(`CodeArmor backend did not respond after ${maxAttempts} attempts`);
  }

  // ── Main scan execution ───────────────────────────────────────────────────

  async triggerScan(
    projectPath: string,
    onProgress: (e: ProgressEvent) => void
  ): Promise<ScanResult> {
    this.isScanning = true;

    try {
      // 1. POST to start the scan (requires JWT token)
      const postRes = await httpPost(`${this.base()}/api/scan`, { projectPath }, this.token);
      if (postRes.statusCode !== 202) {
        const errObj = JSON.parse(postRes.body || '{}');
        throw new Error(errObj.error || `Backend rejected scan request: ${postRes.body}`);
      }
      
      const { scanId } = JSON.parse(postRes.body);
      this.currentScanId = scanId;

      // 2. Stream SSE progress (requires JWT token)
      await this._streamProgress(scanId, onProgress);

      // 3. Fetch the full result (requires JWT token)
      const resultRes = await httpGet(`${this.base()}/api/scan/${scanId}`, this.token);
      if (resultRes.statusCode !== 200) {
        throw new Error(`Failed to fetch scan result: ${resultRes.body}`);
      }
      return JSON.parse(resultRes.body) as ScanResult;
    } finally {
      this.isScanning = false;
    }
  }

  private _streamProgress(
    scanId: string,
    onProgress: (e: ProgressEvent) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Scan timed out after 60 seconds')),
        SCAN_TIMEOUT_MS
      );

      const url = new URL(`${this.base()}/api/scan/${scanId}/stream`);
      const headers: Record<string, string> = { 'Accept': 'text/event-stream' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const req = http.get({
        hostname: url.hostname,
        port:     url.port,
        path:     url.pathname,
        headers,
      }, (res) => {
        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const event = JSON.parse(raw) as ProgressEvent;
              onProgress(event);

              if (event.phase === 'COMPLETE') {
                clearTimeout(timer);
                req.destroy();
                resolve();
                return;
              }
              if (event.phase === 'FAILED') {
                clearTimeout(timer);
                req.destroy();
                reject(new Error(event.message ?? 'Scan failed'));
                return;
              }
            } catch {
              // ignore malformed lines
            }
          }
        });

        res.on('error', (err) => { clearTimeout(timer); reject(err); });
        res.on('end',   ()    => { clearTimeout(timer); resolve(); });
      });

      req.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
  }

  // ── History ───────────────────────────────────────────────────────────────

  async getLastScan(projectPath: string): Promise<ScanResult | null> {
    try {
      const { statusCode, body } = await httpGet(`${this.base()}/api/scan/list`, this.token);
      if (statusCode !== 200) return null;
      const { scans } = JSON.parse(body) as { scans: Array<{ project_path: string } & ScanResult> };
      const match = scans.find((s) => s.project_path === projectPath);
      return match ?? null;
    } catch {
      return null;
    }
  }
}
