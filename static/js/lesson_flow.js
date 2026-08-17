const LESSON_STAGES = Array.from(
    document.querySelectorAll("[data-lesson-stage]")
).map(element => element.dataset.lessonStage);

let currentLessonStage = "learn";


function setLessonStage(stage) {

    if (!LESSON_STAGES.includes(stage)) {
        return;
    }

    currentLessonStage = stage;
    const activeStageIndex = LESSON_STAGES.indexOf(stage);

    document.querySelectorAll("[data-lesson-stage]").forEach(element => {
        const stageIndex = LESSON_STAGES.indexOf(element.dataset.lessonStage);

        element.classList.toggle("active", stageIndex === activeStageIndex);
        element.classList.toggle("complete", stageIndex < activeStageIndex);
    });

}


function showLessonContinue() {

    const continuePanel = document.getElementById("lesson-continue");

    if (continuePanel) {
        continuePanel.hidden = false;
    }

}


function resetLessonFlow() {

    const continuePanel = document.getElementById("lesson-continue");

    if (continuePanel) {
        continuePanel.hidden = true;
    }

    setLessonStage("learn");

}


function initializeLessonFlow() {

    setLessonStage("learn");

    document.querySelectorAll("[data-operation]").forEach(control => {
        control.addEventListener("click", () => {
            if (currentLessonStage === "learn") {
                setLessonStage("mission");
            }
        });
    });

}


initializeLessonFlow();
