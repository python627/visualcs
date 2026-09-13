/* Pure paging domain model. All translation and assessment paths use this API. */
const PagingModel = (() => {
    const integer = value => Number.isSafeInteger(value) && value >= 0;

    function validate(config) {
        if (!config || !integer(config.pageSize) || config.pageSize === 0) {
            throw new Error("pageSize must be a positive safe integer.");
        }
        if (!Array.isArray(config.pageTable) || !config.pageTable.length) {
            throw new Error("pageTable must contain explicit page mappings.");
        }
        const pages = new Set();
        for (const entry of config.pageTable) {
            if (!entry || !integer(entry.page) || pages.has(entry.page)
                || typeof entry.present !== "boolean"
                || (entry.present && !integer(entry.frame))
                || (!entry.present && entry.frame != null && !integer(entry.frame))) {
                throw new Error("Invalid or duplicate page mapping.");
            }
            if (!Number.isSafeInteger((entry.page + 1) * config.pageSize)
                || (entry.present && !Number.isSafeInteger((entry.frame + 1) * config.pageSize))) {
                throw new Error("Page/frame address exceeds safe integer range.");
            }
            pages.add(entry.page);
        }
        if (config.logicalAddressSpace != null
            && (!integer(config.logicalAddressSpace) || config.logicalAddressSpace === 0)) {
            throw new Error("logicalAddressSpace must be a positive byte count.");
        }
        return config;
    }

    function translate(config) {
        validate(config);
        const { logicalAddress, pageSize, pageTable, logicalAddressSpace } = config;
        const result = { status: "INVALID_ADDRESS", logicalAddress, pageSize,
            pageNumber: null, offset: null, frameNumber: null, physicalAddress: null };
        if (!integer(logicalAddress) || (logicalAddressSpace != null && logicalAddress >= logicalAddressSpace)) {
            return result;
        }
        result.pageNumber = Math.floor(logicalAddress / pageSize);
        result.offset = logicalAddress % pageSize;
        const entry = pageTable.find(row => row.page === result.pageNumber);
        // An absent mapping is outside this model's allocated logical pages.
        // An explicit nonresident mapping is a page fault, not an invalid address.
        if (!entry) return result;
        if (!entry.present) return { ...result, status: "PAGE_FAULT" };
        return { ...result, status: "TRANSLATED", frameNumber: entry.frame,
            physicalAddress: entry.frame * pageSize + result.offset };
    }

    const labels = { page: "Page", offset: "Offset", frame: "Frame", physicalAddress: "Physical address" };
    function numeric(value) {
        if (typeof value === "number") return integer(value) ? value : NaN;
        return typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
    }

    function assess(config, response, fields = Object.keys(labels)) {
        const result = translate(config);
        const expected = { page: result.pageNumber, offset: result.offset,
            frame: result.frameNumber, physicalAddress: result.physicalAddress };
        const assessment = fields.map(key => {
            if (!Object.hasOwn(labels, key)) throw new Error(`Unknown paging field: ${key}`);
            const actual = response?.[key];
            const answer = expected[key] === null ? result.status : expected[key];
            const correct = expected[key] === null
                ? String(actual).trim().toUpperCase().replaceAll(" ", "_") === result.status
                : numeric(actual) === expected[key];
            return { key, label: labels[key], submitted: actual ?? "", expected: answer, correct };
        });
        return { allCorrect: assessment.every(field => field.correct), fields: assessment,
            result, feedback: explain(config, result) };
    }

    function explain(config, result = translate(config)) {
        if (result.status === "INVALID_ADDRESS") {
            return `Address ${config.logicalAddress} is outside the configured logical address space or has no allocated page mapping. This is not a nonresident page.`;
        }
        const division = `${config.logicalAddress} = ${result.pageNumber} × ${config.pageSize} + ${result.offset}.`;
        if (result.status === "PAGE_FAULT") {
            return `${division} Page ${result.pageNumber} is allocated but not present in RAM: PAGE FAULT. There is no physical address until the page is loaded.`;
        }
        return `${division} Page ${result.pageNumber} maps to frame ${result.frameNumber}. ${result.frameNumber} × ${config.pageSize} + ${result.offset} = ${result.physicalAddress}. The offset stays the same.`;
    }

    // A session enforces reasoning order, even when a caller invokes the final
    // operation directly. Only an accepted final answer yields a solved outcome.
    function createSession(config) {
        const problem = JSON.parse(JSON.stringify(validate(config)));
        const fields = Object.keys(labels);
        let index = 0;
        const answers = {};
        return {
            get field() { return fields[index] || null; },
            get answers() { return { ...answers }; },
            submit(field, value) {
                if (field !== fields[index]) return { accepted: false, reason: "out_of_order", outcome: null };
                const assessment = assess(problem, { [field]: value }, [field]);
                if (!assessment.allCorrect) return { accepted: false, assessment, outcome: null };
                answers[field] = value;
                index++;
                return { accepted: true, assessment, outcome: index === fields.length ? "solved" : null };
            }
        };
    }
    return { validate, translate, assess, explain, createSession };
})();
