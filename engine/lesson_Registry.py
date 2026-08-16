import json
import os

from engine.validator import LessonValidator


class LessonRegistry:

    def __init__(self, lesson_path="lessons"):

        self.lesson_path = lesson_path

        self.validator = LessonValidator()


    def _lesson_sort_key(self, lesson):

        return (
            lesson.get("order", float("inf")),
            lesson["title"].casefold()
        )


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


                lesson["subject_slug"] = subject

                lessons.append(lesson)


        return lessons


    def get_lessons_by_subject(self):

        subjects = {}

        for lesson in self.get_all_lessons():

            subject = lesson["subject"]

            if subject not in subjects:
                subjects[subject] = []

            subjects[subject].append(lesson)


        for lessons in subjects.values():
            lessons.sort(key=self._lesson_sort_key)


        return dict(sorted(subjects.items()))


    def get_lessons_for_subject(self, subject_slug):

        lessons = [
            lesson
            for lesson in self.get_all_lessons()
            if lesson["subject_slug"] == subject_slug
        ]

        return sorted(lessons, key=self._lesson_sort_key)


    def get_next_lesson(self, subject_slug, lesson_id):

        lessons = self.get_lessons_for_subject(subject_slug)

        for index, lesson in enumerate(lessons):
            if lesson["id"] == lesson_id:
                return lessons[index + 1] if index + 1 < len(lessons) else None

        return None
