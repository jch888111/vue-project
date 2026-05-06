<template>
    <div style="padding: 20px; max-width: 1200px; margin: 0 auto;">
        <a-card title="AI 事件流 - 优化实现方案" style="margin-bottom: 20px;">
            <template #extra>
                <a-space>
                    <a-button type="primary" @click="startAIStream" :loading="isStreaming" :disabled="isStreaming">
                        <template #icon>
                            <PlayCircleOutlined />
                        </template>
                        开始 AI 对话
                    </a-button>
                    <a-button danger @click="stopAIStream" :disabled="!isStreaming">
                        <template #icon>
                            <StopOutlined />
                        </template>
                        停止生成
                    </a-button>
                    <a-button @click="clearConversation">
                        <template #icon>
                            <ClearOutlined />
                        </template>
                        清空对话
                    </a-button>
                </a-space>
            </template>

            <a-alert :message="streamStatus" :type="isStreaming ? 'success' : 'info'" style="margin-bottom: 20px;"
                show-icon />

            <!-- 输入框 -->
            <a-input v-model:value="userInput" placeholder="输入你的问题..." size="large" style="margin-bottom: 20px;"
                @pressEnter="handleSendMessage" :disabled="isStreaming">
                <template #suffix>
                    <a-button type="text" @click="handleSendMessage" :disabled="!userInput.trim() || isStreaming">
                        <template #icon>
                            <SendOutlined />
                        </template>
                    </a-button>
                </template>
            </a-input>

            <!-- 对话历史 -->
            <div
                style="max-height: 600px; overflow-y: auto; border: 1px solid #f0f0f0; border-radius: 8px; padding: 16px;">
                <div v-if="conversations.length === 0" style="text-align: center; color: #999; padding: 40px;">
                    <a-empty description="还没有对话，开始提问吧~" />
                </div>

                <div v-for="(conv, index) in conversations" :key="index" style="margin-bottom: 24px;">
                    <!-- 用户消息 -->
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                        <div
                            style="max-width: 70%; background: #1890ff; color: white; padding: 12px 16px; border-radius: 8px; word-wrap: break-word;">
                            <div style="font-weight: 500; margin-bottom: 4px;">你</div>
                            <div>{{ conv.user }}</div>
                        </div>
                    </div>

                    <!-- AI 回复 -->
                    <div style="display: flex; justify-content: flex-start;">
                        <div
                            style="max-width: 70%; background: #f5f5f5; padding: 12px 16px; border-radius: 8px; word-wrap: break-word;">
                            <div style="font-weight: 500; margin-bottom: 4px; color: #1890ff;">AI</div>
                            <div v-if="conv.isStreaming" style="white-space: pre-wrap;">
                                {{ conv.ai }}
                                <a-typography-text type="secondary" style="animation: blink 1s infinite;">
                                    ▋
                                </a-typography-text>
                            </div>
                            <div v-else style="white-space: pre-wrap;">{{ conv.ai }}</div>
                        </div>
                    </div>
                </div>

                <!-- 当前正在生成的消息 -->
                <div v-if="currentStreamingText" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: flex-start;">
                        <div
                            style="max-width: 70%; background: #f5f5f5; padding: 12px 16px; border-radius: 8px; word-wrap: break-word;">
                            <div style="font-weight: 500; margin-bottom: 4px; color: #1890ff;">AI</div>
                            <div style="white-space: pre-wrap;">
                                {{ currentStreamingText }}
                                <a-typography-text type="secondary" style="animation: blink 1s infinite;">
                                    ▋
                                </a-typography-text>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 统计信息 -->
            <a-row :gutter="16" style="margin-top: 20px;">
                <a-col :span="8">
                    <a-statistic title="对话轮数" :value="conversations.length" />
                </a-col>
                <a-col :span="8">
                    <a-statistic title="已接收字符数" :value="totalChars" />
                </a-col>
                <a-col :span="8">
                    <a-statistic title="状态" :value="isStreaming ? '生成中...' : '空闲'" />
                </a-col>
            </a-row>
        </a-card>
    </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { PlayCircleOutlined, StopOutlined, ClearOutlined, SendOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

// 状态管理
const userInput = ref('');
const isStreaming = ref(false);
const conversations = ref([]);
const currentStreamingText = ref('');
const abortController = ref(null);
const streamStatus = ref('准备就绪');

// 计算属性
const totalChars = computed(() => {
    return conversations.value.reduce((sum, conv) => {
        return sum + (conv.ai?.length || 0);
    }, 0) + currentStreamingText.value.length;
});

// 处理发送消息
const handleSendMessage = () => {
    if (!userInput.value.trim() || isStreaming.value) return;
    debugger
    const question = userInput.value.trim();
    userInput.value = '';

    // 开始流式请求
    startAIStream(question);
};

// 开始 AI 流式对话
const startAIStream = async (question = null) => {
    if (isStreaming.value) return;

    const userMessage = question || userInput.value.trim();
    if (!userMessage) {
        message.warning('请输入问题');
        return;
    }

    // 如果没有传入 question，清空输入框
    if (!question) {
        userInput.value = '';
    }

    // 创建新的对话项
    const conversationIndex = conversations.value.length;
    conversations.value.push({
        user: userMessage,
        ai: '',
        isStreaming: true,
    });

    isStreaming.value = true;
    streamStatus.value = '正在生成回复...';
    currentStreamingText.value = '';
    abortController.value = new AbortController();

    try {
        // 使用 Fetch API + ReadableStream 获取 AI 流式响应
        console.log('开始发送请求到:', 'http://localhost:3000/ai-stream');
        console.log('请求数据:', { question: userMessage });

        const response = await fetch('http://localhost:3000/ai-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream', // 明确期望接收流式响应
            },
            body: JSON.stringify({ question: userMessage }),
            signal: abortController.value.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('响应体不可读');
        }

        console.log('响应状态:', response.status, response.statusText);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));
        streamStatus.value = '正在接收 AI 回复...';

        // 获取 ReadableStream 的 reader
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // 持续读取流数据
        let readCount = 0;
        while (true) {
            try {
                const { done, value } = await reader.read();
                readCount++;

                const decodedValue = value ? decoder.decode(value, { stream: true }) : null;
                console.log(`第 ${readCount} 次读取 - done: ${done}, value length: ${value ? value.length : 0}, value:`, decodedValue);

                if (done) {
                    console.log('流读取完成，最终内容长度:', currentStreamingText.value.length);
                    // 流结束，保存完整回复
                    if (currentStreamingText.value) {
                        conversations.value[conversationIndex].ai = currentStreamingText.value;
                    }
                    conversations.value[conversationIndex].isStreaming = false;
                    currentStreamingText.value = '';
                    streamStatus.value = '回复生成完成';
                    isStreaming.value = false;
                    message.success('AI 回复完成');
                    // 确保 reader 已正确关闭
                    try {
                        reader.releaseLock();
                    } catch (e) {
                        console.warn('释放 reader 锁时出错:', e);
                    }
                    break;
                }

                if (!value || value.length === 0) {
                    console.warn('读取到空值，继续等待...');
                    continue;
                }

                // 解码数据块（注意：这里不应该再次解码，因为上面已经解码了）
                const chunk = decodedValue;
                buffer += chunk;

                // 处理 SSE 格式：data: 前缀
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        // 处理 SSE 格式：data: {...}
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6); // 移除 "data: " 前缀

                            // 处理 [DONE] 标记（OpenAI 格式）
                            if (dataStr.trim() === '[DONE]') {
                                conversations.value[conversationIndex].ai = currentStreamingText.value;
                                conversations.value[conversationIndex].isStreaming = false;
                                currentStreamingText.value = '';
                                streamStatus.value = '回复生成完成';
                                isStreaming.value = false;
                                message.success('AI 回复完成');
                                // 正确关闭 reader，避免连接保持打开
                                try {
                                    reader.cancel();
                                } catch (e) {
                                    console.warn('关闭 reader 时出错:', e);
                                }
                                return;
                            }

                            try {
                                const data = JSON.parse(dataStr);

                                // 处理不同的数据格式
                                if (data.content) {
                                    // OpenAI 格式：{ content: "text" }
                                    currentStreamingText.value += data.content;
                                    conversations.value[conversationIndex].ai = currentStreamingText.value;
                                } else if (data.text) {
                                    // 自定义格式：{ text: "text" }
                                    currentStreamingText.value += data.text;
                                    conversations.value[conversationIndex].ai = currentStreamingText.value;
                                } else if (data.delta) {
                                    // 增量格式：{ delta: "text" }
                                    currentStreamingText.value += data.delta;
                                    conversations.value[conversationIndex].ai = currentStreamingText.value;
                                } else if (typeof data === 'string') {
                                    // 纯文本
                                    currentStreamingText.value += data;
                                    conversations.value[conversationIndex].ai = currentStreamingText.value;
                                }
                            } catch (error) {
                                // 如果不是 JSON，直接作为文本处理
                                if (dataStr.trim()) {
                                    currentStreamingText.value += dataStr;
                                    conversations.value[conversationIndex].ai = currentStreamingText.value;
                                }
                            }
                        } else if (line.trim() && !line.startsWith(':')) {
                            // 非 SSE 格式，直接作为文本处理（逐行 JSON）
                            try {
                                const data = JSON.parse(line);
                                if (data.content || data.text || data.delta) {
                                    const text = data.content || data.text || data.delta;
                                    currentStreamingText.value += text;
                                    conversations.value[conversationIndex].ai = currentStreamingText.value;
                                }
                            } catch (error) {
                                // 纯文本
                                currentStreamingText.value += line;
                                conversations.value[conversationIndex].ai = currentStreamingText.value;
                            }
                        }
                    }
                }
            } catch (readError) {
                console.error('读取流数据时出错:', readError);
                // 读取错误，但不立即退出，尝试继续
                if (readError.name === 'AbortError') {
                    throw readError; // 如果是取消操作，重新抛出
                }
                // 其他错误，等待一下再继续
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            streamStatus.value = '生成已取消';
            message.info('已取消生成');
        } else {
            console.error('AI 流读取错误:', error);
            streamStatus.value = '生成失败';
            message.error('AI 回复失败，请检查服务器连接');

            // 保存错误信息
            conversations.value[conversationIndex].ai = '❌ 生成失败：' + error.message;
            conversations.value[conversationIndex].isStreaming = false;
        }
        currentStreamingText.value = '';
        isStreaming.value = false;
    }
};

// 停止 AI 流
const stopAIStream = () => {
    if (abortController.value) {
        abortController.value.abort();
        abortController.value = null;
    }

    // 保存当前正在生成的内容
    if (currentStreamingText.value && conversations.value.length > 0) {
        const lastConv = conversations.value[conversations.value.length - 1];
        if (lastConv.isStreaming) {
            lastConv.ai = currentStreamingText.value;
            lastConv.isStreaming = false;
        }
    }

    currentStreamingText.value = '';
    isStreaming.value = false;
    streamStatus.value = '已停止';
    message.info('已停止生成');
};

// 清空对话
const clearConversation = () => {
    conversations.value = [];
    currentStreamingText.value = '';
    streamStatus.value = '准备就绪';
    message.success('对话已清空');
};

// 组件卸载时清理
onBeforeUnmount(() => {
    if (abortController.value) {
        abortController.value.abort();
    }
});
</script>

<style scoped>
@keyframes blink {

    0%,
    50% {
        opacity: 1;
    }

    51%,
    100% {
        opacity: 0;
    }
}
</style>
