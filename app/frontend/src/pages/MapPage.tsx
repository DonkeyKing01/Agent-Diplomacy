import React, { useMemo, useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  History,
  Loader2,
  Play,
  RotateCcw,
  Settings2,
  Swords,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGame } from '@/game/GameContext';
import { GameState, PROVINCE_MAP, createInitialState, phaseAt, unitsOf } from '@/game/engine';
import { reportHighlightsFromReports } from '@/game/battleReports';
import AppShell from '@/components/AppShell';
import BattleReportPanel from '@/components/BattleReportPanel';
import ProvinceDetailSheet from '@/components/ProvinceDetailSheet';
import StrategicMap from '@/components/StrategicMap';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  preparing: '准备中',
  reasoning: '推理中',
  awaiting: '等待治理',
  finished: '已结束',
};

const INITIAL_OWNERSHIP = createInitialState().ownership;
const INITIAL_STATE = createInitialState();

const MapPage: React.FC = () => {
  const { state, ready, busy, engine, startGameAction, finishPreparationAction, advance, openSettings } = useGame();
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [reviewOffset, setReviewOffset] = useState(0);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedDetailState, setSelectedDetailState] = useState<GameState | null>(null);
  const phase = phaseAt(state.phaseIndex);
  const reasoning = busy && ready && state.status !== 'preparing';

  const ranked = useMemo(
    () => [...state.nations].sort((a, b) => (state.scCount[b.id] || 0) - (state.scCount[a.id] || 0)),
    [state.nations, state.scCount],
  );

  const territoryCount = (nationId: string, gameState: GameState) =>
    Object.entries(gameState.ownership).filter(([provinceId, owner]) => {
      const province = PROVINCE_MAP[provinceId];
      return owner === nationId && province && province.type !== 'sea' && province.type !== 'mountain';
    }).length;

  const recentReports = useMemo(() => state.reports.slice(0, 12), [state.reports]);
  const maxOffset = Math.max(0, recentReports.length - 1);
  const safeOffset = Math.min(reviewOffset, maxOffset);
  const activeReport = recentReports[safeOffset] || null;
  const activeSnapshot =
    safeOffset > 0 && activeReport
      ? state.phaseSnapshots.find((snapshot) => snapshot.reportId === activeReport.id) || null
      : null;
  const isReviewingHistory = Boolean(activeSnapshot && activeReport);

  const mapState = useMemo<GameState>(() => {
    if (!activeSnapshot) {
      return state;
    }
    return {
      ...state,
      ownership: activeSnapshot.ownership,
      units: activeSnapshot.units,
      scCount: activeSnapshot.scCount,
      conflicts: [],
    };
  }, [activeSnapshot, state]);

  const comparisonPreviousMapState = useMemo<GameState>(() => {
    if (!activeReport) {
      return INITIAL_STATE;
    }
    const olderReport = recentReports[safeOffset + 1];
    if (!olderReport) {
      return INITIAL_STATE;
    }
    const olderSnapshot = state.phaseSnapshots.find((snapshot) => snapshot.reportId === olderReport.id);
    if (!olderSnapshot) {
      return INITIAL_STATE;
    }
    return {
      ...state,
      ownership: olderSnapshot.ownership,
      units: olderSnapshot.units,
      scCount: olderSnapshot.scCount,
      conflicts: [],
    };
  }, [activeReport, recentReports, safeOffset, state]);

  const reportHighlights = useMemo(
    () => (activeReport ? reportHighlightsFromReports([activeReport]) : []),
    [activeReport],
  );

  const reviewLabel = activeSnapshot?.phaseLabel || activeReport?.phaseLabel || '';

  const previousOwnershipForActiveReport = activeReport ? comparisonPreviousMapState.ownership || INITIAL_OWNERSHIP : undefined;

  const openProvince = (provinceId: string, detailState: GameState) => {
    setSelectedProvinceId(provinceId);
    setSelectedDetailState(detailState);
  };

  const handleInitialize = async () => {
    const ok = await startGameAction();
    if (!ok) {
      toast.error('后端初始化失败，请检查服务状态');
      return;
    }
    toast.success('对局已初始化，已进入开局准备阶段');
  };

  const handleFinishPreparation = async () => {
    const ok = await finishPreparationAction();
    if (!ok) {
      toast.error('结束准备失败，请检查后端状态');
      return;
    }
    toast.success('准备结束，1901 年春季谈判与决策正式开始');
  };

  const handleAdvance = async () => {
    if (state.status === 'finished') {
      toast('本局已结束，如需继续请重置对局');
      return;
    }

    toast('各国智能体推理中，正在生成真实外交与军事决策');
    const ok = await advance();
    if (!ok) {
      toast.error('阶段推进失败，请查看后端报错');
      return;
    }
    toast.success('本阶段已推进并完成结算');
  };

  const primaryAction = !ready
    ? {
        label: busy ? '正在初始化' : '初始化对局',
        icon: busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />,
        onClick: handleInitialize,
        disabled: busy,
      }
    : state.status === 'preparing'
      ? {
          label: busy ? '正在结束准备' : '结束准备',
          icon: busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />,
          onClick: handleFinishPreparation,
          disabled: busy,
        }
      : {
          label: reasoning ? '智能体推理中' : '推进阶段',
          icon: reasoning ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-1.5 h-4 w-4" />,
          onClick: handleAdvance,
          disabled: state.status === 'finished' || busy,
        };

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card/80 px-6 py-3">
          <div className="flex items-center gap-6">
            <Stat label="年份" value={`${state.year} 年`} />
            <Stat label="季节" value={phase.season} />
            <Stat label="阶段" value={phase.label} />
            <Stat label="回合进度" value={`${state.phaseIndex + 1} / 6`} />
            {isReviewingHistory ? (
              <div className="rounded-full border border-amber-400/40 bg-amber-500/12 px-3 py-1 text-sm font-semibold text-amber-200">
                正在回看：{reviewLabel}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/40 px-1 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReviewOffset((value) => Math.min(value + 1, maxOffset))}
                disabled={recentReports.length <= 1 || safeOffset >= maxOffset}
                className="h-8 px-2"
                title="回看上一阶段"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <History className="h-3.5 w-3.5 text-primary" />
                {isReviewingHistory ? `历史阶段 ${reviewLabel}` : '当前阶段'}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReviewOffset((value) => Math.max(value - 1, 0))}
                disabled={safeOffset === 0}
                className="h-8 px-2"
                title="查看更新阶段"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant={isReviewingHistory ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setReviewOffset(0)}
                disabled={safeOffset === 0}
                className={cn(
                  'h-8 px-3 text-xs',
                  isReviewingHistory && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90',
                )}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                返回当前阶段
              </Button>
            </div>

            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium',
                state.status === 'reasoning' && 'border-accent/50 text-accent',
                state.status === 'awaiting' && 'border-primary/50 text-primary',
                state.status === 'finished' && 'border-destructive/50 text-destructive',
                state.status === 'preparing' && 'border-border text-muted-foreground',
              )}
            >
              局势：{STATUS_LABEL[state.status]}
            </span>

            <span
              className={cn(
                'hidden items-center gap-1 rounded-full border px-2 py-1 text-xs xl:flex',
                engine === 'llm' ? 'border-accent/50 text-accent' : 'border-border text-muted-foreground',
              )}
            >
              <Brain className="h-3 w-3" />
              {engine === 'llm' ? '真实 LLM' : '回退模式'}
            </span>

            <Button size="sm" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
              {primaryAction.icon}
              {primaryAction.label}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openSettings('map')}
              className="bg-transparent hover:bg-secondary"
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              智能体设置
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 p-1.5">
            <div className="grid h-full min-h-[420px] grid-cols-1 gap-2 xl:grid-cols-2">
              <MapComparisonCard
                title="上一阶段"
                subtitle={
                  activeReport
                    ? recentReports[safeOffset + 1]?.phaseLabel || '开局初始态'
                    : '开局初始态'
                }
                state={comparisonPreviousMapState}
                onProvinceClick={(provinceId) => openProvince(provinceId, comparisonPreviousMapState)}
              />
              <MapComparisonCard
                title={isReviewingHistory ? '所选阶段' : '本阶段'}
                subtitle={reviewLabel || `${state.year} ${phase.label}`}
                state={mapState}
                onProvinceClick={(provinceId) => openProvince(provinceId, mapState)}
                reportHighlights={reportHighlights}
              />
            </div>
          </div>

          <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card/60">
            <div className="border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <Crown className="h-4 w-4 text-primary" />
                国家排行榜
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1.5 p-3">
                {ranked.map((nation, index) => {
                  const sc = mapState.scCount[nation.id] || 0;
                  const units = unitsOf(mapState, nation.id).length;
                  const territories = territoryCount(nation.id, mapState);
                  return (
                    <button
                      key={nation.id}
                      onClick={() => openSettings('map', nation.id)}
                      className="flex w-full items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                    >
                      <span className="w-5 text-center text-sm font-bold text-muted-foreground">{index + 1}</span>
                      <span className="h-4 w-4 shrink-0 rounded-sm" style={{ background: nation.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{nation.short}</div>
                        <div className="text-xs text-muted-foreground">{nation.traits.temperament}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-primary">{sc} SC</div>
                        <div className="text-xs text-muted-foreground">{territories} 领地</div>
                        <div className="text-xs text-muted-foreground">{units} 单位</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              金色旗标代表补给中心 SC。排行榜按 SC 排名，不按总领地数排名。
            </div>
          </aside>
        </div>

        <div className="shrink-0 border-t border-border bg-card/80 px-6 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Swords className="h-4 w-4 text-primary" />
              当前阶段公开战报（主持人口播）
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReportsExpanded((value) => !value)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {reportsExpanded ? (
                <>
                  收起
                  <ChevronDown className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  展开
                  <ChevronUp className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <div
            className={cn(
              'overflow-y-auto overflow-x-hidden pr-1 transition-all',
              reportsExpanded ? 'max-h-[38vh]' : 'max-h-32',
            )}
          >
            <div className="space-y-3 pb-1 pr-2">
              {recentReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚无战报。请前往游戏控制台推进阶段。</p>
              ) : (
                <>
                  {activeReport ? (
                    <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                      {isReviewingHistory ? '正在回看：' : '当前查看：'}
                      <span className="ml-1 font-medium text-foreground">{activeReport.phaseLabel}</span>
                    </div>
                  ) : null}

                  {reportHighlights.length > 0 ? (
                    <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
                      地图已标记该阶段发生过攻占、争夺或防守的地区：
                      {' '}
                      {reportHighlights.map((item) => `${item.provinceName}(${item.label})`).join('、')}
                    </div>
                  ) : null}

                  {activeReport ? (
                    <BattleReportPanel
                      key={activeReport.id}
                      report={activeReport}
                      previousOwnership={previousOwnershipForActiveReport}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <ProvinceDetailSheet
        open={Boolean(selectedProvinceId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProvinceId(null);
            setSelectedDetailState(null);
          }
        }}
        provinceId={selectedProvinceId}
        state={selectedDetailState || mapState}
        referenceReport={activeReport}
        allSnapshots={state.phaseSnapshots}
        previousOwnership={previousOwnershipForActiveReport}
      />
    </AppShell>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-base font-semibold">{value}</div>
  </div>
);

const MapComparisonCard: React.FC<{
  title: string;
  subtitle: string;
  state: GameState;
  onProvinceClick: (provinceId: string) => void;
  reportHighlights?: React.ComponentProps<typeof StrategicMap>['reportHighlights'];
}> = ({ title, subtitle, state, onProvinceClick, reportHighlights }) => (
  <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card/40">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/70 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="tabular text-xs text-primary">
        {Object.values(state.scCount).reduce((sum, value) => sum + (value || 0), 0)} SC
      </div>
    </div>
    <StrategicMap
      state={state}
      className="min-h-0 flex-1"
      onProvinceClick={onProvinceClick}
      reportHighlights={reportHighlights}
    />
  </div>
);

export default MapPage;
