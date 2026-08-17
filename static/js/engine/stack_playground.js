function createStackPlayground() {

    const stack = [];

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

    function add() {
        if (teachingEngine.prepareOperation("push").blocked) {
            return;
        }

        const value = teachingEngine.getOperationValue({
            operation: "push",
            index: stack.length,
            fallback: Math.floor(Math.random() * 90) + 10
        });

        stack.push(value);
        render();
        animateBlockAddition(value, getBlockElements().at(-1));

        teachingEngine.operationCompleted({
            operation: "push",
            value,
            state: [...stack]
        });
    }

    function remove() {
        if (stack.length === 0) {
            setByteMessage("The structure is empty.");
            teachingEngine.reportUnavailableOperation({
                operation: "pop",
                state: [...stack]
            });
            return;
        }

        if (teachingEngine.prepareOperation("pop").blocked) {
            return;
        }

        const previousRects = captureBlockRects();
        const removedValue = stack.at(-1);

        stack.pop();
        render();

        animateRemainingBlocks(previousRects, 0);
        animateBlockRemoval(removedValue, previousRects.at(-1), { x: 0, y: -90 });

        teachingEngine.operationCompleted({
            operation: "pop",
            removedValue,
            state: [...stack]
        });
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
