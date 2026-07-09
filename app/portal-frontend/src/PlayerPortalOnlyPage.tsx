import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Brain, KeyRound, Loader2, Mail, ScrollText, Shield, Users } from 'lucide-react';
import StrategicMap from '@/components/StrategicMap';
import BattleReportPanel from '@/components/BattleReportPanel';
import { fetchPortalSnapshotBundle, PortalSnapshotBundle, SpectatorPrivateState } from '@/game/api';
import { buildSpectatorGameState } from '@/game/spectator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const storageKeyFor = (nationId: string) => `player-portal-password-${nationId}`;

const PlayerPortalOnlyPage: React.FC = () => {
  const { nationId = '' } = useParams();
  const [password, setPassword] = useState('');
  const [data, setData] = useState<SpectatorPrivateState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotBundle, setSnapshotBundle] = useState<PortalSnapshotBundle | null>(null);

  useEffect(() => {
    if (!nationId) return;
    const cached = window.sessionStorage.getItem(storageKeyFor(nationId));
    if (cached) {
      setPassword(cached);
    }
  }, [nationId]);

  const unlock = async (nextPassword?: string) => {
    if (!nationId) return;
    const usingPassword = (nextPassword ?? password).trim();
    if (!usingPassword) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const bundle = snapshotBundle || (await fetchPortalSnapshotBundle());
      setSnapshotBundle(bundle);
      const player = bundle.player_states?.[nationId];
      if (!player) {
        throw new Error('快照中没有这个国家页');
      }
      if ((player.password || '').trim() !== usingPassword) {
        throw new Error('密码错误');
      }
      setData(player.state);
      setError(null);
      window.sessionStorage.setItem(storageKeyFor(nationId), usingPassword);
    } catch (err) {
      setError((err as Error).message || '密码错误或页面暂不可用');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!nationId) return;
    const cached = window.sessionStorage.getItem(storageKeyFor(nationId));
    if (!cached) return;
    void unlock(cached);
    const timer = window.setInterval(() => void unlock(cached), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nationId]);

  const mapState = useMemo(() => {
    if (!data) return null;
    return buildSpectatorGameState({
      year: data.year,
      phase_index: data.phase_index,
      status: data.status,
      ownership: data.map.ownership,
      units: data.map.units,
      scCount: data.map.scCount,
      reports: data.map.reports,
      phaseSnapshots: data.map.phaseSnapshots,
    });
  }, [data]);

  const nationColorById = useMemo(() => {
    if (!data) return {} as Record<string, string>;
    return Object.fromEntries((data.map.nations || []).map((nation) => [nation.id, nation.color]));
  }, [data]);

  if (!data || !mapState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Private Player Portal</div>
            <h1 className="mt-2 font-display text-2xl font-bold">私有国家页</h1>
            <div className="mt-2 text-sm text-muted-foreground">当前通道：{nationId || '未指定国家'}</div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">请输入该国家的访问密码。</div>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void unlock();
                }
              }}
              placeholder="访问密码"
            />
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            <Button onClick={() => void unlock()} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              进入私有国家页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <section className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Player Private Portal</div>
              <h1 className="mt-2 font-display text-3xl font-bold">{data.nation.name}</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                {data.year} 年 · {data.phase_label} · {data.nation.sc} SC
              </div>
            </div>
            <div className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              快照模式 · 15 秒自动刷新
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-primary" />
              当前地图
            </div>
            <div className="h-[56vh] min-h-[420px] overflow-hidden rounded-lg border border-border/70 bg-background/40">
              <StrategicMap state={mapState} className="h-full w-full" />
            </div>
          </div>

          <aside className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" />
                信任与关系
              </div>
              <div className="space-y-2">
                {(data.blackbox?.alignment_report?.trust_scores || []).map((row) => (
                  <div key={row.nation_id} className="rounded-lg border border-border/70 bg-background/40 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-sm border border-white/15"
                          style={{ backgroundColor: nationColorById[row.nation_id] || '#64748b' }}
                          aria-hidden="true"
                        />
                        <div className="font-medium">{row.nation_name}</div>
                      </div>
                      <div className="text-sm font-semibold text-primary">{row.trust_score} / 100</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      关系：{row.soft_alliance_level} · 承诺 {row.commitments} · 协同 {row.military_cooperation} · 背刺 {row.betrayals_against_us}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-primary" />
                私密外交
              </div>
              <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                {data.messages.length > 0 ? (
                  data.messages.map((message) => (
                    <div key={message.id} className="rounded-lg border border-border/70 bg-background/40 px-3 py-3">
                      <div className="text-xs text-muted-foreground">
                        {message.phaseLabel} · {message.from} → {message.to}
                      </div>
                      <div className="mt-1 whitespace-pre-line text-sm">{message.content}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                    暂无私密外交记录。
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4 text-primary" />
              当前提示词与年度建议
            </div>
            <div className="space-y-3">
              <FieldBlock title="System Prompt" value={data.agent_profile.system_prompt} />
              <FieldBlock title="Skills.md" value={data.agent_profile.skills_md} />
              <FieldBlock title="年度建议" value={data.agent_profile.annual_advice} />
              <FieldBlock title="Memory" value={data.agent_profile.memory} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-primary" />
              黑匣子 CoT / 决策回放
            </div>
            <div className="max-h-[76vh] space-y-3 overflow-y-auto pr-1">
              {(data.blackbox?.decision_replay?.entries || []).length > 0 ? (
                data.blackbox.decision_replay.entries.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="rounded-lg border border-border/70 bg-background/40 p-4">
                    <div className="text-sm font-semibold">{entry.phase_label}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{entry.kind}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{entry.summary}</div>
                    <FieldInline title="Headline" value={entry.reasoning_trace?.headline} />
                    <FieldInline title="Goal" value={entry.reasoning_trace?.goal} />
                    <FieldInline title="Board Read" value={entry.reasoning_trace?.board_read} />
                    <FieldInline title="Diplomatic Read" value={entry.reasoning_trace?.diplomatic_read} />
                    <FieldInline title="Decision Logic" value={entry.reasoning_trace?.decision_logic} />
                    {(entry.reasoning_trace?.risks || []).length > 0 ? (
                      <div className="mt-2 text-sm text-muted-foreground">Risks：{entry.reasoning_trace?.risks?.join('；')}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                  暂无黑匣子决策回放。
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4 text-primary" />
            近期战报
          </div>
          <div className="space-y-4">
            {mapState.reports.length > 0 ? (
              mapState.reports.slice(0, 8).map((report) => <BattleReportPanel key={report.id} report={report} />)
            ) : (
              <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                暂无战报。
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const FieldBlock: React.FC<{ title: string; value?: string }> = ({ title, value }) => (
  <div className="space-y-1.5">
    <div className="text-sm font-semibold">{title}</div>
    <Textarea readOnly value={value || ''} rows={5} className="resize-none font-mono text-sm" />
  </div>
);

const FieldInline: React.FC<{ title: string; value?: string }> = ({ title, value }) =>
  value ? (
    <div className="mt-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{title}：</span>
      {value}
    </div>
  ) : null;

export default PlayerPortalOnlyPage;
