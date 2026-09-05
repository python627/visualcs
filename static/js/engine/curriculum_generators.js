/* Reusable deterministic Expert scenario generators for the curriculum batch. */
(function registerCurriculumGenerators() {
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

    function shuffled(values, random) {
        const result = [...values];
        for (let index = result.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(random() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }

    function numberList(value) {
        return Array.isArray(value) ? value.map(Number) : [];
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

    function buildHashTable(keys, size = 5) {
        const table = Array.from({ length: size }, () => []);
        keys.forEach(key => table[key % size].push(key));
        return table;
    }

    function insertionStep(values, index) {
        const result = [...values];
        const value = result[index];
        let position = index - 1;
        let shifts = 0;
        while (position >= 0 && result[position] > value) {
            result[position + 1] = result[position];
            position--;
            shifts++;
        }
        result[position + 1] = value;
        return { values: result, value, insertAt: position + 1, shifts };
    }

    function insertionSimulation(initial) {
        let values = [...initial];
        const steps = [];
        let shifts = 0;
        for (let index = 1; index < values.length; index++) {
            const step = insertionStep(values, index);
            values = step.values;
            shifts += step.shifts;
            steps.push({
                operation: "insert-next",
                index,
                value: step.value,
                insert_at: step.insertAt,
                shifts: step.shifts,
                state: [...values],
                label: `Insert ${step.value} at position ${step.insertAt}; shift ${step.shifts} larger value${step.shifts === 1 ? "" : "s"}.`
            });
        }
        return { steps, finalState: values, shifts };
    }

    function merge(left, right) {
        const result = [];
        let leftIndex = 0;
        let rightIndex = 0;
        while (leftIndex < left.length && rightIndex < right.length) {
            if (left[leftIndex] <= right[rightIndex]) result.push(left[leftIndex++]);
            else result.push(right[rightIndex++]);
        }
        return result.concat(left.slice(leftIndex), right.slice(rightIndex));
    }

    function mergeSimulation(initial) {
        const middle = Math.floor(initial.length / 2);
        const left = initial.slice(0, middle).sort((a, b) => a - b);
        const right = initial.slice(middle).sort((a, b) => a - b);
        const finalState = merge(left, right);
        return {
            left,
            right,
            finalState,
            steps: [
                { operation: "split", state: [left, right], label: "Split the array into two balanced halves." },
                { operation: "sort-halves", state: [left, right], label: "Sort each half independently." },
                { operation: "merge-next", state: finalState, label: "Merge the sorted halves by comparing their front values." }
            ]
        };
    }

    function linearSimulation(values, target) {
        const steps = [];
        for (let index = 0; index < values.length; index++) {
            steps.push({
                operation: "next-step",
                index,
                value: values[index],
                label: `Compare ${values[index]} with ${target}.`
            });
            if (values[index] === target) break;
        }
        const foundIndex = values.indexOf(target);
        return {
            steps,
            compared: steps.map(step => step.value),
            outcome: foundIndex >= 0 ? "found" : "not_found",
            foundIndex
        };
    }

    const graphs = [
        {
            nodes: ["A", "B", "C", "D", "E"],
            edges: { A: ["B", "C"], B: ["D", "E"], C: [], D: [], E: [] },
            start: "A"
        },
        {
            nodes: ["A", "B", "C", "D", "E", "F"],
            edges: { A: ["B", "C"], B: ["D"], C: ["E", "F"], D: [], E: [], F: [] },
            start: "A"
        }
    ];

    function traverse(graph, kind) {
        const visited = [];
        const frontier = [graph.start];
        const seen = new Set([graph.start]);
        const steps = [];
        while (frontier.length) {
            const node = kind === "breadth-first-search" ? frontier.shift() : frontier.pop();
            visited.push(node);
            const neighbors = [...(graph.edges[node] || [])].sort();
            const additions = kind === "breadth-first-search" ? neighbors : [...neighbors].reverse();
            additions.forEach(neighbor => {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    frontier.push(neighbor);
                }
            });
            steps.push({
                operation: "visit-next",
                node,
                state: [...visited],
                frontier: [...frontier],
                label: `Visit ${node}; ${kind === "breadth-first-search" ? "queue" : "stack"}: ${frontier.join(" → ") || "empty"}.`
            });
        }
        return { steps, visited, frontier: [] };
    }

    function createStateExpert({ id, createData, evaluate }) {
        return {
            version: 1,
            generate({ random, rules }) { return createData(random, rules); },
            getMentalSimulation(data) { return data.mental_simulation; },
            validateScenario(data, simulation) {
                if (!simulation || !Array.isArray(simulation.steps) || !simulation.steps.length) {
                    throw new Error(`${id} Expert scenario needs a non-empty mental simulation.`);
                }
                if (!Array.isArray(simulation.initial_state)) {
                    throw new Error(`${id} Expert scenario needs an initial state.`);
                }
            },
            createExecutionChallenge(data, definition) {
                return {
                    phases: [{
                        title: definition?.solve?.title || "Expert challenge",
                        instruction: definition?.solve?.instruction || "Apply the concept to reach the target.",
                        target: { label: definition?.solve?.target_label || "TARGET" },
                        goal: data.execution_goal,
                        success: definition?.solve?.perfect_message || "Expert complete",
                        feedback: definition?.solve?.feedback || "Compare your current state with the target."
                    }]
                };
            },
            evaluatePrediction: evaluate,
            scoreExecution(data, result) {
                return { perfect: result.operations === data.optimal_operations };
            }
        };
    }

    const arrayExpert = createStateExpert({
        id: "Arrays",
        createData(random) {
            const initial = shuffled([15, 30, 45, 60, 75], random).slice(0, 4);
            const firstValue = 80;
            const secondValue = 10;
            const finalState = [...initial];
            finalState[2] = secondValue;
            finalState[0] = firstValue;
            const readValue = finalState[3];
            return {
                values: initial,
                target_state: finalState,
                optimal_operations: 3,
                execution_goal: { type: "state_equals", state_key: "values", expected_state: finalState },
                mental_simulation: {
                    initial_state: initial,
                    steps: [
                        { operation: "set-index", index: 2, value: secondValue, label: `Set index 2 = ${secondValue}.` },
                        { operation: "set-index", index: 0, value: firstValue, label: `Set index 0 = ${firstValue}.` },
                        { operation: "read-index", index: 3, value: readValue, label: "Read index 3." }
                    ],
                    final_state: finalState,
                    next_pop_value: readValue
                }
            };
        },
        evaluate(data, response) {
            const finalCorrect = same(numberList(response.finalState), data.target_state);
            const readCorrect = Number(response.readValue) === data.mental_simulation.next_pop_value;
            return { correctFinalState: finalCorrect, correctNextPop: readCorrect, actualFinalState: data.target_state, actualNextPop: data.mental_simulation.next_pop_value, feedback: finalCorrect && readCorrect ? "Correct. Index updates change only their fixed positions." : "Apply each SET to its numbered position, then read the value currently at index 3." };
        }
    });

    const hashExpert = createStateExpert({
        id: "Hash Tables",
        createData(random) {
            const size = 5;
            // Pick three different buckets, but deliberately put two keys in
            // one of them. This demonstrates distribution and chaining in the
            // same scenario, while leaving useful empty capacity visible.
            const bucketOrder = shuffled([0, 1, 2, 3, 4], random);
            const collisionBucket = bucketOrder[0];
            const singleBuckets = bucketOrder.slice(1, 3);
            const keyFor = (bucket, offset) => bucket + size * (offset + 1);
            const keys = shuffled([
                keyFor(collisionBucket, 0),
                keyFor(collisionBucket, 1),
                keyFor(singleBuckets[0], 0),
                keyFor(singleBuckets[1], 0)
            ], random);
            const table = buildHashTable(keys, size);
            const searched = keys[1];
            return {
                keys,
                table_size: size,
                target_state: table,
                optimal_operations: keys.length,
                execution_goal: { type: "state_equals", state_key: "table", expected_state: table },
                mental_simulation: {
                    initial_state: Array.from({ length: size }, () => []),
                    steps: keys.map(key => ({ operation: "insert-next", value: key, bucket: key % size, label: `Insert key ${key} using the hash rule.` })),
                    final_state: table,
                    next_pop_value: searched
                }
            };
        },
        evaluate(data, response) {
            const buckets = numberList(response.buckets);
            const expected = data.keys.map(key => key % data.table_size);
            const tableCorrect = same(numberList(response.finalKeys), data.keys.slice().sort((a, b) => a - b));
            const bucketCorrect = same(buckets, expected);
            return { correctFinalState: tableCorrect, correctNextPop: bucketCorrect, actualFinalState: data.keys.slice().sort((a, b) => a - b), actualNextPop: expected.join(", "), feedback: tableCorrect && bucketCorrect ? "Correct. The hash rule determines the bucket; chaining keeps collisions together." : "Calculate key % table size for every key, then group keys that land in the same bucket." };
        }
    });

    const heapExpert = createStateExpert({
        id: "Min Heap",
        createData(random) {
            const insertions = shuffled([42, 18, 27, 9, 33, 14], random).slice(0, 5);
            let heap = [];
            const steps = insertions.map(value => {
                heap = insertMinHeap(heap, value);
                return { operation: "insert-next", value, state: [...heap], label: `Insert ${value}, then bubble it up until its parent is smaller.` };
            });
            return {
                values: insertions,
                target_state: heap,
                optimal_operations: insertions.length,
                execution_goal: { type: "state_equals", state_key: "values", expected_state: heap },
                mental_simulation: { initial_state: [], steps, final_state: heap, next_pop_value: heap[0] }
            };
        },
        evaluate(data, response) {
            const finalCorrect = same(numberList(response.finalHeap), data.target_state);
            const rootCorrect = Number(response.root) === data.target_state[0];
            return { correctFinalState: finalCorrect, correctNextPop: rootCorrect, actualFinalState: data.target_state, actualNextPop: data.target_state[0], feedback: finalCorrect && rootCorrect ? "Correct. Every bubble-up keeps the smallest value at the root." : "Insert one value at a time and swap upward only while it is smaller than its parent." };
        }
    });

    const linearSearchExpert = createStateExpert({
        id: "Linear Search",
        createData(random) {
            const values = shuffled([11, 24, 37, 48, 59, 63, 76], random).slice(0, 5);
            const target = random() > 0.45 ? values[Math.floor(random() * values.length)] : 99;
            const simulation = linearSimulation(values, target);
            return {
                values,
                target,
                optimal_operations: simulation.steps.length,
                execution_goal: { type: "outcome_equals", expected_outcome: simulation.outcome },
                mental_simulation: { initial_state: values, target, steps: simulation.steps, final_state: simulation.compared, next_pop_value: simulation.outcome }
            };
        },
        evaluate(data, response) {
            const simulation = linearSimulation(data.values, data.target);
            const valuesCorrect = same(numberList(response.comparedValues), simulation.compared);
            const outcomeCorrect = response.outcome === simulation.outcome;
            return { correctFinalState: valuesCorrect, correctNextPop: outcomeCorrect, actualFinalState: simulation.compared, actualNextPop: simulation.outcome, actualComparedValues: simulation.compared, actualComparisonCount: simulation.steps.length, actualOutcome: simulation.outcome, feedback: valuesCorrect && outcomeCorrect ? "Correct. Linear Search compares from the beginning until it finds the target or reaches the end." : "Trace the list from index 0 and stop only when you match the target or run out of values." };
        }
    });

    const insertionExpert = createStateExpert({
        id: "Insertion Sort",
        createData(random) {
            const initial = shuffled([12, 24, 35, 47, 59], random).slice(0, 4);
            const simulation = insertionSimulation(initial);
            return {
                values: initial,
                target_state: simulation.finalState,
                optimal_operations: simulation.steps.length,
                execution_goal: { type: "state_equals", state_key: "values", expected_state: simulation.finalState },
                mental_simulation: { initial_state: initial, steps: simulation.steps, final_state: simulation.finalState, next_pop_value: simulation.shifts }
            };
        },
        evaluate(data, response) {
            const simulation = insertionSimulation(data.values);
            const finalCorrect = same(numberList(response.finalState), simulation.finalState);
            const shiftCorrect = Number(response.totalShifts) === simulation.shifts;
            return { correctFinalState: finalCorrect, correctNextPop: shiftCorrect, actualFinalState: simulation.finalState, actualNextPop: simulation.shifts, feedback: finalCorrect && shiftCorrect ? "Correct. Each card is inserted into the sorted prefix after larger cards shift right." : "Treat the left side as a sorted hand of cards and count each larger card shifted to the right." };
        }
    });

    const mergeExpert = createStateExpert({
        id: "Merge Sort",
        createData(random) {
            const initial = shuffled([8, 3, 6, 2, 9, 5], random).slice(0, 4);
            const simulation = mergeSimulation(initial);
            return {
                values: initial,
                target_state: simulation.finalState,
                optimal_operations: 3,
                execution_goal: { type: "state_equals", state_key: "values", expected_state: simulation.finalState },
                mental_simulation: { initial_state: initial, steps: simulation.steps, final_state: simulation.finalState, next_pop_value: simulation.finalState[0] }
            };
        },
        evaluate(data, response) {
            const simulation = mergeSimulation(data.values);
            const finalCorrect = same(numberList(response.finalState), simulation.finalState);
            const nextCorrect = Number(response.firstValue) === simulation.finalState[0];
            return { correctFinalState: finalCorrect, correctNextPop: nextCorrect, actualFinalState: simulation.finalState, actualNextPop: simulation.finalState[0], feedback: finalCorrect && nextCorrect ? "Correct. Merge Sort divides the work, then repeatedly takes the smaller front value while merging." : "Split into two halves, sort the halves, then take the smaller front value during the merge." };
        }
    });

    function graphExpert(kind) {
        return createStateExpert({
            id: kind === "breadth-first-search" ? "Breadth-First Search" : "Depth-First Search",
            createData(random) {
                const graph = graphs[Math.floor(random() * graphs.length)];
                const simulation = traverse(graph, kind);
                return {
                    graph,
                    target_state: simulation.visited,
                    optimal_operations: simulation.steps.length,
                    execution_goal: { type: "state_equals", state_key: "visited", expected_state: simulation.visited },
                    mental_simulation: { initial_state: [graph.start], graph, steps: simulation.steps, final_state: simulation.visited, next_pop_value: simulation.visited.at(-1) }
                };
            },
            evaluate(data, response) {
                const expected = traverse(data.graph, kind);
                const orderCorrect = same(String(response.order || "").split(",").map(value => value.trim()).filter(Boolean), expected.visited);
                const nextCorrect = String(response.lastVisited || "").trim() === expected.visited.at(-1);
                return { correctFinalState: orderCorrect, correctNextPop: nextCorrect, actualFinalState: expected.visited, actualNextPop: expected.visited.at(-1), feedback: orderCorrect && nextCorrect ? "Correct. You followed the deterministic neighbor order all the way through the graph." : `Follow the declared neighbor order: ${kind === "breadth-first-search" ? "visit by layers using the queue" : "go deep, then backtrack using the stack"}.` };
            }
        });
    }

    registerScenarioGenerator("array-expert", arrayExpert);
    registerScenarioGenerator("hash-table-expert", hashExpert);
    registerScenarioGenerator("min-heap-expert", heapExpert);
    registerScenarioGenerator("linear-search-expert", linearSearchExpert);
    registerScenarioGenerator("insertion-sort-expert", insertionExpert);
    registerScenarioGenerator("merge-sort-expert", mergeExpert);
    registerScenarioGenerator("breadth-first-search-expert", graphExpert("breadth-first-search"));
    registerScenarioGenerator("depth-first-search-expert", graphExpert("depth-first-search"));
})();
