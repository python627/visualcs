/* Seeded problem construction. Arithmetic and answers live only in PagingModel. */
const PagingGenerator = {
    version: 1,
    generate({ random, rules = {} }) {
        const sizes = rules.pageSizes || [64, 256, 1024];
        const count = rules.pageCount || 4;
        const rate = rules.faultRate ?? 0;
        if (!Array.isArray(sizes) || !sizes.length || !sizes.every(n => Number.isSafeInteger(n) && n > 0)
            || !Number.isInteger(count) || count < 2 || count > 16 || rate < 0 || rate > 1) {
            throw new Error("Invalid paging generation rules.");
        }
        const pick = values => values[Math.floor(random() * values.length)];
        const pageSize = pick(sizes);
        const frames = Array.from({ length: count * 2 }, (_, i) => i);
        for (let i = frames.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [frames[i], frames[j]] = [frames[j], frames[i]];
        }
        const pageTable = Array.from({ length: count }, (_, page) => ({ page, frame: frames[page], present: true }));
        const selectedPage = Math.floor(random() * count);
        if (random() < rate) pageTable[selectedPage] = { page: selectedPage, frame: null, present: false };
        const problem = { pageSize, logicalAddress: selectedPage * pageSize + Math.floor(random() * pageSize),
            logicalAddressSpace: count * pageSize, pageTable };
        const data = { problem, oracle: PagingModel.translate(problem) };
        this.validateScenario(data);
        return data;
    },
    validateScenario(data) {
        const result = PagingModel.translate(data.problem);
        if (result.status === "INVALID_ADDRESS" || Object.keys(result).some(key => result[key] !== data.oracle?.[key])) {
            throw new Error("Generated paging oracle does not match its problem.");
        }
    },
    getMentalSimulation(data) {
        this.validateScenario(data);
        // Public presentation has inputs only. No oracle, target, or computed result.
        return { initial_state: JSON.parse(JSON.stringify(data.problem)), steps: [
            { operation: "page", label: "Determine the logical page number." },
            { operation: "offset", label: "Determine the offset inside that page." },
            { operation: "frame", label: "Inspect the matching page-table entry and its presence bit." },
            { operation: "physicalAddress", label: "Predict the physical address, or PAGE_FAULT if not present." }
        ] };
    },
    evaluatePrediction(data, response) { return PagingModel.assess(data.problem, response); },
    createExecutionChallenge() { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] }; }
};
registerScenarioGenerator("paging", PagingGenerator);
