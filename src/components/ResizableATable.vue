<template>
    <a-table v-bind="attrs" :columns="tableColumns" @resizeColumn="handleResizeColumn">
        <template v-for="(_, name) in $slots" #[name]="slotProps">
            <slot :name="name" v-bind="slotProps || {}" />
        </template>
    </a-table>
</template>

<script setup>
import { computed, shallowRef, triggerRef, useAttrs, watch } from 'vue';

defineOptions({
    name: 'ResizableATable',
    inheritAttrs: false,
});

const props = defineProps({
    columns: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits(['update:columns', 'columnResize']);

const attrs = useAttrs();
const innerColumns = shallowRef([]);

const getColumnKey = (column, index) => {
    if (column?.key != null) return String(column.key);

    const dataIndex = column?.dataIndex;
    if (Array.isArray(dataIndex)) return dataIndex.join('.');
    if (dataIndex != null) return String(dataIndex);

    return `column-${index}`;
};

const shouldEnableResize = column => {
    return column?.resizable !== false && typeof column?.width === 'number';
};

const normalizeColumns = columns => {
    return columns.map(column => {
        const nextColumn = {
            ...column,
        };

        if (Array.isArray(column.children)) {
            nextColumn.children = normalizeColumns(column.children);
        }

        if (shouldEnableResize(nextColumn)) {
            nextColumn.resizable = true;
        }

        return nextColumn;
    });
};

const toExternalColumns = columns => {
    return columns.map(column => {
        const nextColumn = {
            ...column,
        };

        if (Array.isArray(column.children)) {
            nextColumn.children = toExternalColumns(column.children);
        }

        return nextColumn;
    });
};

const findColumnByKey = (columns, targetKey) => {
    for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];

        if (getColumnKey(column, index) === targetKey) {
            return column;
        }

        if (Array.isArray(column.children)) {
            const matchedColumn = findColumnByKey(column.children, targetKey);
            if (matchedColumn) return matchedColumn;
        }
    }

    return null;
};

const tableColumns = computed(() => innerColumns.value);

const handleResizeColumn = (width, column) => {
    const columnKey = getColumnKey(column);
    const matchedColumn = findColumnByKey(innerColumns.value, columnKey) || column;

    matchedColumn.width = width;
    column.width = width;
    triggerRef(innerColumns);

    const externalColumns = toExternalColumns(innerColumns.value);

    emit('update:columns', externalColumns);
    emit('columnResize', {
        width,
        column: {
            ...matchedColumn,
        },
        columns: externalColumns,
    });
};

watch(
    () => props.columns,
    columns => {
        innerColumns.value = normalizeColumns(columns);
    },
    {
        deep: true,
        immediate: true,
    },
);
</script>
