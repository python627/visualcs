let quizShown = false;
let quizAnswered = false;


function setByteMessage(content) {
    const feedback = quizShown
        ? document.getElementById("playground-feedback")
        : null;

    if (feedback) {
        feedback.innerHTML = `<p>${content}</p>`;
        return;
    }

    message.innerHTML = `
        <h3>🤖 Byte</h3>
        <p>${content}</p>
    `;
}


function showQuiz() {
    if (quizShown) return;

    quizShown = true;
    quizAnswered = false;

    const quiz = LESSON.quiz;
    const optionsHTML = quiz.options.map((option, index) => `
        <div class="quiz-option" onclick="checkAnswer(${index})">○ ${option}</div>
    `).join("");

    message.innerHTML = `
        <h3>🤖 Byte</h3>
        <p>You discovered something.</p>
        <p><strong>${quiz.question}</strong></p>
        <div class="quiz-options">${optionsHTML}</div>
        <div id="playground-feedback"></div>
    `;
}


function checkAnswer(answer) {
    if (!quizShown || quizAnswered) return;

    quizAnswered = true;

    const quiz = LESSON.quiz;
    const correct = answer === quiz.correct;

    if (correct) {
        document.getElementById("discoveries").innerHTML = `
            <div class="discovery-card">
                <h3>🏆 ${LESSON.discovery.title}</h3>
                <p>${LESSON.discovery.summary}</p>
            </div>
        `;
    }

    message.innerHTML = `
        <h2>${correct ? "🎉 Correct!" : "❌ Not quite."}</h2>
        <p>${correct ? "You discovered the rule." : "Watch the blocks again."}</p>
        ${correct ? `<h3>${LESSON.discovery.title}</h3><p>${LESSON.discovery.summary}</p>` : ""}
        <div id="playground-feedback"></div>
        <br>
        <button onclick="resetLesson()">Try Again</button>
    `;
}


function resetQuiz() {
    quizShown = false;
    quizAnswered = false;
}
