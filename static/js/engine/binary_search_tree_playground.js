function createBinarySearchTreePlayground() {

    const lessonInsertionValues = [...LESSON.playground.values];
    const svgNamespace = "http://www.w3.org/2000/svg";

    let root = null;
    let nextValueIndex = 0;
    let insertionBusy = false;
    let masteryScenario = null;
    let replayToken = 0;

    function createNode(value, parent = null) {
        return {
            value,
            parent,
            left: null,
            right: null
        };
    }

    function createSvgElement(name, attributes = {}) {

        const element = document.createElementNS(svgNamespace, name);

        Object.entries(attributes).forEach(([attribute, value]) => {
            element.setAttribute(attribute, value);
        });

        return element;
    }

    function getNodePosition(path) {

        let x = 350;
        let offset = 175;

        for (const direction of path) {
            x += direction === "left" ? -offset : offset;
            offset /= 2;
        }

        return {
            x,
            y: 62 + path.length * 105
        };
    }

    function collectNodes(node, path = [], nodes = []) {

        if (!node) return nodes;

        nodes.push({ node, path, position: getNodePosition(path) });
        collectNodes(node.left, [...path, "left"], nodes);
        collectNodes(node.right, [...path, "right"], nodes);

        return nodes;
    }

    function render(options = {}) {

        const {
            pendingValue = null,
            comparingNode = null,
            direction = null,
            newNode = null
        } = options;

        stackDiv.innerHTML = "";
        stackDiv.classList.add("binary-search-tree-view");

        const status = document.createElement("p");
        status.className = "bst-status";
        status.textContent = pendingValue === null
            ? "The tree is empty. Insert the first value."
            : `Insert ${pendingValue}`;

        const svg = createSvgElement("svg", {
            class: "bst-canvas",
            viewBox: "0 0 700 310",
            role: "img",
            "aria-label": "Binary Search Tree visualization"
        });

        const nodes = collectNodes(root);
        const positions = new Map(nodes.map(item => [item.node, item.position]));

        nodes.forEach(({ node, position }) => {

            for (const child of [node.left, node.right]) {

                if (!child) continue;

                const childPosition = positions.get(child);
                const edge = createSvgElement("line", {
                    x1: position.x,
                    y1: position.y,
                    x2: childPosition.x,
                    y2: childPosition.y,
                    class: child === newNode ? "bst-edge bst-new-edge" : "bst-edge"
                });

                svg.appendChild(edge);

            }

        });

        if (direction && positions.has(direction.node)) {

            const parentPosition = positions.get(direction.node);
            const label = createSvgElement("text", {
                x: parentPosition.x + (direction.side === "left" ? -68 : 68),
                y: parentPosition.y + 48,
                class: "bst-direction"
            });

            label.textContent = direction.side === "left" ? "← LEFT" : "RIGHT →";
            svg.appendChild(label);

        }

        nodes.forEach(({ node, position }) => {

            const group = createSvgElement("g", {
                class: [
                    "bst-node",
                    node === comparingNode ? "bst-comparing" : "",
                    node === newNode ? "bst-new-node" : ""
                ].filter(Boolean).join(" ")
            });

            const circle = createSvgElement("circle", {
                cx: position.x,
                cy: position.y,
                r: 27,
                class: "bst-node-circle"
            });

            const text = createSvgElement("text", {
                x: position.x,
                y: position.y + 6,
                class: "bst-node-text",
                "text-anchor": "middle"
            });

            text.textContent = node.value;
            group.append(circle, text);
            svg.appendChild(group);

        });

        stackDiv.append(status, svg);

    }

    function getActiveInsertionValues() {
        return masteryScenario?.values || lessonInsertionValues;
    }

    function completeInsertion(value, node) {

        render({ pendingValue: value, newNode: node });

        if (masteryEngine.isInteractionActive()) {
            nextValueIndex++;
            insertionBusy = false;
            masteryEngine.operationCompleted({
                operation: "insert",
                value,
                state: {
                    outcome: nextValueIndex === getActiveInsertionValues().length
                        ? "built"
                        : null,
                    inserted: nextValueIndex
                },
                progress: true
            });
            return;
        }

        let operation = "follow-comparisons";

        if (nextValueIndex === 0) {
            operation = "insert-root";
        }
        else if (nextValueIndex === 1) {
            operation = "insert-smaller";
        }
        else if (nextValueIndex === 2) {
            operation = "insert-larger";
        }
        else if (nextValueIndex === lessonInsertionValues.length - 1) {
            operation = "build-tree";
        }

        const missionResult = completeAction(operation);

        nextValueIndex++;
        insertionBusy = false;

        if (!missionResult.complete) {
            setByteMessage(`${value} was inserted. Use INSERT to place the next value.`);
        }

    }

    function followInsertion(value, current) {

        render({ pendingValue: value, comparingNode: current });
        if (!masteryEngine.isInteractionActive()) {
            setByteMessage(`Compare ${value} with ${current.value}.`);
        }

        setTimeout(() => {

            const side = value < current.value ? "left" : "right";

            render({
                pendingValue: value,
                comparingNode: current,
                direction: { node: current, side }
            });

            if (!masteryEngine.isInteractionActive()) {
                setByteMessage(`${value} is ${value < current.value ? "smaller" : "larger"} than ${current.value}, so move ${side.toUpperCase()}.`);
            }

            setTimeout(() => {

                const child = current[side];

                if (!child) {
                    const node = createNode(value, current);
                    current[side] = node;
                    completeInsertion(value, node);
                    return;
                }

                followInsertion(value, child);

            }, 650);

        }, 650);

    }

    function insert() {

        if (insertionBusy) return;

        if (nextValueIndex === getActiveInsertionValues().length) {

            root = null;
            nextValueIndex = 0;
            render();
            setByteMessage("Tree reset. Use INSERT to build the sequence again.");

            return;

        }

        insertionBusy = true;

        const value = getActiveInsertionValues()[nextValueIndex];

        if (!root) {

            root = createNode(value);

            if (!masteryEngine.isInteractionActive()) {
                setByteMessage(`${value} is the first value, so it becomes the root.`);
            }

            setTimeout(() => completeInsertion(value, root), 650);

            return;

        }

        followInsertion(value, root);

    }

    return {
        mount() {
            getControl("insert").onclick = insert;
            render();
        },
        reset() {
            replayToken++;
            masteryScenario = null;
            root = null;
            nextValueIndex = 0;
            insertionBusy = false;
            render();
        },
        resetForChallenge() {
            replayToken++;
            masteryScenario = null;
            root = null;
            nextValueIndex = 0;
            insertionBusy = false;
            render();
        },
        configureMasteryScenario(scenario) {
            replayToken++;
            masteryScenario = scenario || {};
            root = null;
            nextValueIndex = 0;
            insertionBusy = false;
            const initial = scenario?.mastery_mode === "expert-thinking"
                ? scenario?.initial_state || []
                : [];
            initial.forEach(value => {
                if (!root) root = createNode(value);
                else {
                    let current = root;
                    while (current) {
                        const side = value < current.value ? "left" : "right";
                        if (!current[side]) {
                            current[side] = createNode(value, current);
                            break;
                        }
                        current = current[side];
                    }
                }
                nextValueIndex++;
            });
            render();
        },
        performMasteryOperation(operation) {
            if (operation === "insert") insert();
        },
        async replayExpertSimulation(simulation) {
            if (!simulation || !Array.isArray(simulation.initial_state) || !Array.isArray(simulation.steps)) return;
            this.configureMasteryScenario({ initial_state: simulation.initial_state, mastery_mode: "expert-thinking" });
            const token = replayToken;
            for (const step of simulation.steps) {
                await new Promise(resolve => window.setTimeout(resolve, 480));
                if (token !== replayToken) return;
                if (step.operation !== "insert") continue;
                const value = step.value;
                let current = root;
                while (current) {
                    const side = value < current.value ? "left" : "right";
                    if (!current[side]) {
                        const node = createNode(value, current);
                        current[side] = node;
                        render({ pendingValue: value, newNode: node });
                        break;
                    }
                    current = current[side];
                }
            }
        },
        renderExpertThinkingState({ initialState, labels }, container) {
            const card = document.createElement("section");
            card.className = "mastery-state-card";
            card.innerHTML = `<span class="challenge-target-label">${labels.title || "Starting Tree"}</span><p>Root: <strong>${initialState?.[0] ?? "empty"}</strong></p>`;
            container.appendChild(card);
        },
        renderMasteryStates({ scenario, target }, container) {
            const card = document.createElement("section");
            card.className = "mastery-state-card";
            card.innerHTML = `<span class="challenge-target-label">INSERTION SEQUENCE</span><p>${(scenario?.values || []).join(" → ") || "No values"}</p>`;
            const outcome = document.createElement("section");
            outcome.className = "mastery-state-card";
            outcome.innerHTML = `<span class="challenge-target-label">TARGET TREE</span><p>${target.description || "Insert every value while following smaller → left and larger → right."}</p>`;
            container.append(card, outcome);
        }
    };

}


registerPlayground("binary-search-tree", createBinarySearchTreePlayground);
