import type { HistoryItem, TurnSCSAnalysis } from './storyTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function createEmptyTurnSCSAnalysis(summary = ''): TurnSCSAnalysis {
  return {
    summary,
    likely_block: 'unclear',
    conscious_vs_vital: 'unclear',
    social_reference_cues: '',
    social_expectation_cues: '',
    automaticity_cues: '',
    afterthought_cues: '',
    position_hypothesis: '',
    dimension_signal: '',
    stress_cost: '',
    stability_note: '',
    role_function_entry: '',
    mobilizing_polr_link: '',
    new_environment_entry: '',
    familiar_environment_response: '',
    self_vs_behavior_gap: '',
    evidence_quotes: [],
    caution: '',
  };
}

export function sanitizeTurnSCSAnalysis(raw: unknown): TurnSCSAnalysis {
  if (typeof raw === 'string') {
    return createEmptyTurnSCSAnalysis(raw);
  }

  if (!isRecord(raw)) {
    return createEmptyTurnSCSAnalysis('');
  }

  const likelyBlock = raw.likely_block;
  const consciousVsVital = raw.conscious_vs_vital;

  return {
    summary: toStringValue(raw.summary),
    likely_block:
      likelyBlock === 'Ego' || likelyBlock === 'Super-Ego' || likelyBlock === 'Super-Id' || likelyBlock === 'Id' || likelyBlock === 'mixed'
        ? likelyBlock
        : 'unclear',
    conscious_vs_vital:
      consciousVsVital === 'conscious' || consciousVsVital === 'vital' || consciousVsVital === 'mixed' ? consciousVsVital : 'unclear',
    social_reference_cues: toStringValue(raw.social_reference_cues),
    social_expectation_cues: toStringValue(raw.social_expectation_cues),
    automaticity_cues: toStringValue(raw.automaticity_cues),
    afterthought_cues: toStringValue(raw.afterthought_cues),
    position_hypothesis: toStringValue(raw.position_hypothesis),
    dimension_signal: toStringValue(raw.dimension_signal),
    stress_cost: toStringValue(raw.stress_cost),
    stability_note: toStringValue(raw.stability_note),
    role_function_entry: toStringValue(raw.role_function_entry),
    mobilizing_polr_link: toStringValue(raw.mobilizing_polr_link),
    new_environment_entry: toStringValue(raw.new_environment_entry),
    familiar_environment_response: toStringValue(raw.familiar_environment_response),
    self_vs_behavior_gap: toStringValue(raw.self_vs_behavior_gap),
    evidence_quotes: toStringArray(raw.evidence_quotes),
    caution: toStringValue(raw.caution),
  };
}

export function summarizeTurnSCSAnalysis(analysis: TurnSCSAnalysis): string {
  const lines: string[] = [];
  if (analysis.summary) lines.push(analysis.summary);
  if (analysis.likely_block !== 'unclear') lines.push(`区块倾向：${analysis.likely_block}`);
  if (analysis.conscious_vs_vital !== 'unclear') lines.push(`意识/生机：${analysis.conscious_vs_vital}`);
  if (analysis.social_reference_cues) lines.push(`社会参照：${analysis.social_reference_cues}`);
  if (analysis.social_expectation_cues) lines.push(`社会期望：${analysis.social_expectation_cues}`);
  if (analysis.automaticity_cues) lines.push(`自动性：${analysis.automaticity_cues}`);
  if (analysis.afterthought_cues) lines.push(`事后察觉：${analysis.afterthought_cues}`);
  if (analysis.position_hypothesis) lines.push(`位置判断：${analysis.position_hypothesis}`);
  if (analysis.dimension_signal) lines.push(`维度信号：${analysis.dimension_signal}`);
  if (analysis.stress_cost) lines.push(`压力代价：${analysis.stress_cost}`);
  if (analysis.stability_note) lines.push(`稳定性：${analysis.stability_note}`);
  if (analysis.role_function_entry) lines.push(`角色起手：${analysis.role_function_entry}`);
  if (analysis.mobilizing_polr_link) lines.push(`激活/薄弱联动：${analysis.mobilizing_polr_link}`);
  if (analysis.new_environment_entry) lines.push(`新环境起手：${analysis.new_environment_entry}`);
  if (analysis.familiar_environment_response) lines.push(`熟悉环境处理：${analysis.familiar_environment_response}`);
  if (analysis.self_vs_behavior_gap) lines.push(`自述落差：${analysis.self_vs_behavior_gap}`);
  if (analysis.evidence_quotes.length > 0) lines.push(`行为证据：${analysis.evidence_quotes.join('；')}`);
  if (analysis.caution) lines.push(`保留说明：${analysis.caution}`);
  return lines.length > 0 ? lines.join('\n') : '无结构化SCS记录。';
}

