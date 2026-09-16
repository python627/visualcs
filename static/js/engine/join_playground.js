/* JOIN builder/visualization. JoinEvaluator owns matching and result construction. */
function createJoinPlayground() {
    const config = LESSON.playground;
    const clone = RelationalModel.clone;
    const escape = RelationalTableRenderer.escape;
    let problem, mode = "learn", response, assessment = null, result = null, feedback = "", reported = new Set();

    function freshResponse() { return { leftColumn: "", rightColumn: "", joinType: "", matchingPairs: [], predictionMade: false }; }
    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function sourceTables() {
        return {
            left: RelationalModel.getTable(problem.database, problem.allowed.leftTable),
            right: RelationalModel.getTable(problem.database, problem.allowed.rightTable)
        };
    }
    function reportDecision(operation, value) {
        if (mode !== "learn" || reported.has(operation)) return;
        reported.add(operation);
        teachingEngine.interactionStarted();
        const explanation = LESSON.teaching?.guided_practice?.action_explanations?.[operation];
        if (explanation) setByteMessage(explanation);
    }
    function allPairs() {
        const { left, right } = sourceTables();
        const pairs = left.rows.flatMap(leftRow => right.rows.map(rightRow => ({
            id: `${leftRow.id}+${rightRow.id}`,
            label: `${leftRow.id} ↔ ${rightRow.id}`
        })));
        if (problem.allowed.joinTypes.includes("left")) {
            left.rows.forEach(leftRow => pairs.push({
                id: `${leftRow.id}+NULL`, label: `${leftRow.id} ↔ NULL (no right match)`
            }));
        }
        return pairs;
    }
    function complete() {
        return response.leftColumn && response.rightColumn && response.joinType && response.predictionMade;
    }
    function builderMarkup() {
        const { left, right } = sourceTables();
        return `<section class="join-builder"><h3>BUILD AND PREDICT THE JOIN</h3>
            <div class="join-definition-grid">
                <label>Left column<select data-join-left><option value="">Choose</option>${left.columns.map(column => `<option value="${escape(column.name)}" ${response.leftColumn === column.name ? "selected" : ""}>${escape(left.name)}.${escape(column.name)}</option>`).join("")}</select></label>
                <label>Join type<select data-join-type><option value="">Choose</option>${problem.allowed.joinTypes.map(type => `<option value="${type}" ${response.joinType === type ? "selected" : ""}>${type.toUpperCase()} JOIN</option>`).join("")}</select></label>
                <label>Right column<select data-join-right><option value="">Choose</option>${right.columns.map(column => `<option value="${escape(column.name)}" ${response.rightColumn === column.name ? "selected" : ""}>${escape(right.name)}.${escape(column.name)}</option>`).join("")}</select></label>
            </div>
            <fieldset class="join-pairs"><legend>Predict every output row pair</legend><p>One-to-many matches create more than one output row.</p>
                <div>${allPairs().map(pair => `<label><input type="checkbox" data-join-pair value="${escape(pair.id)}" ${response.matchingPairs.includes(pair.id) ? "checked" : ""}>${escape(pair.label)}</label>`).join("")}</div>
                <label><input type="checkbox" data-join-none ${response.predictionMade && !response.matchingPairs.length ? "checked" : ""}> No source rows match</label>
            </fieldset>
            <button type="button" class="relational-check" data-join-run>Run and check JOIN</button>
        </section>`;
    }
    function updateTask() {
        if (mode === "expert-thinking") return;
        window.activeTask?.render({ label: mode === "mastery" ? "ACTIVE TASK · JOIN" : "YOUR TASK · JOIN",
            title: "Match related rows", instruction: problem.goal.instruction });
    }
    function render() {
        const { left, right } = sourceTables();
        const matchedLeft = result?.pairs.map(pair => pair.leftRowId) || [];
        const matchedRight = result?.pairs.map(pair => pair.rightRowId).filter(Boolean) || [];
        stackDiv.className = "relational-exercise-view join-view";
        stackDiv.innerHTML = `<section class="relational-task"><span>SOURCE TABLES → KEY MATCHES → JOINED RESULT</span><h3>${escape(problem.goal.instruction)}</h3></section>
            <div class="join-source-tables">${RelationalTableRenderer.table(left, { highlightedRows: matchedLeft })}<span class="join-link">↔</span>${RelationalTableRenderer.table(right, { highlightedRows: matchedRight })}</div>
            ${mode === "expert-thinking" ? '<p class="relational-hidden-result">Join columns, matches, and result rows stay hidden until Check prediction.</p>' : builderMarkup()}
            <section class="join-result"><h3>COMPUTED RESULT</h3>${result ? RelationalTableRenderer.result(result.columns, result.rows, `${result.join.type.toUpperCase()} JOIN RESULT`) : '<p class="relational-hidden-result">The evaluator will build this table after your prediction.</p>'}</section>
            <p class="relational-feedback" aria-live="polite">${escape(feedback)}</p>
            ${assessment ? `<ul class="relational-field-feedback">${assessment.fields.map(field => `<li>${field.correct ? "✓" : "○"} ${escape(field.label)} — yours: ${escape(field.submitted)}; expected: ${escape(field.expected)}</li>`).join("")}</ul>` : ""}`;
        bind(); updateTask();
    }
    function bind() {
        stackDiv.querySelector("[data-join-left]")?.addEventListener("change", event => { response.leftColumn = event.target.value; assessment = result = null; reportDecision("choose-left-column", response.leftColumn); render(); });
        stackDiv.querySelector("[data-join-right]")?.addEventListener("change", event => { response.rightColumn = event.target.value; assessment = result = null; reportDecision("choose-right-column", response.rightColumn); render(); });
        stackDiv.querySelector("[data-join-type]")?.addEventListener("change", event => { response.joinType = event.target.value; assessment = result = null; reportDecision("choose-join-type", response.joinType); render(); });
        stackDiv.querySelectorAll("[data-join-pair]").forEach(input => input.addEventListener("change", () => {
            response.matchingPairs = [...stackDiv.querySelectorAll("[data-join-pair]:checked")].map(item => item.value);
            response.predictionMade = true;
            const none = stackDiv.querySelector("[data-join-none]"); if (none) none.checked = false;
            assessment = result = null; reportDecision("predict-matches", [...response.matchingPairs]); render();
        }));
        stackDiv.querySelector("[data-join-none]")?.addEventListener("change", event => {
            response.matchingPairs = []; response.predictionMade = event.target.checked;
            assessment = result = null; reportDecision("predict-matches", []); render();
        });
        stackDiv.querySelector("[data-join-run]")?.addEventListener("click", runJoin);
    }
    function runJoin() {
        if (mode === "expert-thinking") return;
        if (!complete()) { feedback = "Choose both columns, a join type, and predict the matching pairs first."; render(); return; }
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        try {
            assessment = JoinEvaluator.assessGoal(problem.database, problem.goal.join, {
                leftTable: problem.allowed.leftTable, rightTable: problem.allowed.rightTable,
                leftColumn: response.leftColumn, rightColumn: response.rightColumn, type: response.joinType
            }, response.matchingPairs);
            result = assessment.actualResult;
            feedback = assessment.allCorrect ? `✓ ${assessment.feedback}` : assessment.feedback;
            route({ operation: assessment.allCorrect ? "run-join" : "join-attempt",
                state: { outcome: assessment.allCorrect ? "solved" : "attempted", result: clone(result) }, feedback, progress: !assessment.allCorrect });
        }
        catch (error) {
            assessment = result = null; feedback = error.message;
            route({ operation: "join-attempt", state: { outcome: "attempted" }, feedback, progress: true });
        }
        render();
    }
    function reset(input, nextMode) {
        problem = clone(input); JoinEvaluator.execute(problem.database, problem.goal.join);
        mode = nextMode; response = freshResponse(); assessment = result = null; feedback = ""; reported = new Set(); render();
    }
    function expertState(input, expertAssessment) {
        const wrapper = document.createElement("div"); wrapper.className = "relational-expert-state";
        const actual = expertAssessment?.actualResult;
        wrapper.innerHTML = `<section class="relational-task"><span>EXPERT JOIN</span><h3>${escape(input.goal.instruction)}</h3></section>
            ${RelationalTableRenderer.database(input.database)}
            ${actual ? `<h4>EVALUATOR RESULT</h4>${RelationalTableRenderer.result(actual.columns, actual.rows, "JOIN RESULT")}` : '<p class="relational-hidden-result">The matching pairs and joined result remain hidden until Check prediction.</p>'}`;
        return wrapper;
    }
    return {
        mount() { getControl("run-join").hidden = true; this.reset(); },
        reset() { reset(config.problem, "learn"); }, resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation) { if (operation === "run-join") runJoin(); },
        endMasteryMode() { reset(config.problem, "free-play"); }, renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) { container.appendChild(expertState(initialState, expertAssessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { return { title: "Build the JOIN", instruction: problem.goal.instruction }; },
        getState() { return clone({ problem, response, result, mode }); }
    };
}

registerPlayground("dbms-joins", createJoinPlayground);
