function resetLesson() {
    resetMission();
    resetQuiz();
    resetLessonFlow();
    resetGuidedTeaching();
    resetLessonChallenge();
    resetLessonRecall();
    setByteMessage(`Welcome! Let's discover how a ${LESSON.topic} works.`);
}
