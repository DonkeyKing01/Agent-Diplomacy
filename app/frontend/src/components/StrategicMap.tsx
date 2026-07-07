import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GameState,
  PROVINCES,
  PROVINCE_MAP,
  Unit,
  nationById,
  mapViewBox,
} from '@/game/engine';
import { ReportProvinceHighlight } from '@/game/battleReports';

interface Props {
  state: GameState;
  onProvinceClick?: (provinceId: string) => void;
  className?: string;
  reportHighlights?: ReportProvinceHighlight[];
}

function conflictStyle(kind?: string): { color: string; label: string } | null {
  if (!kind) return null;
  if (kind.includes('占领变化') || kind.includes('进攻')) {
    return { color: '#f2b134', label: '占' };
  }
  if (kind.includes('防守')) {
    return { color: '#66c2ff', label: '守' };
  }
  if (kind.includes('争夺')) {
    return { color: '#ff6b6b', label: '争' };
  }
  if (kind.includes('撤退')) {
    return { color: '#c8b6ff', label: '退' };
  }
  return { color: '#f2b134', label: '战' };
}

const { x: VB_X, y: VB_Y, width: VB_W, height: VB_H } = mapViewBox();
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.2;

function nationColor(state: GameState, provinceId: string): string {
  const owner = state.ownership[provinceId];
  if (!owner) return '#233246';
  return nationById(state, owner)?.color || '#233246';
}

const StrategicMap: React.FC<Props> = ({ state, onProvinceClick, className, reportHighlights = [] }) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const conflictByProv: Record<string, string> = {};
  state.conflicts.forEach((c) => {
    conflictByProv[c.province] = c.kind;
  });
  const reportHighlightByProv = Object.fromEntries(reportHighlights.map((item) => [item.provinceId, item]));

  const seaProvinces = PROVINCES.filter((p) => p.type === 'sea');
  const mountainProvinces = PROVINCES.filter((p) => p.type === 'mountain');
  const landProvinces = PROVINCES.filter((p) => p.type === 'land' || p.type === 'coast');

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = event.clientX - dragRef.current.x;
      const deltaY = event.clientY - dragRef.current.y;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        dragRef.current.moved = true;
      }
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      setPan((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const transformStyle = useMemo(
    () => ({
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: 'center center',
    }),
    [pan.x, pan.y, zoom],
  );

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const rect = frameRef.current?.getBoundingClientRect();
    const localX = rect ? event.clientX - rect.left - rect.width / 2 : 0;
    const localY = rect ? event.clientY - rect.top - rect.height / 2 : 0;
    const factor = event.deltaY < 0 ? 1.12 : 0.9;
    setZoom((currentZoom) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));
      const ratio = nextZoom / currentZoom;
      setPan((currentPan) => ({
        x: currentPan.x - localX * (ratio - 1),
        y: currentPan.y - localY * (ratio - 1),
      }));
      return nextZoom;
    });
  };

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const handleProvinceClick = (provinceId: string) => {
    if (dragRef.current?.moved) return;
    onProvinceClick?.(provinceId);
  };

  return (
    <div
      ref={frameRef}
      className={className}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
    >
      <svg
        viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
        className="h-full w-full select-none"
        preserveAspectRatio="xMidYMid meet"
        style={transformStyle}
      >
        <defs>
          <radialGradient id="map-bg" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#16233a" />
            <stop offset="70%" stopColor="#0c1524" />
            <stop offset="100%" stopColor="#080e18" />
          </radialGradient>
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

        <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="url(#map-bg)" />

        {seaProvinces.map((p) => {
          const conflict = conflictByProv[p.id];
          const pts = p.points.map((pt) => pt.join(',')).join(' ');
          return (
            <g key={p.id} onClick={() => handleProvinceClick(p.id)} className="cursor-pointer">
              <polygon
                points={pts}
                fill="url(#sea-hatch)"
                stroke={conflict ? '#f2b134' : '#12293f'}
                strokeWidth={conflict ? 5 : 2.5}
                opacity={0.95}
              />
              <text x={p.label[0]} y={p.label[1]} fill="#6f9bcf" fontSize="20" textAnchor="middle" fontStyle="italic" fontWeight={600}>
                {p.name}
              </text>
            </g>
          );
        })}

        {mountainProvinces.map((p) => {
          const pts = p.points.map((pt) => pt.join(',')).join(' ');
          return (
            <g key={p.id} onClick={() => handleProvinceClick(p.id)} className="cursor-pointer">
              <polygon
                points={pts}
                fill="#273346"
                stroke="#0a1220"
                strokeWidth={3}
                filter="url(#soft)"
              />
              <polygon
                points={pts}
                fill="none"
                stroke="#8796aa"
                strokeWidth={1.8}
                strokeDasharray="7 5"
                opacity={0.75}
              />
              <text x={p.label[0]} y={p.label[1] - 8} fill="#e3e8ef" fontSize="20" fontWeight={700} textAnchor="middle">
                {p.name}
              </text>
              <text x={p.label[0]} y={p.label[1] + 16} fill="#a1afc1" fontSize="13" textAnchor="middle">
                不可进入
              </text>
            </g>
          );
        })}

        {landProvinces.map((p) => {
          const fill = nationColor(state, p.id);
          const conflict = conflictByProv[p.id];
          const cs = conflictStyle(conflict);
          const reportHighlight = reportHighlightByProv[p.id];
          const pts = p.points.map((pt) => pt.join(',')).join(' ');
          return (
            <g key={p.id} onClick={() => handleProvinceClick(p.id)} className="cursor-pointer transition-opacity hover:opacity-95">
              <polygon
                points={pts}
                fill={fill}
                fillOpacity={state.ownership[p.id] ? 0.85 : 0.5}
                stroke={cs ? cs.color : '#0a1220'}
                strokeWidth={cs ? 6 : 3}
                filter="url(#soft)"
              />
              {reportHighlight && (
                <polygon
                  points={pts}
                  fill="none"
                  stroke={
                    reportHighlight.kind === 'capture'
                      ? '#f2b134'
                      : reportHighlight.kind === 'contest'
                        ? '#ff6b6b'
                        : reportHighlight.kind === 'defense'
                          ? '#66c2ff'
                          : '#c8b6ff'
                  }
                  strokeWidth={5}
                  opacity={0.9}
                />
              )}
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
                fontSize="23"
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
              {reportHighlight && (
                <g transform={`translate(${p.label[0] + 58}, ${p.label[1] + 22})`}>
                  <rect
                    x="-10"
                    y="-15"
                    width="28"
                    height="22"
                    rx="6"
                    fill={
                      reportHighlight.kind === 'capture'
                        ? '#f2b134'
                        : reportHighlight.kind === 'contest'
                          ? '#ff6b6b'
                          : reportHighlight.kind === 'defense'
                            ? '#66c2ff'
                            : '#c8b6ff'
                    }
                    opacity={0.95}
                  />
                  <text x="4" y="1" fill="#0a1220" fontSize="16" fontWeight={800} textAnchor="middle">
                    {reportHighlight.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

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
