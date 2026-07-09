import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Brain, ChevronRight, Copy, Download, Flag, KeyRound, Loader2, Play, Power, Radio, RotateCcw, Settings2 } from 'lucide-react';
import { useGame } from '@/game/GameContext';
import {
  fetchLlmConfig,
  fetchSpectatorCredentials,
  fetchSpectatorNetworkInfo,
  LlmRuntimeConfig,
  SpectatorCredentialsResponse,
  SpectatorNetworkInfoResponse,
  updateLlmConfig,
} from '@/game/api';
import { createInitialState, exportState, phaseAt, PHASES } from '@/game/engine';
import { buildPortalSnapshotBundle } from '@/game/portalSnapshot';
import AppShell from '@/components/AppShell';
import BattleReportPanel from '@/components/BattleReportPanel';
import PortalQrCode from '@/components/PortalQrCode';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPortalSnapshotURL } from '@/lib/config';
import { cn } from '@/lib/utils';

const INITIAL_OWNERSHIP = createInitialState().ownership;
const EMPTY_LLM_CONFIG: LlmRuntimeConfig = {
  active_provider: 'openai',
  openai: { api_key: '', base_url: '', model: 'deepseek-v4-flash' },
  anthropic: { api_key: '', base_url: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  gemini: { api_key: '', base_url: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-pro' },
  updated_at: null,
};

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
  const [portalAccess, setPortalAccess] = useState<SpectatorCredentialsResponse | null>(null);
  const [networkInfo, setNetworkInfo] = useState<SpectatorNetworkInfoResponse | null>(null);
  const [lanShareEnabled, setLanShareEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('lan-share-enabled') === 'true';
  });
  const [shareBaseUrl, setShareBaseUrl] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem('player-share-base-url') || '';
  });
  const [llmConfig, setLlmConfig] = useState<LlmRuntimeConfig>(EMPTY_LLM_CONFIG);
  const [llmConfigLoading, setLlmConfigLoading] = useState(true);
  const [llmConfigSaving, setLlmConfigSaving] = useState(false);

  useEffect(() => {
    setMaxYearDraft(String(state.governance.maxYear || 1910));
  }, [state.governance.maxYear]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchLlmConfig();
        if (!cancelled) {
          setLlmConfig(result.config);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error((error as Error).message || '加载模型配置失败');
        }
      } finally {
        if (!cancelled) {
          setLlmConfigLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('player-share-base-url', shareBaseUrl);
  }, [shareBaseUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('lan-share-enabled', String(lanShareEnabled));
  }, [lanShareEnabled]);

  useEffect(() => {
    if (!lanShareEnabled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { result, network } = await loadLanShareData();
        if (cancelled) {
          return;
        }
        setPortalAccess(result);
        setNetworkInfo(network);
      } catch {
        if (cancelled) {
          return;
        }
        setPortalAccess(null);
        setNetworkInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lanShareEnabled]);

  const portalSnapshotUrl = getPortalSnapshotURL();

  const loadLanShareData = async () => {
    const [result, network] = await Promise.all([fetchSpectatorCredentials(), fetchSpectatorNetworkInfo()]);
    setPortalAccess(result);
    setNetworkInfo(network);
    if (!window.localStorage.getItem('player-share-base-url') && network.recommended_base_url) {
      setShareBaseUrl(network.recommended_base_url);
    }
    return { result, network };
  };

  const handleLlmConfigFieldChange = (
    provider: 'openai' | 'anthropic' | 'gemini',
    field: 'api_key' | 'base_url' | 'model',
    value: string,
  ) => {
    setLlmConfig((previous) => ({
      ...previous,
      [provider]: {
        ...previous[provider],
        [field]: value,
      },
    }));
  };

  const handleReloadLlmConfig = async () => {
    setLlmConfigLoading(true);
    try {
      const result = await fetchLlmConfig();
      setLlmConfig(result.config);
      toast.success('已重新读取当前模型配置');
    } catch (error) {
      toast.error((error as Error).message || '读取模型配置失败');
    } finally {
      setLlmConfigLoading(false);
    }
  };

  const handleSaveLlmConfig = async () => {
    setLlmConfigSaving(true);
    try {
      const result = await updateLlmConfig(llmConfig);
      setLlmConfig(result.config);
      toast.success('模型配置已保存，下一次阶段推进会立即使用新配置');
    } catch (error) {
      toast.error((error as Error).message || '保存模型配置失败');
    } finally {
      setLlmConfigSaving(false);
    }
  };

  const normalizedShareBaseUrl = shareBaseUrl.trim().replace(/\/+$/, '');
  const publicPortalUrl = normalizedShareBaseUrl
    ? `${normalizedShareBaseUrl}/#/public`
    : portalAccess?.public_url || '';

  const getSharedPlayerUrl = (nationId: string) =>
    normalizedShareBaseUrl ? `${normalizedShareBaseUrl}/#/player/${nationId}` : '';

  const handleCopyAllPortalAccess = async () => {
    if (!portalAccess) {
      return;
    }
    const content = [
      '公共页',
      publicPortalUrl,
      '',
      '各排私有页',
      ...portalAccess.players.flatMap((player) => [
        player.slot_label,
        `链接：${getSharedPlayerUrl(player.nation_id) || player.url}`,
        `密码：${player.password}`,
        '',
      ]),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(content);
      toast.success('已复制全部玩家链接与密码');
    } catch {
      toast.error('复制失败，请检查浏览器剪贴板权限');
    }
  };

  const handleCopySinglePortalAccess = async (slotLabel: string, url: string, password: string) => {
    try {
      await navigator.clipboard.writeText(`${slotLabel}\n链接：${url}\n密码：${password}`);
      toast.success(`已复制 ${slotLabel} 的访问链接与密码`);
    } catch {
      toast.error('复制失败，请检查浏览器剪贴板权限');
    }
  };

  const handleAutoFillLanAddress = async () => {
    try {
      const network = networkInfo || (await fetchSpectatorNetworkInfo());
      setNetworkInfo(network);
      if (!network.recommended_base_url) {
        toast.error('未能自动识别当前 WLAN IP，请手动填写');
        return;
      }
      setShareBaseUrl(network.recommended_base_url);
      toast.success(`已自动填入共享地址：${network.recommended_base_url}`);
    } catch {
      toast.error('未能自动识别当前 WLAN IP，请手动填写');
    }
  };

  const handleToggleLanShare = async () => {
    if (lanShareEnabled) {
      setLanShareEnabled(false);
      return;
    }
    try {
      await loadLanShareData();
      setLanShareEnabled(true);
      toast.success('局域网分享已启用');
    } catch {
      setPortalAccess(null);
      setNetworkInfo(null);
      toast.error('启用局域网分享失败，请检查本机服务状态');
    }
  };

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

  const handleExportPortalSnapshot = async () => {
    try {
      const access = portalAccess || (await fetchSpectatorCredentials());
      if (!portalAccess) {
        setPortalAccess(access);
      }
      const bundle = buildPortalSnapshotBundle(state, access);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'latest.json';
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }, 1000);
      toast.success('已导出线上快照 latest.json');
    } catch {
      toast.error('导出线上快照失败，请检查玩家访问凭据是否可用');
    }
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

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">本机模型配置</h3>
                <div className="mt-1 text-sm text-muted-foreground">
                  这里保存的是本地真实后端配置。保存后下一次 AI 决策会立即使用新设置。
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="bg-transparent hover:bg-secondary"
                  onClick={handleReloadLlmConfig}
                  disabled={llmConfigLoading || llmConfigSaving}
                >
                  {llmConfigLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  重新读取
                </Button>
                <Button onClick={handleSaveLlmConfig} disabled={llmConfigLoading || llmConfigSaving}>
                  {llmConfigSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  保存并应用
                </Button>
              </div>
            </div>

            <div className="mb-4 rounded-md border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
              <div>
                当前 AI 决策提供商：<span className="font-mono text-foreground">{llmConfig.active_provider}</span>
              </div>
              <div>OpenAI 一栏兼容 DeepSeek 等 OpenAI-compatible 服务。</div>
              <div>Anthropic 与 Gemini 会走各自官方接口，保存后会真正切换后端调用链路。</div>
              <div>
                上次保存时间：<span className="font-mono text-foreground">{llmConfig.updated_at || '尚未保存过本地覆盖配置'}</span>
              </div>
            </div>

            <div className="mb-6 space-y-1.5">
              <Label htmlFor="active-provider">当前决策提供商</Label>
              <select
                id="active-provider"
                value={llmConfig.active_provider}
                onChange={(event) =>
                  setLlmConfig((previous) => ({
                    ...previous,
                    active_provider: event.target.value as 'openai' | 'anthropic' | 'gemini',
                  }))
                }
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="openai">OpenAI / DeepSeek / OpenAI-compatible</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {([
                {
                  key: 'openai',
                  title: 'OpenAI / Compatible',
                  placeholder: '例如 https://api.deepseek.com',
                },
                {
                  key: 'anthropic',
                  title: 'Anthropic',
                  placeholder: '默认 https://api.anthropic.com',
                },
                {
                  key: 'gemini',
                  title: 'Gemini',
                  placeholder: '默认 https://generativelanguage.googleapis.com',
                },
              ] as const).map((provider) => (
                <div key={provider.key} className="space-y-3 rounded-md border border-border/70 bg-background/30 p-4">
                  <div className="font-medium text-foreground">{provider.title}</div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${provider.key}-api-key`}>API Key</Label>
                    <Input
                      id={`${provider.key}-api-key`}
                      type="password"
                      autoComplete="off"
                      value={llmConfig[provider.key].api_key}
                      onChange={(event) => handleLlmConfigFieldChange(provider.key, 'api_key', event.target.value)}
                      placeholder="输入 API Key"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${provider.key}-base-url`}>Base URL</Label>
                    <Input
                      id={`${provider.key}-base-url`}
                      value={llmConfig[provider.key].base_url}
                      onChange={(event) => handleLlmConfigFieldChange(provider.key, 'base_url', event.target.value)}
                      placeholder={provider.placeholder}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${provider.key}-model`}>模型名</Label>
                    <Input
                      id={`${provider.key}-model`}
                      value={llmConfig[provider.key].model}
                      onChange={(event) => handleLlmConfigFieldChange(provider.key, 'model', event.target.value)}
                      placeholder="输入模型名"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => openSettings('control')}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              智能体设置
            </Button>

            <Button variant="secondary" onClick={handleExportPortalSnapshot}>
              <Download className="mr-1.5 h-4 w-4" />
              导出线上快照 latest.json
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
            <div className="mb-4 flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">玩家页面发布</h3>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-border/70 bg-background/30 p-4 text-sm">
                <div className="font-medium text-foreground">线上静态快照模式</div>
                <div className="mt-1 text-muted-foreground">
                  每回合导出一次 `latest.json`，上传覆盖对象存储中的同名文件。
                </div>
                <div className="mt-3 rounded-md border border-border/60 bg-background/40 px-3 py-3 text-xs text-muted-foreground">
                  <div>Netlify 变量：<span className="ml-1 font-mono text-foreground">VITE_PORTAL_SNAPSHOT_URL</span></div>
                  <div className="mt-1">
                    当前值：
                    <span className="ml-1 font-mono text-foreground">{portalSnapshotUrl || '待填写'}</span>
                  </div>
                  <div className="mt-1">示例：<span className="font-mono text-foreground">https://your-bucket.example.com/snapshot/latest.json</span></div>
                </div>
              </div>

              <div className="rounded-md border border-border/70 bg-secondary/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">局域网直连工具</div>
                    <div className="mt-1 text-sm text-muted-foreground">默认关闭。启用后可复制链接、密码和二维码。</div>
                  </div>
                  <Button type="button" variant={lanShareEnabled ? 'destructive' : 'outline'} className="bg-transparent" onClick={handleToggleLanShare}>
                    <Power className="mr-1.5 h-4 w-4" />
                    {lanShareEnabled ? '关闭局域网分享' : '启用局域网分享'}
                  </Button>
                </div>

                {lanShareEnabled ? (
                  <div className="mt-4 space-y-4">
                    {portalAccess ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                          <Button variant="secondary" onClick={handleCopyAllPortalAccess}>
                            <Copy className="mr-1.5 h-4 w-4" />
                            复制所有玩家链接与密码
                          </Button>
                        </div>

                        <div className="rounded-md border border-border/70 bg-background/30 p-4">
                          <div className="text-sm font-medium text-foreground">共享访问地址</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            填当前这台电脑在同一热点或同一 Wi-Fi 下的可访问地址。玩家二维码和复制链接都会使用这里。
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3">
                            <Input
                              className="min-w-[280px] flex-1"
                              value={shareBaseUrl}
                              onChange={(event) => setShareBaseUrl(event.target.value)}
                              placeholder="例如 http://192.168.3.17:3000"
                            />
                            <Button type="button" variant="outline" className="bg-transparent" onClick={handleAutoFillLanAddress}>
                              自动读取当前 WLAN IP
                            </Button>
                          </div>
                          {networkInfo?.candidates?.length ? (
                            <div className="mt-3 text-xs text-muted-foreground">
                              当前识别到的局域网候选：
                              <div className="mt-1 space-y-1 font-mono text-foreground">
                                {networkInfo.candidates.map((candidate) => (
                                  <div key={`${candidate.interface}-${candidate.ip}-${candidate.source}`}>
                                    {candidate.ip}
                                    {candidate.interface ? ` · ${candidate.interface}` : ''}
                                    {candidate.source ? ` · ${candidate.source}` : ''}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-md border border-border/70 bg-secondary/20 p-4 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground">公共页</div>
                              <div className="mt-1 break-all font-mono text-muted-foreground">{publicPortalUrl}</div>
                            </div>
                            <div className="flex shrink-0 flex-col items-center gap-2">
                              <PortalQrCode
                                value={publicPortalUrl}
                                size={144}
                                className="rounded-md border border-border/70"
                              />
                              <div className="text-xs text-muted-foreground">扫码进入公共页</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {portalAccess.players.map((player) => (
                            <div key={player.nation_id} className="rounded-md border border-border/70 bg-background/40 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-sm" style={{ background: player.nation_color }} />
                                    <div className="font-medium text-foreground">{player.slot_label}</div>
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">{player.filename}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-transparent"
                                  onClick={() =>
                                    handleCopySinglePortalAccess(
                                      player.slot_label,
                                      getSharedPlayerUrl(player.nation_id) || player.url,
                                      player.password,
                                    )
                                  }
                                >
                                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                                  复制
                                </Button>
                              </div>

                              <div className="mt-4 flex flex-col items-center gap-3">
                                <PortalQrCode
                                  value={getSharedPlayerUrl(player.nation_id) || player.url}
                                  size={176}
                                  className="rounded-md border border-border/70"
                                />
                                <div className="text-xs text-muted-foreground">扫码进入私有页</div>
                              </div>

                              <div className="mt-4 text-xs text-muted-foreground">私有页链接</div>
                              <div className="mt-1 break-all font-mono text-xs text-foreground">
                                {getSharedPlayerUrl(player.nation_id) || player.url}
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                <KeyRound className="h-3.5 w-3.5 text-primary" />
                                访问密码：<span className="font-mono text-foreground">{player.password}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                        当前未能读取局域网玩家通道信息。这个面板只允许在本机访问时读取密码清单。
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
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
