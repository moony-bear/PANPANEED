import type { ChatMessage, WorldState } from './storyTypes';
import {
  getNpcAffectionBand,
  normalizeRouteContentPools,
  normalizeStoryFactions,
  summarizeFactionStandings,
  summarizeRouteScores,
  summarizeWorldState,
} from './worldState';

interface GenerateStoryPromptParams {
  playerName: string;
  playerProfile: string;
  ocNpcDescription: string;
  onlyOCInstruction: string;
}

interface ProcessActionPromptParams {
  gameStory: any;
  currentChapterIndex: number;
  currentWorldState: WorldState;
  updatedHistory: ChatMessage[];
  userMessage: ChatMessage;
  playerName: string;
  playerProfile: string;
  npcAffection: Record<string, number>;
  userTurnCount: number;
  stripWorldStateComment: (content: string) => string;
}

export function buildGenerateStoryPrompt({
  playerName,
  playerProfile,
  ocNpcDescription,
  onlyOCInstruction,
}: GenerateStoryPromptParams): string {
  return `你的核心任务不是撰写一个固定的故事，而是根据输入的【玩家角色档案】，生成一套完整的、符合SCS流派×模型A判型逻辑的、可供程序执行的多线剧情框架。

【玩家角色档案】：
代号：${playerName}
自述设定：${playerProfile}

【你的工作流程】
1. 分析档案中的关键信息（如玩家自述的性格倾向、职业、背景）。
2. 从你的“风格库”中，智能选择一个最适合该档案的剧本主风格，并融合1-2个流行叙事元素。
3. 生成一个包含【总体目标】、8个【章节】（每章有具体目标、关键阻碍、线索与分支钩子）、以及【多个可能结局条件】的完整剧情框架。不需要生成特定选项，选项将由玩家自由输入。
4. 整个框架必须严格遵循SCS模型A的判型逻辑，但所有判型意图必须隐藏在生动的剧情冲突中。
5. 最终输出为严格的JSON格式，便于前端游戏引擎解析和呈现。
6. 你必须显式生成阵营系统和路线专属内容池，让剧情在后续回合中能根据玩家行为偏向不同派系与不同路线素材。
7. 你必须让“变化原因”可追踪，方便人工复盘，所以路线和阵营的变化要能说清为什么发生，而不是只给结果标签。
8. 你设计的跑团方式必须服务于SCS模型A观察，而不是只做表面题材包装。剧情要能区分高维自然调用、低维高代价适应、意识功能观察、生机功能自动化等不同运作方式。

【一、风格与元素库（你必须从中智能选择）】
剧本主风格库（选择一项为主）：
现代都市、克苏鲁神话、修仙世界、校园背景、古代皇宫生存、赛博朋克、末日废土、星际科幻、西幻
流行叙事元素库（选择1-2项融合）：
重生、穿越、复仇、系统/面板、预言/宿命、扮猪吃虎、反套路、规则怪谈、真假千金、ABO先婚后爱、恐怖风快穿

【二、SCS模型A判型要求（最高优先级）】
8个章节分别侧重考察以下维度（可混合次要维度）：
伦理 (Ethics：Fi/Fe)：涉及信任、背叛、共情、道德抉择、关系网。
逻辑 (Logic：Ti/Te)：涉及因果分析、系统漏洞、效率、规则博弈。
实感 (Sensing：Si/Se)：涉及细节观察、身体感受、权力压迫、资源掌控。
直觉 (Intuition：Ni/Ne)：涉及隐喻象征、未来预见、潜在联系、发散联想。

【阵营与路线设计补充要求】
1. 至少提供3个有明确利益冲突的阵营，每个阵营都要有公开定位、真实目标、惯用手段、偏好路线。
2. 至少提供4条路线内容池，建议覆盖潜行线、权谋线、感情线、真相线；如果题材不完全适配，可以改名，但功能必须对应。
3. 每条路线内容池都必须有偏好事件、偏好线索、偏好角色、结局入口，保证后续能真正分流。
4. "route_scores" 的初始值必须完整给出，便于后续连续追踪。

【三、跑团设计与NPC设计要求】
1. 章节设计不能只区分“考Fi/考Ti”，还要区分情境类型：新环境社会适应、薄弱点压力、超本我渴望支持、熟悉环境自动处理。
2. 8章中必须尽量覆盖以下几类观察场景：
   - 新环境/社会期望场景：观察角色功能如何起手适应
   - 压力/羞耻/失控场景：观察薄弱功能与防御代价
   - 被支持/被理解/被引诱场景：观察暗示功能与激活功能
   - 熟悉/自动/无需解释场景：观察Id区块与生机功能
3. 每个关键NPC都必须是稳定的信息环境来源，而不是一次性工具人。至少让不同NPC分别更偏向：
   - 规则/结构/秩序压力
   - 关系/忠诚/伦理牵引
   - 权力/空间/资源压迫
   - 时间/预感/可能性诱导
4. 高好感NPC不只是“更友善”，还应根据其类型，为玩家提供不同形式的支持、误导、补偿或诱导。
5. 章节必须显式写出“新环境触发点”“社会期望触发点”“私人放松/被接住触发点”“熟悉事务自动处理触发点”，让后续推进可直接调用。
6. 每个关键NPC都必须给出分阶段互动脚本，至少覆盖：初见施压、建立信任、高好感支持、冲突触发。NPC要像持续稳定的诊断装置，而不是临时发任务的人。

【返回JSON结构要求】（务必返回合规且可以直接被解析的JSON代码，不要有任何markdown转义）：
{
  "game_title": "你生成的核心游戏标题",
  "world_setting": "详细的世界观背景设定",
  "overall_goal": "玩家在整个游戏中需要达成的终极目标",
  "initial_world_state": {
    "chapter_memory": "故事开始时的基准局面",
    "unresolved_threads": ["开局就存在的核心疑点或压力"],
    "revealed_secrets": [],
    "inventory": [],
    "global_flags": [],
    "active_routes": ["故事开局时可能存在的初始路线倾向"],
    "route_scores": { "潜行线": 0, "权谋线": 0, "感情线": 0, "真相线": 0 },
    "route_history": [],
    "route_change_reasons": [],
    "choice_log": [],
    "faction_standings": {
      "阵营名": { "score": 50, "label": "观望", "trend": "steady", "note": "开局默认态度" }
    },
    "faction_change_reasons": {},
    "relationship_notes": {},
    "npc_intentions": {},
    "current_pressure": "开场时逼迫玩家行动的外部压力",
    "chapter_goal_status": "ongoing",
    "goal_progress": 0
  },
  "factions": [
    {
      "id": "faction_id",
      "name": "阵营名",
      "public_brief": "玩家表面能感知到的定位",
      "core_goal": "该阵营真正想达成的长期目标",
      "operating_style": "该阵营惯用的手段与风格",
      "allies": ["可能合作的阵营"],
      "rivals": ["天然敌对或竞争阵营"],
      "preferred_routes": ["偏好的路线，例如真相线、权谋线"]
    }
  ],
  "route_content_pools": [
    {
      "route_id": "truth_route",
      "route_name": "真相线",
      "route_theme": "这条路线的核心张力",
      "favored_events": ["更容易出现的事件"],
      "favored_clues": ["更容易出现的线索"],
      "favored_npcs": ["更容易成为关键节点的角色"],
      "favored_ending_gateways": ["更容易开启的结局入口"]
    }
  ],
  "ending_conditions": {
    "true_ending": "触发真结局的条件描述",
    "normal_ending": "普通结局条件",
    "bad_ending": "坏结局条件"
  },
  "npcs": [
    {
      "name": "NPC名",
      "description": "NPC设定",
      "socionics_type_hidden": "隐含类型(例如:LSI)",
      "faction_affiliation": "该NPC所属阵营，若独立行动则写'独立'",
      "diagnostic_role": "该NPC在判型观察中的功能，例如'施加规则压力'、'提供关系牵引'、'制造权力压迫'、'提供时间性诱导'",
      "information_pressure_style": "这个NPC主要会把玩家拉进什么信息环境",
      "support_vector": "高好感时此NPC更可能提供何种支持、共鸣或诱导",
      "initial_affection": 50,
      "diagnostic_stage_plan": {
        "first_contact": "初见时如何把玩家拉进某类信息环境",
        "trust_building": "关系升温后如何继续观察玩家的适应与选择",
        "high_affection": "高好感时会提供怎样的支持、误导、补偿或诱导",
        "conflict_trigger": "在底线被碰触时会如何制造冲突或触发玩家防御"
      },
      "personality_anchor": {
        "surface_mask": "对外展现的人设与说话风格",
        "core_drive": "该角色绝不会轻易放弃的目标或执念",
        "hidden_agenda": "不会主动告诉玩家的真实盘算",
        "bottom_line": "绝不接受的触发点或原则底线",
        "affection_rules": {
          "low_affection": "低好感时的行为倾向",
          "mid_affection": "中等好感时的行为倾向",
          "high_affection": "高好感时的行为倾向"
        }
      }
    }
  ],
  "chapters": [
    {
      "chapter_id": 1,
      "chapter_title": "第X章标题",
      "chapter_goal": "本章玩家需要达成的具体目标或面临的核心抉择",
      "chapter_stakes": "若本章失利，会付出的代价或损失",
      "opening_narrative": "开场叙事，将玩家代入情境",
      "scenario_description": "当下的具体场景和危机。必须促使玩家做出行动判断",
      "focus_dimension": "本章重点考察的模型A维度",
      "diagnostic_focus": "本章更偏向观察哪个模型A现象，例如'角色功能起手'、'薄弱点压力'、'超本我支持'、'Id自动处理'",
      "new_environment_trigger": "本章如何把玩家放进新的信息环境或陌生社会期望中",
      "social_expectation_trigger": "本章如何迫使玩家考虑外界评价、规训或身份责任",
      "pressure_mode": "本章主要通过什么方式给玩家造成心理或情境压力",
      "support_hint": "本章可能通过什么形式让玩家暴露其被支持、被理解、被补足时的反应",
      "private_relief_trigger": "本章在哪类私人、被接住或暂时放松的时刻观察超本我反应",
      "automation_hint": "若玩家进入熟悉/自动模式，本章更可能出现什么样的自然处理痕迹",
      "automatic_habit_trigger": "本章如何诱发玩家在熟悉事务中不经解释地自动处理",
      "scene_hooks": ["本章可展开的场景切口1", "场景切口2"],
      "key_obstacles": ["阻碍1", "阻碍2"],
      "discoverable_clues": ["可以被发现的线索1", "线索2"],
      "route_vectors": ["本章可能导向的路线A", "本章可能导向的路线B", "本章可能导向的路线C"],
      "branch_outcomes": {
        "route_a": "如果玩家偏向路线A，会如何改变后续局势",
        "route_b": "如果玩家偏向路线B，会如何改变后续局势",
        "route_c": "如果玩家偏向路线C，会如何改变后续局势",
        "complication": "处理失当时会引发什么新麻烦",
        "relationship_shift": "本章可能改变哪些角色关系"
      },
      "carryover_question": "本章结束后必须带到下一章的悬念"
    }
  ]
   ${ocNpcDescription}
   ${onlyOCInstruction}
}`;
}

