/* Seeded Normalization scenarios. NormalizationModel remains the only oracle. */
const NormalizationGenerator = {
    version: 1,

    generate({ random, rules = {} }) {
        const pick = values => values[Math.floor(random() * values.length)];
        const token = Math.floor(random() * 9000) + 1000;
        const forms = rules.forms || ["2NF", "3NF"];
        const requested = pick(forms);
        const rowCount = pick(rules.rowCounts || [4, 5, 6]);
        const problem = requested === "1NF" ? this.atomicityProblem(token, rowCount)
            : requested === "2NF" ? this.partialDependencyProblem(token, rowCount)
            : this.transitiveDependencyProblem(token, rowCount);
        const kinds = requested === "1NF" ? ["identify-normal-form"]
            : (rules.taskKinds || ["identify-redundancy", "identify-dependency", "identify-anomaly", "decompose"]);
        const kind = pick(kinds);
        const anomalyTypes = rules.anomalyTypes || ["update", "insert", "delete"];
        problem.task = {
            kind,
            prompt: this.promptFor(kind, requested),
            targetForm: kind === "decompose" ? (requested === "1NF" ? "1NF" : "3NF") : undefined,
            dependencyClass: requested === "2NF" ? "partial" : requested === "3NF" ? "transitive" : "any",
            anomalyType: kind === "identify-anomaly" || kind === "decompose" ? pick(anomalyTypes) : undefined
        };
        Object.keys(problem.task).forEach(key => problem.task[key] === undefined && delete problem.task[key]);
        const data = { problem };
        this.validateScenario(data);
        return data;
    },

    atomicityProblem(token, rowCount) {
        const rows = Array.from({ length: Math.max(3, rowCount) }, (_, index) => ({
            id: `contact-${token}-${index + 1}`,
            values: {
                contact_id: token + index,
                contact_name: ["Asha", "Ben", "Chen", "Dia", "Eli", "Fara"][index % 6],
                phone_numbers: [`555-${token + index}`, `555-${token + index + 20}`]
            }
        }));
        return {
            relation: { name: `contacts_${token}`, columns: [
                { name: "contact_id", type: "number" }, { name: "contact_name", type: "string" }, { name: "phone_numbers", type: "string" }
            ], primaryKey: ["contact_id"], rows },
            dependencies: [{ determinant: ["contact_id"], dependent: ["contact_name", "phone_numbers"] }]
        };
    },

    partialDependencyProblem(token, rowCount) {
        const students = ["Asha", "Ben", "Chen", "Dia"];
        const courses = ["Databases", "Networks", "Algorithms"];
        const rows = Array.from({ length: Math.max(4, rowCount) }, (_, index) => {
            const student = index % students.length; const course = index % courses.length;
            return { id: `enrollment-${token}-${index + 1}`, values: {
                student_id: 100 + student, student_name: students[student], course_id: `C${10 + course}`,
                course_name: courses[course], instructor: ["Dr Rao", "Dr Lin", "Dr Cole"][course]
            } };
        });
        if (rows.length > 3) { rows[3].values.course_id = rows[0].values.course_id; rows[3].values.course_name = rows[0].values.course_name; rows[3].values.instructor = rows[0].values.instructor; }
        return {
            relation: { name: `enrollment_${token}`, columns: [
                { name: "student_id", type: "number" }, { name: "student_name", type: "string" },
                { name: "course_id", type: "string" }, { name: "course_name", type: "string" }, { name: "instructor", type: "string" }
            ], primaryKey: ["student_id", "course_id"], rows },
            dependencies: [
                { determinant: ["student_id"], dependent: ["student_name"] },
                { determinant: ["course_id"], dependent: ["course_name", "instructor"] }
            ]
        };
    },

    transitiveDependencyProblem(token, rowCount) {
        const departments = [
            { id: "D1", name: "Engineering", office: `North-${token % 20}` },
            { id: "D2", name: "Support", office: `South-${token % 20}` },
            { id: "D3", name: "Research", office: `West-${token % 20}` }
        ];
        const names = ["Asha", "Ben", "Chen", "Dia", "Eli", "Fara"];
        const rows = Array.from({ length: Math.max(4, rowCount) }, (_, index) => {
            const department = departments[index % departments.length];
            return { id: `employee-${token}-${index + 1}`, values: {
                employee_id: token + index, employee_name: names[index % names.length], department_id: department.id,
                department_name: department.name, office: department.office
            } };
        });
        if (rows.length > 3) Object.assign(rows[3].values, {
            department_id: rows[0].values.department_id, department_name: rows[0].values.department_name, office: rows[0].values.office
        });
        return {
            relation: { name: `employees_${token}`, columns: [
                { name: "employee_id", type: "number" }, { name: "employee_name", type: "string" },
                { name: "department_id", type: "string" }, { name: "department_name", type: "string" }, { name: "office", type: "string" }
            ], primaryKey: ["employee_id"], rows },
            dependencies: [
                { determinant: ["employee_id"], dependent: ["employee_name", "department_id"] },
                { determinant: ["department_id"], dependent: ["department_name", "office"] }
            ]
        };
    },

    promptFor(kind, form) {
        if (kind === "identify-normal-form") return "Determine the highest normal form currently satisfied by this relation.";
        if (kind === "identify-redundancy") return "Identify an attribute whose fact is repeated across rows.";
        if (kind === "identify-dependency") return `Identify a ${form === "2NF" ? "partial" : "transitive"} dependency that causes the normalization problem.`;
        if (kind === "identify-anomaly") return "Name the configured anomaly demonstrated by storing these facts together.";
        return "Diagnose the current form, dependency, and anomaly, then propose relations that reach the target normal form.";
    },

    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "expectedRelations") || Object.hasOwn(data, "answer")) {
            throw new Error("A normalization scenario must expose source facts and dependencies, not final answers.");
        }
        NormalizationModel.validateProblem(data.problem);
        NormalizationModel.analyze(data.problem);
    },

    getMentalSimulation(data) {
        this.validateScenario(data);
        return {
            initial_state: NormalizationModel.clone(data.problem),
            steps: [
                { operation: "inspect", label: "Inspect keys, repeated facts, and declared dependencies." },
                { operation: "predict", label: "Predict the anomaly and a valid decomposition before revealing the result." }
            ]
        };
    },

    evaluatePrediction(data, response) {
        this.validateScenario(data);
        return NormalizationModel.assess(data.problem, response);
    },

    createExecutionChallenge() {
        return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] };
    }
};

registerScenarioGenerator("normalization", NormalizationGenerator);
