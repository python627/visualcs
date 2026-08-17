class TeachingEngine {

    constructor(lesson) {
        this.lesson = lesson;
        this.playground = null;
        this.missionStepIndex = 0;
        this.missionCompleted = false;
        this.quizShown = false;
        this.quizAnswered = false;
        this.selectedPrediction = null;
        this.predictionPromptVisible = false;
        this.challengeActive = false;
        this.challengeCompleted = false;
        this.challengePhaseIndex = 0;
        this.completedChallengePhaseMessage = null;
        this.recallCompleted = false;
    }


    getStage(name) {
        return this.lesson.teaching?.[name] ?? this.lesson[name] ?? null;
    }


    getGuidedPractice() {
        return this.getStage("guided_practice")
            ?? this.lesson.guided_teaching
            ?? null;
    }


    getActionExplanations() {
        return this.getGuidedPractice()?.action_explanations || null;
    }


    getPrediction() {
        return this.getGuidedPractice()?.prediction || null;
    }


    getChallenge() {
        return this.getStage("challenge");
    }


    getRecall() {
        return this.getStage("recall");
    }


    getQuiz() {
        return this.getStage("quiz");
    }


    getDiscovery() {
        return this.getStage("discovery");
    }


    connect(playground) {
        this.playground = playground;
    }


    format(template, values = {}) {
        return Object.entries(values).reduce(
            (text, [key, value]) => text.replaceAll(`{${key}}`, value),
            template
        );
    }


    setByteMessage(content) {
        const feedback = this.quizShown
            ? document.getElementById("playground-feedback")
            : null;

        if (feedback) {
            feedback.innerHTML = `<p>${content}</p>`;
            return;
        }

        message.innerHTML = `
            <h3>🤖 Byte</h3>
            <p>${content}</p>
        `;
    }


    renderMission() {
        const steps = document.querySelectorAll(".step");

        steps.forEach((step, index) => {
            step.classList.remove("active", "done");

            if (index < this.missionStepIndex) {
                step.classList.add("done");
            }
            else if (index === this.missionStepIndex) {
                step.classList.add("active");
            }
        });
    }


    getExpectedOperation() {
        return this.lesson.playground.actions[this.missionStepIndex]?.operation
            ?? null;
    }


    getMissionStepIndex() {
        return this.missionStepIndex;
    }


    getGuidedValue(index, fallback) {
        const values = this.getGuidedPractice()?.values;

        return Array.isArray(values) && index < values.length
            ? values[index]
            : fallback;
    }


    getChallengeOperationValue(operation, index) {
        if (!this.challengeActive) {
            return null;
        }

        const values = this.getCurrentChallengePhase()?.operation_values?.[operation];

        return Array.isArray(values) ? values[index] ?? null : null;
    }


    getOperationValue({ operation, index, fallback }) {
        if (!this.missionCompleted && this.getExpectedOperation() === operation) {
            return this.getGuidedValue(this.missionStepIndex, fallback);
        }

        return this.getChallengeOperationValue(operation, index) ?? fallback;
    }


    getActionExplanation(operation, index, values) {
        const explanations = this.getActionExplanations()?.[operation];
        const explanation = Array.isArray(explanations)
            ? explanations[index]
            : explanations;

        return typeof explanation === "string"
            ? this.format(explanation, values)
            : null;
    }


    showActionExplanation(operation, index, values) {
        const explanation = this.getActionExplanation(operation, index, values);

        if (explanation) {
            this.setByteMessage(explanation);
        }
    }


    getPredictionPanel() {
        return document.getElementById("prediction-panel");
    }


    showPredictionPrompt() {
        const prediction = this.getPrediction();
        const panel = this.getPredictionPanel();

        if (!prediction || !panel || this.selectedPrediction !== null) {
            return;
        }

        this.predictionPromptVisible = true;
        panel.hidden = false;
        panel.innerHTML = `
            <div class="prediction-card">
                <h3>${prediction.heading}</h3>
                <p>${prediction.question}</p>
                <div class="prediction-choices">
                    ${prediction.choices.map((choice, index) => `
                        <button class="prediction-choice" data-prediction-index="${index}">
                            ${choice}
                        </button>
                    `).join("")}
                </div>
            </div>
        `;

        panel.querySelectorAll("[data-prediction-index]").forEach(button => {
            button.addEventListener("click", () => {
                this.selectPrediction(prediction.choices[Number(button.dataset.predictionIndex)]);
            });
        });
    }


    selectPrediction(prediction) {
        const config = this.getPrediction();
        const panel = this.getPredictionPanel();

        if (!config || !panel || this.selectedPrediction !== null) {
            return;
        }

        this.selectedPrediction = prediction;
        panel.innerHTML = `
            <div class="prediction-card">
                <h3>${config.heading}</h3>
                <p class="prediction-selected">
                    ${this.format(config.selection_message, { prediction })}
                </p>
            </div>
        `;
    }


    prepareOperation(operation) {
        const prediction = this.getPrediction();

        if (!prediction || this.selectedPrediction !== null) {
            return { blocked: false };
        }

        const expectsPredictionOperation = prediction.before_operation === operation
            && this.getExpectedOperation() === operation;

        if (!this.predictionPromptVisible && !expectsPredictionOperation) {
            return { blocked: false };
        }

        this.showPredictionPrompt();
        this.setByteMessage(
            expectsPredictionOperation
                ? prediction.required_message
                : prediction.pending_message
        );

        return { blocked: true };
    }


    resolvePrediction(actual, operation) {
        const prediction = this.getPrediction();
        const panel = this.getPredictionPanel();

        if (!prediction || !panel || this.selectedPrediction === null) {
            return;
        }

        const result = prediction.result;
        const isCorrect = String(this.selectedPrediction) === String(actual);
        const predictionMessage = this.format(
            isCorrect ? result.correct : result.incorrect,
            { prediction: this.selectedPrediction }
        );
        const actualTemplate = isCorrect && result.correct_actual
            ? result.correct_actual
            : result.actual;
        const actualMessage = this.format(actualTemplate, { actual });
        const explanation = this.getActionExplanation(
            operation || prediction.result_operation || prediction.before_operation,
            0,
            { removed: actual, value: actual }
        );

        panel.hidden = false;
        panel.innerHTML = `
            <div class="prediction-card prediction-result">
                <p>${predictionMessage}</p>
                <p class="prediction-actual">${actualMessage}</p>
                ${explanation ? `<p>${explanation}</p>` : ""}
                <div class="operation-connection">
                    <span>${result.concept.last_in}</span>
                    <span>${result.concept.arrow}</span>
                    <span>${result.concept.first_out}</span>
                    <strong>${result.concept.label}</strong>
                </div>
            </div>
        `;
    }


    completeMissionOperation(operation) {
        if (this.missionCompleted || operation !== this.getExpectedOperation()) {
            return {
                accepted: false,
                complete: this.missionCompleted,
                nextOperation: this.getExpectedOperation()
            };
        }

        this.missionStepIndex++;
        this.renderMission();

        const complete = this.missionStepIndex === this.lesson.playground.actions.length;

        if (complete) {
            this.missionCompleted = true;

            if (!this.startChallenge()) {
                this.showQuiz();
            }
        }

        return {
            accepted: true,
            complete,
            nextOperation: this.getExpectedOperation()
        };
    }


    operationCompleted({ operation, value, removedValue, state }) {
        const missionStep = this.missionStepIndex;
        const missionResult = this.completeMissionOperation(operation);

        if (missionResult.accepted) {
            const actual = removedValue ?? value;
            const prediction = this.getPrediction();

            if (
                prediction
                && this.selectedPrediction !== null
                && (prediction.result_operation || prediction.before_operation) === operation
            ) {
                this.resolvePrediction(actual, operation);
            }
            else {
                this.showActionExplanation(operation, missionStep, {
                    value,
                    removed: removedValue ?? value
                });

                if (missionResult.nextOperation === prediction?.before_operation) {
                    this.showPredictionPrompt();
                }
            }
        }
        else if (this.challengeActive && Array.isArray(state)) {
            this.reportChallengeState(state, operation);
        }

        return missionResult;
    }


    reportUnavailableOperation({ operation, state }) {
        if (this.challengeActive && Array.isArray(state)) {
            this.reportChallengeState(state, operation);
        }
    }


    getCurrentChallengePhase() {
        return this.getChallenge()?.phases?.[this.challengePhaseIndex] || null;
    }


    hasChallenge() {
        const challenge = this.getChallenge();

        return Boolean(challenge && Array.isArray(challenge.phases) && challenge.phases.length);
    }


    statesMatch(currentState, expectedState) {
        return JSON.stringify(currentState) === JSON.stringify(expectedState);
    }


    isExpectedStatePrefix(currentState, expectedState) {
        return currentState.length <= expectedState.length
            && currentState.every((value, index) => value === expectedState[index]);
    }


    renderChallengeTarget(phase) {
        const target = document.getElementById("challenge-target");

        if (target && this.playground?.renderChallengeTarget) {
            this.playground.renderChallengeTarget(phase.target, target);
        }
    }


    bindChallengeControls() {
        const panel = document.getElementById("challenge-panel");

        panel?.querySelector("[data-challenge-retry]")?.addEventListener(
            "click",
            () => this.restartChallenge()
        );
        panel?.querySelector("[data-challenge-continue]")?.addEventListener(
            "click",
            () => this.continueChallenge()
        );
    }


    renderChallenge() {
        const challenge = this.getChallenge();
        const panel = document.getElementById("challenge-panel");

        if (!challenge || !panel) {
            return;
        }

        panel.hidden = false;

        if (this.challengeCompleted) {
            const finalPhase = challenge.phases.at(-1);

            panel.innerHTML = `
                <div class="challenge-card">
                    <h3>${challenge.title}</h3>
                    <p class="challenge-success">${finalPhase.success}</p>
                    <p>${challenge.continue_message}</p>
                    <div class="challenge-actions">
                        <button type="button" data-challenge-retry>Retry challenge</button>
                        <button type="button" data-challenge-continue>Continue experimenting</button>
                    </div>
                </div>
            `;

            this.bindChallengeControls();
            return;
        }

        const phase = this.getCurrentChallengePhase();

        if (!phase) {
            return;
        }

        panel.innerHTML = `
            <div class="challenge-card">
                <h3>${challenge.title}</h3>
                ${this.completedChallengePhaseMessage
                    ? `<p class="challenge-progress">${this.completedChallengePhaseMessage}</p>`
                    : ""}
                <h4>${phase.title}</h4>
                <p>${phase.instruction}</p>
                <div id="challenge-target" class="challenge-target"></div>
                <p>Use the playground below to experiment. You can retry whenever you want.</p>
                <div class="challenge-actions">
                    <button type="button" data-challenge-retry>Retry challenge</button>
                </div>
            </div>
        `;

        this.renderChallengeTarget(phase);
        this.bindChallengeControls();
    }


    startChallenge() {
        if (!this.hasChallenge() || !this.playground?.resetForChallenge) {
            return false;
        }

        this.challengeActive = true;
        this.challengeCompleted = false;
        this.challengePhaseIndex = 0;
        this.completedChallengePhaseMessage = null;
        this.playground.resetForChallenge();
        this.renderChallenge();
        this.setByteMessage(this.getChallenge().start_message);

        return true;
    }


    restartChallenge() {
        if (!this.hasChallenge() || !this.playground?.resetForChallenge) {
            return;
        }

        if (this.quizShown) {
            this.resetQuiz();
            this.resetRecall();
            setLessonStage("mission");
        }

        this.challengeActive = true;
        this.challengeCompleted = false;
        this.challengePhaseIndex = 0;
        this.completedChallengePhaseMessage = null;
        this.playground.resetForChallenge();
        this.renderChallenge();
        this.setByteMessage(this.getChallenge().start_message);
    }


    continueChallenge() {
        const panel = document.getElementById("challenge-panel");

        if (panel) {
            panel.hidden = true;
        }

        this.setByteMessage(this.getChallenge().continue_message);
    }


    reportChallengeState(state, operation) {
        const phase = this.getCurrentChallengePhase();

        if (!phase) {
            return false;
        }

        if (this.statesMatch(state, phase.expected_state)) {
            this.completedChallengePhaseMessage = phase.success;

            if (this.challengePhaseIndex < this.getChallenge().phases.length - 1) {
                this.challengePhaseIndex++;
                this.renderChallenge();
                this.setByteMessage(phase.success);
            }
            else {
                this.challengeActive = false;
                this.challengeCompleted = true;
                this.renderChallenge();
                this.showQuiz();
            }

            return true;
        }

        const progressOperations = phase.progress_operations || [];
        const isValidProgress = phase.progressive
            && progressOperations.includes(operation)
            && this.isExpectedStatePrefix(state, phase.expected_state);

        if (!isValidProgress) {
            this.setByteMessage(phase.feedback);
        }

        return false;
    }


    resetChallenge() {
        this.challengeActive = false;
        this.challengeCompleted = false;
        this.challengePhaseIndex = 0;
        this.completedChallengePhaseMessage = null;

        const panel = document.getElementById("challenge-panel");

        if (panel) {
            panel.hidden = true;
            panel.innerHTML = "";
        }
    }


    showQuiz() {
        if (this.quizShown) {
            return;
        }

        const quiz = this.getQuiz();

        if (!quiz) {
            return;
        }

        this.quizShown = true;
        this.quizAnswered = false;
        setLessonStage("quiz");

        const optionsHTML = quiz.options.map((option, index) => `
            <div class="quiz-option" onclick="checkAnswer(${index})">◯ ${option}</div>
        `).join("");

        message.innerHTML = `
            <h3>🤖 Byte</h3>
            <p>You discovered something.</p>
            <p><strong>${quiz.question}</strong></p>
            <div class="quiz-options">${optionsHTML}</div>
            <div id="playground-feedback"></div>
        `;
    }


    checkQuizAnswer(answer) {
        if (!this.quizShown || this.quizAnswered) {
            return;
        }

        this.quizAnswered = true;

        const quiz = this.getQuiz();
        const discovery = this.getDiscovery();
        const correct = answer === quiz.correct;

        if (correct) {
            setLessonStage("discovery");

            document.getElementById("discoveries").innerHTML = `
                <div class="discovery-card">
                    <h3>🏆 ${discovery.title}</h3>
                    <p>${discovery.summary}</p>
                </div>
            `;

            if (this.hasRecall()) {
                this.showRecall();
            }
            else {
                markLessonCompleted(this.lesson.id);
                showLessonContinue();
            }
        }

        message.innerHTML = `
            <h2>${correct ? "🎉 Correct!" : "❌ Not quite."}</h2>
            <p>${correct ? "You discovered the rule." : "Watch the blocks again."}</p>
            ${correct ? `<h3>${discovery.title}</h3><p>${discovery.summary}</p>` : ""}
            ${correct && this.hasRecall() ? "<p>Now complete the Recall prompt below.</p>" : ""}
            ${correct && !this.hasRecall() ? '<p class="lesson-completion-notice">✓ Lesson Completed</p>' : ""}
            <div id="playground-feedback"></div>
            <br>
            <button onclick="resetLesson()">Try Again</button>
        `;
    }


    resetQuiz() {
        this.quizShown = false;
        this.quizAnswered = false;
    }


    hasRecall() {
        return Boolean(this.getRecall());
    }


    showRecall() {
        const recall = this.getRecall();
        const panel = document.getElementById("lesson-recall");

        if (!recall || !panel) {
            return false;
        }

        this.recallCompleted = false;
        panel.hidden = false;
        panel.innerHTML = `
            <div class="recall-card">
                <h2>${recall.title}</h2>
                <p>${recall.prompt}</p>
                <textarea
                    id="recall-response"
                    class="recall-response"
                    rows="3"
                    aria-label="${recall.title} response"
                ></textarea>
                <button type="button" class="recall-submit" id="submit-recall">
                    ${recall.submit_label}
                </button>
                <p id="recall-feedback" class="recall-feedback"></p>
            </div>
        `;

        document.getElementById("submit-recall").addEventListener(
            "click",
            () => this.submitRecall()
        );
        setLessonStage("recall");

        return true;
    }


    submitRecall() {
        const recall = this.getRecall();
        const response = document.getElementById("recall-response");
        const feedback = document.getElementById("recall-feedback");

        if (!recall || !response || !feedback || this.recallCompleted) {
            return;
        }

        if (!response.value.trim()) {
            feedback.textContent = recall.empty_message;
            return;
        }

        this.recallCompleted = true;
        markLessonCompleted(this.lesson.id);
        showLessonContinue();

        const panel = document.getElementById("lesson-recall");

        panel.innerHTML = `
            <div class="recall-card">
                <h2>${recall.title}</h2>
                <p class="recall-complete">${recall.completion_message}</p>
                <div class="recall-model-answer">
                    <strong>Model explanation</strong>
                    <p>${recall.model_answer}</p>
                </div>
            </div>
        `;
    }


    resetRecall() {
        this.recallCompleted = false;

        const panel = document.getElementById("lesson-recall");

        if (panel) {
            panel.hidden = true;
            panel.innerHTML = "";
        }
    }


    reset() {
        this.missionStepIndex = 0;
        this.missionCompleted = false;
        this.renderMission();
        this.resetQuiz();
        this.selectedPrediction = null;
        this.predictionPromptVisible = false;

        const predictionPanel = this.getPredictionPanel();

        if (predictionPanel) {
            predictionPanel.hidden = true;
            predictionPanel.innerHTML = "";
        }

        this.resetChallenge();
        this.resetRecall();
    }
}


const teachingEngine = new TeachingEngine(LESSON);
