/* Seeded transaction scenarios. TransactionModel computes every intermediate and final state. */
const TransactionGenerator = {
    version: 1,

    generate({ random, rules = {} }) {
        const pick = values => values[Math.floor(random() * values.length)];
        const first = 60 + Math.floor(random() * 91);
        const second = 40 + Math.floor(random() * 81);
        const amount = pick(rules.amounts || [10, 15, 20, 25, 30]);
        const database = RelationalModel.createDatabase({ tables: [{
            name: "accounts",
            columns: [{ name: "account", type: "string" }, { name: "balance", type: "number" }],
            rows: [
                { id: "A", values: { account: "A", balance: first } },
                { id: "B", values: { account: "B", balance: second } }
            ]
        }] });
        const terminal = pick(rules.terminals || ["commit", "rollback", "failure"]);
        const terminalAfter = terminal === "commit" ? 2 : pick(rules.interruptionPoints || [1, 2]);
        const problem = {
            database, table: "accounts", valueField: "balance", terminal, terminalAfter,
            instruction: terminal === "commit"
                ? `Transfer ${amount} units from A to B and commit the complete transaction.`
                : terminal === "rollback"
                    ? `Apply ${terminalAfter} planned change(s), then roll the uncommitted transaction back.`
                    : `A failure occurs after ${terminalAfter} planned change(s). Predict the durable database.`,
            operations: [
                { type: "adjust", rowId: "A", delta: -amount, label: `Subtract ${amount} from A` },
                { type: "adjust", rowId: "B", delta: amount, label: `Add ${amount} to B` }
            ]
        };
        const data = { problem };
        this.validateScenario(data);
        return data;
    },

    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "finalState") || Object.hasOwn(data, "expectedBalances")) {
            throw new Error("A transaction scenario must expose inputs, not a final database.");
        }
        TransactionModel.validateProblem(data.problem);
        TransactionModel.simulate(data.problem);
    },

    getMentalSimulation(data) {
        this.validateScenario(data);
        return {
            initial_state: RelationalModel.clone(data.problem),
            steps: [
                { operation: "begin", label: "BEGIN a working transaction." },
                ...data.problem.operations.slice(0, data.problem.terminalAfter).map(operation => ({ operation: "apply", label: operation.label })),
                { operation: data.problem.terminal, label: data.problem.terminal === "failure" ? "FAIL before COMMIT" : data.problem.terminal.toUpperCase() }
            ]
        };
    },

    evaluatePrediction(data, response) {
        this.validateScenario(data);
        return TransactionModel.assess(data.problem, response);
    },

    createExecutionChallenge() {
        return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] };
    }
};

registerScenarioGenerator("transaction", TransactionGenerator);
