import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GameState,
  Nation,
  NATIONS,
  PHASES,
  PROVINCE_MAP,
  Unit,
  countSC,
  createInitialState,
} from './engine';
import {
  BackendState,
  advancePhase as apiAdvance,
  adjustSc as apiAdjustSc,
  fetchState,
  initGame,
  updateAgent as apiUpdateAgent,
} from './api';

export type SettingsSource = 'map' | 'control' | 'messages' | 'history' | 'index' | null;

const NATION_META: Record<string, Nation> = Object.fromEntries(NATIONS.map((nation) => [nation.id, nation]));

function deriveTraits(
  base: Nation['traits'],
  aggression: number,
  cunning: number,
  loyalty: number,
): Nation['traits'] {
  return {
    ...base,
    expansion: aggression,
    vengeance: Math.max(0, Math.min(100, 100 - loyalty + Math.round(cunning / 4))),
    diplomacy: cunning > 65 ? 'manipulative' : cunning > 45 ? 'probing' : 'calm',
    risk: aggression > 75 ? 'high-risk' : aggression > 50 ? 'opportunistic' : 'steady',
    honor: loyalty > 70 ? 'strict' : loyalty > 45 ? 'conditional' : 'flexible',
  };
}

function mapBackendToGameState(backendState: BackendState): GameState {
  const ownership: Record<string, string | null> = {};
  Object.entries(backendState.ownership || {}).forEach(([provinceId, owner]) => {
    ownership[provinceId] = owner || null;
  });

  Object.keys(PROVINCE_MAP).forEach((provinceId) => {
    if (!(provinceId in ownership)) {
      ownership[provinceId] = null;
    }
  });

  const units: Unit[] = (backendState.units || []).map((unit, index) => ({
    id: `u${index}`,
    owner: unit.owner,
    type: unit.type,
    location: unit.location,
  }));

  const nations: Nation[] = NATIONS.map((meta) => {
    const agent = backendState.agents?.[meta.id];
    if (!agent) return { ...meta };
    return {
      ...meta,
      systemPrompt: agent.system_prompt || meta.systemPrompt,
      skills: agent.skills_md || meta.skills,
      memory: agent.memory || meta.memory,
      yearlyAdvice: agent.annual_advice || meta.yearlyAdvice,
      traits: deriveTraits(meta.traits, agent.aggression, agent.cunning, agent.loyalty),
    };
  });

  const reports = (backendState.reports || []).map((report) => ({
    id: `r${report.id}`,
    year: report.year,
    phaseLabel: report.phaseLabel,
    text: report.headline ? `${report.headline}\n${report.body}` : report.body,
    tone: 'neutral' as const,
  }));

  const messages = (backendState.messages || []).map((message) => {
    const fromNation = NATION_META[message.from];
    const toNation = message.to === 'public' ? null : NATION_META[message.to];
    const intentMap: Record<string, GameState['messages'][number]['intent']> = {
      alliance: '结盟',
      threat: '恫吓',
      betray: '背叛',
      probe: '试探',
      peace: '求和',
      coordination: '协同',
      结盟: '结盟',
      试探: '试探',
      恫吓: '恫吓',
      背叛: '背叛',
      求和: '求和',
      协同: '协同',
    };

    return {
      id: `m${message.id}`,
      year: message.year,
      phaseLabel: message.phaseLabel,
      from: message.from,
      to: message.to === 'public' ? message.from : message.to,
      channel: toNation
        ? `${fromNation?.short || message.from} - ${toNation.short}`
        : `${fromNation?.short || message.from} public`,
      text: message.content,
      intent: intentMap[message.intent] || '试探',
      trustDelta: 0,
    };
  });

  const history = (backendState.history || []).map((item) => ({
    year: item.year,
    season: '冬季',
    phaseLabel: `${item.year} 年度复盘`,
    summary: item.summary,
    scSnapshot: item.scSnapshot || {},
  }));

  const scCount =
    backendState.scCount && Object.keys(backendState.scCount).length
      ? backendState.scCount
      : countSC(ownership);

  const endowment: Record<string, number> = {};
  NATIONS.forEach((nation) => {
    endowment[nation.id] = scCount[nation.id] ?? nation.homeCenters.length;
  });

  const status: GameState['status'] =
    backendState.status === 'finished'
      ? 'finished'
      : backendState.phase_key === 'review'
        ? 'awaiting'
        : 'reasoning';

  return {
    status,
    year: backendState.year,
    phaseIndex: backendState.phase_index,
    started: true,
    units,
    ownership,
    scCount,
    trust: {},
    conflicts: [],
    messages,
    reports,
    history,
    endowment,
    nations,
    seed: 20260704,
  };
}

