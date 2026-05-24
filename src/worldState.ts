import type { ChatMessage, FactionStanding, FactionTrend, RouteContentPool, StoryFaction, WorldState } from './storyTypes';

export function createDefaultWorldState(): WorldState {
  return {
    chapter_memory: '',
    unresolved_threads: [],
    revealed_secrets: [],
    inventory: [],
    global_flags: [],
    active_routes: [],
    route_scores: {},
    route_history: [],
    route_change_reasons: [],
    choice_log: [],
    faction_standings: {},
    faction_change_reasons: {},
    relationship_notes: {},
    npc_intentions: {},
    current_pressure: '',
    chapter_goal_status: 'ongoing',
    goal_progress: 0,
  };
}

export function sanitizeWorldState(raw: any): WorldState {
  const fallback = createDefaultWorldState();
  if (!raw || typeof raw !== 'object') return fallback;

  const toStringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const toStringMap = (value: unknown) =>
    value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
        )
      : {};
  const clampPercent = (value: unknown, defaultValue = 0) => {
    const numericValue =
      typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
    return Number.isFinite(numericValue) ? Math.max(0, Math.min(100, numericValue)) : defaultValue;
  };
  const toScoreMap = (value: unknown) =>
    value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter((entry) => typeof entry[0] === 'string')
            .map(([key, score]) => [key, clampPercent(score)])
            .filter((entry) => Number.isFinite(entry[1])),
        )
      : {};
  const toFactionStandingMap = (value: unknown): Record<string, FactionStanding> => {
    if (!value || typeof value !== 'object') return {};

    return Object.fromEntries(
      Object.entries(value)
        .filter((entry) => typeof entry[0] === 'string')
        .map(([factionName, standingValue]) => {
          if (typeof standingValue === 'string') {
            return [
              factionName,
              {
                score: 50,
                label: standingValue,
                trend: 'steady' as FactionTrend,
                note: '',
              },
            ];
          }

          const standingObject = standingValue && typeof standingValue === 'object' ? standingValue : {};
          const score = clampPercent((standingObject as any).score, 50);
          const trend =
            (standingObject as any).trend === 'up' || (standingObject as any).trend === 'down' || (standingObject as any).trend === 'steady'
              ? (standingObject as any).trend
              : 'steady';

          return [
            factionName,
            {
              score,
              label:
                typeof (standingObject as any).label === 'string' && (standingObject as any).label.trim()
                  ? (standingObject as any).label
                  : getFactionStandingBand(score),
              trend,
              note: typeof (standingObject as any).note === 'string' ? (standingObject as any).note : '',
            },
          ];
        }),
    );
  };

  const goalProgress =
    typeof raw.goal_progress === 'number' && Number.isFinite(raw.goal_progress)
      ? Math.max(0, Math.min(100, raw.goal_progress))
      : fallback.goal_progress;

  const chapterGoalStatus =
    raw.chapter_goal_status === 'success' || raw.chapter_goal_status === 'failure' || raw.chapter_goal_status === 'ongoing'
      ? raw.chapter_goal_status
      : fallback.chapter_goal_status;

  return {
    chapter_memory: typeof raw.chapter_memory === 'string' ? raw.chapter_memory : fallback.chapter_memory,
    unresolved_threads: toStringArray(raw.unresolved_threads),
    revealed_secrets: toStringArray(raw.revealed_secrets),
    inventory: toStringArray(raw.inventory),
    global_flags: toStringArray(raw.global_flags),
    active_routes: toStringArray(raw.active_routes),
    route_scores: toScoreMap(raw.route_scores),
    route_history: toStringArray(raw.route_history),
    route_change_reasons: toStringArray(raw.route_change_reasons),
    choice_log: toStringArray(raw.choice_log),
    faction_standings: toFactionStandingMap(raw.faction_standings),
    faction_change_reasons: toStringMap(raw.faction_change_reasons),
    relationship_notes: toStringMap(raw.relationship_notes),
    npc_intentions: toStringMap(raw.npc_intentions),
    current_pressure: typeof raw.current_pressure === 'string' ? raw.current_pressure : fallback.current_pressure,
    chapter_goal_status: chapterGoalStatus,
    goal_progress: goalProgress,
  };
}

export function summarizeWorldState(state: WorldState): string {
  return JSON.stringify(state, null, 2);
}

export function stripWorldStateComment(content: string): string {
  return content.replace(/\n?<!--WORLD_STATE:[\s\S]*?-->/g, '').trim();
}

export function getNpcAffectionBand(score: number): string {
  if (score <= 20) return '敌对/反制';
  if (score <= 40) return '戒备/冷淡';
  if (score <= 59) return '中立/交易';
  if (score <= 79) return '信任/偏袒';
  return '高度亲近/愿意冒险相助';
}

export function getFactionStandingBand(score: number): string {
  if (score <= 19) return '敌对';
  if (score <= 39) return '戒备';
  if (score <= 59) return '观望';
  if (score <= 79) return '合作';
  return '核心盟友';
}

