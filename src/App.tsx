import React, { useState, useEffect, useRef } from 'react';
import { TerminalSquare, AlertCircle, Loader2, ChevronRight, Download, BrainCircuit, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './index.css';
import { jsonrepair } from 'jsonrepair'
import { getOCList, importOCs, type OCCharacter } from './ocStorage';
import OCManager from './OCManager';
import { buildGenerateStoryPrompt, buildProcessActionPrompt } from './prompts';
import type { ChatMessage, HistoryItem, Screen, TurnSCSAnalysis, WorldState } from './storyTypes';
import {
  buildStructuredHistoryText,
  formatTurnSCSAnalysisForExport,
  formatTurnSCSAnalysisTimeline,
  sanitizeTurnSCSAnalysis,
  summarizeTurnSCSAnalysis,
} from './scsAnalysis';
import {
  createDefaultWorldState,
  formatChapterStoryForExport,
  formatChapterTranscriptForExport,
  formatWorldStateForExport,
  sanitizeWorldState,
  stripWorldStateComment,
  summarizeFactionStandings,
  summarizeRouteScores,
  summarizeWorldState,
} from './worldState';

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

function validateChapterEnding(
  suggestedEnded: boolean,
  userTurnCount: number,
  nextWorldState: WorldState,
  chapterSummary: string,
) {
  const hasMeaningfulStateChange =
    nextWorldState.goal_progress >= 65 ||
    nextWorldState.chapter_goal_status !== 'ongoing' ||
    nextWorldState.unresolved_threads.length > 0 ||
    nextWorldState.revealed_secrets.length > 0 ||
    nextWorldState.global_flags.length > 0;

  const hasSummary = chapterSummary.trim().length >= 20;
  const enoughTurns = userTurnCount >= 4;
  const hardGoalReached = nextWorldState.chapter_goal_status === 'success' || nextWorldState.chapter_goal_status === 'failure';

  return suggestedEnded && hasSummary && ((enoughTurns && hasMeaningfulStateChange) || hardGoalReached);
}

type TimSlot = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

interface TimStructure {
  code: string;
  functions: Record<TimSlot, string>;
}

interface CandidateAnalysis {
  primary_type: string;
  secondary_type?: string;
  reasoning_summary?: string;
  behavior_evidence?: string[];
  dcnh_guess?: string;
  conscious_patterns?: string[];
  vital_patterns?: string[];
}

const ANALYSIS_SYSTEM_PROMPT = `你是一位严格遵循SCS（古典社会人格学）与模型A理论的分析专家。
你的任务分为两步：先基于玩家行为给出候选TIM，再基于程序提供的锁定事实撰写报告。
你绝对不得引用资料库之外的理论，不得混入MBTI、荣格八维影子功能或自创功能组合。
如果程序已经给出了锁定的区块结构、维度和类间关系，你必须完全以这些锁定事实为准，不得改写。
你绝对不能因为玩家单次表现出某个信息元素，就直接断定其主导、创造或最终类型；必须结合行为的稳定性、熟练度、代价感、压力环境和跨章节重复模式进行判断。`;

function normalizeTimCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const match = raw.toUpperCase().match(/\b[A-Z]{3}\b/);
  return match ? match[0] : '';
}

function parseTimDictionary(theoryText: string): Record<string, TimStructure> {
  const dictionary: Record<string, TimStructure> = {};
  const pattern =
    /^([A-Z]{3}):\s*\{\s*1:([A-Za-z]+),\s*2:([A-Za-z]+),\s*3:([A-Za-z]+),\s*4:([A-Za-z]+),\s*5:([A-Za-z]+),\s*6:([A-Za-z]+),\s*7:([A-Za-z]+),\s*8:([A-Za-z]+)\s*\}$/gm;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(theoryText)) !== null) {
    dictionary[match[1]] = {
      code: match[1],
      functions: {
        '1': match[2],
        '2': match[3],
        '3': match[4],
        '4': match[5],
        '5': match[6],
        '6': match[7],
        '7': match[8],
        '8': match[9],
      },
    };
  }

  return dictionary;
}

