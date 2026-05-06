<template>
    <div class="table-demo">
        <div class="table-demo__toolbar">
            <a-alert
                class="table-demo__selection"
                type="info"
                :message="`当前选中行 ID（跨标签页同步）：${selectedIds.length ? selectedIds.join(', ') : '暂无'}`"
                show-icon
            />

            <a-button type="primary" @click="openHeaderSettings">
                表头设置
            </a-button>
        </div>

        <DraggableATable
            v-model:columns="columns"
            :data-source="data"
            :loading="loading"
            :row-class-name="setTriped"
            :row-selection="rowSelection"
            :pagination="false"
            :sticky="{ offsetHeader: 0 }"
            :scroll="{ x: 1500 }"
            bordered
            @columnOrderChange="handleColumnOrderChange"
            @columnResize="handleColumnResize"
        >
            <template #headerCell="{ column, title }">
                <div
                    v-if="column.dataIndex === 'type'"
                    class="table-header-filter"
                    @click.stop
                    @mousedown.stop
                    @pointerdown.stop
                    @touchstart.stop
                >
                    <span class="table-header-filter__label">Type</span>
                    <a-select
                        v-model:value="typeFilter"
                        :options="typeOptions"
                        allow-clear
                        mode="multiple"
                        placeholder="All"
                        style="width: 100%"
                    />
                </div>
                <div
                    v-else-if="column.dataIndex === 'qty'"
                    class="table-header-filter"
                    @click.stop
                    @mousedown.stop
                    @pointerdown.stop
                    @touchstart.stop
                >
                    <span class="table-header-filter__label">Qty</span>
                    <a-range-picker
                        v-model:value="qtyTimeRange"
                        format="YYYY-MM-DD"
                        :placeholder="['Start', 'End']"
                        style="width: 100%"
                    />
                </div>
                <template v-else>
                    {{ title }}
                </template>
            </template>
        </DraggableATable>

        <a-modal
            v-model:open="headerSettingsOpen"
            title="表头设置"
            width="920px"
            ok-text="保存并应用"
            cancel-text="取消"
            :confirm-loading="headerSettingsSaving"
            @ok="applyHeaderSettings"
        >
            <div class="header-settings">
                <section class="header-settings__main">
                    <div class="header-settings__section-title">基础信息</div>

                    <div class="header-settings__actions">
                        <a-button size="small" @click="selectAllColumns">全选</a-button>
                        <a-button size="small" @click="resetHeaderSettings">恢复默认</a-button>
                    </div>

                    <div class="header-settings__checkboxes">
                        <a-checkbox
                            v-for="column in draftColumns"
                            :key="getColumnKey(column)"
                            :checked="isColumnVisible(column)"
                            :disabled="column.required"
                            @change="event => setColumnVisible(getColumnKey(column), event.target.checked)"
                        >
                            {{ getColumnLabel(column) }}
                        </a-checkbox>
                    </div>
                </section>

                <aside class="header-settings__selected">
                    <a-input
                        v-model:value="headerSettingsSearch"
                        placeholder="搜索"
                        allow-clear
                    >
                        <template #suffix>
                            <SearchOutlined />
                        </template>
                    </a-input>

                    <div class="header-settings__hint">最多可固定 1 项</div>

                    <div class="header-settings__list">
                        <div
                            v-for="column in selectedSettingColumns"
                            :key="getColumnKey(column)"
                            class="header-settings__list-item"
                            :class="{ 'header-settings__list-item--fixed': column.fixed }"
                        >
                            <DragOutlined class="header-settings__drag-icon" />
                            <span class="header-settings__list-title">{{ getColumnLabel(column) }}</span>

                            <a-space :size="4">
                                <a-tooltip title="固定到左侧">
                                    <a-button
                                        size="small"
                                        :type="column.fixed === 'left' || column.fixed === true ? 'primary' : 'text'"
                                        @click="toggleColumnFixed(getColumnKey(column), 'left')"
                                    >
                                        <template #icon>
                                            <VerticalLeftOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-tooltip title="固定到右侧">
                                    <a-button
                                        size="small"
                                        :type="column.fixed === 'right' ? 'primary' : 'text'"
                                        @click="toggleColumnFixed(getColumnKey(column), 'right')"
                                    >
                                        <template #icon>
                                            <VerticalRightOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-tooltip title="取消固定">
                                    <a-button
                                        size="small"
                                        type="text"
                                        :disabled="!column.fixed"
                                        @click="setColumnFixed(getColumnKey(column), undefined)"
                                    >
                                        <template #icon>
                                            <CloseCircleOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <LockOutlined v-if="column.required" class="header-settings__lock" />
                            </a-space>
                        </div>
                    </div>
                </aside>
            </div>
        </a-modal>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
    CloseCircleOutlined,
    DragOutlined,
    LockOutlined,
    SearchOutlined,
    VerticalLeftOutlined,
    VerticalRightOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import DraggableATable from './components/DraggableATable.vue';

const typeFilter = ref(undefined);
const qtyTimeRange = ref([]);
const headerSettingsOpen = ref(false);
const headerSettingsSaving = ref(false);
const headerSettingsSearch = ref('');
const draftColumns = ref([]);

