let lessonRecallCompleted = false;


function getLessonRecall() {

    return LESSON.recall || null;

}


function hasLessonRecall() {

    return Boolean(getLessonRecall());

}


function getLessonRecallPanel() {

    return document.getElementById("lesson-recall");

}


function showLessonRecall() {

    const recall = getLessonRecall();
    const panel = getLessonRecallPanel();

    if (!recall || !panel) {
        return false;
    }

    lessonRecallCompleted = false;
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
        submitLessonRecall
    );
    setLessonStage("recall");

    return true;

}


function submitLessonRecall() {

    const recall = getLessonRecall();
    const response = document.getElementById("recall-response");
    const feedback = document.getElementById("recall-feedback");

    if (!recall || !response || !feedback || lessonRecallCompleted) {
        return;
    }

    if (!response.value.trim()) {
        feedback.textContent = recall.empty_message;
        return;
    }

    lessonRecallCompleted = true;
    markLessonCompleted(LESSON.id);
    showLessonContinue();

    const panel = getLessonRecallPanel();

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


function resetLessonRecall() {

    lessonRecallCompleted = false;

    const panel = getLessonRecallPanel();

    if (panel) {
        panel.hidden = true;
        panel.innerHTML = "";
    }

}
