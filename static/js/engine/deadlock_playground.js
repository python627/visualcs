/* Deadlock relationship rendering and prediction input. DeadlockModel owns grant/cycle truth. */
function createDeadlockPlayground() {
    const config = LESSON.playground;
    const clone = value => JSON.parse(JSON.stringify(value));
    const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const choices = [
        ["GRANTED", "GRANTED"], ["BLOCKED", "BLOCKED BUT RECOVERABLE"],
        ["DEADLOCKED", "DEADLOCKED"], ["RELEASED", "RELEASED / PROGRESS RESUMES"]
    ];
    let problem, session, mode = "learn", feedback = "", lastConsequence = null;
    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function graphMarkup(state) {
        const allocations = Object.entries(state.allocations).sort().map(([resource, process]) => `<span class="deadlock-edge allocation"><b>${escape(resource)}</b><i>→ holds →</i><b>${escape(process)}</b></span>`).join("");
        const requests = state.requests.map(item => `<span class="deadlock-edge request"><b>${escape(item.process)}</b><i>→ requests →</i><b>${escape(item.resource)}</b></span>`).join("");
        return `<div class="deadlock-graph"><div class="deadlock-node-row process-row">${state.processes.map(id => `<span class="deadlock-node process-node">${escape(id)}<small>PROCESS</small></span>`).join("")}</div>
            <div class="deadlock-relationships"><section><h3>ALLOCATION · RESOURCE → PROCESS</h3>${allocations || "none"}</section><section><h3>REQUEST · PROCESS → RESOURCE</h3>${requests || "none"}</section></div>
            <div class="deadlock-node-row resource-row">${state.resources.map(id => `<span class="deadlock-node resource-node">${escape(id)}<small>ONE INSTANCE</small></span>`).join("")}</div>
            <div class="deadlock-status ${state.classification}"><strong>${state.classification.toUpperCase()}</strong><span>Blocked: ${state.blockedProcesses.join(", ") || "none"}</span></div></div>`;
    }
    function render() {
        const state = session.getState(), event = session.getEvent();
        stackDiv.className = "deadlock-view";
        stackDiv.innerHTML = `<p class="deadlock-assumption">MODEL ASSUMPTION: each resource has exactly one instance.</p>
            ${event ? `<section class="deadlock-event"><span>CURRENT EVENT</span><strong>${escape(DeadlockModel.eventText(event))}</strong><p>Predict the consequence under the displayed allocation.</p></section>` : `<section class="deadlock-event deadlock-complete"><strong>✓ Resource-event sequence complete</strong></section>`}
            ${graphMarkup(state)}
            ${event && mode !== "expert-thinking" && mode !== "mastery" ? `<div class="deadlock-choices">${choices.map(([value, label]) => `<button type="button" data-deadlock-choice="${value}">${label}</button>`).join("")}</div>` : ""}
            ${lastConsequence ? `<p class="deadlock-consequence">${escape(lastConsequence)}</p>` : ""}<p class="deadlock-feedback" aria-live="polite">${escape(feedback)}</p>
            ${!event ? `<button type="button" data-deadlock-retry>Replay resource events</button>` : ""}`;
        stackDiv.querySelectorAll("[data-deadlock-choice]").forEach(button => button.onclick = () => choose(button.dataset.deadlockChoice));
        stackDiv.querySelector("[data-deadlock-retry]")?.addEventListener("click", () => {
            session.reset(); mode = "free-play"; feedback = "Resource sequence reset. Predict it again in free play."; lastConsequence = null; render();
        });
        updateTask();
    }
    function updateTask() {
        if (mode === "expert-thinking") return;
        const event = session.getEvent(); if (!event) return;
        window.activeTask?.render({ label: mode === "mastery" ? "ACTIVE TASK · RESOURCE MODEL" : "YOUR TASK · RESOURCE MODEL",
            step: session.getIndex() + 1, total: session.getLength(), title: DeadlockModel.eventText(event),
            instruction: "Will it be granted, blocked, or create a deadlock?" });
    }
    function choose(choice) {
        if (!session.getEvent() || mode === "expert-thinking") return;
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        const event = session.getEvent(); const result = session.predict(choice);
        lastConsequence = `${DeadlockModel.eventText(event)} → ${result.expected}`;
        if (!result.accepted) {
            feedback = `You chose ${choice}. The one-instance allocation model produces ${result.expected}.`;
            route({ operation: "deadlock-attempt", value: choice, state: { outcome: "attempted" }, feedback, progress: true }); render(); return;
        }
        feedback = result.expected === "DEADLOCKED"
            ? "The new request closes a circular wait. With one instance of each resource, none of the processes in that cycle can progress."
            : result.expected === "BLOCKED" ? "The resource is held, so the process blocks; no circular wait exists yet."
            : result.expected === "GRANTED" ? "The resource was free, so the request is granted immediately."
            : "The resource was released and any waiting request can now progress.";
        route({ operation: `predict-${result.expected.toLowerCase()}`, value: result.expected,
            state: { outcome: result.complete ? "solved" : "progress", snapshot: result.state }, feedback, progress: !result.complete }); render();
    }
    function reset(input, nextMode) { problem = clone(input); session = DeadlockModel.createSession(problem); mode = nextMode; feedback = ""; lastConsequence = null; render(); }
    function expertPanel(input, assessment) {
        const wrapper = document.createElement("div"); wrapper.className = "deadlock-expert-state";
        const initial = DeadlockModel.snapshot(DeadlockModel.baseState(input));
        const actual = assessment?.actualResult?.finalState;
        wrapper.innerHTML = `<section><span class="challenge-target-label">STARTING ALLOCATION</span>${graphMarkup(initial)}</section>
            ${actual ? `<section class="deadlock-result"><span class="challenge-target-label">MODEL RESULT</span>${graphMarkup(actual)}</section>`
                : `<p class="deadlock-hidden-result">Blocked processes, cycle, and final classification remain hidden until Check prediction.</p>`}`;
        return wrapper;
    }
    return {
        mount() { getControl("predict-blocked").hidden = true; this.reset(); },
        reset() { reset(config.problem, "learn"); }, resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation) { if (operation.startsWith("predict-")) choose(operation.slice(8).toUpperCase()); },
        endMasteryMode() { reset(config.problem, "free-play"); }, renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment }, container) { container.appendChild(expertPanel(initialState, assessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { const event = session.getEvent(); return event ? { title: DeadlockModel.eventText(event), instruction: "Predict the resource-allocation consequence." } : {}; },
        getState() { return { problem: clone(problem), snapshot: session.getState(), eventIndex: session.getIndex(), mode }; }
    };
}
registerPlayground("deadlock-graph", createDeadlockPlayground);