const typeOptions = [
    {
        label: 'Type 1',
        value: 'Type 1',
    },
    {
        label: 'Type 2',
        value: 'Type 2',
    },
    {
        label: 'Type 3',
        value: 'Type 3',
    },
];

const getColumnKey = (column, index) => {
    if (column?.key != null) return String(column.key);

    const dataIndex = column?.dataIndex;
    if (Array.isArray(dataIndex)) return dataIndex.join('.');
    if (dataIndex != null) return String(dataIndex);

    return `column-${index}`;
};

const getColumnLabel = column => {
    if (typeof column.title === 'string') return column.title;
    if (column.label) return column.label;
    return String(column.dataIndex || column.key || '');
};

const cloneColumns = sourceColumns => sourceColumns.map(column => ({ ...column }));

const normalizeColumnsForTable = sourceColumns => {
    const left = sourceColumns.filter(column => column.fixed === true || column.fixed === 'left');
    const middle = sourceColumns.filter(column => !column.fixed);
    const right = sourceColumns.filter(column => column.fixed === 'right');

    return [...left, ...middle, ...right];
};

const serializeColumnsForApi = sourceColumns => {
    return sourceColumns.map((column, index) => ({
        key: column.key ?? column.dataIndex,
        dataIndex: column.dataIndex,
        visible: column.visible !== false,
        fixed: column.fixed || null,
        width: column.width,
        order: index,
    }));
};

const saveTableHeaderSettings = async payload => {
    console.log('[mock api] save table header settings:', payload);
    await Promise.resolve();
};

const defaultColumns = [
    {
        title: 'ID',
        dataIndex: 'id',
        align: 'left',
        fixed: 'left',
        width: 180,
        resizable: true,
        visible: true,
        required: true,
    },
    {
        title: 'Type',
        dataIndex: 'type',
        align: 'left',
        width: 170,
        resizable: true,
        visible: true,
    },
    {
        title: 'Arrival Method',
        dataIndex: 'delivery_type',
        align: 'left',
        width: 120,
        resizable: true,
        visible: true,
    },
    {
        title: 'Tracking Number',
        dataIndex: 'tracking_number',
        align: 'left',
        width: 210,
        resizable: true,
        ellipsis: true,
        visible: true,
    },
    {
        title: 'Box Count',
        dataIndex: 'box_count',
        align: 'left',
        width: 100,
        resizable: true,
        visible: true,
    },
    {
        title: 'Qty',
        dataIndex: 'qty',
        align: 'left',
        width: 300,
        resizable: true,
        visible: true,
        customRender: ({ text }) => {
            return text ? Number(text).toFixed(3) : '';
        },
    },
    {
        title: 'Remark',
        dataIndex: 'remark',
        align: 'left',
        width: 150,
        resizable: true,
        ellipsis: true,
        visible: true,
    },
    {
        title: 'Source',
        dataIndex: 'from_type',
        align: 'left',
        width: 120,
        resizable: true,
        visible: true,
    },
    {
        title: 'Status',
        dataIndex: 'status',
        align: 'left',
        width: 120,
        resizable: true,
        visible: true,
    },
    {
        title: 'Operator',
        dataIndex: 'option_user_id',
        align: 'left',
        width: 160,
        resizable: true,
        visible: true,
    },
    {
        title: 'Time',
        dataIndex: 'time',
        align: 'left',
        width: 250,
        resizable: true,
        visible: true,
    },
    {
        title: 'Operation',
        dataIndex: 'operation',
        align: 'left',
        width: 150,
        resizable: true,
        visible: true,
        required: true,
    },
];

const columns = ref(normalizeColumnsForTable(cloneColumns(defaultColumns)));

const selectedSettingColumns = computed(() => {
    const keyword = headerSettingsSearch.value.trim().toLowerCase();

    return draftColumns.value.filter(column => {
        if (!isColumnVisible(column)) return false;
        if (!keyword) return true;

        return getColumnLabel(column).toLowerCase().includes(keyword);
    });
});

const isColumnVisible = column => column.visible !== false;

const setColumnVisible = (columnKey, visible) => {
    draftColumns.value = draftColumns.value.map((column, index) => {
        if (getColumnKey(column, index) !== columnKey) return column;

        return {
            ...column,
            visible,
            fixed: visible ? column.fixed : undefined,
        };
    });
};

const setColumnFixed = (columnKey, fixed) => {
    draftColumns.value = draftColumns.value.map((column, index) => {
        const matched = getColumnKey(column, index) === columnKey;

        return {
            ...column,
            fixed: matched ? fixed : undefined,
            visible: matched ? true : column.visible,
        };
    });
};

const toggleColumnFixed = (columnKey, fixed) => {
    const currentColumn = draftColumns.value.find((column, index) => getColumnKey(column, index) === columnKey);
    const currentFixed = currentColumn?.fixed === true ? 'left' : currentColumn?.fixed;

    setColumnFixed(columnKey, currentFixed === fixed ? undefined : fixed);
};

