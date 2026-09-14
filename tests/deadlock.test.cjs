/* Run: node --test tests/deadlock.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js',
    'engine/deadlock_model.js', 'engine/deadlock_generator.js']) {
    vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
}
const model = vm.runInContext('DeadlockModel', context);
const factory = vm.runInContext('ScenarioFactory', context);
const generator = vm.runInContext('DeadlockGenerator', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const plain = value => JSON.parse(JSON.stringify(value));

function base(events, allocations = [{ resource: 'R1', process: 'P1' }, { resource: 'R2', process: 'P2' }]) {
    return { assumption: 'one-instance-per-resource', processes: ['P1', 'P2'], resources: ['R1', 'R2', 'R3'], allocations, events };
}
const responseFor = data => {
    const result = data.oracle;
    return { blockedProcesses: result.finalState.blockedProcesses.join(', ') || 'NONE',
        classification: result.finalState.classification,
        cycleRequest: result.cycleCompletingRequest || 'NONE',
        cycleProcesses: [...new Set(result.finalState.cycle)].sort().join(', ') || 'NONE' };
};

test('free resource is granted and one blocked request is not a deadlock', () => {
    const granted = model.simulate(base([{ type: 'request', process: 'P1', resource: 'R3' }]));
    assert.equal(granted.transitions[0].outcome, 'GRANTED');
    assert.equal(granted.finalState.classification, 'safe');
    const blocked = model.simulate(base([{ type: 'request', process: 'P1', resource: 'R2' }]));
    assert.equal(blocked.transitions[0].outcome, 'BLOCKED');
    assert.deepEqual(plain(blocked.finalState.blockedProcesses), ['P1']);
    assert.equal(blocked.finalState.classification, 'blocked');
});

test('a request that closes a one-instance circular wait creates a true deadlock', () => {
    const result = model.simulate(base([
        { type: 'request', process: 'P1', resource: 'R2' },
        { type: 'request', process: 'P2', resource: 'R1' }
    ]));
    assert.equal(result.transitions[0].outcome, 'BLOCKED');
    assert.equal(result.transitions[1].outcome, 'DEADLOCKED');
    assert.equal(result.finalState.classification, 'deadlocked');
    assert.equal(result.cycleCompletingRequest, 'P2->R1');
    assert.deepEqual(plain(result.finalState.blockedProcesses), ['P1', 'P2']);
});

test('a blocked chain without a cycle remains recoverable', () => {
    const input = { assumption: 'one-instance-per-resource', processes: ['P1', 'P2', 'P3'], resources: ['R1', 'R2', 'R3'],
        allocations: [{ resource: 'R1', process: 'P1' }, { resource: 'R2', process: 'P2' }],
        events: [{ type: 'request', process: 'P1', resource: 'R2' }, { type: 'request', process: 'P2', resource: 'R3' }] };
    const result = model.simulate(input);
    assert.equal(result.finalState.classification, 'blocked');
    assert.deepEqual(plain(result.finalState.cycle), []);
});

test('release grants a waiting request and invalid allocation/request operations fail', () => {
    const result = model.simulate(base([
        { type: 'request', process: 'P1', resource: 'R2' },
        { type: 'release', process: 'P2', resource: 'R2' }
    ]));
    assert.equal(result.transitions[1].outcome, 'RELEASED');
    assert.equal(result.finalState.allocations.R2, 'P1');
    assert.equal(result.finalState.classification, 'safe');
    assert.throws(() => model.baseState(base([], [{ resource: 'R1', process: 'P1' }, { resource: 'R1', process: 'P2' }])));
    assert.throws(() => model.simulate(base([{ type: 'request', process: 'P1', resource: 'R1' }])));
    assert.throws(() => model.simulate(base([{ type: 'release', process: 'P1', resource: 'R2' }])));
});

test('session rejects a wrong prediction without mutating allocation state', () => {
    const session = model.createSession(base([{ type: 'request', process: 'P1', resource: 'R2' }]));
    assert.equal(session.predict('DEADLOCKED').accepted, false);
    assert.equal(session.getIndex(), 0);
    assert.equal(session.getState().requests.length, 0);
    assert.equal(session.predict('BLOCKED').complete, true);
});

test('field assessment distinguishes blocked state, cycle, and completing request', () => {
    const input = base([{ type: 'request', process: 'P1', resource: 'R2' }, { type: 'request', process: 'P2', resource: 'R1' }]);
    const correct = model.assess(input, { blockedProcesses: 'P1, P2', classification: 'deadlocked', cycleRequest: 'P2->R1', cycleProcesses: 'P1, P2' });
    assert.equal(correct.allCorrect, true);
    const wrong = model.assess(input, { blockedProcesses: 'P1', classification: 'blocked', cycleRequest: 'NONE', cycleProcesses: 'NONE' });
    assert.equal(wrong.allCorrect, false);
    assert.ok(wrong.fields.filter(field => !field.correct).length >= 3);
});

test('256 seeded deadlock scenarios reproduce, include safe/blocking and true cycles, and hide answers', () => {
    const definition = { generator: 'deadlock', generator_version: 1, scenario_rules: { processCounts: [2, 3, 4], outcomes: ['safe', 'deadlocked'] } };
    const fingerprints = new Set(), outcomes = new Set();
    for (let seed = 1; seed <= 256; seed++) {
        const first = factory.create(definition, { seed }), again = factory.create(definition, { seed });
        assert.deepEqual(plain(first), plain(again));
        generator.validateScenario(first.data); fingerprints.add(first.fingerprint);
        outcomes.add(first.data.oracle.finalState.classification);
        const publicText = JSON.stringify(generator.getMentalSimulation(first.data));
        for (const hidden of ['oracle', 'finalState', 'classification', 'cycleCompletingRequest']) assert.equal(publicText.includes(`"${hidden}"`), false);
    }
    assert.ok(fingerprints.size > 30);
    assert.deepEqual([...outcomes].sort(), ['blocked', 'deadlocked']);
    console.log(`256 deadlock seeds: ${fingerprints.size} distinct; outcomes ${[...outcomes].join(', ')}.`);
});

test('Mastery and Expert cannot complete with partial or wrong predictions', () => {
    const definition = { generator: 'deadlock', generator_version: 1, assessment_mode: 'prediction', scenario_rules: { processCounts: [3], outcomes: ['deadlocked'] } };
    const scenario = factory.create(definition, { seed: 37 });
    const challenge = new Challenge({ phases: [{ goal: { type: 'outcome_equals', expected_outcome: 'solved' } }] });
    assert.notEqual(challenge.reportOperation({ operation: 'deadlock-attempt', state: { outcome: 'attempted' } }).status, 'challenge_completed');
    const partial = new Runner({ definition, scenario });
    assert.notEqual(partial.submitPrediction({ classification: 'deadlocked' }).status, 'expert_perfect');
    const correct = new Runner({ definition, scenario });
    assert.equal(correct.submitPrediction(responseFor(scenario.data)).status, 'expert_perfect');
});
