/* Run: node --test tests/joins.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js', 'engine/relational_model.js', 'engine/join_evaluator.js', 'engine/join_generator.js']) vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
const relational = vm.runInContext('RelationalModel', context);
const joins = vm.runInContext('JoinEvaluator', context);
const generator = vm.runInContext('JoinGenerator', context);
const factory = vm.runInContext('ScenarioFactory', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const lesson = JSON.parse(fs.readFileSync('lessons/dbms/joins.json', 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
function db(rightRows) {
    return relational.createDatabase({ tables: [
        { name: 'lefts', columns: [{ name: 'key', type: 'number' }, { name: 'name', type: 'string' }], rows: [
            { id: 'l1', values: { key: 1, name: 'A' } }, { id: 'l2', values: { key: 2, name: 'B' } }, { id: 'l3', values: { key: 3, name: 'C' } }
        ] },
        { name: 'rights', columns: [{ name: 'key', type: 'number' }, { name: 'value', type: 'string' }], rows: rightRows }
    ] });
}
const spec = type => ({ leftTable: 'lefts', leftColumn: 'key', rightTable: 'rights', rightColumn: 'key', type });
const responseFor = problem => {
    const result = joins.execute(problem.database, problem.goal.join);
    return { joinType: problem.goal.join.type, leftColumn: problem.goal.join.leftColumn, rightColumn: problem.goal.join.rightColumn, matchingPairs: result.pairs.map(pair => pair.id).join(',') || 'NONE' };
};

test('INNER JOIN computes one-to-one matches', () => {
    const result = joins.execute(db([{ id: 'r1', values: { key: 1, value: 'X' } }, { id: 'r2', values: { key: 2, value: 'Y' } }]), spec('inner'));
    assert.deepEqual(plain(result.pairs.map(pair => pair.id)), ['l1+r1', 'l2+r2']);
});

test('one-to-many matching creates multiple output rows', () => {
    const result = joins.execute(db([{ id: 'r1', values: { key: 1, value: 'X' } }, { id: 'r2', values: { key: 1, value: 'Y' } }]), spec('inner'));
    assert.deepEqual(plain(result.pairs.map(pair => pair.id)), ['l1+r1', 'l1+r2']);
});

test('INNER JOIN omits unmatched rows', () => {
    const result = joins.execute(db([{ id: 'r1', values: { key: 9, value: 'X' } }]), spec('inner'));
    assert.equal(result.rows.length, 0);
});

test('duplicate keys preserve every Cartesian equal-key combination', () => {
    const database = db([{ id: 'r1', values: { key: 1, value: 'X' } }, { id: 'r2', values: { key: 1, value: 'Y' } }]);
    relational.getTable(database, 'lefts').rows.push({ id: 'l4', values: { key: 1, name: 'D' } });
    const result = joins.execute(database, spec('inner'));
    assert.deepEqual(plain(result.pairs.map(pair => pair.id)), ['l1+r1', 'l1+r2', 'l4+r1', 'l4+r2']);
});

test('LEFT JOIN preserves unmatched left rows with NULL right values', () => {
    const result = joins.execute(db([{ id: 'r1', values: { key: 1, value: 'X' } }]), spec('left'));
    assert.deepEqual(plain(result.pairs.map(pair => pair.id)), ['l1+r1', 'l2+NULL', 'l3+NULL']);
    assert.equal(result.rows[1].values['rights.value'], null);
});

test('invalid columns and incompatible types fail explicitly', () => {
    const database = db([]);
    assert.throws(() => joins.execute(database, { ...spec('inner'), leftColumn: 'missing' }), /Unknown field/);
    assert.throws(() => joins.execute(database, { ...spec('inner'), rightColumn: 'value' }), /compatible/);
    assert.throws(() => joins.execute(database, { ...spec('cross'), type: 'cross' }), /Unsupported/);
});

test('field assessment uses evaluator output as its oracle', () => {
    const database = db([{ id: 'r1', values: { key: 1, value: 'X' } }]);
    const correct = joins.assessGoal(database, spec('left'), spec('left'), ['l1+r1', 'l2+NULL', 'l3+NULL']);
    assert.equal(correct.allCorrect, true);
    assert.equal(joins.assessGoal(database, spec('left'), spec('inner'), ['l1+r1']).allCorrect, false);
});

test('256 seeded JOIN scenarios reproduce, vary, include duplicates/unmatched, and leak no rows', () => {
    const fingerprints = new Set(); let duplicates = 0, unmatched = 0;
    for (let seed = 1; seed <= 256; seed++) {
        const first = factory.create(lesson.expert, { seed });
        const again = factory.create(lesson.expert, { seed });
        assert.deepEqual(plain(first), plain(again)); generator.validateScenario(first.data); fingerprints.add(first.fingerprint);
        const result = joins.execute(first.data.problem.database, first.data.problem.goal.join);
        if (result.pairs.some((pair, index, pairs) => pairs.findIndex(other => other.leftRowId === pair.leftRowId) !== index)) duplicates++;
        if (result.pairs.some(pair => pair.rightRowId === null)) unmatched++;
        assert.equal(JSON.stringify(first.data).includes('joinedRows'), false);
        assert.equal(JSON.stringify(generator.getMentalSimulation(first.data)).includes('actualResult'), false);
    }
    assert.ok(fingerprints.size > 200); assert.ok(duplicates > 100); assert.ok(unmatched > 20);
    console.log(`256 JOIN seeds: ${fingerprints.size} distinct; ${duplicates} one-to-many, ${unmatched} LEFT-unmatched.`);
});

test('Expert result is hidden and wrong or partial predictions cannot complete', () => {
    const scenario = factory.create(lesson.expert, { seed: 31 });
    const partial = new Runner({ definition: lesson.expert, scenario });
    assert.notEqual(partial.submitPrediction({ joinType: 'inner' }).status, 'expert_perfect');
    const wrong = new Runner({ definition: lesson.expert, scenario });
    assert.notEqual(wrong.submitPrediction({ joinType: 'inner', leftColumn: 'student_id', rightColumn: 'student_id', matchingPairs: 'NONE' }).status, 'expert_perfect');
    const correct = new Runner({ definition: lesson.expert, scenario });
    assert.equal(correct.submitPrediction(responseFor(scenario.data.problem)).status, 'expert_perfect');
});

test('mastery bypass attempts do not satisfy the challenge', () => {
    const challenge = new Challenge({ phases: [{ goal: { type: 'outcome_equals', expected_outcome: 'solved' } }] });
    assert.notEqual(challenge.reportOperation({ operation: 'join-attempt', state: { outcome: 'attempted' } }).status, 'challenge_completed');
    assert.equal(challenge.reportOperation({ operation: 'run-join', state: { outcome: 'solved' } }).status, 'challenge_completed');
});

test('lesson stores source inputs and no scripted joined result', () => {
    const text = JSON.stringify(lesson.visualization);
    assert.equal(text.includes('next_state'), false); assert.equal(text.includes('JOINED'), false); assert.equal(text.includes('expectedRows'), false);
    assert.equal(lesson.expert.generator, 'join');
});
