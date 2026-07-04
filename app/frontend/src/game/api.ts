import { getAPIBaseURL } from '@/lib/config';

const SESSION_KEY = 'main';
const getGameApiBase = () => `${getAPIBaseURL()}/api/v1/game`;

export interface BackendAgent {
  id: number;
  nation_id: string;
  nation_name: string;
  system_prompt: string;
  skills_md: string;
  memory: string;
  annual_advice: string;
  aggression: number;
  loyalty: number;
  cunning: number;
}

export interface BackendUnit {
  owner: string;
  type: 'Army' | 'Fleet';
  location: string;
}

export interface BackendMessage {
  id: number;
  year: number;
  phaseLabel: string;
  from: string;
  to: string;
  intent: string;
  content: string;
}

export interface BackendReport {
  id: number;
  year: number;
  phaseLabel: string;
  phase_index: number;
  headline: string;
  body: string;
}

export interface BackendHistory {
  id: number;
  year: number;
  summary: string;
  scSnapshot: Record<string, number>;
}

export interface BackendState {
  id: number;
  session_key: string;
  year: number;
  phase_index: number;
  phase_key: string;
  phase_label: string;
  season: string;
  status: string;
  engine: 'llm' | 'fallback';
  ownership: Record<string, string>;
  units: BackendUnit[];
  scCount: Record<string, number>;
  nations: { id: string; name: string; short: string; color: string }[];
  lastOrders: Record<string, unknown[]>;
  agents: Record<string, BackendAgent>;
  messages?: BackendMessage[];
  reports?: BackendReport[];
  history?: BackendHistory[];
}

function buildUrl(path: string, data: Record<string, unknown>): string {
  const url = new URL(`${getGameApiBase()}${path}`);
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === 'string') return payload.detail;
    if (typeof payload?.message === 'string') return payload.message;
  } catch {
    // Ignore non-JSON error payloads.
  }
  return `Request failed: ${response.status} ${response.statusText}`;
}

async function invoke<T>(
  path: string,
  method: 'GET' | 'POST',
  data: Record<string, unknown>,
  timeout?: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = timeout ? window.setTimeout(() => controller.abort(), timeout) : null;

  try {
    const response = await fetch(
      method === 'GET' ? buildUrl(path, data) : `${getGameApiBase()}${path}`,
      {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  }
}

export async function fetchState(): Promise<{ exists: boolean; state?: BackendState }> {
  return invoke('/state', 'GET', { session_key: SESSION_KEY });
}

export async function initGame(reset = false): Promise<{ created: boolean; state: BackendState }> {
  return invoke('/init', 'POST', { session_key: SESSION_KEY, reset });
}

export async function advancePhase(): Promise<{ exists: boolean; state: BackendState }> {
  return invoke('/advance', 'POST', { session_key: SESSION_KEY }, 600_000);
}

export async function updateAgent(payload: {
  nation_id: string;
  system_prompt?: string;
  skills_md?: string;
  memory?: string;
  annual_advice?: string;
  aggression?: number;
  loyalty?: number;
  cunning?: number;
}): Promise<{ ok: boolean; agent: BackendAgent }> {
  return invoke('/agent', 'POST', { session_key: SESSION_KEY, ...payload });
}

export async function adjustSc(
  endowments: { nation_id: string; sc: number }[],
): Promise<{ ok: boolean; sc: Record<string, number> }> {
  return invoke('/sc_endowment', 'POST', { session_key: SESSION_KEY, endowments });
}
