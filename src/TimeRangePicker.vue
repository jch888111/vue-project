<template>
    <div style="padding: 20px; max-width: 1200px; margin: 0 auto;">
        <a-card title="多个时间段选择（不重叠）">
            <template #extra>
                <a-button type="primary" @click="addTimeRange">
                    <template #icon>
                        <PlusOutlined />
                    </template>
                    添加时间段
                </a-button>
            </template>

            <!-- 时间段列表 -->
            <div v-if="timeRanges.length === 0" style="text-align: center; padding: 40px; color: #999;">
                <a-empty description="暂无时间段，点击上方按钮添加" />
            </div>

            <div v-else>
                <a-list bordered>
                    <a-list-item v-for="(item, index) in timeRanges" :key="index">
                        <template #actions>
                            <a-button type="link" danger @click="removeTimeRange(index)">
                                <template #icon>
                                    <DeleteOutlined />
                                </template>
                                删除
                            </a-button>
                        </template>

                        <a-list-item-meta>
                            <template #title>
                                <a-space>
                                    <a-tag color="blue">时间段 {{ index + 1 }}</a-tag>
                                    <span v-if="item.overlap" style="color: #ff4d4f;">
                                        <WarningOutlined /> 与其他时间段重叠
                                    </span>
                                </a-space>
                            </template>
                            <template #description>
                                <div style="margin-top: 12px;">
                                    <!-- 使用 a-time-range-picker 作为时间范围选择组件 -->
                                    <a-time-range-picker v-model:value="item.range" format="HH:mm:ss"
                                        :placeholder="['开始时间', '结束时间']" style="width: 100%; max-width: 400px;"
                                        @change="(value) => handleTimeRangeChange(index, value)"
                                        :status="item.overlap ? 'error' : ''" />
                                    <div v-if="item.range && item.range.length === 2" style="margin-top: 8px;">
                                        <a-typography-text type="secondary">
                                            时间范围：{{ formatTimeRange(item.range) }}
                                            <span v-if="item.duration" style="margin-left: 8px; color: #1890ff;">
                                                （时长：{{ item.duration }}）
                                            </span>
                                        </a-typography-text>
                                    </div>
                                </div>
                            </template>
                        </a-list-item-meta>
                    </a-list-item>
                </a-list>

                <!-- 统计信息 -->
                <a-row :gutter="16" style="margin-top: 20px;">
                    <a-col :span="8">
                        <a-statistic title="时间段总数" :value="timeRanges.length" />
                    </a-col>
                    <a-col :span="8">
                        <a-statistic title="有效时间段" :value="validTimeRanges.length"
                            :value-style="{ color: validTimeRanges.length === timeRanges.length ? '#3f8600' : '#cf1322' }" />
                    </a-col>
                    <a-col :span="8">
                        <a-statistic title="总时长" :value="totalDuration" suffix="小时" />
                    </a-col>
                </a-row>
            </div>
        </a-card>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { PlusOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

// 时间段数据结构
const timeRanges = ref([]);

// 添加时间段
const addTimeRange = () => {
    timeRanges.value.push({
        range: null, // [dayjs, dayjs] 或 null
        overlap: false,
        duration: null, // 时长（小时）
    });
};

// 删除时间段
const removeTimeRange = (index) => {
    timeRanges.value.splice(index, 1);
    checkOverlaps();
};

// 处理时间段变化
const handleTimeRangeChange = (index, value) => {
    const item = timeRanges.value[index];
    item.range = value;

    // 计算时长
    if (value && value.length === 2) {
        const start = value[0];
        const end = value[1];
        const diffMs = end.diff(start);
        const diffHours = diffMs / (1000 * 60 * 60);
        item.duration = diffHours.toFixed(2);

        // 检查开始时间是否小于结束时间
        if (diffMs <= 0) {
            message.warning('结束时间必须大于开始时间');
            item.range = null;
            item.duration = null;
            return;
        }
    } else {
        item.duration = null;
    }

    // 检查重叠
    checkOverlaps();
};

// 检查时间段重叠
const checkOverlaps = () => {
    // 重置所有重叠标记
    timeRanges.value.forEach(item => {
        item.overlap = false;
    });

    // 检查每对时间段是否重叠
    for (let i = 0; i < timeRanges.value.length; i++) {
        const range1 = timeRanges.value[i];
        if (!range1.range || range1.range.length !== 2) continue;

        for (let j = i + 1; j < timeRanges.value.length; j++) {
            const range2 = timeRanges.value[j];
            if (!range2.range || range2.range.length !== 2) continue;

            // 检查是否重叠
            if (isOverlapping(range1.range, range2.range)) {
                range1.overlap = true;
                range2.overlap = true;
                message.warning(`时间段 ${i + 1} 和时间段 ${j + 1} 重叠！`);
            }
        }
    }
};

// 判断两个时间段是否重叠
const isOverlapping = (range1, range2) => {
    const [start1, end1] = range1;
    const [start2, end2] = range2;

    // 转换为分钟数进行比较
    const start1Minutes = start1.hour() * 60 + start1.minute();
    const end1Minutes = end1.hour() * 60 + end1.minute();
    const start2Minutes = start2.hour() * 60 + start2.minute();
    const end2Minutes = end2.hour() * 60 + end2.minute();

    // 重叠条件：两个时间段有交集
    // 不重叠的条件：range1 完全在 range2 之前，或 range1 完全在 range2 之后
    // 即：end1 <= start2 或 start1 >= end2
    // 重叠的条件：!(end1 <= start2 || start1 >= end2)
    return !(end1Minutes <= start2Minutes || start1Minutes >= end2Minutes);
};

// 格式化时间段显示
const formatTimeRange = (range) => {
    if (!range || range.length !== 2) return '';
    return `${range[0].format('HH:mm:ss')} - ${range[1].format('HH:mm:ss')}`;
};

// 有效时间段（无重叠的）
const validTimeRanges = computed(() => {
    return timeRanges.value.filter(item => item.range && !item.overlap);
});

// 总时长（所有有效时间段的总和）
const totalDuration = computed(() => {
    return validTimeRanges.value.reduce((sum, item) => {
        return sum + (parseFloat(item.duration) || 0);
    }, 0).toFixed(2);
});

// 监听时间段变化，自动检查重叠
watch(
    () => timeRanges.value.map(item => item.range),
    () => {
        checkOverlaps();
    },
    { deep: true }
);
</script>

<style scoped>
:deep(.ant-list-item) {
    padding: 16px;
}

:deep(.ant-list-item-meta-description) {
    margin-top: 8px;
}
</style>
