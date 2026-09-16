/* HTTP request builder and response visualization. HttpModel owns server behavior. */
function createHttpPlayground() {
    const config = LESSON.playground;
    const clone = value => JSON.parse(JSON.stringify(value));
    const escape = NetworkLessonRenderer.escape;
    let problems = [], problem, problemIndex = 0, mode = "learn", assessment = null, feedback = "", awaitingNext = false;

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function formMarkup() {
        return `<form class="network-prediction http-builder" data-http-form>
            <label>Method<select data-http-method><option value="">Choose</option>${HttpModel.methods.map(method => `<option value="${method}">${method}</option>`).join("")}</select></label>
            <label>Path<input data-http-path placeholder="/about"></label>
            <label>Optional request body<input data-http-body placeholder="Only needed for some POST routes"></label>
            <label>Predicted status<select data-http-status><option value="">Choose</option>${[200, 201, 400, 404, 405, 500].map(status => `<option value="${status}">${status}</option>`).join("")}</select></label>
            <button type="submit">${escape(config.send_label)}</button></form>`;
    }
    function readResponse() { return { method: stackDiv.querySelector("[data-http-method]")?.value || "", path: stackDiv.querySelector("[data-http-path]")?.value || "",
        body: stackDiv.querySelector("[data-http-body]")?.value || "", status: stackDiv.querySelector("[data-http-status]")?.value || "" }; }
    function routesMarkup() {
        return `<section class="http-routes"><h3>SERVER ROUTES</h3><p>Routes describe real server behavior; unlisted paths produce 404.</p><div>${problem.server.routes.map(route => `<span><strong>${escape(route.method)} ${escape(route.path)}</strong><small>${route.failure ? "may fail with 500" : `resource handler`}</small></span>`).join("")}</div></section>`;
    }
    function updateTask() {
        if (mode === "expert-thinking") return;
        window.activeTask?.render({ label: mode === "mastery" ? "ACTIVE TASK · HTTP" : "YOUR TASK · HTTP",
            step: mode === "learn" ? problemIndex + 1 : null, total: mode === "learn" ? problems.length : null,
            title: "Build and predict the request", instruction: problem.goal.instruction });
    }
    function render() {
        const actual = assessment?.actualResult;
        const flow = [{ label: problem.client.name, detail: "CLIENT" }, { label: actual ? `${actual.request.method} ${actual.request.path}` : "HTTP REQUEST" },
            { label: problem.server.name, detail: "SERVER" }, { label: actual ? `${actual.response.status} ${actual.response.label}` : "HTTP RESPONSE" }, { label: problem.client.name, detail: "CLIENT" }];
        stackDiv.className = "network-exercise http-view";
        stackDiv.innerHTML = `<section class="network-task"><span>HTTP ANSWERS: WHAT REQUEST AND RESPONSE OCCUR?</span><h3>${escape(problem.goal.instruction)}</h3></section>
            ${routesMarkup()}${NetworkLessonRenderer.flow(flow, actual ? 3 : 0)}
            ${mode === "expert-thinking" ? '<p class="network-hidden-result">The response status and body remain hidden until Check prediction.</p>' : formMarkup()}
            ${actual ? `<section class="network-result"><h3>MODEL-GENERATED RESPONSE</h3><p><strong>${actual.response.status} ${escape(actual.response.label)}</strong></p><pre>${escape(actual.response.body)}</pre><p>${escape(assessment.feedback)}</p>${NetworkLessonRenderer.fields(assessment)}</section>` : ""}
            <p class="network-feedback" aria-live="polite">${escape(feedback)}</p>${awaitingNext ? '<button type="button" data-http-next>Continue to the next request</button>' : ""}`;
        stackDiv.querySelector("[data-http-form]")?.addEventListener("submit", event => { event.preventDefault(); submit(readResponse()); });
        stackDiv.querySelector("[data-http-next]")?.addEventListener("click", nextProblem); updateTask();
    }
    function submit(answer) {
        if (mode === "expert-thinking" || awaitingNext) return;
        if (["learn", "challenge"].includes(mode)) teachingEngine.interactionStarted();
        assessment = HttpModel.assess(problem, answer); feedback = assessment.feedback;
        const solved = assessment.allCorrect;
        route({ operation: solved ? "send-request" : "http-attempt", value: clone(answer),
            state: { outcome: solved ? "solved" : "attempted", result: assessment.actualResult }, feedback, progress: !solved });
        if (solved && mode === "learn" && problemIndex < problems.length - 1) awaitingNext = true;
        render();
    }
    function nextProblem() { problemIndex++; problem = clone(problems[problemIndex]); assessment = null; feedback = ""; awaitingNext = false; render(); }
    function reset(input, nextMode) {
        mode = nextMode; problems = Array.isArray(input) ? clone(input) : [clone(input)]; problemIndex = 0; problem = problems[0];
        HttpModel.validateProblem(problem); assessment = null; feedback = ""; awaitingNext = false; render();
    }
    function expertState(input, expertAssessment) {
        const wrapper = document.createElement("div"); wrapper.className = "network-expert-state";
        const actual = expertAssessment?.actualResult;
        wrapper.innerHTML = `<section class="network-task"><span>EXPERT HTTP</span><h3>${escape(input.goal.instruction)}</h3></section>
            <section class="http-routes"><h3>SERVER ROUTES</h3><div>${input.server.routes.map(route => `<span><strong>${escape(route.method)} ${escape(route.path)}</strong></span>`).join("")}</div></section>
            ${actual ? `<section class="network-result"><h3>MODEL RESPONSE</h3><p>${actual.response.status} ${escape(actual.response.label)}</p><pre>${escape(actual.response.body)}</pre></section>` : '<p class="network-hidden-result">The evaluated response remains hidden until Check prediction.</p>'}`;
        return wrapper;
    }
    return {
        mount() { getControl("send-http").hidden = true; this.reset(); },
        reset() { reset(config.problems, "learn"); }, resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation, options = {}) { if (operation === "send-request") submit(options.value || readResponse()); },
        endMasteryMode() { reset(config.problems, "free-play"); }, renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) { container.appendChild(expertState(initialState, expertAssessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { return { title: "Build and predict the request", instruction: problem.goal.instruction }; },
        getState() { return clone({ problem, mode, assessment }); }
    };
}
registerPlayground("http-request", createHttpPlayground);
