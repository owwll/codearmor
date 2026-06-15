import * as path from 'path';
import * as cp from 'child_process';
import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { PanelManager }    from './panel';
import { ScannerService }  from './scanner';
import { ScanResult }      from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getConfig<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration('codearmor').get<T>(key, fallback);
}

let backendProcess: cp.ChildProcess | undefined;

// ─────────────────────────────────────────────────────────────────────────────
// activate
// ─────────────────────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {

  // ── Output channel ──────────────────────────────────────────────────────────
  const output = vscode.window.createOutputChannel('CodeArmor');
  context.subscriptions.push(output);

  output.appendLine('[CodeArmor] Extension activating…');

  // ── Core services ───────────────────────────────────────────────────────────
  const statusBar = new StatusBarManager();
  const scanner   = new ScannerService();
  const panel     = new PanelManager(context, scanner);

  context.subscriptions.push(
    { dispose: () => statusBar.dispose() },
    { dispose: () => panel.dispose() }
  );

  // ── Backend boot ────────────────────────────────────────────────────────────
  const backendServerPath = path.join(context.extensionPath, 'backend', 'dist', 'server.js');

  const ensureBackend = async (): Promise<void> => {
    try {
      await scanner.waitForBackend(3, 800);
      output.appendLine('[CodeArmor] Backend already running.');
    } catch {
      output.appendLine('[CodeArmor] Spawning backend…');

      backendProcess = cp.spawn('node', [backendServerPath], {
        detached: false,
        stdio:    'pipe',
        env:      { ...process.env },
      });

      backendProcess.stdout?.on('data', (d: Buffer) =>
        output.appendLine(`[backend] ${d.toString().trim()}`)
      );
      backendProcess.stderr?.on('data', (d: Buffer) =>
        output.appendLine(`[backend:err] ${d.toString().trim()}`)
      );
      backendProcess.on('exit', (code) =>
        output.appendLine(`[CodeArmor] Backend exited with code ${code}`)
      );

      try {
        await scanner.waitForBackend(10, 1000);
        output.appendLine('[CodeArmor] Backend ready.');
      } catch (err) {
        output.appendLine(`[CodeArmor] Backend failed to start: ${String(err)}`);
        vscode.window.showErrorMessage('CodeArmor: backend failed to start. Check the Output panel.');
      }
    }
  };

  await ensureBackend();

  // ── Scan execution helper ───────────────────────────────────────────────────
  const runScan = async (): Promise<void> => {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      vscode.window.showWarningMessage('CodeArmor: No workspace folder open.');
      return;
    }

    if (scanner.isScanning) {
      vscode.window.showInformationMessage('CodeArmor: A scan is already in progress.');
      return;
    }

    // Always re-hydrate the token from the saved session before scanning.
    // This prevents "Unauthorized" errors after the extension is relaunched,
    // because the token is stored in-memory and lost on every restart.
    const authStatus = await scanner.checkAuthStatus();
    if (!authStatus.authenticated) {
      panel.createOrShow();
      // The webview will show the login screen because auth.authenticated is false.
      // Sync the auth state back to the webview.
      panel.notifyAuthStatus(authStatus);
      return;
    }

    statusBar.setScanning();
    panel.createOrShow();
    panel.showLoading();

    try {
      const result = await scanner.triggerScan(workspacePath, (event) => {
        panel.updateProgress(event);
      });
      panel.showResults(result);
      statusBar.setScore(result.score);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      output.appendLine(`[CodeArmor] Scan error: ${msg}`);
      panel.showError(msg);
      statusBar.setError();
    }
  };

  // Wire rescan button in the webview
  panel.onRescanRequested = () => { void runScan(); };

  // ── Commands ────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('codearmor.scan', () => { void runScan(); }),

    vscode.commands.registerCommand('codearmor.openPanel', () => {
      panel.createOrShow();
    })
  );

  // ── Auto-scan on workspace open ─────────────────────────────────────────────
  if (getConfig<boolean>('autoScanOnOpen', false)) {
    // New folders added while VS Code is already open
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => { void runScan(); })
    );

    // Workspace was already open when the extension activated
    if (getWorkspacePath()) {
      setTimeout(() => { void runScan(); }, 2000);
    }
  }

  // ── Auto-scan on save (debounced 2 s) ──────────────────────────────────────
  if (getConfig<boolean>('autoScanOnSave', false)) {
    let saveDebounce: ReturnType<typeof setTimeout> | undefined;

    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        if (saveDebounce) clearTimeout(saveDebounce);
        saveDebounce = setTimeout(() => { void runScan(); }, 2000);
      })
    );
  }

  output.appendLine('[CodeArmor] Extension activated.');
}

// ─────────────────────────────────────────────────────────────────────────────
// deactivate
// ─────────────────────────────────────────────────────────────────────────────

export function deactivate(): void {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (err) {
      // ignore
    }
  }
}