const selectAllColumns = () => {
    draftColumns.value = draftColumns.value.map(column => ({
        ...column,
        visible: true,
    }));
};

const resetHeaderSettings = () => {
    draftColumns.value = cloneColumns(defaultColumns);
    headerSettingsSearch.value = '';
};

const openHeaderSettings = () => {
    draftColumns.value = cloneColumns(columns.value);
    headerSettingsSearch.value = '';
    headerSettingsOpen.value = true;
};

const applyHeaderSettings = async () => {
    headerSettingsSaving.value = true;

    try {
        const nextColumns = normalizeColumnsForTable(cloneColumns(draftColumns.value));
        columns.value = nextColumns;

        await saveTableHeaderSettings({
            columns: serializeColumnsForApi(nextColumns),
        });

        headerSettingsOpen.value = false;
        message.success('表头设置已保存');
    } finally {
        headerSettingsSaving.value = false;
    }
};

const handleColumnOrderChange = async ({ columns: nextColumns }) => {
    await saveTableHeaderSettings({
        columns: serializeColumnsForApi(nextColumns),
    });
};

const handleColumnResize = ({ columns: nextColumns }) => {
    saveTableHeaderSettings({
        columns: serializeColumnsForApi(nextColumns),
    });
};

const data = ref([]);
const loading = ref(true);
const selectedIds = ref([]);
let channel = null;
const CHANNEL_NAME = 'table-row-selection-channel';

const broadcastSelection = () => {
    if (!channel) return;

    channel.postMessage({
        type: 'sync-selection',
        payload: {
            selectedIds: Array.isArray(selectedIds.value) ? [...selectedIds.value] : [],
        },
    });
};

const rowSelection = ref({
    selectedRowKeys: selectedIds.value,
    onChange: selectedRowKeys => {
        selectedIds.value = selectedRowKeys;
        rowSelection.value.selectedRowKeys = selectedRowKeys;
        broadcastSelection();
    },
});

const setTriped = (record, index) => {
    return index % 2 === 0 ? 'striped' : '';
};

const fetchData = async () => {
    loading.value = true;
    setTimeout(() => {
        data.value = Array.from({ length: 80 }, (_, index) => {
            const id = index + 1;
            const typeIndex = (index % 3) + 1;

            return {
                key: id,
                id,
                type: `Type ${typeIndex}`,
                delivery_type: index % 2 === 0 ? 'Truck' : 'Express',
                tracking_number: `TRK${String(id).padStart(6, '0')}`,
                box_count: (index % 5) + 1,
                qty: ((index + 1) * 12.345).toFixed(3),
                remark: `Mock row ${id}`,
                from_type: index % 2 === 0 ? 'Online' : 'Manual',
                status: index % 3 === 0 ? 'Pending' : 'Completed',
                option_user_id: `User ${typeIndex}`,
                time: `2026-04-${String((index % 30) + 1).padStart(2, '0')} 10:00:00`,
                operation: 'View',
            };
        });
        loading.value = false;
    }, 3000);
};

onMounted(() => {
    fetchData();

    if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);

        channel.onmessage = event => {
            const { type, payload } = event.data || {};

            if (type === 'sync-selection' && payload && Array.isArray(payload.selectedIds)) {
                selectedIds.value = payload.selectedIds;
                rowSelection.value.selectedRowKeys = payload.selectedIds;
            }
        };
    } else {
        console.warn('当前浏览器不支持 BroadcastChannel API');
    }
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
        channel = null;
    }
});
</script>

<style scoped>
.table-demo {
    width: 996px;
    margin: 0 auto;
}

.table-demo__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.table-demo__selection {
    flex: 1 1 auto;
}

:deep(.table-header-filter) {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
    width: 100%;
}

:deep(.table-header-filter__label) {
    flex: 0 0 auto;
    font-weight: 600;
    line-height: 20px;
}

.header-settings {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    min-height: 480px;
    border: 1px solid #f0f0f0;
}

.header-settings__main {
    padding: 24px;
}

.header-settings__section-title {
    margin-bottom: 20px;
    color: rgba(0, 0, 0, 0.88);
    font-size: 16px;
    font-weight: 600;
}

.header-settings__actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

.header-settings__checkboxes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 24px;
}

.header-settings__selected {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-left: 1px solid #f0f0f0;
}

.header-settings__selected :deep(.ant-input-affix-wrapper) {
    border-width: 0 0 1px;
    border-radius: 0;
}

.header-settings__hint {
    padding: 12px 16px;
    color: rgba(0, 0, 0, 0.45);
    border-bottom: 1px solid #f0f0f0;
}

.header-settings__list {
    overflow: auto;
    flex: 1 1 auto;
    min-height: 0;
}

.header-settings__list-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    border-bottom: 1px solid #f5f5f5;
}

.header-settings__list-item--fixed {
    background: #f5f8ff;
}

.header-settings__drag-icon {
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.35);
}

.header-settings__list-title {
    overflow: hidden;
    flex: 1 1 auto;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.header-settings__lock {
    color: rgba(0, 0, 0, 0.3);
}
</style>
