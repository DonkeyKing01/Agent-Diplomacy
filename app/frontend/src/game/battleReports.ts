import { BattleReportItem, PROVINCE_MAP } from './engine';

export type ReportProvinceHighlightKind = 'capture' | 'contest' | 'defense' | 'retreat';

export interface ParsedConflict {
  provinceId: string | null;
  provinceName: string;
  kind: string;
  winner?: string;
  participants: string[];
  attackers: string[];
  defenders: string[];
  explanation: string;
}

export interface ParsedBattleReport {
  id: string;
  year: number;
  phaseLabel: string;
  headline: string;
  summary: string;
  movements: string[];
  conflicts: ParsedConflict[];
  retreats: string[];
  winterAdjustments: string[];
  supplyCenters: { nationName: string; value: number }[];
}

export interface ReportProvinceHighlight {
  provinceId: string;
  provinceName: string;
  kind: ReportProvinceHighlightKind;
  label: string;
  detail: string;
}

function splitEntries(text: string): string[] {
  const entries: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of text) {
    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ')') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === ';' && depth === 0) {
      const value = current.trim();
      if (value) {
        entries.push(value);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    entries.push(tail);
  }

  return entries;
}

function resolveProvinceIdByName(name: string): string | null {
  const found = Object.values(PROVINCE_MAP).find((province) => province.name === name);
  return found?.id || null;
}

function parseSupplyCenters(line: string): { nationName: string; value: number }[] {
  return splitEntries(line).map((entry) => {
    const match = entry.match(/^(.*)\s+(\d+)$/);
    if (!match) {
      return { nationName: entry, value: 0 };
    }
    return { nationName: match[1].trim(), value: Number(match[2]) };
  });
}

function movementNationAndTarget(entry: string): { nationName: string; targetProvince: string } | null {
  const match = entry.match(/^(.*?)\s+(.+?)\s*->\s*(.+)$/);
  if (!match) return null;
  return {
    nationName: match[1].trim(),
    targetProvince: match[3].trim(),
  };
}

function attackersForProvince(provinceName: string, movements: string[]): string[] {
  const attackers = new Set<string>();

  for (const movement of movements) {
    const resolved = movementNationAndTarget(movement);
    if (!resolved) continue;
    if (resolved.targetProvince === provinceName) {
      attackers.add(resolved.nationName);
    }
  }

  return [...attackers];
}

function participantsFromConflictMeta(rest: string): string[] {
  const match = rest.match(/participants:\s*([^)]+)/i);
  if (!match) return [];
  return match[1]
    .split('|')[0]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function rawKind(rest: string) {
  return rest.replace(/\(.*?\)/i, '').trim();
}

function kindIncludes(kind: string, variants: string[]) {
  return variants.some((variant) => kind.includes(variant));
}

function classifyConflictKind(kind: string): ReportProvinceHighlightKind {
  if (kindIncludes(kind, ['占领变化', '进攻', '鍗犻鍙樺寲', '杩涙敾'])) return 'capture';
  if (kindIncludes(kind, ['防守', '闃插畧'])) return 'defense';
  if (kindIncludes(kind, ['撤退', '鎾ら€€'])) return 'retreat';
  return 'contest';
}

function conflictDisplayLabel(kind: string): string {
  const classified = classifyConflictKind(kind);
  if (classified === 'capture') return '占';
  if (classified === 'defense') return '守';
  if (classified === 'retreat') return '退';
  return '争';
}

function conflictDisplayName(kind: string): string {
  const classified = classifyConflictKind(kind);
  if (classified === 'capture') return '占领成功';
  if (classified === 'defense') return '守住';
  if (classified === 'retreat') return '撤退';
  return '争夺未果';
}

