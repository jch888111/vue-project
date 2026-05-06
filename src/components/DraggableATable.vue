<template>
    <div ref="tableWrapper" class="draggable-a-table">
        <a-table v-bind="attrs" :columns="tableColumns" @resizeColumn="handleResizeColumn">
            <template v-for="(_, name) in forwardedSlots" #[name]="slotProps">
                <slot :name="name" v-bind="slotProps || {}" />
            </template>
        </a-table>
    </div>
</template>

<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, useAttrs, useSlots, watch } from 'vue';
import { HolderOutlined } from '@ant-design/icons-vue';
import { useDraggable } from 'vue-draggable-plus';
import {
    DEFAULT_FIXED_BEHAVIOR,
    DEFAULT_VISIBLE_FIELD,
    filterVisibleColumns,
    getColumnKey as resolveColumnKey,
    isLockedColumn,
    normalizeColumnsForTable,
    serializeColumnsForApi,
    sortColumnsWithHiddenFollowers,
    splitColumns,
} from './tableColumnUtils';

defineOptions({
    name: 'DraggableATable',
    inheritAttrs: false,
});

const props = defineProps({
    columns: {
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
    draggable: {
        type: Boolean,
        default: true,
    },
    resizable: {
        type: Boolean,
        default: true,
    },
    fixedBehavior: {
        type: String,
        default: DEFAULT_FIXED_BEHAVIOR,
        validator: value => ['normalize', 'none'].includes(value),
    },
    stopHeaderSlotEvents: {
        type: Boolean,
        default: true,
    },
});

const emit = defineEmits(['update:columns', 'columnOrderChange', 'columnResize']);

const attrs = useAttrs();
const slots = useSlots();
const tableWrapper = ref(null);
const orderedColumns = shallowRef([]);
const originColumnMeta = new WeakMap();

const DRAG_HANDLE_CLASS = 'draggable-a-table__drag-handle';

const columnOptions = computed(() => ({
    columnKeyField: props.columnKeyField,
    fixedBehavior: props.fixedBehavior,
    visibleField: props.visibleField,
}));

const getColumnKey = (column, index) => resolveColumnKey(column, index, columnOptions.value);

const shouldEnableResize = column => {
    return props.resizable && column?.resizable !== false && typeof column?.width === 'number';
};

const mergeClass = (sourceClass, addedClass) => {
    if (!sourceClass) return addedClass;
    return [sourceClass, addedClass];
};

const getOriginColumnMeta = column => {
    if (!originColumnMeta.has(column)) {
        originColumnMeta.set(column, {
            title: column.title,
            customHeaderCell: column.customHeaderCell,
        });
    }

    return originColumnMeta.get(column);
};

const toExternalColumn = column => {
    const originMeta = getOriginColumnMeta(column);

    return {
        ...column,
        title: originMeta.title,
        customHeaderCell: originMeta.customHeaderCell,
    };
};

const toExternalColumns = columns => columns.map(toExternalColumn);

const forwardedSlots = computed(() => {
    const { headerCell, ...restSlots } = slots;
    return restSlots;
});

const stopHeaderSlotEvent = event => {
    event.stopPropagation();
};

const wrapHeaderSlotContent = content => {
    if (!props.stopHeaderSlotEvents) return content;

    const children = Array.isArray(content) ? content : [content];

    return h(
        'div',
        {
            class: 'draggable-a-table__header-slot',
            onClick: stopHeaderSlotEvent,
            onMousedown: stopHeaderSlotEvent,
            onPointerdown: stopHeaderSlotEvent,
            onTouchstart: stopHeaderSlotEvent,
        },
        children,
    );
};

const getDraggableHeaderCell = (column, index, originCustomHeaderCell) => {
    const key = getColumnKey(column, index);

    return (...args) => {
        const originProps = originCustomHeaderCell?.(...args) || {};

        return {
            ...originProps,
            class: mergeClass(originProps.class, 'draggable-a-table__header-cell'),
            'data-draggable-column': 'true',
            'data-column-key': key,
        };
    };
};

const renderColumnTitle = (column, titleProps) => {
    const originTitle = getOriginColumnMeta(column).title;

    if (slots.headerCell) {
        return wrapHeaderSlotContent(slots.headerCell({
            ...titleProps,
            title: originTitle,
            column: toExternalColumn(column),
        }));
    }

    if (typeof originTitle === 'function') return originTitle(titleProps);
    return originTitle;
};

const getSlotTitle = column => {
    return titleProps => renderColumnTitle(column, titleProps);
};

const getDraggableTitle = column => {
    return titleProps => {
        const titleNode = renderColumnTitle(column, titleProps);
        const titleChildren = Array.isArray(titleNode) ? titleNode : [titleNode];

        return h(
            'div',
            {
                class: 'draggable-a-table__title',
            },
            [
                h(
                    'span',
                    {
                        class: DRAG_HANDLE_CLASS,
                        title: 'Drag to reorder columns',
                        onClick: event => event.stopPropagation(),
                    },
                    [h(HolderOutlined)],
                ),
                h(
                    'div',
                    {
                        class: 'draggable-a-table__title-text',
                    },
                    titleChildren,
                ),
            ],
        );
    };
};

const prepareColumns = columns => {
    return columns.map((column, index) => {
        const originMeta = getOriginColumnMeta(column);
        const nextColumn = {
            ...column,
            title: originMeta.title,
            customHeaderCell: originMeta.customHeaderCell,
        };

        originColumnMeta.set(nextColumn, originMeta);

        if (shouldEnableResize(nextColumn)) {
            nextColumn.resizable = true;
        }

        if (props.draggable && !isLockedColumn(nextColumn)) {
            nextColumn.title = getDraggableTitle(nextColumn);
            nextColumn.customHeaderCell = getDraggableHeaderCell(nextColumn, index, originMeta.customHeaderCell);
        } else if (slots.headerCell) {
            nextColumn.title = getSlotTitle(nextColumn);
        }

        return nextColumn;
    });
};

const visibleColumns = computed(() => {
    return filterVisibleColumns(orderedColumns.value, props.visibleField);
});

const normalizedVisibleColumns = computed(() => {
    return normalizeColumnsForTable(visibleColumns.value, columnOptions.value);
});

const tableColumns = computed(() => prepareColumns(normalizedVisibleColumns.value));

const normalizeColumns = columns => {
    return normalizeColumnsForTable(columns, columnOptions.value);
};

const syncColumnsFromProps = () => {
    orderedColumns.value = normalizeColumns(props.columns);
};

const findHeaderRow = () => {
    const wrapper = tableWrapper.value;
    if (!wrapper || !props.draggable) return null;

    const rows = Array.from(wrapper.querySelectorAll('.ant-table-thead > tr'));
    return rows.find(row => row.querySelector('[data-draggable-column="true"]')) || null;
};

const emitColumnOrderChange = columns => {
    const externalColumns = toExternalColumns(columns);
    const columnKeys = externalColumns.map((column, index) => getColumnKey(column, index));

    emit('columnOrderChange', {
        columns: externalColumns,
        columnKeys,
    });
};

const emitColumnsUpdate = columns => {
    emit('update:columns', toExternalColumns(columns));
};

const reorderNonFixedColumnsInPlace = (columns, orderedVisibleKeys) => {
    const result = [];
    let segment = [];

    const flushSegment = () => {
        if (!segment.length) return;

        result.push(...sortColumnsWithHiddenFollowers(segment, orderedVisibleKeys, columnOptions.value));
        segment = [];
    };

    columns.forEach((column, index) => {
        if (isLockedColumn(column)) {
            flushSegment();
            result.push(column);
            return;
        }

        segment.push({
            column,
            key: getColumnKey(column, index),
        });
    });

    flushSegment();

    return result;
};

const applyDomColumnOrder = target => {
    if (!props.draggable) return;

    const domKeys = Array.from(target.querySelectorAll('[data-draggable-column="true"]'))
        .map(element => element.dataset.columnKey)
        .filter(Boolean);

    let nextColumns;

    if (props.fixedBehavior === 'none') {
        nextColumns = reorderNonFixedColumnsInPlace(orderedColumns.value, domKeys);
    } else {
        const { left, middle, right } = splitColumns(orderedColumns.value, columnOptions.value);
        const mergedMiddle = sortColumnsWithHiddenFollowers(middle, domKeys, columnOptions.value);

        nextColumns = [
            ...left.map(item => item.column),
            ...mergedMiddle,
            ...right.map(item => item.column),
        ];
    }

    orderedColumns.value = nextColumns;
    emitColumnsUpdate(nextColumns);
    emitColumnOrderChange(nextColumns);
};

const handleResizeColumn = (width, column) => {
    if (!props.resizable) return;

    column.width = width;

    const resizedColumnKey = getColumnKey(column);
    orderedColumns.value.forEach((currentColumn, index) => {
        if (getColumnKey(currentColumn, index) === resizedColumnKey) {
            currentColumn.width = width;
        }
    });

    triggerRef(orderedColumns);
    emitColumnsUpdate(orderedColumns.value);
    emit('columnResize', {
        width,
        column: toExternalColumn(column),
        columns: toExternalColumns(orderedColumns.value),
    });
};

const draggableController = useDraggable(null, {
    immediate: false,
    animation: 150,
    direction: 'horizontal',
    draggable: '[data-draggable-column="true"]',
    handle: `.${DRAG_HANDLE_CLASS}`,
    ghostClass: 'draggable-a-table__ghost',
    chosenClass: 'draggable-a-table__chosen',
    filter: '.ant-table-selection-column,.ant-table-resize-handle,th:not([data-draggable-column="true"])',
    preventOnFilter: false,
    onUpdate(event) {
        applyDomColumnOrder(event.to);
    },
});

const refreshDraggable = async () => {
    await nextTick();

    if (!props.draggable) {
        draggableController.pause?.();
        return;
    }

    const headerRow = findHeaderRow();
    if (!headerRow) return;

    draggableController.start(headerRow);
};

const getColumns = () => toExternalColumns(orderedColumns.value);
const getVisibleColumns = () => toExternalColumns(normalizedVisibleColumns.value);

defineExpose({
    getColumns,
    getVisibleColumns,
    normalizeColumns,
    serializeColumnsForApi: columns => serializeColumnsForApi(columns ?? orderedColumns.value, columnOptions.value),
});

watch(
    () => props.columns,
    () => {
        syncColumnsFromProps();
        refreshDraggable();
    },
    {
        deep: true,
        immediate: true,
    },
);

watch(
    () => [tableColumns.value, props.draggable],
    refreshDraggable,
    {
        flush: 'post',
    },
);

onMounted(refreshDraggable);

onBeforeUnmount(() => {
    draggableController.destroy();
});
</script>

<style scoped>
.draggable-a-table :deep(th[data-draggable-column='true']) {
    user-select: none;
}

.draggable-a-table :deep(.ant-table-thead > tr > th) {
    height: auto;
    width: 100%;
    padding: 12px 24px;
    vertical-align: top;
}

.draggable-a-table :deep(.ant-table-tbody > tr > td) {
    padding: 12px 24px;
}

.draggable-a-table :deep(.draggable-a-table__title) {
    position: relative;
    display: block;
    width: 100%;
}

.draggable-a-table :deep(.draggable-a-table__drag-handle) {
    position: absolute;
    top: 2px;
    left: -20px;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: rgba(0, 0, 0, 0.45);
    cursor: grab;
    opacity: 0;
    transition: color 0.2s ease, opacity 0.2s ease;
}

.draggable-a-table :deep(th[data-draggable-column='true']:hover .draggable-a-table__drag-handle),
.draggable-a-table :deep(.draggable-a-table__chosen .draggable-a-table__drag-handle) {
    opacity: 1;
}

.draggable-a-table :deep(.draggable-a-table__drag-handle:active) {
    cursor: grabbing;
}

.draggable-a-table :deep(.draggable-a-table__drag-handle:hover) {
    color: #1677ff;
}

.draggable-a-table :deep(.draggable-a-table__title-text) {
    min-width: 0;
    width: 100%;
    line-height: 20px;
}

.draggable-a-table :deep(.draggable-a-table__header-slot) {
    width: 100%;
    min-width: 0;
}

.draggable-a-table :deep(.draggable-a-table__chosen) {
    background: #e6f4ff;
}

.draggable-a-table :deep(.draggable-a-table__ghost) {
    opacity: 0.45;
    background: #bae0ff;
}
</style>
