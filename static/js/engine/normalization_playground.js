/* Database Normalization UI. NormalizationModel owns diagnosis, anomalies, and decomposition. */
function createNormalizationPlayground() {
    const config = LESSON.playground;
    const escape = RelationalTableRenderer.escape;
    const clone = NormalizationModel.clone;
    let problems = [], taskIndex = 0, mode = "learn", feedback = "", assessment = null, lastConsequence = null;

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function currentProblem() { return problems[taskIndex] || null; }
    function currentTask() { return currentProblem()?.task; }

    function displayValue(value) {
        return Array.isArray(value) ? `[${value.join(", ")}]` : String(value ?? "NULL");
    }
    function relationTable(relation, caption = relation.name) {
        return `<div class="relational-table-shell normalization-table-shell"><table class="relational-table normalization-table">
            <caption>${escape(caption)}</caption><thead><tr><th>Row</th>${relation.columns.map(column => `<th>${escape(column.name)}${relation.primaryKey.includes(column.name) ? "<small>PRIMARY KEY PART</small>" : ""}</th>`).join("")}</tr></thead>
            <tbody>${relation.rows.map(row => `<tr><th>${escape(row.id)}</th>${relation.columns.map(column => `<td>${escape(displayValue(row.values[column.name]))}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`;
    }
    function decomposedTable(relation) {
        const columns = relation.attributes.map(name => ({ name }));
        return relationTable({ ...relation, columns }, `${relation.name} · key: ${relation.primaryKey.join(" + ")}`);
    }
    function dependencyText(fd) { return `${fd.determinant.join(" + ")} → ${fd.dependent.join(", ")}`; }

    function responseMarkup(problem) {
        const task = problem.task; const columns = problem.relation.columns.map(column => column.name);
        const form = `<label>Current normal form<select data-normal-form><option value="">Choose</option><option>UNNORMALIZED</option><option>1NF</option><option>2NF</option><option>3NF</option></select></label>`;
        const redundancy = `<label>Repeated attribute<select data-normal-redundant><option value="">Choose attribute</option>${columns.map(name => `<option value="${escape(name)}">${escape(name)}</option>`).join("")}</select></label>`;
        const dependency = `<label>Determinant attributes<input data-normal-determinant placeholder="e.g. course_id"></label><label>Dependent attributes<input data-normal-dependent placeholder="e.g. course_name, instructor"></label>`;
        const anomaly = `<label>Anomaly type<select data-normal-anomaly><option value="">Choose</option><option value="update">Update anomaly</option><option value="insert">Insert anomaly</option><option value="delete">Delete anomaly</option></select></label>`;
        const decomposition = `<label class="normalization-wide-field">Proposed relations <textarea data-normal-relations rows="3" placeholder="student_id, student_name | course_id, course_name | student_id, course_id"></textarea><small>Separate relations with |. Attribute and relation order do not matter.</small></label><label>Resulting normal form<select data-normal-result-form><option value="">Choose</option><option>1NF</option><option>2NF</option><option>3NF</option></select></label>`;
        if (task.kind === "identify-normal-form") return form;
        if (task.kind === "identify-redundancy") return redundancy;
        if (task.kind === "identify-dependency") return dependency;
        if (task.kind === "identify-anomaly") return anomaly;
        return form + dependency + anomaly + decomposition;
    }

    function readResponse(root = stackDiv) {
        return {
            currentForm: root.querySelector("[data-normal-form]")?.value ?? "",
            redundantAttribute: root.querySelector("[data-normal-redundant]")?.value ?? "",
            determinant: root.querySelector("[data-normal-determinant]")?.value ?? "",
            dependent: root.querySelector("[data-normal-dependent]")?.value ?? "",
            anomalyType: root.querySelector("[data-normal-anomaly]")?.value ?? "",
            relations: root.querySelector("[data-normal-relations]")?.value ?? "",
            resultingForm: root.querySelector("[data-normal-result-form]")?.value ?? ""
        };
    }

    function consequenceMarkup(problem, result) {
        if (!result) return "";
        const anomalies = result.anomalies || [];
        const simulation = result.result?.anomalySimulation;
        return `<section class="normalization-consequence">
            <header><span>MODEL CONSEQUENCE</span><h4>${escape(result.analysis.currentForm)} → ${escape(result.decomposition.targetForm)}</h4></header>
            ${simulation?.operation ? `<p class="normalization-operation"><strong>${escape(simulation.type.toUpperCase())} OPERATION</strong>${escape(simulation.operation)}</p>` : ""}
            <div class="normalization-before-after">
                <article><strong>BEFORE · ONE MIXED RELATION</strong><p>${escape(simulation?.before?.consequence || anomalies[0]?.explanation || "A non-atomic value or dependency keeps unrelated facts together.")}</p></article>
                <article><strong>AFTER · FACTS HAVE ONE HOME</strong><p>${escape(simulation?.after?.consequence || "The generated decomposition preserves every source attribute while separating the violating dependencies.")}</p></article>
            </div>
            ${simulation?.before?.rows ? relationTable({ ...problem.relation, rows: simulation.before.rows }, "MIXED TABLE · AFTER THE OPERATION") : ""}
            <div class="normalization-result-tables">${result.decomposition.relations.map(decomposedTable).join("")}</div>
        </section>`;
    }

    function fieldFeedback() {
        if (!assessment) return "";
        return `<ul class="relational-field-feedback">${assessment.fields.map(item => `<li>${item.correct ? "✓" : "○"} ${escape(item.label)} — yours: ${escape(item.submitted || "blank")}; expected: ${escape(item.expected)}</li>`).join("")}</ul>`;
    }

    function updateTask() {
        if (mode === "expert-thinking") return;
        const task = currentTask();
        if (!task) { window.activeTask?.clear?.(); return; }
        window.activeTask?.render({
            label: mode === "mastery" ? "ACTIVE TASK · NORMALIZATION" : "YOUR TASK · NORMALIZATION",
            step: taskIndex + 1, total: problems.length,
            title: task.kind.replaceAll("-", " ").toUpperCase(), instruction: task.prompt
        });
    }

    function render() {
        const problem = currentProblem();
        stackDiv.className = "relational-exercise-view normalization-view";
        if (!problem) {
            stackDiv.innerHTML = `<p class="normalization-complete">✓ Every normalization task is complete.</p>${lastConsequence ? consequenceMarkup(lastConsequence.problem, lastConsequence.assessment) : ""}`;
            updateTask(); return;
        }
        const hidden = mode === "expert-thinking";
        stackDiv.innerHTML = `
            <section class="relational-task"><span>OBSERVE → IDENTIFY → DECOMPOSE</span><h3>${escape(problem.task.prompt)}</h3><p>Primary key: <strong>${escape(problem.relation.primaryKey.join(" + "))}</strong></p></section>
            ${relationTable(problem.relation, `SOURCE · ${problem.relation.name}`)}
            ${hidden ? '<p class="relational-hidden-result">The normal form, anomalies, dependencies, and decomposition stay hidden until Check prediction.</p>' : `
                <div class="relational-answer-grid normalization-answer-grid">${responseMarkup(problem)}</div>
                <button type="button" class="relational-check" data-normal-check>Check reasoning</button>`}
            <p class="relational-feedback" aria-live="polite">${escape(feedback)}</p>${fieldFeedback()}
            ${assessment?.allCorrect ? consequenceMarkup(problem, assessment) : ""}`;
        stackDiv.querySelector("[data-normal-check]")?.addEventListener("click", submit);
        updateTask();
    }

    function submit() {
        const problem = currentProblem();
        if (!problem || mode === "expert-thinking") return;
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        assessment = NormalizationModel.assess(problem, readResponse());
        if (!assessment.allCorrect) {
            feedback = assessment.feedback;
            route({ operation: "normalization-attempt", state: { outcome: "attempted" }, feedback, progress: true });
            render(); return;
        }
        const completed = { problem: clone(problem), assessment: clone(assessment) };
        taskIndex += 1; lastConsequence = completed;
        const done = taskIndex >= problems.length;
        feedback = done ? "✓ Normalization reasoning complete." : "✓ Correct. Continue to the next database diagnosis.";
        route({ operation: problem.task.kind, state: { outcome: done ? "solved" : "progress", result: clone(assessment.result) }, feedback, progress: !done });
        assessment = null; render();
    }

    function normalizeProblems(input) {
        const list = (Array.isArray(input) ? input : [input]).filter(Boolean).map(clone);
        if (!list.length) throw new Error("Normalization needs at least one executable problem.");
        list.forEach(NormalizationModel.validateProblem);
        return list;
    }
    function reset(input, nextMode) {
        problems = normalizeProblems(input); taskIndex = 0; mode = nextMode; feedback = ""; assessment = null; lastConsequence = null; render();
    }

    function expertState(input, expertAssessment) {
        const wrapper = document.createElement("div"); wrapper.className = "relational-expert-state normalization-expert-state";
        wrapper.innerHTML = `<section class="relational-task"><span>EXPERT NORMALIZATION</span><h3>${escape(input.task.prompt)}</h3><p>Primary key: <strong>${escape(input.relation.primaryKey.join(" + "))}</strong></p></section>
            ${relationTable(input.relation, `SOURCE · ${input.relation.name}`)}
            ${expertAssessment ? consequenceMarkup(input, expertAssessment) : '<p class="relational-hidden-result">All derived answers remain hidden until you submit every prediction field.</p>'}`;
        return wrapper;
    }

    return {
        mount() { getControl("check-normalization").hidden = true; this.reset(); },
        reset() { reset(config.problems, "learn"); },
        resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation) { if (operation === "check-normalization") submit(); },
        endMasteryMode() { reset(config.problems, "free-play"); },
        renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) { container.appendChild(expertState(initialState, expertAssessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { const task = currentTask(); return task ? { title: task.kind.replaceAll("-", " "), instruction: task.prompt } : {}; },
        getState() { return clone({ problems, taskIndex, mode, assessment, lastConsequence }); }
    };
}

registerPlayground("normalization", createNormalizationPlayground);
