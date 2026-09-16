/* Executable beginner IPv4 validation and endpoint reasoning model. */
const IPv4Address = (() => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const kinds = Object.freeze(["validate-address", "construct-address", "identify-endpoints", "route-packet"]);

    function parse(address) {
        if (typeof address !== "string") return { valid: false, octets: [], error: "An IPv4 address must be text." };
        const parts = address.split(".");
        if (parts.length !== 4) return { valid: false, octets: [], error: "IPv4 needs exactly four octets." };
        if (parts.some(part => !/^\d+$/.test(part))) return { valid: false, octets: [], error: "Every octet must contain digits only." };
        const octets = parts.map(Number);
        if (octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
            return { valid: false, octets, error: "Every octet must be between 0 and 255." };
        }
        return { valid: true, octets, normalized: octets.join("."), error: "" };
    }

    function isValid(address) { return parse(address).valid; }
    function normalize(address) { const result = parse(address); return result.valid ? result.normalized : null; }

    function validateProblem(problem) {
        if (!problem || !Array.isArray(problem.devices) || problem.devices.length < 2 || !problem.task || !kinds.includes(problem.task.kind)) {
            throw new Error("An IPv4 problem needs devices and a supported task.");
        }
        const ids = new Set();
        const addresses = new Set();
        problem.devices.forEach(device => {
            if (!device || typeof device.id !== "string" || !device.id || typeof device.name !== "string" || !device.name || !isValid(device.address)) {
                throw new Error("Every device needs an id, name, and valid IPv4 address.");
            }
            if (ids.has(device.id) || addresses.has(normalize(device.address))) throw new Error("Device ids and addresses must be unique.");
            ids.add(device.id); addresses.add(normalize(device.address));
        });
        if (["identify-endpoints", "route-packet"].includes(problem.task.kind)) {
            if (!problem.packet || !ids.has(problem.packet.sourceDeviceId) || !isValid(problem.packet.destinationAddress)) {
                throw new Error("Packet tasks need a known source and valid destination address.");
            }
        }
        if (problem.task.kind === "validate-address" && typeof problem.task.candidate !== "string") throw new Error("Validation tasks need a candidate address.");
        if (problem.task.kind === "construct-address" && (!Array.isArray(problem.task.octets) || problem.task.octets.length !== 4)) {
            throw new Error("Construction tasks need four octets.");
        }
        return true;
    }

    function deviceForAddress(devices, address) {
        const target = normalize(address);
        return devices.find(device => normalize(device.address) === target) || null;
    }

    function execute(problem) {
        validateProblem(problem);
        const task = problem.task;
        if (task.kind === "validate-address") {
            const parsed = parse(task.candidate);
            return { kind: task.kind, valid: parsed.valid, normalized: parsed.normalized || null, explanation: parsed.valid ? "The address has four octets in the 0–255 range." : parsed.error };
        }
        if (task.kind === "construct-address") {
            const address = task.octets.join(".");
            const parsed = parse(address);
            return { kind: task.kind, valid: parsed.valid, address: parsed.normalized || address, explanation: parsed.valid ? "The four valid octets form an IPv4 address." : parsed.error };
        }
        const source = problem.devices.find(device => device.id === problem.packet.sourceDeviceId);
        const destination = deviceForAddress(problem.devices, problem.packet.destinationAddress);
        if (task.kind === "identify-endpoints") {
            return { kind: task.kind, sourceAddress: normalize(source.address), destinationAddress: normalize(problem.packet.destinationAddress), destinationDeviceId: destination?.id || "NONE",
                explanation: "The source identifies the sender; the destination identifies the intended endpoint." };
        }
        return { kind: task.kind, destinationDeviceId: destination?.id || "NONE", destinationAddress: normalize(problem.packet.destinationAddress),
            explanation: destination ? `${problem.packet.destinationAddress} belongs to ${destination.name}.` : "No displayed device owns that destination address." };
    }

    function bool(value) {
        if (value === true || String(value).toLowerCase() === "valid") return true;
        if (value === false || String(value).toLowerCase() === "invalid") return false;
        return null;
    }
    const field = (label, submitted, expected) => ({ label, submitted, expected, correct: submitted === expected });

    function assess(problem, response = {}) {
        const result = execute(problem);
        const fields = [];
        if (result.kind === "validate-address") fields.push(field("Address validity", bool(response.validity), result.valid));
        else if (result.kind === "construct-address") fields.push(field("Constructed address", normalize(String(response.address || "")), result.address));
        else if (result.kind === "identify-endpoints") {
            fields.push(field("Source address", normalize(String(response.sourceAddress || "")), result.sourceAddress));
            fields.push(field("Destination address", normalize(String(response.destinationAddress || "")), result.destinationAddress));
        }
        else fields.push(field("Destination device", String(response.destinationDeviceId || "").trim(), result.destinationDeviceId));
        return { allCorrect: fields.every(item => item.correct), fields, actualResult: clone(result), feedback: result.explanation };
    }

    return { kinds, parse, isValid, normalize, validateProblem, deviceForAddress, execute, assess };
})();
