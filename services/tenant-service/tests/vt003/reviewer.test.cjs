'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./reviewer-harness.cjs');

async function fixture(options) {
  const app = createHarness(options);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  return { ...app, base: `http://127.0.0.1:${app.server.address().port}`,
    close: () => new Promise(resolve => app.server.close(resolve)) };
}
async function call(app, path, token='rA', method='GET', version, body) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  if (version !== undefined) headers['if-match'] = String(version);
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(app.base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, json: await response.json() };
}
async function inFixture(callback, options) { const app = await fixture(options); try { await callback(app); } finally { await app.close(); } }

// Test data: two tenants, distinct actors, one immutable document and separate approval record.
test('VT01 reviewer reads own-tenant document and pending decision', () => inFixture(async a => {
  const r = await call(a, '/documents/doc-1');
  assert.equal(r.status, 200); assert.equal(r.json.document.tenantId, 'tenant-A'); assert.equal(r.json.approval.status, 'pending');
}));
test('VT02 reviewer approves through metadata-only endpoint', () => inFixture(async a => {
  const r = await call(a, '/documents/doc-1/approval', 'rA', 'POST', 1, {});
  assert.equal(r.status, 200); assert.equal(r.json.approval.status, 'approved'); assert.equal(r.json.approval.version, 2);
}));
test('VT03 approval must not modify original document', () => inFixture(async a => {
  const before = JSON.stringify(a.documents.get('doc-1'));
  assert.equal((await call(a, '/documents/doc-1/approval', 'rA', 'POST', 1, {})).status, 200);
  assert.equal(JSON.stringify(a.documents.get('doc-1')), before); assert.equal(before, a.originalSnapshot);
}));
test('VT04 reviewer cannot PATCH/PUT/DELETE source content', () => inFixture(async a => {
  for (const method of ['PATCH','PUT','DELETE']) assert.equal((await call(a,'/documents/doc-1','rA',method)).status,403);
}));
test('VT05 anonymous request is rejected', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1','')).status,401);
}));
test('VT06 student cannot approve', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1/approval','studentA','POST',1,{})).status,403);
}));
test('VT07 reviewer from another tenant cannot read or approve', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1','rB')).status,404);
  assert.equal((await call(a,'/documents/doc-1/approval','rB','POST',1,{})).status,404);
}));
test('VT08 missing If-Match returns 428 without side effect', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST',undefined,{})).status,428);
  assert.equal(a.approvals.get('doc-1').status,'pending');
}));
test('VT09 malformed version returns 400', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST','-1',{})).status,400);
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST','garbage',{})).status,400);
}));
test('VT10 stale precondition conflicts after first approval', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST',1,{})).status,200);
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST',1,{})).status,409);
}));
test('VT11 two concurrent approvals allow exactly one winner', () => inFixture(async a => {
  const outcomes = await Promise.all(Array.from({length:2},() => call(a,'/documents/doc-1/approval','rA','POST',1,{})));
  assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,409]);
}));
test('VT12 100 concurrent approvals allow one winner and 99 conflicts', () => inFixture(async a => {
  const outcomes = await Promise.all(Array.from({length:100},() => call(a,'/documents/doc-1/approval','rA','POST',1,{})));
  assert.equal(outcomes.filter(x=>x.status===200).length,1);
  assert.equal(outcomes.filter(x=>x.status===409).length,99);
  assert.equal(a.approvals.get('doc-1').version,2);
}));
test('VT13 dependency failure returns 503 with no write', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST',1,{})).status,503);
  assert.equal(a.approvals.get('doc-1').status,'pending');
}, { unavailable:true }));
test('VT14 inactive reviewer cannot read or approve', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1','revokedA')).status,403);
  assert.equal((await call(a,'/documents/doc-1/approval','revokedA','POST',1,{})).status,403);
}));
test('VT15 approve payload cannot contain source edit fields', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST',1,{ content:'inject new source' })).status,400);
  assert.equal(a.approvals.get('doc-1').version,1);
}));
test('VT16 other tenant data stays untouched', () => inFixture(async a => {
  assert.equal((await call(a,'/documents/doc-1/approval','rA','POST',1,{})).status,200);
  assert.equal(a.approvals.get('doc-2').status,'pending');
  assert.equal(a.documents.get('doc-2').content,'Private tenant B');
}));
