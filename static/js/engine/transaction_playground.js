/* Transaction UI. TransactionModel owns working/committed state and valid transitions. */
function createTransactionPlayground() {
    const config = LESSON.playground;
    const clone = RelationalModel.clone;
    const escape = RelationalTableRenderer.escape;
    let problem, session, mode = "learn", feedback = "", assessment = null;

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function snapshot() { return session.getSnapshot(); }
    function expectedStatusOptions() {
        return ["committed", "rolled_back", "failed_rolled_back"];
    }
    function predictionComplete() {
        const state = snapshot();
        return Boolean(stackDiv.querySelector("[data-transaction-status]")?.value)
            && Object.keys(state.committed).every(id => String(stackDiv.querySelector(`[data-transaction-balance="${id}"]`)?.value ?? "").trim());
    }
    function readPrediction() {
        const state = snapshot();
        return {
            status: stackDiv.querySelector("[data-transaction-status]")?.value || "",
            committed: Object.fromEntries(Object.keys(state.committed).map(id => [id, stackDiv.querySelector(`[data-transaction-balance="${id}"]`)?.value ?? ""]))
        };
    }
    function planMarkup(state) {
        return `<ol class="transaction-plan">${problem.operations.map((operation, index) => `<li class="${index < state.operationIndex ? "is-complete" : index === state.operationIndex && state.status === "active" ? "is-current" : ""}">
            ${escape(operation.label)} ${index < state.operationIndex ? "✓" : ""}</li>`).join("")}
            <li class="${session.isComplete() ? "is-complete" : ""}">${problem.terminal === "failure" ? "FAIL before COMMIT" : problem.terminal.toUpperCase()}</li></ol>`;
    }
    function controlsMarkup(state) {
        if (mode === "expert-thinking" || session.isComplete()) return "";
        return `<div class="transaction-controls" aria-label="Transaction actions">
            <button type="button" data-transaction-action="begin" ${state.status !== "idle" ? "disabled" : ""}>BEGIN</button>
            <button type="button" data-transaction-action="apply" ${state.status !== "active" ? "disabled" : ""}>APPLY NEXT CHANGE</button>
            <button type="button" data-transaction-action="commit" ${state.status !== "active" ? "disabled" : ""}>COMMIT</button>
            <button type="button" data-transaction-action="rollback" ${state.status !== "active" ? "disabled" : ""}>ROLLBACK</button>
            <button type="button" data-transaction-action="failure" ${state.status !== "active" ? "disabled" : ""}>SIMULATE FAILURE</button>
        </div>`;
    }
    function predictionMarkup(state) {
        if (mode === "expert-thinking") return '<p class="relational-hidden-result">The final committed state remains hidden until Check prediction.</p>';
        return `<fieldset class="transaction-prediction"><legend>PREDICT THE FINAL DURABLE STATE</legend>
            <label>Status<select data-transaction-status><option value="">Choose</option>${expectedStatusOptions().map(value => `<option value="${value}">${escape(value.replaceAll("_", " "))}</option>`).join("")}</select></label>
            ${Object.keys(state.committed).map(id => `<label>Committed ${escape(id)}<input data-transaction-balance="${escape(id)}" inputmode="numeric" placeholder="Final value"></label>`).join("")}
            <p>Enter this prediction before COMMIT, ROLLBACK, or FAILURE.</p>
        </fieldset>`;
    }
    function updateTask() {
        if (mode === "expert-thinking") return;
        const state = snapshot();
        const next = state.status === "idle" ? "Begin the transaction"
            : state.operationIndex < problem.terminalAfter ? problem.operations[state.operationIndex].label
                : `Choose ${problem.terminal.toUpperCase()} and predict what remains committed`;
        window.activeTask?.render({ label: mode === "mastery" ? "ACTIVE TASK · TRANSACTION" : "YOUR TASK · TRANSACTION",
            title: next, instruction: problem.instruction });
    }
    function render() {
        const state = snapshot();
        stackDiv.className = "relational-exercise-view transaction-view";
        stackDiv.innerHTML = `<section class="relational-task"><span>COMMITTED DATA → WORKING COPY → COMMIT OR DISCARD</span><h3>${escape(problem.instruction)}</h3></section>
            <div class="transaction-state-grid"><section><h3>COMMITTED STATE</h3>${RelationalTableRenderer.database(state.committedDatabase)}</section>
            <span class="transaction-divider">→</span><section><h3>WORKING / UNCOMMITTED STATE</h3>${state.workingDatabase ? RelationalTableRenderer.database(state.workingDatabase) : `<p class="transaction-empty">${state.status === "idle" ? "No transaction begun" : "No uncommitted copy remains"}</p>`}</section></div>
            <section class="transaction-workflow"><div><h3>TRANSACTION PLAN</h3>${planMarkup(state)}</div><div><h3>STATUS</h3><strong class="transaction-status">${escape(state.status.replaceAll("_", " ").toUpperCase())}</strong></div></section>
            ${predictionMarkup(state)}${controlsMarkup(state)}
            <p class="relational-feedback" aria-live="polite">${escape(feedback)}</p>
            ${assessment ? `<ul class="relational-field-feedback">${assessment.fields.map(field => `<li>${field.correct ? "✓" : "○"} ${escape(field.label)} — yours: ${escape(field.submitted)}; expected: ${escape(field.expected)}</li>`).join("")}</ul>` : ""}
            ${session.isComplete() ? '<button type="button" data-transaction-retry>Retry this transaction</button>' : ""}`;
        stackDiv.querySelectorAll("[data-transaction-action]").forEach(button => button.onclick = () => perform(button.dataset.transactionAction));
        stackDiv.querySelector("[data-transaction-retry]")?.addEventListener("click", () => reset(problem, mode === "mastery" ? "mastery" : "free-play"));
        updateTask();
    }
    function perform(action) {
        if (mode === "expert-thinking" || session.isComplete()) return;
        if (["commit", "rollback", "failure"].includes(action) && !predictionComplete()) {
            feedback = "Predict the final status and committed values before the terminal action."; render(); return;
        }
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        try {
            if (action === "begin") session.begin();
            else if (action === "apply") session.applyNext();
            else if (action === "commit") session.commit();
            else if (action === "rollback") session.rollback();
            else if (action === "failure") session.simulateFailure();
            else throw new Error(`Unsupported transaction action "${action}".`);
            const complete = session.isComplete();
            assessment = complete ? TransactionModel.assess(problem, readPrediction()) : null;
            const solved = complete && assessment.allCorrect;
            feedback = complete ? `${solved ? "✓ " : ""}${assessment.feedback}`
                : action === "begin" ? "BEGIN created a working copy; committed data has not changed."
                    : "The operation changed only the working copy. Nothing is durable yet.";
            route({ operation: solved ? action : complete ? "transaction-attempt" : action,
                state: { outcome: solved ? "solved" : complete ? "attempted" : "progress", snapshot: snapshot() }, feedback, progress: !solved });
        }
        catch (error) {
            feedback = error.message;
            route({ operation: "transaction-attempt", state: { outcome: "attempted" }, feedback, progress: true });
        }
        render();
    }
    function reset(input, nextMode) {
        problem = clone(input); session = TransactionModel.createSession(problem); mode = nextMode; feedback = ""; assessment = null; render();
    }
    function expertState(input, expertAssessment) {
        const wrapper = document.createElement("div"); wrapper.className = "relational-expert-state";
        const actual = expertAssessment?.actualFinalState;
        wrapper.innerHTML = `<section class="relational-task"><span>EXPERT TRANSACTION</span><h3>${escape(input.instruction)}</h3></section>
            <h4>INITIAL COMMITTED STATE</h4>${RelationalTableRenderer.database(input.database)}
            <h4>TRANSACTION CONDITIONS</h4><ol class="transaction-plan">${input.operations.slice(0, input.terminalAfter).map(operation => `<li>${escape(operation.label)}</li>`).join("")}<li>${escape(input.terminal === "failure" ? "FAIL before COMMIT" : input.terminal.toUpperCase())}</li></ol>
            ${actual ? `<div class="transaction-expert-result"><strong>MODEL RESULT: ${escape(actual.status)}</strong><p>${Object.entries(actual.committed).map(([id, value]) => `${escape(id)} = ${escape(value)}`).join(" · ")}</p></div>` : '<p class="relational-hidden-result">The final durable state remains hidden until Check prediction.</p>'}`;
        return wrapper;
    }
    return {
        mount() { config.controls.forEach(control => { const button = getControl(control.id); if (button) button.hidden = true; }); this.reset(); },
        reset() { reset(config.problem, "learn"); }, resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation) { perform(operation); },
        endMasteryMode() { reset(config.problem, "free-play"); }, renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) { container.appendChild(expertState(initialState, expertAssessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { return { title: "Protect the committed state", instruction: problem.instruction }; },
        getState() { return clone({ problem, snapshot: snapshot(), mode }); }
    };
}

registerPlayground("transactions", createTransactionPlayground);
