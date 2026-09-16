/* DNS prediction and event trace. DnsModel owns cache and resolution truth. */
function createDnsPlayground() {
    const config = LESSON.playground;
    const clone = value => JSON.parse(JSON.stringify(value));
    const escape = NetworkLessonRenderer.escape;
    let problems = [], problem, problemIndex = 0, mode = "learn", response = {}, assessment = null, replay = null, events = [], phase = "predict", feedback = "", awaitingNext = false;

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }
    function readResponse() {
        stackDiv.querySelectorAll("[data-dns-field]").forEach(input => response[input.dataset.dnsField] = input.value);
        return clone(response);
    }
    function recordsMarkup(records) {
        return `<div class="dns-records"><h3>DNS RECORDS</h3><table><thead><tr><th>Domain</th><th>IP address</th><th>Server</th></tr></thead><tbody>${records.map(record => `<tr><td>${escape(record.domain)}</td><td>${escape(record.ip)}</td><td>${escape(record.serverId)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    function cacheMarkup(cache) {
        const entries = Object.entries(cache || {});
        return `<div class="dns-cache"><h3>CLIENT CACHE</h3>${entries.length ? entries.map(([domain, ip]) => `<p><strong>${escape(domain)}</strong><code>${escape(ip)}</code></p>`).join("") : "<p>empty</p>"}</div>`;
    }
    function predictionMarkup() {
        return `<form class="network-prediction dns-prediction" data-dns-form>
            <label>Cache result<select data-dns-field="cacheResult"><option value="">Choose</option><option value="hit">Cache hit</option><option value="miss">Cache miss</option></select></label>
            <label>Resolved IP<input data-dns-field="resolvedIp" placeholder="IPv4 or NOT_FOUND"></label>
            <label>Destination server<input data-dns-field="destinationServerId" placeholder="server-1 or NONE"></label>
            <label class="wide">Resolution sequence<input data-dns-field="sequence" placeholder="CHECK_CACHE, CACHE_MISS, DNS_QUERY, ..."></label>
            <p class="wide">Available steps: CHECK_CACHE · CACHE_HIT · CACHE_MISS · DNS_QUERY · DNS_RESPONSE · CACHE_UPDATE · RESOLVED · NOT_FOUND</p>
            <button type="submit">${escape(config.check_label)}</button></form>`;
    }
    function updateTask() {
        if (mode === "expert-thinking") return;
        window.activeTask?.render({ label: mode === "mastery" ? "ACTIVE TASK · DNS" : "YOUR TASK · DNS",
            step: mode === "learn" ? problemIndex + 1 : null, total: mode === "learn" ? problems.length : null,
            title: phase === "predict" ? "Predict the DNS resolution" : phase === "replay" ? "Trace the lookup" : "Review the resolved endpoint",
            instruction: `Resolve ${problem.query.domain}. DNS only maps the name to an address.` });
    }
    function render() {
        const actual = assessment?.actualResult;
        const visibleCache = phase === "complete" && actual ? actual.cacheAfter : problem.cache;
        stackDiv.className = "network-exercise dns-view";
        stackDiv.innerHTML = `<section class="network-task"><span>DNS ANSWERS: WHAT IP MATCHES THIS NAME?</span><h3>${escape(problem.query.domain)}</h3></section>
            <div class="dns-source-grid">${cacheMarkup(visibleCache)}${recordsMarkup(problem.records)}</div>
            ${NetworkLessonRenderer.flow([{ label: "CLIENT" }, { label: "DNS", detail: problem.query.domain }, { label: "DESTINATION SERVER" }], phase === "complete" ? 2 : phase === "replay" ? 1 : 0)}
            ${phase === "predict" && mode !== "expert-thinking" ? predictionMarkup() : ""}
            ${events.length ? `<section class="network-trace"><h3>RESOLUTION TRACE</h3>${NetworkLessonRenderer.timeline(events.map(event => ({ label: event.replaceAll("_", " ") })))}</section>` : ""}
            ${phase === "replay" ? `<button type="button" data-dns-next>${escape(config.next_step_label)}</button>` : ""}
            ${phase === "complete" && actual ? `<section class="network-result"><h3>MODEL RESULT</h3><p><strong>${escape(actual.resolvedIp)}</strong> · ${escape(actual.destinationServerId)}</p><p>${escape(actual.explanation)}</p>${NetworkLessonRenderer.fields(assessment)}</section>` : ""}
            <p class="network-feedback" aria-live="polite">${escape(feedback)}</p>${awaitingNext ? '<button type="button" data-dns-continue>Continue to the next lookup</button>' : ""}`;
        stackDiv.querySelector("[data-dns-form]")?.addEventListener("submit", event => { event.preventDefault(); startReplay(); });
        stackDiv.querySelector("[data-dns-next]")?.addEventListener("click", nextEvent);
        stackDiv.querySelector("[data-dns-continue]")?.addEventListener("click", nextProblem);
        updateTask();
    }
    function startReplay() {
        if (mode === "expert-thinking") return;
        const answer = readResponse();
        if (["cacheResult", "resolvedIp", "destinationServerId", "sequence"].some(field => !String(answer[field] || "").trim())) {
            feedback = "Complete every prediction before tracing the lookup."; render(); return;
        }
        if (["learn", "challenge"].includes(mode)) teachingEngine.interactionStarted();
        assessment = DnsModel.assess(problem, answer); replay = DnsModel.createReplay(problem); events = []; phase = "replay";
        feedback = "Prediction locked. Reveal the DNS steps in order."; render();
    }
    function nextEvent() {
        if (phase !== "replay" || !replay) {
            feedback = "Lock your complete prediction before revealing DNS events.";
            render();
            return;
        }
        const step = replay.next(); if (step.event) events.push(step.event);
        if (step.done) {
            phase = "complete"; feedback = assessment.feedback;
            route({ operation: assessment.allCorrect ? "resolve-dns" : "dns-attempt", value: clone(response),
                state: { outcome: assessment.allCorrect ? "solved" : "attempted", result: assessment.actualResult }, feedback, progress: !assessment.allCorrect });
            if (assessment.allCorrect && mode === "learn" && problemIndex < problems.length - 1) awaitingNext = true;
        }
        render();
    }
    function nextProblem() { problemIndex++; problem = clone(problems[problemIndex]); response = {}; assessment = replay = null; events = []; phase = "predict"; feedback = ""; awaitingNext = false; render(); }
    function reset(input, nextMode) {
        mode = nextMode; problems = Array.isArray(input) ? clone(input) : [clone(input)]; problemIndex = 0; problem = problems[0];
        DnsModel.validateProblem(problem); response = {}; assessment = replay = null; events = []; phase = "predict"; feedback = ""; awaitingNext = false; render();
    }
    function expertState(input, expertAssessment) {
        const wrapper = document.createElement("div"); wrapper.className = "network-expert-state";
        const actual = expertAssessment?.actualResult;
        wrapper.innerHTML = `<section class="network-task"><span>EXPERT DNS</span><h3>${escape(input.query.domain)}</h3></section><div class="dns-source-grid">${cacheMarkup(input.cache)}${recordsMarkup(input.records)}</div>
            ${actual ? `<section class="network-result"><h3>MODEL RESULT</h3><p>${escape(actual.resolvedIp)} · ${escape(actual.destinationServerId)}</p>${NetworkLessonRenderer.timeline(actual.sequence.map(label => ({ label })))}</section>` : '<p class="network-hidden-result">Cache result, resolved IP, server, and lookup sequence remain hidden until Check prediction.</p>'}`;
        return wrapper;
    }
    return {
        mount() { getControl("run-dns").hidden = true; this.reset(); },
        reset() { reset(config.problems, "learn"); }, resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation) {
            if (operation === "run-dns" && phase === "predict") startReplay();
            else if (operation === "next-dns-step") nextEvent();
            else if (operation === "run-dns") { feedback = "Your prediction is locked. Reveal the queued DNS events in order."; render(); }
        },
        endMasteryMode() { reset(config.problems, "free-play"); }, renderChallengeTarget() {}, renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) { container.appendChild(expertState(initialState, expertAssessment)); },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { return { title: "Resolve the domain", instruction: `Predict how ${problem.query.domain} resolves.` }; },
        getState() { return clone({ problem, response, phase, events, assessment }); }
    };
}
registerPlayground("dns-lookup", createDnsPlayground);
