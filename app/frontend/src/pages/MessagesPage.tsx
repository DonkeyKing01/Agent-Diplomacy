import React, { useState } from 'react';
import { Settings2, Lock, Radio } from 'lucide-react';
import { useGame } from '@/game/GameContext';
import { nationById } from '@/game/engine';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const MessagesPage: React.FC = () => {
  const { state, openSettings } = useGame();
  const [filter, setFilter] = useState<string>('all');

  const filtered = state.messages.filter((m) => filter === 'all' || m.from === filter || m.to === filter);

  return (
    <AppShell>
      <div className="flex h-full">
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/50">
          <div className="border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-primary" />
              信道筛选
            </h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm',
                  filter === 'all' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60',
                )}
              >
                全部密信
              </button>
              {state.nations.map((nation) => (
                <button
                  key={nation.id}
                  onClick={() => setFilter(nation.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                    filter === nation.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60',
                  )}
                >
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: nation.color }} />
                  <span className="truncate">{nation.short}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
            <h2 className="font-display text-lg font-semibold">外交密信 · 秘密信道</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openSettings('messages', filter === 'all' ? undefined : filter)}
              className="!bg-transparent hover:!bg-secondary"
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              智能体设置
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl space-y-3 p-6">
              {filtered.length === 0 && (
                <p className="py-12 text-center text-muted-foreground">
                  尚无密信。请在游戏控制台推进春季或秋季谈判阶段以生成外交往来。
                </p>
              )}
              {filtered.map((message) => {
                const from = nationById(state, message.from);
                const to = nationById(state, message.to);

                return (
                  <div key={message.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="h-3 w-3 rounded-sm" style={{ background: from?.color }} />
                        {from?.short}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="h-3 w-3 rounded-sm" style={{ background: to?.color }} />
                        {to?.short}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground tabular">{message.phaseLabel}</span>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{message.text}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Radio className="h-3.5 w-3.5 text-accent" />
                      <span>{message.channel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </AppShell>
  );
};

export default MessagesPage;
