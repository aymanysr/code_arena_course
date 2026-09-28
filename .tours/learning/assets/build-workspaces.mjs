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
