import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { targetUrl, model, messages } = req.body;
  const apiKey = req.headers.authorization?.split(' ')[1];

  if (!targetUrl || !model || !messages || !apiKey) {
    return res.status(400).json({ error: 'Missing required parameters: targetUrl, model, messages, or API key.' });
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false, // 确保在这里也关闭流式输出
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // 将上游错误信息透传给客户端
      return res.status(response.status).send(errorBody);
    }

    const data = await response.json();
    
    // 将 AI 服务商的响应直接返回给前端
    res.status(200).json(data);

  } catch (error: any) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
}
