import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, Gamepad2, Users, Swords, ScrollText, ShieldQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { useGame } from '@/game/GameContext';
import { NATIONS } from '@/game/engine';
import AppShell from '@/components/AppShell';
import StrategicMap from '@/components/StrategicMap';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: Users, title: '国家人格编辑器', desc: '为十个国家编写 system prompt、skills 和 memory，塑造它们的决策风格。' },
  { icon: Swords, title: '自动演化沙盘', desc: '智能体会自动谈判、下达命令，并由后端统一裁定战局。' },
  { icon: ScrollText, title: '年度治理循环', desc: '按年度阶段推进，并在年末复盘时继续调整各国行为规则。' },
];

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { state, ready, busy, startGameAction } = useGame();

  const handleStart = async () => {
    if (!ready) {
      const ok = await startGameAction();
      if (!ok) {
        toast.error('后端初始化失败，请检查后端连接或错误提示');
        return;
      }
    }
    navigate('/map');
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-10 p-8">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-center">
          <div className="space-y-5 lg:col-span-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
              <ShieldQuestion className="h-3.5 w-3.5" />
              第一晚活动
            </div>

            <h1 className="font-display text-4xl font-black leading-tight">
              <span className="text-glow text-primary">智能体外交</span>
              <br />
              一场由真实模型驱动的国家博弈
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              你不直接下达军令，而是通过塑造各国的规则与人格，让智能体自行谈判、合作、背叛与扩张。
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" onClick={handleStart} disabled={busy}>
                <Gamepad2 className="mr-2 h-5 w-5" />
                {busy ? '正在初始化' : ready ? '进入战略地图' : '开始游戏'}
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/control')}
                className="!bg-transparent hover:!bg-secondary"
              >
                <MapIcon className="mr-2 h-5 w-5" />
                前往游戏控制台
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-border shadow">
              <div className="aspect-video">
                <StrategicMap state={state} className="h-full w-full" />
              </div>
              <div className="border-t border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground">
                战略沙盘预览
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-lg border border-border bg-card p-5">
                <Icon className="mb-3 h-7 w-7 text-primary" />
                <h3 className="mb-1.5 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
              </div>
            );
          })}
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl font-semibold">参战的十个架空国家</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {NATIONS.map((nation) => (
              <div key={nation.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3">
                <span className="h-8 w-8 shrink-0 rounded-md" style={{ background: nation.color }} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{nation.name}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Index;
