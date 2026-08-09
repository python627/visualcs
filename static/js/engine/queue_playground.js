function createQueuePlayground() {

    const queue = [];

    function render() {

        stackDiv.innerHTML = "";
        stackDiv.classList.remove("linked-list-view");

        queue.forEach(number => {

            const block = document.createElement("div");
            block.className = "block";
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

            queue.push(value);
            render();

        }, 600);

        message.innerHTML =
            "\uD83E\uDD16 Byte<br><br>" +
            (pushCount < 3
                ? "Great! Press ENQUEUE again."
                : "Excellent! Now press DEQUEUE once.");

        updateMission();

    }

    function remove() {

        if (lessonFinished) return;

        if (queue.length === 0) {
            message.innerHTML = "\uD83E\uDD16 Byte<br><br>The structure is empty.";
            return;
        }

        queue.shift();
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
            queue.length = 0;
            render();
        }
    };

}
