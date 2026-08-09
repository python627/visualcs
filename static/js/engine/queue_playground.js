function createQueuePlayground() {

    const queue = [];

    function render() {
        stackDiv.innerHTML = "";
        stackDiv.classList.remove("linked-list-view");

        queue.forEach(number => {
            const block = document.createElement("div");
            block.className = "block";
            block.innerText = number;
            stackDiv.appendChild(block);
        });
    }

    function add() {
        const value = Math.floor(Math.random() * 90) + 10;

        queue.push(value);
        render();
        animateBlockAddition(value, getBlockElements().at(-1));

        const missionResult = completeAction("enqueue");

        if (!missionResult.complete) {
            setByteMessage(
                missionResult.nextOperation === "enqueue"
                    ? "Great! Press ENQUEUE again."
                    : "Excellent! Now press DEQUEUE once."
            );
        }
    }

    function remove() {
        if (queue.length === 0) {
            setByteMessage("The structure is empty.");
            return;
        }

        const previousRects = captureBlockRects();
        const removedValue = queue[0];

        queue.shift();
        render();

        animateRemainingBlocks(previousRects, 1);
        animateBlockRemoval(removedValue, previousRects[0], { x: -100, y: 0 });

        completeAction("dequeue");
    }

    return {
        mount() {
            getControl("enqueue").onclick = add;
            getControl("dequeue").onclick = remove;
        },
        reset() {
            queue.length = 0;
            render();
        }
    };
}


registerPlayground("queue", createQueuePlayground);
