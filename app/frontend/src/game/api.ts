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
  intent?: string;
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

export interface BackendPhaseSnapshot {
  report_id?: number | null;
  year: number;
  phase_index: number;
  phase_key: string;
  phaseLabel: string;
  ownership: Record<string, string>;
  units: BackendUnit[];
  scCount: Record<string, number>;
}

export interface BackendBlackboxMessageItem {
  year: number;
  phase: string;
  from: string;
  from_name: string;
  to: string;
  to_name: string;
  content: string;
  commitments: number;
  tone_score: number;
}

export interface BackendBlackboxBetrayalEvidence {
  year: string;
  phase: string;
  direction: 'against_us' | 'by_us';
  actor: string;
  actor_name: string;
  target: string;
  target_name: string;
  province: string;
  province_name: string;
}

export interface BackendBlackboxAlignmentTrustRow {
  nation_id: string;
  nation_name: string;
  trust_score: number;
  soft_alliance_level: string;
  commitments: number;
  military_cooperation: number;
  betrayals_against_us: number;
  recent_negative: number;
  recent_positive: number;
  outbound_betrayals: number;
  last_touch?: {
    year?: number | null;
    phase?: string;
    content?: string;
    from?: string;
    to?: string;
  } | null;
}

export interface BackendBlackboxConflict {
  province: string;
  province_name: string;
  kind: string;
  winner: string;
  winner_name: string;
  participants: string[];
  participant_names: string[];
}

export interface BackendBlackboxReplayEntry {
  timestamp: string;
  phase_label: string;
  kind: string;
  summary: string;
  order_summaries?: string[];
  messages?: Array<{ from_nation: string; to_nation: string; content: string }>;
  conflicts?: BackendBlackboxConflict[];
  logs?: string[];
  decision?: Record<string, unknown>;
  pending_retreats?: Array<Record<string, unknown>>;
  reasoning_trace?: {
    headline?: string;
    goal?: string;
    board_read?: string;
    diplomatic_read?: string;
    risks?: string[];
    decision_logic?: string;
  };
}

export interface BackendBlackboxNation {
  diplomatic_archive: {
    sent: BackendBlackboxMessageItem[];
    received: BackendBlackboxMessageItem[];
    public_statements: BackendBlackboxMessageItem[];
    suspected_agreements: Array<{
      year: number;
      phase: string;
      counterparty: string;
      counterparty_name: string;
      evidence: string;
      direction: 'outbound' | 'inbound';
    }>;
    betrayal_evidence: BackendBlackboxBetrayalEvidence[];
  };
  alignment_report: {
    betrayed_us: Array<Record<string, unknown>>;
    we_betrayed: Array<Record<string, unknown>>;
    trust_scores: BackendBlackboxAlignmentTrustRow[];
    memory_whitelist: Array<Record<string, unknown>>;
    memory_blacklist: Array<Record<string, unknown>>;
  };
  decision_replay: {
    cot_available: boolean;
    note: string;
    entries: BackendBlackboxReplayEntry[];
  };
  memory_snapshot: {
    persistent_memory: string;
    recent_public_outcomes: Array<Record<string, unknown>>;
  };
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
  trust?: Record<string, number>;
  governance?: {
    system_prompt_edits_used: number;
    skills_edits_used: number;
    system_prompt_updated_nations?: string[];
    skills_updated_nations?: string[];
    annual_advice_updated_years: number[];
    annual_advice_updated_years_by_nation?: Record<string, number[]>;
    annual_advice_effective_years?: Record<string, number>;
    max_year?: number;
  };
  messages?: BackendMessage[];
  reports?: BackendReport[];
  phaseSnapshots?: BackendPhaseSnapshot[];
  history?: BackendHistory[];
  blackbox?: Record<string, BackendBlackboxNation>;
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

export async function startPreparedGame(): Promise<{ ok: boolean; state: BackendState }> {
  return invoke('/start', 'POST', { session_key: SESSION_KEY });
}

export async function updateMatchConfig(payload: { max_year?: number }): Promise<{ ok: boolean; state: BackendState }> {
  return invoke('/config', 'POST', { session_key: SESSION_KEY, ...payload });
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
}): Promise<{ ok: boolean; agent: BackendAgent }> {
  return invoke('/agent', 'POST', { session_key: SESSION_KEY, ...payload });
}

export async function adjustSc(
  endowments: { nation_id: string; sc: number }[],
): Promise<{ ok: boolean; sc: Record<string, number> }> {
  return invoke('/sc_endowment', 'POST', { session_key: SESSION_KEY, endowments });
}
