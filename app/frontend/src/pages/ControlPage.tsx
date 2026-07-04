import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, ChevronRight, RotateCcw, Download, Settings2, Flag, Loader2, Brain } from 'lucide-react';
import { useGame } from '@/game/GameContext';
import { PHASES, exportState, phaseAt } from '@/game/engine';
import AppShell from '@/components/AppShell';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const ControlPage: React.FC = () => {
  const { state, ready, busy, engine, startGameAction, advance, reset, openSettings } = useGame();
  const navigate = useNavigate();
  const phase = phaseAt(state.phaseIndex);
  const reasoning = busy && ready;

  const handleExport = () => {
    const data = exportState(state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `agent-diplomacy-${state.year}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('已导出当前局势数据');
  };

  const handleStart = async () => {
    const ok = await startGameAction();
    if (!ok) {
      toast.error('后端初始化失败，请检查后端连接或错误提示');
      return;
    }
    toast.success('对局已在后端初始化，进入年度治理循环');
    navigate('/map');
  };

  const handleAdvance = async () => {
    if (state.status === 'finished') {
      toast('本局已结束，如需重玩请重置游戏');
      return;
    }

    toast('各国智能体推理中，正在调用真实模型生成外交与军事决策');
    const ok = await advance();
    if (!ok) {
      toast.error('阶段推进失败，请查看后端错误信息');
      return;
    }
    toast.success('本阶段已推进并落库');
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">当前进度</div>
              <div className="mt-1 font-display text-2xl font-bold tabular">
                {state.year} 年 · {phase.label}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  回合进度 {state.phaseIndex + 1} / 6 ·{' '}
                  {state.status === 'finished' ? '已完成' : ready ? '进行中' : '准备中'}
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
              {!ready ? (
                <Button size="lg" onClick={handleStart} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                  {busy ? '正在初始化' : '开始游戏'}
                </Button>
              ) : (
                <Button size="lg" onClick={handleAdvance} disabled={state.status === 'finished' || busy}>
                  {reasoning ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <ChevronRight className="mr-2 h-5 w-5" />
                  )}
                  {reasoning ? '各国智能体推理中' : '进入下一阶段'}
                </Button>
              )}

              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/map')}
                className="!bg-transparent hover:!bg-secondary"
              >
                <Flag className="mr-2 h-5 w-5" />
                查看战略地图
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">年度治理循环</h3>
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
                <div className="mt-1 font-medium leading-tight">{item.label.split('·')[1] || item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => openSettings('control')}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            智能体设置
          </Button>

          <Button variant="outline" onClick={handleExport} className="!bg-transparent hover:!bg-secondary">
            <Download className="mr-1.5 h-4 w-4" />
            导出数据
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
                  重置会清空当前地图、单位、消息、战报和历史记录，回到开局状态。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    const ok = await reset();
                    if (ok) {
                      toast.success('对局已在后端重置到开局状态');
                    } else {
                      toast.error('重置失败，请查看后端错误信息');
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
          <h3 className="mb-3 font-display text-lg font-semibold">近期战报</h3>
          <ScrollArea className="h-64">
            <div className="space-y-2 pr-3">
              {state.reports.slice(0, 30).map((report) => (
                <div key={report.id} className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">{report.phaseLabel}</div>
                  <p className="whitespace-pre-line text-sm leading-snug">{report.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </section>
      </div>
    </AppShell>
  );
};

export default ControlPage;
