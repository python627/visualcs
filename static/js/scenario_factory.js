const scenarioGeneratorRegistry = new Map();


function registerScenarioGenerator(id, generator) {

    if (typeof id !== "string" || !id) {
        throw new Error("Scenario generators need a non-empty id.");
    }

    if (!generator || typeof generator.generate !== "function") {
        throw new Error(`Scenario generator "${id}" must provide generate().`);
    }

    if (scenarioGeneratorRegistry.has(id)) {
        throw new Error(`A scenario generator is already registered for "${id}".`);
    }

    scenarioGeneratorRegistry.set(id, generator);

}


function hashScenarioText(value) {

    let hash = 2166136261;

    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;

}


function stableScenarioText(value) {

    if (Array.isArray(value)) {
        return `[${value.map(item => stableScenarioText(item)).join(",")}]`;
    }

    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map(
            key => `${JSON.stringify(key)}:${stableScenarioText(value[key])}`
        ).join(",")}}`;
    }

    return JSON.stringify(value);

}


function normalizeScenarioSeed(seed) {

    if (Number.isInteger(seed)) {
        return seed >>> 0;
    }

    if (typeof seed === "string" && seed) {
        return hashScenarioText(seed);
    }

    throw new Error("A scenario seed must be an integer or non-empty string.");

}


function createSeededRandom(seed) {

    let state = normalizeScenarioSeed(seed) || 0x6d2b79f5;

    return () => {
        state += 0x6d2b79f5;

        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };

}


function createScenarioSeed() {

    if (window.crypto?.getRandomValues) {
        const values = new Uint32Array(1);
        window.crypto.getRandomValues(values);
        return values[0] || 1;
    }

    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

}


class ScenarioFactory {

    static getGenerator(id) {
        return scenarioGeneratorRegistry.get(id) || null;
    }


    static create(config, { seed } = {}) {

        const generatorId = config?.generator;
        const generator = this.getGenerator(generatorId);

        if (!generator) {
            throw new Error(`Unknown scenario generator: "${generatorId}".`);
        }

        const generatorVersion = Number.isInteger(config.generator_version)
            ? config.generator_version
            : generator.version;

        if (!Number.isInteger(generatorVersion) || generatorVersion < 1) {
            throw new Error(`Scenario generator "${generatorId}" needs a version.`);
        }

        if (generator.version !== generatorVersion) {
            throw new Error(
                `Scenario generator "${generatorId}" version ${generatorVersion} is unavailable.`
            );
        }

        const normalizedSeed = normalizeScenarioSeed(seed ?? createScenarioSeed());
        const data = generator.generate({
            seed: normalizedSeed,
            random: createSeededRandom(normalizedSeed),
            rules: config.scenario_rules || {}
        });

        if (!data || typeof data !== "object") {
            throw new Error(`Scenario generator "${generatorId}" did not return scenario data.`);
        }

        const fingerprint = hashScenarioText(stableScenarioText(data)).toString(36);

        return {
            id: `${generatorId}:${generatorVersion}:${normalizedSeed}:${fingerprint}`,
            generator: generatorId,
            generatorVersion,
            seed: normalizedSeed,
            fingerprint,
            data
        };

    }


    static createNew(config, { previousFingerprint = null } = {}) {

        for (let attempt = 0; attempt < 16; attempt++) {
            const scenario = this.create(config);

            if (!previousFingerprint || scenario.fingerprint !== previousFingerprint) {
                return scenario;
            }
        }

        throw new Error("Could not generate a distinct Expert scenario. Try again.");

    }


    static recreate(config, storedScenario) {

        if (!storedScenario || typeof storedScenario !== "object") {
            return null;
        }

        if (
            storedScenario.generator !== config?.generator
            || storedScenario.generatorVersion !== config?.generator_version
        ) {
            return null;
        }

        const scenario = this.create(config, { seed: storedScenario.seed });

        return scenario.fingerprint === storedScenario.fingerprint
            ? scenario
            : null;

    }
}
