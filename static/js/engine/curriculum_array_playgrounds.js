/* Shared array visuals used by Arrays, searching, and sorting lessons. */
(function registerArrayCurriculumPlaygrounds() {
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

    function createArray(values, { active = null, sortedPrefix = 0, faded = [] } = {}) {
        const array = document.createElement("div");
        array.className = "curriculum-array";
        values.forEach((value, index) => {
            const cell = document.createElement("div");
            cell.className = "curriculum-array-cell";
            cell.dataset.index = index;
            if (index === active) cell.classList.add("is-active");
            if (index < sortedPrefix) cell.classList.add("is-sorted");
            if (faded.includes(index)) cell.classList.add("is-faded");
            cell.innerHTML = `<span class="curriculum-index">${index}</span><strong>${value}</strong>`;
            array.appendChild(cell);
        });
        return array;
    }

    function appendArrayState(container, label, values) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        card.innerHTML = `<span class="challenge-target-label">${label}</span>`;
        card.appendChild(createArray(values || []));
        container.appendChild(card);
    }

    function routeEvent(event) {
        if (masteryEngine.isInteractionActive()) masteryEngine.operationCompleted(event);
        else teachingEngine.operationCompleted(event);
    }

    function insertionStep(values, index) {
        const result = [...values];
        const value = result[index];
        let position = index - 1;
        let shifts = 0;
        while (position >= 0 && result[position] > value) {
            result[position + 1] = result[position];
            position--;
            shifts++;
        }
        result[position + 1] = value;
        return { values: result, value, insertAt: position + 1, shifts };
    }

    function merge(left, right) {
        const result = [];
        let leftIndex = 0;
        let rightIndex = 0;
        while (leftIndex < left.length && rightIndex < right.length) {
            if (left[leftIndex] <= right[rightIndex]) result.push(left[leftIndex++]);
            else result.push(right[rightIndex++]);
        }
        return result.concat(left.slice(leftIndex), right.slice(rightIndex));
    }

    function createArrayOperationsPlayground() {
        const original = [...LESSON.playground.values];
        let values = [...original];
        let steps = [];
        let stepIndex = 0;
        let activeIndex = null;
        let lastMessage = "Choose an index to see how a fixed position stores a value.";
        let masteryMode = false;
        let scenario = null;

        function reset({ useScenario = false } = {}) {
            scenario = useScenario ? (scenario || {}) : null;
            values = useScenario
                ? [...(scenario?.values || scenario?.initial_state || original)]
                : [...original];
            steps = useScenario
                ? [...(scenario?.operations || scenario?.mental_simulation?.steps || [])]
                : [...(LESSON.playground.guided_steps || [])];
            stepIndex = 0;
            activeIndex = null;
            lastMessage = masteryMode
                ? "Use the available array operation to reach the target state."
                : "Indexes identify fixed positions in an array.";
            updateLegacyControl();
            render();
        }

        function updateLegacyControl() {
            const control = getControl("next-step");
            control.hidden = !masteryMode;
            control.onclick = () => next();
        }

        function render() {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view array-operations-view";
            const heading = document.createElement("p");
            heading.className = "curriculum-instruction";
            heading.textContent = lastMessage;
            const array = createArray(values, { active: activeIndex });
            stackDiv.append(heading, array);
            const step = steps[stepIndex];
            if (!masteryMode && step) {
                const hint = document.createElement("p");
                hint.className = "curriculum-instruction";
                hint.textContent = step.operation === "set-index"
                    ? `Click index ${step.index}, then enter the replacement value.`
                    : `Click index ${step.index} to read its value.`;
                stackDiv.appendChild(hint);
                array.querySelectorAll("[data-index]").forEach(cell => {
                    cell.addEventListener("click", () => {
                        if (!masteryMode && teachingEngine.guardPendingPrediction("next-step")) return;
                        const selectedIndex = Number(cell.dataset.index);
                        if (selectedIndex !== step.index) {
                            teachingEngine.setByteMessage(`That is index ${selectedIndex}. The current task uses index ${step.index}.`);
                            return;
                        }
                        if (step.operation === "set-index") {
                            const editor = document.createElement("div");
                            editor.className = "array-edit-panel";
                            editor.innerHTML = `<label>New value for index ${step.index}<input type="number" data-array-value value="${step.value}"></label><button type="button" data-array-commit>SET INDEX ${step.index}</button>`;
                            editor.querySelector("[data-array-commit]").addEventListener("click", () => {
                                const nextValue = Number(editor.querySelector("[data-array-value]").value);
                                if (!Number.isFinite(nextValue)) {
                                    teachingEngine.setByteMessage("Enter a numeric replacement value.");
                                    return;
                                }
                                const appliedStep = { ...step, value: nextValue };
                                applyStep(appliedStep);
                                stepIndex++;
                                render();
                                routeEvent({ operation: "next-step", value: nextValue, state: { values: [...values], outcome: stepIndex === steps.length ? "complete" : null }, feedback: lastMessage, progress: stepIndex < steps.length });
                            });
                            stackDiv.appendChild(editor);
                            return;
                        }
                        applyStep(step);
                        stepIndex++;
                        render();
                        routeEvent({ operation: "next-step", value: values[selectedIndex], state: { values: [...values], outcome: stepIndex === steps.length ? "complete" : null }, feedback: lastMessage, progress: stepIndex < steps.length });
                    });
                });
            }
        }

        function applyStep(step) {
            activeIndex = Number.isInteger(step?.index) ? step.index : null;
            if (step?.operation === "set-index") {
                values[step.index] = step.value;
                lastMessage = `Index ${step.index} now stores ${step.value}. Other positions stay the same.`;
            }
            else if (step?.operation === "read-index") {
                lastMessage = `Reading index ${step.index} returns ${values[step.index]}.`;
            }
            else {
                lastMessage = step?.label || "Follow the next array operation.";
            }
        }

        function next(operation = "next-step") {
            const step = steps[stepIndex];
            if (!step) {
                if (!masteryMode) {
                    reset();
                    setByteMessage("The array reset. Try the indexed operations again.");
                }
                return;
            }
            applyStep(step);
            stepIndex++;
            render();
            routeEvent({
                operation,
                value: step.value ?? values[activeIndex],
                state: { values: [...values], outcome: stepIndex === steps.length ? "complete" : null },
                feedback: lastMessage,
                progress: stepIndex < steps.length
            });
        }

        return {
            mount() { getControl("next-step").onclick = () => next(); reset(); },
            reset() { masteryMode = false; scenario = null; reset(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(nextScenario) { masteryMode = true; scenario = nextScenario || {}; reset({ useScenario: true }); },
            performMasteryOperation() { next("next-step"); },
            endMasteryMode() { masteryMode = false; scenario = null; reset(); },
            async replayExpertSimulation(simulation) {
                if (!simulation?.initial_state || !Array.isArray(simulation.steps)) return;
                masteryMode = true;
                scenario = { values: simulation.initial_state, operations: simulation.steps };
                reset({ useScenario: true });
                for (const step of simulation.steps) {
                    applyStep(step);
                    render();
                    await new Promise(resolve => window.setTimeout(resolve, 500));
                }
            },
            renderChallengeTarget(target, container) { appendArrayState(container, target.label || "TARGET ARRAY", target.items || []); },
            renderMasteryStates({ scenario: state, target }, container) {
                appendArrayState(container, "START ARRAY", state?.values || state?.initial_state || []);
                appendArrayState(container, target.label || "TARGET ARRAY", target.raw_state || target.items || scenario?.target_state || []);
            },
            renderExpertThinkingState({ initialState, labels }, container) { appendArrayState(container, labels.title || "STARTING ARRAY", initialState || []); }
        };
    }

    function createLinearSearchPlayground() {
        const original = [...LESSON.playground.values];
        const originalTarget = LESSON.playground.target;
        let values = [...original];
        let target = originalTarget;
        let index = 0;
        let outcome = null;
        let masteryMode = false;
        let scenario = null;

        function reset({ useScenario = false } = {}) {
            values = useScenario ? [...(scenario?.values || original)] : [...original];
            target = useScenario ? (scenario?.target ?? originalTarget) : originalTarget;
            index = 0;
            outcome = null;
            updateLegacyControl();
            render();
        }

        function updateLegacyControl() {
            const control = getControl("next-step");
            control.hidden = !masteryMode;
            control.onclick = runGuided;
        }

        function render() {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view linear-search-view";
            const heading = document.createElement("p");
            heading.className = "curriculum-instruction";
            heading.textContent = `Find ${target}. ${outcome === "found" ? "Target found." : outcome === "not_found" ? "Reached the end: target not found." : "Compare from left to right."}`;
            stackDiv.append(heading, createArray(values, { active: outcome ? null : index, faded: Array.from({ length: index }, (_, value) => value) }));
            if (!masteryMode && !outcome && Number.isFinite(values[index])) {
                const choices = document.createElement("div");
                choices.className = "search-decision-row";
                ["FOUND", "CONTINUE"].forEach(label => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = label;
                    button.addEventListener("click", () => chooseGuided(label.toLowerCase()));
                    choices.appendChild(button);
                });
                stackDiv.appendChild(choices);
            }
        }

        function state() { return { values: [...values], index, outcome }; }

        function runGuided() {
            if (outcome) {
                reset();
                return;
            }
            const value = values[index];
            if (value === target) outcome = "found";
            else if (index === values.length - 1) outcome = "not_found";
            else index++;
            render();
            routeEvent({ operation: "next-step", value, state: state(), feedback: outcome === "found" ? `${value} matches the target, so the search stops.` : outcome === "not_found" ? "Every value was compared; the target is not in this array." : `${value} is not the target, so continue to the next index.`, progress: !outcome });
        }

        function chooseGuided(operation) {
            if (outcome) return;
            if (teachingEngine.guardPendingPrediction("next-step")) return;
            const expected = expectedDecision();
            if (operation !== expected) {
                teachingEngine.setByteMessage(expected === "found"
                    ? "The highlighted value matches the target, so choose FOUND."
                    : "This value is not the target yet, so choose CONTINUE.");
                return;
            }
            const value = values[index];
            if (operation === "found") outcome = "found";
            else {
                index++;
                if (index >= values.length) outcome = "not_found";
            }
            render();
            routeEvent({ operation: "next-step", value, state: state(), feedback: outcome === "found" ? `${value} matches the target, so the search stops.` : outcome === "not_found" ? "Every value was compared; the target is not in this array." : `${value} is not the target, so continue to the next index.`, progress: !outcome });
        }

        function expectedDecision() {
            if (index >= values.length) return "not-found";
            return values[index] === target ? "found" : "continue";
        }

        function decide(operation) {
            const expected = expectedDecision();
            if (operation !== expected) {
                masteryEngine.operationCompleted({ operation, state: state(), feedback: expected === "found" ? "The highlighted value already matches the target." : expected === "not-found" ? "No values remain, so choose NOT FOUND." : "This value does not match yet; continue one position right." });
                return;
            }
            const value = values[index];
            if (operation === "found") outcome = "found";
            else if (operation === "continue") {
                index++;
                if (index >= values.length) outcome = "not_found";
            }
            else outcome = "not_found";
            render();
            masteryEngine.operationCompleted({ operation, value, state: state(), feedback: outcome === "found" ? "Found it: the highlighted value matches the target." : outcome === "not_found" ? "The search reached the end without a match." : "Correct. Move to the next value.", progress: !outcome, count: operation !== "not-found" });
        }

        return {
            mount() { getControl("next-step").onclick = runGuided; reset(); },
            reset() { masteryMode = false; scenario = null; reset(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(nextScenario) { masteryMode = true; scenario = nextScenario || {}; reset({ useScenario: true }); },
            performMasteryOperation(operation) { decide(operation); },
            endMasteryMode() { masteryMode = false; scenario = null; reset(); },
            async replayExpertSimulation(simulation) {
                if (!Array.isArray(simulation?.initial_state)) return;
                masteryMode = true;
                scenario = { values: simulation.initial_state, target: simulation.target };
                reset({ useScenario: true });
                for (const step of simulation.steps || []) {
                    index = step.index;
                    render();
                    await new Promise(resolve => window.setTimeout(resolve, 500));
                }
                outcome = simulation.next_pop_value;
                render();
            },
            renderChallengeTarget(targetConfig, container) { appendArrayState(container, targetConfig.label || "SEARCH TARGET", values); },
            renderMasteryStates({ scenario: state, target: targetConfig }, container) {
                appendArrayState(container, "START ARRAY", state?.values || []);
                const card = document.createElement("section");
                card.className = "mastery-state-card";
                card.innerHTML = `<span class="challenge-target-label">${targetConfig.label || "SEARCH TASK"}</span><p>Find <strong>${state?.target ?? target}</strong>, or prove it is absent.</p>`;
                container.appendChild(card);
            },
            renderExpertThinkingState({ initialState, target: expertTarget, labels }, container) {
                appendArrayState(container, labels.title || "STARTING ARRAY", initialState || []);
                const card = document.createElement("section");
                card.className = "mastery-state-card";
                card.innerHTML = `<span class="challenge-target-label">TARGET</span><p>${expertTarget}</p>`;
                container.appendChild(card);
            }
        };
    }

    function createInsertionSortPlayground() {
        const original = [...LESSON.playground.values];
        let values = [...original];
        let index = 1;
        let masteryMode = false;
        let scenario = null;
        let guidedStage = "compare";
        let pendingKey = null;
        let compareIndex = null;

        function reset({ useScenario = false } = {}) {
            values = useScenario ? [...(scenario?.values || original)] : [...original];
            index = 1;
            guidedStage = "compare";
            pendingKey = null;
            compareIndex = null;
            updateLegacyControl();
            render("The first value starts the sorted prefix.");
        }

        function updateLegacyControl() {
            const control = getControl("next-step");
            control.hidden = !masteryMode;
            control.onclick = () => next();
        }

        function render(message) {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view insertion-sort-view";
            const heading = document.createElement("p");
            heading.className = "curriculum-instruction";
            heading.textContent = message || (index >= values.length ? "The whole array is sorted." : `Insert ${values[index]} into the sorted prefix on the left.`);
            stackDiv.append(heading, createArray(values, { active: index < values.length ? index : null, sortedPrefix: Math.min(index, values.length) }));

            if (!masteryMode && index < values.length) {
                const panel = document.createElement("div");
                panel.className = "hash-decision-panel insertion-decision-panel";
                if (guidedStage === "compare") {
                    const key = values[index];
                    pendingKey = key;
                    compareIndex = index - 1;
                    guidedStage = "decide";
                }
                if (guidedStage === "decide") {
                    const leftValue = compareIndex >= 0 ? values[compareIndex] : null;
                    panel.innerHTML = leftValue === null
                        ? `<strong>${pendingKey} has reached the start of the prefix.</strong><button type="button" data-insert-decision="insert">INSERT HERE</button>`
                        : `<strong>Current key: ${pendingKey}</strong><p>Compare it with ${leftValue}. Should the prefix value shift right?</p><div class="hash-collision-choices"><button type="button" data-insert-decision="shift">SHIFT ${leftValue}</button><button type="button" data-insert-decision="insert">INSERT ${pendingKey}</button></div>`;
                    panel.querySelectorAll("[data-insert-decision]").forEach(button => button.addEventListener("click", () => decideGuided(button.dataset.insertDecision)));
                }
                stackDiv.appendChild(panel);
            }
        }

        function decideGuided(decision) {
            if (!Number.isFinite(pendingKey)) return;
            if (teachingEngine.guardPendingPrediction("next-step")) return;
            const leftValue = compareIndex >= 0 ? values[compareIndex] : null;
            const expected = leftValue !== null && leftValue > pendingKey ? "shift" : "insert";
            if (decision !== expected) {
                teachingEngine.setByteMessage(expected === "shift"
                    ? `${leftValue} is larger than ${pendingKey}. Shift it right to make room.`
                    : `${leftValue === null ? "No values remain" : `${leftValue} is not larger than ${pendingKey}`}. Insert the key here.`);
                return;
            }

            if (decision === "shift") {
                values[compareIndex + 1] = values[compareIndex];
                compareIndex--;
                render(`${values[compareIndex + 1]} shifted right. Compare ${pendingKey} with the next value to the left.`);
                return;
            }

            values[compareIndex + 1] = pendingKey;
            const inserted = pendingKey;
            index++;
            pendingKey = null;
            compareIndex = null;
            guidedStage = "compare";
            const complete = index >= values.length;
            const feedback = complete
                ? "Every value is in ascending order. The array is sorted."
                : `${inserted} was inserted into the sorted prefix. Choose the next key.`;
            render(feedback);
            routeEvent({ operation: "next-step", value: inserted, state: { values: [...values], outcome: complete ? "sorted" : null }, feedback, progress: !complete });
        }

        function next(operation = "next-step") {
            if (!masteryMode) {
                teachingEngine.setByteMessage("Use SHIFT or INSERT in the insertion panel.");
                return;
            }
            if (index >= values.length) {
                if (!masteryMode) reset();
                return;
            }
            const step = insertionStep(values, index);
            values = step.values;
            index++;
            const outcome = index >= values.length ? "sorted" : null;
            const feedback = `${step.value} was inserted at position ${step.insertAt}; ${step.shifts} larger value${step.shifts === 1 ? "" : "s"} shifted right.`;
            render(feedback);
            routeEvent({ operation, value: step.value, state: { values: [...values], outcome }, feedback, progress: !outcome });
        }

        return {
            mount() { reset(); },
            reset() { masteryMode = false; scenario = null; reset(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(nextScenario) { masteryMode = true; scenario = nextScenario || {}; reset({ useScenario: true }); },
            performMasteryOperation() { next("insert-next"); },
            endMasteryMode() { masteryMode = false; scenario = null; reset(); },
            async replayExpertSimulation(simulation) {
                if (!Array.isArray(simulation?.initial_state)) return;
                masteryMode = true;
                scenario = { values: simulation.initial_state };
                reset({ useScenario: true });
                for (const step of simulation.steps || []) {
                    values = [...step.state];
                    index = step.index + 1;
                    render(step.label);
                    await new Promise(resolve => window.setTimeout(resolve, 500));
                }
            },
            renderChallengeTarget(target, container) { appendArrayState(container, target.label || "TARGET ARRAY", target.items || []); },
            renderMasteryStates({ scenario: state, target }, container) {
                appendArrayState(container, "START ARRAY", state?.values || []);
                appendArrayState(container, target.label || "TARGET ARRAY", target.raw_state || target.items || scenario?.target_state || []);
            },
            renderExpertThinkingState({ initialState, labels }, container) { appendArrayState(container, labels.title || "STARTING ARRAY", initialState || []); }
        };
    }

    function createMergeSortPlayground() {
        const original = [...LESSON.playground.values];
        let values = [...original];
        let phase = 0;
        let guidedStage = "split";
        let leftWork = [];
        let rightWork = [];
        let leftSorted = [];
        let rightSorted = [];
        let mergedValues = [];
        let simulation = null;
        let masteryMode = false;
        let scenario = null;

        function buildSimulation(input) {
            const middle = Math.floor(input.length / 2);
            const leftRaw = input.slice(0, middle);
            const rightRaw = input.slice(middle);
            const left = leftRaw.slice().sort((a, b) => a - b);
            const right = rightRaw.slice().sort((a, b) => a - b);
            return { leftRaw, rightRaw, left, right, finalState: merge(left, right) };
        }

        function reset({ useScenario = false } = {}) {
            values = useScenario ? [...(scenario?.values || original)] : [...original];
            phase = 0;
            simulation = buildSimulation(values);
            leftWork = [...simulation.leftRaw];
            rightWork = [...simulation.rightRaw];
            leftSorted = [];
            rightSorted = [];
            mergedValues = [];
            guidedStage = "split";
            updateLegacyControl();
            renderGuided("Choose where the array should split into two halves.");
        }

        function updateLegacyControl() {
            const control = getControl("next-step");
            control.hidden = !masteryMode;
            control.onclick = () => nextMasteryStage();
        }

        function renderMastery(message) {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view merge-sort-view";
            const heading = document.createElement("p");
            heading.className = "curriculum-instruction";
            heading.textContent = message;
            const stages = document.createElement("div");
            stages.className = "merge-stages";
            const source = document.createElement("p");
            source.innerHTML = `<strong>ARRAY</strong> [${values.join(", ")}]`;
            stages.appendChild(source);
            if (phase >= 1) stages.insertAdjacentHTML("beforeend", `<p><strong>SPLIT</strong> [${simulation.leftRaw.join(", ")}] &nbsp; | &nbsp; [${simulation.rightRaw.join(", ")}]</p>`);
            if (phase >= 2) stages.insertAdjacentHTML("beforeend", `<p><strong>SORTED HALVES</strong> [${simulation.left.join(", ")}] &nbsp; | &nbsp; [${simulation.right.join(", ")}]</p>`);
            if (phase >= 3) stages.insertAdjacentHTML("beforeend", `<p><strong>MERGED</strong> [${simulation.finalState.join(", ")}]</p>`);
            stackDiv.append(heading, stages);
        }

        function appendChoice(container, value, label = value) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "merge-choice";
            button.dataset.mergeChoice = value;
            button.textContent = label;
            container.appendChild(button);
            return button;
        }

        function guidedEvent(value, outcome = null, feedback = "") {
            renderGuided(feedback);
            routeEvent({
                operation: "next-step",
                value,
                state: { values: [...values], outcome },
                feedback,
                progress: !outcome
            });
        }

        function renderGuided(message) {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view merge-sort-view merge-sort-guided-view";
            const heading = document.createElement("p");
            heading.className = "curriculum-instruction";
            heading.textContent = message;

            const stages = document.createElement("div");
            stages.className = "merge-stages";
            const source = document.createElement("p");
            source.innerHTML = `<strong>ARRAY</strong> [${values.join(", ")}]`;
            stages.appendChild(source);

            if (guidedStage === "split") {
                stages.insertAdjacentHTML("beforeend", `<p><strong>YOUR DECISION</strong> Choose a split that gives two workable halves.</p>`);
                const choices = document.createElement("div");
                choices.className = "merge-choice-row";
                [1, simulation.leftRaw.length, values.length - 1].filter((value, index, list) => (
                    value > 0 && value < values.length && list.indexOf(value) === index
                )).forEach(splitAfter => {
                    const left = values.slice(0, splitAfter);
                    const right = values.slice(splitAfter);
                    const button = appendChoice(choices, splitAfter, `[${left.join(", ")}] | [${right.join(", ")}]`);
                    button.addEventListener("click", () => {
                        if (teachingEngine.guardPendingPrediction("next-step")) return;
                        if (splitAfter !== simulation.leftRaw.length) {
                            teachingEngine.setByteMessage("Use the middle so Merge Sort can work on two balanced halves.");
                            return;
                        }
                        guidedStage = "sort-left";
                        guidedEvent("Split the array", null, "Correct. Now build the sorted left half by choosing its smaller value first.");
                    });
                });
                stages.appendChild(choices);
            }
            else if (guidedStage === "sort-left" || guidedStage === "sort-right") {
                const isLeft = guidedStage === "sort-left";
                const work = isLeft ? leftWork : rightWork;
                const sorted = isLeft ? leftSorted : rightSorted;
                const label = isLeft ? "LEFT HALF" : "RIGHT HALF";
                stages.insertAdjacentHTML("beforeend", `<p><strong>${label}</strong> [${work.join(", ")}]</p>`);
                stages.insertAdjacentHTML("beforeend", `<p>Choose the smallest remaining value for this half.</p>`);
                const choices = document.createElement("div");
                choices.className = "merge-choice-row";
                work.forEach(valueToChoose => appendChoice(choices, valueToChoose, valueToChoose));
                choices.querySelectorAll("button").forEach(button => {
                        button.addEventListener("click", () => {
                            if (teachingEngine.guardPendingPrediction("next-step")) return;
                            const selected = Number(button.dataset.mergeChoice);
                        const expected = Math.min(...work);
                        if (selected !== expected) {
                            teachingEngine.setByteMessage(`${selected} is not the smallest remaining value. Compare the two values again.`);
                            return;
                        }
                        const wasEmpty = !sorted.length;
                        work.splice(work.indexOf(selected), 1);
                        sorted.push(selected);
                        if (!work.length) {
                            if (isLeft) guidedStage = "sort-right";
                            else guidedStage = "merge";
                        }
                        const eventValue = isLeft && wasEmpty ? "Sort each half" : selected;
                        guidedEvent(eventValue, null, `${selected} belongs next in the sorted ${isLeft ? "left" : "right"} half.`);
                    });
                });
                stages.appendChild(choices);
                if (sorted.length) stages.insertAdjacentHTML("beforeend", `<p><strong>SORTED SO FAR</strong> [${sorted.join(", ")}]</p>`);
            }
            else if (guidedStage === "merge") {
                stages.insertAdjacentHTML("beforeend", `<p><strong>LEFT</strong> [${leftSorted.join(", ")}] &nbsp; | &nbsp; <strong>RIGHT</strong> [${rightSorted.join(", ")}]</p>`);
                stages.insertAdjacentHTML("beforeend", `<p><strong>MERGED SO FAR</strong> [${mergedValues.join(", ") || "empty"}]</p>`);
                const candidates = [leftSorted[0], rightSorted[0]].filter(Number.isFinite);
                const choices = document.createElement("div");
                choices.className = "merge-choice-row";
                [...new Set(candidates)].forEach(valueToChoose => appendChoice(choices, valueToChoose, valueToChoose));
                choices.querySelectorAll("button").forEach(button => {
                        button.addEventListener("click", () => {
                            if (teachingEngine.guardPendingPrediction("next-step")) return;
                            const selected = Number(button.dataset.mergeChoice);
                        const expected = Math.min(...candidates);
                        if (selected !== expected) {
                            teachingEngine.setByteMessage(`${selected} is not the smaller front value. Choose the smaller available value.`);
                            return;
                        }
                        if (leftSorted[0] === selected) leftSorted.shift();
                        else rightSorted.shift();
                        mergedValues.push(selected);
                        const complete = !leftSorted.length && !rightSorted.length;
                        if (complete) {
                            values = [...mergedValues];
                            guidedStage = "complete";
                        }
                        guidedEvent(selected, complete ? "sorted" : null, complete ? "The merge is complete: every value is now in sorted order." : `${selected} entered the merged array because it was the smaller front value.`);
                    });
                });
                stages.appendChild(choices);
            }
            else {
                stages.insertAdjacentHTML("beforeend", `<p><strong>SORTED</strong> [${values.join(", ")}]</p>`);
            }

            stackDiv.append(heading, stages);
        }

        function nextMasteryStage(operation = "next-step") {
            if (phase >= 3) {
                if (!masteryMode) reset();
                return;
            }
            phase++;
            const labels = ["", "Divide the array into two smaller halves.", "Sort the two halves independently.", "Merge by repeatedly taking the smaller front value."];
            if (phase === 3) values = [...simulation.finalState];
            const outcome = phase === 3 ? "sorted" : null;
            renderMastery(labels[phase]);
            const stepValue = phase === 1
                ? "Split the array"
                : phase === 2
                    ? "Sort each half"
                    : "Merge the halves";
            routeEvent({ operation, value: stepValue, state: { values: [...values], outcome }, feedback: labels[phase], progress: !outcome });
        }

        return {
            mount() { reset(); },
            reset() { masteryMode = false; scenario = null; reset(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(nextScenario) { masteryMode = true; scenario = nextScenario || {}; reset({ useScenario: true }); },
            performMasteryOperation() { nextMasteryStage("next-step"); },
            endMasteryMode() { masteryMode = false; scenario = null; reset(); },
            async replayExpertSimulation(simulationData) {
                if (!Array.isArray(simulationData?.initial_state)) return;
                masteryMode = true;
                scenario = { values: simulationData.initial_state };
                reset({ useScenario: true });
                for (const step of simulationData.steps || []) {
                    phase = step.operation === "split" ? 1 : step.operation === "sort-halves" ? 2 : 3;
                    if (phase === 3) values = [...simulationData.final_state];
                    renderMastery(step.label);
                    await new Promise(resolve => window.setTimeout(resolve, 500));
                }
            },
            renderChallengeTarget(target, container) { appendArrayState(container, target.label || "TARGET ARRAY", target.items || []); },
            renderMasteryStates({ scenario: state, target }, container) {
                appendArrayState(container, "START ARRAY", state?.values || []);
                appendArrayState(container, target.label || "TARGET ARRAY", target.raw_state || target.items || scenario?.target_state || []);
            },
            renderExpertThinkingState({ initialState, labels }, container) { appendArrayState(container, labels.title || "STARTING ARRAY", initialState || []); }
        };
    }

    registerPlayground("array-operations", createArrayOperationsPlayground);
    registerPlayground("linear-search", createLinearSearchPlayground);
    registerPlayground("insertion-sort", createInsertionSortPlayground);
    registerPlayground("merge-sort", createMergeSortPlayground);
})();
