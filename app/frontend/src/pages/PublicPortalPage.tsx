import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Loader2, Radio, ScrollText, Swords } from 'lucide-react';
import StrategicMap from '@/components/StrategicMap';
import BattleReportPanel from '@/components/BattleReportPanel';
import { fetchPortalSnapshotBundle, fetchSpectatorPublic, SpectatorPublicState } from '@/game/api';
import { buildSpectatorGameState } from '@/game/spectator';

const PublicPortalPage: React.FC = () => {
  const [data, setData] = useState<SpectatorPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'live' | 'snapshot'>('live');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchSpectatorPublic();
        if (cancelled) return;
        setData(result.state);
        setError(null);
        setMode('live');
      } catch {
        try {
          const snapshot = await fetchPortalSnapshotBundle();
          if (cancelled) return;
          setData(snapshot.public_state);
          setError(null);
          setMode('snapshot');
        } catch (err) {
          if (!cancelled) {
            setError((err as Error).message || 'Failed to load public portal');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const mapState = useMemo(() => {
    if (!data) return null;
    return buildSpectatorGameState({
      year: data.year,
      phase_index: data.phase_index,
      status: data.status,
      ownership: data.ownership,
      units: data.units,
      scCount: data.scCount,
      reports: data.reports,
      phaseSnapshots: data.phaseSnapshots,
    });
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          正在加载公共战况
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!data || !mapState) {
    return null;
  }

  const rankings = [...data.nations].sort((a, b) => (data.scCount[b.id] || 0) - (data.scCount[a.id] || 0));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <section className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Agent Diplomacy Public Portal</div>
              <h1 className="mt-2 font-display text-3xl font-bold">公共局势页</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                {data.year} 年 · {data.phase_label}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <Radio className="h-4 w-4" />
              {mode === 'live' ? '实时模式 · 15 秒自动刷新' : '快照模式 · 15 秒轮询公共快照'}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Swords className="h-4 w-4 text-primary" />
              当前战略地图
            </div>
            <div className="h-[58vh] min-h-[420px] overflow-hidden rounded-lg border border-border/70 bg-background/40">
              <StrategicMap state={mapState} className="h-full w-full" />
            </div>
          </div>

          <aside className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Crown className="h-4 w-4 text-primary" />
              当前 SC 排行
            </div>
            <div className="space-y-2">
              {rankings.map((nation, index) => (
                <div key={nation.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-3">
                  <div className="w-5 text-center text-sm font-bold text-muted-foreground">{index + 1}</div>
                  <span className="h-4 w-4 rounded-sm" style={{ background: nation.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{nation.slot_label}</div>
                    <div className="text-xs text-muted-foreground">{nation.name}</div>
                  </div>
                  <div className="text-right text-sm font-semibold text-primary">{data.scCount[nation.id] || 0} SC</div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4 text-primary" />
              近期公开战报
            </div>
            <div className="space-y-4">
              {mapState.reports.length > 0 ? (
                mapState.reports.slice(0, 8).map((report) => <BattleReportPanel key={report.id} report={report} />)
              ) : (
                <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                  暂无公开战报。
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">年度回顾</div>
            <div className="space-y-2">
              {data.history.length > 0 ? (
                data.history.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/70 bg-background/40 px-3 py-3">
                    <div className="text-sm font-semibold">{item.year} 年</div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.summary}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                  暂无年度总结。
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default PublicPortalPage;
