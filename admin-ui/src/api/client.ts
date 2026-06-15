import axios, { AxiosInstance } from 'axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  overview: { totalScans: number; totalFindings: number; avgScore: number; projectCount: number };
  severityBreakdown: { severity: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
}

export interface ScanRecord {
  id: string;
  projectName: string;
  projectPath: string;
  score: number;
  status: string;
  totalFindings: number;
  criticalCount: number;
  warningCount:  number;
  infoCount:     number;
  startedAt:     string;
  completedAt?:  string;
  durationMs?:   number;
  armorIqPlanId?: string;
}

export interface ScanResult extends ScanRecord {
  findings:      any[];
  agentStatuses: any[];
  projectName?:  string;
  projectPath?:  string;
  startedAt?:    string;
  durationMs?:   number;
  summary?: {
    critical: number;
    warning:  number;
    info:     number;
    total:    number;
  };
}

export interface Project {
  id: string;
  projectPath: string;
  projectName: string;
  lastScore?:  number;
  scanCount:   number;
  updatedAt?:  string;
}

export interface AuditEntry {
  id:               string;
  scanId?:         string;
  eventType:       string;
  agentName?:      string;
  action:           string;
  target?:          string;
  result?:          string;
  armorIqPlanId?:string;
  createdAt?:      string;
}

export interface UsageEntry {
  userId:       string;
  username:     string;
  plan:         string;
  role:         string;
  scansToday:   number;
  limit:        number | null;    // null = unlimited
  remaining:    number | null;
  lastScanDate: string | null;
  createdAt?:   string;
}

// ── Axios instance ────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3847';
const TOKEN_KEY = 'codearmor_token';

const http: AxiosInstance = axios.create({ baseURL: BASE_URL });

// Attach token on every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 clear token and redirect to login
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Typed API functions ───────────────────────────────────────────────────────

export const api = {
  login: async (username: string, password: string) => {
    const { data } = await http.post('/api/auth/login', { username, password });
    return data as { token: string; user: { id: string; username: string; role: string; plan: string } };
  },

  signup: async (username: string, password: string) => {
    const { data } = await http.post('/api/auth/signup', { username, password });
    return data as { success: boolean; user: { id: string; username: string; role: string; plan: string } };
  },

  getStats: async (): Promise<DashboardStats> => {
    const { data } = await http.get('/api/admin/stats');
    return data;
  },

  getScans: async (page = 1, limit = 20): Promise<{ scans: ScanRecord[]; total: number }> => {
    const { data } = await http.get(`/api/scan/list?page=${page}&limit=${limit}`);
    return data;
  },

  getScanById: async (id: string): Promise<ScanResult> => {
    const { data } = await http.get(`/api/scan/${id}`);
    return data;
  },

  getProjects: async (): Promise<Project[]> => {
    const { data } = await http.get('/api/admin/projects');
    return data.projects ?? data;
  },

  getAuditLog: async (scanId?: string): Promise<AuditEntry[]> => {
    const qs = scanId ? `?scanId=${scanId}` : '';
    const { data } = await http.get(`/api/admin/audit-log${qs}`);
    return data.events ?? data;
  },

  getUsers: async (): Promise<any> => {
    const { data } = await http.get('/api/admin/users');
    return data;
  },

  updateUserPlan: async (userId: string, plan: 'free' | 'pro'): Promise<any> => {
    const { data } = await http.post(`/api/admin/users/${userId}/plan`, { plan });
    return data;
  },

  updateUserRole: async (userId: string, role: 'user' | 'admin'): Promise<any> => {
    const { data } = await http.post(`/api/admin/users/${userId}/role`, { role });
    return data;
  },

  getArmorIQStatus: async () => {
    const { data } = await http.get('/api/armoriq/status');
    return data as {
      armoriq:   { mode: string; endpoint: string; keyConfigured: boolean };
      armorclaw: { mode: string; endpoint: string; keyConfigured: boolean };
      llm:       { provider: string; model: string; keyConfigured: boolean };
    };
  },

  getArmorIQAgents: async () => {
    const { data } = await http.get('/api/armoriq/agents');
    return data as { agents: { id: string; name: string; role: string }[]; total: number };
  },

  getArmorIQFlow: async () => {
    const { data } = await http.get('/api/armoriq/how-it-works');
    return data as { steps: { step: number; title: string; description: string }[] };
  },

  getUsage: async (): Promise<{ usage: UsageEntry[]; total: number }> => {
    const { data } = await http.get('/api/admin/usage');
    return data;
  },
};

