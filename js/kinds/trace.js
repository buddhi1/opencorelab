/* kind: trace - a debugger session next to the live program state.

   scene = { prompt:'(gdb)', title:'terminal' }
   step ops (all accumulate):
     term:['(gdb) break main', 'Breakpoint 1 ...']     lines appended to the terminal
     stack:['factorial (n=5)', 'main ()']              call stack, innermost first
     vars:{ i:1, result:1 }                            variable values (changed ones flash); null removes
     arr:{ name:'arr', v:[..], at:[pos], bad:[pos], off:-1 }   an array (pos = position in v; `off` shifts the printed index, e.g. -1 to show arr[-1])
     out:['text']                                      lines printed by the program itself                    */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  PDC.kinds.trace = {
    create: function (host, scene, steps) {
      function render(i) {
        const term = [], out = [], vars = {}, changed = {};
        let stack = [], arr = null;
        for (let j = 0; j <= i; j++) {
          const s = steps[j];
          (s.term || []).forEach(function (t) { term.push(t); });
          (s.out || []).forEach(function (t) { out.push(t); });
          if (s.stack) stack = s.stack;
          if (s.vars) Object.keys(s.vars).forEach(function (k) {
            if (s.vars[k] === null) delete vars[k]; else { if (String(vars[k]) !== String(s.vars[k]) && j === i) changed[k] = true; vars[k] = s.vars[k]; }
          });
          if (s.arr) arr = s.arr;
        }
        const cur = steps[i];
        const lastTerm = (cur.term || []).length;
        let t = '';
        term.forEach(function (l, k) {
          const fresh = k >= term.length - lastTerm;
          const pr = /^\((cuda-)?gdb\)/.test(l);
          t += '<div class="tl' + (pr ? ' pr' : '') + (fresh ? ' fresh' : '') + '">' + esc(l) + '</div>';
        });
        let v = '';
        const names = Object.keys(vars);
        v += names.length ? names.map(function (k) { return '<tr class="' + (changed[k] ? 'chg' : '') + '"><td>' + esc(k) + '</td><td>' + esc(vars[k]) + '</td></tr>'; }).join('') :
          '<tr><td colspan="2" class="muted">no locals yet</td></tr>';
        let a = '';
        if (arr) {
          a = '<div class="tr-arr"><span class="nm">' + esc(arr.name || 'arr') + '</span><div class="cells">' + arr.v.map(function (x, k) {
            const bad = (arr.bad || []).indexOf(k) >= 0, at = (arr.at || []).indexOf(k) >= 0;
            return '<i class="cell' + (at ? ' at' : '') + (bad ? ' bad' : '') + '"><small>' + (k + (arr.off || 0)) + '</small>' + esc(x) + '</i>';
          }).join('') + '</div></div>';
        }
        host.innerHTML =
          '<div class="tr"><div class="tr-term"><div class="tr-bar"><i></i><i></i><i></i><span>' + esc(scene.title || 'terminal') + '</span></div><div class="tr-body">' + t + '</div></div>' +
          '<div class="tr-side"><div class="tr-box"><h5>Call stack</h5>' + (stack.length ? stack.map(function (f, k) { return '<div class="fr' + (k === 0 ? ' top' : '') + '">#' + k + ' ' + esc(f) + '</div>'; }).join('') : '<div class="muted">program not started</div>') + '</div>' +
          '<div class="tr-box"><h5>Variables</h5><table>' + v + '</table>' + a + '</div>' +
          (out.length ? '<div class="tr-box"><h5>Program output</h5>' + out.map(function (o) { return '<div class="po">' + esc(o) + '</div>'; }).join('') + '</div>' : '') + '</div></div>';
        const body = host.querySelector('.tr-body'); if (body) body.scrollTop = body.scrollHeight;
      }
      return { render: render };
    }
  };
})();
