/* One graph renderer with distinct BFS and DFS frontier behaviour. */
(function registerGraphTraversalPlaygrounds() {
    const positions = {
        A: [50, 12], B: [27, 42], C: [73, 42], D: [12, 76], E: [39, 76], F: [88, 76]
    };

    function edgesFromGraph(graph) {
        return Object.entries(graph.edges || {}).flatMap(([from, neighbors]) => (
            (neighbors || []).map(to => ({ from, to }))
        ));
    }

    function traversal(graph, kind) {
        const visited = [];
        const frontier = [graph.start];
        const seen = new Set([graph.start]);
        const steps = [];
        while (frontier.length) {
            const node = kind === "breadth-first-search" ? frontier.shift() : frontier.pop();
            visited.push(node);
            const ordered = [...(graph.edges[node] || [])].sort();
            const additions = kind === "breadth-first-search" ? ordered : [...ordered].reverse();
            additions.forEach(neighbor => {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    frontier.push(neighbor);
                }
            });
            steps.push({ node, visited: [...visited], frontier: [...frontier] });
        }
        return steps;
    }

    function appendGraphState(container, label, graph, visited = []) {
        const card = document.createElement("section");
        card.className = "mastery-state-card graph-state-card";
        card.innerHTML = `<span class="challenge-target-label">${label}</span><p>${visited.length ? visited.join(" → ") : "No nodes visited yet"}</p>`;
        container.appendChild(card);
    }

    function createGraphTraversalPlayground(kind) {
        const originalGraph = LESSON.playground.graph;
        const isBfs = kind === "breadth-first-search";
        const frontierName = isBfs ? "QUEUE" : "STACK / PATH";
        let graph = originalGraph;
        let steps = [];
        let stepIndex = 0;
        let visited = [];
        let frontier = [];
        let selectedNode = null;
        let masteryMode = false;
        let scenario = null;

        function reset({ useScenario = false } = {}) {
            graph = useScenario ? (scenario?.graph || originalGraph) : originalGraph;
            steps = traversal(graph, kind);
            stepIndex = 0;
            visited = [];
            frontier = [graph.start];
            selectedNode = null;
            updateLegacyControl();
            render(`Start at ${graph.start}. ${isBfs ? "The queue keeps nodes in level order." : "The stack/path follows one branch deeply before backtracking."}`);
        }

        function updateLegacyControl() {
            const control = getControl("next-step");
            control.hidden = !masteryMode;
            control.onclick = nextGuided;
        }

        function render(message) {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view graph-traversal-view";
            const instruction = document.createElement("p");
            instruction.className = "curriculum-instruction";
            instruction.textContent = message;
            const map = document.createElement("div");
            map.className = "graph-map";
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 100 100");
            svg.setAttribute("preserveAspectRatio", "none");
            edgesFromGraph(graph).forEach(edge => {
                const [x1, y1] = positions[edge.from] || [50, 50];
                const [x2, y2] = positions[edge.to] || [50, 50];
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", x1);
                line.setAttribute("y1", y1);
                line.setAttribute("x2", x2);
                line.setAttribute("y2", y2);
                svg.appendChild(line);
            });
            map.appendChild(svg);
            graph.nodes.forEach(nodeId => {
                const button = document.createElement("button");
                const [left, top] = positions[nodeId] || [50, 50];
                button.type = "button";
                button.className = "graph-node";
                if (visited.includes(nodeId)) button.classList.add("is-visited");
                if (frontier.includes(nodeId)) button.classList.add("is-frontier");
                if (selectedNode === nodeId) button.classList.add("is-selected");
                button.style.left = `${left}%`;
                button.style.top = `${top}%`;
                button.textContent = nodeId;
                button.disabled = visited.includes(nodeId);
                button.onclick = () => {
                    const expected = steps[stepIndex]?.node;
                    if (!masteryMode) {
                        if (teachingEngine.guardPendingPrediction("next-step")) return;
                        if (nodeId !== expected) {
                            teachingEngine.setByteMessage(`${nodeId} is not the next ${isBfs ? "queue-front" : "stack-top"} node. Check the ${frontierName.toLowerCase()} first.`);
                            return;
                        }
                        applyStep(steps[stepIndex]);
                        render(`${nodeId} is the correct next visit. ${isBfs ? "Its unvisited neighbors join the queue." : "Continue along the path or backtrack when needed."}`);
                        report("next-step", nodeId, stepIndex < steps.length);
                        return;
                    }
                    selectedNode = nodeId;
                    render(`You selected ${nodeId}. Confirm it only if it is the next ${isBfs ? "queue" : "stack"} node.`);
                };
                map.appendChild(button);
            });
            const frontierLabel = document.createElement("p");
            frontierLabel.className = "graph-frontier";
            frontierLabel.innerHTML = `<strong>${frontierName}</strong>: ${frontier.join(" → ") || "empty"}<br><strong>VISITED</strong>: ${visited.join(" → ") || "none"}`;
            stackDiv.append(instruction, map, frontierLabel);
        }

        function applyStep(step) {
            visited = [...step.visited];
            frontier = [...step.frontier];
            stepIndex++;
            selectedNode = null;
        }

        function report(operation, node, progress) {
            const complete = stepIndex >= steps.length;
            const feedback = complete
                ? `Traversal complete: ${visited.join(" → ")}.`
                : `${node} was visited. The next choice must come from the ${isBfs ? "front of the queue" : "top of the stack"}.`;
            routeEvent({ operation, value: node, state: { visited: [...visited], frontier: [...frontier], outcome: complete ? "complete" : null }, feedback, progress });
        }

        function routeEvent(event) {
            if (masteryEngine.isInteractionActive()) masteryEngine.operationCompleted(event);
            else teachingEngine.operationCompleted(event);
        }

        function nextGuided() {
            const step = steps[stepIndex];
            if (!step) {
                if (!masteryMode) reset();
                return;
            }
            applyStep(step);
            render(`${step.node} is visited next. ${isBfs ? "Its unvisited neighbors join the back of the queue." : "Its unvisited neighbors extend the path."}`);
            report("next-step", step.node, stepIndex < steps.length);
        }

        function confirmNext() {
            const step = steps[stepIndex];
            if (!step) return;
            if (selectedNode !== step.node) {
                masteryEngine.operationCompleted({ operation: "confirm-next", state: { visited: [...visited], frontier: [...frontier], outcome: null }, feedback: `Not yet. Follow the ${isBfs ? "front of the queue" : "top of the stack"} and the alphabetical neighbor order.` });
                return;
            }
            applyStep(step);
            render(`${step.node} is the correct next visit.`);
            report("confirm-next", step.node, stepIndex < steps.length);
        }

        return {
            mount() { reset(); },
            reset() { masteryMode = false; scenario = null; reset(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(nextScenario) { masteryMode = true; scenario = nextScenario || {}; reset({ useScenario: true }); },
            performMasteryOperation(operation) { if (operation === "confirm-next") confirmNext(); },
            endMasteryMode() { masteryMode = false; scenario = null; reset(); },
            async replayExpertSimulation(simulation) {
                if (!simulation?.graph || !Array.isArray(simulation.steps)) return;
                masteryMode = true;
                scenario = { graph: simulation.graph };
                reset({ useScenario: true });
                for (const step of simulation.steps) {
                    const local = steps.find(item => item.node === step.node);
                    if (local) {
                        applyStep(local);
                        render(step.label);
                    }
                    await new Promise(resolve => window.setTimeout(resolve, 500));
                }
            },
            renderChallengeTarget(target, container) { appendGraphState(container, target.label || "TARGET ORDER", graph, target.items || []); },
            renderMasteryStates({ scenario: state, target }, container) {
                appendGraphState(container, "START NODE", state?.graph || graph, []);
                appendGraphState(container, target.label || "TARGET VISIT ORDER", state?.graph || graph, target.raw_state || target.items || scenario?.target_state || []);
            },
            renderExpertThinkingState({ initialState, graph: expertGraph, labels }, container) { appendGraphState(container, labels.title || "START NODE", expertGraph || graph, initialState || []); }
        };
    }

    registerPlayground("breadth-first-search", () => createGraphTraversalPlayground("breadth-first-search"));
    registerPlayground("depth-first-search", () => createGraphTraversalPlayground("depth-first-search"));
})();
