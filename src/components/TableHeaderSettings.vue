<template>
    <a-modal
        :open="open"
        title="Header settings"
        width="920px"
        ok-text="Save and apply"
        cancel-text="Cancel"
        @update:open="value => emit('update:open', value)"
        @ok="applySettings"
    >
        <div class="table-header-settings">
            <section class="table-header-settings__main">
                <div class="table-header-settings__title">Columns</div>

                <div class="table-header-settings__actions">
                    <a-button size="small" @click="selectAllColumns">Select all</a-button>
                    <a-button size="small" @click="resetColumns">Reset</a-button>
                </div>

                <div class="table-header-settings__checkboxes">
                    <a-checkbox
                        v-for="column in draftColumns"
                        :key="getKey(column)"
                        :checked="isColumnVisible(column, visibleField)"
                        :disabled="column.required"
                        @change="event => setColumnVisible(getKey(column), event.target.checked)"
                    >
                        {{ getColumnLabel(column) }}
                    </a-checkbox>
                </div>
            </section>

            <aside class="table-header-settings__selected">
                <a-input v-model:value="keyword" placeholder="Search" allow-clear>
                    <template #suffix>
                        <SearchOutlined />
                    </template>
                </a-input>

                <div class="table-header-settings__hint">
                    Max fixed columns: {{ maxFixed }}
                </div>

                <div class="table-header-settings__list">
                    <div
                        v-for="column in selectedColumns"
                        :key="getKey(column)"
                        class="table-header-settings__item"
                        :class="{ 'table-header-settings__item--fixed': column.fixed }"
                    >
                        <DragOutlined class="table-header-settings__drag-icon" />
                        <span class="table-header-settings__item-title">{{ getColumnLabel(column) }}</span>

                        <a-space :size="4">
                            <a-tooltip title="Fix left">
                                <a-button
                                    size="small"
                                    :type="column.fixed === 'left' || column.fixed === true ? 'primary' : 'text'"
                                    @click="toggleColumnFixed(getKey(column), 'left')"
                                >
                                    <template #icon>
                                        <VerticalLeftOutlined />
                                    </template>
                                </a-button>
                            </a-tooltip>

                            <a-tooltip title="Fix right">
                                <a-button
                                    size="small"
                                    :type="column.fixed === 'right' ? 'primary' : 'text'"
                                    @click="toggleColumnFixed(getKey(column), 'right')"
                                >
                                    <template #icon>
                                        <VerticalRightOutlined />
                                    </template>
                                </a-button>
                            </a-tooltip>

                            <a-tooltip title="Clear fixed">
                                <a-button
                                    size="small"
                                    type="text"
                                    :disabled="!column.fixed"
                                    @click="setColumnFixed(getKey(column), undefined)"
                                >
                                    <template #icon>
                                        <CloseCircleOutlined />
                                    </template>
                                </a-button>
                            </a-tooltip>

                            <LockOutlined v-if="column.required" class="table-header-settings__lock" />
                        </a-space>
                    </div>
                </div>
            </aside>
        </div>
    </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
    CloseCircleOutlined,
    DragOutlined,
    LockOutlined,
    SearchOutlined,
    VerticalLeftOutlined,
    VerticalRightOutlined,
} from '@ant-design/icons-vue';
import {
    DEFAULT_VISIBLE_FIELD,
    getColumnKey,
    isColumnVisible,
    normalizeColumnsForTable,
    serializeColumnsForApi,
} from './tableColumnUtils';

const props = defineProps({
    open: {
        type: Boolean,
        default: false,
    },
    columns: {
        type: Array,
        default: () => [],
    },
    defaultColumns: {
        type: Array,
        default: () => [],
    },
    visibleField: {
        type: String,
        default: DEFAULT_VISIBLE_FIELD,
    },
    columnKeyField: {
        type: [String, Function],
        default: '',
    },
    maxFixed: {
        type: Number,
        default: 1,
    },
});

const emit = defineEmits(['update:open', 'apply']);

