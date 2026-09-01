"""Validate the active VisualCS curriculum from the project root.

Run with the same Python environment used for the Flask project:

    python validate_lessons.py
"""

import json
from pathlib import Path

from engine.lesson_schema import normalize_lesson
from engine.validator import LessonValidator


LESSONS_DIRECTORY = Path("lessons")


def is_empty_placeholder(contents):
    """Empty JSON files are intentionally-unused lesson placeholders."""

    return not contents.strip()


def main():
    validator = LessonValidator()
    records = []
    valid = []
    skipped = []
    invalid = []

    for path in sorted(LESSONS_DIRECTORY.rglob("*.json")):
        relative_path = path.as_posix()
        contents = path.read_text(encoding="utf-8")

        if is_empty_placeholder(contents):
            skipped.append((relative_path, "empty placeholder"))
            continue

        try:
            source = json.loads(contents)
        except json.JSONDecodeError as error:
            invalid.append((relative_path, [f"invalid JSON: {error.msg} (line {error.lineno}, column {error.colno})"]))
            continue

        errors = validator.validate(source)
        if errors:
            invalid.append((relative_path, errors))
            continue

        records.append({
            "path": relative_path,
            "lesson": normalize_lesson(source),
        })

    collection_errors = validator.validate_collection(records)

    for record in records:
        errors = collection_errors.get(record["path"], [])
        if errors:
            invalid.append((record["path"], errors))
        else:
            valid.append(record["lesson"])

    print("VisualCS lesson validation")
    print(f"Valid lessons ({len(valid)}):")
    for lesson in valid:
        print(f"  [OK] {lesson['id']} - {lesson['title']}")

    print(f"Skipped placeholders ({len(skipped)}):")
    for path, reason in skipped:
        print(f"  [SKIP] {path} ({reason})")

    if invalid:
        print(f"Errors ({len(invalid)}):")
        for path, errors in invalid:
            print(f"  [ERROR] {path}")
            for error in errors:
                print(f"      - {error}")
        return 1

    print("No active-lesson errors found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
