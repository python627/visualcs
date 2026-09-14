/* TCP/UDP visualization and learner input. Protocol truth lives in TransportSimulator. */
function createTransportPlayground() {
    const config = LESSON.playground;
    const clone = value => JSON.parse(JSON.stringify(value));
    const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    let problem;
    let mode = "learn";
    let selectedProtocol = "";
    let response = {};
    let replay = null;
    let replayState = null;
    let revealedEvents = [];
    let assessment = null;
    let feedback = "";
    let phase = "predict";
    let reported = new Set();

    function reset(input, nextMode) {
        problem = clone(input);
        TransportSimulator.validateProblem(problem);
        mode = nextMode;
        selectedProtocol = problem.knownProtocol || "";
        response = {};
        replay = null;
        replayState = null;
        revealedEvents = [];
        assessment = null;
        feedback = "";
        phase = "predict";
        reported = new Set();
        render();
    }

    function route(event) {
        if (mode === "mastery") masteryEngine.operationCompleted(event);
        else if (mode !== "free-play" && mode !== "expert-thinking") teachingEngine.operationCompleted(event);
    }

    function reportDecision(operation, event = {}) {
        if (!['learn', 'challenge'].includes(mode) || reported.has(operation)) return;
        reported.add(operation);
        teachingEngine.interactionStarted();
        route({ operation, state: { outcome: null }, progress: true, ...event });
    }

    function packetChips(items, status = {}) {
        if (!items.length) return '<span class="transport-empty">none</span>';
        return items.map(item => {
            const id = typeof item === "string" ? item : item.id;
            const label = typeof item === "string" ? item : `${item.id} · ${item.payload}`;
            return `<span class="transport-packet transport-${escape(status[id] || "waiting")}">${escape(label)}</span>`;
        }).join("");
    }

    function eventLabel(event) {
        const labels = {
            SEND: "SEND", DROP: "LOST", ARRIVE: "ARRIVE", BUFFER: "BUFFER",
            DELIVER_TO_APP: "APP DELIVERY", ACK_SEND: "ACK SENT", ACK_ARRIVE: "ACK RECEIVED",
            TIMEOUT: "TIMEOUT", RETRANSMIT: "RETRANSMIT"
        };
        return `${labels[event.type] || event.type}${event.packetId ? ` · ${event.packetId}` : ""}`;
    }

    function problemHeader(input, protocol = "") {
        return `<section class="transport-goal">
            <div><span>APPLICATION NEED</span><h3>${escape(input.application.title)}</h3><p>${escape(input.application.need)}</p></div>
            <div class="transport-requirements">
                <span>Ordered application delivery: <strong>${input.requirements.orderedDelivery ? "required" : "not required"}</strong></span>
                <span>Transport loss repair: <strong>${input.requirements.lossRepair ? "required" : "not required"}</strong></span>
                ${input.knownProtocol ? `<span>Protocol for this problem: <strong>${escape(input.knownProtocol)}</strong></span>` : protocol ? `<span>Your protocol: <strong>${escape(protocol)}</strong></span>` : ""}
            </div>
        </section>`;
    }

    function networkConditions(input) {
        return `<section class="transport-conditions"><h3>KNOWN NETWORK CONDITIONS</h3>
            <p>These conditions describe each packet's first transmission.</p>
            <div class="transport-condition-grid">${input.network.conditions.map(condition => {
                const packet = input.packets.find(item => item.sequence === condition.sequence);
                return `<div><strong>${escape(packet.id)}</strong><span>${condition.firstTransmission === "loss"
                    ? `lost after ${condition.delay} tick${condition.delay === 1 ? "" : "s"}`
                    : `arrives after ${condition.delay} tick${condition.delay === 1 ? "" : "s"}`}</span></div>`;
            }).join("")}</div>
            ${protocolForProblem(input) === "TCP" ? `<p class="transport-clock">Timeout: ${input.network.timeout} ticks · ACK delay: ${input.network.ackDelay} tick${input.network.ackDelay === 1 ? "" : "s"}</p>` : ""}
        </section>`;
    }

    function protocolForProblem(input = problem) {
        return input.knownProtocol || selectedProtocol || "";
    }

    function flowMarkup(input, state = null) {
        const statuses = state?.packetStatus || {};
        const networkPackets = input.packets.filter(packet => !["waiting", "delivered"].includes(statuses[packet.id] || "waiting"));
        const receiver = state?.receiverPackets || [];
        const buffered = state?.bufferedPackets || [];
        const application = state?.applicationOrder || [];
        return `<section class="transport-flow" aria-label="Transport sequence flow">
            <div class="transport-zone"><h3>SENDER</h3><div class="transport-packets">${packetChips(input.packets, statuses)}</div></div>
            <span class="transport-arrow" aria-hidden="true">→</span>
            <div class="transport-zone"><h3>NETWORK</h3><div class="transport-packets">${packetChips(networkPackets, statuses)}</div></div>
            <span class="transport-arrow" aria-hidden="true">→</span>
            <div class="transport-zone"><h3>RECEIVER</h3><div class="transport-packets">${packetChips(receiver, statuses)}</div>
                ${buffered.length ? `<small>Buffered: ${escape(buffered.join(", "))}</small>` : ""}</div>
            <span class="transport-arrow" aria-hidden="true">→</span>
            <div class="transport-zone"><h3>APPLICATION</h3><div class="transport-packets">${packetChips(application, statuses)}</div></div>
        </section>`;
    }

    function predictionMarkup() {
        const disabled = selectedProtocol ? "" : "disabled";
        return `<section class="transport-prediction">
            <h3>YOUR PREDICTION</h3>
            ${problem.knownProtocol ? "" : `<fieldset class="transport-protocol-choice"><legend>Choose the protocol that fits the application need</legend>
                ${TransportSimulator.protocols.map(protocol => `<button type="button" data-transport-protocol="${protocol}"
                    class="${selectedProtocol === protocol ? "selected" : ""}">${protocol}</button>`).join("")}</fieldset>`}
            <div class="transport-prediction-grid">
                <label>Transport arrival order<input data-transport-field="receiverPackets" ${disabled}
                    value="${escape(response.receiverPackets || "")}" placeholder="P1, P3 or NONE"></label>
                <label>Application delivery order<input data-transport-field="applicationOrder" ${disabled}
                    value="${escape(response.applicationOrder || "")}" placeholder="P1, P3 or NONE"></label>
                <label>Packets retransmitted<input data-transport-field="retransmittedPackets" ${disabled}
                    value="${escape(response.retransmittedPackets || "")}" placeholder="P2 or NONE"></label>
                <label>Does transport repair the loss?<select data-transport-field="repairsLoss" ${disabled}>
                    <option value="">Choose</option><option value="yes" ${response.repairsLoss === "yes" ? "selected" : ""}>Yes</option>
                    <option value="no" ${response.repairsLoss === "no" ? "selected" : ""}>No</option></select></label>
            </div>
            <p class="transport-prediction-help">Use packet IDs in arrival order. Type NONE when no packet belongs in an answer.</p>
            <button type="button" data-transport-run>${escape(config.run_label)}</button>
        </section>`;
    }

    function eventTimeline(events, current = null) {
        if (!events.length) return "";
        return `<section class="transport-timeline"><h3>SIMULATOR EVENTS</h3><ol>${events.map(event => `<li class="${current === event ? "active" : ""}">
            <span>t=${event.time}</span><strong>${escape(eventLabel(event))}</strong><small>${escape(event.detail)}</small></li>`).join("")}</ol></section>`;
    }

    function resultMarkup(result, fieldAssessment = null) {
        if (!result) return "";
        return `<section class="transport-result"><h3>ACTUAL SIMULATOR RESULT</h3>
            <div class="transport-summary">
                <span>Receiver arrival: <strong>${escape(result.receiverPackets.join(" → ") || "NONE")}</strong></span>
                <span>Application order: <strong>${escape(result.applicationOrder.join(" → ") || "NONE")}</strong></span>
                <span>Retransmitted: <strong>${escape(result.retransmittedPackets.join(", ") || "NONE")}</strong></span>
                <span>Loss repaired: <strong>${result.repairsLoss ? "YES" : "NO"}</strong></span>
            </div>
            ${fieldAssessment ? `<ul class="transport-field-results">${fieldAssessment.fields.map(field => `<li class="${field.correct ? "correct" : "incorrect"}">
                ${field.correct ? "✓" : "Needs revision"} · ${escape(field.label)} — yours: ${escape(field.submitted)}; result: ${escape(field.expected)}</li>`).join("")}</ul>` : ""}
        </section>`;
    }

    function task() {
        if (!selectedProtocol) return config.tasks.protocol;
        if (phase === "predict") return config.tasks.prediction;
        if (phase === "replay") return {
            title: config.tasks.replay.title,
            instruction: `${config.tasks.replay.instruction} Event ${replay.getCursor() + 1} of ${replay.getLength()}.`
        };
        return config.tasks.review;
    }

    function updateActiveTask() {
        if (mode === "expert-thinking") return;
        const current = task();
        window.activeTask?.render({
            label: mode === "mastery" ? "ACTIVE TASK · TRANSPORT SIMULATION" : "YOUR TASK · TRANSPORT SIMULATION",
            title: current.title,
            instruction: current.instruction
        });
    }

    function render() {
        stackDiv.className = "transport-view";
        const finalResult = phase === "complete" ? assessment?.actualResult : null;
        const currentEvent = replayState?.currentEvent || null;
        stackDiv.innerHTML = `${problemHeader(problem, selectedProtocol)}
            ${networkConditions(problem)}
            ${flowMarkup(problem, replayState)}
            ${phase === "predict" && mode !== "expert-thinking" ? predictionMarkup() : ""}
            ${phase === "replay" ? `<div class="transport-replay-control"><p>${currentEvent ? escape(eventLabel(currentEvent)) : "Prediction locked. Reveal the deterministic events."}</p>
                <button type="button" data-transport-next>${escape(config.next_event_label)}</button></div>` : ""}
            ${eventTimeline(revealedEvents, currentEvent)}
            ${phase === "complete" ? resultMarkup(finalResult, assessment) : ""}
            <p class="transport-feedback" aria-live="polite">${escape(feedback)}</p>
            ${phase === "complete" ? `<div class="transport-finish-actions"><button type="button" data-transport-replay>Replay actual events</button>
                ${assessment?.allCorrect ? "" : `<button type="button" data-transport-retry>Revise prediction</button>`}</div>` : ""}`;
        bind();
        updateActiveTask();
    }

    function bind() {
        stackDiv.querySelectorAll("[data-transport-protocol]").forEach(button => button.addEventListener("click", () => {
            selectedProtocol = button.dataset.transportProtocol;
            response = {};
            feedback = `${selectedProtocol} selected. Now predict its actual behavior under the displayed network conditions.`;
            reportDecision("choose-protocol", { value: selectedProtocol });
            render();
        }));
        stackDiv.querySelectorAll("[data-transport-field]").forEach(input => input.addEventListener("change", () => {
            response[input.dataset.transportField] = input.value;
        }));
        stackDiv.querySelector("[data-transport-run]")?.addEventListener("click", startReplay);
        stackDiv.querySelector("[data-transport-next]")?.addEventListener("click", stepReplay);
        stackDiv.querySelector("[data-transport-replay]")?.addEventListener("click", replayActual);
        stackDiv.querySelector("[data-transport-retry]")?.addEventListener("click", () => {
            response = {};
            replay = null;
            replayState = null;
            revealedEvents = [];
            assessment = null;
            feedback = "Try the same deterministic scenario again.";
            phase = "predict";
            render();
        });
    }

    function readResponse() {
        stackDiv.querySelectorAll("[data-transport-field]").forEach(input => {
            response[input.dataset.transportField] = input.value;
        });
        return { protocol: selectedProtocol, ...response };
    }

    function startReplay() {
        const prediction = readResponse();
        if (!selectedProtocol) {
            feedback = config.messages.missing_protocol;
            render();
            return;
        }
        if (["receiverPackets", "applicationOrder", "retransmittedPackets", "repairsLoss"]
            .some(field => !String(prediction[field] ?? "").trim())) {
            feedback = config.messages.missing_prediction;
            render();
            return;
        }
        assessment = TransportSimulator.assess(problem, prediction);
        replay = TransportSimulator.createReplay(problem, selectedProtocol);
        replayState = replay.getState();
        revealedEvents = [];
        phase = "replay";
        feedback = config.messages.prediction_saved;
        reportDecision("predict", { value: clone(prediction) });
        render();
    }

    function stepReplay() {
        if (!replay || phase !== "replay") return;
        const step = replay.next();
        replayState = step.state;
        if (step.event) revealedEvents.push(step.event);
        if (step.done) {
            phase = "complete";
            feedback = `${assessment.allCorrect ? config.messages.success : config.messages.incorrect} ${assessment.feedback}`;
            route({
                operation: assessment.allCorrect ? "run-simulation" : "simulation-attempt",
                state: { outcome: assessment.allCorrect ? "solved" : "attempted", result: assessment.actualResult },
                feedback,
                progress: !assessment.allCorrect
            });
        }
        render();
    }

    function replayActual() {
        if (!assessment) return;
        replay = TransportSimulator.createReplay(problem, selectedProtocol);
        replayState = replay.getState();
        revealedEvents = [];
        phase = "replay";
        feedback = "Replay reset to logical time 0. No old events remain.";
        render();
    }

    function expertState(input, expertAssessment = null) {
        const wrapper = document.createElement("div");
        wrapper.className = "transport-expert-state";
        const actual = expertAssessment?.actualResult || null;
        wrapper.innerHTML = `${problemHeader(input, input.knownProtocol)}${networkConditions(input)}${flowMarkup(input)}
            ${actual ? `${resultMarkup(actual, expertAssessment)}${eventTimeline(actual.events)}`
                : `<p class="transport-hidden-result">Receiver state, application order, retransmissions, and events remain hidden until Check prediction.</p>`}`;
        return wrapper;
    }

    return {
        mount() {
            const control = getControl("run-simulation");
            control.hidden = true;
            this.reset();
        },
        reset() { reset(config.problem, "learn"); },
        resetForChallenge() { reset(config.challenge_problem, "challenge"); },
        configureMasteryScenario(data) {
            reset(data.problem, data.mastery_mode === "expert-thinking" ? "expert-thinking" : "mastery");
        },
        performMasteryOperation(operation) {
            if (operation === "run-simulation") startReplay();
            if (operation === "next-event") stepReplay();
        },
        endMasteryMode() { reset(config.problem, "free-play"); },
        renderChallengeTarget() {},
        renderMasteryStates() {},
        renderExpertThinkingState({ initialState, assessment: expertAssessment }, container) {
            container.appendChild(expertState(initialState, expertAssessment));
        },
        replayExpertSimulation() { return Promise.resolve(); },
        getActiveTask() { return task(); },
        getState() { return clone({ problem, mode, selectedProtocol, response, phase, replayState, assessment }); }
    };
}

registerPlayground("transport-simulation", createTransportPlayground);
