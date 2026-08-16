from flask import Flask, render_template, redirect, url_for

from engine.lesson_loader import LessonLoader
from engine.lesson_Registry import LessonRegistry


app = Flask(__name__)


lesson_loader = LessonLoader()
lesson_registry = LessonRegistry()


@app.route("/")
def home():

    subjects = lesson_registry.get_lessons_by_subject()

    return render_template(
        "library.html",
        subjects=subjects
    )


@app.route("/lesson/<subject>/<lesson>")
def lesson(subject, lesson):

    lesson_data = lesson_loader.load(
        subject,
        lesson
    )

    next_lesson = lesson_registry.get_next_lesson(
        subject,
        lesson_data["id"]
    )

    return render_template(
        "index.html",
        lesson=lesson_data,
        next_lesson=next_lesson
    )


if __name__ == "__main__":
    app.run(debug=True)
