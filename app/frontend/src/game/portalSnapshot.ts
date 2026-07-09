import {
  BackendBlackboxNation,
  BackendHistory,
  BackendMessage,
  BackendPhaseSnapshot,
  BackendReport,
  SpectatorCredentialsResponse,
  SpectatorPrivateState,
  SpectatorPublicState,
} from './api';
import { GameState, phaseAt } from './engine';

export interface PortalSnapshotBundle {
  version: 1;
  exported_at: string;
  source: 'agent-diplomacy-local';
  public_state: SpectatorPublicState;
  player_states: Record<
    string,
    {
      password: string;
      state: SpectatorPrivateState;
    }
  >;
}

function toOwnershipMap(ownership: GameState['ownership']): Record<string, string> {
  return Object.fromEntries(Object.entries(ownership || {}).map(([key, value]) => [key, value || '']));
}

function toBackendUnits(units: GameState['units']) {
  return (units || []).map((unit) => ({
    owner: unit.owner,
    type: unit.type,
    location: unit.location,
  }));
}

function toBackendMessages(messages: GameState['messages']): BackendMessage[] {
  return (messages || []).map((message, index) => ({
    id: index + 1,
    year: message.year,
    phaseLabel: message.phaseLabel,
    from: message.fromNation,
    to: message.toNation,
    intent: message.intent,
    content: message.text,
  }));
}

function toBackendReports(reports: GameState['reports'], phaseIndex: number): BackendReport[] {
  return (reports || []).map((report, index) => ({
    id: index + 1,
    year: report.year,
    phaseLabel: report.phaseLabel,
    phase_index: phaseIndex,
    headline: '',
    body: report.text,
  }));
}

function toBackendHistory(history: GameState['history']): BackendHistory[] {
  return (history || []).map((entry, index) => ({
    id: index + 1,
    year: entry.year,
    summary: entry.summary,
    scSnapshot: entry.scSnapshot,
  }));
}

function toBackendPhaseSnapshots(snapshots: GameState['phaseSnapshots']): BackendPhaseSnapshot[] {
  return (snapshots || []).map((snapshot, index) => ({
    report_id: index + 1,
    year: snapshot.year,
    phase_index: snapshot.phaseIndex,
    phase_key: snapshot.phaseKey,
    phaseLabel: snapshot.phaseLabel,
    ownership: toOwnershipMap(snapshot.ownership),
    units: toBackendUnits(snapshot.units),
    scCount: snapshot.scCount,
  }));
}

function toBackendBlackbox(blackbox: GameState['blackbox']): Record<string, BackendBlackboxNation> {
  return Object.fromEntries(
    Object.entries(blackbox || {}).map(([nationId, data]) => [
      nationId,
      {
        diplomatic_archive: {
          sent: (data.diplomaticArchive?.sent || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            from: item.from,
            from_name: item.fromName,
            to: item.to,
            to_name: item.toName,
            content: item.content,
            commitments: item.commitments,
            tone_score: item.toneScore,
          })),
          received: (data.diplomaticArchive?.received || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            from: item.from,
            from_name: item.fromName,
            to: item.to,
            to_name: item.toName,
            content: item.content,
            commitments: item.commitments,
            tone_score: item.toneScore,
          })),
          public_statements: (data.diplomaticArchive?.publicStatements || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            from: item.from,
            from_name: item.fromName,
            to: item.to,
            to_name: item.toName,
            content: item.content,
            commitments: item.commitments,
            tone_score: item.toneScore,
          })),
          suspected_agreements: (data.diplomaticArchive?.suspectedAgreements || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            counterparty: item.counterparty,
            counterparty_name: item.counterpartyName,
            evidence: item.evidence,
            direction: item.direction,
          })),
          betrayal_evidence: (data.diplomaticArchive?.betrayalEvidence || []).map((item) => ({
            year: item.year,
            phase: item.phase,
            direction: item.direction,
            actor: item.actor,
            actor_name: item.actorName,
            target: item.target,
            target_name: item.targetName,
            province: item.province,
            province_name: item.provinceName,
          })),
        },
        alignment_report: {
          betrayed_us: data.alignmentReport?.betrayedUs || [],
          we_betrayed: data.alignmentReport?.weBetrayed || [],
          trust_scores: (data.alignmentReport?.trustScores || []).map((item) => ({
            nation_id: item.nationId,
            nation_name: item.nationName,
            trust_score: item.trustScore,
            soft_alliance_level: item.softAllianceLevel,
            commitments: item.commitments,
            military_cooperation: item.militaryCooperation,
            betrayals_against_us: item.betrayalsAgainstUs,
            recent_negative: item.recentNegative,
            recent_positive: item.recentPositive,
            outbound_betrayals: item.outboundBetrayals,
            last_touch: item.lastTouch || null,
          })),
          memory_whitelist: data.alignmentReport?.memoryWhitelist || [],
          memory_blacklist: data.alignmentReport?.memoryBlacklist || [],
        },
        decision_replay: {
          cot_available: data.decisionReplay?.cotAvailable || false,
          note: data.decisionReplay?.note || '',
          entries: (data.decisionReplay?.entries || []).map((entry) => ({
            timestamp: entry.timestamp,
            phase_label: entry.phaseLabel,
            kind: entry.kind,
            summary: entry.summary,
            order_summaries: entry.orderSummaries,
            messages: (entry.messages || []).map((message) => ({
              from_nation: message.fromNation,
              to_nation: message.toNation,
              content: message.content,
            })),
            conflicts: (entry.conflicts || []).map((conflict) => ({
              province: conflict.province,
              province_name: conflict.provinceName,
              kind: conflict.kind,
              winner: conflict.winner,
              winner_name: conflict.winnerName,
              participants: conflict.participants,
              participant_names: conflict.participantNames,
            })),
            logs: entry.logs || [],
            decision: entry.decision,
            reasoning_trace: entry.reasoningTrace
              ? {
                  headline: entry.reasoningTrace.headline,
                  goal: entry.reasoningTrace.goal,
                  board_read: entry.reasoningTrace.boardRead,
                  diplomatic_read: entry.reasoningTrace.diplomaticRead,
                  risks: entry.reasoningTrace.risks,
                  decision_logic: entry.reasoningTrace.decisionLogic,
                }
              : undefined,
          })),
        },
        memory_snapshot: {
          persistent_memory: data.memorySnapshot?.persistentMemory || '',
          recent_public_outcomes: data.memorySnapshot?.recentPublicOutcomes || [],
        },
      },
    ]),
  );
}

