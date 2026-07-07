import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Archive, Download, FileText, Package } from 'lucide-react';
import { useGame } from '@/game/GameContext';
import {
  GameState,
  HistoricalPhaseSnapshot,
  Nation,
  NATIONS,
  phaseAt,
  PROVINCE_MAP,
  Unit,
  mapViewBox,
} from '@/game/engine';
import { parseBattleReport } from '@/game/battleReports';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PhaseTarget = {
  id: string;
  year: number;
  phaseIndex: number;
  phaseLabel: string;
  isCurrent: boolean;
  reportId?: string;
};

type NationExportData = {
  nation: Nation;
  sc: number;
  territories: string[];
  units: Unit[];
  sentMessages: string[];
  receivedMessages: string[];
  battleMovements: string[];
  battleConflicts: string[];
  trustRows: string[];
  annualSummary?: string;
  diplomaticSentLogs: string[];
  diplomaticReceivedLogs: string[];
  publicStatementLogs: string[];
  suspectedAgreementLogs: string[];
  betrayalEvidenceLogs: string[];
  betrayedUsLogs: string[];
  weBetrayedLogs: string[];
  trustScoreRows: string[];
  memoryWhitelistRows: string[];
  memoryBlacklistRows: string[];
  blackboxEntries: Array<{
    timestamp: string;
    phaseLabel: string;
    kind: string;
    summary: string;
    orderSummaries: string[];
    logs: string[];
    reasoningTrace: {
      headline: string;
      goal: string;
      boardRead: string;
      diplomaticRead: string;
      risks: string[];
      decisionLogic: string;
    };
  }>;
  blackboxNote?: string;
  cotAvailable: boolean;
};

const MAP_VIEW = mapViewBox();

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1000);
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mapProvinceFill(ownership: Record<string, string | null>, provinceId: string) {
  const province = PROVINCE_MAP[provinceId];
  if (!province) return '#233246';
  if (province.type === 'sea') return '#0f2138';
  if (province.type === 'mountain') return '#273346';
  const owner = ownership[provinceId];
  if (!owner) return province.type === 'coast' ? '#314153' : '#233246';
  return NATIONS.find((nation) => nation.id === owner)?.color || '#233246';
}

function renderStrategicMapSvg(
  snapshotState: Pick<GameState, 'ownership' | 'units' | 'scCount'>,
  nations: Nation[],
  accentColor: string,
) {
  const nationColorById = Object.fromEntries(nations.map((nation) => [nation.id, nation.color]));

  const polygons = Object.values(PROVINCE_MAP)
    .map((province) => {
      const points = province.points.map(([x, y]) => `${x},${y}`).join(' ');
      const fill = mapProvinceFill(snapshotState.ownership, province.id);
      const baseStroke =
        province.type === 'sea' ? '#18304b' : province.type === 'mountain' ? '#7f8ea1' : '#0b1320';
      const strokeDash = province.type === 'coast' ? ' stroke-dasharray="8 7"' : '';
      const labelColor =
        province.type === 'sea' ? '#6f9bcf' : province.type === 'mountain' ? '#e3e8ef' : '#f4f8ff';
      const secondaryLabel =
        province.type === 'mountain'
          ? `<text x="${province.label[0]}" y="${province.label[1] + 16}" fill="#a1afc1" font-size="13" text-anchor="middle">不可进入</text>`
          : '';
      const scBadge = province.isSC
        ? `<g transform="translate(${province.label[0]}, ${province.label[1] + 20})">
            <circle r="11" fill="#0a1220" stroke="#f2b134" stroke-width="3" />
            <path d="M-2,-7 L7,-3 L1,1 L7,5 L-2,9 Z" fill="#f2b134" />
          </g>`
        : '';

      return `
        <g>
          <polygon
            points="${points}"
            fill="${fill}"
            fill-opacity="${province.type === 'sea' ? '0.92' : province.type === 'mountain' ? '0.95' : snapshotState.ownership[province.id] ? '0.88' : '0.56'}"
            stroke="${baseStroke}"
            stroke-width="${province.type === 'sea' ? '2.5' : province.type === 'mountain' ? '2.5' : '3'}"
            ${strokeDash}
          />
          <text
            x="${province.label[0]}"
            y="${province.label[1] - 10}"
            fill="${labelColor}"
            font-size="${province.type === 'sea' ? '18' : '20'}"
            font-weight="${province.type === 'sea' ? '600' : '700'}"
            text-anchor="middle"
          >${escapeHtml(province.name)}</text>
          ${secondaryLabel}
          ${scBadge}
        </g>
      `;
    })
    .join('');

  const units = snapshotState.units
    .map((unit) => {
      const province = PROVINCE_MAP[unit.location];
      if (!province) return '';
      const unitColor = nationColorById[unit.owner] || accentColor;
      const unitLabelX = province.label[0] - 26;
      const unitLabelY = province.label[1] + 6;
      return `
        <g>
          <rect x="${unitLabelX - 12}" y="${unitLabelY - 16}" width="24" height="22" rx="6" fill="${unitColor}" stroke="#0a1220" stroke-width="2" />
          <text x="${unitLabelX}" y="${unitLabelY}" fill="#0b1320" font-size="16" font-weight="800" text-anchor="middle">${unit.type === 'Army' ? 'A' : 'F'}</text>
        </g>
      `;
    })
    .join('');

  return `
    <div class="map-card">
      <div class="map-card-title">当前局势图</div>
      <svg viewBox="${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.width} ${MAP_VIEW.height}" class="strategic-map" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="map-export-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#142236" />
            <stop offset="100%" stop-color="#0a1019" />
          </linearGradient>
        </defs>
        <rect x="${MAP_VIEW.x}" y="${MAP_VIEW.y}" width="${MAP_VIEW.width}" height="${MAP_VIEW.height}" fill="url(#map-export-bg)" rx="24" />
        ${polygons}
        ${units}
      </svg>
    </div>
  `;
}

