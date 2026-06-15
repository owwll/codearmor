import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ScanResult } from '../api/client';
import { ArrowLeft, Download, ShieldAlert, AlertTriangle, Info, Layers, ChevronDown, ChevronUp, FileCode2, Tag } from 'lucide-react';

function scoreBgColor(s: number) {
  if (s >= 80) return '#22C55E'; // green
  if (s >= 50) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

function scoreTextColor(s: number) {
  if (s >= 80) return 'text-[#22C55E]';
  if (s >= 50) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

function scoreBgClass(s: number) {
  if (s >= 80) return 'bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]';
  if (s >= 50) return 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]';
  return 'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]';
}

function sevBadge(sev: string) {
  const m: Record<string, string> = {
    CRITICAL: 'bg-[#EF4444]/10 border-[#EF4444]/25 text-[#EF4444]',
    WARNING:  'bg-[#F59E0B]/10 border-[#F59E0B]/25 text-[#F59E0B]',
    INFO:     'bg-[#06B6D4]/10 border-[#06B6D4]/25 text-[#06B6D4]',
  };
  return m[sev] ?? m.INFO;
}

function fmtDuration(ms?: number): string {
  if (!ms) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Score ring (SVG) ──────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 40; 
  const circ = 2 * Math.PI * r;
  const dash = circ - (circ * score) / 100;
  const color = scoreBgColor(score);
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth={8} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute text-center">
        <span className={`text-2xl font-black ${scoreTextColor(score)} font-display`}>{score}</span>
        <span className="block text-[8px] text-slate-400 uppercase tracking-widest font-bold">score</span>
      </div>
    </div>
  );
}

