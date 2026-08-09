class LinkedListNode {

    constructor(value) {

        this.value = value;

        this.next = null;

    }

}


class LinkedList {

    constructor() {

        this.head = null;

        this.length = 0;

    }


    add(value) {

        const newNode =
            new LinkedListNode(value);


        if (this.head === null) {

            this.head = newNode;

        }

        else {

            let current = this.head;


            while (current.next !== null) {

                current = current.next;

            }


            current.next = newNode;

        }


        this.length++;

    }


    remove() {

        if (this.head === null) {

            return null;

        }


        const removed =
            this.head;


        this.head =
            this.head.next;


        this.length--;


        return removed.value;

    }


    getValues() {

        const values = [];

        let current = this.head;


        while (current !== null) {

            values.push(current.value);

            current = current.next;

        }


        return values;

    }


    isEmpty() {

        return this.head === null;

    }


    clear() {

        this.head = null;

        this.length = 0;

    }

}