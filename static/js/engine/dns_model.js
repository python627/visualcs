/* Bounded executable DNS model: name resolution only, never HTTP fetching. */
const DnsModel = (() => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

    function validateProblem(problem) {
        if (!problem || !Array.isArray(problem.records) || !problem.records.length || !problem.query || typeof problem.query.domain !== "string") {
            throw new Error("A DNS problem needs records and a query domain.");
        }
        const domains = new Set();
        problem.records.forEach(record => {
            if (!record || !domainPattern.test(record.domain) || !IPv4Address.isValid(record.ip) || typeof record.serverId !== "string" || !record.serverId) {
                throw new Error("Every DNS record needs a valid domain, IPv4 address, and server id.");
            }
            if (domains.has(record.domain.toLowerCase())) throw new Error("DNS record domains must be unique.");
            domains.add(record.domain.toLowerCase());
        });
        if (!domainPattern.test(problem.query.domain)) throw new Error("The query domain is invalid.");
        const cache = problem.cache || {};
        Object.entries(cache).forEach(([domain, ip]) => {
            if (!domainPattern.test(domain) || !IPv4Address.isValid(ip)) throw new Error("DNS cache entries must contain valid domains and IPv4 addresses.");
        });
        return true;
    }

    function resolve(problem) {
        validateProblem(problem);
        const domain = problem.query.domain.toLowerCase();
        const cache = clone(problem.cache || {});
        const cachedKey = Object.keys(cache).find(key => key.toLowerCase() === domain);
        const record = problem.records.find(item => item.domain.toLowerCase() === domain) || null;
        if (cachedKey) {
            const ip = IPv4Address.normalize(cache[cachedKey]);
            const destination = problem.records.find(item => IPv4Address.normalize(item.ip) === ip) || record;
            return { domain, cacheResult: "hit", found: true, resolvedIp: ip, destinationServerId: destination?.serverId || "UNKNOWN",
                sequence: ["CHECK_CACHE", "CACHE_HIT", "RESOLVED"], cacheAfter: cache,
                explanation: "The cached address was returned without asking the DNS records again. DNS resolved the name; it did not fetch a webpage." };
        }
        if (!record) {
            return { domain, cacheResult: "miss", found: false, resolvedIp: "NOT_FOUND", destinationServerId: "NONE",
                sequence: ["CHECK_CACHE", "CACHE_MISS", "DNS_QUERY", "NOT_FOUND"], cacheAfter: cache,
                explanation: "The name was not cached and no DNS record existed. No webpage request was performed." };
        }
        cache[record.domain] = record.ip;
        return { domain, cacheResult: "miss", found: true, resolvedIp: IPv4Address.normalize(record.ip), destinationServerId: record.serverId,
            sequence: ["CHECK_CACHE", "CACHE_MISS", "DNS_QUERY", "DNS_RESPONSE", "CACHE_UPDATE", "RESOLVED"], cacheAfter: cache,
            explanation: "DNS returned the record's IP address and the client cached it. Fetching content would be a later HTTP step." };
    }

    const list = value => Array.isArray(value) ? value.map(String) : String(value ?? "").split(",").map(item => item.trim()).filter(Boolean);
    const field = (label, submitted, expected, correct = submitted === expected) => ({ label, submitted, expected, correct });
    function assess(problem, response = {}) {
        const result = resolve(problem);
        const submittedIp = String(response.resolvedIp || "").trim().toUpperCase() === "NOT_FOUND" ? "NOT_FOUND" : IPv4Address.normalize(String(response.resolvedIp || ""));
        const submittedSequence = list(response.sequence).map(item => item.toUpperCase().replaceAll(" ", "_"));
        const fields = [
            field("Cache result", String(response.cacheResult || "").trim().toLowerCase(), result.cacheResult),
            field("Resolved IP", submittedIp, result.resolvedIp),
            field("Destination server", String(response.destinationServerId || "").trim(), result.destinationServerId),
            field("Resolution sequence", submittedSequence.join(", "), result.sequence.join(", "), JSON.stringify(submittedSequence) === JSON.stringify(result.sequence))
        ];
        return { allCorrect: fields.every(item => item.correct), fields, actualResult: clone(result), feedback: result.explanation };
    }

    function createReplay(problem) {
        const result = resolve(problem);
        let cursor = 0;
        return {
            next() { const event = result.sequence[cursor] || null; if (event) cursor++; return { event, done: cursor >= result.sequence.length, cursor, result: clone(result) }; },
            getCursor: () => cursor,
            getLength: () => result.sequence.length,
            getResult: () => clone(result),
            reset() { cursor = 0; }
        };
    }

    return { validateProblem, resolve, assess, createReplay };
})();
