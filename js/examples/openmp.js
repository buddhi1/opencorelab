/* OpenMP examples: pdc/openmp/src1 (basics) and pdc/openmp/src2 (directives and clauses). */
(function () {
  'use strict';
  const B1 = 'pdc/openmp/src1/', B2 = 'pdc/openmp/src2/';
  const basics = { course: 'pdc', topic: 'openmp-basics' }, dirs = { course: 'pdc', topic: 'openmp-directives' };
  const TL = ['T0', 'T1', 'T2', 'T3'];
  const all = function (txt, cls, span, col) { return [0, 1, 2, 3].map(function (l) { return [l, typeof txt === 'function' ? txt(l) : txt, cls, span, col]; }); };
  const forkLinks = [[0, 1], [0, 2], [0, 3]];

  /* ---------- hello (src1/hello.c, src1/hello_threads.c, src2/parallel_directive.c) ---------- */
  function helloSteps(o) {
    const hello = o.hello, bye = o.bye;
    return [
      { t: 'Fork: a team of threads is created', col: 0, ev: all('start', 'sys'), link: forkLinks, code: o.fork,
        say: 'At <code>#pragma omp parallel</code> the program <b>forks</b> a team. The number of threads comes from <code>OMP_NUM_THREADS</code> (by default, the number of cores). The thread that was running becomes thread 0 (the master).' },
      { t: 'Every thread runs the block', ev: [[0, hello(0), '', 1, 1], [2, hello(2), '', 1, 1], [2, bye(2), '', 1, 2], [1, hello(1), '', 1, 2], [0, bye(0), '', 1, 2], [3, hello(3), '', 1, 3], [1, bye(1), '', 1, 3]], col: 1, code: o.body,
        say: 'The <em>same</em> block is executed by <b>every</b> thread, so each line is printed once per thread. The threads progress at their own speed, so the lines of different threads <b>interleave</b> in an unpredictable order.' },
      { t: 'Join: the team ends', col: 4, ev: [[3, bye(3), '', 1, 4]].concat(all('end', 'done', 1, 5)), bar: { at: 5, lanes: 'all', label: 'implicit barrier' }, code: o.end,
        say: 'There is an <b>implicit barrier</b> at the closing brace of the parallel region. After it, the extra threads are parked and only the master continues with the code after the region.' }
    ];
  }
  const helloScene = { lanes: ['T0 (master)', 'T1', 'T2', 'T3'], colw: 96 };
  const hello1 = PDC.add(Object.assign({}, basics, {
    id: 'hello', title: 'Hello from every thread', files: [B1 + 'hello.c'],
    summary: 'The smallest OpenMP program: a <code>parallel</code> region whose body is executed by every thread of the team.',
    concepts: ['#pragma omp parallel', 'fork-join', 'thread team', 'OMP_NUM_THREADS'],
    kind: 'lanes', scene: helloScene,
    steps: helloSteps({ hello: function () { return 'Hello\nworld !'; }, bye: function () { return 'Goodbye\nworld !'; }, fork: '#pragma omp parallel', body: ['printf("Hello world ! \\n");', 'printf("Goodbye world ! \\n");'], end: 'return 0;' }),
    notes: ['Compile with <code>-fopenmp</code>; without it the pragma is ignored and the program runs on one thread.'],
    tryit: ['Run with <code>OMP_NUM_THREADS=1</code>, <code>2</code>, <code>8</code> and count the lines.', 'Run it five times. Does the interleaving change?']
  }));
  PDC.add(Object.assign({}, basics, {
    id: 'hello_threads', title: 'Hello with thread numbers', files: [B1 + 'hello_threads.c'],
    summary: 'Same program, but every line includes <code>omp_get_thread_num()</code>, which tells each thread who it is.',
    concepts: ['omp_get_thread_num', 'thread id', 'interleaved output'],
    kind: 'lanes', scene: helloScene,
    steps: helloSteps({ hello: function (t) { return 'Hello, I am\nthread ' + t; }, bye: function (t) { return 'Goodbye\nthread ' + t; }, fork: '#pragma omp parallel', body: ['printf("Hello world from thread %d\\n", omp_get_thread_num());', 'printf("Goodbye world from thread %d\\n", omp_get_thread_num());'], end: 'return 0;' }),
    notes: ['Thread ids are 0 &hellip; N&minus;1 inside the region. Outside it, <code>omp_get_thread_num()</code> is 0.', 'The ids make the interleaving visible: lines of different threads mix, but lines from <em>one</em> thread stay in program order.']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'parallel_directive', title: 'parallel directive', files: [B2 + 'parallel_directive.c'],
    summary: 'The <code>parallel</code> directive in its plainest form: every thread prints both lines.',
    concepts: ['parallel', 'team of threads'], kind: 'lanes', scene: helloScene,
    steps: helloSteps({ hello: function () { return 'Hello\nworld'; }, bye: function () { return 'Goodbye\nworld'; }, fork: '#pragma omp parallel', body: ['printf("Hello world\\n");', 'printf("Goodbye world\\n");'], end: 'return 0;' }),
    notes: ['All other directives in this folder (<code>single</code>, <code>master</code>, <code>critical</code>, &hellip;) are used <em>inside</em> a parallel region like this one.']
  }));

  /* ---------- barrier (src1/barrier.c, src2/barrier_directive.c) ---------- */
  function barrierSteps(o) {
    return [
      { t: 'Threads start at different speeds', col: 0, ev: all('start', 'sys'), link: forkLinks, code: o.fork, say: 'A team is created. ' + (o.idSay || '') },
      { t: 'Each prints Hello', ev: [[2, o.h(2), '', 1, 1], [0, o.h(0), '', 1, 1], [3, o.h(3), '', 1, 2], [1, o.h(1), '', 1, 3]], col: 1, code: o.hello, say: 'The threads reach the first print at different times.' },
      { t: 'Early arrivals wait', col: 2, ev: [[2, 'barrier', 'wait', 2, 2], [0, 'barrier', 'wait', 2, 2], [3, 'barrier', 'wait', 1, 3]], code: '#pragma omp barrier',
        say: '<code>#pragma omp barrier</code> makes each thread <b>wait until all threads of the team have reached it</b>.' },
      { t: 'The last thread arrives: all continue', col: 4, bar: { at: 4, lanes: 'all', label: 'barrier' }, ev: [[1, 'barrier\n(last)', 'lock', 1, 3]].concat(all(o.b, '', 1, 4)), code: o.bye,
        say: 'Only now does any thread print "Goodbye". <b>Every</b> "Hello" line is guaranteed to appear before <b>any</b> "Goodbye" line.' }
    ];
  }
  PDC.add(Object.assign({}, basics, {
    id: 'barrier', title: 'Barrier with private ids', files: [B1 + 'barrier.c'],
    summary: 'All threads print "Hello", wait at <code>#pragma omp barrier</code>, and only then print "Goodbye". The thread id is kept in a <code>private</code> variable.',
    concepts: ['#pragma omp barrier', 'private(id)', 'phases'], kind: 'lanes', scene: helloScene,
    steps: barrierSteps({ fork: '#pragma omp parallel private(id)', idSay: '<code>private(id)</code> gives each thread its own copy of <code>id</code>, so each can store its own thread number.', h: function (t) { return 'Hello\nthread ' + t; }, b: function (t) { return 'Goodbye\nthread ' + t; }, hello: 'printf("Hello world from thread %d\\n", id);', bye: 'printf("Goodbye world from thread %d\\n", id);' }),
    notes: ['If <code>id</code> were shared, threads would overwrite each other\'s id.'],
    tryit: ['Remove the barrier and run several times. Do "Goodbye" lines appear before the last "Hello"?']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'barrier_directive', title: 'barrier directive', files: [B2 + 'barrier_directive.c'],
    summary: 'The explicit <code>barrier</code> directive: all "Hello world" lines are printed before any "Goodbye world".',
    concepts: ['barrier'], kind: 'lanes', scene: helloScene,
    steps: barrierSteps({ fork: '#pragma omp parallel', h: function () { return 'Hello\nworld'; }, b: function () { return 'Goodbye\nworld'; }, hello: 'printf("Hello world\\n");', bye: 'printf("Goodbye world\\n");' }),
    notes: ['Many work-sharing constructs already end with an implicit barrier (<code>for</code>, <code>single</code>, <code>sections</code>); <code>nowait</code> removes it.']
  }));

  /* ---------- rc: race condition ---------- */
  PDC.add(Object.assign({}, basics, {
    id: 'rc', title: 'Race condition (lost update)', files: [B1 + 'rc.c'],
    summary: 'Every thread executes <code>sum = sum + 1</code> on a shared variable with no protection. The final value is often smaller than the number of threads.',
    concepts: ['data race', 'lost update', 'read-modify-write', 'shared variable'],
    kind: 'lanes', scene: { lanes: TL, colw: 100, vars: { sum: 0 } },
    steps: [
      { t: 'Four threads, one shared sum', col: 0, ev: all('start', 'sys'), link: forkLinks, code: ['int sum  = 0;', '#pragma omp parallel'],
        say: '<code>sum</code> is declared outside the region, so it is <b>shared</b>: there is one memory location for all threads. Each thread will add 1, so we <em>expect 4</em>.' },
      { t: 'All read the same old value', col: 1, ev: all('load sum\n(=0)', ''), code: 'sum = sum + 1;',
        say: '<code>sum = sum + 1</code> is really <b>three</b> machine steps: <em>load</em> sum, <em>add</em> 1, <em>store</em> sum. All four threads load before anyone has stored, so they all see 0.' },
      { t: 'Everyone adds 1 to its own copy', col: 2, ev: all('tmp = 0+1\n= 1', ''), code: 'sum = sum + 1;', say: 'Each thread computes 1 in a register.' },
      { t: 'Everyone stores 1: three updates are lost', col: 3, ev: all('store\nsum = 1', 'bad'), set: { sum: { v: 1, cls: 'bad' } }, code: 'sum = sum + 1;',
        say: 'Every thread writes <b>1</b>. The final value is 1, not 4. Which updates are lost depends on timing, so the result can differ from run to run &mdash; the hallmark of a <b>race condition</b>.' },
      { t: 'The wrong answer is printed', col: 4, ev: all('printf\n"sum = 1"', 'bad'), code: ['printf("The current sum value is %d from thread %d\\n", sum, omp_get_thread_num());', 'printf("The final sum value is %d  from thread %d\\n"'],
        say: 'Run the real program repeatedly: you will sometimes see 4, sometimes less. A race that "usually works" is still a bug. The next two examples fix it with <code>critical</code> and <code>atomic</code>.' }
    ],
    notes: ['The race exists even though the code is just one line: the unit of atomicity is the machine instruction, not the C statement.'],
    tryit: ['Run it 20 times with <code>OMP_NUM_THREADS=8</code> and count the distinct final values.']
  }));

  /* ---------- critical (src1/critical.c) ---------- */
  PDC.add(Object.assign({}, basics, {
    id: 'critical', title: 'critical: one thread at a time', files: [B1 + 'critical.c'],
    summary: 'The race from <code>rc.c</code> is fixed by wrapping the update <em>and</em> the print in <code>#pragma omp critical</code>.',
    concepts: ['#pragma omp critical', 'mutual exclusion', 'serialisation'],
    kind: 'lanes', scene: { lanes: TL, colw: 100, vars: { sum: 0 } },
    steps: [
      { t: 'The team forks', col: 0, ev: all('start', 'sys'), link: forkLinks, code: ['int sum  = 0;', '#pragma omp parallel'], say: 'Same shared <code>sum</code> as before.' },
      { t: 'One thread enters the critical region', col: 1, ev: [[2, 'critical:\nsum = 1', 'lock'], [0, 'wait', 'wait'], [1, 'wait', 'wait'], [3, 'wait', 'wait']], set: { sum: 1 }, code: ['#pragma omp critical', 'sum = sum + 1;'],
        say: 'Exactly one thread (here T2) may execute the block at a time. The others <b>wait</b> at its entrance.' },
      { t: 'They take turns', col: 2, ev: [[2, 'print "1"', 'good'], [0, 'critical:\nsum = 2', 'lock'], [1, 'wait', 'wait'], [3, 'wait', 'wait']], set: { sum: 2 }, code: 'printf("The current sum value is %d from thread %d\\n", sum, omp_get_thread_num());',
        say: 'While T2 leaves, the next thread enters. The print is <em>inside</em> the critical region, so it shows the value that this thread just wrote.' },
      { t: 'Finally everyone has updated sum', col: 4, ev: [[0, 'print "2"', 'good', 1, 3], [3, 'critical:\nsum = 3', 'lock', 1, 3], [1, 'critical:\nsum = 4', 'lock', 1, 4], [3, 'print "3"', 'good', 1, 4], [1, 'print "4"', 'good', 1, 5]], set: { sum: { v: 4, cls: 'good' } }, code: 'printf("The final sum value is %d  from thread %d\\n"',
        say: 'The four updates happen one after another: 1, 2, 3, 4. The result is now <b>always 4</b>, and the printed lines are in increasing order (though which <em>thread</em> prints which number can change).' }
    ],
    notes: ['The price of correctness: the critical region is <b>serial</b>. If most of the work is inside it, the program does not speed up.', '<code>critical</code> can protect any block of code; <code>atomic</code> (next example) protects a single update and is cheaper.']
  }));

  /* ---------- atomic (src1/atomic.c) ---------- */
  PDC.add(Object.assign({}, basics, {
    id: 'atomic', title: 'atomic: a cheaper fix', files: [B1 + 'atomic.c'],
    summary: '<code>#pragma omp atomic</code> makes the single statement <code>sum = sum + 1</code> indivisible. The <code>printf</code> after it is not protected.',
    concepts: ['#pragma omp atomic', 'hardware atomic instruction', 'what atomic does NOT protect'],
    kind: 'lanes', scene: { lanes: TL, colw: 100, vars: { sum: 0 } },
    steps: [
      { t: 'Fork', col: 0, ev: all('start', 'sys'), link: forkLinks, code: ['int sum  = 0;', '#pragma omp parallel'], say: 'Again one shared <code>sum</code> and four threads.' },
      { t: 'The updates are atomic and serialised', col: 1, ev: [[1, 'atomic\nsum = 1', 'lock', 1, 1], [0, 'atomic\nsum = 2', 'lock', 1, 2], [3, 'atomic\nsum = 3', 'lock', 1, 3], [2, 'atomic\nsum = 4', 'lock', 1, 4]], set: { sum: { v: 4, cls: 'good' } }, code: ['#pragma omp atomic', 'sum = sum + 1;'],
        say: 'The compiler turns the update into one <b>hardware atomic instruction</b> (such as <code>lock add</code>), so no increment can be lost. The final value is always 4.' },
      { t: 'But the printf is not atomic', col: 2, ev: [[1, 'print "2"', 'bad', 1, 2], [0, 'print "3"', 'bad', 1, 3], [3, 'print "4"', 'bad', 1, 4], [2, 'print "4"', 'bad', 1, 5]], code: 'printf("The current sum value is %d from thread %d\\n", sum, omp_get_thread_num());',
        say: 'Only the <em>one statement</em> after <code>#pragma omp atomic</code> is protected. The <code>printf</code> reads <code>sum</code> a moment later, when other threads may already have incremented it &mdash; so T1 prints 2, not 1, and two threads print 4.' },
      { t: 'The final line is correct', col: 5, ev: [[0, 'final sum = 4', 'good', 1, 5]], code: 'printf("The final sum value is %d', say: 'After the region ends (implicit barrier) the final value, printed by the master thread, is 4.' }
    ],
    notes: ['<code>atomic</code> only covers simple updates like <code>x += expr</code>, <code>x++</code>, <code>x = x op expr</code>.', 'Use <code>critical</code> if you need to protect several statements together, including the print.']
  }));

  /* ---------- for_directive (src1) ---------- */
  const forScene = function (n) { return { threads: 4, order: false, rows: [{ name: 'for (i = 0; i < ' + n + '; i++)', n: n, after: 'implicit barrier' }] }; };
  PDC.add(Object.assign({}, basics, {
    id: 'for_directive', title: 'Work-sharing loop (omp for)', files: [B1 + 'for_directive.c'],
    summary: 'Inside a parallel region, <code>#pragma omp for</code> divides the loop\'s iterations among the threads instead of repeating the whole loop in each one.',
    concepts: ['#pragma omp for', 'work sharing', 'static schedule', 'omp_get_wtime'],
    kind: 'iters', scene: forScene(10),
    steps: [
      { t: 'Ten independent iterations', code: ['for(i = 0; i < count; i++)', 'int i, count=10;'],
        say: 'Without <code>omp for</code> each of the four threads would run <em>all</em> ten iterations (40 lines). With it the iterations are split so that each runs exactly once.' },
      { t: 'The runtime splits them into chunks', a: [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1], [5, 1], [6, 2], [7, 2], [8, 3], [9, 3]], chunk: [[0, 0, 3], [0, 3, 3], [0, 6, 2], [0, 8, 2]], code: '#pragma omp for',
        say: 'The default (<code>static</code>) schedule gives each thread one contiguous block of about <code>10 / 4</code> iterations: sizes 3, 3, 2, 2. (The exact split is implementation-defined.)' },
      { t: 'Threads run their chunks in parallel', a: [], now: [[0, 0], [0, 3], [0, 6], [0, 8]], code: 'printf("Thread id %d printing value %d\\n", omp_get_thread_num(), i);',
        say: 'All four threads print at the same time, so the lines from different threads interleave. Each iteration is printed exactly once.' },
      { t: 'Implicit barrier, then timing', note: 'omp_get_wtime() measures wall-clock time around the whole region.', code: ['start = omp_get_wtime();', 'end = omp_get_wtime();', 'printf("Elapsed time: %f seconds\\n", end - start);'],
        say: 'At the end of the loop all threads wait for the slowest one (<b>implicit barrier</b>). <code>omp_get_wtime()</code> before and after gives the elapsed wall-clock time.' }
    ],
    notes: ['The loop variable <code>i</code> is automatically private to each thread.', 'Iterations must be independent: the result must not depend on their order.'],
    tryit: ['Increase <code>count</code> to 1,000,000, remove the <code>printf</code>, and compare run time for 1 and 4 threads.']
  }));

  /* ---------- for_directive2: nested loop with shared j ---------- */
  PDC.add(Object.assign({}, basics, {
    id: 'for_directive2', title: 'Nested loops: the shared inner index', files: [B1 + 'for_directive2.c'],
    summary: '<code>parallel for</code> makes the <em>outer</em> index private, but the inner index <code>j</code> was declared outside the loop, so it is <b>shared</b> and the threads trample on it.',
    concepts: ['parallel for', 'loop index privacy', 'private(j)', 'data race on loop variable'],
    kind: 'lanes', scene: { lanes: TL, colw: 106, vars: { j: '?' } },
    steps: [
      { t: 'Outer loop split: one i per thread', col: 0, ev: all(function (l) { return 'i = ' + l; }, 'sys'), link: forkLinks, code: ['#pragma omp parallel for //private (j)', 'for(i = 0; i < count1; i++)'],
        say: 'With 4 threads and 4 outer iterations, each thread gets one value of <code>i</code>. OpenMP makes the parallelised loop\'s index <code>i</code> private automatically.' },
      { t: 'Inner loops all start at j = 0', col: 1, ev: all('for j: j = 0', ''), set: { j: 0 }, code: 'for (j = 0; j < count2; ++j)',
        say: 'But <code>j</code> belongs to an <em>inner, sequential</em> loop and was declared before the region, so there is <b>one shared</b> <code>j</code> for all threads.' },
      { t: 'The threads disturb each other\'s j', col: 2, ev: [[0, 'print (0,0)\n++j', 'bad'], [1, 'print (1,0)\n++j', 'bad'], [2, 'j>=2: exit', 'bad'], [3, 'j>=2: exit', 'bad']], set: { j: { v: 2, cls: 'bad' } }, code: 'printf("i: %d, j: %d (pid = %d)\\n", i, j, omp_get_thread_num());',
        say: 'T0 and T1 both increment the same <code>j</code>, so it reaches 2 after one round and <b>all</b> inner loops stop. Pairs such as (0,1) and (1,1) are never printed &mdash; the program silently does less work than the sequential one.' },
      { t: 'Fix: private(j)', reset: true, col: 0, ev: all(function (l) { return 'own j\n0 → 1'; }, 'good', 2), set: { j: { v: 'one per thread', cls: 'good' } }, code: '#pragma omp parallel for //private (j)',
        say: 'Uncommenting <code>private (j)</code> (or declaring <code>j</code> inside the loop: <code>for (int j = ...)</code>) gives each thread its own <code>j</code>. Now every (i, j) pair is printed exactly once.' }
    ],
    notes: ['This is a very common OpenMP bug: nested sequential loops need their own private index in C/C++.', 'Declaring loop variables in the <code>for</code> statement (C99) avoids the problem.'],
    tryit: ['Uncomment <code>private (j)</code> and count the output lines: you should see exactly 8.']
  }));

  /* ---------- section_directive ---------- */
  PDC.add(Object.assign({}, dirs, {
    id: 'section_directive', title: 'sections: different code per thread', files: [B2 + 'section_directive.c'],
    summary: 'Each <code>#pragma omp section</code> block is run by one thread. Two sections means at most two threads work; the rest wait.',
    concepts: ['sections / section', 'task parallelism', 'functional decomposition'],
    kind: 'iters', scene: { threads: 4, order: false, rows: [{ name: 'section blocks:  0 = loop over i,  1 = loop over j', n: 2, after: 'implicit barrier at the end of sections' }] },
    steps: [
      { t: 'Two independent pieces of work', code: '#pragma omp section', say: 'Unlike <code>omp for</code>, which splits <em>one</em> loop, <code>sections</code> lists <b>different</b> blocks of code that may run at the same time.' },
      { t: 'Each section goes to one thread', a: [[0, 1], [1, 3]], code: ['for(i = 0; i < ITERS; i++)', 'for(j = 0; j < ITERS; j++)'], note: 'Which threads receive the sections is up to the runtime. T0 and T2 have nothing to do.',
        say: 'Section 0 runs entirely on one thread, section 1 on another. Each prints its three lines with the thread number (<code>pid=</code>). T0 and T2 get no work.' },
      { t: 'Barrier at the end', note: 'Only 2 of 4 threads were useful: speed-up is limited by the number of sections.', code: '#pragma omp sections', say: 'All threads wait at the end of the <code>sections</code> construct. With 2 sections you cannot use more than 2 threads.' }
    ],
    notes: ['Sections are useful when you have a small, fixed number of unrelated jobs.', 'For a variable amount of independent work, prefer <code>omp for</code> or <code>task</code>.']
  }));

  /* ---------- single / master ---------- */
  PDC.add(Object.assign({}, dirs, {
    id: 'single_directive', title: 'single: run once, anyone', files: [B2 + 'single_directive.c'],
    summary: 'Inside a parallel region the <code>single</code> block is executed by exactly <b>one</b> thread (whichever arrives first), and the others wait at its end.',
    concepts: ['single', 'implicit barrier'],
    kind: 'lanes', scene: { lanes: TL, colw: 100 },
    steps: [
      { t: 'All threads print Hello', col: 0, ev: all('Hello\nworld'), code: ['#pragma omp parallel', 'printf("Hello world\\n");'], say: 'Everyone executes the first line of the region.' },
      { t: 'Only one thread enters single', col: 1, ev: [[2, 'single:\n"prints once"', 'lock'], [0, 'wait', 'wait'], [1, 'wait', 'wait'], [3, 'wait', 'wait']], code: ['#pragma omp single', 'printf("This only prints once (printed by pid %d)\\n", omp_get_thread_num());'],
        say: 'The first thread to arrive (here T2) executes the block. The others skip it but <b>wait</b>, because <code>single</code> ends with an implicit barrier.' },
      { t: 'Barrier, then everyone continues', col: 2, bar: { at: 2, lanes: 'all', label: 'implicit barrier' }, ev: all('Goodbye\nworld'), code: 'printf("Goodbye world\\n");',
        say: 'After the barrier all threads print "Goodbye world". Use <code>single nowait</code> to skip the waiting.' }
    ],
    notes: ['<code>single</code> is handy for I/O or setup that must happen once but whose thread does not matter.']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'master_directive', title: 'master: only thread 0', files: [B2 + 'master_directive.c'],
    summary: 'The <code>master</code> block is run only by thread 0, and <em>there is no barrier</em>: other threads do not wait.',
    concepts: ['master', 'no implied barrier', 'master vs single'],
    kind: 'lanes', scene: { lanes: TL, colw: 100 },
    steps: [
      { t: 'All threads print Hello', col: 0, ev: all('Hello\nworld'), code: ['#pragma omp parallel', 'printf("Hello world\\n");'], say: 'Everyone executes the first line.' },
      { t: 'Only thread 0 runs the master block', col: 1, ev: [[0, 'master:\n"I am the master"', 'lock'], [1, 'Goodbye\nworld', '', 1, 1], [2, 'Goodbye\nworld', '', 1, 1], [3, 'Goodbye\nworld', '', 1, 1]], code: ['#pragma omp master', 'printf("I am the master! (printed by pid %d)\\n", omp_get_thread_num());'],
        say: 'Unlike <code>single</code>, <code>master</code> always picks <b>thread 0</b>, and the other threads <b>do not wait</b> &mdash; they race ahead and print "Goodbye world" immediately.' },
      { t: 'Master catches up', col: 2, ev: [[0, 'Goodbye\nworld']], code: 'printf("Goodbye world\\n");', say: 'The master finishes last here. Because there is no barrier, "Goodbye" lines can appear before the master line. (Newer OpenMP versions rename this construct <code>masked</code>.)' }
    ],
    notes: ['If you need the others to wait, add <code>#pragma omp barrier</code> after the master block.']
  }));

  /* ---------- critical_directive / atomic_directive (two scenarios each) ---------- */
  function raceSteps(o) {
    return [
      { t: 'Without protection: all read 0', col: 0, ev: all(o.read, ''), set: o.zero, code: o.unprot, say: 'Each increment is load&nbsp;&rarr;&nbsp;add&nbsp;&rarr;&nbsp;store. All threads load the old value 0 before anyone stores.' },
      { t: 'Everyone stores 1', col: 1, ev: all(o.store, 'bad'), set: o.bad, code: o.unprot, say: 'Every thread writes 1, so ' + o.what + ' ends at <b>1</b> instead of the number of threads. The final value is unstable from run to run.' },
      { t: 'With ' + o.name + ': one at a time', reset: true, col: 0, ev: [[2, o.name + ': ' + o.upd + '1', 'lock'], [0, 'wait', 'wait'], [1, 'wait', 'wait'], [3, 'wait', 'wait']], set: o.s1, code: o.prot,
        say: o.protSay },
      { t: 'Updates are serialised', col: 1, ev: [[0, o.upd + '2', 'lock'], [1, o.upd + '3', 'lock', 1, 2], [3, o.upd + '4', 'lock', 1, 3]], set: o.good, code: o.prot,
        say: 'Each thread runs its update after the previous one has finished. ' + o.what + ' always ends at the number of threads (4).' }
    ];
  }
  PDC.add(Object.assign({}, dirs, {
    id: 'critical_directive', title: 'critical vs no protection', files: [B2 + 'critical_directive.c'],
    summary: 'Two threads-wide experiments in one file: increment <code>i</code> and <code>j</code> with no protection (unstable), then inside <code>#pragma omp critical</code> (always the thread count).',
    concepts: ['critical', 'lost updates', 'multiple statements in one critical section'],
    kind: 'lanes', scene: { lanes: TL, colw: 100, vars: { i: 0, j: 0 } },
    steps: raceSteps({ read: 'load i, j\n(=0, 0)', store: 'store i=1\nstore j=1', what: '<code>i</code> and <code>j</code>', name: 'critical', upd: 'i,j = ', zero: { i: 0, j: 0 }, bad: { i: { v: 1, cls: 'bad' }, j: { v: 1, cls: 'bad' } },
      s1: { i: 1, j: 1 }, good: { i: { v: 4, cls: 'good' }, j: { v: 4, cls: 'good' } }, unprot: 'i = i + 1;>>j = j + 1;', prot: '#pragma omp critical>>j = j + 1;',
      protSay: 'The <code>critical</code> block covers <em>both</em> statements, so <code>i</code> and <code>j</code> are updated together by one thread at a time. The others wait at the entrance.' }),
    notes: ['The comment in the source calls both versions "critical section"; the first one has none, which is why its output is unstable.']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'atomic_directive', title: 'atomic vs no protection', files: [B2 + 'atomic_directive.c'],
    summary: 'Incrementing <code>i</code> with no protection loses updates; with <code>#pragma omp atomic</code> the update is one indivisible instruction.',
    concepts: ['atomic', 'lost updates'],
    kind: 'lanes', scene: { lanes: TL, colw: 100, vars: { i: 0 } },
    steps: raceSteps({ read: 'load i\n(=0)', store: 'store\ni = 1', what: '<code>i</code>', name: 'atomic', upd: 'i = ', zero: { i: 0 }, bad: { i: { v: 1, cls: 'bad' } },
      s1: { i: 1 }, good: { i: { v: 4, cls: 'good' } }, unprot: 'i = i + 1;', prot: '#pragma omp atomic>>i = i + 1;',
      protSay: '<code>#pragma omp atomic</code> turns the single statement into one atomic read-modify-write. Other threads\' updates are queued by the hardware.' }),
    notes: ['The program prints "(with critical section)" in its second experiment, but the code actually uses <code>atomic</code>.']
  }));

  /* ---------- data-sharing clauses (diagram) ---------- */
  function copiesScene(origVal, extra) {
    const nodes = { orig: { x: 260, y: 14, w: 240, h: 84, label: 'original i (main thread)', cells: [origVal], cls: 'mem', cw: 60 } };
    for (let t = 0; t < 4; t++) nodes['T' + t] = { x: 10 + t * 185, y: 190, w: 165, h: 100, label: 'thread ' + t, sub: 'its own i', c: t, cells: [{ v: '—', c: 'empty' }], cw: 60, hidden: true };
    return { w: 760, h: 310, nodes: Object.assign(nodes, extra || {}) };
  }
  const showAll = ['T0', 'T1', 'T2', 'T3'];
  const cellsFor = function (fn) { const o = {}; for (let t = 0; t < 4; t++) o['T' + t] = { cells: [fn(t)] }; return o; };

  PDC.add(Object.assign({}, dirs, {
    id: 'private_clause', title: 'private(i)', files: [B2 + 'private_clause.c'],
    summary: 'A <code>private</code> variable gets a fresh, <b>uninitialised</b> copy in every thread. The original is neither read nor changed.',
    concepts: ['private', 'uninitialised copy', 'original unchanged'],
    kind: 'diagram', scene: copiesScene(11),
    steps: [
      { t: 'Before the region: i = 11', pulse: ['orig'], code: ['int i = 11;', 'printf("Before parallel execution, i is %d\\n", i);'], say: 'The original <code>i</code> is 11.' },
      { t: 'Each thread gets its own copy', show: showAll, set: cellsFor(function () { return { v: '?', c: 'hot' }; }), code: '#pragma omp parallel private(i)',
        say: '<code>private(i)</code> creates one new <code>i</code> per thread. It is <b>not initialised</b> from the original: the first <code>printf</code> shows garbage (the value 11 does <em>not</em> carry over).' },
      { t: 'Threads assign their own id', set: cellsFor(function (t) { return { v: t, c: 'c' + t }; }), code: 'i=omp_get_thread_num();',
        say: 'Each thread stores its own number in its own copy. There is no interference.' },
      { t: 'After the region: the original is untouched', hide: showAll, set: { orig: { cells: [{ v: 11, c: 'ok' }] } }, pulse: ['orig'], code: 'printf("After parallel execution, i is %d (pid=%d)\\n", i, omp_get_thread_num());',
        say: 'The private copies disappear at the end of the region. The original <code>i</code> is <b>still 11</b>.' }
    ],
    notes: ['Use <code>firstprivate</code> if the copies must start with the original value, and <code>lastprivate</code> if the last value must be copied out.']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'firstprivate_clause', title: 'firstprivate(i)', files: [B2 + 'firstprivate_clause.c'],
    summary: '<code>firstprivate</code> is <code>private</code> plus initialisation: each thread\'s copy starts with the value the variable had before the region.',
    concepts: ['firstprivate', 'copy-in'],
    kind: 'diagram', scene: copiesScene(11),
    steps: [
      { t: 'Original i = 11', pulse: ['orig'], code: ['int i = 11;', 'printf("Before parallel execution, i is %d (pid = %d)\\n"'], say: 'The original is 11.' },
      { t: 'Copies are initialised from the original', show: showAll, set: cellsFor(function (t) { return { v: 11, c: 'c' + t }; }), flow: showAll.map(function (id, k) { return { from: 'orig', to: id, label: '11', delay: k * 0.1 }; }), code: '#pragma omp parallel firstprivate(i)',
        say: 'Every thread\'s copy of <code>i</code> starts at <b>11</b> (compare with <code>private</code>, where it would be garbage).' },
      { t: 'Each thread increments its copy', set: cellsFor(function (t) { return { v: 12, c: 'c' + t }; }), code: ['i++;', 'printf("Within a pid=%d: new value is %d\\n", omp_get_thread_num(), i);'],
        say: 'All threads print "initial value is 11" and then "new value is 12" &mdash; they modify only their own copy.' },
      { t: 'The original is still 11', hide: showAll, set: { orig: { cells: [{ v: 11, c: 'ok' }] } }, code: 'printf("After parallel execution, i is %d (pid = %d)\\n", i, omp_get_thread_num());',
        say: 'Copies are thrown away at the end of the region. Nothing is copied back (that is what <code>lastprivate</code> or a reduction is for).' }
    ],
    notes: ['<code>firstprivate</code> is how you pass an initial value into each thread (for example a loop bound or a task\'s captured data).']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'shared_clause', title: 'shared(i)', files: [B2 + 'shared_clause.c'],
    summary: 'A <code>shared</code> variable is one memory location seen by all threads. Concurrent writes must be coordinated &mdash; here with <code>critical</code>.',
    concepts: ['shared', 'critical', 'default data sharing'],
    kind: 'diagram', scene: (function () {
      const s = copiesScene(0); s.nodes.orig.sub = 'shared: one location'; s.nodes.orig.x = 260;
      for (let t = 0; t < 4; t++) { s.nodes['T' + t].sub = 'sees the same i'; s.nodes['T' + t].cells = null; s.nodes['T' + t].h = 64; s.nodes['T' + t].y = 220; }
      s.edges = showAll.map(function (id) { return ['orig', id, { dash: true }]; });
      return s;
    })(),
    steps: [
      { t: 'One i for everybody', show: showAll, pulse: ['orig'], code: ['#pragma omp parallel shared(i)', 'int i = 0;'], say: '<code>shared(i)</code> (the default for variables declared before the region) means all threads access the <b>same</b> <code>i</code>.' },
      { t: 'Threads update it one at a time', flow: showAll.map(function (id, k) { return { from: id, to: 'orig', label: '+1', delay: k * 0.45, cls: 'ok' }; }), set: { orig: { cells: [{ v: 4, c: 'ok' }] } }, code: ['#pragma omp critical', 'i++;'],
        say: 'Because <code>i</code> is shared and written, access has to be protected. The <code>critical</code> block lets one thread at a time do <code>i++</code> and print.' },
      { t: 'After the region: i = number of threads', hide: showAll, pulse: ['orig'], code: 'printf("After parallel execution, i is %d\\n", i);', say: 'The changes are visible after the region because there was only ever one <code>i</code>. Result: 4 with 4 threads.' }
    ],
    notes: ['Compare: <code>private</code> = separate, uninitialised; <code>firstprivate</code> = separate, initialised; <code>shared</code> = one copy for all.']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'lastprivate_clause', title: 'lastprivate(j)', files: [B2 + 'lastprivate_clause.c'],
    summary: 'With <code>lastprivate</code> each thread has a private copy, and after the loop the value from the <em>sequentially last</em> iteration is copied back to the original.',
    concepts: ['lastprivate', 'copy-out', 'parallel for'],
    kind: 'diagram', scene: (function () {
      const s = copiesScene(0);
      s.nodes.orig.label = 'original j'; s.nodes.orig.cells = [0];
      for (let t = 0; t < 4; t++) { s.nodes['T' + t].label = 'thread ' + t + '  (i = ' + t + ')'; s.nodes['T' + t].sub = 'private j'; }
      return s;
    })(),
    steps: [
      { t: 'Original j = 0', pulse: ['orig'], code: ['int i = 0, j = 0;', 'printf("Before parallel execution, i=%d and j=%d (pid = %d)\\n"'], say: 'Both <code>i</code> and <code>j</code> start at 0.' },
      { t: 'Each thread gets private i and private j', show: showAll, set: cellsFor(function () { return { v: '?', c: 'hot' }; }), code: '#pragma omp parallel for private(i) lastprivate(j)',
        say: 'Loop iterations 0&hellip;3 are spread over the threads. <code>private(i)</code> is the loop index; <code>lastprivate(j)</code> is a private copy of <code>j</code> that will be copied out.' },
      { t: 'Each iteration sets j = i', set: cellsFor(function (t) { return { v: t, c: 'c' + t }; }), code: 'j = i;', say: 'Thread <i>k</i> runs iteration <i>k</i> and stores <i>k</i> in its own <code>j</code>.' },
      { t: 'The last iteration\'s j is copied out', flow: [{ from: 'T3', to: 'orig', label: '3', cls: 'ok' }], set: { orig: { cells: [{ v: 3, c: 'ok' }] } }, hide: ['T0', 'T1', 'T2'], code: 'printf("After parallel execution, i=%d and j=%d (pid = %d)\\n", i, j, omp_get_thread_num());',
        say: 'After the loop the original <code>j</code> receives the value from the <b>last iteration in sequential order</b> (i = 3), regardless of which thread finished last. The original <code>i</code> stays 0 because it is only <code>private</code>.' }
    ],
    notes: ['This is the way to "get a result out of the last iteration", for example the final index or the last computed value.']
  }));

  /* ---------- reductions (iters with partials) ---------- */
  PDC.add(Object.assign({}, dirs, {
    id: 'reduction_clause', title: 'reduction(+: result): dot product', files: [B2 + 'reduction_clause.c'],
    summary: 'Dot product of two 8-element vectors. Each thread sums into a private partial result; OpenMP adds the partials at the end.',
    concepts: ['reduction', 'partial sums', 'associative combine'],
    kind: 'iters', scene: { threads: 4, order: false, partials: true, rows: [{ name: 'i :   a[i]*b[i] = 0 5 12 21 0 5 12 21', n: 8 }] },
    steps: [
      { t: 'Eight products to add up', code: ['int a[8] = {0,1,2,3, 0,1,2,3};', 'int b[8] = {4,5,6,7, 4,5,6,7};'], say: 'Adding to one shared <code>result</code> from all threads would be a race. <code>reduction(+: result)</code> avoids it.' },
      { t: 'Each thread gets a private result = 0', part: { 0: 0, 1: 0, 2: 0, 3: 0 }, code: '#pragma omp parallel for reduction(+: result)', say: 'For each thread OpenMP creates a private copy of <code>result</code>, initialised to the identity of <code>+</code> (0).' },
      { t: 'Threads accumulate on their iterations', a: [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3]], part: { 0: 5, 1: 33, 2: 5, 3: 33 }, code: 'result += a[i]*b[i];',
        say: 'Static schedule: T0 gets i = 0,1 (0 + 5 = 5), T1 gets 2,3 (12 + 21 = 33), T2 gets 4,5 (5), T3 gets 6,7 (33). No locking is needed because every thread updates only <em>its own</em> copy.' },
      { t: 'Partials are combined at the end', final: 76, code: 'printf("Final result is %d\\n", result);', say: 'At the end of the loop the private copies are combined with <code>+</code>: 5 + 33 + 5 + 33 = <b>76</b>. (The comment in the source, 38, is for one half of the data.)' }
    ],
    notes: ['The operator must be associative (and commutative for floating-point results to be reproducible): <code>+ * min max &amp; | ^ &amp;&amp; ||</code>.', 'Floating-point sums may differ in the last digits from the sequential result, because the order of additions changes.']
  }));
  PDC.add(Object.assign({}, dirs, {
    id: 'reduction_clause2', title: 'reduction with N = 128', files: [B2 + 'reduction_clause2.c'],
    summary: 'The same dot product on 128 elements (a[i] = 1, b[i] = 2): four partial sums of 64 combine to 256.',
    concepts: ['reduction', 'scaling the loop'],
    kind: 'iters', scene: { threads: 4, order: false, partials: true, rows: [{ name: 'iteration blocks (each box = 8 of the 128 iterations, a[i]*b[i] = 2)', n: 16 }] },
    steps: [
      { t: 'Many identical products', code: ['#define N 128', 'a[i]=1;>>b[i]=2;'], say: 'Every product is 1&times;2 = 2, so the exact answer is 128 &times; 2 = 256.' },
      { t: 'Private partials', a: Array.from({ length: 16 }, function (_, k) { return [k, Math.floor(k / 4)]; }), part: { 0: 64, 1: 64, 2: 64, 3: 64 }, code: ['#pragma omp parallel for reduction(+: result)', 'result += a[i]*b[i];'],
        say: 'Each thread handles 32 iterations: <code>32 &times; 2 = 64</code>.' },
      { t: 'Combine', final: 256, code: 'printf("Final result is %d\\n", result);', say: '64 + 64 + 64 + 64 = <b>256</b>, every time &mdash; unlike the unprotected sum in <code>rc.c</code>.' }
    ]
  }));

  /* ---------- schedule ---------- */
  PDC.add(Object.assign({}, dirs, {
    id: 'schedule_static', title: 'schedule(static, 4) and friends', files: [B2 + 'schedule_static.c'],
    summary: 'The <code>schedule</code> clause decides how iterations are handed to threads: fixed chunks (<code>static</code>), first-come-first-served (<code>dynamic</code>), or shrinking chunks (<code>guided</code>).',
    concepts: ['schedule(static)', 'schedule(dynamic)', 'schedule(guided)', 'chunk size', 'load balancing'],
    kind: 'iters', scene: { threads: 4, rows: [{ name: 'for (i = 0; i < 16; i++)', n: 16 }] },
    steps: [
      { t: 'Sixteen iterations, chunks of four', code: ['#define N 16', '#pragma omp for schedule(static, 4)'], noorder: true, say: 'The code uses <code>schedule(static, 4)</code>: iterations are cut into chunks of 4.' },
      { t: 'static: chunks are dealt out round-robin', noorder: true, chunk: [[0, 0, 4], [0, 4, 4], [0, 8, 4], [0, 12, 4]], a: Array.from({ length: 16 }, function (_, k) { return [k, Math.floor(k / 4)]; }), code: 'printf("Thread %d executes iteration %d\\n", omp_get_thread_num(), i);',
        say: 'With 4 threads, thread <i>t</i> gets chunk <i>t</i> (and, if there were more chunks, chunk <i>t + 4</i>, &hellip;). The assignment is decided <b>before</b> running: no scheduling cost at run time, but no balancing either.' },
      { t: 'dynamic, 2: grab the next chunk when free', reset: true, noorder: false, chunk: [[0, 0, 2], [0, 2, 2], [0, 4, 2], [0, 6, 2], [0, 8, 2], [0, 10, 2], [0, 12, 2], [0, 14, 2]],
        a: [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3], [8, 1], [9, 1], [10, 0], [11, 0], [12, 3], [13, 3], [14, 2], [15, 2]], code: 'schedule(dynamic, 2)', note: 'Numbers #1&hellip;#16 show the order in which the iterations were taken (illustrative run).',
        say: 'Idle threads take the next chunk of 2 from a shared queue. Fast threads do more iterations. Good when iterations take uneven time; costs a little synchronisation per chunk.' },
      { t: 'guided, 2: big chunks first, small later', reset: true, chunk: [[0, 0, 4], [0, 4, 3], [0, 7, 3], [0, 10, 2], [0, 12, 2], [0, 14, 2]],
        a: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [5, 1], [6, 1], [7, 2], [8, 2], [9, 2], [10, 3], [11, 3], [12, 1], [13, 1], [14, 0], [15, 0]], code: 'schedule(guided, 2)', note: 'Chunk sizes shrink (4, 3, 3, 2, 2, 2): a minimum of 2 is kept.',
        say: 'Like dynamic, but the chunk size starts large and shrinks as work runs out, which balances load with fewer queue accesses. The last chunks are small so nobody is left waiting.' },
      { t: 'runtime and auto', reset: true, noorder: true, code: ['RUNTIME', 'AUTO'], say: '<code>schedule(runtime)</code> reads the policy from the environment variable <code>OMP_SCHEDULE</code> (e.g. <code>export OMP_SCHEDULE="dynamic,2"</code>) so you can experiment without recompiling. <code>schedule(auto)</code> lets the compiler or runtime decide.' }
    ],
    notes: ['The program contains the other schedules only as comments; try each in turn.'],
    tryit: ['Add <code>usleep(i * 1000)</code> inside the loop (uneven work) and compare <code>static</code> and <code>dynamic</code> timings.']
  }));

  /* ---------- nowait ---------- */
  PDC.add(Object.assign({}, dirs, {
    id: 'nowait_clause', title: 'nowait: skip the barrier', files: [B2 + 'nowait_clause.c'],
    summary: 'Every work-sharing loop ends with an implicit barrier. <code>nowait</code> removes it, so a thread that finishes its share of loop 1 can start loop 2 right away.',
    concepts: ['nowait', 'implicit barrier', 'independent loops'],
    kind: 'iters', scene: { threads: 4, rows: [{ name: 'loop 1:  for (i = 0; i < 8; i++)', n: 8, after: 'implicit barrier' }, { name: 'loop 2:  for (j = 0; j < 8; j++)', n: 8 }] },
    steps: [
      { t: 'Two loops in one parallel region', code: ['#pragma omp parallel', '#pragma omp for#2'], say: 'Both loops are inside one <code>parallel</code> region, each with its own <code>omp for</code>.' },
      { t: 'Loop 1: threads split i', a: [[0, 0, 0], [0, 1, 0], [0, 2, 1], [0, 3, 1], [0, 4, 2], [0, 5, 2], [0, 6, 3], [0, 7, 3]], code: ['#pragma omp for', 'printf("i is %d\\n", i);'], say: 'Each thread gets two iterations of loop 1.' },
      { t: 'Barrier: wait for the slowest thread', a: [[1, 0, 0], [1, 1, 0], [1, 2, 1], [1, 3, 1], [1, 4, 2], [1, 5, 2], [1, 6, 3], [1, 7, 3]], note: 'Without <code>nowait</code>: <b>every i line is printed before any j line</b>.', code: 'printf("Without nowait, loop i is always executed before loop j\\n");',
        say: 'Without <code>nowait</code>, all threads wait at the end of loop 1. Only then does loop 2 start, so all "i is ..." lines come before all "j is ..." lines.' },
      { t: 'With nowait: no waiting', reset: true, after: { 0: 'nowait' }, a: [[0, 0, 0], [0, 1, 0], [0, 2, 1], [0, 3, 1], [0, 4, 2], [0, 5, 2], [0, 6, 3], [0, 7, 3], [1, 0, 0], [1, 1, 0], [1, 2, 1]], code: '#pragma omp for nowait',
        note: 'T0 finished its i-iterations first and already started j while T3 is still on i.', say: 'With <code>nowait</code> a thread moves on as soon as <em>its</em> iterations of loop 1 are done. Some "j is ..." lines can appear <b>before</b> the last "i is ..." line.' },
      { t: 'When is nowait safe?', code: 'printf("With nowait, some iterations of loop i are executed after loop j\\n");', say: 'Only if loop 2 does not read anything that loop 1 writes. Here the loops are independent, so removing the barrier is safe and saves waiting time.' }
    ],
    notes: ['<code>nowait</code> trades a guarantee (loop 1 is finished) for speed; use it only when you can prove independence.']
  }));

  /* ---------- omp_get_thread_num ---------- */
  PDC.add(Object.assign({}, dirs, {
    id: 'ompgetthreadnum_function', title: 'omp_get_thread_num()', files: [B2 + 'ompgetthreadnum_function.c'],
    summary: 'The thread id returned by <code>omp_get_thread_num()</code> is used to report which thread handles which of the 16 iterations.',
    concepts: ['omp_get_thread_num', 'private(id)', 'omp for'],
    kind: 'iters', scene: { threads: 4, order: false, rows: [{ name: 'i = 0 … 15', n: 16 }] },
    steps: [
      { t: 'Each thread learns its id', code: ['#pragma omp parallel private(id)', 'id = omp_get_thread_num();'], say: 'Every thread stores <code>omp_get_thread_num()</code> (0&hellip;3) in its private <code>id</code>.' },
      { t: 'The for loop divides the 16 iterations', a: Array.from({ length: 16 }, function (_, k) { return [k, Math.floor(k / 4)]; }), chunk: [[0, 0, 4], [0, 4, 4], [0, 8, 4], [0, 12, 4]], code: ['#pragma omp for', 'printf("thread %d handles iteration i = %d\\n", id, i);'],
        say: 'With the default static schedule each thread handles 4 consecutive iterations: thread 0 gets 0&ndash;3, thread 1 gets 4&ndash;7, and so on. The lines print in any order, but each iteration is reported by exactly one thread.' }
    ]
  }));

  /* ---------- task ---------- */
  PDC.add(Object.assign({}, dirs, {
    id: 'task_directive', title: 'task: dynamic work units', files: [B2 + 'task_directive.c'],
    summary: 'One thread (inside <code>single</code>) creates 16 tasks; any thread in the team can pick them up and run them.',
    concepts: ['task', 'single producer', 'task queue', 'shared vs firstprivate in tasks'],
    kind: 'iters', scene: { threads: 4, rows: [{ name: 'Task 1 queue  (loop over i, 8 tasks)', n: 8 }, { name: 'Task 2 queue  (loop over j, 8 tasks)', n: 8 }] },
    steps: [
      { t: 'One thread creates the tasks', note: 'T0 is inside <code>single</code> and creates all 16 task objects; they go into a queue.', code: ['#pragma omp single', 'for (i = 0; i < ITERS; i++) {'],
        say: 'Only one thread executes the <code>single</code> block and creates the tasks. Each <code>#pragma omp task</code> packages one <code>printf</code> as a unit of work and places it in a <b>queue</b>.' },
      { t: 'Idle threads execute tasks', a: [[0, 0, 1], [0, 1, 2], [0, 2, 3], [0, 3, 1], [0, 4, 0], [0, 5, 2], [0, 6, 3], [0, 7, 1], [1, 0, 2], [1, 1, 3], [1, 2, 0], [1, 3, 1], [1, 4, 2], [1, 5, 3], [1, 6, 1], [1, 7, 0]],
        code: ['printf("Task 1: i = %d (pid=%d)\\n", i, omp_get_thread_num());', 'printf("Task 2: j = %d (pid=%d)\\n", j, omp_get_thread_num());'], note: 'Any thread may run any task, including the creating thread once it is done creating (illustrative run, numbers = order).',
        say: 'Threads that have nothing else to do take tasks from the queue. The task-to-thread mapping is <b>dynamic</b> &mdash; compare with <code>for</code>, where it is fixed up front. Good for irregular or recursive work.' },
      { t: 'Watch out: shared loop variables', code: ['int i, j;', '// #pragma omp task'], note: 'i and j are shared: a task that starts late may print an index that has already moved on.',
        say: '<code>i</code> and <code>j</code> are declared outside the parallel region, so they are <b>shared</b> and are not copied into the tasks. A task that runs after the loop has advanced can print a wrong index. Capturing the value with <code>firstprivate(i)</code> on the task avoids this.' },
      { t: 'All tasks finish at the barrier', code: '} // implicit taskwait here at the end of single', say: 'The implicit barrier at the end of the parallel region guarantees that all tasks have been executed before the program continues.' }
    ],
    notes: ['Tasks are the right tool for linked lists, tree walks and recursion, where the amount of work is not known up front.'],
    tryit: ['Add <code>firstprivate(i)</code> to the first task directive and check that the printed indices are always 0&hellip;7.']
  }));
})();
