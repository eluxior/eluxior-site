const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../vendor-photo-submission/intake.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../vendor-photo-submission/index.html'), 'utf8');
const portal = 'https://eluxior-vendor-api.marco-eluxior.workers.dev/photo-card';
function visit(url, fetchImpl = () => Promise.reject(Error('Unexpected fetch'))) {
  const events = {};
  const elements = {
    'intake-status': {textContent:''},
    'photo-form': {addEventListener:(event,fn)=>{events[event]=fn}},
    'po-entry': {value:'',focus:()=>{events.focused=true}}
  };
  const assigned = [], replaced = [];
  const location = {href:url,pathname:'/vendor-photo-submission/',assign:x=>assigned.push(x)};
  vm.runInNewContext(script,{
    document:{getElementById:id=>elements[id]},
    location, history:{replaceState:(...args)=>replaced.push(args)}, URL, fetch:fetchImpl
  });
  return {events,elements,assigned,replaced};
}

test('Digest PO link enters the one canonical portal without a bearer token',()=>{
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/?po=186650&token=secret');
  assert.deepEqual(s.assigned,[portal+'?po=186650']);
  assert.equal(s.replaced[0][2],'/vendor-photo-submission/');
  assert.equal(s.assigned[0].includes('secret'),false);
});
test('manual PO entry navigates only after validating its number',()=>{
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/');
  s.elements['po-entry'].value='50 274701';
  s.events.submit({preventDefault(){}});
  assert.deepEqual(s.assigned,[portal+'?po=50274701']);
});
test('invalid PO cannot navigate or become an authorization token',()=>{
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/?po=../../foo&token=legacy');
  assert.equal(s.assigned.length,0);
  s.elements['po-entry'].value='foo';
  s.events.submit({preventDefault(){}});
  assert.equal(s.assigned.length,0);
  assert.equal(s.events.focused,true);
});

test('existing token-only link resolves PO without forwarding token to portal', async()=>{
  const calls=[];
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/?token=old-secret',
    (url, options)=>{calls.push({url,options}); return Promise.resolve({ok:true,json:async()=>({po:'160844'})});});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(s.replaced[0][2],'/vendor-photo-submission/');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url.startsWith('https://eluxior-vendor-api.marco-eluxior.workers.dev/v1/photo-intake/context?token='),true);
  assert.equal(calls[0].options.referrerPolicy,'no-referrer');
  assert.deepEqual(s.assigned,[portal+'?po=160844']);
  assert.equal(s.assigned[0].includes('old-secret'),false);
});

test('unavailable legacy token leaves manual PO entry available', async()=>{
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/?token=expired',
    ()=>Promise.resolve({ok:false}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(s.assigned.length,0);
  assert.match(s.elements['intake-status'].textContent,/Enter the PO number/);
});

test('PO entry appears before compact instructions and protects legacy token referrers',()=>{
  assert(html.indexOf('<section class="action"') < html.indexOf('<section class="steps"'));
  assert(html.indexOf('name="referrer"') < html.indexOf('rel="stylesheet"'));
  assert.doesNotMatch(html,/measuring tape/i);
  assert.match(html,/Upload confirmed.*file was received/s);
});
