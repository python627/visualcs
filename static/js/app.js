const stack = [];
const stackDiv = document.getElementById("stack");
const message = document.getElementById("message");

let pushCount = 0;
let popCount = 0;
let lessonFinished = false;


function updateMission(){

    const steps = document.querySelectorAll(".step");

    steps.forEach(step => {
        step.classList.remove("active");
        step.classList.remove("done");
    });

    if(pushCount === 0){
        steps[0].classList.add("active");
    }
    else if(pushCount === 1){
        steps[0].classList.add("done");
        steps[1].classList.add("active");
    }
    else if(pushCount === 2){
        steps[0].classList.add("done");
        steps[1].classList.add("done");
        steps[2].classList.add("active");
    }
    else if(pushCount >= 3 && popCount === 0){
        steps[0].classList.add("done");
        steps[1].classList.add("done");
        steps[2].classList.add("done");
        steps[3].classList.add("active");
    }
    else if(pushCount >= 3 && popCount >= 1){
        steps.forEach(step => step.classList.add("done"));
    }

}

document.getElementById("pushBtn").onclick = push;
document.getElementById("popBtn").onclick = pop;

function render() {

    stackDiv.innerHTML = "";

    stack.forEach(number => {

        const block = document.createElement("div");

        block.className = "block";

        block.innerText = number;

        stackDiv.appendChild(block);

    });

}

function resetLesson(){

    stack.length = 0;

    pushCount = 0;

    popCount = 0;

    lessonFinished = false;

    render();

    updateMission();

    message.innerHTML =
    "Welcome! Let's discover how a Stack works.";

}

function push() {

    if (lessonFinished) return;

    const value = Math.floor(Math.random() * 90) + 10;

    stack.push(value);

    pushCount++;

    render();

    if (pushCount < 3) {

        message.innerHTML =
        "🤖 Byte<br><br>Great! Press PUSH again.";

    }

    else {

        message.innerHTML =
        "🤖 Byte<br><br>Excellent! Now press POP once.";

    }
    updateMission();

}

function pop() {

    if (lessonFinished) return;

    if (stack.length === 0) {

        message.innerHTML =
        "🤖 Byte<br><br>The stack is empty.";

        return;

    }

    stack.pop();

    popCount++;

    render();

    if (pushCount >= 3 && popCount >= 1) {

        showQuiz();

    }
    updateMission();

}

function showQuiz() {

    lessonFinished = true;

    message.innerHTML = `

<h3>🤖 Byte</h3>

<p>You discovered something.</p>

<p><strong>Which block disappeared?</strong></p>

<button onclick="checkAnswer('A')">
The first one added
</button>

<br><br>

<button onclick="checkAnswer('B')">
The last one added
</button>

<br><br>

<button onclick="checkAnswer('C')">
A random block
</button>

`;

}

function checkAnswer(answer){

    if(answer==="B"){

        message.innerHTML=`

<h2>🎉 Correct!</h2>

<p>You discovered the LIFO rule.</p>

<h3>Last In First Out</h3>

<br>

<button onclick="resetLesson()">
Try Again
</button>

`;

    }

    else{

        message.innerHTML=`

<h2>❌ Not quite.</h2>

<p>Watch the blocks again.</p>

<br>

<button onclick="resetLesson()">
Try Again
</button>

`;

    }

}
updateMission();