function parseIntertypeRelations(theoryText: string): Record<string, Record<string, string>> {
  const relations: Record<string, Record<string, string>> = {};
  const startMarker = '查询规则：找到玩家的类型';
  const endMarker = '4.2 SCS对特定关系的独特理解';
  const startIndex = theoryText.indexOf(startMarker);
  const endIndex = theoryText.indexOf(endMarker);
  const relevantText =
    startIndex >= 0
      ? theoryText.slice(startIndex, endIndex >= 0 ? endIndex : theoryText.length)
      : theoryText;

  relevantText.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!/^[A-Z]{3}:/.test(trimmed)) return;

    const [playerType, rawMappings] = trimmed.split(':');
    if (!playerType || !rawMappings) return;

    const mapping: Record<string, string> = {};
    rawMappings.split(/[，,]\s*/).forEach((entry) => {
      const normalizedEntry = entry.trim();
      const errataMatch = normalizedEntry.match(/[（(]\s*应为\s*([^）)]+)\s*[）)]/);
      const baseEntry = normalizedEntry.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim();
      let cleanEntry = baseEntry;

      if (errataMatch) {
        const correctedEntry = errataMatch[1].trim();
        if (/^.+?[A-Z]{3}$/.test(correctedEntry)) {
          cleanEntry = correctedEntry;
        } else {
          const originalRelationMatch = baseEntry.match(/^(.+?)([A-Z]{3})$/);
          const correctedType = normalizeTimCode(correctedEntry);
          if (originalRelationMatch && correctedType) {
            cleanEntry = `${originalRelationMatch[1]}${correctedType}`;
          }
        }
      }

      const match = cleanEntry.match(/^(.+?)([A-Z]{3})$/);
      if (!match) return;
      mapping[match[2]] = match[1].trim();
    });

    relations[playerType.trim()] = mapping;
  });

  return relations;
}

function buildTypeFacts(typeCode: string, dictionary: Record<string, TimStructure>) {
  const profile = dictionary[typeCode];
  if (!profile) return null;

  return {
    type: typeCode,
    ego: `${profile.functions['1']} + ${profile.functions['2']}`,
    superEgo: `${profile.functions['3']} + ${profile.functions['4']}`,
    superId: `${profile.functions['5']} + ${profile.functions['6']}`,
    id: `${profile.functions['7']} + ${profile.functions['8']}`,
    dimensions: {
      [profile.functions['1']]: '4D',
      [profile.functions['2']]: '3D',
      [profile.functions['3']]: '2D',
      [profile.functions['4']]: '1D',
      [profile.functions['5']]: '1D',
      [profile.functions['6']]: '2D',
      [profile.functions['7']]: '3D',
      [profile.functions['8']]: '4D',
    },
    slots: profile.functions,
  };
}

