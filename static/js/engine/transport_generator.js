/* Seeded transport problems. Consequences and assessment come only from TransportSimulator. */
const TransportGenerator = {
    version: 1,

    generate({ random, rules = {} }) {
        const protocols = rules.protocols || ["TCP", "UDP"];
        const packetCounts = rules.packetCounts || [3, 4];
        const lossCounts = rules.lossCounts || [0, 1];
        const knownProtocol = rules.knownProtocol === true;
        const outOfOrderRate = rules.outOfOrderRate ?? 0.5;
        if (!Array.isArray(protocols) || !protocols.length
            || !protocols.every(protocol => TransportSimulator.protocols.includes(protocol))
            || !Array.isArray(packetCounts) || !packetCounts.length
            || !packetCounts.every(count => Number.isInteger(count) && count >= 2 && count <= 8)
            || !Array.isArray(lossCounts) || !lossCounts.length
            || !lossCounts.every(count => Number.isInteger(count) && count >= 0 && count <= 2)
            || typeof outOfOrderRate !== "number" || outOfOrderRate < 0 || outOfOrderRate > 1) {
            throw new Error("Invalid transport generation rules.");
        }
        const pick = values => values[Math.floor(random() * values.length)];
        const shuffle = values => {
            const result = [...values];
            for (let index = result.length - 1; index > 0; index--) {
                const other = Math.floor(random() * (index + 1));
                [result[index], result[other]] = [result[other], result[index]];
            }
            return result;
        };
        const protocol = pick(protocols);
        const applications = protocol === "TCP"
            ? [
                { id: "document", title: "Document download", need: "Every chunk must reach the application in its original order." },
                { id: "account-update", title: "Account update", need: "Missing or reordered data could change the meaning of the update." }
            ]
            : [
                { id: "live-position", title: "Live position updates", need: "Use each fresh update that arrives; do not wait for transport to repair an old missing update." },
                { id: "voice-samples", title: "Live voice samples", need: "Play surviving samples promptly; one late sample is less useful than the newest audio." }
            ];
        const application = pick(applications);
        const requirements = protocol === "TCP"
            ? { orderedDelivery: true, lossRepair: true }
            : { orderedDelivery: false, lossRepair: false };
        const packetCount = pick(packetCounts);
        const lossCount = Math.min(pick(lossCounts), packetCount - 1);
        const lostSequences = new Set(shuffle(Array.from({ length: packetCount }, (_, index) => index + 1)).slice(0, lossCount));
        let delays = Array.from({ length: packetCount }, () => 1 + Math.floor(random() * 4));
        if (packetCount > 2 && random() < outOfOrderRate) {
            const first = Math.floor(random() * (packetCount - 1));
            delays[first] = 4;
            delays[first + 1] = 1;
        }
        const sender = "Sender";
        const receiver = "Receiver";
        const problem = {
            application,
            requirements,
            packets: Array.from({ length: packetCount }, (_, index) => ({
                id: `P${index + 1}`,
                sequence: index + 1,
                payload: `chunk-${String.fromCharCode(65 + index)}`,
                sender,
                receiver
            })),
            network: {
                conditions: Array.from({ length: packetCount }, (_, index) => ({
                    sequence: index + 1,
                    firstTransmission: lostSequences.has(index + 1) ? "loss" : "deliver",
                    delay: delays[index]
                })),
                sendSpacing: 0,
                timeout: 6,
                retransmissionDelay: 2,
                ackDelay: 1
            }
        };
        if (knownProtocol) problem.knownProtocol = protocol;
        TransportSimulator.validateProblem(problem);
        const selectedProtocol = knownProtocol ? protocol : TransportSimulator.recommendProtocol(problem);
        const data = {
            problem,
            oracle: {
                recommendedProtocol: TransportSimulator.recommendProtocol(problem),
                result: TransportSimulator.simulate(problem, selectedProtocol)
            }
        };
        this.validateScenario(data);
        return data;
    },

    validateScenario(data) {
        if (!data?.problem || !data?.oracle) throw new Error("Transport scenario needs problem inputs and a private oracle.");
        TransportSimulator.validateProblem(data.problem);
        const protocol = data.problem.knownProtocol || TransportSimulator.recommendProtocol(data.problem);
        const expected = TransportSimulator.simulate(data.problem, protocol);
        if (data.oracle.recommendedProtocol !== TransportSimulator.recommendProtocol(data.problem)
            || JSON.stringify(data.oracle.result) !== JSON.stringify(expected)) {
            throw new Error("Generated transport oracle does not match the simulator.");
        }
    },

    getMentalSimulation(data) {
        this.validateScenario(data);
        return {
            initial_state: JSON.parse(JSON.stringify(data.problem)),
            steps: [
                { operation: "inspect", label: "Inspect each first-transmission network condition." },
                { operation: "receive", label: "Predict which packets reach the transport receiver and in what order." },
                { operation: "repair", label: "Decide whether timeout and retransmission repair any loss." },
                { operation: "deliver", label: "Predict the order delivered to the application." }
            ]
        };
    },

    evaluatePrediction(data, response) {
        this.validateScenario(data);
        return TransportSimulator.assess(data.problem, response);
    },

    createExecutionChallenge() {
        return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] };
    }
};

registerScenarioGenerator("transport", TransportGenerator);