export function buildPortalSnapshotBundle(
  state: GameState,
  credentials: SpectatorCredentialsResponse | null,
): PortalSnapshotBundle {
  const phase = phaseAt(state.phaseIndex);
  const reports = toBackendReports(state.reports, state.phaseIndex);
  const history = toBackendHistory(state.history);
  const phaseSnapshots = toBackendPhaseSnapshots(state.phaseSnapshots);
  const messages = toBackendMessages(state.messages);
  const blackbox = toBackendBlackbox(state.blackbox);
  const nations = (state.nations || []).map((nation, index) => ({
    id: nation.id,
    name: nation.name,
    short: nation.short,
    color: nation.color,
    slot_label: credentials?.players.find((item) => item.nation_id === nation.id)?.slot_label || nation.short || `第${index + 1}排`,
    player_path: `/#/player/${nation.id}`,
  }));

  const publicState: SpectatorPublicState = {
    year: state.year,
    phase_index: state.phaseIndex,
    phase_key: phase.key,
    phase_label: phase.label,
    season: phase.season,
    status: state.status,
    engine: 'snapshot',
    ownership: toOwnershipMap(state.ownership),
    units: toBackendUnits(state.units),
    scCount: state.scCount,
    nations,
    reports,
    history,
    phaseSnapshots,
    public_url: '',
  };

  const playerStates: PortalSnapshotBundle['player_states'] = {};

  for (const nation of state.nations || []) {
    const credential = credentials?.players.find((item) => item.nation_id === nation.id);
    playerStates[nation.id] = {
      password: credential?.password || '',
      state: {
        year: state.year,
        phase_index: state.phaseIndex,
        phase_key: phase.key,
        phase_label: phase.label,
        season: phase.season,
        status: state.status,
        nation: {
          id: nation.id,
          name: nation.name,
          short: nation.short,
          color: nation.color,
          sc: state.scCount[nation.id] || 0,
          private_url: '',
        },
        map: {
          ownership: toOwnershipMap(state.ownership),
          units: toBackendUnits(state.units),
          scCount: state.scCount,
          nations: (state.nations || []).map((item) => ({
            id: item.id,
            name: item.name,
            short: item.short,
            color: item.color,
          })),
          reports,
          history,
          phaseSnapshots,
        },
        agent_profile: {
          system_prompt: nation.systemPrompt || '',
          skills_md: nation.skills || '',
          memory: nation.memory || '',
          annual_advice: nation.yearlyAdvice || '',
        },
        messages: messages.filter((message) => message.from === nation.id || message.to === nation.id),
        reports,
        history,
        blackbox: blackbox[nation.id] || {
          diplomatic_archive: {
            sent: [],
            received: [],
            public_statements: [],
            suspected_agreements: [],
            betrayal_evidence: [],
          },
          alignment_report: {
            betrayed_us: [],
            we_betrayed: [],
            trust_scores: [],
            memory_whitelist: [],
            memory_blacklist: [],
          },
          decision_replay: { cot_available: false, note: '', entries: [] },
          memory_snapshot: { persistent_memory: '', recent_public_outcomes: [] },
        },
      },
    };
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    source: 'agent-diplomacy-local',
    public_state: publicState,
    player_states: playerStates,
  };
}
