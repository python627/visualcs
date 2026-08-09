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

            if "actions" not in lesson["playground"]:
                errors.append(
                    "playground.actions is missing"
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


        return errors