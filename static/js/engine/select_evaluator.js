/* A bounded, executable SELECT/FROM/WHERE evaluator. No SQL text parsing or eval(). */
const SelectEvaluator = (() => {
    const operators = Object.freeze(["=", "!=", ">", ">=", "<", "<="]);

    function fail(message, code = "INVALID_QUERY") {
        const error = new Error(message);
        error.name = "SelectQueryError";
        error.code = code;
        throw error;
    }

    function coerce(value, type, field) {
        if (type === "string") return String(value);
        if (type === "boolean") {
            if (value === true || String(value).toLowerCase() === "true") return true;
            if (value === false || String(value).toLowerCase() === "false") return false;
            fail(`WHERE value for "${field}" must be true or false.`, "TYPE_MISMATCH");
        }
        if (typeof value === "number" && Number.isFinite(value)) return value;
        const text = String(value ?? "").trim();
        if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) {
            fail(`WHERE value for "${field}" must be a number.`, "TYPE_MISMATCH");
        }
        return Number(text);
    }

    function normalizeQuery(database, query) {
        if (!query || typeof query !== "object" || Array.isArray(query)) fail("Query must be an object.");
        if (Object.hasOwn(query, "distinct") || Object.hasOwn(query, "orderBy")) {
            fail("DISTINCT and ORDER BY are not supported in this lesson.", "UNSUPPORTED_FEATURE");
        }
        const table = RelationalModel.getTable(database, query.from);
        if (!Array.isArray(query.select) || !query.select.length) fail("SELECT needs at least one column.");
        if (new Set(query.select).size !== query.select.length) fail("SELECT columns must not be repeated.");
        query.select.forEach(name => RelationalModel.getColumn(table, name));

        let where = null;
        if (query.where != null) {
            if (!query.where || typeof query.where !== "object" || Array.isArray(query.where)) {
                fail("WHERE must be an object when present.");
            }
            const column = RelationalModel.getColumn(table, query.where.field);
            if (!operators.includes(query.where.operator)) {
                fail(`Unsupported WHERE operator "${query.where.operator}".`, "UNSUPPORTED_OPERATOR");
            }
            if (column.type !== "number" && !["=", "!="].includes(query.where.operator)) {
                fail(`Operator "${query.where.operator}" requires a number field.`, "TYPE_MISMATCH");
            }
            where = {
                field: column.name,
                operator: query.where.operator,
                value: coerce(query.where.value, column.type, column.name)
            };
        }
        return { from: table.name, select: [...query.select], where };
    }

    function compare(left, operator, right) {
        if (operator === "=") return left === right;
        if (operator === "!=") return left !== right;
        if (operator === ">") return left > right;
        if (operator === ">=") return left >= right;
        if (operator === "<") return left < right;
        if (operator === "<=") return left <= right;
        fail(`Unsupported WHERE operator "${operator}".`, "UNSUPPORTED_OPERATOR");
    }

    function execute(database, inputQuery) {
        const query = normalizeQuery(database, inputQuery);
        const table = RelationalModel.getTable(database, query.from);
        const matchedRows = query.where
            ? table.rows.filter(row => compare(row.values[query.where.field], query.where.operator, query.where.value))
            : [...table.rows];
        return {
            query,
            sourceTable: table.name,
            sourceRowCount: table.rows.length,
            matchedRowIds: matchedRows.map(row => row.id),
            columns: query.select.map(name => ({ ...RelationalModel.getColumn(table, name) })),
            rows: matchedRows.map(row => ({
                sourceRowId: row.id,
                values: Object.fromEntries(query.select.map(name => [name, row.values[name]]))
            }))
        };
    }

    function rowSignature(columns, row) {
        return JSON.stringify(columns.map(column => row.values[column.name]));
    }

    function sameResult(left, right, { ordered = false } = {}) {
        if (!left || !right) return false;
        const leftColumns = left.columns.map(column => column.name);
        const rightColumns = right.columns.map(column => column.name);
        if (JSON.stringify(leftColumns) !== JSON.stringify(rightColumns)) return false;
        const leftRows = left.rows.map(row => rowSignature(left.columns, row));
        const rightRows = right.rows.map(row => rowSignature(right.columns, row));
        if (ordered) return JSON.stringify(leftRows) === JSON.stringify(rightRows);
        return JSON.stringify([...leftRows].sort()) === JSON.stringify([...rightRows].sort());
    }

    function sameMembers(left, right) {
        return Array.isArray(left) && Array.isArray(right)
            && JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
    }

    function whereText(where) {
        return where ? `${where.field} ${where.operator} ${where.value}` : "no WHERE condition";
    }

    function explain(result) {
        const filter = result.query.where
            ? `WHERE ${whereText(result.query.where)} kept ${result.rows.length} of ${result.sourceRowCount} rows.`
            : `With no WHERE condition, all ${result.sourceRowCount} rows remained.`;
        return `${filter} SELECT returned only ${result.columns.map(column => column.name).join(", ")}. Row order is not part of this exercise.`;
    }

    function field(label, submitted, expected, correct) {
        return { label, submitted, expected, correct };
    }

    function assessGoal(database, goalQuery, submittedQuery, predictedRowIds) {
        const goal = normalizeQuery(database, goalQuery);
        const submitted = normalizeQuery(database, submittedQuery);
        const expectedResult = execute(database, goal);
        const actualResult = execute(database, submitted);
        const goalWhere = goal.where;
        const submittedWhere = submitted.where;
        const queryFields = [
            field("FROM", submitted.from, goal.from, submitted.from === goal.from),
            field("SELECT columns", submitted.select.join(", "), goal.select.join(", "), JSON.stringify(submitted.select) === JSON.stringify(goal.select)),
            field("WHERE field", submittedWhere?.field ?? "NONE", goalWhere?.field ?? "NONE", (submittedWhere?.field ?? null) === (goalWhere?.field ?? null)),
            field("Operator", submittedWhere?.operator ?? "NONE", goalWhere?.operator ?? "NONE", (submittedWhere?.operator ?? null) === (goalWhere?.operator ?? null)),
            field("Comparison value", submittedWhere?.value ?? "NONE", goalWhere?.value ?? "NONE", (submittedWhere?.value ?? null) === (goalWhere?.value ?? null))
        ];
        const predictionCorrect = sameMembers(predictedRowIds, actualResult.matchedRowIds);
        const fields = [
            ...queryFields,
            field("Predicted matching rows", (predictedRowIds || []).join(", ") || "NONE",
                actualResult.matchedRowIds.join(", ") || "NONE", predictionCorrect)
        ];
        const queryCorrect = queryFields.every(item => item.correct);
        return {
            allCorrect: queryCorrect && predictionCorrect,
            queryCorrect,
            predictionCorrect,
            fields,
            actualResult,
            expectedResult,
            feedback: explain(actualResult)
        };
    }

    return { operators, normalizeQuery, execute, sameResult, assessGoal, explain };
})();
