// api/ai-proxy.js
// Vercel Serverless Function - 用于转发 AI API 请求，解决 CORS 问题

export default async function handler(req, res) {
  // 1. 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 设置 CORS 响应头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 3. 处理预检请求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 4. 从请求体中获取目标 URL、模型名称和消息
    const { targetUrl, model, messages } = req.body;
    
    // 5. 从请求头中获取玩家提供的 API Key
    const apiKey = req.headers.authorization;
    
    if (!targetUrl || !apiKey) {
      return res.status(400).json({ error: 'Missing targetUrl or API key' });
    }

    // 6. 向真正的 AI 服务商转发请求
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    // 7. 获取 AI 返回的数据
    const data = await response.json();

    // 8. 将 AI 的响应原样返回给前端
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
}