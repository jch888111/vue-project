export const DEFAULT_VISIBLE_FIELD = 'visible';
export const DEFAULT_FIXED_BEHAVIOR = 'normalize';

const getValueByPath = (source, path) => {
    if (!source || !path) return undefined;

    return String(path)
        .split('.')
        .reduce((value, key) => value?.[key], source);
};

export const getColumnKey = (column, index, options = {}) => {
    const { columnKeyField } = options;

    if (typeof columnKeyField === 'function') {
        const value = columnKeyField(column, index);
        if (value != null && value !== '') return String(value);
    } else if (typeof columnKeyField === 'string' && columnKeyField) {
        const value = getValueByPath(column, columnKeyField);
        if (value != null && value !== '') return String(value);
    }

    if (column?.key != null) return String(column.key);

    const dataIndex = column?.dataIndex;
    if (Array.isArray(dataIndex)) return dataIndex.join('.');
    if (dataIndex != null) return String(dataIndex);

    return `column-${index}`;
};

export const isColumnVisible = (column, visibleField = DEFAULT_VISIBLE_FIELD) => {
    return getValueByPath(column, visibleField) !== false;
};

export const filterVisibleColumns = (columns, visibleField = DEFAULT_VISIBLE_FIELD) => {
    return columns.filter(column => isColumnVisible(column, visibleField));
};

export const isLeftFixedColumn = column => column?.fixed === true || column?.fixed === 'left';

export const isRightFixedColumn = column => column?.fixed === 'right';

export const isLockedColumn = column => isLeftFixedColumn(column) || isRightFixedColumn(column);

export const splitColumns = (columns, options = {}) => {
    return columns.reduce(
        (result, column, index) => {
            const item = {
                column,
                key: getColumnKey(column, index, options),
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

export const normalizeColumnsForTable = (columns, options = {}) => {
    const { fixedBehavior = DEFAULT_FIXED_BEHAVIOR } = options;

    if (fixedBehavior === 'none') return [...columns];

    const { left, middle, right } = splitColumns(columns, options);

    return [
        ...left.map(item => item.column),
        ...middle.map(item => item.column),
        ...right.map(item => item.column),
    ];
};

export const sortColumnsWithHiddenFollowers = (items, orderedVisibleKeys, options = {}) => {
    const { visibleField = DEFAULT_VISIBLE_FIELD } = options;
    const leadingHiddenColumns = [];
    const groups = [];
    let currentGroup = null;

    items.forEach(item => {
        if (!isColumnVisible(item.column, visibleField)) {
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

export const serializeColumnsForApi = (columns, options = {}) => {
    const { visibleField = DEFAULT_VISIBLE_FIELD, columnKeyField } = options;

    return columns.map((column, index) => ({
        key: getColumnKey(column, index, { columnKeyField }),
        dataIndex: column.dataIndex,
        visible: isColumnVisible(column, visibleField),
        fixed: column.fixed || null,
        width: column.width,
        order: index,
    }));
};
