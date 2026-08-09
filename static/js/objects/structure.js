class StackStructure {

    constructor() {
        this.items = [];
    }

    add(value) {
        this.items.push(value);
    }

    remove() {
        return this.items.pop();
    }

    getItems() {
        return [...this.items];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    clear() {
        this.items = [];
    }
}


class QueueStructure {

    constructor() {
        this.items = [];
    }

    add(value) {
        this.items.push(value);
    }

    remove() {
        return this.items.shift();
    }

    getItems() {
        return [...this.items];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    clear() {
        this.items = [];
    }
}


function createStructure(type) {

    if (type === "queue") {
        return new QueueStructure();
    }

    return new StackStructure();
}