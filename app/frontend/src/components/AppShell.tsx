/**
 * 应用外壳：中文侧边导航 + 顶栏 + 智能体设置覆盖面板挂载。
 * 首页仅作开局介绍；游戏开始后默认主页为战略地图。
 */
import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Map as MapIcon,
  Gamepad2,
  Mail,
  Users,
  ScrollText,
  Database,
  Home,
  Circle,
} from 'lucide-react';
import { useGame } from '@/game/GameContext';
import { phaseAt } from '@/game/engine';
import AgentSettingsPanel from './AgentSettingsPanel';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: '活动首页', icon: Home, sub: false },
  { to: '/map', label: '战略地图', icon: MapIcon, sub: false },
  { to: '/control', label: '游戏控制台', icon: Gamepad2, sub: false },
  { to: '/messages', label: '外交密信', icon: Mail, sub: false },
  { to: '/agents', label: '智能体设置', icon: Users, sub: false },
  { to: '/history', label: '历史记录', icon: ScrollText, sub: false },
  { to: '/data', label: '数据管理', icon: Database, sub: false },
];

const STATUS_TEXT: Record<string, { text: string; color: string }> = {
  preparing: { text: '准备中', color: 'text-muted-foreground' },
  reasoning: { text: '推理中', color: 'text-accent' },
  awaiting: { text: '等待提交', color: 'text-primary' },
  finished: { text: '已完成', color: 'text-destructive' },
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, settingsOpen, openSettings } = useGame();
  const location = useLocation();
  const phase = phaseAt(state.phaseIndex);
  const status = STATUS_TEXT[state.status];

  // 从侧边导航直接进入「智能体设置」时，落在战略地图并打开覆盖面板，返回即回到战略地图。
  useEffect(() => {
    if (location.pathname === '/agents' && !settingsOpen) {
      openSettings('map');
    }
  }, [location.pathname, settingsOpen, openSettings]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 侧边导航 */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar-background">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary font-display text-lg font-black text-primary-foreground">
            智
          </div>
          <div>
            <div className="font-display text-base font-bold leading-none text-glow">智能体外交</div>
            <div className="mt-1 text-[11px] tracking-wider text-muted-foreground">Agent Diplomacy</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Circle className={cn('h-2.5 w-2.5 fill-current', status.color)} />
            <span>
              局势：<span className={status.color}>{status.text}</span>
            </span>
          </div>
          <div className="mt-1.5 tabular">
            {state.year} 年 · {phase.season}
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-lg font-semibold">
              {NAV.find((n) => n.to === location.pathname)?.label ?? '智能体外交'}
            </h2>
            <span className="text-sm text-muted-foreground tabular">
              {state.year} 年 · {phase.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={cn('flex items-center gap-1.5 font-medium', status.color)}>
              <Circle className="h-2 w-2 fill-current" />
              {status.text}
            </span>
          </div>
        </header>

        {/* 内容 */}
        <main className="min-h-0 flex-1 overflow-auto scrollbar-thin cmd-grid">{children}</main>
      </div>

      {/* 智能体设置覆盖面板 */}
      {settingsOpen && <AgentSettingsPanel />}
    </div>
  );
};

export default AppShell;