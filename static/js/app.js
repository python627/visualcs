const stack = [];
const stackDiv = document.getElementById("stack");
const message = document.getElementById("message");

let pushCount = 0;
let popCount = 0;
let lessonFinished = false;


function updateMission(){

    document.querySelectorAll(".step").forEach(step=>{

        step.classList.remove("active");

    });

    if(pushCount===0){

        step1.classList.add("active");

    }

    else if(pushCount===1){

        step1.classList.add("done");

        step2.classList.add("active");

    }

    else if(pushCount===2){

        step2.classList.add("done");

        step3.classList.add("active");

    }

    else if(pushCount===3 && popCount===0){

        step3.classList.add("done");

        step4.classList.add("active");

    }

    else if(pushCount>=3 && popCount>=1){

        step4.classList.add("done");

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

`;

    }

    else{

        message.innerHTML=`

<h2>❌ Not quite.</h2>

<p>Refresh the page and try again.</p>

`;

    }

}
updateMission();