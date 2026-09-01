function createBinarySearchExpertGenerator() {

    const version = 1;

    function randomInteger(random, minimum, maximum) {
        return Math.floor(random() * (maximum - minimum + 1)) + minimum;
    }


    function createSortedValues(random, length) {
        const values = [];
        let value = randomInteger(random, 8, 20);

        for (let index = 0; index < length; index++) {
            value += randomInteger(random, 5, 14);
            values.push(value);
        }

        return values;
    }


    function chooseAbsentTarget(values, random) {
        const gapIndex = randomInteger(random, 0, values.length);

        if (gapIndex === 0) {
            return values[0] - randomInteger(random, 1, 4);
        }

        if (gapIndex === values.length) {
            return values.at(-1) + randomInteger(random, 1, 4);
        }

        const lower = values[gapIndex - 1];
        const upper = values[gapIndex];

        return lower + randomInteger(random, 1, upper - lower - 1);
    }


    function simulateSearch(values, target) {
        let low = 0;
        let high = values.length - 1;
        const steps = [];

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const value = values[middle];
            let decision;

            if (target === value) {
                decision = "found";
            }
            else if (target < value) {
                decision = "left";
            }
            else {
                decision = "right";
            }

            const label = decision === "found"
                ? `Compare ${value}: it matches the target.`
                : decision === "left"
                    ? `Compare ${value}: target is smaller, so search LEFT.`
                    : `Compare ${value}: target is larger, so search RIGHT.`;

            steps.push({ low, high, middle, value, decision, label });

            if (decision === "found") {
                return {
                    values: [...values],
                    target,
                    steps,
                    compared_values: steps.map(step => step.value),
                    comparison_count: steps.length,
                    outcome: "found",
                    final_low: low,
                    final_high: high,
                    result_label: `${target} was found after ${steps.length} comparison${steps.length === 1 ? "" : "s"}.`
                };
            }

            if (decision === "left") {
                high = middle - 1;
            }
            else {
                low = middle + 1;
            }
        }

        return {
            values: [...values],
            target,
            steps,
            compared_values: steps.map(step => step.value),
            comparison_count: steps.length,
            outcome: "not_found",
            final_low: low,
            final_high: high,
            result_label: `${target} is not in the array; no candidate values remain.`
        };
    }


    function createSearchScenario(random, { avoidFirstMiddle = false } = {}) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const length = randomInteger(random, 9, 15);
            const values = createSortedValues(random, length);
            const present = random() < .62;
            const target = present
                ? values[randomInteger(random, 0, values.length - 1)]
                : chooseAbsentTarget(values, random);
            const simulation = simulateSearch(values, target);

            if (!avoidFirstMiddle || simulation.comparison_count > 1) {
                return simulation;
            }
        }

        throw new Error("Binary Search Expert generator created a trivial scenario repeatedly.");
    }


    function valuesAreSorted(values) {
        return Array.isArray(values)
            && values.every(Number.isFinite)
            && values.every((value, index) => index === 0 || values[index - 1] < value);
    }


    function sameValues(first, second) {
        return JSON.stringify(first) === JSON.stringify(second);
    }


    function validateSimulation(simulation, name) {
        if (!simulation || !valuesAreSorted(simulation.values) || !Number.isFinite(simulation.target)) {
            throw new Error(`${name} is missing a sorted array or target.`);
        }

        if (!Array.isArray(simulation.steps) || !simulation.steps.length) {
            throw new Error(`${name} has no search decisions.`);
        }

        const expected = simulateSearch(simulation.values, simulation.target);

        if (
            !sameValues(simulation.compared_values, expected.compared_values)
            || simulation.comparison_count !== expected.comparison_count
            || simulation.outcome !== expected.outcome
            || simulation.steps.length !== expected.steps.length
        ) {
            throw new Error(`${name} does not match Binary Search's actual path.`);
        }

        simulation.steps.forEach((step, index) => {
            const expectedStep = expected.steps[index];

            if (
                step.low !== expectedStep.low
                || step.high !== expectedStep.high
                || step.middle !== expectedStep.middle
                || step.value !== expectedStep.value
                || step.decision !== expectedStep.decision
            ) {
                throw new Error(`${name} step ${index + 1} does not match Binary Search.`);
            }
        });

        return expected;
    }


    return {
        version,

        generate({ random }) {
            const mentalSimulation = createSearchScenario(random, { avoidFirstMiddle: true });
            const executionSimulation = createSearchScenario(random, { avoidFirstMiddle: true });

            return {
                values: executionSimulation.values,
                target: executionSimulation.target,
                expected_outcome: executionSimulation.outcome,
                optimal_operations: executionSimulation.comparison_count,
                mental_simulation: mentalSimulation
            };
        },

        getMentalSimulation(data) {
            return data?.mental_simulation || null;
        },

        validateScenario(data, mentalSimulation) {
            const mental = validateSimulation(mentalSimulation, "Expert prediction scenario");

            if (!valuesAreSorted(data?.values) || !Number.isFinite(data?.target)) {
                throw new Error("Expert challenge scenario is missing a sorted array or target.");
            }

            const execution = simulateSearch(data.values, data.target);

            if (data.expected_outcome !== execution.outcome) {
                throw new Error("Expert challenge outcome does not match its generated search path.");
            }

            if (data.optimal_operations !== execution.comparison_count) {
                throw new Error("Expert comparison count does not match its generated search path.");
            }

            return mental;
        },

        createExecutionChallenge(data, definition) {
            return {
                phases: [
                    {
                        goal: {
                            type: "outcome_equals",
                            expected_outcome: data.expected_outcome
                        },
                        feedback: definition?.solve?.feedback
                            || "Compare the target with the current middle before deciding."
                    }
                ]
            };
        },

        evaluatePrediction(data, response) {
            const simulation = data.mental_simulation;
            const comparedCorrect = sameValues(
                response.comparedValues,
                simulation.compared_values
            );
            const countCorrect = response.comparisonCount === simulation.comparison_count;
            const outcomeCorrect = response.outcome === simulation.outcome;
            const allCorrect = comparedCorrect && countCorrect && outcomeCorrect;

            return {
                correctFinalState: comparedCorrect,
                correctNextPop: outcomeCorrect,
                correctComparedValues: comparedCorrect,
                correctComparisonCount: countCorrect,
                correctOutcome: outcomeCorrect,
                actualComparedValues: simulation.compared_values,
                actualComparisonCount: simulation.comparison_count,
                actualOutcome: simulation.outcome,
                feedback: allCorrect
                    ? "Excellent mental simulation. You predicted every comparison and the result."
                    : "Compare the replay one middle value at a time. Each comparison decides which half remains."
            };
        },

        simulateSearch
    };
}


registerScenarioGenerator("binary-search-expert", createBinarySearchExpertGenerator());


function createBinarySearchMasteryGenerator() {
    const expertGenerator = createBinarySearchExpertGenerator();

    return {
        version: 1,

        generate({ random }) {
            const expertScenario = expertGenerator.generate({ random });

            return {
                values: expertScenario.values,
                target: expertScenario.target,
                expected_outcome: expertScenario.expected_outcome
            };
        }
    };
}


registerScenarioGenerator("binary-search-mastery", createBinarySearchMasteryGenerator());
