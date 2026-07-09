/**
 * Agent Diplomacy 核心引擎（纯数据与逻辑，无 React 依赖）。
 * 提供：类型定义、十个排、战棋六边形网格地图省份、初始局势，
 * 以及确定性（seeded）的阶段推进模拟，生成单位移动、冲突、外交密信、战报与历史。
 *
 * 地图采用真正的 flat-top 六边形战棋网格（见 hexmap.ts）：所有省份（陆地/沿海/海域）
 * 用同一套网格规则紧密贴合、无缝无重叠；相邻关系严格由六邻居定义，
 * 移动/进攻/支援/护航只能沿相邻格发生。此规则与后端 game_engine.py 完全一致。
 */

import {
  HEX_CELLS,
  HEX_ADJ,
  hexCenter,
  hexCorners,
  type HexLayout,
} from './hexmap';

// ---------------------------------------------------------------------------
// 基础类型
// ---------------------------------------------------------------------------

export type UnitType = 'Army' | 'Fleet';
export type OrderType = 'Hold' | 'Move' | 'Support' | 'Convoy';

/** 阶段序列：春季 -> 春季撤退 -> 秋季 -> 秋季撤退 -> 冬季调整 -> 年度复盘 */
export type PhaseKey =
  | 'spring'
  | 'springRetreat'
  | 'autumn'
  | 'autumnRetreat'
  | 'winter'
  | 'review';

export type GameStatus = 'preparing' | 'reasoning' | 'awaiting' | 'finished';

export interface Nation {
  id: string;
  name: string;
  short: string;
  color: string;
  homeCenters: string[];
  systemPrompt: string;
  skills: string;
  memory: string;
  yearlyAdvice: string;
  traits: {
    temperament: string;
    risk: string;
    honor: string;
    vengeance: number;
    expansion: number;
    cunning: number;
    diplomacy: string;
  };
}

/** 地图省份（战棋六边形网格单元） */
export interface Province {
  id: string;
  name: string;
  type: 'land' | 'coast' | 'sea' | 'mountain';
  isSC: boolean;
  /** axial 坐标（flat-top） */
  q: number;
  r: number;
  /** flat-top 六边形顶点（无缝贴合），由布局尺寸生成 */
  points: [number, number][];
  /** 六边形中心（标签/单位锚点） */
  label: [number, number];
  /** 相邻省份 id（严格六邻居） */
  adj: string[];
}

export interface Unit {
  id: string;
  owner: string;
  type: UnitType;
  location: string;
  order?: {
    type: OrderType;
    from?: string;
    to?: string;
    target?: string;
  };
  dislodged?: boolean;
}

export interface ConflictMark {
  province: string;
  kind: '进攻' | '支援' | '防守' | '争夺' | '撤退' | '占领变化';
}

export interface DiplomaticMessage {
  id: string;
  year: number;
  phaseLabel: string;
  from: string;
  to: string;
  channel: string;
  text: string;
  intent: '结盟' | '试探' | '恐吓' | '背叛' | '求和' | '协同';
  trustDelta: number;
}

export interface BattleReportItem {
  id: string;
  year: number;
  phaseLabel: string;
  text: string;
  tone: 'neutral' | 'conflict' | 'alliance' | 'betrayal' | 'expansion';
}

export interface HistoryEntry {
  year: number;
  season: string;
  phaseLabel: string;
  summary: string;
  scSnapshot: Record<string, number>;
}

export interface GovernanceState {
  system_prompt_edits_used: number;
  skills_edits_used: number;
  system_prompt_updated_nations?: string[];
  skills_updated_nations?: string[];
  annual_advice_updated_years: number[];
  annual_advice_updated_years_by_nation?: Record<string, number[]>;
  annual_advice_effective_years?: Record<string, number>;
  maxYear: number;
}

export interface NationBlackboxMessageItem {
  year: number;
  phase: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  content: string;
  commitments: number;
  toneScore: number;
}

export interface NationBlackboxConflict {
  province: string;
  provinceName: string;
  kind: string;
  winner: string;
  winnerName: string;
  participants: string[];
  participantNames: string[];
}

export interface NationBlackboxReplayEntry {
  timestamp: string;
  phaseLabel: string;
  kind: string;
  summary: string;
  orderSummaries: string[];
  messages: Array<{ fromNation: string; toNation: string; content: string }>;
  conflicts: NationBlackboxConflict[];
  logs: string[];
  decision?: Record<string, unknown>;
  reasoningTrace: {
    headline: string;
    goal: string;
    boardRead: string;
    diplomaticRead: string;
    risks: string[];
    decisionLogic: string;
  };
}

