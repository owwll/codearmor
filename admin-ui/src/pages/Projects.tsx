import React, { useEffect, useState } from 'react';
import { FolderGit2, Calendar, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, Project } from '../api/client';

function scoreBadge(score?: number) {
  if (!score) return 'text-slate-400';
  if (score >= 80) return 'badge-success';
  if (score >= 50) return 'badge-warning';
  return 'badge-critical';
}

function ProjectsSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-slate-200 rounded-md" />
          <div className="h-4 w-48 bg-slate-100 rounded-md" />
        </div>
        <div className="h-9 w-24 bg-slate-100 rounded-md" />
      </div>
      <div className="h-[300px] bg-slate-100 rounded-md" />
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProjects()
      .then(setProjects)
      .catch(() => setError('Failed to load projects.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProjectsSkeleton />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">{error ? 'Could not load projects.' : `${projects.length} project${projects.length !== 1 ? 's' : ''} monitored.`}</p>
        </div>
      </div>

      {error ? (
        <div className="card p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-armor-critical" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700 mb-3">{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary btn-sm">Retry</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {projects.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FolderGit2 className="w-10 h-10 mx-auto mb-3 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium">No projects scanned yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Project', 'Path', 'Scans', 'Last Score', 'Updated', ''].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="group">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-armor-primary-subtle text-armor-primary flex items-center justify-center shrink-0">
                            <FolderGit2 className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <span className="text-slate-900 font-medium text-sm">{p.projectName}</span>
                        </div>
                      </td>
                      <td className="text-slate-400 text-xs font-mono max-w-[280px] truncate" title={p.projectPath}>{p.projectPath}</td>
                      <td className="text-slate-700 font-semibold font-mono text-sm">{p.scanCount ?? 0}</td>
                      <td>
                        {p.lastScore ? (
                          <span className={`badge ${scoreBadge(p.lastScore)}`}>{p.lastScore}</span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}</span>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/scans?project=${p.id}`}
                          className="btn btn-secondary px-3 py-1.5 text-xs group-hover:border-slate-300 transition-colors"
                        >
                          View scans <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
