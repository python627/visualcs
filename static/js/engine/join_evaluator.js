/* INNER/LEFT JOIN semantics layered on RelationalModel structural truth. */
const JoinEvaluator = (() => {
    const joinTypes = Object.freeze(["inner", "left"]);

    function fail(message, code = "INVALID_JOIN") {
        const error = new Error(message);
        error.name = "JoinEvaluationError";
        error.code = code;
        throw error;
    }

    function normalize(database, input) {
        RelationalModel.validateDatabase(database);
        if (!input || typeof input !== "object") fail("A join definition is required.");
        const left = RelationalModel.getTable(database, input.leftTable);
        const right = RelationalModel.getTable(database, input.rightTable);
        if (left.name === right.name) fail("Choose two different source tables.");
        const leftColumn = RelationalModel.getColumn(left, input.leftColumn);
        const rightColumn = RelationalModel.getColumn(right, input.rightColumn);
        const type = String(input.type || "").toLowerCase();
        if (!joinTypes.includes(type)) fail(`Unsupported join type "${input.type}".`, "UNSUPPORTED_JOIN");
        if (leftColumn.type !== rightColumn.type) {
            fail("Join columns must use compatible data types.", "INCOMPATIBLE_COLUMNS");
        }
        return {
            leftTable: left.name, rightTable: right.name,
            leftColumn: leftColumn.name, rightColumn: rightColumn.name, type
        };
    }

    function execute(database, input) {
        const join = normalize(database, input);
        const left = RelationalModel.getTable(database, join.leftTable);
        const right = RelationalModel.getTable(database, join.rightTable);
        const columns = [
            ...left.columns.map(column => ({ ...column, name: `${left.name}.${column.name}` })),
            ...right.columns.map(column => ({ ...column, name: `${right.name}.${column.name}` }))
        ];
        const rows = [];
        const pairs = [];
        left.rows.forEach(leftRow => {
            const matches = right.rows.filter(rightRow => (
                leftRow.values[join.leftColumn] === rightRow.values[join.rightColumn]
            ));
            if (!matches.length && join.type === "left") matches.push(null);
            matches.forEach(rightRow => {
                const pairId = `${leftRow.id}+${rightRow?.id || "NULL"}`;
                pairs.push({ id: pairId, leftRowId: leftRow.id, rightRowId: rightRow?.id || null });
                rows.push({
                    id: pairId,
                    values: Object.fromEntries([
                        ...left.columns.map(column => [`${left.name}.${column.name}`, leftRow.values[column.name]]),
                        ...right.columns.map(column => [`${right.name}.${column.name}`, rightRow ? rightRow.values[column.name] : null])
                    ])
                });
            });
        });
        return { join, columns, rows, pairs };
    }

    function sameMembers(left, right) {
        return Array.isArray(left) && Array.isArray(right)
            && JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
    }

    function field(label, submitted, expected, correct) {
        return { label, submitted, expected, correct };
    }

    function list(value) {
        if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
        const text = String(value ?? "").trim();
        return text.toUpperCase() === "NONE" ? [] : text.split(",").map(item => item.trim()).filter(Boolean);
    }

    function assessGoal(database, goal, submitted, predictedPairs) {
        const expectedJoin = normalize(database, goal);
        const submittedJoin = normalize(database, submitted);
        const expectedResult = execute(database, expectedJoin);
        const actualResult = execute(database, submittedJoin);
        const pairs = list(predictedPairs);
        const expectedPairs = actualResult.pairs.map(pair => pair.id);
        const fields = [
            field("Join type", submittedJoin.type, expectedJoin.type, submittedJoin.type === expectedJoin.type),
            field("Left join column", `${submittedJoin.leftTable}.${submittedJoin.leftColumn}`, `${expectedJoin.leftTable}.${expectedJoin.leftColumn}`,
                submittedJoin.leftTable === expectedJoin.leftTable && submittedJoin.leftColumn === expectedJoin.leftColumn),
            field("Right join column", `${submittedJoin.rightTable}.${submittedJoin.rightColumn}`, `${expectedJoin.rightTable}.${expectedJoin.rightColumn}`,
                submittedJoin.rightTable === expectedJoin.rightTable && submittedJoin.rightColumn === expectedJoin.rightColumn),
            field("Predicted row pairs", pairs.join(", ") || "NONE", expectedPairs.join(", ") || "NONE", sameMembers(pairs, expectedPairs))
        ];
        const definitionCorrect = fields.slice(0, 3).every(item => item.correct);
        return {
            allCorrect: fields.every(item => item.correct), definitionCorrect,
            predictionCorrect: fields[3].correct, fields, actualResult, expectedResult,
            feedback: `${actualResult.rows.length} joined row${actualResult.rows.length === 1 ? "" : "s"} came from actual equal-key combinations.${submittedJoin.type === "inner" ? " Unmatched rows were omitted." : " Unmatched left rows were kept with NULL values."}`
        };
    }

    return { joinTypes, normalize, execute, assessGoal };
})();
