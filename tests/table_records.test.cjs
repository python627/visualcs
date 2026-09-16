/* Run: node --test tests/table_records.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js', 'engine/relational_model.js', 'engine/table_record_model.js', 'engine/table_record_generator.js']) {
    vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
}
const relational = vm.runInContext('RelationalModel', context);
const model = vm.runInContext('TableRecordModel', context);
const generator = vm.runInContext('TableRecordGenerator', context);
const factory = vm.runInContext('ScenarioFactory', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const lesson = JSON.parse(fs.readFileSync('lessons/dbms/tables-records.json', 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
const database = () => relational.createDatabase({ tables: [{ name: 'people', columns: [
    { name: 'id', type: 'number' }, { name: 'name', type: 'string' }, { name: 'active', type: 'boolean' }
], rows: [{ id: 'p1', values: { id: 1, name: 'Ana', active: true } }] }] });

function responseFor(problem) {
    const outcome = model.execute(problem.database, problem.task);
    if (outcome.answer !== undefined) return { answer: String(outcome.answer) };
    const before = relational.getTable(problem.database, problem.task.table);
    const after = relational.getTable(outcome.database, problem.task.table);
    if (problem.task.kind === 'add-record') return { validity: outcome.valid ? 'valid' : 'invalid', rowCount: after.rows.length };
    return { validity: outcome.valid ? 'valid' : 'invalid', resultValue: after.rows.find(row => row.id === problem.task.rowId).values[problem.task.column] };
}

test('schema validation rejects unknown columns and missing typed fields', () => {
    const table = relational.getTable(database(), 'people');
    assert.equal(relational.validateRecord(table, { id: 'p2', values: { id: 2, name: 'Ben', active: false } }).valid, true);
    assert.equal(relational.validateRecord(table, { id: 'p2', values: { id: 2, name: 'Ben' } }).valid, false);
    assert.equal(relational.validateRecord(table, { id: 'p2', values: { id: 2, name: 'Ben', active: false, age: 20 } }).valid, false);
});

test('row validation enforces number, string, and boolean types', () => {
    const table = relational.getTable(database(), 'people');
    assert.equal(relational.validateRecord(table, { id: 'p2', values: { id: '2', name: 'Ben', active: false } }).valid, false);
    assert.equal(relational.validateRecord(table, { id: 'p2', values: { id: 2, name: 99, active: false } }).valid, false);
    assert.equal(relational.validateRecord(table, { id: 'p2', values: { id: 2, name: 'Ben', active: 'yes' } }).valid, false);
});

test('valid add and edit create new databases without mutating source', () => {
    const source = database();
    const added = relational.addRecord(source, 'people', { id: 'p2', values: { id: 2, name: 'Ben', active: false } });
    const edited = relational.editField(added, 'people', 'p2', 'name', 'Beno');
    assert.equal(relational.getTable(source, 'people').rows.length, 1);
    assert.equal(relational.getTable(added, 'people').rows[1].values.name, 'Ben');
    assert.equal(relational.getTable(edited, 'people').rows[1].values.name, 'Beno');
});

test('invalid records and edits fail explicitly', () => {
    assert.throws(() => relational.addRecord(database(), 'people', { id: 'p2', values: { id: 2, name: 'Ben', active: 'no' } }), /must be boolean/);
    assert.throws(() => relational.editField(database(), 'people', 'p1', 'id', 'one'), /must be number/);
    assert.throws(() => relational.editField(database(), 'people', 'missing', 'name', 'X'), /Unknown row/);
});

test('row identity remains stable and duplicate ids are rejected', () => {
    const source = database();
    const edited = relational.editField(source, 'people', 'p1', 'name', 'Asha');
    assert.equal(relational.getTable(edited, 'people').rows[0].id, 'p1');
    assert.throws(() => relational.addRecord(source, 'people', { id: 'p1', values: { id: 2, name: 'Ben', active: false } }), /already exists/);
});

test('field-level assessment rejects wrong predictions and accepts correct consequences', () => {
    const problem = { database: database(), task: { kind: 'edit-field', table: 'people', rowId: 'p1', column: 'active', value: 'no' } };
    assert.equal(model.assess(problem.database, problem.task, { validity: 'valid', resultValue: 'no' }).allCorrect, false);
    const correct = responseFor(problem);
    assert.equal(model.assess(problem.database, problem.task, correct).allCorrect, true);
});

test('256 seeded table scenarios reproduce, vary, validate, and expose no answer table', () => {
    const definition = lesson.expert;
    const fingerprints = new Set();
    let valid = 0, invalid = 0;
    for (let seed = 1; seed <= 256; seed++) {
        const first = factory.create(definition, { seed });
        const again = factory.create(definition, { seed });
        assert.deepEqual(plain(first), plain(again));
        generator.validateScenario(first.data);
        fingerprints.add(first.fingerprint);
        const outcome = model.execute(first.data.problem.database, first.data.problem.task);
        outcome.valid ? valid++ : invalid++;
        const publicView = generator.getMentalSimulation(first.data);
        assert.equal(JSON.stringify(publicView).includes('expectedTable'), false);
        assert.equal(JSON.stringify(first.data).includes('oracle'), false);
    }
    assert.ok(fingerprints.size > 200);
    assert.ok(valid > 50 && invalid > 50);
    console.log(`256 table seeds: ${fingerprints.size} distinct; ${valid} valid, ${invalid} invalid.`);
});

test('Expert keeps consequence hidden and rejects wrong numeric answers', () => {
    const scenario = factory.create(lesson.expert, { seed: 17 });
    const publicView = generator.getMentalSimulation(scenario.data);
    assert.equal('result' in publicView, false);
    const wrong = new Runner({ definition: lesson.expert, scenario });
    assert.notEqual(wrong.submitPrediction({ validity: 'valid', rowCount: 999 }).status, 'expert_perfect');
    const correct = new Runner({ definition: lesson.expert, scenario });
    assert.equal(correct.submitPrediction(responseFor(scenario.data.problem)).status, 'expert_perfect');
});

test('mastery cannot be bypassed with an attempted outcome', () => {
    const challenge = new Challenge({ phases: [{ goal: { type: 'outcome_equals', expected_outcome: 'solved' } }] });
    assert.notEqual(challenge.reportOperation({ operation: 'table-attempt', state: { outcome: 'attempted' } }).status, 'challenge_completed');
    assert.equal(challenge.reportOperation({ operation: 'check-table', state: { outcome: 'solved' } }).status, 'challenge_completed');
});

test('lesson contains executable inputs and no scripted transition states', () => {
    const text = JSON.stringify(lesson.visualization);
    assert.equal(text.includes('guided_steps'), false);
    assert.equal(text.includes('next_state'), false);
    assert.equal(text.includes('expectedTable'), false);
    assert.equal(lesson.expert.generator, 'table-records');
});
