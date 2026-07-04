/**
 * 历史记录页：年度编年史。逐年展示复盘摘要与各国 SC 快照。
 */
import React from 'react';
import { ScrollText, Settings2 } from 'lucide-react';
import { useGame } from '@/game/GameContext';
import { nationById } from '@/game/engine';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const HistoryPage: React.FC = () => {
  const { state, openSettings } = useGame();

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScrollText className="h-5 w-5 text-primary" />
            历史记录 · 编年史
          </h2>
          <Button variant="outline" size="sm" onClick={() => openSettings('history')} className="!bg-transparent hover:!bg-secondary">
            <Settings2 className="mr-1.5 h-4 w-4" />
            智能体设置
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl space-y-4 p-6">
            {state.history.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">
                尚无年度复盘记录。每完成一年（推进至年度复盘阶段）后，将在此生成编年史条目。
              </p>
            )}
            {state.history.map((h) => {
              const ranked = state.nations
                .map((n) => ({ n, sc: h.scSnapshot[n.id] || 0 }))
                .sort((a, b) => b.sc - a.sc);
              return (
                <div key={`${h.year}-${h.phaseLabel}`} className="rounded-lg border border-border bg-card p-5">
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className="font-display text-2xl font-bold text-primary tabular">{h.year}</span>
                    <span className="text-sm text-muted-foreground">{h.phaseLabel}</span>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-foreground">{h.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {ranked.map(({ n, sc }) => (
                      <span
                        key={n.id}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 text-xs tabular"
                      >
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: nationById(state, n.id)?.color }} />
                        {n.short}
                        <span className="font-semibold text-primary">{sc}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </AppShell>
  );
};

export default HistoryPage;