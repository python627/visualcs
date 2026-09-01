class LessonCapabilities {

    constructor(capabilities = []) {
        this.values = new Set(
            Array.isArray(capabilities)
                ? capabilities.filter(capability => typeof capability === "string")
                : []
        );
    }


    supports(capability) {
        return this.values.has(capability);
    }


    supportsAll(capabilities = []) {
        return Array.isArray(capabilities)
            && capabilities.every(capability => this.supports(capability));
    }


    list() {
        return [...this.values];
    }

}


const lessonCapabilities = new LessonCapabilities(LESSON.capabilities);
