/**
 * Flat-top axial hex map definition shared by the frontend render engine.
 * Province adjacency is derived strictly from axial neighbors.
 */

export type HexType = 'land' | 'coast' | 'sea' | 'mountain';

export interface HexCellDef {
  id: string;
  name: string;
  type: HexType;
  isSC: boolean;
  q: number;
  r: number;
}

export const HEX_CELLS: HexCellDef[] = [
  // Northern impassable mountain wall
  { id: 'mt_frosthorn', name: '霜角山脉', type: 'mountain', isSC: false, q: -1, r: -2 },
  { id: 'mt_skytooth', name: '天齿岭', type: 'mountain', isSC: false, q: 0, r: -2 },
  { id: 'mt_winterkeep', name: '寒垒群峰', type: 'mountain', isSC: false, q: 1, r: -2 },
  { id: 'mt_ashencrest', name: '灰冠岭', type: 'mountain', isSC: false, q: 2, r: -2 },
  { id: 'mt_sunspine', name: '曜脊山', type: 'mountain', isSC: false, q: 3, r: -2 },
  { id: 'mt_goldwall', name: '金垣山', type: 'mountain', isSC: false, q: 4, r: -2 },
  { id: 'mt_redfang', name: '赤牙峰', type: 'mountain', isSC: false, q: 5, r: -2 },
  { id: 'mt_farwatch', name: '望北群山', type: 'mountain', isSC: false, q: 6, r: -2 },

  // Northern frontier
  { id: 'sea_upper_nw', name: '寒潮外海', type: 'sea', isSC: false, q: -2, r: -1 },
  { id: 'aur_march', name: '霜盾海角', type: 'coast', isSC: true, q: -1, r: -1 },
  { id: 'dra_watch', name: '霜哨高台', type: 'land', isSC: true, q: 0, r: -1 },
  { id: 'dra_peak', name: '龙脊峰', type: 'land', isSC: true, q: 1, r: -1 },
  { id: 'dra_cap', name: '德拉肯要塞', type: 'land', isSC: true, q: 2, r: -1 },
  { id: 'kaz_steppe', name: '苍狼草原', type: 'land', isSC: true, q: 3, r: -1 },
  { id: 'kaz_cap', name: '卡兹汗庭', type: 'land', isSC: true, q: 4, r: -1 },
  { id: 'kaz_ford', name: '赤河渡口', type: 'coast', isSC: true, q: 5, r: -1 },
  { id: 'sea_high_north', name: '高北洋', type: 'sea', isSC: false, q: 6, r: -1 },
  { id: 'sea_ne_hook', name: '北隅海', type: 'sea', isSC: false, q: 7, r: -1 },

  // Upper belt
  { id: 'sea_far_nw', name: '寒风海峡', type: 'sea', isSC: false, q: -2, r: 0 },
  { id: 'mt_rimepass', name: '霜崖天险', type: 'mountain', isSC: false, q: -1, r: 0 },
  { id: 'aur_north', name: '北疆冻原', type: 'land', isSC: true, q: 0, r: 0 },
  { id: 'aur_cap', name: '奥瑞京畿', type: 'land', isSC: true, q: 1, r: 0 },
  { id: 'dra_pass', name: '幽谷隘口', type: 'land', isSC: true, q: 2, r: 0 },
  { id: 'sol_gate', name: '圣光之门', type: 'land', isSC: true, q: 3, r: 0 },
  { id: 'kaz_oasis', name: '金沙绿洲', type: 'land', isSC: true, q: 4, r: 0 },
  { id: 'east_gulf', name: '赤河内海', type: 'sea', isSC: false, q: 5, r: 0 },
  { id: 'zeph_reef', name: '碧波礁群', type: 'coast', isSC: true, q: 6, r: 0 },
  { id: 'sea_outer_ne', name: '东冠洋', type: 'sea', isSC: false, q: 7, r: 0 },

  // Northern middle
  { id: 'sea_northwest', name: '西风洋', type: 'sea', isSC: false, q: -2, r: 1 },
  { id: 'aur_cliff', name: '断潮崖岸', type: 'coast', isSC: false, q: -1, r: 1 },
  { id: 'aur_port', name: '铁湾港', type: 'land', isSC: true, q: 0, r: 1 },
  { id: 'ferr_mine', name: '深铁矿脉', type: 'land', isSC: true, q: 1, r: 1 },
  { id: 'sol_temple', name: '神谕圣殿', type: 'land', isSC: true, q: 2, r: 1 },
  { id: 'sol_cap', name: '索拉里斯圣城', type: 'land', isSC: true, q: 3, r: 1 },
  { id: 'ith_spring', name: '甘泉圣井', type: 'coast', isSC: true, q: 4, r: 1 },
  { id: 'amber_cross', name: '琥珀十字', type: 'land', isSC: true, q: 5, r: 1 },
  { id: 'zeph_cap', name: '泽菲兰主岛', type: 'coast', isSC: true, q: 6, r: 1 },
  { id: 'sea_east_ocean', name: '东穹洋', type: 'sea', isSC: false, q: 7, r: 1 },

  // Central belt
  { id: 'sea_west_north', name: '西涡海', type: 'sea', isSC: false, q: -2, r: 2 },
  { id: 'ferr_works', name: '齿轮工坊', type: 'coast', isSC: true, q: -1, r: 2 },
  { id: 'ferr_forge', name: '烈焰锻炉', type: 'coast', isSC: true, q: 0, r: 2 },
  { id: 'ferr_cap', name: '费罗斯钢都', type: 'land', isSC: true, q: 1, r: 2 },
  { id: 'nor_wood', name: '翠影林地', type: 'land', isSC: true, q: 2, r: 2 },
  { id: 'sol_plain', name: '曙光原野', type: 'land', isSC: true, q: 3, r: 2 },
  { id: 'ith_market', name: '伊萨里商栈', type: 'land', isSC: true, q: 4, r: 2 },
  { id: 'ith_garden', name: '绿庭花苑', type: 'land', isSC: true, q: 5, r: 2 },
  { id: 'zeph_bay', name: '风信湾', type: 'coast', isSC: true, q: 6, r: 2 },
  { id: 'sea_east_mid', name: '东穹海', type: 'sea', isSC: false, q: 7, r: 2 },

  // Southern middle
  { id: 'sea_west_inner', name: '西湾海', type: 'sea', isSC: false, q: -2, r: 3 },
  { id: 'sea_west_inlet', name: '西湾内海', type: 'sea', isSC: false, q: -1, r: 3 },
  { id: 'mar_dock', name: '珊瑚船坞', type: 'coast', isSC: true, q: 0, r: 3 },
  { id: 'nor_lake', name: '静水湖区', type: 'land', isSC: true, q: 1, r: 3 },
  { id: 'nor_cap', name: '诺瓦克联邦厅', type: 'land', isSC: true, q: 2, r: 3 },
  { id: 'vel_cap', name: '维尔登王城', type: 'land', isSC: true, q: 3, r: 3 },
  { id: 'ith_cap', name: '伊萨里商祠', type: 'land', isSC: true, q: 4, r: 3 },
  { id: 'windward_key', name: '迎风礁门', type: 'coast', isSC: true, q: 5, r: 3 },
  { id: 'zeph_atoll', name: '环环礁', type: 'coast', isSC: true, q: 6, r: 3 },
  { id: 'sea_east_south', name: '东南洋', type: 'sea', isSC: false, q: 7, r: 3 },

  // Lower mainland
  { id: 'sea_west_outer', name: '雾潮海', type: 'sea', isSC: false, q: -2, r: 4 },
  { id: 'nor_harbor', name: '雾港', type: 'coast', isSC: true, q: -1, r: 4 },
  { id: 'mar_cap', name: '玛琳诺商都', type: 'land', isSC: true, q: 0, r: 4 },
  { id: 'vel_ford', name: '维尔登渡口', type: 'land', isSC: true, q: 1, r: 4 },
  { id: 'vel_hill', name: '维尔登丘陵', type: 'land', isSC: true, q: 2, r: 4 },
  { id: 'vel_keep', name: '维尔登堡', type: 'land', isSC: true, q: 3, r: 4 },
  { id: 'vel_harbor', name: '王湾港', type: 'coast', isSC: false, q: 4, r: 4 },
  { id: 'sea_south_channel', name: '南环海峡', type: 'sea', isSC: false, q: 5, r: 4 },
  { id: 'sea_east_shelf', name: '东岬海', type: 'sea', isSC: false, q: 6, r: 4 },

  // Southern coast
  { id: 'sea_far_sw', name: '暮湾外海', type: 'sea', isSC: false, q: -2, r: 5 },
  { id: 'mar_isle', name: '远灯孤岛', type: 'coast', isSC: true, q: -1, r: 5 },
  { id: 'mar_shoal', name: '浅帆滩', type: 'coast', isSC: true, q: 0, r: 5 },
  { id: 'lighthouse_isle', name: '灯塔孤岛', type: 'coast', isSC: true, q: 1, r: 5 },
  { id: 'sea_south_inlet', name: '南湾内海', type: 'sea', isSC: false, q: 2, r: 5 },
  { id: 'sea_south_mid', name: '西南弧海', type: 'sea', isSC: false, q: 3, r: 5 },
  { id: 'sea_south', name: '南珊海', type: 'sea', isSC: false, q: 4, r: 5 },
  { id: 'sea_south_channel_outer', name: '南环外海', type: 'sea', isSC: false, q: 5, r: 5 },

  // Southern outer ring
  { id: 'sea_southwest_arc', name: '西南外海', type: 'sea', isSC: false, q: -1, r: 6 },
  { id: 'sea_southwest_outer', name: '南湾外海', type: 'sea', isSC: false, q: 0, r: 6 },
  { id: 'sea_south_lower', name: '南沙海', type: 'sea', isSC: false, q: 1, r: 6 },
  { id: 'sea_southwest_tail', name: '南弧海', type: 'sea', isSC: false, q: 2, r: 6 },
];

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

export interface HexLayout {
  size: number;
  originX: number;
  originY: number;
}

export function hexCenter(q: number, r: number, layout: HexLayout): [number, number] {
  const { size, originX, originY } = layout;
  const x = originX + size * (1.5 * q);
  const y = originY + size * Math.sqrt(3) * (r + q / 2);
  return [x, y];
}

export function hexCorners(cx: number, cy: number, size: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}
