import React, { useState } from 'react';
import { Finding } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'rgba(244,67,54,0.15)',  text: '#F44336', border: 'rgba(244,67,54,0.4)'  },
  WARNING:  { bg: 'rgba(255,152,0,0.15)',  text: '#FF9800', border: 'rgba(255,152,0,0.4)'  },
  INFO:     { bg: 'rgba(33,150,243,0.15)', text: '#2196F3', border: 'rgba(33,150,243,0.4)' },
};

const AGENT_DISPLAY: Record<string, string> = {
  'route-analyst':   'Route Analyst',
  'auth-inspector':  'Auth Inspector',
  'injection-hunter':'Injection Hunter',
  'data-flow-tracer':'Data Flow Tracer',
  'config-auditor':  'Config Auditor',
  'xss-scanner':     'XSS Scanner',
  'csrf-scanner':    'CSRF Scanner',
  'file-security':   'File Security',
  'api-security':    'API Security',
  'business-logic':  'Business Logic',
  'crypto-auditor':  'Crypto Auditor',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  finding:    Finding;
  onNavigate: (file: string, line: number) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.INFO;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: '4px', padding: '1px 7px', fontSize: '10px',
      fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', flexShrink: 0,
    }}>
      {severity}
    </span>
  );
}

function CodeBlock({ code, tinted }: { code: string; tinted?: boolean }) {
  const style: React.CSSProperties = {
    background:  tinted ? 'rgba(76,175,80,0.07)' : 'rgba(0,0,0,0.35)',
    border:      `1px solid ${tinted ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.07)'}`,
    borderRadius:'6px',
    padding:     '10px 12px',
    fontFamily:  "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontSize:    '11px',
    lineHeight:  1.6,
    overflowX:   'auto',
    whiteSpace:  'pre',
    color:       tinted ? '#81C784' : 'rgba(255,255,255,0.85)',
  };
  return <pre style={style}>{code}</pre>;
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function FindingCard({ finding, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sev    = SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.INFO;
  const agents = finding.agentId.split(',').map((a) => AGENT_DISPLAY[a.trim()] ?? a.trim());

  const cardStyle: React.CSSProperties = {
    border:       `1px solid ${expanded ? sev.border : 'rgba(255,255,255,0.07)'}`,
    borderLeft:   `3px solid ${sev.text}`,
    borderRadius: '8px',
    overflow:     'hidden',
    background:   expanded ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
    transition:   'all 0.2s ease',
    marginBottom: '8px',
  };

  const headerStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          '8px',
    padding:      '10px 14px',
    cursor:       'pointer',
    userSelect:   'none',
    flexWrap:     'wrap',
  };

  const titleStyle: React.CSSProperties = {
    fontSize:   '13px',
    fontWeight: 600,
    flex:       1,
    minWidth:   '120px',
  };

  const fileLinkStyle: React.CSSProperties = {
    fontSize:     '11px',
    opacity:      0.65,
    cursor:       'pointer',
    textDecoration:'underline',
    color:        '#3794FF',
    flexShrink:   0,
    whiteSpace:   'nowrap',
  };

  const bodyStyle: React.CSSProperties = {
    padding:      '0 14px 14px',
    display:      'flex',
    flexDirection:'column',
    gap:          '10px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px', opacity: 0.5, textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '3px', fontWeight: 600,
  };

  const categoryStyle: React.CSSProperties = {
    fontSize: '10px', background: 'rgba(255,255,255,0.08)',
    borderRadius: '4px', padding: '1px 6px', flexShrink: 0,
  };

  const confStyle: React.CSSProperties = {
    fontSize: '11px', opacity: 0.5, flexShrink: 0,
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={headerStyle} onClick={() => setExpanded((e) => !e)}>
        <SeverityBadge severity={finding.severity} />
        <span style={titleStyle}>{finding.title}</span>
        <span
          style={fileLinkStyle}
          onClick={(e) => { e.stopPropagation(); onNavigate(finding.file, finding.line); }}
          title={`Open ${finding.file} at line ${finding.line}`}
        >
          {finding.file.split('/').pop()}:{finding.line}
        </span>
        <span style={categoryStyle}>{finding.category}</span>
        <span style={confStyle}>{Math.round(finding.confidence * 100)}%</span>
        <span style={{ opacity: 0.5, fontSize: '12px', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={bodyStyle}>
          <div><p style={labelStyle}>What's wrong</p><p style={{ fontSize: '12px', lineHeight: 1.6, opacity: 0.85 }}>{finding.description}</p></div>
          <div><p style={labelStyle}>Impact</p><p style={{ fontSize: '12px', lineHeight: 1.6, opacity: 0.75 }}>{finding.impact}</p></div>
          {finding.codeSnippet && <div><p style={labelStyle}>Vulnerable code</p><CodeBlock code={finding.codeSnippet} /></div>}
          {finding.fix && <div><p style={labelStyle}>Fix</p><p style={{ fontSize: '12px', lineHeight: 1.6, opacity: 0.85 }}>{finding.fix}</p></div>}
          {finding.fixSnippet && <div><p style={labelStyle}>Fixed code</p><CodeBlock code={finding.fixSnippet} tinted /></div>}
          <div>
            <span style={{ ...categoryStyle, background: 'rgba(55,148,255,0.12)', color: '#3794FF', border: '1px solid rgba(55,148,255,0.2)' }}>
              Found by: {agents.join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
