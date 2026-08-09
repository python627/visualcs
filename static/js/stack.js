const stack = [];

const playgroundType = LESSON.playground.type;


function render() {

    stackDiv.innerHTML = "";

    stack.forEach((number, index) => {

        const block = document.createElement("div");

        block.className = "block";

        if (
            playgroundType === "stack" &&
            index === stack.length - 1
        ) {
            block.classList.add("new");
        }

        block.innerText = number;

        stackDiv.appendChild(block);

    });

}


function push() {

    if (lessonFinished) return;

    const value =
        Math.floor(Math.random() * 90) + 10;

    pushCount++;

    const block = document.createElement("div");

    block.className = "block falling-block";

    block.innerText = value;

    animationLayer.appendChild(block);


    setTimeout(() => {

        if (animationLayer.contains(block)) {

            animationLayer.removeChild(block);

        }

        stack.push(value);

        render();

    }, 600);


    if (pushCount < 3) {

        message.innerHTML =
            "🤖 Byte<br><br>" +
            "Great! Press " +
            (playgroundType === "queue"
                ? "ENQUEUE"
                : "PUSH") +
            " again.";

    }

    else {

        message.innerHTML =
            "🤖 Byte<br><br>" +
            "Excellent! Now press " +
            (playgroundType === "queue"
                ? "DEQUEUE"
                : "POP") +
            " once.";

    }

    updateMission();

}


function pop() {

    if (lessonFinished) return;


    if (stack.length === 0) {

        message.innerHTML =
            "🤖 Byte<br><br>The structure is empty.";

        return;

    }


    if (playgroundType === "queue") {

        stack.shift();

    }

    else {

        stack.pop();

    }


    popCount++;

    render();

    updateMission();


    if (
        pushCount >= 3 &&
        popCount >= 1
    ) {

        showQuiz();

    }

}