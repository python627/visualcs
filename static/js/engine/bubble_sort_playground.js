function createBubbleSortPlayground() {

    const originalValues = [...LESSON.playground.values];
    let values = [...originalValues];
    let index = 0;
    let end = values.length - 1;
    let phase = "compare";
    let comparing = [];
    let sortedIndices = new Set();
    let sortFinished = false;
    let masteryMode = false;
    let masteryScenario = null;
    let replayToken = 0;

    function render(options = {}) {
        const { swapping = false, statusText = null } = options;
        stackDiv.innerHTML = "";
        stackDiv.classList.add("bubble-sort-view");
        const instruction = document.createElement("p");
        instruction.className = "bubble-sort-instruction";
        instruction.textContent = statusText || (sortFinished
            ? "Sorted! Use NEXT STEP to sort the values again."
            : "Compare neighboring values from left to right.");
        const array = document.createElement("div");
        array.className = "bubble-sort-array";
        values.forEach((value, valueIndex) => {
            const item = document.createElement("div");
            item.className = "sort-value";
            item.textContent = value;
            if (comparing.includes(valueIndex)) item.classList.add("comparing");
            if (swapping && comparing.includes(valueIndex)) item.classList.add("swapping");
            if (sortedIndices.has(valueIndex)) item.classList.add("sorted");
            array.appendChild(item);
        });
        stackDiv.append(instruction, array);
    }

    function getSortItems() { return Array.from(stackDiv.querySelectorAll(".sort-value")); }

    function animateSwap(previousRects) {
        const items = getSortItems();
        const left = items[index];
        const right = items[index + 1];
        if (!left || !right || typeof left.animate !== "function") return;
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        left.animate([{ transform: `translateX(${previousRects[index + 1].left - leftRect.left}px)` }, { transform: "translateX(0)" }], { duration: 420, easing: "ease-out" });
        right.animate([{ transform: `translateX(${previousRects[index].left - rightRect.left}px)` }, { transform: "translateX(0)" }], { duration: 420, easing: "ease-out" });
    }

    function resetSort({ useScenario = false } = {}) {
        values = useScenario && Array.isArray(masteryScenario?.values)
            ? [...masteryScenario.values]
            : [...originalValues];
        index = 0;
        end = values.length - 1;
        phase = "compare";
        comparing = [];
        sortedIndices = new Set();
        sortFinished = false;
        render();
    }

    function reportNormal(operation) { return completeAction(operation).complete; }

    function nextStep() {
        if (masteryMode) {
            setByteMessage("Choose SWAP or KEEP ORDER in the focused mastery controls.");
            return;
        }
        if (sortFinished) {
            resetSort();
            setByteMessage("Sort reset. Use NEXT STEP to compare the first pair again.");
            return;
        }
        if (phase === "compare") {
            comparing = [index, index + 1];
            render();
            const complete = reportNormal("compare-adjacent");
            if (values[index] > values[index + 1]) {
                phase = "swap";
                if (!complete) setByteMessage(`${values[index]} is larger than ${values[index + 1]}. Use NEXT STEP to swap them.`);
            }
            else {
                phase = "advance";
                if (!complete) setByteMessage(`${values[index]} and ${values[index + 1]} are already in order. No swap is needed.`);
            }
            return;
        }
        if (phase === "swap") {
            const previousRects = getSortItems().map(item => item.getBoundingClientRect());
            [values[index], values[index + 1]] = [values[index + 1], values[index]];
            render({ swapping: true });
            animateSwap(previousRects);
            phase = "advance";
            if (!reportNormal("swap")) setByteMessage("The larger value moved one position to the right.");
            return;
        }
        if (phase === "finish") {
            sortFinished = true;
            comparing = [];
            render();
            if (!reportNormal("sorted-array")) setByteMessage("The array is sorted!");
            return;
        }
        advanceNormalPass();
    }

    function advanceNormalPass() {
        if (index >= end - 1) {
            sortedIndices.add(end);
            end--;
            index = 0;
            comparing = [];
            const complete = reportNormal("complete-pass");
            if (end === 0) {
                sortedIndices.add(0);
                phase = "finish";
                render();
                if (!complete) setByteMessage("Every pass is complete. Use NEXT STEP to reveal the sorted array.");
            }
            else {
                phase = "compare";
                render();
                if (!complete) setByteMessage("One value reached its final position. Start the next pass from the left.");
            }
            return;
        }
        index++;
        comparing = [];
        phase = "compare";
        render();
        if (!reportNormal("continue-pass")) setByteMessage("Move to the next adjacent pair in this pass.");
    }

    function advanceMasteryPair(operation) {
        if (!masteryMode || sortFinished) return;
        const shouldSwap = values[index] > values[index + 1];
        const expected = shouldSwap ? "swap" : "keep";
        comparing = [index, index + 1];

        if (operation !== expected) {
            render();
            masteryEngine.operationCompleted({
                operation,
                state: { outcome: null, values: [...values] },
                feedback: shouldSwap
                    ? `${values[index]} is larger than ${values[index + 1]}, so this pair must swap.`
                    : `${values[index]} is already smaller than ${values[index + 1]}, so keep their order.`
            });
            return;
        }

        if (shouldSwap) {
            const previousRects = getSortItems().map(item => item.getBoundingClientRect());
            [values[index], values[index + 1]] = [values[index + 1], values[index]];
            render({ swapping: true });
            animateSwap(previousRects);
        }

        let outcome = null;
        if (index >= end - 1) {
            sortedIndices.add(end);
            end--;
            index = 0;
            if (end === 0) {
                sortedIndices.add(0);
                sortFinished = true;
                outcome = "sorted";
            }
        }
        else index++;
        comparing = sortFinished ? [] : [index, index + 1];
        render({ statusText: sortFinished ? "The array is sorted." : "Choose the correct decision for the highlighted pair." });
        masteryEngine.operationCompleted({
            operation,
            state: { outcome, values: [...values] },
            feedback: outcome ? "Every pair is now in ascending order." : "Good. Move to the next highlighted pair.",
            progress: !outcome
        });
    }

    function pause(milliseconds) { return new Promise(resolve => window.setTimeout(resolve, milliseconds)); }

    async function replayExpertSimulation(simulation) {
        if (!simulation || !Array.isArray(simulation.initial_state) || !Array.isArray(simulation.steps)) return;
        const token = ++replayToken;
        masteryMode = true;
        masteryScenario = { values: simulation.initial_state };
        resetSort({ useScenario: true });
        for (const step of simulation.steps) {
            await pause(430);
            if (token !== replayToken) return;
            index = step.index;
            comparing = [index, index + 1];
            if (step.operation === "swap") [values[index], values[index + 1]] = [values[index + 1], values[index]];
            render({ swapping: step.operation === "swap" });
        }
    }

    function renderArrayCard(title, valuesToRender, container) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        card.innerHTML = `<span class="challenge-target-label">${title}</span><p class="mastery-array-state">[${(valuesToRender || []).join(", ")}]</p>`;
        container.appendChild(card);
    }

    return {
        mount() { getControl("next-step").onclick = nextStep; render(); },
        reset() { replayToken++; masteryMode = false; masteryScenario = null; resetSort(); },
        resetForChallenge() { this.reset(); },
        configureMasteryScenario(scenario) {
            replayToken++;
            masteryMode = true;
            masteryScenario = scenario || {};
            resetSort({ useScenario: true });
            comparing = [0, 1];
            render({ statusText: "Choose whether the highlighted pair should swap or keep its order." });
        },
        performMasteryOperation(operation) { advanceMasteryPair(operation); },
        endMasteryMode() { masteryMode = false; masteryScenario = null; },
        replayExpertSimulation,
        renderExpertThinkingState({ initialState, labels }, container) { renderArrayCard(labels.title || "Starting Array", initialState, container); },
        renderMasteryStates({ scenario, target }, container) {
            renderArrayCard("START ARRAY", scenario?.values || [], container);
            renderArrayCard(target.label || "TARGET ARRAY", target.items || masteryScenario?.target_state || [], container);
        }
    };
}


registerPlayground("bubble-sort", createBubbleSortPlayground);
