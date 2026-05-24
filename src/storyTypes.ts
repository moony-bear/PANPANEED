export type Screen = 'create' | 'chapter' | 'report';

export interface ChatMessage {
  role: 'user' | 'npc';
  content: string;
  name?: string;
}

export interface HistoryItem {
  chapterId: number;
  chapterTitle: string;
  openingNarrative: string;
  scenarioDescription: string;
  chatHistory: ChatMessage[];
  playerActionLog: string[];
  fullActionText: string;
  scsAnalysis: string;
  scsAnalysisStructured?: TurnSCSAnalysis;
  turnAnalyses?: TurnSCSAnalysis[];
  consequence: string;
  vagueFeedback: string;
  chapterSummary?: string;
  worldStateAfter?: WorldState;
}

export type ModelABlock = 'Ego' | 'Super-Ego' | 'Super-Id' | 'Id' | 'mixed' | 'unclear';
export type ConsciousLayer = 'conscious' | 'vital' | 'mixed' | 'unclear';

export interface TurnSCSAnalysis {
  summary: string;
  likely_block: ModelABlock;
  conscious_vs_vital: ConsciousLayer;
  social_reference_cues: string;
  social_expectation_cues: string;
  automaticity_cues: string;
  afterthought_cues: string;
  position_hypothesis: string;
  dimension_signal: string;
  stress_cost: string;
  stability_note: string;
  role_function_entry: string;
  mobilizing_polr_link: string;
  new_environment_entry: string;
  familiar_environment_response: string;
  self_vs_behavior_gap: string;
  evidence_quotes: string[];
  caution: string;
}

export type FactionTrend = 'up' | 'down' | 'steady';

export interface FactionStanding {
  score: number;
  label: string;
  trend: FactionTrend;
  note: string;
}

export interface StoryFaction {
  id: string;
  name: string;
  public_brief: string;
  core_goal: string;
  operating_style: string;
  allies: string[];
  rivals: string[];
  preferred_routes: string[];
}

export interface RouteContentPool {
  route_id: string;
  route_name: string;
  route_theme: string;
  favored_events: string[];
  favored_clues: string[];
  favored_npcs: string[];
  favored_ending_gateways: string[];
}

export interface WorldState {
  chapter_memory: string;
  unresolved_threads: string[];
  revealed_secrets: string[];
  inventory: string[];
  global_flags: string[];
  active_routes: string[];
  route_scores: Record<string, number>;
  route_history: string[];
  route_change_reasons: string[];
  choice_log: string[];
  faction_standings: Record<string, FactionStanding>;
  faction_change_reasons: Record<string, string>;
  relationship_notes: Record<string, string>;
  npc_intentions: Record<string, string>;
  current_pressure: string;
  chapter_goal_status: 'ongoing' | 'success' | 'failure';
  goal_progress: number;
}