export function summarizeFactionStandings(factionStandings: Record<string, FactionStanding>): string {
  const entries = Object.entries(factionStandings);
  if (entries.length === 0) return '无明确阵营偏向';

  return entries
    .map(([faction, standing]) => {
      const trendText = standing.trend === 'up' ? '上升' : standing.trend === 'down' ? '下降' : '持平';
      const noteText = standing.note ? `，备注：${standing.note}` : '';
      return `${faction}=${standing.label}(分值${standing.score}，${trendText}${noteText})`;
    })
    .join('；');
}

export function summarizeRouteScores(routeScores: Record<string, number>): string {
  const sortedRoutes = Object.entries(routeScores).sort((a, b) => b[1] - a[1]);
  if (sortedRoutes.length === 0) return '无明显路线倾向';
  return sortedRoutes.map(([route, score]) => `${route}:${score}`).join('；');
}

export function normalizeStoryFactions(rawStory: any): StoryFaction[] {
  if (!Array.isArray(rawStory?.factions)) return [];

  return rawStory.factions
    .filter((faction: any) => faction && typeof faction === 'object' && typeof faction.name === 'string')
    .map((faction: any, index: number) => ({
      id: typeof faction.id === 'string' && faction.id.trim() ? faction.id : `faction_${index + 1}`,
      name: faction.name,
      public_brief: typeof faction.public_brief === 'string' ? faction.public_brief : '',
      core_goal: typeof faction.core_goal === 'string' ? faction.core_goal : '',
      operating_style: typeof faction.operating_style === 'string' ? faction.operating_style : '',
      allies: Array.isArray(faction.allies) ? faction.allies.filter((item: unknown): item is string => typeof item === 'string') : [],
      rivals: Array.isArray(faction.rivals) ? faction.rivals.filter((item: unknown): item is string => typeof item === 'string') : [],
      preferred_routes: Array.isArray(faction.preferred_routes)
        ? faction.preferred_routes.filter((item: unknown): item is string => typeof item === 'string')
        : [],
    }));
}

export function normalizeRouteContentPools(rawStory: any): RouteContentPool[] {
  if (!Array.isArray(rawStory?.route_content_pools)) return [];

  return rawStory.route_content_pools
    .filter((pool: any) => pool && typeof pool === 'object' && typeof pool.route_name === 'string')
    .map((pool: any, index: number) => ({
      route_id: typeof pool.route_id === 'string' && pool.route_id.trim() ? pool.route_id : `route_${index + 1}`,
      route_name: pool.route_name,
      route_theme: typeof pool.route_theme === 'string' ? pool.route_theme : '',
      favored_events: Array.isArray(pool.favored_events) ? pool.favored_events.filter((item: unknown): item is string => typeof item === 'string') : [],
      favored_clues: Array.isArray(pool.favored_clues) ? pool.favored_clues.filter((item: unknown): item is string => typeof item === 'string') : [],
      favored_npcs: Array.isArray(pool.favored_npcs) ? pool.favored_npcs.filter((item: unknown): item is string => typeof item === 'string') : [],
      favored_ending_gateways: Array.isArray(pool.favored_ending_gateways)
        ? pool.favored_ending_gateways.filter((item: unknown): item is string => typeof item === 'string')
        : [],
    }));
}

export function formatChapterTranscriptForExport(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      if (message.role === 'user') {
        return `【玩家输入】\n${message.content}`;
      }

      if (message.name) {
        return `【NPC：${message.name}】\n${message.content}`;
      }

      return `【旁白】\n${message.content}`;
    })
    .join('\n\n');
}

export function formatChapterStoryForExport(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      if (message.role === 'user') {
        return `【你的行动】\n${message.content}`;
      }

      if (message.name) {
        return `【${message.name}】\n${message.content}`;
      }

      return message.content;
    })
    .join('\n\n');
}

export function formatWorldStateForExport(worldState?: WorldState): string {
  if (!worldState) return '无结构化状态记录。';

  const lines: string[] = [];
  if (worldState.chapter_memory) lines.push(`章节余波：${worldState.chapter_memory}`);
  if (worldState.current_pressure) lines.push(`当前压力：${worldState.current_pressure}`);
  if (worldState.active_routes.length > 0) lines.push(`活跃路线：${worldState.active_routes.join('；')}`);
  if (Object.keys(worldState.route_scores).length > 0) lines.push(`路线权重：${summarizeRouteScores(worldState.route_scores)}`);
  if (worldState.route_change_reasons.length > 0) lines.push(`路线变化原因：${worldState.route_change_reasons.join('；')}`);
  if (Object.keys(worldState.faction_standings).length > 0) lines.push(`阵营立场：${summarizeFactionStandings(worldState.faction_standings)}`);
  if (Object.keys(worldState.faction_change_reasons).length > 0) {
    lines.push(`阵营变化原因：${Object.entries(worldState.faction_change_reasons).map(([faction, reason]) => `${faction}=${reason}`).join('；')}`);
  }
  if (worldState.unresolved_threads.length > 0) lines.push(`未解问题：${worldState.unresolved_threads.join('；')}`);
  if (worldState.revealed_secrets.length > 0) lines.push(`已揭露真相：${worldState.revealed_secrets.join('；')}`);
  if (worldState.inventory.length > 0) lines.push(`关键物品：${worldState.inventory.join('；')}`);
  return lines.length > 0 ? lines.join('\n') : '无结构化状态记录。';
}