function explainConflict(kind: string, winner?: string): string {
  const classified = classifyConflictKind(kind);
  if (classified === 'capture') {
    return winner ? `${winner} 成功夺取了这块地区。` : '这块地区发生了占领变化。';
  }
  if (classified === 'defense') {
    return winner ? `${winner} 顶住了进攻，最终守住了这里。` : '原有控制方守住了这块地区。';
  }
  if (classified === 'retreat') {
    return '该地区涉及撤退处理。';
  }
  return '多方都试图进入该地区，但结算后无人成功拿下。';
}

function parseConflicts(line: string, movements: string[]): ParsedConflict[] {
  return splitEntries(line).map((entry) => {
    const separatorIndex = entry.indexOf(':');
    const provincePart = separatorIndex >= 0 ? entry.slice(0, separatorIndex) : entry;
    const rest = separatorIndex >= 0 ? entry.slice(separatorIndex + 1) : '';
    const provinceName = provincePart.trim();
    const winnerMatch = rest.match(/winner:\s*([^\)|;]+)/i);
    const winner = winnerMatch?.[1]?.trim();
    const kind = rawKind(rest);
    const attackers = attackersForProvince(provinceName, movements);
    const participants = [...participantsFromConflictMeta(rest), ...attackers];
    if (winner) {
      participants.unshift(winner);
    }
    const uniqueParticipants = [...new Set(participants)].filter(Boolean);
    const defenders = uniqueParticipants.filter((participant) => !attackers.includes(participant));

    return {
      provinceId: resolveProvinceIdByName(provinceName),
      provinceName,
      kind,
      winner,
      participants: uniqueParticipants,
      attackers,
      defenders,
      explanation: explainConflict(kind, winner),
    };
  });
}

export function parseBattleReport(report: BattleReportItem): ParsedBattleReport {
  const lines = report.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const filteredLines = lines.filter(
    (line, index) => !(index < 2 && (line === report.phaseLabel || line === report.phaseLabel.replace(/\s+/g, ' '))),
  );

  const parsed: ParsedBattleReport = {
    id: report.id,
    year: report.year,
    phaseLabel: report.phaseLabel,
    headline: report.phaseLabel,
    summary: '',
    movements: [],
    conflicts: [],
    retreats: [],
    winterAdjustments: [],
    supplyCenters: [],
  };

  for (const line of filteredLines) {
    if (line.endsWith('resolved.')) {
      parsed.summary = line.replace(/\s*resolved\.$/, '').trim();
      continue;
    }
    if (line.startsWith('Movements:')) {
      parsed.movements = splitEntries(line.slice('Movements:'.length));
      continue;
    }
    if (line.startsWith('Conflicts:')) {
      parsed.conflicts = parseConflicts(line.slice('Conflicts:'.length), parsed.movements);
      continue;
    }
    if (line.startsWith('Retreat phase:') || line.startsWith('Retreats pending:')) {
      const source = line.startsWith('Retreat phase:') ? 'Retreat phase:' : 'Retreats pending:';
      parsed.retreats = splitEntries(line.slice(source.length));
      continue;
    }
    if (line.startsWith('Winter adjustments:')) {
      parsed.winterAdjustments = splitEntries(line.slice('Winter adjustments:'.length));
      continue;
    }
    if (line.startsWith('Supply centers:')) {
      parsed.supplyCenters = parseSupplyCenters(line.slice('Supply centers:'.length));
    }
  }

  return parsed;
}

export function reportHighlightsFromReports(reports: BattleReportItem[]): ReportProvinceHighlight[] {
  const seen = new Map<string, ReportProvinceHighlight>();

  for (const report of reports) {
    const parsed = parseBattleReport(report);
    for (const conflict of parsed.conflicts) {
      if (!conflict.provinceId) continue;
      const kind = classifyConflictKind(conflict.kind);
      seen.set(conflict.provinceId, {
        provinceId: conflict.provinceId,
        provinceName: conflict.provinceName,
        kind,
        label: conflictDisplayLabel(conflict.kind),
        detail: conflictDisplayName(conflict.kind),
      });
    }
  }

  return [...seen.values()];
}
