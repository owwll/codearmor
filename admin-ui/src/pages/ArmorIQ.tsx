import React, { useEffect, useState } from 'react';
import { Skeleton } from '@mui/material';
import { api } from '../api/client';
import {
  ShieldCheck, ShieldAlert, Brain, Bot, Zap, CheckCircle2,
  Circle, Lock, Activity
} from 'lucide-react';

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

function StatusBadge({ mode, keyConfigured }: { mode: string; keyConfigured: boolean }) {
  const isLive = mode === 'live' && keyConfigured;
  return (
    <span className={`badge ${isLive ? 'badge-success' : 'badge-warning'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-armor-success animate-pulse' : 'bg-armor-warning'}`} />
      {isLive ? 'Live' : 'Mock'}
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
  const key = status.keyConfigured;
  return (
    <div className="card p-6 flex flex-col gap-4 hover:border-slate-300 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <StatusBadge mode={mode} keyConfigured={key} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
      </div>
      <div className="text-xs font-mono bg-slate-50 rounded-md px-3 py-2 text-slate-400 truncate border border-slate-100">
        {'endpoint' in status ? status.endpoint : `model: ${status.model}`}
      </div>
    </div>
  );
}

function FlowTimeline({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="relative border-l border-slate-200 space-y-6 ml-3">
      {steps.map((s) => (
        <li key={s.step} className="ms-6 group">
          <span className="absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full bg-armor-primary text-white text-[10px] font-bold ring-4 ring-white group-hover:bg-armor-primary-hover transition-colors">
            {s.step}
          </span>
          <div className="card p-4 group-hover:border-slate-300 transition-all duration-200">
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
          className="flex items-start gap-3 card p-4 hover:border-slate-200 transition-colors group">
          <div className="w-8 h-8 rounded-md bg-armor-primary-subtle flex items-center justify-center shrink-0 group-hover:bg-armor-primary-subtle">
            <Bot className="w-4 h-4 text-armor-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{a.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{a.role}</p>
          </div>
          <ShieldCheck className="w-4 h-4 text-armor-success shrink-0 mt-0.5 ml-auto" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

export default function ArmorIQ() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [flow, setFlow] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError('Could not load integration status.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton variant="text" width={200} height={28} sx={{ bgcolor: '#F1F5F9', borderRadius: '4px' }} />
              <Skeleton variant="text" width={300} height={16} sx={{ bgcolor: '#F1F5F9', borderRadius: '4px' }} />
            </div>
            <Skeleton variant="rounded" width={100} height={28} sx={{ bgcolor: '#F1F5F9', borderRadius: '6px' }} />
          </div>
          <Skeleton variant="rounded" width="100%" height={80} sx={{ bgcolor: '#F1F5F9', borderRadius: '8px' }} />
          <div className="space-y-4">
            <Skeleton variant="text" width={140} height={12} sx={{ bgcolor: '#F1F5F9', borderRadius: '4px' }} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" width="100%" height={160} sx={{ bgcolor: '#F1F5F9', borderRadius: '8px' }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Skeleton variant="text" width={100} height={12} sx={{ bgcolor: '#F1F5F9', borderRadius: '4px' }} />
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" width="100%" height={80} sx={{ bgcolor: '#F1F5F9', borderRadius: '8px' }} />
              ))}
            </div>
            <div className="space-y-4">
              <Skeleton variant="text" width={100} height={12} sx={{ bgcolor: '#F1F5F9', borderRadius: '4px' }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rounded" width="100%" height={72} sx={{ bgcolor: '#F1F5F9', borderRadius: '8px' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-armor-critical">
          <ShieldAlert className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const allConfigured = status.armoriq.keyConfigured && status.armorclaw.keyConfigured && status.llm.keyConfigured;

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-armor-primary" aria-hidden="true" />
              <h1 className="text-xl font-bold text-slate-900">ArmorIQ & ArmorClaw</h1>
            </div>
            <p className="text-sm text-slate-500">AI agent orchestration and verification platform.</p>
          </div>
          <div className={`badge ${allConfigured ? 'badge-success' : 'badge-warning'}`}>
            {allConfigured
              ? <><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Fully Live</>
              : <><Circle className="w-4 h-4" aria-hidden="true" /> Mock Mode</>}
          </div>
        </div>

        {!allConfigured && (
          <div className="bg-armor-warning-subtle border border-armor-warning-border rounded-md p-5 flex gap-4">
            <Zap className="w-5 h-5 text-armor-warning shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-armor-warning mb-1">Running in Mock Mode</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Intent verification and prompt-injection checks are operational with built-in mock logic.
                To connect to the live ArmorIQ platform, add your API key to{' '}
                <code className="font-mono bg-armor-warning-subtle px-1 rounded">ARMORIQ_API_KEY</code>{' '}
                in the backend <code className="font-mono bg-armor-warning-subtle px-1 rounded">.env</code>.
              </p>
            </div>
          </div>
        )}

        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Integration Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ServiceCard
              title="ArmorIQ"
              icon={ShieldCheck}
              iconColor="bg-armor-primary"
              status={status.armoriq}
              detail="Intent proxy — plan capture, delegation, invoke verification"
            />
            <ServiceCard
              title="ArmorClaw"
              icon={Lock}
              iconColor="bg-violet-600"
              status={status.armorclaw}
              detail="Validator — prompt-injection detection, finding quality"
            />
            <ServiceCard
              title={status.llm.provider}
              icon={Brain}
              iconColor="bg-sky-600"
              status={status.llm}
              detail="LLM powering all 11 AI agents via HuggingFace"
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">Security Flow</h2>
            {flow.length > 0
              ? <FlowTimeline steps={flow} />
              : <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Activity className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
                  <p className="text-sm font-medium">No flow data</p>
                  <p className="text-xs mt-0.5">Security flow will populate after first scan.</p>
                </div>}
          </section>

          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Agents</h2>
              <span className="badge badge-info">{agents.length} agents</span>
            </div>
            {agents.length > 0
              ? <AgentGrid agents={agents} />
              : <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Bot className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
                  <p className="text-sm font-medium">No agents found</p>
                  <p className="text-xs mt-0.5">Agents will be listed once the platform is configured.</p>
                </div>}
          </section>
        </div>
      </div>
    </div>
  );
}
