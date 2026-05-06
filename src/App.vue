<template>
  <div style="padding: 20px; max-width: 1200px; margin: 0 auto;">
    <a-tabs default-active-key="1">
      <!-- EventSource 方式 -->
      <a-tab-pane key="1" tab="EventSource API">
        <a-card title="SSE (Server-Sent Events) 流式数据接收示例" style="margin-bottom: 20px;">
          <div style="margin-bottom: 20px;">
            <a-space>
              <a-button type="primary" @click="connectSSE" :disabled="isConnected">
                <template #icon>
                  <PlayCircleOutlined />
                </template>
                连接SSE
              </a-button>
              <a-button danger @click="disconnectSSE" :disabled="!isConnected">
                <template #icon>
                  <StopOutlined />
                </template>
                断开连接
              </a-button>
              <a-button @click="clearMessages">
                <template #icon>
                  <ClearOutlined />
                </template>
                清空消息
              </a-button>
            </a-space>
          </div>

          <a-alert :message="connectionStatus" :type="isConnected ? 'success' : 'info'" style="margin-bottom: 20px;"
            show-icon />

          <a-card title="接收到的消息" size="small">
            <div style="max-height: 400px; overflow-y: auto;">
              <a-list :data-source="messages" :loading="loading">
                <template #renderItem="{ item }">
                  <a-list-item>
                    <a-list-item-meta>
                      <template #title>
                        <a-tag color="blue">ID: {{ item.id }}</a-tag>
                        <span style="margin-left: 10px;">{{ item.timestamp }}</span>
                      </template>
                      <template #description>
                        <div>
                          <p><strong>消息内容：</strong>{{ item.message }}</p>
                          <p><strong>随机数：</strong>{{ item.random }}</p>
                        </div>
                      </template>
                    </a-list-item-meta>
                  </a-list-item>
                </template>
              </a-list>
            </div>
          </a-card>

          <a-statistic title="已接收消息总数" :value="messages.length" style="margin-top: 20px;" />
        </a-card>
      </a-tab-pane>

      <!-- Fetch API + ReadableStream 方式 -->
      <a-tab-pane key="2" tab="Fetch API + ReadableStream">
        <a-card title="使用 response.body.getReader() 读取流式数据" style="margin-bottom: 20px;">
          <div style="margin-bottom: 20px;">
            <a-space>
              <a-button type="primary" @click="connectStream" :disabled="isStreamConnected">
                <template #icon>
                  <PlayCircleOutlined />
                </template>
                连接流
              </a-button>
              <a-button danger @click="disconnectStream" :disabled="!isStreamConnected">
                <template #icon>
                  <StopOutlined />
                </template>
                断开连接
              </a-button>
              <a-button @click="clearStreamMessages">
                <template #icon>
                  <ClearOutlined />
                </template>
                清空消息
              </a-button>
            </a-space>
          </div>

          <a-alert :message="streamConnectionStatus" :type="isStreamConnected ? 'success' : 'info'"
            style="margin-bottom: 20px;" show-icon />

          <a-card title="接收到的消息" size="small">
            <div style="max-height: 400px; overflow-y: auto;">
              <a-list :data-source="streamMessages" :loading="streamLoading">
                <template #renderItem="{ item }">
                  <a-list-item>
                    <a-list-item-meta>
                      <template #title>
                        <a-tag color="green">ID: {{ item.id }}</a-tag>
                        <span style="margin-left: 10px;">{{ item.timestamp }}</span>
                      </template>
                      <template #description>
                        <div>
                          <p><strong>消息内容：</strong>{{ item.message }}</p>
                          <p><strong>随机数：</strong>{{ item.random }}</p>
                        </div>
                      </template>
                    </a-list-item-meta>
                  </a-list-item>
                </template>
              </a-list>
            </div>
          </a-card>

          <a-statistic title="已接收消息总数" :value="streamMessages.length" style="margin-top: 20px;" />
        </a-card>
      </a-tab-pane>

      <!-- AI 事件流优化实现 -->
      <a-tab-pane key="3" tab="AI 事件流（优化版）">
        <AIStream />
      </a-tab-pane>

      <!-- 多个时间段选择 -->
      <a-tab-pane key="4" tab="时间段选择">
        <TimeRangePicker />
      </a-tab-pane>
    </a-tabs>
  </div>
  <Table />
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { PlayCircleOutlined, StopOutlined, ClearOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import Table from './Table.vue';
import AIStream from './AIStream.vue';
import TimeRangePicker from './TimeRangePicker.vue';
// EventSource 相关状态
const messages = ref([]);
const isConnected = ref(false);
const loading = ref(false);
const connectionStatus = ref('未连接');
let eventSource = null;

// Fetch API + ReadableStream 相关状态
const streamMessages = ref([]);
const isStreamConnected = ref(false);
const streamLoading = ref(false);
const streamConnectionStatus = ref('未连接');
let abortController = null;

// 连接SSE
const connectSSE = () => {
  if (eventSource) {
    eventSource.close();
  }

  loading.value = true;
  connectionStatus.value = '正在连接...';

  // 创建EventSource连接
  eventSource = new EventSource('http://localhost:3000/sse');

  // 监听消息
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      messages.value.unshift({
        ...data,
        receivedAt: new Date().toLocaleTimeString('zh-CN'),
      });
      loading.value = false;
      connectionStatus.value = '已连接 - 正在接收数据';
    } catch (error) {
      console.error('解析消息失败:', error);
      message.error('解析消息失败');
    }
  };

  // 监听自定义事件
  eventSource.addEventListener('close', () => {
    connectionStatus.value = '服务器主动关闭连接';
    isConnected.value = false;
    loading.value = false;
    message.info('服务器已关闭连接');
  });

  // 连接打开
  eventSource.onopen = () => {
    isConnected.value = true;
    connectionStatus.value = '已连接 - 等待数据';
    loading.value = false;
    message.success('SSE连接已建立');
  };

  // 连接错误
  eventSource.onerror = (error) => {
    console.error('SSE连接错误:', error);
    connectionStatus.value = '连接错误';
    isConnected.value = false;
    loading.value = false;
    message.error('SSE连接失败，请确保服务器已启动');

    // 如果连接关闭，尝试重连
    if (eventSource.readyState === EventSource.CLOSED) {
      setTimeout(() => {
        if (!isConnected.value) {
          message.warning('尝试重新连接...');
          connectSSE();
        }
      }, 3000);
    }
  };
};

