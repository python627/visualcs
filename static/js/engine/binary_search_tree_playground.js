function createBinarySearchTreePlayground() {

    const insertionValues = [...LESSON.playground.values];
    const svgNamespace = "http://www.w3.org/2000/svg";

    let root = null;
    let nextValueIndex = 0;
    let insertionBusy = false;

    function createNode(value, parent = null) {
        return {
            value,
            parent,
            left: null,
            right: null
        };
    }

    function createSvgElement(name, attributes = {}) {

        const element = document.createElementNS(svgNamespace, name);

        Object.entries(attributes).forEach(([attribute, value]) => {
            element.setAttribute(attribute, value);
        });

        return element;
    }

    function getNodePosition(path) {

        let x = 350;
        let offset = 175;

        for (const direction of path) {
            x += direction === "left" ? -offset : offset;
            offset /= 2;
        }

        return {
            x,
            y: 62 + path.length * 105
        };
    }

    function collectNodes(node, path = [], nodes = []) {

        if (!node) return nodes;

        nodes.push({ node, path, position: getNodePosition(path) });
        collectNodes(node.left, [...path, "left"], nodes);
        collectNodes(node.right, [...path, "right"], nodes);

        return nodes;
    }

    function render(options = {}) {

        const {
            pendingValue = null,
            comparingNode = null,
            direction = null,
            newNode = null
        } = options;

        stackDiv.innerHTML = "";
        stackDiv.classList.add("binary-search-tree-view");

        const status = document.createElement("p");
        status.className = "bst-status";
        status.textContent = pendingValue === null
            ? "The tree is empty. Insert the first value."
            : `Insert ${pendingValue}`;

        const svg = createSvgElement("svg", {
            class: "bst-canvas",
            viewBox: "0 0 700 310",
            role: "img",
            "aria-label": "Binary Search Tree visualization"
        });

        const nodes = collectNodes(root);
        const positions = new Map(nodes.map(item => [item.node, item.position]));

        nodes.forEach(({ node, position }) => {

            for (const child of [node.left, node.right]) {

                if (!child) continue;

                const childPosition = positions.get(child);
                const edge = createSvgElement("line", {
                    x1: position.x,
                    y1: position.y,
                    x2: childPosition.x,
                    y2: childPosition.y,
                    class: child === newNode ? "bst-edge bst-new-edge" : "bst-edge"
                });

                svg.appendChild(edge);

            }

        });

        if (direction && positions.has(direction.node)) {

            const parentPosition = positions.get(direction.node);
            const label = createSvgElement("text", {
                x: parentPosition.x + (direction.side === "left" ? -68 : 68),
                y: parentPosition.y + 48,
                class: "bst-direction"
            });

            label.textContent = direction.side === "left" ? "← LEFT" : "RIGHT →";
            svg.appendChild(label);

        }

        nodes.forEach(({ node, position }) => {

            const group = createSvgElement("g", {
                class: [
                    "bst-node",
                    node === comparingNode ? "bst-comparing" : "",
                    node === newNode ? "bst-new-node" : ""
                ].filter(Boolean).join(" ")
            });

            const circle = createSvgElement("circle", {
                cx: position.x,
                cy: position.y,
                r: 27,
                class: "bst-node-circle"
            });

            const text = createSvgElement("text", {
                x: position.x,
                y: position.y + 6,
                class: "bst-node-text",
                "text-anchor": "middle"
            });

            text.textContent = node.value;
            group.append(circle, text);
            svg.appendChild(group);

        });

        stackDiv.append(status, svg);

    }

    function completeInsertion(value, node) {

        render({ pendingValue: value, newNode: node });

        let operation = "follow-comparisons";

        if (nextValueIndex === 0) {
            operation = "insert-root";
        }
        else if (nextValueIndex === 1) {
            operation = "insert-smaller";
        }
        else if (nextValueIndex === 2) {
            operation = "insert-larger";
        }
        else if (nextValueIndex === insertionValues.length - 1) {
            operation = "build-tree";
        }

        const missionResult = completeAction(operation);

        nextValueIndex++;
        insertionBusy = false;

        if (!missionResult.complete) {
            setByteMessage(`${value} was inserted. Use INSERT to place the next value.`);
        }

    }

    function followInsertion(value, current) {

        render({ pendingValue: value, comparingNode: current });
        setByteMessage(`Compare ${value} with ${current.value}.`);

        setTimeout(() => {

            const side = value < current.value ? "left" : "right";

            render({
                pendingValue: value,
                comparingNode: current,
                direction: { node: current, side }
            });

            setByteMessage(`${value} is ${value < current.value ? "smaller" : "larger"} than ${current.value}, so move ${side.toUpperCase()}.`);

            setTimeout(() => {

                const child = current[side];

                if (!child) {
                    const node = createNode(value, current);
                    current[side] = node;
                    completeInsertion(value, node);
                    return;
                }

                followInsertion(value, child);

            }, 650);

        }, 650);

    }

    function insert() {

        if (insertionBusy) return;

        if (nextValueIndex === insertionValues.length) {

            root = null;
            nextValueIndex = 0;
            render();
            setByteMessage("Tree reset. Use INSERT to build the sequence again.");

            return;

        }

        insertionBusy = true;

        const value = insertionValues[nextValueIndex];

        if (!root) {

            root = createNode(value);

            setByteMessage(`${value} is the first value, so it becomes the root.`);

            setTimeout(() => completeInsertion(value, root), 650);

            return;

        }

        followInsertion(value, root);

    }

    return {
        mount() {
            getControl("insert").onclick = insert;
            render();
        },
        reset() {
            root = null;
            nextValueIndex = 0;
            insertionBusy = false;
            render();
        }
    };

}


registerPlayground("binary-search-tree", createBinarySearchTreePlayground);
