 function showQuiz(){

    lessonFinished = true;

    const quiz = LESSON.quiz;

    let optionsHTML = "";

    quiz.options.forEach((option, index) => {

        optionsHTML += `
            <div
                class="quiz-option"
                onclick="checkAnswer(${index})"
            >
                ○ ${option}
            </div>
        `;

    });

    message.innerHTML = `

        <h3>🤖 Byte</h3>

        <p>You discovered something.</p>

        <p>
            <strong>${quiz.question}</strong>
        </p>

        <div class="quiz-options">

            ${optionsHTML}

        </div>

    `;
}


function checkAnswer(answer){

    const quiz = LESSON.quiz;

    if(answer === quiz.correct){
        document.getElementById("discoveries").innerHTML = `

    <div class="discovery-card">

        <h3>🏆 ${LESSON.discovery.title}</h3>

        <p>
            ${LESSON.discovery.summary}
        </p>

    </div>

`;

        message.innerHTML = `

            <h2>🎉 Correct!</h2>

            <p>
                You discovered the rule.
            </p>

            <h3>${LESSON.discovery.title}</h3>

            <p>
                ${LESSON.discovery.summary}
            </p>

            <br>

            <button onclick="resetLesson()">
                Try Again
            </button>

        `;

    }

    else{

        message.innerHTML = `

            <h2>❌ Not quite.</h2>

            <p>
                Watch the blocks again.
            </p>

            <br>

            <button onclick="resetLesson()">
                Try Again
            </button>

        `;

    }

}