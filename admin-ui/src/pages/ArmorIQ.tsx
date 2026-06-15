import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  ShieldCheck, ShieldAlert, Brain, Bot, Zap, CheckCircle2,
  Circle, Lock, ChevronRight, Activity
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface ServiceStatus {
  mode: string;
  endpoint: string;
  keyConfigured: boolean;
}
interface IntegrationStatus {
  armoriq: ServiceStatus;
  armorclaw: ServiceStatus;
  llm: { provider: string; model: string; keyConfigured: boolean };
}
interface Agent { id: string; name: string; role: string }
interface FlowStep { step: number; title: string; description: string }

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ mode, keyConfigured }: { mode: string; keyConfigured: boolean }) {
  const isLive = mode === 'live' && keyConfigured;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
      ${isLive
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
      {isLive ? 'Live' : 'Mock Mode'}
    </span>
  );
}

function ServiceCard({ title, icon: Icon, iconColor, status, detail }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  status: ServiceStatus | { provider: string; model: string; keyConfigured: boolean };
  detail: string;
}) {
  const mode = 'mode' in status ? status.mode : (status.keyConfigured ? 'live' : 'mock');
  const key  = status.keyConfigured;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md hover:border-slate-200 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <StatusBadge mode={mode} keyConfigured={key} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
      </div>
      <div className="text-xs font-mono bg-slate-50 rounded-lg px-3 py-2 text-slate-500 truncate border border-slate-100">
        {'endpoint' in status ? status.endpoint : `model: ${status.model}`}
      </div>
    </div>
  );
}

function FlowTimeline({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="relative border-l border-indigo-100 space-y-6 ml-3">
      {steps.map((s) => (
        <li key={s.step} className="ms-6">
          <span className="absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-md shadow-indigo-500/25 ring-4 ring-white">
            {s.step}
          </span>
          <div className="bg-white rounded-xl border border-slate-100 p-4 hover:border-indigo-100 hover:shadow-sm transition-all duration-200">
            <p className="text-sm font-semibold text-slate-800 mb-1">{s.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function AgentGrid({ agents }: { agents: Agent[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {agents.map((a) => (
        <div key={a.id}
          className="flex items-start gap-3 bg-white rounded-xl border border-slate-100 p-4 hover:border-indigo-100 hover:shadow-sm transition-all duration-200 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
            <Bot className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{a.role}</p>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArmorIQ() {
  const [status,  setStatus]  = useState<IntegrationStatus | null>(null);
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [flow,    setFlow]    = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, a, f] = await Promise.all([
          api.getArmorIQStatus(),
          api.getArmorIQAgents(),
          api.getArmorIQFlow(),
        ]);
        setStatus(s);
        setAgents(a.agents);
        setFlow(f.steps);
      } catch {
        setError('Could not load integration status. Ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Activity className="w-8 h-8 animate-pulse" />
          <p className="text-sm">Loading integration status…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-rose-400">
          <ShieldAlert className="w-8 h-8" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const allConfigured = status?.armoriq.keyConfigured && status?.armorclaw.keyConfigured && status?.llm.keyConfigured;

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">ArmorIQ & ArmorClaw</h1>
            </div>
            <p className="text-sm text-slate-500">
              Cryptographic intent enforcement and prompt-injection defense for all 11 AI agents
            </p>
          </div>
          <div className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border shadow-sm
            ${allConfigured
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50  text-amber-700  border-amber-200'}`}>
            {allConfigured
              ? <><CheckCircle2 className="w-4 h-4" /> Fully Live</>
              : <><Circle      className="w-4 h-4" /> Running in Mock Mode</>}
          </div>
        </div>

        {/* ── Mock mode notice ── */}
        {!allConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
            <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Running in Mock Mode</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                ArmorIQ and ArmorClaw are active and protecting every scan — all intent verification,
                file-access control, and prompt-injection checks are operational with built-in mock logic.
                To connect to the live ArmorIQ platform, add your API key to{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">ARMORIQ_API_KEY</code>{' '}in the backend <code className="font-mono bg-amber-100 px-1 rounded">.env</code> and restart the server.
              </p>
            </div>
          </div>
        )}

        {/* ── Service status cards ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Integration Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {status && <>
              <ServiceCard
                title="ArmorIQ"
                icon={ShieldCheck}
                iconColor="bg-indigo-600"
                status={status.armoriq}
                detail="Intent Access Proxy — plan capture, delegation tokens, invoke verification"
              />
              <ServiceCard
                title="ArmorClaw"
                icon={Lock}
                iconColor="bg-violet-600"
                status={status.armorclaw}
                detail="Validator — prompt-injection detection and finding quality enforcement"
              />
              <ServiceCard
                title={status.llm.provider}
                icon={Brain}
                iconColor="bg-sky-600"
                status={status.llm}
                detail="LLM powering all 11 AI security agents via HuggingFace Inference API"
              />
            </>}
          </div>
        </section>

        {/* ── Security flow + agents grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Security flow */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Security Flow Per Scan</h2>
            {flow.length > 0
              ? <FlowTimeline steps={flow} />
              : <p className="text-sm text-slate-400">No flow data.</p>}
          </section>

          {/* Agent roster */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Protected AI Agents</h2>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                {agents.length} agents
              </span>
            </div>
            {agents.length > 0
              ? <AgentGrid agents={agents} />
              : <p className="text-sm text-slate-400">No agents found.</p>}
          </section>
        </div>

      </div>
    </div>
  );
}
