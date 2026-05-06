import http from 'http';
import url from 'url';

const PORT = 3000;

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // 处理CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // SSE端点（使用EventSource）
  if (parsedUrl.pathname === '/sse') {
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    let counter = 0;

    // 每2秒发送一次数据
    const interval = setInterval(() => {
      counter++;
      const data = {
        id: counter,
        timestamp: new Date().toLocaleTimeString('zh-CN'),
        message: `这是第 ${counter} 条消息`,
        random: Math.floor(Math.random() * 1000),
      };

      // SSE格式：data: 后面跟JSON数据，以\n\n结尾
      res.write(`id: ${counter}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      // 发送10条消息后停止
      if (counter >= 10) {
        clearInterval(interval);
        res.write('event: close\n');
        res.write('data: 连接已关闭\n\n');
        res.end();
      }
    }, 2000);

    // 客户端断开连接时清理
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }
  // AI 事件流端点（优化版，支持 POST 请求）
  else if (parsedUrl.pathname === '/ai-stream' && req.method === 'POST') {
    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    });

    // 立即发送一个初始注释，让浏览器知道这是一个活跃的流式响应
    // 这对于保持连接打开很重要
    res.write(': connected\n\n');
    res.flushHeaders && res.flushHeaders(); // 确保头部立即发送

    let body = '';
    let sendInterval = null; // 使用 setInterval 而不是递归 setTimeout

    // 收集请求体
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      // 解析请求
      let question = '你好';
      try {
        const data = JSON.parse(body);
        question = data.question || '你好';
      } catch (error) {
        console.error('解析请求体失败:', error);
      }

      console.log('收到问题:', question);

      // 生成 AI 回复
      const aiResponse = generateAIResponse(question);
      console.log('AI 回复长度:', aiResponse.length);

      let charIndex = 0;
      const CHAR_DELAY = 20; // 每个字符的延迟（毫秒）

      // 使用递归函数发送字符，更可靠
      const sendNextChar = () => {
        // 检查连接状态
        if (res.destroyed || res.closed) {
          console.log('连接已关闭，停止发送');
          if (sendInterval) {
            clearInterval(sendInterval);
            sendInterval = null;
          }
          return;
        }

        // 检查是否还有字符要发送
        if (charIndex >= aiResponse.length) {
          // 所有字符已发送完成
          console.log('所有字符已发送完成');
          if (sendInterval) {
            clearInterval(sendInterval);
            sendInterval = null;
          }

          try {
            // 发送结束标记
            res.write('data: [DONE]\n\n');
            // 延迟关闭，确保数据发送完成
            setTimeout(() => {
              if (!res.destroyed) {
                res.end();
              }
            }, 200);
          } catch (error) {
            console.error('发送结束标记失败:', error);
          }
          return;
        }

        // 发送当前字符
        try {
          const chunk = {
            content: aiResponse[charIndex],
          };

          const dataToSend = `data: ${JSON.stringify(chunk)}\n\n`;
          const success = res.write(dataToSend);

          console.log(`发送字符 ${charIndex + 1}/${aiResponse.length}: "${aiResponse[charIndex]}"`);

          charIndex++;

          // 如果写入失败（缓冲区满），等待 drain 事件
          if (!success) {
            console.log('缓冲区满，等待 drain 事件');
            if (sendInterval) {
              clearInterval(sendInterval);
              sendInterval = null;
            }

            // 检查连接是否仍然有效
            if (res.destroyed || res.closed) {
              console.log('连接已关闭，停止等待 drain');
              return;
            }

            res.once('drain', () => {
              console.log('缓冲区已清空，恢复发送');
              // 再次检查连接状态
              if (res.destroyed || res.closed) {
                console.log('连接已关闭，不恢复发送');
                return;
              }
              // 恢复定时发送
              sendInterval = setInterval(sendNextChar, CHAR_DELAY);
            });
          } else {
            // 继续发送下一个字符（通过定时器）
            // sendNextChar 会在定时器中继续调用
          }
        } catch (error) {
          console.error('写入数据失败:', error);
          if (sendInterval) {
            clearInterval(sendInterval);
            sendInterval = null;
          }
        }
      };

      // 开始定时发送
      sendInterval = setInterval(sendNextChar, CHAR_DELAY);
    });

    // 客户端断开连接时清理
    req.on('close', () => {
      console.log('客户端断开连接 - req.on("close") 触发');
      console.log('连接状态 - destroyed:', req.destroyed, 'aborted:', req.aborted);
      if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
      }
      // 确保响应流也被关闭
      if (!res.destroyed && !res.closed) {
        try {
          res.destroy();
        } catch (e) {
          console.warn('关闭响应流时出错:', e);
        }
      }
    });

    // 请求被中止时清理
    req.on('aborted', () => {
      console.log('请求被中止');
      if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
      }
    });

    // 响应流错误处理
    res.on('error', (error) => {
      console.error('响应流错误:', error);
      if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
      }
    });
  }
  // 流式数据端点（使用Fetch API + ReadableStream）
  else if (parsedUrl.pathname === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    let counter = 0;

    // 服务端

    // 每2秒发送一次数据（纯文本流，每行一个JSON对象）
    const interval = setInterval(() => {
      counter++;
      const data = {
        id: counter,
        timestamp: new Date().toLocaleTimeString('zh-CN'),
        message: `这是第 ${counter} 条消息`,
        random: Math.floor(Math.random() * 1000),
      };

      // 发送JSON数据，每行一个对象
      res.write(JSON.stringify(data) + '\n');

      // 发送10条消息后停止
      if (counter >= 10) {
        clearInterval(interval);
        res.end();
      }
    }, 2000);

    // 客户端断开连接时清理
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }
  else {
    // 其他路由返回404
    res.writeHead(404);
    res.end('Not Found');
  }
});

// 生成 AI 回复的函数（模拟）
function generateAIResponse(question) {
  const responses = {
    '你好': '你好！我是 AI 助手，很高兴为你服务。有什么我可以帮助你的吗？',
    '你是谁': '我是一个基于 AI 的智能助手，可以回答你的问题、提供信息和建议。',
    '默认': `关于"${question}"，这是一个很好的问题。让我为你详细解答：

1. 首先，我们需要理解这个问题的核心要点。
2. 然后，我们可以从多个角度来分析。
3. 最后，我会给出一些实用的建议。

希望这个回答对你有帮助！如果你还有其他问题，随时可以问我。`,
  };

  // 简单的关键词匹配
  for (const [key, value] of Object.entries(responses)) {
    if (question.includes(key)) {
      return value;
    }
  }

  return responses['默认'];
}

server.listen(PORT, () => {
  console.log(`SSE服务器运行在 http://localhost:${PORT}`);
  console.log(`SSE端点: http://localhost:${PORT}/sse`);
  console.log(`流式端点: http://localhost:${PORT}/stream`);
  console.log(`AI流式端点: http://localhost:${PORT}/ai-stream`);
});