export interface NationBlackboxState {
  diplomaticArchive: {
    sent: NationBlackboxMessageItem[];
    received: NationBlackboxMessageItem[];
    publicStatements: NationBlackboxMessageItem[];
    suspectedAgreements: Array<{
      year: number;
      phase: string;
      counterparty: string;
      counterpartyName: string;
      evidence: string;
      direction: 'outbound' | 'inbound';
    }>;
    betrayalEvidence: Array<{
      year: string;
      phase: string;
      direction: 'against_us' | 'by_us';
      actor: string;
      actorName: string;
      target: string;
      targetName: string;
      province: string;
      provinceName: string;
    }>;
  };
  alignmentReport: {
    betrayedUs: Array<Record<string, unknown>>;
    weBetrayed: Array<Record<string, unknown>>;
    trustScores: Array<{
      nationId: string;
      nationName: string;
      trustScore: number;
      softAllianceLevel: string;
      commitments: number;
      militaryCooperation: number;
      betrayalsAgainstUs: number;
      recentNegative: number;
      recentPositive: number;
      outboundBetrayals: number;
      lastTouch?: {
        year?: number | null;
        phase?: string;
        content?: string;
        from?: string;
        to?: string;
      } | null;
    }>;
    memoryWhitelist: Array<Record<string, unknown>>;
    memoryBlacklist: Array<Record<string, unknown>>;
  };
  decisionReplay: {
    cotAvailable: boolean;
    note: string;
    entries: NationBlackboxReplayEntry[];
  };
  memorySnapshot: {
    persistentMemory: string;
    recentPublicOutcomes: Array<Record<string, unknown>>;
  };
}

export interface HistoricalPhaseSnapshot {
  reportId: string;
  year: number;
  phaseIndex: number;
  phaseKey: string;
  phaseLabel: string;
  ownership: Record<string, string | null>;
  units: Unit[];
  scCount: Record<string, number>;
}

export interface GameState {
  status: GameStatus;
  year: number;
  phaseIndex: number;
  started: boolean;
  units: Unit[];
  ownership: Record<string, string | null>;
  scCount: Record<string, number>;
  trust: Record<string, number>;
  conflicts: ConflictMark[];
  messages: DiplomaticMessage[];
  reports: BattleReportItem[];
  phaseSnapshots: HistoricalPhaseSnapshot[];
  history: HistoryEntry[];
  governance: GovernanceState;
  endowment: Record<string, number>;
  nations: Nation[];
  blackbox: Record<string, NationBlackboxState>;
  seed: number;
}

// ---------------------------------------------------------------------------
// 阶段定义
// ---------------------------------------------------------------------------

export const PHASES: { key: PhaseKey; label: string; season: string }[] = [
  { key: 'spring', label: '春季·谈判与决策', season: '春季' },
  { key: 'springRetreat', label: '春季撤退', season: '春季' },
  { key: 'autumn', label: '秋季·谈判与决策', season: '秋季' },
  { key: 'autumnRetreat', label: '秋季撤退', season: '秋季' },
  { key: 'winter', label: '冬季调整', season: '冬季' },
  { key: 'review', label: '年度复盘与治理', season: '冬季' },
];

export function phaseAt(index: number) {
  return PHASES[((index % PHASES.length) + PHASES.length) % PHASES.length];
}

// ---------------------------------------------------------------------------
// 十个排
// ---------------------------------------------------------------------------

