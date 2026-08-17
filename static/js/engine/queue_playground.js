function createQueuePlayground() {

    const queue = [];

    function render() {
        stackDiv.innerHTML = "";
        stackDiv.classList.remove("linked-list-view");
        stackDiv.classList.add("queue-view");

        queue.forEach(number => {
            const block = document.createElement("div");
            block.className = "block";
            block.innerText = number;
            stackDiv.appendChild(block);
        });
    }

    function clearQueue() {
        queue.length = 0;
        render();
    }

    function add() {
        if (teachingEngine.prepareOperation("enqueue").blocked) {
            return;
        }

        const value = teachingEngine.getOperationValue({
            operation: "enqueue",
            index: queue.length,
            fallback: Math.floor(Math.random() * 90) + 10
        });

        queue.push(value);
        render();
        animateBlockAddition(value, getBlockElements().at(-1));

        teachingEngine.operationCompleted({
            operation: "enqueue",
            value,
            state: [...queue]
        });
    }

    function remove() {
        if (queue.length === 0) {
            setByteMessage("The structure is empty.");
            teachingEngine.reportUnavailableOperation({
                operation: "dequeue",
                state: [...queue]
            });
            return;
        }

        if (teachingEngine.prepareOperation("dequeue").blocked) {
            return;
        }

        const previousRects = captureBlockRects();
        const removedValue = queue[0];

        queue.shift();
        render();

        animateRemainingBlocks(previousRects, 1);
        animateBlockRemoval(removedValue, previousRects[0], { x: -100, y: 0 });

        teachingEngine.operationCompleted({
            operation: "dequeue",
            removedValue,
            state: [...queue]
        });
    }

    return {
        mount() {
            getControl("enqueue").onclick = add;
            getControl("dequeue").onclick = remove;
        },
        reset() {
            clearQueue();
        },
        resetForChallenge() {
            clearQueue();
        },
        renderChallengeTarget(target, container) {
            const label = document.createElement("span");
            label.className = "challenge-target-label";
            label.textContent = target.label;

            const ends = document.createElement("div");
            ends.className = "challenge-queue-ends";
            ends.innerHTML = `
                <span>${target.front_label} ↓</span>
                <span>${target.rear_label} ↓</span>
            `;

            const targetQueue = document.createElement("div");
            targetQueue.className = "challenge-queue-target";

            target.items.forEach((value, index) => {
                const block = document.createElement("span");
                block.className = "challenge-queue-value";
                block.textContent = value;
                targetQueue.appendChild(block);

                if (index < target.items.length - 1) {
                    const arrow = document.createElement("span");
                    arrow.className = "challenge-queue-arrow";
                    arrow.textContent = "→";
                    targetQueue.appendChild(arrow);
                }
            });

            container.append(label, ends, targetQueue);
        }
    };
}


registerPlayground("queue", createQueuePlayground);
