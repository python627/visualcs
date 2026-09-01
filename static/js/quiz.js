function setByteMessage(content) {

    const masteryPanel = document.getElementById("mastery-challenge-panel");
    const masteryFeedback = document.getElementById("mastery-feedback");

    if (masteryPanel && !masteryPanel.hidden && masteryFeedback) {
        masteryFeedback.innerHTML = `<p>${content}</p>`;
        return;
    }

    teachingEngine.setByteMessage(content);
}


function showQuiz() {
    teachingEngine.showQuiz();
}


function checkAnswer(answer) {
    teachingEngine.checkQuizAnswer(answer);
}


function resetQuiz() {
    teachingEngine.resetQuiz();
}
