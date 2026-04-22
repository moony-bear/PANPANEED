import React, { useState, useEffect, useRef } from 'react';
import { TerminalSquare, AlertCircle, Loader2, ChevronRight, Download, BrainCircuit, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './index.css';

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
// 1. 添加状态来存储从 public 目录加载的提示词
const [systemPromptContent, setSystemPromptContent] = useState('');

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
3. 生成一个包含8个章节、以及动态NPC阵容的完整剧情框架。不需要生成特定选项，选项将由玩家自由输入。
4. 整个框架必须严格遵循SCS模型A的判型逻辑，但所有判型意图必须隐藏在生动的剧情冲突中。
5. 最终输出为严格的JSON格式，便于前端游戏引擎解析和呈现。

【一、风格与元素库（你必须从中智能选择）】
剧本主风格库（选择一项为主）：
现代都市、克苏鲁神话、修仙世界、校园背景、古代皇宫生存、赛博朋克、末日废土、星际科幻
流行叙事元素库（选择1-2项融合）：
重生、穿越、复仇、系统/面板、预言/宿命、扮猪吃虎、反套路、规则怪谈、真假千金、ABO先婚后爱、恐怖风快穿

【二、SCS模型A判型要求（最高优先级）】
8个章节分别侧重考察以下维度（可混合次要维度）：
伦理 (Ethics：Fi/Fe)：涉及信任、背叛、共情、道德抉择、关系网。
逻辑 (Logic：Ti/Te)：涉及因果分析、系统漏洞、效率、规则博弈。
实感 (Sensing：Si/Se)：涉及细节观察、身体感受、权力压迫、资源掌控。
直觉 (Intuition：Ni/Ne)：涉及隐喻象征、未来预见、潜在联系、发散联想。

【返回JSON结构要求】（务必返回合规且可以直接被解析的JSON代码，不要有任何markdown转义，如下所示）：
{
  "game_title": "你生成的核心游戏标题",
  "world_setting": "详细的世界观背景设定",
  "npcs": [
    { "name": "NPC名", "description": "NPC设定", "socionics_type_hidden": "隐含类型(例如:LSI)", "initial_affection": 50 }
  ],
  "chapters": [
    {
      "chapter_id": 1,
      "chapter_title": "第X章标题",
      "opening_narrative": "开场叙事，将玩家代入情境",
      "scenario_description": "当下的具体场景和危机。必须促使玩家做出行动判断",
      "focus_dimension": "本章重点考察的模型A维度 (例如: 伦理 Fi/Fe)"
    }
  ] (必须严格包含8个章节)
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
          max_tokens: 4000
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // 如果 AI 服务商返回错误（例如401 Unauthorized），data里会有详细信息
        throw new Error(data.error?.message || 'Failed to generate reality matrix.');
      }

      // AI 服务商的响应现在被包裹在 choices 数组中
      function extractJsonFromMarkdown(content: string): string {
        // 匹配被 ```json ... ``` 包裹的内容
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          return jsonMatch[1];
        }
        // 匹配被 ``` ... ``` 包裹的内容
        const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          return codeMatch[1];
        }
        // 如果没有 Markdown 标记，直接返回原内容
        return content;
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
      const processActionPrompt = `你是一个TRPG游戏主持人(GM)，同时也是精通Socionics模型A的分析者。
根据玩家在当前情境下的行动描述，生成合理的剧情发展，并分析玩家的SCS模型A特征。

【当前章节背景】:
标题: ${gameStory.chapters[currentChapterIndex].chapter_title}
背景说明: ${gameStory.chapters[currentChapterIndex].scenario_description}
本章重点考察维度: ${gameStory.chapters[currentChapterIndex].focus_dimension}

【玩家角色设定】:
${`[代号]: ${playerName}\n[自我评估设定]: ${playerProfile}`}

【主要NPC阵营】:
${gameStory.npcs.map((n:any) => `${n.name} (隐含类型: ${n.socionics_type_hidden})`).join(', ')}

【历史对话摘要】:
${updatedHistory.map((msg:any) => `${msg.role === 'user' ? '玩家行动' : '剧情/NPC'}: ${msg.content}`).join('\n')}

【当前玩家行动输入】:
${userMessage.content}

请根据玩家的行动，生成接下来的剧情发展，并分析玩家行动中体现的社会人格学(Socionics)特质。
注意：NPC的行为和台词会随好感度变化，但变化方式必须符合其类型特质。

【返回JSON结构要求】：
{
  "narrative_response": "你作为GM或者NPC对玩家行动的直接反馈（纯文本叙事）。不要包含任何判型内容，用作直接显示给玩家看的剧情文本",
  "npc_reactions": [
    { "name": "互动的NPC名", "reaction": "NPC的反应台词或行为", "affection_change": 5 (或-5等数值变化) }
  ],
  "scs_analysis": "（仅供系统后台记录的分析）请根据SCS流派而不是MBTI判断。推断其伦理(Ethics)、逻辑(Logic)、实感(Sensing)、直觉(Intuition)的位置、符合哪个类型，注意使用scs的判断方式而不是单纯看强度。比如：玩家这一举动体现了怎样的模型A区块特征（是Ego的自信还是Super-id的试探等）。",
  "vague_feedback": "充满诗意和谜语感的微小坐标更新隐喻(比如：你的潜意识重构了情感模块)。这句话将作为本回合结束时的系统提示语给玩家看。"
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
          max_tokens: 4000
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to process action.');
      }

      const responseData = JSON.parse(data.choices[0].message.content);

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

      setChatHistory([...updatedHistory, ...newMessages]);
      setLastVagueFeedback(responseData.vague_feedback || "你的潜意识完成了一次微小的坐标更新...");
      
      // Save to history and mark chapter complete
      setPlayHistory([
        ...playHistory,
        {
          chapterId: gameStory.chapters[currentChapterIndex].chapter_id,
          chapterTitle: gameStory.chapters[currentChapterIndex].chapter_title,
          openingNarrative: gameStory.chapters[currentChapterIndex].opening_narrative,
          scenarioDescription: gameStory.chapters[currentChapterIndex].scenario_description,
          chatHistory: [...updatedHistory, ...newMessages],
          fullActionText: userMessage.content,
          scsAnalysis: data.scs_analysis,
          consequence: consequenceText,
          vagueFeedback: data.vague_feedback
        }
      ]);

      setChapterCompleted(true);

    } catch (err: any) {
      setError(err.message);
      // Remove failed message to try again
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
      // Game Over, Generate Report
      setLoading(true);
      setLoadingPhase('Extracting Deep Psychological Architecture...');
      try {
        const historyText = playHistory.map((h: any) => `
