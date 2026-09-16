/* Seeded DNS scenarios with cache hits, misses, and bounded not-found cases. */
const DnsGenerator = {
    version: 1,
    generate({ random, rules = {} }) {
        const pick = values => values[Math.floor(random() * values.length)];
        const count = pick(rules.recordCounts || [3, 4, 5]);
        const names = ["learn.example", "media.example", "api.example", "shop.example", "status.example", "docs.example", "games.example", "mail.example"];
        const base = 20 + Math.floor(random() * 180);
        const records = Array.from({ length: count }, (_, index) => ({ domain: names[index], ip: `203.0.${base}.${10 + index}`, serverId: `server-${index + 1}` }));
        const missing = random() < (rules.missingRate ?? 0.1);
        const record = pick(records);
        const domain = missing ? `missing-${Math.floor(random() * 900 + 100)}.example` : record.domain;
        const cacheHit = !missing && random() < (rules.cacheHitRate ?? 0.5);
        const cache = {};
        if (cacheHit) cache[record.domain] = record.ip;
        if (rules.decoyCache !== false) {
            const decoy = records.find(item => item.domain !== domain);
            if (decoy) cache[decoy.domain] = decoy.ip;
        }
        const data = { problem: { records, cache, query: { domain } } };
        this.validateScenario(data);
        return data;
    },
    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "resolvedIp") || Object.hasOwn(data, "sequence")) {
            throw new Error("DNS scenarios must expose records, cache, and query inputs only.");
        }
        DnsModel.resolve(data.problem);
    },
    getMentalSimulation(data) {
        this.validateScenario(data);
        return { initial_state: JSON.parse(JSON.stringify(data.problem)), steps: [
            { operation: "check-cache", label: "Check the client cache for the exact domain." },
            { operation: "query-dns", label: "On a miss, ask DNS for the domain's address." },
            { operation: "resolve", label: "Use the returned IP to identify the destination server." }
        ] };
    },
    evaluatePrediction(data, response) { this.validateScenario(data); return DnsModel.assess(data.problem, response); },
    createExecutionChallenge() { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] }; }
};
registerScenarioGenerator("dns", DnsGenerator);
