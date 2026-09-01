function createPacketRoutingPlayground() {

    let network = LESSON.playground;
    let nodesById = new Map(network.nodes.map(node => [node.id, node]));
    const edgeKey = (from, to) => `${from}->${to}`;
    let firstRouterId = network.route[1];
    let selectedNextHopId = network.route[2];
    let alternativeEdge = network.edges.find(
        edge => edge.from === firstRouterId && edge.to !== selectedNextHopId
    );
    let alternativeHopId = alternativeEdge?.to;
    let alternativeHopAvailable = !alternativeEdge?.disabled;
    let selectedNextHop = nodesById.get(selectedNextHopId);
    let alternativeHop = nodesById.get(alternativeHopId);

    let packetLocation = network.source;
    let phase = "send";
    let routeFinished = false;
    let examiningRouter = false;
    let routeSelected = false;
    let statusElement;
    let decisionElement;
    let packetElement;
    let nodeElements = new Map();
    let edgeElements = new Map();
    let masteryMode = false;
    let masteryScenario = null;
    let replayToken = 0;

    function configureNetwork(scenario = {}) {
        network = {
            ...LESSON.playground,
            nodes: scenario.nodes || LESSON.playground.nodes,
            edges: scenario.edges || LESSON.playground.edges,
            source: scenario.source || LESSON.playground.source,
            destination: scenario.destination || LESSON.playground.destination,
            route: scenario.route || LESSON.playground.route
        };
        nodesById = new Map(network.nodes.map(node => [node.id, node]));
        firstRouterId = network.route[1];
        selectedNextHopId = network.route[2];
        alternativeEdge = network.edges.find(edge => (
            edge.from === firstRouterId && edge.to !== selectedNextHopId
        ));
        alternativeHopId = alternativeEdge?.to;
        alternativeHopAvailable = !alternativeEdge?.disabled;
        selectedNextHop = nodesById.get(selectedNextHopId);
        alternativeHop = nodesById.get(alternativeHopId);
    }

    function setPacketPosition(nodeId, animate = false) {

        const node = nodesById.get(nodeId);

        if (!animate) {
            packetElement.style.transition = "none";
        }

        packetElement.style.left = `${(node.x / 600) * 100}%`;
        packetElement.style.top = `${(node.y / 380) * 100}%`;

        if (!animate) {
            requestAnimationFrame(() => {
                packetElement.style.transition = "";
            });
        }
        else {
            packetElement.classList.remove("nr-packet-moving");
            void packetElement.offsetWidth;
            packetElement.classList.add("nr-packet-moving");
        }

    }

    function getTraversedEdges() {

        const currentRouteIndex = network.route.indexOf(packetLocation);

        return new Set(
            network.route
                .slice(0, currentRouteIndex + 1)
                .slice(1)
                .map((nodeId, index) => edgeKey(network.route[index], nodeId))
        );

    }

    function updateNetwork(statusText, animatePacket = false) {

        const traversedEdges = getTraversedEdges();
        const routeChoiceEdges = new Set(
            network.edges
                .filter(edge => edge.from === firstRouterId && !edge.disabled)
                .map(edge => edgeKey(edge.from, edge.to))
        );
        statusElement.textContent = statusText;

        nodeElements.forEach((element, nodeId) => {
            element.classList.toggle("nr-current", nodeId === packetLocation);
            element.classList.toggle("nr-examining", examiningRouter && nodeId === firstRouterId);
        });

        edgeElements.forEach((element, key) => {
            element.classList.toggle("nr-traversed", traversedEdges.has(key));
            element.classList.toggle("nr-choice", examiningRouter && routeChoiceEdges.has(key));
            element.classList.toggle(
                "nr-selected-route",
                routeSelected && key === edgeKey(firstRouterId, selectedNextHopId)
            );
        });

        if (examiningRouter || routeSelected) {
            decisionElement.hidden = false;
            decisionElement.innerHTML = routeSelected
                ? `${nodesById.get(firstRouterId).label} selects <strong>${selectedNextHop.label} → ${nodesById.get(network.destination).label}</strong>. ${alternativeHopAvailable ? `The ${alternativeHop?.label || "other"} path stays visible, but it does not lead to the destination.` : `The ${alternativeHop?.label || "other"} link is unavailable.`}`
                : `${nodesById.get(firstRouterId).label} can choose ${alternativeHopAvailable ? `<strong>${alternativeHop?.label || "another route"}</strong> or ` : ""}<strong>${selectedNextHop.label}</strong>. It examines the packet's destination: ${nodesById.get(network.destination).label}.`;
        }
        else {
            decisionElement.hidden = true;
        }

        setPacketPosition(packetLocation, animatePacket);

    }

    function createEdge(edge, svg) {

        const source = nodesById.get(edge.from);
        const destination = nodesById.get(edge.to);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", source.x);
        line.setAttribute("y1", source.y);
        line.setAttribute("x2", destination.x);
        line.setAttribute("y2", destination.y);
        line.classList.add("nr-edge");
        line.classList.toggle("nr-edge-disabled", Boolean(edge.disabled));

        svg.appendChild(line);
        edgeElements.set(edgeKey(edge.from, edge.to), line);

    }

    function createNode(node, canvas) {

        const element = document.createElement("div");
        element.className = `nr-node nr-${node.type}`;
        element.style.left = `${(node.x / 600) * 100}%`;
        element.style.top = `${(node.y / 380) * 100}%`;

        const type = document.createElement("span");
        type.className = "nr-node-type";
        type.textContent = node.type === "computer"
            ? "SOURCE"
            : node.type === "server"
                ? "DESTINATION"
                : "ROUTER";

        const label = document.createElement("strong");
        label.textContent = node.label;

        element.append(type, label);
        canvas.appendChild(element);
        nodeElements.set(node.id, element);

    }

    function buildNetwork() {

        stackDiv.innerHTML = "";
        stackDiv.classList.add("packet-routing-view");

        statusElement = document.createElement("p");
        statusElement.className = "nr-status";

        const routeInfo = document.createElement("div");
        routeInfo.className = "nr-route-info";
        routeInfo.innerHTML = `<span><b>SOURCE</b> ${nodesById.get(network.source).label}</span><span><b>DESTINATION</b> ${nodesById.get(network.destination).label}</span>`;

        decisionElement = document.createElement("p");
        decisionElement.className = "nr-decision";
        decisionElement.hidden = true;

        const canvas = document.createElement("div");
        canvas.className = "nr-network-canvas";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("nr-connections");
        svg.setAttribute("viewBox", "0 0 600 380");
        svg.setAttribute("preserveAspectRatio", "none");

        network.edges.forEach(edge => createEdge(edge, svg));
        canvas.appendChild(svg);
        network.nodes.forEach(node => createNode(node, canvas));

        packetElement = document.createElement("div");
        packetElement.className = "nr-packet";
        packetElement.textContent = "PKT";
        canvas.appendChild(packetElement);

        stackDiv.append(statusElement, routeInfo, decisionElement, canvas);
        setPacketPosition(packetLocation);

    }

    function resetRoute() {

        packetLocation = network.source;
        phase = "send";
        routeFinished = false;
        examiningRouter = false;
        routeSelected = false;

        updateNetwork(`A packet is ready at ${nodesById.get(network.source).label}. Its destination is ${nodesById.get(network.destination).label}.`);

    }

    function completeMissionAction(operation) {

        return completeAction(operation).complete;

    }

    function nextStep() {

        if (masteryMode) {
            setByteMessage("Choose the next hop that moves the packet toward its destination.");
            return;
        }

        if (routeFinished) {
            resetRoute();
            setByteMessage("Route reset. Send the packet from Computer A to Server C again.");
            return;
        }

        if (phase === "send") {
            packetElement.classList.remove("nr-packet-sending");
            void packetElement.offsetWidth;
            packetElement.classList.add("nr-packet-sending");

            updateNetwork(`${nodesById.get(network.source).label} sends the packet toward ${nodesById.get(firstRouterId).label}.`);
            const missionComplete = completeMissionAction("send-packet");
            phase = "reach-router";

            if (!missionComplete) {
                setByteMessage(`The packet leaves ${nodesById.get(network.source).label} and travels to ${nodesById.get(firstRouterId).label}.`);
            }

            return;
        }

        if (phase === "reach-router") {
            packetLocation = firstRouterId;
            updateNetwork(`The packet reaches ${nodesById.get(firstRouterId).label}.`, true);
            const missionComplete = completeMissionAction("reach-first-router");
            phase = "examine";

            if (!missionComplete) {
                setByteMessage(`${nodesById.get(firstRouterId).label} receives the packet and needs to decide which path leads toward ${nodesById.get(network.destination).label}.`);
            }

            return;
        }

        if (phase === "examine") {
            examiningRouter = true;
            updateNetwork(`${nodesById.get(firstRouterId).label} examines the packet's destination and keeps both possible paths visible.`);
            completeMissionAction("examine-destination");
            phase = "choose";
            setByteMessage(`The destination is ${nodesById.get(network.destination).label}. ${nodesById.get(firstRouterId).label} compares the available next hops.`);

            return;
        }

        if (phase === "choose") {
            routeSelected = true;
            updateNetwork(`${nodesById.get(firstRouterId).label} selects the path through ${nodesById.get(selectedNextHopId).label}, which leads toward ${nodesById.get(network.destination).label}.`);
            const missionComplete = completeMissionAction("choose-correct-route");
            phase = "forward";

            if (!missionComplete) {
                setByteMessage(`${alternativeHop.label} is still a visible option, but ${selectedNextHop.label} is the correct next hop toward the destination.`);
            }

            return;
        }

        if (phase === "forward") {
            packetLocation = selectedNextHopId;
            examiningRouter = false;
            updateNetwork(`The packet is forwarded from ${nodesById.get(firstRouterId).label} to ${nodesById.get(selectedNextHopId).label}.`, true);
            const missionComplete = completeMissionAction("forward-packet");
            phase = "deliver";

            if (!missionComplete) {
                setByteMessage(`${nodesById.get(selectedNextHopId).label} is now the packet's current location. It has a direct path to ${nodesById.get(network.destination).label}.`);
            }

            return;
        }

        packetLocation = network.destination;
        updateNetwork(`The packet reaches ${nodesById.get(network.destination).label}, its destination.`, true);
        routeFinished = true;

        const missionComplete = completeMissionAction("reach-destination");

        if (!missionComplete) {
            setByteMessage(`${nodesById.get(network.destination).label} receives the packet. The route from ${nodesById.get(network.source).label} is complete.`);
        }

    }

    function chooseMasteryHop(operation) {
        if (!masteryMode || routeFinished) return;
        const selected = operation.replace("to-", "");
        const routeIndex = network.route.indexOf(packetLocation);
        const expected = network.route[routeIndex + 1];

        if (selected !== expected) {
            const link = network.edges.find(edge => (
                edge.from === packetLocation && edge.to === selected
            ));
            const unavailableMessage = link?.disabled
                ? `${nodesById.get(selected)?.label || selected} is connected by an unavailable link. Choose an active route toward the destination.`
                : null;
            masteryEngine.operationCompleted({
                operation,
                state: { outcome: null, location: packetLocation },
                feedback: unavailableMessage || `The packet is at ${nodesById.get(packetLocation).label}. Check which connected hop continues toward ${nodesById.get(network.destination).label}.`
            });
            return;
        }

        packetLocation = selected;
        examiningRouter = packetLocation === firstRouterId;
        routeSelected = routeIndex >= 1;
        routeFinished = packetLocation === network.destination;
        updateNetwork(
            routeFinished
                ? `The packet reached ${nodesById.get(network.destination).label}.`
                : `The packet moves to ${nodesById.get(packetLocation).label}.`,
            true
        );
        masteryEngine.operationCompleted({
            operation,
            state: { outcome: routeFinished ? "delivered" : null, location: packetLocation },
            feedback: routeFinished
                ? `The packet arrived at ${nodesById.get(network.destination).label}.`
                : `Good route choice. The packet is now at ${nodesById.get(packetLocation).label}.`,
            progress: !routeFinished
        });
    }

    function renderRouteCard(title, route, container) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        card.innerHTML = `<span class="challenge-target-label">${title}</span><p>${(route || []).map(node => nodesById.get(node)?.label || node).join(" → ")}</p>`;
        container.appendChild(card);
    }

    return {
        mount() {
            buildNetwork();
            getControl("next-step").onclick = nextStep;
            resetRoute();
        },
        reset() {
            replayToken++;
            masteryMode = false;
            masteryScenario = null;
            configureNetwork();
            buildNetwork();
            resetRoute();
        },
        resetForChallenge() {
            this.reset();
        },
        configureMasteryScenario(scenario) {
            replayToken++;
            masteryMode = true;
            masteryScenario = scenario || {};
            configureNetwork(scenario);
            buildNetwork();
            resetRoute();
        },
        performMasteryOperation(operation) {
            if (operation.startsWith("to-")) chooseMasteryHop(operation);
        },
        endMasteryMode() { masteryMode = false; masteryScenario = null; },
        async replayExpertSimulation(simulation) {
            if (!simulation || !Array.isArray(simulation.route)) return;
            const token = ++replayToken;
            packetLocation = network.source;
            resetRoute();
            for (const nodeId of simulation.route.slice(1)) {
                await new Promise(resolve => window.setTimeout(resolve, 460));
                if (token !== replayToken) return;
                packetLocation = nodeId;
                routeFinished = nodeId === network.destination;
                updateNetwork(`Packet moves to ${nodesById.get(nodeId).label}.`, true);
            }
        },
        renderExpertThinkingState({ labels }, container) {
            renderRouteCard(labels.title || "Starting route", masteryScenario?.route || network.route, container);
        },
        renderMasteryStates({ scenario, target }, container) {
            renderRouteCard("ROUTE OPTIONS", scenario?.route || network.route, container);
            const goal = document.createElement("section");
            goal.className = "mastery-state-card";
            goal.innerHTML = `<span class="challenge-target-label">${target.label || "TARGET"}</span><p>${target.description || `Deliver the packet to ${nodesById.get(network.destination).label}.`}</p>`;
            container.appendChild(goal);
        }
    };

}


registerPlayground("packet-routing", createPacketRoutingPlayground);
