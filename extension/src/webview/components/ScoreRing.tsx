import React, { useEffect, useRef } from 'react';

interface Props {
  score: number;
}

function getColor(score: number): string {
  if (score >= 80) return '#4CAF50';
  if (score >= 50) return '#FF9800';
  return '#F44336';
}

const SIZE        = 120;
const STROKE_W    = 10;
const RADIUS      = (SIZE - STROKE_W) / 2;
const CIRCUMF     = 2 * Math.PI * RADIUS;

export function ScoreRing({ score }: Props) {
  const circleRef = useRef<SVGCircleElement>(null);
  const color     = getColor(score);
  const clamped   = Math.max(0, Math.min(100, score));

  // Animate the ring filling on mount / score change
  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;

    // Start from empty
    el.style.transition = 'none';
    el.style.strokeDashoffset = String(CIRCUMF);

    // Force reflow then animate
    void el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    el.style.strokeDashoffset = String(CIRCUMF - (CIRCUMF * clamped) / 100);
  }, [clamped]);

  const containerStyle: React.CSSProperties = {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '8px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize:   '11px',
    opacity:    0.65,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  };

  const scoreStyle: React.CSSProperties = {
    fontSize:   '26px',
    fontWeight: 700,
    color,
    lineHeight: 1,
  };

  return (
    <div style={containerStyle}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE_W}
        />
        {/* Progress */}
        <circle
          ref={circleRef}
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          strokeDasharray={CIRCUMF}
          strokeDashoffset={CIRCUMF}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        {/* Score text */}
        <text
          x="50%" y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill={color}
          fontSize="26"
          fontWeight="700"
          style={{ fontFamily: 'var(--vscode-font-family)' }}
        >
          {clamped}
        </text>
      </svg>
      <span style={labelStyle}>Security Score</span>
    </div>
  );
}
