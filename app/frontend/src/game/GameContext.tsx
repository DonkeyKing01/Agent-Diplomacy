import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GameState,
  HistoricalPhaseSnapshot,
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
  startPreparedGame as apiStartPreparedGame,
  updateMatchConfig as apiUpdateMatchConfig,
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
    cunning,
    vengeance: Math.max(0, Math.min(100, 100 - loyalty + Math.round(cunning / 4))),
    diplomacy: cunning > 65 ? '操控性强' : cunning > 45 ? '暧昧试探' : '冷静理智',
    risk: aggression > 75 ? '豪赌型' : aggression > 50 ? '机会主义' : '稳健运营',
    honor: loyalty > 70 ? '守信' : loyalty > 45 ? '灵活务实' : '纯粹务实',
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

  const phaseSnapshots: HistoricalPhaseSnapshot[] = (backendState.phaseSnapshots || []).map((snapshot) => {
    const snapshotOwnership: Record<string, string | null> = {};
    Object.entries(snapshot.ownership || {}).forEach(([provinceId, owner]) => {
      snapshotOwnership[provinceId] = owner || null;
    });

    Object.keys(PROVINCE_MAP).forEach((provinceId) => {
      if (!(provinceId in snapshotOwnership)) {
        snapshotOwnership[provinceId] = null;
      }
    });

    return {
      reportId: `r${snapshot.report_id ?? `${snapshot.year}-${snapshot.phase_index}`}`,
      year: snapshot.year,
      phaseIndex: snapshot.phase_index,
      phaseKey: snapshot.phase_key,
      phaseLabel: snapshot.phaseLabel,
      ownership: snapshotOwnership,
      units: (snapshot.units || []).map((unit, index) => ({
        id: `hs-${snapshot.report_id ?? snapshot.phase_index}-${index}`,
        owner: unit.owner,
        type: unit.type,
        location: unit.location,
      })),
      scCount: snapshot.scCount || {},
    };
  });

  const messages = (backendState.messages || []).map((message) => {
    const fromNation = NATION_META[message.from];
    const toNation = message.to === 'public' ? null : NATION_META[message.to];
    const intentMap: Record<string, GameState['messages'][number]['intent']> = {
      alliance: '结盟',
      threat: '恐吓',
      betray: '背叛',
      probe: '试探',
      peace: '求和',
      coordination: '协同',
      结盟: '结盟',
      试探: '试探',
      恐吓: '恐吓',
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

  const blackbox = Object.fromEntries(
    Object.entries(backendState.blackbox || {}).map(([nationId, nationBlackbox]) => [
      nationId,
      {
        diplomaticArchive: {
          sent: (nationBlackbox.diplomatic_archive?.sent || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            from: item.from,
            fromName: item.from_name,
            to: item.to,
            toName: item.to_name,
            content: item.content,
            commitments: item.commitments,
            toneScore: item.tone_score,
          })),
          received: (nationBlackbox.diplomatic_archive?.received || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            from: item.from,
            fromName: item.from_name,
            to: item.to,
            toName: item.to_name,
            content: item.content,
            commitments: item.commitments,
            toneScore: item.tone_score,
          })),
          publicStatements: (nationBlackbox.diplomatic_archive?.public_statements || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            from: item.from,
            fromName: item.from_name,
            to: item.to,
            toName: item.to_name,
            content: item.content,
            commitments: item.commitments,
            toneScore: item.tone_score,
          })),
          suspectedAgreements: nationBlackbox.diplomatic_archive?.suspected_agreements || [],
          betrayalEvidence: (nationBlackbox.diplomatic_archive?.betrayal_evidence || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            direction: item.direction,
            actor: item.actor,
            actorName: item.actor_name,
            target: item.target,
            targetName: item.target_name,
            province: item.province,
            provinceName: item.province_name,
          })),
        },
        alignmentReport: {
          betrayedUs: nationBlackbox.alignment_report?.betrayed_us || [],
          weBetrayed: nationBlackbox.alignment_report?.we_betrayed || [],
          trustScores: (nationBlackbox.alignment_report?.trust_scores || []).map((row) => ({
            nationId: row.nation_id,
            nationName: row.nation_name,
            trustScore: row.trust_score,
            softAllianceLevel: row.soft_alliance_level,
            commitments: row.commitments,
            militaryCooperation: row.military_cooperation,
            betrayalsAgainstUs: row.betrayals_against_us,
            recentNegative: row.recent_negative,
            recentPositive: row.recent_positive,
            outboundBetrayals: row.outbound_betrayals,
            lastTouch: row.last_touch || null,
          })),
          memoryWhitelist: nationBlackbox.alignment_report?.memory_whitelist || [],
          memoryBlacklist: nationBlackbox.alignment_report?.memory_blacklist || [],
        },
        decisionReplay: {
          cotAvailable: nationBlackbox.decision_replay?.cot_available ?? false,
          note: nationBlackbox.decision_replay?.note || '',
          entries: (nationBlackbox.decision_replay?.entries || []).map((entry) => ({
            timestamp: entry.timestamp,
            phaseLabel: entry.phase_label,
            kind: entry.kind,
            summary: entry.summary,
            orderSummaries: entry.order_summaries || [],
            messages: (entry.messages || []).map((message) => ({
              fromNation: message.from_nation,
              toNation: message.to_nation,
              content: message.content,
            })),
            conflicts: (entry.conflicts || []).map((conflict) => ({
              province: conflict.province,
              provinceName: conflict.province_name,
              kind: conflict.kind,
              winner: conflict.winner,
              winnerName: conflict.winner_name,
              participants: conflict.participants,
              participantNames: conflict.participant_names,
            })),
            logs: entry.logs || [],
            decision: entry.decision || undefined,
            reasoningTrace: {
              headline: entry.reasoning_trace?.headline || '',
              goal: entry.reasoning_trace?.goal || '',
              boardRead: entry.reasoning_trace?.board_read || '',
              diplomaticRead: entry.reasoning_trace?.diplomatic_read || '',
              risks: entry.reasoning_trace?.risks || [],
              decisionLogic: entry.reasoning_trace?.decision_logic || '',
            },
          })),
        },
        memorySnapshot: {
          persistentMemory: nationBlackbox.memory_snapshot?.persistent_memory || '',
          recentPublicOutcomes: nationBlackbox.memory_snapshot?.recent_public_outcomes || [],
        },
      },
    ]),
  );

  const scCount =
    backendState.scCount && Object.keys(backendState.scCount).length
      ? backendState.scCount
      : countSC(ownership);

  const endowment: Record<string, number> = {};
  NATIONS.forEach((nation) => {
    endowment[nation.id] = scCount[nation.id] ?? nation.homeCenters.length;
  });

  const status: GameState['status'] =
    backendState.status === 'preparing'
      ? 'preparing'
      : backendState.status === 'finished'
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
    trust: backendState.trust || {},
    conflicts: [],
    messages,
    reports,
    phaseSnapshots,
    history,
    governance: {
      system_prompt_edits_used: backendState.governance?.system_prompt_edits_used ?? 0,
      skills_edits_used: backendState.governance?.skills_edits_used ?? 0,
      annual_advice_updated_years: backendState.governance?.annual_advice_updated_years || [],
      annual_advice_updated_years_by_nation: backendState.governance?.annual_advice_updated_years_by_nation || {},
      annual_advice_effective_years: backendState.governance?.annual_advice_effective_years || {},
      maxYear: backendState.governance?.max_year ?? 1910,
    },
    endowment,
    nations,
    blackbox,
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
  finishPreparationAction: () => Promise<boolean>;
  advance: () => Promise<boolean>;
  reset: () => Promise<boolean>;
  refresh: () => Promise<void>;
  setEndowment: (nationId: string, value: number) => Promise<void>;
  updateMatchConfig: (patch: { maxYear?: number }) => Promise<void>;
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

  const finishPreparationAction = useCallback(async () => {
    if (state.status !== 'preparing') {
      return false;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await apiStartPreparedGame();
      if (result.state) {
        applyBackend(result.state);
      }
      return true;
    } catch (error) {
      const message = (error as { message?: string })?.message || 'Failed to finish preparation';
      setError(message);
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [state.status, applyBackend, refresh]);

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
    let previousNation: Nation | null = null;
    setState((previous) => ({
      ...previous,
      nations: previous.nations.map((nation) => {
        if (nation.id !== nationId) return nation;
        previousNation = nation;
        return { ...nation, ...patch, traits: { ...nation.traits, ...(patch.traits || {}) } };
      }),
    }));

    const payload: Parameters<typeof apiUpdateAgent>[0] = { nation_id: nationId };
    if (patch.systemPrompt !== undefined) payload.system_prompt = patch.systemPrompt;
    if (patch.skills !== undefined) payload.skills_md = patch.skills;
    if (patch.memory !== undefined) payload.memory = patch.memory;
    if (patch.yearlyAdvice !== undefined) payload.annual_advice = patch.yearlyAdvice;
    if (patch.traits?.expansion !== undefined) payload.aggression = patch.traits.expansion;
    if (patch.traits?.cunning !== undefined) payload.cunning = patch.traits.cunning;
    if (patch.traits?.vengeance !== undefined) {
      payload.loyalty = Math.max(0, Math.min(100, 100 - patch.traits.vengeance));
    }

    try {
      await apiUpdateAgent(payload);
    } catch (error) {
      if (previousNation) {
        setState((previous) => ({
          ...previous,
          nations: previous.nations.map((nation) => (nation.id === nationId ? previousNation! : nation)),
        }));
      }
      const message = (error as { message?: string })?.message || 'Failed to update nation';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const updateMatchConfig = useCallback(async (patch: { maxYear?: number }) => {
    try {
      const result = await apiUpdateMatchConfig({
        max_year: patch.maxYear,
      });
      if (result.state) {
        applyBackend(result.state);
      }
    } catch (error) {
      const message = (error as { message?: string })?.message || 'Failed to update match configuration';
      setError(message);
      throw new Error(message);
    }
  }, [applyBackend]);

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
      finishPreparationAction,
      advance,
      reset,
      refresh,
      setEndowment,
      updateMatchConfig,
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
      finishPreparationAction,
      advance,
      reset,
      refresh,
      setEndowment,
      updateMatchConfig,
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
