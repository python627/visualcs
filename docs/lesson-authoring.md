# VisualCS lesson authoring

VisualCS has two supported lesson formats:

- Legacy files keep the original top-level keys and continue to work unchanged.
- New lessons should use the declarative schema below. The server normalizes it
  into the stable browser runtime shape before the Teaching and Mastery Engines
  receive it.

Run validation from the project root before opening a lesson:

```text
python validate_lessons.py
```

The command prints valid lessons, separately lists empty placeholder files,
and exits with an error for broken active lessons.

## Declarative schema

```json
{
  "schema_version": 2,
  "metadata": {
    "id": "kebab-case-id",
    "order": 1,
    "subject_order": 1,
    "subject": "Subject name",
    "topic": "Concept name",
    "title": "Lesson title",
    "description": "Short catalog description.",
    "difficulty": "Beginner",
    "estimated_time": "10 min"
  },
  "learning_objectives": ["A learner can explain the main idea."],
  "capabilities": ["interactive_state"],
  "teaching": {
    "mission": { "title": "Mission", "description": "Try the concept." },
    "introduction": {},
    "worked_example": {},
    "guided_practice": {}
  },
  "visualization": {
    "type": "registered-playground-type",
    "controls": [],
    "actions": []
  },
  "practice": { "challenge": {} },
  "mastery": { "title": "Topic Mastery", "mastered_label": "Topic Mastered", "levels": [] },
  "expert": {},
  "assessment": {
    "quiz": {},
    "discovery": {},
    "notes": { "sections": [] },
    "alternate_explanations": []
  },
  "completion": { "recall": {} }
}
```

Every section except `metadata`, `teaching`, `visualization`, and `assessment`
is optional. Within those objects, individual teaching stages are optional.
Missing stages are skipped by the Teaching Engine.

`practice.challenge` becomes `teaching.challenge` at runtime, and
`completion.recall` becomes `teaching.recall`. A top-level `expert` object is
appended to `mastery.levels` at runtime, which keeps the Mastery Engine’s
single ordered level list intact.

## Capabilities

Capabilities describe interaction *kinds*, never a particular data structure.
Declare only what the lesson uses:

| Capability | Use it for |
| --- | --- |
| `interactive_state` | A learner changes a visible state. |
| `prediction` | A learner predicts an outcome before it is shown. |
| `sequence_simulation` | A learner mentally simulates a sequence. |
| `target_transformation` | A learner transforms a start state into a target. |
| `decision_tree` | A learner chooses among branches. |
| `calculation` | A learner derives a numeric result. |
| `relationship_reasoning` | A learner matches related records or entities. |
| `routing` | A learner chooses a path or hop. |
| `sorting` | A learner orders values through comparisons. |
| `scheduling` | A learner decides execution order or time allocation. |

An Expert level can list `required_capabilities`. Validation fails if the
lesson does not declare them. This prevents an Expert configuration from
claiming support for a type of interaction its lesson does not provide.

## Reusable teaching content

The shared template renders short introduction, worked-example, prediction,
challenge, recall, quiz, discovery, notes, alternate explanations, and
completion components. Use simple teaching-state visual types in introduction
or worked examples when helpful:

- `stack`
- `queue`
- `array`
- `sequence`
- `text`

These are deliberately lightweight content views. Do not use them as a
replacement for a live tree, network, table, or animation—the dedicated
playground owns those visualizations.

## Playground contract

Register a playground with `registerPlayground(type, factory)`. A factory only
implements the methods its lesson needs:

```text
mount()                         Required: bind normal lesson controls and render.
reset()                         Required: restore the regular lesson state.
resetForChallenge()             Optional: prepare beginner challenge state.
configureMasteryScenario(data)  Optional: load a mastery/expert scenario.
performMasteryOperation(op, options) Optional: perform a configured attempt action.
endMasteryMode()                Optional: return to normal free play.
renderChallengeTarget(target, element) Optional: show a structure-specific target.
renderMasteryStates(data, element) Optional: show start/current/target states.
renderExpertThinkingState(data, element) Optional: show mental-simulation input.
replayExpertSimulation(data)    Optional: replay the predicted sequence.
```

The playground keeps domain behaviour: state, permitted operations, rendering,
and animation. When an operation finishes, it reports a neutral event:

```js
teachingEngine.operationCompleted({ operation, value, removedValue, state });
// or, during mastery/expert:
masteryEngine.operationCompleted({ operation, state, feedback, progress });
```

Teaching prose, stage order, constraints, targets, and assessment content stay
in lesson JSON. Do not add teaching sentences to a playground implementation.

## Mastery and Expert

`mastery.levels` is an ordered list. The Learn level normally uses:

```json
{ "id": "learn", "label": "Learn", "completion": { "type": "course_completion" } }
```

Other levels provide `scenario`, a `challenge.phases` list, optional `controls`,
guidance, and constraints. Challenge goals are reusable:

- `state_equals`
- `operation_sequence`
- `outcome_equals`
- `outcome_in`

Expert uses a registered scenario generator. Add an `expert` object with
`generator`, `generator_version`, `thinking`, `solve`, and
`required_capabilities`. The generator belongs beside the playground when it
contains domain logic; `ScenarioFactory` and `ExpertAttemptRunner` provide
seeding, replay, prediction flow, scoring, and persistence.

## Adding a lesson

1. Copy the closest file in `docs/lesson-templates/`.
2. Create `lessons/<subject-folder>/<lesson-id>.json`.
3. If the concept needs a new live visualization, create and register one
   focused playground implementation. Otherwise reuse the existing type.
4. Add the playground script to `templates/index.html` only when it is new.
5. Add its type to `KNOWN_PLAYGROUND_TYPES` in `engine/lesson_schema.py`.
6. Add a scenario generator only if generated Mastery or Expert scenarios need
   domain logic.
7. Run `python validate_lessons.py`, then open the lesson and test its full
   journey. The registry and dashboard discover valid JSON automatically.

Subjects are grouped from `metadata.subject`; ordering uses `subject_order`,
then `order`. A duplicate order inside a subject is a validation error.
