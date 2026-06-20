import React, { useEffect, useRef, useState } from 'react';
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
  'primary-glow': 'rgba(79,70,229,0.6)',
  'primary-subtle': 'rgba(79,70,229,0.12)',
  success: '#10b981',
  'success-glow': 'rgba(16,185,129,0.5)',
  error: '#DC2626',
};

function AgentCard({ agentId, status, findingsCount, index }: {
  agentId: string;
  status:  AgentStatus['status'] | 'waiting';
  findingsCount: number;
  index: number;
}) {
  const isWaiting  = status === 'waiting';
  const isRunning  = status === 'running';
  const isComplete = status === 'complete';
  const isError    = status === 'error';
  const [justCompleted, setJustCompleted] = useState(false);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (prevStatusRef.current !== 'complete' && status === 'complete') {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 600);
      return () => clearTimeout(t);
    }
    prevStatusRef.current = status;
  }, [status]);

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: isRunning ? THEME['primary-subtle']
              : isComplete ? 'rgba(16,185,129,0.06)'
              : 'rgba(255,255,255,0.02)',
    border: `1px solid ${
      isRunning ? `${THEME.primary}40`
      : isComplete ? 'rgba(16,185,129,0.2)'
      : isError ? 'rgba(220,38,38,0.3)'
      : 'rgba(255,255,255,0.06)'
    }`,
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isRunning ? `0 0 20px ${THEME['primary-glow']}08` : 'none',
    animation: isComplete && justCompleted ? 'completePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
    opacity: isWaiting ? 0.5 : 1,
    animationDelay: isWaiting ? `${index * 0.03}s` : '0s',
  };

  return (
    <div style={cardStyle}>
      <div style={{
        position: 'relative',
        width: '16px',
        height: '16px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isWaiting && (
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
          }} />
        )}
        {isRunning && (
          <>
            <div style={{
              position: 'absolute',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: `2px solid ${THEME.primary}`,
              borderTopColor: 'transparent',
              animation: 'agentSpin 0.8s linear infinite',
            }} />
            <div style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: THEME.primary,
              boxShadow: `0 0 6px ${THEME['primary-glow']}`,
            }} />
          </>
        )}
        {isComplete && (
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: THEME.success,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: justCompleted ? `0 0 12px ${THEME['success-glow']}` : 'none',
            transition: 'box-shadow 0.5s ease',
          }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {isError && (
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: THEME.error,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      <span style={{
        fontSize: '11px',
        fontWeight: isRunning ? 600 : 500,
        color: isRunning ? THEME.primary
             : isComplete ? '#e2e8f0'
             : isError ? THEME.error
             : 'rgba(255,255,255,0.6)',
        flex: 1,
        transition: 'color 0.3s ease',
      }}>
        {AGENT_NAMES[agentId] ?? agentId}
      </span>

      {isRunning && (
        <div style={{
          width: '3px',
          height: '3px',
          borderRadius: '50%',
          background: THEME.primary,
          boxShadow: `0 0 6px ${THEME['primary-glow']}`,
        }} />
      )}

      {isComplete && (
        <span style={{
          fontSize: '10px',
          padding: '2px 7px',
          borderRadius: '5px',
          background: findingsCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
          color: findingsCount > 0 ? '#f59e0b' : '#10b981',
          fontWeight: 600,
          letterSpacing: '0.2px',
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
  const runningCount   = agentStatuses.filter((a) => a.status === 'running').length;
  const totalAgents = ALL_AGENT_IDS.length;
  const progressPct = (completedCount / totalAgents) * 100;

  return (
    <>
      <style>{`
        @keyframes agentSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes completePop {
          0% { transform: scale(1); }
          50% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes radarPulse {
          0% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.6; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        padding: '32px 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        minHeight: '100vh',
        background: '#030712',
      }}>
        {/* Radar + branding */}
        <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '1px solid rgba(79,70,229,0.15)',
            borderRadius: '50%',
            animation: 'radarPulse 3s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            inset: '8px',
            border: '1px dashed rgba(79,70,229,0.2)',
            borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute',
            width: '50%',
            height: '50%',
            top: '25%',
            left: '25%',
            background: `conic-gradient(from 0deg, transparent 60%, ${THEME.primary}40 80%, transparent 100%)`,
            borderRadius: '50%',
            animation: 'sweep 2.5s linear infinite',
            mask: 'radial-gradient(circle at 50% 50%, transparent 35%, black 36%)',
            WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 35%, black 36%)',
          }} />
          <div style={{
            position: 'absolute',
            inset: '22px',
            borderRadius: '50%',
            background: THEME['primary-subtle'],
            border: `1.5px solid ${THEME.primary}30`,
          }} />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 700,
            margin: '0 0 4px 0',
            letterSpacing: '-0.2px',
            color: '#f1f5f9',
          }}>
            Agent Scan in Progress
          </h2>
          <p style={{ fontSize: '11px', opacity: 0.45, margin: 0 }}>
            {completedCount} / {totalAgents} agents complete
            {runningCount > 0 && ` · ${runningCount} active`}
          </p>
        </div>

        {/* Progress bar with shimmer */}
        <div style={{
          width: '100%',
          maxWidth: '480px',
          height: '4px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${THEME.primary}, #818CF8)`,
            borderRadius: '4px',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: `0 0 8px ${THEME['primary-glow']}`,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {progressPct < 100 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                animation: 'shimmer 1.5s ease-in-out infinite',
              }} />
            )}
          </div>
        </div>

        {/* Agent grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '8px',
          width: '100%',
          maxWidth: '560px',
        }}>
          {ALL_AGENT_IDS.map((id, i) => {
            const agent = statusMap.get(id);
            return (
              <div key={id} style={{
                animation: 'fadeSlideUp 0.4s ease both',
                animationDelay: `${i * 0.04}s`,
              }}>
                <AgentCard
                  agentId={id}
                  index={i}
                  status={agent?.status ?? 'waiting'}
                  findingsCount={agent?.findingsCount ?? 0}
                />
              </div>
            );
          })}
        </div>

        {/* Status footer */}
        <p style={{
          fontSize: '9px',
          opacity: 0.25,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          marginTop: '4px',
        }}>
          {completedCount === totalAgents ? 'Compilation complete' : 'Scanning codebase across 11 vectors'}
        </p>
      </div>
    </>
  );
}
