const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../vendor-photo-submission/intake.js'), 'utf8');
const portal = 'https://eluxior-vendor-api.marco-eluxior.workers.dev/photo-card';
function visit(url) {
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
    location, history:{replaceState:(...args)=>replaced.push(args)}, URL
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
