/**
 * 数据管理页：导出局势 JSON、调整各国初始 SC 禀赋（仅未开局时生效）。
 */
import React from 'react';
import { toast } from 'sonner';
import { Download, Database, Info } from 'lucide-react';
import { useGame } from '@/game/GameContext';
import { exportState } from '@/game/engine';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';

const DataPage: React.FC = () => {
  const { state, ready, setEndowment } = useGame();

  const handleExport = () => {
    const data = exportState(state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-diplomacy-${state.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出当前局势数据（JSON）');
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
            <Download className="h-5 w-5 text-primary" />
            导出数据
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            将当前年份、阶段、地图归属、单位、信任分、外交密信与历史编年史导出为结构化 JSON，便于赛后复盘或存档。
          </p>
          <Button onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />
            导出数据
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
            <Database className="h-5 w-5 text-primary" />
            初始 SC 禀赋调整
          </h2>
          <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              初始禀赋仅在<span className="text-foreground">游戏未开局</span>时可调整。当前局势
              {ready ? '已开始，如需修改请先在游戏控制台重置游戏。' : '尚未开始，可自由调整。'}
            </span>
          </div>
          <ScrollArea className="h-96">
            <div className="space-y-4 pr-3">
              {state.nations.map((n) => (
                <div key={n.id} className="rounded-md border border-border bg-background/30 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="h-3.5 w-3.5 rounded-sm" style={{ background: n.color }} />
                      {n.name}
                    </span>
                    <span className="tabular text-sm text-primary">初始 {state.endowment[n.id]} SC</span>
                  </div>
                  <Slider
                    value={[state.endowment[n.id]]}
                    min={2}
                    max={6}
                    step={1}
                    disabled={ready}
                    onValueChange={(v) => setEndowment(n.id, v[0])}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </section>
      </div>
    </AppShell>
  );
};

export default DataPage;