export const NATIONS: Nation[] = [
  {
    id: 'aur', name: '一排领地', short: '一排', color: '#e0533f',
    homeCenters: ['aur_march', 'mt_rimepass', 'aur_cliff', 'aur_cap'],
    systemPrompt: '你是一排领地的最高决策智能体，位于西北岛。先稳住本岛北侧，再争夺中央公共领地。',
    skills: '# 开局\n守住西北岛上半区，抢占中央北港。\n# 岛间\n舰队优先控海，陆军跨海前确认 Convoy 链路。\n# 风控\n不要同时放空本岛门户和中央前线。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。\n历史偏见层：初始中立。',
    yearlyAdvice: '守住西北岛上半区，抢占中央北港。',
    traits: { temperament: '稳步扩张', risk: '机会主义', honor: '灵活务实', vengeance: 58, expansion: 74, cunning: 56, diplomacy: '冷静理智' },
  },
  {
    id: 'mar', name: '二排领地', short: '二排', color: '#2d8fd0',
    homeCenters: ['mar_cap', 'mar_isle', 'mar_dock', 'mar_shoal'],
    systemPrompt: '你是二排领地的最高决策智能体，位于西南岛。你重视海军机动与西南航道。',
    skills: '# 开局\n控制西南航道，必要时从灯塔岛方向跨海压迫。\n# 海军\n优先维持舰队互相接应。\n# 外交\n以护航和航道安全换取临时合作。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '控制西南航道，必要时从灯塔岛方向跨海压迫。',
    traits: { temperament: '海权机动', risk: '稳健运营', honor: '重利益轻虚名', vengeance: 46, expansion: 58, cunning: 70, diplomacy: '操控性强' },
  },
  {
    id: 'vel', name: '三排领地', short: '三排', color: '#6f57c8',
    homeCenters: ['vel_cap', 'vel_keep', 'vel_harbor', 'windward_key'],
    systemPrompt: '你是三排领地的最高决策智能体，位于东南岛。你需要稳住南线并争夺中央南镇。',
    skills: '# 开局\n稳住东南本岛，优先争取中央南镇。\n# 联盟\n可寻找一个长期盟友，但不能放弃补给中心收益。\n# 报复\n遭背刺后提高复仇权重。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '稳住东南本岛，优先争取中央南镇。',
    traits: { temperament: '守信但会反击', risk: '稳健运营', honor: '重视承诺', vengeance: 72, expansion: 56, cunning: 42, diplomacy: '冠冕堂皇' },
  },
  {
    id: 'kaz', name: '四排领地', short: '四排', color: '#d98a2b',
    homeCenters: ['mt_goldwall', 'kaz_cap', 'kaz_oasis', 'kaz_ford'],
    systemPrompt: '你是四排领地的最高决策智能体，位于东北岛。你偏好主动出击和抢先占位。',
    skills: '# 开局\n从东北本岛主动出击，争夺北中岛。\n# 突击\n发现空置 SC 应快速压上。\n# 风控\n突击后要留下可支援退路。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '从东北本岛主动出击，争夺北中岛。',
    traits: { temperament: '激进扩张', risk: '豪赌型', honor: '灵活务实', vengeance: 62, expansion: 78, cunning: 58, diplomacy: '暧昧试探' },
  },
  {
    id: 'sol', name: '五排领地', short: '五排', color: '#e6c229',
    homeCenters: ['kaz_steppe', 'sol_gate', 'sol_cap', 'sol_plain'],
    systemPrompt: '你是五排领地的最高决策智能体，位于右岛西岸，天然贴近中央公共区。',
    skills: '# 开局\n守住右岛西岸，围绕中央码头建立缓冲。\n# 中央区\n优先拿能形成支援链的公共 SC。\n# 外交\n以道义包装扩张，但以收益为准。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '守住右岛西岸，围绕中央码头建立缓冲。',
    traits: { temperament: '外柔内扩', risk: '机会主义', honor: '善于包装', vengeance: 62, expansion: 64, cunning: 64, diplomacy: '冠冕堂皇' },
  },
  {
    id: 'nor', name: '六排领地', short: '六排', color: '#3aa676',
    homeCenters: ['sea_west_inlet', 'nor_lake', 'nor_harbor', 'vel_ford'],
    systemPrompt: '你是六排领地的最高决策智能体，位于左岛南部。你擅长筑线和反打。',
    skills: '# 开局\n先筑稳左岛南线，再向中央南港试探推进。\n# 防守\n用 Support 形成互保阵型。\n# 机会\n邻国露出空置 SC 时要及时接收。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '先筑稳左岛南线，再向中央南港试探推进。',
    traits: { temperament: '谨慎防守', risk: '稳健运营', honor: '守信', vengeance: 48, expansion: 46, cunning: 44, diplomacy: '冷静理智' },
  },
  {
    id: 'ferr', name: '七排领地', short: '七排', color: '#b0563e',
    homeCenters: ['ferr_cap', 'ferr_forge', 'ferr_mine', 'ferr_works'],
    systemPrompt: '你是七排领地的最高决策智能体，位于左岛中部。你重视产能、支援链和稳定扩张。',
    skills: '# 开局\n连成左岛中部防线，优先吃下中央丘陵。\n# 作战\n避免单点裸冲，尽量让相邻单位互相支援。\n# 收益\n优先争夺近处 SC。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '连成左岛中部防线，优先吃下中央丘陵。',
    traits: { temperament: '务实扩张', risk: '稳健运营', honor: '纯粹务实', vengeance: 44, expansion: 68, cunning: 50, diplomacy: '冷静理智' },
  },
  {
    id: 'zeph', name: '八排领地', short: '八排', color: '#4cc0c0',
    homeCenters: ['zeph_cap', 'zeph_reef', 'zeph_bay', 'zeph_atoll'],
    systemPrompt: '你是八排领地的最高决策智能体，位于右岛东岸。你依赖舰队、侧袭和海峡机动。',
    skills: '# 开局\n保持东侧海军机动，争夺东桥镇和海峡控制权。\n# 海军\n舰队不要孤军深入，优先保持互相接应。\n# 外交\n用模糊承诺争取时间。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '保持东侧海军机动，争夺东桥镇和海峡控制权。',
    traits: { temperament: '机会主义', risk: '机会主义', honor: '灵活', vengeance: 44, expansion: 54, cunning: 68, diplomacy: '暧昧试探' },
  },
  {
    id: 'dra', name: '九排领地', short: '九排', color: '#8a8f98',
    homeCenters: ['mt_skytooth', 'mt_winterkeep', 'dra_watch', 'dra_peak'],
    systemPrompt: '你是九排领地的最高决策智能体，位于左岛北端。你需要守住北端并伺机进入北中岛。',
    skills: '# 开局\n守住左岛北端，伺机进入北中岛。\n# 防守\n利用相邻支援稳住山脚和高地。\n# 反击\n确认对手空虚时再推进。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '守住左岛北端，伺机进入北中岛。',
    traits: { temperament: '谨慎反打', risk: '稳健运营', honor: '守信但多疑', vengeance: 64, expansion: 48, cunning: 54, diplomacy: '冷静理智' },
  },
  {
    id: 'ith', name: '十排领地', short: '十排', color: '#c86fa0',
    homeCenters: ['ith_cap', 'ith_market', 'ith_spring', 'ith_garden'],
    systemPrompt: '你是十排领地的最高决策智能体，位于右岛中部。你靠交易、情报和局部借力扩张。',
    skills: '# 开局\n以交易换安全，利用东桥镇挑动右岛内斗。\n# 生存\n避免正面硬扛两个邻居。\n# 情报\n用密信换支援，但保留后手。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '以交易换安全，利用东桥镇挑动右岛内斗。',
    traits: { temperament: '精明交易', risk: '机会主义', honor: '灵活务实', vengeance: 46, expansion: 42, cunning: 74, diplomacy: '操控性强' },
  },
];

