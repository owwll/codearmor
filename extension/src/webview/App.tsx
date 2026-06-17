import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useFindings }    from './hooks/useFindings';
import { LoadingScreen }  from './components/LoadingScreen';
import { ScoreRing }      from './components/ScoreRing';
import { FilterBar }      from './components/FilterBar';
import { FindingCard }    from './components/FindingCard';

const pageStyle: React.CSSProperties = {
  maxWidth:  '760px',
  margin:    '0 auto',
  padding:   '0 20px 40px',
  fontFamily: 'var(--vscode-font-family, sans-serif)',
  color: 'var(--vscode-editor-foreground, #cccccc)',
};

function Btn({ children, onClick, variant = 'primary' }: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const base: React.CSSProperties = {
    display:      'inline-flex',
    alignItems:   'center',
    gap:          '6px',
    padding:      '8px 16px',
    borderRadius: '8px',
    border:       isPrimary ? '1px solid rgba(0,245,255,0.4)' 
                  : isDanger ? '1px solid rgba(244,67,54,0.4)'
                  : '1px solid rgba(255,255,255,0.15)',
    background:   isPrimary ? 'rgba(0,245,255,0.15)' 
                  : isDanger ? 'rgba(244,67,54,0.15)'
                  : 'rgba(255,255,255,0.05)',
    color:        isPrimary ? '#00f5ff' 
                  : isDanger ? '#f44336'
                  : 'inherit',
    fontSize:     '12px',
    cursor:       'pointer',
    fontWeight:   600,
    transition:   'all 0.2s ease',
  };
  return <button style={base} onClick={onClick}>{children}</button>;
}

