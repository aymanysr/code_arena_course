import {emptyProgress,readProgress,saveProgress,reduceProgress,importProgress,exportProgress} from './build-progress.mjs';
import {resolveBuildStep,quoteShellPath,validateWorkspaceProfile} from './build-workspaces.mjs';
import {boundaryResult,selectFrame} from './build-visuals.mjs';
export function mountBuildCourse(root,course,lesson,storage){
  const win=root.defaultView,abort=new win.AbortController();
  const q=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)];
  const on=(node,name,handler)=>node?.addEventListener(name,handler,{signal:abort.signal});
  const el=(tag,text,cls)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
  const loaded=readProgress(storage,course);let state=loaded.state,paused=!!loaded.warning?.includes('corrupt'),pendingImport=null,index=0;
  const prefix=lesson||q('[data-profile-form]')?'../':'';
  const warning=message=>{q('[data-storage-warning]').hidden=!message;q('[data-storage-warning]').textContent=message??''};
  warning(loaded.warning);q('[data-replace-corrupt]').hidden=!paused;
  const active=()=>state.workspaces[state.activeWorkspace];
  function persist(){if(!paused&&!saveProgress(storage,state))warning('Saving is unavailable. Keep learning and export this session before closing the page.')}
  function dispatch(event){state=reduceProgress(state,event,course);persist()}
  function chrome(){
    root.documentElement.dataset.theme=state.theme;
    q('[data-theme-toggle]').textContent=state.theme==='dusk'?'Light theme':'Dusk theme';
    const profile=state.profiles.find(p=>p.id===state.activeWorkspace);
    q('[data-workspace-label]').textContent=`${profile.kind==='practice'?'Practice':'Team'} · ${profile.root??'folder not selected'}${profile.kind==='team'&&!profile.mappings.length?' · mapping needed':''}`;
    const select=q('[data-workspace-select]');select.replaceChildren();
    for(const p of state.profiles){const option=el('option',p.kind==='practice'?'Practice':`Team · ${p.id}`);option.value=p.id;select.append(option)}
    if(!state.profiles.some(p=>p.id==='team')){const option=el('option','Team · not ready');option.value='team';select.append(option)}select.value=state.activeWorkspace;
    const continueLink=q('[data-build-continue]');if(continueLink){const position=active().position;const entry=course.path.lessons.find(e=>course.lessons.find(l=>l.id===e.id)?.steps.some(s=>s.id===position))??course.path.lessons.find(e=>e.status==='ready');if(entry){continueLink.href=`${prefix}${entry.output}${position?'#'+position:''}`;continueLink.replaceChildren(el('span',position?'Continue learning':'Start learning'),el('span','→'));q('[data-continue-title]').textContent=entry.title;const reports=Object.values(active().reports).sort((a,b)=>b.reportedAt.localeCompare(a.reportedAt));if(reports[0])q('[data-continue-note]').textContent=`Last result you recorded here: ${reports[0].status}${reports[0].needsReview?' (check again)':''}. Your next reading step is saved separately.`}}
  }
  function renderGuidance(step,node){
    const profile=state.profiles.find(p=>p.id===state.activeWorkspace),resolved=resolveBuildStep(step,lesson,profile);
    const target=node.querySelector('[data-file-guidance]');target.replaceChildren();
    for(const message of resolved.blockedBy)target.append(el('p',message,'notice'));
    for(const f of resolved.files){const card=el('article',undefined,'file-card');card.append(el('p',f.workspace==='reference'?'REFERENCE · READ ONLY':`${resolved.workspace.toUpperCase()} · ${f.action.toUpperCase()}`,'eyebrow'));const title=el('h3');title.append(el('code',f.path));card.append(title,el('p',f.owner),el('p',f.change),el('p',`Pattern: ${f.pattern}`,'muted'));if(f.workspace==='reference'){const link=el('a','Find this file in the source map');link.href=prefix+'source-map.html';card.append(link)}target.append(card)}
    const checks=node.querySelector('[data-check-guidance]');if(!checks)return;checks.replaceChildren();
    for(const check of resolved.checks){
      const card=el('article',undefined,'check-card');card.append(el('p',check.kind==='explain'?'EXPLAIN IN YOUR OWN WORDS':`${resolved.workspace.toUpperCase()} · ${check.kind.toUpperCase()} CHECK`,'eyebrow'));
      if(check.kind!=='explain'){const cwd=check.cwd==='current-terminal'?'Your current terminal':`${profile.root}${check.cwd==='.'?'':'/'+check.cwd}`;card.append(el('p',`Run from: ${cwd}`,'muted'));if(profile.root&&check.cwd!=='current-terminal')card.append(el('pre',`cd ${quoteShellPath(cwd)}`))}
      card.append(el('pre',check.command),el('p',`Expected: ${check.expected}`));
      const recovery=el('details');recovery.append(el('summary','If this does not work'));for(const f of check.failure){recovery.append(el('h3',f.symptom),el('p',`Try: ${f.diagnostic}`),el('p',f.meaning))}card.append(recovery);
      const form=el('form'),label=el('label','My result'),select=el('select');select.dataset.reportStatus='';select.setAttribute('aria-label',`My result for ${check.id}`);
      for(const value of ['untried','passed','failed','blocked']){const option=el('option',{untried:'Not tried',passed:'Passed',failed:'Failed',blocked:'Blocked'}[value]);option.value=value;select.append(option)}select.value=active().reports[check.id]?.status??'untried';label.append(select);form.append(label);
      const noteLabel=el('label','What happened? (optional)'),note=el('textarea');note.rows=2;note.maxLength=10000;note.value=active().reports[check.id]?.note??'';noteLabel.append(note);form.append(noteLabel,el('button','Record my result'));
      const status=el('p');status.dataset.buildReport='';status.setAttribute('role','status');const report=active().reports[check.id];status.textContent=report?`${report.source==='import'?'Imported':'You reported'}: ${report.status}${report.needsReview?' — check again':''}`:'Not checked yet';form.append(status,el('small','This is your report. The course has not run the command.'));
      on(form,'submit',event=>{event.preventDefault();dispatch({type:'report',checkId:check.id,report:{status:select.value,source:'learner-report',note:note.value,reportedAt:new Date().toISOString(),courseRevision:course.path.revision,sourceSnapshotId:course.path.sourceSnapshotId,needsReview:course.referenceReviewRequired}});renderGuidance(step,node)});card.append(form);checks.append(card);
    }
  }
  function show(next,focus=false,history='replace'){
    if(!lesson)return;index=Math.max(0,Math.min(next,lesson.steps.length-1));const step=lesson.steps[index];
    for(const section of all('[data-build-step]'))section.hidden=section.id!==step.id;
    for(const link of all('[data-step-link]')){if(link.dataset.stepLink===step.id)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current')}
    const node=root.getElementById(step.id);renderGuidance(step,node);node.querySelector('[data-step-note]').value=active().notes[step.id]??'';
    q('[data-step-navigation]').hidden=false;q('[data-back]').disabled=index===0;q('[data-next]').disabled=index===lesson.steps.length-1;q('[data-step-count]').textContent=`Step ${index+1} of ${lesson.steps.length}`;q('[data-next-lesson]').hidden=index!==lesson.steps.length-1;
    const missing=lesson.prerequisites.filter(id=>course.lessons.find(l=>l.id===id)?.checks.some(c=>active().reports[c.id]?.status!=='passed'||active().reports[c.id]?.needsReview));const notice=q('[data-prerequisite-notice]');notice.hidden=!missing.length;notice.textContent=`You can read ahead. Earlier checks are still unrecorded or need review: ${missing.map(id=>course.path.lessons.find(l=>l.id===id).title).join(', ')}.`;
    dispatch({type:'visit',stepId:step.id});
    try{win.history[history==='push'?'pushState':'replaceState'](null,'','#'+step.id)}catch{/* file origins may disallow History API; navigation still works */}
    if(focus)node.querySelector('h2').focus({preventScroll:false});
  }
  on(q('[data-theme-toggle]'),'click',()=>{dispatch({type:'theme',theme:state.theme==='dusk'?'light':'dusk'});chrome()});
  on(q('[data-workspace-select]'),'change',event=>{const id=event.target.value;if(!state.profiles.some(p=>p.id===id))dispatch({type:'profile',profile:{id,kind:'team',root:null,mappings:[]}});dispatch({type:'workspace',id});chrome();show(index)});
  on(q('[data-back]'),'click',()=>show(index-1,true,'push'));on(q('[data-next]'),'click',()=>show(index+1,true,'push'));
  for(const link of all('[data-step-link]'))on(link,'click',event=>{event.preventDefault();show(lesson.steps.findIndex(s=>s.id===link.dataset.stepLink),true,'push')});
  on(win,'popstate',()=>{if(lesson)show(Math.max(0,lesson.steps.findIndex(s=>'#'+s.id===win.location.hash)),true)});
  for(const node of all('[data-build-step]')){const step=lesson.steps.find(s=>s.id===node.id);on(node.querySelector('[data-save-note]'),'click',()=>{dispatch({type:'note',stepId:step.id,text:node.querySelector('[data-step-note]').value});node.querySelector('[data-note-status]').textContent=paused?'Note kept in this session. Export to keep a copy.':'Note recorded. Export a backup if saving is unavailable.'});
    for(const button of node.querySelectorAll('[data-frame]'))on(button,'click',()=>{const frame=selectFrame(step.visual,button.dataset.frame);const values=node.querySelector('[data-frame-values]');values.replaceChildren(...frame.values.map(value=>{const box=el('div');box.append(el('small',value.label),el('strong',value.value));return box}));node.querySelector('[data-frame-explanation]').textContent=frame.explanation;for(const line of node.querySelectorAll('[data-line]'))line.classList.toggle('highlight',frame.codeLines.includes(Number(line.dataset.line)));for(const b of node.querySelectorAll('[data-frame]'))b.setAttribute('aria-pressed',String(b===button))});
    on(node.querySelector('[data-boundary]'),'submit',event=>{event.preventDefault();const form=event.currentTarget,seconds=Number(form.elements.seconds.value);try{const actual=boundaryResult(seconds,form.elements.operator.value),expected=seconds>0;node.querySelector('[data-boundary-feedback]').textContent=`Input: ${seconds}. Expected: ${expected}. Your comparison returns: ${actual}. ${actual===expected?'This case matches. Now try another boundary.':seconds===0?'At zero, time is already over. Use a strict greater-than comparison.':'Follow the sign of the input and compare it with zero.'}`;dispatch({type:'attempt',stepId:step.id})}catch(error){node.querySelector('[data-boundary-feedback]').textContent=error.message}});
  }
  on(q('[data-export]'),'click',()=>{const blob=new win.Blob([exportProgress(state)],{type:'application/json'}),url=win.URL.createObjectURL(blob),link=el('a');link.href=url;link.download='code-arena-progress.json';root.body.append(link);link.click();link.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000)});
  on(q('[data-import]'),'change',async event=>{pendingImport=null;q('[data-confirm-import]').hidden=true;q('[data-cancel-import]').hidden=true;try{const file=event.target.files[0];if(!file)return;if(file.size>1000000)throw Error('File is too large (maximum 1 MB).');pendingImport=importProgress(await file.text(),course);q('[data-import-preview]').textContent=`Ready to replace local progress with ${pendingImport.profiles.length} workspace(s). Imported results will need checking again.`;q('[data-confirm-import]').hidden=false;q('[data-cancel-import]').hidden=false}catch(error){q('[data-import-preview]').textContent=`Import rejected: ${error.message}. Your current progress is unchanged.`}});
  on(q('[data-cancel-import]'),'click',()=>{pendingImport=null;q('[data-import-preview]').textContent='Import canceled.';q('[data-confirm-import]').hidden=true;q('[data-cancel-import]').hidden=true});
  on(q('[data-confirm-import]'),'click',()=>{if(!pendingImport)return;state=pendingImport;pendingImport=null;paused=false;persist();chrome();show(lesson?Math.max(0,lesson.steps.findIndex(s=>s.id===active().position)):0);q('[data-import-preview]').textContent='Progress imported. Check imported results again.';q('[data-confirm-import]').hidden=true;q('[data-cancel-import]').hidden=true});
  on(q('[data-reset]'),'click',()=>q('[data-reset-confirm]').hidden=false);on(q('[data-cancel-reset]'),'click',()=>q('[data-reset-confirm]').hidden=true);
  on(q('[data-confirm-reset]'),'click',()=>{state.workspaces[state.activeWorkspace]=structuredClone(emptyProgress(course).workspaces.practice);persist();q('[data-reset-confirm]').hidden=true;chrome();show(0)});
  on(q('[data-replace-corrupt]'),'click',()=>{paused=false;warning(null);q('[data-replace-corrupt]').hidden=true;persist()});
  on(q('[data-profile-form]'),'submit',event=>{event.preventDefault();const form=event.currentTarget,status=q('[data-profile-status]');try{const rootPath=form.elements.root.value.trim().replace(/\/+$/,'');const reference=JSON.parse(q('#build-course-data').textContent).referenceRoot;if(rootPath===reference||rootPath.startsWith(reference+'/'))throw Error('Choose a separate folder outside the reference checkout.');const kind=form.elements.kind.value,id=kind==='practice'?'practice':'team';const prior=state.profiles.find(p=>p.id===id);const profile=validateWorkspaceProfile({id,kind,root:rootPath||null,mappings:prior?.mappings??[]});dispatch({type:'profile',profile});dispatch({type:'workspace',id});chrome();status.textContent='Location saved. No folders were created or inspected.'}catch(error){status.textContent=error.message}});
  if(win.matchMedia('(max-width:720px)').matches)q('.route').open=false;
  chrome();if(lesson){const hash=win.location.hash.slice(1),saved=active().position;const wanted=hash||saved;const found=lesson.steps.findIndex(s=>s.id===wanted);show(found<0?0:found);if(hash&&found<0)warning('That step is unavailable. Showing the beginning of this lesson; your saved notes remain.')}
  return {dispose(){abort.abort()}};
}
if(typeof document!=='undefined'){
  const node=document.getElementById('build-course-data');
  if(node){try{const data=JSON.parse(node.textContent);if(data.course?.path?.version!==2||!Array.isArray(data.course.lessons))throw Error('Invalid course data');let storage=null;try{storage=window.localStorage}catch{}mountBuildCourse(document,data.course,data.course.lessons.find(l=>l.id===data.lessonId)??null,storage)}catch(error){const warning=document.querySelector('[data-storage-warning]');warning.hidden=false;warning.textContent=`Interactive controls could not start: ${error.message}. The complete lesson remains readable below.`}}
}
