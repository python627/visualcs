/* Reusable Phase 2 visual playgrounds.
 * The lesson JSON supplies the data, guided steps, and labels; this module
 * supplies only structure-appropriate rendering and state transitions.
 */
(function registerPhase2Playgrounds() {
    const clone = value => JSON.parse(JSON.stringify(value));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    function route(event) {
        if (typeof masteryEngine !== "undefined" && masteryEngine.isInteractionActive()) {
            masteryEngine.operationCompleted(event);
        } else {
            teachingEngine.operationCompleted(event);
        }
    }

    function card(label, value, className = "phase2-state-card") {
        const element = document.createElement("section");
        element.className = className;
        const heading = document.createElement("span");
        heading.className = "challenge-target-label";
        heading.textContent = label;
        element.appendChild(heading);
        const body = document.createElement("pre");
        body.className = "phase2-state-value";
        body.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        element.appendChild(body);
        return element;
    }

    function createTable(table) {
        const wrapper = document.createElement("div");
        wrapper.className = "phase2-table";
        if (!Array.isArray(table) || !table.length) {
            wrapper.textContent = "No rows";
            return wrapper;
        }
        const rows = table.map(row => Array.isArray(row) ? row : Object.values(row || {}));
        const tableElement = document.createElement("table");
        rows.forEach((row, index) => {
            const tr = document.createElement("tr");
            row.forEach(value => {
                const cell = document.createElement(index === 0 ? "th" : "td");
                cell.textContent = value;
                tr.appendChild(cell);
            });
            tableElement.appendChild(tr);
        });
        wrapper.appendChild(tableElement);
        return wrapper;
    }

    function createVisual(kind, state) {
        const visual = document.createElement("div");
        visual.className = `phase2-visual phase2-${kind}`;
        if (kind === "table" || kind === "query") {
            const tables = state?.tables || state?.table ? (state.tables || { TABLE: state.table }) : {};
            Object.entries(tables).forEach(([name, table]) => {
                const section = document.createElement("section");
                section.className = "phase2-table-card";
                const title = document.createElement("h3");
                title.textContent = name;
                section.append(title, createTable(table));
                visual.appendChild(section);
            });
            if (state?.result) visual.appendChild(card("RESULT", state.result));
        } else if (kind === "zones") {
            Object.entries(state?.zones || state || {}).forEach(([name, values]) => {
                const zone = document.createElement("section");
                zone.className = "phase2-zone";
                zone.innerHTML = `<h3>${name}</h3>`;
                const list = document.createElement("div");
                list.className = "phase2-zone-items";
                (Array.isArray(values) ? values : [values]).forEach(value => {
                    const item = document.createElement("span");
                    item.className = "phase2-item";
                    item.textContent = typeof value === "object" ? JSON.stringify(value) : value;
                    list.appendChild(item);
                });
                if (!list.children.length) list.textContent = "empty";
                zone.appendChild(list);
                visual.appendChild(zone);
            });
        } else if (kind === "graph") {
            const graph = state?.graph || state;
            const graphCard = document.createElement("section");
            graphCard.className = "phase2-state-card phase2-graph-card";
            const graphTitle = document.createElement("span");
            graphTitle.className = "challenge-target-label";
            graphTitle.textContent = "RESOURCE / PROCESS GRAPH";
            graphCard.appendChild(graphTitle);
            const graphFlow = document.createElement("div");
            graphFlow.className = "phase2-graph-flow";
            String(graph).split(";").map(item => item.trim()).filter(Boolean).forEach((segment, index, segments) => {
                if (index) {
                    const separator = document.createElement("span");
                    separator.className = "phase2-flow-arrow";
                    separator.textContent = "↔";
                    graphFlow.appendChild(separator);
                }
                const node = document.createElement("span");
                node.className = "phase2-flow-item";
                node.textContent = segment;
                graphFlow.appendChild(node);
            });
            graphCard.appendChild(graphFlow);
            visual.appendChild(graphCard);
            if (state?.status) visual.appendChild(card("STATUS", state.status));
        } else if (kind === "flow") {
            const flow = Array.isArray(state?.flow) ? state.flow : (Array.isArray(state) ? state : []);
            const row = document.createElement("div");
            row.className = "phase2-flow-row";
            flow.forEach((step, index) => {
                if (index) {
                    const arrow = document.createElement("span");
                    arrow.className = "phase2-flow-arrow";
                    arrow.textContent = "→";
                    row.appendChild(arrow);
                }
                const item = document.createElement("span");
                item.className = "phase2-flow-item";
                item.textContent = typeof step === "object" ? (step.label || JSON.stringify(step)) : step;
                row.appendChild(item);
            });
            visual.appendChild(row);
        } else {
            visual.appendChild(card("CURRENT STATE", state));
        }
        return visual;
    }

    function createPlayground() {
        const config = LESSON.playground;
        const kind = config.view || "state";
        const original = clone(config.initial_state ?? config.state ?? config.data ?? {});
        let state = clone(original);
        let guidedIndex = 0;
        let masteryMode = false;
        let scenario = null;
        let message = config.instruction || "Choose the next meaningful action.";

        function operationStep(operation) {
            const steps = masteryMode
                ? (scenario?.operations || scenario?.steps || [])
                : (config.guided_steps || []);
            return steps.find(step => step.operation === operation) || steps[0] || null;
        }

        function apply(operation, value) {
            const step = operationStep(operation);
            if (step?.next_state !== undefined) state = clone(step.next_state);
            else if (step?.state !== undefined) state = clone(step.state);
            else if (step?.result !== undefined) state = { ...state, result: clone(step.result) };
            message = step?.message || step?.explanation || config.operation_messages?.[operation] || `Action: ${operation}`;
            if (!masteryMode) guidedIndex++;
            render();
            const steps = masteryMode ? (scenario?.operations || scenario?.steps || []) : (config.guided_steps || []);
            const finalStep = steps.length > 0 && (masteryMode ? step === steps[steps.length - 1] : guidedIndex >= steps.length);
            const evaluationState = finalStep
                ? clone(scenario?.target_state || config.target_state || ["COMPLETE"])
                : clone(step?.evaluation_state ?? state);
            route({ operation, value, state: evaluationState, feedback: message, progress: !finalStep });
        }

        function render() {
            stackDiv.innerHTML = "";
            stackDiv.className = `curriculum-view phase2-view phase2-${kind}`;
            const instruction = document.createElement("p");
            instruction.className = "curriculum-instruction";
            instruction.textContent = message;
            stackDiv.appendChild(instruction);
            stackDiv.appendChild(createVisual(kind, state));
            if (!masteryMode) {
                const step = config.guided_steps?.[guidedIndex];
                if (step?.instruction) {
                    const next = document.createElement("p");
                    next.className = "phase2-next-instruction";
                    next.textContent = step.instruction;
                    stackDiv.appendChild(next);
                }
            }
        }

        function bindControls() {
            document.querySelectorAll(".buttons [data-operation]").forEach(button => {
                button.onclick = () => {
                    const operation = button.dataset.operation;
                    if (!masteryMode && typeof teachingEngine !== "undefined" && teachingEngine.guardPendingPrediction?.(operation)) return;
                    const expected = config.guided_steps?.[guidedIndex]?.operation;
                    if (!masteryMode && expected && expected !== operation) {
                        setByteMessage(config.wrong_action_message || "Compare the current state with the task before choosing.");
                        return;
                    }
                    apply(operation);
                };
            });
        }

        return {
            mount() { bindControls(); this.reset(); },
            reset() { masteryMode = false; scenario = null; guidedIndex = 0; state = clone(original); message = config.instruction || "Choose the next meaningful action."; render(); bindControls(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(data) { masteryMode = true; scenario = clone(data || {}); guidedIndex = 0; state = clone(scenario.initial_state ?? scenario.state ?? original); message = scenario.instruction || "Use the target to decide your next action."; render(); bindControls(); },
            performMasteryOperation(operation, options = {}) { if (masteryMode) apply(operation, options.value); },
            endMasteryMode() { this.reset(); },
            renderChallengeTarget(target, container) {
                const targetState = target?.state
                    ?? target?.items
                    ?? config.guided_steps?.at(-1)?.next_state
                    ?? target?.description
                    ?? "";
                container.appendChild(card(target?.label || "TARGET", targetState));
            },
            renderMasteryStates({ scenario: input, target }, container) {
                container.appendChild(card("START", input?.initial_state ?? input?.state ?? input?.values ?? {}));
                const targetState = target?.raw_state
                    ?? target?.state
                    ?? target?.items
                    ?? scenario?.target_state
                    ?? scenario?.operations?.at(-1)?.next_state
                    ?? target?.description
                    ?? {};
                container.appendChild(card("TARGET", targetState));
            },
            renderExpertThinkingState({ initialState, labels }, container) { container.appendChild(card(labels?.title || "STARTING STATE", initialState)); },
            async replayExpertSimulation(simulation) { if (!simulation?.steps) return; for (const step of simulation.steps) { apply(step.operation, step.value); await new Promise(resolve => setTimeout(resolve, 350)); } }
        };
    }

    const types = [
        "normalization",
        "ip-addresses", "dns-lookup", "http-request"
    ];
    types.forEach(type => registerPlayground(type, createPlayground));

    if (typeof registerScenarioGenerator === "function" && !ScenarioFactory.getGenerator("phase2-expert")) {
        registerScenarioGenerator("phase2-expert", {
            version: 1,
            generate({ rules }) {
                const initial = clone(rules.initial_state ?? rules.state ?? {});
                const steps = clone(rules.steps || rules.operations || []);
                return { initial_state: initial, steps, final_state: clone(rules.final_state ?? initial), next_pop_value: null, target_state: clone(rules.target_state ?? initial) };
            },
            getMentalSimulation(data) { return clone(data); },
            evaluatePrediction(data, response) {
                const expected = JSON.stringify(data.final_state);
                const answer = response?.finalState ?? response?.answer ?? "";
                const normalizedAnswer = String(answer).replace(/[\[\]\s]/g, "");
                const normalizedExpected = Array.isArray(data.final_state)
                    ? data.final_state.join(",").replace(/[\[\]\s]/g, "")
                    : String(data.final_state).replace(/[\[\]\s]/g, "");
                const correct = JSON.stringify(answer) === expected || normalizedAnswer === normalizedExpected;
                return { correctFinalState: correct, correctNextPop: true, actualFinalState: Array.isArray(data.final_state) ? data.final_state : [], actualNextPop: data.next_pop_value ?? null, actualOutcome: "complete" };
            },
            createExecutionChallenge(data) { return { phases: [{ goal: { type: "state_equals", expected_state: data.target_state }, feedback: "Compare your current state with the target." }] }; }
        });
    }
})();
