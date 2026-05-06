# SSE 流式数据接收方式对比

本项目提供了两种前端接收流式数据的方式：

## 方式一：EventSource API

### 特点
- ✅ 浏览器原生 API，使用简单
- ✅ 自动重连机制
- ✅ 专门为 SSE 协议设计
- ❌ 只支持 GET 请求
- ❌ 只支持 text/event-stream 格式
- ❌ 无法自定义请求头（如 Authorization）

### 使用方式
```javascript
// 创建 EventSource 连接
const eventSource = new EventSource('http://localhost:3000/sse');

// 监听消息
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到数据:', data);
};

// 监听连接打开
eventSource.onopen = () => {
  console.log('连接已建立');
};

// 监听错误
eventSource.onerror = (error) => {
  console.error('连接错误:', error);
};

// 关闭连接
eventSource.close();
```

### 服务器响应格式
```
id: 1
data: {"id":1,"message":"这是第 1 条消息"}

id: 2
data: {"id":2,"message":"这是第 2 条消息"}

```

---

## 方式二：Fetch API + ReadableStream (response.body.getReader())

### 特点
- ✅ 更灵活，支持所有 HTTP 方法（GET、POST 等）
- ✅ 可以自定义请求头（Authorization、Content-Type 等）
- ✅ 可以处理任意格式的流式数据（不限于 SSE）
- ✅ 更好的错误处理和控制
- ❌ 需要手动处理数据解析
- ❌ 需要手动实现重连机制
- ❌ 代码相对复杂

### 使用方式
```javascript
// 创建 AbortController 用于取消请求
const abortController = new AbortController();

// 使用 Fetch API 获取流
const response = await fetch('http://localhost:3000/stream', {
  signal: abortController.signal,
  // 可以添加自定义请求头
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json',
  },
});

// 检查响应状态
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}

// 获取 ReadableStream 的 reader
const reader = response.body.getReader();

// 创建 TextDecoder 用于解码字节流
const decoder = new TextDecoder();

// 用于累积不完整的数据
let buffer = '';

// 持续读取流数据
while (true) {
  // 读取数据块（返回 { done, value }）
  const { done, value } = await reader.read();
  
  if (done) {
    console.log('流已结束');
    break;
  }
  
  // 将 Uint8Array 解码为字符串
  const chunk = decoder.decode(value, { stream: true });
  buffer += chunk;
  
  // 按行分割处理（根据实际数据格式调整）
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // 保留最后一行（可能不完整）
  
  // 处理完整的行
  for (const line of lines) {
    if (line.trim()) {
      try {
        const data = JSON.parse(line);
        console.log('收到数据:', data);
      } catch (error) {
        console.error('解析失败:', error);
      }
    }
  }
}

// 取消请求
abortController.abort();
```

### 核心 API 说明

#### 1. `response.body.getReader()`
- 返回一个 `ReadableStreamDefaultReader` 对象
- 用于逐块读取流数据
- 每次读取返回 `{ done: boolean, value: Uint8Array }`

#### 2. `reader.read()`
- 异步方法，返回 Promise
- `done: true` 表示流已结束
- `value` 是 `Uint8Array` 类型，包含原始字节数据

#### 3. `TextDecoder`
- 用于将 `Uint8Array` 解码为字符串
- `decoder.decode(value, { stream: true })` 支持流式解码

#### 4. `AbortController`
- 用于取消 Fetch 请求
- 调用 `abort()` 会中断流读取

### 服务器响应格式
```
{"id":1,"message":"这是第 1 条消息"}
{"id":2,"message":"这是第 2 条消息"}
{"id":3,"message":"这是第 3 条消息"}
```

---

## 使用场景对比

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 简单的 SSE 推送 | EventSource | 代码简单，自动重连 |
| 需要认证的流 | Fetch + ReadableStream | 可以添加 Authorization 头 |
| POST 请求的流 | Fetch + ReadableStream | EventSource 不支持 POST |
| 自定义数据格式 | Fetch + ReadableStream | 更灵活的数据处理 |
| 需要精确控制 | Fetch + ReadableStream | 更好的错误处理和状态管理 |

---

## 数据格式处理

### EventSource 方式
- 服务器必须遵循 SSE 协议格式
- 每行以 `data:` 开头
- 消息以 `\n\n` 分隔

### Fetch + ReadableStream 方式
- 可以处理任意格式
- 需要手动解析数据
- 常见格式：
  - **逐行 JSON**：每行一个 JSON 对象
  - **SSE 格式**：需要手动解析 `data:` 前缀
  - **自定义格式**：根据业务需求解析

---

## 错误处理

### EventSource
```javascript
eventSource.onerror = (error) => {
  // 自动重连（浏览器内置）
  if (eventSource.readyState === EventSource.CLOSED) {
    // 连接已关闭，可以手动重连
    setTimeout(() => {
      eventSource = new EventSource(url);
    }, 3000);
  }
};
```

### Fetch + ReadableStream
```javascript
try {
  const response = await fetch(url);
  const reader = response.body.getReader();
  // ... 读取数据
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('请求已取消');
  } else {
    console.error('请求失败:', error);
    // 手动实现重连逻辑
  }
}
```

---

## 性能考虑

- **EventSource**：浏览器优化，性能较好
- **Fetch + ReadableStream**：需要手动处理缓冲，但更灵活

两种方式在性能上差异不大，主要区别在于使用场景和灵活性。

