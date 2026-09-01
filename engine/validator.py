REQUIRED_FIELDS = [
    "id",
    "subject",
    "topic",
    "title",
    "description",
    "difficulty",
    "estimated_time",
    "mission",
    "playground",
    "quiz",
    "discovery"
]


class LessonValidator:

    def validate(self, lesson):

        errors = []

        # Check top-level fields
        for field in REQUIRED_FIELDS:

            if field not in lesson:

                errors.append(
                    f"Missing field: {field}"
                )


        # Stop here if important fields are missing
        if errors:
            return errors


        # Validate optional lesson ordering metadata
        if "order" in lesson and (
            not isinstance(lesson["order"], int)
            or isinstance(lesson["order"], bool)
        ):
            errors.append(
                "order must be an integer"
            )


        # Validate mission
        if not isinstance(lesson["mission"], dict):

            errors.append(
                "mission must be an object"
            )

        else:

            if "title" not in lesson["mission"]:
                errors.append(
                    "mission.title is missing"
                )

            if "description" not in lesson["mission"]:
                errors.append(
                    "mission.description is missing"
                )


        # Validate playground
        if not isinstance(lesson["playground"], dict):

            errors.append(
                "playground must be an object"
            )

        else:

            if "type" not in lesson["playground"]:
                errors.append(
                    "playground.type is missing"
                )

            if "controls" not in lesson["playground"]:
                errors.append(
                    "playground.controls is missing"
                )

            elif not isinstance(lesson["playground"]["controls"], list):
                errors.append(
                    "playground.controls must be a list"
                )

            else:
                for index, control in enumerate(lesson["playground"]["controls"]):

                    if not isinstance(control, dict):
                        errors.append(
                            f"playground.controls[{index}] must be an object"
                        )

                        continue

                    for field in ("id", "label", "operation"):
                        if not isinstance(control.get(field), str):
                            errors.append(
                                f"playground.controls[{index}].{field} must be a string"
                            )

            if "actions" not in lesson["playground"]:
                errors.append(
                    "playground.actions is missing"
                )

            elif not isinstance(lesson["playground"]["actions"], list):
                errors.append(
                    "playground.actions must be a list"
                )

            else:
                for index, action in enumerate(lesson["playground"]["actions"]):

                    if not isinstance(action, dict):
                        errors.append(
                            f"playground.actions[{index}] must be an object"
                        )

                        continue

                    if not isinstance(action.get("label"), str):
                        errors.append(
                            f"playground.actions[{index}].label must be a string"
                        )

                    if not isinstance(action.get("operation"), str):
                        errors.append(
                            f"playground.actions[{index}].operation must be a string"
                        )


        # Validate quiz
        if not isinstance(lesson["quiz"], dict):

            errors.append(
                "quiz must be an object"
            )

        else:

            if "question" not in lesson["quiz"]:
                errors.append(
                    "quiz.question is missing"
                )

            if "options" not in lesson["quiz"]:
                errors.append(
                    "quiz.options is missing"
                )

            if "correct" not in lesson["quiz"]:
                errors.append(
                    "quiz.correct is missing"
                )


        # Validate discovery
        if not isinstance(lesson["discovery"], dict):

            errors.append(
                "discovery must be an object"
            )

        else:

            if "title" not in lesson["discovery"]:
                errors.append(
                    "discovery.title is missing"
                )

            if "summary" not in lesson["discovery"]:
                errors.append(
                    "discovery.summary is missing"
                )


        # Teaching stages are optional and may be supplied together under a
        # reusable teaching object. The existing root-level fields remain
        # supported so established lessons keep validating unchanged.
        teaching = lesson.get("teaching")

        if teaching is not None:
            if not isinstance(teaching, dict):
                errors.append(
                    "teaching must be an object"
                )

            else:
                effective_lesson = dict(lesson)

                for field in (
                    "introduction",
                    "worked_example",
                    "challenge",
                    "recall"
                ):
                    if field in teaching:
                        effective_lesson[field] = teaching[field]

                guided_practice = teaching.get("guided_practice")

                if guided_practice is not None:
                    effective_lesson["guided_teaching"] = guided_practice

                lesson = effective_lesson


        # Validate optional mastery progression configuration
        if "mastery" in lesson:

            mastery = lesson["mastery"]

            if not isinstance(mastery, dict):
                errors.append(
                    "mastery must be an object"
                )

            else:
                for field in ("title", "mastered_label"):
                    if not isinstance(mastery.get(field), str):
                        errors.append(
                            f"mastery.{field} must be a string"
                        )

                levels = mastery.get("levels")

                if not isinstance(levels, list) or not levels:
                    errors.append(
                        "mastery.levels must be a non-empty list"
                    )

                else:
                    level_ids = []

                    for index, level in enumerate(levels):

                        if not isinstance(level, dict):
                            errors.append(
                                f"mastery.levels[{index}] must be an object"
                            )
                            continue

                        for field in ("id", "label"):
                            if not isinstance(level.get(field), str):
                                errors.append(
                                    f"mastery.levels[{index}].{field} must be a string"
                                )

                        level_ids.append(level.get("id"))

                        prerequisites = level.get("prerequisites", [])

                        if not isinstance(prerequisites, list) or not all(
                            isinstance(prerequisite, str)
                            for prerequisite in prerequisites
                        ):
                            errors.append(
                                f"mastery.levels[{index}].prerequisites must contain strings"
                            )

                        completion = level.get("completion")

                        level_kind = level.get("kind")

                        if level_kind is not None and not isinstance(level_kind, str):
                            errors.append(
                                f"mastery.levels[{index}].kind must be a string"
                            )

                        if completion is not None and (
                            not isinstance(completion, dict)
                            or completion.get("type") != "course_completion"
                        ):
                            errors.append(
                                f"mastery.levels[{index}].completion.type must be course_completion"
                            )

                        guidance = level.get("guidance", {})

                        if not isinstance(guidance, dict):
                            errors.append(
                                f"mastery.levels[{index}].guidance must be an object"
                            )

                        else:
                            if "start_message" in guidance and not isinstance(
                                guidance["start_message"], str
                            ):
                                errors.append(
                                    f"mastery.levels[{index}].guidance.start_message must be a string"
                                )

                            hints = guidance.get("hints")

                            if hints is not None:
                                if not isinstance(hints, dict):
                                    errors.append(
                                        f"mastery.levels[{index}].guidance.hints must be an object"
                                    )
                                else:
                                    limit = hints.get("limit")

                                    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 0:
                                        errors.append(
                                            f"mastery.levels[{index}].guidance.hints.limit must be a non-negative integer"
                                        )

                                    items = hints.get("items")

                                    if not isinstance(items, list) or not all(
                                        isinstance(item, dict)
                                        and isinstance(item.get("content"), str)
                                        for item in items
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].guidance.hints.items must contain content strings"
                                        )

                        if "operation_rule" in level and not isinstance(
                            level["operation_rule"], str
                        ):
                            errors.append(
                                f"mastery.levels[{index}].operation_rule must be a string"
                            )

                        metrics = level.get("metrics")

                        if metrics is not None and (
                            not isinstance(metrics, dict)
                            or (
                                "operation_label" in metrics
                                and not isinstance(metrics["operation_label"], str)
                            )
                        ):
                            errors.append(
                                f"mastery.levels[{index}].metrics.operation_label must be a string"
                            )

                        controls = level.get("controls")

                        if controls is not None and (
                            not isinstance(controls, list)
                            or not all(
                                isinstance(control, dict)
                                and isinstance(control.get("operation"), str)
                                and isinstance(control.get("label"), str)
                                for control in controls
                            )
                        ):
                            errors.append(
                                f"mastery.levels[{index}].controls must contain operation and label strings"
                            )

                        if level_kind == "expert":
                            expert = level.get("expert")

                            if not isinstance(expert, dict):
                                errors.append(
                                    f"mastery.levels[{index}].expert must be an object"
                                )
                            else:
                                if not isinstance(expert.get("generator"), str):
                                    errors.append(
                                        f"mastery.levels[{index}].expert.generator must be a string"
                                    )

                                generator_version = expert.get("generator_version")

                                if (
                                    not isinstance(generator_version, int)
                                    or isinstance(generator_version, bool)
                                    or generator_version < 1
                                ):
                                    errors.append(
                                        f"mastery.levels[{index}].expert.generator_version must be a positive integer"
                                    )

                                if "replayable" in expert and not isinstance(
                                    expert["replayable"], bool
                                ):
                                    errors.append(
                                        f"mastery.levels[{index}].expert.replayable must be a boolean"
                                    )

                                if not isinstance(expert.get("scenario_rules", {}), dict):
                                    errors.append(
                                        f"mastery.levels[{index}].expert.scenario_rules must be an object"
                                    )

                                for section_name in ("thinking", "solve"):
                                    section = expert.get(section_name)

                                    if not isinstance(section, dict):
                                        errors.append(
                                            f"mastery.levels[{index}].expert.{section_name} must be an object"
                                        )

                        if completion is None and level_kind != "expert":
                            scenario = level.get("scenario")

                            if not isinstance(scenario, dict):
                                errors.append(
                                    f"mastery.levels[{index}].scenario must be an object"
                                )
                            else:
                                if "generator" in scenario:
                                    if not isinstance(scenario.get("generator"), str):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.generator must be a string"
                                        )

                                    if (
                                        not isinstance(scenario.get("generator_version"), int)
                                        or isinstance(scenario.get("generator_version"), bool)
                                        or scenario.get("generator_version") < 1
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.generator_version must be a positive integer"
                                        )

                                    if not isinstance(scenario.get("scenario_rules", {}), dict):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.scenario_rules must be an object"
                                        )

                                elif scenario.get("type") == "binary-search":
                                    values = scenario.get("values")

                                    if (
                                        not isinstance(values, list)
                                        or not values
                                        or not all(
                                            isinstance(value, (int, float))
                                            and not isinstance(value, bool)
                                            for value in values
                                        )
                                        or any(values[position - 1] >= values[position] for position in range(1, len(values)))
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.values must be a sorted numeric list"
                                        )

                                    if not isinstance(scenario.get("target"), (int, float)) or isinstance(
                                        scenario.get("target"), bool
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.target must be numeric"
                                        )

                                elif "initial_state" in scenario or "operation_values" in scenario:
                                    if not isinstance(scenario.get("initial_state"), list):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.initial_state must be a list"
                                        )

                                    operation_values = scenario.get("operation_values")

                                    if not isinstance(operation_values, dict) or not all(
                                        isinstance(operation, str)
                                        and isinstance(values, list)
                                        for operation, values in operation_values.items()
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.operation_values must map operations to lists"
                                        )

                                elif "values" in scenario:
                                    values = scenario.get("values")

                                    if not isinstance(values, list) or not values or not all(
                                        isinstance(value, (int, float))
                                        and not isinstance(value, bool)
                                        for value in values
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.values must be a non-empty numeric list"
                                        )

                                elif "processes" in scenario:
                                    processes = scenario.get("processes")

                                    if not isinstance(processes, list) or not processes or not all(
                                        isinstance(process, dict)
                                        and isinstance(process.get("id"), str)
                                        and isinstance(process.get("burst"), int)
                                        and not isinstance(process.get("burst"), bool)
                                        and process["burst"] > 0
                                        for process in processes
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario.processes must contain process ids and positive bursts"
                                        )

                                elif "students" in scenario or "payments" in scenario:
                                    if (
                                        not isinstance(scenario.get("students"), list)
                                        or not isinstance(scenario.get("payments"), list)
                                        or not isinstance(scenario.get("target_payment"), str)
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario relational data must include students, payments, and target_payment"
                                        )

                                elif "route" in scenario:
                                    if (
                                        not isinstance(scenario.get("route"), list)
                                        or len(scenario["route"]) < 2
                                        or not all(isinstance(node, str) for node in scenario["route"])
                                        or not isinstance(scenario.get("destination"), str)
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].scenario route must contain node ids and a destination"
                                        )

                                else:
                                    errors.append(
                                        f"mastery.levels[{index}].scenario needs a supported domain state"
                                    )

                            challenge = level.get("challenge")

                            if not isinstance(challenge, dict) or not isinstance(
                                challenge.get("phases"), list
                            ) or not challenge["phases"]:
                                errors.append(
                                    f"mastery.levels[{index}].challenge.phases must be a non-empty list"
                                )
                            else:
                                for phase_index, phase in enumerate(challenge["phases"]):
                                    prefix = f"mastery.levels[{index}].challenge.phases[{phase_index}]"

                                    if not isinstance(phase, dict):
                                        errors.append(f"{prefix} must be an object")
                                        continue

                                    for field in ("title", "instruction", "success", "feedback"):
                                        if not isinstance(phase.get(field), str):
                                            errors.append(f"{prefix}.{field} must be a string")

                                    target = phase.get("target")

                                    if not isinstance(target, dict) or not isinstance(
                                        target.get("label"), str
                                    ):
                                        errors.append(f"{prefix}.target.label must be a string")

                                    goal = phase.get("goal")

                                    if not isinstance(goal, dict):
                                        errors.append(f"{prefix}.goal must be an object")
                                    elif goal.get("type") == "state_equals":
                                        if (
                                            not isinstance(goal.get("expected_state_from_scenario"), str)
                                            and not isinstance(goal.get("expected_state"), list)
                                        ):
                                            errors.append(f"{prefix}.goal.expected_state must be a list")
                                    elif goal.get("type") == "operation_sequence":
                                        if not isinstance(goal.get("operations"), list) or not all(
                                            isinstance(operation, str)
                                            for operation in goal["operations"]
                                        ):
                                            errors.append(f"{prefix}.goal.operations must contain strings")
                                    elif goal.get("type") == "outcome_equals":
                                        if "expected_outcome" not in goal:
                                            errors.append(f"{prefix}.goal.expected_outcome is required")
                                    elif goal.get("type") == "outcome_in":
                                        if not isinstance(goal.get("expected_outcomes"), list) or not all(
                                            isinstance(outcome, str)
                                            for outcome in goal["expected_outcomes"]
                                        ):
                                            errors.append(f"{prefix}.goal.expected_outcomes must contain strings")
                                    else:
                                        errors.append(f"{prefix}.goal.type is not supported")

                            constraints = level.get("constraints", {})

                            if not isinstance(constraints, dict):
                                errors.append(
                                    f"mastery.levels[{index}].constraints must be an object"
                                )
                            else:
                                for field in ("max_operations", "max_hints"):
                                    if field in constraints and (
                                        not isinstance(constraints[field], int)
                                        or isinstance(constraints[field], bool)
                                        or constraints[field] < 0
                                    ):
                                        errors.append(
                                            f"mastery.levels[{index}].constraints.{field} must be a non-negative integer"
                                        )

                                if "operation_limit_message" in constraints and not isinstance(
                                    constraints["operation_limit_message"], str
                                ):
                                    errors.append(
                                        f"mastery.levels[{index}].constraints.operation_limit_message must be a string"
                                    )

                    if len(level_ids) != len(set(level_ids)):
                        errors.append("mastery.levels ids must be unique")

                    valid_level_ids = {
                        level_id for level_id in level_ids
                        if isinstance(level_id, str)
                    }

                    for index, level in enumerate(levels):
                        if not isinstance(level, dict):
                            continue

                        for prerequisite in level.get("prerequisites", []):
                            if prerequisite not in valid_level_ids:
                                errors.append(
                                    f"mastery.levels[{index}].prerequisites references an unknown level"
                                )


        # Validate optional notes
        if "notes" in lesson:

            if not isinstance(lesson["notes"], dict):
                errors.append(
                    "notes must be an object"
                )

            elif not isinstance(lesson["notes"].get("sections"), list):
                errors.append(
                    "notes.sections must be a list"
                )

            else:
                for index, section in enumerate(lesson["notes"]["sections"]):

                    if not isinstance(section, dict):
                        errors.append(
                            f"notes.sections[{index}] must be an object"
                        )

                        continue

                    for field in ("title", "content"):
                        if not isinstance(section.get(field), str):
                            errors.append(
                                f"notes.sections[{index}].{field} must be a string"
                            )


        # Validate optional alternate explanations
        if "alternate_explanations" in lesson:

            if not isinstance(lesson["alternate_explanations"], list):
                errors.append(
                    "alternate_explanations must be a list"
                )

            else:
                for index, explanation in enumerate(
                    lesson["alternate_explanations"]
                ):

                    if not isinstance(explanation, dict):
                        errors.append(
                            f"alternate_explanations[{index}] must be an object"
                        )

                        continue

                    for field in ("title", "type", "content"):
                        if not isinstance(explanation.get(field), str):
                            errors.append(
                                f"alternate_explanations[{index}].{field} must be a string"
                            )


        # Validate optional beginner introduction
        if "introduction" in lesson:

            introduction = lesson["introduction"]

            if not isinstance(introduction, dict):
                errors.append(
                    "introduction must be an object"
                )

            else:
                for field in ("title", "content"):
                    if not isinstance(introduction.get(field), str):
                        errors.append(
                            f"introduction.{field} must be a string"
                        )

                if "points" in introduction:
                    if not isinstance(introduction["points"], list):
                        errors.append(
                            "introduction.points must be a list"
                        )

                    elif not all(
                        isinstance(point, str)
                        for point in introduction["points"]
                    ):
                        errors.append(
                            "introduction.points must contain strings"
                        )

                if "visual" in introduction:
                    visual = introduction["visual"]

                    if not isinstance(visual, dict):
                        errors.append(
                            "introduction.visual must be an object"
                        )

                    else:
                        for field in ("type", "label"):
                            if not isinstance(visual.get(field), str):
                                errors.append(
                                    f"introduction.visual.{field} must be a string"
                                )

                        visual_type = visual.get("type")
                        label_fields = {
                            "stack": ("top_label",),
                            "queue": ("front_label", "rear_label"),
                        }.get(visual_type, ())

                        for field in label_fields:
                            if not isinstance(visual.get(field), str):
                                errors.append(
                                    f"introduction.visual.{field} must be a string"
                                )

                        if not isinstance(visual.get("items"), list):
                            errors.append(
                                "introduction.visual.items must be a list"
                            )


        # Validate optional worked example
        if "worked_example" in lesson:

            worked_example = lesson["worked_example"]

            if not isinstance(worked_example, dict):
                errors.append(
                    "worked_example must be an object"
                )

            else:
                for field in ("title", "content", "conclusion"):
                    if not isinstance(worked_example.get(field), str):
                        errors.append(
                            f"worked_example.{field} must be a string"
                        )

                if "visual_type" in worked_example and not isinstance(
                    worked_example["visual_type"],
                    str
                ):
                    errors.append(
                        "worked_example.visual_type must be a string"
                    )

                if not isinstance(worked_example.get("steps"), list):
                    errors.append(
                        "worked_example.steps must be a list"
                    )

                else:
                    for index, step in enumerate(worked_example["steps"]):

                        if not isinstance(step, dict):
                            errors.append(
                                f"worked_example.steps[{index}] must be an object"
                            )

                            continue

                        for field in ("action", "explanation"):
                            if not isinstance(step.get(field), str):
                                errors.append(
                                    f"worked_example.steps[{index}].{field} must be a string"
                                )

                        has_items = isinstance(step.get("items"), list)
                        has_visual = isinstance(step.get("visual"), str)

                        if not has_items and not has_visual:
                            errors.append(
                                f"worked_example.steps[{index}] must include items or a visual string"
                            )

                next_step = worked_example.get("next")

                if not isinstance(next_step, dict):
                    errors.append(
                        "worked_example.next must be an object"
                    )

                else:
                    for field in ("title", "content"):
                        if not isinstance(next_step.get(field), str):
                            errors.append(
                                f"worked_example.next.{field} must be a string"
                            )


        # Validate optional guided teaching interactions
        if "guided_teaching" in lesson:

            guided_teaching = lesson["guided_teaching"]

            if not isinstance(guided_teaching, dict):
                errors.append(
                    "guided_teaching must be an object"
                )

            else:
                if "values" in guided_teaching and not isinstance(
                    guided_teaching["values"],
                    list
                ):
                    errors.append(
                        "guided_teaching.values must be a list"
                    )

                action_explanations = guided_teaching.get(
                    "action_explanations"
                )

                if action_explanations is not None and not isinstance(
                    action_explanations,
                    dict
                ):
                    errors.append(
                        "guided_teaching.action_explanations must be an object"
                    )

                prediction = guided_teaching.get("prediction")

                if prediction is not None:
                    if not isinstance(prediction, dict):
                        errors.append(
                            "guided_teaching.prediction must be an object"
                        )

                    else:
                        for field in (
                            "before_operation",
                            "heading",
                            "question",
                            "selection_message"
                        ):
                            if not isinstance(prediction.get(field), str):
                                errors.append(
                                    f"guided_teaching.prediction.{field} must be a string"
                                )

                        for field in ("pending_message", "required_message"):
                            if field in prediction and not isinstance(
                                prediction[field],
                                str
                            ):
                                errors.append(
                                    f"guided_teaching.prediction.{field} must be a string"
                                )

                        if "result_operation" in prediction and not isinstance(
                            prediction["result_operation"],
                            str
                        ):
                            errors.append(
                                "guided_teaching.prediction.result_operation must be a string"
                            )

                        if not isinstance(prediction.get("choices"), list):
                            errors.append(
                                "guided_teaching.prediction.choices must be a list"
                            )

                        result = prediction.get("result")

                        if not isinstance(result, dict):
                            errors.append(
                                "guided_teaching.prediction.result must be an object"
                            )

                        else:
                            for field in ("correct", "incorrect", "actual"):
                                if not isinstance(result.get(field), str):
                                    errors.append(
                                        f"guided_teaching.prediction.result.{field} must be a string"
                                    )

                            if "correct_actual" in result and not isinstance(
                                result["correct_actual"],
                                str
                            ):
                                errors.append(
                                    "guided_teaching.prediction.result.correct_actual must be a string"
                                )

                            concept = result.get("concept")

                            if not isinstance(concept, dict):
                                errors.append(
                                    "guided_teaching.prediction.result.concept must be an object"
                                )

                            else:
                                for field in (
                                    "last_in",
                                    "arrow",
                                    "first_out",
                                    "label"
                                ):
                                    if not isinstance(concept.get(field), str):
                                        errors.append(
                                            f"guided_teaching.prediction.result.concept.{field} must be a string"
                                        )


        # Validate optional lesson challenge
        if "challenge" in lesson:

            challenge = lesson["challenge"]

            if not isinstance(challenge, dict):
                errors.append(
                    "challenge must be an object"
                )

            else:
                for field in ("title", "start_message", "continue_message"):
                    if not isinstance(challenge.get(field), str):
                        errors.append(
                            f"challenge.{field} must be a string"
                        )

                if not isinstance(challenge.get("phases"), list):
                    errors.append(
                        "challenge.phases must be a list"
                    )

                else:
                    for index, phase in enumerate(challenge["phases"]):

                        if not isinstance(phase, dict):
                            errors.append(
                                f"challenge.phases[{index}] must be an object"
                            )

                            continue

                        for field in (
                            "title",
                            "instruction",
                            "success",
                            "feedback"
                        ):
                            if not isinstance(phase.get(field), str):
                                errors.append(
                                    f"challenge.phases[{index}].{field} must be a string"
                                )

                        has_expected_state = isinstance(
                            phase.get("expected_state"), list
                        )
                        has_expected_operations = isinstance(
                            phase.get("expected_operations"), list
                        )

                        if not has_expected_state and not has_expected_operations:
                            errors.append(
                                f"challenge.phases[{index}] must include expected_state or expected_operations"
                            )

                        target = phase.get("target")

                        if not isinstance(target, dict):
                            errors.append(
                                f"challenge.phases[{index}].target must be an object"
                            )

                        else:
                            if not isinstance(target.get("label"), str):
                                errors.append(
                                    f"challenge.phases[{index}].target.label must be a string"
                                )

                            target_label_fields = {
                                "stack": ("top_label",),
                                "queue": ("front_label", "rear_label"),
                            }.get(lesson.get("playground", {}).get("type"), ())

                            for field in target_label_fields:
                                if not isinstance(target.get(field), str):
                                    errors.append(
                                        f"challenge.phases[{index}].target.{field} must be a string"
                                    )

                            has_target_items = isinstance(
                                target.get("items"), list
                            )
                            has_target_description = isinstance(
                                target.get("description"), str
                            )

                            if not has_target_items and not has_target_description:
                                errors.append(
                                    f"challenge.phases[{index}].target must include items or a description"
                                )

                        operation_values = phase.get("operation_values")

                        if operation_values is not None:
                            if not isinstance(operation_values, dict):
                                errors.append(
                                    f"challenge.phases[{index}].operation_values must be an object"
                                )

                            elif not all(
                                isinstance(operation, str)
                                and isinstance(values, list)
                                for operation, values in operation_values.items()
                            ):
                                errors.append(
                                    f"challenge.phases[{index}].operation_values must map operations to lists"
                                )

                        if "progressive" in phase and not isinstance(
                            phase["progressive"],
                            bool
                        ):
                            errors.append(
                                f"challenge.phases[{index}].progressive must be a boolean"
                            )

                        if "progress_operations" in phase and (
                            not isinstance(phase["progress_operations"], list)
                            or not all(
                                isinstance(operation, str)
                                for operation in phase["progress_operations"]
                            )
                        ):
                            errors.append(
                                f"challenge.phases[{index}].progress_operations must contain strings"
                            )

                        if "expected_operations" in phase and (
                            not isinstance(phase["expected_operations"], list)
                            or not phase["expected_operations"]
                            or not all(
                                isinstance(operation, str)
                                for operation in phase["expected_operations"]
                            )
                        ):
                            errors.append(
                                f"challenge.phases[{index}].expected_operations must be a non-empty list of strings"
                            )


        # Validate optional retrieval-practice recall
        if "recall" in lesson:

            recall = lesson["recall"]

            if not isinstance(recall, dict):
                errors.append(
                    "recall must be an object"
                )

            else:
                for field in (
                    "title",
                    "prompt",
                    "submit_label",
                    "empty_message",
                    "completion_message",
                    "model_answer"
                ):
                    if not isinstance(recall.get(field), str):
                        errors.append(
                            f"recall.{field} must be a string"
                        )


        return errors