// ---------------------------------------------------------------------------
// 战棋六边形网格地图省份（由 hexmap.ts 生成，紧密贴合、六邻居相邻）
// viewBox 1680x1120（约 3:2），六边形整体放大以适配大屏投屏。
// ---------------------------------------------------------------------------

export const HEX_LAYOUT: HexLayout = { size: 100, originX: 300, originY: 220 };

export const PROVINCES: Province[] = HEX_CELLS.map((c) => {
  const [cx, cy] = hexCenter(c.q, c.r, HEX_LAYOUT);
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    isSC: c.isSC,
    q: c.q,
    r: c.r,
    points: hexCorners(cx, cy, HEX_LAYOUT.size),
    label: [cx, cy] as [number, number],
    adj: HEX_ADJ[c.id] || [],
  };
});

export const PROVINCE_MAP: Record<string, Province> = Object.fromEntries(
  PROVINCES.map((p) => [p.id, p]),
);

/** 地图 viewBox 尺寸（依据所有六边形外接盒动态计算，供渲染放大使用） */
export function mapViewBox(): { x: number; y: number; width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  PROVINCES.forEach((p) => {
    p.points.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
  });
  const padding = HEX_LAYOUT.size * 0.8;
  return {
    x: Math.floor(minX - padding),
    y: Math.floor(minY - padding),
    width: Math.ceil(maxX - minX + padding * 2),
    height: Math.ceil(maxY - minY + padding * 2),
  };
}

// ---------------------------------------------------------------------------
// 初始局势
// ---------------------------------------------------------------------------

const INITIAL_UNITS: { owner: string; type: UnitType; location: string }[] = [
  { owner: 'aur', type: 'Fleet', location: 'aur_march' },
  { owner: 'aur', type: 'Army', location: 'aur_cap' },
  { owner: 'aur', type: 'Fleet', location: 'aur_cliff' },
  { owner: 'mar', type: 'Fleet', location: 'mar_dock' },
  { owner: 'mar', type: 'Fleet', location: 'mar_shoal' },
  { owner: 'mar', type: 'Army', location: 'mar_cap' },
  { owner: 'vel', type: 'Fleet', location: 'windward_key' },
  { owner: 'vel', type: 'Army', location: 'vel_cap' },
  { owner: 'vel', type: 'Army', location: 'vel_keep' },
  { owner: 'kaz', type: 'Fleet', location: 'kaz_ford' },
  { owner: 'kaz', type: 'Army', location: 'kaz_cap' },
  { owner: 'kaz', type: 'Army', location: 'kaz_oasis' },
  { owner: 'sol', type: 'Fleet', location: 'kaz_steppe' },
  { owner: 'sol', type: 'Army', location: 'sol_plain' },
  { owner: 'sol', type: 'Army', location: 'sol_cap' },
  { owner: 'nor', type: 'Fleet', location: 'sea_west_inlet' },
  { owner: 'nor', type: 'Army', location: 'nor_lake' },
  { owner: 'nor', type: 'Army', location: 'vel_ford' },
  { owner: 'ferr', type: 'Fleet', location: 'ferr_forge' },
  { owner: 'ferr', type: 'Army', location: 'ferr_mine' },
  { owner: 'ferr', type: 'Army', location: 'ferr_cap' },
  { owner: 'zeph', type: 'Fleet', location: 'zeph_reef' },
  { owner: 'zeph', type: 'Fleet', location: 'zeph_cap' },
  { owner: 'zeph', type: 'Fleet', location: 'zeph_bay' },
  { owner: 'dra', type: 'Fleet', location: 'mt_skytooth' },
  { owner: 'dra', type: 'Army', location: 'dra_watch' },
  { owner: 'dra', type: 'Army', location: 'dra_peak' },
  { owner: 'ith', type: 'Fleet', location: 'ith_spring' },
  { owner: 'ith', type: 'Army', location: 'ith_garden' },
  { owner: 'ith', type: 'Army', location: 'ith_cap' },
];

