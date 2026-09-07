import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:['ignore','pipe','inherit'],encoding:'utf8'}).trim();
if(run('git',['branch','--show-current'])!=='main') throw new Error('Run from main.');
if(run('git',['status','--porcelain'])) throw new Error('Commit or stash source changes before publishing.');
run(process.execPath,['scripts/validate.mjs']);
run(process.execPath,['scripts/export-demo.mjs']);
run(process.execPath,['scripts/validate-demo.mjs']);
const remote=run('git',['remote','get-url','origin']);
if(!/^https:\/\/github\.com\/Kibosh13\/primecom-copy(?:\.git)?$/.test(remote)) throw new Error('Unexpected origin; review the repository before publishing.');
const source=run('git',['rev-parse','--short','HEAD']);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'primecom-demo-'));
try {
  const exists=run('git',['ls-remote','--heads','origin','gh-pages']);
  if(exists) run('git',['clone','--quiet','--single-branch','--branch','gh-pages',remote,temporary]);
  else {run('git',['init','-b','gh-pages'],temporary);run('git',['remote','add','origin',remote],temporary);}
  // The isolated clone contains generated demo files only; preserve its Git history.
  for(const entry of fs.readdirSync(temporary)) if(entry!=='.git') fs.rmSync(path.join(temporary,entry),{recursive:true,force:true});
  fs.cpSync(path.join(root,'dist'),temporary,{recursive:true});
  for(const key of ['user.name','user.email']) run('git',['config',key,run('git',['config',key])],temporary);
  run('git',['add','--all'],temporary);
  if(!run('git',['status','--porcelain'])) {console.log('Demo unchanged; nothing to push.');}
  else {run('git',['commit','-m',`Publish static demo from main ${source}`],temporary);run('git',['push','origin','gh-pages'],temporary);console.log('Published demo commit '+run('git',['rev-parse','HEAD'],temporary));}
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
