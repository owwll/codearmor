import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProgressEvent, ScanResult, WebviewMessage } from './types';
import { ScannerService } from './scanner';

// ─────────────────────────────────────────────────────────────────────────────
// PanelManager
// ─────────────────────────────────────────────────────────────────────────────

export class PanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private readonly context: vscode.ExtensionContext;
  private readonly scanner: ScannerService;

  /** Fired when the webview requests a new scan (REQUEST_RESCAN message) */
  public onRescanRequested: (() => void) | undefined;

  constructor(context: vscode.ExtensionContext, scanner: ScannerService) {
    this.context = context;
    this.scanner = scanner;
  }

  // ── Panel lifecycle ─────────────────────────────────────────────────────────

  createOrShow(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const webviewDistUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      'dist',
      'webview'
    );

    this.panel = vscode.window.createWebviewPanel(
      'codearmor.panel',
      'CodeArmor Security Report',
      vscode.ViewColumn.Beside,
      {
        enableScripts:            true,
        retainContextWhenHidden:  true,
        localResourceRoots:       [webviewDistUri],
      }
    );

    this.panel.webview.html = this._getWebviewHtml();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this._handleMessage(msg),
      undefined,
      this.context.subscriptions
    );
  }

  // ── Outbound messages (extension → webview) ─────────────────────────────────

  showLoading(): void {
    this._postMessage({ type: 'SCAN_START' });
  }

  updateProgress(event: ProgressEvent): void {
    this._postMessage({ type: 'AGENT_UPDATE', payload: event });
  }

  showResults(result: ScanResult): void {
    this._postMessage({ type: 'SCAN_COMPLETE', payload: result });
  }

  showError(message: string): void {
    this._postMessage({ type: 'SCAN_ERROR', payload: { message } });
  }

  notifyAuthStatus(status: { authenticated: boolean; user?: any }): void {
    this._postMessage({ type: 'AUTH_STATUS', payload: status });
  }

  // ── Inbound messages (webview → extension) ──────────────────────────────────

  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'CHECK_AUTH': {
        const status = await this.scanner.checkAuthStatus();
        this._postMessage({ type: 'AUTH_STATUS', payload: status });
        break;
      }

      case 'INITIATE_LOGIN': {
        vscode.env.openExternal(
          vscode.Uri.parse('http://localhost:4000/login?callback=http://localhost:3847/api/auth/callback')
        );
        break;
      }

      case 'INITIATE_LOGOUT': {
        await this.scanner.logout();
        this._postMessage({ type: 'AUTH_STATUS', payload: { authenticated: false } });
        break;
      }

      case 'NAVIGATE_TO_FILE': {
        const { file, line } = message.payload;
        try {
          const candidates = [
            file,
            ...(vscode.workspace.workspaceFolders ?? []).map((f) =>
              path.join(f.uri.fsPath, file)
            ),
          ];
          const resolved = candidates.find((p) => fs.existsSync(p));
          if (!resolved) {
            vscode.window.showWarningMessage(`CodeArmor: file not found — ${file}`);
            return;
          }

          const doc    = await vscode.workspace.openTextDocument(resolved);
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false,
          });

          const targetLine = Math.max(0, line - 1); // VS Code is 0-indexed
          const range      = new vscode.Range(targetLine, 0, targetLine, 0);
          editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
          editor.selection = new vscode.Selection(range.start, range.start);
        } catch (err) {
          vscode.window.showErrorMessage(`CodeArmor: Failed to open file — ${String(err)}`);
        }
        break;
      }

      case 'REQUEST_RESCAN': {
        this.onRescanRequested?.();
        break;
      }
    }
  }

  // ── HTML generation ─────────────────────────────────────────────────────────

  private _getWebviewHtml(): string {
    const webview      = this.panel!.webview;
    const distPath     = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    const indexHtmlPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

    const nonce = this._generateNonce();

    let html: string;
    try {
      html = fs.readFileSync(indexHtmlPath, 'utf8');
    } catch {
      html = this._fallbackHtml(nonce);
    }

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'bundle.js')
    );

    html = html
      .replace(/__CSP_NONCE__/g,  nonce)
      .replace(/__SCRIPT_URI__/g, scriptUri.toString());

    return html;
  }

  private _generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private _fallbackHtml(nonce: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>CodeArmor</title>
  <style>
    body { display:flex; align-items:center; justify-content:center; height:100vh;
           background:var(--vscode-editor-background); color:var(--vscode-editor-foreground);
           font-family:var(--vscode-font-family); }
    p { opacity: 0.6; }
  </style>
</head>
<body><p>Building CodeArmor UI… run <code>npm run build:webview</code> first.</p></body>
</html>`;
  }

  private _postMessage(message: WebviewMessage): void {
    this.panel?.webview.postMessage(message);
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
