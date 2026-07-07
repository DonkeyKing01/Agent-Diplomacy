import React, { useMemo } from 'react';
import { Clock3, Flag, Shield, Swords } from 'lucide-react';
import { parseBattleReport } from '@/game/battleReports';
import { BattleReportItem } from '@/game/engine';
import { GameState, HistoricalPhaseSnapshot, PROVINCE_MAP, nationById } from '@/game/engine';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provinceId: string | null;
  state: GameState;
  referenceReport: BattleReportItem | null;
  allSnapshots: HistoricalPhaseSnapshot[];
  previousOwnership?: Record<string, string | null>;
}

function initialOwnerId(state: GameState, provinceId: string): string | null {
  for (const nation of state.nations) {
    if (nation.homeCenters.includes(provinceId)) {
      return nation.id;
    }
  }
  return null;
}

function ownerLabel(state: GameState, provinceId: string, ownerId: string | null): string {
  const province = PROVINCE_MAP[provinceId];
  if (!province) return '未知';
  if (province.type === 'mountain') return '群山禁区';
  if (province.type === 'sea') return ownerId ? nationById(state, ownerId)?.name || ownerId : '无归属海域';
  return ownerId ? nationById(state, ownerId)?.name || ownerId : '中立';
}

const ProvinceDetailSheet: React.FC<Props> = ({
  open,
  onOpenChange,
  provinceId,
  state,
  referenceReport,
  allSnapshots,
  previousOwnership,
}) => {
  const province = provinceId ? PROVINCE_MAP[provinceId] : null;

  const stationedUnits = useMemo(() => {
    if (!provinceId) return [];
    return state.units.filter((unit) => unit.location === provinceId);
  }, [provinceId, state.units]);

  const parsedReport = useMemo(() => {
    if (!referenceReport) return null;
    return parseBattleReport(referenceReport);
  }, [referenceReport]);

  const localMovements = useMemo(() => {
    if (!province || !parsedReport) return [];
    return parsedReport.movements.filter((entry) => {
      const match = entry.match(/^(.*?)\s+(.+?)\s*->\s*(.+)$/);
      if (!match) return false;
      const fromName = match[2].trim();
      const toName = match[3].trim();
      return fromName === province.name || toName === province.name;
    });
  }, [parsedReport, province]);

  const localConflicts = useMemo(() => {
    if (!province || !parsedReport) return [];
    return parsedReport.conflicts
      .filter((conflict) => conflict.provinceName === province.name)
      .map((conflict) => {
        const previousOwnerId =
          conflict.provinceId && previousOwnership ? previousOwnership[conflict.provinceId] || null : null;
        const previousOwnerName = previousOwnerId ? nationById(state, previousOwnerId)?.name || previousOwnerId : '';
        const defenders =
          conflict.defenders.length > 0
            ? conflict.defenders
            : previousOwnerName && !conflict.attackers.includes(previousOwnerName)
              ? [previousOwnerName]
              : [];
        const participants = [...new Set([...conflict.participants, ...defenders])];
        return { ...conflict, defenders, participants };
      });
  }, [parsedReport, previousOwnership, province, state]);

  const ownershipHistory = useMemo(() => {
    if (!provinceId) return [];
    const chronologicalSnapshots = [...allSnapshots].reverse();
    const entries: Array<{ phaseLabel: string; ownerLabel: string }> = [];
    let previousOwner = initialOwnerId(state, provinceId);

    entries.push({
      phaseLabel: '开局',
      ownerLabel: ownerLabel(state, provinceId, previousOwner),
    });

    for (const snapshot of chronologicalSnapshots) {
      const currentOwner = snapshot.ownership[provinceId] || null;
      if (currentOwner === previousOwner) {
        continue;
      }
      entries.push({
        phaseLabel: snapshot.phaseLabel,
        ownerLabel: ownerLabel(state, provinceId, currentOwner),
      });
      previousOwner = currentOwner;
    }

    if (entries.length === 1) {
      entries.push({
        phaseLabel: '至今',
        ownerLabel: entries[0].ownerLabel,
      });
    }

    return entries.reverse();
  }, [allSnapshots, provinceId, state]);

  if (!provinceId || !province) {
    return null;
  }

  const currentOwner = state.ownership[provinceId] || null;
  const currentOwnerLabel = ownerLabel(state, provinceId, currentOwner);
  const reportLabel = referenceReport?.phaseLabel || '最近一回合';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[540px] max-w-[92vw] border-border/80 bg-card p-0 sm:max-w-[540px]">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-xl">{province.name}</SheetTitle>
          <SheetDescription>
            {province.type === 'sea' ? '海域' : province.type === 'mountain' ? '不可进入山地' : province.type === 'coast' ? '沿海地区' : '内陆地区'}
            {' · '}
            {province.isSC ? '补给中心' : '非补给中心'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-96px)]">
          <div className="space-y-5 px-6 py-5">
            <section className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Flag className="h-4 w-4 text-primary" />
                当前归属与驻军
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="归属国" value={currentOwnerLabel} />
                <InfoCard label="驻军数量" value={`${stationedUnits.length} 支`} />
              </div>
              <div className="mt-3 space-y-2">
                {stationedUnits.length > 0 ? (
                  stationedUnits.map((unit) => {
                    const nation = nationById(state, unit.owner);
                    return (
                      <div key={unit.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: nation?.color || '#8892a0' }} />
                          <span>{nation?.name || unit.owner}</span>
                        </div>
                        <span className="font-medium">{unit.type === 'Army' ? 'A 陆军' : 'F 海军'}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
                    当前无单位驻扎。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Swords className="h-4 w-4 text-primary" />
                {reportLabel} 在此地的行动与交战
              </div>
              <div className="space-y-2">
                {localMovements.map((entry, index) => (
                  <div key={`move-${index}`} className="rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm">
                    {entry}
                  </div>
                ))}
                {localConflicts.map((conflict, index) => (
                  <div key={`conflict-${index}`} className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm">
                    <div className="font-medium text-foreground">{conflict.explanation}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      进攻方：{conflict.attackers.length ? conflict.attackers.join('、') : '无'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      防守方：{conflict.defenders.length ? conflict.defenders.join('、') : '无（中立或空地）'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      交战相关方：{conflict.participants.length ? conflict.participants.join('、') : '无'}
                    </div>
                  </div>
                ))}
                {localMovements.length === 0 && localConflicts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
                    上一回合这里没有记录到行军或交战。
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="h-4 w-4 text-primary" />
                历史占领记录
              </div>
              <div className="space-y-2">
                {ownershipHistory.map((item, index) => (
                  <div key={`${item.phaseLabel}-${index}`} className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm">
                    <div className="text-muted-foreground">{item.phaseLabel}</div>
                    <div className="text-right font-medium text-foreground">{item.ownerLabel}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-primary" />
                区域说明
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>区域类型：{province.type === 'sea' ? '海域，可停驻海军。' : province.type === 'mountain' ? '不可进入山地，仅作地形边界。' : province.type === 'coast' ? '沿海地区，陆军与海军都可能出现在这里。' : '内陆地区，仅陆军可进入。'}</p>
                <p>补给中心：{province.isSC ? '是。控制它会计入国家 SC。' : '否。这里只影响兵力机动，不直接增加 SC。'}</p>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
  </div>
);

export default ProvinceDetailSheet;
