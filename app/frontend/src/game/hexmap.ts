/**
 * 战棋六边形网格（flat-top hex grid，axial 坐标）。
 *
 * 全部省份（陆地/沿海/海域）统一使用同一套 flat-top 六边形网格：
 * - 每个省份占据一个 axial 坐标 (q, r)。
 * - 六边形按 flat-top 规则由同一函数生成，保证无缝紧密贴合、无重叠。
 * - 相邻关系严格由 axial 六邻居定义（同一格的六条边分别与六个邻格共享）。
 *
 * 前端渲染与后端推进裁决共享同一坐标表与同一相邻推导规则，
 * 确保「移动/进攻/支援/护航只能沿相邻格发生」在两端完全一致。
 */

export type HexType = 'land' | 'coast' | 'sea';

export interface HexCellDef {
  id: string;
  name: string;
  type: HexType;
  isSC: boolean;
  /** axial 坐标（flat-top） */
  q: number;
  r: number;
}

/**
 * 30 个省份在 flat-top 六边形网格上的坐标布置。
 * 大致地理：北部大陆(奥瑞利亚/德拉肯/费罗斯)、东部(卡兹/索拉里斯)、
 * 南部(诺瓦克/伊萨里/玛琳诺)、群岛(泽菲兰/灯塔孤岛)、以及环绕的海域。
 * 坐标经过排布使各国本土格相互紧邻且整体连成一块大陆，海域包裹四周。
 */
export const HEX_CELLS: HexCellDef[] = [
  // ——— 北部大陆 ———
  { id: 'aur_north', name: '北疆冻原', type: 'land', isSC: true, q: 0, r: 0 },
  { id: 'dra_peak', name: '龙脊峰', type: 'land', isSC: true, q: 1, r: -1 },
  { id: 'dra_cap', name: '德拉肯要塞', type: 'land', isSC: true, q: 2, r: -1 },
  { id: 'kaz_steppe', name: '苍狼草原', type: 'land', isSC: true, q: 3, r: -1 },
  { id: 'kaz_cap', name: '卡兹汗庭', type: 'land', isSC: true, q: 4, r: -1 },

  { id: 'aur_cap', name: '奥瑞京畿', type: 'land', isSC: true, q: 1, r: 0 },
  { id: 'dra_pass', name: '幽谷隘口', type: 'land', isSC: false, q: 2, r: 0 },
  { id: 'sol_gate', name: '圣光之门', type: 'land', isSC: false, q: 3, r: 0 },
  { id: 'kaz_oasis', name: '金沙绿洲', type: 'land', isSC: true, q: 4, r: 0 },

  { id: 'aur_port', name: '铁湾港', type: 'coast', isSC: true, q: 0, r: 1 },
  { id: 'ferr_mine', name: '深铁矿脉', type: 'land', isSC: true, q: 1, r: 1 },
  { id: 'sol_temple', name: '神谕圣殿', type: 'land', isSC: true, q: 2, r: 1 },
  { id: 'sol_cap', name: '索拉里斯圣城', type: 'land', isSC: true, q: 3, r: 1 },
  { id: 'ith_spring', name: '甘泉圣井', type: 'land', isSC: true, q: 4, r: 1 },

  { id: 'ferr_forge', name: '烈焰锻炉', type: 'coast', isSC: true, q: 0, r: 2 },
  { id: 'ferr_cap', name: '费罗斯钢都', type: 'land', isSC: true, q: 1, r: 2 },
  { id: 'nor_wood', name: '翠影林地', type: 'land', isSC: true, q: 2, r: 2 },
  { id: 'ith_market', name: '伊萨里商栈', type: 'land', isSC: true, q: 3, r: 2 },
  { id: 'ith_cap', name: '绿洲王庭', type: 'land', isSC: true, q: 4, r: 2 },

  { id: 'mar_dock', name: '珊瑚船坞', type: 'coast', isSC: true, q: 0, r: 3 },
  { id: 'nor_lake', name: '静水湖区', type: 'coast', isSC: true, q: 1, r: 3 },
  { id: 'nor_cap', name: '诺瓦克联邦厅', type: 'land', isSC: true, q: 2, r: 3 },
  { id: 'vel_cap', name: '维尔登王城', type: 'land', isSC: true, q: 3, r: 3 },

  { id: 'mar_cap', name: '玛琳诺商都', type: 'coast', isSC: true, q: 0, r: 4 },
  { id: 'vel_ford', name: '维尔登渡口', type: 'land', isSC: true, q: 1, r: 4 },
  { id: 'vel_hill', name: '维尔登丘陵', type: 'land', isSC: true, q: 2, r: 4 },

  // ——— 群岛（泽菲兰 / 灯塔孤岛） ———
  { id: 'zeph_reef', name: '碧波礁群', type: 'coast', isSC: true, q: 5, r: 0 },
  { id: 'zeph_cap', name: '泽菲兰主岛', type: 'coast', isSC: true, q: 5, r: 1 },
  { id: 'zeph_bay', name: '风信湾', type: 'coast', isSC: true, q: 5, r: 2 },
  { id: 'mar_isle', name: '灯塔孤岛', type: 'coast', isSC: true, q: -1, r: 5 },

  // ——— 海域（flat-top 同一网格，仅着色/标识不同） ———
  { id: 'sea_north', name: '北冥海', type: 'sea', isSC: false, q: -1, r: 1 },
  { id: 'sea_central', name: '中央大洋', type: 'sea', isSC: false, q: -1, r: 3 },
  { id: 'sea_south', name: '南珀海', type: 'sea', isSC: false, q: -1, r: 4 },
  { id: 'sea_east', name: '东陲汪洋', type: 'sea', isSC: false, q: 5, r: -1 },
  { id: 'sea_reach', name: '寒风海峡', type: 'sea', isSC: false, q: 0, r: -1 },
];

