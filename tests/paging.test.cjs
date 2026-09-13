/* Run: node --test tests/paging.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: { crypto: require('node:crypto').webcrypto } });
for (const file of ['scenario_factory.js', 'challenge_runner.js', 'expert_attempt_runner.js', 'engine/paging_model.js', 'engine/paging_generator.js']) {
    vm.runInContext(fs.readFileSync(`static/js/${file}`, 'utf8'), context, { filename: file });
}
const model = vm.runInContext('PagingModel', context);
const factory = vm.runInContext('ScenarioFactory', context);
const generator = vm.runInContext('PagingGenerator', context);
const Runner = vm.runInContext('ExpertAttemptRunner', context);
const plain = value => JSON.parse(JSON.stringify(value));
const source = JSON.parse(fs.readFileSync('lessons/os/paging-virtual-memory.json', 'utf8'));
const problem = source.visualization.problem;
const answer = r => ({ page: r.pageNumber, offset: r.offset,
    frame: r.frameNumber ?? r.status, physicalAddress: r.physicalAddress ?? r.status });

test('normal translation, changed input, boundaries and multiple sizes', () => {
    assert.deepEqual(plain(model.translate(problem)), { status:'TRANSLATED', logicalAddress:2053, pageSize:1024,
        pageNumber:2, offset:5, frameNumber:5, physicalAddress:5125 });
    assert.equal(model.translate({ ...problem, logicalAddress:2054 }).physicalAddress,5126);
    for (const size of [1,16,64,100,256,1024,4096]) {
        const base={pageSize:size,logicalAddressSpace:size*3,pageTable:[{page:0,frame:3,present:true},{page:1,frame:5,present:true},{page:2,frame:0,present:true}]};
        for (const [address,page,offset,frame] of [[0,0,0,3],[size,1,0,5],[size-1,0,size-1,3],[size*2-1,1,size-1,5]]) {
            const r=model.translate({...base,logicalAddress:address});
            assert.equal(r.pageNumber,page); assert.equal(r.offset,offset);
            assert.equal(r.physicalAddress,frame*size+offset);
        }
    }
});

test('page fault is distinct from invalid address; bad config fails explicitly', () => {
    const fault={...problem,pageTable:problem.pageTable.map(r=>r.page===2?{...r,present:false}:r)};
    assert.equal(model.translate(fault).status,'PAGE_FAULT');
    assert.equal(model.translate(fault).physicalAddress,null);
    assert.equal(model.assess(fault,{page:2,offset:5,frame:'PAGE_FAULT',physicalAddress:'PAGE_FAULT'}).allCorrect,true);
    for(const logicalAddress of [-1,4096,1.5,'2053',Number.MAX_SAFE_INTEGER+1])
        assert.equal(model.translate({...problem,logicalAddress}).status,'INVALID_ADDRESS');
    assert.equal(model.translate({...problem,pageTable:problem.pageTable.filter(r=>r.page!==2)}).status,'INVALID_ADDRESS');
    for(const pageSize of [0,-1,NaN,1.5,'1024']) assert.throws(()=>model.translate({...problem,pageSize}));
    for(const pageTable of [[],[...problem.pageTable,problem.pageTable[0]],[{page:0,frame:-1,present:true}], [{page:0,frame:1,present:'yes'}]])
        assert.throws(()=>model.translate({...problem,pageTable}));
});

test('structured checks reject wrong/empty numbers and preserve correct fields', () => {
    for (const wrong of ['', 'abc', '2abc', null, true, 3]) {
        const result=model.assess(problem,{page:wrong,offset:5,frame:5,physicalAddress:5125});
        assert.equal(result.allCorrect,false); assert.equal(result.fields[0].correct,false);
        assert.equal(result.fields[1].correct,true);
    }
    assert.equal(model.assess(problem,{page:'2',offset:'5',frame:'5',physicalAddress:'5125'}).allCorrect,true);
    assert.equal('correctNextPop' in model.assess(problem,{}),false);
});

test('session rejects final-step bypass and wrong attempts; retry starts clean', () => {
    const session=model.createSession(problem);
    assert.equal(session.submit('physicalAddress',5125).accepted,false);
    assert.equal(session.submit('page',3).accepted,false);
    assert.equal(session.field,'page');
    for (const [field,value] of Object.entries(answer(model.translate(problem)))) {
        const r=session.submit(field,value); assert.equal(r.accepted,true);
        assert.equal(r.outcome,field==='physicalAddress'?'solved':null);
    }
    assert.equal(session.submit('physicalAddress',5125).accepted,false);
    assert.deepEqual(plain(model.createSession(problem).answers),{});
});

test('256 seeds reproduce, vary, validate, recompute and hide answers', () => {
    const definition=source.expert;
    const seen=new Set(); let faults=0;
    for(let seed=1;seed<=256;seed++) {
        const a=factory.create(definition,{seed}), b=factory.create(definition,{seed});
        assert.deepEqual(plain(a),plain(b));
        assert.deepEqual(plain(factory.recreate(definition,a)),plain(a));
        seen.add(a.fingerprint); generator.validateScenario(a.data);
        assert.deepEqual(plain(model.translate(a.data.problem)),plain(a.data.oracle));
        if(a.data.oracle.status==='PAGE_FAULT') faults++;
        const publicView=generator.getMentalSimulation(a.data);
        assert.deepEqual(Object.keys(publicView).sort(),['initial_state','steps']);
        assert.deepEqual(plain(publicView.initial_state),plain(a.data.problem));
        assert.equal(JSON.stringify(publicView).includes('oracle'),false);
        assert.equal('target_state' in publicView,false);
        const runner=new Runner({definition,scenario:a});
        assert.equal(runner.submitPrediction(answer(a.data.oracle)).status,'expert_perfect');
        assert.equal(runner.reportOperation({operation:'bypass',state:{outcome:'solved'}}).status,'inactive');
        const wrong=new Runner({definition,scenario:a});
        const result=wrong.submitPrediction({...answer(a.data.oracle),page:-10});
        assert.equal(result.status,'prediction_submitted'); assert.equal(result.assessment.allCorrect,false);
    }
    assert.ok(seen.size>250); assert.ok(faults>20 && faults<140);
    console.log(`256 seeded problems: ${seen.size} distinct; ${faults} valid page faults.`);
});

test('every configured mastery level has a solvable model-backed problem', () => {
    const Challenge=vm.runInContext('ChallengeRunner',context);
    for(const level of source.mastery.levels.slice(1)) {
        for(let seed=1;seed<=32;seed++) {
            const data=factory.create(level.scenario,{seed}).data;
            const s=model.createSession(data.problem), runner=new Challenge(level.challenge);
            let result;
            for(const [field,value] of Object.entries(answer(model.translate(data.problem)))) {
                const event=s.submit(field,value);
                result=runner.reportOperation({operation:field,state:{outcome:event.outcome},progress:!event.outcome});
            }
            assert.equal(result.status,'challenge_completed');
        }
    }
    assert.equal('guided_steps' in source.visualization,false);
    assert.equal('target_state' in source.visualization,false);
});

test('legacy ChallengeRunner operation/state goals and Expert still behave normally', () => {
    const Challenge=vm.runInContext('ChallengeRunner',context);
    const state=new Challenge({phases:[{goal:{type:'state_equals',expected_state:[10,20]}}]});
    assert.equal(state.reportOperation({operation:'push',state:[10]}).status,'incorrect');
    assert.equal(state.reportOperation({operation:'push',state:[10,20]}).status,'challenge_completed');
    const seq=new Challenge({phases:[{goal:{type:'operation_sequence',operations:['push','pop']}}]});
    assert.equal(seq.reportOperation({operation:'pop',state:[]}).status,'incorrect');
    assert.equal(seq.reportOperation({operation:'push',state:[10]}).status,'progress');
    assert.equal(seq.reportOperation({operation:'pop',state:[]}).status,'challenge_completed');
    for(const file of ['stack_expert_generator.js','binary_search_expert_generator.js','curriculum_generators.js','remaining_mastery_generators.js'])
        vm.runInContext(fs.readFileSync('static/js/engine/'+file,'utf8'),context);
    const paths=['data_structures/stack','data_structures/queue','algorithms/binary-search','algorithms/merge-sort','data_structures/hash-tables','algorithms/breadth-first-search'];
    for(const path of paths) {
        const lesson=JSON.parse(fs.readFileSync('lessons/'+path+'.json','utf8'));
        const raw=lesson.expert || lesson.mastery.levels.find(l=>l.kind==='expert').expert;
        const definition=raw.expert||raw;
        for(let seed=1;seed<=5;seed++) {
            const scenario=factory.create(definition,{seed});
            const runner=new Runner({definition,scenario});
            assert.ok(runner.getMentalSimulation().steps.length>0);
            assert.equal(runner.submitPrediction({}).status,'prediction_submitted');
            assert.equal(runner.beginExecution().status,'execution_started');
        }
    }
});
