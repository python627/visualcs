"""Actionable validation for both legacy and declarative VisualCS lessons."""

import re

from engine.lesson_schema import (
    KNOWN_CAPABILITIES,
    KNOWN_PLAYGROUND_TYPES,
    is_declarative_lesson,
    normalize_lesson,
)


REQUIRED_METADATA_FIELDS = (
    "id",
    "subject",
    "topic",
    "title",
    "description",
    "difficulty",
    "estimated_time",
)
SUPPORTED_GOALS = {
    "state_equals",
    "operation_sequence",
    "outcome_equals",
    "outcome_in",
}
LESSON_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class LessonValidator:
    """Validate one lesson at a time, then validate a curriculum collection.

    The runtime accepts the original lesson format as well as the new
    declarative authoring format. Validation always operates on the normalized
    runtime view so a field is checked once, consistently.
    """

    def validate(self, source):
        errors = []

        if not isinstance(source, dict):
            return ["lesson must be a JSON object"]

        declarative = is_declarative_lesson(source)
        self._validate_authoring_container(source, errors, declarative)

        lesson = normalize_lesson(source)
        self._validate_metadata(lesson, errors)
        self._validate_capabilities(lesson, errors)
        self._validate_mission(lesson, errors)
        self._validate_playground(lesson, errors)
        self._validate_assessment(lesson, errors)
        self._validate_teaching(lesson, errors)
        self._validate_mastery(lesson, errors, declarative)

        return errors

    def _validate_authoring_container(self, source, errors, declarative):
        """Catch authoring-schema container mistakes before normalization."""

        if not declarative:
            return

        version = source.get("schema_version")
        if not isinstance(version, int) or isinstance(version, bool) or version < 2:
            errors.append("schema_version must be integer 2 or later for a declarative lesson")

        for field in ("metadata", "teaching", "visualization", "assessment"):
            if not isinstance(source.get(field), dict):
                errors.append(f"{field} must be an object")

        for field in ("practice", "completion", "expert"):
            if field in source and not isinstance(source[field], dict):
                errors.append(f"{field} must be an object when provided")

        if "learning_objectives" in source and not self._is_string_list(source["learning_objectives"]):
            errors.append("learning_objectives must be a list of strings")

    def _validate_metadata(self, lesson, errors):
        for field in REQUIRED_METADATA_FIELDS:
            value = lesson.get(field)
            if not self._is_text(value):
                errors.append(f"metadata.{field} must be a non-empty string")

        lesson_id = lesson.get("id")
        if isinstance(lesson_id, str) and lesson_id and not LESSON_ID_PATTERN.fullmatch(lesson_id):
            errors.append("metadata.id must use lowercase letters, numbers, and hyphens only")

        for field in ("order", "subject_order"):
            if field in lesson and (
                not isinstance(lesson[field], int)
                or isinstance(lesson[field], bool)
                or lesson[field] < 0
            ):
                errors.append(f"metadata.{field} must be a non-negative integer")

    def _validate_capabilities(self, lesson, errors):
        capabilities = lesson.get("capabilities", [])

        if not isinstance(capabilities, list) or not all(
            isinstance(capability, str) for capability in capabilities
        ):
            errors.append("capabilities must be a list of strings")
            return

        duplicates = sorted({
            capability for capability in capabilities if capabilities.count(capability) > 1
        })
        if duplicates:
            errors.append(f"capabilities contains duplicates: {', '.join(duplicates)}")

        unknown = sorted(set(capabilities) - KNOWN_CAPABILITIES)
        if unknown:
            errors.append(f"capabilities contains unknown values: {', '.join(unknown)}")

    def _validate_mission(self, lesson, errors):
        mission = lesson.get("mission")
        if not isinstance(mission, dict):
            errors.append("mission must be an object")
            return

        for field in ("title", "description"):
            if not self._is_text(mission.get(field)):
                errors.append(f"mission.{field} must be a non-empty string")

    def _validate_playground(self, lesson, errors):
        playground = lesson.get("playground")
        if not isinstance(playground, dict):
            errors.append("playground must be an object")
            return

        playground_type = playground.get("type")
        if not self._is_text(playground_type):
            errors.append("playground.type must be a non-empty string")
        elif playground_type not in KNOWN_PLAYGROUND_TYPES:
            errors.append(
                f"playground.type '{playground_type}' is not registered; add a playground implementation first"
            )

        self._validate_controls(playground.get("controls"), "playground.controls", errors)
        self._validate_actions(playground.get("actions"), "playground.actions", errors)
        if playground_type == "paging-translation":
            for name in ("problem", "challenge_problem"):
                problem = playground.get(name)
                if not isinstance(problem, dict):
                    errors.append(f"playground.{name} must contain paging inputs")
                    continue
                for key in ("pageSize", "logicalAddress", "logicalAddressSpace"):
                    if type(problem.get(key)) is not int:
                        errors.append(f"playground.{name}.{key} must be an integer")
                if not isinstance(problem.get("pageTable"), list):
                    errors.append(f"playground.{name}.pageTable must be a list")
                if any(key in problem for key in ("physicalAddress", "oracle", "target_state", "pageNumber", "offset")):
                    errors.append(f"playground.{name} must contain inputs only, not derived answers")
            if "guided_steps" in playground or "target_state" in playground:
                errors.append("paging uses the executable model, not scripted answer states")
        if playground_type == "sql-select":
            for name in ("problem", "challenge_problem"):
                self._validate_sql_select_problem(
                    playground.get(name),
                    f"playground.{name}",
                    errors,
                )
            if any(key in playground for key in ("guided_steps", "target_state", "initial_state")):
                errors.append("sql-select uses the executable evaluator, not scripted answer states")
        if playground_type == "transport-simulation":
            for name in ("problem", "challenge_problem"):
                self._validate_transport_problem(playground.get(name), f"playground.{name}", errors)
            if any(key in playground for key in ("guided_steps", "target_state", "initial_state")):
                errors.append("transport-simulation uses the executable event model, not scripted states")
        if playground_type == "process-states":
            for name in ("problem", "challenge_problem"):
                self._validate_process_problem(playground.get(name), f"playground.{name}", errors)
            if any(key in playground for key in ("guided_steps", "target_state", "initial_state")):
                errors.append("process-states uses the executable transition model, not scripted states")
        if playground_type == "deadlock-graph":
            for name in ("problem", "challenge_problem"):
                self._validate_deadlock_problem(playground.get(name), f"playground.{name}", errors)
            if any(key in playground for key in ("guided_steps", "target_state", "initial_state")):
                errors.append("deadlock-graph uses the executable allocation model, not scripted states")
        if playground_type == "table-records":
            problems = playground.get("problems")
            if not isinstance(problems, list) or not problems:
                errors.append("playground.problems must contain executable table tasks")
            else:
                for index, problem in enumerate(problems):
                    if not isinstance(problem, dict) or not isinstance(problem.get("task"), dict):
                        errors.append(f"playground.problems[{index}] must contain a table task")
                if not isinstance(problems[0].get("database"), dict):
                    errors.append("playground.problems[0].database must contain relational source data")
            challenge = playground.get("challenge_problem")
            if not isinstance(challenge, dict) or not isinstance(challenge.get("database"), dict) or not isinstance(challenge.get("task"), dict):
                errors.append("playground.challenge_problem must contain relational source data and a table task")
            if any(key in playground for key in ("guided_steps", "target_state", "initial_state")):
                errors.append("table-records uses the executable relational model, not scripted states")
        if playground_type == "dbms-joins":
            for name in ("problem", "challenge_problem"):
                problem = playground.get(name)
                if not isinstance(problem, dict) or not isinstance(problem.get("database"), dict):
                    errors.append(f"playground.{name} must contain relational source tables")
                elif not isinstance(problem.get("goal", {}).get("join"), dict):
                    errors.append(f"playground.{name}.goal.join must define join inputs")
                if isinstance(problem, dict) and any(key in problem for key in ("result", "joinedRows", "expectedRows", "oracle")):
                    errors.append(f"playground.{name} must not contain authored JOIN result rows")
            if any(key in playground for key in ("guided_steps", "target_state", "initial_state")):
                errors.append("dbms-joins uses JoinEvaluator, not scripted result states")
        if playground_type == "transactions":
            for name in ("problem", "challenge_problem"):
                problem = playground.get(name)
                if not isinstance(problem, dict) or not isinstance(problem.get("database"), dict) or not isinstance(problem.get("operations"), list):
                    errors.append(f"playground.{name} must contain transaction inputs and operations")
                if isinstance(problem, dict) and any(key in problem for key in ("final_state", "finalState", "expectedBalances", "oracle")):
                    errors.append(f"playground.{name} must not contain an authored final transaction state")
            if any(key in playground for key in ("guided_steps", "target_state", "initial_state")):
                errors.append("transactions uses TransactionModel, not scripted states")

    def _validate_sql_select_problem(self, problem, path, errors):
        if not isinstance(problem, dict):
            errors.append(f"{path} must contain relational inputs and a query goal")
            return
        if any(key in problem for key in ("result", "oracle", "expectedRows", "expected_rows")):
            errors.append(f"{path} must not contain authored SELECT result rows")

        database = problem.get("database")
        tables = database.get("tables") if isinstance(database, dict) else None
        if not isinstance(tables, list) or not tables:
            errors.append(f"{path}.database.tables must be a non-empty list")
            return

        table_names = set()
        table_columns = {}
        table_types = {}
        for table_index, table in enumerate(tables):
            table_path = f"{path}.database.tables[{table_index}]"
            if not isinstance(table, dict) or not self._is_text(table.get("name")):
                errors.append(f"{table_path}.name must be a non-empty string")
                continue
            name = table["name"]
            if name in table_names:
                errors.append(f"{path}.database repeats table '{name}'")
            table_names.add(name)

            columns = table.get("columns")
            if not isinstance(columns, list) or not columns:
                errors.append(f"{table_path}.columns must be a non-empty list")
                continue
            column_names = []
            types = {}
            for column_index, column in enumerate(columns):
                column_path = f"{table_path}.columns[{column_index}]"
                if not isinstance(column, dict) or not self._is_text(column.get("name")):
                    errors.append(f"{column_path}.name must be a non-empty string")
                    continue
                if column.get("type") not in ("string", "number", "boolean"):
                    errors.append(f"{column_path}.type must be string, number, or boolean")
                if column["name"] in column_names:
                    errors.append(f"{table_path} repeats column '{column['name']}'")
                column_names.append(column["name"])
                types[column["name"]] = column.get("type")
            table_columns[name] = set(column_names)
            table_types[name] = types

            rows = table.get("rows")
            if not isinstance(rows, list):
                errors.append(f"{table_path}.rows must be a list")
                continue
            row_ids = set()
            for row_index, row in enumerate(rows):
                row_path = f"{table_path}.rows[{row_index}]"
                if not isinstance(row, dict) or not self._is_text(row.get("id")) or not isinstance(row.get("values"), dict):
                    errors.append(f"{row_path} must contain id and values")
                    continue
                if row["id"] in row_ids:
                    errors.append(f"{table_path} repeats row id '{row['id']}'")
                row_ids.add(row["id"])
                if set(row["values"]) != set(column_names):
                    errors.append(f"{row_path}.values must match the explicit columns")
                    continue
                for column_name, column_type in types.items():
                    value = row["values"].get(column_name)
                    valid = (
                        column_type == "string" and isinstance(value, str)
                        or column_type == "number" and isinstance(value, (int, float)) and not isinstance(value, bool)
                        or column_type == "boolean" and isinstance(value, bool)
                    )
                    if not valid:
                        errors.append(f"{row_path}.values.{column_name} must be {column_type}")

        goal = problem.get("goal")
        query = goal.get("query") if isinstance(goal, dict) else None
        if not isinstance(goal, dict) or not self._is_text(goal.get("instruction")) or not isinstance(query, dict):
            errors.append(f"{path}.goal must contain instruction and structured query")
            return
        source = query.get("from")
        if source not in table_names:
            errors.append(f"{path}.goal.query.from references an unknown table")
            return
        selected = query.get("select")
        if not isinstance(selected, list) or not selected or not all(
            isinstance(field, str) and field in table_columns.get(source, set()) for field in selected
        ):
            errors.append(f"{path}.goal.query.select must reference source-table columns")
        where = query.get("where")
        if where is not None:
            if not isinstance(where, dict) or where.get("field") not in table_columns.get(source, set()):
                errors.append(f"{path}.goal.query.where.field must reference a source-table column")
                return
            operator = where.get("operator")
            if operator not in ("=", "!=", ">", ">=", "<", "<="):
                errors.append(f"{path}.goal.query.where.operator is unsupported")
            if table_types.get(source, {}).get(where.get("field")) != "number" and operator not in ("=", "!="):
                errors.append(f"{path}.goal.query.where uses an ordered operator on a non-number field")

    def _validate_transport_problem(self, problem, path, errors):
        if not isinstance(problem, dict):
            errors.append(f"{path} must contain transport inputs")
            return
        if any(key in problem for key in (
            "oracle", "result", "events", "final_state", "target_state", "applicationOrder"
        )):
            errors.append(f"{path} must contain inputs only, not simulator answers")
        application = problem.get("application")
        if not isinstance(application, dict) or not all(
            self._is_text(application.get(field)) for field in ("title", "need")
        ):
            errors.append(f"{path}.application must contain title and need")
        requirements = problem.get("requirements")
        if not isinstance(requirements, dict) or any(
            type(requirements.get(field)) is not bool for field in ("orderedDelivery", "lossRepair")
        ):
            errors.append(f"{path}.requirements must contain boolean orderedDelivery and lossRepair")
        packets = problem.get("packets")
        if not isinstance(packets, list) or not 2 <= len(packets) <= 8:
            errors.append(f"{path}.packets must contain 2 to 8 packets")
            packets = []
        packet_ids = set()
        sequences = set()
        for index, packet in enumerate(packets):
            packet_path = f"{path}.packets[{index}]"
            if not isinstance(packet, dict) or not all(
                self._is_text(packet.get(field)) for field in ("id", "payload", "sender", "receiver")
            ) or type(packet.get("sequence")) is not int:
                errors.append(f"{packet_path} must contain id, sequence, payload, sender, and receiver")
                continue
            if packet["sequence"] != index + 1:
                errors.append(f"{packet_path}.sequence must be the next ordered sequence number")
            if packet["id"] in packet_ids or packet["sequence"] in sequences:
                errors.append(f"{path}.packets must have unique IDs and sequence numbers")
            packet_ids.add(packet["id"])
            sequences.add(packet["sequence"])
        network = problem.get("network")
        if not isinstance(network, dict):
            errors.append(f"{path}.network must be an object")
            return
        conditions = network.get("conditions")
        if not isinstance(conditions, list) or len(conditions) != len(packets):
            errors.append(f"{path}.network.conditions must describe every packet")
            conditions = []
        condition_sequences = set()
        for index, condition in enumerate(conditions):
            condition_path = f"{path}.network.conditions[{index}]"
            if not isinstance(condition, dict) or condition.get("sequence") not in sequences:
                errors.append(f"{condition_path}.sequence must reference a packet")
                continue
            if condition["sequence"] in condition_sequences:
                errors.append(f"{path}.network.conditions repeats a sequence")
            condition_sequences.add(condition["sequence"])
            if condition.get("firstTransmission") not in ("deliver", "loss"):
                errors.append(f"{condition_path}.firstTransmission must be deliver or loss")
            if type(condition.get("delay")) is not int or condition["delay"] < 1:
                errors.append(f"{condition_path}.delay must be a positive integer")
        for field in ("sendSpacing", "timeout", "retransmissionDelay", "ackDelay"):
            if type(network.get(field)) is not int or network[field] < 0:
                errors.append(f"{path}.network.{field} must be a non-negative integer")
        if problem.get("knownProtocol") not in (None, "TCP", "UDP"):
            errors.append(f"{path}.knownProtocol must be TCP or UDP when provided")

    def _validate_process_problem(self, problem, path, errors):
        if not isinstance(problem, dict):
            errors.append(f"{path} must contain process inputs and events")
            return
        if any(key in problem for key in ("oracle", "result", "finalState", "target_state")):
            errors.append(f"{path} must contain inputs only, not model-derived answers")
        cpu_count = problem.get("cpuCount")
        if type(cpu_count) is not int or cpu_count < 1:
            errors.append(f"{path}.cpuCount must be a positive integer")
            cpu_count = 1
        processes = problem.get("processes")
        if not isinstance(processes, list) or not processes:
            errors.append(f"{path}.processes must be a non-empty list")
            return
        valid_states = {"READY", "RUNNING", "WAITING", "TERMINATED"}
        states = {}
        for index, process in enumerate(processes):
            process_path = f"{path}.processes[{index}]"
            if not isinstance(process, dict) or not self._is_text(process.get("id")):
                errors.append(f"{process_path} must contain a non-empty id")
                continue
            process_id = process["id"]
            if process_id in states:
                errors.append(f"{path}.processes repeats id '{process_id}'")
            if process.get("state") not in valid_states:
                errors.append(f"{process_path}.state must be READY, RUNNING, WAITING, or TERMINATED")
            states[process_id] = process.get("state")
        if sum(state == "RUNNING" for state in states.values()) > cpu_count:
            errors.append(f"{path} has more RUNNING processes than available CPUs")

        events = problem.get("events")
        if not isinstance(events, list) or not events:
            errors.append(f"{path}.events must be a non-empty list")
            return
        transitions = {
            "dispatch": ("READY", "RUNNING"),
            "timeslice": ("RUNNING", "READY"),
            "io_request": ("RUNNING", "WAITING"),
            "io_complete": ("WAITING", "READY"),
            "finish": ("RUNNING", "TERMINATED"),
        }
        for index, event in enumerate(events):
            event_path = f"{path}.events[{index}]"
            if not isinstance(event, dict) or event.get("type") not in transitions or event.get("process") not in states:
                errors.append(f"{event_path} must reference a known process and supported event")
                continue
            source, target = transitions[event["type"]]
            process_id = event["process"]
            if states[process_id] != source:
                errors.append(f"{event_path} requires {process_id} to be {source}, not {states[process_id]}")
                continue
            if target == "RUNNING" and sum(state == "RUNNING" for state in states.values()) >= cpu_count:
                errors.append(f"{event_path} dispatches a process when all CPUs are occupied")
                continue
            states[process_id] = target

    def _validate_deadlock_problem(self, problem, path, errors):
        if not isinstance(problem, dict):
            errors.append(f"{path} must contain resource-allocation inputs and events")
            return
        if any(key in problem for key in ("oracle", "result", "classification", "cycle", "target_state")):
            errors.append(f"{path} must contain inputs only, not model-derived answers")
        if problem.get("assumption") != "one-instance-per-resource":
            errors.append(f"{path}.assumption must explicitly be one-instance-per-resource")
        processes = problem.get("processes")
        resources = problem.get("resources")
        if not self._is_string_list(processes) or not processes:
            errors.append(f"{path}.processes must be a non-empty list of IDs")
            return
        if len(processes) != len(set(processes)):
            errors.append(f"{path}.processes must contain unique IDs")
        if not self._is_string_list(resources) or not resources:
            errors.append(f"{path}.resources must be a non-empty list of IDs")
            return
        if len(resources) != len(set(resources)):
            errors.append(f"{path}.resources must contain unique IDs")
        allocations = problem.get("allocations")
        if not isinstance(allocations, list):
            errors.append(f"{path}.allocations must be a list")
            return
        held = {}
        for index, allocation in enumerate(allocations):
            allocation_path = f"{path}.allocations[{index}]"
            if not isinstance(allocation, dict) or allocation.get("process") not in processes or allocation.get("resource") not in resources:
                errors.append(f"{allocation_path} must reference a known process and resource")
                continue
            resource = allocation["resource"]
            if resource in held:
                errors.append(f"{path}.allocations assigns the one instance of {resource} more than once")
            held[resource] = allocation["process"]

        events = problem.get("events")
        if not isinstance(events, list) or not events:
            errors.append(f"{path}.events must be a non-empty list")
            return
        requests = []
        for index, event in enumerate(events):
            event_path = f"{path}.events[{index}]"
            if not isinstance(event, dict) or event.get("type") not in ("request", "release") \
                    or event.get("process") not in processes or event.get("resource") not in resources:
                errors.append(f"{event_path} must reference a known process, resource, and request/release event")
                continue
            pair = (event["process"], event["resource"])
            if event["type"] == "request":
                if held.get(event["resource"]) == event["process"]:
                    errors.append(f"{event_path} requests a resource already held by the same process")
                elif pair in requests:
                    errors.append(f"{event_path} duplicates a pending request")
                elif event["resource"] not in held:
                    held[event["resource"]] = event["process"]
                else:
                    requests.append(pair)
            elif held.get(event["resource"]) != event["process"]:
                errors.append(f"{event_path} releases a resource the process does not hold")
            else:
                del held[event["resource"]]
                waiting = next((pair for pair in requests if pair[1] == event["resource"]), None)
                if waiting:
                    requests.remove(waiting)
                    held[event["resource"]] = waiting[0]

    def _validate_controls(self, controls, path, errors, require_id=True):
        if not isinstance(controls, list) or not controls:
            errors.append(f"{path} must be a non-empty list")
            return

        control_ids = []
        for index, control in enumerate(controls):
            prefix = f"{path}[{index}]"
            if not isinstance(control, dict):
                errors.append(f"{prefix} must be an object")
                continue

            fields = ("id", "label", "operation") if require_id else ("label", "operation")
            for field in fields:
                if not self._is_text(control.get(field)):
                    errors.append(f"{prefix}.{field} must be a non-empty string")
            if require_id:
                control_ids.append(control.get("id"))

        valid_ids = [value for value in control_ids if isinstance(value, str)]
        if len(valid_ids) != len(set(valid_ids)):
            errors.append(f"{path} ids must be unique")

    def _validate_actions(self, actions, path, errors):
        if not isinstance(actions, list) or not actions:
            errors.append(f"{path} must be a non-empty list")
            return

        for index, action in enumerate(actions):
            prefix = f"{path}[{index}]"
            if not isinstance(action, dict):
                errors.append(f"{prefix} must be an object")
                continue

            for field in ("label", "operation"):
                if not self._is_text(action.get(field)):
                    errors.append(f"{prefix}.{field} must be a non-empty string")

    def _validate_assessment(self, lesson, errors):
        quiz = lesson.get("quiz")
        if not isinstance(quiz, dict):
            errors.append("assessment.quiz must be an object")
        else:
            if not self._is_text(quiz.get("question")):
                errors.append("assessment.quiz.question must be a non-empty string")
            options = quiz.get("options")
            if not self._is_string_list(options) or len(options) < 2:
                errors.append("assessment.quiz.options must contain at least two strings")
            correct = quiz.get("correct")
            if not isinstance(correct, int) or isinstance(correct, bool):
                errors.append("assessment.quiz.correct must be an option index")
            elif isinstance(options, list) and not 0 <= correct < len(options):
                errors.append("assessment.quiz.correct must reference an existing option")

        discovery = lesson.get("discovery")
        if not isinstance(discovery, dict):
            errors.append("assessment.discovery must be an object")
        else:
            for field in ("title", "summary"):
                if not self._is_text(discovery.get(field)):
                    errors.append(f"assessment.discovery.{field} must be a non-empty string")

        self._validate_notes(lesson.get("notes"), errors)
        self._validate_alternate_explanations(lesson.get("alternate_explanations"), errors)

    def _validate_notes(self, notes, errors):
        if notes is None:
            return
        if not isinstance(notes, dict) or not isinstance(notes.get("sections"), list):
            errors.append("assessment.notes.sections must be a list")
            return
        for index, section in enumerate(notes["sections"]):
            prefix = f"assessment.notes.sections[{index}]"
            if not isinstance(section, dict):
                errors.append(f"{prefix} must be an object")
                continue
            for field in ("title", "content"):
                if not self._is_text(section.get(field)):
                    errors.append(f"{prefix}.{field} must be a non-empty string")

    def _validate_alternate_explanations(self, explanations, errors):
        if explanations is None:
            return
        if not isinstance(explanations, list):
            errors.append("assessment.alternate_explanations must be a list")
            return
        for index, explanation in enumerate(explanations):
            prefix = f"assessment.alternate_explanations[{index}]"
            if not isinstance(explanation, dict):
                errors.append(f"{prefix} must be an object")
                continue
            for field in ("title", "type", "content"):
                if not self._is_text(explanation.get(field)):
                    errors.append(f"{prefix}.{field} must be a non-empty string")

    def _validate_teaching(self, lesson, errors):
        teaching = lesson.get("teaching", {})
        if not isinstance(teaching, dict):
            errors.append("teaching must be an object")
            return

        introduction = teaching.get("introduction")
        if introduction is not None:
            self._validate_introduction(introduction, errors)

        worked_example = teaching.get("worked_example")
        if worked_example is not None:
            self._validate_worked_example(worked_example, errors)

        guided = teaching.get("guided_practice")
        if guided is not None:
            self._validate_guided_practice(guided, errors)

        challenge = teaching.get("challenge")
        if challenge is not None:
            self._validate_challenge(challenge, "practice.challenge", errors)

        recall = teaching.get("recall")
        if recall is not None:
            self._validate_recall(recall, errors)

    def _validate_introduction(self, introduction, errors):
        if not isinstance(introduction, dict):
            errors.append("teaching.introduction must be an object")
            return
        for field in ("title", "content"):
            if not self._is_text(introduction.get(field)):
                errors.append(f"teaching.introduction.{field} must be a non-empty string")
        if "points" in introduction and not self._is_string_list(introduction["points"]):
            errors.append("teaching.introduction.points must be a list of strings")
        if "visual" in introduction and not isinstance(introduction["visual"], dict):
            errors.append("teaching.introduction.visual must be an object")

    def _validate_worked_example(self, example, errors):
        if not isinstance(example, dict):
            errors.append("teaching.worked_example must be an object")
            return
        for field in ("title", "content", "conclusion"):
            if not self._is_text(example.get(field)):
                errors.append(f"teaching.worked_example.{field} must be a non-empty string")
        steps = example.get("steps")
        if not isinstance(steps, list) or not steps:
            errors.append("teaching.worked_example.steps must be a non-empty list")
        else:
            for index, step in enumerate(steps):
                prefix = f"teaching.worked_example.steps[{index}]"
                if not isinstance(step, dict):
                    errors.append(f"{prefix} must be an object")
                    continue
                for field in ("action", "explanation"):
                    if not self._is_text(step.get(field)):
                        errors.append(f"{prefix}.{field} must be a non-empty string")
                if not any(key in step for key in ("items", "visual", "state")):
                    errors.append(f"{prefix} needs items, visual, or state to show the example")
        next_step = example.get("next")
        if not isinstance(next_step, dict):
            errors.append("teaching.worked_example.next must be an object")
        else:
            for field in ("title", "content"):
                if not self._is_text(next_step.get(field)):
                    errors.append(f"teaching.worked_example.next.{field} must be a non-empty string")

    def _validate_guided_practice(self, guided, errors):
        if not isinstance(guided, dict):
            errors.append("teaching.guided_practice must be an object")
            return
        if "values" in guided and not isinstance(guided["values"], list):
            errors.append("teaching.guided_practice.values must be a list")
        explanations = guided.get("action_explanations")
        if explanations is not None:
            if not isinstance(explanations, dict) or not all(
                isinstance(value, str) or self._is_string_list(value)
                for value in explanations.values()
            ):
                errors.append("teaching.guided_practice.action_explanations must map operations to text or text lists")
        prediction = guided.get("prediction")
        if prediction is not None:
            self._validate_prediction(prediction, errors)

    def _validate_prediction(self, prediction, errors):
        if not isinstance(prediction, dict):
            errors.append("teaching.guided_practice.prediction must be an object")
            return
        for field in ("before_operation", "heading", "question", "selection_message"):
            if not self._is_text(prediction.get(field)):
                errors.append(f"teaching.guided_practice.prediction.{field} must be a non-empty string")
        if not isinstance(prediction.get("choices"), list) or not prediction["choices"]:
            errors.append("teaching.guided_practice.prediction.choices must be a non-empty list")
        result = prediction.get("result")
        if not isinstance(result, dict):
            errors.append("teaching.guided_practice.prediction.result must be an object")
        else:
            for field in ("correct", "incorrect", "actual"):
                if not self._is_text(result.get(field)):
                    errors.append(f"teaching.guided_practice.prediction.result.{field} must be a non-empty string")

    def _validate_challenge(self, challenge, path, errors):
        if not isinstance(challenge, dict):
            errors.append(f"{path} must be an object")
            return
        for field in ("title", "start_message", "continue_message"):
            if not self._is_text(challenge.get(field)):
                errors.append(f"{path}.{field} must be a non-empty string")
        phases = challenge.get("phases")
        if not isinstance(phases, list) or not phases:
            errors.append(f"{path}.phases must be a non-empty list")
            return
        for index, phase in enumerate(phases):
            self._validate_challenge_phase(phase, f"{path}.phases[{index}]", errors)

    def _validate_challenge_phase(self, phase, path, errors):
        if not isinstance(phase, dict):
            errors.append(f"{path} must be an object")
            return
        for field in ("title", "instruction", "success", "feedback"):
            if not self._is_text(phase.get(field)):
                errors.append(f"{path}.{field} must be a non-empty string")
        if phase.get("targetVisibility", "visible") not in ("visible", "hidden"):
            errors.append(f"{path}.targetVisibility must be visible or hidden")
        target = phase.get("target")
        if not isinstance(target, dict) or not self._is_text(target.get("label")):
            errors.append(f"{path}.target.label must be a non-empty string")
        goal = phase.get("goal")
        if goal is None:
            if isinstance(phase.get("expected_state"), list):
                goal = {"type": "state_equals", "expected_state": phase["expected_state"]}
            elif isinstance(phase.get("expected_operations"), list):
                goal = {"type": "operation_sequence", "operations": phase["expected_operations"]}
        self._validate_goal(goal, f"{path}.goal", errors)

    def _validate_goal(self, goal, path, errors):
        if not isinstance(goal, dict):
            errors.append(f"{path} must be an object")
            return
        goal_type = goal.get("type")
        if goal_type not in SUPPORTED_GOALS:
            errors.append(f"{path}.type '{goal_type}' is not supported")
            return
        if goal_type == "state_equals" and not (
            isinstance(goal.get("expected_state"), list)
            or self._is_text(goal.get("expected_state_from_scenario"))
        ):
            errors.append(f"{path} state_equals needs expected_state or expected_state_from_scenario")
        if "state_key" in goal and not self._is_text(goal.get("state_key")):
            errors.append(f"{path}.state_key must be a non-empty string")
        if goal_type == "operation_sequence" and not self._is_string_list(goal.get("operations")):
            errors.append(f"{path}.operations must be a list of strings")
        if goal_type == "outcome_equals" and "expected_outcome" not in goal:
            errors.append(f"{path}.expected_outcome is required")
        if goal_type == "outcome_in" and not isinstance(goal.get("expected_outcomes"), list):
            errors.append(f"{path}.expected_outcomes must be a list")

    def _validate_recall(self, recall, errors):
        if not isinstance(recall, dict):
            errors.append("completion.recall must be an object")
            return
        for field in ("title", "prompt", "submit_label", "empty_message", "completion_message", "model_answer"):
            if not self._is_text(recall.get(field)):
                errors.append(f"completion.recall.{field} must be a non-empty string")

    def _validate_mastery(self, lesson, errors, declarative):
        mastery = lesson.get("mastery")
        if mastery is None:
            return
        if not isinstance(mastery, dict):
            errors.append("mastery must be an object")
            return
        for field in ("title", "mastered_label"):
            if not self._is_text(mastery.get(field)):
                errors.append(f"mastery.{field} must be a non-empty string")
        levels = mastery.get("levels")
        if not isinstance(levels, list) or not levels:
            errors.append("mastery.levels must be a non-empty list")
            return

        declared_capabilities = set(lesson.get("capabilities", []))
        executable_sql = lesson.get("playground", {}).get("type") == "sql-select"
        executable_transport = lesson.get("playground", {}).get("type") == "transport-simulation"
        executable_process = lesson.get("playground", {}).get("type") == "process-states"
        executable_deadlock = lesson.get("playground", {}).get("type") == "deadlock-graph"
        executable_tables = lesson.get("playground", {}).get("type") == "table-records"
        executable_join = lesson.get("playground", {}).get("type") == "dbms-joins"
        executable_transaction = lesson.get("playground", {}).get("type") == "transactions"
        level_ids = []
        for index, level in enumerate(levels):
            path = f"mastery.levels[{index}]"
            if not isinstance(level, dict):
                errors.append(f"{path} must be an object")
                continue
            level_ids.append(level.get("id"))
            if level.get("targetVisibility", "visible") not in ("visible", "hidden"):
                errors.append(f"{path}.targetVisibility must be visible or hidden")
            for field in ("id", "label"):
                if not self._is_text(level.get(field)):
                    errors.append(f"{path}.{field} must be a non-empty string")
            prerequisites = level.get("prerequisites", [])
            if not self._is_string_list(prerequisites):
                errors.append(f"{path}.prerequisites must be a list of strings")
            self._validate_level_guidance(level.get("guidance", {}), f"{path}.guidance", errors)
            self._validate_level_constraints(level.get("constraints", {}), f"{path}.constraints", errors)
            if "controls" in level:
                self._validate_controls(
                    level.get("controls"),
                    f"{path}.controls",
                    errors,
                    require_id=False
                )

            if level.get("completion", {}).get("type") == "course_completion":
                continue
            if level.get("kind") == "expert":
                self._validate_expert(level.get("expert"), path, errors, declared_capabilities, declarative)
                if executable_sql and level.get("expert", {}).get("generator") != "sql-select":
                    errors.append(f"{path}.expert must use the sql-select evaluator-backed generator")
                if executable_transport and level.get("expert", {}).get("generator") != "transport":
                    errors.append(f"{path}.expert must use the transport simulator-backed generator")
                if executable_process and level.get("expert", {}).get("generator") != "process":
                    errors.append(f"{path}.expert must use the process model-backed generator")
                if executable_deadlock and level.get("expert", {}).get("generator") != "deadlock":
                    errors.append(f"{path}.expert must use the deadlock model-backed generator")
                if executable_tables and level.get("expert", {}).get("generator") != "table-records":
                    errors.append(f"{path}.expert must use the table-record model-backed generator")
                if executable_join and level.get("expert", {}).get("generator") != "join":
                    errors.append(f"{path}.expert must use the JOIN evaluator-backed generator")
                if executable_transaction and level.get("expert", {}).get("generator") != "transaction":
                    errors.append(f"{path}.expert must use the transaction model-backed generator")
                continue

            scenario = level.get("scenario")
            if not isinstance(scenario, dict):
                errors.append(f"{path}.scenario must be an object")
            elif "generator" in scenario:
                if not self._is_text(scenario.get("generator")):
                    errors.append(f"{path}.scenario.generator must be a non-empty string")
                if not isinstance(scenario.get("generator_version"), int) or scenario["generator_version"] < 1:
                    errors.append(f"{path}.scenario.generator_version must be a positive integer")
                if "scenario_rules" in scenario and not isinstance(scenario["scenario_rules"], dict):
                    errors.append(f"{path}.scenario.scenario_rules must be an object")
                if executable_sql and scenario.get("generator") != "sql-select":
                    errors.append(f"{path}.scenario must use the sql-select evaluator-backed generator")
                if executable_transport and scenario.get("generator") != "transport":
                    errors.append(f"{path}.scenario must use the transport simulator-backed generator")
                if executable_process and scenario.get("generator") != "process":
                    errors.append(f"{path}.scenario must use the process model-backed generator")
                if executable_deadlock and scenario.get("generator") != "deadlock":
                    errors.append(f"{path}.scenario must use the deadlock model-backed generator")
                if executable_tables and scenario.get("generator") != "table-records":
                    errors.append(f"{path}.scenario must use the table-record model-backed generator")
                if executable_join and scenario.get("generator") != "join":
                    errors.append(f"{path}.scenario must use the JOIN evaluator-backed generator")
                if executable_transaction and scenario.get("generator") != "transaction":
                    errors.append(f"{path}.scenario must use the transaction model-backed generator")
            elif executable_sql or executable_transport or executable_process or executable_deadlock or executable_tables or executable_join or executable_transaction:
                generator_name = (
                    "sql-select evaluator" if executable_sql else
                    "transport simulator" if executable_transport else
                    "process model" if executable_process else
                    "deadlock model" if executable_deadlock else
                    "table-record model" if executable_tables else
                    "JOIN evaluator" if executable_join else
                    "transaction model"
                )
                errors.append(f"{path}.scenario must use the {generator_name}-backed generator")

            challenge = level.get("challenge")
            if not isinstance(challenge, dict) or not isinstance(challenge.get("phases"), list) or not challenge["phases"]:
                errors.append(f"{path}.challenge.phases must be a non-empty list")
            else:
                for phase_index, phase in enumerate(challenge["phases"]):
                    self._validate_challenge_phase(phase, f"{path}.challenge.phases[{phase_index}]", errors)

        valid_ids = [level_id for level_id in level_ids if isinstance(level_id, str)]
        if len(valid_ids) != len(set(valid_ids)):
            errors.append("mastery.levels ids must be unique")
        valid_id_set = set(valid_ids)
        for index, level in enumerate(levels):
            if isinstance(level, dict):
                for prerequisite in level.get("prerequisites", []):
                    if prerequisite not in valid_id_set:
                        errors.append(f"mastery.levels[{index}].prerequisites references unknown level '{prerequisite}'")

    def _validate_level_guidance(self, guidance, path, errors):
        if not isinstance(guidance, dict):
            errors.append(f"{path} must be an object")
            return
        if "start_message" in guidance and not self._is_text(guidance["start_message"]):
            errors.append(f"{path}.start_message must be a non-empty string")
        hints = guidance.get("hints")
        if hints is None:
            return
        if not isinstance(hints, dict):
            errors.append(f"{path}.hints must be an object")
            return
        if not isinstance(hints.get("limit"), int) or hints["limit"] < 0:
            errors.append(f"{path}.hints.limit must be a non-negative integer")
        if not isinstance(hints.get("items"), list) or not all(
            isinstance(item, dict) and self._is_text(item.get("content"))
            for item in hints["items"]
        ):
            errors.append(f"{path}.hints.items must contain content strings")

    def _validate_level_constraints(self, constraints, path, errors):
        if not isinstance(constraints, dict):
            errors.append(f"{path} must be an object")
            return
        for field in ("max_operations", "max_hints"):
            if field in constraints and (
                not isinstance(constraints[field], int)
                or isinstance(constraints[field], bool)
                or constraints[field] < 0
            ):
                errors.append(f"{path}.{field} must be a non-negative integer")
        if "operation_limit_message" in constraints and not self._is_text(constraints["operation_limit_message"]):
            errors.append(f"{path}.operation_limit_message must be a non-empty string")

    def _validate_expert(self, expert, path, errors, declared_capabilities, declarative):
        if not isinstance(expert, dict):
            errors.append(f"{path}.expert must be an object")
            return
        if not self._is_text(expert.get("generator")):
            errors.append(f"{path}.expert.generator must be a non-empty string")
        if expert.get("targetVisibility", "visible") not in ("visible", "hidden"):
            errors.append(f"{path}.expert.targetVisibility must be visible or hidden")
        if expert.get("assessment_mode", "execution") not in ("execution", "prediction"):
            errors.append(f"{path}.expert.assessment_mode must be execution or prediction")
        if not isinstance(expert.get("generator_version"), int) or expert["generator_version"] < 1:
            errors.append(f"{path}.expert.generator_version must be a positive integer")
        for section in ("thinking", "solve"):
            if not isinstance(expert.get(section), dict):
                errors.append(f"{path}.expert.{section} must be an object")
        required = expert.get("required_capabilities")
        if required is None and declarative:
            errors.append(f"{path}.expert.required_capabilities must declare the capabilities Expert needs")
        elif required is not None:
            if not self._is_string_list(required):
                errors.append(f"{path}.expert.required_capabilities must be a list of strings")
            else:
                unknown = sorted(set(required) - KNOWN_CAPABILITIES)
                missing = sorted(set(required) - declared_capabilities)
                if unknown:
                    errors.append(f"{path}.expert.required_capabilities contains unknown values: {', '.join(unknown)}")
                if missing:
                    errors.append(f"{path}.expert requires undeclared capabilities: {', '.join(missing)}")

    def validate_collection(self, records):
        """Return source-path keyed errors that require curriculum context."""

        errors_by_path = {}
        by_id = {}
        by_subject_order = {}

        for record in records:
            lesson = record.get("lesson", {})
            path = record.get("path", "<unknown file>")
            lesson_id = lesson.get("id")
            subject = lesson.get("subject")
            order = lesson.get("order")
            if isinstance(lesson_id, str):
                by_id.setdefault(lesson_id, []).append(path)
            if isinstance(subject, str) and isinstance(order, int):
                by_subject_order.setdefault((subject, order), []).append(path)

        for lesson_id, paths in by_id.items():
            if len(paths) > 1:
                for path in paths:
                    errors_by_path.setdefault(path, []).append(
                        f"duplicate lesson id '{lesson_id}' (also declared in another lesson file)"
                    )

        for (subject, order), paths in by_subject_order.items():
            if len(paths) > 1:
                for path in paths:
                    errors_by_path.setdefault(path, []).append(
                        f"duplicate lesson order {order} in subject '{subject}'"
                    )

        return errors_by_path

    @staticmethod
    def _is_text(value):
        return isinstance(value, str) and bool(value.strip())

    @staticmethod
    def _is_string_list(value):
        return isinstance(value, list) and all(
            isinstance(item, str) and bool(item.strip()) for item in value
        )
