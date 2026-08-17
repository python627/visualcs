let lessonChallengePlayground = null;
let lessonChallengeActive = false;
let lessonChallengeCompleted = false;
let lessonChallengePhaseIndex = 0;
let completedChallengePhaseMessage = null;


function getLessonChallenge() {

    return LESSON.challenge || null;

}


function getLessonChallengePanel() {

    return document.getElementById("challenge-panel");

}


function getCurrentChallengePhase() {

    return getLessonChallenge()?.phases?.[lessonChallengePhaseIndex] || null;

}


function hasLessonChallenge() {

    const challenge = getLessonChallenge();

    return Boolean(challenge && Array.isArray(challenge.phases) && challenge.phases.length);

}


function statesMatch(currentState, expectedState) {

    return JSON.stringify(currentState) === JSON.stringify(expectedState);

}


function isExpectedStatePrefix(currentState, expectedState) {

    return currentState.length <= expectedState.length
        && currentState.every((value, index) => value === expectedState[index]);

}


function initializeLessonChallenge(playground) {

    lessonChallengePlayground = playground;

}


function renderChallengeTarget(phase) {

    const target = document.getElementById("challenge-target");

    if (target && lessonChallengePlayground?.renderChallengeTarget) {
        lessonChallengePlayground.renderChallengeTarget(phase.target, target);
    }

}


function bindChallengeControls() {

    const panel = getLessonChallengePanel();

    panel?.querySelector("[data-challenge-retry]")?.addEventListener(
        "click",
        restartLessonChallenge
    );
    panel?.querySelector("[data-challenge-continue]")?.addEventListener(
        "click",
        continueLessonChallenge
    );

}


function renderLessonChallenge() {

    const challenge = getLessonChallenge();
    const panel = getLessonChallengePanel();

    if (!challenge || !panel) {
        return;
    }

    panel.hidden = false;

    if (lessonChallengeCompleted) {
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

        bindChallengeControls();
        return;
    }

    const phase = getCurrentChallengePhase();

    if (!phase) {
        return;
    }

    panel.innerHTML = `
        <div class="challenge-card">
            <h3>${challenge.title}</h3>
            ${completedChallengePhaseMessage
                ? `<p class="challenge-progress">${completedChallengePhaseMessage}</p>`
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

    renderChallengeTarget(phase);
    bindChallengeControls();

}


function startLessonChallenge() {

    if (!hasLessonChallenge() || !lessonChallengePlayground?.resetForChallenge) {
        return false;
    }

    lessonChallengeActive = true;
    lessonChallengeCompleted = false;
    lessonChallengePhaseIndex = 0;
    completedChallengePhaseMessage = null;
    lessonChallengePlayground.resetForChallenge();
    renderLessonChallenge();
    setByteMessage(getLessonChallenge().start_message);

    return true;

}


function restartLessonChallenge() {

    if (!hasLessonChallenge() || !lessonChallengePlayground?.resetForChallenge) {
        return;
    }

    if (quizShown) {
        resetQuiz();
        resetLessonRecall();
        setLessonStage("mission");
    }

    lessonChallengeActive = true;
    lessonChallengeCompleted = false;
    lessonChallengePhaseIndex = 0;
    completedChallengePhaseMessage = null;
    lessonChallengePlayground.resetForChallenge();
    renderLessonChallenge();
    setByteMessage(getLessonChallenge().start_message);

}


function continueLessonChallenge() {

    const panel = getLessonChallengePanel();

    if (panel) {
        panel.hidden = true;
    }

    setByteMessage(getLessonChallenge().continue_message);

}


function getLessonChallengeOperationValue(operation, index) {

    if (!lessonChallengeActive) {
        return null;
    }

    const values = getCurrentChallengePhase()?.operation_values?.[operation];

    return Array.isArray(values) ? values[index] ?? null : null;

}


function reportLessonChallengeState(state, operation) {

    if (!lessonChallengeActive) {
        return false;
    }

    const phase = getCurrentChallengePhase();

    if (!phase) {
        return false;
    }

    if (statesMatch(state, phase.expected_state)) {
        completedChallengePhaseMessage = phase.success;

        if (lessonChallengePhaseIndex < getLessonChallenge().phases.length - 1) {
            lessonChallengePhaseIndex++;
            renderLessonChallenge();
            setByteMessage(phase.success);
        }
        else {
            lessonChallengeActive = false;
            lessonChallengeCompleted = true;
            renderLessonChallenge();
            showQuiz();
        }

        return true;
    }

    const progressOperations = phase.progress_operations || [];
    const isValidProgress = phase.progressive
        && progressOperations.includes(operation)
        && isExpectedStatePrefix(state, phase.expected_state);

    if (!isValidProgress) {
        setByteMessage(phase.feedback);
    }

    return false;

}


function resetLessonChallenge() {

    lessonChallengeActive = false;
    lessonChallengeCompleted = false;
    lessonChallengePhaseIndex = 0;
    completedChallengePhaseMessage = null;

    const panel = getLessonChallengePanel();

    if (panel) {
        panel.hidden = true;
        panel.innerHTML = "";
    }

}