// 断开连接
const disconnectSSE = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  isConnected.value = false;
  connectionStatus.value = '已断开连接';
  loading.value = false;
  message.info('已断开SSE连接');
};

// 清空消息
const clearMessages = () => {
  messages.value = [];
  message.success('消息已清空');
};

// ========== Fetch API + ReadableStream 方式 ==========

// 使用 response.body.getReader() 连接流
const connectStream = async () => {
  if (abortController) {
    abortController.abort();
  }

  streamLoading.value = true;
  streamConnectionStatus.value = '正在连接...';

  // 创建 AbortController 用于取消请求
  abortController = new AbortController();

  try {
    // 使用 Fetch API 获取流
    const response = await fetch('http://localhost:3000/stream', {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('响应体不可读');
    }

    streamConnectionStatus.value = '已连接 - 正在接收数据';
    isStreamConnected.value = true;
    streamLoading.value = false;
    message.success('流连接已建立');

    // 获取 ReadableStream 的 reader
    const reader = response.body.getReader();

    // 创建 TextDecoder 用于解码字节流
    const decoder = new TextDecoder();

    // 用于累积不完整的数据
    let buffer = '';

    // 持续读取流数据
    while (true) {
      // 读取数据块
      const { done, value } = await reader.read();
      console.log(done, value);

      if (done) {
        streamConnectionStatus.value = '流已结束';
        isStreamConnected.value = false;
        streamLoading.value = false;
        message.info('流数据接收完成');
        break;
      }

      // 将 Uint8Array 解码为字符串
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // 按行分割处理（每行一个JSON对象）
      const lines = buffer.split('\n');
      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      // 处理完整的行
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            streamMessages.value.unshift({
              ...data,
              receivedAt: new Date().toLocaleTimeString('zh-CN'),
            });
          } catch (error) {
            console.error('解析JSON失败:', error, '原始数据:', line);
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      streamConnectionStatus.value = '连接已取消';
      message.info('已取消连接');
    } else {
      console.error('流读取错误:', error);
      streamConnectionStatus.value = '连接错误';
      message.error('流连接失败，请确保服务器已启动');
    }
    isStreamConnected.value = false;
    streamLoading.value = false;
  }
};

// 断开流连接
const disconnectStream = () => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  isStreamConnected.value = false;
  streamConnectionStatus.value = '已断开连接';
  streamLoading.value = false;
  message.info('已断开流连接');
};

// 清空流消息
const clearStreamMessages = () => {
  streamMessages.value = [];
  message.success('消息已清空');
};

// 组件卸载时关闭连接
onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
  if (abortController) {
    abortController.abort();
  }
});
</script>

<style scoped>
:deep(.ant-list-item) {
  border-bottom: 1px solid #f0f0f0;
}
</style>
