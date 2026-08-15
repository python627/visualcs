function createBinarySearchPlayground() {

    const values = LESSON.playground.values;
    const target = LESSON.playground.target;

    let low = 0;
    let high = values.length - 1;
    let middle = null;
    let phase = "check";
    let targetFound = false;

    function render() {

        stackDiv.innerHTML = "";
        stackDiv.classList.add("binary-search-view");

        const targetLabel = document.createElement("p");
        targetLabel.className = "binary-search-target";
        targetLabel.textContent = `Find ${target}`;

        const array = document.createElement("div");
        array.className = "binary-search-array";

        values.forEach((value, index) => {

            const item = document.createElement("div");
            item.className = "search-value";
            item.textContent = value;

            if (index < low || index > high) {
                item.classList.add("eliminated");
            }

            if (index === middle) {
                item.classList.add("middle");
            }

            if (targetFound && index === middle) {
                item.classList.add("found");
            }

            array.appendChild(item);

        });

        stackDiv.append(targetLabel, array);

    }

    function resetSearch() {

        low = 0;
        high = values.length - 1;
        middle = null;
        phase = "check";
        targetFound = false;

        render();

    }

    function nextStep() {

        if (targetFound) {
            resetSearch();
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

    return {
        mount() {
            getControl("next-step").onclick = nextStep;
            render();
        },
        reset() {
            resetSearch();
        }
    };

}


registerPlayground("binary-search", createBinarySearchPlayground);
