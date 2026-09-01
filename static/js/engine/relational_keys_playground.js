function createRelationalKeysPlayground() {

    let playgroundData = LESSON.playground;
    let { tables, relationship } = playgroundData;
    let sourceTable = tables[relationship.source_table];
    let targetTable = tables[relationship.target_table];

    let traceIndex = 0;
    let phase = "find";
    let masteryScenario = null;
    let masteryMode = false;
    let replayToken = 0;

    function getTrace(index = traceIndex) {

        const paymentId = relationship.trace_order[index];
        const payment = sourceTable.rows.find(
            row => row[sourceTable.primary_key] === paymentId
        );
        const studentId = payment[relationship.foreign_key];
        const student = targetTable.rows.find(
            row => row[relationship.primary_key] === studentId
        );

        return { payment, student };

    }

    function createKeyBadge(label, type) {

        const badge = document.createElement("span");
        badge.className = `rk-key-badge rk-${type}-badge`;
        badge.textContent = label;

        return badge;

    }

    function createTable(tableName, table, trace, options) {

        const card = document.createElement("section");
        card.className = `rk-table-card rk-${tableName}-table`;

        const title = document.createElement("h3");
        title.textContent = table.title;

        const tableElement = document.createElement("table");
        tableElement.className = "rk-table";

        const headerRow = document.createElement("tr");

        table.columns.forEach(column => {
            const heading = document.createElement("th");
            heading.append(document.createTextNode(column.label));

            if (column.key === table.primary_key) {
                heading.appendChild(createKeyBadge("PK", "primary"));
            }

            if (
                tableName === relationship.source_table
                && column.key === relationship.foreign_key
            ) {
                heading.appendChild(createKeyBadge("FK", "foreign"));
            }

            headerRow.appendChild(heading);
        });

        const tableHead = document.createElement("thead");
        tableHead.appendChild(headerRow);

        const tableBody = document.createElement("tbody");

        table.rows.forEach(row => {
            const rowElement = document.createElement("tr");
            const isSourceRow = tableName === relationship.source_table
                && row[sourceTable.primary_key] === trace.payment[sourceTable.primary_key];
            const isTargetRow = tableName === relationship.target_table
                && row[relationship.primary_key] === trace.student[relationship.primary_key];

            if (options.studentHighlighted && isTargetRow) {
                rowElement.classList.add("rk-matched-row");
            }

            table.columns.forEach(column => {
                const cell = document.createElement("td");
                const isForeignKey = isSourceRow
                    && column.key === relationship.foreign_key;
                const isPrimaryKey = isTargetRow
                    && column.key === relationship.primary_key;

                cell.textContent = row[column.key];

                if (isForeignKey) {
                    cell.classList.add("rk-foreign-key");

                    if (options.foreignKeyHighlighted) {
                        cell.classList.add("rk-active");
                    }
                }

                if (isPrimaryKey) {
                    cell.classList.add("rk-primary-key");

                    if (options.primaryKeyHighlighted) {
                        cell.classList.add("rk-active");
                    }
                    else if (options.traceVisible) {
                        cell.classList.add("rk-trace-target");
                    }
                }

                if (
                    options.studentHighlighted
                    && isTargetRow
                    && column.key === "name"
                ) {
                    cell.classList.add("rk-student-name");
                }

                rowElement.appendChild(cell);
            });

            tableBody.appendChild(rowElement);
        });

        tableElement.append(tableHead, tableBody);
        card.append(title, tableElement);

        return card;

    }

    function createConnector(trace, traceVisible) {

        const connector = document.createElement("div");
        connector.className = `rk-connector ${traceVisible ? "rk-trace-visible" : ""}`;

        const line = document.createElement("div");
        line.className = "rk-trace-line";

        const label = document.createElement("p");
        label.className = "rk-connector-label";
        label.textContent = traceVisible
            ? `${trace.payment[relationship.foreign_key]} references ${trace.student[relationship.primary_key]}`
            : "Trace a STUDENT_ID";

        connector.append(line, label);

        return connector;

    }

    function render(options = {}) {

        const {
            foreignKeyHighlighted = false,
            traceVisible = false,
            primaryKeyHighlighted = false,
            studentHighlighted = false,
            statusText = "Select TRACE RELATION to follow a payment's STUDENT_ID."
        } = options;
        const trace = getTrace();

        stackDiv.innerHTML = "";
        stackDiv.classList.add("relational-keys-view");

        const status = document.createElement("p");
        status.className = "rk-status";
        status.textContent = statusText;

        const keyGuide = document.createElement("div");
        keyGuide.className = "rk-key-guide";
        keyGuide.innerHTML = "<span><b>PK</b> uniquely identifies a row</span><span><b>FK</b> points to a key in another table</span>";

        const layout = document.createElement("div");
        layout.className = "rk-layout";

        const tableOptions = {
            foreignKeyHighlighted,
            traceVisible,
            primaryKeyHighlighted,
            studentHighlighted
        };

        layout.append(
            createTable("students", targetTable, trace, tableOptions),
            createConnector(trace, traceVisible),
            createTable("payments", sourceTable, trace, tableOptions)
        );

        stackDiv.append(status, keyGuide, layout);

    }

    function reportMission(operation) {

        return completeAction(operation).complete;

    }

    function beginNextTrace() {

        traceIndex = (traceIndex + 1) % relationship.trace_order.length;
        phase = "find";

    }

    function traceRelation() {

        if (masteryMode) {
            setByteMessage("Choose the payment whose foreign key you want to trace in the focused mastery controls.");
            return;
        }

        const trace = getTrace();

        if (phase === "find") {
            render({
                foreignKeyHighlighted: true,
                statusText: `${trace.payment[sourceTable.primary_key]}.STUDENT_ID is ${trace.payment[relationship.foreign_key]}. This is the foreign-key value to follow.`
            });

            const missionComplete = reportMission("find-foreign-key");
            phase = "trace";

            if (!missionComplete) {
                setByteMessage(`Find ${trace.payment[relationship.foreign_key]} in the STUDENTS table. Which ID does it match?`);
            }

            return;
        }

        if (phase === "trace") {
            render({
                foreignKeyHighlighted: true,
                traceVisible: true,
                statusText: `${trace.payment[relationship.foreign_key]} travels from PAYMENTS.STUDENT_ID to STUDENTS.ID.`
            });

            const missionComplete = reportMission("trace-to-students");
            phase = "match";

            if (!missionComplete) {
                setByteMessage(`The foreign key points to the STUDENTS row whose primary key is ${trace.student[relationship.primary_key]}.`);
            }

            return;
        }

        if (phase === "match") {
            render({
                foreignKeyHighlighted: true,
                traceVisible: true,
                primaryKeyHighlighted: true,
                statusText: `STUDENTS.ID = ${trace.student[relationship.primary_key]} is a unique primary-key match.`
            });

            const missionComplete = reportMission("match-primary-key");
            phase = "identify";

            if (!missionComplete) {
                setByteMessage(`Because primary keys are unique, ${trace.student[relationship.primary_key]} identifies exactly one student.`);
            }

            return;
        }

        if (phase === "identify") {
            render({
                foreignKeyHighlighted: true,
                traceVisible: true,
                primaryKeyHighlighted: true,
                studentHighlighted: true,
                statusText: `${trace.payment[sourceTable.primary_key]} belongs to ${trace.student.name}.`
            });

            const missionComplete = reportMission("identify-student");
            phase = "complete-next";

            if (!missionComplete) {
                setByteMessage(`${trace.student.name} is the student connected to ${trace.payment[sourceTable.primary_key]}.`);
            }

            return;
        }

        beginNextTrace();
        const nextTrace = getTrace();

        render({
            foreignKeyHighlighted: true,
            traceVisible: true,
            primaryKeyHighlighted: true,
            studentHighlighted: true,
            statusText: `${nextTrace.payment[sourceTable.primary_key]}.STUDENT_ID = ${nextTrace.payment[relationship.foreign_key]} traces to ${nextTrace.student.name}.`
        });

        const missionComplete = reportMission("complete-another-relationship");
        beginNextTrace();

        if (!missionComplete) {
            setByteMessage(`Another payment can point to a different student by storing that student's ID as a foreign key.`);
        }

    }

    function traceMastery(operation) {
        if (!masteryMode) return;
        const paymentId = operation.replace("trace-", "").toUpperCase();
        const expectedId = masteryScenario?.target_payment;
        const paymentIndex = relationship.trace_order.indexOf(paymentId);

        if (paymentId !== expectedId || paymentIndex === -1) {
            masteryEngine.operationCompleted({
                operation,
                state: { outcome: null },
                feedback: `Look for ${expectedId}. Its STUDENT_ID is the foreign-key value this challenge asks you to trace.`
            });
            return;
        }

        traceIndex = paymentIndex;
        const trace = getTrace();
        phase = "complete-next";
        render({
            foreignKeyHighlighted: true,
            traceVisible: true,
            primaryKeyHighlighted: true,
            studentHighlighted: true,
            statusText: `${trace.payment[sourceTable.primary_key]}.STUDENT_ID = ${trace.payment[relationship.foreign_key]} references ${trace.student.name}.`
        });
        masteryEngine.operationCompleted({
            operation,
            state: { outcome: "matched", payment: paymentId, student: trace.student.name },
            feedback: `${paymentId} points to ${trace.student.name} through a foreign-key to primary-key match.`
        });
    }

    function configureMasteryData(scenario) {
        const students = scenario?.students || [];
        const payments = scenario?.payments || [];
        playgroundData = {
            tables: {
                students: {
                    title: "STUDENTS",
                    primary_key: "id",
                    columns: [{ key: "id", label: "ID" }, { key: "name", label: "NAME" }],
                    rows: students
                },
                payments: {
                    title: "PAYMENTS",
                    primary_key: "payment_id",
                    columns: [{ key: "payment_id", label: "PAYMENT_ID" }, { key: "student_id", label: "STUDENT_ID" }],
                    rows: payments
                }
            },
            relationship: {
                source_table: "payments",
                foreign_key: "student_id",
                target_table: "students",
                primary_key: "id",
                trace_order: payments.map(payment => payment.payment_id)
            }
        };
        ({ tables, relationship } = playgroundData);
        sourceTable = tables.payments;
        targetTable = tables.students;
        traceIndex = Math.max(0, relationship.trace_order.indexOf(scenario?.target_payment));
        phase = "find";
    }

    function renderRelationshipCard(title, scenario, container) {
        const card = document.createElement("section");
        card.className = "mastery-state-card";
        const payment = scenario?.payments?.find(item => item.payment_id === scenario?.target_payment);
        card.innerHTML = `<span class="challenge-target-label">${title}</span><p>Trace <strong>${scenario?.target_payment || "a payment"}</strong>${payment ? ` · STUDENT_ID ${payment.student_id}` : ""}</p>`;
        container.appendChild(card);
    }

    function resetRelationship() {

        traceIndex = 0;
        phase = "find";

        render({
            statusText: "Payments.STUDENT_ID values can be traced to unique STUDENTS.ID values."
        });

    }

    return {
        mount() {
            getControl("trace-relation").onclick = traceRelation;
            resetRelationship();
        },
        reset() {
            replayToken++;
            masteryScenario = null;
            masteryMode = false;
            playgroundData = LESSON.playground;
            ({ tables, relationship } = playgroundData);
            sourceTable = tables[relationship.source_table];
            targetTable = tables[relationship.target_table];
            resetRelationship();
        },
        resetForChallenge() {
            this.reset();
        },
        configureMasteryScenario(scenario) {
            replayToken++;
            masteryScenario = scenario || {};
            masteryMode = true;
            configureMasteryData(scenario);
            render({ statusText: `Trace ${scenario?.target_payment} from PAYMENTS to STUDENTS.` });
        },
        performMasteryOperation(operation) {
            if (operation.startsWith("trace-")) traceMastery(operation);
        },
        endMasteryMode() { masteryMode = false; masteryScenario = null; },
        async replayExpertSimulation(simulation) {
            if (!simulation || !Array.isArray(simulation.steps)) return;
            const token = ++replayToken;
            for (const step of simulation.steps) {
                await new Promise(resolve => window.setTimeout(resolve, 470));
                if (token !== replayToken) return;
                const paymentId = step.operation.replace("trace-", "").toUpperCase();
                const index = relationship.trace_order.indexOf(paymentId);
                if (index < 0) continue;
                traceIndex = index;
                const trace = getTrace();
                render({ foreignKeyHighlighted: true, traceVisible: true, primaryKeyHighlighted: true, studentHighlighted: true, statusText: `${paymentId} references ${trace.student.name}.` });
            }
        },
        renderExpertThinkingState({ labels }, container) {
            renderRelationshipCard(labels.title || "Related records", masteryScenario, container);
        },
        renderMasteryStates({ scenario, target }, container) {
            renderRelationshipCard("FOREIGN-KEY TASK", scenario, container);
            const goal = document.createElement("section");
            goal.className = "mastery-state-card";
            goal.innerHTML = `<span class="challenge-target-label">${target.label || "TARGET"}</span><p>${target.description || "Trace the requested foreign key to its matching primary-key row."}</p>`;
            container.appendChild(goal);
        }
    };

}


registerPlayground("relational-keys", createRelationalKeysPlayground);
