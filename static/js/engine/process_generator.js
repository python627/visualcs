/* Seeded process-event scenarios. Final states are derived only by ProcessModel. */
const ProcessGenerator = {
    version: 1,
    generate({ random, rules = {} }) {
        const counts = rules.processCounts || [3, 4];
        const eventCounts = rules.eventCounts || [5, 6, 7];
        const mixedInitial = rules.mixedInitial === true;
        if (!Array.isArray(counts) || !counts.length || !counts.every(n => Number.isInteger(n) && n >= 2 && n <= 7)
            || !Array.isArray(eventCounts) || !eventCounts.length || !eventCounts.every(n => Number.isInteger(n) && n >= 3 && n <= 12)) {
            throw new Error("Invalid process generation rules.");
        }
        const pick = values => values[Math.floor(random() * values.length)];
        const processCount = pick(counts);
        const targetEvents = pick(eventCounts);
        const processes = Array.from({ length: processCount }, (_, index) => ({ id: `P${index + 1}`, state: "READY" }));
        if (mixedInitial) {
            processes[0].state = "RUNNING";
            processes.at(-1).state = "WAITING";
        }
        const base = { cpuCount: 1, processes };
        let state = ProcessModel.initialSnapshot(base);
        const events = [];
        const chooseProcess = ids => ids[Math.floor(random() * ids.length)];

        while (events.length < targetEvents) {
            const candidates = [];
            if (state.RUNNING.length === 0 && state.READY.length) {
                for (const id of state.READY) candidates.push({ type: "dispatch", process: id });
            }
            for (const id of state.RUNNING) {
                candidates.push({ type: "timeslice", process: id }, { type: "io_request", process: id });
                if (state.TERMINATED.length < processCount - 1) candidates.push({ type: "finish", process: id });
            }
            for (const id of state.WAITING) candidates.push({ type: "io_complete", process: id });
            if (!candidates.length) break;
            let event;
            if (!events.length && state.RUNNING.length === 0) {
                event = { type: "dispatch", process: chooseProcess(state.READY) };
            } else {
                event = pick(candidates);
            }
            state = ProcessModel.transition(state, event).after;
            events.push(event);
        }
        const problem = { cpuCount: 1, processes, events };
        const data = { problem, oracle: ProcessModel.simulate(problem) };
        this.validateScenario(data);
        return data;
    },
    validateScenario(data) {
        if (!data?.problem || !data?.oracle) throw new Error("Process scenario needs inputs and a private oracle.");
        ProcessModel.validateProblem(data.problem);
        const expected = ProcessModel.simulate(data.problem);
        if (JSON.stringify(expected) !== JSON.stringify(data.oracle)) throw new Error("Process oracle does not match the model.");
    },
    getMentalSimulation(data) {
        this.validateScenario(data);
        return { initial_state: JSON.parse(JSON.stringify(data.problem)),
            steps: data.problem.events.map(event => ({ operation: event.type, process: event.process, label: ProcessModel.eventText(event) })) };
    },
    evaluatePrediction(data, response) { this.validateScenario(data); return ProcessModel.assess(data.problem, response); },
    createExecutionChallenge() { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] }; }
};
registerScenarioGenerator("process", ProcessGenerator);
