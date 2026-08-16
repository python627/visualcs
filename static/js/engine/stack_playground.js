function createStackPlayground() {

    const stack = [];

    function render() {
        stackDiv.innerHTML = "";
        stackDiv.classList.remove("linked-list-view");

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

    function add() {
        if (isGuidedPredictionPending()) {
            setByteMessage("Choose a prediction, then press POP to check it.");
            return;
        }

        const missionStep = getMissionStepIndex();
        const isGuidedPush = getExpectedOperation() === "push";
        const challengeValue = getLessonChallengeOperationValue(
            "push",
            stack.length
        );
        const value = isGuidedPush
            ? getGuidedValue(missionStep, Math.floor(Math.random() * 90) + 10)
            : challengeValue ?? Math.floor(Math.random() * 90) + 10;

        stack.push(value);
        render();
        animateBlockAddition(value, getBlockElements().at(-1));

        const missionResult = completeAction("push");

        if (missionResult.accepted) {
            showGuidedActionExplanation("push", missionStep, { value });

            if (missionResult.nextOperation === "pop") {
                showPredictionPrompt();
            }
        }
        else {
            reportLessonChallengeState(stack, "push");
        }
    }

    function remove() {
        if (stack.length === 0) {
            setByteMessage("The structure is empty.");
            reportLessonChallengeState(stack, "pop");
            return;
        }

        if (isGuidedPredictionRequired("pop")) {
            showPredictionPrompt();
            setByteMessage("Make a prediction before POP reveals the answer.");
            return;
        }

        const previousRects = captureBlockRects();
        const removedValue = stack.at(-1);

        stack.pop();
        render();

        animateRemainingBlocks(previousRects, 0);
        animateBlockRemoval(removedValue, previousRects.at(-1), { x: 0, y: -90 });

        const missionResult = completeAction("pop");

        if (missionResult.accepted) {
            resolveGuidedPrediction(removedValue);
        }
        else {
            reportLessonChallengeState(stack, "pop");
        }
    }

    return {
        mount() {
            getControl("push").onclick = add;
            getControl("pop").onclick = remove;
        },
        reset() {
            clearStack();
        },
        resetForChallenge() {
            clearStack();
        },
        getChallengeState() {
            return [...stack];
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
