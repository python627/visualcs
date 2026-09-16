/* Bounded HTTP request/response evaluator. Transport and DNS are intentionally out of scope. */
const HttpModel = (() => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const methods = Object.freeze(["GET", "POST"]);

    function normalizeRequest(request) {
        const method = String(request?.method || "").trim().toUpperCase();
        const path = String(request?.path || "").trim();
        if (!methods.includes(method)) throw new Error("The educational HTTP model supports GET and POST.");
        if (!/^\/[A-Za-z0-9/_-]*$/.test(path)) throw new Error("An HTTP path must begin with / and contain simple path characters.");
        return { method, path, body: request?.body == null ? null : String(request.body) };
    }

    function validateServer(server) {
        if (!server || typeof server.id !== "string" || !Array.isArray(server.routes) || !server.routes.length) throw new Error("An HTTP server needs routes.");
        server.routes.forEach(route => {
            const request = normalizeRequest(route);
            if (![200, 201, 500].includes(route.status)) throw new Error("Configured routes must use supported educational status codes.");
            if (request.method === "POST" && route.status < 500 && route.requiresBody && typeof route.bodyResult !== "string" && typeof route.body !== "string") throw new Error("POST routes requiring a body need a result.");
        });
        return true;
    }

    function execute(server, request) {
        validateServer(server);
        const normalized = normalizeRequest(request);
        const exact = server.routes.find(route => route.method === normalized.method && route.path === normalized.path);
        if (exact) {
            if (exact.requiresBody && !String(normalized.body || "").trim()) {
                return { request: normalized, response: { status: 400, label: "Bad Request", body: "A request body is required." }, explanation: "The route exists, but the request body is missing." };
            }
            const status = exact.failure ? 500 : exact.status;
            const labels = { 200: "OK", 201: "Created", 500: "Internal Server Error" };
            return { request: normalized, response: { status, label: labels[status], body: status === 500 ? "The server failed while handling this route." : (exact.bodyResult || exact.body || "") },
                explanation: status === 500 ? "The path exists, but the server failed while handling it." : `The server matched ${normalized.method} ${normalized.path} and returned ${status}.` };
        }
        const pathExists = server.routes.some(route => route.path === normalized.path);
        if (pathExists) return { request: normalized, response: { status: 405, label: "Method Not Allowed", body: "That method is not allowed for this path." }, explanation: "The path exists, but not for the chosen method." };
        return { request: normalized, response: { status: 404, label: "Not Found", body: "No resource exists at this path." }, explanation: "The server received the request, but no route matched the path." };
    }

    function validateProblem(problem) {
        if (!problem || !problem.client || typeof problem.client.name !== "string" || !problem.server || !problem.goal?.request) throw new Error("An HTTP problem needs a client, server, and request goal.");
        validateServer(problem.server);
        normalizeRequest(problem.goal.request);
        return true;
    }

    const field = (label, submitted, expected) => ({ label, submitted, expected, correct: submitted === expected });
    function assess(problem, response = {}) {
        validateProblem(problem);
        let actual;
        try { actual = execute(problem.server, response); }
        catch (error) {
            return { allCorrect: false, fields: [{ label: "Request", submitted: "invalid", expected: "valid method and path", correct: false }], actualResult: null, feedback: error.message };
        }
        const goal = normalizeRequest(problem.goal.request);
        const submittedStatus = Number(response.status);
        const fields = [
            field("Request method", actual.request.method, goal.method),
            field("Request path", actual.request.path, goal.path),
            field("Predicted status", submittedStatus, actual.response.status)
        ];
        return { allCorrect: fields.every(item => item.correct), fields, actualResult: clone(actual), expectedResult: execute(problem.server, goal), feedback: actual.explanation };
    }

    return { methods, normalizeRequest, validateServer, validateProblem, execute, assess };
})();
