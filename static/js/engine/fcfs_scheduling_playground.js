function createFcfsSchedulingPlayground() {

    const originalProcesses = LESSON.playground.processes.map(process => ({ ...process }));

    let readyQueue = [];
    let runningProcess = null;
    let completedProcesses = [];
    let phase = "enter";
    let schedulingFinished = false;

    function createProcessCard(process, state, options = {}) {

        const { highlighted = false, executing = false, entering = false, completing = false } = options;
        const card = document.createElement("div");

        card.className = [
            "fcfs-process",
            `fcfs-${state}`,
            highlighted ? "fcfs-highlighted" : "",
            executing ? "fcfs-executing" : "",
            entering ? "fcfs-entering" : "",
            completing ? "fcfs-completing" : ""
        ].filter(Boolean).join(" ");

        card.innerHTML = `
            <strong>${process.id}</strong>
            <span>${executing ? "executed" : process.burst + " units"}</span>
        `;

        return card;

    }

    function createStage(title, className) {

        const stage = document.createElement("section");
        stage.className = `fcfs-stage ${className}`;

        const heading = document.createElement("h3");
        heading.textContent = title;

        const content = document.createElement("div");
        content.className = "fcfs-stage-content";

        stage.append(heading, content);

        return { stage, content };

    }

    function render(options = {}) {

        const {
            highlightedId = null,
            executing = false,
            enteringCpu = false,
            completingId = null
        } = options;

        stackDiv.innerHTML = "";
        stackDiv.classList.add("fcfs-scheduling-view");

        const status = document.createElement("p");
        status.className = "fcfs-status";
        status.textContent = schedulingFinished
            ? "All processes are complete. Use NEXT STEP to schedule them again."
            : "Processes move from Ready Queue to CPU to Completed.";

        const flow = document.createElement("div");
        flow.className = "fcfs-flow";

        const ready = createStage("READY QUEUE", "fcfs-ready-queue");
        const cpu = createStage("CPU", "fcfs-cpu");
        const completed = createStage("COMPLETED", "fcfs-completed");

        readyQueue.forEach(process => {
            ready.content.appendChild(
                createProcessCard(process, "ready", {
                    highlighted: process.id === highlightedId
                })
            );
        });

        if (readyQueue.length === 0) {
            const empty = document.createElement("span");
            empty.className = "fcfs-empty";
            empty.textContent = "empty";
            ready.content.appendChild(empty);
        }

        if (runningProcess) {
            cpu.content.appendChild(
                createProcessCard(runningProcess, "running", {
                    executing,
                    entering: enteringCpu
                })
            );
        }
        else {
            const empty = document.createElement("span");
            empty.className = "fcfs-empty";
            empty.textContent = "empty";
            cpu.content.appendChild(empty);
        }

        completedProcesses.forEach(process => {
            completed.content.appendChild(
                createProcessCard(process, "completed", {
                    completing: process.id === completingId
                })
            );
        });

        if (completedProcesses.length === 0) {
            const empty = document.createElement("span");
            empty.className = "fcfs-empty";
            empty.textContent = "none yet";
            completed.content.appendChild(empty);
        }

        const firstArrow = document.createElement("div");
        firstArrow.className = "fcfs-arrow";
        firstArrow.textContent = "→";

        const secondArrow = document.createElement("div");
        secondArrow.className = "fcfs-arrow";
        secondArrow.textContent = "→";

        flow.append(ready.stage, firstArrow, cpu.stage, secondArrow, completed.stage);
        stackDiv.append(status, flow);

    }

    function resetSchedule() {

        readyQueue = originalProcesses.map(process => ({ ...process }));
        runningProcess = null;
        completedProcesses = [];
        phase = "enter";
        schedulingFinished = false;

        render({ highlightedId: readyQueue[0]?.id });

    }

    function nextStep() {

        if (schedulingFinished) {

            resetSchedule();
            setByteMessage("Schedule reset. P1 is first because it arrived first.");

            return;

        }

        if (phase === "enter") {

            runningProcess = readyQueue.shift();
            render({ enteringCpu: true });

            const operation = runningProcess.id === "P1"
                ? "observe-ready-queue"
                : runningProcess.id === "P2"
                    ? "run-next-process"
                    : "continue-running";

            const missionResult = completeAction(operation);

            phase = "execute";

            if (!missionResult.complete) {
                setByteMessage(`${runningProcess.id} was first in the ready queue, so it enters the CPU.`);
            }

            return;

        }

        if (phase === "execute") {

            render({ executing: true });

            const missionResult = completeAction(
                runningProcess.id === "P1" ? "run-first-process" : "continue-running"
            );

            phase = "finish";

            if (!missionResult.complete) {
                setByteMessage(`${runningProcess.id} executes for ${runningProcess.burst} units.`);
            }

            return;

        }

        const finished = runningProcess;

        completedProcesses.push(finished);
        runningProcess = null;

        render({ completingId: finished.id });

        const operation = finished.id === "P1"
            ? "finish-p1"
            : finished.id === "P3"
                ? "complete-all"
                : "continue-running";

        const missionResult = completeAction(operation);

        if (readyQueue.length === 0) {
            schedulingFinished = true;
        }
        else {
            phase = "enter";
        }

        if (!missionResult.complete) {
            setByteMessage(`${finished.id} finished and moved to Completed.`);
        }

    }

    return {
        mount() {
            getControl("next-step").onclick = nextStep;
            resetSchedule();
        },
        reset() {
            resetSchedule();
        }
    };

}


registerPlayground("fcfs-scheduling", createFcfsSchedulingPlayground);
