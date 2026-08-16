function resetLesson() {
    resetMission();
    resetQuiz();
    resetLessonFlow();
    resetGuidedTeaching();
    setByteMessage(`Welcome! Let's discover how a ${LESSON.topic} works.`);
}
