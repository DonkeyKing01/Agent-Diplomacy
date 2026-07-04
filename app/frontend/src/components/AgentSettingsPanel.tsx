/**
 * 智能体设置面板：国家档案式覆盖面板（overlay）。
 * - 不作独立首页入口，不触发游戏重置/重新初始化。
 * - 记录来源页，点击返回时回到进入前的游戏页面，返回文案随来源变化。
 * - 阶段运行中可查看，关键修改提示将在下一阶段生效。
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, ScrollText, Save, Undo2, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { useGame } from '@/game/GameContext';
import { Nation, phaseAt, unitsOf } from '@/game/engine';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const RETURN_LABEL: Record<string, string> = {
  map: '返回战略地图',
  control: '返回游戏控制台',
  messages: '返回外交密信',
  history: '返回历史记录',
  index: '返回活动首页',
};
const RETURN_PATH: Record<string, string> = {
  map: '/map',
  control: '/control',
  messages: '/messages',
  history: '/history',
  index: '/',
};

const FIELD_HINT: { key: keyof Nation; label: string; zh: string; rows: number }[] = [
  { key: 'systemPrompt', label: 'System Prompt', zh: '国家宪法：长期不易改变的核心人格与地缘价值观', rows: 5 },
  { key: 'skills', label: 'Skills.md', zh: '行为与战术手册：将人格翻译为合规军事命令的操作规范', rows: 6 },
  { key: 'memory', label: 'Memory', zh: '历史记忆：信誉白名单、血仇黑名单与历史偏见（核心仇恨不可一键清空）', rows: 4 },
  { key: 'yearlyAdvice', label: '年度建议', zh: '下一年度临时策略补丁（仅供参考，智能体自主决断）', rows: 3 },
];

const AgentSettingsPanel: React.FC = () => {
  const { state, ready, settingsSource, focusNation, closeSettings, updateNation } = useGame();
  const navigate = useNavigate();
  const running = phaseAt(state.phaseIndex).key !== 'review' && ready && state.status !== 'finished';

  const [selectedId, setSelectedId] = useState<string>(focusNation || state.nations[0].id);
  const selected = state.nations.find((n) => n.id === selectedId) || state.nations[0];
  const [draft, setDraft] = useState<Nation>(() => JSON.parse(JSON.stringify(selected)));

  // 切换国家时同步草稿
  const selectNation = (id: string) => {
    const n = state.nations.find((x) => x.id === id)!;
    setSelectedId(id);
    setDraft(JSON.parse(JSON.stringify(n)));
  };

  const handleBack = () => {
    closeSettings();
    if (settingsSource && RETURN_PATH[settingsSource]) navigate(RETURN_PATH[settingsSource]);
  };

  const handleSave = () => {
    updateNation(draft.id, {
      systemPrompt: draft.systemPrompt,
      skills: draft.skills,
      memory: draft.memory,
      yearlyAdvice: draft.yearlyAdvice,
      traits: draft.traits,
    });
    toast.success(`已保存「${draft.name}」的智能体设置`, {
      description: running ? '当前阶段正在运行，修改将在下一阶段生效。' : '设置已即时写入国家档案。',
    });
  };

  const handleDiscard = () => {
    setDraft(JSON.parse(JSON.stringify(selected)));
    toast('已放弃本次修改');
  };

  const backLabel = settingsSource ? RETURN_LABEL[settingsSource] : '返回游戏';
  const sc = state.scCount[draft.id] || 0;
  const unitCount = unitsOf(state, draft.id).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-sm">
      {/* 顶部返回栏 */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack} className="!bg-transparent hover:!bg-secondary">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {backLabel}
          </Button>
          <h2 className="font-display text-lg font-semibold">智能体设置 · 国家档案</h2>
        </div>
        {running && (
          <Badge variant="outline" className="border-primary/50 text-primary">
            当前阶段运行中，修改将在下一阶段生效
          </Badge>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 国家列表 */}
        <ScrollArea className="w-60 shrink-0 border-r border-border">
          <div className="space-y-1 p-3">
            {state.nations.map((n) => (
              <button
                key={n.id}
                onClick={() => selectNation(n.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                  n.id === selectedId ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60',
                )}
              >
                <span className="h-4 w-4 shrink-0 rounded-sm" style={{ background: n.color }} />
                <span className="min-w-0 flex-1 truncate">{n.name}</span>
                <span className="tabular text-xs text-primary">{state.scCount[n.id] || 0} SC</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* 档案详情 */}
        <ScrollArea className="min-w-0 flex-1">
          <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* 1. 国家基础信息 */}
            <section className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-md" style={{ background: draft.color }}>
                  <Flag className="h-6 w-6 text-[#0a1220]" />
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-xl font-bold">{draft.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground tabular">
                    <span>当前 SC：<span className="text-primary">{sc}</span></span>
                    <span>当前单位数：<span className="text-foreground">{unitCount}</span></span>
                    <span>状态：{state.status === 'finished' ? '终局' : ready ? '参战中' : '待命'}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Agent 核心设置 */}
            <section className="space-y-4 rounded-lg border border-border bg-card p-5">
              <h3 className="font-display text-lg font-semibold">Agent 核心设置</h3>
              {FIELD_HINT.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="flex items-baseline gap-2">
                    <span className="font-mono text-primary">{f.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">（{f.zh}）</span>
                  </Label>
                  <Textarea
                    rows={f.rows}
                    value={draft[f.key] as string}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="resize-none font-mono text-sm scrollbar-thin"
                  />
                </div>
              ))}
            </section>

            {/* 3. 国家性格参数 */}
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h3 className="font-display text-lg font-semibold">国家性格参数</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextTrait label="国家气质" value={draft.traits.temperament} onChange={(v) => setDraft({ ...draft, traits: { ...draft.traits, temperament: v } })} />
                <TextTrait label="风险偏好" value={draft.traits.risk} onChange={(v) => setDraft({ ...draft, traits: { ...draft.traits, risk: v } })} />
                <TextTrait label="荣誉观" value={draft.traits.honor} onChange={(v) => setDraft({ ...draft, traits: { ...draft.traits, honor: v } })} />
                <TextTrait label="外交风格" value={draft.traits.diplomacy} onChange={(v) => setDraft({ ...draft, traits: { ...draft.traits, diplomacy: v } })} />
              </div>
              <SliderTrait label="记仇指数" value={draft.traits.vengeance} onChange={(v) => setDraft({ ...draft, traits: { ...draft.traits, vengeance: v } })} />
              <SliderTrait label="扩张倾向" value={draft.traits.expansion} onChange={(v) => setDraft({ ...draft, traits: { ...draft.traits, expansion: v } })} />
            </section>

            {/* 4. 操作按钮 */}
            <section className="flex flex-wrap gap-3">
              <Button onClick={handleSave}>
                <Save className="mr-1.5 h-4 w-4" />
                保存设置
              </Button>
              <Button variant="outline" onClick={handleDiscard} className="!bg-transparent hover:!bg-secondary">
                <Undo2 className="mr-1.5 h-4 w-4" />
                放弃修改
              </Button>
              <Button variant="secondary" onClick={handleBack}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                返回游戏
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  closeSettings();
                  navigate('/messages');
                }}
              >
                <Mail className="mr-1.5 h-4 w-4" />
                查看该国密信
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  closeSettings();
                  navigate('/history');
                }}
              >
                <ScrollText className="mr-1.5 h-4 w-4" />
                查看该国历史记录
              </Button>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

const TextTrait: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const SliderTrait: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <span className="tabular text-sm text-primary">{value}</span>
    </div>
    <Slider value={[value]} min={0} max={100} step={1} onValueChange={(v) => onChange(v[0])} />
  </div>
);

export default AgentSettingsPanel;