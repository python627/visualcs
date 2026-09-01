function createStackExpertGenerator() {

    const version = 1;

    function randomInteger(random, minimum, maximum) {
        return Math.floor(random() * (maximum - minimum + 1)) + minimum;
    }


    function shuffled(values, random) {
        const result = [...values];

        for (let index = result.length - 1; index > 0; index--) {
            const targetIndex = Math.floor(random() * (index + 1));
            [result[index], result[targetIndex]] = [result[targetIndex], result[index]];
        }

        return result;
    }


    function simulate(initialState, steps) {
        const state = [...initialState];

        steps.forEach(step => {
            if (step.operation === "push") {
                state.push(step.value);
            }
            else if (step.operation === "pop") {
                state.pop();
            }
        });

        return state;
    }


    function getMinimumOperations(initialState, targetState) {
        let sharedBottomItems = 0;

        while (
            sharedBottomItems < initialState.length
            && sharedBottomItems < targetState.length
            && initialState[sharedBottomItems] === targetState[sharedBottomItems]
        ) {
            sharedBottomItems++;
        }

        return (
            initialState.length - sharedBottomItems
            + targetState.length - sharedBottomItems
        );
    }


    function createMentalSimulation(values, random) {
        const chosen = shuffled(values, random);
        const initialState = chosen.slice(0, 3);
        const pushValues = chosen.slice(3, 7);
        const patterns = [
            ["push", "push", "pop", "push", "pop", "push"],
            ["pop", "push", "push", "pop", "push", "push"],
            ["push", "pop", "push", "push", "pop", "push"]
        ];
        const pattern = patterns[randomInteger(random, 0, patterns.length - 1)];
        let pushIndex = 0;
        const steps = pattern.map(operation => (
            operation === "push"
                ? { operation, value: pushValues[pushIndex++] }
                : { operation }
        ));
        const finalState = simulate(initialState, steps);

        return {
            initial_state: initialState,
            steps,
            final_state: finalState,
            next_pop_value: finalState.at(-1)
        };
    }


    return {
        version,

        generate({ random, rules }) {
            const valuePool = Array.isArray(rules.value_pool) && rules.value_pool.length >= 20
                ? rules.value_pool
                : [
                    11, 14, 18, 23, 27, 32, 36, 41, 45, 49,
                    54, 58, 63, 67, 72, 76, 81, 85, 89, 94,
                    98, 103, 107, 112
                ];
            const availableValues = shuffled(valuePool, random);
            const initialLength = randomInteger(random, 4, 5);
            const sharedBottomItems = randomInteger(random, 1, 2);
            const targetAdditions = randomInteger(random, 2, 3);
            const initialState = availableValues.slice(0, initialLength);
            const targetSuffix = availableValues.slice(
                initialLength,
                initialLength + targetAdditions
            );
            const targetState = [
                ...initialState.slice(0, sharedBottomItems),
                ...targetSuffix
            ];
            const distractors = availableValues.slice(
                initialLength + targetAdditions,
                initialLength + targetAdditions + 3
            );
            const optimalOperations = getMinimumOperations(initialState, targetState);

            if (optimalOperations < 4 || targetState.length < 3) {
                throw new Error("Stack Expert generator created a trivial scenario.");
            }

            return {
                initial_state: initialState,
                target_state: targetState,
                available_push_values: shuffled([...targetSuffix, ...distractors], random),
                optimal_operations: optimalOperations,
                mental_simulation: createMentalSimulation(availableValues, random)
            };
        },

        evaluatePrediction(data, response) {
            const mentalSimulation = data.mental_simulation;
            const actualFinalState = [...mentalSimulation.final_state].reverse();
            const predictedFinalState = Array.isArray(response.finalState)
                ? response.finalState
                : [];
            const correctFinalState = JSON.stringify(predictedFinalState)
                === JSON.stringify(actualFinalState);
            const correctNextPop = response.nextPop === mentalSimulation.next_pop_value;

            return {
                correctFinalState,
                correctNextPop,
                actualFinalState,
                actualNextPop: mentalSimulation.next_pop_value
            };
        },

        getMinimumOperations
    };
}


registerScenarioGenerator("stack-expert", createStackExpertGenerator());
