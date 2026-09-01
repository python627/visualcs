function createBinarySearchPlayground() {

    const lessonValues = [...LESSON.playground.values];
    const lessonTarget = LESSON.playground.target;

    let values = [...lessonValues];
    let target = lessonTarget;
    let low = 0;
    let high = values.length - 1;
    let middle = null;
    let phase = "check";
    let targetFound = false;
    let outcome = null;
    let masteryMode = false;
    let decisionFeedback = "";
    let replayToken = 0;

    function getMiddle() {
        return low <= high ? Math.floor((low + high) / 2) : null;
    }


    function createArray(valuesToRender, {
        lowBound = 0,
        highBound = valuesToRender.length - 1,
        middleIndex = null,
        foundIndex = null
    } = {}) {
        const array = document.createElement("div");
        array.className = "binary-search-array";

        valuesToRender.forEach((value, index) => {
            const item = document.createElement("div");
            item.className = "search-value";
            item.textContent = value;

            if (index < lowBound || index > highBound) {
                item.classList.add("eliminated");
            }

            if (index === middleIndex) {
                item.classList.add("middle");
            }

            if (index === foundIndex) {
                item.classList.add("found");
            }

            array.appendChild(item);
        });

        return array;
    }


    function render() {
        stackDiv.innerHTML = "";
        stackDiv.className = "binary-search-view";

        const targetLabel = document.createElement("p");
        targetLabel.className = "binary-search-target";
        targetLabel.textContent = masteryMode
            ? `Target: ${target}`
            : `Find ${target}`;

        const activeMiddle = middle ?? (masteryMode ? getMiddle() : null);
        const foundIndex = outcome === "found" ? activeMiddle : null;
        const array = createArray(values, {
            lowBound: low,
            highBound: high,
            middleIndex: activeMiddle,
            foundIndex
        });

        stackDiv.append(targetLabel, array);

        if (masteryMode) {
            const status = document.createElement("p");
            status.className = "binary-search-status";

            if (outcome === "found") {
                status.textContent = `Found ${target} at the current middle value.`;
            }
            else if (outcome === "not_found") {
                status.textContent = "No candidate values remain.";
            }
            else if (activeMiddle === null) {
                status.textContent = "The search area is empty. Decide whether the target was found.";
            }
            else {
                status.textContent = `Current middle: ${values[activeMiddle]}`;
            }

            stackDiv.appendChild(status);

            if (decisionFeedback) {
                const feedback = document.createElement("p");
                feedback.className = "binary-search-decision-feedback";
                feedback.textContent = decisionFeedback;
                stackDiv.appendChild(feedback);
            }
        }
    }


    function resetLessonSearch() {
        replayToken++;
        values = [...lessonValues];
        target = lessonTarget;
        low = 0;
        high = values.length - 1;
        middle = null;
        phase = "check";
        targetFound = false;
        outcome = null;
        masteryMode = false;
        decisionFeedback = "";
        render();
    }


    function resetMasterySearch(scenario = {}) {
        replayToken++;
        values = [...(scenario.values || lessonValues)];
        target = scenario.target ?? lessonTarget;
        low = 0;
        high = values.length - 1;
        middle = getMiddle();
        phase = "decision";
        targetFound = false;
        outcome = null;
        masteryMode = true;
        decisionFeedback = "";
        render();
    }


    function nextStep() {
        if (masteryMode) {
            setByteMessage("Choose a search decision from the mastery controls.");
            return;
        }

        if (targetFound) {
            resetLessonSearch();
            setByteMessage("Search reset. Use NEXT STEP to check the middle value again.");
            return;
        }

        if (phase === "check") {
            middle = Math.floor((low + high) / 2);
            render();

            const missionResult = completeAction("check-middle");

            if (values[middle] === target) {
                phase = "find";

                if (!missionResult.complete) {
                    setByteMessage(`${target} is the middle value. Use NEXT STEP to confirm the target.`);
                }
            }
            else {
                phase = "eliminate";

                if (!missionResult.complete) {
                    setByteMessage(`The middle value is ${values[middle]}. Compare it with ${target}.`);
                }
            }

            return;
        }

        if (phase === "eliminate") {
            const middleValue = values[middle];

            if (target > middleValue) {
                low = middle + 1;
            }
            else {
                high = middle - 1;
            }

            render();

            const missionResult = completeAction("eliminate-half");
            phase = "check";

            if (!missionResult.complete) {
                setByteMessage("The faded values cannot contain the target. Check the middle of what remains.");
            }

            return;
        }

        targetFound = true;
        render();

        const missionResult = completeAction("find-target");

        if (!missionResult.complete) {
            setByteMessage(`You found ${target}!`);
        }
    }


    function expectedDecision() {
        if (low > high) {
            return "not-found";
        }

        middle = getMiddle();
        const middleValue = values[middle];

        if (target === middleValue) {
            return "found";
        }

        return target < middleValue ? "left" : "right";
    }


    function describeCorrectDecision(decision) {
        if (decision === "not-found") {
            return "The search area is empty, so the target is not in this array.";
        }

        const middleValue = values[middle];

        if (decision === "found") {
            return `${target} matches the middle value ${middleValue}.`;
        }

        return target < middleValue
            ? `${target} is smaller than ${middleValue}, so only the left half can still contain it.`
            : `${target} is larger than ${middleValue}, so only the right half can still contain it.`;
    }


    function describeIncorrectDecision(expected) {
        if (expected === "not-found") {
            return "No values remain. NOT FOUND is the only valid conclusion now.";
        }

        const middleValue = values[middle];

        if (expected === "found") {
            return `${middleValue} already matches the target. Choose FOUND.`;
        }

        return target < middleValue
            ? `${target} is smaller than ${middleValue}. Keep the left half.`
            : `${target} is larger than ${middleValue}. Keep the right half.`;
    }


    function getMasteryState() {
        return {
            outcome,
            values: [...values],
            target,
            low,
            high,
            middle: middle ?? getMiddle()
        };
    }


    function performMasteryOperation(operation) {
        if (!masteryMode) {
            return;
        }

        const expected = expectedDecision();

        if (operation !== expected) {
            decisionFeedback = describeIncorrectDecision(expected);
            render();
            masteryEngine.operationCompleted({
                operation,
                state: getMasteryState(),
                feedback: decisionFeedback,
                progress: false
            });
            return;
        }

        if (operation === "left") {
            high = middle - 1;
            middle = getMiddle();
        }
        else if (operation === "right") {
            low = middle + 1;
            middle = getMiddle();
        }
        else if (operation === "found") {
            outcome = "found";
        }
        else if (operation === "not-found") {
            outcome = "not_found";
        }

        decisionFeedback = describeCorrectDecision(operation);
        render();
        masteryEngine.operationCompleted({
            operation,
            state: getMasteryState(),
            feedback: decisionFeedback,
            progress: operation === "left" || operation === "right",
            // Reaching an empty range does not compare another middle value.
            count: operation !== "not-found"
        });
    }


    function pause(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }


    async function replayExpertSimulation(simulation) {
        if (!simulation || !Array.isArray(simulation.values) || !Array.isArray(simulation.steps)) {
            return;
        }

        resetMasterySearch({ values: simulation.values, target: simulation.target });
        const token = replayToken;

        for (const step of simulation.steps) {
            if (token !== replayToken) {
                return;
            }

            low = step.low;
            high = step.high;
            middle = step.middle;
            decisionFeedback = step.label || "";
            render();
            await pause(700);
        }

        if (token !== replayToken) {
            return;
        }

        outcome = simulation.outcome;
        if (outcome === "not_found") {
            low = simulation.final_low;
            high = simulation.final_high;
            middle = null;
        }

        decisionFeedback = simulation.result_label || "";
        render();
    }


    function renderMasteryArray(valuesToRender, className = "binary-mastery-array") {
        const array = document.createElement("div");
        array.className = className;

        valuesToRender.forEach(value => {
            const item = document.createElement("span");
            item.textContent = value;
            array.appendChild(item);
        });

        return array;
    }


    function renderExpertThinkingState({ values: thinkingValues, target: thinkingTarget, labels }, container) {
        if (!container || !Array.isArray(thinkingValues)) {
            return;
        }

        const card = document.createElement("section");
        card.className = "mastery-state-card binary-expert-start";

        const heading = document.createElement("span");
        heading.className = "challenge-target-label";
        heading.textContent = labels?.title || "Starting Array";

        const targetLabel = document.createElement("p");
        targetLabel.className = "binary-expert-target";
        targetLabel.textContent = `${labels?.target || "Target"}: ${thinkingTarget}`;

        card.append(heading, targetLabel, renderMasteryArray(thinkingValues));
        container.appendChild(card);
    }


    function renderMasteryStates({ scenario, target: challengeTarget }, container) {
        if (!container) {
            return;
        }

        const scenarioValues = scenario?.values || values;
        const scenarioTarget = scenario?.target ?? target;
        const task = document.createElement("section");
        task.className = "mastery-state-card binary-mastery-task";
        task.innerHTML = `<span class="challenge-target-label">SEARCH TASK</span><p>Find: <strong>${scenarioTarget}</strong></p>`;
        task.appendChild(renderMasteryArray(scenarioValues));

        const decisionGuide = document.createElement("section");
        decisionGuide.className = "mastery-state-card binary-mastery-guide";
        decisionGuide.innerHTML = `
            <span class="challenge-target-label">MAKE A DECISION</span>
            <p>Compare the target with the highlighted middle value.</p>
            <p>Smaller → LEFT · Equal → FOUND · Larger → RIGHT</p>
        `;

        if (challengeTarget?.description) {
            const detail = document.createElement("p");
            detail.className = "challenge-target-description";
            detail.textContent = challengeTarget.description;
            decisionGuide.appendChild(detail);
        }

        container.append(task, decisionGuide);
    }


    return {
        mount() {
            getControl("next-step").onclick = nextStep;
            render();
        },
        reset() {
            resetLessonSearch();
        },
        resetForChallenge() {
            resetLessonSearch();
        },
        configureMasteryScenario(scenario) {
            resetMasterySearch(scenario);
        },
        performMasteryOperation,
        replayExpertSimulation,
        renderExpertThinkingState,
        renderMasteryStates
    };

}


registerPlayground("binary-search", createBinarySearchPlayground);
