/* Seeded IPv4 tasks. IPv4Address remains the only answer oracle. */
const IpGenerator = {
    version: 1,
    generate({ random, rules = {} }) {
        const pick = values => values[Math.floor(random() * values.length)];
        const count = pick(rules.deviceCounts || [3, 4, 5]);
        const network = 10 + Math.floor(random() * 180);
        const names = ["Laptop", "Printer", "Server", "Tablet", "Camera", "Phone"];
        const devices = Array.from({ length: count }, (_, index) => ({ id: `device-${index + 1}`, name: names[index], role: index === 2 ? "SERVER" : "ENDPOINT", address: `192.168.${network}.${10 + index}` }));
        const kind = pick(rules.taskKinds || IPv4Address.kinds);
        let task;
        let packet = null;
        if (kind === "validate-address") {
            const invalidTypes = rules.invalidTypes || ["octet", "count", "characters"];
            const valid = random() >= (rules.invalidRate ?? 0.5);
            let candidate = pick(devices).address;
            if (!valid) {
                const type = pick(invalidTypes);
                candidate = type === "octet" ? `10.0.${network}.256` : type === "count" ? `192.168.${network}` : `abc.1.2.3`;
            }
            task = { kind, candidate, prompt: "Decide whether the displayed address is a structurally valid IPv4 address." };
        }
        else if (kind === "construct-address") {
            const octets = pick(devices).address.split(".").map(Number);
            task = { kind, octets, prompt: "Combine the four displayed octets into one IPv4 address." };
        }
        else {
            const sourceIndex = Math.floor(random() * count);
            let destinationIndex = Math.floor(random() * count);
            if (destinationIndex === sourceIndex) destinationIndex = (destinationIndex + 1) % count;
            packet = { sourceDeviceId: devices[sourceIndex].id, destinationAddress: devices[destinationIndex].address };
            task = { kind, prompt: kind === "identify-endpoints" ? "Identify the packet's source and destination addresses." : "Choose the device that owns the packet's destination address." };
        }
        const data = { problem: { devices, packet, task } };
        this.validateScenario(data);
        return data;
    },
    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "answer")) throw new Error("IPv4 scenarios must expose inputs only.");
        IPv4Address.execute(data.problem);
    },
    getMentalSimulation(data) {
        this.validateScenario(data);
        return { initial_state: JSON.parse(JSON.stringify(data.problem)), steps: [
            { operation: "inspect-address", label: "Inspect the four octets and their range." },
            { operation: "resolve-endpoint", label: "Match the source or destination address to the displayed devices." }
        ] };
    },
    evaluatePrediction(data, response) { this.validateScenario(data); return IPv4Address.assess(data.problem, response); },
    createExecutionChallenge() { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] }; }
};
registerScenarioGenerator("ipv4", IpGenerator);
