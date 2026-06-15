import React, { useEffect, useState } from 'react';
import { FolderGit2, Star, Calendar, ArrowUpRight } from 'lucide-react';
import { api, Project } from '../api/client';

function scoreBadge(score?: number) {
  if (!score) return 'text-slate-500 bg-slate-100 border-slate-200';
  if (score >= 80) return 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20';
  if (score >= 50) return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20';
  return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.getProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Monitored Repositories</h1>
          <p className="text-sm text-slate-500">Platform workspaces checked out and inspected under active intelligence protocols.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm">
          <FolderGit2 className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-650">
            <span className="text-slate-900 font-mono font-extrabold">{projects.length}</span> Active Workspaces
          </span>
        </div>
      </div>

      {/* Projects Grid/Table Card */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <span className="text-2xl animate-spin text-indigo-650">🛡️</span>
            <p className="text-xs text-slate-500">Loading active projects...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cyber-table">
              <thead>
                <tr>
                  {['Project Name', 'Repository Path', 'Total Inspect Runs', 'Last Compliance Score', 'Last Updated'].map((h) => (
                    <th key={h} className="text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-slate-500 bg-white">
                      <FolderGit2 className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                      <p className="text-sm font-semibold">No projects scanned yet</p>
                    </td>
                  </tr>
                )}
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                          <FolderGit2 className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-slate-900 font-bold text-sm">{p.projectName}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 text-xs font-mono max-w-[280px] truncate" title={p.projectPath}>
                      {p.projectPath}
                    </td>
                    <td className="text-slate-700 font-bold font-mono text-sm pl-6">{p.scanCount ?? 0}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-0.5 font-bold ${scoreBadge(p.lastScore)}`}>
                        {p.lastScore ?? '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
