function createQueuePlayground() {

    const queue = [];
    let masteryScenario = null;
    let enqueueIndex = 0;
    let replayToken = 0;

    function render() {
        stackDiv.innerHTML = "";
        stackDiv.classList.remove("linked-list-view");
        stackDiv.classList.add("queue-view");

        queue.forEach(number => {
            const block = document.createElement("div");
            block.className = "block";
            block.innerText = number;
            stackDiv.appendChild(block);
        });
    }

    function clearQueue() {
        queue.length = 0;
        render();
    }

    function reportOperation(event) {
        if (masteryEngine.isInteractionActive()) {
            masteryEngine.operationCompleted(event);
            return;
        }

        teachingEngine.operationCompleted(event);
    }

    function getMasteryEnqueueValue() {
        const configured = masteryScenario?.operation_values?.enqueue || [];
        const value = configured[enqueueIndex];
        enqueueIndex++;
        return value;
    }

    function add(valueOverride = undefined) {
        if (valueOverride instanceof Event) valueOverride = undefined;

        if (!masteryEngine.isInteractionActive() && teachingEngine.prepareOperation("enqueue").blocked) {
            return;
        }

        const value = valueOverride
            ?? masteryEngine.getOperationValue({ operation: "enqueue", fallback: undefined })
            ?? (masteryEngine.isInteractionActive() ? getMasteryEnqueueValue() : undefined)
            ?? teachingEngine.getOperationValue({
                operation: "enqueue",
                index: queue.length,
                fallback: Math.floor(Math.random() * 90) + 10
            });

        if (!Number.isFinite(value)) {
            setByteMessage("This challenge has no more configured values to enqueue. Compare your Queue with the target.");
            return;
        }

        queue.push(value);
        render();
        animateBlockAddition(value, getBlockElements().at(-1));
        reportOperation({ operation: "enqueue", value, state: [...queue] });
    }

    function remove() {
        if (queue.length === 0) {
            setByteMessage("The Queue is empty.");
            const event = { operation: "dequeue", state: [...queue] };
            if (masteryEngine.isInteractionActive()) masteryEngine.reportUnavailableOperation(event);
            else teachingEngine.reportUnavailableOperation(event);
            return;
        }

        if (!masteryEngine.isInteractionActive() && teachingEngine.prepareOperation("dequeue").blocked) {
            return;
        }

        const previousRects = captureBlockRects();
        const removedValue = queue.shift();
        render();
        animateRemainingBlocks(previousRects, 1);
        animateBlockRemoval(removedValue, previousRects[0], { x: -100, y: 0 });
        reportOperation({ operation: "dequeue", removedValue, state: [...queue] });
    }

    function pause(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    async function replayExpertSimulation(simulation) {
        if (!simulation || !Array.isArray(simulation.initial_state) || !Array.isArray(simulation.steps)) return;
        const token = ++replayToken;
        queue.length = 0;
        queue.push(...simulation.initial_state);
        render();

        for (const step of simulation.steps) {
            await pause(420);
            if (token !== replayToken) return;
            if (step.operation === "enqueue") queue.push(step.value);
            if (step.operation === "dequeue") queue.shift();
            render();
        }
    }

    function renderQueueCard(title, values, container) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        card.innerHTML = `<span class="challenge-target-label">${title}</span><span class="mastery-queue-boundaries">FRONT → REAR</span>`;
        const row = document.createElement("div");
        row.className = "challenge-queue-target";
        (values || []).forEach((value, index) => {
            const item = document.createElement("span");
            item.className = "challenge-queue-value";
            item.textContent = value;
            row.appendChild(item);
            if (index < values.length - 1) row.appendChild(document.createTextNode(" → "));
        });
        if (!values?.length) row.textContent = "empty";
        card.appendChild(row);
        container.appendChild(card);
    }

    return {
        mount() {
            getControl("enqueue").onclick = add;
            getControl("dequeue").onclick = remove;
            render();
        },
        reset() {
            replayToken++;
            masteryScenario = null;
            enqueueIndex = 0;
            clearQueue();
        },
        resetForChallenge() {
            replayToken++;
            masteryScenario = null;
            enqueueIndex = 0;
            clearQueue();
        },
        configureMasteryScenario(scenario) {
            replayToken++;
            masteryScenario = scenario || {};
            enqueueIndex = 0;
            queue.length = 0;
            queue.push(...(scenario?.initial_state || []));
            render();
        },
        performMasteryOperation(operation, { value } = {}) {
            if (operation === "enqueue") add(value);
            if (operation === "dequeue") remove();
        },
        replayExpertSimulation,
        renderExpertThinkingState({ initialState, labels }, container) {
            renderQueueCard(labels.title || "Starting Queue", initialState, container);
        },
        renderMasteryStates({ initialState, target }, container) {
            renderQueueCard("START QUEUE", initialState, container);
            renderQueueCard(target.label || "TARGET QUEUE", target.items || masteryScenario?.target_state || [], container);
        },
        renderChallengeTarget(target, container) {
            renderQueueCard(target.label, target.items || [], container);
        }
    };
}


registerPlayground("queue", createQueuePlayground);
