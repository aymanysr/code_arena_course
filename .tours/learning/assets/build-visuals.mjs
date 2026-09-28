export function boundaryResult(seconds,operator){
  if(!Number.isFinite(seconds))throw Error('Enter a finite number of seconds.');
  if(operator==='>')return seconds>0;
  if(operator==='>=')return seconds>=0;
  if(operator==='<')return seconds<0;
  throw Error('Choose a listed comparison.');
}
export function selectFrame(visual,id){const frame=visual.frames.find(f=>f.id===id);if(!frame)throw Error(`Unknown frame: ${id}`);return frame}
