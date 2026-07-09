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
  // Northern sea edge and island caps
  { id: 'mt_frosthorn', name: '西北外海', type: 'sea', isSC: false, q: -1, r: -2 },
  { id: 'mt_skytooth', name: '九排北港', type: 'coast', isSC: true, q: 0, r: -2 },
  { id: 'mt_winterkeep', name: '九排北营', type: 'land', isSC: true, q: 1, r: -2 },
  { id: 'mt_ashencrest', name: '北中海', type: 'sea', isSC: false, q: 2, r: -2 },
  { id: 'mt_sunspine', name: '五排北岸', type: 'coast', isSC: true, q: 3, r: -2 },
  { id: 'mt_goldwall', name: '四排北营', type: 'land', isSC: true, q: 4, r: -2 },
  { id: 'mt_redfang', name: '四排北港', type: 'coast', isSC: true, q: 5, r: -2 },
  { id: 'mt_farwatch', name: '东北外海', type: 'sea', isSC: false, q: 6, r: -2 },

  // Northern frontier
  { id: 'sea_upper_nw', name: '西北海', type: 'sea', isSC: false, q: -2, r: -1 },
  { id: 'aur_march', name: '一排西港', type: 'coast', isSC: true, q: -1, r: -1 },
  { id: 'dra_watch', name: '九排山脚', type: 'land', isSC: true, q: 0, r: -1 },
  { id: 'dra_peak', name: '九排高地', type: 'land', isSC: true, q: 1, r: -1 },
  { id: 'dra_cap', name: '中央北海', type: 'sea', isSC: false, q: 2, r: -1 },
  { id: 'kaz_steppe', name: '五排西港', type: 'coast', isSC: true, q: 3, r: -1 },
  { id: 'kaz_cap', name: '四排大营', type: 'land', isSC: true, q: 4, r: -1 },
  { id: 'kaz_ford', name: '四排东港', type: 'coast', isSC: true, q: 5, r: -1 },
  { id: 'sea_high_north', name: '东北海', type: 'sea', isSC: false, q: 6, r: -1 },
  { id: 'sea_ne_hook', name: '远东北海', type: 'sea', isSC: false, q: 7, r: -1 },

  // Upper belt
  { id: 'sea_far_nw', name: '西外海', type: 'sea', isSC: false, q: -2, r: 0 },
  { id: 'mt_rimepass', name: '北角滩', type: 'coast', isSC: true, q: -1, r: 0 },
  { id: 'aur_north', name: '西中海峡北段', type: 'sea', isSC: false, q: 0, r: 0 },
  { id: 'aur_cap', name: '一排营地', type: 'land', isSC: true, q: 1, r: 0 },
  { id: 'dra_pass', name: '北中海峡', type: 'sea', isSC: false, q: 2, r: 0 },
  { id: 'sol_gate', name: '五排西门', type: 'coast', isSC: true, q: 3, r: 0 },
  { id: 'kaz_oasis', name: '四排南村', type: 'land', isSC: true, q: 4, r: 0 },
  { id: 'east_gulf', name: '四排南港', type: 'coast', isSC: true, q: 5, r: 0 },
  { id: 'zeph_reef', name: '八排北礁', type: 'coast', isSC: true, q: 6, r: 0 },
  { id: 'sea_outer_ne', name: '东外海', type: 'sea', isSC: false, q: 7, r: 0 },

  // Northern middle
  { id: 'sea_northwest', name: '西中海', type: 'sea', isSC: false, q: -2, r: 1 },
  { id: 'aur_cliff', name: '西岸集镇', type: 'coast', isSC: true, q: -1, r: 1 },
  { id: 'aur_port', name: '西中海峡南段', type: 'sea', isSC: false, q: 0, r: 1 },
  { id: 'ferr_mine', name: '七排北矿', type: 'land', isSC: true, q: 1, r: 1 },
  { id: 'sol_temple', name: '中央海峡北段', type: 'sea', isSC: false, q: 2, r: 1 },
  { id: 'sol_cap', name: '五排大营', type: 'land', isSC: true, q: 3, r: 1 },
  { id: 'ith_spring', name: '十排北泉', type: 'coast', isSC: true, q: 4, r: 1 },
  { id: 'amber_cross', name: '东桥镇', type: 'land', isSC: true, q: 5, r: 1 },
  { id: 'zeph_cap', name: '八排主岛', type: 'coast', isSC: true, q: 6, r: 1 },
  { id: 'sea_east_ocean', name: '东中海', type: 'sea', isSC: false, q: 7, r: 1 },

  // Central belt
  { id: 'sea_west_north', name: '西湾海', type: 'sea', isSC: false, q: -2, r: 2 },
  { id: 'ferr_works', name: '七排西厂', type: 'coast', isSC: true, q: -1, r: 2 },
  { id: 'ferr_forge', name: '七排工坊', type: 'coast', isSC: true, q: 0, r: 2 },
  { id: 'ferr_cap', name: '七排大营', type: 'land', isSC: true, q: 1, r: 2 },
  { id: 'nor_wood', name: '中央海', type: 'sea', isSC: false, q: 2, r: 2 },
  { id: 'sol_plain', name: '五排南村', type: 'land', isSC: true, q: 3, r: 2 },
  { id: 'ith_market', name: '十排集市', type: 'land', isSC: true, q: 4, r: 2 },
  { id: 'ith_garden', name: '十排农场', type: 'land', isSC: true, q: 5, r: 2 },
  { id: 'zeph_bay', name: '八排南湾', type: 'coast', isSC: true, q: 6, r: 2 },
  { id: 'sea_east_mid', name: '东湾海', type: 'sea', isSC: false, q: 7, r: 2 },

  // Southern middle
  { id: 'sea_west_inner', name: '西南海', type: 'sea', isSC: false, q: -2, r: 3 },
  { id: 'sea_west_inlet', name: '六排西港', type: 'coast', isSC: true, q: -1, r: 3 },
  { id: 'mar_dock', name: '二排船坞', type: 'coast', isSC: true, q: 0, r: 3 },
  { id: 'nor_lake', name: '六排湖村', type: 'land', isSC: true, q: 1, r: 3 },
  { id: 'nor_cap', name: '中央海峡南段', type: 'sea', isSC: false, q: 2, r: 3 },
  { id: 'vel_cap', name: '三排大营', type: 'land', isSC: true, q: 3, r: 3 },
  { id: 'ith_cap', name: '十排大营', type: 'land', isSC: true, q: 4, r: 3 },
  { id: 'windward_key', name: '三排东港', type: 'coast', isSC: true, q: 5, r: 3 },
  { id: 'zeph_atoll', name: '八排南礁', type: 'coast', isSC: true, q: 6, r: 3 },
  { id: 'sea_east_south', name: '东南海', type: 'sea', isSC: false, q: 7, r: 3 },

  // Lower mainland
  { id: 'sea_west_outer', name: '远西南海', type: 'sea', isSC: false, q: -2, r: 4 },
  { id: 'nor_harbor', name: '六排南港', type: 'coast', isSC: true, q: -1, r: 4 },
  { id: 'mar_cap', name: '二排大营', type: 'land', isSC: true, q: 0, r: 4 },
  { id: 'vel_ford', name: '六排南村', type: 'land', isSC: true, q: 1, r: 4 },
  { id: 'vel_hill', name: '中央南海', type: 'sea', isSC: false, q: 2, r: 4 },
  { id: 'vel_keep', name: '三排南堡', type: 'land', isSC: true, q: 3, r: 4 },
  { id: 'vel_harbor', name: '三排海港', type: 'coast', isSC: true, q: 4, r: 4 },
  { id: 'sea_south_channel', name: '东南海峡', type: 'sea', isSC: false, q: 5, r: 4 },
  { id: 'sea_east_shelf', name: '远东南海', type: 'sea', isSC: false, q: 6, r: 4 },

  // Southern coast
  { id: 'sea_far_sw', name: '远西海', type: 'sea', isSC: false, q: -2, r: 5 },
  { id: 'mar_isle', name: '二排西岛', type: 'coast', isSC: true, q: -1, r: 5 },
  { id: 'mar_shoal', name: '二排浅滩', type: 'coast', isSC: true, q: 0, r: 5 },
  { id: 'lighthouse_isle', name: '灯塔岛', type: 'coast', isSC: true, q: 1, r: 5 },
  { id: 'sea_south_inlet', name: '南中海峡', type: 'sea', isSC: false, q: 2, r: 5 },
  { id: 'sea_south_mid', name: '南中海', type: 'sea', isSC: false, q: 3, r: 5 },
  { id: 'sea_south', name: '南海', type: 'sea', isSC: false, q: 4, r: 5 },
  { id: 'sea_south_channel_outer', name: '东南外海', type: 'sea', isSC: false, q: 5, r: 5 },

  // Southern outer ring
  { id: 'sea_southwest_arc', name: '西南外海', type: 'sea', isSC: false, q: -1, r: 6 },
  { id: 'sea_southwest_outer', name: '南湾外海', type: 'sea', isSC: false, q: 0, r: 6 },
  { id: 'sea_south_lower', name: '南外海', type: 'sea', isSC: false, q: 1, r: 6 },
  { id: 'sea_southwest_tail', name: '南中外海', type: 'sea', isSC: false, q: 2, r: 6 },
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
