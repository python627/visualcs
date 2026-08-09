function createPlayground(type) {

    switch (type) {

        case "stack":
            return createStackPlayground();

        case "queue":
            return createQueuePlayground();

        case "linked-list":
            return createLinkedListPlayground();

        default:
            console.error(
                `Unknown playground type: ${type}`
            );

            return null;
    }
}
