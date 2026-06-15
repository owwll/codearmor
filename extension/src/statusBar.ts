import * as vscode from 'vscode';

// ─────────────────────────────────────────────────────────────────────────────
// Status bar colours — map to VS Code ThemeColor tokens
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_GREEN  = new vscode.ThemeColor('terminal.ansiGreen');
const COLOR_YELLOW = new vscode.ThemeColor('terminal.ansiYellow');
const COLOR_RED    = new vscode.ThemeColor('terminal.ansiRed');

/**
 * StatusBarManager
 *
 * Owns a single status-bar item on the right side of the VS Code status bar.
 * The item is always visible and updates its icon, text, colour, and tooltip
 * in response to scan lifecycle calls.
 */
export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'codearmor.openPanel';
    this.item.show();
    this.setReady();
  }

  // ── Public state setters ────────────────────────────────────────────────────

  /** Idle — no scan running or results available */
  setReady(): void {
    this.item.text    = '$(shield) CodeArmor: Ready';
    this.item.tooltip = 'Click to open CodeArmor panel';
    this.item.color   = undefined;
  }

  /** Scan is actively running */
  setScanning(): void {
    this.item.text    = '$(sync~spin) Scanning...';
    this.item.tooltip = 'Security scan in progress';
    this.item.color   = undefined;
  }

  /**
   * Scan finished — show the numeric score with a severity-appropriate colour.
   *   score ≥ 80 → green   (good)
   *   score ≥ 50 → yellow  (moderate risk)
   *   score  < 50 → red    (high risk)
   */
  setScore(score: number): void {
    if (score >= 80) {
      this.item.text  = `$(shield) CodeArmor: $(check) ${score}`;
      this.item.color = COLOR_GREEN;
    } else if (score >= 50) {
      this.item.text  = `$(shield) CodeArmor: $(warning) ${score}`;
      this.item.color = COLOR_YELLOW;
    } else {
      this.item.text  = `$(shield) CodeArmor: $(error) ${score}`;
      this.item.color = COLOR_RED;
    }
    this.item.tooltip = 'Click to open security report';
  }

  /** Scan ended with an error */
  setError(): void {
    this.item.text    = '$(shield) CodeArmor: $(error) Error';
    this.item.tooltip = 'Scan failed — click to view details';
    this.item.color   = COLOR_RED;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  dispose(): void {
    this.item.dispose();
  }
}
