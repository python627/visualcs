let lessonFinished = false;


function resetLesson() {

    playground.reset();

    pushCount = 0;

    popCount = 0;

    lessonFinished = false;

    updateMission();

    message.innerHTML = `
        🤖 Byte<br><br>
        Welcome! Let's discover how a
        ${LESSON.topic} works.
    `;
}
