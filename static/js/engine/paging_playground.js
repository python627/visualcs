/* Paging adapter: input/reveal state and visualization, never paging arithmetic. */
function createPagingPlayground() {
    const config = LESSON.playground;
    const fields = ["page", "offset", "frame", "physicalAddress"];
    let problem;
    let session;
    let mode = "learn";
    let feedback = "";
    let completed = false;

    const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const format = text => String(text).replace(/\{(\w+)\}/g, (_, key) => problem[key] ?? "");

    function publicProblem(input, answers = {}) {
        const panel = document.createElement("div");
        panel.className = "paging-diagram";
        const selectedPage = answers.page === undefined ? null : Number(answers.page);
        const revealLookup = answers.frame !== undefined;
        panel.innerHTML = `
            <div class="paging-problem"><strong>Logical address: ${input.logicalAddress}</strong>
                <span>Page size: ${input.pageSize} bytes</span>
                <span>Logical range: 0–${input.logicalAddressSpace - 1}</span></div>
            <span class="paging-arrow" aria-hidden="true">↓</span>
            <div class="paging-parts"><span>PAGE <strong>${escape(answers.page ?? "?")}</strong></span>
                <span>OFFSET <strong>${escape(answers.offset ?? "?")}</strong></span></div>
            <span class="paging-arrow" aria-hidden="true">↓</span>
            <div class="paging-table-wrap"><table class="paging-table"><caption>PAGE TABLE</caption>
                <thead><tr><th>Logical page</th><th>Physical frame</th><th>Present in RAM?</th></tr></thead>
                <tbody>${input.pageTable.map(row => `<tr ${revealLookup && row.page === selectedPage ? 'class="paging-selected"' : ""}>
                    <td>${row.page}</td><td>${row.present ? row.frame : "—"}</td><td>${row.present ? "Yes" : "NOT PRESENT"}</td></tr>`).join("")}</tbody>
            </table></div>
            <span class="paging-arrow" aria-hidden="true">↓</span>
            <div class="paging-parts"><span>FRAME <strong>${escape(answers.frame ?? "?")}</strong></span></div>
            <span class="paging-arrow" aria-hidden="true">↓</span>
            <div class="paging-parts"><span>PHYSICAL ADDRESS <strong>${escape(answers.physicalAddress ?? "?")}</strong></span></div>`;
        return panel;
    }

    function reset(input, nextMode) {
        problem = JSON.parse(JSON.stringify(input));
        session = PagingModel.createSession(problem);
        mode = nextMode;
        feedback = "";
        completed = false;
        render();
    }

    function updateActiveTask() {
        if (!session.field || mode === "expert-thinking") return;
        if (mode === "learn" && teachingEngine.quizShown) return;
        const task = config.tasks[session.field];
        window.activeTask?.render({ label: "YOUR TASK · ADDRESS TRANSLATION",
            step: fields.indexOf(session.field) + 1, total: fields.length,
            title: task.title, instruction: format(task.instruction) });
    }

    function render() {
        stackDiv.className = "paging-view";
        stackDiv.replaceChildren(publicProblem(problem, session.answers));
        if (mode === "expert-thinking") return;
        const status = document.createElement("p");
        status.className = "paging-feedback";
        status.setAttribute("aria-live", "polite");
        status.textContent = feedback;
        stackDiv.appendChild(status);
        if (!completed) {
            const task = config.tasks[session.field];
            const form = document.createElement("form");
            form.className = "paging-answer";
            form.innerHTML = `<label>${escape(task.title)}<input name="answer" data-paging-answer autocomplete="off"
                placeholder="${escape(task.placeholder)}" aria-label="${escape(task.title)}"></label>
                <button type="submit" data-paging-check>${escape(config.check_label)}</button>`;
            form.onsubmit = event => { event.preventDefault(); submit(session.field, new FormData(form).get("answer")); };
            stackDiv.appendChild(form);
        } else {
            const newProblem = document.createElement("button");
            newProblem.type = "button";
            newProblem.textContent = "Try another translation";
            newProblem.dataset.pagingFreePlay = "";
            newProblem.onclick = () => reset(ScenarioFactory.createNew(config.free_play).data.problem, "free-play");
            stackDiv.appendChild(newProblem);
        }
        updateActiveTask();
    }

    function submit(field, value) {
        if (mode === "expert-thinking" || completed) return;
        if (mode === "learn" || mode === "challenge") teachingEngine.interactionStarted();
        const result = session.submit(field, value);
        if (!result.accepted) {
            feedback = result.reason === "out_of_order" ? config.order_message : format(config.tasks[field].retry);
            // Unavailable/incorrect attempts never fabricate a completed model state.
            if (mode === "mastery") masteryEngine.operationCompleted({ operation: "incorrect", state: { outcome: null }, feedback });
            render();
            return;
        }
        completed = result.outcome === "solved";
        feedback = completed ? PagingModel.explain(problem) : config.tasks[field].accepted.replace("{answer}", String(value));
        const event = { operation: field, value, state: { outcome: result.outcome, answers: session.answers }, feedback, progress: !completed };
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play") teachingEngine.operationCompleted(event);
        render();
    }

    return {
        mount() {
            const button = getControl("check-answer");
            button.hidden = true; // The labelled form is the operation control.
            this.reset();
        },
        reset() { reset(config.problem, "learn"); },
        resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) { reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery"); },
        performMasteryOperation(operation, options = {}) { submit(operation, options.value); },
        endMasteryMode() { reset(config.problem, "free-play"); },
        renderChallengeTarget() {},
        renderMasteryStates({ scenario }, container) { container.appendChild(publicProblem(scenario.problem)); },
        renderExpertThinkingState({ initialState }, container) { container.appendChild(publicProblem(initialState)); },
        getActiveTask() {
            if (!session.field || mode === "expert-thinking") return {};
            const task = config.tasks[session.field];
            return { title: task.title, instruction: format(task.instruction) };
        },
        getState() { return { problem: JSON.parse(JSON.stringify(problem)), answers: session.answers, field: session.field, completed }; }
    };
}
registerPlayground("paging-translation", createPagingPlayground);
