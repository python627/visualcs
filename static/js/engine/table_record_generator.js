/* Seeded Tables & Records problems. Answers are derived by TableRecordModel. */
const TableRecordGenerator = {
    version: 1,

    generate({ random, rules = {} }) {
        const pick = values => values[Math.floor(random() * values.length)];
        const rowCount = pick(rules.rowCounts || [3, 4, 5]);
        const names = ["Ana", "Ben", "Cara", "Dev", "Eva", "Finn", "Gia", "Hugo"];
        for (let index = names.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(random() * (index + 1));
            [names[index], names[swapIndex]] = [names[swapIndex], names[index]];
        }
        const rows = Array.from({ length: rowCount }, (_, index) => ({
            id: `student-${index + 1}`,
            values: { id: 101 + index, name: names[index], age: 18 + Math.floor(random() * 8), active: random() >= 0.35 }
        }));
        const database = RelationalModel.createDatabase({ tables: [{
            name: "students",
            columns: [
                { name: "id", type: "number" }, { name: "name", type: "string" },
                { name: "age", type: "number" }, { name: "active", type: "boolean" }
            ], rows
        }] });
        const kinds = rules.taskKinds || ["identify-row", "identify-column", "inspect-field", "add-record", "edit-field"];
        const kind = pick(kinds);
        const selected = pick(rows);
        let task;
        if (kind === "identify-row") task = { kind, table: "students", rowId: selected.id, prompt: `Which row id identifies the record for ${selected.values.name}?` };
        else if (kind === "identify-column") {
            const column = pick(["name", "age", "active"]);
            const descriptions = { name: "each student's name", age: "each student's age", active: "whether each student is active" };
            task = { kind, table: "students", column, prompt: `Which column stores ${descriptions[column]}?` };
        }
        else if (kind === "inspect-field") {
            const column = pick(["name", "age", "active"]);
            task = { kind, table: "students", rowId: selected.id, column, prompt: `Read ${column} from row ${selected.id}.` };
        }
        else if (kind === "add-record") {
            const valid = random() >= (rules.invalidRate ?? 0.35);
            task = { kind, table: "students", prompt: "Predict whether this record passes the schema and the resulting row count.", record: {
                id: `student-${rowCount + 1}`,
                values: { id: 101 + rowCount, name: "Gia", age: valid ? 20 : "twenty", active: true }
            } };
        }
        else {
            const column = pick(["age", "active"]);
            const valid = random() >= (rules.invalidRate ?? 0.35);
            const value = column === "age" ? (valid ? 22 : "twenty-two") : (valid ? false : "no");
            task = { kind: "edit-field", table: "students", rowId: selected.id, column, value,
                prompt: `Predict whether editing ${selected.id}.${column} to ${String(value)} is valid and what value remains.` };
        }
        const data = { problem: { database, task } };
        this.validateScenario(data);
        return data;
    },

    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "expectedTable")) {
            throw new Error("A table scenario must expose inputs, not an authored answer table.");
        }
        RelationalModel.validateDatabase(data.problem.database);
        TableRecordModel.execute(data.problem.database, data.problem.task);
    },

    getMentalSimulation(data) {
        this.validateScenario(data);
        return {
            initial_state: RelationalModel.clone(data.problem),
            steps: [
                { operation: "inspect-schema", label: "Inspect the schema and source records." },
                { operation: "predict", label: "Predict the selected field or resulting table change." }
            ]
        };
    },

    evaluatePrediction(data, response) {
        this.validateScenario(data);
        return TableRecordModel.assess(data.problem.database, data.problem.task, response);
    },

    createExecutionChallenge() {
        return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] };
    }
};

registerScenarioGenerator("table-records", TableRecordGenerator);