const draftColumns = ref([]);
const keyword = ref('');

const columnOptions = computed(() => ({
    columnKeyField: props.columnKeyField,
    visibleField: props.visibleField,
}));

const cloneColumns = columns => columns.map(column => ({ ...column }));

const getKey = (column, index) => getColumnKey(column, index, columnOptions.value);

const getColumnLabel = column => {
    if (typeof column.title === 'string') return column.title;
    if (column.label) return column.label;
    return String(column.dataIndex || column.key || '');
};

const selectedColumns = computed(() => {
    const value = keyword.value.trim().toLowerCase();

    return draftColumns.value.filter(column => {
        if (!isColumnVisible(column, props.visibleField)) return false;
        if (!value) return true;
        return getColumnLabel(column).toLowerCase().includes(value);
    });
});

const setColumnVisible = (columnKey, visible) => {
    draftColumns.value = draftColumns.value.map((column, index) => {
        if (getKey(column, index) !== columnKey) return column;

        return {
            ...column,
            [props.visibleField]: visible,
            fixed: visible ? column.fixed : undefined,
        };
    });
};

const setColumnFixed = (columnKey, fixed) => {
    draftColumns.value = draftColumns.value.map((column, index) => {
        const matched = getKey(column, index) === columnKey;
        const shouldClearFixed = props.maxFixed === 1 && fixed;

        return {
            ...column,
            fixed: matched ? fixed : shouldClearFixed ? undefined : column.fixed,
            [props.visibleField]: matched ? true : column[props.visibleField],
        };
    });
};

const toggleColumnFixed = (columnKey, fixed) => {
    const currentColumn = draftColumns.value.find((column, index) => getKey(column, index) === columnKey);
    const currentFixed = currentColumn?.fixed === true ? 'left' : currentColumn?.fixed;

    setColumnFixed(columnKey, currentFixed === fixed ? undefined : fixed);
};

const selectAllColumns = () => {
    draftColumns.value = draftColumns.value.map(column => ({
        ...column,
        [props.visibleField]: true,
    }));
};

const resetColumns = () => {
    draftColumns.value = cloneColumns(props.defaultColumns.length ? props.defaultColumns : props.columns);
    keyword.value = '';
};

const applySettings = () => {
    const columns = normalizeColumnsForTable(cloneColumns(draftColumns.value), columnOptions.value);

    emit('apply', {
        columns,
        serializedColumns: serializeColumnsForApi(columns, columnOptions.value),
    });
    emit('update:open', false);
};

watch(
    () => props.open,
    open => {
        if (!open) return;

        draftColumns.value = cloneColumns(props.columns);
        keyword.value = '';
    },
);
</script>

<style scoped>
.table-header-settings {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    min-height: 480px;
    border: 1px solid #f0f0f0;
}

.table-header-settings__main {
    padding: 24px;
}

.table-header-settings__title {
    margin-bottom: 20px;
    color: rgba(0, 0, 0, 0.88);
    font-size: 16px;
    font-weight: 600;
}

.table-header-settings__actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

.table-header-settings__checkboxes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 24px;
}

.table-header-settings__selected {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-left: 1px solid #f0f0f0;
}

.table-header-settings__selected :deep(.ant-input-affix-wrapper) {
    border-width: 0 0 1px;
    border-radius: 0;
}

.table-header-settings__hint {
    padding: 12px 16px;
    color: rgba(0, 0, 0, 0.45);
    border-bottom: 1px solid #f0f0f0;
}

.table-header-settings__list {
    overflow: auto;
    flex: 1 1 auto;
    min-height: 0;
}

.table-header-settings__item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    border-bottom: 1px solid #f5f5f5;
}

.table-header-settings__item--fixed {
    background: #f5f8ff;
}

.table-header-settings__drag-icon {
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.35);
}

.table-header-settings__item-title {
    overflow: hidden;
    flex: 1 1 auto;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.table-header-settings__lock {
    color: rgba(0, 0, 0, 0.3);
}
</style>
