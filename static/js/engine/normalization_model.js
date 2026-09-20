/* Executable Normalization semantics. Lesson data supplies relations and FDs; this model derives every answer. */
const NormalizationModel = (() => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const FORMS = ["UNNORMALIZED", "1NF", "2NF", "3NF"];

    function fail(message) {
        const error = new Error(message);
        error.name = "NormalizationModelError";
        throw error;
    }

    function unique(values) { return [...new Set(values)]; }
    function sameSet(left, right) {
        const a = unique(left).sort(); const b = unique(right).sort();
        return a.length === b.length && a.every((value, index) => value === b[index]);
    }
    function subset(left, right) { const allowed = new Set(right); return left.every(value => allowed.has(value)); }
    function properSubset(left, right) { return left.length < right.length && subset(left, right); }
    function atomic(value) { return value === null || ["string", "number", "boolean"].includes(typeof value); }
    function determinantKey(row, columns) { return JSON.stringify(columns.map(name => row.values[name])); }
    function formValue(value) {
        const text = String(value ?? "").trim().toUpperCase().replaceAll(" ", "");
        if (["0NF", "UNNORMALIZED", "UNF", "NOT1NF"].includes(text)) return "UNNORMALIZED";
        return FORMS.includes(text) ? text : "";
    }

    function validateProblem(problem) {
        if (!problem || typeof problem !== "object" || Array.isArray(problem)) fail("A normalization problem must be an object.");
        if (["answer", "oracle", "result", "expectedRelations", "finalDecomposition"].some(key => Object.hasOwn(problem, key))) {
            fail("Normalization problems must contain inputs, not authored answers.");
        }
        const relation = problem.relation;
        if (!relation || typeof relation.name !== "string" || !relation.name.trim()) fail("The source relation needs a name.");
        if (!Array.isArray(relation.columns) || relation.columns.length < 2) fail("The source relation needs at least two columns.");
        const names = relation.columns.map(column => column?.name);
        if (names.some(name => typeof name !== "string" || !name.trim()) || unique(names).length !== names.length) fail("Relation columns must have unique names.");
        if (!Array.isArray(relation.primaryKey) || !relation.primaryKey.length || !subset(relation.primaryKey, names)) fail("The primary key must reference source columns.");
        if (!Array.isArray(relation.rows) || !relation.rows.length) fail("The source relation needs rows.");
        const rowIds = new Set();
        relation.rows.forEach(row => {
            if (!row || typeof row.id !== "string" || !row.id || rowIds.has(row.id)) fail("Every source row needs a unique id.");
            rowIds.add(row.id);
            if (!row.values || typeof row.values !== "object" || Array.isArray(row.values) || !sameSet(Object.keys(row.values), names)) {
                fail(`Row ${row.id} values must match the relation columns.`);
            }
        });
        if (!Array.isArray(problem.dependencies)) fail("Functional dependencies must be an array.");
        problem.dependencies.forEach(dependency => {
            if (!dependency || !Array.isArray(dependency.determinant) || !dependency.determinant.length
                || !Array.isArray(dependency.dependent) || !dependency.dependent.length
                || !subset(dependency.determinant, names) || !subset(dependency.dependent, names)
                || dependency.dependent.some(name => dependency.determinant.includes(name))) {
                fail("Every functional dependency must reference distinct source columns.");
            }
        });
        if (!problem.task || typeof problem.task.kind !== "string" || typeof problem.task.prompt !== "string") fail("The problem needs an executable task and prompt.");
        if (problem.task.targetForm && !["1NF", "2NF", "3NF"].includes(formValue(problem.task.targetForm))) fail("Target normal form must be 1NF, 2NF, or 3NF.");
        return problem;
    }

    function closure(attributes, dependencies) {
        const result = new Set(attributes);
        let changed = true;
        while (changed) {
            changed = false;
            dependencies.forEach(fd => {
                if (fd.determinant.every(name => result.has(name))) fd.dependent.forEach(name => {
                    if (!result.has(name)) { result.add(name); changed = true; }
                });
            });
        }
        return [...result];
    }

    function analyze(problem) {
        validateProblem(problem);
        const relation = problem.relation;
        const attributes = relation.columns.map(column => column.name);
        const prime = new Set(relation.primaryKey);
        const isAtomic = relation.rows.every(row => attributes.every(name => atomic(row.values[name])));
        const dependencies = problem.dependencies.map(fd => ({ ...clone(fd), superkey: subset(attributes, closure(fd.determinant, problem.dependencies)) }));
        const partialDependencies = dependencies.filter(fd => relation.primaryKey.length > 1
            && properSubset(fd.determinant, relation.primaryKey)
            && fd.dependent.some(name => !prime.has(name)));
        const partialSignatures = new Set(partialDependencies.map(fd => JSON.stringify([fd.determinant, fd.dependent])));
        const transitiveDependencies = dependencies.filter(fd => !fd.superkey
            && !partialSignatures.has(JSON.stringify([fd.determinant, fd.dependent]))
            && fd.dependent.some(name => !prime.has(name)));
        let currentForm = "3NF";
        if (!isAtomic) currentForm = "UNNORMALIZED";
        else if (partialDependencies.length) currentForm = "1NF";
        else if (transitiveDependencies.length) currentForm = "2NF";

        const repeatedFacts = [];
        dependencies.forEach(fd => {
            const groups = new Map();
            relation.rows.forEach(row => {
                const key = determinantKey(row, fd.determinant);
                const values = fd.dependent.map(name => row.values[name]);
                const group = groups.get(key) || { determinantValues: fd.determinant.map(name => row.values[name]), rows: [], values };
                group.rows.push(row.id); groups.set(key, group);
            });
            groups.forEach(group => {
                if (group.rows.length > 1) fd.dependent.forEach((attribute, index) => repeatedFacts.push({
                    determinant: [...fd.determinant], dependent: attribute, value: group.values[index], rowIds: [...group.rows]
                }));
            });
        });
        return { isAtomic, currentForm, partialDependencies, transitiveDependencies, repeatedFacts, dependencies };
    }

    function identifyDependencies(problem) { return analyze(problem).dependencies.map(fd => clone(fd)); }

    function detectAnomalies(problem) {
        const analysis = analyze(problem);
        const violations = [...analysis.partialDependencies, ...analysis.transitiveDependencies];
        const anomalies = [];
        analysis.repeatedFacts.forEach(fact => anomalies.push({
            type: "update", dependency: { determinant: fact.determinant, dependent: [fact.dependent] },
            explanation: `${fact.dependent} is repeated in ${fact.rowIds.length} rows, so updating only one copy creates disagreement.`
        }));
        violations.forEach(fd => {
            anomalies.push({ type: "insert", dependency: clone(fd), explanation: `${fd.dependent.join(", ")} cannot be stored independently without inventing unrelated key values.` });
            anomalies.push({ type: "delete", dependency: clone(fd), explanation: `Deleting the last matching row can erase the only stored ${fd.dependent.join(", ")} fact.` });
        });
        return unique(anomalies.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
    }

    function changedValue(value) {
        if (typeof value === "number") return value + 1;
        if (typeof value === "boolean") return !value;
        return `${value} (updated)`;
    }

    function simulateAnomaly(problem, requestedType = null) {
        const analysis = analyze(problem);
        const type = String(requestedType || problem.task.anomalyType || detectAnomalies(problem)[0]?.type || "update").toLowerCase();
        const violations = [...analysis.partialDependencies, ...analysis.transitiveDependencies];
        const dependency = violations[0] || analysis.dependencies[0];
        if (!dependency) fail("An anomaly simulation needs at least one functional dependency.");
        const relation = clone(problem.relation);

        if (type === "update") {
            const fact = analysis.repeatedFacts.find(item => sameSet(item.determinant, dependency.determinant)) || analysis.repeatedFacts[0];
            if (!fact) return {
                type, dependency: clone(dependency), before: { safe: true, consequence: "No repeated copy exists in this bounded data set." },
                after: { safe: true, consequence: "The dependency-owned fact still has one home." }
            };
            const next = changedValue(fact.value);
            const beforeRows = clone(relation.rows);
            beforeRows.find(row => row.id === fact.rowIds[0]).values[fact.dependent] = next;
            const remainingValues = unique(beforeRows.filter(row => fact.rowIds.includes(row.id)).map(row => JSON.stringify(row.values[fact.dependent])));
            return {
                type, dependency: { determinant: fact.determinant, dependent: [fact.dependent] },
                operation: `Change ${fact.dependent} from ${String(fact.value)} to ${String(next)} in only row ${fact.rowIds[0]}.`,
                before: { safe: remainingValues.length === 1, rows: beforeRows, consequence: `${remainingValues.length} conflicting ${fact.dependent} values now describe the same determinant.` },
                after: { safe: true, consequence: `Update the single ${fact.determinant.join(" + ")} fact once; every reference observes ${String(next)}.` }
            };
        }

        if (type === "insert") {
            const missingKey = problem.relation.primaryKey.filter(name => !dependency.determinant.includes(name));
            return {
                type, dependency: clone(dependency),
                operation: `Store a new ${dependency.determinant.join(" + ")} fact without an unrelated ${missingKey.join(" + ") || "row"}.`,
                before: { safe: false, accepted: false, consequence: missingKey.length
                    ? `The mixed relation requires ${missingKey.join(" + ")}, so the independent fact cannot be inserted honestly.`
                    : "The mixed relation has no independent home for this fact." },
                after: { safe: true, accepted: true, consequence: `Insert the fact directly into the relation keyed by ${dependency.determinant.join(" + ")}.` }
            };
        }

        if (type === "delete") {
            const groups = new Map();
            relation.rows.forEach(row => {
                const key = determinantKey(row, dependency.determinant);
                const group = groups.get(key) || []; group.push(row); groups.set(key, group);
            });
            const selected = [...groups.values()].find(group => group.length === 1) || [...groups.values()][0];
            const row = selected[0];
            const fact = dependency.dependent.map(name => `${name}=${String(row.values[name])}`).join(", ");
            return {
                type, dependency: clone(dependency), operation: `Delete row ${row.id}, the last row currently carrying ${fact}.`,
                before: { safe: false, rows: relation.rows.filter(item => item.id !== row.id), consequence: `The mixed table loses the ${fact} fact with the relationship row.` },
                after: { safe: true, consequence: `Delete the relationship row while the ${dependency.determinant.join(" + ")} fact remains in its own relation.` }
            };
        }
        fail(`Unsupported anomaly type "${type}".`);
    }

    function projectRows(relation, attributes) {
        const seen = new Set(); const rows = [];
        relation.rows.forEach((row, index) => {
            const values = Object.fromEntries(attributes.map(name => [name, clone(row.values[name])]));
            const signature = JSON.stringify(values);
            if (!seen.has(signature)) { seen.add(signature); rows.push({ id: `${relation.name.toLowerCase()}-${index + 1}`, values }); }
        });
        return rows;
    }

    function atomicRows(relation) {
        const rows = [];
        relation.rows.forEach(row => {
            let expanded = [{}];
            relation.columns.forEach(column => {
                const values = Array.isArray(row.values[column.name]) ? row.values[column.name] : [row.values[column.name]];
                expanded = expanded.flatMap(current => values.map(value => ({ ...current, [column.name]: value })));
            });
            expanded.forEach((values, index) => rows.push({ id: `${row.id}-${index + 1}`, values }));
        });
        return rows;
    }

    function relationName(determinant, used) {
        let base = determinant.map(name => name.replace(/_id$/i, "")).join("_") || "details";
        if (!base) base = "details";
        let name = base; let suffix = 2;
        while (used.has(name)) name = `${base}_${suffix++}`;
        used.add(name); return name;
    }

    function decompose(problem, requestedForm = null) {
        const analysis = analyze(problem);
        const targetForm = formValue(requestedForm || problem.task.targetForm || "3NF") || "3NF";
        const relation = problem.relation;
        const allAttributes = relation.columns.map(column => column.name);
        if (targetForm === "1NF") return { targetForm, relations: [{
            name: relation.name, attributes: allAttributes, primaryKey: [...relation.primaryKey], rows: atomicRows(relation)
        }] };
        const violations = targetForm === "2NF" ? analysis.partialDependencies
            : [...analysis.partialDependencies, ...analysis.transitiveDependencies];
        const grouped = new Map();
        violations.forEach(fd => {
            const key = [...fd.determinant].sort().join("|");
            const group = grouped.get(key) || { determinant: [...fd.determinant], dependent: [] };
            group.dependent = unique([...group.dependent, ...fd.dependent.filter(name => !relation.primaryKey.includes(name))]);
            grouped.set(key, group);
        });
        const moved = unique([...grouped.values()].flatMap(group => group.dependent));
        const mainAttributes = allAttributes.filter(name => !moved.includes(name));
        const used = new Set([relation.name.toLowerCase()]);
        const relations = [...grouped.values()].filter(group => group.dependent.length).map(group => {
            const attributes = unique([...group.determinant, ...group.dependent]);
            return { name: relationName(group.determinant, used), attributes, primaryKey: [...group.determinant], rows: projectRows(relation, attributes) };
        });
        relations.push({ name: relation.name, attributes: mainAttributes, primaryKey: [...relation.primaryKey], rows: projectRows(relation, mainAttributes) });
        return { targetForm, relations };
    }

    function parseAttributes(value) {
        if (Array.isArray(value)) return unique(value.map(item => String(item).trim()).filter(Boolean));
        return unique(String(value ?? "").split(",").map(item => item.trim()).filter(Boolean));
    }
    function parseRelations(value) {
        if (Array.isArray(value)) return value.map(item => parseAttributes(item.attributes || item));
        return String(value ?? "").split(/[|;\n]+/).map(parseAttributes).filter(items => items.length);
    }

    function assessDecomposition(problem, submitted) {
        const target = decompose(problem, problem.task.targetForm || "3NF");
        const relations = parseRelations(submitted);
        const source = problem.relation.columns.map(column => column.name);
        if (!relations.length) return { correct: false, reason: "Enter each relation as comma-separated attributes, separated by |." };
        if (relations.some(group => group.some(name => !source.includes(name)))) return { correct: false, reason: "A proposed relation contains an unknown attribute." };
        const signatures = relations.map(group => [...group].sort().join("|")).sort();
        if (unique(signatures).length !== signatures.length) return { correct: false, reason: "The same proposed relation is duplicated." };
        if (!source.every(name => relations.some(group => group.includes(name)))) return { correct: false, reason: "Every source attribute must be preserved." };
        const expectedMain = target.relations.at(-1).attributes;
        if (!relations.some(group => expectedMain.every(name => group.includes(name)))) return { correct: false, reason: "Keep a relation that preserves the original key and remaining facts." };
        for (const expected of target.relations.slice(0, -1)) {
            const determinant = expected.primaryKey;
            const dependents = expected.attributes.filter(name => !determinant.includes(name));
            for (const dependent of dependents) {
                const holders = relations.filter(group => group.includes(dependent));
                if (!holders.length || holders.some(group => !determinant.every(name => group.includes(name)))) {
                    return { correct: false, reason: `${dependent} must stay with the determinant ${determinant.join(", ")}.` };
                }
                if (holders.length > 1) {
                    return { correct: false, reason: `${dependent} is duplicated across proposed relations instead of having one home.` };
                }
                if (holders.some(group => problem.relation.primaryKey.some(name => !determinant.includes(name) && group.includes(name)))) {
                    return { correct: false, reason: `${dependent} is still mixed with an unrelated part of the original key.` };
                }
            }
        }
        return { correct: true, reason: "The decomposition preserves every attribute and separates the model-derived dependencies.", relations };
    }

    function field(label, submitted, expected, correct) { return { label, submitted: String(submitted ?? ""), expected, correct }; }
    function matchingDependency(problem, response) {
        const analysis = analyze(problem);
        const candidates = problem.task.dependencyClass === "partial" ? analysis.partialDependencies
            : problem.task.dependencyClass === "transitive" ? analysis.transitiveDependencies
            : [...analysis.partialDependencies, ...analysis.transitiveDependencies, ...analysis.dependencies];
        const determinant = parseAttributes(response.determinant); const dependent = parseAttributes(response.dependent);
        return candidates.find(fd => sameSet(fd.determinant, determinant) && dependent.length && subset(dependent, fd.dependent));
    }

    function assess(problem, response = {}) {
        validateProblem(problem);
        const analysis = analyze(problem); const anomalies = detectAnomalies(problem);
        const target = decompose(problem, problem.task.targetForm || "3NF");
        const fields = []; const kind = problem.task.kind;
        if (kind === "identify-normal-form" || kind === "decompose") {
            const submitted = formValue(response.currentForm);
            fields.push(field("Current normal form", response.currentForm, analysis.currentForm, submitted === analysis.currentForm));
        }
        if (kind === "identify-redundancy") {
            const valid = new Set(analysis.repeatedFacts.map(item => item.dependent));
            fields.push(field("Repeated attribute", response.redundantAttribute, [...valid].join(" or "), valid.has(String(response.redundantAttribute ?? "").trim())));
        }
        if (kind === "identify-dependency" || kind === "decompose") {
            const match = matchingDependency(problem, response);
            fields.push(field("Determinant", response.determinant, "A determinant from a model-derived violation", Boolean(match)));
            fields.push(field("Dependent attribute", response.dependent, "An attribute determined by that determinant", Boolean(match)));
        }
        if (kind === "identify-anomaly" || kind === "decompose") {
            const accepted = problem.task.anomalyType ? [problem.task.anomalyType] : unique(anomalies.map(item => item.type));
            fields.push(field("Anomaly", response.anomalyType, accepted.join(" or "), accepted.includes(String(response.anomalyType ?? "").trim().toLowerCase())));
        }
        let decompositionAssessment = null;
        if (kind === "decompose") {
            decompositionAssessment = assessDecomposition(problem, response.relations);
            fields.push(field("Decomposition", response.relations, "A dependency-preserving decomposition", decompositionAssessment.correct));
            const resulting = formValue(response.resultingForm);
            fields.push(field("Resulting normal form", response.resultingForm, target.targetForm, resulting === target.targetForm));
        }
        const allCorrect = fields.length > 0 && fields.every(item => item.correct);
        return {
            allCorrect, fields, analysis, anomalies, decomposition: target,
            feedback: allCorrect ? "Your reasoning matches the executable normalization model."
                : (decompositionAssessment?.reason || "Review the highlighted field-level feedback and try again."),
            result: { currentForm: analysis.currentForm, targetForm: target.targetForm, relations: clone(target.relations),
                anomalySimulation: simulateAnomaly(problem, problem.task.anomalyType || response.anomalyType) }
        };
    }

    function createSession(problem) {
        validateProblem(problem);
        let submitted = false;
        return {
            inspect() { return { analysis: analyze(problem), anomalies: detectAnomalies(problem) }; },
            submit(response) { submitted = true; return assess(problem, response); },
            getState() { return { submitted, problem: clone(problem) }; }
        };
    }

    return { validateProblem, analyze, identifyDependencies, detectAnomalies, simulateAnomaly, decompose, assess, assessDecomposition, createSession, parseRelations, clone };
})();
