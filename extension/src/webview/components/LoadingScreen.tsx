import React, { useEffect, useRef } from 'react';
import { AgentStatus } from '../hooks/useFindings';

const AGENT_NAMES: Record<string, string> = {
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

const ALL_AGENT_IDS = Object.keys(AGENT_NAMES);

const THEME = {
  primary: '#4F46E5',
  'primary-border': 'rgba(79,70,229,0.4)',
  success: '#059669',
  'success-border': 'rgba(5,150,105,0.4)',
  error: '#DC2626',
};

function dotColor(status: AgentStatus['status'] | 'waiting'): string {
  switch (status) {
    case 'running':  return THEME.primary;
    case 'complete': return THEME.success;
    case 'error':    return THEME.error;
    default:         return 'rgba(255,255,255,0.15)';
  }
}

function AgentCard({ agentId, status, findingsCount }: {
  agentId: string;
  status:  AgentStatus['status'] | 'waiting';
  findingsCount: number;
}) {
  const isRunning = status === 'running';
  const isComplete = status === 'complete';
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dotRef.current;
    if (!el) return;
    if (isRunning) {
      el.style.animation = 'pulse 0.8s ease-in-out infinite';
    } else {
      el.style.animation = 'none';
    }
  }, [isRunning]);

  const cardStyle: React.CSSProperties = {
    position:      'relative',
    display:       'flex',
    alignItems:    'center',
    gap:           '10px',
    padding:       '12px',
    borderRadius:  '12px',
    background:    isRunning ? 'rgba(79,70,229,0.04)' : 'rgba(255,255,255,0.02)',
    border:        `1px solid ${isRunning ? 'rgba(79,70,229,0.3)' : isComplete ? 'rgba(5,150,105,0.2)' : 'rgba(255,255,255,0.06)'}`,
    transition:    'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow:      'hidden',
    boxShadow:     isRunning ? '0 0 16px rgba(79,70,229,0.15)' : 'none',
  };

  const dotStyle: React.CSSProperties = {
    width:        '8px',
    height:       '8px',
    borderRadius: '50%',
    background:   dotColor(status),
    flexShrink:   0,
    boxShadow:    isRunning ? `0 0 8px ${THEME.primary}` : isComplete ? `0 0 6px ${THEME.success}` : 'none',
  };

  return (
    <div style={cardStyle}>
      {/* Scanline overlay for running agents */}
      {isRunning && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${THEME.primary}, transparent)`,
          animation: 'scanline 2s linear infinite',
          opacity: 0.7
        }} />
      )}
      
      <div ref={dotRef} style={dotStyle} />
      <span style={{ 
        fontSize: '11px', 
        fontWeight: isRunning ? 600 : 500,
        color: isRunning ? THEME.primary : 'inherit',
        flex: 1, 
        opacity: status === 'waiting' ? 0.4 : 1 
      }}>
        {AGENT_NAMES[agentId] ?? agentId}
      </span>
      {isComplete && (
        <span style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '4px',
          background: findingsCount > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
          color: findingsCount > 0 ? '#f59e0b' : '#10b981',
          fontWeight: 600
        }}>
          {findingsCount > 0 ? `${findingsCount} flaws` : 'Secure'}
        </span>
      )}
    </div>
  );
}

interface Props {
  agentStatuses: AgentStatus[];
}

export function LoadingScreen({ agentStatuses }: Props) {
  const statusMap = new Map(agentStatuses.map((a) => [a.agentId, a]));
  const completedCount = agentStatuses.filter((a) => a.status === 'complete').length;

  const containerStyle: React.CSSProperties = {
    padding:        '40px 24px',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '28px',
    minHeight:      '100vh',
    background:     '#030712'
  };

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.3)} }
        @keyframes scanline { 0% { top: 0%; } 100% { top: 100%; } }
        @keyframes radar { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.3); opacity: 0; } }
      `}</style>

      <div style={containerStyle}>
        {/* Animated Cyber Radar Icon */}
        <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            border: `2px solid ${THEME['primary-border']}`,
            borderRadius: '50%',
            animation: 'radar 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite',
            opacity: 0.5,
          }} />
          <div style={{
            position: 'absolute',
            width: '80%',
            height: '80%',
            border: '1px dashed rgba(79,70,229,0.3)',
            borderRadius: '50%',
          }} />
          <div style={{
            background: 'rgba(79,70,229,0.05)',
            border: `1px solid ${THEME['primary-border']}`,
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(79,70,229,0.2)'
          }}>
            <span style={{ fontSize: '26px' }}>🛡️</span>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.3px', color: '#f8fafc' }}>
            CodeArmor Agent Inspection
          </h2>
          <p style={{ fontSize: '11px', opacity: 0.5, margin: 0 }}>
            Active agents: {completedCount} / 11 compiled
          </p>
        </div>

        {/* HUD progress meter */}
        <div style={{ width: '100%', maxWidth: '500px' }}>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
              width:      `${(completedCount / 11) * 100}%`,
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow:  '0 0 8px #4F46E5'
            }} />
          </div>
        </div>

        {/* Asymmetric Agent console list */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
          width: '100%',
          maxWidth: '500px',
        }}>
          {ALL_AGENT_IDS.map((id) => {
            const agent = statusMap.get(id);
            return (
              <AgentCard
                key={id}
                agentId={id}
                status={agent?.status ?? 'waiting'}
                findingsCount={agent?.findingsCount ?? 0}
              />
            );
          })}
        </div>

        <p style={{ fontSize: '10px', opacity: 0.3, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '12px' }}>
          Secure Encryption Pipeline Active
        </p>
      </div>
    </>
  );
}
