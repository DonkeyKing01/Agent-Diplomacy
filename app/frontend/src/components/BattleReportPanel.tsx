import React from 'react';
import { Shield, Swords, TrendingUp, Undo2 } from 'lucide-react';
import { BattleReportItem, NATIONS } from '@/game/engine';
import { ParsedBattleReport, parseBattleReport } from '@/game/battleReports';

const sectionIcon = {
  movements: TrendingUp,
  conflicts: Swords,
  retreats: Undo2,
  winterAdjustments: Shield,
};

const sectionTitle = {
  movements: '部队行动',
  conflicts: '战斗结果',
  retreats: '撤退处理',
  winterAdjustments: '冬季调整',
};

const nationColorByName = Object.fromEntries(NATIONS.map((nation) => [nation.name, nation.color]));
const nationNameById = Object.fromEntries(NATIONS.map((nation) => [nation.id, nation.name]));

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function movementNationName(item: string) {
  const match = item.match(/^(.*?)\s+(.+?)\s*->\s*(.+)$/);
  return match?.[1]?.trim() || '';
}

function movementTone(item: string) {
  const nationName = movementNationName(item);
  const nationColor = nationColorByName[nationName];
  if (!nationColor) {
    return {
      nationName: '',
      style: undefined,
      badgeStyle: undefined,
    };
  }

  return {
    nationName,
    style: {
      borderColor: hexToRgba(nationColor, 0.45),
      backgroundColor: hexToRgba(nationColor, 0.12),
      color: '#d9e2f2',
    } as React.CSSProperties,
    badgeStyle: {
      borderColor: hexToRgba(nationColor, 0.55),
      backgroundColor: hexToRgba(nationColor, 0.18),
      color: nationColor,
    } as React.CSSProperties,
  };
}

const supplyTone = (index: number) => {
  if (index === 0) return 'border-primary/50 bg-primary/10 text-primary';
  if (index === 1) return 'border-[#66c2ff]/40 bg-[#66c2ff]/10 text-[#8ed3ff]';
  if (index === 2) return 'border-[#d9a441]/40 bg-[#d9a441]/10 text-[#f2c56a]';
  return 'border-border bg-background/50 text-muted-foreground';
};

function kindIncludes(kind: string, variants: string[]) {
  return variants.some((variant) => kind.includes(variant));
}

function conflictTone(kind: string) {
  if (kindIncludes(kind, ['占领变化', '进攻'])) return 'border-primary/50 bg-primary/10';
  if (kindIncludes(kind, ['争夺'])) return 'border-destructive/45 bg-destructive/10';
  if (kindIncludes(kind, ['防守'])) return 'border-[#66c2ff]/45 bg-[#66c2ff]/10';
  return 'border-border/70 bg-background/50';
}

function conflictDisplayName(kind: string) {
  if (kindIncludes(kind, ['占领变化', '进攻'])) return '占领成功';
  if (kindIncludes(kind, ['防守'])) return '守住';
  if (kindIncludes(kind, ['争夺'])) return '争夺未果';
  if (kindIncludes(kind, ['撤退'])) return '撤退';
  return kind;
}

