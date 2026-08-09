from flask import Flask, render_template, redirect, url_for

from engine.lesson_loader import LessonLoader
from engine.lesson_Registry import LessonRegistry


app = Flask(__name__)


lesson_loader = LessonLoader()
lesson_registry = LessonRegistry()


@app.route("/")
def home():

    lessons = lesson_registry.get_all_lessons()

    return render_template(
        "library.html",
        lessons=lessons
    )


@app.route("/lesson/<subject>/<lesson>")
def lesson(subject, lesson):

    lesson_data = lesson_loader.load(
        subject,
        lesson
    )

    return render_template(
        "index.html",
        lesson=lesson_data
    )


if __name__ == "__main__":
    app.run(debug=True)