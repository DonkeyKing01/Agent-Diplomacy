/**
 * 战略地图：真正的战棋六边形网格（flat-top hex grid）。
 * 所有省份（陆地/沿海/海域）用同一套网格规则紧密贴合、无缝无重叠，相邻格共享整条边。
 * 陆地/沿海显示国家色块，海域用海纹标识；SC 显示为旗帜，Army/Fleet 为棋子；
 * Move 命令用箭头，冲突用状态标记。整体尺寸放大以适配大屏投屏。
 */
import React from 'react';
import {
  GameState,
  PROVINCES,
  PROVINCE_MAP,
  Unit,
  nationById,
  mapViewBox,
} from '@/game/engine';

interface Props {
  state: GameState;
  onProvinceClick?: (provinceId: string) => void;
  className?: string;
}

const CONFLICT_STYLE: Record<string, { color: string; label: string }> = {
  进攻: { color: '#e0533f', label: '进攻' },
  支援: { color: '#3aa676', label: '支援' },
  防守: { color: '#2d8fd0', label: '防守' },
  争夺: { color: '#e6c229', label: '争夺' },
  撤退: { color: '#c86fa0', label: '撤退' },
  占领变化: { color: '#e6a23c', label: '易主' },
};

function nationColor(state: GameState, provinceId: string): string {
  const owner = state.ownership[provinceId];
  if (!owner) return '#233246';
  return nationById(state, owner)?.color || '#233246';
}

const { width: VB_W, height: VB_H } = mapViewBox();

const StrategicMap: React.FC<Props> = ({ state, onProvinceClick, className }) => {
  const conflictByProv: Record<string, string> = {};
  state.conflicts.forEach((c) => {
    conflictByProv[c.province] = c.kind;
  });

  const seaProvinces = PROVINCES.filter((p) => p.type === 'sea');
  const landProvinces = PROVINCES.filter((p) => p.type !== 'sea');

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #16233a 0%, #0c1524 70%, #080e18 100%)' }}
      >
        <defs>
          <pattern id="sea-hatch" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="20" height="20" fill="#0f2138" />
            <line x1="0" y1="0" x2="0" y2="20" stroke="#1b3a5e" strokeWidth="2.5" />
          </pattern>
          <marker id="arrow-attack" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill="#f2b134" />
          </marker>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* 海域六边格 */}
        {seaProvinces.map((p) => {
          const conflict = conflictByProv[p.id];
          const pts = p.points.map((pt) => pt.join(',')).join(' ');
          return (
            <g key={p.id} onClick={() => onProvinceClick?.(p.id)} className="cursor-pointer">
              <polygon
                points={pts}
                fill="url(#sea-hatch)"
                stroke={conflict ? CONFLICT_STYLE[conflict]?.color : '#12293f'}
                strokeWidth={conflict ? 5 : 2.5}
                opacity={0.95}
              />
              <text x={p.label[0]} y={p.label[1]} fill="#6f9bcf" fontSize="22" textAnchor="middle" fontStyle="italic" fontWeight={600}>
                {p.name}
              </text>
            </g>
          );
        })}

        {/* 陆地 / 沿海六边格 */}
        {landProvinces.map((p) => {
          const fill = nationColor(state, p.id);
          const conflict = conflictByProv[p.id];
          const cs = conflict ? CONFLICT_STYLE[conflict] : null;
          const pts = p.points.map((pt) => pt.join(',')).join(' ');
          return (
            <g key={p.id} onClick={() => onProvinceClick?.(p.id)} className="cursor-pointer transition-opacity hover:opacity-95">
              <polygon
                points={pts}
                fill={fill}
                fillOpacity={state.ownership[p.id] ? 0.85 : 0.5}
                stroke={cs ? cs.color : '#0a1220'}
                strokeWidth={cs ? 6 : 3}
                filter="url(#soft)"
              />
              {p.type === 'coast' && (
                <polygon
                  points={pts}
                  fill="none"
                  stroke="#0b2036"
                  strokeWidth={2.5}
                  strokeDasharray="8 7"
                  opacity={0.85}
                />
              )}
              <text
                x={p.label[0]}
                y={p.label[1] - 12}
                fill="#0a1220"
                fontSize="24"
                fontWeight={700}
                textAnchor="middle"
                style={{ paintOrder: 'stroke', stroke: '#ffffffbb', strokeWidth: 3.5 }}
              >
                {p.name}
              </text>
              {p.isSC && (
                <g transform={`translate(${p.label[0]}, ${p.label[1] + 20})`}>
                  <circle r="11" fill="#0a1220" stroke="#f2b134" strokeWidth="3" />
                  <path d="M-1,-7 L8,-4 L-1,-1 Z" fill="#f2b134" />
                  <line x1="-1" y1="-7" x2="-1" y2="9" stroke="#f2b134" strokeWidth="2.5" />
                </g>
              )}
              {cs && (
                <g transform={`translate(${p.label[0] + 52}, ${p.label[1] - 44})`}>
                  <rect x="-4" y="-16" width={cs.label.length * 22 + 8} height="26" rx="5" fill={cs.color} />
                  <text x={cs.label.length * 11} y="2" fill="#0a1220" fontSize="17" fontWeight={700} textAnchor="middle">
                    {cs.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 行动箭头（Move 命令，仅相邻格之间） */}
        {state.units
          .filter((u) => u.order?.type === 'Move' && u.order.from && u.order.to)
          .map((u) => {
            const from = PROVINCE_MAP[u.order!.from!];
            const to = PROVINCE_MAP[u.order!.to!];
            if (!from || !to) return null;
            const [x1, y1] = from.label;
            const [x2, y2] = to.label;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            const sx = x1 + (dx / len) * 40;
            const sy = y1 + (dy / len) * 40;
            const ex = x2 - (dx / len) * 48;
            const ey = y2 - (dy / len) * 48;
            return (
              <line
                key={`arr-${u.id}`}
                x1={sx}
                y1={sy}
                x2={ex}
                y2={ey}
                stroke="#f2b134"
                strokeWidth={5}
                strokeDasharray="12 7"
                markerEnd="url(#arrow-attack)"
                opacity={0.95}
              />
            );
          })}

        {/* 单位棋子 */}
        {state.units.map((u: Unit) => {
          const prov = PROVINCE_MAP[u.location];
          if (!prov) return null;
          const [cx, cy] = prov.label;
          const color = nationById(state, u.owner)?.color || '#888';
          const isFleet = u.type === 'Fleet';
          return (
            <g key={u.id} transform={`translate(${cx - 40}, ${cy + 14})`} filter="url(#soft)">
              {isFleet ? (
                <rect x="-18" y="-16" width="36" height="32" rx="5" fill={color} stroke="#0a1220" strokeWidth="3" />
              ) : (
                <circle r="18" fill={color} stroke="#0a1220" strokeWidth="3" />
              )}
              <text x="0" y="7" fill="#0a1220" fontSize="20" fontWeight={800} textAnchor="middle">
                {isFleet ? 'F' : 'A'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default StrategicMap;