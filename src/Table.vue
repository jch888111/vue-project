<template>
    <div class="table-demo">
        <div class="table-demo__toolbar">
            <a-alert class="table-demo__selection" type="info"
                :message="`Selected row IDs: ${selectedIds.length ? selectedIds.join(', ') : 'none'}`" show-icon />

            <a-button type="primary" @click="headerSettingsOpen = true">
                Header settings
            </a-button>
        </div>

        <DraggableATable ref="tableRef" v-model:columns="columns" :data-source="data" :loading="loading"
            :row-class-name="setStriped" :row-selection="rowSelection" :pagination="false" :sticky="{ offsetHeader: 0 }"
            :scroll="{ x: 1500 }" bordered @columnOrderChange="saveColumns" @columnResize="saveColumns">
            <template #headerCell="{ column, title }">
                <div v-if="column.dataIndex === 'type'" class="table-header-filter">
                    <span class="table-header-filter__label">Type</span>
                    <a-select v-model:value="typeFilter" :options="typeOptions" allow-clear mode="multiple"
                        placeholder="All" style="width: 100%" />
                </div>
                <div v-else-if="column.dataIndex === 'qty'" class="table-header-filter">
                    <span class="table-header-filter__label">Qty</span>
                    <a-range-picker v-model:value="qtyTimeRange" format="YYYY-MM-DD" :placeholder="['Start', 'End']"
                        style="width: 100%" />
                </div>
                <template v-else>
                    {{ title }}
                </template>
            </template>
        </DraggableATable>

        <TableHeaderSettings v-model:open="headerSettingsOpen" :columns="columns" :default-columns="defaultColumns"
            :max-fixed="1" @apply="applyHeaderSettings" />
    </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import DraggableATable from './components/DraggableATable.vue';
import TableHeaderSettings from './components/TableHeaderSettings.vue';
import { normalizeColumnsForTable, serializeColumnsForApi } from './components/tableColumnUtils';

const tableRef = ref(null);
const typeFilter = ref(undefined);
const qtyTimeRange = ref([]);
const headerSettingsOpen = ref(false);

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

const cloneColumns = sourceColumns => sourceColumns.map(column => ({ ...column }));

const defaultColumns = [
    {
        key: 'id',
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
        key: 'type',
        title: 'Type',
        dataIndex: 'type',
        align: 'left',
        width: 170,
        resizable: true,
        visible: true,
    },
    {
        key: 'delivery_type',
        title: 'Arrival Method',
        dataIndex: 'delivery_type',
        align: 'left',
        width: 140,
        resizable: true,
        visible: true,
    },
    {
        key: 'tracking_number',
        title: 'Tracking Number',
        dataIndex: 'tracking_number',
        align: 'left',
        width: 210,
        resizable: true,
        ellipsis: true,
        visible: true,
    },
    {
        key: 'box_count',
        title: 'Box Count',
        dataIndex: 'box_count',
        align: 'left',
        width: 120,
        resizable: true,
        visible: true,
    },
    {
        key: 'qty',
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
        key: 'remark',
        title: 'Remark',
        dataIndex: 'remark',
        align: 'left',
        width: 150,
        resizable: true,
        ellipsis: true,
        visible: true,
    },
    {
        key: 'from_type',
        title: 'Source',
        dataIndex: 'from_type',
        align: 'left',
        width: 120,
        resizable: true,
        visible: true,
    },
    {
        key: 'status',
        title: 'Status',
        dataIndex: 'status',
        align: 'left',
        width: 120,
        resizable: true,
        visible: true,
    },
    {
        key: 'option_user_id',
        title: 'Operator',
        dataIndex: 'option_user_id',
        align: 'left',
        width: 160,
        resizable: true,
        visible: true,
    },
    {
        key: 'time',
        title: 'Time',
        dataIndex: 'time',
        align: 'left',
        width: 250,
        resizable: true,
        visible: true,
    },
    {
        key: 'operation',
        title: 'Operation',
        dataIndex: 'operation',
        align: 'left',
        width: 150,
        resizable: true,
        visible: true,
        fixed: 'right',
        required: true,
    },
];

const columns = ref(normalizeColumnsForTable(cloneColumns(defaultColumns)));
const data = ref([]);
const loading = ref(true);
const selectedIds = ref([]);
let channel = null;

const saveTableHeaderSettings = async payload => {
    console.log('[mock api] save table header settings:', payload);
    await Promise.resolve();
};

const applyHeaderSettings = async ({ columns: nextColumns, serializedColumns }) => {
    columns.value = nextColumns;

    await saveTableHeaderSettings({
        columns: serializedColumns,
    });
};

const saveColumns = async ({ columns: nextColumns }) => {
    await saveTableHeaderSettings({
        columns: serializeColumnsForApi(nextColumns),
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

const broadcastSelection = () => {
    if (!channel) return;

    channel.postMessage({
        type: 'sync-selection',
        payload: {
            selectedIds: Array.isArray(selectedIds.value) ? [...selectedIds.value] : [],
        },
    });
};

const setStriped = (record, index) => {
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
        channel = new BroadcastChannel('table-row-selection-channel');

        channel.onmessage = event => {
            const { type, payload } = event.data || {};

            if (type === 'sync-selection' && payload && Array.isArray(payload.selectedIds)) {
                selectedIds.value = payload.selectedIds;
                rowSelection.value.selectedRowKeys = payload.selectedIds;
            }
        };
    } else {
        console.warn('BroadcastChannel API is not supported in this browser.');
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
</style>
