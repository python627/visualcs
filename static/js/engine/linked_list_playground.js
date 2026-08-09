function createLinkedListPlayground() {

    const linkedList = new LinkedList();
    let linkedListBusy = false;

    function render(options = {}) {

        const { enteringNode = false, removingHead = false } = options;

        stackDiv.innerHTML = "";
        stackDiv.classList.add("linked-list-view");

        const values = linkedList.getValues();

        if (values.length === 0) {

            const emptyState = document.createElement("p");
            emptyState.className = "linked-list-empty";
            emptyState.textContent = "head \u2192 null";
            stackDiv.appendChild(emptyState);

            return;

        }

        values.forEach((value, index) => {

            const node = document.createElement("div");
            node.className = "linked-node";

            if (index === 0) node.classList.add("head-node");
            if (index === values.length - 1 && enteringNode) {
                node.classList.add("node-entering");
            }
            if (index === 0 && removingHead) {
                node.classList.add("node-removing");
            }

            if (index === 0) {

                const headLabel = document.createElement("span");
                headLabel.className = "head-label";
                headLabel.textContent = "HEAD";
                node.appendChild(headLabel);

            }

            const data = document.createElement("div");
            data.className = "node-data";
            data.textContent = value;

            const link = document.createElement("div");
            link.className = "node-arrow";
            link.textContent = index < values.length - 1 ? "next \u2192" : "next \u2192 null";

            node.append(data, link);
            stackDiv.appendChild(node);

        });

    }

    function add() {

        if (lessonFinished || linkedListBusy) return;

        const value = Math.floor(Math.random() * 90) + 10;
        const wasEmpty = linkedList.isEmpty();

        linkedList.add(value);
        pushCount++;

        render({ enteringNode: true });
        updateMission();

        message.innerHTML =
            "\uD83E\uDD16 Byte<br><br>" +
            (pushCount < 3
                ? (wasEmpty
                    ? `Node ${value} is the first node, so HEAD points to it.`
                    : `Node ${value} joined the chain. The previous node's next link points to it.`)
                : "Excellent! Now remove a node and watch HEAD follow its next link.");

    }

    function remove() {

        if (lessonFinished || linkedListBusy) return;

        if (linkedList.isEmpty()) {
            message.innerHTML = "\uD83E\uDD16 Byte<br><br>The Linked List is empty.";
            return;
        }

        linkedListBusy = true;

        const removedValue = linkedList.head.value;

        render({ removingHead: true });

        message.innerHTML =
            "\uD83E\uDD16 Byte<br><br>" +
            `Node ${removedValue} is leaving. Watch HEAD move to the next node.`;

        setTimeout(() => {

            linkedList.remove();
            popCount++;

            render();
            updateMission();

            linkedListBusy = false;

            if (pushCount >= 3 && popCount >= 1) {
                showQuiz();
            }
            else {
                message.innerHTML =
                    "\uD83E\uDD16 Byte<br><br>" +
                    "HEAD now points to the next node in the chain.";
            }

        }, 650);

    }

    return {
        mount() {
            pushBtn.onclick = add;
            popBtn.onclick = remove;
            render();
        },
        reset() {
            linkedListBusy = false;
            linkedList.clear();
            render();
        }
    };

}
