import { BackendPhaseSnapshot, BackendReport, BackendUnit } from './api';
import { BattleReportItem, createInitialState, GameState, NATIONS, PROVINCE_MAP, Unit } from './engine';

function mapUnits(units: BackendUnit[], prefix: string): Unit[] {
  return (units || []).map((unit, index) => ({
    id: `${prefix}-${index}`,
    owner: unit.owner,
    type: unit.type,
    location: unit.location,
  }));
}

function mapReports(reports: BackendReport[]): BattleReportItem[] {
  return (reports || []).map((report) => ({
    id: `r${report.id}`,
    year: report.year,
    phaseLabel: report.phaseLabel,
    text: report.headline ? `${report.headline}\n${report.body}` : report.body,
    tone: 'neutral' as const,
  }));
}

export function buildSpectatorGameState(payload: {
  year: number;
  phase_index: number;
  status: string;
  ownership: Record<string, string>;
  units: BackendUnit[];
  scCount: Record<string, number>;
  reports?: BackendReport[];
  phaseSnapshots?: BackendPhaseSnapshot[];
}): GameState {
  const state = createInitialState();
  const ownership: Record<string, string | null> = {};

  Object.keys(PROVINCE_MAP).forEach((provinceId) => {
    ownership[provinceId] = payload.ownership?.[provinceId] || null;
  });

  state.year = payload.year;
  state.phaseIndex = payload.phase_index;
  state.started = true;
  state.status =
    payload.status === 'finished'
      ? 'finished'
      : payload.status === 'preparing'
        ? 'preparing'
        : payload.status === 'awaiting'
          ? 'awaiting'
          : 'reasoning';
  state.ownership = ownership;
  state.units = mapUnits(payload.units || [], 'spectator');
  state.scCount = payload.scCount || {};
  state.reports = mapReports(payload.reports || []);
  state.phaseSnapshots = (payload.phaseSnapshots || []).map((snapshot) => ({
    reportId: `r${snapshot.report_id ?? `${snapshot.year}-${snapshot.phase_index}`}`,
    year: snapshot.year,
    phaseIndex: snapshot.phase_index,
    phaseKey: snapshot.phase_key,
    phaseLabel: snapshot.phaseLabel,
    ownership: Object.fromEntries(
      Object.keys(PROVINCE_MAP).map((provinceId) => [provinceId, snapshot.ownership?.[provinceId] || null]),
    ),
    units: mapUnits(snapshot.units || [], `snapshot-${snapshot.report_id ?? snapshot.phase_index}`),
    scCount: snapshot.scCount || {},
  }));
  state.nations = NATIONS.map((nation) => ({ ...nation }));
  return state;
}
