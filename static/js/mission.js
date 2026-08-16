let missionStepIndex = 0;
let missionCompleted = false;


function renderMission() {
    const steps = document.querySelectorAll(".step");

    steps.forEach((step, index) => {
        step.classList.remove("active", "done");

        if (index < missionStepIndex) {
            step.classList.add("done");
        }
        else if (index === missionStepIndex) {
            step.classList.add("active");
        }
    });
}


function getExpectedOperation() {
    return LESSON.playground.actions[missionStepIndex]?.operation ?? null;
}


function getMissionStepIndex() {
    return missionStepIndex;
}


function completeAction(operation) {
    if (missionCompleted || operation !== getExpectedOperation()) {
        return {
            accepted: false,
            complete: missionCompleted,
            nextOperation: getExpectedOperation()
        };
    }

    missionStepIndex++;
    renderMission();

    const complete = missionStepIndex === LESSON.playground.actions.length;

    if (complete) {
        missionCompleted = true;
        showQuiz();
    }

    return {
        accepted: true,
        complete,
        nextOperation: getExpectedOperation()
    };
}


function resetMission() {
    missionStepIndex = 0;
    missionCompleted = false;
    renderMission();
}
