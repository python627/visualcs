/* Process visualization and learner input. ProcessModel owns all valid transitions. */
function createProcessPlayground() {
    const config = LESSON.playground;
    const clone = value => JSON.parse(JSON.stringify(value));
    const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    let problem, session, mode = "learn", feedback = "", lastPreview = null;

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function zonesMarkup(state) {
        return `<div class="process-zones">${ProcessModel.states.map(name => `<section class="process-zone process-${name.toLowerCase()}"><h3>${name}</h3><div class="process-zone-items">${state[name].length
            ? state[name].map(id => `<span class="process-card">${escape(id)}</span>`).join("") : `<span class="process-empty">empty</span>`}</div></section>`).join("")}</div>`;
    }
    function eventMarkup(event) {
        return event ? `<section class="process-event"><span>CURRENT EVENT</span><strong>${escape(ProcessModel.eventText(event))}</strong><p>Predict the state ${escape(event.process)} enters.</p></section>`
            : `<section class="process-event process-complete"><strong>✓ Event sequence complete</strong></section>`;
    }
    function choicesMarkup() {
        if (!session.getEvent() || mode === "expert-thinking" || mode === "mastery") return "";
        return `<div class="process-choices" aria-label="Choose the next process state">${ProcessModel.states.map(state => `<button type="button" data-process-state="${state}">${state}</button>`).join("")}</div>`;
    }
    function updateTask() {
        if (mode === "expert-thinking") return;
        const event = session.getEvent();
        if (!event) return;
        window.activeTask?.render({ label: mode === "mastery" ? "ACTIVE TASK · PROCESS STATES" : "YOUR TASK · PROCESS STATES",
            step: session.getIndex() + 1, total: session.getLength(), title: ProcessModel.eventText(event),
            instruction: `Where should ${event.process} move next?` });
    }
    function bind() {
        stackDiv.querySelectorAll("[data-process-state]").forEach(button => button.onclick = () => choose(button.dataset.processState));
        stackDiv.querySelector("[data-process-retry]")?.addEventListener("click", () => {
            session.reset(); mode = "free-play"; feedback = "Sequence reset. Predict the events again in free play."; lastPreview = null; render();
        });
    }
    function render() {
        const state = session.getState();
        stackDiv.className = "process-view";
        stackDiv.innerHTML = `${eventMarkup(session.getEvent())}${zonesMarkup(state)}${choicesMarkup()}
            ${lastPreview ? `<p class="process-consequence">${escape(lastPreview)}</p>` : ""}
            <p class="process-feedback" aria-live="polite">${escape(feedback)}</p>
            ${!session.getEvent() ? `<button type="button" data-process-retry>Replay events</button>` : ""}`;
        bind(); updateTask();
    }
    function choose(state) {
        if (!session.getEvent() || mode === "expert-thinking") return;
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        const event = session.getEvent();
        const result = session.predict(state);
        lastPreview = `${event.process}: ${result.transition.from} → ${result.transition.to}`;
        if (!result.accepted) {
            feedback = `You chose ${state}. ${ProcessModel.eventText(event)} can only move ${event.process} from ${result.transition.from} to ${result.expected}.`;
            route({ operation: "process-attempt", value: state, state: { outcome: "attempted" }, feedback, progress: true });
            render(); return;
        }
        feedback = result.complete ? "The model completed every valid transition." : `${ProcessModel.eventText(event)} moved ${event.process} into ${result.expected}.`;
        route({ operation: `predict-${result.expected.toLowerCase()}`, value: result.expected,
            state: { outcome: result.complete ? "solved" : "progress", snapshot: result.state }, feedback, progress: !result.complete });
        render();
    }
    function reset(input, nextMode) { problem = clone(input); session = ProcessModel.createSession(problem); mode = nextMode; feedback = ""; lastPreview = null; render(); }
    function expertPanel(input, assessment) {
        const wrapper = document.createElement("div"); wrapper.className = "process-expert-state";
        const initial = ProcessModel.initialSnapshot(input);
        const actual = assessment?.actualResult?.finalState;
        wrapper.innerHTML = `<section><span class="challenge-target-label">STARTING SNAPSHOT</span>${zonesMarkup(initial)}</section>
            ${actual ? `<section class="process-result"><span class="challenge-target-label">MODEL RESULT</span>${zonesMarkup(actual)}</section>`
                : `<p class="process-hidden-result">Final process locations remain hidden until Check prediction.</p>`}`;
        return wrapper;
    }
    return {
        mount() { getControl("predict-ready").hidden = true; this.reset(); },
        reset() { reset(config.problem, "learn"); },
        resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation) { if (operation.startsWith("predict-")) choose(operation.slice(8).toUpperCase()); },
        endMasteryMode() { reset(config.problem, "free-play"); },
        renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment }, container) { container.appendChild(expertPanel(initialState, assessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { const event = session.getEvent(); return event ? { title: ProcessModel.eventText(event), instruction: `Where should ${event.process} move next?` } : {}; },
        getState() { return { problem: clone(problem), snapshot: session.getState(), eventIndex: session.getIndex(), mode }; }
    };
}
registerPlayground("process-states", createProcessPlayground);
