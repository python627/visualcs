/* Seeded JOIN scenarios. JoinEvaluator is the sole result oracle. */
const JoinGenerator = {
    version: 1,

    generate({ random, rules = {} }) {
        const pick = values => values[Math.floor(random() * values.length)];
        const shuffle = values => {
            const result = [...values];
            for (let index = result.length - 1; index > 0; index--) {
                const other = Math.floor(random() * (index + 1));
                [result[index], result[other]] = [result[other], result[index]];
            }
            return result;
        };
        const leftCount = pick(rules.leftRowCounts || [3, 4, 5]);
        const rightCount = pick(rules.rightRowCounts || [3, 4, 5, 6]);
        const keys = Array.from({ length: leftCount }, (_, index) => 101 + index);
        const names = shuffle(["Ana", "Ben", "Cara", "Dev", "Eva", "Finn"]);
        const courses = shuffle(["Databases", "Networks", "Algorithms", "Systems", "Security", "Web"]);
        const leftRows = keys.map((key, index) => ({ id: `student-${index + 1}`, values: { student_id: key, name: names[index] } }));
        const rightRows = Array.from({ length: rightCount }, (_, index) => {
            const unmatched = random() < (rules.unmatchedRate ?? 0.25);
            const key = unmatched ? 900 + index : pick(keys);
            return { id: `enrollment-${index + 1}`, values: { student_id: key, course: courses[index % courses.length] } };
        });
        if ((rules.forceDuplicate ?? true) && rightRows.length >= 2) rightRows[1].values.student_id = rightRows[0].values.student_id;
        const database = RelationalModel.createDatabase({ tables: [
            { name: "students", columns: [{ name: "student_id", type: "number" }, { name: "name", type: "string" }], rows: leftRows },
            { name: "enrollments", columns: [{ name: "student_id", type: "number" }, { name: "course", type: "string" }], rows: rightRows }
        ] });
        const type = pick(rules.joinTypes || ["inner"]);
        const problem = {
            database,
            goal: { instruction: `Build a ${type.toUpperCase()} JOIN by matching the related student identifiers.`, join: {
                leftTable: "students", leftColumn: "student_id", rightTable: "enrollments", rightColumn: "student_id", type
            } },
            allowed: { joinTypes: rules.joinTypes || ["inner"], leftTable: "students", rightTable: "enrollments" }
        };
        const data = { problem };
        this.validateScenario(data);
        return data;
    },

    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "joinedRows") || Object.hasOwn(data, "expectedRows")) {
            throw new Error("A JOIN scenario must expose source tables and a goal, not joined results.");
        }
        RelationalModel.validateDatabase(data.problem.database);
        JoinEvaluator.execute(data.problem.database, data.problem.goal?.join);
    },

    getMentalSimulation(data) {
        this.validateScenario(data);
        return {
            initial_state: RelationalModel.clone(data.problem),
            steps: [
                { operation: "choose-join", label: "Choose the join type and related columns." },
                { operation: "predict-pairs", label: "Predict every equal-key row combination." }
            ]
        };
    },

    evaluatePrediction(data, response) {
        this.validateScenario(data);
        try {
            return JoinEvaluator.assessGoal(data.problem.database, data.problem.goal.join, {
                leftTable: data.problem.allowed.leftTable,
                rightTable: data.problem.allowed.rightTable,
                leftColumn: String(response?.leftColumn ?? "").trim(),
                rightColumn: String(response?.rightColumn ?? "").trim(),
                type: String(response?.joinType ?? "").trim().toLowerCase()
            }, response?.matchingPairs);
        }
        catch (error) {
            return { allCorrect: false, fields: [{ label: "Join definition", submitted: "Invalid", expected: "Compatible related columns", correct: false }], feedback: error.message };
        }
    },

    createExecutionChallenge() {
        return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] };
    }
};

registerScenarioGenerator("join", JoinGenerator);
