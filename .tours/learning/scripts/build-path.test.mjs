import test from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture} from './fixtures/build-course.mjs';
let api={};try{api=await import('./build-path.mjs')}catch{}
const validate=(f,options)=>{assert.equal(typeof api.validateBuildPath,'function','build validator exists');return api.validateBuildPath(f.raw,f.lessons,f.referenceData,options)};
test('accepts a complete lesson while leaving future lessons visibly planned',()=>{const c=validate(foundationFixture());assert.equal(c.lessons.length,1);assert.equal(c.path.lessons[1].status,'planned');assert.deepEqual(c.changedReferencePaths,[])});
const invalid=[
 ['cycle',f=>{f.raw.lessons[0].prerequisites=['m00-next']},/cycle/],
 ['unknown prerequisite',f=>{f.raw.lessons[1].prerequisites=['absent']},/absent/],
 ['duplicate IDs',f=>{f.raw.lessons.push(f.raw.lessons[0])},/duplicate/],
 ['escaping output',f=>{f.raw.lessons[0].output='../out.html'},/output/],
 ['duplicate outputs',f=>{f.raw.lessons[1].output=f.raw.lessons[0].output},/output/],
 ['missing content',f=>{f.lessons=[]},/content/],
 ['missing phase',f=>{f.lessons[0].steps.splice(1,1)},/phase/],
 ['missing expected output',f=>{f.lessons[0].checks[0].expected=''},/expected/],
 ['missing recovery',f=>{f.lessons[0].checks[0].failure=[]},/failure/],
 ['unknown check',f=>{f.lessons[0].steps[4].checkIds=['missing']},/check/],
 ['bad reference span',f=>{f.lessons[0].references[0].endLine=99},/reference/],
 ['missing file owner',f=>{f.lessons[0].steps[4].files[0].owner=''},/owner/],
 ['missing hints',f=>{f.lessons[0].steps[4].hints=[]},/hints/],
 ['ready prerequisite is planned',f=>{f.raw.lessons[1].prerequisites=[];f.raw.lessons[0].prerequisites=['m00-next'];f.lessons[0].prerequisites=['m00-next']},/planned/],
 ['unknown behavior lesson',f=>{f.raw.behaviors[0].lessonIds=['lost']},/lost/],
 ['empty disposition reason',f=>{f.raw.dispositions[0].reason=''},/reason/],
 ['missing transfer',f=>{delete f.lessons[0].steps[5].transfer},/transfer/]
];
for(const [name,mutate,error] of invalid)test(`rejects ${name}`,()=>{const f=foundationFixture();mutate(f);assert.throws(()=>validate(f),error)});
test('strict mode cannot call a partial route complete',()=>assert.throws(()=>validate(foundationFixture(),{complete:true}),/planned/));
test('source drift becomes a review signal',()=>{const f=foundationFixture();f.referenceData.sourceChanges=[{path:'src/rule.ts',kind:'changed'}];const c=validate(f);assert.deepEqual(c.changedReferencePaths,['src/rule.ts']);assert.equal(c.referenceReviewRequired,true)});
