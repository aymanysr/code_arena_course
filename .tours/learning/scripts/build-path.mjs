/** Validate authored course data before it can become a learner instruction. */
const phases=['orient','see','understand','try','build','check'];
const fail=(where,message)=>{throw new Error(`${where}: ${message}`)};
const text=(value,where)=>{if(typeof value!=='string'||!value.trim())fail(where,'required text');return value};
const list=(value,where)=>{if(!Array.isArray(value))fail(where,'expected an array');return value};
const path=(value,where)=>{text(value,where);if(value.startsWith('/')||value.includes('\\')||value.split('/').some(x=>x==='..'||x==='.'||!x)||/[\x00-\x1f]/.test(value))fail(where,'unsafe relative path');return value};
const index=(items,where)=>{const map=new Map();for(const item of list(items,where)){text(item?.id,where);if(!/^(?:[a-z][a-z0-9-]*|M\d\d)$/.test(item.id)||['constructor','prototype','__proto__'].includes(item.id))fail(where,'invalid id');if(map.has(item.id))fail(where,`duplicate ${item.id}`);map.set(item.id,item)}return map};
function graph(items,where){const byId=index(items,where),done=new Set(),visiting=[];function visit(id){if(done.has(id))return;if(visiting.includes(id))fail(where,`cycle ${[...visiting,id].join(' → ')}`);const item=byId.get(id);if(!item)fail(where,`unknown prerequisite ${id}`);visiting.push(id);for(const dependency of list(item.prerequisites,`${id}.prerequisites`))visit(dependency);visiting.pop();done.add(id)}for(const id of byId.keys())visit(id);return byId}
export function validateBuildPath(raw,lessons,referenceData,{complete=false}={}){
  if(raw?.version!==2)fail('path.version','expected 2');
  text(raw.revision,'revision');text(raw.sourceSnapshotId,'sourceSnapshotId');
  const entries=graph(raw.lessons,'lessons'),milestones=graph(raw.milestones,'milestones');
  const contents=index(lessons,'content'),outputs=new Set(),steps=new Set(),checks=new Map();
  for(const m of milestones.values()){
    for(const key of ['title','why','enables'])text(m[key],`${m.id}.${key}`);path(m.content,`${m.id}.content`);
    for(const id of list(m.lessonIds,`${m.id}.lessonIds`))if(entries.get(id)?.milestoneId!==m.id)fail(m.id,`unknown or misplaced lesson ${id}`);
  }
  for(const e of entries.values()){
    text(e.title,`${e.id}.title`);if(!milestones.get(e.milestoneId)?.lessonIds.includes(e.id))fail(e.id,'milestone membership');
    path(e.output,`${e.id}.output`);if(!/^build\/[a-z0-9-]+\.html$/.test(e.output)||outputs.has(e.output))fail(e.id,'invalid or duplicate output');outputs.add(e.output);
    if(!['ready','planned'].includes(e.status))fail(e.id,'status');
    if(e.status==='ready'&&!contents.has(e.id))fail(e.id,'missing content');
  }
  for(const lesson of lessons){
    const e=entries.get(lesson.id);if(!e||e.status!=='ready')fail(lesson.id,'content needs ready entry');
    if(e.milestoneId!==lesson.milestoneId||JSON.stringify(e.prerequisites)!==JSON.stringify(lesson.prerequisites))fail(lesson.id,'manifest/content prerequisites differ');
    for(const id of e.prerequisites)if(entries.get(id).status!=='ready')fail(lesson.id,`prerequisite ${id} is planned`);
    for(const key of ['title','why','outcome'])text(lesson[key],`${lesson.id}.${key}`);
    for(const check of index(lesson.checks,`${lesson.id}.checks`).values()){
      if(checks.has(check.id))fail(check.id,'duplicate check');checks.set(check.id,{check,lessonId:lesson.id});
      for(const key of ['command','cwd','expected'])text(check[key],`${check.id}.${key}`);
      if(!['explain','unit','service','database','judge','browser','integration'].includes(check.kind))fail(check.id,'kind');
      if(!list(check.failure,`${check.id}.failure`).length)fail(check.id,'failure guidance missing');
      for(const f of check.failure)for(const key of ['symptom','diagnostic','meaning'])text(f[key],`${check.id}.failure.${key}`);
    }
    const sequence=[];
    for(const step of list(lesson.steps,`${lesson.id}.steps`)){
      if(steps.has(step.id)||!new RegExp(`^${lesson.id}-[a-z0-9-]+$`).test(step.id))fail(lesson.id,'duplicate or invalid step id');steps.add(step.id);
      if(sequence.at(-1)!==step.phase)sequence.push(step.phase);
      for(const key of ['title','question','next'])text(step[key],`${step.id}.${key}`);
      if(!list(step.explanation,`${step.id}.explanation`).length)fail(step.id,'explanation');
      step.explanation.forEach(v=>text(v,`${step.id}.explanation`));
      list(step.vocabulary,`${step.id}.vocabulary`).forEach(v=>{text(v.term,step.id);text(v.meaning,step.id)});
      list(step.hints,`${step.id}.hints`);list(step.checkIds,`${step.id}.checkIds`);list(step.prerequisiteCheckIds,`${step.id}.prerequisiteCheckIds`);
      for(const f of list(step.files,`${step.id}.files`)){
        for(const key of ['role','owner','change','pattern'])text(f[key],`${step.id}.${key}`);path(f.path,`${step.id}.path`);
        if(!['reference','active'].includes(f.workspace)||!['read','create','edit'].includes(f.action)||f.workspace==='reference'&&f.action!=='read')fail(step.id,'file action');
      }
      if(step.phase==='build'&&(!step.files.length||!step.checkIds.length||step.hints.length!==4))fail(step.id,'build requires files, checks and four hints');
      step.hints.forEach(v=>text(v,`${step.id}.hint`));
      if(step.visual){const v=step.visual;if(!['trace','boundary'].includes(v.kind))fail(step.id,'visual kind');text(v.title,step.id);list(v.code,step.id);if(!list(v.frames,step.id).length)fail(step.id,'visual frames');const fs=index(v.frames,step.id);for(const frame of fs.values()){text(frame.label,step.id);text(frame.explanation,step.id);list(frame.values,step.id).forEach(x=>{text(x.label,step.id);text(x.value,step.id)});list(frame.codeLines,step.id).forEach(n=>{if(!Number.isInteger(n)||n<1||n>v.code.length)fail(step.id,'visual code line')})}list(v.cases,step.id).forEach(c=>{for(const k of ['input','expected','reason'])text(c[k],step.id)})}
    }
    if(sequence.join()!==phases.join())fail(lesson.id,'phase sequence must be orient → see → understand → try → build → check');
    if(!lesson.steps.some(s=>s.phase==='check'&&s.transfer?.trim()))fail(lesson.id,'missing transfer');
    for(const ref of list(lesson.references,`${lesson.id}.references`)){
      const old=referenceData.lessons.find(x=>x.id===ref.lessonId);
      if(!Number.isInteger(ref.startLine)||!Number.isInteger(ref.endLine)||ref.startLine<1||ref.endLine<ref.startLine||!old?.references.some(r=>r.path===ref.path&&r.startLine<=ref.startLine&&r.endLine>=ref.endLine))fail(lesson.id,`invalid reference ${ref.path}`);
    }
  }
  function ancestors(id,result=new Set()){for(const p of entries.get(id).prerequisites){result.add(p);ancestors(p,result)}return result}
  for(const lesson of lessons){const allowed=ancestors(lesson.id);allowed.add(lesson.id);for(const step of lesson.steps)for(const id of [...step.checkIds,...step.prerequisiteCheckIds])if(!checks.has(id)||!allowed.has(checks.get(id).lessonId))fail(step.id,`unknown or unrelated check ${id}`)}
  for(const b of index(raw.behaviors,'behaviors').values()){
    text(b.title,b.id);text(b.reason,`${b.id}.reason`);if(!['required','support','optional'].includes(b.scope))fail(b.id,'scope');
    for(const id of list(b.lessonIds,b.id))if(!entries.has(id))fail(b.id,`unknown lesson ${id}`);
    for(const id of list(b.referenceLessonIds,b.id))if(!referenceData.lessons.some(l=>l.id===id))fail(b.id,`unknown reference ${id}`);
    for(const id of list(b.checkIds,b.id))if(!checks.has(id))fail(b.id,`unknown check ${id}`);
  }
  const dispositions=new Set();for(const d of list(raw.dispositions,'dispositions')){path(d.path,'disposition.path');if(dispositions.has(d.path))fail(d.path,'duplicate disposition');dispositions.add(d.path);text(d.reason,`${d.path}.reason`);if(!['build','support','exclude'].includes(d.kind))fail(d.path,'disposition kind');for(const id of list(d.lessonIds,d.path))if(!entries.has(id))fail(d.path,`unknown lesson ${id}`);if(d.kind==='build'&&!d.lessonIds.length)fail(d.path,'build lesson missing')}
  const changedReferencePaths=[...new Set([...referenceData.sourceChanges,...referenceData.evidenceChanges].map(x=>x.path))];
  const referenceReviewRequired=!!(changedReferencePaths.length||referenceData.invalidTourAnchors.length||!referenceData.referenceSnapshotId||raw.sourceSnapshotId!==referenceData.snapshotId);
  if(complete){if(raw.lessons.some(l=>l.status==='planned'))fail('course','planned lessons remain');if(referenceData.files.some(f=>!dispositions.has(f.path)))fail('course','missing file disposition');if(raw.behaviors.some(b=>b.scope==='required'&&!b.checkIds.length))fail('course','missing behavior check');if(referenceReviewRequired)fail('course','reference review required')}
  return {path:raw,lessons,changedReferencePaths,referenceReviewRequired};
}
