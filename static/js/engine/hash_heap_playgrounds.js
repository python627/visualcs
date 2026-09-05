/* Dedicated visual playgrounds for deterministic hashing and min-heap insertion. */
(function registerHashAndHeapPlaygrounds() {
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

    function routeEvent(event) {
        if (masteryEngine.isInteractionActive()) masteryEngine.operationCompleted(event);
        else teachingEngine.operationCompleted(event);
    }

    function appendTableCard(container, label, table) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        card.innerHTML = `<span class="challenge-target-label">${label}</span>`;
        card.appendChild(createTable(table || []));
        container.appendChild(card);
    }

    function createTable(table, activeBucket = null) {
        const view = document.createElement("div");
        view.className = "hash-table-grid";
        table.forEach((bucket, index) => {
            const row = document.createElement("div");
            row.className = "hash-bucket";
            if (index === activeBucket) row.classList.add("is-active");
            const chain = bucket.length ? bucket.join(" → ") : "empty";
            row.innerHTML = `<strong>${index}</strong><span>${chain}</span>`;
            view.appendChild(row);
        });
        return view;
    }

    function insertMinHeap(heap, value) {
        const result = [...heap, value];
        let index = result.length - 1;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (result[parent] <= result[index]) break;
            [result[parent], result[index]] = [result[index], result[parent]];
            index = parent;
        }
        return result;
    }

    function appendHeapCard(container, label, heap) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        card.innerHTML = `<span class="challenge-target-label">${label}</span><p class="mastery-array-state">[${(heap || []).join(", ")}]</p>`;
        container.appendChild(card);
    }

    function createHashTablePlayground() {
        const originalKeys = [...LESSON.playground.keys];
        const size = LESSON.playground.table_size || 5;
        let keys = [...originalKeys];
        let table = [];
        let index = 0;
        let activeBucket = null;
        let guidedStage = "calculate";
        let pendingKey = null;
        let pendingBucket = null;
        let masteryMode = false;
        let scenario = null;

        function emptyTable() { return Array.from({ length: size }, () => []); }

        function reset({ useScenario = false } = {}) {
            keys = useScenario ? [...(scenario?.keys || originalKeys)] : [...originalKeys];
            table = emptyTable();
            index = 0;
            activeBucket = null;
            guidedStage = "calculate";
            pendingKey = null;
            pendingBucket = null;
            updateLegacyControl();
            if (masteryMode) {
                renderAutomatic("Use the hash rule to place the next key.");
            }
            else {
                renderGuided("Calculate the bucket for the next key before placing it.");
            }
        }

        function updateLegacyControl() {
            const control = getControl("next-step");
            control.hidden = !masteryMode;
            control.onclick = () => nextMasteryInsertion();
        }

        function renderTableView(message, extra = null) {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view hash-table-view";
            const rule = document.createElement("p");
            rule.className = "curriculum-instruction";
            rule.textContent = message;
            const formula = document.createElement("p");
            formula.className = "hash-rule";
            formula.textContent = `Hash rule: key % ${size}`;
            stackDiv.append(rule, formula, createTable(table, activeBucket));
            if (extra) stackDiv.appendChild(extra);
        }

        function renderAutomatic(message) {
            const key = keys[index];
            const text = Number.isFinite(key) ? `${message} Next key: ${key}.` : "All keys are in their buckets.";
            renderTableView(text);
        }

        function finishInsertion(operation = "next-step") {
            if (!masteryMode && teachingEngine.guardPendingPrediction(operation)) return;
            const key = pendingKey;
            const bucket = pendingBucket;
            if (!Number.isFinite(key) || !Number.isInteger(bucket)) return;
            const collision = table[bucket].length > 0;
            table[bucket].push(key);
            index++;
            const complete = index === keys.length;
            pendingKey = null;
            pendingBucket = null;
            guidedStage = complete ? "complete" : "calculate";
            activeBucket = bucket;
            const feedback = `${key} % ${size} = ${bucket}. ${collision ? `Bucket ${bucket} already had a key, so ${key} joined its chain.` : `${key} entered bucket ${bucket}.`}`;
            if (masteryMode) renderAutomatic(feedback);
            else renderGuided(feedback);
            routeEvent({ operation, value: key, state: { table: table.map(bucketValues => [...bucketValues]), outcome: complete ? "built" : null }, feedback, progress: !complete });
        }

        function renderGuided(message) {
            const key = keys[index];
            if (!Number.isFinite(key)) {
                renderTableView(message || "All keys have been inserted.");
                return;
            }

            if (guidedStage === "calculate") {
                const content = document.createElement("div");
                content.className = "hash-decision-panel";
                content.innerHTML = `<strong>KEY TO INSERT: ${key}</strong><label>Calculate ${key} % ${size}<input type="number" data-hash-answer inputmode="numeric"></label><button type="button" data-hash-check>CHECK HASH</button>`;
                content.querySelector("[data-hash-check]").addEventListener("click", () => {
                    const answer = Number(content.querySelector("[data-hash-answer]").value);
                    if (!Number.isFinite(answer)) {
                        teachingEngine.setByteMessage("Enter the remainder before checking the bucket.");
                        return;
                    }
                    const expected = key % size;
                    if (answer !== expected) {
                        teachingEngine.setByteMessage(`${answer} is not the remainder for ${key} % ${size}. Try the calculation again.`);
                        return;
                    }
                    pendingKey = key;
                    pendingBucket = expected;
                    guidedStage = "bucket";
                    renderGuided(`Correct: ${key} % ${size} = ${expected}. Now choose bucket ${expected}.`);
                });
                renderTableView(message, content);
                return;
            }

            if (guidedStage === "bucket") {
                const content = document.createElement("div");
                content.className = "hash-decision-panel";
                content.innerHTML = `<strong>Which bucket receives ${pendingKey}?</strong><div class="hash-bucket-choices"></div>`;
                const choices = content.querySelector(".hash-bucket-choices");
                for (let bucket = 0; bucket < size; bucket++) {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = bucket;
                    button.addEventListener("click", () => {
                        if (bucket !== pendingBucket) {
                            teachingEngine.setByteMessage(`Bucket ${bucket} does not match the remainder. Choose bucket ${pendingBucket}.`);
                            return;
                        }
                        guidedStage = table[bucket].length ? "collision" : "insert";
                        renderGuided(table[bucket].length ? `Bucket ${bucket} already contains a key. Decide how to handle the collision.` : `Bucket ${bucket} is empty. ${pendingKey} can be inserted there.`);
                    });
                    choices.appendChild(button);
                }
                renderTableView(message, content);
                return;
            }

            if (guidedStage === "collision") {
                const content = document.createElement("div");
                content.className = "hash-decision-panel";
                content.innerHTML = `<strong>Bucket ${pendingBucket} has a collision.</strong><p>What should happen to ${pendingKey}?</p><div class="hash-collision-choices"><button type="button" data-collision="replace">REPLACE</button><button type="button" data-collision="chain">ADD TO CHAIN</button><button type="button" data-collision="reject">REJECT</button></div>`;
                content.querySelectorAll("[data-collision]").forEach(button => {
                    button.addEventListener("click", () => {
                        if (button.dataset.collision !== "chain") {
                            teachingEngine.setByteMessage("Keep both keys: chaining adds the new key after the existing key.");
                            return;
                        }
                        guidedStage = "insert";
                        renderGuided(`Correct. Add ${pendingKey} to the end of bucket ${pendingBucket}'s chain.`);
                    });
                });
                renderTableView(message, content);
                return;
            }

            if (guidedStage === "insert") {
                const content = document.createElement("div");
                content.className = "hash-decision-panel";
                content.innerHTML = `<strong>Ready to insert ${pendingKey} into bucket ${pendingBucket}</strong><button type="button" data-hash-insert>INSERT INTO BUCKET</button>`;
                content.querySelector("[data-hash-insert]").addEventListener("click", () => finishInsertion());
                renderTableView(message, content);
                return;
            }

            renderTableView(message || "All keys are in their buckets.");
        }

        function nextMasteryInsertion(operation = "insert-next") {
            const key = keys[index];
            if (!Number.isFinite(key)) {
                if (!masteryMode) reset();
                return;
            }
            const bucket = key % size;
            activeBucket = bucket;
            const collision = table[bucket].length > 0;
            table[bucket].push(key);
            index++;
            const complete = index === keys.length;
            const feedback = `${key} % ${size} = ${bucket}. ${collision ? `Bucket ${bucket} already has a key, so ${key} joins its chain.` : `${key} enters bucket ${bucket}.`}`;
            renderAutomatic(feedback);
            routeEvent({ operation, value: key, state: { table: table.map(bucketValues => [...bucketValues]), outcome: complete ? "built" : null }, feedback, progress: !complete });
        }

        return {
            mount() { reset(); },
            reset() { masteryMode = false; scenario = null; reset(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(nextScenario) { masteryMode = true; scenario = nextScenario || {}; reset({ useScenario: true }); },
            performMasteryOperation() { nextMasteryInsertion("insert-next"); },
            endMasteryMode() { masteryMode = false; scenario = null; reset(); },
            async replayExpertSimulation(simulation) {
                if (!Array.isArray(simulation?.steps)) return;
                masteryMode = true;
                scenario = { keys: simulation.steps.map(step => step.value) };
                reset({ useScenario: true });
                for (const step of simulation.steps) {
                    nextMasteryInsertion("insert-next");
                    await new Promise(resolve => window.setTimeout(resolve, 500));
                }
            },
            renderChallengeTarget(target, container) { appendTableCard(container, target.label || "TARGET TABLE", target.items || []); },
            renderMasteryStates({ scenario: state, target }, container) {
                appendTableCard(container, "START TABLE", Array.from({ length: state?.table_size || size }, () => []));
                appendTableCard(container, target.label || "TARGET TABLE", target.raw_state || target.items || scenario?.target_state || []);
            },
            renderExpertThinkingState({ initialState, labels }, container) { appendTableCard(container, labels.title || "STARTING TABLE", initialState || emptyTable()); }
        };
    }

    function createMinHeapPlayground() {
        const originalValues = [...LESSON.playground.values];
        let insertionValues = [...originalValues];
        let heap = [];
        let index = 0;
        let lastInserted = null;
        let masteryMode = false;
        let scenario = null;
        let guidedStage = "place";
        let pendingValue = null;
        let pendingIndex = null;
        let pendingParent = null;

        function reset({ useScenario = false } = {}) {
            insertionValues = useScenario ? [...(scenario?.values || originalValues)] : [...originalValues];
            heap = [];
            index = 0;
            lastInserted = null;
            guidedStage = "place";
            pendingValue = null;
            pendingIndex = null;
            pendingParent = null;
            updateLegacyControl();
            render("Insert a value at the next open spot, then bubble it up while it is smaller than its parent.");
        }

        function updateLegacyControl() {
            const control = getControl("next-step");
            control.hidden = !masteryMode;
            control.onclick = () => next();
        }

        function render(message) {
            stackDiv.innerHTML = "";
            stackDiv.className = "curriculum-view min-heap-view";
            const instruction = document.createElement("p");
            instruction.className = "curriculum-instruction";
            instruction.textContent = message;
            const tree = document.createElement("div");
            tree.className = "heap-tree";
            heap.forEach((value, nodeIndex) => {
                const node = document.createElement("span");
                node.className = "heap-node";
                if (value === lastInserted) node.classList.add("is-active");
                node.textContent = value;
                tree.appendChild(node);
            });
            const array = document.createElement("p");
            array.className = "heap-array";
            array.textContent = `Heap array: [${heap.join(", ")}]`;
            stackDiv.append(instruction, tree, array);

            if (!masteryMode && Number.isFinite(insertionValues[index])) {
                const panel = document.createElement("div");
                panel.className = "hash-decision-panel heap-decision-panel";

                if (guidedStage === "place") {
                    panel.innerHTML = `<strong>Next value: ${insertionValues[index]}</strong><p>The complete-tree shape puts it at the next open position (index ${heap.length}).</p><button type="button" data-heap-place>PLACE AT INDEX ${heap.length}</button>`;
                    panel.querySelector("[data-heap-place]").addEventListener("click", () => {
                        if (teachingEngine.guardPendingPrediction("next-step")) return;
                        pendingValue = insertionValues[index];
                        pendingIndex = heap.length;
                        heap.push(pendingValue);
                        lastInserted = pendingValue;
                        pendingParent = pendingIndex > 0 ? Math.floor((pendingIndex - 1) / 2) : null;
                        guidedStage = "bubble";
                        render(pendingParent === null
                            ? `${pendingValue} is at the root; there is no parent to compare.`
                            : `Compare ${pendingValue} with its parent ${heap[pendingParent]}. Decide whether to swap.`);
                    });
                }
                else if (guidedStage === "bubble" && pendingIndex !== null) {
                    if (pendingParent === null) {
                        panel.innerHTML = `<strong>${pendingValue} reached the root.</strong><button type="button" data-heap-keep>KEEP AT ROOT</button>`;
                        panel.querySelector("[data-heap-keep]").addEventListener("click", () => finishGuidedInsertion());
                    }
                    else {
                        panel.innerHTML = `<strong>Compare ${pendingValue} with parent ${heap[pendingParent]}</strong><p>Should the child move up?</p><div class="hash-collision-choices"><button type="button" data-heap-decision="swap">SWAP</button><button type="button" data-heap-decision="keep">KEEP ORDER</button></div>`;
                        panel.querySelectorAll("[data-heap-decision]").forEach(button => button.addEventListener("click", () => decideBubble(button.dataset.heapDecision)));
                    }
                }
                stackDiv.appendChild(panel);
            }
        }

        function finishGuidedInsertion() {
            const value = pendingValue;
            index++;
            const complete = index === insertionValues.length;
            guidedStage = "place";
            pendingValue = null;
            pendingIndex = null;
            pendingParent = null;
            const feedback = `${value} is in place. The parent is no larger than its children, so the min-heap rule holds.`;
            render(feedback);
            routeEvent({ operation: "next-step", value, state: { values: [...heap], outcome: complete ? "built" : null }, feedback, progress: !complete });
        }

        function decideBubble(decision) {
            if (pendingIndex === null || pendingParent === null) return;
            if (teachingEngine.guardPendingPrediction("next-step")) return;
            const child = heap[pendingIndex];
            const parent = heap[pendingParent];
            const shouldSwap = child < parent;
            const expected = shouldSwap ? "swap" : "keep";
            if (decision !== expected) {
                teachingEngine.setByteMessage(shouldSwap
                    ? `${child} is smaller than ${parent}; choose SWAP so it bubbles upward.`
                    : `${child} is not smaller than ${parent}; keep the parent-child order.`);
                return;
            }

            if (shouldSwap) {
                [heap[pendingParent], heap[pendingIndex]] = [heap[pendingIndex], heap[pendingParent]];
                pendingIndex = pendingParent;
                pendingParent = pendingIndex > 0 ? Math.floor((pendingIndex - 1) / 2) : null;
                render(`${child} swapped upward. Compare it with the next parent, if one exists.`);
                return;
            }

            finishGuidedInsertion();
        }

        function next(operation = "next-step") {
            if (!masteryMode) {
                teachingEngine.setByteMessage("Use PLACE, SWAP, or KEEP ORDER in the heap panel.");
                return;
            }
            const value = insertionValues[index];
            if (!Number.isFinite(value)) {
                if (!masteryMode) reset();
                return;
            }
            heap = insertMinHeap(heap, value);
            lastInserted = value;
            index++;
            const complete = index === insertionValues.length;
            const feedback = `${value} entered the next open spot and bubbled up until the min-heap rule was restored. Root: ${heap[0]}.`;
            render(feedback);
            routeEvent({ operation, value, state: { values: [...heap], outcome: complete ? "built" : null }, feedback, progress: !complete });
        }

        return {
            mount() { reset(); },
            reset() { masteryMode = false; scenario = null; reset(); },
            resetForChallenge() { this.reset(); },
            configureMasteryScenario(nextScenario) { masteryMode = true; scenario = nextScenario || {}; reset({ useScenario: true }); },
            performMasteryOperation() { next("insert-next"); },
            endMasteryMode() { masteryMode = false; scenario = null; reset(); },
            async replayExpertSimulation(simulation) {
                if (!Array.isArray(simulation?.steps)) return;
                masteryMode = true;
                scenario = { values: simulation.steps.map(step => step.value) };
                reset({ useScenario: true });
                for (const step of simulation.steps) {
                    heap = [...step.state];
                    lastInserted = step.value;
                    index++;
                    render(step.label);
                    await new Promise(resolve => window.setTimeout(resolve, 500));
                }
            },
            renderChallengeTarget(target, container) { appendHeapCard(container, target.label || "TARGET HEAP", target.items || []); },
            renderMasteryStates({ scenario: state, target }, container) {
                appendHeapCard(container, "START HEAP", state?.initial_state || []);
                appendHeapCard(container, target.label || "TARGET HEAP", target.raw_state || target.items || scenario?.target_state || []);
            },
            renderExpertThinkingState({ initialState, labels }, container) { appendHeapCard(container, labels.title || "STARTING HEAP", initialState || []); }
        };
    }

    registerPlayground("hash-table", createHashTablePlayground);
    registerPlayground("min-heap", createMinHeapPlayground);
})();
