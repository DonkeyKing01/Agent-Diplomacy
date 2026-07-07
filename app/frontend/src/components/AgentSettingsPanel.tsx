import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Flag,
  Mail,
  Save,
  ScrollText,
  ShieldAlert,
  Undo2,
  Waypoints,
} from 'lucide-react';
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

const FIELD_HINT: { key: keyof Nation; label: string; description: string; rows: number }[] = [
  { key: 'systemPrompt', label: 'System Prompt', description: '长期人格、约束与战略底线。', rows: 5 },
  { key: 'skills', label: 'Skills.md', description: '行动手册与操作倾向。', rows: 6 },
  { key: 'memory', label: 'Memory', description: '历史持久记忆，只读展示。', rows: 4 },
  { key: 'yearlyAdvice', label: '本年年度建议', description: '当前年或下一年生效的策略补丁。', rows: 3 },
];

function cloneNation(nation: Nation): Nation {
  return JSON.parse(JSON.stringify(nation)) as Nation;
}

function parseMemorySections(memory: string) {
  const lines = memory
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const updateLine = lines.find((line) => line.startsWith('最近更新：')) || '';
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (line === updateLine) continue;
    if (line.endsWith('：') && !line.startsWith('-')) {
      current = { title: line.slice(0, -1), lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: '记忆摘要', lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }

  return { updateLine, sections };
}

const AgentSettingsPanel: React.FC = () => {
  const { state, ready, settingsSource, focusNation, closeSettings, updateNation } = useGame();
  const navigate = useNavigate();

  const inPreparing = ready && state.status === 'preparing';
  const inReview = ready && phaseAt(state.phaseIndex).key === 'review' && state.status !== 'finished';
  const selectedFromState = focusNation || state.nations[0]?.id || '';

  const [selectedId, setSelectedId] = useState<string>(selectedFromState);
  const selected = state.nations.find((nation) => nation.id === selectedId) || state.nations[0];
  const [draft, setDraft] = useState<Nation>(() => cloneNation(selected || state.nations[0]));

  useEffect(() => {
    if (focusNation && focusNation !== selectedId) {
      setSelectedId(focusNation);
    }
  }, [focusNation, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraft(cloneNation(selected));
    }
  }, [selectedId, selected]);

  const annualAdviceYears = state.governance.annual_advice_updated_years_by_nation || {};
  const nationAdviceYears = annualAdviceYears[draft.id] || [];
  const annualAdviceUsedThisYear = nationAdviceYears.includes(state.year);
  const isEliminated = (state.scCount[draft.id] || 0) <= 0;
  const canEditAnnualAdvice = inPreparing || inReview;
  const canEditCore = inPreparing;
  const canSave = !isEliminated && (inPreparing || inReview);
  const memoryView = useMemo(() => parseMemorySections(draft.memory || ''), [draft.memory]);
  const blackbox = state.blackbox[draft.id];

  const statusBadge = useMemo(() => {
    if (isEliminated) {
      return '已灭国：不可再编辑、不可复活';
    }
    if (inPreparing) {
      return '开局准备中：可修改 System Prompt / Skills / traits / 本年年度建议';
    }
    if (inReview) {
      return '年度复盘中：仅可修改一次下一年年度建议';
    }
    return '当前阶段仅可查看，治理修改已锁定';
  }, [inPreparing, inReview, isEliminated]);

  const selectNation = (nationId: string) => {
    const nation = state.nations.find((item) => item.id === nationId);
    if (!nation) return;
    setSelectedId(nationId);
    setDraft(cloneNation(nation));
  };

  const handleBack = () => {
    closeSettings();
    if (settingsSource && RETURN_PATH[settingsSource]) {
      navigate(RETURN_PATH[settingsSource]);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    if (isEliminated) {
      toast.error('该国已灭国，不能再修改或复活');
      return;
    }

    const patch: Partial<Nation> = {};

    if (inPreparing) {
      if (draft.systemPrompt !== selected.systemPrompt) patch.systemPrompt = draft.systemPrompt;
      if (draft.skills !== selected.skills) patch.skills = draft.skills;

      const traitsChanged =
        draft.traits.expansion !== selected.traits.expansion ||
        draft.traits.cunning !== selected.traits.cunning ||
        draft.traits.vengeance !== selected.traits.vengeance;

      if (traitsChanged) {
        patch.traits = {
          ...selected.traits,
          expansion: draft.traits.expansion,
          cunning: draft.traits.cunning,
          vengeance: draft.traits.vengeance,
        };
      }
    }

    if (canEditAnnualAdvice && draft.yearlyAdvice !== selected.yearlyAdvice) {
      patch.yearlyAdvice = draft.yearlyAdvice;
    }

    if (Object.keys(patch).length === 0) {
      toast('没有可保存的修改');
      return;
    }

    try {
      await updateNation(draft.id, patch);
      toast.success(`已保存 ${draft.name} 的智能体设置`, {
        description: inPreparing
          ? '准备阶段修改会立即用于 1901 年开局后的真实决策。'
          : '年度建议已写入，将在下一年度开始时生效。',
      });
    } catch (error) {
      toast.error('保存失败', {
        description: (error as { message?: string })?.message || '请稍后重试。',
      });
    }
  };

  const handleDiscard = () => {
    if (selected) {
      setDraft(cloneNation(selected));
    }
    toast('已放弃本次未保存修改');
  };

  const backLabel = settingsSource ? RETURN_LABEL[settingsSource] : '返回游戏';
  const sc = state.scCount[draft.id] || 0;
  const unitCount = unitsOf(state, draft.id).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-sm">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack} className="!bg-transparent hover:!bg-secondary">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {backLabel}
          </Button>
          <h2 className="font-display text-lg font-semibold">智能体设置 · 国家档案</h2>
        </div>
        <Badge variant="outline" className="border-primary/50 text-primary">
          {statusBadge}
        </Badge>
      </div>

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="w-60 shrink-0 border-r border-border">
          <div className="space-y-1 p-3">
            {state.nations.map((nation) => {
              const nationEliminated = (state.scCount[nation.id] || 0) <= 0;
              return (
                <button
                  key={nation.id}
                  onClick={() => selectNation(nation.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                    nation.id === selectedId
                      ? 'bg-secondary text-foreground'
                      : nationEliminated
                        ? 'text-muted-foreground/60'
                        : 'text-muted-foreground hover:bg-secondary/60',
                  )}
                >
                  <span className="h-4 w-4 shrink-0 rounded-sm" style={{ background: nation.color }} />
                  <span className="min-w-0 flex-1 truncate">{nation.name}</span>
                  {nationEliminated ? (
                    <span className="tabular text-xs text-muted-foreground">已灭国</span>
                  ) : (
                    <span className="tabular text-xs text-primary">{state.scCount[nation.id] || 0} SC</span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <ScrollArea className="min-w-0 flex-1">
          <div className="mx-auto max-w-5xl space-y-6 p-6">
            <section className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-md" style={{ background: draft.color }}>
                  <Flag className="h-6 w-6 text-[#0a1220]" />
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-xl font-bold">{draft.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground tabular">
                    <span>
                      当前 SC：<span className="text-primary">{sc}</span>
                    </span>
                    <span>
                      当前单位数：<span className="text-foreground">{unitCount}</span>
                    </span>
                    <span>状态：{isEliminated ? '已灭国' : state.status === 'finished' ? '终局' : inPreparing ? '准备中' : '参战中'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border bg-card p-5">
              <h3 className="font-display text-lg font-semibold">Agent 核心设置</h3>
              <div className="grid gap-2 rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                <div>System Prompt 剩余修改次数：{Math.max(0, 1 - state.governance.system_prompt_edits_used)} / 1</div>
                <div>Skills.md 剩余修改次数：{Math.max(0, 3 - state.governance.skills_edits_used)} / 3</div>
                <div>System Prompt 与 Skills.md 仅可在 preparing 阶段设定，后续年份不可再改。</div>
                <div>System Prompt / Skills.md / 年度建议 均不再限制文本长度。</div>
                <div>本年年度建议默认沿用上一年版本，除非你手动改写。</div>
                <div>本年年度建议：{annualAdviceUsedThisYear ? '本年额度已使用' : '本年还可修改 1 次'}</div>
                <div>Memory 为锁定历史层，只读展示，不可手动编辑。</div>
                {isEliminated ? <div>该国已灭国：不会再参与推理、行动或冬季复活。</div> : null}
              </div>

              {FIELD_HINT.map((field) => {
                const readOnly =
                  isEliminated || field.key === 'memory'
                    ? true
                    : field.key === 'yearlyAdvice'
                      ? !canEditAnnualAdvice
                      : !canEditCore;

                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="flex items-baseline gap-2">
                      <span className="font-mono text-primary">{field.label}</span>
                      <span className="text-xs font-normal text-muted-foreground">{field.description}</span>
                    </Label>
                    {field.key === 'memory' ? (
                      <div className="space-y-3 rounded-md border border-border bg-secondary/10 p-4">
                        {memoryView.updateLine ? (
                          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                            <div className="mb-1 text-xs uppercase tracking-[0.18em] text-primary">Latest Update</div>
                            <div className="font-mono text-foreground">{memoryView.updateLine.replace('最近更新：', '')}</div>
                          </div>
                        ) : null}
                        <div className="grid gap-3">
                          {memoryView.sections.length ? (
                            memoryView.sections.map((section) => (
                              <div key={section.title} className="rounded-md border border-border/70 bg-background/40 p-3">
                                <div className="mb-2 text-sm font-semibold text-primary">{section.title}</div>
                                <div className="space-y-1 font-mono text-sm text-muted-foreground">
                                  {section.lines.map((line, index) => (
                                    <div
                                      key={`${section.title}-${index}`}
                                      className={cn(
                                        'rounded px-2 py-1',
                                        line.startsWith('-') ? 'border-l-2 border-primary/40 bg-secondary/30 text-foreground' : '',
                                      )}
                                    >
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <Textarea rows={field.rows} value={draft[field.key] as string} readOnly className="resize-none font-mono text-sm" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <Textarea
                        rows={field.rows}
                        value={draft[field.key] as string}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                        readOnly={readOnly}
                        className="resize-none font-mono text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </section>

            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h3 className="font-display text-lg font-semibold">国家性格参数</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextTrait label="国家气质" value={draft.traits.temperament} disabled onChange={() => {}} />
                <TextTrait label="风险偏好" value={draft.traits.risk} disabled onChange={() => {}} />
                <TextTrait label="荣誉观" value={draft.traits.honor} disabled onChange={() => {}} />
                <TextTrait label="外交风格" value={draft.traits.diplomacy} disabled onChange={() => {}} />
              </div>
              <div className="rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                上面 4 个文本标签会根据下方真实人格数值自动推导并参与展示；真正进入后端决策的是下方 3 个数值参数。
              </div>
              <SliderTrait
                label="记仇指数"
                value={draft.traits.vengeance}
                disabled={!canEditCore}
                onChange={(value) => setDraft({ ...draft, traits: { ...draft.traits, vengeance: value } })}
              />
              <SliderTrait
                label="扩张倾向"
                value={draft.traits.expansion}
                disabled={!canEditCore}
                onChange={(value) => setDraft({ ...draft, traits: { ...draft.traits, expansion: value } })}
              />
              <SliderTrait
                label="诡谋程度"
                value={draft.traits.cunning}
                disabled={!canEditCore}
                onChange={(value) => setDraft({ ...draft, traits: { ...draft.traits, cunning: value } })}
              />
            </section>

            {blackbox ? (
              <section className="space-y-5 rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-semibold">黑匣子数据</h3>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-3 rounded-md border border-border/70 bg-secondary/10 p-4">
                    <div className="font-semibold text-primary">外交日志密档</div>
                    <BlackboxSubTitle title="最近发出" />
                    <MessageArchiveList items={blackbox.diplomaticArchive.sent.slice(0, 6)} emptyLabel="暂无发信记录" />
                    <BlackboxSubTitle title="最近收到" />
                    <MessageArchiveList items={blackbox.diplomaticArchive.received.slice(0, 6)} emptyLabel="暂无收信记录" />
                    <BlackboxSubTitle title="疑似协议证据" />
                    <div className="space-y-2 text-sm">
                      {blackbox.diplomaticArchive.suspectedAgreements.slice(0, 5).length ? (
                        blackbox.diplomaticArchive.suspectedAgreements.slice(0, 5).map((item, index) => (
                          <div key={`${item.year}-${item.phase}-${index}`} className="rounded-md border border-border/70 bg-background/40 p-3">
                            <div className="text-xs text-muted-foreground">
                              {item.year} · {item.phase} · {item.direction === 'outbound' ? '我方提出' : '对方提出'}
                            </div>
                            <div className="mt-1 text-foreground">{item.counterpartyName}</div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">{item.evidence}</div>
                          </div>
                        ))
                      ) : (
                        <EmptyText text="暂无可识别协议承诺" />
                      )}
                    </div>
                    <BlackboxSubTitle title="背叛文本证据" />
                    <div className="space-y-2 text-sm">
                      {blackbox.diplomaticArchive.betrayalEvidence.slice(0, 5).length ? (
                        blackbox.diplomaticArchive.betrayalEvidence.slice(0, 5).map((item, index) => (
                          <div key={`${item.year}-${item.phase}-${index}`} className="rounded-md border border-border/70 bg-background/40 p-3">
                            <div className="text-xs text-muted-foreground">
                              {item.year} · {item.phase} · {item.direction === 'against_us' ? '对方背刺我方' : '我方背刺对方'}
                            </div>
                            <div className="mt-1 text-foreground">
                              {item.actorName} → {item.targetName} @ {item.provinceName}
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyText text="暂无背叛记录" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-border/70 bg-secondary/10 p-4">
                    <div className="font-semibold text-primary">知行对齐报告</div>
                    <BlackboxSubTitle title="谁背叛了我们" />
                    <RelationEventList items={blackbox.alignmentReport.betrayedUs} emptyLabel="暂无记录" />
                    <BlackboxSubTitle title="我们背叛了谁" />
                    <RelationEventList items={blackbox.alignmentReport.weBetrayed} emptyLabel="暂无记录" />
                    <BlackboxSubTitle title="底层信任分" />
                    <div className="space-y-2">
                      {blackbox.alignmentReport.trustScores.slice(0, 6).map((row) => (
                        <div key={row.nationId} className="rounded-md border border-border/70 bg-background/40 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-foreground">{row.nationName}</div>
                            <div className="tabular text-primary">{row.trustScore} / 100</div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            关系：{row.softAllianceLevel} · 承诺 {row.commitments} · 协同 {row.militaryCooperation} · 对我背刺 {row.betrayalsAgainstUs}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-border/70 bg-secondary/10 p-4">
                  <div className="flex items-center gap-2">
                    <Waypoints className="h-4 w-4 text-primary" />
                    <div className="font-semibold text-primary">结构化决策回放</div>
                  </div>
                  <div className="rounded-md border border-dashed border-border/80 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                    {blackbox.decisionReplay.note}
                  </div>
                  <div className="space-y-3">
                    {blackbox.decisionReplay.entries.length ? (
                      blackbox.decisionReplay.entries.slice(0, 8).map((entry, index) => (
                        <div key={`${entry.timestamp}-${index}`} className="rounded-md border border-border/70 bg-background/40 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-medium text-foreground">{entry.phaseLabel}</div>
                            <Badge variant="outline" className="text-xs uppercase">
                              {entry.kind}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">{entry.summary}</div>

                          {entry.reasoningTrace.headline ||
                          entry.reasoningTrace.goal ||
                          entry.reasoningTrace.boardRead ||
                          entry.reasoningTrace.diplomaticRead ||
                          entry.reasoningTrace.decisionLogic ||
                          entry.reasoningTrace.risks.length ? (
                            <div className="mt-3 space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3">
                              <div className="text-xs uppercase tracking-[0.14em] text-primary">Inner Monologue</div>
                              {entry.reasoningTrace.headline ? (
                                <div className="text-sm font-medium text-foreground">{entry.reasoningTrace.headline}</div>
                              ) : null}
                              {entry.reasoningTrace.goal ? (
                                <div className="text-sm text-muted-foreground">目标：{entry.reasoningTrace.goal}</div>
                              ) : null}
                              {entry.reasoningTrace.boardRead ? (
                                <div className="text-sm text-muted-foreground">局势判断：{entry.reasoningTrace.boardRead}</div>
                              ) : null}
                              {entry.reasoningTrace.diplomaticRead ? (
                                <div className="text-sm text-muted-foreground">外交判断：{entry.reasoningTrace.diplomaticRead}</div>
                              ) : null}
                              {entry.reasoningTrace.risks.length ? (
                                <div className="text-sm text-muted-foreground">主要风险：{entry.reasoningTrace.risks.join('；')}</div>
                              ) : null}
                              {entry.reasoningTrace.decisionLogic ? (
                                <div className="text-sm text-muted-foreground">决策依据：{entry.reasoningTrace.decisionLogic}</div>
                              ) : null}
                            </div>
                          ) : null}

                          {entry.orderSummaries.length ? (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs uppercase tracking-[0.14em] text-primary">Orders</div>
                              {entry.orderSummaries.map((line, lineIndex) => (
                                <div key={lineIndex} className="rounded bg-secondary/30 px-2 py-1 text-sm text-foreground">
                                  {line}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {entry.messages.length ? (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs uppercase tracking-[0.14em] text-primary">Messages</div>
                              {entry.messages.map((message, messageIndex) => (
                                <div key={messageIndex} className="rounded bg-secondary/20 px-2 py-1 text-sm text-muted-foreground">
                                  {message.fromNation} → {message.toNation}: {message.content}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {entry.conflicts.length ? (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs uppercase tracking-[0.14em] text-primary">Conflicts</div>
                              {entry.conflicts.map((conflict, conflictIndex) => (
                                <div key={conflictIndex} className="rounded bg-secondary/20 px-2 py-2 text-sm text-muted-foreground">
                                  <div className="text-foreground">{conflict.provinceName} · {conflict.kind}</div>
                                  <div>参与方：{conflict.participantNames.join('、') || '未记录'}</div>
                                  <div>胜者：{conflict.winnerName || '未分胜负'}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {entry.logs.length ? (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs uppercase tracking-[0.14em] text-primary">Logs</div>
                              {entry.logs.map((line, lineIndex) => (
                                <div key={lineIndex} className="rounded bg-secondary/20 px-2 py-1 text-sm text-muted-foreground">
                                  {line}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <EmptyText text="当前还没有可回放的决策记录" />
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="flex flex-wrap gap-3">
              <Button onClick={handleSave} disabled={!canSave}>
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

const TextTrait: React.FC<{ label: string; value: string; onChange: (value: string) => void; disabled?: boolean }> = ({
  label,
  value,
  onChange,
  disabled,
}) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
  </div>
);

const SliderTrait: React.FC<{ label: string; value: number; onChange: (value: number) => void; disabled?: boolean }> = ({
  label,
  value,
  onChange,
  disabled,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <span className="tabular text-sm text-primary">{value}</span>
    </div>
    <Slider value={[value]} min={0} max={100} step={1} onValueChange={(values) => onChange(values[0])} disabled={disabled} />
  </div>
);

const BlackboxSubTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-xs uppercase tracking-[0.16em] text-primary">{title}</div>
);

const EmptyText: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-md border border-dashed border-border/80 bg-background/30 px-3 py-2 text-sm text-muted-foreground">
    {text}
  </div>
);

const MessageArchiveList: React.FC<{
  items: Array<{
    year: number;
    phase: string;
    fromName: string;
    toName: string;
    content: string;
  }>;
  emptyLabel: string;
}> = ({ items, emptyLabel }) => {
  if (!items.length) return <EmptyText text={emptyLabel} />;
  return (
    <div className="space-y-2 text-sm">
      {items.map((item, index) => (
        <div key={`${item.year}-${item.phase}-${index}`} className="rounded-md border border-border/70 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">
            {item.year} · {item.phase} · {item.fromName} → {item.toName}
          </div>
          <div className="mt-1 font-mono text-foreground">{item.content}</div>
        </div>
      ))}
    </div>
  );
};

const RelationEventList: React.FC<{ items: Array<Record<string, unknown>>; emptyLabel: string }> = ({ items, emptyLabel }) => {
  if (!items.length) return <EmptyText text={emptyLabel} />;
  return (
    <div className="space-y-2 text-sm">
      {items.map((item, index) => (
        <div key={index} className="rounded-md border border-border/70 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">
            {String(item.year || '')} · {String(item.phase || '')}
          </div>
          <div className="mt-1 text-foreground">
            {String(item.from_name || item.from || '')} → {String(item.to_name || item.to || '')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{String(item.province_name || item.province || '')}</div>
        </div>
      ))}
    </div>
  );
};

export default AgentSettingsPanel;
