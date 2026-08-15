function createBubbleSortPlayground() {

    const originalValues = [...LESSON.playground.values];

    let values = [...originalValues];
    let index = 0;
    let end = values.length - 1;
    let phase = "compare";
    let comparing = [];
    let sortedIndices = new Set();
    let sortFinished = false;

    function render(options = {}) {

        const { swapping = false } = options;

        stackDiv.innerHTML = "";
        stackDiv.classList.add("bubble-sort-view");

        const instruction = document.createElement("p");
        instruction.className = "bubble-sort-instruction";
        instruction.textContent = sortFinished
            ? "Sorted! Use NEXT STEP to sort the values again."
            : "Compare neighboring values from left to right.";

        const array = document.createElement("div");
        array.className = "bubble-sort-array";

        values.forEach((value, valueIndex) => {

            const item = document.createElement("div");
            item.className = "sort-value";
            item.textContent = value;

            if (comparing.includes(valueIndex)) {
                item.classList.add("comparing");
            }

            if (swapping && comparing.includes(valueIndex)) {
                item.classList.add("swapping");
            }

            if (sortedIndices.has(valueIndex)) {
                item.classList.add("sorted");
            }

            array.appendChild(item);

        });

        stackDiv.append(instruction, array);

    }

    function getSortItems() {
        return Array.from(stackDiv.querySelectorAll(".sort-value"));
    }

    function animateSwap(previousRects) {

        const items = getSortItems();
        const left = items[index];
        const right = items[index + 1];

        if (!left || !right || typeof left.animate !== "function") return;

        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();

        left.animate(
            [
                { transform: `translateX(${previousRects[index + 1].left - leftRect.left}px)` },
                { transform: "translateX(0)" }
            ],
            { duration: 420, easing: "ease-out" }
        );

        right.animate(
            [
                { transform: `translateX(${previousRects[index].left - rightRect.left}px)` },
                { transform: "translateX(0)" }
            ],
            { duration: 420, easing: "ease-out" }
        );

    }

    function resetSort() {

        values = [...originalValues];
        index = 0;
        end = values.length - 1;
        phase = "compare";
        comparing = [];
        sortedIndices = new Set();
        sortFinished = false;

        render();

    }

    function nextStep() {

        if (sortFinished) {
            resetSort();
            setByteMessage("Sort reset. Use NEXT STEP to compare the first pair again.");
            return;
        }

        if (phase === "compare") {

            comparing = [index, index + 1];
            render();

            const missionResult = completeAction("compare-adjacent");

            if (values[index] > values[index + 1]) {
                phase = "swap";

                if (!missionResult.complete) {
                    setByteMessage(`${values[index]} is larger than ${values[index + 1]}. Use NEXT STEP to swap them.`);
                }
            }
            else {
                phase = "advance";

                if (!missionResult.complete) {
                    setByteMessage(`${values[index]} and ${values[index + 1]} are already in order. No swap is needed.`);
                }
            }

            return;

        }

        if (phase === "swap") {

            const previousRects = getSortItems().map(item => item.getBoundingClientRect());

            [values[index], values[index + 1]] = [values[index + 1], values[index]];
            render({ swapping: true });
            animateSwap(previousRects);

            phase = "advance";

            const missionResult = completeAction("swap");

            if (!missionResult.complete) {
                setByteMessage("The larger value moved one position to the right.");
            }

            return;

        }

        if (phase === "finish") {

            sortFinished = true;
            comparing = [];
            render();

            const missionResult = completeAction("sorted-array");

            if (!missionResult.complete) {
                setByteMessage("The array is sorted!");
            }

            return;

        }

        if (index >= end - 1) {

            sortedIndices.add(end);
            end--;
            index = 0;
            comparing = [];

            const missionResult = completeAction("complete-pass");

            if (end === 0) {
                sortedIndices.add(0);
                phase = "finish";
                render();

                if (!missionResult.complete) {
                    setByteMessage("Every pass is complete. Use NEXT STEP to reveal the sorted array.");
                }
            }
            else {
                phase = "compare";
                render();

                if (!missionResult.complete) {
                    setByteMessage("One value reached its final position. Start the next pass from the left.");
                }
            }

            return;

        }

        index++;
        comparing = [];
        phase = "compare";
        render();

        const missionResult = completeAction("continue-pass");

        if (!missionResult.complete) {
            setByteMessage("Move to the next adjacent pair in this pass.");
        }

    }

    return {
        mount() {
            getControl("next-step").onclick = nextStep;
            render();
        },
        reset() {
            resetSort();
        }
    };

}


registerPlayground("bubble-sort", createBubbleSortPlayground);