第${h.chapterId}章: ${h.chapterTitle}
玩家总行动文本: ${h.fullActionText}
后台SCS预判侧写: ${h.scsAnalysis}
剧情后果: ${h.consequence}
    `).join('\n');

        const analysisUserPrompt = `玩家初始自述：
${`[代号]: ${playerName}\n[自我评估设定]: ${playerProfile}`}

剧情选择追踪日志与系统预判（包含SCS模型A判型依据）：
${historyText}

最终各类NPC（及其假定类型）好感度状态：
${Object.entries(npcAffection).map(([npc, score]) => `${npc}: ${score}`).join('\n')}
(极度厌恶为负值)

任务：
请你扮演一位精通SCS流派与古典模型A的Socionics专家。基于上述全过程隐秘收集的数据，为玩家撰写一份深层的认知类型分析报告。

【硬性要求】：
1. 坚决排除任何MBTI词汇。必须严格使用Socionics模型A的理论术语（例如：Ego/Super-Ego/Super-Id/Id区块结构，Mental(意识轨道)/Vital(潜意识轨道)，维度高低，或信息元素符号如Ti, Te, Fe, Fi, Se, Si, Ne, Ni）。务必注意使用scs的判断方式，分析功能在模型中的位置（而不是单纯看强度）。
2. 文字风格必须是一位深邃、客观的专家在进行人格解构，带有赛博朋克深层剖析的氛围。不要输出直白的数字评分或轻浮的网发言论。
3. 玩家在游玩时输入了自由文本。请根据他们的轨迹：
   - 评估其在处理困境时，哪些信息元素表现出了高维度（3D/4D，游刃有余、创新），哪些落在了痛点区块（如Super-Ego的一维/二维限制）。
   - 对比【玩家初始自述】和【实际行为】，指出其自我认知与模型A本我/超我区块可能存在的落差。
   - 类间关系反推：依据玩家与NPC互动导致的最终好感度数值关系，推断该玩家与这三者的类间关系（例如：对冲、幻觉、双重、超我等），以佐证玩家最终可能的类型。
4. 在报告的最后，给出 1-2种 最有根据的可能社会人格类型（如 ILI，EIE等全称缩写），并给出其心理认知结构上的发展建议。

请直接输出评测长文，纯排版文本（可使用Markdown小标题）。字数800-1200字即可。`;

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
            max_tokens: 400
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || 'Failed to generate analysis.');
        }

        const analysisText = data.choices[0].message.content;
        setFinalReport(analysisText);
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
                     <h2 className="text-xl font-bold text-white tracking-tight">{gameStory.chapters[currentChapterIndex].chapter_title}</h2>
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
    </div>
  );
}
