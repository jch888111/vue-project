# vue-project

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

## SSE 示例使用说明

本项目包含一个完整的 SSE (Server-Sent Events) 流式数据接收示例。

### 运行步骤

1. **启动后端SSE服务器**（在一个终端窗口）：
```sh
npm run server
```
服务器将在 `http://localhost:3000` 启动，SSE端点为 `http://localhost:3000/sse`

2. **启动前端开发服务器**（在另一个终端窗口）：
```sh
npm run dev
```
前端将在 `http://localhost:3001` 启动

3. **使用示例**：
   - 打开浏览器访问 `http://localhost:3001`
   - 点击"连接SSE"按钮开始接收流式数据
   - 服务器会每2秒发送一条消息，共发送10条
   - 前端会实时显示接收到的消息
   - 可以随时点击"断开连接"或"清空消息"

### 功能特点

- ✅ **两种接收方式**：
  - EventSource API（简单易用，自动重连）
  - Fetch API + ReadableStream（灵活强大，支持自定义请求头）
- ✅ 实时显示接收到的消息
- ✅ 支持连接/断开控制
- ✅ 自动重连机制（EventSource 方式）
- ✅ 美观的 UI 界面（使用 Ant Design Vue）
- ✅ 消息统计功能

### 技术说明

- **后端**：使用 Node.js 原生 `http` 模块创建流式服务器
  - `/sse` 端点：SSE 格式（用于 EventSource）
  - `/stream` 端点：纯文本流（用于 Fetch API）
- **前端**：
  - 方式一：Vue 3 Composition API + EventSource API
  - 方式二：Vue 3 Composition API + Fetch API + ReadableStream (`response.body.getReader()`)
- **数据格式**：JSON 格式的消息，包含 ID、时间戳、消息内容和随机数

### 两种方式对比

详细对比说明请查看 [SSE_README.md](./SSE_README.md)

**核心区别**：
- **EventSource**：简单易用，但只支持 GET 请求，无法自定义请求头
- **Fetch + ReadableStream**：更灵活，支持所有 HTTP 方法，可以添加自定义请求头（如 Authorization）

**使用 `response.body.getReader()` 的关键代码**：
```javascript
const response = await fetch('http://localhost:3000/stream');
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value, { stream: true });
  // 处理数据...
}
```