// ── Expandable finding card ───────────────────────────────────────────────────
function FindingRow({ finding }: { finding: any }) {
  const [open, setOpen] = useState(false);
  const fileBasename = finding.file?.split('/').pop() ?? 'file';

  return (
    <div className="glass-card overflow-hidden mb-3 border border-slate-200 hover:border-slate-300 transition-all duration-150 shadow-sm bg-white">
      <button 
        onClick={() => setOpen(o => !o)} 
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className={`text-xs border rounded-lg px-2.5 py-1 font-bold shrink-0 uppercase tracking-wider ${sevBadge(finding.severity)}`}>
          {finding.severity}
        </span>
        <span className="text-sm text-slate-800 font-bold flex-1 truncate">{finding.title}</span>
        
        <div className="hidden sm:flex items-center gap-1.5 text-slate-650 text-xs shrink-0 font-mono bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
          <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{fileBasename}:{finding.line}</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-slate-650 text-xs shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
          <Tag className="w-3.5 h-3.5 text-slate-400" />
          <span>{finding.category}</span>
        </div>

        <span className="text-slate-450 text-xs shrink-0">
          {open ? <ChevronUp className="w-4 h-4 text-slate-650" /> : <ChevronDown className="w-4 h-4 text-slate-650" />}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-200 pt-4 bg-[#F8FAFC]">
          <div className="space-y-1">
            <h4 className="text-[10px] uppercase text-slate-450 font-bold tracking-wider">Description</h4>
            <p className="text-xs text-slate-700 leading-relaxed">{finding.description}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {finding.impact && (
              <div className="bg-[#EF4444]/5 border border-[#EF4444]/15 rounded-xl p-3.5">
                <h4 className="text-[10px] uppercase text-[#EF4444] font-bold tracking-wider mb-1">Impact Analysis</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{finding.impact}</p>
              </div>
            )}
            {finding.fix && (
              <div className="bg-[#22C55E]/5 border border-[#22C55E]/15 rounded-xl p-3.5">
                <h4 className="text-[10px] uppercase text-[#22C55E] font-bold tracking-wider mb-1">Recommended Action</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{finding.fix}</p>
              </div>
            )}
          </div>

          {finding.codeSnippet && (
            <div className="space-y-1.5">
              <h4 className="text-[10px] uppercase text-slate-450 font-bold tracking-wider">Vulnerable Code Segment</h4>
              <pre className="bg-slate-900 rounded-xl p-4 text-xs text-slate-200 overflow-x-auto font-mono">
                <code>{finding.codeSnippet}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ScanDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [scan, setScan]     = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getScanById(id).then(setScan).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
        <span className="text-3xl animate-spin text-indigo-600">🛡️</span>
        <p className="text-xs">Parsing inspection telemetry data...</p>
      </div>
    );
  }
  if (!scan) {
    return (
      <div className="p-8 text-[#EF4444] font-semibold glass-card max-w-lg mx-auto mt-12 text-center bg-white border-slate-200 shadow-md">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-[#EF4444]" />
        Scan execution record not found.
      </div>
    );
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(scan, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `scan-${id}.json` });
    a.click(); URL.revokeObjectURL(url);
  };

  const sorted = [...(scan.findings ?? [])].sort((a, b) => {
    const ord: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none bg-[#F8FAFC]">
      {/* Header / Actions */}
      <div className="flex items-start gap-6 flex-wrap justify-between border-b border-slate-200 pb-6">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2.5 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-250 rounded-xl text-slate-500 transition-all mt-1 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{scan.projectName}</h1>
            <p className="text-xs text-slate-500 font-mono mt-1" title={scan.projectPath}>
              {scan.projectPath}
            </p>
            <p className="text-xs text-slate-500 mt-2 font-semibold">
              Completed {new Date(scan.startedAt).toLocaleString()} · Duration: {fmtDuration(scan.durationMs)}
              {scan.armorIqPlanId && (
                <span className="ml-3 inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-lg text-xs font-mono">
                  CodeArmor Verification: {String(scan.armorIqPlanId).slice(0, 8)}…
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <ScoreRing score={scan.score} />
          <button 
            onClick={exportJson} 
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all duration-200 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-650" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical Severity', val: scan.summary?.critical ?? scan.criticalCount, cls: 'border-[#EF4444]/20 text-[#EF4444] bg-[#EF4444]/5', icon: ShieldAlert },
          { label: 'Warning Severity', val: scan.summary?.warning ?? scan.warningCount, cls: 'border-[#F59E0B]/20 text-[#F59E0B] bg-[#F59E0B]/5', icon: AlertTriangle },
          { label: 'Informational', val: scan.summary?.info ?? scan.infoCount, cls: 'border-[#06B6D4]/20 text-[#06B6D4] bg-[#06B6D4]/5', icon: Info },
          { label: 'Total Gaps Located', val: scan.summary?.total ?? scan.totalFindings, cls: 'border-slate-200 text-slate-700 bg-white shadow-sm', icon: Layers },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`border rounded-xl p-5 flex items-center justify-between ${c.cls}`}>
              <div>
                <p className="text-2xl font-black font-mono leading-none mb-1">{c.val ?? 0}</p>
                <p className="text-[10px] uppercase font-bold opacity-80 tracking-wider">{c.label}</p>
              </div>
              <Icon className="w-6 h-6 opacity-60" />
            </div>
          );
        })}
      </div>

      {/* Agent execution list */}
      {scan.agentStatuses?.length > 0 && (
        <div className="glass-card p-6 bg-white border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Inspection Agent Analysis Sequence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {scan.agentStatuses.map((a: any) => (
              <div key={a.agentId} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'complete' ? 'bg-[#22C55E]' : a.status === 'error' ? 'bg-[#EF4444]' : 'bg-slate-400'}`} />
                  <span className="text-xs text-slate-700 font-bold truncate">{a.agentName}</span>
                </div>
                <span className="text-xs font-bold text-[#F59E0B] font-mono bg-[#F59E0B]/5 px-2 py-0.5 rounded border border-[#F59E0B]/10 shrink-0">
                  {a.findingsCount ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Vulnerability Findings Directory ({sorted.length})</h2>
        {sorted.length === 0 ? (
          <div className="text-center py-16 glass-card text-slate-500 bg-white border-slate-200">
            <p className="text-sm font-semibold text-slate-650">Compliance checklist passed successfully</p>
            <p className="text-xs text-slate-400 mt-1">No security exceptions were identified during execution.</p>
          </div>
        ) : (
          <div>
            {sorted.map((f) => <FindingRow key={f.id} finding={f} />)}
          </div>
        )}
      </div>
    </div>
  );
}