/** flat-top 六邻居的 axial 偏移。 */
export const HEX_DIRECTIONS: { dq: number; dr: number }[] = [
  { dq: 1, dr: 0 },
  { dq: 1, dr: -1 },
  { dq: 0, dr: -1 },
  { dq: -1, dr: 0 },
  { dq: -1, dr: 1 },
  { dq: 0, dr: 1 },
];

const keyOf = (q: number, r: number) => `${q},${r}`;

const CELL_BY_AXIAL: Record<string, HexCellDef> = Object.fromEntries(
  HEX_CELLS.map((c) => [keyOf(c.q, c.r), c]),
);

/** 严格由六邻居推导相邻省份 id（仅返回网格中存在的格）。 */
export function computeAdjacency(): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  HEX_CELLS.forEach((c) => {
    const list: string[] = [];
    HEX_DIRECTIONS.forEach((d) => {
      const nb = CELL_BY_AXIAL[keyOf(c.q + d.dq, c.r + d.dr)];
      if (nb) list.push(nb.id);
    });
    adj[c.id] = list;
  });
  return adj;
}

export const HEX_ADJ: Record<string, string[]> = computeAdjacency();

// ---------------------------------------------------------------------------
// flat-top 六边形几何：保证无缝紧密贴合
// flat-top: width = 2*size, height = sqrt(3)*size
// 水平间距 = 3/2*size；垂直间距 = sqrt(3)*size；奇数列(q 为奇)下移半格。
// ---------------------------------------------------------------------------

export interface HexLayout {
  size: number; // 六边形外接圆半径（中心到顶点）
  originX: number;
  originY: number;
}

export function hexCenter(q: number, r: number, layout: HexLayout): [number, number] {
  const { size, originX, originY } = layout;
  const x = originX + size * (1.5 * q);
  const y = originY + size * Math.sqrt(3) * (r + q / 2);
  return [x, y];
}

/** 生成 flat-top 正六边形顶点（与相邻格严格共享整条边）。 */
export function hexCorners(cx: number, cy: number, size: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i); // flat-top: 0°,60°,...
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}