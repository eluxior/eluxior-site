const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../vendor-photo-submission/intake.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../vendor-photo-submission/index.html'), 'utf8');
const portal = 'https://photo-api.eluxiorsourcing.com/photo-card';
function visit(url, ready = true) {
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
    location, history:{replaceState:(...args)=>replaced.push(args)}, URL, window:{ELUXIOR_PHOTO_V2_READY:ready}
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

test('legacy token is removed from browser URL without sending any request',()=>{
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/?token=old-secret');
  assert.deepEqual(s.assigned,[]);
  assert.equal(s.replaced[0][2],'/vendor-photo-submission/');
  assert.match(s.elements['intake-status'].textContent,/older link/);
});
test('default feature gate blocks redirect until authenticated production portal is verified',()=>{
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/?po=186650',false);
  assert.deepEqual(s.assigned,[]);
  assert.equal(s.elements['po-entry'].value,'186650');
  assert.match(s.elements['intake-status'].textContent,/being updated/);
});
test('prefixed PO numbers normalize hyphens and spaces without bearer tokens',()=>{
  const s=visit('https://www.eluxiorsourcing.com/vendor-photo-submission/');
  s.elements['po-entry'].value='25-194660';
  s.events.submit({preventDefault(){}});
  assert.deepEqual(s.assigned,[portal+'?po=25194660']);
});

test('PO entry appears before compact instructions and protects legacy token referrers',()=>{
  assert(html.indexOf('<section class="action"') < html.indexOf('<section class="steps"'));
  assert(html.indexOf('name="referrer"') < html.indexOf('rel="stylesheet"'));
  assert.doesNotMatch(html,/measuring tape/i);
  assert.match(html,/Upload confirmed.*file was received/s);
});

const retiredReview = fs.readFileSync(path.join(__dirname, '../admin-photo-review/index.html'), 'utf8');
test('legacy admin decision UI is retired: receipt-only with no approval API or credentials',()=>{
  assert.match(retiredReview, /Upload confirmed/);
  assert.match(retiredReview, /vendor remains responsible/i);
  assert.match(retiredReview, /no manual or automatic product-image approval stage/i);
  assert.doesNotMatch(retiredReview, /\/v1\/admin\/photo-review/);
  assert.doesNotMatch(retiredReview, /(?:approved|needs_review|rejected).*onclick/i);
  assert.doesNotMatch(retiredReview, /type=["']password["']/);
  assert.doesNotMatch(retiredReview, /<script\b/i);
});