function SectionList({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  const isMovementSection = title === sectionTitle.movements;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="grid gap-2">
        {items.map((item, index) => {
          if (!isMovementSection) {
            return (
              <div
                key={`${title}-${index}`}
                className="rounded-md border border-border/70 bg-background/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
              >
                {item}
              </div>
            );
          }

          const tone = movementTone(item);
          return (
            <div
              key={`${title}-${index}`}
              className="rounded-md border px-3 py-2 text-sm leading-relaxed text-foreground"
              style={tone.style}
            >
              <div className="flex items-start gap-3">
                {tone.nationName ? (
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em]"
                    style={tone.badgeStyle}
                  >
                    {tone.nationName}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">{item}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderConflictItems(
  parsed: ParsedBattleReport,
  previousOwnership?: Record<string, string | null>,
) {
  return parsed.conflicts.map((conflict) => {
    const attackersText = conflict.attackers.length > 0 ? conflict.attackers.join('、') : '无';
    const previousOwnerId = conflict.provinceId && previousOwnership ? previousOwnership[conflict.provinceId] || null : null;
    const previousOwnerName = previousOwnerId ? nationNameById[previousOwnerId] || previousOwnerId : '';
    const resolvedDefenders =
      conflict.defenders.length > 0
        ? conflict.defenders
        : previousOwnerName && !conflict.attackers.includes(previousOwnerName)
          ? [previousOwnerName]
          : [];
    const defendersText =
      resolvedDefenders.length > 0
        ? resolvedDefenders
            .map((name) => (name === previousOwnerName && conflict.defenders.length === 0 ? `${name}（原控制方）` : name))
            .join('、')
        : '无（中立或空地）';
    const resolvedParticipants =
      conflict.participants.length > 0
        ? [...new Set([...conflict.participants, ...resolvedDefenders])]
        : [...new Set([...(conflict.winner ? [conflict.winner] : []), ...conflict.attackers, ...resolvedDefenders])];
    const participantsText = resolvedParticipants.length > 0 ? resolvedParticipants.join('、') : conflict.winner || '无明确交战方';

    return (
      <div
        key={`${parsed.id}-${conflict.provinceName}`}
        className={`rounded-md border px-3 py-3 text-sm ${conflictTone(conflict.kind)}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-foreground">{conflict.provinceName}</div>
            <div className="mt-1 text-xs text-muted-foreground">状态：{conflictDisplayName(conflict.kind)}</div>
          </div>
          {conflict.winner ? (
            <div className="rounded-full border border-primary/40 bg-background/70 px-2 py-1 text-xs text-primary">
              胜者：{conflict.winner}
            </div>
          ) : (
            <div className="rounded-full border border-destructive/35 bg-background/70 px-2 py-1 text-xs text-destructive">
              未分胜负
            </div>
          )}
        </div>

        <div className="mt-3 grid gap-2">
          <div className="text-foreground">
            <span className="text-muted-foreground">进攻方：</span>
            {attackersText}
          </div>
          <div className="text-foreground">
            <span className="text-muted-foreground">防守方：</span>
            {defendersText}
          </div>
          <div className="text-foreground">
            <span className="text-muted-foreground">交战双方：</span>
            {participantsText}
          </div>
          <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-muted-foreground">
            {conflict.explanation}
          </div>
        </div>
      </div>
    );
  });
}

const BattleReportPanel: React.FC<{
  report: BattleReportItem;
  previousOwnership?: Record<string, string | null>;
}> = ({ report, previousOwnership }) => {
  const parsed = parseBattleReport(report);
  const ConflictIcon = sectionIcon.conflicts;

  return (
    <div className="rounded-lg border border-border bg-card/70 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{parsed.phaseLabel}</div>
          <h4 className="mt-1 text-base font-semibold text-foreground">{parsed.headline}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{parsed.summary || '本阶段结算完成。'}</p>
        </div>
        {parsed.supplyCenters.length > 0 ? (
          <div className="grid min-w-[240px] grid-cols-1 gap-2 sm:grid-cols-2">
            {parsed.supplyCenters.slice(0, 4).map((entry, index) => (
              <div key={entry.nationName} className={`rounded-md border px-3 py-2 text-xs ${supplyTone(index)}`}>
                <div className="truncate">{entry.nationName}</div>
                <div className="mt-1 text-base font-semibold">{entry.value} SC</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <SectionList icon={sectionIcon.movements} title={sectionTitle.movements} items={parsed.movements} />

        {parsed.conflicts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ConflictIcon className="h-4 w-4 text-primary" />
              {sectionTitle.conflicts}
            </div>
            <div className="grid gap-2">{renderConflictItems(parsed, previousOwnership)}</div>
          </div>
        )}

        <SectionList icon={sectionIcon.retreats} title={sectionTitle.retreats} items={parsed.retreats} />
        <SectionList icon={sectionIcon.winterAdjustments} title={sectionTitle.winterAdjustments} items={parsed.winterAdjustments} />

        {parsed.supplyCenters.length > 4 ? (
          <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
            其余补给中心排名：
            {' '}
            {parsed.supplyCenters
              .slice(4)
              .map((entry) => `${entry.nationName} ${entry.value} SC`)
              .join('；')}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BattleReportPanel;
