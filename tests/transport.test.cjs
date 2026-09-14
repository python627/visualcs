/* Run: node --test tests/transport.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js',
    'engine/transport_simulator.js', 'engine/transport_generator.js']) {
    vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
}
const model = vm.runInContext('TransportSimulator', context);
const generator = vm.runInContext('TransportGenerator', context);
const factory = vm.runInContext('ScenarioFactory', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const Challenge = vm.runInContext('ChallengeRunner', context);
const plain = value => JSON.parse(JSON.stringify(value));
const source = JSON.parse(fs.readFileSync('lessons/computer_networks/tcp-vs-udp.json', 'utf8'));

function problem({ protocol = null, lost = [], delays = [1, 2, 1], requirements } = {}) {
    const value = {
        application: { title: 'Test transfer', need: 'Test deterministic delivery.' },
        requirements: requirements || (protocol === 'UDP'
            ? { orderedDelivery: false, lossRepair: false }
            : { orderedDelivery: true, lossRepair: true }),
        packets: [1, 2, 3].map(sequence => ({ id: `P${sequence}`, sequence, payload: `chunk-${sequence}`, sender: 'S', receiver: 'R' })),
        network: {
            conditions: [1, 2, 3].map((sequence, index) => ({ sequence,
                firstTransmission: lost.includes(sequence) ? 'loss' : 'deliver', delay: delays[index] })),
            sendSpacing: 0, timeout: 6, retransmissionDelay: 2, ackDelay: 1
        }
    };
    if (protocol) value.knownProtocol = protocol;
    return value;
}

const responseFor = (data, override = {}) => ({
    protocol: data.oracle.recommendedProtocol,
    receiverPackets: data.oracle.result.receiverPackets.join(', ') || 'NONE',
    applicationOrder: data.oracle.result.applicationOrder.join(', ') || 'NONE',
    retransmittedPackets: data.oracle.result.retransmittedPackets.join(', ') || 'NONE',
    repairsLoss: data.oracle.result.repairsLoss ? 'YES' : 'NO',
    ...override
});

test('UDP delivers surviving datagrams in network-arrival order without automatic retransmission', () => {
    const noLoss = model.simulate(problem({ protocol: 'UDP', delays: [3, 1, 2] }), 'UDP');
    assert.deepEqual(plain(noLoss.receiverPackets), ['P2', 'P3', 'P1']);
    assert.deepEqual(plain(noLoss.applicationOrder), ['P2', 'P3', 'P1']);
    assert.deepEqual(plain(noLoss.retransmittedPackets), []);

    const loss = model.simulate(problem({ protocol: 'UDP', lost: [2] }), 'UDP');
    assert.deepEqual(plain(loss.receiverPackets), ['P1', 'P3']);
    assert.deepEqual(plain(loss.applicationOrder), ['P1', 'P3']);
    assert.deepEqual(plain(loss.lostPackets), ['P2']);
    assert.deepEqual(plain(loss.retransmittedPackets), []);
    assert.equal(loss.repairsLoss, false);
    assert.equal(loss.events.some(event => ['ACK_SEND', 'ACK_ARRIVE', 'TIMEOUT', 'RETRANSMIT'].includes(event.type)), false);
});

test('TCP loss produces ACKs, timeout, retransmission, buffering, and ordered application delivery', () => {
    const result = model.simulate(problem({ protocol: 'TCP', lost: [2], delays: [1, 2, 1] }), 'TCP');
    assert.deepEqual(plain(result.receiverPackets), ['P1', 'P3', 'P2']);
    assert.deepEqual(plain(result.applicationOrder), ['P1', 'P2', 'P3']);
    assert.deepEqual(plain(result.lostPackets), ['P2']);
    assert.deepEqual(plain(result.retransmittedPackets), ['P2']);
    assert.deepEqual(plain(result.acknowledgedPackets), ['P1', 'P2', 'P3']);
    assert.equal(result.repairsLoss, true);
    for (const type of ['BUFFER', 'TIMEOUT', 'RETRANSMIT', 'ACK_SEND', 'ACK_ARRIVE']) {
        assert.ok(result.events.some(event => event.type === type), `${type} must occur`);
    }
    const delivered = result.events.filter(event => event.type === 'DELIVER_TO_APP').map(event => event.packetId);
    assert.deepEqual(plain(delivered), ['P1', 'P2', 'P3']);
});

test('TCP buffers out-of-order arrivals even when no packet is lost', () => {
    const result = model.simulate(problem({ protocol: 'TCP', delays: [1, 4, 2] }), 'TCP');
    assert.deepEqual(plain(result.receiverPackets), ['P1', 'P3', 'P2']);
    assert.deepEqual(plain(result.applicationOrder), ['P1', 'P2', 'P3']);
    assert.equal(result.events.some(event => event.type === 'BUFFER' && event.packetId === 'P3'), true);
    assert.deepEqual(plain(result.retransmittedPackets), []);
});

test('logical replay is deterministic, resettable, and independent of browser timers', () => {
    const input = problem({ protocol: 'TCP', lost: [2] });
    const first = model.createReplay(input, 'TCP');
    const events = [];
    while (first.getCursor() < first.getLength()) events.push(first.next().event);
    assert.deepEqual(plain(events), plain(model.simulate(input, 'TCP').events));
    const resetState = first.reset();
    assert.equal(first.getCursor(), 0);
    assert.deepEqual(plain(resetState.applicationOrder), []);
    const second = model.createReplay(input, 'TCP');
    const replayed = [];
    while (second.getCursor() < second.getLength()) replayed.push(second.next().event);
    assert.deepEqual(plain(replayed), plain(events));
});

test('structured assessment explains protocol and field-level prediction differences', () => {
    const input = problem({ lost: [2], requirements: { orderedDelivery: false, lossRepair: false } });
    const actual = model.simulate(input, 'UDP');
    const correct = model.assess(input, { protocol: 'UDP', receiverPackets: actual.receiverPackets,
        applicationOrder: actual.applicationOrder, retransmittedPackets: 'NONE', repairsLoss: 'NO' });
    assert.equal(correct.allCorrect, true);
    const wrong = model.assess(input, { protocol: 'TCP', receiverPackets: 'P1, P2, P3',
        applicationOrder: 'P1, P2, P3', retransmittedPackets: 'P2', repairsLoss: 'YES' });
    assert.equal(wrong.allCorrect, false);
    assert.equal(wrong.protocolCorrect, false);
    assert.ok(wrong.feedback.includes('application requirements point to UDP'));
    const partial = model.assess({ ...input, knownProtocol: 'UDP' }, { receiverPackets: 'P1' });
    assert.equal(partial.allCorrect, false);
    assert.ok(partial.fields.some(field => !field.correct));
});

test('invalid transport inputs fail explicitly', () => {
    const base = problem({ protocol: 'UDP' });
    assert.throws(() => model.simulate({ ...base, packets: [] }, 'UDP'));
    assert.throws(() => model.simulate({ ...base, network: { ...base.network, conditions: [] } }, 'UDP'));
    assert.throws(() => model.simulate({ ...base, packets: base.packets.map((p, i) => i === 1 ? { ...p, sequence: 1 } : p) }, 'UDP'));
    assert.throws(() => model.simulate(base, 'SCTP'));
});

test('256 seeded scenarios reproduce, vary, validate, and hide event-derived answers', () => {
    const definition = source.expert;
    const fingerprints = new Set();
    const protocols = new Set();
    let losses = 0;
    let reordered = 0;
    for (let seed = 1; seed <= 256; seed++) {
        const a = factory.create(definition, { seed });
        const b = factory.create(definition, { seed });
        assert.deepEqual(plain(a), plain(b));
        assert.deepEqual(plain(factory.recreate(definition, a)), plain(a));
        generator.validateScenario(a.data);
        fingerprints.add(a.fingerprint);
        protocols.add(a.data.problem.knownProtocol);
        if (a.data.oracle.result.lostPackets.length) losses++;
        if (a.data.oracle.result.receiverPackets.join() !== a.data.oracle.result.applicationOrder.join()) reordered++;
        assert.deepEqual(plain(a.data.oracle.result), plain(model.simulate(a.data.problem, a.data.problem.knownProtocol)));
        const publicView = generator.getMentalSimulation(a.data);
        const publicText = JSON.stringify(publicView);
        assert.deepEqual(Object.keys(publicView).sort(), ['initial_state', 'steps']);
        for (const hidden of ['oracle', 'actualResult', 'applicationOrder', 'retransmittedPackets', 'events']) {
            assert.equal(publicText.includes(`\"${hidden}\"`), false);
        }
    }
    assert.ok(fingerprints.size > 245);
    assert.deepEqual([...protocols].sort(), ['TCP', 'UDP']);
    assert.ok(losses > 50 && losses < 210);
    assert.ok(reordered > 20);
    console.log(`256 transport seeds: ${fingerprints.size} distinct; ${losses} loss scenarios; ${reordered} reordered outcomes.`);
});

test('Mastery and Expert require a complete correct model-derived prediction', () => {
    for (const level of source.mastery.levels.slice(1)) {
        for (let seed = 1; seed <= 24; seed++) {
            const data = factory.create(level.scenario, { seed }).data;
            const runner = new Challenge(level.challenge);
            const wrong = model.assess(data.problem, responseFor(data, { applicationOrder: 'NONE' }));
            assert.notEqual(runner.reportOperation({ operation: 'simulation-attempt', state: { outcome: wrong.allCorrect ? 'solved' : 'attempted' } }).status, 'challenge_completed');
            const correct = model.assess(data.problem, responseFor(data));
            assert.equal(correct.allCorrect, true);
            assert.equal(runner.reportOperation({ operation: 'run-simulation', state: { outcome: 'solved' } }).status, 'challenge_completed');
        }
    }
    const scenario = factory.create(source.expert, { seed: 91 });
    const incomplete = new Runner({ definition: source.expert, scenario });
    assert.equal(incomplete.submitPrediction({}).status, 'prediction_submitted');
    assert.equal(incomplete.getStage(), 'review');
    assert.equal(incomplete.result, null);
    const correct = new Runner({ definition: source.expert, scenario });
    assert.equal(correct.submitPrediction(responseFor(scenario.data)).status, 'expert_perfect');
});

test('lesson configuration contains inputs and generators, not scripted transport truth', () => {
    assert.equal(source.visualization.type, 'transport-simulation');
    for (const forbidden of ['guided_steps', 'initial_state', 'target_state', 'oracle', 'events', 'applicationOrder']) {
        assert.equal(Object.hasOwn(source.visualization, forbidden), false);
    }
    for (const level of source.mastery.levels.slice(1)) assert.equal(level.scenario.generator, 'transport');
    assert.equal(source.expert.generator, 'transport');
});
