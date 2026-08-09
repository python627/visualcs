import json
import os


class LessonLoader:

    def __init__(self, lesson_path="lessons"):
        self.lesson_path = lesson_path


    def load(self, subject, lesson):

        path = os.path.join(

            self.lesson_path,

            subject,

            f"{lesson}.json"

        )

        with open(path, "r", encoding="utf-8") as file:

            return json.load(file)