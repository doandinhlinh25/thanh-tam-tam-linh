'use strict';
const { performance } = require('node:perf_hooks');
const { createHarness } = require('./reviewer-harness.cjs');
(async () => {
  const h = createHarness();
  await new Promise(r => h.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${h.server.address().port}/documents/doc-1/approval`;
  const start = performance.now();
  const times = await Promise.all(Array.from({ length: 100 }, async () => {
    const t = performance.now();
    const r = await fetch(url, {method:'POST', headers:{authorization:'Bearer rA', 'if-match':'1', 'content-type':'application/json'}, body:'{}'});
    await r.arrayBuffer();
    return { code:r.status, elapsed:performance.now()-t };
  }));
  const samples = times.map(x=>x.elapsed).sort((a,b)=>a-b);
  const p95 = samples[Math.ceil(0.95*samples.length)-1];
  console.log(JSON.stringify({scenario:'100 simultaneous HTTP approval attempts SAME revision',target_p95_ms:3000,
    p50_ms:+samples[49].toFixed(2),p95_ms:+p95.toFixed(2),max_ms:+samples[99].toFixed(2),
    wall_ms:+(performance.now()-start).toFixed(2),success:times.filter(x=>x.code===200).length,
    conflict:times.filter(x=>x.code===409).length,
    pass_harness:p95<=3000 && times.filter(x=>x.code===200).length===1,
    limitation:'localhost in-memory fake; not production p95 or multi-process atomicity'},null,2));
  await new Promise(r=>h.server.close(r));
})().catch(e => {console.error(e);process.exitCode=1;});
