/* Seeded one-instance resource scenarios. DeadlockModel computes all outcomes. */
const DeadlockGenerator = {
    version: 1,
    generate({ random, rules = {} }) {
        const counts = rules.processCounts || [2, 3, 4];
        const outcomes = rules.outcomes || ["safe", "deadlocked"];
        if (!Array.isArray(counts) || !counts.length || !counts.every(n => Number.isInteger(n) && n >= 2 && n <= 6)
            || !Array.isArray(outcomes) || !outcomes.length || !outcomes.every(value => ["safe", "deadlocked"].includes(value))) {
            throw new Error("Invalid deadlock generation rules.");
        }
        const pick = values => values[Math.floor(random() * values.length)];
        const shuffle = values => {
            const result = [...values];
            for (let index = result.length - 1; index > 0; index--) {
                const other = Math.floor(random() * (index + 1));
                [result[index], result[other]] = [result[other], result[index]];
            }
            return result;
        };
        const count = pick(counts), outcome = pick(outcomes);
        const processes = Array.from({ length: count }, (_, index) => `P${index + 1}`);
        const resources = Array.from({ length: count + (outcome === "safe" ? 1 : 0) }, (_, index) => `R${index + 1}`);
        const holders = shuffle(processes);
        const heldResources = resources.slice(0, count);
        const allocations = heldResources.map((resource, index) => ({ resource, process: holders[index] }));
        let events;
        if (outcome === "deadlocked") {
            const direction = random() < 0.5 ? 1 : count - 1;
            events = holders.map((process, index) => ({ type: "request", process,
                resource: heldResources[(index + direction) % count] }));
        } else {
            events = [{ type: "request", process: holders[0], resource: heldResources[1] }];
            if (count > 2) {
                for (let index = 1; index < count - 1; index++) {
                    events.push({ type: "request", process: holders[index],
                        resource: index === count - 2 ? resources.at(-1) : heldResources[index + 1] });
                }
            } else {
                events.push({ type: "request", process: holders[1], resource: resources.at(-1) });
            }
        }
        const problem = { assumption: "one-instance-per-resource", processes, resources, allocations, events };
        const data = { problem, oracle: DeadlockModel.simulate(problem) };
        this.validateScenario(data); return data;
    },
    validateScenario(data) {
        if (!data?.problem || !data?.oracle) throw new Error("Deadlock scenario needs inputs and a private oracle.");
        DeadlockModel.validateProblem(data.problem);
        const expected = DeadlockModel.simulate(data.problem);
        if (JSON.stringify(expected) !== JSON.stringify(data.oracle)) throw new Error("Deadlock oracle does not match the model.");
    },
    getMentalSimulation(data) {
        this.validateScenario(data);
        return { initial_state: { assumption: data.problem.assumption, processes: [...data.problem.processes], resources: [...data.problem.resources],
            allocations: JSON.parse(JSON.stringify(data.problem.allocations)), events: JSON.parse(JSON.stringify(data.problem.events)) },
            steps: data.problem.events.map(event => ({ operation: event.type, process: event.process, resource: event.resource, label: DeadlockModel.eventText(event) })) };
    },
    evaluatePrediction(data, response) { this.validateScenario(data); return DeadlockModel.assess(data.problem, response); },
    createExecutionChallenge() { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] }; }
};
registerScenarioGenerator("deadlock", DeadlockGenerator);
