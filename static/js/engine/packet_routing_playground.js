function createPacketRoutingPlayground() {

    const network = LESSON.playground;
    const nodesById = new Map(network.nodes.map(node => [node.id, node]));
    const edgeKey = (from, to) => `${from}->${to}`;
    const firstRouterId = network.route[1];
    const selectedNextHopId = network.route[2];
    const alternativeHopId = network.edges.find(
        edge => edge.from === firstRouterId && edge.to !== selectedNextHopId
    ).to;
    const selectedNextHop = nodesById.get(selectedNextHopId);
    const alternativeHop = nodesById.get(alternativeHopId);

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
                .filter(edge => edge.from === firstRouterId)
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
                ? `${nodesById.get(firstRouterId).label} selects <strong>${selectedNextHop.label} → ${nodesById.get(network.destination).label}</strong>. The ${alternativeHop.label} path stays visible, but it does not lead to the destination.`
                : `${nodesById.get(firstRouterId).label} can choose <strong>${alternativeHop.label}</strong> or <strong>${selectedNextHop.label}</strong>. It examines the packet's destination: ${nodesById.get(network.destination).label}.`;
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
        routeInfo.innerHTML = "<span><b>SOURCE</b> Computer A</span><span><b>DESTINATION</b> Server C</span>";

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

    return {
        mount() {
            buildNetwork();
            getControl("next-step").onclick = nextStep;
            resetRoute();
        },
        reset() {
            resetRoute();
        }
    };

}


registerPlayground("packet-routing", createPacketRoutingPlayground);
