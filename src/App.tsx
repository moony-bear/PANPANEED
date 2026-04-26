import React, { useState, useEffect, useRef } from 'react';
import { TerminalSquare, AlertCircle, Loader2, ChevronRight, Download, BrainCircuit, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './index.css';
import { jsonrepair } from 'jsonrepair'
import { getOCList, importOCs, type OCCharacter } from './ocStorage';

function extractJsonFromMarkdown(content: string): string {
  // 1. 去除首尾空白
  let cleaned = content.trim();
  
  // 2. 匹配被 ```json ... ``` 或 ``` ... ``` 包裹的内容
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }
  
  // 3. 查找第一个 '{' 和最后一个 '}'，提取 JSON 部分（忽略前面的任何文字）
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

type Screen = 'create' | 'chapter' | 'report';

interface ChatMessage {
  role: 'user' | 'npc';
  content: string;
  name?: string;
}

interface HistoryItem {
  chapterId: number;
  chapterTitle: string;
  openingNarrative: string;
  scenarioDescription: string;
  chatHistory: ChatMessage[];
  fullActionText: string;
  scsAnalysis: string;
  consequence: string;
  vagueFeedback: string;
}

// 辅助函数：提取并尝试修复 JSON（使用 jsonrepair 库）
function extractAndRepairJson(content: string): any {
  let jsonStr = extractJsonFromMarkdown(content);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // 解析失败，尝试用 jsonrepair 修复（例如修复缺少引号、逗号等问题）
    const repaired = jsonrepair(jsonStr);
    return JSON.parse(repaired);
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('create');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('Uploading Neural Telemetry...');
  const [error, setError] = useState<string | null>(null);

  // Dynamic Story State
  const [gameStory, setGameStory] = useState<any>(null);

  // Player State
  const [playerName, setPlayerName] = useState('');
  const [playerProfile, setPlayerProfile] = useState('');
  
  // Game State
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [npcAffection, setNpcAffection] = useState<Record<string, number>>({});
  const [playHistory, setPlayHistory] = useState<HistoryItem[]>([]);
  
  // Chat State for Current Chapter
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [lastVagueFeedback, setLastVagueFeedback] = useState('');
  const [chapterCompleted, setChapterCompleted] = useState(false);
  
  // Scroll Ref
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Final Report
  const [finalReport, setFinalReport] = useState<any>(null);
  const [ocMode, setOcMode] = useState(false);
 const [onlyUseOC, setOnlyUseOC] = useState(false);    // ← 新增这一行，放在这里
const [selectedOCs, setSelectedOCs] = useState<string[]>([]);
// 1. 添加状态来存储从 public 目录加载的提示词
const [systemPromptContent, setSystemPromptContent] = useState('');
const [reviewChapterIndex, setReviewChapterIndex] = useState<number | null>(null);//剧情回顾组件

// 2. 在组件挂载时加载提示词
useEffect(() => {
  fetch('/socionics_ai_prompt.txt')
    .then((res) => {
      if (!res.ok) {
        throw new Error('Failed to load SCS system prompt');
      }
      return res.text();
    })
    .then((text) => setSystemPromptContent(text))
    .catch((err) => console.error('加载 SCS 提示词失败:', err));
}, []);
  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);
            
  const handleStartGame = async () => {
      // ========== 构建 OC 描述文本 ==========
let ocNpcDescription = '';
if (ocMode && selectedOCs.length > 0) {
  const selectedCharacters = getOCList().filter(oc => selectedOCs.includes(oc.id));
  ocNpcDescription = `\n【玩家预设的 NPC（OC 模式）】：
你必须将这些角色和对应关系完整融入你生成的故事世界观中。他们应扮演符合自身设定的重要角色，并且按照其关系网与其他 NPC 或玩家角色互动。
${selectedCharacters.map(oc => {
    const relationText = oc.relations && oc.relations.length > 0
      ? oc.relations.map(r => `${r.relation}：${r.targetName}${r.detail ? '(' + r.detail + ')' : ''}`).join('；')
      : '无预设关系';
    return `- 姓名：${oc.name}
  性格设定：${oc.personality}
  SCS类型推断：${oc.socionicsType || '未知'}
  [与其他角色关系]：${relationText}`;
}).join('\n')}
\n`;
}
// 构建“仅 OC 模式”的特殊指令
let onlyOCInstruction = '';
if (ocMode && onlyUseOC) {
  onlyOCInstruction = `\n【仅 OC 角色模式】：
该模式下，你必须**只使用**上述玩家预设的 NPC 作为所有出场角色。
- npcs 数组中**只能包含**玩家预设的这些 OC 角色，不要再额外生成任何新 NPC。
- 你需要根据他们已有的关系网、性格和 SCS 类型，构建完整的故事，不需要创造新的配角。
- 如果剧情需要路人或一次性角色，可以简单提及，但不要将他们列为有名字、有描述的正式 NPC。
\n`;            
}  
    if (!playerName.trim() || !playerProfile.trim()) return;
    
    setLoading(true);
    setLoadingPhase('Synthesizing Dimensional Reality based on Profile...');
 
    try {  
         const generateStoryPrompt = `你的核心任务不是撰写一个固定的故事，而是根据输入的【玩家角色档案】，生成一套完整的、符合SCS流派×模型A判型逻辑的、可供程序执行的多线剧情框架。

【玩家角色档案】：
代号：${playerName}
自述设定：${playerProfile}

【你的工作流程】
1. 分析档案中的关键信息（如玩家自述的性格倾向、职业、背景）。
2. 从你的“风格库”中，智能选择一个最适合该档案的剧本主风格，并融合1-2个流行叙事元素。
3. 生成一个包含【总体目标】、8个【章节】（每章有具体目标）、以及【多个可能结局条件】的完整剧情框架。不需要生成特定选项，选项将由玩家自由输入。
4. 整个框架必须严格遵循SCS模型A的判型逻辑，但所有判型意图必须隐藏在生动的剧情冲突中。
5. 最终输出为严格的JSON格式，便于前端游戏引擎解析和呈现。

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

【返回JSON结构要求】（务必返回合规且可以直接被解析的JSON代码，不要有任何markdown转义）：
{
  "game_title": "你生成的核心游戏标题",
  "world_setting": "详细的世界观背景设定",
  "overall_goal": "玩家在整个游戏中需要达成的终极目标（例如：'揭开古宅的秘密并活着离开'、'在公司内斗中上位并保护家人'）。",
  "ending_conditions": {
    "true_ending": "触发真结局的条件描述（例如：'成功揭发真凶且与关键NPC好感度均高于60'）",
    "normal_ending": "普通结局条件",
    "bad_ending": "坏结局条件"
  },
  "npcs": [
    { "name": "NPC名", "description": "NPC设定", "socionics_type_hidden": "隐含类型(例如:LSI)", "initial_affection": 50 }
  ],
  "chapters": [
    {
      "chapter_id": 1,
      "chapter_title": "第X章标题",
      "chapter_goal": "本章玩家需要达成的具体目标或面临的核心抉择（例如：'获取顾夜白的信任'、'在宫廷宴会中生存下来'）。",
      "opening_narrative": "开场叙事，将玩家代入情境",
      "scenario_description": "当下的具体场景和危机。必须促使玩家做出行动判断",
      "focus_dimension": "本章重点考察的模型A维度 (例如: 伦理 Fi/Fe)"
    }
  ] // 必须严格包含8个章节
   ${ocNpcDescription}
   ${onlyOCInstruction}
}`;

      const proxyUrl = '/api/ai-proxy';
      const apiUrlFromStorage = localStorage.getItem('apiUrl');
      const modelFromStorage = localStorage.getItem('apiModel');
      const apiKeyFromStorage = localStorage.getItem('apiKey');

      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyFromStorage}`,
        },
        body: JSON.stringify({
          targetUrl: `${apiUrlFromStorage}/chat/completions`, // 拼接为完整的 completions 地址
          model: modelFromStorage,
          messages: [{ role: 'user', content: generateStoryPrompt }],
          max_tokens: 4000,  
           temperature: 0.8,
           presence_penalty: 0.4
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to generate reality matrix.');
      }

      
      // 使用
      const storyDataString = data.choices[0].message.content;
      const cleanedContent = extractJsonFromMarkdown(storyDataString);
      const newStory = JSON.parse(cleanedContent);
      setGameStory(newStory);

      // Initialize Affection
      const initialAffection: Record<string, number> = {};
      if (newStory.npcs) {
          newStory.npcs.forEach((npc: any) => {
            initialAffection[npc.name] = npc.initial_affection;
          });
      }
      setNpcAffection(initialAffection);
      setCurrentChapterIndex(0);
      initChapter(newStory.chapters[0]);
      setScreen('chapter');
    } catch (err: any) {
      setError(err.message || 'Failed to generate reality matrix.');
    } finally {
      setLoading(false);
      setLoadingPhase('Uploading Neural Telemetry...');
    }
  };

  const initChapter = (chapter: any) => {
    setChatHistory([
      { role: 'npc', content: chapter.opening_narrative },
      { role: 'npc', content: chapter.scenario_description }
    ]);
    setLastVagueFeedback('');
    setChapterCompleted(false);
    setInputValue('');
  };

 const handleSendMessage = async () => {
  if (!inputValue.trim() || loading || chapterCompleted) return;

  const userMessage: ChatMessage = { role: 'user', content: inputValue.trim() };
  const updatedHistory = [...chatHistory, userMessage];
  setChatHistory(updatedHistory);
  setInputValue('');
  
  setLoading(true);
  setLoadingPhase('Analyzing actions and calculating responses...');

  try {
    // 从对话历史中提取上一次AI给出的世界状态追踪器
    const lastAIResponse = updatedHistory.filter(msg => msg.role === 'npc').pop();
    let currentWorldState = '';
    try {
      const lastContent = lastAIResponse?.content || '';
      const stateMatch = lastContent.match(/<!--WORLD_STATE: (.*?)-->/);
      if (stateMatch) currentWorldState = stateMatch[1];
    } catch {}

    const processActionPrompt = `你是一个TRPG游戏主持人(GM)，同时也是精通Socionics模型A的分析者。
根据玩家在当前情境下的行动描述，生成合理的剧情发展，并更新隐藏的世界状态。你的核心职责是创造引人入胜、细节丰富的叙事，同时考察玩家的认知模式。

【叙事核心指令 - 必须遵守】：
1. **展示，而非告知**：不要用一句话概括事件。请像小说一样描写场景的细节——环境氛围、人物的微表情、语气的变化、内心的迟疑。每次回复的叙事部分不少于200字。
2. **主动制造困境与冲突**：根据章节目标和NPC的性格，主动引入新的变量、突发状况或道德两难。让局势复杂化，迫使玩家做出更深刻的思考和选择。如果当前局面太平稳，你可以引入一个新的事件刺激玩家。
3. **NPC的深度互动**：NPC不会被动地等待提问。他们会根据自己的目标、性格和对玩家的好感度，主动发起对话、提出请求、隐瞒信息或试图说服玩家。
4. **节制的章节推进**：本章节的叙事容量至少需要4-6轮有意义的互动才考虑结束。只有当玩家的行动已经对核心困境产生了决定性影响，且剧情到达自然收束点时，才将 chapter_ended 设为 true。过早结束会导致故事体验单薄。



【故事大背景】:
总体目标: ${gameStory.overall_goal || '探索这个世界，书写你的命运。'}
世界设定: ${gameStory.world_setting}

【当前章节】:
第${currentChapterIndex + 1}章: ${gameStory.chapters[currentChapterIndex].chapter_title}
章节目标: ${gameStory.chapters[currentChapterIndex].chapter_goal || '应对当前局面，做出关键选择'}
背景说明: ${gameStory.chapters[currentChapterIndex].scenario_description}
本章判型维度: ${gameStory.chapters[currentChapterIndex].focus_dimension}

【玩家角色设定】:
${`[代号]: ${playerName}\n[自我评估设定]: ${playerProfile}`}

【主要NPC阵营】:
${gameStory.npcs.map((n:any) => `${n.name} (隐含类型: ${n.socionics_type_hidden}, 当前好感: ${npcAffection[n.name] || 50})`).join(', ')}

【历史对话摘要】:
${updatedHistory.map((msg:any) => `${msg.role === 'user' ? '玩家行动' : '剧情/NPC'}: ${msg.content}`).join('\n')}

【当前隐藏世界状态】:
${currentWorldState || '游戏刚开始，尚无累积状态。'}

【当前玩家行动输入】:
${userMessage.content}

请根据以上信息，执行以下任务：
1. **生成剧情反馈**：对玩家的行动做出合理的叙事回应。NPC的反应必须符合其Socionics类型特质和当前好感度。
2. **更新世界状态**：用一两句话总结当前累积的关键剧情进展（例如：'已获得书房钥匙；顾夜白好感度较低；地下室秘密尚未揭开'）。这将在后续对话中传递，用于追踪分支和结局。
3. **判断章节结束**：根据玩家行动和章节目标，判断本章是否应该结束。如果目标已达成、目标已失败、或剧情发展到了自然的转折点，请将 chapter_ended 设为 true，并提供一段章节总结。
4. **SCS分析**：分析玩家行动中体现的模型A区块特征（如Ego的自信、Super-ego的挣扎等），用于后台记录。

【返回JSON结构要求】（必须严格遵守，不要添加额外解释）：
{
  "narrative_response": "纯文本叙事，直接显示给玩家。",
  "npc_reactions": [
    { "name": "互动的NPC名", "reaction": "NPC的反应台词或行为", "affection_change": 5 }
  ],
  "world_state_update": "更新后的隐藏世界状态摘要（替换旧状态）。",
  "scs_analysis": "后台SCS分析，不显示给玩家。",
  "vague_feedback": "诗意隐喻，作为本回合系统提示。",
  "chapter_ended": false,
  "chapter_summary": "如果 chapter_ended 为 true，用一两句话总结本章关键事件和结果。否则留空。"
}`;

    const proxyUrl = '/api/ai-proxy';
    const apiUrlFromStorage = localStorage.getItem('apiUrl');
    const modelFromStorage = localStorage.getItem('apiModel');
    const apiKeyFromStorage = localStorage.getItem('apiKey');

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyFromStorage}`,
      },
      body: JSON.stringify({
        targetUrl: `${apiUrlFromStorage}/chat/completions`,
        model: modelFromStorage,
        messages: [{ role: 'user', content: processActionPrompt }],
        max_tokens: 4000,
         temperature: 0.8,
        presence_penalty: 0.4
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to process action.');

    const rawContent = data.choices[0].message.content;
    let responseData;
    try {
      responseData = extractAndRepairJson(rawContent);
    } catch (e) {
      responseData = {
        narrative_response: rawContent,
        npc_reactions: [],
        world_state_update: currentWorldState,
        scs_analysis: '',
        vague_feedback: '你的行动在混沌中激起涟漪...',
        chapter_ended: false,
        chapter_summary: ''
      };
    }

    // 将世界状态嵌入到剧情文本中（作为注释，不显示给玩家）
    const narrativeWithState = responseData.narrative_response + `\n<!--WORLD_STATE: ${responseData.world_state_update || ''}-->`;
    const newMessages: ChatMessage[] = [];
    newMessages.push({ role: 'npc', content: narrativeWithState });
    
    let consequenceText = responseData.narrative_response;
    if (responseData.npc_reactions && responseData.npc_reactions.length > 0) {
       const updatedAffection = { ...npcAffection };
       responseData.npc_reactions.forEach((reaction: any) => {
          newMessages.push({ role: 'npc', content: reaction.reaction, name: reaction.name });
          consequenceText += `\n[${reaction.name}]: ${reaction.reaction}`;
          if (reaction.affection_change) {
            updatedAffection[reaction.name] = (updatedAffection[reaction.name] || 50) + Number(reaction.affection_change);
          }
       });
       setNpcAffection(updatedAffection);
    }

    setChatHistory([...updatedHistory, ...newMessages]);
    
    if (responseData.chapter_ended === true) {
      setChapterCompleted(true);
      setLastVagueFeedback(responseData.vague_feedback || "本章节告一段落...");
      setPlayHistory([
        ...playHistory,
        {
          chapterId: gameStory.chapters[currentChapterIndex].chapter_id,
          chapterTitle: gameStory.chapters[currentChapterIndex].chapter_title,
          openingNarrative: gameStory.chapters[currentChapterIndex].opening_narrative,
          scenarioDescription: gameStory.chapters[currentChapterIndex].scenario_description,
          chatHistory: [...updatedHistory, ...newMessages],
          fullActionText: userMessage.content,
          scsAnalysis: responseData.scs_analysis || '',
          consequence: consequenceText,
          vagueFeedback: responseData.vague_feedback || ''
        }
      ]);
    } else {
      setLastVagueFeedback(responseData.vague_feedback || '');
    }

  } catch (err: any) {
    setError(err.message);
    setChatHistory(chatHistory);
    setInputValue(userMessage.content);
  } finally {
    setLoading(false);
  }
};




// ... (rest of the imports)

// ... (inside App component)

 const handleNextPhase = async () => {
  if (currentChapterIndex < gameStory.chapters.length - 1) {
    const nextIndex = currentChapterIndex + 1;
    setCurrentChapterIndex(nextIndex);
    initChapter(gameStory.chapters[nextIndex]);
  } else {
    // Game Over, Generate Report with Ending
    setLoading(true);
    setLoadingPhase('Evaluating fate threads and extracting psychological architecture...');
    try {
      // 提取最终累积的世界状态（从最后一次AI响应中获取）
      const allStateMessages = playHistory.flatMap(h => 
        h.chatHistory.filter(m => m.role === 'npc' && m.content.includes('<!--WORLD_STATE:'))
      );
      const finalWorldState = allStateMessages.length > 0 
        ? allStateMessages[allStateMessages.length - 1].content.match(/<!--WORLD_STATE: (.*?)-->/)?.[1] || ''
        : '';

      // 构建原有详细的历史记录文本
      const historyText = playHistory.map((h: any) => `
第${h.chapterId}章: ${h.chapterTitle}
玩家总行动文本: ${h.fullActionText}
后台SCS预判侧写: ${h.scsAnalysis}
剧情后果: ${h.consequence}
      `).join('\n');

      const analysisUserPrompt = `玩家初始自述：
${`[代号]: ${playerName}\n[自我评估设定]: ${playerProfile}`}

故事世界设定：
${gameStory.world_setting}
总体目标：${gameStory.overall_goal || '无特定目标'}

预设结局条件：
真结局: ${gameStory.ending_conditions?.true_ending || '无'}
普通结局: ${gameStory.ending_conditions?.normal_ending || '无'}
坏结局: ${gameStory.ending_conditions?.bad_ending || '无'}

最终累积的世界状态（关键flag与进度）：
${finalWorldState || '无明显累积状态。'}

剧情选择追踪日志与系统预判（包含SCS模型A判型依据）：
${historyText}

最终各类NPC（及其假定类型）好感度状态：
${Object.entries(npcAffection).map(([npc, score]) => `${npc}: ${score}`).join('\n')}
(极度厌恶为负值)

任务：
请你扮演一位精通SCS流派与古典模型A的Socionics专家，同时作为故事的最终讲述者。
首先，根据【最终累积的世界状态】和【预设结局条件】，判断玩家触发了哪个结局（真/普通/坏），并用一段约200字的叙事描述这个结局，将其置于报告最前面。
然后，基于上述全过程隐秘收集的数据，为玩家撰写一份深层的认知类型分析报告。

【结局描述要求】：
- 根据玩家实际达成的条件和世界状态，选择最符合的结局类型。
- 叙事风格与游戏世界观一致，具有沉浸感。

【SCS分析硬性要求】（不可丢失）：
1. 坚决排除任何MBTI词汇。必须严格使用Socionics模型A的理论术语（例如：Ego/Super-Ego/Super-Id/Id区块结构，Mental(意识轨道)/Vital(潜意识轨道)，维度高低，或信息元素符号如Ti, Te, Fe, Fi, Se, Si, Ne, Ni）。务必注意使用scs的判断方式，分析功能在模型中的位置（而不是单纯看强度）。
2. 文字风格必须是一位深邃、客观的专家在进行人格解构，带有赛博朋克深层剖析的氛围。不要输出直白的数字评分或轻浮的网发言论。
3. 玩家在游玩时输入了自由文本。请根据他们的轨迹：
   - 评估其在处理困境时，哪些信息元素表现出了高维度（3D/4D，游刃有余、创新），哪些落在了痛点区块（如Super-Ego的一维/二维限制）。
   - 对比【玩家初始自述】和【实际行为】，指出其自我认知与模型A本我/超我区块可能存在的落差。
   - 类间关系反推：依据玩家与NPC互动导致的最终好感度数值关系，推断该玩家与这些NPC的类间关系（例如：对偶、激活、监督、冲突等），以佐证玩家最终可能的类型。
4. 在报告的最后，给出1-2种最有根据的可能社会人格类型（如 ILI，EIE等全称缩写），并给出其心理认知结构上的发展建议。

【输出格式】：
请直接输出评测长文，包含结局描述和SCS分析。可用Markdown小标题（如“## 最终结局”、“## 深层人格结构解析”）区分两部分。分析报告正文字数请保持在1000-2500字之间。`;

      const proxyUrl = '/api/ai-proxy';
      const apiUrlFromStorage = localStorage.getItem('apiUrl');
      const modelFromStorage = localStorage.getItem('apiModel');
      const apiKeyFromStorage = localStorage.getItem('apiKey');

      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyFromStorage}`,
        },
        body: JSON.stringify({
          targetUrl: `${apiUrlFromStorage}/chat/completions`,
          model: modelFromStorage,
          messages: [
            { role: "system", content: systemPromptContent },
            { role: "user", content: analysisUserPrompt }
          ],
          max_tokens: 4000   // 确保足够输出长文
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to generate analysis.');
      }

      const fullReport = data.choices[0].message.content;
      setFinalReport(fullReport);
      setScreen('report');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
};

  const handleExportStory = () => {
    let content = `=================================\n`;
    content += `    《${gameStory.game_title}》 - 完整故事记录\n`;
    content += `=================================\n`;
    content += `玩家代号：${playerName}\n`;
    content += `自述性格：${playerProfile}\n`;
    content += `世界设定：${gameStory.world_setting}\n`;
    content += `---------------------------------\n\n`;

    playHistory.forEach((item, index) => {
      content += `【第${index + 1}章：${item.chapterTitle}】\n\n`;
      content += `${item.openingNarrative}\n\n`;
      content += `${item.scenarioDescription}\n\n`;
      content += `★ 此时，你决定：\n${item.fullActionText}\n\n`;
      content += `> ${item.consequence.replace(/\n/g, '\n> ')}\n\n`;
      content += `[ ${item.vagueFeedback} ]\n\n`;
      if (index < playHistory.length - 1) {
          content += `---------------------------------\n\n`;
      }
    });

    content += `=================================\n`;
    content += `【最终分析报告】\n\n`;
    if (finalReport) {
      let cleanReport = finalReport.replace(/\*\*/g, '').replace(/#/g, '');
      content += `${cleanReport}\n\n`;
    }
    content += `=================================\n`;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateString = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    content += `生成时间：${dateString}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `我的SCS之旅_${playerName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Listen for Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans p-6 flex flex-col gap-4">
      {/* HEADER */}
      <header className="flex justify-between items-center h-12 px-4 glass shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center font-bold text-slate-900 accent-glow">
             <TerminalSquare className="w-4 h-4" />
          </div>
          <div>
             <h1 className="text-sm font-bold tracking-tight text-white">{gameStory ? gameStory.game_title : 'SOC_ECHOES'} <span className="font-normal opacity-50">| 临界分析仪</span></h1>
          </div>
        </div>
        <div className="hidden md:flex gap-6 items-center">
            {screen !== 'create' && screen !== 'report' && (
                <div className="text-right text-[10px]">
                    <div className="stat-label">阶段节点</div>
                    <div className="text-cyan-400 font-medium">Phase {String(currentChapterIndex + 1).padStart(2, '0')}</div>
                </div>
            )}
            <div className="h-6 w-px bg-white/10"></div>
            <div className="text-right text-[10px]">
                <div className="stat-label">API Status</div>
                <div className="text-green-400 font-medium tracking-widest">CONNECTED</div>
            </div>
        </div>
      </header>

      {/* LOADING OVERLAY */}
      {loading && screen !== 'chapter' && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-4 accent-glow rounded-full" />
          <div className="stat-label text-cyan-400">
            {loadingPhase}
          </div>
        </div>
      )}

      {error && (
        <div className="glass bg-red-500/10 border-red-500/30 p-4 shrink-0">
          <div className="flex items-center gap-2 mb-1 text-red-400">
             <AlertCircle className="w-4 h-4" />
             <span className="stat-label !text-red-400">Error Encountered</span>
          </div>
          <p className="text-sm text-red-200/80 mb-2">{error}</p>
          <div className="flex gap-4">
            <button className="stat-label !text-red-300 hover:!text-red-200" onClick={() => setError(null)}>Dismiss</button>
            {error.includes('API request failed') && (
              <button className="stat-label !text-cyan-300 hover:!text-cyan-200" onClick={() => {
                localStorage.removeItem('apiKey');
                localStorage.removeItem('apiUrl');
                localStorage.removeItem('apiModel');
                window.location.reload();
              }}>重新配置 API</button>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 glass overflow-hidden flex flex-col relative w-full max-w-5xl mx-auto h-full min-h-0">
        
        {screen === 'create' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 flex flex-col justify-center max-w-3xl mx-auto w-full">
            <div className="text-center mb-8">
               <BrainCircuit className="w-12 h-12 text-cyan-500 mx-auto opacity-80 mb-4 accent-glow" />
               <h2 className="text-2xl font-bold text-white tracking-tight">SCS 临界现实生成引擎</h2>
               <p className="text-sm text-slate-400 mt-2">提供你的基本侧写。架构师系统将为你编织一组定制的多维困境与世界线。</p>
            </div>

            <div className="glass p-6 md:p-8 bg-black/20 relative overflow-hidden">
               <h2 className="stat-label mb-6 text-cyan-400 border-b border-white/10 pb-2">录入人格特征锚点 (Input Profile)</h2>
               <div className="space-y-6">
                 <div>
                   <label className="block stat-label mb-2">Identification [代号 / 职业角色]</label>
                   <input
                     type="text"
                     className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-200 placeholder:opacity-30 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 font-mono transition-all"
                     placeholder="例：亚瑟 - 边缘世界的赛博医生 ； 或：李明 - 普通的大学转校生"
                     value={playerName}
                     onChange={e => setPlayerName(e.target.value)}
                   />
                 </div>
                 <div>
                   <label className="block stat-label mb-2">Psychological Profile [性格设定与核心执念]</label>
                   <textarea
                     className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-200 placeholder:opacity-30 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none leading-relaxed"
                     placeholder="描述你的核心处事原则、底线，或你引以为傲的性格特征。例如：‘极其渴望打破束缚，向往远方，但又有些优柔寡断。重情义但讨厌被道德绑架。’ --- 系统将据此自动融合【风格元素库】，展开高度贴合甚至反套路的专属世界线..."
                     value={playerProfile}
                     onChange={e => setPlayerProfile(e.target.value)}
                   />
                 </div>
               </div>
               {/* OC 模式开关 */}
<div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6">
  <div className="flex items-center gap-3">
    <input 
      type="checkbox" 
      id="oc-mode" 
      checked={ocMode} 
      onChange={(e) => setOcMode(e.target.checked)} 
      className="w-4 h-4 accent-cyan-500"
    />
    <label htmlFor="oc-mode" className="text-sm text-cyan-300 cursor-pointer">
      启用 OC 模式（导入已保存的原创角色作为 NPC）
    </label>
  </div>

  {/* OC 多选列表 */}
  {ocMode && (
    <div className="ml-7 space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
          {/* ========== 新增的“仅使用 OC 角色”复选框放在这里 ========== */}
      <label className="flex items-center gap-2 text-sm text-slate-400 border-b border-white/5 pb-3 mb-2">
        <input 
          type="checkbox" 
          checked={onlyUseOC} 
          onChange={(e) => setOnlyUseOC(e.target.checked)} 
          className="w-4 h-4 accent-cyan-500"
        />
        仅使用这些 OC 角色（不额外生成 NPC）
      </label>
      <p className="text-xs text-slate-500 -mt-2 mb-4 ml-6">
        勾选后，游戏中只会出现你选择的角色，AI 不会再自动添加其他 NPC。
      </p>
      {/* ========== 新增结束 ========== */}
      <p className="text-xs text-slate-400 mb-3">勾选需要导入为 NPC 的角色：</p>
      {getOCList().map((oc: OCCharacter) => (
        <label key={oc.id} className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
          <input 
            type="checkbox" 
            checked={selectedOCs.includes(oc.id)} 
            onChange={(e) => {
              if(e.target.checked) {
                setSelectedOCs([...selectedOCs, oc.id]);
              } else {
                setSelectedOCs(selectedOCs.filter(id => id !== oc.id));
              }
            }} 
            className="w-4 h-4 accent-cyan-500"
          />
          {oc.avatar && (
            <img src={oc.avatar} alt={oc.name} className="w-10 h-10 rounded-full object-cover border border-cyan-500/30" />
          )}
          <div>
            <span className="text-cyan-200 font-medium">{oc.name}</span>
            {oc.socionicsType && (
              <span className="text-xs text-slate-400 ml-2">({oc.socionicsType})</span>
            )}
            {oc.relations && oc.relations.length > 0 && (
              <span className="text-xs text-slate-500 block mt-0.5">
                关系：{oc.relations.map(r => `${r.relation}:${r.targetName}`).join('、')}
              </span>
            )}
          </div>
        </label>
      ))}
      {getOCList().length === 0 && (
        <p className="text-xs text-slate-500 italic">暂无已保存的 OC 角色，请先在 OC 管理器中创建。</p>
      )}
    </div>
  )}
</div>
               <div className="mt-8 flex justify-end">
                   <button
                     onClick={handleStartGame}
                     disabled={!playerName.trim() || !playerProfile.trim()}
                     className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all accent-glow flex items-center justify-center gap-2 w-full md:w-auto"
                   >
                     Initiate Sequence
                   </button>
               </div>
            </div>
          </div>
        )}

        {screen === 'chapter' && gameStory && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Chapter Header */}
                <div className="shrink-0 p-6 border-b border-white/5 bg-black/20">
                   <div className="flex flex-col gap-1">
                     <span className="stat-label text-cyan-500/50">Phase_{String(currentChapterIndex + 1).padStart(2, '0')}</span>
                     <h2 className="text-xl font-bold text-white tracking-tight">{gameStory.chapters[currentChapterIndex].chapter_title}
                     <button
                            onClick={() => setReviewChapterIndex(currentChapterIndex)}
                           className="text-xs text-cyan-400 hover:text-cyan-300 underline ml-4"
                    >
                      回顾本章
                    </button>
                     </h2>
                   </div>
                </div>

                {/* Chat Log Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'npc' ? (
                                <div className="max-w-[85%] flex flex-col gap-1 items-start">
                                    {msg.name ? (
                                        <span className="text-[10px] text-cyan-400 uppercase tracking-widest ml-4 font-bold">{msg.name}</span>
                                    ) : (
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">NARRATIVE LOG</span>
                                    )}
                                    <div className={`glass px-5 py-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.name ? 'bg-cyan-950/20 border-cyan-500/20 text-cyan-50' : 'bg-transparent border-transparent text-slate-400 text-center mx-auto'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-[85%] flex flex-col gap-1 items-end">
                                    <span className="text-[10px] text-cyan-600 uppercase tracking-widest mr-4">{playerName}</span>
                                    <div className="glass px-5 py-4 rounded-2xl rounded-tr-sm bg-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap border-slate-700/50">
                                        {msg.content}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="flex w-full justify-start items-center gap-3 p-4">
                            <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                            <span className="text-xs text-cyan-500/50 font-mono">{loadingPhase}</span>
                        </div>
                    )}
                    
                    {/* Completion Feedback */}
                    {chapterCompleted && (
                        <div className="w-full flex flex-col items-center justify-center mt-8 py-8 border-t border-white/5 gap-6">
                            <p className="text-sm font-medium text-cyan-300 italic">
                                [ {lastVagueFeedback} ]
                            </p>
                            <button
                                onClick={handleNextPhase}
                                className="bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-900 border border-cyan-500/50 px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                {currentChapterIndex < gameStory.chapters.length - 1 ? '推进时空序列 [Next Phase]' : '核心解码 [Analyze Sequence]'}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div ref={chatBottomRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="shrink-0 p-4 border-t border-white/5 bg-black/40">
                    <div className="relative flex items-end w-full max-w-4xl mx-auto gap-2">
                         <div className="bg-slate-800/50 border border-white/10 rounded-2xl flex-1 flex flex-col focus-within:border-cyan-500/50 focus-within:bg-slate-800 transition-colors">
                             <div className="px-4 py-2 border-b border-white/5 opacity-50 flex items-center gap-2">
                                <User className="w-3 h-3" />
                                <span className="text-[10px] font-mono tracking-widest uppercase">你要怎么做？（行动、对话或思考）</span>
                             </div>
                             <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading || chapterCompleted}
                                placeholder="..."
                                className="w-full bg-transparent text-sm text-slate-200 p-4 outline-none resize-none min-h-[80px] disabled:opacity-50"
                             />
                         </div>
                         <button
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || loading || chapterCompleted}
                            className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 p-4 rounded-xl transition-colors h-[80px] w-[80px] flex items-center justify-center shrink-0 mb-[2px]"
                         >
                            <Send className="w-6 h-6" />
                         </button>
                    </div>
                </div>
            </div>
        )}

        {screen === 'report' && finalReport && (
             <div className="flex-1 overflow-y-auto p-6 md:p-10">
               <div className="max-w-3xl mx-auto">
                   <div className="glass p-6 text-center mb-8 bg-black/20">
                     <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500 flex items-center justify-center text-slate-900 accent-glow mb-4">
                        <TerminalSquare className="w-6 h-6" />
                     </div>
                     <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mb-2">深层人格结构解析</h2>
                     <p className="stat-label text-cyan-400">SCS_MODEL_A / FINAL_CLASSIFICATION</p>
                   </div>

                   <div className="glass p-6 md:p-10 bg-black/20">
                     <div className="react-markdown-wrapper text-slate-300 leading-relaxed prose prose-invert max-w-none prose-headings:font-bold prose-h3:text-cyan-400 prose-h3:mt-8 prose-h3:mb-4 prose-h3:uppercase prose-h3:tracking-widest prose-h3:text-sm prose-p:mb-6 prose-strong:text-cyan-300 prose-a:text-cyan-400 text-sm">
                        <ReactMarkdown>{finalReport}</ReactMarkdown>
                     </div>
                   </div>
                   
                   <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-4">
                     <button 
                      onClick={handleExportStory}
                      className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 border-none outline-none font-bold text-[10px] uppercase tracking-widest transition-colors rounded-full flex gap-2 items-center shadow-[0_0_15px_rgba(34,211,238,0.2)] focus:ring-2 focus:ring-cyan-500/50"
                     >
                       <Download className="w-4 h-4" />
                       📄 导出我的故事 (TXT)
                     </button>
                     <button 
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 text-slate-400 hover:text-cyan-400 stat-label transition-colors glass bg-white/5 border border-white/10 rounded-full focus:ring-2 focus:ring-cyan-500/50"
                     >
                       Initiate Reboot Sequence
                     </button>
                   </div>
               </div>
             </div>
        )}

      </main>
      {reviewChapterIndex !== null && (
  <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-start p-4">
    <div className="glass w-full max-w-2xl h-[80vh] p-6 overflow-y-auto mt-10">
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold text-cyan-400">
          回顾：{playHistory[reviewChapterIndex]?.chapterTitle || '未知章节'}
        </h3>
        <button
          className="text-red-400 text-sm"
          onClick={() => setReviewChapterIndex(null)}
        >
          关闭
        </button>
      </div>
      <div className="space-y-4">
        {playHistory[reviewChapterIndex]?.chatHistory.map((msg: any, idx: number) => (
          <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            {msg.name && <div className="text-xs text-cyan-300 mb-1">{msg.name}</div>}
            <div className={`inline-block p-3 rounded-lg max-w-[80%] text-sm whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-slate-800 text-slate-200' 
                : 'bg-cyan-950/30 text-cyan-50 border border-cyan-500/20'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
    </div>
  );
}
