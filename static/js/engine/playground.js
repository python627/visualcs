function createPlayground(type) {

    switch (type) {

        case "stack":
            return {
                type: "stack",
                addAction: "PUSH",
                removeAction: "POP"
            };

        case "queue":
            return {
                type: "queue",
                addAction: "ENQUEUE",
                removeAction: "DEQUEUE"
            };

        default:

            console.error(
                `Unknown playground type: ${type}`
            );

            return null;
    }
}