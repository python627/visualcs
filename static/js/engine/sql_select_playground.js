/* SQL SELECT adapter: builds structured queries and delegates all semantics to SelectEvaluator. */
function createSqlSelectPlayground() {
    const config = LESSON.playground;
    const clone = RelationalModel.clone;
    const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    let problem;
    let mode = "learn";
    let response;
    let result = null;
    let assessment = null;
    let feedback = "";
    let reported = new Set();

    function freshResponse() {
        return {
            from: "",
            select: [],
            where: { field: "", operator: "", value: "" },
            predictedRowIds: [],
            predictionMade: false
        };
    }

    function reset(input, nextMode) {
        problem = clone(input);
        RelationalModel.validateDatabase(problem.database);
        SelectEvaluator.normalizeQuery(problem.database, problem.goal.query);
        mode = nextMode;
        response = freshResponse();
        result = null;
        assessment = null;
        feedback = "";
        reported = new Set();
        render();
    }

    function currentTable() {
        if (!response.from) return null;
        try { return RelationalModel.getTable(problem.database, response.from); }
        catch (_) { return null; }
    }

    function availableOperators() {
        const table = currentTable();
        if (!table || !response.where.field) return problem.allowed?.operators || SelectEvaluator.operators;
        const column = RelationalModel.getColumn(table, response.where.field);
        return (problem.allowed?.operators || SelectEvaluator.operators).filter(operator => (
            column.type === "number" || ["=", "!="].includes(operator)
        ));
    }

    function queryComplete() {
        return Boolean(response.from && response.select.length && response.where.field
            && response.where.operator && String(response.where.value).trim());
    }

    function task() {
        const tasks = config.tasks;
        if (!response.from) return tasks.source;
        if (!response.select.length) return tasks.columns;
        if (!response.where.field || !response.where.operator || !String(response.where.value).trim()) return tasks.where;
        if (!response.predictionMade) return tasks.prediction;
        return tasks.run;
    }

    function updateActiveTask() {
        if (mode === "expert-thinking") return;
        const current = task();
        window.activeTask?.render({
            label: mode === "mastery" ? "ACTIVE TASK · SQL SELECT" : "YOUR TASK · SQL SELECT",
            title: current.title,
            instruction: current.instruction
        });
    }

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }

    function reportDecision(operation, event = {}) {
        if (mode !== "learn" || reported.has(operation)) return;
        reported.add(operation);
        teachingEngine.interactionStarted();
        route({ operation, state: { outcome: null }, progress: true, ...event });
    }

    function invalidatePrediction() {
        response.predictedRowIds = [];
        response.predictionMade = false;
        result = null;
        assessment = null;
    }

    function tableMarkup(table, { outputColumns = [], matchedRowIds = null } = {}) {
        const matched = matchedRowIds ? new Set(matchedRowIds) : null;
        return `<div class="sql-table-shell"><table class="sql-table"><caption>${escape(table.name)}</caption>
            <thead><tr><th scope="col">Row ID</th>${table.columns.map(column => (
                `<th scope="col" class="${outputColumns.includes(column.name) ? "sql-selected-column" : ""}">${escape(column.name)}<small>${escape(column.type)}</small></th>`
            )).join("")}</tr></thead>
            <tbody>${table.rows.map(row => `<tr data-row-id="${escape(row.id)}" class="${matched ? (matched.has(row.id) ? "sql-row-matched" : "sql-row-filtered") : ""}">
                <th scope="row">${escape(row.id)}</th>${table.columns.map(column => (
                    `<td class="${outputColumns.includes(column.name) ? "sql-selected-column" : ""}">${escape(row.values[column.name])}</td>`
                )).join("")}</tr>`).join("")}</tbody></table></div>`;
    }

    function resultMarkup(execution) {
        if (!execution) return `<div class="sql-result-placeholder">Result hidden until RUN QUERY.</div>`;
        return `<div class="sql-table-shell"><table class="sql-table sql-result-table"><caption>RESULT TABLE</caption>
            <thead><tr>${execution.columns.map(column => `<th>${escape(column.name)}</th>`).join("")}</tr></thead>
            <tbody>${execution.rows.length ? execution.rows.map(row => `<tr>${execution.columns.map(column => (
                `<td>${escape(row.values[column.name])}</td>`
            )).join("")}</tr>`).join("") : `<tr><td colspan="${execution.columns.length}">0 rows</td></tr>`}</tbody></table></div>`;
    }

    function queryText(query) {
        if (!query) return "Complete the structured query.";
        const where = query.where ? ` WHERE ${query.where.field} ${query.where.operator} ${query.where.value}` : "";
        return `SELECT ${query.select.join(", ")} FROM ${query.from}${where}`;
    }

    function renderBuilder(table) {
        const tables = problem.allowed?.tables || problem.database.tables.map(item => item.name);
        const selectable = table
            ? table.columns.filter(column => (problem.allowed?.selectColumns || table.columns.map(item => item.name)).includes(column.name))
            : [];
        const whereFields = table
            ? table.columns.filter(column => (problem.allowed?.whereFields || table.columns.map(item => item.name)).includes(column.name))
            : [];
        const operators = availableOperators();
        const predictionRows = table?.rows || [];
        return `<section class="sql-query-builder" aria-label="Build a structured SELECT query">
            <h3>BUILD THE QUERY</h3>
            <div class="sql-builder-grid">
                <label>FROM table<select data-sql-from><option value="">Choose table</option>${tables.map(name => (
                    `<option value="${escape(name)}" ${response.from === name ? "selected" : ""}>${escape(name)}</option>`
                )).join("")}</select></label>
                <fieldset ${table ? "" : "disabled"}><legend>SELECT columns</legend>${selectable.map(column => (
                    `<label class="sql-check"><input type="checkbox" data-sql-select value="${escape(column.name)}" ${response.select.includes(column.name) ? "checked" : ""}> ${escape(column.name)}</label>`
                )).join("") || "Choose a table first."}</fieldset>
                <div class="sql-where-controls">
                    <label>WHERE field<select data-sql-field ${table ? "" : "disabled"}><option value="">Choose field</option>${whereFields.map(column => (
                        `<option value="${escape(column.name)}" ${response.where.field === column.name ? "selected" : ""}>${escape(column.name)}</option>`
                    )).join("")}</select></label>
                    <label>Operator<select data-sql-operator ${response.where.field ? "" : "disabled"}><option value="">Choose operator</option>${operators.map(operator => (
                        `<option value="${escape(operator)}" ${response.where.operator === operator ? "selected" : ""}>${escape(operator)}</option>`
                    )).join("")}</select></label>
                    <label>Value<input data-sql-value value="${escape(response.where.value)}" ${response.where.field ? "" : "disabled"} placeholder="Comparison value"></label>
                </div>
            </div>
            <fieldset class="sql-prediction" ${queryComplete() ? "" : "disabled"}><legend>PREDICT MATCHING SOURCE ROWS</legend>
                <p>${escape(config.prediction_instruction)}</p>
                <div class="sql-prediction-options">${predictionRows.map(row => `<label class="sql-check"><input type="checkbox" data-sql-predict value="${escape(row.id)}"
                    ${response.predictedRowIds.includes(row.id) ? "checked" : ""}> ${escape(row.id)} · ${escape(row.values[problem.prediction?.rowLabelColumn] ?? "")}</label>`).join("")}</div>
                <label class="sql-check sql-no-rows"><input type="checkbox" data-sql-no-rows ${response.predictionMade && !response.predictedRowIds.length ? "checked" : ""}> No rows will match</label>
            </fieldset>
            <div class="sql-query-preview"><span>QUERY TO RUN</span><code>${queryComplete() ? escape(queryText({ from: response.from, select: response.select, where: response.where })) : "—"}</code></div>
            <button type="button" class="sql-run-button" data-sql-run>${escape(config.run_label)}</button>
        </section>`;
    }

    function bind() {
        stackDiv.querySelector("[data-sql-from]")?.addEventListener("change", event => {
            response = freshResponse();
            response.from = event.target.value;
            result = null;
            assessment = null;
            feedback = "";
            reportDecision("choose-source", { value: response.from });
            render();
        });
        stackDiv.querySelectorAll("[data-sql-select]").forEach(input => input.addEventListener("change", () => {
            response.select = [...stackDiv.querySelectorAll("[data-sql-select]:checked")].map(item => item.value);
            invalidatePrediction();
            if (response.select.length) reportDecision("choose-columns", { value: [...response.select] });
            render();
        }));
        stackDiv.querySelector("[data-sql-field]")?.addEventListener("change", event => {
            response.where = { field: event.target.value, operator: "", value: "" };
            invalidatePrediction();
            render();
        });
        stackDiv.querySelector("[data-sql-operator]")?.addEventListener("change", event => {
            response.where.operator = event.target.value;
            invalidatePrediction();
            render();
        });
        stackDiv.querySelector("[data-sql-value]")?.addEventListener("change", event => {
            response.where.value = event.target.value;
            invalidatePrediction();
            if (queryComplete()) reportDecision("build-where", { value: { ...response.where } });
            render();
        });
        stackDiv.querySelectorAll("[data-sql-predict]").forEach(input => input.addEventListener("change", () => {
            response.predictedRowIds = [...stackDiv.querySelectorAll("[data-sql-predict]:checked")].map(item => item.value);
            response.predictionMade = true;
            const noRows = stackDiv.querySelector("[data-sql-no-rows]");
            if (noRows) noRows.checked = false;
            reportDecision("predict", { value: [...response.predictedRowIds] });
            result = null;
            assessment = null;
            render();
        }));
        stackDiv.querySelector("[data-sql-no-rows]")?.addEventListener("change", event => {
            response.predictedRowIds = [];
            response.predictionMade = event.target.checked;
            reportDecision("predict", { value: [] });
            result = null;
            assessment = null;
            render();
        });
        stackDiv.querySelector("[data-sql-run]")?.addEventListener("click", runQuery);
    }

    function firstMissingMessage() {
        if (!response.from) return config.messages.missing_source;
        if (!response.select.length) return config.messages.missing_columns;
        if (!response.where.field || !response.where.operator || !String(response.where.value).trim()) return config.messages.missing_where;
        if (!response.predictionMade) return config.messages.missing_prediction;
        return null;
    }

    function runQuery() {
        const missing = firstMissingMessage();
        if (missing) {
            feedback = missing;
            render();
            return;
        }
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        try {
            const query = { from: response.from, select: [...response.select], where: { ...response.where } };
            assessment = SelectEvaluator.assessGoal(problem.database, problem.goal.query, query, response.predictedRowIds);
            result = assessment.actualResult;
            if (assessment.allCorrect) feedback = `${config.messages.success} ${assessment.feedback}`;
            else if (assessment.queryCorrect) feedback = `${config.messages.prediction_mismatch} ${assessment.feedback}`;
            else feedback = `${config.messages.valid_difference} ${assessment.feedback}`;
            route({
                operation: assessment.allCorrect ? "run-query" : "query-attempt",
                value: query,
                state: { outcome: assessment.allCorrect ? "solved" : "attempted", query, result },
                feedback,
                progress: !assessment.allCorrect
            });
        }
        catch (error) {
            assessment = null;
            result = null;
            feedback = error.message;
            route({ operation: "invalid-query", state: { outcome: null }, feedback, progress: true });
        }
        render();
    }

    function render() {
        const table = currentTable() || problem.database.tables[0];
        stackDiv.className = "sql-select-view";
        stackDiv.innerHTML = `<div class="sql-goal"><span>QUERY GOAL</span><p>${escape(problem.goal.instruction)}</p></div>
            <div class="sql-consequence-flow">
                <section class="sql-stage"><h3>SOURCE TABLE</h3>${tableMarkup(table, {
                    outputColumns: result?.query.select || [], matchedRowIds: result?.matchedRowIds || null
                })}</section>
                <span class="sql-flow-arrow" aria-hidden="true">→</span>
                <section class="sql-stage sql-filter-stage"><h3>WHERE FILTERING</h3><p>${result
                    ? `${result.rows.length} of ${result.sourceRowCount} rows survived.`
                    : "Qualifying rows stay hidden until the query runs."}</p></section>
                <span class="sql-flow-arrow" aria-hidden="true">→</span>
                <section class="sql-stage"><h3>SELECT PROJECTION</h3>${resultMarkup(result)}</section>
            </div>
            ${mode === "expert-thinking" ? "" : renderBuilder(currentTable())}
            <p class="sql-feedback" aria-live="polite">${escape(feedback)}</p>
            ${assessment ? `<details class="sql-field-results"><summary>Query feedback</summary><ul>${assessment.fields.map(item => (
                `<li>${escape(item.label)}: ${item.correct ? "✓" : "Needs revision"} — yours: ${escape(item.submitted)}; goal/result: ${escape(item.expected)}</li>`
            )).join("")}</ul></details>` : ""}`;
        bind();
        updateActiveTask();
    }

    function publicProblem(input, container, expertAssessment = null) {
        const table = input.database.tables[0];
        const execution = expertAssessment?.actualResult || null;
        const wrapper = document.createElement("div");
        wrapper.className = "sql-expert-state";
        wrapper.innerHTML = `<div class="sql-goal"><span>QUERY GOAL</span><p>${escape(input.goal.instruction)}</p></div>
            <h4>SOURCE TABLE</h4>${tableMarkup(table, {
                outputColumns: execution?.query.select || [],
                matchedRowIds: execution?.matchedRowIds || null
            })}${execution
                ? `<div class="sql-query-preview"><span>QUERY EXECUTED</span><code>${escape(queryText(execution.query))}</code></div>${resultMarkup(execution)}`
                : `<p class="sql-hidden-result">Result rows remain hidden until Check prediction.</p>`}`;
        container.appendChild(wrapper);
    }

    return {
        mount() {
            const templateControl = getControl("run-query");
            templateControl.hidden = true;
            this.reset();
        },
        reset() { reset(config.problem, "learn"); },
        resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) {
            reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery");
        },
        performMasteryOperation(operation) { if (operation === "run-query") runQuery(); },
        endMasteryMode() { reset(config.problem, "free-play"); },
        renderChallengeTarget() {},
        renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) {
            publicProblem(initialState, container, expertAssessment);
        },
        getActiveTask() { return task(); },
        getState() { return clone({ problem, response, result, assessment, mode }); }
    };
}

registerPlayground("sql-select", createSqlSelectPlayground);
