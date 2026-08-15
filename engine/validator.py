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


        return errors
