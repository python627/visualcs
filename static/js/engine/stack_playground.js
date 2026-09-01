function createStackPlayground() {

    const stack = [];
    let expertReplayToken = 0;

    function render() {
        stackDiv.innerHTML = "";
        stackDiv.classList.remove("linked-list-view", "queue-view");

        stack.forEach(number => {
            const block = document.createElement("div");
            block.className = "block";
            block.innerText = number;
            stackDiv.appendChild(block);
        });
    }

    function clearStack() {
        stack.length = 0;
        render();
    }


    function reportOperation(event) {
        if (masteryEngine.isInteractionActive()) {
            masteryEngine.operationCompleted(event);
            return;
        }

        teachingEngine.operationCompleted(event);
    }

    function add(valueOverride = undefined) {
        if (valueOverride instanceof Event) {
            valueOverride = undefined;
        }

        if (masteryEngine.isExpertExecutionActive() && valueOverride === undefined) {
            setByteMessage("Choose one of the available PUSH values for this Expert challenge.");
            return;
        }

        if (
            !masteryEngine.isInteractionActive()
            && teachingEngine.prepareOperation("push").blocked
        ) {
            return;
        }

        const masteryValue = masteryEngine.getOperationValue({
            operation: "push",
            fallback: undefined
        });
        const value = valueOverride ?? masteryValue ?? teachingEngine.getOperationValue({
            operation: "push",
            index: stack.length,
            fallback: Math.floor(Math.random() * 90) + 10
        });

        stack.push(value);
        render();
        animateBlockAddition(value, getBlockElements().at(-1));

        reportOperation({
            operation: "push",
            value,
            state: [...stack]
        });
    }

    function remove() {
        if (stack.length === 0) {
            setByteMessage("The structure is empty.");
            const event = {
                operation: "pop",
                state: [...stack]
            };

            if (masteryEngine.isInteractionActive()) {
                masteryEngine.reportUnavailableOperation(event);
            }
            else {
                teachingEngine.reportUnavailableOperation(event);
            }

            return;
        }

        if (
            !masteryEngine.isInteractionActive()
            && teachingEngine.prepareOperation("pop").blocked
        ) {
            return;
        }

        const previousRects = captureBlockRects();
        const removedValue = stack.at(-1);

        stack.pop();
        render();

        animateRemainingBlocks(previousRects, 0);
        animateBlockRemoval(removedValue, previousRects.at(-1), { x: 0, y: -90 });

        reportOperation({
            operation: "pop",
            removedValue,
            state: [...stack]
        });
    }


    function pause(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }


    async function replayExpertSimulation(simulation) {
        if (!simulation || !Array.isArray(simulation.initial_state) || !Array.isArray(simulation.steps)) {
            return;
        }

        const replayToken = ++expertReplayToken;
        stack.length = 0;
        stack.push(...simulation.initial_state);
        render();

        for (const step of simulation.steps) {
            await pause(430);

            if (replayToken !== expertReplayToken) {
                return;
            }

            if (step.operation === "push") {
                stack.push(step.value);
                render();
                animateBlockAddition(step.value, getBlockElements().at(-1));
            }
            else if (step.operation === "pop" && stack.length) {
                const previousRects = captureBlockRects();
                const removedValue = stack.at(-1);

                stack.pop();
                render();
                animateRemainingBlocks(previousRects, 0);
                animateBlockRemoval(removedValue, previousRects.at(-1), { x: 0, y: -90 });
            }
        }
    }

    return {
        mount() {
            getControl("push").onclick = add;
            getControl("pop").onclick = remove;
        },
        reset() {
            expertReplayToken++;
            clearStack();
        },
        resetForChallenge() {
            clearStack();
        },
        configureMasteryScenario(scenario) {
            expertReplayToken++;
            stack.length = 0;

            if (Array.isArray(scenario.initial_state)) {
                stack.push(...scenario.initial_state);
            }

            render();
        },
        performMasteryOperation(operation, { value } = {}) {
            if (operation === "push" && Number.isFinite(value)) {
                add(value);
            }
            else if (operation === "pop") {
                remove();
            }
        },
        replayExpertSimulation,
        renderExpertThinkingState({ initialState, labels }, container) {
            if (!container) {
                return;
            }

            const card = document.createElement("section");
            card.className = "mastery-state-card expert-start-stack";

            const title = document.createElement("span");
            title.className = "challenge-target-label";
            title.textContent = labels.title;

            const top = document.createElement("span");
            top.className = "expert-stack-boundary";
            top.textContent = labels.top;

            const stackState = document.createElement("div");
            stackState.className = "challenge-stack-target";

            [...initialState].reverse().forEach(value => {
                const row = document.createElement("div");
                row.className = "challenge-stack-row";

                const block = document.createElement("span");
                block.className = "challenge-stack-value";
                block.textContent = value;
                row.appendChild(block);
                stackState.appendChild(row);
            });

            const bottom = document.createElement("span");
            bottom.className = "expert-stack-boundary";
            bottom.textContent = labels.bottom;

            card.append(title, top, stackState, bottom);
            container.appendChild(card);
        },
        renderMasteryStates({ initialState, target }, container) {
            const renderState = ({ label, items, topLabel }) => {
                const card = document.createElement("section");
                card.className = "mastery-state-card";

                const heading = document.createElement("span");
                heading.className = "challenge-target-label";
                heading.textContent = label;
                card.appendChild(heading);

                if (!items.length) {
                    const empty = document.createElement("p");
                    empty.className = "mastery-state-empty";
                    empty.textContent = "Empty";
                    card.appendChild(empty);
                    return card;
                }

                const stackState = document.createElement("div");
                stackState.className = "challenge-stack-target";

                items.forEach((value, index) => {
                    const row = document.createElement("div");
                    row.className = "challenge-stack-row";

                    const block = document.createElement("span");
                    block.className = "challenge-stack-value";
                    block.textContent = value;
                    row.appendChild(block);

                    if (index === 0) {
                        const top = document.createElement("span");
                        top.className = "challenge-stack-top";
                        top.textContent = `← ${topLabel}`;
                        row.appendChild(top);
                    }

                    stackState.appendChild(row);
                });

                card.appendChild(stackState);
                return card;
            };

            container.append(
                renderState({
                    label: "START STACK",
                    items: [...initialState].reverse(),
                    topLabel: "TOP"
                }),
                renderState({
                    label: "TARGET STACK",
                    items: Array.isArray(target.raw_state)
                        ? [...target.raw_state].reverse()
                        : target.items || [],
                    topLabel: target.top_label || "TOP"
                })
            );
        },
        renderChallengeTarget(target, container) {
            const label = document.createElement("span");
            label.className = "challenge-target-label";
            label.textContent = target.label;

            const targetStack = document.createElement("div");
            targetStack.className = "challenge-stack-target";

            target.items.forEach((value, index) => {
                const row = document.createElement("div");
                row.className = "challenge-stack-row";

                const block = document.createElement("span");
                block.className = "challenge-stack-value";
                block.textContent = value;
                row.appendChild(block);

                if (index === 0) {
                    const top = document.createElement("span");
                    top.className = "challenge-stack-top";
                    top.textContent = `← ${target.top_label}`;
                    row.appendChild(top);
                }

                targetStack.appendChild(row);
            });

            container.append(label, targetStack);
        }
    };
}


registerPlayground("stack", createStackPlayground);
