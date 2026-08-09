const playgroundRegistry = new Map();


function registerPlayground(type, factory) {

    if (playgroundRegistry.has(type)) {
        throw new Error(`A playground is already registered for "${type}".`);
    }

    playgroundRegistry.set(type, factory);

}


function createPlayground(type) {

    const factory = playgroundRegistry.get(type);

    if (!factory) {
        throw new Error(`Unknown playground type: "${type}".`);
    }

    return factory();

}
