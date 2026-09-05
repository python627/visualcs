class MasteryEngine {

    constructor(lesson) {
        this.lesson = lesson;
        this.config = lesson.mastery || null;
        this.playground = null;
        this.runner = null;
        this.expertRunner = null;
        this.expertScenario = null;
        this.masteryScenario = null;
        this.expertReplayComplete = false;
        this.activeLevelId = null;
        this.attemptActive = false;
        this.interactionEngaged = false;
        this.lastResult = null;
    }


    hasMastery() {
        return Boolean(
            this.config
            && Array.isArray(this.config.levels)
            && this.config.levels.length
        );
    }


    getLevels() {
        return this.hasMastery() ? this.config.levels : [];
    }


    getLevel(levelId) {
        return this.getLevels().find(level => level.id === levelId) || null;
    }


    getStoredLevelProgress(levelId) {
        return getMasteryLevelProgress(this.lesson.id, levelId);
    }


    isExpertLevel(level) {
        return Boolean(level?.kind === "expert" && level?.expert);
    }


    supportsExpertLevel(level) {
        const required = level?.expert?.required_capabilities;

        return !Array.isArray(required)
            || typeof lessonCapabilities === "undefined"
            || lessonCapabilities.supportsAll(required);
    }


    getExpertDefinition() {
        return this.isExpertLevel(this.getCurrentLevel())
            ? this.getCurrentLevel().expert
            : null;
    }


    isCourseComplete() {
        return getProgress().completedLessons.includes(this.lesson.id);
    }


    getLevelStatus(level) {
        const stored = this.getStoredLevelProgress(level.id);

        if (
            stored.status === "completed"
            || (this.isExpertLevel(level) && stored.expert?.optimalAttempts > 0)
        ) {
            return "completed";
        }

        if (level.completion?.type === "course_completion") {
            return this.isCourseComplete() ? "completed" : "unlocked";
        }

        const prerequisites = level.prerequisites || [];
        const prerequisitesComplete = prerequisites.every(prerequisiteId => {
            const prerequisite = this.getLevel(prerequisiteId);
            return prerequisite && this.getLevelStatus(prerequisite) === "completed";
        });

        return prerequisitesComplete ? "unlocked" : "locked";
    }


    syncCourseCompletion() {
        if (!this.hasMastery() || !this.isCourseComplete()) {
            return;
        }

        this.getLevels()
            .filter(level => level.completion?.type === "course_completion")
            .forEach(level => {
                if (this.getStoredLevelProgress(level.id).status !== "completed") {
                    markMasteryLevelCompleted(this.lesson.id, level.id);
                }
            });
    }


    unlockEligibleLevels() {
        this.getLevels().forEach(level => {
            const status = this.getLevelStatus(level);
            const stored = this.getStoredLevelProgress(level.id);

            if (status === "unlocked" && stored.status !== "unlocked") {
                unlockMasteryLevel(this.lesson.id, level.id);
            }
        });
    }


    connect(playground) {
        this.playground = playground;
        this.syncCourseCompletion();
        this.unlockEligibleLevels();
        this.render();
    }


    recordCourseCompletion() {
        this.syncCourseCompletion();
        this.unlockEligibleLevels();
        this.render();
    }


    isAttemptActive() {
        return this.attemptActive;
    }


    isInteractionActive() {
        return this.hasMastery()
            && this.interactionEngaged
            && (!this.expertRunner || this.expertRunner.isExecutionActive());
    }


    isExpertExecutionActive() {
        return Boolean(this.expertRunner?.isExecutionActive());
    }


    getCurrentLevel() {
        return this.getLevel(this.activeLevelId);
    }


    getRecommendedLevel() {
        return this.getLevels().find(level => (
            level.completion?.type !== "course_completion"
            && this.getLevelStatus(level) === "unlocked"
        )) || null;
    }


    startRecommendedLevel() {
        const level = this.getRecommendedLevel();

        if (level) {
            this.startLevel(level.id);
        }
    }


    getLevelNumber(level) {
        return this.getLevels().findIndex(item => item.id === level.id) + 1;
    }


    getHintsText(level, metrics) {
        const hintLimit = level.guidance?.hints?.limit;

        if (!Number.isInteger(hintLimit)) {
            return "Hints: available";
        }

        const remaining = Math.max(0, hintLimit - metrics.hintsUsed);

        return remaining === 0
            ? "Hints: none"
            : `Hints: ${remaining} available`;
    }


    getMetricLabel(level) {
        return level?.metrics?.operation_label || "Operations";
    }


    getOperationRule(level) {
        return level?.operation_rule
            || level?.guidance?.operation_rule
            || this.config?.default_operation_rule
            || "Each available operation counts once.";
    }


    getCurrentStateLabel(level, fallback = "YOUR STATE") {
        return level?.current_state_label
            || this.config?.current_state_label
            || fallback;
    }


    getMasteryControls(level) {
        return Array.isArray(level?.controls)
            ? level.controls.filter(control => (
                control
                && typeof control.operation === "string"
                && typeof control.label === "string"
            ))
            : [];
    }


    setYourStackLabel(visible, text = "YOUR STACK") {
        const label = document.getElementById("mastery-your-stack-label");

        if (label) {
            label.hidden = !visible;
            label.textContent = text;
        }
    }


    getRunnerConstraints(level) {
        const hintLimit = level.guidance?.hints?.limit;

        return {
            ...(level.constraints || {}),
            ...(Number.isInteger(hintLimit) ? { max_hints: hintLimit } : {})
        };
    }


    getResolvedChallenge(level) {
        const challenge = JSON.parse(JSON.stringify(level?.challenge || { phases: [] }));
        const data = this.masteryScenario?.data || {};

        challenge.phases?.forEach(phase => {
            const key = phase?.goal?.expected_state_from_scenario;

            if (typeof key === "string" && Object.hasOwn(data, key)) {
                phase.goal.expected_state = data[key];
            }
        });

        return challenge;
    }


    startExpertLevel(level, scenario = null) {
        const definition = level.expert;
        const previousFingerprint = this.expertScenario?.fingerprint || null;
        let mentalSimulation;

        try {
            this.expertScenario = scenario || ScenarioFactory.createNew(definition, {
                previousFingerprint
            });
            this.expertRunner = new ExpertAttemptRunner({
                definition,
                scenario: this.expertScenario
            });
            mentalSimulation = this.expertRunner.getMentalSimulation();
        }
        catch (error) {
            console.error("Invalid Expert scenario:", error);
            this.expertScenario = null;
            this.expertRunner = null;
            setByteMessage(`Expert challenge preparation failed: ${error.message}`);
            return;
        }

        this.runner = null;
        this.masteryScenario = null;
        this.activeLevelId = level.id;
        this.attemptActive = true;
        this.interactionEngaged = true;
        this.expertReplayComplete = false;
        this.lastResult = null;

        startExpertAttempt(this.lesson.id, level.id, this.expertScenario);
        this.playground?.configureMasteryScenario?.({
            ...this.expertScenario.data,
            mental_simulation: mentalSimulation,
            initial_state: mentalSimulation.initial_state,
            mastery_mode: "expert-thinking"
        });
        this.render();
        setByteMessage(definition.thinking?.start_message || "Plan the sequence before you run it.");
    }


    startLevel(levelId) {
        const level = this.getLevel(levelId);

        if (
            !level
            || (
                this.getLevelStatus(level) !== "unlocked"
                && !(this.isExpertLevel(level) && this.getLevelStatus(level) === "completed")
            )
        ) {
            return;
        }

        if (this.isExpertLevel(level)) {
            if (!this.supportsExpertLevel(level)) {
                setByteMessage("This Expert level needs lesson capabilities that are not available.");
                return;
            }
            this.startExpertLevel(level);
            return;
        }

        this.expertRunner = null;
        this.expertScenario = null;
        try {
            this.masteryScenario = level.scenario?.generator
                ? ScenarioFactory.createNew(level.scenario)
                : { data: level.scenario || {} };
        }
        catch (error) {
            console.error("Invalid mastery scenario:", error);
            setByteMessage(`Mastery challenge preparation failed: ${error.message}`);
            return;
        }

        this.runner = new ChallengeRunner(this.getResolvedChallenge(level), this.getRunnerConstraints(level));
        this.activeLevelId = level.id;
        this.attemptActive = true;
        this.interactionEngaged = true;
        this.lastResult = null;

        startMasteryAttempt(this.lesson.id, level.id);
        this.playground?.configureMasteryScenario?.(this.masteryScenario.data);
        this.render();

        const startMessage = level.guidance?.start_message;

        if (startMessage) {
            setByteMessage(startMessage);
        }
    }


    retryLevel() {
        if (this.isExpertLevel(this.getCurrentLevel())) {
            this.retryExpertChallenge();
            return;
        }

        if (this.activeLevelId) {
            this.startLevel(this.activeLevelId);
        }
    }


    continueFreePlay() {
        this.attemptActive = false;
        this.interactionEngaged = false;
        this.lastResult = null;
        this.runner = null;
        this.expertRunner = null;
        this.playground?.endMasteryMode?.();
        this.render();
        setByteMessage("Mastery progress is saved. Keep experimenting freely with the playground.");
    }


    retryExpertChallenge() {
        const level = this.getCurrentLevel();

        if (!level || !this.expertScenario) {
            return;
        }

        this.startExpertLevel(level, this.expertScenario);
    }


    startNewExpertChallenge() {
        const level = this.getCurrentLevel() || this.getLevels().find(
            item => this.isExpertLevel(item)
        );

        if (level && this.getLevelStatus(level) !== "locked") {
            this.startExpertLevel(level);
        }
    }


    getOperationValue({ operation, fallback }) {
        if (!this.attemptActive) {
            return undefined;
        }

        if (this.expertRunner) {
            return undefined;
        }

        const values = this.masteryScenario?.data?.operation_values?.[operation]
            || this.getCurrentLevel()?.scenario?.operation_values?.[operation];
        const index = this.runner?.getMetrics().operationCounts?.[operation] || 0;

        return Array.isArray(values) && index < values.length
            ? values[index]
            : fallback;
    }


    getCurrentHint() {
        const hints = this.getCurrentLevel()?.guidance?.hints;

        if (!hints || !Array.isArray(hints.items) || !hints.items.length) {
            return null;
        }

        const hintIndex = this.runner?.getMetrics().hintsUsed || 0;

        return hints.items[Math.min(hintIndex, hints.items.length - 1)] || null;
    }


    useHint() {
        if (!this.attemptActive || !this.runner) {
            return;
        }

        const hint = this.getCurrentHint();
        const result = this.runner.useHint();

        if (result.status === "hint_used" && hint?.content) {
            setByteMessage(hint.content);
            this.renderAttempt();
            this.bindControls();
        }
    }


    operationCompleted(event) {
        if (!this.attemptActive) {
            return false;
        }

        if (this.expertRunner) {
            const result = this.expertRunner.reportOperation(event);
            this.handleExpertAttemptResult(result);
            return true;
        }

        if (!this.runner) {
            return false;
        }

        const result = this.runner.reportOperation(event);
        this.handleAttemptResult(result);

        return true;
    }


    reportUnavailableOperation(event) {
        if (!this.attemptActive) {
            return false;
        }

        if (this.expertRunner) {
            const result = this.expertRunner.reportUnavailable(event);

            if (result.feedback) {
                setByteMessage(result.feedback);
            }

            this.lastResult = result;
            this.renderAttempt();
            this.bindControls();
            return true;
        }

        if (!this.runner) {
            return false;
        }

        const result = this.runner.reportUnavailable(event);

        if (result.feedback) {
            setByteMessage(result.feedback);
        }

        return true;
    }


    handleAttemptResult(result) {
        if (!result) {
            return;
        }

        this.lastResult = result;

        if (result.status === "phase_completed") {
            setByteMessage(result.completedPhase.success);
            this.renderAttempt();
            this.bindControls();
            return;
        }

        if (result.status === "challenge_completed") {
            this.attemptActive = false;
            this.interactionEngaged = false;

            finishMasteryAttempt(this.lesson.id, this.activeLevelId, {
                ...result,
                status: "completed"
            });
            this.unlockEligibleLevels();
            this.render();
            setByteMessage(result.completedPhase.success);
            return;
        }

        if (result.status === "failed") {
            this.attemptActive = false;
            this.interactionEngaged = false;

            finishMasteryAttempt(this.lesson.id, this.activeLevelId, {
                status: "failed",
                ...result
            });
            this.render();
            setByteMessage(result.feedback);
            return;
        }

        if (result.feedback) {
            setByteMessage(result.feedback);
        }

        this.renderAttempt();
        this.bindControls();
    }


    handleExpertAttemptResult(result) {
        if (!result || result.status === "inactive") {
            return;
        }

        this.lastResult = result;

        if (result.status === "expert_solved" || result.status === "expert_perfect") {
            this.attemptActive = false;
            this.interactionEngaged = false;

            finishExpertAttempt(this.lesson.id, this.activeLevelId, {
                ...result,
                scenario: this.expertScenario,
                prediction: this.expertRunner.getPrediction(),
                transcript: this.expertRunner.getTranscript()
            });
            this.unlockEligibleLevels();
            this.render();
            setByteMessage(
                result.perfect
                    ? (this.getExpertDefinition()?.solve?.perfect_message || "🏆 Perfect Expert")
                    : (this.getExpertDefinition()?.solve?.solved_message || "✓ Expert Challenge Solved")
            );
            return;
        }

        if (result.feedback) {
            setByteMessage(result.feedback);
        }

        this.renderAttempt();
        this.bindControls();
    }


    formatExpertText(template, values = {}) {
        return String(template || "").replace(/\{\{(\w+)\}\}/g, (match, key) => (
            values[key] ?? match
        ));
    }


    getExpertPredictionMessage(assessment) {
        const thinking = this.getExpertDefinition()?.thinking || {};

        if (typeof assessment?.feedback === "string") {
            return assessment.feedback;
        }

        let template = thinking.feedback?.incorrect;

        if (assessment.correctFinalState && assessment.correctNextPop) {
            template = thinking.feedback?.all_correct;
        }
        else if (assessment.correctFinalState) {
            template = thinking.feedback?.final_state_correct;
        }
        else if (assessment.correctNextPop) {
            template = thinking.feedback?.next_pop_correct;
        }

        return this.formatExpertText(template, {
            final_state: assessment.actualFinalState.join(", "),
            next_pop: assessment.actualNextPop
        });
    }


    getExpertPredictionFields(thinking) {
        if (Array.isArray(thinking?.prediction_fields) && thinking.prediction_fields.length) {
            return thinking.prediction_fields;
        }

        return [
            {
                id: "finalState",
                label: thinking?.final_state_label || "Final state",
                prompt: thinking?.final_state_prompt || "After all operations are completed, what will the Stack contain?",
                type: "number_list",
                placeholder: thinking?.final_state_placeholder || "Top to bottom, e.g. 70, 40, 10"
            },
            {
                id: "nextPop",
                label: thinking?.next_pop_label || "Next POP value",
                prompt: thinking?.next_pop_prompt || "What value would the NEXT POP remove?",
                type: "number",
                inputmode: "numeric"
            }
        ];
    }


    formatPredictionValue(value, field) {
        if (Array.isArray(value)) {
            return value.join(", ");
        }

        if (value === "found") {
            return field?.found_label || "FOUND";
        }

        if (value === "not_found") {
            return field?.not_found_label || "NOT FOUND";
        }

        return value ?? "";
    }


    parsePredictionValue(rawValue, field) {
        const type = field?.type || "text";

        if (!rawValue) {
            return null;
        }

        if (type === "number") {
            const value = Number(rawValue);
            return Number.isFinite(value) ? value : null;
        }

        if (type === "number_list") {
            const values = rawValue.split(",").map(value => Number(value.trim()));
            return values.length && values.every(Number.isFinite) ? values : null;
        }

        if (type === "text_list") {
            const values = rawValue.split(",").map(value => value.trim()).filter(Boolean);
            return values.length ? values : null;
        }

        return rawValue || null;
    }


    renderExpertPredictionControl(field, prediction, submitted) {
        const value = prediction?.[field.id];
        const formattedValue = this.formatPredictionValue(value, field);
        const id = `expert-prediction-${field.id}`;
        const disabled = submitted ? "disabled" : "";

        if (field.type === "choice" && Array.isArray(field.options)) {
            return `
                ${field.prompt ? `<p>${field.prompt}</p>` : ""}
                <label>
                    ${field.label}
                    <select id="${id}" ${disabled}>
                        <option value="">Choose an answer</option>
                        ${field.options.map(option => (
                            `<option value="${option.value}" ${option.value === value ? "selected" : ""}>${option.label}</option>`
                        )).join("")}
                    </select>
                </label>
            `;
        }

        return `
            ${field.prompt ? `<p>${field.prompt}</p>` : ""}
            <label>
                ${field.label}
                <input id="${id}" type="text" value="${formattedValue}" placeholder="${field.placeholder || ""}" ${field.inputmode ? `inputmode="${field.inputmode}"` : ""} ${disabled}>
            </label>
        `;
    }


    parseExpertPrediction() {
        const fields = this.getExpertPredictionFields(
            this.getExpertDefinition()?.thinking || {}
        );
        const response = {};

        for (const field of fields) {
            if (!field?.id) {
                return null;
            }

            const input = document.getElementById(`expert-prediction-${field.id}`);
            const rawValue = input?.value.trim() || "";
            const value = this.parsePredictionValue(rawValue, field);

            if (value === null) {
                return null;
            }

            response[field.id] = value;
        }

        return response;
    }


    submitExpertPrediction() {
        if (!this.expertRunner || this.expertRunner.getStage() !== "think") {
            return;
        }

        const prediction = this.parseExpertPrediction();

        if (!prediction) {
            this.lastResult = {
                status: "prediction_incomplete",
                feedback: this.getExpertDefinition()?.thinking?.empty_message
                    || "Enter both predictions before continuing."
            };
            this.renderAttempt();
            return;
        }

        const result = this.expertRunner.submitPrediction(prediction);
        this.lastResult = result;
        this.expertReplayComplete = false;
        this.renderAttempt();

        const simulation = this.expertRunner.getMentalSimulation();
        const scenarioId = this.expertScenario?.id;

        Promise.resolve(
            this.playground?.replayExpertSimulation?.(simulation)
        ).finally(() => {
            if (
                this.expertScenario?.id !== scenarioId
                || this.expertRunner?.getStage() !== "review"
            ) {
                return;
            }

            this.expertReplayComplete = true;
            this.renderAttempt();
            this.bindControls();
            setByteMessage(this.getExpertPredictionMessage(result.assessment));
        });
    }


    beginExpertExecution() {
        if (!this.expertRunner || this.expertRunner.getStage() !== "review") {
            return;
        }

        this.expertRunner.beginExecution();
        this.lastResult = null;
        this.playground?.configureMasteryScenario?.({
            ...this.expertScenario.data,
            mastery_mode: "expert-solve"
        });
        this.renderAttempt();
        this.bindControls();
        setByteMessage(this.getExpertDefinition()?.solve?.start_message || "Build a plan, then test it.");
    }


    performExpertOperation(operation, value = undefined) {
        if (!this.expertRunner?.isExecutionActive()) {
            return;
        }

        this.playground?.performMasteryOperation?.(operation, { value });
    }


    performMasteryOperation(operation, value = undefined) {
        if (!this.attemptActive || this.expertRunner || !this.runner) {
            return;
        }

        this.playground?.performMasteryOperation?.(operation, { value });
    }


    getStatusIcon(status) {
        return {
            completed: "✓",
            unlocked: "●",
            in_progress: "●",
            locked: "🔒"
        }[status];
    }


    getLevelDisplay(level, status) {
        const stored = this.getStoredLevelProgress(level.id);

        if (!this.isExpertLevel(level)) {
            return { icon: this.getStatusIcon(status), label: level.label, status };
        }

        if (stored.expert?.optimalAttempts > 0) {
            return { icon: "🏆", label: "Perfect Expert", status: "perfect" };
        }

        if (stored.expert?.solvedAttempts > 0) {
            return { icon: "✓", label: "Expert Solved", status: "solved" };
        }

        return { icon: this.getStatusIcon(status), label: level.label, status };
    }


    getNextUnlockedLevel() {
        return this.getLevels().find(level => this.getLevelStatus(level) === "unlocked") || null;
    }


    isMastered() {
        return this.getLevels().every(level => this.getLevelStatus(level) === "completed");
    }


    render() {
        this.renderPanel();
        this.renderAttempt();
        this.bindControls();
    }


    renderPanel() {
        const panel = document.getElementById("mastery-panel");

        if (!panel || !this.hasMastery()) {
            return;
        }

        const levels = this.getLevels().map(level => {
            const status = this.getLevelStatus(level);
            const display = this.getLevelDisplay(level, status);
            const canStart = (status === "unlocked" || (
                this.isExpertLevel(level) && status === "completed"
            ))
                && level.completion?.type !== "course_completion"
                && !(this.attemptActive && this.activeLevelId === level.id);

            return `
                <li class="mastery-level mastery-level-${display.status}">
                    <span class="mastery-level-icon">${display.icon}</span>
                    <span>${display.label}</span>
                    ${canStart
                        ? `<button type="button" data-mastery-start="${level.id}">${this.isExpertLevel(level) ? "New Expert Challenge" : `Start ${level.label}`}</button>`
                        : ""}
                </li>
            `;
        }).join("");

        panel.innerHTML = `
            <section class="mastery-card" aria-label="${this.config.title}">
                <h3>${this.config.title}</h3>
                <ol class="mastery-levels">${levels}</ol>
                ${this.isMastered()
                    ? `<p class="mastery-complete">✓ ${this.config.mastered_label}</p>`
                    : ""}
            </section>
        `;
    }


    renderMasteryStates(level, phase, container) {
        const states = this.isExpertLevel(level)
            ? {
                scenario: this.expertScenario?.data || {},
                initialState: this.expertScenario?.data?.initial_state || [],
                target: {
                    label: this.getExpertDefinition()?.solve?.target_label || "TARGET STACK",
                    // State order is owned by each playground. Reversing here
                    // made every Expert target look like a Stack.
                    items: [...(this.expertScenario?.data?.target_state || [])],
                    raw_state: [...(this.expertScenario?.data?.target_state || [])],
                    top_label: this.getExpertDefinition()?.solve?.top_label || "TOP"
                }
            }
            : {
                scenario: this.masteryScenario?.data || level.scenario || {},
                initialState: this.masteryScenario?.data?.initial_state
                    || level.scenario?.initial_state
                    || [],
                target: phase.target || {}
            };

        if (this.playground?.renderMasteryStates) {
            this.playground.renderMasteryStates(states, container);
            return;
        }

        container.innerHTML = `
            <div class="mastery-state-card">
                <span class="challenge-target-label">START STATE</span>
                <p>${JSON.stringify(states.initialState)}</p>
            </div>
            <div class="mastery-state-card">
                <span class="challenge-target-label">TARGET STATE</span>
                <p>${JSON.stringify(states.target)}</p>
            </div>
        `;
    }


    renderAttempt() {
        const panel = document.getElementById("mastery-challenge-panel");
        const level = this.getCurrentLevel();

        if (this.expertRunner) {
            this.renderExpertAttempt();
            return;
        }

        if (!panel || !level || !this.runner || (!this.attemptActive && !this.lastResult)) {
            window.activeTask?.clear?.();
            if (panel) {
                panel.hidden = true;
                panel.innerHTML = "";
            }
            this.setYourStackLabel(false);
            return;
        }

        const phase = this.runner.getCurrentPhase();

        if (!phase) {
            window.activeTask?.clear?.();
            return;
        }

        const metrics = this.runner.getMetrics();
        const maximum = level.constraints?.max_operations;
        const hint = this.getCurrentHint();
        const hintAvailable = this.attemptActive && hint?.content;
        const nextLevel = this.getNextUnlockedLevel();
        const outcome = this.lastResult?.status;
        const levelNumber = this.getLevelNumber(level);
        const controls = this.getMasteryControls(level);
        const metricLabel = this.getMetricLabel(level);
        const operations = Number.isInteger(maximum)
            ? `${metricLabel}: ${metrics.operations} / ${maximum}`
            : `${metricLabel}: ${metrics.operations}`;
        const successText = phase.success || `✓ ${level.label} Complete`;
        const failureText = this.lastResult?.failure === "operation_limit"
            ? "Operation limit reached. Target not achieved."
            : this.lastResult?.feedback;
        const progressText = this.attemptActive && outcome
            ? (this.lastResult?.feedback || "Target not achieved yet. Compare YOUR STACK with the TARGET STACK.")
            : "";

        window.activeTask?.render?.({
            label: `ACTIVE TASK · ${level.label}`,
            title: phase.title,
            instruction: phase.instruction,
            meta: [operations, this.getHintsText(level, metrics)]
        });

        panel.hidden = false;
        panel.className = `challenge-panel mastery-challenge-panel mastery-${this.lesson.playground.type}`;
        this.setYourStackLabel(true, this.getCurrentStateLabel(level));
        panel.innerHTML = `
            <div class="challenge-card mastery-challenge-card">
                <header class="mastery-puzzle-header">
                    <span class="teaching-kicker">Level ${levelNumber} · ${level.label}</span>
                    <h3>${phase.title}</h3>
                </header>
                <div class="mastery-objective">
                    <span>Objective</span>
                    <p>${phase.instruction}</p>
                </div>
                <div id="mastery-state-comparison" class="mastery-state-comparison"></div>
                <div class="mastery-quick-facts">
                    <p class="mastery-operations">${operations}</p>
                    <p class="mastery-hints">${this.getHintsText(level, metrics)}</p>
                    <p class="mastery-operation-rule">${this.getOperationRule(level)}</p>
                </div>
                ${controls.length
                    ? `<div class="mastery-operation-controls" aria-label="Available decisions">
                        ${controls.map(control => (
                            `<button type="button" data-mastery-operation="${control.operation}">${control.label}</button>`
                        )).join("")}
                    </div>`
                    : ""}
                <div class="mastery-outcome" aria-live="polite">
                    ${outcome === "failed"
                        ? `<p class="mastery-attempt-feedback">${failureText}</p>`
                        : ""}
                    ${outcome === "challenge_completed"
                        ? `<p class="challenge-success">${successText}</p>
                           <p class="mastery-result-detail">${metrics.operations}${Number.isInteger(maximum) ? ` / ${maximum}` : ""} ${metricLabel.toLowerCase()} used.</p>`
                        : ""}
                    ${progressText
                        ? `<p class="mastery-progress-feedback">${progressText}</p>`
                        : ""}
                </div>
                <div class="challenge-actions">
                    ${hintAvailable
                        ? '<button type="button" data-mastery-hint>Need a hint</button>'
                        : ""}
                    ${this.attemptActive || outcome === "failed"
                        ? `<button type="button" data-mastery-retry>Retry ${level.label}</button>`
                        : ""}
                    ${outcome === "challenge_completed" && nextLevel
                        ? `<button type="button" data-mastery-start="${nextLevel.id}">Continue to ${nextLevel.label} →</button>`
                        : ""}
                    ${outcome === "challenge_completed"
                        ? '<button type="button" data-mastery-free-play>Continue experimenting</button>'
                        : ""}
                </div>
            </div>
        `;

        this.renderMasteryStates(
            level,
            phase,
            document.getElementById("mastery-state-comparison")
        );
    }


    renderExpertAttempt() {
        const panel = document.getElementById("mastery-challenge-panel");
        const level = this.getCurrentLevel();
        const definition = this.getExpertDefinition();
        const scenario = this.expertScenario;

        if (!panel || !level || !definition || !scenario || (!this.attemptActive && !this.lastResult)) {
            window.activeTask?.clear?.();
            if (panel) {
                panel.hidden = true;
                panel.innerHTML = "";
            }
            this.setYourStackLabel(false);
            return;
        }

        const stage = this.expertRunner.getStage();
        const levelNumber = this.getLevelNumber(level);

        const presentationClass = stage === "solve"
            ? "expert-solve"
            : "expert-thinking";

        const stageCopy = stage === "solve"
            ? definition.solve || {}
            : definition.thinking || {};
        window.activeTask?.render?.({
            label: stage === "solve" ? "ACTIVE TASK · EXPERT CHALLENGE" : "ACTIVE TASK · THINK FIRST",
            title: stageCopy.title || "Expert task",
            instruction: stageCopy.instruction || "Work through the problem before continuing.",
            meta: stage === "solve" ? ["No hints", "Execute your plan"] : ["Predict before execution"]
        });

        panel.hidden = false;
        panel.className = [
            "challenge-panel",
            "mastery-challenge-panel",
            `mastery-${this.lesson.playground.type}`,
            presentationClass,
            `expert-stage-${stage}`
        ].join(" ");

        if (stage === "think" || stage === "review") {
            this.renderExpertThinking(panel, levelNumber, definition, scenario, stage);
            return;
        }

        this.renderExpertSolve(panel, levelNumber, definition, scenario);
    }


    renderExpertThinking(panel, levelNumber, definition, scenario, stage) {
        const thinking = definition.thinking || {};
        const simulation = this.expertRunner?.getMentalSimulation();

        if (!simulation) {
            throw new Error("Expert prediction cannot render without a validated operation sequence.");
        }
        const submitted = stage === "review";
        const assessment = this.expertRunner.getPrediction()?.assessment;
        const prediction = this.expertRunner.getPrediction()?.response;
        const predictionFields = this.getExpertPredictionFields(thinking);
        const trace = simulation.steps.map((step, index) => (
            `<li data-expert-operation-index="${index + 1}" data-expert-operation="${step.operation}">
                <strong>${step.label || (Number.isFinite(step.value)
                    ? `${step.operation?.toUpperCase()} ${step.value}`
                    : step.operation?.toUpperCase())}</strong>
            </li>`
        )).join("");
        const actualResult = assessment
            ? this.formatExpertText(thinking.actual_result, {
                final_state: assessment.actualFinalState?.join(", "),
                next_pop: assessment.actualNextPop,
                compared_values: assessment.actualComparedValues?.join(", "),
                comparison_count: assessment.actualComparisonCount,
                outcome: assessment.actualOutcome === "found"
                    ? (thinking.found_label || "FOUND")
                    : assessment.actualOutcome === "not_found"
                        ? (thinking.not_found_label || "NOT FOUND")
                        : assessment.actualOutcome
            })
            : "";
        const predictionSummary = predictionFields.map(field => (
            `${field.label}: ${this.formatPredictionValue(prediction?.[field.id], field)}`
        )).join("; ");
        const resultExplanation = assessment
            ? this.getExpertPredictionMessage(assessment)
            : "";

        this.setYourStackLabel(
            submitted,
            thinking.replay_stack_label || "SIMULATION REPLAY"
        );
        panel.innerHTML = `
            <div class="challenge-card mastery-challenge-card expert-thinking-card">
                <header class="mastery-puzzle-header">
                    <span class="teaching-kicker">Level ${levelNumber} · Expert</span>
                    <h3>${thinking.title || "Think before you run it"}</h3>
                </header>
                <div class="mastery-objective">
                    <span>${thinking.objective_label || "Think first"}</span>
                    <p>${thinking.instruction || "Predict the result before the playground runs."}</p>
                </div>
                <div id="expert-thinking-start-state" class="expert-thinking-start-state"></div>
                <div class="expert-trace" aria-label="Operation sequence">
                    <span>${thinking.sequence_label || "Operations to simulate"}</span>
                    <p>${thinking.do_not_execute || "Do not perform these operations yet. Work through them in your head."}</p>
                    <ol>${trace}</ol>
                </div>
                <div class="expert-prediction-fields">
                    <span class="expert-prediction-heading">${thinking.prediction_label || "Your prediction"}</span>
                    ${predictionFields.map(field => (
                        this.renderExpertPredictionControl(field, prediction, submitted)
                    )).join("")}
                </div>
                ${submitted
                    ? `<div class="expert-actual-result"><strong>${thinking.actual_label || "Result"}</strong><p>${thinking.your_prediction_label || "Your prediction"}: ${predictionSummary}.</p><p>${actualResult}</p><p class="expert-result-explanation">${resultExplanation}</p></div>`
                    : ""}
                <div class="mastery-outcome" aria-live="polite">
                    ${this.lastResult?.status === "prediction_incomplete"
                        ? `<p class="mastery-attempt-feedback">${this.lastResult.feedback}</p>`
                        : ""}
                    ${submitted && !this.expertReplayComplete
                        ? `<p class="mastery-progress-feedback">${thinking.replay_message || "Now watch the playground carry out the sequence."}</p>`
                        : ""}
                </div>
                <div class="challenge-actions">
                    ${!submitted
                        ? `<button type="button" data-expert-prediction-submit>${thinking.submit_label || "Check my prediction"}</button>`
                        : ""}
                    ${submitted && this.expertReplayComplete
                        ? `<button type="button" data-expert-begin>${thinking.continue_label || "Continue to Expert Challenge →"}</button>`
                        : ""}
                </div>
            </div>
        `;

        this.playground?.renderExpertThinkingState?.({
            ...simulation,
            initialState: simulation.initial_state,
            labels: {
                title: thinking.starting_stack_label || "Starting Stack",
                target: thinking.target_label || "Target",
                top: thinking.top_label || "TOP",
                bottom: thinking.bottom_label || "BOTTOM"
            }
        }, document.getElementById("expert-thinking-start-state"));
    }


    renderExpertSolve(panel, levelNumber, definition, scenario) {
        const solve = definition.solve || {};
        const metrics = this.expertRunner.getMetrics();
        const outcome = this.lastResult?.status;
        const active = this.expertRunner.isExecutionActive();
        const availableValues = scenario.data.available_push_values || [];
        const customControls = Array.isArray(solve.controls)
            ? solve.controls.filter(control => (
                control
                && typeof control.operation === "string"
                && typeof control.label === "string"
            ))
            : [];
        const metricLabel = solve.metric_label || "Operations";
        const supportsOptimization = Number.isFinite(scenario.data.optimal_operations);
        const pushButtons = availableValues.map(value => (
            `<button type="button" data-expert-push-value="${value}">PUSH ${value}</button>`
        )).join("");
        const expertControls = customControls.length
            ? customControls.map(control => (
                `<button type="button" data-expert-operation="${control.operation}">${control.label}</button>`
            )).join("")
            : `${pushButtons}<button type="button" data-expert-pop>POP</button>`;

        this.setYourStackLabel(true, solve.your_label || "YOUR STACK");
        panel.innerHTML = `
            <div class="challenge-card mastery-challenge-card expert-solve-card">
                <header class="mastery-puzzle-header">
                    <span class="teaching-kicker">Level ${levelNumber} · Expert</span>
                    <h3>${solve.title || "Expert Challenge"}</h3>
                </header>
                <div class="mastery-objective">
                    <span>Objective</span>
                    <p>${solve.instruction || "Transform START into TARGET. Find your own efficient plan."}</p>
                </div>
                <div id="mastery-state-comparison" class="mastery-state-comparison"></div>
                <div class="mastery-quick-facts">
                    <p class="mastery-operations">${metricLabel}: ${metrics.operations}</p>
                    <p class="mastery-hints">${solve.hints_label || "Hints: none"}</p>
                    <p class="mastery-operation-rule">${solve.operation_rule || "Each available operation counts once."}</p>
                </div>
                <div class="expert-controls" aria-label="Available operations">
                    <span>${solve.available_values_label || "Available operations"}</span>
                    <div class="expert-push-values">${expertControls}</div>
                </div>
                <div class="mastery-outcome" aria-live="polite">
                    ${outcome === "expert_solved"
                        ? `<p class="challenge-success">${solve.solved_message || "✓ Expert Challenge Solved"}</p>
                           ${solve.solved_result ? `<p class="mastery-result-detail">${this.formatExpertText(solve.solved_result, {
                               operations: metrics.operations,
                               comparisons: metrics.operations,
                               optimal_operations: scenario.data.optimal_operations
                           })}</p>` : ""}`
                        : ""}
                    ${outcome === "expert_perfect"
                        ? `<p class="challenge-success expert-perfect-result">${solve.perfect_message || "🏆 PERFECT EXPERT"}</p>
                           <p class="mastery-result-detail">${this.formatExpertText(solve.perfect_result, {
                               comparisons: metrics.operations,
                               optimal_operations: scenario.data.optimal_operations
                           })}</p>`
                        : ""}
                    ${active && this.lastResult?.feedback
                        ? `<p class="mastery-progress-feedback">${this.lastResult.feedback}</p>`
                        : ""}
                </div>
                <div class="challenge-actions">
                    ${active
                        ? '<button type="button" data-expert-retry>Restart this challenge</button>'
                        : ""}
                    ${outcome === "expert_solved" && supportsOptimization && solve.try_optimal_label
                        ? `<button type="button" data-expert-optimal>${this.formatExpertText(solve.try_optimal_label, {
                            optimal_operations: scenario.data.optimal_operations
                        })}</button>`
                        : ""}
                    ${(outcome === "expert_solved" || outcome === "expert_perfect")
                        ? `<button type="button" data-expert-new>${solve.new_challenge_label || "New Expert Challenge"}</button>`
                        : ""}
                    ${(outcome === "expert_solved" || outcome === "expert_perfect")
                        ? '<button type="button" data-mastery-free-play>Continue experimenting</button>'
                        : ""}
                </div>
            </div>
        `;

        this.renderMasteryStates(
            this.getCurrentLevel(),
            {},
            document.getElementById("mastery-state-comparison")
        );
    }


    bindControls() {
        document.querySelectorAll("[data-mastery-start]").forEach(button => {
            button.onclick = () => this.startLevel(button.dataset.masteryStart);
        });

        document.querySelectorAll("[data-mastery-retry]").forEach(button => {
            button.onclick = () => this.retryLevel();
        });

        document.querySelectorAll("[data-mastery-hint]").forEach(button => {
            button.onclick = () => this.useHint();
        });

        document.querySelectorAll("[data-mastery-free-play]").forEach(button => {
            button.onclick = () => this.continueFreePlay();
        });

        document.querySelectorAll("[data-mastery-operation]").forEach(button => {
            button.onclick = () => this.performMasteryOperation(
                button.dataset.masteryOperation
            );
        });

        document.querySelectorAll("[data-expert-prediction-submit]").forEach(button => {
            button.onclick = () => this.submitExpertPrediction();
        });

        document.querySelectorAll("[data-expert-begin]").forEach(button => {
            button.onclick = () => this.beginExpertExecution();
        });

        document.querySelectorAll("[data-expert-push-value]").forEach(button => {
            button.onclick = () => this.performExpertOperation(
                "push",
                Number(button.dataset.expertPushValue)
            );
        });

        document.querySelectorAll("[data-expert-pop]").forEach(button => {
            button.onclick = () => this.performExpertOperation("pop");
        });

        document.querySelectorAll("[data-expert-operation]").forEach(button => {
            button.onclick = () => this.performExpertOperation(
                button.dataset.expertOperation
            );
        });

        document.querySelectorAll("[data-expert-retry]").forEach(button => {
            button.onclick = () => this.retryExpertChallenge();
        });

        document.querySelectorAll("[data-expert-optimal]").forEach(button => {
            button.onclick = () => this.retryExpertChallenge();
        });

        document.querySelectorAll("[data-expert-new]").forEach(button => {
            button.onclick = () => this.startNewExpertChallenge();
        });
    }

}


const masteryEngine = new MasteryEngine(LESSON);
