/* Executable single-CPU process-state model. JSON supplies events; this model owns transition truth. */
const ProcessModel = (() => {
    const STATES = ["READY", "RUNNING", "WAITING", "TERMINATED"];
    const EVENT_TARGETS = {
        dispatch: ["READY", "RUNNING"],
        timeslice: ["RUNNING", "READY"],
        io_request: ["RUNNING", "WAITING"],
        io_complete: ["WAITING", "READY"],
        finish: ["RUNNING", "TERMINATED"]
    };
    const clone = value => JSON.parse(JSON.stringify(value));

    function normalizeState(value) {
        const state = String(value || "").trim().toUpperCase();
        if (!STATES.includes(state)) throw new Error(`Unknown process state: ${value}.`);
        return state;
    }

    function initialSnapshot(problem) {
        if (!problem || !Number.isInteger(problem.cpuCount) || problem.cpuCount < 1) {
            throw new Error("A process problem needs at least one CPU.");
        }
        if (!Array.isArray(problem.processes) || !problem.processes.length) {
            throw new Error("A process problem needs processes.");
        }
        const states = {};
        const queues = { READY: [], RUNNING: [], WAITING: [], TERMINATED: [] };
        for (const process of problem.processes) {
            if (!process || typeof process.id !== "string" || !process.id || states[process.id]) {
                throw new Error("Process IDs must be unique non-empty strings.");
            }
            const state = normalizeState(process.state);
            states[process.id] = state;
            queues[state].push(process.id);
        }
        if (queues.RUNNING.length > problem.cpuCount) {
            throw new Error("More processes are RUNNING than the modeled CPUs allow.");
        }
        return { cpuCount: problem.cpuCount, states, ...queues, history: [] };
    }

    function transition(snapshot, event) {
        if (!event || !Object.hasOwn(EVENT_TARGETS, event.type) || typeof event.process !== "string") {
            throw new Error("Unknown or incomplete process event.");
        }
        if (!Object.hasOwn(snapshot.states, event.process)) {
            throw new Error(`Unknown process: ${event.process}.`);
        }
        const [from, to] = EVENT_TARGETS[event.type];
        const actual = snapshot.states[event.process];
        if (actual !== from) {
            throw new Error(`${event.type} requires ${event.process} to be ${from}, not ${actual}.`);
        }
        if (to === "RUNNING" && snapshot.RUNNING.length >= snapshot.cpuCount) {
            throw new Error("The single-CPU scenario already has a RUNNING process.");
        }
        const next = clone(snapshot);
        next[from] = next[from].filter(id => id !== event.process);
        next[to].push(event.process);
        next.states[event.process] = to;
        const record = { index: next.history.length, type: event.type, process: event.process, from, to };
        next.history.push(record);
        return { before: clone(snapshot), after: next, event: record, from, to };
    }

    function validateProblem(problem) {
        let state = initialSnapshot(problem);
        if (!Array.isArray(problem.events) || !problem.events.length) {
            throw new Error("A process problem needs at least one event.");
        }
        for (const event of problem.events) state = transition(state, event).after;
        return true;
    }

    function simulate(problem) {
        let state = initialSnapshot(problem);
        if (!Array.isArray(problem.events) || !problem.events.length) {
            throw new Error("A process problem needs at least one event.");
        }
        const transitions = [];
        for (const event of problem.events) {
            const result = transition(state, event);
            transitions.push(result);
            state = result.after;
        }
        return { finalState: clone(state), transitions: clone(transitions) };
    }

    function tokens(value) {
        if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
        const text = String(value ?? "").trim();
        if (!text || text.toUpperCase() === "NONE") return [];
        return text.split(",").map(item => item.trim()).filter(Boolean);
    }

    function assess(problem, response = {}) {
        const actual = simulate(problem);
        const expected = actual.finalState;
        const definitions = [
            ["ready", "READY processes", expected.READY],
            ["running", "RUNNING processes", expected.RUNNING],
            ["waiting", "WAITING processes", expected.WAITING],
            ["terminated", "TERMINATED processes", expected.TERMINATED]
        ];
        const fields = definitions.map(([id, label, wanted]) => {
            const submitted = tokens(response[id]);
            return { id, label, submitted, expected: clone(wanted), correct: JSON.stringify(submitted) === JSON.stringify(wanted) };
        });
        const allCorrect = fields.every(field => field.correct);
        return {
            allCorrect,
            fields,
            actualResult: actual,
            actualFinalState: expected,
            correctFinalState: allCorrect,
            correctNextPop: true,
            feedback: allCorrect
                ? "Every process is in the state produced by the event sequence."
                : `Recheck: ${fields.filter(field => !field.correct).map(field => field.label).join(", ")}.`
        };
    }

    function eventText(event) {
        return {
            dispatch: `Scheduler dispatches ${event.process}`,
            timeslice: `${event.process}'s time slice expires`,
            io_request: `${event.process} requests I/O`,
            io_complete: `${event.process}'s I/O completes`,
            finish: `${event.process} finishes`
        }[event.type];
    }

    function createSession(problem) {
        validateProblem(problem);
        let state = initialSnapshot(problem);
        let index = 0;
        return {
            getState: () => clone(state),
            getIndex: () => index,
            getEvent: () => clone(problem.events[index] || null),
            getLength: () => problem.events.length,
            predict(nextState) {
                const event = problem.events[index];
                if (!event) return { accepted: false, complete: true, state: clone(state) };
                const result = transition(state, event);
                const choice = normalizeState(nextState);
                const correct = choice === result.to;
                if (correct) {
                    state = result.after;
                    index++;
                }
                return { accepted: correct, choice, expected: result.to, transition: clone(result),
                    complete: correct && index >= problem.events.length, state: clone(state) };
            },
            reset() { state = initialSnapshot(problem); index = 0; return clone(state); }
        };
    }

    return { states: STATES, eventTargets: EVENT_TARGETS, initialSnapshot, transition, validateProblem,
        simulate, assess, createSession, eventText };
})();
