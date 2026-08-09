function createStackPlayground() {

    const stack = [];

    function render() {

        stackDiv.innerHTML = "";
        stackDiv.classList.remove("linked-list-view");

        stack.forEach((number, index) => {

            const block = document.createElement("div");
            block.className = "block";

            if (index === stack.length - 1) {
                block.classList.add("new");
            }

            block.innerText = number;
            stackDiv.appendChild(block);

        });

    }

    function add() {

        if (lessonFinished) return;

        const value = Math.floor(Math.random() * 90) + 10;

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

        message.innerHTML =
            "\uD83E\uDD16 Byte<br><br>" +
            (pushCount < 3
                ? "Great! Press PUSH again."
                : "Excellent! Now press POP once.");

        updateMission();

    }

    function remove() {

        if (lessonFinished) return;

        if (stack.length === 0) {
            message.innerHTML = "\uD83E\uDD16 Byte<br><br>The structure is empty.";
            return;
        }

        stack.pop();
        popCount++;

        render();
        updateMission();

        if (pushCount >= 3 && popCount >= 1) {
            showQuiz();
        }

    }

    return {
        mount() {
            pushBtn.onclick = add;
            popBtn.onclick = remove;
        },
        reset() {
            stack.length = 0;
            render();
        }
    };

}
