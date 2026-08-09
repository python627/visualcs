let lessonFinished = false;


function resetLesson() {

    stack.length = 0;

    pushCount = 0;

    popCount = 0;

    lessonFinished = false;

    render();

    updateMission();

    message.innerHTML = `
        🤖 Byte<br><br>
        Welcome! Let's discover how a
        ${LESSON.topic} works.
    `;
}