export function formatTurnSCSAnalysisForExport(analysis?: TurnSCSAnalysis): string {
  if (!analysis) return '无模型A复盘记录。';

  const lines: string[] = [];
  if (analysis.summary) lines.push(`总述：${analysis.summary}`);
  lines.push(`区块倾向：${analysis.likely_block}`);
  lines.push(`意识/生机：${analysis.conscious_vs_vital}`);
  if (analysis.social_reference_cues) lines.push(`社会参照线索：${analysis.social_reference_cues}`);
  if (analysis.social_expectation_cues) lines.push(`社会期望线索：${analysis.social_expectation_cues}`);
  if (analysis.automaticity_cues) lines.push(`自动性线索：${analysis.automaticity_cues}`);
  if (analysis.afterthought_cues) lines.push(`事后察觉线索：${analysis.afterthought_cues}`);
  if (analysis.position_hypothesis) lines.push(`位置假设：${analysis.position_hypothesis}`);
  if (analysis.dimension_signal) lines.push(`维度与熟练度信号：${analysis.dimension_signal}`);
  if (analysis.stress_cost) lines.push(`压力下代价感：${analysis.stress_cost}`);
  if (analysis.stability_note) lines.push(`跨情境稳定性：${analysis.stability_note}`);
  if (analysis.role_function_entry) lines.push(`角色功能起手：${analysis.role_function_entry}`);
  if (analysis.mobilizing_polr_link) lines.push(`激活-薄弱联动：${analysis.mobilizing_polr_link}`);
  if (analysis.new_environment_entry) lines.push(`新环境进入方式：${analysis.new_environment_entry}`);
  if (analysis.familiar_environment_response) lines.push(`熟悉环境自动处理：${analysis.familiar_environment_response}`);
  if (analysis.self_vs_behavior_gap) lines.push(`自述 vs 行为落差：${analysis.self_vs_behavior_gap}`);
  if (analysis.evidence_quotes.length > 0) lines.push(`本章证据：${analysis.evidence_quotes.join('；')}`);
  if (analysis.caution) lines.push(`保留意见：${analysis.caution}`);
  return lines.join('\n');
}

export function formatTurnSCSAnalysisTimeline(analyses?: TurnSCSAnalysis[]): string {
  if (!analyses || analyses.length === 0) return '无逐回合模型A轨迹记录。';

  return analyses
    .map((analysis, index) => `【第${index + 1}回合】\n${formatTurnSCSAnalysisForExport(analysis)}`)
    .join('\n\n');
}

export function buildStructuredHistoryText(playHistory: HistoryItem[]): string {
  return playHistory
    .map((item) => {
      const playerActionText =
        item.playerActionLog && item.playerActionLog.length > 0
          ? item.playerActionLog.map((action, index) => `${index + 1}. ${action}`).join('\n')
          : item.fullActionText || '无';
      const analysisText =
        item.turnAnalyses && item.turnAnalyses.length > 0
          ? formatTurnSCSAnalysisTimeline(item.turnAnalyses)
          : item.scsAnalysisStructured
            ? formatTurnSCSAnalysisForExport(item.scsAnalysisStructured)
            : item.scsAnalysis || '无';
      return `
第${item.chapterId}章: ${item.chapterTitle}
玩家行动序列:
${playerActionText}
逐回合模型A结构化复盘:
${analysisText}
章节收束判断:
${item.scsAnalysis || '无'}
剧情后果: ${item.consequence}
章节总结: ${item.chapterSummary || '无'}
章节后状态: ${item.worldStateAfter ? JSON.stringify(item.worldStateAfter, null, 2) : '无'}
      `;
    })
    .join('\n');
}
