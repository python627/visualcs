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

    function add() {
        if (isGuidedPredictionPending()) {
            setByteMessage("Choose a prediction, then press POP to check it.");
            return;
        }

        const missionStep = getMissionStepIndex();
        const isGuidedPush = getExpectedOperation() === "push";
        const value = isGuidedPush
            ? getGuidedValue(missionStep, Math.floor(Math.random() * 90) + 10)
            : Math.floor(Math.random() * 90) + 10;

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
    }

    function remove() {
        if (stack.length === 0) {
            setByteMessage("The structure is empty.");
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
    }

    return {
        mount() {
            getControl("push").onclick = add;
            getControl("pop").onclick = remove;
        },
        reset() {
            stack.length = 0;
            render();
        }
    };
}


registerPlayground("stack", createStackPlayground);
