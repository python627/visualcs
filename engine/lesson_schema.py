"""Shared lesson-schema helpers for the VisualCS curriculum.

The browser still receives the established runtime lesson shape.  New lessons
can instead use the declarative schema (``metadata``, ``visualization``,
``practice``, ``assessment`` and ``completion``); this module adapts that
shape at the boundary rather than forcing the teaching and playground engines
to support two formats.
"""

from copy import deepcopy


LESSON_SCHEMA_VERSION = 2


# These are learning interactions, not subjects or playground implementations.
# A lesson can declare only the capabilities it uses.
KNOWN_CAPABILITIES = frozenset({
    "interactive_state",
    "prediction",
    "sequence_simulation",
    "target_transformation",
    "decision_tree",
    "calculation",
    "relationship_reasoning",
    "routing",
    "sorting",
    "scheduling",
    "array_access",
    "hashing",
    "heap_operations",
    "searching",
    "divide_and_conquer",
    "graph_traversal",
})


# Browser registration remains the source of rendering behaviour.  Keeping the
# supported identifiers here lets server-side validation report a useful error
# before a learner reaches a broken lesson page.
KNOWN_PLAYGROUND_TYPES = frozenset({
    "stack",
    "queue",
    "linked-list",
    "binary-search-tree",
    "binary-search",
    "bubble-sort",
    "fcfs-scheduling",
    "round-robin-scheduling",
    "relational-keys",
    "packet-routing",
    "selection-sort",
    "array-operations",
    "hash-table",
    "min-heap",
    "linear-search",
    "insertion-sort",
    "merge-sort",
    "breadth-first-search",
    "depth-first-search",
    "process-states",
    "deadlock-graph",
    "paging-translation",
    "table-records",
    "sql-select",
    "dbms-joins",
    "normalization",
    "transactions",
    "ip-addresses",
    "dns-lookup",
    "tcp-udp",
    "transport-simulation",
    "http-request",
})


def is_declarative_lesson(lesson):
    """Return whether a JSON document uses the authoring schema."""

    return isinstance(lesson, dict) and (
        "metadata" in lesson
        or lesson.get("schema_version") == LESSON_SCHEMA_VERSION
    )


def normalize_lesson(lesson):
    """Adapt a declarative lesson into the existing browser runtime shape.

    Legacy lesson files are copied unchanged apart from harmless defaults, so
    the established lessons retain their present runtime contract.
    """

    source = deepcopy(lesson) if isinstance(lesson, dict) else {}

    if not is_declarative_lesson(source):
        source.setdefault("schema_version", 1)
        source.setdefault("capabilities", [])
        return source

    metadata = source.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    teaching = source.get("teaching")
    teaching = deepcopy(teaching) if isinstance(teaching, dict) else {}
    practice = source.get("practice")
    practice = practice if isinstance(practice, dict) else {}
    assessment = source.get("assessment")
    assessment = assessment if isinstance(assessment, dict) else {}
    completion = source.get("completion")
    completion = completion if isinstance(completion, dict) else {}

    if "challenge" not in teaching and "challenge" in practice:
        teaching["challenge"] = deepcopy(practice["challenge"])

    if "recall" not in teaching and "recall" in completion:
        teaching["recall"] = deepcopy(completion["recall"])

    visualization = source.get("visualization")
    playground = visualization if isinstance(visualization, dict) else source.get("playground")

    normalized = {
        **metadata,
        "schema_version": source.get("schema_version", LESSON_SCHEMA_VERSION),
        "learning_objectives": deepcopy(source.get("learning_objectives", [])),
        "capabilities": deepcopy(source.get("capabilities", [])),
        "teaching": teaching,
        "mission": deepcopy(teaching.get("mission", source.get("mission"))),
        "playground": deepcopy(playground),
        "quiz": deepcopy(assessment.get("quiz", source.get("quiz"))),
        "discovery": deepcopy(assessment.get("discovery", source.get("discovery"))),
        "notes": deepcopy(assessment.get("notes", source.get("notes"))),
        "alternate_explanations": deepcopy(
            assessment.get("alternate_explanations", source.get("alternate_explanations"))
        ),
        "mastery": deepcopy(source.get("mastery")),
        "completion": deepcopy(completion),
    }

    # Do not add null optional fields to the browser object.  Existing template
    # conditionals and engines already handle their absence naturally.
    normalized = {
        key: value
        for key, value in normalized.items()
        if value is not None
    }

    expert = source.get("expert")
    if isinstance(expert, dict):
        mastery = normalized.setdefault("mastery", {})
        if isinstance(mastery, dict):
            levels = mastery.setdefault("levels", [])
            if isinstance(levels, list):
                if isinstance(expert.get("expert"), dict):
                    expert_level = deepcopy(expert)
                    expert_level.setdefault("id", "expert")
                    expert_level.setdefault("label", "Expert")
                    expert_level.setdefault("kind", "expert")
                else:
                    expert_level = {
                        "id": expert.get("id", "expert"),
                        "label": expert.get("label", "Expert"),
                        "kind": "expert",
                        "expert": {
                            key: deepcopy(value)
                            for key, value in expert.items()
                            if key not in {"id", "label", "kind", "prerequisites"}
                        },
                    }
                if "prerequisites" in expert:
                    expert_level["prerequisites"] = deepcopy(expert["prerequisites"])
                elif "prerequisites" not in expert_level and levels:
                    previous_id = levels[-1].get("id") if isinstance(levels[-1], dict) else None
                    if previous_id:
                        expert_level["prerequisites"] = [previous_id]
                levels.append(expert_level)

    return normalized


def lesson_identity(lesson):
    """Return the declarative or legacy lesson id for diagnostic messages."""

    if not isinstance(lesson, dict):
        return "<invalid lesson>"

    metadata = lesson.get("metadata")
    if isinstance(metadata, dict):
        return metadata.get("id") or "<missing id>"

    return lesson.get("id") or "<missing id>"
