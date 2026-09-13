/* Seeded SQL SELECT scenarios. Results are always computed by SelectEvaluator. */
const SqlSelectGenerator = {
    version: 1,

    generate({ random, rules = {} }) {
        const rowCount = rules.rowCount ?? 5;
        const selectCounts = rules.selectCounts || [1];
        const configuredOperators = rules.operators || ["=", ">=", "<"];
        const emptyRate = rules.emptyResultRate ?? 0;
        if (!Number.isInteger(rowCount) || rowCount < 3 || rowCount > 10
            || !Array.isArray(selectCounts) || !selectCounts.length
            || !selectCounts.every(count => Number.isInteger(count) && count >= 1 && count <= 3)
            || !Array.isArray(configuredOperators) || !configuredOperators.length
            || !configuredOperators.every(operator => SelectEvaluator.operators.includes(operator))
            || typeof emptyRate !== "number" || emptyRate < 0 || emptyRate > 1) {
            throw new Error("Invalid SQL SELECT generation rules.");
        }

        const pick = values => values[Math.floor(random() * values.length)];
        const shuffle = values => {
            const result = [...values];
            for (let index = result.length - 1; index > 0; index--) {
                const other = Math.floor(random() * (index + 1));
                [result[index], result[other]] = [result[other], result[index]];
            }
            return result;
        };
        const names = shuffle(["Ana", "Ben", "Cara", "Dev", "Eva", "Finn", "Gia", "Hugo", "Ivy", "Jai"]);
        const courses = ["CS", "IT", "Design"];
        const rows = Array.from({ length: rowCount }, (_, index) => ({
            id: `student-${index + 1}`,
            values: {
                id: index + 1,
                name: names[index],
                age: 18 + Math.floor(random() * 8),
                score: 55 + Math.floor(random() * 41),
                course: pick(courses)
            }
        }));
        const database = RelationalModel.createDatabase({ tables: [{
            name: "students",
            columns: [
                { name: "id", type: "number" },
                { name: "name", type: "string" },
                { name: "age", type: "number" },
                { name: "score", type: "number" },
                { name: "course", type: "string" }
            ],
            rows
        }] });

        const operator = pick(configuredOperators);
        const comparableFields = ["age", "score"];
        const equalityFields = ["age", "score", "course"];
        const whereField = pick(["=", "!="].includes(operator) ? equalityFields : comparableFields);
        const values = rows.map(row => row.values[whereField]);
        let value = pick(values);
        if (random() < emptyRate) {
            if (typeof value === "number") {
                const minimum = Math.min(...values);
                const maximum = Math.max(...values);
                if ([">", ">="].includes(operator)) value = maximum + 1;
                else if (["<", "<="].includes(operator)) value = minimum - 1;
                else if (operator === "=") value = maximum + 100;
            }
            else if (operator === "=") value = "Math";
        }

        const selectable = ["name", "age", "score", "course"];
        const selectCount = Math.min(pick(selectCounts), selectable.length);
        const select = shuffle(selectable).slice(0, selectCount);
        const query = { from: "students", select, where: { field: whereField, operator, value } };
        const result = SelectEvaluator.execute(database, query);
        const problem = {
            database,
            goal: {
                instruction: `Return ${select.join(" and ")} from students where ${whereField} ${operator} ${value}.`,
                query
            },
            allowed: {
                tables: ["students"],
                selectColumns: selectable,
                whereFields: equalityFields,
                operators: [...configuredOperators]
            },
            prediction: { rowLabelColumn: "name" }
        };

        // Compute now so an impossible or malformed generated problem fails at creation.
        if (result.sourceRowCount !== rowCount) throw new Error("Generated SELECT result is inconsistent.");
        const data = { problem };
        this.validateScenario(data);
        return data;
    },

    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "expectedRows")) {
            throw new Error("Generated SQL scenario must expose inputs, not result rows.");
        }
        const { database, goal } = data.problem;
        RelationalModel.validateDatabase(database);
        SelectEvaluator.execute(database, goal?.query);
    },

    getMentalSimulation(data) {
        this.validateScenario(data);
        return {
            initial_state: RelationalModel.clone(data.problem),
            steps: [
                { operation: "from", label: "Choose the source table." },
                { operation: "select", label: "Choose the output columns." },
                { operation: "where", label: "Build the WHERE condition." },
                { operation: "predict", label: "Predict the matching source-row IDs." }
            ]
        };
    },

    evaluatePrediction(data, response) {
        this.validateScenario(data);
        const list = value => Array.isArray(value)
            ? value.map(item => String(item).trim()).filter(Boolean)
            : String(value ?? "").split(",").map(item => item.trim()).filter(Boolean);
        const predictedRows = String(response?.matchingRows ?? "").trim().toUpperCase() === "NONE"
            ? []
            : list(response?.matchingRows);
        try {
            return SelectEvaluator.assessGoal(
                data.problem.database,
                data.problem.goal.query,
                {
                    from: String(response?.from ?? "").trim(),
                    select: list(response?.select),
                    where: {
                        field: String(response?.whereField ?? "").trim(),
                        operator: String(response?.operator ?? "").trim(),
                        value: response?.value
                    }
                },
                predictedRows
            );
        }
        catch (error) {
            return {
                allCorrect: false,
                fields: [{
                    label: "Structured query",
                    submitted: "Invalid query",
                    expected: "A valid query using the displayed schema",
                    correct: false
                }],
                feedback: error.message
            };
        }
    },

    createExecutionChallenge() {
        return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] };
    }
};

registerScenarioGenerator("sql-select", SqlSelectGenerator);