function initialOwnership(): Record<string, string | null> {
  const own: Record<string, string | null> = {};
  PROVINCES.forEach((p) => (own[p.id] = null));
  NATIONS.forEach((n) => n.homeCenters.forEach((sc) => (own[sc] = n.id)));
  return own;
}

// ---------------------------------------------------------------------------
// 确定性伪随机（mulberry32）
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// SC 统计
// ---------------------------------------------------------------------------

export function countSC(ownership: Record<string, string | null>): Record<string, number> {
  const c: Record<string, number> = {};
  NATIONS.forEach((n) => (c[n.id] = 0));
  Object.entries(ownership).forEach(([pid, owner]) => {
    if (owner && PROVINCE_MAP[pid]?.isSC) c[owner] = (c[owner] || 0) + 1;
  });
  return c;
}

export function nationById(state: GameState, id: string): Nation | undefined {
  return state.nations.find((n) => n.id === id);
}

export function unitsOf(state: GameState, nationId: string): Unit[] {
  return state.units.filter((u) => u.owner === nationId);
}

// ---------------------------------------------------------------------------
// 初始状态
// ---------------------------------------------------------------------------

export function createInitialState(endowment?: Record<string, number>): GameState {
  const ownership = initialOwnership();
  const trust: Record<string, number> = {};
  NATIONS.forEach((a) =>
    NATIONS.forEach((b) => {
      if (a.id !== b.id) trust[`${a.id}->${b.id}`] = 50;
    }),
  );
  const units: Unit[] = INITIAL_UNITS.map((u, i) => ({
    id: `u${i}`,
    owner: u.owner,
    type: u.type,
    location: u.location,
  }));
  const defaultEndow: Record<string, number> = {};
  NATIONS.forEach((n) => (defaultEndow[n.id] = n.homeCenters.length));
  return {
    status: 'preparing',
    year: 1901,
    phaseIndex: 0,
    started: false,
    units,
    ownership,
    scCount: countSC(ownership),
    trust,
    conflicts: [],
    messages: [],
    reports: [
      {
        id: 'r0',
        year: 1901,
        phaseLabel: '开局',
        text: '各国智能体已完成宪法（System Prompt）与 Skills.md 注入，等待第一年的春季谈判开启。',
        tone: 'neutral',
      },
    ],
    phaseSnapshots: [],
    history: [],
    governance: {
      system_prompt_edits_used: 0,
      skills_edits_used: 0,
      system_prompt_updated_nations: [],
      skills_updated_nations: [],
      annual_advice_updated_years: [],
      annual_advice_updated_years_by_nation: {},
      annual_advice_effective_years: {},
      maxYear: 1910,
    },
    endowment: endowment || defaultEndow,
    nations: JSON.parse(JSON.stringify(NATIONS)),
    blackbox: {},
    seed: 20260704,
  };
}

// ---------------------------------------------------------------------------
// 阶段推进模拟（本地回退演示；真后端存在时以后端状态为准）
// ---------------------------------------------------------------------------

const INTENTS: DiplomaticMessage['intent'][] = ['结盟', '试探', '恐吓', '背叛', '求和', '协同'];

