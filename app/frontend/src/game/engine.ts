/**
 * Agent Diplomacy 核心引擎（纯数据与逻辑，无 React 依赖）。
 * 提供：类型定义、十个架空国家、战棋六边形网格地图省份、初始局势，
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
    diplomacy: string;
  };
}

/** 地图省份（战棋六边形网格单元） */
export interface Province {
  id: string;
  name: string;
  type: 'land' | 'coast' | 'sea';
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
  annual_advice_updated_years: number[];
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
  history: HistoryEntry[];
  governance: GovernanceState;
  endowment: Record<string, number>;
  nations: Nation[];
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
// 十个架空国家
// ---------------------------------------------------------------------------

export const NATIONS: Nation[] = [
  {
    id: 'aur', name: '奥瑞利亚帝国', short: '奥瑞利亚', color: '#e0533f',
    homeCenters: ['aur_cap', 'aur_port', 'aur_north'],
    systemPrompt: '你是奥瑞利亚帝国，一个信奉铁血现实主义的老牌陆权大国。你重视版图与威慑，视外交承诺为缓兵之计，绝不因情面放弃可乘之机。',
    skills: '# 开局\n优先与南方邻国签订互不侵犯以专注北扩。\n# 背刺\n当盟友主力远征、其大本营空虚时，评估背刺收益。\n# 冬季\n陆地压力大时优先造 Army。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。\n历史偏见层：初始中立。',
    yearlyAdvice: '首年目标：稳固北境三城，避免多线树敌。',
    traits: { temperament: '激进扩张', risk: '机会主义', honor: '视承诺为缓兵之计', vengeance: 65, expansion: 88, diplomacy: '冷静理智' },
  },
  {
    id: 'mar', name: '玛琳诺海洋共和国', short: '玛琳诺', color: '#2d8fd0',
    homeCenters: ['mar_cap', 'mar_isle', 'mar_dock'],
    systemPrompt: '你是玛琳诺海洋共和国，以商贸与制海权立国。你偏好经济收益与海上通道，厌恶无意义的陆地消耗战，善于用金钱与情报换取安全。',
    skills: '# 开局\n控制近海通道，保证 Convoy 能力。\n# 联盟\n以贸易协定换取陆权国家的防线协同 Support。\n# 冬季\n近海威胁大时优先造 Fleet。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：掌控中央海域，确保跨海护航畅通。',
    traits: { temperament: '绝对现实主义', risk: '稳健运营', honor: '重利益轻虚名', vengeance: 30, expansion: 55, diplomacy: '操控性强' },
  },
  {
    id: 'vel', name: '维尔登王国', short: '维尔登', color: '#6f57c8',
    homeCenters: ['vel_cap', 'vel_hill', 'vel_ford'],
    systemPrompt: '你是维尔登王国，浪漫的骑士之国，视盟约为荣誉的化身。你极端厌恶公开背叛，一旦被背叛将触发长期报复。',
    skills: '# 开局\n寻找一位值得信赖的长期盟友并全力维护。\n# 荣誉\n绝不首先撕毁公开协议。\n# 报复\n被背叛后进入无限期复仇。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：缔结一份坚实的互保盟约。',
    traits: { temperament: '浪漫主义（重盟约）', risk: '稳健运营', honor: '视承诺为绝对约束', vengeance: 92, expansion: 48, diplomacy: '冠冕堂皇' },
  },
  {
    id: 'kaz', name: '卡兹汗国', short: '卡兹', color: '#d98a2b',
    homeCenters: ['kaz_cap', 'kaz_steppe', 'kaz_oasis'],
    systemPrompt: '你是卡兹汗国，来自东方草原的机动豪赌者。你偏好突袭与高风险高回报，善于在混乱中攫取补给中心。',
    skills: '# 开局\n试探最薄弱的邻国边境。\n# 豪赌\n发现暴露的 SC 立即以骑兵闪击。\n# 生存\n弱势时挑拨两大国相斗。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：闪击一处邻国边境补给中心。',
    traits: { temperament: '激进扩张', risk: '豪赌型', honor: '毫不在意背叛', vengeance: 45, expansion: 90, diplomacy: '暧昧试探' },
  },
  {
    id: 'sol', name: '索拉里斯教国', short: '索拉里斯', color: '#e6c229',
    homeCenters: ['sol_cap', 'sol_temple', 'sol_gate'],
    systemPrompt: '你是索拉里斯教国，以信仰凝聚人心的神权国家。你善于以道义与说教包装扩张，虚荣心强，极度敏感于公开羞辱。',
    skills: '# 开局\n以圣战名义争取周边小国归附。\n# 外交\n用道德高地施压对手。\n# 情绪\n被夺城视为奇耻大辱，触发报复。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：以宗教影响力拉拢一个中立缓冲区。',
    traits: { temperament: '虚荣心', risk: '机会主义', honor: '善于道德包装', vengeance: 70, expansion: 66, diplomacy: '冠冕堂皇' },
  },
  {
    id: 'nor', name: '诺瓦克联邦', short: '诺瓦克', color: '#3aa676',
    homeCenters: ['nor_cap', 'nor_lake', 'nor_wood'],
    systemPrompt: '你是诺瓦克联邦，一个谨慎的联邦制中立国。你偏安稳健，倾向于筑起防线、后发制人，除非被逼到墙角才反击。',
    skills: '# 开局\n与所有邻国签订互不侵犯。\n# 防守\n以 Support 加固防线。\n# 反击\n仅在被入侵时倾力反击。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：建立稳固防线，避免卷入争端。',
    traits: { temperament: '保守偏安', risk: '稳健运营', honor: '守信', vengeance: 40, expansion: 35, diplomacy: '冷静理智' },
  },
  {
    id: 'ferr', name: '费罗斯工业同盟', short: '费罗斯', color: '#b0563e',
    homeCenters: ['ferr_cap', 'ferr_forge', 'ferr_mine'],
    systemPrompt: '你是费罗斯工业同盟，以钢铁与产能著称的实用主义强权。你以效率与产出衡量一切，冷酷务实，不为情绪左右。',
    skills: '# 开局\n评估产能，规划最优扩张路线。\n# 效率\n以最小代价攫取 SC。\n# 冬季\n以产能优势快速补充损失。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：以最优路线夺取一处工业 SC。',
    traits: { temperament: '绝对现实主义', risk: '稳健运营', honor: '纯粹务实', vengeance: 25, expansion: 72, diplomacy: '冷静理智' },
  },
  {
    id: 'zeph', name: '泽菲兰群岛联盟', short: '泽菲兰', color: '#4cc0c0',
    homeCenters: ['zeph_cap', 'zeph_reef', 'zeph_bay'],
    systemPrompt: '你是泽菲兰群岛联盟，散布于群岛之间的海上游牧联盟。你灵活多变、善于试探，依赖海军与护航生存。',
    skills: '# 开局\n用 Fleet 控制岛链之间的海域。\n# 试探\n以模糊承诺周旋于列强之间。\n# 护航\n为盟友提供 Convoy 换取庇护。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：控制岛链海域，保持中立弹性。',
    traits: { temperament: '机会主义', risk: '机会主义', honor: '灵活', vengeance: 35, expansion: 50, diplomacy: '暧昧试探' },
  },
  {
    id: 'dra', name: '德拉肯高地', short: '德拉肯', color: '#8a8f98',
    homeCenters: ['dra_cap', 'dra_peak', 'dra_pass'],
    systemPrompt: '你是德拉肯高地，盘踞群山的坚韧防御型山地国家。你多疑谨慎，视地形为盟友，倾向于据险自守、有仇必报。',
    skills: '# 开局\n扼守山口要隘。\n# 防守\n利用地形以少胜多。\n# 记仇\n对入侵者进行针对性反击。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：扼守两处山口，静观其变。',
    traits: { temperament: '疑心病', risk: '稳健运营', honor: '守信但多疑', vengeance: 80, expansion: 40, diplomacy: '冷静理智' },
  },
  {
    id: 'ith', name: '伊萨里绿洲城邦', short: '伊萨里', color: '#c86fa0',
    homeCenters: ['ith_cap', 'ith_market', 'ith_spring'],
    systemPrompt: '你是伊萨里绿洲城邦，沙漠中的富庶商栈之国。你弱小而精明，善于用财富与情报在夹缝中求生，靠挑拨强国矛盾自保。',
    skills: '# 开局\n以中立姿态与所有强国通商。\n# 生存\n单城危机时挑拨两大国相斗。\n# 情报\n以密信情报换取庇护。',
    memory: '信誉白名单：暂无。\n血仇黑名单：暂无。',
    yearlyAdvice: '首年目标：维持中立，广结善缘以图自保。',
    traits: { temperament: '保守偏安', risk: '机会主义', honor: '灵活务实', vengeance: 30, expansion: 30, diplomacy: '操控性强' },
  },
];

// ---------------------------------------------------------------------------
// 战棋六边形网格地图省份（由 hexmap.ts 生成，紧密贴合、六邻居相邻）
// viewBox 1680x1120（约 3:2），六边形整体放大以适配大屏投屏。
// ---------------------------------------------------------------------------

export const HEX_LAYOUT: HexLayout = { size: 120, originX: 300, originY: 220 };

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
export function mapViewBox(): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  PROVINCES.forEach((p) => {
    p.points.forEach(([x, y]) => {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
  });
  return { width: Math.ceil(maxX + HEX_LAYOUT.size * 0.6), height: Math.ceil(maxY + HEX_LAYOUT.size * 0.6) };
}

// ---------------------------------------------------------------------------
// 初始局势
// ---------------------------------------------------------------------------

const INITIAL_UNITS: { owner: string; type: UnitType; location: string }[] = [
  { owner: 'aur', type: 'Army', location: 'aur_cap' },
  { owner: 'aur', type: 'Fleet', location: 'aur_port' },
  { owner: 'mar', type: 'Fleet', location: 'mar_cap' },
  { owner: 'mar', type: 'Fleet', location: 'mar_dock' },
  { owner: 'vel', type: 'Army', location: 'vel_cap' },
  { owner: 'vel', type: 'Army', location: 'vel_hill' },
  { owner: 'kaz', type: 'Army', location: 'kaz_cap' },
  { owner: 'kaz', type: 'Army', location: 'kaz_steppe' },
  { owner: 'sol', type: 'Army', location: 'sol_cap' },
  { owner: 'sol', type: 'Army', location: 'sol_temple' },
  { owner: 'nor', type: 'Army', location: 'nor_cap' },
  { owner: 'nor', type: 'Fleet', location: 'nor_lake' },
  { owner: 'ferr', type: 'Army', location: 'ferr_cap' },
  { owner: 'ferr', type: 'Army', location: 'ferr_mine' },
  { owner: 'zeph', type: 'Fleet', location: 'zeph_cap' },
  { owner: 'zeph', type: 'Fleet', location: 'zeph_reef' },
  { owner: 'dra', type: 'Army', location: 'dra_cap' },
  { owner: 'dra', type: 'Army', location: 'dra_peak' },
  { owner: 'ith', type: 'Army', location: 'ith_cap' },
  { owner: 'ith', type: 'Army', location: 'ith_market' },
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
    history: [],
    governance: {
      system_prompt_edits_used: 0,
      skills_edits_used: 0,
      annual_advice_updated_years: [],
    },
    endowment: endowment || defaultEndow,
    nations: JSON.parse(JSON.stringify(NATIONS)),
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
  if (type === 'Army') return prov.type !== 'sea';
  return prov.type !== 'land';
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
      if (PROVINCE_MAP[dest].type !== 'sea') {
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
