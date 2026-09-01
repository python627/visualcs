function createRemainingMasteryGenerators() {

    const numbers = [12, 18, 24, 31, 37, 43, 49, 56, 62, 68, 74, 81, 87, 93];
    const names = ["Asha", "Diego", "Mina", "Noah", "Priya", "Sam"];

    const integer = (random, minimum, maximum) => (
        Math.floor(random() * (maximum - minimum + 1)) + minimum
    );
    const shuffled = (items, random) => {
        const result = [...items];

        for (let index = result.length - 1; index > 0; index--) {
            const other = integer(random, 0, index);
            [result[index], result[other]] = [result[other], result[index]];
        }

        return result;
    };
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    const listText = values => values.join(", ");

    function createLinearGenerator({ id, addOperation, removeOperation, removalField }) {
        function simulate(initial, steps) {
            const state = [...initial];

            steps.forEach(step => {
                if (step.operation === addOperation) state.push(step.value);
                if (step.operation === removeOperation) state.shift();
            });

            return state;
        }

        return {
            version: 1,
            generate({ random }) {
                const values = shuffled(numbers, random);
                const initial = values.slice(0, 3);
                const added = values.slice(3, 6);
                const steps = [
                    { operation: removeOperation },
                    { operation: addOperation, value: added[0] },
                    { operation: addOperation, value: added[1] },
                    { operation: removeOperation },
                    { operation: addOperation, value: added[2] }
                ];
                const finalState = simulate(initial, steps);
                const targetState = [initial[1], initial[2], values[6]];

                return {
                    initial_state: initial,
                    target_state: targetState,
                    operation_values: { [addOperation]: [values[6]] },
                    mental_simulation: {
                        initial_state: initial,
                        steps,
                        final_state: finalState,
                        [removalField]: finalState[0]
                    }
                };
            },
            getMentalSimulation(data) {
                return data?.mental_simulation || null;
            },
            validateScenario(data, simulation) {
                if (!Array.isArray(simulation?.initial_state) || !Array.isArray(simulation?.steps)) {
                    throw new Error(`${id} Expert scenario is missing a valid sequence.`);
                }

                const expected = simulate(simulation.initial_state, simulation.steps);

                if (!same(expected, simulation.final_state) || simulation[removalField] !== expected[0]) {
                    throw new Error(`${id} Expert prediction does not match its operations.`);
                }

                if (!Array.isArray(data?.initial_state) || !Array.isArray(data?.target_state)) {
                    throw new Error(`${id} Expert challenge is missing start or target state.`);
                }
            },
            createExecutionChallenge(data, definition) {
                return {
                    phases: [{
                        goal: { type: "state_equals", expected_state: data.target_state },
                        feedback: definition?.solve?.feedback || "Compare the start, current, and target states."
                    }]
                };
            },
            evaluatePrediction(data, response) {
                const simulation = data.mental_simulation;
                const finalCorrect = same(response.finalState, simulation.final_state);
                const removalCorrect = response.nextRemoval === simulation[removalField];

                return {
                    correctFinalState: finalCorrect,
                    correctNextPop: removalCorrect,
                    actualFinalState: simulation.final_state,
                    actualNextPop: simulation[removalField],
                    feedback: finalCorrect && removalCorrect
                        ? "Excellent mental simulation. Your final order and next removal are correct."
                        : "Replay the sequence from the FRONT/HEAD: additions join at the end and removals leave from the beginning."
                };
            }
        };
    }

    const queueExpert = createLinearGenerator({
        id: "Queue",
        addOperation: "enqueue",
        removeOperation: "dequeue",
        removalField: "next_removal"
    });
    const linkedListExpert = createLinearGenerator({
        id: "Linked List",
        addOperation: "add",
        removeOperation: "remove",
        removalField: "head_value"
    });

    function createLinearMasteryGenerator(expertGenerator) {
        return {
            version: 1,
            generate({ random }) {
                const generated = expertGenerator.generate({ random });

                return {
                    initial_state: generated.initial_state,
                    target_state: generated.target_state,
                    operation_values: generated.operation_values
                };
            }
        };
    }

    function insertIntoTree(values) {
        const root = { value: null, left: null, right: null };

        values.forEach(value => {
            if (root.value === null) {
                root.value = value;
                return;
            }

            let node = root;
            while (true) {
                const side = value < node.value ? "left" : "right";
                if (!node[side]) {
                    node[side] = { value, left: null, right: null };
                    return;
                }
                node = node[side];
            }
        });

        const links = [];
        const visit = node => {
            if (!node || node.value === null) return;
            if (node.left) links.push(`${node.value}→${node.left.value}`);
            if (node.right) links.push(`${node.value}→${node.right.value}`);
            visit(node.left);
            visit(node.right);
        };
        visit(root);

        return { root: root.value, links };
    }

    const bstExpert = {
        version: 1,
        generate({ random }) {
            const values = shuffled([20, 30, 35, 40, 50, 60, 65, 70, 80], random);
            const root = 50;
            const remaining = values.filter(value => value !== root).slice(0, 5);
            const sequence = [root, ...remaining];
            const tree = insertIntoTree(sequence);

            return {
                values: sequence,
                expected_outcome: "built",
                mental_simulation: {
                    initial_state: [root],
                    steps: remaining.map(value => ({ operation: "insert", value, label: `INSERT ${value}` })),
                    root: tree.root,
                    links: tree.links
                }
            };
        },
        getMentalSimulation(data) {
            return data?.mental_simulation || null;
        },
        validateScenario(data, simulation) {
            const tree = insertIntoTree(data?.values || []);
            if (!simulation || tree.root !== simulation.root || !same(tree.links, simulation.links)) {
                throw new Error("BST Expert scenario does not match its insertion sequence.");
            }
        },
        createExecutionChallenge(data, definition) {
            return {
                phases: [{
                    goal: { type: "outcome_equals", expected_outcome: "built" },
                    feedback: definition?.solve?.feedback || "Insert each value and follow the comparison path."
                }]
            };
        },
        evaluatePrediction(data, response) {
            const simulation = data.mental_simulation;
            const rootCorrect = response.root === simulation.root;
            const linksCorrect = same(response.links, simulation.links);

            return {
                correctFinalState: linksCorrect,
                correctNextPop: rootCorrect,
                actualFinalState: simulation.links,
                actualNextPop: simulation.root,
                feedback: rootCorrect && linksCorrect
                    ? "Correct. You predicted the root and every parent-child relationship."
                    : "Follow each insertion from the root: smaller values go left and larger values go right."
            };
        }
    };

    const bstMastery = {
        version: 1,
        generate({ random }) {
            const data = bstExpert.generate({ random });
            return { values: data.values, expected_outcome: "built" };
        }
    };

    function bubblePass(values) {
        const result = [...values];
        const steps = [];
        let swaps = 0;

        for (let index = 0; index < result.length - 1; index++) {
            const shouldSwap = result[index] > result[index + 1];
            steps.push({
                operation: shouldSwap ? "swap" : "keep",
                index,
                left: result[index],
                right: result[index + 1],
                label: `${result[index]} and ${result[index + 1]} → ${shouldSwap ? "SWAP" : "KEEP"}`
            });
            if (shouldSwap) {
                [result[index], result[index + 1]] = [result[index + 1], result[index]];
                swaps++;
            }
        }

        return { steps, finalState: result, comparisons: steps.length, swaps };
    }

    const bubbleExpert = {
        version: 1,
        generate({ random }) {
            const initial = shuffled([14, 29, 37, 52, 68], random).slice(0, 4);
            const simulation = bubblePass(initial);
            return {
                values: initial,
                target_state: [...initial].sort((a, b) => a - b),
                expected_outcome: "sorted",
                mental_simulation: {
                    initial_state: initial,
                    steps: simulation.steps,
                    final_state: simulation.finalState,
                    comparisons: simulation.comparisons,
                    swaps: simulation.swaps
                }
            };
        },
        getMentalSimulation(data) { return data?.mental_simulation || null; },
        validateScenario(data, simulation) {
            const expected = bubblePass(simulation?.initial_state || []);
            if (!same(expected.steps, simulation?.steps) || !same(expected.finalState, simulation?.final_state)) {
                throw new Error("Bubble Sort Expert scenario does not match its displayed pass.");
            }
            if (!Array.isArray(data?.target_state)) throw new Error("Bubble Sort target is missing.");
        },
        createExecutionChallenge(data, definition) {
            return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "sorted" }, feedback: definition?.solve?.feedback || "Compare the highlighted neighbors before choosing." }] };
        },
        evaluatePrediction(data, response) {
            const simulation = data.mental_simulation;
            const correct = same(response.finalState, simulation.final_state)
                && response.comparisons === simulation.comparisons
                && response.swaps === simulation.swaps;
            return {
                correctFinalState: correct,
                correctNextPop: correct,
                actualFinalState: simulation.final_state,
                actualNextPop: simulation.swaps,
                feedback: correct ? "Correct: you tracked each comparison, swap, and resulting pass." : "Replay the pass pair by pair. Only a larger left value swaps right."
            };
        }
    };

    const bubbleMastery = {
        version: 1,
        generate({ random }) {
            const generated = bubbleExpert.generate({ random });
            return { values: generated.values, target_state: generated.target_state, expected_outcome: "sorted" };
        }
    };

    function fcfsSimulation(processes) {
        const order = processes.map(process => process.id);
        let elapsed = 0;
        const waiting = {};
        processes.forEach(process => {
            waiting[process.id] = elapsed;
            elapsed += process.burst;
        });
        return { order, waiting };
    }

    const fcfsExpert = {
        version: 1,
        generate({ random }) {
            const bursts = shuffled([2, 3, 4, 5], random).slice(0, 3);
            const processes = bursts.map((burst, index) => ({ id: `P${index + 1}`, burst }));
            const simulation = fcfsSimulation(processes);
            return {
                processes,
                expected_outcome: "complete",
                mental_simulation: {
                    initial_state: processes,
                    steps: processes.map(process => ({ operation: `run-${process.id.toLowerCase()}`, label: `${process.id} runs for ${process.burst} units` })),
                    execution_order: simulation.order,
                    waiting_times: simulation.waiting
                }
            };
        },
        getMentalSimulation(data) { return data?.mental_simulation || null; },
        validateScenario(data, simulation) {
            const expected = fcfsSimulation(data?.processes || []);
            if (!same(expected.order, simulation?.execution_order) || !same(expected.waiting, simulation?.waiting_times)) throw new Error("FCFS Expert scenario does not match arrival order.");
        },
        createExecutionChallenge(data, definition) {
            return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "complete" }, feedback: definition?.solve?.feedback || "FCFS always runs the process at the front of the ready queue." }] };
        },
        evaluatePrediction(data, response) {
            const simulation = data.mental_simulation;
            const orderCorrect = same(response.executionOrder, simulation.execution_order);
            const waitingCorrect = response.waitingTimes === Object.values(simulation.waiting_times).join(", ");
            return {
                correctFinalState: orderCorrect,
                correctNextPop: waitingCorrect,
                actualFinalState: simulation.execution_order,
                actualNextPop: Object.values(simulation.waiting_times).join(", "),
                feedback: orderCorrect && waitingCorrect ? "Correct. Arrival order determines both execution order and waiting time." : "Build the timeline from left to right: each earlier burst becomes waiting time for later processes."
            };
        }
    };
    const fcfsMastery = { version: 1, generate({ random }) { const data = fcfsExpert.generate({ random }); return { processes: data.processes, expected_outcome: "complete" }; } };

    function rrSimulation(processes, quantum) {
        const queue = processes.map(process => ({ ...process, remaining: process.burst }));
        const completed = [];
        const steps = [];
        let queueAfterThree = [];

        while (queue.length) {
            const process = queue.shift();
            const used = Math.min(quantum, process.remaining);
            process.remaining -= used;
            steps.push({ operation: `run-${process.id.toLowerCase()}`, process: process.id, used, remaining: process.remaining, label: `${process.id} uses ${used} units${process.remaining ? ` → ${process.remaining} left` : " → complete"}` });
            if (process.remaining) queue.push(process); else completed.push(process.id);
            if (steps.length === 3) queueAfterThree = queue.map(item => item.id);
        }

        return { steps, completion_order: completed, queue_after_three: queueAfterThree };
    }

    const rrExpert = {
        version: 1,
        generate({ random }) {
            const bursts = shuffled([3, 4, 5, 6], random).slice(0, 3);
            const processes = bursts.map((burst, index) => ({ id: `P${index + 1}`, burst }));
            const quantum = integer(random, 2, 3);
            const simulation = rrSimulation(processes, quantum);
            return {
                processes,
                quantum,
                expected_outcome: "complete",
                mental_simulation: {
                    initial_state: processes,
                    quantum,
                    steps: simulation.steps,
                    completion_order: simulation.completion_order,
                    queue_after_three: simulation.queue_after_three
                }
            };
        },
        getMentalSimulation(data) { return data?.mental_simulation || null; },
        validateScenario(data, simulation) {
            const expected = rrSimulation(data?.processes || [], data?.quantum);
            if (!same(expected.steps, simulation?.steps) || !same(expected.completion_order, simulation?.completion_order)) throw new Error("Round Robin Expert scenario does not match its scheduling rounds.");
        },
        createExecutionChallenge(data, definition) { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "complete" }, feedback: definition?.solve?.feedback || "The front process gets the next quantum." }] }; },
        evaluatePrediction(data, response) {
            const simulation = data.mental_simulation;
            const completionCorrect = same(response.completionOrder, simulation.completion_order);
            const roundsCorrect = same(response.firstRounds, simulation.queue_after_three);
            return { correctFinalState: completionCorrect, correctNextPop: roundsCorrect, actualFinalState: simulation.completion_order, actualNextPop: listText(simulation.queue_after_three), feedback: completionCorrect && roundsCorrect ? "Correct. You tracked the rotating queue and completion order." : "Move the front process through one quantum at a time; unfinished work returns to the rear." };
        }
    };
    const rrMastery = { version: 1, generate({ random }) { const data = rrExpert.generate({ random }); return { processes: data.processes, quantum: data.quantum, expected_outcome: "complete" }; } };

    function relationalScenario(random) {
        const ids = shuffled([101, 102, 103, 104], random);
        const chosenNames = shuffled(names, random);
        const students = ids.slice(0, 3).map((id, index) => ({ id, name: chosenNames[index] }));
        const payments = students.map((student, index) => ({ payment_id: `P00${index + 1}`, student_id: student.id }));
        const target = payments[integer(random, 0, payments.length - 1)];
        const student = students.find(item => item.id === target.student_id);
        return { students, payments, target_payment: target.payment_id, expected_student: student.name };
    }

    const relationalExpert = {
        version: 1,
        generate({ random }) {
            const data = relationalScenario(random);
            const second = data.payments.find(payment => payment.payment_id !== data.target_payment);
            return {
                ...data,
                expected_outcome: "matched",
                mental_simulation: {
                    initial_state: data.payments,
                    steps: [
                        { operation: `trace-${data.target_payment.toLowerCase()}`, label: `${data.target_payment}.STUDENT_ID → STUDENTS.ID` },
                        { operation: `trace-${second.payment_id.toLowerCase()}`, label: `${second.payment_id}.STUDENT_ID → STUDENTS.ID` }
                    ],
                    matched_student: data.expected_student,
                    valid_payments: data.payments.map(payment => payment.payment_id)
                }
            };
        },
        getMentalSimulation(data) { return data?.mental_simulation || null; },
        validateScenario(data, simulation) {
            const expected = data?.students?.find(student => student.name === simulation?.matched_student);
            if (!expected || !Array.isArray(simulation?.valid_payments)) throw new Error("Relational Keys Expert scenario has invalid references.");
        },
        createExecutionChallenge(data, definition) { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "matched" }, feedback: definition?.solve?.feedback || "Trace the foreign key to its unique primary-key row." }] }; },
        evaluatePrediction(data, response) {
            const simulation = data.mental_simulation;
            const studentCorrect = response.student === simulation.matched_student;
            const validCorrect = same(response.validPayments, simulation.valid_payments);
            return { correctFinalState: validCorrect, correctNextPop: studentCorrect, actualFinalState: simulation.valid_payments, actualNextPop: simulation.matched_student, feedback: studentCorrect && validCorrect ? "Correct. Every shown foreign key references one valid student row." : "Match each PAYMENT.STUDENT_ID against STUDENTS.ID, which must identify one row." };
        }
    };
    const relationalMastery = { version: 1, generate({ random }) { return { ...relationalScenario(random), expected_outcome: "matched" }; } };

    const routingNodes = [
        { id: "computer-a", label: "Computer A", type: "computer", x: 300, y: 40 },
        { id: "router-1", label: "Router 1", type: "router", x: 300, y: 120 },
        { id: "router-2", label: "Router 2", type: "router", x: 180, y: 215 },
        { id: "router-3", label: "Router 3", type: "router", x: 420, y: 215 },
        { id: "server-b", label: "Server B", type: "server", x: 180, y: 330 },
        { id: "server-c", label: "Server C", type: "server", x: 420, y: 330 }
    ];
    const routingNetworks = [
        {
            destination: "server-c",
            route: ["computer-a", "router-1", "router-3", "server-c"],
            edges: [
                { from: "computer-a", to: "router-1" },
                { from: "router-1", to: "router-2" },
                { from: "router-1", to: "router-3" },
                { from: "router-2", to: "server-b" },
                { from: "router-3", to: "server-c" }
            ]
        },
        {
            destination: "server-c",
            route: ["computer-a", "router-1", "router-2", "server-c"],
            edges: [
                { from: "computer-a", to: "router-1" },
                { from: "router-1", to: "router-2" },
                { from: "router-1", to: "router-3", disabled: true },
                { from: "router-2", to: "server-c" },
                { from: "router-3", to: "server-b" }
            ]
        },
        {
            destination: "server-b",
            route: ["computer-a", "router-1", "router-3", "server-b"],
            edges: [
                { from: "computer-a", to: "router-1" },
                { from: "router-1", to: "router-2", disabled: true },
                { from: "router-1", to: "router-3" },
                { from: "router-2", to: "server-c" },
                { from: "router-3", to: "server-b" }
            ]
        }
    ];

    const routingExpert = {
        version: 1,
        generate({ random }) {
            const scenario = routingNetworks[integer(random, 0, routingNetworks.length - 1)];
            const other = routingNetworks.find(item => item.destination !== scenario.destination);
            return {
                ...scenario,
                nodes: routingNodes,
                expected_outcome: "delivered",
                mental_simulation: {
                    initial_state: "computer-a",
                    steps: scenario.route.slice(1).map(node => ({ operation: `to-${node}`, label: `Forward packet to ${node.replace("-", " ")}` })),
                    route: scenario.route,
                    reachable: true,
                    distractor_route: other.route
                }
            };
        },
        getMentalSimulation(data) { return data?.mental_simulation || null; },
        validateScenario(data, simulation) {
            if (!Array.isArray(simulation?.route) || simulation.route.at(-1) !== data?.destination) {
                throw new Error("Packet Routing Expert scenario does not reach its destination.");
            }

            const routeIsActive = simulation.route.slice(1).every((nodeId, index) => (
                data?.edges?.some(edge => (
                    edge.from === simulation.route[index]
                    && edge.to === nodeId
                    && !edge.disabled
                ))
            ));

            if (!routeIsActive) {
                throw new Error("Packet Routing Expert scenario uses an unavailable link.");
            }
        },
        createExecutionChallenge(data, definition) { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "delivered" }, feedback: definition?.solve?.feedback || "Choose the next hop that leads toward the destination." }] }; },
        evaluatePrediction(data, response) {
            const simulation = data.mental_simulation;
            const routeCorrect = same(response.route, simulation.route);
            const reachableCorrect = response.reachable === "reachable";
            return { correctFinalState: routeCorrect, correctNextPop: reachableCorrect, actualFinalState: simulation.route, actualNextPop: "reachable", feedback: routeCorrect && reachableCorrect ? "Correct. The packet has a valid path to the requested server." : "Start at Computer A and follow the router branch that reaches the requested server." };
        }
    };
    const routingMastery = { version: 1, generate({ random }) { const data = routingExpert.generate({ random }); return { destination: data.destination, route: data.route, expected_outcome: "delivered" }; } };

    registerScenarioGenerator("queue-mastery", createLinearMasteryGenerator(queueExpert));
    registerScenarioGenerator("queue-expert", queueExpert);
    registerScenarioGenerator("linked-list-mastery", createLinearMasteryGenerator(linkedListExpert));
    registerScenarioGenerator("linked-list-expert", linkedListExpert);
    registerScenarioGenerator("bst-mastery", bstMastery);
    registerScenarioGenerator("bst-expert", bstExpert);
    registerScenarioGenerator("bubble-sort-mastery", bubbleMastery);
    registerScenarioGenerator("bubble-sort-expert", bubbleExpert);
    registerScenarioGenerator("fcfs-mastery", fcfsMastery);
    registerScenarioGenerator("fcfs-expert", fcfsExpert);
    registerScenarioGenerator("round-robin-mastery", rrMastery);
    registerScenarioGenerator("round-robin-expert", rrExpert);
    registerScenarioGenerator("relational-keys-mastery", relationalMastery);
    registerScenarioGenerator("relational-keys-expert", relationalExpert);
    registerScenarioGenerator("packet-routing-mastery", routingMastery);
    registerScenarioGenerator("packet-routing-expert", routingExpert);
}


createRemainingMasteryGenerators();
