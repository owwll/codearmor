import React from 'react';

interface Props {
  onFilter:  (severity: string | null) => void;
  active:    string | null;
  counts:    { critical: number; warning: number; info: number };
}

const FILTERS = [
  { value: null,       label: 'All',      emoji: '🛡️',  color: 'rgba(79,70,229,0.08)', activeColor: 'rgba(79,70,229,0.25)' },
  { value: 'CRITICAL', label: 'Critical', emoji: '🔴',  color: 'rgba(220,38,38,0.15)',  activeColor: 'rgba(220,38,38,0.4)'  },
  { value: 'WARNING',  label: 'Warning',  emoji: '🟡',  color: 'rgba(217,119,6,0.15)',  activeColor: 'rgba(217,119,6,0.4)'  },
  { value: 'INFO',     label: 'Info',     emoji: '🔵',  color: 'rgba(2,132,199,0.15)',  activeColor: 'rgba(2,132,199,0.4)'  },
] as const;

function getCount(value: typeof FILTERS[number]['value'], counts: Props['counts']): number | null {
  if (value === null)        return null;
  if (value === 'CRITICAL')  return counts.critical;
  if (value === 'WARNING')   return counts.warning;
  return counts.info;
}

export function FilterBar({ onFilter, active, counts }: Props) {
  const wrapStyle: React.CSSProperties = {
    display:    'flex',
    gap:        '8px',
    flexWrap:   'wrap',
    padding:    '12px 0',
  };

  return (
    <div style={wrapStyle} role="group" aria-label="Filter findings by severity">
      {FILTERS.map(({ value, label, emoji, color, activeColor }) => {
        const isActive = active === value;
        const count    = getCount(value, counts);

        const btnStyle: React.CSSProperties = {
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '6px',
          padding:      '5px 12px',
          borderRadius: '20px',
          border:       `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
          background:   isActive ? activeColor : color,
          color:        'inherit',
          fontSize:     '12px',
          cursor:       'pointer',
          fontFamily:   'var(--vscode-font-family)',
          fontWeight:   isActive ? 600 : 400,
          transition:   'all 0.15s ease',
          userSelect:   'none',
          whiteSpace:   'nowrap',
        };

        const badgeStyle: React.CSSProperties = {
          background:   isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding:      '1px 7px',
          fontSize:     '11px',
          fontWeight:   600,
          minWidth:     '20px',
          textAlign:    'center',
        };

        return (
          <button
            key={String(value)}
            style={btnStyle}
            onClick={() => onFilter(value)}
            aria-pressed={isActive}
          >
            <span>{emoji}</span>
            <span>{label}</span>
            {count !== null && <span style={badgeStyle}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
