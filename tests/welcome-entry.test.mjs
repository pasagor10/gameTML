import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/welcome.js',import.meta.url),'utf8').replace(/^import .*\n/,'');
async function boot(users,search='') {
  const elements=new Map(),calls=[],redirects=[];
  const node=selector=>elements.get(selector)||elements.set(selector,{hidden:false,disabled:false,value:'',dataset:{},classList:{toggle(){}},setAttribute(){},textContent:'',innerHTML:''}).get(selector);
  const context={facebookIosControls(){},navigator:{userAgent:'iPhone Safari',webdriver:false},URLSearchParams,
    document:{referrer:'',querySelector:node,querySelectorAll:()=>[],documentElement:{classList:{toggle(){}}}},
    location:{search,hash:'',replace:url=>redirects.push(url),assign:url=>redirects.push(url)},
    fetch:async url=>{calls.push(url);return {ok:true,json:async()=>({user:url==='/api/me'?users.shift():{id:'new'}})};},
  };
  vm.runInNewContext(source,context);
  for(let n=0;n<8;n++) await new Promise(resolve=>setImmediate(resolve));
  return {calls,redirects,elements};
}
test('entrance resumes the existing account before attempting guest creation',async()=>{
  const result=await boot([{id:'old'},{id:'old'}],'?enter=1');
  assert.deepEqual(result.calls,['/api/me','/api/me']);
  assert.deepEqual(result.redirects,['/play?auto=1']);
});
test('new visitors verify the guest session before entering',async()=>{
  const result=await boot([null,{id:'new'}],'?enter=1');
  assert.deepEqual(result.calls,['/api/me','/api/auth/guest','/api/me']);
  assert.deepEqual(result.redirects,['/play?auto=1']);
});
test('blocked cookies stop with a useful message instead of a redirect loop',async()=>{
  const result=await boot([null,null],'?enter=1');
  assert.deepEqual(result.redirects,[]);
  assert.match(result.elements.get('#guest-error').textContent,/Safari \/ Chrome/);
});
test('explicit account login remains available',async()=>{
  const result=await boot([null],'?account=login');
  assert.deepEqual(result.redirects,[]);assert.deepEqual(result.calls,['/api/me']);
});
