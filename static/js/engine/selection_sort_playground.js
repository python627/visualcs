function createSelectionSortPlayground() {

    const originalValues = [...LESSON.playground.values];
    let values = [...originalValues];
    let passIndex = 0;
    let sortedCount = 0;
    let activeIndices = [];
    let selectedIndex = null;
    let sortFinished = false;
    let busy = false;
    let masteryMode = false;
    let masteryScenario = null;
    let replayToken = 0;

    function minimumIndex(startIndex) {
        let minimum = startIndex;

        for (let index = startIndex + 1; index < values.length; index++) {
            if (values[index] < values[minimum]) {
                minimum = index;
            }
        }

        return minimum;
    }

    function render({ swapping = false, statusText = null } = {}) {
        stackDiv.innerHTML = "";
        stackDiv.className = "selection-sort-view";

        const instruction = document.createElement("p");
        instruction.className = "selection-sort-instruction";
        instruction.textContent = statusText || (
            sortFinished
                ? "The array is sorted. Start again whenever you want to practise another run."
                : "Each pass selects the smallest value that is still unsorted."
        );

        const array = document.createElement("div");
        array.className = "selection-sort-array";

        values.forEach((value, index) => {
            const item = document.createElement("span");
            item.className = "selection-sort-value";
            item.textContent = value;
            if (index < sortedCount) item.classList.add("sorted");
            if (activeIndices.includes(index)) item.classList.add("scanning");
            if (selectedIndex === index) item.classList.add("minimum");
            if (swapping && (index === passIndex || index === selectedIndex)) {
                item.classList.add("swapping");
            }
            array.appendChild(item);
        });

        stackDiv.append(instruction, array);
    }

    function getArrayItems() {
        return [...stackDiv.querySelectorAll(".selection-sort-value")];
    }

    function animatePlacement(previousRects, destinationIndex, sourceIndex) {
        const items = getArrayItems();
        const destination = items[destinationIndex];
        const source = items[sourceIndex];

        if (!destination || !source || typeof destination.animate !== "function") {
            return;
        }

        const destinationRect = destination.getBoundingClientRect();
        const sourceRect = source.getBoundingClientRect();
        destination.animate([
            { transform: `translateX(${previousRects[sourceIndex].left - destinationRect.left}px)` },
            { transform: "translateX(0)" }
        ], { duration: 420, easing: "ease-out" });
        source.animate([
            { transform: `translateX(${previousRects[destinationIndex].left - sourceRect.left}px)` },
            { transform: "translateX(0)" }
        ], { duration: 420, easing: "ease-out" });
    }

    function resetSort({ useScenario = false } = {}) {
        values = useScenario && Array.isArray(masteryScenario?.values)
            ? [...masteryScenario.values]
            : useScenario && Array.isArray(masteryScenario?.initial_state)
                ? [...masteryScenario.initial_state]
                : [...originalValues];
        passIndex = 0;
        sortedCount = 0;
        activeIndices = [];
        selectedIndex = null;
        sortFinished = values.length < 2;
        busy = false;
        render();
    }

    function reportPass(operation, selectedValue) {
        const event = {
            operation,
            value: selectedValue,
            state: {
                outcome: sortFinished ? "sorted" : null,
                values: [...values]
            },
            feedback: sortFinished
                ? "Every value now has a final position."
                : "One smallest remaining value is now fixed on the left.",
            progress: !sortFinished
        };

        if (masteryEngine.isInteractionActive()) {
            masteryEngine.operationCompleted(event);
        }
        else {
            teachingEngine.operationCompleted(event);
        }
    }

    function runPass(operation = "next-step") {
        if (busy) {
            return;
        }

        // Expert thinking is deliberately mental: the live array must not
        // reveal the answer before the learner submits a prediction.
        if (masteryMode && !masteryEngine.isInteractionActive()) {
            return;
        }

        if (!masteryEngine.isInteractionActive()) {
            const preparation = teachingEngine.prepareOperation(operation);
            if (preparation.blocked) {
                return;
            }
        }

        if (sortFinished) {
            if (!masteryEngine.isInteractionActive()) {
                resetSort();
            }
            return;
        }

        busy = true;
        const currentPass = passIndex;
        const smallestIndex = minimumIndex(currentPass);
        const selectedValue = values[smallestIndex];
        activeIndices = Array.from(
            { length: values.length - currentPass },
            (_, offset) => currentPass + offset
        );
        selectedIndex = smallestIndex;
        render({
            statusText: `${selectedValue} is the smallest value still available for position ${currentPass + 1}.`
        });

        window.setTimeout(() => {
            const previousRects = getArrayItems().map(item => item.getBoundingClientRect());

            if (smallestIndex !== currentPass) {
                [values[currentPass], values[smallestIndex]] = [
                    values[smallestIndex],
                    values[currentPass]
                ];
            }

            sortedCount = currentPass + 1;
            passIndex++;
            sortFinished = passIndex >= values.length - 1;
            if (sortFinished) {
                sortedCount = values.length;
            }
            activeIndices = [];
            selectedIndex = smallestIndex === currentPass ? currentPass : null;
            render({
                swapping: smallestIndex !== currentPass,
                statusText: sortFinished
                    ? "Every value is in ascending order."
                    : `${selectedValue} is fixed. The next pass will choose from the remaining values.`
            });

            if (smallestIndex !== currentPass) {
                animatePlacement(previousRects, currentPass, smallestIndex);
            }

            busy = false;
            reportPass(operation, selectedValue);
        }, 430);
    }

    function renderArrayCard(title, items, container) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        const label = document.createElement("span");
        label.className = "challenge-target-label";
        label.textContent = title;
        const array = document.createElement("p");
        array.className = "mastery-array-state";
        array.textContent = `[${(items || []).join(", ")}]`;
        card.append(label, array);
        container.appendChild(card);
    }

    function pause(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    return {
        mount() {
            getControl("next-step").onclick = () => runPass("next-step");
            render();
        },
        reset() {
            replayToken++;
            masteryMode = false;
            masteryScenario = null;
            resetSort();
        },
        resetForChallenge() {
            this.reset();
        },
        configureMasteryScenario(scenario) {
            replayToken++;
            masteryMode = true;
            masteryScenario = scenario || {};
            resetSort({ useScenario: true });
        },
        performMasteryOperation(operation) {
            if (operation === "next-step") {
                runPass(operation);
            }
        },
        endMasteryMode() {
            masteryMode = false;
            masteryScenario = null;
            resetSort();
        },
        async replayExpertSimulation(simulation) {
            if (!simulation || !Array.isArray(simulation.initial_state) || !Array.isArray(simulation.steps)) {
                return;
            }

            const token = ++replayToken;
            masteryMode = true;
            masteryScenario = { values: simulation.initial_state };
            resetSort({ useScenario: true });

            for (const step of simulation.steps) {
                await pause(450);
                if (token !== replayToken) {
                    return;
                }
                values = [...step.state];
                passIndex = step.pass + 1;
                sortedCount = passIndex;
                selectedIndex = null;
                sortFinished = passIndex >= values.length - 1;
                if (sortFinished) sortedCount = values.length;
                render({ statusText: step.label });
            }
        },
        renderExpertThinkingState({ initialState, labels }, container) {
            renderArrayCard(labels.title || "Starting Array", initialState, container);
        },
        renderMasteryStates({ scenario, target }, container) {
            renderArrayCard("START ARRAY", scenario?.values || scenario?.initial_state || [], container);
            renderArrayCard(
                target.label || "TARGET ARRAY",
                target.raw_state || target.items || masteryScenario?.target_state || [],
                container
            );
        },
        renderChallengeTarget(target, container) {
            renderArrayCard(target.label || "TARGET ARRAY", target.items || [], container);
        }
    };
}


