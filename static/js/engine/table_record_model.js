/* Executable schema/record exercises built on the shared relational model. */
const TableRecordModel = (() => {
    const clone = RelationalModel.clone;

    function parseValue(value, type) {
        if (type === "string") return String(value ?? "");
        if (type === "boolean") {
            if (value === true || String(value).toLowerCase() === "true") return true;
            if (value === false || String(value).toLowerCase() === "false") return false;
            return value;
        }
        const text = String(value ?? "").trim();
        return /^-?(?:\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : value;
    }

    function execute(database, task) {
        RelationalModel.validateDatabase(database);
        if (!task || typeof task !== "object") throw new Error("A table task is required.");
        const table = RelationalModel.getTable(database, task.table);
        if (task.kind === "identify-row") {
            const row = table.rows.find(item => item.id === task.rowId);
            if (!row) throw new Error(`Unknown row "${task.rowId}".`);
            return { kind: task.kind, database: clone(database), answer: task.rowId, changed: false };
        }
        if (task.kind === "identify-column") {
            const column = RelationalModel.getColumn(table, task.column);
            return { kind: task.kind, database: clone(database), answer: column.name, changed: false };
        }
        if (task.kind === "inspect-field") {
            const column = RelationalModel.getColumn(table, task.column);
            const row = table.rows.find(item => item.id === task.rowId);
            if (!row) throw new Error(`Unknown row "${task.rowId}".`);
            return { kind: task.kind, database: clone(database), answer: row.values[column.name], changed: false };
        }
        if (task.kind === "add-record") {
            const assessment = RelationalModel.validateRecord(table, task.record);
            return {
                kind: task.kind,
                valid: assessment.valid,
                errors: assessment.errors,
                database: assessment.valid
                    ? RelationalModel.addRecord(database, task.table, task.record)
                    : clone(database),
                changed: assessment.valid
            };
        }
        if (task.kind === "edit-field") {
            const column = RelationalModel.getColumn(table, task.column);
            const value = task.value;
            const valid = RelationalModel.valueMatchesType(value, column.type);
            return {
                kind: task.kind,
                valid,
                errors: valid ? [] : [`Value for "${task.column}" must be ${column.type}.`],
                database: valid
                    ? RelationalModel.editField(database, task.table, task.rowId, task.column, value)
                    : clone(database),
                changed: valid
            };
        }
        throw new Error(`Unsupported table task "${task.kind}".`);
    }

    function field(label, submitted, expected, correct) {
        return { label, submitted, expected, correct };
    }

    function booleanAnswer(value) {
        if (value === true || String(value).toLowerCase() === "valid") return true;
        if (value === false || String(value).toLowerCase() === "invalid") return false;
        return null;
    }

    function assess(database, task, response = {}) {
        const result = execute(database, task);
        const tableBefore = RelationalModel.getTable(database, task.table);
        const tableAfter = RelationalModel.getTable(result.database, task.table);
        const fields = [];
        if (["identify-row", "identify-column", "inspect-field"].includes(task.kind)) {
            const submitted = parseValue(response.answer, typeof result.answer);
            fields.push(field("Your selection", submitted, result.answer, submitted === result.answer));
        }
        else {
            const submittedValidity = booleanAnswer(response.validity);
            fields.push(field("Schema validity", submittedValidity, result.valid, submittedValidity === result.valid));
            if (task.kind === "add-record") {
                const expectedCount = tableAfter.rows.length;
                fields.push(field("Resulting row count", Number(response.rowCount), expectedCount,
                    Number(response.rowCount) === expectedCount));
            }
            else {
                const beforeRow = tableBefore.rows.find(row => row.id === task.rowId);
                const afterRow = tableAfter.rows.find(row => row.id === task.rowId);
                const expectedValue = afterRow?.values[task.column] ?? beforeRow?.values[task.column];
                const column = RelationalModel.getColumn(tableBefore, task.column);
                const submittedValue = parseValue(response.resultValue, column.type);
                fields.push(field("Resulting field value", submittedValue, expectedValue,
                    submittedValue === expectedValue));
            }
        }
        return {
            allCorrect: fields.every(item => item.correct),
            fields,
            result,
            feedback: result.errors?.length
                ? `The schema rejects this change: ${result.errors.join(" ")}`
                : result.changed
                    ? "The prediction matches the schema-checked table change."
                    : "The selection matches the table structure."
        };
    }

    return { parseValue, execute, assess };
})();