function buildNpcRelationFacts(
  playerType: string,
  npcs: any[],
  npcAffection: Record<string, number>,
  relationMap: Record<string, Record<string, string>>,
) {
  const relationsForType = relationMap[playerType] || {};
  return npcs.map((npc) => {
    const npcType = normalizeTimCode(npc.socionics_type_hidden);
    return {
      npc_name: npc.name,
      npc_type: npcType || npc.socionics_type_hidden || '未知',
      affection: npcAffection[npc.name] ?? npc.initial_affection ?? 50,
      relation: npcType ? relationsForType[npcType] || '未知' : '未知',
    };
  });
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
  const [currentWorldState, setCurrentWorldState] = useState<WorldState>(createDefaultWorldState());
  
  // Chat State for Current Chapter
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentChapterActionLog, setCurrentChapterActionLog] = useState<string[]>([]);
  const [currentChapterTurnAnalyses, setCurrentChapterTurnAnalyses] = useState<TurnSCSAnalysis[]>([]);
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
const [showOCManager, setShowOCManager] = useState(false); // oc编辑器
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
         const generateStoryPrompt = buildGenerateStoryPrompt({
          playerName,
          playerProfile,
          ocNpcDescription,
          onlyOCInstruction,
        });

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
      const initialWorldState = sanitizeWorldState(newStory.initial_world_state);
      setCurrentWorldState(initialWorldState);
      setCurrentChapterIndex(0);
      initChapter(newStory.chapters[0], initialWorldState);
      setScreen('chapter');
    } catch (err: any) {
      setError(err.message || 'Failed to generate reality matrix.');
    } finally {
      setLoading(false);
      setLoadingPhase('Uploading Neural Telemetry...');
    }
  };

  const initChapter = (chapter: any, worldStateOverride?: WorldState) => {
    const activeWorldState = worldStateOverride ?? currentWorldState;
    const carryoverLines: string[] = [];

    if (activeWorldState.chapter_memory) {
      carryoverLines.push(`上一阶段余波：${activeWorldState.chapter_memory}`);
    }
    if (activeWorldState.current_pressure) {
      carryoverLines.push(`当前外部压力：${activeWorldState.current_pressure}`);
    }
    if (activeWorldState.unresolved_threads.length > 0) {
      carryoverLines.push(`尚未解决的线索/冲突：${activeWorldState.unresolved_threads.join('；')}`);
    }
    if (activeWorldState.active_routes.length > 0) {
      carryoverLines.push(`当前已成形的路线倾向：${activeWorldState.active_routes.join('；')}`);
    }
    if (Object.keys(activeWorldState.route_scores).length > 0) {
      carryoverLines.push(`路线强度分布：${summarizeRouteScores(activeWorldState.route_scores)}`);
    }
    if (Object.keys(activeWorldState.faction_standings).length > 0) {
      carryoverLines.push(`主要阵营立场：${summarizeFactionStandings(activeWorldState.faction_standings)}`);
    }

    const initialMessages: ChatMessage[] = [{ role: 'npc', content: chapter.opening_narrative }];
    if (carryoverLines.length > 0) {
      initialMessages.push({
        role: 'npc',
        content: `承接前情：\n${carryoverLines.join('\n')}`,
      });
    }
    initialMessages.push({ role: 'npc', content: chapter.scenario_description });

    setChatHistory(initialMessages);
    setCurrentChapterActionLog([]);
    setCurrentChapterTurnAnalyses([]);
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
    const userTurnCount = updatedHistory.filter((msg) => msg.role === 'user').length;
    const processActionPrompt = buildProcessActionPrompt({
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
    });

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
        temperature: 0.55,
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
        scs_analysis: { summary: '' },
        vague_feedback: '你的行动在混沌中激起涟漪...',
        chapter_ended: false,
        chapter_summary: ''
      };
    }

    const structuredTurnAnalysis = sanitizeTurnSCSAnalysis(responseData.scs_analysis);
    const turnAnalysisSummary = summarizeTurnSCSAnalysis(structuredTurnAnalysis);
    const nextChapterActionLog = [...currentChapterActionLog, userMessage.content];
    const nextChapterTurnAnalyses = [...currentChapterTurnAnalyses, structuredTurnAnalysis];
    const nextWorldState = sanitizeWorldState(responseData.world_state_update);
    const shouldEndChapter = validateChapterEnding(
      Boolean(responseData.chapter_ended),
      userTurnCount,
      nextWorldState,
      responseData.chapter_summary || '',
    );

    const newMessages: ChatMessage[] = [];
    newMessages.push({ role: 'npc', content: responseData.narrative_response });
    
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

    setCurrentWorldState(nextWorldState);
    setChatHistory([...updatedHistory, ...newMessages]);
    setCurrentChapterActionLog(nextChapterActionLog);
    setCurrentChapterTurnAnalyses(nextChapterTurnAnalyses);
    
    if (shouldEndChapter) {
      setChapterCompleted(true);
      setLastVagueFeedback(responseData.vague_feedback || "本章节告一段落...");
      setPlayHistory((previousHistory) => [
        ...previousHistory,
        {
          chapterId: gameStory.chapters[currentChapterIndex].chapter_id,
          chapterTitle: gameStory.chapters[currentChapterIndex].chapter_title,
          openingNarrative: gameStory.chapters[currentChapterIndex].opening_narrative,
          scenarioDescription: gameStory.chapters[currentChapterIndex].scenario_description,
          chatHistory: [...updatedHistory, ...newMessages],
          playerActionLog: nextChapterActionLog,
          fullActionText: nextChapterActionLog.join('\n'),
          scsAnalysis: turnAnalysisSummary,
          scsAnalysisStructured: structuredTurnAnalysis,
          turnAnalyses: nextChapterTurnAnalyses,
          consequence: consequenceText,
          vagueFeedback: responseData.vague_feedback || '',
          chapterSummary: responseData.chapter_summary || '',
          worldStateAfter: nextWorldState
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
    initChapter(gameStory.chapters[nextIndex], currentWorldState);
  } else {
    // Game Over, Generate Report with Ending
    setLoading(true);
    setLoadingPhase('Evaluating fate threads and extracting psychological architecture...');
    try {
      const historyText = buildStructuredHistoryText(playHistory);

      if (!systemPromptContent.trim()) {
        throw new Error('SCS 理论资料库尚未加载完成，请稍后重试。');
      }

      const timDictionary = parseTimDictionary(systemPromptContent);
      const relationDictionary = parseIntertypeRelations(systemPromptContent);

      if (Object.keys(timDictionary).length === 0) {
        throw new Error('SCS 理论资料库中的 TIM 字典解析失败。');
      }

      const baseAnalysisContext = `玩家初始自述：
${`[代号]: ${playerName}\n[自我评估设定]: ${playerProfile}`}

故事世界设定：
${gameStory.world_setting}
总体目标：${gameStory.overall_goal || '无特定目标'}

预设结局条件：
真结局: ${gameStory.ending_conditions?.true_ending || '无'}
普通结局: ${gameStory.ending_conditions?.normal_ending || '无'}
坏结局: ${gameStory.ending_conditions?.bad_ending || '无'}

最终累积的世界状态（关键flag与进度）：
${summarizeWorldState(currentWorldState)}

最终路线历史：
${currentWorldState.route_history.length > 0 ? currentWorldState.route_history.join('\n') : '无明确路线偏移记录。'}

当前活跃路线：
${currentWorldState.active_routes.length > 0 ? currentWorldState.active_routes.join('；') : '无明确活跃路线。'}

路线分值：
${Object.keys(currentWorldState.route_scores).length > 0 ? summarizeRouteScores(currentWorldState.route_scores) : '无明确路线分值。'}

关键选择日志：
${currentWorldState.choice_log.length > 0 ? currentWorldState.choice_log.join('\n') : '无关键选择摘要。'}

阵营立场：
${Object.keys(currentWorldState.faction_standings).length > 0
  ? summarizeFactionStandings(currentWorldState.faction_standings)
  : '无明确阵营偏向。'}

剧情选择追踪日志与系统预判（包含SCS模型A判型依据）：
${historyText}

最终各类NPC（及其假定类型）好感度状态：
${Object.entries(npcAffection).map(([npc, score]) => `${npc}: ${score}`).join('\n')}
(极度厌恶为负值)

NPC 隐含类型清单：
${gameStory.npcs.map((npc: any) => `${npc.name}: ${npc.socionics_type_hidden || '未知'}`).join('\n')}`;

      const candidatePrompt = `${baseAnalysisContext}

任务：
你现在只做第一阶段判断：基于以上玩家行为，从理论资料库中筛选最可能的候选 TIM。
要求：
1. 只能输出 JSON，不要输出 Markdown，不要写解释性前言。
2. primary_type 与 secondary_type 必须是资料库中存在的三字母代码。
3. 不要自行生成区块组合，不要自行推导类间关系，不要使用MBTI表述。
4. reasoning_summary 只总结“为什么是这两个候选类型”。
5. 不要因为单个回合里出现某种 Ti/Fe/Se/Ne 风格就直接定主导；请优先依据跨章节重复模式、熟练度、代价感和压力环境来筛选候选。

JSON 格式如下：
{
  "primary_type": "ILI",
  "secondary_type": "IEI",
  "reasoning_summary": "50-120字的候选判断摘要",
  "behavior_evidence": ["证据1", "证据2", "证据3"],
  "dcnh_guess": "N",
  "conscious_patterns": ["意识功能特征1", "意识功能特征2"],
  "vital_patterns": ["生机功能特征1", "生机功能特征2"]
}`;

      const proxyUrl = '/api/ai-proxy';
      const apiUrlFromStorage = localStorage.getItem('apiUrl');
      const modelFromStorage = localStorage.getItem('apiModel');
      const apiKeyFromStorage = localStorage.getItem('apiKey');

      const candidateRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyFromStorage}`,
        },
        body: JSON.stringify({
          targetUrl: `${apiUrlFromStorage}/chat/completions`,
          model: modelFromStorage,
          messages: [
            { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
            { role: 'system', content: `以下内容是唯一允许引用的 SCS 理论资料库，请只以此为准：\n\n${systemPromptContent}` },
            { role: 'user', content: candidatePrompt },
          ],
          temperature: 0.1,
          max_tokens: 1200,
        }),
      });

      const candidateData = await candidateRes.json();
      if (!candidateRes.ok) {
        throw new Error(candidateData.error?.message || 'Failed to infer TIM candidates.');
      }

      const rawCandidateContent = candidateData.choices?.[0]?.message?.content || '';
      const parsedCandidates = extractAndRepairJson(rawCandidateContent) as CandidateAnalysis;
      const primaryType = normalizeTimCode(parsedCandidates.primary_type);
      const secondaryType = normalizeTimCode(parsedCandidates.secondary_type);

      if (!primaryType || !timDictionary[primaryType]) {
        throw new Error('AI 未返回可识别的主候选 TIM。');
      }

      const lockedPrimaryFacts = buildTypeFacts(primaryType, timDictionary);
      const lockedSecondaryFacts =
        secondaryType && timDictionary[secondaryType] ? buildTypeFacts(secondaryType, timDictionary) : null;
      const primaryNpcRelations = buildNpcRelationFacts(primaryType, gameStory.npcs || [], npcAffection, relationDictionary);
      const secondaryNpcRelations = secondaryType
        ? buildNpcRelationFacts(secondaryType, gameStory.npcs || [], npcAffection, relationDictionary)
        : [];

      const analysisUserPrompt = `${baseAnalysisContext}

任务：
你现在进入第二阶段：撰写最终结局与深层人格分析报告。
首先，根据【最终累积的世界状态】和【预设结局条件】，判断玩家触发了哪个结局（真/普通/坏），并用一段约200字的叙事描述这个结局，将其置于报告最前面。
然后，基于“候选判断”与“程序查表锁定事实”，撰写深层分析报告。

【第一阶段候选判断（供你参考，不可越界扩写）】：
${JSON.stringify(parsedCandidates, null, 2)}

【程序根据理论资料库锁定的事实 - 绝对不得修改】：
${JSON.stringify(
  {
    primary_candidate: lockedPrimaryFacts,
    secondary_candidate: lockedSecondaryFacts,
    primary_candidate_npc_relations: primaryNpcRelations,
    secondary_candidate_npc_relations: secondaryNpcRelations,
  },
  null,
  2,
)}

【结局描述要求】：
- 根据玩家实际达成的条件和世界状态，选择最符合的结局类型。
- 叙事风格与游戏世界观一致，具有沉浸感。

【SCS分析硬性要求】（不可丢失）：
1. 坚决排除任何MBTI词汇。必须严格使用Socionics模型A理论术语。
2. 最终采用的区块结构、维度映射、类间关系，必须完全来自“程序锁定事实”，不得自行改写。
3. 你只能在 primary_type 与 secondary_type 中做最终排序，不得提出第三个新类型。
4. 对比【玩家初始自述】和【实际行为】，指出其自我认知与模型A区块可能存在的落差。
5. 类间关系分析时，必须直接引用程序已给出的 NPC 关系结果，不得根据好感度自由脑补关系名称。
6. 不能把“表现出Ti/Fe/Se”等单次行为，直接等同于主导功能；必须说明这种表现更像是高维熟练调用、低维应激补偿、角色功能适应，还是其他位置的阶段性动员。
7. 必须结合剧情记录中的“意识/生机线索”、“角色功能起手”、“激活功能与薄弱功能联动”、“压力代价感”来论证，而不是只罗列功能名。
8. 在报告结尾给出温和、专业的发展建议，并强调“本次分析基于游戏行为模式，仅供参考”。

【输出格式】：
请直接输出评测长文，包含结局描述和SCS分析。可用Markdown小标题（如“## 最终结局”、“## 深层人格结构解析”）区分两部分。
报告中必须明确写出：
- 最终最可能类型
- 次可能类型
- 自述 vs 实际行为 对照
- Ego / Super-Ego / Super-Id / Id
- 意识功能 vs 生机功能线索
- 角色功能起手与压力代价
- 激活功能与薄弱功能联动
- 与关键NPC的类间关系解读
- DCNH亚型推断
- 发展建议`;

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
            { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
            { role: 'system', content: `以下内容是唯一允许引用的 SCS 理论资料库，请只以此为准：\n\n${systemPromptContent}` },
            { role: 'user', content: analysisUserPrompt },
          ],
          temperature: 0.1,
          max_tokens: 4000,
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
    content += `    《${gameStory.game_title}》 - 双版本导出\n`;
    content += `=================================\n`;
    content += `玩家代号：${playerName}\n`;
    content += `自述性格：${playerProfile}\n`;
    content += `世界设定：${gameStory.world_setting}\n`;
    if (gameStory.overall_goal) {
      content += `总体目标：${gameStory.overall_goal}\n`;
    }
    content += `---------------------------------\n\n`;

    content += `=================================\n`;
    content += `【纯剧情版】\n`;
    content += `=================================\n\n`;

    playHistory.forEach((item, index) => {
      content += `【第${index + 1}章：${item.chapterTitle}】\n\n`;
      content += `${formatChapterStoryForExport(item.chatHistory)}\n\n`;
      if (item.chapterSummary) {
        content += `【章节小结】\n${item.chapterSummary}\n\n`;
      }
      if (index < playHistory.length - 1) {
          content += `---------------------------------\n\n`;
      }
    });

    content += `=================================\n`;
    content += `【人工复盘版】\n`;
    content += `=================================\n\n`;

    playHistory.forEach((item, index) => {
      content += `【第${index + 1}章：${item.chapterTitle}】\n\n`;
      content += `【章节开场】\n${item.openingNarrative}\n\n`;
      content += `【当前局面】\n${item.scenarioDescription}\n\n`;
      content += `${formatChapterTranscriptForExport(item.chatHistory)}\n\n`;
      if (item.chapterSummary) {
        content += `【本章小结】\n${item.chapterSummary}\n\n`;
      }
      content += `【模型A复盘】\n${formatTurnSCSAnalysisForExport(item.scsAnalysisStructured)}\n\n`;
      if (item.turnAnalyses && item.turnAnalyses.length > 0) {
        content += `【逐回合模型A轨迹】\n${formatTurnSCSAnalysisTimeline(item.turnAnalyses)}\n\n`;
      }
      content += `【章节状态】\n${formatWorldStateForExport(item.worldStateAfter)}\n\n`;
      content += `【系统余响】\n${item.vagueFeedback}\n\n`;
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
      {/* 就是这一行：新增的 OC 管理器入口按钮 */}
  <button
    onClick={() => setShowOCManager(!showOCManager)}
    className="text-xs text-slate-400 hover:text-cyan-300 underline underline-offset-4 ml-2"
  >
    {showOCManager ? '关闭 OC 管理器' : '打开 OC 管理器'}
  </button>
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
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">旁白</span>
                                    )}
                                    <div className={`glass px-5 py-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.name ? 'bg-cyan-950/20 border-cyan-500/20 text-cyan-50' : 'bg-transparent border-transparent text-slate-400 text-center mx-auto'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-[85%] flex flex-col gap-1 items-end">
                                    <span className="text-[10px] text-cyan-600 uppercase tracking-widest mr-4">玩家输入 · {playerName}</span>
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
                                <span className="text-[10px] font-mono tracking-widest uppercase">玩家输入（行动、对话或思考）</span>
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
            {/* OC 管理器弹窗 */}
      {showOCManager && (
        <OCManager
          onClose={() => setShowOCManager(false)}
          onOCsUpdated={() => {
            // OC 变化时，可在这里刷新列表
            // 如果你的 OC 选择列表需要刷新，可以调用一个获取 OC 的函数
          }}
        />
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
