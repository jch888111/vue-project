# DraggableATable 使用文档

`DraggableATable` 是基于 `ant-design-vue` 的 `a-table` 封装的通用增强表格组件。它只负责表格能力增强，其他功能参考官方文档。

## 能力范围

- 支持列拖拽排序。
- 支持列宽 resize，并通过 `v-model:columns` 回写完整列配置。
- 支持通过业务字段控制列显示隐藏，默认字段为 `visible`。
- 支持 `fixed: 'left' | 'right'` 固定列，并默认归位到左右两侧。
- 支持 `#headerCell` 插槽，内置表头插槽事件隔离，避免筛选控件误触发拖拽。
- 保留并透传大部分 `a-table` props、attrs 和普通 slots。

## 基础用法

```vue
<template>
  <DraggableATable
    v-model:columns="columns"
    :data-source="data"
    :scroll="{ x: 1500 }"
    bordered
    @columnOrderChange="saveColumns"
    @columnResize="saveColumns"
  />
</template>

<script setup>
import { ref } from "vue";
import DraggableATable from "@/components/DraggableATable.vue";
import { serializeColumnsForApi } from "@/components/tableColumnUtils";

const columns = ref([
  {
    key: "order_no",
    title: "Order No.",
    dataIndex: "order_no",
    width: 180,
    visible: true,
    resizable: true,
  },
]);

const data = ref([]);

const saveColumns = async ({ columns }) => {
  await saveTableColumns({
    columns: serializeColumnsForApi(columns),
  });
};
</script>
```

## 列配置约定

推荐每一列都配置稳定的 `key`。没有 `key` 时组件会依次使用 `dataIndex`、`column-${index}` 作为兜底。

```js
{
  key: 'system_order_no',
  title: '系统订单号',
  dataIndex: 'system_order_no',
  width: 180,
  visible: true,
  fixed: undefined,
  resizable: true,
  required: false,
}
```

常用字段：

| 字段        | 说明                                                     |
| ----------- | -------------------------------------------------------- |
| `key`       | 推荐必填，列的稳定唯一标识                               |
| `dataIndex` | `a-table` 原生字段，也可作为列 key 兜底                  |
| `visible`   | 业务字段，`false` 时不渲染该列                           |
| `fixed`     | `a-table` 原生字段，支持 `'left'`、`'right'`、`true`     |
| `resizable` | 是否允许 resize，默认为允许；需要配合数字 `width`        |
| `required`  | 业务字段，组件本身不处理，表头设置弹窗可用它禁用取消勾选 |

## Props

| Prop                   | 类型                    | 默认值        | 说明                                |
| ---------------------- | ----------------------- | ------------- | ----------------------------------- |
| `columns`              | `Array`                 | `[]`          | 完整列配置，包含隐藏列              |
| `visibleField`         | `String`                | `'visible'`   | 控制显示隐藏的字段名                |
| `columnKeyField`       | `String \| Function`    | `''`          | 自定义列 key 来源                   |
| `draggable`            | `Boolean`               | `true`        | 是否启用列拖拽                      |
| `resizable`            | `Boolean`               | `true`        | 是否启用列 resize                   |
| `fixedBehavior`        | `'normalize' \| 'none'` | `'normalize'` | 是否自动把 fixed 列归位到左右两侧   |
| `stopHeaderSlotEvents` | `Boolean`               | `true`        | 是否阻止 `#headerCell` 插槽事件冒泡 |

`DraggableATable` 使用 `inheritAttrs: false`，除上述 props 外的属性会继续透传给内部 `a-table`。

## Events

### `update:columns`

拖拽或 resize 后触发，用于 `v-model:columns`。

```js
columns => void
```

### `columnOrderChange`

拖拽列顺序后触发。

```js
{
  columns: Array,
  columnKeys: Array<string>,
}
```

### `columnResize`

调整列宽后触发。

```js
{
  width: number,
  column: Object,
  columns: Array,
}
```

## Expose 方法

通过 `ref` 可以访问：

```vue
<DraggableATable ref="tableRef" v-model:columns="columns" />
```

```js
tableRef.value.getColumns();
tableRef.value.getVisibleColumns();
tableRef.value.normalizeColumns(columns);
tableRef.value.serializeColumnsForApi(columns);
```

| 方法                               | 说明                             |
| ---------------------------------- | -------------------------------- |
| `getColumns()`                     | 获取当前完整列配置               |
| `getVisibleColumns()`              | 获取当前渲染列配置               |
| `normalizeColumns(columns)`        | 按当前 props 标准化 fixed 列位置 |
| `serializeColumnsForApi(columns?)` | 输出适合接口保存的字段           |

## 表头插槽

`#headerCell` 支持继续使用业务筛选控件：

```vue
<DraggableATable v-model:columns="columns">
  <template #headerCell="{ column, title }">
    <div v-if="column.dataIndex === 'type'" class="table-header-filter">
      <span>Type</span>
      <a-select
        v-model:value="typeFilter"
        :options="typeOptions"
        mode="multiple"
        style="width: 100%"
      />
    </div>
    <template v-else>
      {{ title }}
    </template>
  </template>
</DraggableATable>
```

默认 `stopHeaderSlotEvents=true`，组件会阻止 `click`、`mousedown`、`pointerdown`、`touchstart` 冒泡，因此筛选控件不需要手写 `.stop`。

如果某些排序列希望点击插槽内容也触发 `a-table` 排序，可以关闭：

```vue
<DraggableATable :stop-header-slot-events="false" />
```

## 表头设置组件

`TableHeaderSettings` 是可选业务 UI 组件，负责编辑完整列配置：

```vue
<TableHeaderSettings
  v-model:open="headerSettingsOpen"
  :columns="columns"
  :default-columns="defaultColumns"
  :max-fixed="1"
  @apply="applyHeaderSettings"
/>
```

```js
const applyHeaderSettings = async ({ columns, serializedColumns }) => {
  columns.value = columns;

  await saveTableColumns({
    columns: serializedColumns,
  });
};
```

它不属于 `DraggableATable` 核心能力，可以按业务设计自行替换。

## 接口保存建议

不要把 `customRender`、`title` 函数、`customHeaderCell` 等函数保存到后端。推荐保存纯配置：

```js
{
  key: 'order_no',
  dataIndex: 'order_no',
  visible: true,
  fixed: null,
  width: 180,
  order: 0,
}
```

可直接使用：

```js
import { serializeColumnsForApi } from "@/components/tableColumnUtils";

const payload = {
  columns: serializeColumnsForApi(columns.value),
};
```

## 拖拽和隐藏列规则

- `fixed` 列不会显示拖拽手柄。
- 默认 `fixedBehavior='normalize'` 时，左固定列始终在左侧，右固定列始终在右侧。
- `visible=false` 的列不会渲染，但仍保留在完整 `columns` 中。
- 隐藏列会跟随它前面的可见列一起移动。

示例：

```js
[A, B(hidden), C, D];
```

把 `D` 拖到 `A` 前面后：

```js
[D, A, B(hidden), C];
```

## 已知限制

- 当前版本主要面向一级 columns。
- 多级表头 `children` 的显示隐藏、固定列归位和拖拽边界需要单独扩展。
- `width` 为数字且 `resizable !== false` 时才会启用列 resize。
- 如果业务需要点击整个表头排序，请谨慎使用 `stopHeaderSlotEvents`。