export function buildProcessActionPrompt({
  gameStory,
  currentChapterIndex,
  currentWorldState,
  updatedHistory,
  userMessage,
  playerName,
  playerProfile,
  npcAffection,
  userTurnCount,
  stripWorldStateComment,
}: ProcessActionPromptParams): string {
  const activeChapter = gameStory.chapters[currentChapterIndex];
  const storyFactions = normalizeStoryFactions(gameStory);
  const routeContentPools = normalizeRouteContentPools(gameStory);
  const npcDirectiveText = gameStory.npcs
    .map((npc: any) => {
      const affectionScore = npcAffection[npc.name] || npc.initial_affection || 50;
      const anchor = npc.personality_anchor || {};
      const stagePlan = npc.diagnostic_stage_plan || {};
      return `- ${npc.name}
  隐含类型: ${npc.socionics_type_hidden}
  所属阵营: ${npc.faction_affiliation || '独立/未标注'}
  判型观察职能: ${npc.diagnostic_role || '未定义'}
  信息环境风格: ${npc.information_pressure_style || '未定义'}
  高好感支持向量: ${npc.support_vector || '未定义'}
  初见施压脚本: ${stagePlan.first_contact || '未定义'}
  建立信任脚本: ${stagePlan.trust_building || '未定义'}
  高好感脚本: ${stagePlan.high_affection || '未定义'}
  冲突触发脚本: ${stagePlan.conflict_trigger || '未定义'}
  当前好感: ${affectionScore}（${getNpcAffectionBand(affectionScore)}）
  表层人设: ${anchor.surface_mask || '未定义'}
  核心驱动力: ${anchor.core_drive || '未定义'}
  隐藏盘算: ${anchor.hidden_agenda || '未定义'}
  绝对底线: ${anchor.bottom_line || '未定义'}
  低好感行为规则: ${anchor.affection_rules?.low_affection || '保持防备，不轻易交付关键资源'}
  中好感行为规则: ${anchor.affection_rules?.mid_affection || '可合作，但会保留筹码'}
  高好感行为规则: ${anchor.affection_rules?.high_affection || '愿意主动帮助，但仍会遵守自身底线'}`;
    })
    .join('\n');
  const factionDirectiveText =
    storyFactions.length > 0
      ? storyFactions
          .map(
            (faction) => `- ${faction.name}
  明面定位: ${faction.public_brief || '未定义'}
  核心目标: ${faction.core_goal || '未定义'}
  行事风格: ${faction.operating_style || '未定义'}
  友方/可合作阵营: ${faction.allies.join('；') || '无'}
  敌对/竞争阵营: ${faction.rivals.join('；') || '无'}
  偏好路线: ${faction.preferred_routes.join('；') || '无'}`,
          )
          .join('\n')
      : '未单独定义阵营。';
  const routePoolDirectiveText =
    routeContentPools.length > 0
      ? routeContentPools
          .map(
            (pool) => `- ${pool.route_name}
  路线主题: ${pool.route_theme || '未定义'}
  偏好事件: ${pool.favored_events.join('；') || '无'}
  偏好线索: ${pool.favored_clues.join('；') || '无'}
  偏好角色: ${pool.favored_npcs.join('；') || '无'}
  结局入口: ${pool.favored_ending_gateways.join('；') || '无'}`,
          )
          .join('\n')
      : '未单独定义路线内容池。';

  return `你是一个TRPG游戏主持人(GM)，同时也是精通Socionics模型A的分析者。
根据玩家在当前情境下的行动描述，生成合理的剧情发展，并更新隐藏的世界状态。你的核心职责是创造引人入胜、细节丰富、具有连续性的叙事，同时考察玩家的认知模式。

【叙事核心指令 - 必须遵守】：
1. 不要用一句话概括事件。请像小说一样描写场景细节、微表情、语气变化、犹豫与冲突。每次回复的叙事部分不少于200字。
2. 主动制造困境与冲突。根据章节目标和NPC性格，引入新的变量、突发状况或道德两难。
3. NPC绝不能因为玩家一句话就放弃自己的核心驱动力、隐藏盘算和底线。
4. 好感度阈值必须实际生效。低好感偏拒绝与试探，中好感偏交易与观察，高好感偏协助，但都不能违背底线。
5. 章节像可探索场景网络，而不是一次性问答；要持续使用已有线索、未解决冲突、角色关系、持有物与压力源。
6. 本章节至少需要4轮有意义的玩家行动后，才允许考虑自然结束。只有在章节目标明确达成/失败，或局势产生足够重大的不可逆变化时，才建议结束。
7. 不同选择必须导向不同路线、不同阵营关系或不同信息视角。
8. 路线专属内容池必须落地。如果玩家当前行动或既有路线分值已经偏向某条路线，你必须优先调用该路线内容池中的事件、线索、关键NPC与结局入口。
9. 阵营必须像派系一样运作。阵营反应要基于它们的公开立场、核心目标、行事风格和当前standing分值。
10. SCS判型记录必须克制。不要因为玩家本轮表现出某个信息元素，就直接把它等同于该元素的主导或创造。相同元素可能出现在不同位置和不同维度，必须结合持续性、压力情境、熟练度、代价感与行为质感来记录。
11. 在叙事推进上，你必须利用当前章节的“观察重点/压力模式/支持线索/自动处理线索”来设计局面，不要只给泛化冲突。
12. 新信息优先看意识环的适应痕迹，熟悉事务优先看生机环的自动处理。若章节写明了“新环境触发点/社会期望触发点/私人放松触发点/自动习惯触发点”，你必须显式把它们落进叙事。
13. 第3功能是新局面的适应性起手候选，第5/6功能更适合在被支持、被理解或被引诱时观察，第7/8功能更适合在熟悉任务里观察。不要把这些线索混写成一个抽象评价。

【故事大背景】:
总体目标: ${gameStory.overall_goal || '探索这个世界，书写你的命运。'}
世界设定: ${gameStory.world_setting}

【当前章节】:
第${currentChapterIndex + 1}章: ${activeChapter.chapter_title}
章节目标: ${activeChapter.chapter_goal || '应对当前局面，做出关键选择'}
章节失败代价: ${activeChapter.chapter_stakes || '局势失控并留下后续代价'}
背景说明: ${activeChapter.scenario_description}
本章判型维度: ${activeChapter.focus_dimension}
本章模型A观察重点: ${activeChapter.diagnostic_focus || '未特别指定'}
本章新环境触发点: ${activeChapter.new_environment_trigger || '未特别指定'}
本章社会期望触发点: ${activeChapter.social_expectation_trigger || '未特别指定'}
本章压力模式: ${activeChapter.pressure_mode || '未特别指定'}
本章支持线索: ${activeChapter.support_hint || '未特别指定'}
本章私人放松触发点: ${activeChapter.private_relief_trigger || '未特别指定'}
本章自动处理线索: ${activeChapter.automation_hint || '未特别指定'}
本章自动习惯触发点: ${activeChapter.automatic_habit_trigger || '未特别指定'}
本章可展开场景: ${(activeChapter.scene_hooks || []).join('；') || '未特别指定'}
本章关键阻碍: ${(activeChapter.key_obstacles || []).join('；') || '未特别指定'}
本章可发现线索: ${(activeChapter.discoverable_clues || []).join('；') || '未特别指定'}
本章可能导向的路线: ${(activeChapter.route_vectors || []).join('；') || '未特别指定'}
本章分支影响: ${
    activeChapter.branch_outcomes
      ? `路线A=${activeChapter.branch_outcomes.route_a || '未指定'}；路线B=${activeChapter.branch_outcomes.route_b || '未指定'}；路线C=${activeChapter.branch_outcomes.route_c || '未指定'}；处理失当=${activeChapter.branch_outcomes.complication || '未指定'}；关系变化=${activeChapter.branch_outcomes.relationship_shift || '未指定'}`
      : '未特别指定'
  }
必须带向后续章节的悬念: ${activeChapter.carryover_question || '未特别指定'}
当前章节玩家已行动轮数: ${userTurnCount}

【玩家角色设定】:
${`[代号]: ${playerName}\n[自我评估设定]: ${playerProfile}`}

【主要NPC阵营与行为规则】:
${npcDirectiveText}

【预设阵营定义】:
${factionDirectiveText}

【预设路线专属内容池】:
${routePoolDirectiveText}

【历史对话摘要】:
${updatedHistory.map((msg: any) => `${msg.role === 'user' ? '玩家行动' : '剧情/NPC'}: ${stripWorldStateComment(msg.content)}`).join('\n')}

【当前结构化世界状态】:
${summarizeWorldState(currentWorldState)}

【当前路线强度】:
${summarizeRouteScores(currentWorldState.route_scores)}

【当前阵营站位】:
${summarizeFactionStandings(currentWorldState.faction_standings)}

【当前玩家行动输入】:
${userMessage.content}

请根据以上信息，执行以下任务：
1. 生成剧情反馈：对玩家的行动做出合理的叙事回应。NPC反应必须符合其Socionics类型特质和当前好感度。
2. 更新世界状态：必须返回一个结构化对象，明确记录当前阶段的记忆、未解问题、已暴露秘密、物品、旗标、关系备注、NPC当前意图、外部压力、章节目标状态与推进度。
3. 记录分支方向：玩家本轮选择应写入路线变化、关键选择日志和阵营立场变化。即便没有成功/失败，也可能让后续进入不同路线。
4. 给出变化原因：必须说明路线为何偏移、阵营为何改变态度，原因要基于本轮实际互动与利益变化，便于人工复盘。
5. 判断章节结束：只有在章节目标明确成功/失败，或局势已不可逆地进入下一个阶段时，才建议 chapter_ended = true；否则保持 false。
6. SCS分析：只记录本轮可观察到的行为线索与其可能对应的位置/维度特征，不得把单次行为直接判成最终类型。
7. 你的SCS分析必须优先采用模型A术语：四区块、意识/生机、角色功能起手、激活功能与薄弱功能联动、维度高低、压力下代价感，而不是泛泛地说“像Ti/像Fe”。
8. 如果证据不足，你必须明确写“证据不足”或“暂不锁定”，不能强行给出确定判断。
9. 你必须拆开记录意识/生机指标：是否引用社会或一般人视角、是否显著考虑社会期望、是否表现为自动发生、是否更像事后才意识到。
10. 你必须区分这是“新环境起手”还是“熟悉环境自动处理”。若两者都没有明显证据，要明确写证据不足。

【返回JSON结构要求】（必须严格遵守，不要添加额外解释）：
{
  "narrative_response": "纯文本叙事，直接显示给玩家。",
  "npc_reactions": [
    { "name": "互动的NPC名", "reaction": "NPC的反应台词或行为", "affection_change": 5 }
  ],
  "world_state_update": {
    "chapter_memory": "这一轮后，后续章节必须记住的事件余波",
    "unresolved_threads": ["仍悬而未决的问题1"],
    "revealed_secrets": ["本轮新暴露的秘密或真相"],
    "inventory": ["玩家持有或失去的重要物品"],
    "global_flags": ["关键旗标"],
    "active_routes": ["当前已经成形的路线标签，例如'潜行调查线'、'与教团合作线'"],
    "route_scores": { "潜行线": 72, "真相线": 48, "权谋线": 15 },
    "route_history": ["本轮新增的路线偏移或路线确认"],
    "route_change_reasons": ["权谋线 +12，因为玩家选择交换利益而非正面对抗"],
    "choice_log": ["玩家本轮做出的关键选择及其后果"],
    "faction_standings": {
      "阵营名": { "score": 62, "label": "谨慎合作", "trend": "up", "note": "因为交付情报而临时放松戒备" }
    },
    "faction_change_reasons": { "阵营名": "因为玩家提供了该阵营急需的资源或情报" },
    "relationship_notes": { "NPC名": "该NPC当前对玩家的态度或判断" },
    "npc_intentions": { "NPC名": "该NPC下一步真正想做什么" },
    "current_pressure": "正在逼迫剧情前进的压力",
    "chapter_goal_status": "ongoing",
    "goal_progress": 55
  },
  "scs_analysis": {
    "summary": "本轮模型A侧写总述，50-120字。",
    "likely_block": "Ego | Super-Ego | Super-Id | Id | mixed | unclear",
    "conscious_vs_vital": "conscious | vital | mixed | unclear",
    "social_reference_cues": "是否出现'我们/一般人/社会上'这类社会参照，若无则写无明显社会参照。",
    "social_expectation_cues": "是否明显考虑外界评价、身份责任、规范压力，若无则写无明显社会期望取向。",
    "automaticity_cues": "是否表现为自动、顺手、无需解释地处理，若无则写无明显自动性。",
    "afterthought_cues": "是否更像事后才意识到或事后复盘才说清，若无则写无明显事后察觉。",
    "position_hypothesis": "更像哪个位置或哪种起手方式在运作，例如角色功能起手适应、创造功能灵活调用、薄弱点防御等。",
    "dimension_signal": "从熟练度、灵活性、刻板感、全局感等角度判断更像高维还是低维，但必须保留谨慎语气。",
    "stress_cost": "本轮是否出现明显代价感、迟滞、防御、过度补偿或轻松自如。",
    "stability_note": "这一表现更像稳定重复模式、暂时动员，还是证据不足。",
    "role_function_entry": "是否像第3功能作为新局面起手适应，如果不像也要说明。",
    "mobilizing_polr_link": "若出现回避或紧绷，请判断是否更像激活功能在带动对立薄弱功能的防御；证据不足可写暂不明确。",
    "new_environment_entry": "如果本轮存在陌生任务、陌生关系或社会规训，请描述玩家如何起手适应；没有就写无明显新环境起手。",
    "familiar_environment_response": "如果本轮存在熟悉事务或自动处理，请描述其自然痕迹；没有就写无明显熟悉环境自动处理。",
    "self_vs_behavior_gap": "若本轮能看出玩家自述与实际行为的轻微落差，可记录；没有就写无明显落差。",
    "evidence_quotes": ["必须引用1-3条具体玩家输入或行为片段作为证据"],
    "caution": "保留说明，强调本轮记录不能直接等同于最终类型。"
  },
  "vague_feedback": "诗意隐喻，作为本回合系统提示。",
  "chapter_ended": false,
  "chapter_summary": "如果 chapter_ended 为 true，用2-4句话总结本章关键事件、关系变化以及带往下章的悬念。否则留空。"
}`;
}