export default function App() {
  const {
    phase, findings, score, summary,
    agentStatuses, durationMs, error,
    projectName, sendMessage, auth,
    initiateLogin, initiateLogout, checkAuth
  } = useFindings();

  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Poll for auth status while not logged in
  useEffect(() => {
    if (!auth.authenticated) {
      const interval = setInterval(() => {
        checkAuth();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [auth.authenticated, checkAuth]);

  const handleNavigate = (file: string, line: number) => {
    sendMessage({ type: 'NAVIGATE_TO_FILE', payload: { file, line } });
  };

  const handleRescan = () => {
    sendMessage({ type: 'REQUEST_RESCAN' });
  };

  // ── 1. AUTH VERIFYING ──────────────────────────────────────────────────────
  if (!auth.checked) {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '12px' }}>
        <img src={(window as any).__LOGO_URI__} alt="CodeArmor" style={{ width: '32px', height: '32px', animation: 'pulse 1.5s infinite' }} />
        <p style={{ opacity: 0.5, fontSize: '12px' }}>Connecting to secure vault...</p>
      </div>
    );
  }

  // ── 2. LOGIN REQUIRED ──────────────────────────────────────────────────────
  if (!auth.authenticated) {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '40px 20px' }}>
        <div style={{
          background: 'rgba(0, 245, 255, 0.03)',
          border: '1px solid rgba(0, 245, 255, 0.1)',
          borderRadius: '50%',
          width: '80px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: '0 0 24px rgba(0, 245, 255, 0.15)'
        }}>
          <img src={(window as any).__LOGO_URI__} alt="CodeArmor" style={{ width: '40px', height: '40px' }} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.3px', color: '#f8fafc' }}>
          CodeArmor Security
        </h2>
        <p style={{ opacity: 0.6, fontSize: '13px', maxWidth: '320px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
          Run 11 parallel AI agents to detect, validate, and score vulnerabilities in your code.
        </p>
        <Btn onClick={initiateLogin}>⚡ Authenticate in Browser</Btn>
        <p style={{ opacity: 0.35, fontSize: '11px', marginTop: '16px', maxWidth: '280px' }}>
          This will redirect to the CodeArmor dashboard to complete sign-in.
        </p>
      </div>
    );
  }

  // ── 3. LOADING SCAN STATE ──────────────────────────────────────────────────
  if (phase === 'loading') {
    return <LoadingScreen agentStatuses={agentStatuses} />;
  }

  // ── 4. SCAN FAIL OR LIMIT EXCEEDED ─────────────────────────────────────────
  if (phase === 'error') {
    const isLimitError = error?.toLowerCase().includes('limit') || error?.toLowerCase().includes('upgrade');
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>{isLimitError ? '💎' : '⚠️'}</div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: isLimitError ? '#c084fc' : '#F44336', margin: 0 }}>
          {isLimitError ? 'Upgrade Required' : 'Scan Execution Failed'}
        </h3>
        <p style={{ opacity: 0.65, fontSize: '12px', maxWidth: '340px', lineHeight: 1.6, margin: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isLimitError ? (
            <Btn onClick={() => {
              sendMessage({
                type: 'NAVIGATE_TO_FILE',
                payload: { file: 'http://localhost:4000/dashboard', line: 1 }
              });
            }}>💎 Upgrade to Pro Plan</Btn>
          ) : (
            <Btn onClick={handleRescan}>↺ Retry Scan</Btn>
          )}
        </div>
      </div>
    );
  }

  // ── 5. IDLE (WAITING FOR FIRST SCAN) ───────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={(window as any).__LOGO_URI__} alt="CodeArmor" style={{ width: '20px', height: '20px' }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>CodeArmor</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: auth.user.plan === 'pro' ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.08)',
              color: auth.user.plan === 'pro' ? '#c084fc' : '#94a3b8',
              fontWeight: 600,
            }}>{auth.user.plan === 'pro' ? 'PRO' : 'FREE'}</span>
          </div>
          <Btn onClick={initiateLogout} variant="ghost">Sign Out</Btn>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px 0' }}>
          <div style={{ fontSize: '64px', lineHeight: 1 }}>📡</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Armor Vault Ready</h2>
          <p style={{ opacity: 0.5, fontSize: '13px', textAlign: 'center', maxWidth: '280px', margin: 0, lineHeight: 1.5 }}>
            Open any folder and launch a scan to analyze security flaws.
          </p>
          <Btn onClick={handleRescan}>⚡ Run Security Scan</Btn>
          {auth.user.plan === 'free' && (
            <span style={{ fontSize: '11px', opacity: 0.4 }}>Daily Scans: {auth.user.scansToday} / 3 used</span>
          )}
        </div>
      </div>
    );
  }

  // ── 6. COMPLETED SCAN RESULTS ──────────────────────────────────────────────
  const filtered = activeFilter
    ? findings.filter((f) => f.severity === activeFilter)
    : findings;

  const durationSec = durationMs ? (durationMs / 1000).toFixed(1) : null;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={(window as any).__LOGO_URI__} alt="CodeArmor" style={{ width: '24px', height: '24px' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>CodeArmor</h1>
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: auth.user.plan === 'pro' ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.08)',
                color: auth.user.plan === 'pro' ? '#c084fc' : '#94a3b8',
                fontWeight: 600,
              }}>{auth.user.plan === 'pro' ? 'PRO' : 'FREE'}</span>
            </div>
            <p style={{ fontSize: '11px', opacity: 0.5, margin: 0 }}>
              {projectName ? `${projectName} · ` : ''}Scan Complete
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn onClick={handleRescan} variant="primary">↺ Re-scan</Btn>
          <Btn onClick={initiateLogout} variant="ghost">Sign Out</Btn>
        </div>
      </div>

      {/* Score and summary breakdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px', padding: '24px 0 16px', flexWrap: 'wrap' }}>
        <ScoreRing score={score} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Critical', value: summary.critical, color: '#F44336' },
              { label: 'Warning',  value: summary.warning,  color: '#FF9800' },
              { label: 'Info',     value: summary.info,     color: '#2196F3' },
              { label: 'Total',    value: summary.total,    color: 'inherit' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {durationSec && (
              <p style={{ fontSize: '11px', opacity: 0.45, margin: 0 }}>⏱ Scanned in {durationSec}s</p>
            )}
            {auth.user.plan === 'free' && (
              <p style={{ fontSize: '11px', opacity: 0.45, margin: 0 }}>• {auth.user.scansToday}/3 scans today</p>
            )}
          </div>
        </div>
      </div>

      {/* Filter and findings */}
      {summary.total === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0', opacity: 0.8 }}>
          <div style={{ fontSize: '48px' }}>✅</div>
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>No vulnerabilities found!</h3>
          <p style={{ fontSize: '12px', opacity: 0.6 }}>Security score: 100 — your project looks clean.</p>
        </div>
      ) : (
        <>
          <FilterBar onFilter={setActiveFilter} active={activeFilter} counts={summary} />
          <div>
            {filtered.length === 0 ? (
              <p style={{ opacity: 0.45, fontSize: '12px', padding: '16px 0' }}>No findings match this filter.</p>
            ) : (
              filtered.map((f) => (
                <FindingCard key={f.id} finding={f} onNavigate={handleNavigate} />
              ))
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '24px', paddingTop: '16px', fontSize: '11px', opacity: 0.35, textAlign: 'center' }}>
        Powered by ArmorIQ + ArmorClaw · Report saved to scan history
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

