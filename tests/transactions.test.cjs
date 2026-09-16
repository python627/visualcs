/* Run: node --test tests/transactions.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js', 'engine/relational_model.js', 'engine/transaction_model.js', 'engine/transaction_generator.js']) vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
const relational = vm.runInContext('RelationalModel', context);
const model = vm.runInContext('TransactionModel', context);
const generator = vm.runInContext('TransactionGenerator', context);
const factory = vm.runInContext('ScenarioFactory', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const lesson = JSON.parse(fs.readFileSync('lessons/dbms/transactions.json', 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
function problem(terminal = 'commit', terminalAfter = 2) {
    return { database: relational.createDatabase({ tables: [{ name: 'accounts', columns: [{ name: 'account', type: 'string' }, { name: 'balance', type: 'number' }], rows: [
        { id: 'A', values: { account: 'A', balance: 100 } }, { id: 'B', values: { account: 'B', balance: 50 } }
    ] }] }), table: 'accounts', valueField: 'balance', terminal, terminalAfter, operations: [
        { type: 'adjust', rowId: 'A', delta: -20, label: 'debit A' }, { type: 'adjust', rowId: 'B', delta: 20, label: 'credit B' }
    ] };
}
const responseFor = data => {
    const result = model.simulate(data.problem).finalState;
    return { status: result.status, ...result.committed };
};

test('BEGIN creates an isolated working state', () => {
    const session = model.createSession(problem()); const state = session.begin();
    assert.equal(state.status, 'active'); assert.deepEqual(plain(state.committed), { A: 100, B: 50 }); assert.deepEqual(plain(state.working), { A: 100, B: 50 });
});

test('operations change working state but not committed state', () => {
    const session = model.createSession(problem()); session.begin(); const state = session.applyNext();
    assert.deepEqual(plain(state.working), { A: 80, B: 50 }); assert.deepEqual(plain(state.committed), { A: 100, B: 50 });
});

test('COMMIT makes the complete working state durable', () => {
    const result = model.simulate(problem('commit')).finalState;
    assert.equal(result.status, 'committed'); assert.deepEqual(plain(result.committed), { A: 80, B: 70 }); assert.equal(result.working, null);
});

test('ROLLBACK discards one or multiple working operations', () => {
    assert.deepEqual(plain(model.simulate(problem('rollback', 1)).finalState.committed), { A: 100, B: 50 });
    assert.deepEqual(plain(model.simulate(problem('rollback', 2)).finalState.committed), { A: 100, B: 50 });
});

test('failure before COMMIT never leaves a half-committed transfer', () => {
    const result = model.simulate(problem('failure', 1)).finalState;
    assert.equal(result.status, 'failed_rolled_back'); assert.deepEqual(plain(result.committed), { A: 100, B: 50 }); assert.equal(result.working, null);
});

test('multi-operation atomicity preserves total and commits both changes together', () => {
    const before = model.simulate(problem('failure', 2)).finalState.committed;
    const after = model.simulate(problem('commit', 2)).finalState.committed;
    assert.equal(before.A + before.B, 150); assert.equal(after.A + after.B, 150); assert.deepEqual(plain(after), { A: 80, B: 70 });
});

test('invalid operations and state transitions fail explicitly', () => {
    const session = model.createSession(problem());
    assert.throws(() => session.applyNext(), /Start/); session.begin(); assert.throws(() => session.begin(), /only valid/);
    assert.throws(() => session.rollback(), /requires COMMIT/); session.applyNext(); assert.throws(() => session.commit(), /more planned/);
    assert.throws(() => model.validateProblem({ ...problem(), operations: [{ type: 'delete', rowId: 'A' }] }), /invalid/);
});

test('field assessment rejects partial or incorrect committed predictions', () => {
    assert.equal(model.assess(problem('failure', 1), { status: 'failed_rolled_back', A: 80, B: 50 }).allCorrect, false);
    assert.equal(model.assess(problem('failure', 1), { status: 'failed_rolled_back', A: 100, B: 50 }).allCorrect, true);
});

test('256 seeded scenarios reproduce, vary, cover all terminals, and hide final states', () => {
    const fingerprints = new Set(); const terminals = new Set();
    for (let seed = 1; seed <= 256; seed++) {
        const first = factory.create(lesson.expert, { seed }); const again = factory.create(lesson.expert, { seed });
        assert.deepEqual(plain(first), plain(again)); generator.validateScenario(first.data); fingerprints.add(first.fingerprint); terminals.add(first.data.problem.terminal);
        assert.equal(JSON.stringify(first.data).includes('finalState'), false); assert.equal(JSON.stringify(generator.getMentalSimulation(first.data)).includes('actualFinalState'), false);
    }
    assert.ok(fingerprints.size > 200); assert.equal(terminals.size, 3);
    console.log(`256 transaction seeds: ${fingerprints.size} distinct; terminals ${[...terminals].sort().join(', ')}.`);
});

test('Expert and mastery reject bypasses and accept only complete model predictions', () => {
    const scenario = factory.create(lesson.expert, { seed: 87 });
    const partial = new Runner({ definition: lesson.expert, scenario }); assert.notEqual(partial.submitPrediction({ status: 'committed' }).status, 'expert_perfect');
    const correct = new Runner({ definition: lesson.expert, scenario }); assert.equal(correct.submitPrediction(responseFor(scenario.data)).status, 'expert_perfect');
    const challenge = new Challenge({ phases: [{ goal: { type: 'outcome_equals', expected_outcome: 'solved' } }] });
    assert.notEqual(challenge.reportOperation({ operation: 'transaction-attempt', state: { outcome: 'attempted' } }).status, 'challenge_completed');
    assert.equal(challenge.reportOperation({ operation: 'commit', state: { outcome: 'solved' } }).status, 'challenge_completed');
});

test('lesson contains transaction inputs and no scripted final database', () => {
    const text = JSON.stringify(lesson.visualization);
    assert.equal(text.includes('next_state'), false); assert.equal(text.includes('final_state'), false); assert.equal(text.includes('expectedBalances'), false);
    assert.equal(lesson.expert.generator, 'transaction');
});
