import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Brain, ChevronRight, Download, Flag, Loader2, Play, RotateCcw, Settings2 } from 'lucide-react';
import { useGame } from '@/game/GameContext';
import { createInitialState, exportState, phaseAt, PHASES } from '@/game/engine';
import AppShell from '@/components/AppShell';
import BattleReportPanel from '@/components/BattleReportPanel';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const INITIAL_OWNERSHIP = createInitialState().ownership;

const ControlPage: React.FC = () => {
  const {
    state,
    ready,
    busy,
    engine,
    startGameAction,
    finishPreparationAction,
    advance,
    reset,
    openSettings,
    updateMatchConfig,
  } = useGame();
  const navigate = useNavigate();
  const phase = phaseAt(state.phaseIndex);
  const reasoning = busy && ready && state.status !== 'preparing';
  const [maxYearDraft, setMaxYearDraft] = useState(String(state.governance.maxYear || 1910));

  useEffect(() => {
    setMaxYearDraft(String(state.governance.maxYear || 1910));
  }, [state.governance.maxYear]);

  const handleExport = () => {
    const data = exportState(state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `agent-diplomacy-${state.year}.json`;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 1000);
    toast.success('已导出当前局势 JSON');
  };

  const handleInitialize = async () => {
    const ok = await startGameAction();
    if (!ok) {
      toast.error('后端初始化失败，请检查服务状态');
      return;
    }
    toast.success('对局已初始化，已进入开局准备阶段');
    navigate('/map');
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
        label: busy ? '正在初始化' : '初始化对局，进入开局准备',
        icon: busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />,
        onClick: handleInitialize,
        disabled: busy,
      }
    : state.status === 'preparing'
      ? {
          label: busy ? '正在结束准备' : '结束准备，进入第一年春季决策',
          icon: busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />,
          onClick: handleFinishPreparation,
          disabled: busy,
        }
      : {
          label: reasoning ? '各国智能体推理中' : '进入下一阶段',
          icon: reasoning ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ChevronRight className="mr-2 h-5 w-5" />,
          onClick: handleAdvance,
          disabled: state.status === 'finished' || busy,
        };

  const progressText = !ready
    ? '未初始化'
    : state.status === 'preparing'
      ? '开局准备'
      : state.status === 'finished'
        ? '已结束'
        : '进行中';

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-6 pb-10">
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">当前进度</div>
                <div className="mt-1 font-display text-2xl font-bold tabular">
                  {state.year} 年 · {phase.label}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    回合进度 {state.phaseIndex + 1} / 6 · {progressText}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                      engine === 'llm' ? 'border-accent/50 text-accent' : 'border-border text-muted-foreground',
                    )}
                  >
                    <Brain className="h-3 w-3" />
                    {engine === 'llm' ? '真实 LLM 驱动' : '回退模式'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                  {primaryAction.icon}
                  {primaryAction.label}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/map')}
                  className="bg-transparent hover:bg-secondary"
                >
                  <Flag className="mr-2 h-5 w-5" />
                  查看战略地图
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-display text-lg font-semibold">年度治理循环</h3>
            <div className="mb-4 rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
              {!ready && '先初始化对局，然后进入开局准备阶段。'}
              {ready && state.status === 'preparing' && '准备阶段必须写入 System Prompt、Skills 与本年年度建议。'}
              {ready && state.status !== 'preparing' && '准备结束后，System Prompt / Skills 每排各有一次修改机会；年终复盘必须写入年度建议。'}
            </div>

            {ready && state.status === 'preparing' ? (
              <div className="mb-4 rounded-md border border-border/70 bg-background/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">终局年份</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      默认 1910 年，即从 1901 年开始共运行 10 个完整年度。到达该年的年度复盘后自动结算结束。
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">当前：{state.governance.maxYear} 年</div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="number"
                    min={1901}
                    max={1950}
                    value={maxYearDraft}
                    onChange={(event) => setMaxYearDraft(event.target.value)}
                    className="w-40"
                  />
                  <Button
                    variant="outline"
                    className="bg-transparent hover:bg-secondary"
                    onClick={async () => {
                      const parsed = Number(maxYearDraft);
                      if (!Number.isFinite(parsed) || parsed < 1901) {
                        toast.error('终局年份必须是不早于 1901 的整数');
                        return;
                      }
                      try {
                        await updateMatchConfig({ maxYear: parsed });
                        toast.success(`终局年份已更新为 ${parsed} 年`);
                      } catch (error) {
                        toast.error((error as Error).message || '终局年份更新失败');
                      }
                    }}
                  >
                    保存终局年份
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {PHASES.map((item, index) => (
                <div
                  key={item.key}
                  className={cn(
                    'rounded-md border px-3 py-3 text-center text-sm',
                    index === state.phaseIndex ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                  )}
                >
                  <div className="text-xs opacity-70">{item.season}</div>
                  <div className="mt-1 font-medium leading-tight">{item.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => openSettings('control')}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              智能体设置
            </Button>

            <Button variant="outline" onClick={handleExport} className="bg-transparent hover:bg-secondary">
              <Download className="mr-1.5 h-4 w-4" />
              导出 JSON
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  重置游戏
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认重置游戏？</AlertDialogTitle>
                  <AlertDialogDescription>
                    重置会清空当前地图、单位、消息、战报与历史记录，并回到新的开局准备状态。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const ok = await reset();
                      if (ok) {
                        toast.success('对局已重置，重新进入开局准备阶段');
                      } else {
                        toast.error('重置失败，请查看后端报错');
                      }
                    }}
                  >
                    确认重置
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">近期战报</h3>
                <p className="mt-1 text-sm text-muted-foreground">外层页面可以整体滚动，战报列表内部也支持独立滚动。</p>
              </div>
              <div className="text-xs text-muted-foreground">{Math.min(state.reports.length, 30)} / {state.reports.length} 条</div>
            </div>
            <ScrollArea className="h-[48vh] min-h-[420px] rounded-md border border-border/70 bg-background/30 pr-4">
              <div className="space-y-3 p-3">
                {state.reports.slice(0, 30).map((report, index, reports) => {
                  const olderReport = reports[index + 1];
                  const olderSnapshot = olderReport
                    ? state.phaseSnapshots.find((snapshot) => snapshot.reportId === olderReport.id)
                    : null;
                  const previousOwnership = olderSnapshot?.ownership || INITIAL_OWNERSHIP;
                  return <BattleReportPanel key={report.id} report={report} previousOwnership={previousOwnership} />;
                })}
              </div>
            </ScrollArea>
          </section>
        </div>
      </div>
    </AppShell>
  );
};

export default ControlPage;
