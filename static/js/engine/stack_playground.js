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
        const value = Math.floor(Math.random() * 90) + 10;

        stack.push(value);
        render();
        animateBlockAddition(value, getBlockElements().at(-1));

        const missionResult = completeAction("push");

        if (!missionResult.complete) {
            setByteMessage(
                missionResult.nextOperation === "push"
                    ? "Great! Press PUSH again."
                    : "Excellent! Now press POP once."
            );
        }
    }

    function remove() {
        if (stack.length === 0) {
            setByteMessage("The structure is empty.");
            return;
        }

        const previousRects = captureBlockRects();
        const removedValue = stack.at(-1);

        stack.pop();
        render();

        animateRemainingBlocks(previousRects, 0);
        animateBlockRemoval(removedValue, previousRects.at(-1), { x: 0, y: -90 });

        completeAction("pop");
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
