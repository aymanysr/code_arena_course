import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';import os from 'node:os';import {execFileSync} from 'node:child_process';import path from 'node:path';import {buildCatalogData} from './build-catalog.mjs';import {loadBuildCourse} from './build-course.mjs';
const learningDir=path.join(process.cwd(),'.tours/learning');const coverageMap=JSON.parse(await readFile(path.join(learningDir,'coverage-map.json'),'utf8'));const referenceData=await buildCatalogData({repoRoot:process.cwd(),learningDir,coverageMap,tours:[]});
test('the foundation entry has a usable prerequisite chain through the first run',async()=>{const course=await loadBuildCourse(learningDir,referenceData);for(const id of ['m00-destination','m00-workspaces','m01-tools','m01-folder','m01-package','m01-first-run']){const lesson=course.lessons.find(l=>l.id===id);assert.ok(lesson,`${id} has authored content`);for(const prereq of lesson.prerequisites)assert.ok(course.lessons.some(l=>l.id===prereq));assert.ok(lesson.steps.some(s=>s.phase==='check'&&s.transfer));for(const step of lesson.steps.filter(s=>s.phase==='build')){assert.equal(step.hints.length,4);assert.ok(step.files.length);for(const id of step.checkIds){const check=lesson.checks.find(c=>c.id===id);assert.ok(check?.expected&&check.failure.length)}}}});
test('practice configuration checks, emits and runs a module while rejecting the wrong type',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'course config '));
 try{
  for(const name of ['package.json','tsconfig.json'])await writeFile(path.join(dir,name),await readFile(path.join(learningDir,'practice',name)));
  await mkdir(path.join(dir,'src'));await symlink(path.join(process.cwd(),'node_modules'),path.join(dir,'node_modules'),'dir');
  await writeFile(path.join(dir,'src/helper.ts'),'export function twice(value:number):number {return value * 2;}');
  await writeFile(path.join(dir,'src/demo.ts'),"import {twice} from './helper.js'; console.log(twice(4));");
  execFileSync('npm',['run','typecheck'],{cwd:dir});execFileSync('npm',['run','build'],{cwd:dir});
  assert.match(execFileSync('npm',['run','demo'],{cwd:dir,encoding:'utf8'}),/\n8\s*$/);
  await writeFile(path.join(dir,'src/demo.ts'),"import {twice} from './helper.js'; console.log(twice('wrong'));");
  assert.throws(()=>execFileSync('npm',['run','typecheck'],{cwd:dir,stdio:'pipe'}));
 }finally{await rm(dir,{recursive:true,force:true})}
});
