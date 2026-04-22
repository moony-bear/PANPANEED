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
      }),
    });

    // 7. 获取 AI 返回的数据（可能是 JSON，也可能是错误文本）
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // 如果不是 JSON，读取为文本
      const text = await response.text();
      console.error('Non-JSON response from upstream:', text);
      return res.status(response.status).json({ 
        error: `Upstream returned non-JSON response (status ${response.status})`,
        details: text.slice(0, 500) // 截取前500字符便于调试
      });
    }

    // 8. 如果上游返回错误状态码，将错误信息原样返回给前端
    if (!response.ok) {
      console.error('Upstream error:', data);
      return res.status(response.status).json(data);
    }

    // 9. 将 AI 的响应原样返回给前端
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    // 返回更详细的错误信息
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
