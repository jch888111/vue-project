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

defineOptions({
    inheritAttrs: false,
});

const props = defineProps({
    columns: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits(['update:columns', 'columnOrderChange', 'columnResize']);

const attrs = useAttrs();
const slots = useSlots();
const tableWrapper = ref(null);
const orderedColumns = shallowRef([]);
const originColumnMeta = new WeakMap();

const DRAG_HANDLE_CLASS = 'draggable-a-table__drag-handle';

const getColumnKey = (column, index) => {
    if (column?.key != null) return String(column.key);

    const dataIndex = column?.dataIndex;
    if (Array.isArray(dataIndex)) return dataIndex.join('.');
    if (dataIndex != null) return String(dataIndex);

    return `column-${index}`;
};

const isLeftFixedColumn = column => column?.fixed === true || column?.fixed === 'left';
const isRightFixedColumn = column => column?.fixed === 'right';
const isLockedColumn = column => isLeftFixedColumn(column) || isRightFixedColumn(column);
const isResizableColumn = column => column?.resizable && typeof column?.width === 'number';

const splitColumns = columns => {
    return columns.reduce(
        (result, column, index) => {
            const item = {
                column,
                key: getColumnKey(column, index),
            };

            if (isLeftFixedColumn(column)) {
                result.left.push(item);
            } else if (isRightFixedColumn(column)) {
                result.right.push(item);
            } else {
                result.middle.push(item);
            }

            return result;
        },
        {
            left: [],
            middle: [],
            right: [],
        },
    );
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
        return slots.headerCell({
            ...titleProps,
            title: originTitle,
            column: toExternalColumn(column),
        });
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

        if (isResizableColumn(nextColumn)) {
            nextColumn.resizable = true;
        }

        if (!isLockedColumn(nextColumn)) {
            nextColumn.title = getDraggableTitle(nextColumn);
            nextColumn.customHeaderCell = getDraggableHeaderCell(nextColumn, index, originMeta.customHeaderCell);
        } else if (slots.headerCell) {
            nextColumn.title = getSlotTitle(nextColumn);
        }

        return nextColumn;
    });
};

const normalizeColumnsForTable = columns => {
    const { left, middle, right } = splitColumns(columns);

    return [
        ...left.map(item => item.column),
        ...middle.map(item => item.column),
        ...right.map(item => item.column),
    ];
};

const visibleColumns = computed(() => {
    return orderedColumns.value.filter(column => column.visible !== false);
});

const tableColumns = computed(() => prepareColumns(normalizeColumnsForTable(visibleColumns.value)));

const syncColumnsFromProps = () => {
    orderedColumns.value = normalizeColumnsForTable(props.columns);
};

const findHeaderRow = () => {
    const wrapper = tableWrapper.value;
    if (!wrapper) return null;

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

const sortColumnsWithHiddenFollowers = (items, orderedVisibleKeys) => {
    const leadingHiddenColumns = [];
    const groups = [];
    let currentGroup = null;

    items.forEach(item => {
        if (item.column.visible === false) {
            if (currentGroup) {
                currentGroup.columns.push(item.column);
            } else {
                leadingHiddenColumns.push(item.column);
            }
            return;
        }

        currentGroup = {
            key: item.key,
            columns: [item.column],
        };
        groups.push(currentGroup);
    });

    const groupByKey = new Map(groups.map(group => [group.key, group]));
    const usedKeys = new Set();
    const sortedGroups = [];

    orderedVisibleKeys.forEach(key => {
        if (!groupByKey.has(key) || usedKeys.has(key)) return;

        usedKeys.add(key);
        sortedGroups.push(groupByKey.get(key));
    });

    groups.forEach(group => {
        if (usedKeys.has(group.key)) return;
        sortedGroups.push(group);
    });

    return [
        ...leadingHiddenColumns,
        ...sortedGroups.flatMap(group => group.columns),
    ];
};

const applyDomColumnOrder = target => {
    const { left, middle, right } = splitColumns(orderedColumns.value);

    const domKeys = Array.from(target.querySelectorAll('[data-draggable-column="true"]'))
        .map(element => element.dataset.columnKey)
        .filter(Boolean);

    const mergedMiddle = sortColumnsWithHiddenFollowers(middle, domKeys);

    const nextColumns = [
        ...left.map(item => item.column),
        ...mergedMiddle,
        ...right.map(item => item.column),
    ];

    orderedColumns.value = nextColumns;
    emitColumnsUpdate(nextColumns);
    emitColumnOrderChange(nextColumns);
};

const handleResizeColumn = (width, column) => {
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

const draggable = useDraggable(null, {
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

    const headerRow = findHeaderRow();
    if (!headerRow) return;

    draggable.start(headerRow);
};

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

watch(tableColumns, refreshDraggable, {
    flush: 'post',
});

onMounted(refreshDraggable);

onBeforeUnmount(() => {
    draggable.destroy();
});
</script>

<style scoped>
.draggable-a-table :deep(th[data-draggable-column='true']) {
    user-select: none;
}

.draggable-a-table :deep(.ant-table-thead > tr > th) {
    height: auto;
    padding: 12px;
    vertical-align: top;
}

.draggable-a-table :deep(.draggable-a-table__title) {
    display: flex;
    gap: 6px;
}

.draggable-a-table :deep(.draggable-a-table__drag-handle) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    margin-top: 2px;
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
    line-height: 20px;
}

.draggable-a-table :deep(.draggable-a-table__chosen) {
    background: #e6f4ff;
}

.draggable-a-table :deep(.draggable-a-table__ghost) {
    opacity: 0.45;
    background: #bae0ff;
}
</style>
