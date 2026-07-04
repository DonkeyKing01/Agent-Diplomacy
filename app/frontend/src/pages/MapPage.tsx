import React, { useState } from 'react';
import {
  Settings2,
  Crown,
  Swords,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useGame } from '@/game/GameContext';
import { phaseAt, unitsOf } from '@/game/engine';
import AppShell from '@/components/AppShell';
import StrategicMap from '@/components/StrategicMap';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  preparing: '准备中',
  reasoning: '推理中',
  awaiting: '等待提交',
  finished: '已完成',
};

const TONE_COLOR: Record<string, string> = {
  neutral: 'text-muted-foreground',
  conflict: 'text-destructive',
  alliance: 'text-[#3aa676]',
  betrayal: 'text-[#c86fa0]',
  expansion: 'text-primary',
};

const MapPage: React.FC = () => {
  const { state, openSettings } = useGame();
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const phase = phaseAt(state.phaseIndex);
  const ranked = [...state.nations].sort(
    (a, b) => (state.scCount[b.id] || 0) - (state.scCount[a.id] || 0)
  );
  const phaseReports = state.reports
    .filter(r => r.year === state.year)
    .slice(0, 6);

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card/80 px-6 py-3">
          <div className="flex items-center gap-6 tabular">
            <Stat label="年份" value={`${state.year} 年`} />
            <Stat label="季节" value={phase.season} />
            <Stat label="阶段" value={phase.label} />
            <Stat label="回合进度" value={`${state.phaseIndex + 1} / 6`} />
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium',
                state.status === 'reasoning' && 'border-accent/50 text-accent',
                state.status === 'awaiting' && 'border-primary/50 text-primary',
                state.status === 'finished' &&
                  'border-destructive/50 text-destructive',
                state.status === 'preparing' &&
                  'border-border text-muted-foreground'
              )}
            >
              局势：{STATUS_LABEL[state.status]}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openSettings('map')}
              className="!bg-transparent hover:!bg-secondary"
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              智能体设置
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 p-1.5">
            <div className="h-full min-h-[420px] overflow-hidden rounded-lg border border-border">
              <StrategicMap
                state={state}
                className="h-full w-full"
                onProvinceClick={() => undefined}
              />
            </div>
          </div>

          <aside className="flex w-64 shrink-0 flex-col border-l border-border bg-card/60">
            <div className="border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <Crown className="h-4 w-4 text-primary" />
                国家排行榜
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1.5 p-3">
                {ranked.map((n, i) => {
                  const sc = state.scCount[n.id] || 0;
                  const units = unitsOf(state, n.id).length;
                  return (
                    <button
                      key={n.id}
                      onClick={() => openSettings('map', n.id)}
                      className="flex w-full items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                    >
                      <span className="w-5 text-center text-sm font-bold tabular text-muted-foreground">
                        {i + 1}
                      </span>
                      <span
                        className="h-4 w-4 shrink-0 rounded-sm"
                        style={{ background: n.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {n.short}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {n.traits.temperament}
                        </div>
                      </div>
                      <div className="text-right tabular">
                        <div className="text-sm font-semibold text-primary">
                          {sc} SC
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {units} 单位
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              点击任意国家可打开其国家档案（智能体设置），返回后保留当前局势。
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
              onClick={() => setReportsExpanded(v => !v)}
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

          <ScrollArea
            className={cn(
              'overflow-hidden transition-all',
              reportsExpanded ? 'max-h-[38vh]' : 'max-h-32'
            )}
          >
            <div className="flex gap-3 overflow-x-auto pb-1">
              {phaseReports.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  尚无战报。请前往游戏控制台推进阶段。
                </p>
              )}
              {phaseReports.map(r => (
                <div
                  key={r.id}
                  className="min-w-[280px] max-w-[560px] shrink-0 rounded-md border border-border bg-background/50 px-3 py-2"
                >
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    {r.phaseLabel}
                  </div>
                  <p
                    className={cn(
                      'whitespace-pre-line text-sm leading-snug',
                      TONE_COLOR[r.tone]
                    )}
                  >
                    {r.text}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </AppShell>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-base font-semibold">{value}</div>
  </div>
);

export default MapPage;
