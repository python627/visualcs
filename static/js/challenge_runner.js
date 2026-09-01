class ChallengeRunner {

    constructor(challenge, constraints = {}) {
        this.challenge = challenge || { phases: [] };
        this.constraints = constraints || {};
        this.reset();
    }


    reset() {
        this.phaseIndex = 0;
        this.operationIndex = 0;
        this.operationCount = 0;
        this.operationCounts = {};
        this.hintsUsed = 0;
        this.completed = false;
        this.failed = false;
    }


    getCurrentPhase() {
        return this.challenge.phases?.[this.phaseIndex] || null;
    }


    getPhaseGoal(phase) {
        if (phase?.goal) {
            return phase.goal;
        }

        if (Array.isArray(phase?.expected_operations)) {
            return {
                type: "operation_sequence",
                operations: phase.expected_operations
            };
        }

        if (Array.isArray(phase?.expected_state)) {
            return {
                type: "state_equals",
                expected_state: phase.expected_state
            };
        }

        return null;
    }


    getMetrics() {
        const maximum = this.constraints.max_operations;

        return {
            operations: this.operationCount,
            operationCounts: { ...this.operationCounts },
            hintsUsed: this.hintsUsed,
            remainingOperations: Number.isInteger(maximum)
                ? Math.max(0, maximum - this.operationCount)
                : null
        };
    }


    createResult(status, details = {}) {
        return {
            status,
            phase: this.getCurrentPhase(),
            phaseIndex: this.phaseIndex,
            challengeCompleted: this.completed,
            ...this.getMetrics(),
            ...details
        };
    }


    getConstraintFailure() {
        if (
            Number.isInteger(this.constraints.max_operations)
            && this.operationCount >= this.constraints.max_operations
        ) {
            return this.constraints.operation_limit_message
                || "The operation limit was exceeded. Retry to try a shorter solution.";
        }

        return null;
    }


    recordOperation(operation) {
        this.operationCount++;
        this.operationCounts[operation] = (this.operationCounts[operation] || 0) + 1;
    }


    finishWithConstraintIfNeeded(result) {
        const completed = result.status === "phase_completed"
            || result.status === "challenge_completed";
        const constraintFailure = this.getConstraintFailure();

        if (completed || !constraintFailure) {
            return result;
        }

        this.failed = true;

        return this.createResult("failed", {
            failure: "operation_limit",
            feedback: constraintFailure
        });
    }


    statesMatch(currentState, expectedState) {
        return JSON.stringify(currentState) === JSON.stringify(expectedState);
    }


    isExpectedStatePrefix(currentState, expectedState) {
        return Array.isArray(currentState)
            && Array.isArray(expectedState)
            && currentState.length <= expectedState.length
            && currentState.every((value, index) => value === expectedState[index]);
    }


    completeCurrentPhase() {
        const completedPhase = this.getCurrentPhase();

        if (this.phaseIndex < this.challenge.phases.length - 1) {
            this.phaseIndex++;
            this.operationIndex = 0;

            return this.createResult("phase_completed", {
                completedPhase,
                phase: this.getCurrentPhase()
            });
        }

        this.completed = true;

        return this.createResult("challenge_completed", {
            completedPhase
        });
    }


    reportOperation({ operation, state, feedback = null, progress = false, count = true }) {
        if (this.completed || this.failed) {
            return this.createResult("inactive");
        }

        const phase = this.getCurrentPhase();

        if (!phase) {
            return this.createResult("inactive");
        }

        if (count) {
            this.recordOperation(operation);
        }

        const goal = this.getPhaseGoal(phase);

        if (goal?.type === "operation_sequence") {
            const expectedOperation = goal.operations?.[this.operationIndex];

            if (expectedOperation === operation || expectedOperation === "*") {
                this.operationIndex++;

                if (this.operationIndex === goal.operations.length) {
                    return this.completeCurrentPhase();
                }

                return this.finishWithConstraintIfNeeded(
                    this.createResult("progress")
                );
            }

            return this.finishWithConstraintIfNeeded(
                this.createResult("incorrect", {
                    feedback: phase.feedback
                })
            );
        }

        if (goal?.type === "state_equals") {
            const currentState = goal.state_key
                ? state?.[goal.state_key]
                : state;

            if (this.statesMatch(currentState, goal.expected_state)) {
                return this.completeCurrentPhase();
            }

            const progressOperations = phase.progress_operations || [];
            const isValidProgress = phase.progressive
                && progressOperations.includes(operation)
                && this.isExpectedStatePrefix(currentState, goal.expected_state);

            return this.finishWithConstraintIfNeeded(
                this.createResult(isValidProgress ? "progress" : "incorrect", {
                    feedback: isValidProgress ? null : phase.feedback
                })
            );
        }

        if (goal?.type === "outcome_equals" || goal?.type === "outcome_in") {
            const outcome = state?.[goal.state_key || "outcome"];
            const acceptedOutcomes = goal.type === "outcome_in"
                ? goal.expected_outcomes || []
                : [goal.expected_outcome];

            if (acceptedOutcomes.includes(outcome)) {
                return this.completeCurrentPhase();
            }

            return this.finishWithConstraintIfNeeded(
                this.createResult(progress ? "progress" : "incorrect", {
                    feedback: feedback || (progress ? null : phase.feedback)
                })
            );
        }

        return this.finishWithConstraintIfNeeded(
            this.createResult("incorrect", {
                feedback: phase.feedback
            })
        );
    }


    reportUnavailable({ operation, state }) {
        if (this.completed || this.failed) {
            return this.createResult("inactive");
        }

        const phase = this.getCurrentPhase();

        return this.createResult("incorrect", {
            operation,
            state,
            feedback: phase?.feedback
        });
    }


    useHint() {
        const maximum = this.constraints.max_hints;

        if (Number.isInteger(maximum) && this.hintsUsed >= maximum) {
            return this.createResult("hint_unavailable");
        }

        this.hintsUsed++;

        return this.createResult("hint_used");
    }

}
