function renderMission() {
    teachingEngine.renderMission();
}


function getExpectedOperation() {
    return teachingEngine.getExpectedOperation();
}


function getMissionStepIndex() {
    return teachingEngine.getMissionStepIndex();
}


function completeAction(operation) {
    return teachingEngine.operationCompleted({
        operation,
        deferExplanation: true
    });
}


function resetMission() {
    teachingEngine.reset();
}
