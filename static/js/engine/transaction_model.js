/* Educational transaction state machine: committed truth and working state stay separate. */
const TransactionModel = (() => {
    const clone = RelationalModel.clone;

    function fail(message, code = "INVALID_TRANSACTION") {
        const error = new Error(message);
        error.name = "TransactionModelError";
        error.code = code;
        throw error;
    }

    function validateProblem(problem) {
        if (!problem || typeof problem !== "object") fail("A transaction problem is required.");
        RelationalModel.validateDatabase(problem.database);
        const table = RelationalModel.getTable(problem.database, problem.table);
        const field = RelationalModel.getColumn(table, problem.valueField);
        if (field.type !== "number") fail("Transaction changes require a numeric value field.");
        if (!Array.isArray(problem.operations) || !problem.operations.length) fail("A transaction needs operations.");
        problem.operations.forEach((operation, index) => {
            if (!operation || operation.type !== "adjust" || !Number.isFinite(operation.delta)) {
                fail(`Transaction operation ${index + 1} is invalid.`);
            }
            if (!table.rows.some(row => row.id === operation.rowId)) fail(`Unknown row "${operation.rowId}".`);
        });
        if (!["commit", "rollback", "failure"].includes(problem.terminal)) fail("Transaction terminal must be commit, rollback, or failure.");
        const terminalAfter = problem.terminalAfter ?? problem.operations.length;
        if (!Number.isInteger(terminalAfter) || terminalAfter < 0 || terminalAfter > problem.operations.length) {
            fail("terminalAfter must point within the operation sequence.");
        }
        return problem;
    }

    function balances(database, problem) {
        const table = RelationalModel.getTable(database, problem.table);
        return Object.fromEntries(table.rows.map(row => [row.id, row.values[problem.valueField]]));
    }

    function createSession(input) {
        const problem = clone(input);
        validateProblem(problem);
        let committed = clone(problem.database);
        let working = null;
        let status = "idle";
        let operationIndex = 0;
        const history = [];

        function snapshot() {
            return clone({
                status, operationIndex,
                committed: balances(committed, problem),
                working: working ? balances(working, problem) : null,
                committedDatabase: committed,
                workingDatabase: working
            });
        }

        function begin() {
            if (status !== "idle") fail("BEGIN is only valid before a transaction starts.", "INVALID_STATE");
            working = clone(committed);
            status = "active";
            history.push({ action: "begin", snapshot: snapshot() });
            return snapshot();
        }

        function applyNext() {
            if (status !== "active") fail("Start the transaction before applying a change.", "INVALID_STATE");
            if (operationIndex >= problem.operations.length) fail("Every planned change has already been applied.", "NO_OPERATION");
            if (operationIndex >= (problem.terminalAfter ?? problem.operations.length)) {
                fail(`The scenario calls for ${problem.terminal.toUpperCase()} before another change.`, "TERMINAL_DUE");
            }
            const operation = problem.operations[operationIndex];
            const table = RelationalModel.getTable(working, problem.table);
            const row = table.rows.find(item => item.id === operation.rowId);
            working = RelationalModel.editField(working, problem.table, operation.rowId, problem.valueField,
                row.values[problem.valueField] + operation.delta);
            operationIndex++;
            history.push({ action: "apply", operation: clone(operation), snapshot: snapshot() });
            return snapshot();
        }

        function ensureTerminal(expected) {
            if (status !== "active") fail(`${expected.toUpperCase()} needs an active transaction.`, "INVALID_STATE");
            if (problem.terminal !== expected) fail(`This scenario requires ${problem.terminal.toUpperCase()}, not ${expected.toUpperCase()}.`, "WRONG_TERMINAL");
            if (operationIndex !== (problem.terminalAfter ?? problem.operations.length)) {
                fail(`Apply ${problem.terminalAfter - operationIndex} more planned change(s) first.`, "TERMINAL_EARLY");
            }
        }

        function commit() {
            ensureTerminal("commit");
            committed = clone(working);
            working = null;
            status = "committed";
            history.push({ action: "commit", snapshot: snapshot() });
            return snapshot();
        }

        function rollback() {
            ensureTerminal("rollback");
            working = null;
            status = "rolled_back";
            history.push({ action: "rollback", snapshot: snapshot() });
            return snapshot();
        }

        function simulateFailure() {
            ensureTerminal("failure");
            working = null;
            status = "failed_rolled_back";
            history.push({ action: "failure", snapshot: snapshot() });
            return snapshot();
        }

        return {
            begin, applyNext, commit, rollback, simulateFailure,
            getSnapshot: snapshot,
            getProblem: () => clone(problem),
            getHistory: () => clone(history),
            isComplete: () => ["committed", "rolled_back", "failed_rolled_back"].includes(status)
        };
    }

    function simulate(problem) {
        const session = createSession(problem);
        session.begin();
        const count = problem.terminalAfter ?? problem.operations.length;
        for (let index = 0; index < count; index++) session.applyNext();
        if (problem.terminal === "commit") session.commit();
        else if (problem.terminal === "rollback") session.rollback();
        else session.simulateFailure();
        return { finalState: session.getSnapshot(), history: session.getHistory() };
    }

    function assess(problem, response = {}) {
        const expected = simulate(problem).finalState;
        const submittedStatus = String(response.status ?? "").trim().toLowerCase();
        const fields = [{ label: "Transaction status", submitted: submittedStatus, expected: expected.status, correct: submittedStatus === expected.status }];
        Object.entries(expected.committed).forEach(([rowId, value]) => {
            const submitted = Number(response.committed?.[rowId] ?? response[rowId]);
            fields.push({ label: `Committed ${rowId}`, submitted, expected: value, correct: submitted === value });
        });
        return {
            allCorrect: fields.every(field => field.correct), fields, actualFinalState: expected,
            feedback: expected.status === "committed"
                ? "COMMIT made the complete working transaction durable."
                : "The uncommitted working copy was discarded, so the committed database stayed whole."
        };
    }

    return { validateProblem, balances, createSession, simulate, assess };
})();