const selectionSortExpertGenerator = {
    version: 1,

    generate({ random, rules }) {
        const length = Number.isInteger(rules?.length) ? rules.length : 5;
        const pool = [14, 23, 31, 42, 57, 68, 76, 89, 95];
        const values = [];

        while (values.length < Math.min(length, pool.length)) {
            const index = Math.floor(random() * pool.length);
            const value = pool[index];
            if (!values.includes(value)) values.push(value);
        }

        // A sorted start would not make for a meaningful selection challenge.
        if (values.every((value, index) => index === 0 || values[index - 1] < value)) {
            [values[0], values[1]] = [values[1], values[0]];
        }

        const working = [...values];
        const steps = [];

        for (let pass = 0; pass < working.length - 1; pass++) {
            let smallestIndex = pass;
            for (let index = pass + 1; index < working.length; index++) {
                if (working[index] < working[smallestIndex]) smallestIndex = index;
            }
            const selectedValue = working[smallestIndex];
            [working[pass], working[smallestIndex]] = [working[smallestIndex], working[pass]];
            steps.push({
                operation: "select-minimum",
                pass,
                value: selectedValue,
                state: [...working],
                label: `Pass ${pass + 1}: place ${selectedValue} in position ${pass + 1}`
            });
        }

        return {
            initial_state: values,
            target_state: [...working],
            first_minimum: steps[0]?.value ?? null,
            optimal_operations: steps.length,
            mental_simulation: {
                initial_state: values,
                steps,
                final_state: [...working],
                next_pop_value: steps[0]?.value ?? null
            }
        };
    },

    getMentalSimulation(data) {
        return data?.mental_simulation || null;
    },

    validateScenario(data, simulation) {
        if (!Array.isArray(data?.initial_state) || !Array.isArray(data?.target_state)) {
            throw new Error("Selection Sort Expert needs an initial and target array.");
        }
        if (!Array.isArray(simulation?.steps) || simulation.steps.length !== data.initial_state.length - 1) {
            throw new Error("Selection Sort Expert needs one simulated pass per final position.");
        }
        if (JSON.stringify(simulation.final_state) !== JSON.stringify(data.target_state)) {
            throw new Error("Selection Sort Expert simulation does not reach its target array.");
        }
    },

    evaluatePrediction(data, response) {
        const finalState = data?.target_state || [];
        const firstMinimum = data?.first_minimum;
        const correctFinalState = JSON.stringify(response?.finalState) === JSON.stringify(finalState);
        const correctFirstMinimum = Number(response?.firstMinimum) === Number(firstMinimum);

        return {
            correctFinalState,
            correctNextPop: correctFirstMinimum,
            actualFinalState: finalState,
            actualNextPop: firstMinimum,
            feedback: correctFinalState && correctFirstMinimum
                ? "You correctly simulated every Selection Sort pass."
                : "Selection Sort places the smallest remaining value on each pass. Compare the start of every remaining section."
        };
    },

    createExecutionChallenge(data, definition) {
        return {
            phases: [{
                title: definition?.solve?.title || "Expert Selection Sort",
                instruction: definition?.solve?.instruction || "Sort the array.",
                target: { label: definition?.solve?.target_label || "TARGET ARRAY" },
                goal: {
                    type: "state_equals",
                    state_key: "values",
                    expected_state: data.target_state
                },
                success: definition?.solve?.perfect_message || "Perfect Expert",
                feedback: "Compare the unsorted part before each selection pass."
            }]
        };
    },

    scoreExecution(data, result) {
        return {
            perfect: result.operations === data.optimal_operations
        };
    }
};


registerPlayground("selection-sort", createSelectionSortPlayground);
registerScenarioGenerator("selection-sort-expert", selectionSortExpertGenerator);
