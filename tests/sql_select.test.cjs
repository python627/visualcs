/* Run: node --test tests/sql_select.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of [
    'scenario_factory.js',
    'challenge_runner.js',
    'expert_attempt_runner.js',
    'engine/relational_model.js',
    'engine/select_evaluator.js',
    'engine/sql_select_generator.js'
]) vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });

const relational = vm.runInContext('RelationalModel', context);
const select = vm.runInContext('SelectEvaluator', context);
const generator = vm.runInContext('SqlSelectGenerator', context);
const factory = vm.runInContext('ScenarioFactory', context);
const ExpertRunner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const plain = value => JSON.parse(JSON.stringify(value));
const lesson = JSON.parse(fs.readFileSync('lessons/dbms/sql-select.json', 'utf8'));

const database = relational.createDatabase({ tables: [{
    name: 'students',
    columns: [
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'age', type: 'number' },
        { name: 'course', type: 'string' }
    ],
    rows: [
        { id: 's1', values: { id: 1, name: 'Ana', age: 19, course: 'CS' } },
        { id: 's2', values: { id: 2, name: 'Ben', age: 20, course: 'IT' } },
        { id: 's3', values: { id: 3, name: 'Cara', age: 20, course: 'CS' } },
        { id: 's4', values: { id: 4, name: 'Cara', age: 23, course: 'CS' } }
    ]
}] });

const query = (operator, value, columns = ['name']) => ({
    from: 'students', select: columns, where: { field: 'age', operator, value }
});

test('SELECT projects one or multiple explicit columns after WHERE filtering', () => {
    const one = select.execute(database, query('>=', 20));
    assert.deepEqual(plain(one.matchedRowIds), ['s2', 's3', 's4']);
    assert.deepEqual(plain(one.columns.map(column => column.name)), ['name']);
    assert.deepEqual(plain(one.rows.map(row => row.values)), [{ name: 'Ben' }, { name: 'Cara' }, { name: 'Cara' }]);
    const multiple = select.execute(database, query('>=', 20, ['name', 'course']));
    assert.deepEqual(plain(multiple.rows[0].values), { name: 'Ben', course: 'IT' });
    assert.equal(Object.hasOwn(multiple.rows[0].values, 'age'), false);
});

test('comparison operators preserve their boundary semantics', () => {
    assert.deepEqual(plain(select.execute(database, query('>', 20)).matchedRowIds), ['s4']);
    assert.deepEqual(plain(select.execute(database, query('>=', 20)).matchedRowIds), ['s2', 's3', 's4']);
    assert.deepEqual(plain(select.execute(database, query('<', 20)).matchedRowIds), ['s1']);
    assert.deepEqual(plain(select.execute(database, query('<=', 20)).matchedRowIds), ['s1', 's2', 's3']);
    assert.deepEqual(plain(select.execute(database, query('=', 20)).matchedRowIds), ['s2', 's3']);
    assert.deepEqual(plain(select.execute(database, query('!=', 20)).matchedRowIds), ['s1', 's4']);
});

test('no WHERE, zero, one, multiple, and duplicate projected values are real results', () => {
    assert.equal(select.execute(database, { from: 'students', select: ['name'] }).rows.length, 4);
    assert.equal(select.execute(database, query('>', 99)).rows.length, 0);
    assert.deepEqual(plain(select.execute(database, query('=', 19)).matchedRowIds), ['s1']);
    assert.equal(select.execute(database, query('>=', 20)).rows.length, 3);
    assert.deepEqual(plain(select.execute(database, query('>=', 20)).rows.map(row => row.values.name)), ['Ben', 'Cara', 'Cara']);
});

test('result comparison is order-insensitive but preserves duplicate rows', () => {
    const result = select.execute(database, query('>=', 20));
    const reordered = { ...plain(result), rows: [...plain(result.rows)].reverse() };
    assert.equal(select.sameResult(result, reordered), true);
    assert.equal(select.sameResult(result, reordered, { ordered: true }), false);
    const missingDuplicate = { ...plain(result), rows: plain(result.rows).slice(0, 2) };
    assert.equal(select.sameResult(result, missingDuplicate), false);
});

test('invalid tables, fields, operators, features, and types fail explicitly', () => {
    assert.throws(() => select.execute(database, { from: 'missing', select: ['name'] }), /Unknown table/);
    assert.throws(() => select.execute(database, { from: 'students', select: ['salary'] }), /Unknown field/);
    assert.throws(() => select.execute(database, { from: 'students', select: ['name'], where: { field: 'salary', operator: '>=', value: 20 } }), /Unknown field/);
    assert.throws(() => select.execute(database, { from: 'students', select: ['name'], where: { field: 'age', operator: 'LIKE', value: 20 } }), /Unsupported/);
    assert.throws(() => select.execute(database, { from: 'students', select: ['name'], where: { field: 'age', operator: '>=', value: 'twenty' } }), /must be a number/);
    assert.throws(() => select.execute(database, { from: 'students', select: ['name'], where: { field: 'course', operator: '>', value: 'CS' } }), /requires a number/);
    assert.throws(() => select.execute(database, { from: 'students', select: ['name'], distinct: true }), /not supported/);
});

test('WHERE is evaluated before projection and source data changes need no answer edits', () => {
    const first = select.execute(database, { from: 'students', select: ['name'], where: { field: 'age', operator: '>=', value: 20 } });
    const changed = plain(database);
    changed.tables[0].rows[0].values.age = 24;
    const second = select.execute(changed, { from: 'students', select: ['name'], where: { field: 'age', operator: '>=', value: 20 } });
    assert.deepEqual(plain(first.matchedRowIds), ['s2', 's3', 's4']);
    assert.deepEqual(plain(second.matchedRowIds), ['s1', 's2', 's3', 's4']);
    assert.deepEqual(plain(second.columns.map(column => column.name)), ['name']);
});

test('structured assessment distinguishes query fields from row prediction', () => {
    const goal = query('>=', 20);
    const correct = select.assessGoal(database, goal, goal, ['s4', 's2', 's3']);
    assert.equal(correct.allCorrect, true);
    const different = select.assessGoal(database, goal, query('>', 20), ['s4']);
    assert.equal(different.queryCorrect, false);
    assert.equal(different.predictionCorrect, true);
    assert.equal(different.allCorrect, false);
    const badPrediction = select.assessGoal(database, goal, goal, ['s2']);
    assert.equal(badPrediction.queryCorrect, true);
    assert.equal(badPrediction.predictionCorrect, false);
});

test('256 seeded scenarios reproduce, vary, stay valid, and leak no result rows', () => {
    const definition = lesson.expert;
    const fingerprints = new Set();
    const operators = new Set();
    let emptyResults = 0;
    for (let seed = 1; seed <= 256; seed++) {
        const first = factory.create(definition, { seed });
        const second = factory.create(definition, { seed });
        assert.deepEqual(plain(first), plain(second));
        assert.deepEqual(plain(factory.recreate(definition, first)), plain(first));
        generator.validateScenario(first.data);
        fingerprints.add(first.fingerprint);
        const goal = first.data.problem.goal.query;
        const result = select.execute(first.data.problem.database, goal);
        operators.add(goal.where.operator);
        if (!result.rows.length) emptyResults++;
        assert.equal('oracle' in first.data, false);
        assert.equal('expectedRows' in first.data, false);
        const publicView = generator.getMentalSimulation(first.data);
        assert.deepEqual(Object.keys(publicView).sort(), ['initial_state', 'steps']);
        assert.equal(JSON.stringify(publicView).includes('matchedRowIds'), false);
        assert.equal(JSON.stringify(publicView).includes('expectedRows'), false);

        const response = {
            from: goal.from,
            select: goal.select.join(', '),
            whereField: goal.where.field,
            operator: goal.where.operator,
            value: String(goal.where.value),
            matchingRows: result.matchedRowIds.join(', ') || 'NONE'
        };
        const assessment = generator.evaluatePrediction(first.data, response);
        assert.equal(assessment.allCorrect, true);
        const runner = new ExpertRunner({ definition, scenario: first });
        assert.equal(runner.submitPrediction(response).status, 'expert_perfect');
    }
    assert.ok(fingerprints.size > 250);
    assert.equal(operators.size, 6);
    assert.ok(emptyResults > 5);
    console.log(`256 SQL seeds: ${fingerprints.size} distinct; ${emptyResults} empty results; ${operators.size} operators.`);
});

test('all mastery generators complete only after a correct query and prediction', () => {
    for (const level of lesson.mastery.levels.slice(1)) {
        for (let seed = 1; seed <= 24; seed++) {
            const data = factory.create(level.scenario, { seed }).data;
            const goal = data.problem.goal.query;
            const expected = select.execute(data.problem.database, goal);
            const runner = new Challenge(level.challenge);
            assert.notEqual(runner.reportOperation({ operation: 'query-attempt', state: { outcome: 'attempted' } }).status, 'challenge_completed');
            assert.equal(runner.reportOperation({ operation: 'run-query', state: { outcome: 'solved' } }).status, 'challenge_completed');
            assert.equal(generator.evaluatePrediction(data, {
                from: goal.from,
                select: goal.select.join(','),
                whereField: goal.where.field,
                operator: goal.where.operator,
                value: String(goal.where.value),
                matchingRows: expected.matchedRowIds.join(',') || 'NONE'
            }).allCorrect, true);
        }
    }
});

test('lesson configuration contains no scripted SELECT result states', () => {
    assert.equal('guided_steps' in lesson.visualization, false);
    assert.equal('target_state' in lesson.visualization, false);
    assert.equal('initial_state' in lesson.visualization, false);
    assert.equal(JSON.stringify(lesson.visualization).includes('expectedRows'), false);
    assert.equal(lesson.expert.generator, 'sql-select');
});
