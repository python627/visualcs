/* Tables & Records UI. TableRecordModel owns schema checks and resulting data. */
function createTableRecordPlayground() {
    const config = LESSON.playground;
    const clone = RelationalModel.clone;
    const escape = RelationalTableRenderer.escape;
    let problems = [], taskIndex = 0, database, mode = "learn", feedback = "", assessment = null;

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }

    function currentProblem() { return problems[taskIndex] || null; }
    function currentTask() { return currentProblem()?.task; }
    function taskOperation(task) { return task?.kind || "check-table"; }

    function taskDetails(task) {
        if (task.kind === "add-record") return `<div class="relational-proposal"><strong>PROPOSED RECORD</strong><code>${escape(JSON.stringify(task.record.values))}</code></div>`;
        if (task.kind === "edit-field") return `<div class="relational-proposal"><strong>PROPOSED EDIT</strong><code>${escape(`${task.rowId}.${task.column} = ${String(task.value)}`)}</code></div>`;
        return "";
    }

    function responseMarkup(task) {
        const table = RelationalModel.getTable(database, task.table);
        if (task.kind === "identify-row") return `<label>Your answer<select data-table-answer><option value="">Choose row</option>${table.rows.map(row => `<option value="${escape(row.id)}">${escape(row.id)}</option>`).join("")}</select></label>`;
        if (task.kind === "identify-column") return `<label>Your answer<select data-table-answer><option value="">Choose column</option>${table.columns.map(column => `<option value="${escape(column.name)}">${escape(column.name)}</option>`).join("")}</select></label>`;
        if (task.kind === "inspect-field") return `<label>Field value<input data-table-answer placeholder="Enter the value"></label>`;
        const extra = task.kind === "add-record"
            ? `<label>Resulting row count<input data-table-row-count inputmode="numeric" placeholder="Number of rows"></label>`
            : `<label>Resulting field value<input data-table-result-value placeholder="Value after the edit attempt"></label>`;
        return `<label>Will the schema accept it?<select data-table-validity><option value="">Choose</option><option value="valid">Valid</option><option value="invalid">Invalid</option></select></label>${extra}`;
    }

    function readResponse() {
        return {
            answer: stackDiv.querySelector("[data-table-answer]")?.value ?? "",
            validity: stackDiv.querySelector("[data-table-validity]")?.value ?? "",
            rowCount: stackDiv.querySelector("[data-table-row-count]")?.value ?? "",
            resultValue: stackDiv.querySelector("[data-table-result-value]")?.value ?? ""
        };
    }

    function updateTask() {
        if (mode === "expert-thinking") return;
        const task = currentTask();
        if (!task) { window.activeTask?.clear?.(); return; }
        window.activeTask?.render({
            label: mode === "mastery" ? "ACTIVE TASK · TABLE STRUCTURE" : "YOUR TASK · TABLE STRUCTURE",
            step: taskIndex + 1, total: problems.length,
            title: task.kind.replaceAll("-", " ").toUpperCase(), instruction: task.prompt
        });
    }

    function render() {
        const task = currentTask();
        stackDiv.className = "relational-exercise-view table-record-view";
        stackDiv.innerHTML = task ? `
            <section class="relational-task"><span>SCHEMA → PREDICT → CONSEQUENCE</span><h3>${escape(task.prompt)}</h3>${taskDetails(task)}</section>
            ${RelationalTableRenderer.database(database)}
            ${mode === "expert-thinking" ? '<p class="relational-hidden-result">The resulting table stays hidden until Check prediction.</p>' : `
                <div class="relational-answer-grid">${responseMarkup(task)}</div>
                <button type="button" class="relational-check" data-table-check>Check prediction</button>`}
            <p class="relational-feedback" aria-live="polite">${escape(feedback)}</p>
            ${assessment ? `<ul class="relational-field-feedback">${assessment.fields.map(field => `<li>${field.correct ? "✓" : "○"} ${escape(field.label)} — yours: ${escape(field.submitted)}; expected: ${escape(field.expected)}</li>`).join("")}</ul>` : ""}` : "<p>✓ Every table task is complete.</p>";
        stackDiv.querySelector("[data-table-check]")?.addEventListener("click", submit);
        updateTask();
    }

    function submit() {
        const problem = currentProblem();
        if (!problem || mode === "expert-thinking") return;
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        assessment = TableRecordModel.assess(database, problem.task, readResponse());
        if (!assessment.allCorrect) {
            feedback = assessment.feedback;
            route({ operation: "table-attempt", state: { outcome: "attempted" }, feedback, progress: true });
            render();
            return;
        }
        database = clone(assessment.result.database);
        const operation = taskOperation(problem.task);
        taskIndex++;
        const complete = taskIndex >= problems.length;
        feedback = complete ? `✓ ${assessment.feedback}` : assessment.feedback;
        route({ operation, state: { outcome: complete ? "solved" : "progress", database: clone(database) }, feedback, progress: !complete });
        assessment = null;
        render();
    }

    function normalizeProblems(input) {
        const source = Array.isArray(input) ? input : [input];
        const firstDatabase = source[0]?.database;
        const list = source.map(problem => ({ ...problem, database: problem?.database || firstDatabase }));
        if (!list.length || list.some(problem => !problem?.database || !problem?.task)) throw new Error("Tables & Records needs executable problems.");
        list.forEach(problem => TableRecordModel.execute(problem.database, problem.task));
        return clone(list);
    }

    function reset(input, nextMode) {
        problems = normalizeProblems(input);
        taskIndex = 0;
        database = clone(problems[0].database);
        mode = nextMode;
        feedback = "";
        assessment = null;
        render();
    }

    function expertState(input, expertAssessment) {
        const wrapper = document.createElement("div");
        wrapper.className = "relational-expert-state";
        const task = input.task;
        wrapper.innerHTML = `<section class="relational-task"><span>EXPERT TABLE TASK</span><h3>${escape(task.prompt)}</h3>${taskDetails(task)}</section>
            ${RelationalTableRenderer.database(input.database)}
            ${expertAssessment?.result ? `<h4>MODEL CONSEQUENCE</h4>${RelationalTableRenderer.database(expertAssessment.result.database)}` : '<p class="relational-hidden-result">Schema validity and the resulting table remain hidden until Check prediction.</p>'}`;
        return wrapper;
    }

    return {
        mount() { getControl("check-table").hidden = true; this.reset(); },
        reset() { reset(config.problems, "learn"); },
        resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation) { if (operation === "check-table") submit(); },
        endMasteryMode() { reset(config.problems, "free-play"); },
        renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) { container.appendChild(expertState(initialState, expertAssessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { const task = currentTask(); return task ? { title: task.kind.replaceAll("-", " "), instruction: task.prompt } : {}; },
        getState() { return clone({ problems, taskIndex, database, mode }); }
    };
}

registerPlayground("table-records", createTableRecordPlayground);