function territoryNames(ownership: Record<string, string | null>, nationId: string) {
  return Object.entries(ownership)
    .filter(([provinceId, owner]) => {
      const province = PROVINCE_MAP[provinceId];
      return owner === nationId && province && province.type !== 'sea' && province.type !== 'mountain';
    })
    .map(([provinceId]) => PROVINCE_MAP[provinceId]?.name || provinceId)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function buildPhaseTargets(state: GameState): PhaseTarget[] {
  const current = {
    id: `current-${state.year}-${state.phaseIndex}`,
    year: state.year,
    phaseIndex: state.phaseIndex,
    phaseLabel: phaseAt(state.phaseIndex).label,
    isCurrent: true,
  };

  const historical = [...state.phaseSnapshots]
    .sort((a, b) => b.year - a.year || b.phaseIndex - a.phaseIndex)
    .map((snapshot) => ({
      id: `snapshot-${snapshot.reportId}`,
      year: snapshot.year,
      phaseIndex: snapshot.phaseIndex,
      phaseLabel: snapshot.phaseLabel,
      isCurrent: false,
      reportId: snapshot.reportId,
    }));

  return [current, ...historical];
}

function collectNationExportData(
  nation: Nation,
  state: GameState,
  phaseTarget: PhaseTarget,
  phaseMessages: GameState['messages'],
  phaseReports: GameState['reports'],
  snapshotState: Pick<GameState, 'ownership' | 'units' | 'scCount'>,
): NationExportData {
  const parsedReports = phaseReports.map((report) => parseBattleReport(report));
  const blackbox = state.blackbox[nation.id];
  const isYearReviewPhase = phaseTarget.phaseIndex === 5;
  const units = snapshotState.units.filter((unit) => unit.owner === nation.id);
  const territories = territoryNames(snapshotState.ownership, nation.id);
  const sentMessages = phaseMessages
    .filter((message) => message.from === nation.id)
    .map((message) => `→ ${message.channel}: ${message.text}`);
  const receivedMessages = phaseMessages
    .filter((message) => message.to === nation.id && message.from !== nation.id)
    .map((message) => `→ ${message.channel}: ${message.text}`);
  const battleMovements = parsedReports.flatMap((report) =>
    report.movements.filter((entry) => entry.startsWith(`${nation.name} `)),
  );
  const battleConflicts = parsedReports.flatMap((report) =>
    report.conflicts
      .filter((conflict) => conflict.participants.includes(nation.name))
      .map((conflict) => {
        const attackers = conflict.attackers.length > 0 ? conflict.attackers.join('、') : '无';
        const defenders = conflict.defenders.length > 0 ? conflict.defenders.join('、') : '无（中立或空地）';
        const winner = conflict.winner || '未分胜负';
        return `${conflict.provinceName}｜状态：${conflict.kind}｜进攻方：${attackers}｜防守方：${defenders}｜胜者：${winner}`;
      }),
  );
  const trustRows = state.nations
    .filter((other) => other.id !== nation.id)
    .map((other) => `${other.name}：${state.trust[`${nation.id}->${other.id}`] ?? 50}`);
  const annualSummary = state.history.find((item) => item.year === phaseTarget.year)?.summary;
  const diplomaticSentLogs = (blackbox?.diplomaticArchive.sent || [])
    .filter((item) => (isYearReviewPhase ? item.year === phaseTarget.year : item.year === phaseTarget.year && item.phase === phaseTarget.phaseLabel))
    .map((item) => `${item.fromName} -> ${item.toName}: ${item.content}`);
  const diplomaticReceivedLogs = (blackbox?.diplomaticArchive.received || [])
    .filter((item) => (isYearReviewPhase ? item.year === phaseTarget.year : item.year === phaseTarget.year && item.phase === phaseTarget.phaseLabel))
    .map((item) => `${item.fromName} -> ${item.toName}: ${item.content}`);
  const publicStatementLogs = (blackbox?.diplomaticArchive.publicStatements || [])
    .filter((item) => (isYearReviewPhase ? item.year === phaseTarget.year : item.year === phaseTarget.year && item.phase === phaseTarget.phaseLabel))
    .map((item) => `${item.fromName}: ${item.content}`);
  const suspectedAgreementLogs = (blackbox?.diplomaticArchive.suspectedAgreements || [])
    .filter((item) => (isYearReviewPhase ? item.year === phaseTarget.year : item.year === phaseTarget.year && item.phase === phaseTarget.phaseLabel))
    .map(
      (item) =>
        `${item.direction === 'outbound' ? '我方提出' : '对方提出'} | 对象: ${item.counterpartyName} | 证据: ${item.evidence}`,
    );
  const betrayalEvidenceLogs = (blackbox?.diplomaticArchive.betrayalEvidence || [])
    .filter((item) => (isYearReviewPhase ? Number(item.year) === phaseTarget.year : Number(item.year) === phaseTarget.year && item.phase === phaseTarget.phaseLabel))
    .map(
      (item) =>
        `${item.direction === 'against_us' ? '对我方背叛' : '我方背叛他国'} | ${item.actorName} -> ${item.targetName} | ${item.provinceName}`,
    );
  const betrayedUsLogs = (blackbox?.alignmentReport.betrayedUs || []).map((item) => JSON.stringify(item));
  const weBetrayedLogs = (blackbox?.alignmentReport.weBetrayed || []).map((item) => JSON.stringify(item));
  const trustScoreRows = (blackbox?.alignmentReport.trustScores || []).map(
    (row) =>
      `${row.nationName}: 信任 ${row.trustScore}, 软联盟 ${row.softAllianceLevel}, 承诺 ${row.commitments}, 军事协作 ${row.militaryCooperation}, 对我背叛 ${row.betrayalsAgainstUs}, 我方背叛 ${row.outboundBetrayals}`,
  );
  const memoryWhitelistRows = (blackbox?.alignmentReport.memoryWhitelist || []).map((item) => JSON.stringify(item));
  const memoryBlacklistRows = (blackbox?.alignmentReport.memoryBlacklist || []).map((item) => JSON.stringify(item));
  const blackboxEntries = (blackbox?.decisionReplay.entries || [])
    .filter((entry) => (isYearReviewPhase ? entry.phaseLabel.includes(String(phaseTarget.year)) : entry.phaseLabel === phaseTarget.phaseLabel))
    .map((entry) => ({
      timestamp: entry.timestamp,
      phaseLabel: entry.phaseLabel,
      kind: entry.kind,
      summary: entry.summary,
      orderSummaries: entry.orderSummaries || [],
      logs: entry.logs || [],
      reasoningTrace: {
        headline: entry.reasoningTrace?.headline || '',
        goal: entry.reasoningTrace?.goal || '',
        boardRead: entry.reasoningTrace?.boardRead || '',
        diplomaticRead: entry.reasoningTrace?.diplomaticRead || '',
        risks: entry.reasoningTrace?.risks || [],
        decisionLogic: entry.reasoningTrace?.decisionLogic || '',
      },
    }));

  return {
    nation,
    sc: snapshotState.scCount[nation.id] ?? 0,
    territories,
    units,
    sentMessages,
    receivedMessages,
    battleMovements,
    battleConflicts,
    trustRows,
    annualSummary,
    diplomaticSentLogs,
    diplomaticReceivedLogs,
    publicStatementLogs,
    suspectedAgreementLogs,
    betrayalEvidenceLogs,
    betrayedUsLogs,
    weBetrayedLogs,
    trustScoreRows,
    memoryWhitelistRows,
    memoryBlacklistRows,
    blackboxEntries,
    blackboxNote: blackbox?.decisionReplay.note,
    cotAvailable: blackbox?.decisionReplay.cotAvailable ?? false,
  };
}

function renderList(items: string[]) {
  if (items.length === 0) {
    return '<li>无</li>';
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderBlockText(text: string) {
  return `<pre>${escapeHtml(text || '无')}</pre>`;
}

function renderBlackboxSection(data: NationExportData) {
  if (!data.cotAvailable && data.blackboxEntries.length === 0) {
    return `
      <div class="card">
        <h3>黑匣子决策回放</h3>
        <div class="empty-state">当前没有可导出的决策回放或内心独白数据。</div>
      </div>
    `;
  }

  const entries =
    data.blackboxEntries.length > 0
      ? data.blackboxEntries
          .map((entry) => {
            const risks = entry.reasoningTrace.risks.length > 0 ? entry.reasoningTrace.risks : ['无'];
            return `
              <article class="replay-entry">
                <div class="replay-meta">
                  <span class="replay-chip">${escapeHtml(entry.phaseLabel || '未知阶段')}</span>
                  <span>${escapeHtml(entry.kind || 'decision')}</span>
                  <span>${escapeHtml(entry.timestamp || '')}</span>
                </div>
                <h4>${escapeHtml(entry.summary || '无摘要')}</h4>
                <div class="grid two compact">
                  <div class="subcard">
                    <strong>内心独白</strong>
                    <ul class="detail-list">
                      <li><span>核心判断</span>${escapeHtml(entry.reasoningTrace.headline || '无')}</li>
                      <li><span>目标</span>${escapeHtml(entry.reasoningTrace.goal || '无')}</li>
                      <li><span>局势阅读</span>${escapeHtml(entry.reasoningTrace.boardRead || '无')}</li>
                      <li><span>外交判断</span>${escapeHtml(entry.reasoningTrace.diplomaticRead || '无')}</li>
                      <li><span>决策逻辑</span>${escapeHtml(entry.reasoningTrace.decisionLogic || '无')}</li>
                    </ul>
                  </div>
                  <div class="subcard">
                    <strong>风险与执行</strong>
                    <div class="subsection">
                      <div class="mini-title">风险</div>
                      <ul>${renderList(risks)}</ul>
                    </div>
                    <div class="subsection">
                      <div class="mini-title">命令摘要</div>
                      <ul>${renderList(entry.orderSummaries)}</ul>
                    </div>
                    <div class="subsection">
                      <div class="mini-title">运行日志</div>
                      <ul>${renderList(entry.logs)}</ul>
                    </div>
                  </div>
                </div>
              </article>
            `;
          })
          .join('')
      : `<div class="empty-state">该阶段尚无可用内心独白记录。旧局数据可能产生于功能开启之前。</div>`;

  return `
    <div class="card">
      <h3>黑匣子决策回放</h3>
      ${data.blackboxNote ? `<p class="section-note">${escapeHtml(data.blackboxNote)}</p>` : ''}
      ${entries}
    </div>
  `;
}

function renderBlackboxExportSection(data: NationExportData) {
  if (!data.cotAvailable && data.blackboxEntries.length === 0) {
    return `
      <div class="card">
        <h3>黑匣子决策回放</h3>
        <div class="empty-state">当前没有可导出的决策回放或内心独白数据。</div>
      </div>
    `;
  }

  const entries =
    data.blackboxEntries.length > 0
      ? data.blackboxEntries
          .map((entry) => {
            const risks = entry.reasoningTrace.risks.length > 0 ? entry.reasoningTrace.risks : ['无'];
            return `
              <article class="replay-entry">
                <div class="replay-meta">
                  <span class="replay-chip">${escapeHtml(entry.phaseLabel || '未知阶段')}</span>
                  <span>${escapeHtml(entry.kind || 'decision')}</span>
                  <span>${escapeHtml(entry.timestamp || '')}</span>
                </div>
                <h4>${escapeHtml(entry.summary || '无摘要')}</h4>
                <div class="grid two compact">
                  <div class="subcard">
                    <strong>内心独白</strong>
                    <ul class="detail-list">
                      <li><span>核心判断</span>${escapeHtml(entry.reasoningTrace.headline || '无')}</li>
                      <li><span>目标</span>${escapeHtml(entry.reasoningTrace.goal || '无')}</li>
                      <li><span>局势阅读</span>${escapeHtml(entry.reasoningTrace.boardRead || '无')}</li>
                      <li><span>外交判断</span>${escapeHtml(entry.reasoningTrace.diplomaticRead || '无')}</li>
                      <li><span>决策逻辑</span>${escapeHtml(entry.reasoningTrace.decisionLogic || '无')}</li>
                    </ul>
                  </div>
                  <div class="subcard">
                    <strong>风险与执行</strong>
                    <div class="subsection">
                      <div class="mini-title">风险</div>
                      <ul>${renderList(risks)}</ul>
                    </div>
                    <div class="subsection">
                      <div class="mini-title">命令摘要</div>
                      <ul>${renderList(entry.orderSummaries)}</ul>
                    </div>
                    <div class="subsection">
                      <div class="mini-title">运行日志</div>
                      <ul>${renderList(entry.logs)}</ul>
                    </div>
                  </div>
                </div>
              </article>
            `;
          })
          .join('')
      : `<div class="empty-state">该阶段尚无可用内心独白记录。旧局数据可能产生于功能开启之前。</div>`;

  return `
    <div class="card">
      <h3>黑匣子决策回放</h3>
      ${data.blackboxNote ? `<p class="section-note">${escapeHtml(data.blackboxNote)}</p>` : ''}
      ${entries}
    </div>
  `;
}

function renderBlackboxDiplomacySection(data: NationExportData) {
  return `
    <div class="card">
      <h3>外交日志密档</h3>
      <div class="grid two compact">
        <div class="subcard">
          <strong>我方发信</strong>
          <ul>${renderList(data.diplomaticSentLogs)}</ul>
        </div>
        <div class="subcard">
          <strong>我方收信</strong>
          <ul>${renderList(data.diplomaticReceivedLogs)}</ul>
        </div>
      </div>
      <div class="grid two compact">
        <div class="subcard">
          <strong>公开发言</strong>
          <ul>${renderList(data.publicStatementLogs)}</ul>
        </div>
        <div class="subcard">
          <strong>疑似协议与背叛证据</strong>
          <div class="subsection">
            <div class="mini-title">疑似协议</div>
            <ul>${renderList(data.suspectedAgreementLogs)}</ul>
          </div>
          <div class="subsection">
            <div class="mini-title">背叛证据</div>
            <ul>${renderList(data.betrayalEvidenceLogs)}</ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBlackboxAlignmentSection(data: NationExportData) {
  return `
    <div class="card">
      <h3>知行对齐报告</h3>
      <div class="grid two compact">
        <div class="subcard">
          <strong>谁背叛了我们</strong>
          <ul>${renderList(data.betrayedUsLogs)}</ul>
        </div>
        <div class="subcard">
          <strong>我们背叛了谁</strong>
          <ul>${renderList(data.weBetrayedLogs)}</ul>
        </div>
      </div>
      <div class="grid two compact">
        <div class="subcard">
          <strong>底层信任账本</strong>
          <ul>${renderList(data.trustScoreRows)}</ul>
        </div>
        <div class="subcard">
          <strong>持久记忆写回</strong>
          <div class="subsection">
            <div class="mini-title">信誉白名单</div>
            <ul>${renderList(data.memoryWhitelistRows)}</ul>
          </div>
          <div class="subsection">
            <div class="mini-title">血仇黑名单</div>
            <ul>${renderList(data.memoryBlacklistRows)}</ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildNationSection(
  data: NationExportData,
  phaseTarget: PhaseTarget,
  snapshotState: Pick<GameState, 'ownership' | 'units' | 'scCount'>,
  nations: Nation[],
) {
  const { nation } = data;
  return `
    <section class="nation-section" style="--accent:${nation.color};--accent-soft:${hexToRgba(nation.color, 0.12)};--accent-border:${hexToRgba(nation.color, 0.32)};">
      <header class="nation-header">
        <div>
          <div class="nation-tag">${escapeHtml(String(phaseTarget.year))} · ${escapeHtml(phaseTarget.phaseLabel)}</div>
          <h2>${escapeHtml(nation.name)}</h2>
          <p>${escapeHtml(nation.traits.temperament)} / ${escapeHtml(nation.traits.diplomacy)}</p>
        </div>
        <div class="nation-sc">${data.sc} SC</div>
      </header>

      ${renderStrategicMapSvg(snapshotState, nations, nation.color)}

      <div class="grid two">
        <div class="card">
          <h3>局势概览</h3>
          <ul>
            <li>领地数：${data.territories.length}</li>
            <li>单位数：${data.units.length}</li>
          </ul>
        </div>
        <div class="card">
          <h3>单位分布</h3>
          <ul>${renderList(data.units.map((unit) => `${unit.type} · ${PROVINCE_MAP[unit.location]?.name || unit.location}`))}</ul>
        </div>
      </div>

      <div class="card">
        <h3>当前控制领地</h3>
        <ul>${renderList(data.territories)}</ul>
      </div>

      <div class="grid two">
        <div class="card">
          <h3>本阶段发出密信</h3>
          <ul>${renderList(data.sentMessages)}</ul>
        </div>
        <div class="card">
          <h3>本阶段收到密信</h3>
          <ul>${renderList(data.receivedMessages)}</ul>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3>本阶段军事行动</h3>
          <ul>${renderList(data.battleMovements)}</ul>
        </div>
        <div class="card">
          <h3>本阶段交战记录</h3>
          <ul>${renderList(data.battleConflicts)}</ul>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3>当前持久档案</h3>
          <div class="subcard">
            <strong>System Prompt</strong>
            ${renderBlockText(nation.systemPrompt)}
          </div>
          <div class="subcard">
            <strong>Skills</strong>
            ${renderBlockText(nation.skills)}
          </div>
          <div class="subcard">
            <strong>Memory</strong>
            ${renderBlockText(nation.memory)}
          </div>
          <div class="subcard">
            <strong>本年年度建议</strong>
            ${renderBlockText(nation.yearlyAdvice)}
          </div>
        </div>
        <div class="card">
          <h3>当前对外信任值</h3>
          <ul>${renderList(data.trustRows)}</ul>
          <h3 style="margin-top:20px;">年度总结</h3>
          ${renderBlockText(data.annualSummary || '该年份暂无年度总结，或当前筛选尚未走到年终复盘。')}
        </div>
      </div>
      ${renderBlackboxDiplomacySection(data)}
      ${renderBlackboxAlignmentSection(data)}
      ${renderBlackboxExportSection(data)}
    </section>
  `;
}

function buildHtmlDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1220;
      --panel: #101826;
      --card: #162131;
      --line: #273246;
      --text: #edf2ff;
      --muted: #9fb0cf;
      --gold: #f5b63a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(245, 182, 58, 0.08), transparent 24%),
        linear-gradient(180deg, #0b1220, #0f1725);
      color: var(--text);
    }
    .page {
      width: min(1280px, calc(100vw - 40px));
      margin: 24px auto 56px;
    }
    .hero, .nation-section {
      background: rgba(16, 24, 38, 0.92);
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 24px;
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
    }
    .hero { margin-bottom: 18px; }
    .hero h1 {
      margin: 0 0 8px;
      font-size: 34px;
      line-height: 1.1;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
    }
    .nation-section {
      margin-top: 18px;
      border-color: var(--accent-border);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(255,255,255,0.02);
    }
    .nation-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--accent-border);
      margin-bottom: 18px;
    }
    .nation-header h2 {
      margin: 6px 0;
      font-size: 28px;
    }
    .nation-header p {
      margin: 0;
      color: var(--muted);
    }
    .nation-tag {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--accent-border);
      background: var(--accent-soft);
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      color: var(--gold);
    }
    .nation-sc {
      font-size: 28px;
      font-weight: 700;
      color: var(--accent);
      white-space: nowrap;
    }
    .grid {
      display: grid;
      gap: 16px;
      margin-top: 16px;
    }
    .grid.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .map-card {
      margin-top: 18px;
      padding: 16px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(10, 16, 25, 0.96), rgba(14, 22, 34, 0.98));
      border: 1px solid var(--accent-border);
    }
    .map-card-title {
      margin-bottom: 12px;
      color: var(--gold);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .strategic-map {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      overflow: hidden;
    }
    .card, .subcard {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
    }
    .subcard + .subcard { margin-top: 12px; }
    .card h3 {
      margin: 0 0 12px;
      font-size: 16px;
    }
    .card h4 {
      margin: 0 0 12px;
      font-size: 18px;
    }
    .compact { margin-top: 12px; }
    ul {
      margin: 0;
      padding-left: 18px;
      line-height: 1.75;
      color: var(--muted);
    }
    pre {
      margin: 8px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--muted);
      font-family: inherit;
      line-height: 1.7;
    }
    .section-note {
      margin: 0 0 12px;
      color: var(--muted);
      line-height: 1.7;
    }
    .empty-state {
      color: var(--muted);
      line-height: 1.7;
      padding: 12px 0;
    }
    .replay-entry {
      padding: 16px;
      border-radius: 14px;
      border: 1px solid var(--accent-border);
      background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.08));
    }
    .replay-entry + .replay-entry { margin-top: 14px; }
    .replay-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .replay-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid var(--accent-border);
      background: var(--accent-soft);
      color: var(--gold);
      font-weight: 700;
    }
    .detail-list {
      list-style: none;
      padding-left: 0;
      margin: 10px 0 0;
    }
    .detail-list li {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: 8px;
      padding: 6px 0;
      color: var(--muted);
      line-height: 1.7;
    }
    .detail-list span {
      color: var(--text);
      font-weight: 700;
    }
    .subsection + .subsection { margin-top: 12px; }
    .mini-title {
      margin-bottom: 6px;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
    }
    .note {
      margin-top: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.7;
    }
    @media (max-width: 900px) {
      .page { width: min(100vw - 20px, 100%); margin: 12px auto 28px; }
      .grid.two { grid-template-columns: 1fr; }
      .nation-header { flex-direction: column; }
      .nation-sc { font-size: 24px; }
      .hero h1, .nation-header h2 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <main class="page">${body}</main>
</body>
</html>`;
}

const DataPage: React.FC = () => {
  const { state } = useGame();
  const phaseTargets = useMemo(() => buildPhaseTargets(state), [state]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>(phaseTargets[0]?.id || '');

  useEffect(() => {
    if (!phaseTargets.some((target) => target.id === selectedPhaseId)) {
      setSelectedPhaseId(phaseTargets[0]?.id || '');
    }
  }, [phaseTargets, selectedPhaseId]);

  const selectedPhase = useMemo(
    () => phaseTargets.find((target) => target.id === selectedPhaseId) || phaseTargets[0] || null,
    [phaseTargets, selectedPhaseId],
  );

  const selectedSnapshot = useMemo<HistoricalPhaseSnapshot | null>(() => {
    if (!selectedPhase || selectedPhase.isCurrent || !selectedPhase.reportId) {
      return null;
    }
    return state.phaseSnapshots.find((snapshot) => snapshot.reportId === selectedPhase.reportId) || null;
  }, [selectedPhase, state.phaseSnapshots]);

  const snapshotState = useMemo<Pick<GameState, 'ownership' | 'units' | 'scCount'>>(() => {
    if (selectedSnapshot) {
      return {
        ownership: selectedSnapshot.ownership,
        units: selectedSnapshot.units,
        scCount: selectedSnapshot.scCount,
      };
    }
    return {
      ownership: state.ownership,
      units: state.units,
      scCount: state.scCount,
    };
  }, [selectedSnapshot, state.ownership, state.scCount, state.units]);

  const phaseMessages = useMemo(() => {
    if (!selectedPhase) return [];
    return state.messages.filter(
      (message) => message.year === selectedPhase.year && message.phaseLabel === selectedPhase.phaseLabel,
    );
  }, [selectedPhase, state.messages]);

  const phaseReports = useMemo(() => {
    if (!selectedPhase) return [];
    if (selectedPhase.reportId) {
      return state.reports.filter((report) => report.id === selectedPhase.reportId);
    }
    return state.reports.filter(
      (report) => report.year === selectedPhase.year && report.phaseLabel === selectedPhase.phaseLabel,
    );
  }, [selectedPhase, state.reports]);

  const nationExports = useMemo(() => {
    if (!selectedPhase) return [];
    return state.nations.map((nation) =>
      collectNationExportData(nation, state, selectedPhase, phaseMessages, phaseReports, snapshotState),
    );
  }, [phaseMessages, phaseReports, selectedPhase, snapshotState, state]);

  const selectedLabel = selectedPhase ? `${selectedPhase.year} · ${selectedPhase.phaseLabel}` : '当前阶段';

  const handleRawJsonExport = () => {
    const payload = JSON.stringify(
      {
        phase: selectedPhase,
        snapshotState,
        messages: phaseMessages,
        reports: phaseReports,
        nations: nationExports,
      },
      null,
      2,
    );
    downloadText(payload, `agent-diplomacy-${selectedLabel.replace(/\s+/g, '-')}.json`, 'application/json');
    toast.success('已导出当前筛选结果 JSON');
  };

  const buildNationPage = (data: NationExportData) =>
    buildHtmlDocument(
      `${data.nation.name} - ${selectedLabel}`,
      `
        <section class="hero">
          <h1>${escapeHtml(data.nation.name)} 档案导出</h1>
          <p>导出时间对应阶段：${escapeHtml(selectedLabel)}。地图、密信、军事行动、交战记录均来自当前后端状态；智能体档案展示的是数据库中保留的持久版本。</p>
        </section>
        ${buildNationSection(data, selectedPhase!, snapshotState, state.nations)}
        <div class="note">说明：历史阶段的地图、单位、SC 取自阶段快照；System Prompt / Skills / Memory / 年度建议取自当前数据库持久档案。</div>
      `,
    );

  const buildBatchPage = () =>
    buildHtmlDocument(
      `十排总览导出 - ${selectedLabel}`,
      `
        <section class="hero">
          <h1>十排总览导出</h1>
          <p>筛选阶段：${escapeHtml(selectedLabel)}。本页面汇总十个排在该阶段的地图数据、外交消息、战斗结果与当前智能体持久档案。</p>
        </section>
        ${nationExports
          .map((item) => buildNationSection(item, selectedPhase!, snapshotState, state.nations))
          .join('')}
      `,
    );

  const handleDownloadAllNationPages = () => {
    nationExports.forEach((item, index) => {
      window.setTimeout(() => {
        downloadText(
          buildNationPage(item),
          `agent-diplomacy-${item.nation.short}-${selectedLabel.replace(/\s+/g, '-')}.html`,
          'text/html;charset=utf-8',
        );
      }, index * 140);
    });
    toast.success(`已开始下载 ${nationExports.length} 个排的独立 HTML`);
  };

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-6 pb-10">
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
              <Archive className="h-5 w-5 text-primary" />
              历史数据导出
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              可以按年份与阶段筛选十个排的数据，默认展示最新阶段。支持单独下载某个排的 HTML，也支持一键下载十个排的独立 HTML 或总览 HTML。
            </p>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
              <div>
                <div className="mb-2 text-sm text-muted-foreground">筛选阶段</div>
                <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择阶段" />
                  </SelectTrigger>
                  <SelectContent>
                    {phaseTargets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.year} · {target.phaseLabel}
                        {target.isCurrent ? '（最新）' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="bg-transparent hover:bg-secondary"
                onClick={handleDownloadAllNationPages}
              >
                <Download className="mr-1.5 h-4 w-4" />
                一键下载十个排 HTML
              </Button>

              <Button
                variant="outline"
                className="bg-transparent hover:bg-secondary"
                onClick={() => {
                  downloadText(
                    buildBatchPage(),
                    `agent-diplomacy-batch-${selectedLabel.replace(/\s+/g, '-')}.html`,
                    'text/html;charset=utf-8',
                  );
                  toast.success('已导出批量 HTML 页面');
                }}
              >
                <Package className="mr-1.5 h-4 w-4" />
                下载总览 HTML
              </Button>

              <Button variant="outline" className="bg-transparent hover:bg-secondary" onClick={handleRawJsonExport}>
                <Download className="mr-1.5 h-4 w-4" />
                下载筛选 JSON
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <FileText className="h-5 w-5 text-primary" />
              十排导出列表
            </h2>
            <ScrollArea className="h-[50vh] min-h-[420px] rounded-md border border-border/70 bg-background/30 pr-4">
              <div className="space-y-4 p-3">
                {nationExports.map((item) => (
                  <div key={item.nation.id} className="rounded-xl border border-border bg-card/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <span className="h-3.5 w-3.5 rounded-sm" style={{ background: item.nation.color }} />
                          {item.nation.name}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {selectedLabel} · {item.sc} SC · {item.territories.length} 领地 · {item.units.length} 单位
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          downloadText(
                            buildNationPage(item),
                            `agent-diplomacy-${item.nation.id}-${selectedLabel.replace(/\s+/g, '-')}.html`,
                            'text/html;charset=utf-8',
                          );
                          toast.success(`已导出 ${item.nation.name} HTML 页面`);
                        }}
                      >
                        <Download className="mr-1.5 h-4 w-4" />
                        下载该排 HTML
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                        <div className="mb-2 text-sm font-medium text-foreground">控制领地</div>
                        <div className="text-sm text-muted-foreground">
                          {item.territories.length > 0 ? item.territories.join('、') : '无'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                        <div className="mb-2 text-sm font-medium text-foreground">本阶段发出密信</div>
                        <div className="text-sm text-muted-foreground">
                          {item.sentMessages.length > 0 ? item.sentMessages.slice(0, 2).join('；') : '无'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                        <div className="mb-2 text-sm font-medium text-foreground">本阶段交战记录</div>
                        <div className="text-sm text-muted-foreground">
                          {item.battleConflicts.length > 0 ? item.battleConflicts.slice(0, 2).join('；') : '无'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>
        </div>
      </div>
    </AppShell>
  );
};

export default DataPage;
