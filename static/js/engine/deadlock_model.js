/* Executable one-instance resource-allocation model. */
const DeadlockModel = (() => {
    const clone = value => JSON.parse(JSON.stringify(value));

    function baseState(problem) {
        if (problem?.assumption !== "one-instance-per-resource") {
            throw new Error("This lesson requires the explicit one-instance-per-resource assumption.");
        }
        if (!Array.isArray(problem.processes) || problem.processes.length < 2
            || !Array.isArray(problem.resources) || problem.resources.length < 2) {
            throw new Error("A deadlock problem needs at least two processes and two resources.");
        }
        const processSet = new Set(problem.processes);
        const resourceSet = new Set(problem.resources);
        if (processSet.size !== problem.processes.length || resourceSet.size !== problem.resources.length
            || [...processSet].some(id => typeof id !== "string" || !id)
            || [...resourceSet].some(id => typeof id !== "string" || !id)) {
            throw new Error("Process and resource IDs must be unique non-empty strings.");
        }
        const allocations = {};
        for (const item of problem.allocations || []) {
            if (!item || !processSet.has(item.process) || !resourceSet.has(item.resource)) {
                throw new Error("Allocation references an unknown process or resource.");
            }
            if (allocations[item.resource]) throw new Error(`${item.resource} has only one modeled instance.`);
            allocations[item.resource] = item.process;
        }
        return { assumption: problem.assumption, processes: [...problem.processes], resources: [...problem.resources],
            allocations, requests: [], history: [] };
    }

    function waitGraph(state) {
        const graph = Object.fromEntries(state.processes.map(id => [id, []]));
        for (const request of state.requests) {
            const holder = state.allocations[request.resource];
            if (holder && holder !== request.process) graph[request.process].push({ process: holder, resource: request.resource });
        }
        return graph;
    }

    function findCycle(state) {
        const graph = waitGraph(state);
        const visiting = new Set(), visited = new Set(), stack = [];
        let found = null;
        function visit(node) {
            if (found) return;
            visiting.add(node); stack.push(node);
            for (const edge of graph[node]) {
                if (visiting.has(edge.process)) {
                    const start = stack.indexOf(edge.process);
                    found = [...stack.slice(start), edge.process];
                    return;
                }
                if (!visited.has(edge.process)) visit(edge.process);
            }
            stack.pop(); visiting.delete(node); visited.add(node);
        }
        for (const process of state.processes) if (!visited.has(process)) visit(process);
        return found;
    }

    function snapshot(state) {
        const cycle = findCycle(state);
        const blockedProcesses = [...new Set(state.requests.filter(request => state.allocations[request.resource]
            && state.allocations[request.resource] !== request.process).map(request => request.process))].sort();
        return { ...clone(state), blockedProcesses, cycle: cycle || [],
            classification: cycle ? "deadlocked" : blockedProcesses.length ? "blocked" : "safe" };
    }

    function applyEvent(state, event) {
        if (!event || !["request", "release"].includes(event.type)
            || !state.processes.includes(event.process) || !state.resources.includes(event.resource)) {
            throw new Error("Unknown or incomplete resource event.");
        }
        const before = snapshot(state);
        const next = clone(state);
        let outcome;
        if (event.type === "request") {
            if (next.allocations[event.resource] === event.process) {
                throw new Error(`${event.process} already holds ${event.resource}.`);
            }
            if (next.requests.some(item => item.process === event.process && item.resource === event.resource)) {
                throw new Error("The same request cannot be added twice.");
            }
            if (!next.allocations[event.resource]) {
                next.allocations[event.resource] = event.process;
                outcome = "GRANTED";
            } else {
                next.requests.push({ process: event.process, resource: event.resource });
                outcome = findCycle(next) ? "DEADLOCKED" : "BLOCKED";
            }
        } else {
            if (next.allocations[event.resource] !== event.process) {
                throw new Error(`${event.process} cannot release ${event.resource} because it does not hold it.`);
            }
            delete next.allocations[event.resource];
            const waitingIndex = next.requests.findIndex(item => item.resource === event.resource);
            if (waitingIndex >= 0) {
                const [waiting] = next.requests.splice(waitingIndex, 1);
                next.allocations[event.resource] = waiting.process;
            }
            outcome = findCycle(next) ? "DEADLOCKED" : "RELEASED";
        }
        const record = { index: next.history.length, ...event, outcome };
        next.history.push(record);
        return { before, after: snapshot(next), event: record, outcome };
    }

    function validateProblem(problem) {
        let state = baseState(problem);
        if (!Array.isArray(problem.events) || !problem.events.length) throw new Error("A deadlock problem needs resource events.");
        for (const event of problem.events) state = applyEvent(state, event).after;
        return true;
    }

    function simulate(problem) {
        let state = baseState(problem);
        if (!Array.isArray(problem.events) || !problem.events.length) throw new Error("A deadlock problem needs resource events.");
        const transitions = [];
        let cycleCompletingRequest = null;
        for (const event of problem.events) {
            const result = applyEvent(state, event);
            if (result.outcome === "DEADLOCKED" && result.before.classification !== "deadlocked" && event.type === "request") {
                cycleCompletingRequest = `${event.process}->${event.resource}`;
            }
            transitions.push(result); state = result.after;
        }
        return { finalState: snapshot(state), transitions: clone(transitions), cycleCompletingRequest };
    }

    function tokens(value) {
        if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean).sort();
        const text = String(value ?? "").trim();
        if (!text || text.toUpperCase() === "NONE") return [];
        return text.split(",").map(item => item.trim()).filter(Boolean).sort();
    }
    function assess(problem, response = {}) {
        const actual = simulate(problem);
        const state = actual.finalState;
        const expectedCycle = [...new Set(state.cycle)].sort();
        const submittedClassification = String(response.classification || "").trim().toLowerCase();
        const submittedRequest = String(response.cycleRequest || "").replaceAll(" ", "").toUpperCase();
        const expectedRequest = (actual.cycleCompletingRequest || "NONE").toUpperCase();
        const definitions = [
            { id: "blockedProcesses", label: "Blocked processes", submitted: tokens(response.blockedProcesses), expected: state.blockedProcesses, correct: JSON.stringify(tokens(response.blockedProcesses)) === JSON.stringify(state.blockedProcesses) },
            { id: "classification", label: "Final classification", submitted: submittedClassification, expected: state.classification, correct: submittedClassification === state.classification },
            { id: "cycleRequest", label: "Cycle-completing request", submitted: submittedRequest, expected: expectedRequest, correct: submittedRequest === expectedRequest },
            { id: "cycleProcesses", label: "Processes in the cycle", submitted: tokens(response.cycleProcesses), expected: expectedCycle, correct: JSON.stringify(tokens(response.cycleProcesses)) === JSON.stringify(expectedCycle) }
        ];
        const allCorrect = definitions.every(field => field.correct);
        return { allCorrect, fields: definitions, actualResult: actual, actualFinalState: state,
            correctFinalState: allCorrect, correctNextPop: true,
            feedback: allCorrect ? "Your prediction matches the one-instance resource model."
                : `Recheck: ${definitions.filter(field => !field.correct).map(field => field.label).join(", ")}.` };
    }

    function eventText(event) {
        return event.type === "request" ? `${event.process} requests ${event.resource}` : `${event.process} releases ${event.resource}`;
    }
    function createSession(problem) {
        validateProblem(problem);
        let state = baseState(problem), index = 0;
        return { getState: () => snapshot(state), getIndex: () => index, getLength: () => problem.events.length,
            getEvent: () => clone(problem.events[index] || null),
            predict(choice) {
                const event = problem.events[index];
                if (!event) return { accepted: false, complete: true, state: snapshot(state) };
                const result = applyEvent(state, event);
                const normalized = String(choice || "").trim().toUpperCase();
                const correct = normalized === result.outcome;
                if (correct) { state = result.after; index++; }
                return { accepted: correct, choice: normalized, expected: result.outcome, transition: clone(result),
                    complete: correct && index >= problem.events.length, state: snapshot(state) };
            },
            reset() { state = baseState(problem); index = 0; return snapshot(state); }
        };
    }
    return { baseState, snapshot, waitGraph, findCycle, applyEvent, validateProblem, simulate, assess, createSession, eventText };
})();
