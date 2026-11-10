'use strict';
/** VT-003 executable contract probe; NOT wired to live Mongo/tenant-service. */
const http = require('node:http');

const APPROVAL_ROLES = new Set(['reviewer']); // VT-003: only reviewers may approve.
const WRITE_ROLES = new Set(['tenant_owner', 'tenant_admin', 'lecturer']);
const READ_ROLES = new Set(['tenant_owner', 'tenant_admin', 'lecturer', 'student', 'reviewer']);

function createHarness({ unavailable = false } = {}) {
  const actors = new Map([
    ['rA', { id: 'reviewer-A', tenantId: 'tenant-A', role: 'reviewer', active: true }],
    ['ownerA', { id: 'owner-A', tenantId: 'tenant-A', role: 'tenant_owner', active: true }],
    ['studentA', { id: 'student-A', tenantId: 'tenant-A', role: 'student', active: true }],
    ['rB', { id: 'reviewer-B', tenantId: 'tenant-B', role: 'reviewer', active: true }],
    ['revokedA', { id: 'reviewer-disabled', tenantId: 'tenant-A', role: 'reviewer', active: false }]
  ]);
  // Documents are read-only fixtures. Approval state is a distinct record.
  const documents = new Map([
    ['doc-1', Object.freeze({ id: 'doc-1', tenantId: 'tenant-A', title: 'SE course material', content: 'Immutable source v1' })],
    ['doc-2', Object.freeze({ id: 'doc-2', tenantId: 'tenant-B', title: 'Other tenant material', content: 'Private tenant B' })]
  ]);
  const approvals = new Map([['doc-1', { status: 'pending', version: 1 }], ['doc-2', { status: 'pending', version: 1 }]]);
  const origin = JSON.stringify(documents.get('doc-1'));

  function reply(res, status, data) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  async function bodyJSON(req) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 4096) throw Object.assign(new Error('too_large'), { status: 413 });
    }
    const text = Buffer.concat(chunks).toString('utf8');
    try { return text ? JSON.parse(text) : {}; }
    catch { throw Object.assign(new Error('bad_json'), { status: 400 }); }
  }
  async function handler(req, res) {
    try {
      const actor = actors.get((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!actor) return reply(res, 401, { error: 'unauthenticated' });
      if (!actor.active) return reply(res, 403, { error: 'inactive_membership' });
      const match = /^\/documents\/(doc-[\w-]+)(?:\/(approval))?$/.exec(new URL(req.url, 'http://localhost').pathname);
      if (!match) return reply(res, 404, { error: 'not_found' });
      const [, id, action] = match;
      const document = documents.get(id);
      // Intentional not-found masking of cross-tenant existence.
      if (!document || document.tenantId !== actor.tenantId) return reply(res, 404, { error: 'not_found' });
      if (!action && req.method === 'GET') {
        if (!READ_ROLES.has(actor.role)) return reply(res, 403, { error: 'forbidden' });
        return reply(res, 200, { document, approval: { ...approvals.get(id) } });
      }
      if (!action && ['PATCH', 'PUT', 'DELETE'].includes(req.method)) {
        // The harness does not implement edits for ANY role; do not treat 403 as production authorization proof.
        return reply(res, 403, { error: WRITE_ROLES.has(actor.role) ? 'not_implemented' : 'forbidden' });
      }
      if (action === 'approval' && req.method === 'POST') {
        if (!APPROVAL_ROLES.has(actor.role)) return reply(res, 403, { error: 'forbidden' });
        const raw = req.headers['if-match'];
        if (raw === undefined) return reply(res, 428, { error: 'version_required' });
        if (!/^[1-9]\d*$/.test(String(raw))) return reply(res, 400, { error: 'invalid_version' });
        const requestedVersion = Number(raw);
        if (!Number.isSafeInteger(requestedVersion)) return reply(res, 400, { error: 'invalid_version' });
        const payload = await bodyJSON(req);
        if (Object.keys(payload).length !== 0) return reply(res, 400, { error: 'approval_is_metadata_only' });
        if (unavailable) return reply(res, 503, { error: 'approval_store_unavailable' });
        // Compare-and-set is synchronous in the in-process fixture only.
        const current = approvals.get(id);
        if (current.version !== requestedVersion || current.status !== 'pending')
          return reply(res, 409, { error: 'approval_conflict', currentVersion: current.version });
        const approved = { status: 'approved', version: current.version + 1, reviewerId: actor.id };
        approvals.set(id, approved);
        return reply(res, 200, { approval: approved });
      }
      return reply(res, 405, { error: 'method_not_allowed' });
    } catch (error) { return reply(res, error.status || 500, { error: error.message || 'internal_error' }); }
  }
  return { actors, documents, approvals, originalSnapshot: origin, server: http.createServer(handler) };
}
module.exports = { createHarness };
