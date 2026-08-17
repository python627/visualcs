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

                        if not isinstance(step.get("items"), list):
                            errors.append(
                                f"worked_example.steps[{index}].items must be a list"
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

                        if not isinstance(phase.get("expected_state"), list):
                            errors.append(
                                f"challenge.phases[{index}].expected_state must be a list"
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

                            if not isinstance(target.get("items"), list):
                                errors.append(
                                    f"challenge.phases[{index}].target.items must be a list"
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
