/* Deterministic educational transport simulation. Browser timing never defines truth. */
const TransportSimulator = (() => {
    const PROTOCOLS = ["TCP", "UDP"];
    const clone = value => JSON.parse(JSON.stringify(value));

    function validateProblem(problem) {
        if (!problem || typeof problem !== "object") throw new Error("Transport problem must be an object.");
        const requirements = problem.requirements;
        if (!requirements || typeof requirements !== "object"
            || typeof requirements.orderedDelivery !== "boolean"
            || typeof requirements.lossRepair !== "boolean") {
            throw new Error("Transport requirements need orderedDelivery and lossRepair booleans.");
        }
        if (!problem.application || typeof problem.application.title !== "string"
            || typeof problem.application.need !== "string") {
            throw new Error("Transport problem needs an application title and delivery need.");
        }
        if (!Array.isArray(problem.packets) || problem.packets.length < 2 || problem.packets.length > 8) {
            throw new Error("Transport problem needs between 2 and 8 packets.");
        }
        const ids = new Set();
        const sequences = new Set();
        problem.packets.forEach((packet, index) => {
            if (!packet || typeof packet.id !== "string" || !packet.id
                || !Number.isInteger(packet.sequence) || packet.sequence !== index + 1
                || typeof packet.payload !== "string" || !packet.payload
                || typeof packet.sender !== "string" || typeof packet.receiver !== "string") {
                throw new Error(`Transport packet ${index + 1} is invalid.`);
            }
            if (ids.has(packet.id) || sequences.has(packet.sequence)) {
                throw new Error("Transport packet IDs and sequence numbers must be unique.");
            }
            ids.add(packet.id);
            sequences.add(packet.sequence);
        });
        const network = problem.network;
        if (!network || !Array.isArray(network.conditions)
            || network.conditions.length !== problem.packets.length) {
            throw new Error("Network conditions must describe every packet.");
        }
        const conditionSequences = new Set();
        network.conditions.forEach(condition => {
            if (!condition || !sequences.has(condition.sequence)
                || conditionSequences.has(condition.sequence)
                || !["deliver", "loss"].includes(condition.firstTransmission)
                || !Number.isInteger(condition.delay) || condition.delay < 1) {
                throw new Error("A network condition is invalid.");
            }
            conditionSequences.add(condition.sequence);
        });
        for (const field of ["sendSpacing", "timeout", "retransmissionDelay", "ackDelay"]) {
            if (!Number.isInteger(network[field]) || network[field] < 0) {
                throw new Error(`Network ${field} must be a non-negative integer.`);
            }
        }
        if (network.timeout < 1 || network.retransmissionDelay < 1) {
            throw new Error("Timeout and retransmission delay must be positive.");
        }
        if (problem.knownProtocol !== undefined && !PROTOCOLS.includes(problem.knownProtocol)) {
            throw new Error("knownProtocol must be TCP or UDP.");
        }
        return problem;
    }

    function recommendProtocol(problem) {
        validateProblem(problem);
        return problem.requirements.orderedDelivery || problem.requirements.lossRepair ? "TCP" : "UDP";
    }

    function simulate(problem, requestedProtocol) {
        validateProblem(problem);
        const protocol = String(requestedProtocol || problem.knownProtocol || "").toUpperCase();
        if (!PROTOCOLS.includes(protocol)) throw new Error("Choose TCP or UDP before simulating.");

        const packets = new Map(problem.packets.map(packet => [packet.sequence, packet]));
        const conditions = new Map(problem.network.conditions.map(item => [item.sequence, item]));
        const queue = [];
        const events = [];
        let ordinal = 0;
        const schedule = event => queue.push({ ...event, ordinal: ordinal++ });
        const record = event => events.push({
            time: event.time,
            type: event.type,
            packetId: event.sequence ? packets.get(event.sequence)?.id || null : null,
            sequence: event.sequence ?? null,
            attempt: event.attempt ?? null,
            detail: event.detail || ""
        });
        const attempts = new Map();
        const acknowledged = new Set();
        const received = new Set();
        const buffered = new Set();
        const receiverOrder = [];
        const applicationOrder = [];
        const lost = new Set();
        const retransmitted = new Set();
        let nextExpected = 1;

        problem.packets.forEach((packet, index) => schedule({
            time: index * problem.network.sendSpacing,
            type: "SEND",
            sequence: packet.sequence,
            attempt: 1
        }));

        const deliverToApplication = (sequence, time, fromBuffer = false) => {
            applicationOrder.push(sequence);
            record({ time, type: "DELIVER_TO_APP", sequence,
                detail: fromBuffer ? "Released from the receiver buffer in sequence order." : "Delivered to the application." });
        };

        while (queue.length) {
            queue.sort((left, right) => left.time - right.time || left.ordinal - right.ordinal);
            const event = queue.shift();
            const sequence = event.sequence;

            if (event.type === "SEND") {
                attempts.set(sequence, event.attempt);
                record({ ...event, detail: event.attempt > 1 ? "Segment sent again." : "Packet entered the network." });
                const condition = conditions.get(sequence);
                const firstIsLost = event.attempt === 1 && condition.firstTransmission === "loss";
                schedule({
                    time: event.time + (event.attempt === 1 ? condition.delay : problem.network.retransmissionDelay),
                    type: firstIsLost ? "DROP" : "ARRIVE",
                    sequence,
                    attempt: event.attempt
                });
                if (protocol === "TCP") schedule({
                    time: event.time + problem.network.timeout,
                    type: "TIMEOUT",
                    sequence,
                    attempt: event.attempt
                });
                continue;
            }

            if (event.type === "DROP") {
                lost.add(sequence);
                record({ ...event, detail: "The simulated network lost this transmission." });
                continue;
            }

            if (event.type === "ARRIVE") {
                record({ ...event, detail: "The packet reached the transport receiver." });
                if (!received.has(sequence)) {
                    received.add(sequence);
                    receiverOrder.push(sequence);
                }
                if (protocol === "UDP") {
                    deliverToApplication(sequence, event.time);
                    continue;
                }

                record({ time: event.time, type: "ACK_SEND", sequence,
                    detail: `Receiver acknowledged segment ${sequence}.` });
                schedule({ time: event.time + problem.network.ackDelay, type: "ACK_ARRIVE", sequence });
                if (sequence > nextExpected) {
                    if (!buffered.has(sequence)) {
                        buffered.add(sequence);
                        record({ time: event.time, type: "BUFFER", sequence,
                            detail: `Waiting for missing sequence ${nextExpected}.` });
                    }
                    continue;
                }
                if (sequence < nextExpected) continue;

                deliverToApplication(sequence, event.time);
                nextExpected++;
                while (buffered.has(nextExpected)) {
                    buffered.delete(nextExpected);
                    deliverToApplication(nextExpected, event.time, true);
                    nextExpected++;
                }
                continue;
            }

            if (event.type === "ACK_ARRIVE") {
                acknowledged.add(sequence);
                record({ ...event, detail: `Sender received ACK ${sequence}.` });
                continue;
            }

            if (event.type === "TIMEOUT") {
                if (acknowledged.has(sequence) || attempts.get(sequence) !== event.attempt) continue;
                record({ ...event, detail: `No ACK arrived for segment ${sequence} before the timeout.` });
                schedule({ time: event.time, type: "RETRANSMIT", sequence, attempt: event.attempt + 1 });
                continue;
            }

            if (event.type === "RETRANSMIT") {
                retransmitted.add(sequence);
                record({ ...event, detail: `TCP retransmits missing segment ${sequence}.` });
                schedule({ ...event, type: "SEND" });
            }
        }

        const packetIds = values => values.map(sequence => packets.get(sequence).id);
        const lostPackets = packetIds([...lost]);
        const retransmittedPackets = packetIds([...retransmitted]);
        const applicationPackets = packetIds(applicationOrder);
        const result = {
            protocol,
            events,
            receiverPackets: packetIds(receiverOrder),
            applicationOrder: applicationPackets,
            lostPackets,
            retransmittedPackets,
            acknowledgedPackets: packetIds([...acknowledged].sort((a, b) => a - b)),
            repairsLoss: lostPackets.length > 0
                && lostPackets.every(id => retransmittedPackets.includes(id) && applicationPackets.includes(id))
        };
        return result;
    }

    function parseList(value) {
        if (Array.isArray(value)) return value.map(item => String(item).trim().toUpperCase()).filter(Boolean);
        const text = String(value ?? "").trim();
        if (!text || text.toUpperCase() === "NONE") return [];
        return text.split(",").map(item => item.trim().toUpperCase()).filter(Boolean);
    }

    function parseBoolean(value) {
        if (typeof value === "boolean") return value;
        const text = String(value ?? "").trim().toLowerCase();
        if (["yes", "true", "repair", "repaired"].includes(text)) return true;
        if (["no", "false", "not repaired", "none"].includes(text)) return false;
        return null;
    }

    function sameOrdered(left, right) {
        return left.length === right.length && left.every((item, index) => item === right[index]);
    }

    function sameSet(left, right) {
        return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
    }

    function explain(problem, result, assessment = null) {
        const loss = result.lostPackets.length ? `${result.lostPackets.join(", ")} was lost on its first transmission.` : "No first transmission was lost.";
        const behavior = result.protocol === "UDP"
            ? "UDP delivered surviving datagrams without transport-level retransmission."
            : result.lostPackets.length
                ? `TCP detected missing data by timeout, retransmitted ${result.retransmittedPackets.join(", ")}, and released application data in order.`
                : "TCP acknowledged the segments and delivered application data in sequence order.";
        const choice = assessment && !assessment.protocolCorrect
            ? ` The application requirements point to ${recommendProtocol(problem)}, not ${result.protocol}.`
            : "";
        return `${loss} ${behavior}${choice}`;
    }

    function assess(problem, response) {
        validateProblem(problem);
        const protocol = problem.knownProtocol || String(response?.protocol || "").trim().toUpperCase();
        const actualResult = simulate(problem, protocol);
        const expectedProtocol = recommendProtocol(problem);
        const receiver = parseList(response?.receiverPackets);
        const application = parseList(response?.applicationOrder);
        const retransmitted = parseList(response?.retransmittedPackets);
        const repaired = parseBoolean(response?.repairsLoss);
        const fields = [];
        const protocolCorrect = protocol === expectedProtocol;
        if (!problem.knownProtocol) fields.push({
            label: "Protocol choice", submitted: protocol || "Not chosen", expected: expectedProtocol, correct: protocolCorrect
        });
        fields.push(
            { label: "Transport arrival order", submitted: receiver.join(", ") || "NONE",
                expected: actualResult.receiverPackets.join(", ") || "NONE", correct: sameOrdered(receiver, actualResult.receiverPackets) },
            { label: "Application delivery order", submitted: application.join(", ") || "NONE",
                expected: actualResult.applicationOrder.join(", ") || "NONE", correct: sameOrdered(application, actualResult.applicationOrder) },
            { label: "Retransmitted packets", submitted: retransmitted.join(", ") || "NONE",
                expected: actualResult.retransmittedPackets.join(", ") || "NONE", correct: sameSet(retransmitted, actualResult.retransmittedPackets) },
            { label: "Transport repairs the loss", submitted: repaired === null ? "Not answered" : repaired ? "YES" : "NO",
                expected: actualResult.repairsLoss ? "YES" : "NO", correct: repaired === actualResult.repairsLoss }
        );
        const allCorrect = protocolCorrect && fields.every(field => field.correct);
        const assessment = { allCorrect, protocolCorrect, fields, actualResult };
        assessment.feedback = explain(problem, actualResult, assessment);
        return assessment;
    }

    function createReplay(problem, protocol) {
        const result = simulate(problem, protocol);
        let cursor = 0;
        let state;
        const blank = () => ({
            time: 0,
            packetStatus: Object.fromEntries(problem.packets.map(packet => [packet.id, "waiting"])),
            receiverPackets: [],
            bufferedPackets: [],
            applicationOrder: [],
            acknowledgements: [],
            currentEvent: null
        });
        const apply = event => {
            state.time = event.time;
            state.currentEvent = clone(event);
            const id = event.packetId;
            if (event.type === "SEND") state.packetStatus[id] = event.attempt > 1 ? "retransmitted" : "in-network";
            if (event.type === "DROP") state.packetStatus[id] = "lost";
            if (event.type === "ARRIVE") {
                state.packetStatus[id] = "received";
                if (!state.receiverPackets.includes(id)) state.receiverPackets.push(id);
            }
            if (event.type === "BUFFER") {
                state.packetStatus[id] = "buffered";
                if (!state.bufferedPackets.includes(id)) state.bufferedPackets.push(id);
            }
            if (event.type === "DELIVER_TO_APP") {
                state.packetStatus[id] = "delivered";
                state.bufferedPackets = state.bufferedPackets.filter(item => item !== id);
                if (!state.applicationOrder.includes(id)) state.applicationOrder.push(id);
            }
            if (event.type === "ACK_ARRIVE" && !state.acknowledgements.includes(id)) state.acknowledgements.push(id);
            if (event.type === "TIMEOUT") state.packetStatus[id] = "timeout";
            if (event.type === "RETRANSMIT") state.packetStatus[id] = "retransmitted";
        };
        const reset = () => { cursor = 0; state = blank(); return clone(state); };
        reset();
        return {
            next() {
                if (cursor >= result.events.length) return { done: true, event: null, state: clone(state), result: clone(result) };
                const event = result.events[cursor++];
                apply(event);
                return { done: cursor >= result.events.length, event: clone(event), state: clone(state), result: clone(result) };
            },
            reset,
            getState: () => clone(state),
            getResult: () => clone(result),
            getCursor: () => cursor,
            getLength: () => result.events.length
        };
    }

    return { protocols: [...PROTOCOLS], validateProblem, recommendProtocol, simulate, assess, explain, createReplay };
})();
