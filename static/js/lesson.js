function resetLesson() {
    resetMission();
    resetQuiz();
    resetLessonFlow();
    resetGuidedTeaching();
    resetLessonChallenge();
    setByteMessage(`Welcome! Let's discover how a ${LESSON.topic} works.`);
}
