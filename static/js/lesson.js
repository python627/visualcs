function resetLesson() {
    resetMission();
    resetQuiz();
    resetLessonFlow();
    setByteMessage(`Welcome! Let's discover how a ${LESSON.topic} works.`);
}
