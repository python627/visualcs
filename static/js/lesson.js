function resetLesson() {
    resetLessonFlow();
    teachingEngine.reset();
    setByteMessage(`Welcome! Let's discover how a ${LESSON.topic} works.`);
}
