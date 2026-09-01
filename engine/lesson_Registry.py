import json
import os

from engine.validator import LessonValidator
from engine.lesson_schema import normalize_lesson


class LessonRegistry:

    def __init__(self, lesson_path="lessons"):

        self.lesson_path = lesson_path

        self.validator = LessonValidator()


    def _lesson_sort_key(self, lesson):

        return (
            lesson.get("order", float("inf")),
            lesson["title"].casefold()
        )


    def _subject_sort_key(self, section):

        return (
            section["order"],
            section["title"].casefold()
        )


    def _catalog_lesson(self, lesson):

        mastery_levels = lesson.get("mastery", {}).get("levels", [])

        return {
            "id": lesson["id"],
            "title": lesson["title"],
            "description": lesson["description"],
            "difficulty": lesson["difficulty"],
            "estimated_time": lesson["estimated_time"],
            "subject": lesson["subject"],
            "subject_slug": lesson["subject_slug"],
            "order": lesson.get("order"),
            "mastery_levels": [
                {
                    "id": level.get("id"),
                    "label": level.get("label"),
                    "kind": level.get("kind"),
                    "completion": level.get("completion")
                }
                for level in mastery_levels
                if isinstance(level, dict)
            ]
        }


    def get_all_lessons(self):

        records = []

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

                        contents = file.read()

                    # Empty files are known unused curriculum placeholders,
                    # not lesson pages. The validation command lists them
                    # separately without treating them as active failures.
                    if not contents.strip():
                        continue

                    lesson = json.loads(contents)


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


                records.append({
                    "path": file_path,
                    "subject_slug": subject,
                    "lesson": normalize_lesson(lesson)
                })


        collection_errors = self.validator.validate_collection(records)
        lessons = []

        for record in records:
            errors = collection_errors.get(record["path"], [])

            if errors:
                print(f"INVALID LESSON: {record['path']}")
                for error in errors:
                    print(f"  - {error}")
                continue

            lesson = record["lesson"]
            lesson["subject_slug"] = record["subject_slug"]
            lessons.append(lesson)


        return lessons


    def get_lessons_by_subject(self):

        return {
            section["title"]: section["lessons"]
            for section in self.get_catalog_sections()
        }


    def get_catalog_sections(self):

        sections = {}

        for lesson in self.get_all_lessons():
            subject = lesson["subject"]
            section = sections.setdefault(
                subject,
                {
                    "title": subject,
                    "order": lesson.get("subject_order", float("inf")),
                    "lessons": []
                }
            )

            section["order"] = min(
                section["order"],
                lesson.get("subject_order", float("inf"))
            )
            section["lessons"].append(lesson)


        for section in sections.values():
            section["lessons"].sort(key=self._lesson_sort_key)


        return sorted(sections.values(), key=self._subject_sort_key)


    def get_catalog_lessons(self):

        return [
            self._catalog_lesson(lesson)
            for section in self.get_catalog_sections()
            for lesson in section["lessons"]
        ]


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