const CHANNEL_TEMPLATES: Record<DiplomaticMessage['intent'], string[]> = {
  结盟: ['贵国与我唇齿相依，何不缔结互保之盟，共御强邻？', '若你我联手，这片大陆再无人敢轻犯。'],
  试探: ['听闻贵国近来调兵频繁，不知意欲何为？', '边境风声鹤唳，我方只是关切，别无他意。'],
  恐吓: ['识相者速速退出争议之地，否则铁蹄踏平尔境。', '我军已枕戈待旦，贵国最好三思而后行。'],
  背叛: ['（密档）对方仍以为你我为盟，实则我军已悄然合围其侧翼。', '（密档）承诺不过缓兵之计，此刻正是背刺良机。'],
  求和: ['连年征战，生灵涂炭，愿与贵国罢兵言和。', '我方愿割一城以息干戈，望贵国接纳。'],
  协同: ['依约，我军将于此役对贵军提供 Support，请放心进军。', '海峡已备好 Convoy，贵军可放心跨海。'],
};

function neighborsOf(pid: string): Province[] {
  return (PROVINCE_MAP[pid]?.adj || []).map((a) => PROVINCE_MAP[a]).filter(Boolean);
}

/** 单位是否可进入某格：Army 不入海，Fleet 不入内陆（沿海与海域可）。 */
function canEnter(type: UnitType, prov: Province): boolean {
  if (type === 'Army') return prov.type === 'land' || prov.type === 'coast';
  return prov.type === 'coast' || prov.type === 'sea';
}

