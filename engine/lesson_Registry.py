import json
import os

from engine.validator import LessonValidator


class LessonRegistry:

    def __init__(self, lesson_path="lessons"):

        self.lesson_path = lesson_path

        self.validator = LessonValidator()


    def get_all_lessons(self):

        lessons = []

        for subject in os.listdir(self.lesson_path):

            subject_path = os.path.join(
                self.lesson_path,
                subject
            )

            if not os.path.isdir(subject_path):
                continue


            for filename in os.listdir(subject_path):

                if not filename.endswith(".json"):
                    continue


                file_path = os.path.join(
                    subject_path,
                    filename
                )


                try:

                    with open(
                        file_path,
                        "r",
                        encoding="utf-8"
                    ) as file:

                        lesson = json.load(file)


                except json.JSONDecodeError as error:

                    print(
                        f"INVALID JSON: {file_path}"
                    )

                    print(
                        f"ERROR: {error}"
                    )

                    continue


                errors = self.validator.validate(
                    lesson
                )


                if errors:

                    print(
                        f"INVALID LESSON: {file_path}"
                    )

                    for error in errors:

                        print(
                            f"  - {error}"
                        )

                    continue


                lessons.append(lesson)


        return lessons