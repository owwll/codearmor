import { useEffect, useReducer, useCallback } from 'react';
import { Finding, ProgressEvent, ScanResult, WebviewMessage } from '../../types';

// ── VS Code API (singleton) ───────────────────────────────────────────────────

declare function acquireVsCodeApi(): {
  postMessage(msg: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// ── Agent status shape ────────────────────────────────────────────────────────

export interface AgentStatus {
  agentId:       string;
  agentName:     string;
  status:        'waiting' | 'running' | 'complete' | 'error';
  findingsCount: number;
  durationMs?:   number;
}

// ── State ─────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'complete' | 'error';

interface AuthState {
  checked: boolean;
  authenticated: boolean;
  user: any | null;
}

interface State {
  phase:         Phase;
  findings:      Finding[];
  score:         number;
  summary:       ScanResult['summary'];
  agentStatuses: AgentStatus[];
  durationMs:    number | undefined;
  error:         string | undefined;
  projectName:   string | undefined;
  auth:          AuthState;
}

const INITIAL_STATE: State = {
  phase:         'idle',
  findings:      [],
  score:         0,
  summary:       { critical: 0, warning: 0, info: 0, total: 0 },
  agentStatuses: [],
  durationMs:    undefined,
  error:         undefined,
  projectName:   undefined,
  auth: {
    checked: false,
    authenticated: false,
    user: null
  }
};

type Action =
  | { type: 'SCAN_START' }
  | { type: 'AGENT_UPDATE'; event: ProgressEvent }
  | { type: 'SCAN_COMPLETE'; result: ScanResult }
  | { type: 'SCAN_ERROR'; message: string }
  | { type: 'AUTH_STATUS'; payload: { authenticated: boolean; user?: any } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SCAN_START':
      return { ...INITIAL_STATE, phase: 'loading', auth: state.auth };

    case 'AGENT_UPDATE': {
      const { event } = action;
      if (!event.agentId) return state;
      const existing = state.agentStatuses.find((a) => a.agentId === event.agentId);
      const updated: AgentStatus = {
        agentId:       event.agentId,
        agentName:     event.agentName ?? event.agentId,
        status:        event.phase === 'AGENT_COMPLETE' ? 'complete'
                     : event.phase === 'AGENT_START'   ? 'running'
                     : (existing?.status ?? 'waiting'),
        findingsCount: event.findingsCount ?? existing?.findingsCount ?? 0,
        durationMs:    event.durationMs   ?? existing?.durationMs,
      };
      const others = state.agentStatuses.filter((a) => a.agentId !== event.agentId);
      return { ...state, agentStatuses: [...others, updated] };
    }

    case 'SCAN_COMPLETE':
      return {
        ...state,
        phase:       'complete',
        findings:    action.result.findings,
        score:       action.result.score,
        summary:     action.result.summary,
        durationMs:  action.result.durationMs,
        projectName: action.result.projectName,
        error:       undefined,
      };

    case 'SCAN_ERROR':
      return { ...state, phase: 'error', error: action.message };

    case 'AUTH_STATUS':
      return {
        ...state,
        auth: {
          checked: true,
          authenticated: action.payload.authenticated,
          user: action.payload.user || null
        }
      };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFindings() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const sendMessage = useCallback((msg: WebviewMessage) => {
    vscode.postMessage(msg);
  }, []);

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      const msg = ev.data as WebviewMessage;
      switch (msg.type) {
        case 'SCAN_START':    dispatch({ type: 'SCAN_START' }); break;
        case 'AGENT_UPDATE':  dispatch({ type: 'AGENT_UPDATE',  event:   msg.payload }); break;
        case 'SCAN_COMPLETE': dispatch({ type: 'SCAN_COMPLETE', result:  msg.payload }); break;
        case 'SCAN_ERROR':    dispatch({ type: 'SCAN_ERROR',    message: msg.payload.message }); break;
        case 'AUTH_STATUS':   dispatch({ type: 'AUTH_STATUS',   payload: msg.payload }); break;
      }
    };
    window.addEventListener('message', handler);
    
    // Check auth on mount
    sendMessage({ type: 'CHECK_AUTH' });

    return () => window.removeEventListener('message', handler);
  }, [sendMessage]);

  const initiateLogin = useCallback(() => {
    sendMessage({ type: 'INITIATE_LOGIN' });
  }, [sendMessage]);

  const initiateLogout = useCallback(() => {
    sendMessage({ type: 'INITIATE_LOGOUT' });
  }, [sendMessage]);

  const checkAuth = useCallback(() => {
    sendMessage({ type: 'CHECK_AUTH' });
  }, [sendMessage]);

  return { ...state, sendMessage, initiateLogin, initiateLogout, checkAuth };
}