function resolveOrders(state: GameState, rng: () => number, phaseLabel: string): void {
  const conflicts: ConflictMark[] = [];
  const messages: DiplomaticMessage[] = [];
  const reports: BattleReportItem[] = [];

  const pairs: [string, string][] = [];
  NATIONS.forEach((a) => {
    const adjNations = new Set<string>();
    Object.entries(state.ownership).forEach(([pid, owner]) => {
      if (owner !== a.id) return;
      neighborsOf(pid).forEach((nb) => {
        const o = state.ownership[nb.id];
        if (o && o !== a.id) adjNations.add(o);
      });
    });
    adjNations.forEach((b) => {
      if (a.id < b) pairs.push([a.id, b]);
    });
  });
  pairs.forEach(([a, b], idx) => {
    if (rng() > 0.7) return;
    const intent = pick(rng, INTENTS);
    const from = rng() > 0.5 ? a : b;
    const to = from === a ? b : a;
    const nf = nationById(state, from)!;
    const nt = nationById(state, to)!;
    const text = pick(rng, CHANNEL_TEMPLATES[intent]);
    let trustDelta = 0;
    if (intent === '结盟' || intent === '协同' || intent === '求和') trustDelta = 6 + Math.floor(rng() * 8);
    if (intent === '恐吓') trustDelta = -8 - Math.floor(rng() * 6);
    if (intent === '背叛') trustDelta = -20 - Math.floor(rng() * 10);
    const key = `${to}->${from}`;
    state.trust[key] = Math.max(0, Math.min(100, (state.trust[key] ?? 50) + trustDelta));
    messages.push({
      id: `m${state.year}-${state.phaseIndex}-${idx}`,
      year: state.year,
      phaseLabel,
      from,
      to,
      channel: `${nf.short}—${nt.short} 秘密信道`,
      text,
      intent,
      trustDelta,
    });
    if (intent === '背叛') {
      reports.push({
        id: `br${state.year}-${state.phaseIndex}-${idx}`,
        year: state.year,
        phaseLabel,
        text: `【背叛】${nf.name}在密信中假意结盟，实则暗中调兵，直指${nt.name}侧翼。`,
        tone: 'betrayal',
      });
    } else if (intent === '结盟') {
      reports.push({
        id: `br${state.year}-${state.phaseIndex}-${idx}`,
        year: state.year,
        phaseLabel,
        text: `【结盟】${nf.name}与${nt.name}就互不侵犯达成默契，局势暂趋缓和。`,
        tone: 'alliance',
      });
    }
  });

  const occupied: Record<string, Unit> = {};
  state.units.forEach((u) => (occupied[u.location] = u));
  const moveTargets: Record<string, Unit[]> = {};

  state.units.forEach((u) => {
    u.dislodged = false;
    const nat = nationById(state, u.owner)!;
    // 严格：只能沿相邻格移动/进攻，且需满足单位可进入规则
    const validTargets = neighborsOf(u.location).filter((p) => canEnter(u.type, p));
    const aggression = (nat.traits.expansion + (nat.traits.risk === '豪赌型' ? 30 : nat.traits.risk === '机会主义' ? 10 : 0)) / 130;
    if (validTargets.length && rng() < aggression) {
      const scored = [...validTargets].sort((p1, p2) => {
        const s1 = (p1.isSC ? 2 : 0) + (state.ownership[p1.id] && state.ownership[p1.id] !== u.owner ? 1 : 0);
        const s2 = (p2.isSC ? 2 : 0) + (state.ownership[p2.id] && state.ownership[p2.id] !== u.owner ? 1 : 0);
        return s2 - s1;
      });
      const dest = scored[0];
      u.order = { type: 'Move', from: u.location, to: dest.id };
      (moveTargets[dest.id] = moveTargets[dest.id] || []).push(u);
      conflicts.push({ province: dest.id, kind: state.ownership[dest.id] && state.ownership[dest.id] !== u.owner ? '进攻' : '占领变化' });
    } else if (validTargets.length && rng() < 0.35) {
      const target = pick(rng, validTargets);
      u.order = { type: 'Support', target: target.id };
      conflicts.push({ province: u.location, kind: '支援' });
    } else {
      u.order = { type: 'Hold' };
      conflicts.push({ province: u.location, kind: '防守' });
    }
  });

  Object.entries(moveTargets).forEach(([dest, movers]) => {
    if (movers.length > 1) {
      conflicts.push({ province: dest, kind: '争夺' });
      return;
    }
    const mover = movers[0];
    const defender = occupied[dest];
    const support = state.units.filter(
      (s) => s.order?.type === 'Support' && s.order.target === dest && s.owner === mover.owner && s.location !== dest,
    ).length;
    const attackStrength = 1 + support;
    let defenseStrength = 0;
    if (defender && defender.location === dest) {
      defenseStrength = 1 + state.units.filter(
        (s) => s.order?.type === 'Support' && s.order.target === dest && s.owner === defender.owner,
      ).length;
    }
    if (attackStrength > defenseStrength) {
      if (defender && defender.owner !== mover.owner) {
        defender.dislodged = true;
        conflicts.push({ province: dest, kind: '撤退' });
      }
      const prevOwner = state.ownership[dest];
      mover.location = dest;
      if (PROVINCE_MAP[dest].type !== 'sea' && PROVINCE_MAP[dest].type !== 'mountain') {
        state.ownership[dest] = mover.owner;
        if (PROVINCE_MAP[dest].isSC && prevOwner !== mover.owner) {
          conflicts.push({ province: dest, kind: '占领变化' });
          const mn = nationById(state, mover.owner)!;
          const pn = PROVINCE_MAP[dest].name;
          reports.push({
            id: `br${state.year}-${state.phaseIndex}-cap-${dest}`,
            year: state.year,
            phaseLabel,
            text: `【扩张】${mn.name}攻占补给中心「${pn}」${prevOwner ? `，夺自${nationById(state, prevOwner)?.name}` : '（原属中立）'}。`,
            tone: 'expansion',
          });
        }
      } else {
        state.ownership[dest] = null;
      }
    } else {
      conflicts.push({ province: dest, kind: '防守' });
    }
  });

  const seen = new Set<string>();
  state.conflicts = conflicts.filter((c) => {
    const k = `${c.province}:${c.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  state.messages = [...messages, ...state.messages].slice(0, 200);
  state.reports = [...reports, ...state.reports].slice(0, 200);
  state.scCount = countSC(state.ownership);
}

function resolveRetreat(state: GameState, rng: () => number, phaseLabel: string): void {
  const conflicts: ConflictMark[] = [];
  const occupied = new Set(state.units.map((u) => u.location));
  const survivors: Unit[] = [];
  const reports: BattleReportItem[] = [];
  state.units.forEach((u) => {
    if (!u.dislodged) {
      survivors.push(u);
      return;
    }
    const options = neighborsOf(u.location).filter((p) => {
      if (occupied.has(p.id)) return false;
      return canEnter(u.type, p);
    });
    if (options.length) {
      const dest = pick(rng, options);
      u.location = dest.id;
      u.dislodged = false;
      occupied.add(dest.id);
      conflicts.push({ province: dest.id, kind: '撤退' });
      survivors.push(u);
    } else {
      reports.push({
        id: `br${state.year}-${state.phaseIndex}-des-${u.id}`,
        year: state.year,
        phaseLabel,
        text: `【溃散】${nationById(state, u.owner)?.name}的一支${u.type === 'Army' ? '陆军(Army)' : '海军(Fleet)'}四面楚歌，无路可退，就地解散。`,
        tone: 'conflict',
      });
    }
  });
  state.units = survivors;
  state.conflicts = conflicts;
  state.reports = [...reports, ...state.reports].slice(0, 200);
  state.scCount = countSC(state.ownership);
}

function resolveWinter(state: GameState, rng: () => number, phaseLabel: string): void {
  const reports: BattleReportItem[] = [];
  const occupied = new Set(state.units.map((u) => u.location));
  NATIONS.forEach((n) => {
    const sc = state.scCount[n.id] || 0;
    const army = unitsOf(state, n.id).length;
    if (sc > army) {
      const freeHomes = n.homeCenters.filter((h) => state.ownership[h] === n.id && !occupied.has(h));
      let toBuild = Math.min(sc - army, freeHomes.length);
      freeHomes.forEach((h) => {
        if (toBuild <= 0) return;
        const isCoast = PROVINCE_MAP[h].type === 'coast';
        const type: UnitType = isCoast && rng() > 0.5 ? 'Fleet' : 'Army';
        state.units.push({ id: `u${n.id}-${state.year}-${h}`, owner: n.id, type, location: h });
        occupied.add(h);
        toBuild--;
      });
      if (sc - army > 0) {
        reports.push({
          id: `br${state.year}-w-${n.id}`,
          year: state.year,
          phaseLabel,
          text: `【调整】${n.name}拥 ${sc} 个 SC、${army} 支单位，于大本营增兵。`,
          tone: 'expansion',
        });
      }
    } else if (sc < army) {
      const cull = army - sc;
      const own = unitsOf(state, n.id);
      const away = own.filter((u) => !n.homeCenters.includes(u.location));
      const list = (away.length ? away : own).slice(0, cull).map((u) => u.id);
      state.units = state.units.filter((u) => !list.includes(u.id));
      reports.push({
        id: `br${state.year}-w-${n.id}`,
        year: state.year,
        phaseLabel,
        text: `【裁军】${n.name}仅剩 ${sc} 个 SC，被迫裁撤 ${cull} 支单位以维持补给。`,
        tone: 'conflict',
      });
    }
  });
  state.conflicts = [];
  state.reports = [...reports, ...state.reports].slice(0, 200);
  state.scCount = countSC(state.ownership);
}

function resolveReview(state: GameState, phaseLabel: string): void {
  const ranked = [...NATIONS].sort((a, b) => (state.scCount[b.id] || 0) - (state.scCount[a.id] || 0));
  const leader = ranked[0];
  const summary = `${state.year} 年终：${leader.name}以 ${state.scCount[leader.id]} 个 SC 领跑，${ranked[1].name}紧随其后。玩家可在本阶段消耗额度微调各国 System Prompt / Skills.md，并发布下一年度建议。`;
  state.history.unshift({
    year: state.year,
    season: '冬季',
    phaseLabel,
    summary,
    scSnapshot: { ...state.scCount },
  });
  state.reports = [
    { id: `br${state.year}-review`, year: state.year, phaseLabel, text: summary, tone: 'neutral' },
    ...state.reports,
  ].slice(0, 200);

  if ((state.scCount[leader.id] || 0) >= 12) {
    state.status = 'finished';
    state.reports.unshift({
      id: `br${state.year}-win`,
      year: state.year,
      phaseLabel,
      text: `【终局】${leader.name}控制了 ${state.scCount[leader.id]} 个补给中心，达成霸权，本局历史编年史就此定格。`,
      tone: 'expansion',
    });
  }
}

export function advancePhase(prev: GameState): GameState {
  if (prev.status === 'finished') return prev;
  const state: GameState = JSON.parse(JSON.stringify(prev));
  const current = phaseAt(state.phaseIndex);
  const rng = mulberry32(state.seed + state.year * 131 + state.phaseIndex * 17);
  const label = `${state.year} ${current.label}`;

  switch (current.key) {
    case 'spring':
    case 'autumn':
      resolveOrders(state, rng, label);
      break;
    case 'springRetreat':
    case 'autumnRetreat':
      resolveRetreat(state, rng, label);
      break;
    case 'winter':
      resolveWinter(state, rng, label);
      break;
    case 'review':
      resolveReview(state, label);
      break;
  }

  state.phaseIndex += 1;
  if (state.phaseIndex >= PHASES.length) {
    state.phaseIndex = 0;
    state.year += 1;
  }
  if (state.status !== 'finished') {
    state.status = phaseAt(state.phaseIndex).key === 'review' ? 'awaiting' : 'reasoning';
  }
  return state;
}

export function startGame(prev: GameState): GameState {
  const state: GameState = JSON.parse(JSON.stringify(prev));
  state.started = true;
  state.status = 'reasoning';
  state.reports = [
    { id: `br-start-${Date.now()}`, year: state.year, phaseLabel: '开局', text: `${state.year} 年，年度治理循环正式开启，请在游戏控制台推进春季阶段。`, tone: 'neutral' },
    ...state.reports,
  ];
  return state;
}

export function exportState(state: GameState): string {
  return JSON.stringify(
    {
      year: state.year,
      phase: phaseAt(state.phaseIndex).label,
      status: state.status,
      scCount: state.scCount,
      units: state.units,
      ownership: state.ownership,
      trust: state.trust,
      messages: state.messages,
      history: state.history,
    },
    null,
    2,
  );
}
