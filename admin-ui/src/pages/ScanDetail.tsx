import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ScanResult, Finding } from '../api/client';
import { ArrowLeft, Download, ShieldAlert, AlertTriangle, Info, Layers, ChevronDown, ChevronUp, FileCode2, Tag } from 'lucide-react';

function sevClass(sev: string) {
  const m: Record<string, { badge: string; border: string; label: string }> = {
    CRITICAL: { badge: 'badge-critical', border: 'border-l-armor-critical', label: 'text-armor-critical' },
    WARNING: { badge: 'badge-warning', border: 'border-l-armor-warning', label: 'text-armor-warning' },
    INFO: { badge: 'badge-info', border: 'border-l-armor-info', label: 'text-armor-info' },
  };
  return m[sev] ?? m.INFO;
}

function fmtDuration(ms?: number): string {
  if (!ms) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = circ - (circ * score) / 100;
  const color = score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={100} height={100} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth={8} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute text-center">
        <span className={`text-2xl font-bold ${score >= 80 ? 'text-armor-success' : score >= 50 ? 'text-armor-warning' : 'text-armor-critical'}`}>{score}</span>
        <span className="block text-[8px] text-slate-400 uppercase tracking-wider font-medium">score</span>
      </div>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const fileBasename = finding.file?.split('/').pop() ?? 'file';
  const sev = sevClass(finding.severity);

  return (
    <div className={`card overflow-hidden mb-3 border-l-2 ${finding.severity === 'CRITICAL' ? 'border-l-armor-critical' : finding.severity === 'WARNING' ? 'border-l-armor-warning' : 'border-l-armor-info'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className={`badge ${sev.badge}`}>{finding.severity}</span>
        <span className="text-sm text-slate-800 font-medium flex-1 truncate">{finding.title}</span>
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-xs shrink-0 font-mono">
          <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{fileBasename}:{finding.line}</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-xs shrink-0">
          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{finding.category}</span>
        </div>
        <span className="text-slate-300 shrink-0">
          {open ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4 bg-slate-50/50">
          <div className="space-y-1">
            <h4 className="text-xs text-slate-400 font-medium">Description</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{finding.description}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {finding.impact && (
              <div className="bg-armor-critical-subtle border border-armor-critical-border rounded-md p-3.5">
                <h4 className="text-xs text-armor-critical font-medium mb-1">Impact</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{finding.impact}</p>
              </div>
            )}
            {finding.fix && (
              <div className="bg-armor-success-subtle border border-armor-success-border rounded-md p-3.5">
                <h4 className="text-xs text-armor-success font-medium mb-1">Recommended Fix</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{finding.fix}</p>
              </div>
            )}
          </div>
          {finding.codeSnippet && (
            <div className="space-y-1.5">
              <h4 className="text-xs text-slate-400 font-medium">Vulnerable Code</h4>
              <pre className="bg-slate-900 rounded-md p-4 text-xs text-slate-200 overflow-x-auto"><code>{finding.codeSnippet}</code></pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScanDetailSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-start gap-6">
        <div className="h-9 w-9 bg-slate-200 rounded-md shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-7 w-64 bg-slate-200 rounded-md" />
          <div className="h-4 w-96 bg-slate-100 rounded-md" />
          <div className="h-4 w-48 bg-slate-100 rounded-md" />
        </div>
        <div className="h-24 w-24 bg-slate-100 rounded-full shrink-0" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-md" />
        ))}
      </div>
      <div className="h-32 bg-slate-100 rounded-md" />
      <div className="h-48 bg-slate-100 rounded-md" />
    </div>
  );
}

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getScanById(id).then(setScan).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ScanDetailSkeleton />;

  if (!scan) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="p-8 card max-w-lg mx-auto mt-12 text-center">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-armor-critical" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">Scan not found.</p>
        </div>
      </div>
    );
  }

  const exportJson = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 200));
    const blob = new Blob([JSON.stringify(scan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `scan-${id}.json` });
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const sorted = [...(scan.findings ?? [])].sort((a, b) => {
    const ord: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-6 flex-wrap justify-between border-b border-slate-200 pb-6">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-secondary px-3 py-2 mt-1" aria-label="Go back">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{scan.projectName}</h1>
            <p className="text-xs text-slate-400 font-mono mt-1 truncate max-w-lg" title={scan.projectPath}>{scan.projectPath}</p>
            <p className="text-xs text-slate-400 mt-2">
              {new Date(scan.startedAt).toLocaleString()} · {fmtDuration(scan.durationMs)}
              {scan.armorIqPlanId && (
                <span className="ml-3 badge badge-info">Plan: {String(scan.armorIqPlanId).slice(0, 8)}…</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <ScoreRing score={scan.score} />
          <button onClick={exportJson} disabled={exporting} className="btn btn-secondary">
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} aria-hidden="true" />
            <span>{exporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical', val: scan.summary?.critical ?? scan.criticalCount, cls: 'text-armor-critical bg-armor-critical-subtle border-armor-critical/20', icon: ShieldAlert },
          { label: 'Warning', val: scan.summary?.warning ?? scan.warningCount, cls: 'text-armor-warning bg-armor-warning-subtle border-armor-warning/20', icon: AlertTriangle },
          { label: 'Info', val: scan.summary?.info ?? scan.infoCount, cls: 'text-armor-info bg-armor-info-subtle border-armor-info/20', icon: Info },
          { label: 'Total', val: scan.summary?.total ?? scan.totalFindings, cls: 'text-slate-700 bg-white border-slate-200', icon: Layers },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`border rounded-md p-4 flex items-center justify-between ${c.cls}`}>
              <div>
                <p className="text-2xl font-bold font-mono leading-none mb-1">{c.val ?? 0}</p>
                <p className="text-xs font-medium opacity-80">{c.label}</p>
              </div>
              <Icon className="w-5 h-5 opacity-60" aria-hidden="true" />
            </div>
          );
        })}
      </div>

      {/* Agent results */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Agent Results</h2>
        {scan.agentStatuses?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {scan.agentStatuses.map((a) => (
              <div key={a.agentId} className="flex items-center justify-between bg-slate-50 rounded-md px-4 py-3 border border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'complete' ? 'bg-armor-success' : a.status === 'error' ? 'bg-armor-critical' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-700 font-medium truncate">{a.agentName}</span>
                </div>
                <span className="text-xs font-mono text-slate-400">{a.findingsCount ?? 0}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Layers className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium">No agent data</p>
            <p className="text-xs mt-0.5">Agent results will appear after scan completion.</p>
          </div>
        )}
      </div>

      {/* Findings */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Findings ({sorted.length})</h2>
        {sorted.length === 0 ? (
          <div className="text-center py-16 card text-slate-400">
            <p className="text-sm font-medium">No vulnerabilities found.</p>
            <p className="text-xs mt-1">All security checks passed.</p>
          </div>
        ) : (
          <div>{sorted.map((f) => <FindingRow key={f.id} finding={f} />)}</div>
        )}
      </div>
    </div>
  );
}
