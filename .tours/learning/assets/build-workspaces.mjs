const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const requireText=(v,name)=>{if(typeof v!=='string'||!v.trim()||v.length>10000||/[\x00\r\n]/.test(v))throw Error(`${name}: expected one line of text`);return v};
export function safeRelative(value,name='path') {requireText(value,name);if(value.startsWith('/')||value.includes('\\')||value.split('/').some(p=>!p||p==='..'||p==='.'))throw Error(`${name}: use a relative path inside the workspace`);return value}
export function validateWorkspaceProfile(raw){
  if(!plain(raw)||!['practice','team'].includes(raw.kind)||typeof raw.id!=='string'||! /^[a-z][a-z0-9-]*$/.test(raw.id)||['constructor','prototype'].includes(raw.id))throw Error('profile: invalid identity');
  if(raw.root!==null){requireText(raw.root,'root');if(!raw.root.startsWith('/'))throw Error('root: use an absolute folder path')}
  if(!Array.isArray(raw.mappings))throw Error('mappings: expected an array');
  const roles=new Set(),checkIds=new Set();
  const mappings=raw.mappings.map(m=>{
    if(!plain(m))throw Error('mapping: expected object');requireText(m.role,'role');if(roles.has(m.role))throw Error('duplicate role');roles.add(m.role);
    for(const k of ['referencePath','practicePath','targetPath'])safeRelative(m[k],k);
    if(!['reuse','create','extend'].includes(m.action))throw Error('mapping action');requireText(m.reason,'reason');
    if(m.dependency!==null)requireText(m.dependency,'dependency');
    if(!Array.isArray(m.checks))throw Error('checks: expected an array');
    const checks=m.checks.map(c=>{for(const k of ['checkId','command','cwd'])requireText(c[k],k);if(c.cwd!=='.')safeRelative(c.cwd,'cwd');if(checkIds.has(c.checkId))throw Error('duplicate check');checkIds.add(c.checkId);if(!['unverified','learner-reported'].includes(c.verification))throw Error('verification');return {checkId:c.checkId,command:c.command,cwd:c.cwd,verification:c.verification}});
    return {role:m.role,referencePath:m.referencePath,practicePath:m.practicePath,targetPath:m.targetPath,action:m.action,reason:m.reason,checks,dependency:m.dependency};
  });
  return {id:raw.id,kind:raw.kind,root:raw.root,mappings};
}
export function quoteShellPath(value){if(typeof value!=='string'||/[\x00\r\n]/.test(value))throw Error('root: control character');return "'"+value.replaceAll("'","'\\''")+"'"}
export function resolveBuildStep(step,lesson,rawProfile){
  const profile=validateWorkspaceProfile(rawProfile),blockedBy=[],files=[];
  const authored=step.checkIds.map(id=>lesson.checks.find(c=>c.id===id));
  if(authored.some(c=>!c))throw Error('Unknown lesson check');
  const needsRoot=step.files.some(f=>f.workspace==='active')||authored.some(c=>c.kind!=='explain'&&c.cwd!=='current-terminal');
  if(needsRoot&&!profile.root)blockedBy.push(`Choose the ${profile.kind} folder before following file or command instructions.`);
  for(const file of step.files){
    if(file.workspace==='reference'||profile.kind==='practice'){files.push({...file});continue}
    const mapped=profile.mappings.find(m=>m.role===file.role);
    if(!mapped){blockedBy.push(`Map the team responsibility: ${file.role}`);continue}
    if(mapped.dependency)blockedBy.push(`${file.role}: ${mapped.dependency}`);
    files.push({...file,path:mapped.targetPath,action:{reuse:'read',create:'create',extend:'edit'}[mapped.action],owner:mapped.reason});
  }
  const checks=[];
  for(const check of authored){
    if(profile.kind==='practice'||check.kind==='explain'||check.cwd==='current-terminal'){checks.push({...check});continue}
    const mapped=profile.mappings.flatMap(m=>m.checks).find(c=>c.checkId===check.id);
    if(!mapped){blockedBy.push(`Map the team check: ${check.id}`);continue}
    checks.push({...check,command:mapped.command,cwd:mapped.cwd});
  }
  return {workspace:profile.kind,root:profile.root,files,checks:blockedBy.length?checks.filter(c=>c.kind==='explain'||c.cwd==='current-terminal'):checks,blockedBy};
}
