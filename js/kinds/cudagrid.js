/* kind: cudagrid - CUDA grid / block / thread -> array element mapping, plus host-side workflow and kernel printf output.

   scene = { mode:'linear' | 'grid2d-yx' | 'grid2d-xy' | 'tid' | 'bid' | 'hello',
             gx, gy (default 1), bd (threads per block), N (elements; omit for 'hello'),
             a:[..], b:[..], op:'add' (c = a + b) | 'copy' | 'square' | 'none' }
   Blocks are numbered k = by*gx + bx in row-major order; `run` lists those numbers.
   step ops:
     cpu:'text'            what the host is doing now (persists)
     alloc:true  h2d:true  d2h:true     device buffers allocated / inputs copied in / result copied back
     launch:true           the grid appears
     run:[k..] | 'all'     blocks that execute during this step      thr:[t..] threads of those blocks that run (default all)
     focus:[k,t]           show the index arithmetic for one thread
     out:['line',..]       lines printed by the kernel (console)     hostOut:['line']  lines printed by the CPU   */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  function geom(scene) {
    const gx = scene.gx || 1, gy = scene.gy || 1, bd = scene.bd || 1;
    return { gx: gx, gy: gy, bd: bd, nb: gx * gy };
  }
  function idxOf(scene, k, t) {
    const g = geom(scene), bx = k % g.gx, by = Math.floor(k / g.gx);
    switch (scene.mode) {
      case 'grid2d-yx': return (by * g.gx + bx) * g.bd + t;
      case 'grid2d-xy': return bx * g.bd * g.gy + by * g.bd + t;
      case 'tid': return t;
      case 'bid': return bx;
      default: return bx * g.bd + t;
    }
  }
  function formula(scene, k, t) {
    const g = geom(scene), bx = k % g.gx, by = Math.floor(k / g.gx), idx = idxOf(scene, k, t);
    switch (scene.mode) {
      case 'grid2d-yx': return 'blockId = blockIdx.y &times; gridDim.x + blockIdx.x = ' + by + '&times;' + g.gx + '+' + bx + ' = ' + (by * g.gx + bx) +
        '<br>idx = blockId &times; blockDim.x + threadIdx.x = ' + (by * g.gx + bx) + '&times;' + g.bd + '+' + t + ' = <b>' + idx + '</b>';
      case 'grid2d-xy': return 'idx = blockIdx.x &times; blockDim.x &times; gridDim.y + blockIdx.y &times; blockDim.x + threadIdx.x<br>= ' +
        bx + '&times;' + g.bd + '&times;' + g.gy + ' + ' + by + '&times;' + g.bd + ' + ' + t + ' = <b>' + idx + '</b>';
      case 'tid': return 'idx = threadIdx.x = <b>' + idx + '</b>';
      case 'bid': return 'idx = blockIdx.x = <b>' + idx + '</b>';
      default: return 'idx = blockIdx.x &times; blockDim.x + threadIdx.x = ' + bx + '&times;' + g.bd + ' + ' + t + ' = <b>' + idx + '</b>';
    }
  }
  function cval(scene, i) {
    const a = scene.a ? scene.a[i] : i, b = scene.b ? scene.b[i] : i * i;
    switch (scene.op) {
      case 'copy': return a;
      case 'square': return a * a;
      case 'none': return '';
      default: return a + b;
    }
  }
  function blockLabel(scene, k) {
    const g = geom(scene);
    return g.gy > 1 ? '(' + (k % g.gx) + ',' + Math.floor(k / g.gx) + ')' : String(k);
  }

  PDC.kinds.cudagrid = {
    idxOf: idxOf, formula: formula,
    create: function (host, scene, steps) {
      const g = geom(scene), hello = scene.mode === 'hello', N = scene.N;

      function fold(i) {
        const st = { cpu: '', alloc: false, h2d: false, d2h: false, launched: false, ran: {}, cdone: {}, out: [], hostOut: [] };
        for (let j = 0; j <= i; j++) {
          const s = steps[j];
          if (s.cpu != null) st.cpu = s.cpu;
          if (s.alloc) st.alloc = true;
          if (s.h2d) { st.alloc = true; st.h2d = true; }
          if (s.launch) st.launched = true;
          if (s.d2h) st.d2h = true;
          if (s.out) s.out.forEach(function (o) { st.out.push(o); });
          if (s.hostOut) s.hostOut.forEach(function (o) { st.hostOut.push(o); });
          if (s.run) {
            const blocks = s.run === 'all' ? Array.from({ length: g.nb }, function (_, k) { return k; }) : s.run;
            const thr = s.thr || null;
            blocks.forEach(function (k) {
              st.ran[k] = st.ran[k] || {};
              for (let t = 0; t < g.bd; t++) {
                if (thr && thr.indexOf(t) < 0) continue;
                st.ran[k][t] = j;
                if (!hello) { const idx = idxOf(scene, k, t); if (idx < N) st.cdone[idx] = { k: k, j: j }; }
              }
            });
          }
        }
        return st;
      }

      function render(i) {
        const st = fold(i), s = steps[i];
        const nowBlocks = {};
        if (s.run) (s.run === 'all' ? Array.from({ length: g.nb }, function (_, k) { return k; }) : s.run).forEach(function (k) { nowBlocks[k] = true; });
        const thrNow = s.thr || null;
        let h = '<div class="cg">';
        h += '<div class="cg-cpu"><span class="tag">CPU</span><span class="txt">' + (st.cpu ? st.cpu : '<em>idle</em>') + '</span></div>';

        /* grid */
        h += '<div class="cg-gridwrap' + (st.launched ? '' : ' off') + '"><div class="cg-glabel"><span class="tag gpu">GPU</span>' +
          (st.launched ? 'grid: ' + g.gx + (g.gy > 1 ? '&times;' + g.gy : '') + ' block' + (g.nb > 1 ? 's' : '') + ' &times; ' + g.bd + ' thread' + (g.bd > 1 ? 's' : '') +
            ' = <b>' + (g.nb * g.bd) + '</b> threads' : 'kernel not launched yet') + '</div><div class="cg-grid">';
        for (let k = 0; k < g.nb; k++) {
          const isNow = nowBlocks[k];
          h += '<div class="cg-block ' + PDC.col(k) + (isNow ? ' now' : '') + (st.ran[k] && !isNow ? ' done' : '') + '"><div class="cg-bh">Block ' + blockLabel(scene, k) + '</div><div class="cg-threads">';
          const showAll = g.bd <= 32, cap = showAll ? g.bd : 16;
          for (let t = 0; t < cap; t++) {
            const idx = hello ? -1 : idxOf(scene, k, t);
            const skip = !hello && idx >= N;
            const act = isNow && (!thrNow || thrNow.indexOf(t) >= 0);
            const was = st.ran[k] && st.ran[k][t] != null;
            const foc = s.focus && s.focus[0] === k && s.focus[1] === t;
            h += '<i class="th' + (act ? ' act' : '') + (!act && was ? ' ran' : '') + (skip ? ' skip' : '') + (foc ? ' foc' : '') + '" title="thread ' + t + (hello ? '' : ' &rarr; idx ' + idx + (skip ? ' (guard: idx &ge; N, does nothing)' : '')) + '">' + t + '</i>';
          }
          if (!showAll) h += '<i class="th more">&hellip;' + g.bd + '</i>';
          h += '</div></div>';
        }
        h += '</div></div>';

        if (s.focus) {
          const k = s.focus[0], t = s.focus[1];
          h += '<div class="cg-formula ' + PDC.col(k) + '"><span class="tag">block ' + blockLabel(scene, k) + ', thread ' + t + '</span>' +
            (hello ? (s.formula || '') : formula(scene, k, t) + (idxOf(scene, k, t) >= N ? '<br><span class="bad">idx &ge; N &rarr; the <code>if</code> guard stops this thread</span>' : '')) + '</div>';
        } else if (s.formula) {
          h += '<div class="cg-formula"><span class="tag">note</span>' + s.formula + '</div>';
        }

        /* arrays */
        if (!hello && N != null) {
          const arr = function (name, kind, filled, extra) {
            let r = '<div class="cg-arr"><span class="nm">' + name + '</span><div class="cells">';
            for (let q = 0; q < N; q++) {
              let v = '', cls = '';
              if (kind === 'a') { v = filled ? (scene.a ? scene.a[q] : q) : ''; }
              else if (kind === 'b') { v = filled ? (scene.b ? scene.b[q] : q * q) : ''; }
              else {
                const d = st.cdone[q];
                if (d) { v = cval(scene, q); cls = ' ' + PDC.col(d.k) + (d.j === i ? ' fresh' : ''); } else { v = '?'; cls = ' empty'; }
                if (d && st.d2h) cls += ' copied';
              }
              r += '<i class="cell' + cls + (kind !== 'c' && !filled ? ' empty' : '') + '" title="' + name + '[' + q + ']">' + esc(v) + '</i>';
            }
            return r + '</div>' + (extra || '') + '</div>';
          };
          h += '<div class="cg-arrays' + (st.alloc ? '' : ' off') + '">' +
            arr('a', 'a', st.h2d) + arr('b', 'b', st.h2d) + arr('c', 'c', true, st.d2h ? '<span class="cp">copied to host</span>' : '') +
            '<div class="cg-idxrow"><span class="nm">idx</span><div class="cells">' + Array.from({ length: N }, function (_, q) { return '<i class="cell ix">' + q + '</i>'; }).join('') + '</div></div></div>';
        }

        /* console */
        if (st.out.length || st.hostOut.length || scene.console) {
          const all = st.out.map(function (o) { return '<div class="gpu">' + esc(o) + '</div>'; }).concat(st.hostOut.map(function (o) { return '<div class="cpu">' + esc(o) + '</div>'; }));
          h += '<div class="cg-console"><span class="tag">stdout</span>' + (all.length ? all.slice(-9).join('') : '<div class="muted">(nothing printed yet)</div>') + '</div>';
        }
        host.innerHTML = h + '</div>';
      }
      return { render: render };
    }
  };

  /* ---------- helpers that build the usual step sequences ---------- */
  const CG = (PDC.CG = {});

  /* Standard vector-style example: alloc -> h2d -> launch -> blocks -> d2h. */
  CG.auto = function (scene, o) {
    o = o || {};
    const code = o.code || {};
    const g = geom(scene), N = scene.N, total = g.nb * g.bd;
    const cfg = (g.gy > 1 ? 'dim3(' + g.gx + ',' + g.gy + ')' : g.gx) + ' block' + (g.nb > 1 ? 's' : '') + ' &times; ' + g.bd + ' thread' + (g.bd > 1 ? 's' : '');
    const mid = Math.min(g.bd - 1, Math.floor(g.bd / 2));
    const say = o.say || {};
    const steps = [];
    steps.push({ t: 'Allocate on the GPU', cpu: '<code>cudaMalloc</code> &times; 3 &mdash; room for a, b and c in GPU memory', alloc: true, code: code.alloc,
      say: say.alloc || 'The CPU (host) asks the GPU (device) for memory. GPU memory is separate from CPU memory, so the arrays must be allocated and filled explicitly.' });
    steps.push({ t: 'Copy inputs host &rarr; device', cpu: '<code>cudaMemcpy(..., HostToDevice)</code> for a and b', h2d: true, code: code.h2d,
      say: say.h2d || 'The input arrays travel over the PCIe / NVLink bus. Only after this copy can GPU threads read <code>a</code> and <code>b</code>.' });
    steps.push({ t: 'Launch the kernel', cpu: '<code>' + (o.kernel || 'kernel') + '&lt;&lt;&lt;' + (g.gy > 1 ? 'grid' : g.gx) + ', ' + g.bd + '&gt;&gt;&gt;(...)</code>', launch: true, code: code.launch,
      say: say.launch || ('The launch configuration creates <b>' + cfg + ' = ' + total + ' threads</b>. All of them run the <em>same</em> kernel code; each finds its own data through its block and thread ids.' +
        (N != null && total > N ? ' Note ' + total + ' &gt; N = ' + N + ': a few threads have no element to work on.' : '')) });
    const order = [];
    const firstBlocks = Math.min(o.individual != null ? o.individual : 2, g.nb);
    for (let k = 0; k < firstBlocks; k++) order.push(k);
    order.forEach(function (k, n) {
      const t = k === 0 ? Math.min(mid, g.bd - 1) : Math.min(g.bd - 1, 1);
      steps.push({ t: 'Block ' + blockLabel(scene, k) + ' runs', run: [k], focus: [k, t], code: code.kernel,
        say: (say['block' + k]) || ('Block ' + blockLabel(scene, k) + '\'s threads run together. Look at thread <b>' + t + '</b>: it combines <code>blockIdx</code>, <code>blockDim</code> and <code>threadIdx</code> to get a unique <code>idx</code>, then handles element <code>c[idx]</code> alone.') });
    });
    if (g.nb > firstBlocks) {
      const rest = [];
      for (let k = firstBlocks; k < g.nb; k++) rest.push(k);
      const lastB = g.nb - 1, lastT = g.bd - 1;
      const overshoot = N != null && idxOf(scene, lastB, lastT) >= N;
      steps.push({ t: 'The remaining blocks run', run: rest, focus: overshoot ? [lastB, lastT] : undefined, code: code.kernel,
        say: say.rest || ('The other blocks run <b>concurrently</b>, in no guaranteed order &mdash; the hardware schedules them onto free multiprocessors.' +
          (overshoot ? ' The last thread computes idx = ' + idxOf(scene, lastB, lastT) + ' &ge; N, so the bounds check <code>if (idx &lt; N)</code> makes it do nothing.' : '')) });
    }
    steps.push({ t: 'Copy the result back', cpu: '<code>cudaMemcpy(..., DeviceToHost)</code> &mdash; waits for the kernel, then copies c', d2h: true, code: code.d2h,
      say: say.d2h || 'This copy is synchronous: it first waits for every block to finish, then brings <code>c</code> back to host memory, where the CPU prints the sums.' });
    if (o.free !== false && code.free) steps.push({ t: 'Free the memory', cpu: '<code>cudaFree</code> / <code>free</code>', code: code.free, say: say.free || 'Release GPU and CPU memory.' });
    if (o.extra) o.extra.forEach(function (x) { steps.push(x); });
    return steps;
  };

  /* Hello-world style: kernel printf output and the role of synchronisation. */
  CG.hello = function (scene, o) {
    o = o || {};
    const code = o.code || {}, g = geom(scene), steps = [];
    const text = o.text || 'Hello, world!';
    const line = o.line || function (k, t) { return 'From GPU ' + text; };
    steps.push({ t: 'Launch is asynchronous', launch: true, cpu: '<code>kernel&lt;&lt;&lt;' + g.gx + ', ' + g.bd + '&gt;&gt;&gt;()</code> returns <b>immediately</b> &mdash; the CPU keeps going', code: code.launch,
      say: 'A kernel launch only <em>queues</em> work on the GPU. The CPU does not wait for it. ' + g.gx * g.bd + ' threads are created.' });
    if (o.whatIf !== false) steps.push({ t: 'What if the CPU just returned?', cpu: '<em>hypothetical:</em> <code>return 0;</code> &mdash; the process would exit while the GPU is still working', code: code.end || code.sync,
      say: 'Hypothetical: without a synchronisation call, <code>main()</code> could exit first and the GPU output might never appear. That is why the program waits.' });
    const per = o.order || Array.from({ length: g.gx }, function (_, k) { return k; });
    per.forEach(function (k, n) {
      const t = 0;
      const lines = [];
      const shown = Math.min(g.bd, o.perBlock || 3);
      for (let q = 0; q < shown; q++) lines.push(line(k, q));
      if (g.bd > shown) lines.push('... ' + (g.bd - shown) + ' more from block ' + k);
      steps.push({ t: 'Block ' + k + ' threads print', run: [k], out: lines, code: code.kernel, cpu: 'CPU: not waiting for the GPU yet (the launch returned immediately)',
        say: n === 0 ? 'Every thread executes <code>printf</code>. Output from different blocks and threads arrives in <b>no fixed order</b> &mdash; run the program twice and the order can differ.'
                     : 'Another block\'s threads print. Blocks are scheduled independently of each other.' });
    });
    steps.push({ t: o.syncTitle || 'Wait for the GPU', cpu: o.syncText || '<code>cudaDeviceSynchronize()</code> blocks the CPU until all queued kernels finish and their printf buffers are flushed',
      code: code.sync, say: o.syncSay || 'Now the CPU blocks until the GPU is done, so all GPU lines are flushed to the terminal first.' });
    steps.push({ t: 'CPU prints last', hostOut: [o.hostLine || 'From CPU ' + text], cpu: 'CPU resumes and prints', code: code.host,
      say: 'Because the CPU waited, its message comes <b>after</b> all GPU messages. Without the wait the order would be undefined.' });
    return steps;
  };
})();
