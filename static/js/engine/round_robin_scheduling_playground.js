function createRoundRobinSchedulingPlayground() {

    const originalProcesses = LESSON.playground.processes.map(process => ({ ...process }));
    const lessonTimeQuantum = LESSON.playground.time_quantum;

    let readyQueue = [];
    let runningProcess = null;
    let completedProcesses = [];
    let phase = "enter";
    let schedulingFinished = false;
    let timeQuantum = lessonTimeQuantum;
    let masteryScenario = null;
    let masteryMode = false;
    let masteryBusy = false;
    let replayToken = 0;

    function createProcessCard(process, state, options = {}) {

        const {
            highlighted = false,
            entering = false,
            executing = false,
            returning = false,
            completing = false
        } = options;

        const card = document.createElement("div");

        card.className = [
            "rr-process",
            `rr-${state}`,
            highlighted ? "rr-highlighted" : "",
            entering ? "rr-entering" : "",
            executing ? "rr-executing" : "",
            returning ? "rr-returning" : "",
            completing ? "rr-completing" : ""
        ].filter(Boolean).join(" ");

        card.innerHTML = `
            <strong>${process.id}</strong>
            <span>${process.remaining} unit${process.remaining === 1 ? "" : "s"} left</span>
        `;

        return card;

    }

    function createStage(title, className) {

        const stage = document.createElement("section");
        stage.className = `rr-stage ${className}`;

        const heading = document.createElement("h3");
        heading.textContent = title;

        const content = document.createElement("div");
        content.className = "rr-stage-content";

        stage.append(heading, content);

        return { stage, content };

    }

    function appendEmptyState(container, text) {

        const empty = document.createElement("span");
        empty.className = "rr-empty";
        empty.textContent = text;
        container.appendChild(empty);

    }

    function render(options = {}) {

        const {
            highlightedId = null,
            enteringCpu = false,
            executing = false,
            returningId = null,
            completingId = null,
            statusText = null
        } = options;

        stackDiv.innerHTML = "";
        stackDiv.classList.add("round-robin-scheduling-view");

        const status = document.createElement("p");
        status.className = "rr-status";
        status.textContent = statusText || (schedulingFinished
            ? "All processes are complete. Use NEXT STEP to schedule them again."
            : "Each CPU turn can use at most one time quantum.");

        const quantum = document.createElement("p");
        quantum.className = "rr-quantum";
        quantum.textContent = `TIME QUANTUM = ${timeQuantum} UNITS`;

        const flow = document.createElement("div");
        flow.className = "rr-flow";

        const ready = createStage("READY QUEUE", "rr-ready-queue");
        const cpu = createStage("CPU", "rr-cpu");
        const completed = createStage("COMPLETED", "rr-completed");

        readyQueue.forEach(process => {
            ready.content.appendChild(
                createProcessCard(process, "ready", {
                    highlighted: process.id === highlightedId,
                    returning: process.id === returningId
                })
            );
        });

        if (readyQueue.length === 0) {
            appendEmptyState(ready.content, "empty");
        }

        if (runningProcess) {
            cpu.content.appendChild(
                createProcessCard(runningProcess, "running", {
                    entering: enteringCpu,
                    executing
                })
            );
        }
        else {
            appendEmptyState(cpu.content, "empty");
        }

        completedProcesses.forEach(process => {
            completed.content.appendChild(
                createProcessCard(process, "completed", {
                    completing: process.id === completingId
                })
            );
        });

        if (completedProcesses.length === 0) {
            appendEmptyState(completed.content, "none yet");
        }

        const firstArrow = document.createElement("div");
        firstArrow.className = "rr-arrow";
        firstArrow.textContent = "→";

        const secondArrow = document.createElement("div");
        secondArrow.className = "rr-arrow";
        secondArrow.textContent = "→";

        flow.append(ready.stage, firstArrow, cpu.stage, secondArrow, completed.stage);
        stackDiv.append(status, quantum, flow);

    }

    function resetSchedule() {

        const processes = masteryScenario?.processes || originalProcesses;
        timeQuantum = masteryScenario?.quantum || lessonTimeQuantum;
        readyQueue = processes.map(process => ({
            ...process,
            remaining: process.burst
        }));
        runningProcess = null;
        completedProcesses = [];
        phase = "enter";
        schedulingFinished = false;

        render({
            highlightedId: readyQueue[0]?.id,
            statusText: "P1 is at the front of the ready queue and will get the first turn."
        });

    }

    function reportMission(operation) {

        const missionResult = completeAction(operation);

        return missionResult.complete;

    }

    function nextStep() {

        if (masteryMode) {
            setByteMessage("Choose the process at the front of the Ready Queue for the next quantum.");
            return;
        }

        if (schedulingFinished) {
            resetSchedule();
            setByteMessage("Schedule reset. Each process will get up to 2 CPU units before the queue rotates.");
            return;
        }

        if (phase === "enter") {
            runningProcess = readyQueue.shift();

            render({
                enteringCpu: true,
                statusText: `${runningProcess.id} moves from the front of Ready Queue into the CPU.`
            });

            const operation = runningProcess.id === "P1" && completedProcesses.length === 0
                ? "run-first-process"
                : completedProcesses.length === 0 && runningProcess.id === "P2"
                    ? "run-next-process"
                    : "continue-rotating";

            const missionComplete = reportMission(operation);
            phase = "execute";

            if (!missionComplete) {
                setByteMessage(`${runningProcess.id} is now running. It can use up to ${timeQuantum} CPU units.`);
            }

            return;
        }

        if (phase === "execute") {
            const used = Math.min(timeQuantum, runningProcess.remaining);
            runningProcess.remaining -= used;

            render({
                executing: true,
                statusText: runningProcess.remaining === 0
                    ? `${runningProcess.id} uses ${used} unit${used === 1 ? "" : "s"} and finishes its work.`
                    : `${runningProcess.id} uses ${used} units and has ${runningProcess.remaining} left.`
            });

            const operation = runningProcess.id === "P1" && completedProcesses.length === 0
                ? "use-time-quantum"
                : "continue-rotating";

            const missionComplete = reportMission(operation);
            phase = "resolve";

            if (!missionComplete) {
                setByteMessage(`${runningProcess.id} used one time quantum. Now decide whether it finishes or returns to Ready Queue.`);
            }

            return;
        }

        const process = runningProcess;

        if (process.remaining === 0) {
            completedProcesses.push(process);
            runningProcess = null;

            if (readyQueue.length === 0) {
                schedulingFinished = true;
            }

            render({
                completingId: process.id,
                statusText: `${process.id} is finished and moves to Completed instead of returning to the queue.`
            });

            const missionComplete = reportMission(
                schedulingFinished ? "complete-all" : "continue-rotating"
            );

            if (!missionComplete) {
                setByteMessage(`${process.id} finished, so it leaves the ready queue instead of taking another turn.`);
            }
        }
        else {
            readyQueue.push(process);
            runningProcess = null;

            render({
                returningId: process.id,
                statusText: `${process.id} is unfinished, so it returns to the back of Ready Queue.`
            });

            const operation = process.id === "P1" && completedProcesses.length === 0
                ? "return-to-ready-queue"
                : "continue-rotating";

            const missionComplete = reportMission(operation);

            if (!missionComplete) {
                setByteMessage(`${process.id} is unfinished, so the queue rotates and ${readyQueue[0].id} gets the next turn.`);
            }
        }

        phase = "enter";

    }

    function runMasteryProcess(operation) {
        if (!masteryMode || masteryBusy || schedulingFinished) return;
        const selectedId = operation.replace("run-", "").toUpperCase();
        const expected = readyQueue[0];
        if (!expected) return;

        if (selectedId !== expected.id) {
            masteryEngine.operationCompleted({
                operation,
                state: { outcome: null, ready: readyQueue.map(process => process.id) },
                feedback: `${expected.id} is at the front of Ready Queue, so it gets the next time quantum.`
            });
            return;
        }

        masteryBusy = true;
        runningProcess = readyQueue.shift();
        const used = Math.min(timeQuantum, runningProcess.remaining);
        render({ enteringCpu: true, statusText: `${runningProcess.id} enters the CPU for up to ${timeQuantum} units.` });

        setTimeout(() => {
            const process = runningProcess;
            process.remaining -= used;
            runningProcess = null;
            let completedId = null;
            let returningId = null;
            if (process.remaining === 0) {
                completedProcesses.push(process);
                completedId = process.id;
            }
            else {
                readyQueue.push(process);
                returningId = process.id;
            }
            schedulingFinished = readyQueue.length === 0;
            masteryBusy = false;
            render({
                completingId: completedId,
                returningId,
                statusText: completedId
                    ? `${completedId} finished and moved to Completed.`
                    : `${returningId} is unfinished and returns to the back of Ready Queue.`
            });
            masteryEngine.operationCompleted({
                operation,
                state: {
                    outcome: schedulingFinished ? "complete" : null,
                    ready: readyQueue.map(item => item.id),
                    completed: completedProcesses.map(item => item.id)
                },
                feedback: schedulingFinished
                    ? "All processes have completed after taking turns."
                    : `${readyQueue[0].id} is now at the front for the next turn.`,
                progress: !schedulingFinished
            });
        }, 440);
    }

    function renderRoundRobinCard(title, processes, quantum, container) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        card.innerHTML = `<span class="challenge-target-label">${title}</span><p>Quantum ${quantum} · ${processes?.map(process => `${process.id} (${process.burst}u)`).join(" → ") || "empty"}</p>`;
        container.appendChild(card);
    }

    return {
        mount() {
            getControl("next-step").onclick = nextStep;
            resetSchedule();
        },
        reset() {
            replayToken++;
            masteryScenario = null;
            masteryMode = false;
            masteryBusy = false;
            resetSchedule();
        },
        resetForChallenge() {
            replayToken++;
            masteryScenario = null;
            masteryMode = false;
            masteryBusy = false;
            resetSchedule();
        },
        configureMasteryScenario(scenario) {
            replayToken++;
            masteryScenario = scenario || {};
            masteryMode = true;
            masteryBusy = false;
            resetSchedule();
        },
        performMasteryOperation(operation) {
            if (operation.startsWith("run-")) runMasteryProcess(operation);
        },
        endMasteryMode() { masteryMode = false; masteryScenario = null; masteryBusy = false; },
        async replayExpertSimulation(simulation) {
            if (!simulation || !Array.isArray(simulation.initial_state) || !Array.isArray(simulation.steps)) return;
            const token = ++replayToken;
            masteryScenario = { processes: simulation.initial_state, quantum: simulation.quantum || LESSON.playground.time_quantum };
            masteryMode = true;
            resetSchedule();
            for (const step of simulation.steps) {
                await new Promise(resolve => window.setTimeout(resolve, 390));
                if (token !== replayToken) return;
                const process = readyQueue.shift();
                if (!process) return;
                process.remaining -= step.used;
                if (process.remaining > 0) readyQueue.push(process);
                else completedProcesses.push(process);
                schedulingFinished = readyQueue.length === 0;
                render({ statusText: step.label, completingId: process.remaining === 0 ? process.id : null, returningId: process.remaining > 0 ? process.id : null });
            }
        },
        renderExpertThinkingState({ initialState, labels }, container) {
            renderRoundRobinCard(labels.title || "Starting Ready Queue", initialState, timeQuantum, container);
        },
        renderMasteryStates({ scenario, target }, container) {
            renderRoundRobinCard("START READY QUEUE", scenario?.processes || [], scenario?.quantum || timeQuantum, container);
            const outcome = document.createElement("section");
            outcome.className = "mastery-state-card";
            outcome.innerHTML = `<span class="challenge-target-label">${target.label || "TARGET"}</span><p>${target.description || "Run every process until it completes, rotating unfinished work to the rear."}</p>`;
            container.appendChild(outcome);
        }
    };

}


registerPlayground("round-robin-scheduling", createRoundRobinSchedulingPlayground);
