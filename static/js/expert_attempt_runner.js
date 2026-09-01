function getValidatedMentalSimulation(scenario) {
    const simulation = scenario?.data?.mental_simulation;

    if (!simulation || typeof simulation !== "object") {
        throw new Error("Expert prediction scenario is missing mental_simulation.");
    }

    if (!Array.isArray(simulation.initial_state) || !simulation.initial_state.length) {
        throw new Error("Expert prediction scenario needs a non-empty starting Stack.");
    }

    if (!Array.isArray(simulation.steps) || !simulation.steps.length) {
        throw new Error("Expert prediction scenario has no operations to simulate.");
    }

    const expectedFinalState = [...simulation.initial_state];

    simulation.steps.forEach((step, index) => {
        if (!step || (step.operation !== "push" && step.operation !== "pop")) {
            throw new Error(`Expert prediction operation ${index + 1} is invalid.`);
        }

        if (step.operation === "push") {
            if (!Number.isFinite(step.value)) {
                throw new Error(`Expert prediction PUSH ${index + 1} is missing its value.`);
            }

            expectedFinalState.push(step.value);
            return;
        }

        if (!expectedFinalState.length) {
            throw new Error(`Expert prediction POP ${index + 1} would remove from an empty Stack.`);
        }

        expectedFinalState.pop();
    });

    if (
        !Array.isArray(simulation.final_state)
        || JSON.stringify(simulation.final_state) !== JSON.stringify(expectedFinalState)
    ) {
        throw new Error("Expert prediction final Stack does not match its displayed operations.");
    }

    if (simulation.next_pop_value !== expectedFinalState.at(-1)) {
        throw new Error("Expert prediction next POP value does not match its displayed operations.");
    }

    return simulation;
}


function cloneScenarioValue(value) {
    return JSON.parse(JSON.stringify(value));
}


class ExpertAttemptRunner {

    constructor({ definition, scenario }) {
        this.definition = definition || {};
        this.scenario = scenario;
        this.generator = ScenarioFactory.getGenerator(scenario?.generator);
        if (!this.generator) {
            throw new Error("Expert scenario refers to an unavailable generator.");
        }

        this.mentalSimulation = this.generator.getMentalSimulation
            ? this.generator.getMentalSimulation(scenario.data)
            : getValidatedMentalSimulation(scenario);

        if (!this.mentalSimulation || typeof this.mentalSimulation !== "object") {
            throw new Error("Expert scenario is missing prediction data.");
        }

        if (this.generator.validateScenario) {
            this.generator.validateScenario(scenario.data, this.mentalSimulation);
        }

        const executionChallenge = this.generator.createExecutionChallenge
            ? this.generator.createExecutionChallenge(scenario.data, this.definition)
            : {
                phases: [
                    {
                        goal: {
                            type: "state_equals",
                            expected_state: scenario?.data?.target_state || []
                        },
                        feedback: this.definition?.solve?.feedback
                            || "Keep comparing your current state with the target."
                    }
                ]
            };

        this.executionRunner = new ChallengeRunner({
            phases: executionChallenge?.phases || []
        });
        this.stage = "think";
        this.prediction = null;
        this.transcript = [];
        this.result = null;
    }


    getStage() {
        return this.stage;
    }


    isExecutionActive() {
        return this.stage === "solve" && !this.result;
    }


    getMetrics() {
        return this.executionRunner.getMetrics();
    }


    getPrediction() {
        return this.prediction;
    }


    getMentalSimulation() {
        return cloneScenarioValue(this.mentalSimulation);
    }


    getTranscript() {
        return this.transcript.map(event => ({ ...event, state: [...event.state] }));
    }


    submitPrediction(response) {

        if (this.stage !== "think") {
            return { status: "inactive" };
        }

        const assessment = this.generator?.evaluatePrediction?.(
            this.scenario.data,
            response
        ) || {
            correctFinalState: false,
            correctNextPop: false,
            actualFinalState: [],
            actualNextPop: null
        };

        this.prediction = {
            response,
            assessment
        };
        this.stage = "review";

        return {
            status: "prediction_submitted",
            assessment
        };

    }


    beginExecution() {

        if (this.stage !== "review") {
            return { status: "inactive" };
        }

        this.stage = "solve";

        return {
            status: "execution_started",
            metrics: this.getMetrics()
        };

    }


    reportOperation(event) {

        if (!this.isExecutionActive()) {
            return { status: "inactive", ...this.getMetrics() };
        }

        this.transcript.push({
            operation: event.operation,
            value: event.value ?? null,
            removedValue: event.removedValue ?? null,
            state: Array.isArray(event.state) ? [...event.state] : []
        });

        const challengeResult = this.executionRunner.reportOperation(event);

        if (challengeResult.status !== "challenge_completed") {
            return challengeResult;
        }

        const scoring = this.generator?.scoreExecution?.(
            this.scenario.data,
            challengeResult,
            this.getTranscript()
        ) || {};
        const supportsOptimization = Number.isFinite(this.scenario.data.optimal_operations);
        const perfect = typeof scoring.perfect === "boolean"
            ? scoring.perfect
            : supportsOptimization
                && challengeResult.operations === this.scenario.data.optimal_operations;

        this.result = {
            ...challengeResult,
            status: perfect ? "expert_perfect" : "expert_solved",
            solved: true,
            perfect,
            optimalOperations: supportsOptimization
                ? this.scenario.data.optimal_operations
                : null,
            scoring
        };

        return this.result;

    }


    reportUnavailable(event) {

        if (!this.isExecutionActive()) {
            return { status: "inactive", ...this.getMetrics() };
        }

        return this.executionRunner.reportUnavailable(event);

    }
}