interface GameContextValue {
  state: GameState;
  busy: boolean;
  ready: boolean;
  engine: 'llm' | 'fallback';
  error: string | null;
  startGameAction: () => Promise<boolean>;
  advance: () => Promise<boolean>;
  reset: () => Promise<boolean>;
  refresh: () => Promise<void>;
  setEndowment: (nationId: string, value: number) => Promise<void>;
  updateNation: (nationId: string, patch: Partial<Nation>) => Promise<void>;
  settingsOpen: boolean;
  settingsSource: SettingsSource;
  focusNation: string | null;
  openSettings: (source: SettingsSource, nationId?: string) => void;
  closeSettings: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [engine, setEngine] = useState<'llm' | 'fallback'>('llm');
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSource, setSettingsSource] = useState<SettingsSource>(null);
  const [focusNation, setFocusNation] = useState<string | null>(null);

  const applyBackend = useCallback((backendState: BackendState) => {
    setState(mapBackendToGameState(backendState));
    setEngine(backendState.engine === 'fallback' ? 'fallback' : 'llm');
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchState();
      if (result.exists && result.state) {
        applyBackend(result.state);
      } else {
        setReady(false);
      }
    } catch (error) {
      const message = (error as { message?: string })?.message || 'Failed to load game state';
      setError(message);
    }
  }, [applyBackend]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startGameAction = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await initGame(false);
      applyBackend(result.state);
      return true;
    } catch (error) {
      setError((error as { message?: string })?.message || 'Failed to initialize game');
      return false;
    } finally {
      setBusy(false);
    }
  }, [applyBackend]);

  const advance = useCallback(async () => {
    if (state.status === 'finished') {
      return false;
    }

    setBusy(true);
    setError(null);
    setState((previous) => ({ ...previous, status: 'reasoning' }));

    try {
      const result = await apiAdvance();
      if (result.state) {
        applyBackend(result.state);
      }
      return true;
    } catch (error) {
      setError((error as { message?: string })?.message || 'Failed to advance phase');
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [state.status, applyBackend, refresh]);

  const reset = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await initGame(true);
      applyBackend(result.state);
      return true;
    } catch (error) {
      setError((error as { message?: string })?.message || 'Failed to reset game');
      return false;
    } finally {
      setBusy(false);
    }
  }, [applyBackend]);

  const setEndowment = useCallback(
    async (nationId: string, value: number) => {
      try {
        const endowments = NATIONS.map((nation) => ({
          nation_id: nation.id,
          sc: nation.id === nationId ? value : state.endowment[nation.id] ?? nation.homeCenters.length,
        }));
        const result = await apiAdjustSc(endowments);
        setState((previous) => ({
          ...previous,
          scCount: { ...previous.scCount, ...result.sc },
          endowment: { ...previous.endowment, [nationId]: value },
        }));
      } catch (error) {
        setError((error as { message?: string })?.message || 'Failed to update supply centers');
      }
    },
    [state.endowment],
  );

  const updateNation = useCallback(async (nationId: string, patch: Partial<Nation>) => {
    setState((previous) => ({
      ...previous,
      nations: previous.nations.map((nation) =>
        nation.id === nationId
          ? { ...nation, ...patch, traits: { ...nation.traits, ...(patch.traits || {}) } }
          : nation,
      ),
    }));

    const payload: Parameters<typeof apiUpdateAgent>[0] = { nation_id: nationId };
    if (patch.systemPrompt !== undefined) payload.system_prompt = patch.systemPrompt;
    if (patch.skills !== undefined) payload.skills_md = patch.skills;
    if (patch.memory !== undefined) payload.memory = patch.memory;
    if (patch.yearlyAdvice !== undefined) payload.annual_advice = patch.yearlyAdvice;
    if (patch.traits?.expansion !== undefined) payload.aggression = patch.traits.expansion;
    if (patch.traits?.vengeance !== undefined) {
      payload.loyalty = Math.max(0, Math.min(100, 100 - patch.traits.vengeance));
    }

    try {
      await apiUpdateAgent(payload);
    } catch (error) {
      setError((error as { message?: string })?.message || 'Failed to update nation');
    }
  }, []);

  const openSettings = useCallback((source: SettingsSource, nationId?: string) => {
    setSettingsSource(source);
    setFocusNation(nationId || null);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      busy,
      ready,
      engine,
      error,
      startGameAction,
      advance,
      reset,
      refresh,
      setEndowment,
      updateNation,
      settingsOpen,
      settingsSource,
      focusNation,
      openSettings,
      closeSettings,
    }),
    [
      state,
      busy,
      ready,
      engine,
      error,
      startGameAction,
      advance,
      reset,
      refresh,
      setEndowment,
      updateNation,
      settingsOpen,
      settingsSource,
      focusNation,
      openSettings,
      closeSettings,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used inside GameProvider');
  }
  return context;
}

export { PHASES };
