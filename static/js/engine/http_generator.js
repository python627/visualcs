/* Seeded HTTP goals; all response truth is computed by HttpModel. */
const HttpGenerator = {
    version: 1,
    generate({ random, rules = {} }) {
        const pick = values => values[Math.floor(random() * values.length)];
        const suffix = Math.floor(random() * 900 + 100);
        const routeCounts = rules.routeCounts || [4, 5, 6];
        const routeCount = pick(routeCounts);
        const routes = [
            { method: "GET", path: "/", status: 200, body: "Home page" },
            { method: "GET", path: "/about", status: 200, body: "About page" },
            { method: "GET", path: "/broken", status: 500, failure: true },
            { method: "POST", path: "/messages", status: 201, requiresBody: true, bodyResult: "Message created" }
        ];
        while (routes.length < routeCount) routes.push({ method: "GET", path: `/resource-${suffix}-${routes.length}`, status: 200, body: `Resource ${routes.length}` });
        const server = { id: "web-server", name: `Example Web Server ${suffix}`, routes };
        const cases = rules.cases || ["success", "missing", "failure"];
        const kind = pick(cases);
        let request;
        if (kind === "success") request = { method: "GET", path: pick(["/", "/about"]) };
        else if (kind === "failure") request = { method: "GET", path: "/broken" };
        else if (kind === "post") request = { method: "POST", path: "/messages", body: `hello-${suffix}` };
        else request = { method: "GET", path: `/missing-${suffix}` };
        const data = { problem: { client: { id: "browser", name: "Browser" }, server, goal: { instruction: `Send ${request.method} ${request.path} and predict the server response.`, request } } };
        this.validateScenario(data);
        return data;
    },
    validateScenario(data) {
        if (!data?.problem || Object.hasOwn(data, "oracle") || Object.hasOwn(data, "response") || Object.hasOwn(data, "status")) throw new Error("HTTP scenarios must expose request goals and server routes only.");
        HttpModel.validateProblem(data.problem);
    },
    getMentalSimulation(data) {
        this.validateScenario(data);
        return { initial_state: JSON.parse(JSON.stringify(data.problem)), steps: [
            { operation: "build-request", label: "Choose the HTTP method and path." },
            { operation: "server-match", label: "The server compares the request with its routes." },
            { operation: "predict-response", label: "Predict the response status before sending." }
        ] };
    },
    evaluatePrediction(data, response) { this.validateScenario(data); return HttpModel.assess(data.problem, response); },
    createExecutionChallenge() { return { phases: [{ goal: { type: "outcome_equals", expected_outcome: "solved" } }] }; }
};
registerScenarioGenerator("http", HttpGenerator);
