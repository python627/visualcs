const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js', 'engine/normalization_model.js', 'engine/normalization_generator.js']) {
    vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
}
const model = vm.runInContext('NormalizationModel', context);
const generator = vm.runInContext('NormalizationGenerator', context);
const factory = vm.runInContext('ScenarioFactory', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const lesson = JSON.parse(fs.readFileSync('lessons/dbms/normalization.json', 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));

function enrollment() {
    return {
        relation: { name: 'enrollment', columns: ['student_id', 'student_name', 'course_id', 'course_name', 'instructor'].map(name => ({ name, type: name === 'student_id' ? 'number' : 'string' })), primaryKey: ['student_id', 'course_id'], rows: [
            { id: 'e1', values: { student_id: 1, student_name: 'Ana', course_id: 'C1', course_name: 'DB', instructor: 'Rao' } },
            { id: 'e2', values: { student_id: 2, student_name: 'Ben', course_id: 'C1', course_name: 'DB', instructor: 'Rao' } },
            { id: 'e3', values: { student_id: 1, student_name: 'Ana', course_id: 'C2', course_name: 'OS', instructor: 'Lin' } }
        ] },
        dependencies: [
            { determinant: ['student_id'], dependent: ['student_name'] },
            { determinant: ['course_id'], dependent: ['course_name', 'instructor'] }
        ],
        task: { kind: 'decompose', prompt: 'Normalize', targetForm: '3NF', dependencyClass: 'partial', anomalyType: 'update' }
    };
}

function employees() {
    return {
        relation: { name: 'employees', columns: ['employee_id', 'employee_name', 'department_id', 'department_name'].map(name => ({ name, type: name === 'employee_id' ? 'number' : 'string' })), primaryKey: ['employee_id'], rows: [
            { id: 'p1', values: { employee_id: 1, employee_name: 'Ana', department_id: 'D1', department_name: 'Engineering' } },
            { id: 'p2', values: { employee_id: 2, employee_name: 'Ben', department_id: 'D1', department_name: 'Engineering' } }
        ] },
        dependencies: [
            { determinant: ['employee_id'], dependent: ['employee_name', 'department_id'] },
            { determinant: ['department_id'], dependent: ['department_name'] }
        ],
        task: { kind: 'decompose', prompt: 'Normalize', targetForm: '3NF', dependencyClass: 'transitive', anomalyType: 'delete' }
    };
}

function responseFor(problem) {
    const analysis = model.analyze(problem);
    const dependency = (problem.task.dependencyClass === 'partial' ? analysis.partialDependencies : analysis.transitiveDependencies)[0]
        || analysis.partialDependencies[0] || analysis.transitiveDependencies[0] || analysis.dependencies[0];
    const decomposition = model.decompose(problem, problem.task.targetForm || '3NF');
    return {
        currentForm: analysis.currentForm,
        determinant: dependency.determinant.join(','), dependent: dependency.dependent.join(','),
        anomalyType: problem.task.anomalyType || model.detectAnomalies(problem)[0]?.type,
        relations: decomposition.relations.map(relation => relation.attributes.join(',')).join(' | '),
        resultingForm: decomposition.targetForm
    };
}

test('1NF distinguishes atomic cells from repeating groups and atomizes rows', () => {
    const problem = employees();
    assert.equal(model.analyze(problem).isAtomic, true);
    problem.relation.rows[0].values.department_name = ['Engineering', 'Platform'];
    assert.equal(model.analyze(problem).currentForm, 'UNNORMALIZED');
    const result = model.decompose({ ...problem, task: { kind: 'identify-normal-form', prompt: 'Check', targetForm: '1NF' } }, '1NF');
    assert.equal(result.relations[0].rows.length, 3);
    assert.ok(result.relations[0].rows.every(row => !Array.isArray(row.values.department_name)));
});

test('2NF detects partial dependencies on a composite key', () => {
    const analysis = model.analyze(enrollment());
    assert.equal(analysis.currentForm, '1NF');
    assert.equal(analysis.partialDependencies.length, 2);
    assert.equal(analysis.transitiveDependencies.length, 0);
});

test('a composite-key relation with only whole-key dependencies has no 2NF violation', () => {
    const problem = enrollment();
    problem.relation.columns = problem.relation.columns.filter(column => !['student_name', 'course_name', 'instructor'].includes(column.name));
    problem.relation.columns.push({ name: 'grade', type: 'string' });
    problem.relation.rows.forEach(row => {
        delete row.values.student_name; delete row.values.course_name; delete row.values.instructor; row.values.grade = 'A';
    });
    problem.dependencies = [{ determinant: ['student_id', 'course_id'], dependent: ['grade'] }];
    assert.equal(model.analyze(problem).partialDependencies.length, 0);
    assert.equal(model.analyze(problem).currentForm, '3NF');
});

test('2NF decomposition separates partial facts and preserves the bridge key', () => {
    const result = model.decompose(enrollment(), '2NF');
    assert.ok(result.relations.some(relation => relation.attributes.includes('student_id') && relation.attributes.includes('student_name')));
    assert.ok(result.relations.some(relation => relation.attributes.includes('course_id') && relation.attributes.includes('course_name')));
    assert.ok(result.relations.some(relation => relation.attributes.length === 2 && relation.attributes.includes('student_id') && relation.attributes.includes('course_id')));
});

test('3NF detects a transitive dependency through a non-key determinant', () => {
    const analysis = model.analyze(employees());
    assert.equal(analysis.currentForm, '2NF');
    assert.equal(analysis.partialDependencies.length, 0);
    assert.equal(analysis.transitiveDependencies.length, 1);
});

test('3NF decomposition gives department facts one home', () => {
    const result = model.decompose(employees(), '3NF');
    assert.deepEqual(plain(result.relations.map(item => item.attributes)), [
        ['department_id', 'department_name'], ['employee_id', 'employee_name', 'department_id']
    ]);
});

test('update, insertion, and deletion anomalies are derived from dependencies and rows', () => {
    const types = new Set(model.detectAnomalies(enrollment()).map(item => item.type));
    assert.deepEqual([...types].sort(), ['delete', 'insert', 'update']);
});

test('anomaly simulation executes different before/after consequences', () => {
    const problem = enrollment();
    const update = model.simulateAnomaly(problem, 'update');
    assert.equal(update.before.safe, false); assert.equal(update.after.safe, true); assert.ok(update.before.rows);
    const insertion = model.simulateAnomaly(problem, 'insert');
    assert.equal(insertion.before.accepted, false); assert.equal(insertion.after.accepted, true);
    const deletion = model.simulateAnomaly(problem, 'delete');
    assert.equal(deletion.before.safe, false); assert.equal(deletion.after.safe, true); assert.ok(deletion.before.rows.length < problem.relation.rows.length);
});

test('field-level assessment rejects wrong and missing answers', () => {
    const problem = enrollment();
    assert.equal(model.assess(problem, {}).allCorrect, false);
    const wrong = { ...responseFor(problem), currentForm: '3NF', determinant: 'course_name', anomalyType: 'insert' };
    assert.equal(model.assess(problem, wrong).allCorrect, false);
    assert.ok(model.assess(problem, wrong).fields.filter(field => !field.correct).length >= 2);
});

test('structural assessment ignores relation and attribute ordering', () => {
    const problem = enrollment(); const response = responseFor(problem);
    response.relations = 'course_id,instructor,course_name | course_id,student_id | student_name,student_id';
    assert.equal(model.assess(problem, response).allCorrect, true);
});

test('equivalent split dependency relations are accepted', () => {
    const result = model.assessDecomposition(enrollment(), 'student_id,student_name | course_id,course_name | instructor,course_id | course_id,student_id');
    assert.equal(result.correct, true);
});

test('missing attributes, unknown attributes, and still-denormalized designs are rejected', () => {
    assert.equal(model.assessDecomposition(enrollment(), 'student_id,student_name | student_id,course_id').correct, false);
    assert.equal(model.assessDecomposition(enrollment(), 'student_id,student_name | course_id,course_name,instructor,bogus | student_id,course_id').correct, false);
    assert.equal(model.assessDecomposition(enrollment(), 'student_id,student_name,course_id,course_name,instructor').correct, false);
    assert.equal(model.assessDecomposition(enrollment(), 'student_id,student_name | course_id,course_name,instructor | course_id,course_name | student_id,course_id').correct, false);
});

test('256 seeded Expert scenarios reproduce, vary, validate, and agree with the model', () => {
    const fingerprints = new Set(); const forms = new Set(); const anomalyTypes = new Set();
    for (let seed = 1; seed <= 256; seed++) {
        const first = factory.create(lesson.expert, { seed }); const again = factory.create(lesson.expert, { seed });
        assert.deepEqual(plain(first), plain(again)); generator.validateScenario(first.data);
        fingerprints.add(first.fingerprint); forms.add(model.analyze(first.data.problem).currentForm); anomalyTypes.add(first.data.problem.task.anomalyType);
        assert.equal(JSON.stringify(first.data).includes('expectedRelations'), false);
        assert.equal(model.assess(first.data.problem, responseFor(first.data.problem)).allCorrect, true);
    }
    assert.ok(fingerprints.size > 200); assert.deepEqual([...forms].sort(), ['1NF', '2NF']); assert.deepEqual([...anomalyTypes].sort(), ['delete', 'insert', 'update']);
    console.log(`256 normalization seeds: ${fingerprints.size} distinct; forms ${[...forms].sort().join(', ')}.`);
});

test('seeded generator covers bounded 1NF, 2NF, and 3NF teaching scenarios', () => {
    const definition = { generator: 'normalization', generator_version: 1,
        scenario_rules: { forms: ['1NF', '2NF', '3NF'], taskKinds: ['identify-normal-form', 'identify-dependency'] } };
    const kinds = new Set();
    for (let seed = 1; seed <= 96; seed++) {
        const scenario = factory.create(definition, { seed }); generator.validateScenario(scenario.data);
        const name = scenario.data.problem.relation.name;
        kinds.add(name.startsWith('contacts') ? '1NF' : name.startsWith('enrollment') ? '2NF' : '3NF');
    }
    assert.deepEqual([...kinds].sort(), ['1NF', '2NF', '3NF']);
});

test('Expert keeps answers hidden and rejects partial predictions', () => {
    const scenario = factory.create(lesson.expert, { seed: 71 });
    assert.equal(JSON.stringify(scenario.data).includes('decomposition'), false);
    assert.equal(JSON.stringify(generator.getMentalSimulation(scenario.data)).includes('expectedRelations'), false);
    const partial = new Runner({ definition: lesson.expert, scenario });
    assert.notEqual(partial.submitPrediction({ currentForm: model.analyze(scenario.data.problem).currentForm }).status, 'expert_perfect');
    const correct = new Runner({ definition: lesson.expert, scenario });
    assert.equal(correct.submitPrediction(responseFor(scenario.data.problem)).status, 'expert_perfect');
});

test('mastery cannot be bypassed with an attempted outcome', () => {
    const runner = new Challenge({ phases: [{ goal: { type: 'outcome_equals', expected_outcome: 'solved' } }] });
    assert.notEqual(runner.reportOperation({ operation: 'normalization-attempt', state: { outcome: 'attempted' } }).status, 'challenge_completed');
    assert.equal(runner.reportOperation({ operation: 'decompose', state: { outcome: 'solved' } }).status, 'challenge_completed');
});

test('lesson architecture uses executable problems and the Normalization generator only', () => {
    const text = JSON.stringify(lesson.visualization);
    assert.equal(text.includes('guided_steps'), false); assert.equal(text.includes('target_state'), false); assert.equal(text.includes('expectedRelations'), false);
    assert.equal(lesson.expert.generator, 'normalization');
    assert.ok(lesson.mastery.levels.slice(1).every(level => level.scenario.generator === 'normalization'));
});
