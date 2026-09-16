/* IPv4 lesson adapter. Structural and routing truth lives in IPv4Address. */
function createIpPlayground() {
    const config = LESSON.playground;
    const clone = value => JSON.parse(JSON.stringify(value));
    const escape = NetworkLessonRenderer.escape;
    let problems = [], problem = null, problemIndex = 0, mode = "learn", assessment = null, feedback = "", awaitingNext = false;

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function taskTitle(task) {
        return ({ "validate-address": "Validate the address", "construct-address": "Construct the address", "identify-endpoints": "Identify source and destination", "route-packet": "Choose the destination device" })[task.kind];
    }
    function formMarkup() {
        const task = problem.task;
        if (task.kind === "validate-address") return `<label>Is ${escape(task.candidate)} valid?<select data-ip-validity><option value="">Choose</option><option value="valid">Valid IPv4</option><option value="invalid">Invalid IPv4</option></select></label>`;
        if (task.kind === "construct-address") return `<div class="ip-octets">${task.octets.map(value => `<span>${value}</span>`).join('<b>.</b>')}</div><label>Constructed IPv4 address<input data-ip-address placeholder="192.168.1.10"></label>`;
        if (task.kind === "identify-endpoints") return `<label>Source address<input data-ip-source placeholder="Source IPv4"></label><label>Destination address<input data-ip-destination placeholder="Destination IPv4"></label>`;
        return `<label>Destination device<select data-ip-device><option value="">Choose device</option>${problem.devices.map(device => `<option value="${escape(device.id)}">${escape(device.name)} · ${escape(device.address)}</option>`).join("")}</select></label>`;
    }
    function response() {
        const value = selector => stackDiv.querySelector(selector)?.value || "";
        return { validity: value("[data-ip-validity]"), address: value("[data-ip-address]"), sourceAddress: value("[data-ip-source]"),
            destinationAddress: value("[data-ip-destination]"), destinationDeviceId: value("[data-ip-device]") };
    }
    function resultMarkup() {
        if (!assessment) return "";
        const actual = assessment.actualResult;
        const highlight = actual.destinationDeviceId && actual.destinationDeviceId !== "NONE" ? actual.destinationDeviceId : null;
        return `<section class="network-result"><h3>MODEL CONSEQUENCE</h3>${highlight ? NetworkLessonRenderer.devices(problem.devices, { highlightedId: highlight }) : ""}
            <p>${escape(assessment.feedback)}</p>${NetworkLessonRenderer.fields(assessment)}</section>`;
    }
    function updateTask() {
        if (mode === "expert-thinking") return;
        window.activeTask?.render({ label: mode === "mastery" ? "ACTIVE TASK · IPV4" : "YOUR TASK · IPV4",
            step: mode === "learn" ? problemIndex + 1 : null, total: mode === "learn" ? problems.length : null,
            title: taskTitle(problem.task), instruction: problem.task.prompt });
    }
    function render() {
        stackDiv.className = "network-exercise ip-view";
        const packet = problem.packet ? `<section class="network-message"><span>PACKET</span><strong>Source device: ${escape(problem.packet.sourceDeviceId)}</strong><code>Destination: ${escape(problem.packet.destinationAddress)}</code></section>` : "";
        stackDiv.innerHTML = `<section class="network-task"><span>IP ANSWERS: WHERE IS THE ENDPOINT?</span><h3>${escape(problem.task.prompt)}</h3></section>
            ${NetworkLessonRenderer.devices(problem.devices)}${packet}
            ${problem.task.kind === "validate-address" ? `<p class="ip-candidate">${escape(problem.task.candidate)}</p>` : ""}
            ${mode === "expert-thinking" ? '<p class="network-hidden-result">The matching endpoint remains hidden until Check prediction.</p>' : `<form class="network-prediction" data-ip-form>${formMarkup()}<button type="submit">${escape(config.check_label)}</button></form>`}
            ${resultMarkup()}<p class="network-feedback" aria-live="polite">${escape(feedback)}</p>
            ${awaitingNext ? '<button type="button" data-ip-next>Continue to the next address task</button>' : ""}`;
        stackDiv.querySelector("[data-ip-form]")?.addEventListener("submit", event => { event.preventDefault(); submit(response()); });
        stackDiv.querySelector("[data-ip-next]")?.addEventListener("click", nextProblem);
        updateTask();
    }
    function submit(answer) {
        if (mode === "expert-thinking" || awaitingNext) return;
        if (["learn", "challenge"].includes(mode)) teachingEngine.interactionStarted();
        assessment = IPv4Address.assess(problem, answer);
        feedback = assessment.feedback;
        const solved = assessment.allCorrect;
        route({ operation: solved ? problem.task.kind : "ip-attempt", value: clone(answer),
            state: { outcome: solved ? "solved" : "attempted", result: assessment.actualResult }, feedback, progress: !solved });
        if (solved && mode === "learn" && problemIndex < problems.length - 1) awaitingNext = true;
        render();
    }
    function nextProblem() { problemIndex++; problem = clone(problems[problemIndex]); assessment = null; feedback = ""; awaitingNext = false; render(); }
    function reset(input, nextMode) {
        mode = nextMode; problemIndex = 0; assessment = null; feedback = ""; awaitingNext = false;
        problems = Array.isArray(input) ? clone(input) : [clone(input)]; problem = problems[0]; IPv4Address.validateProblem(problem); render();
    }
    function expertState(input, expertAssessment) {
        const wrapper = document.createElement("div"); wrapper.className = "network-expert-state";
        const actual = expertAssessment?.actualResult;
        wrapper.innerHTML = `<section class="network-task"><span>EXPERT IPV4</span><h3>${escape(input.task.prompt)}</h3></section>${NetworkLessonRenderer.devices(input.devices)}
            ${input.packet ? `<section class="network-message"><strong>Source: ${escape(input.packet.sourceDeviceId)}</strong><code>Destination: ${escape(input.packet.destinationAddress)}</code></section>` : ""}
            ${actual ? `<section class="network-result"><h3>MODEL CONSEQUENCE</h3><p>${escape(expertAssessment.feedback)}</p></section>` : '<p class="network-hidden-result">The destination device remains hidden until Check prediction.</p>'}`;
        return wrapper;
    }
    return {
        mount() { getControl("check-ip").hidden = true; this.reset(); },
        reset() { reset(config.problems, "learn"); }, resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation, options = {}) { if (operation === "check-ip") submit(options.value || response()); },
        endMasteryMode() { reset(config.problems, "free-play"); }, renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) { container.appendChild(expertState(initialState, expertAssessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { return { title: taskTitle(problem.task), instruction: problem.task.prompt }; },
        getState() { return clone({ problem, problemIndex, mode, assessment }); }
    };
}
registerPlayground("ip-addresses", createIpPlayground);
