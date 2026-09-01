function createLinkedListPlayground() {

    const linkedList = new LinkedList();
    let linkedListBusy = false;
    let masteryScenario = null;
    let addIndex = 0;
    let replayToken = 0;

    function render(options = {}) {
        const { enteringNode = false, removingHead = false } = options;

        stackDiv.innerHTML = "";
        stackDiv.classList.remove("queue-view");
        stackDiv.classList.add("linked-list-view");

        const values = linkedList.getValues();
        if (!values.length) {
            const empty = document.createElement("p");
            empty.className = "linked-list-empty";
            empty.textContent = "head → null";
            stackDiv.appendChild(empty);
            return;
        }

        values.forEach((value, index) => {
            const node = document.createElement("div");
            node.className = "linked-node";
            if (index === 0) node.classList.add("head-node");
            if (index === values.length - 1 && enteringNode) node.classList.add("node-entering");
            if (index === 0 && removingHead) node.classList.add("node-removing");
            if (index === 0) {
                const label = document.createElement("span");
                label.className = "head-label";
                label.textContent = "HEAD";
                node.appendChild(label);
            }
            const data = document.createElement("div");
            data.className = "node-data";
            data.textContent = value;
            const next = document.createElement("div");
            next.className = "node-arrow";
            next.textContent = index < values.length - 1 ? "next →" : "next → null";
            node.append(data, next);
            stackDiv.appendChild(node);
        });
    }

    function nonMasteryAction(operation, message) {
        const result = completeAction(operation);
        if (!result.complete && message) setByteMessage(message);
    }

    function nextMasteryValue() {
        const value = masteryScenario?.operation_values?.add?.[addIndex];
        addIndex++;
        return value;
    }

    function add(valueOverride = undefined) {
        if (linkedListBusy) return;
        if (valueOverride instanceof Event) valueOverride = undefined;
        const isMastery = masteryEngine.isInteractionActive();
        const value = valueOverride
            ?? masteryEngine.getOperationValue({ operation: "add", fallback: undefined })
            ?? (isMastery ? nextMasteryValue() : undefined)
            ?? Math.floor(Math.random() * 90) + 10;

        if (!Number.isFinite(value)) {
            setByteMessage("No more configured nodes can be added. Compare your chain with the target.");
            return;
        }

        const wasEmpty = linkedList.isEmpty();
        linkedList.add(value);
        render({ enteringNode: true });
        const event = { operation: "add", value, state: linkedList.getValues() };

        if (isMastery) masteryEngine.operationCompleted(event);
        else nonMasteryAction("add", wasEmpty
            ? `Node ${value} is the first node, so HEAD points to it.`
            : `Node ${value} joined the chain. The previous node's next link points to it.`);
    }

    function remove() {
        if (linkedListBusy) return;
        const isMastery = masteryEngine.isInteractionActive();
        if (linkedList.isEmpty()) {
            setByteMessage("The Linked List is empty.");
            const event = { operation: "remove", state: linkedList.getValues() };
            if (isMastery) masteryEngine.reportUnavailableOperation(event);
            return;
        }

        linkedListBusy = true;
        const removedValue = linkedList.head.value;
        render({ removingHead: true });
        if (!isMastery) setByteMessage(`Node ${removedValue} is leaving. Watch HEAD move to the next node.`);

        setTimeout(() => {
            linkedList.remove();
            render();
            linkedListBusy = false;
            const event = { operation: "remove", removedValue, state: linkedList.getValues() };
            if (masteryEngine.isInteractionActive()) masteryEngine.operationCompleted(event);
            else nonMasteryAction("remove", "HEAD now points to the next node in the chain.");
        }, 650);
    }

    function pause(milliseconds) { return new Promise(resolve => window.setTimeout(resolve, milliseconds)); }

    async function replayExpertSimulation(simulation) {
        if (!simulation || !Array.isArray(simulation.initial_state) || !Array.isArray(simulation.steps)) return;
        const token = ++replayToken;
        linkedList.clear();
        simulation.initial_state.forEach(value => linkedList.add(value));
        render();
        for (const step of simulation.steps) {
            await pause(430);
            if (token !== replayToken) return;
            if (step.operation === "add") linkedList.add(step.value);
            if (step.operation === "remove" && !linkedList.isEmpty()) linkedList.remove();
            render();
        }
    }

    function renderListCard(title, values, container) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        const label = document.createElement("span");
        label.className = "challenge-target-label";
        label.textContent = title;
        const chain = document.createElement("p");
        chain.className = "mastery-list-chain";
        chain.textContent = values?.length ? `HEAD → ${values.join(" → ")} → null` : "HEAD → null";
        card.append(label, chain);
        container.appendChild(card);
    }

    return {
        mount() {
            getControl("add").onclick = add;
            getControl("remove").onclick = remove;
            render();
        },
        reset() {
            replayToken++;
            linkedListBusy = false;
            masteryScenario = null;
            addIndex = 0;
            linkedList.clear();
            render();
        },
        resetForChallenge() { this.reset(); },
        configureMasteryScenario(scenario) {
            replayToken++;
            linkedListBusy = false;
            masteryScenario = scenario || {};
            addIndex = 0;
            linkedList.clear();
            (scenario?.initial_state || []).forEach(value => linkedList.add(value));
            render();
        },
        performMasteryOperation(operation, { value } = {}) {
            if (operation === "add") add(value);
            if (operation === "remove") remove();
        },
        replayExpertSimulation,
        renderExpertThinkingState({ initialState, labels }, container) {
            renderListCard(labels.title || "Starting Linked List", initialState, container);
        },
        renderMasteryStates({ initialState, target }, container) {
            renderListCard("START LIST", initialState, container);
            renderListCard(target.label || "TARGET LIST", target.items || masteryScenario?.target_state || [], container);
        }
    };
}


registerPlayground("linked-list", createLinkedListPlayground);
