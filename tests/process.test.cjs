/* Run: node --test tests/process.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js',
    'engine/process_model.js', 'engine/process_generator.js']) {
    vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
}
const model = vm.runInContext('ProcessModel', context);
const factory = vm.runInContext('ScenarioFactory', context);
const generator = vm.runInContext('ProcessGenerator', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const plain = value => JSON.parse(JSON.stringify(value));

function problem(events, processes = [{ id: 'P1', state: 'READY' }, { id: 'P2', state: 'READY' }]) {
    return { cpuCount: 1, processes, events };
}
const responseFor = data => ({
    ready: data.oracle.finalState.READY.join(', ') || 'NONE',
    running: data.oracle.finalState.RUNNING.join(', ') || 'NONE',
    waiting: data.oracle.finalState.WAITING.join(', ') || 'NONE',
    terminated: data.oracle.finalState.TERMINATED.join(', ') || 'NONE'
});

test('valid dispatch, time-slice, I/O, completion, and termination transitions', () => {
    const input = problem([
        { type: 'dispatch', process: 'P1' }, { type: 'timeslice', process: 'P1' },
        { type: 'dispatch', process: 'P2' }, { type: 'io_request', process: 'P2' },
        { type: 'dispatch', process: 'P1' }, { type: 'finish', process: 'P1' },
        { type: 'io_complete', process: 'P2' }
    ]);
    const result = model.simulate(input);
    assert.deepEqual(plain(result.finalState.READY), ['P2']);
    assert.deepEqual(plain(result.finalState.RUNNING), []);
    assert.deepEqual(plain(result.finalState.WAITING), []);
    assert.deepEqual(plain(result.finalState.TERMINATED), ['P1']);
    assert.deepEqual(plain(result.transitions.map(item => [item.from, item.to])), [
        ['READY', 'RUNNING'], ['RUNNING', 'READY'], ['READY', 'RUNNING'], ['RUNNING', 'WAITING'],
        ['READY', 'RUNNING'], ['RUNNING', 'TERMINATED'], ['WAITING', 'READY']
    ]);
});

test('impossible transitions and single-CPU violations are rejected', () => {
    assert.throws(() => model.simulate(problem([{ type: 'io_request', process: 'P1' }])));
    assert.throws(() => model.simulate(problem([{ type: 'dispatch', process: 'P1' }, { type: 'dispatch', process: 'P2' }])));
    assert.throws(() => model.simulate(problem([{ type: 'dispatch', process: 'P1' }, { type: 'finish', process: 'P1' }, { type: 'dispatch', process: 'P1' }])));
    assert.throws(() => model.initialSnapshot({ cpuCount: 1, processes: [{ id: 'P1', state: 'RUNNING' }, { id: 'P2', state: 'RUNNING' }] }));
});

test('session requires the correct predicted next state and cannot skip events', () => {
    const session = model.createSession(problem([{ type: 'dispatch', process: 'P1' }, { type: 'io_request', process: 'P1' }]));
    const wrong = session.predict('WAITING');
    assert.equal(wrong.accepted, false);
    assert.equal(session.getIndex(), 0);
    assert.equal(session.predict('RUNNING').accepted, true);
    assert.equal(session.getIndex(), 1);
    assert.equal(session.predict('WAITING').complete, true);
});

test('multiple-process snapshots and field assessment come from the model', () => {
    const input = problem([{ type: 'dispatch', process: 'P1' }, { type: 'io_request', process: 'P1' }, { type: 'dispatch', process: 'P2' }]);
    const correct = model.assess(input, { ready: 'NONE', running: 'P2', waiting: 'P1', terminated: 'NONE' });
    assert.equal(correct.allCorrect, true);
    const wrong = model.assess(input, { ready: 'P1', running: 'P2', waiting: 'NONE', terminated: 'NONE' });
    assert.equal(wrong.allCorrect, false);
    assert.equal(wrong.fields.filter(field => !field.correct).length, 2);
});

test('256 seeded process scenarios reproduce, vary, validate, and hide final snapshots', () => {
    const definition = { generator: 'process', generator_version: 1, scenario_rules: { processCounts: [3, 4, 5], eventCounts: [5, 6, 7, 8], mixedInitial: true } };
    const fingerprints = new Set();
    for (let seed = 1; seed <= 256; seed++) {
        const first = factory.create(definition, { seed });
        const again = factory.create(definition, { seed });
        assert.deepEqual(plain(first), plain(again));
        generator.validateScenario(first.data);
        fingerprints.add(first.fingerprint);
        assert.deepEqual(plain(first.data.oracle), plain(model.simulate(first.data.problem)));
        const publicView = generator.getMentalSimulation(first.data);
        const text = JSON.stringify(publicView);
        for (const hidden of ['oracle', 'finalState', 'actualResult']) assert.equal(text.includes(`"${hidden}"`), false);
    }
    assert.ok(fingerprints.size > 200);
    console.log(`256 process seeds: ${fingerprints.size} distinct.`);
});

test('Mastery and Expert cannot complete with a wrong or partial model prediction', () => {
    const definition = { generator: 'process', generator_version: 1, assessment_mode: 'prediction', scenario_rules: { processCounts: [4], eventCounts: [7], mixedInitial: true } };
    const scenario = factory.create(definition, { seed: 91 });
    const challenge = new Challenge({ phases: [{ goal: { type: 'outcome_equals', expected_outcome: 'solved' } }] });
    assert.notEqual(challenge.reportOperation({ operation: 'process-attempt', state: { outcome: 'attempted' } }).status, 'challenge_completed');
    const incomplete = new Runner({ definition, scenario });
    assert.notEqual(incomplete.submitPrediction({ ready: 'NONE' }).status, 'expert_perfect');
    const correct = new Runner({ definition, scenario });
    assert.equal(correct.submitPrediction(responseFor(scenario.data)).status, 'expert_perfect');
});
