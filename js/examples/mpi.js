/* MPI examples (pdc/mpi/src). Ranks are boxes holding their data; messages are tokens flying between them. */
(function () {
  'use strict';
  const D = 'pdc/mpi/src/';
  const base = { course: 'pdc', topic: 'mpi' };

  /* n rank boxes in a row; extra nodes can be merged in. */
  function ranks(n, o) {
    o = o || {};
    const w = Math.min(150, Math.floor(700 / n) - 12), gap = n > 1 ? (720 - n * w) / (n - 1) : 0, y = o.y != null ? o.y : 60;
    const nodes = {};
    for (let i = 0; i < n; i++) {
      nodes['r' + i] = { x: 20 + i * (w + gap), y: y, w: w, h: o.h || 100, label: 'rank ' + i, sub: o.sub ? o.sub(i) : '', c: i, cells: o.cells ? o.cells(i) : [], cw: o.cw || 34, hidden: !!o.hidden };
    }
    nodes.out = { x: 20, y: o.outY || 190, w: 720, h: o.outH || 90, label: 'stdout', sub: '', cls: 'mem', hidden: true };
    if (o.nodes) Object.assign(nodes, o.nodes);
    return { w: 760, h: o.H || 296, nodes: nodes, groups: o.groups || [], edges: o.edges || [] };
  }
  const R = function (n) { return Array.from({ length: n }, function (_, i) { return 'r' + i; }); };
  const cells = function (arr) { const o = {}; arr.forEach(function (c, i) { if (c !== undefined) o['r' + i] = { cells: c }; }); return o; };
  const co = function (v, c) { return { v: v, c: c }; };
  const printed = function (lines) { return { out: { sub: lines.join('\n') } }; };
  const merge = function () { return Object.assign.apply(null, [{}].concat(Array.prototype.slice.call(arguments))); };

  /* ---------- 1-hello and 15-management ---------- */
  function helloSteps(code) {
    return [
      { t: 'mpirun starts N processes', show: R(4), code: code.run || 'int main (int argc, char *argv[])',
        say: '<code>mpirun -np 4 ./1-hello</code> starts <b>four separate processes</b>, each running the same <code>main</code>. They have <em>separate memory</em>: nothing is shared unless it is sent as a message.' },
      { t: 'MPI_Init, Comm_size, Comm_rank', set: cells([[co('id ?', 'hot')], [co('id ?', 'hot')], [co('id ?', 'hot')], [co('id ?', 'hot')]]), code: 'MPI_Init(&argc, &argv);', pulse: R(4),
        say: '<code>MPI_Init</code> connects the processes. They then learn <b>how many</b> there are (<code>MPI_Comm_size</code> = 4) and <b>who they are</b> (<code>MPI_Comm_rank</code> = 0&hellip;3) inside the default communicator <code>MPI_COMM_WORLD</code>.' },
      { t: 'Every rank knows its rank and the size', set: cells([[co('rank 0', 'c0'), co('of 4', 'c0')], [co('rank 1', 'c1'), co('of 4', 'c1')], [co('rank 2', 'c2'), co('of 4', 'c2')], [co('rank 3', 'c3'), co('of 4', 'c3')]]), code: ['MPI_Comm_size(MPI_COMM_WORLD, &proc_cnt);', 'MPI_Comm_rank(MPI_COMM_WORLD, &proc_id);'],
        say: 'The same variables (<code>proc_cnt</code>, <code>proc_id</code>) now hold <b>different values in each process</b>. Programs use the rank to decide what each process does.' },
      { t: 'Every rank prints its greeting', show: ['out'], set: printed(['Hello from process 2 on node01!', 'Hello from process 0 on node01!', 'Hello from process 3 on node02!', 'Hello from process 1 on node01!']), code: ['MPI_Get_processor_name(host_name, &len);', 'printf ("Hello from process %d on %s!\\n", proc_id, host_name);'],
        say: 'Each process prints a line with its rank and the <b>host name</b> of the machine it runs on. The lines arrive in no particular order. Across nodes, the host names differ.' },
      { t: 'Only rank 0 prints the master line', set: printed(['Hello from process 2 on node01!', 'Hello from process 0 on node01!', 'Hello from process 3 on node02!', 'Hello from process 1 on node01!', 'MASTER: Number of MPI tasks is: 4']), pulse: ['r0'], code: ['if(proc_id == 0)', 'printf("MASTER: Number of MPI tasks is: %d\\n", proc_cnt);'],
        say: 'A rank-0 test lets a single process report once. This "rank 0 as master" idiom is used throughout MPI programs.' },
      { t: 'MPI_Finalize', hide: ['out'], code: 'MPI_Finalize();', say: 'Every process calls <code>MPI_Finalize</code> to shut MPI down cleanly before exiting.' }
    ];
  }
  const helloScene = function () { return ranks(4, {}); };
  PDC.add(Object.assign({}, base, {
    id: '1-hello', title: 'Hello: ranks and communicator size', files: [D + '1-hello.c'],
    summary: 'The first MPI program: every process learns its <b>rank</b>, the <b>size</b> of the world and the <b>host</b> it runs on.',
    concepts: ['MPI_Init / Finalize', 'MPI_COMM_WORLD', 'rank & size', 'SPMD'],
    kind: 'diagram', scene: helloScene(), steps: helloSteps({}),
    notes: ['MPI is <b>SPMD</b>: Single Program, Multiple Data &mdash; one executable, many processes, behaviour chosen by rank.'],
    tryit: ['Run with <code>-np 8</code>; with a hostfile spanning two machines, look at the host names.']
  }));
  PDC.add(Object.assign({}, base, {
    id: '15-management', title: 'Environment management', files: [D + '15-management.c'],
    summary: 'Same environment queries as <code>1-hello.c</code> (rank, size, processor name) &mdash; the "management" routines of MPI.',
    concepts: ['MPI_Comm_size', 'MPI_Comm_rank', 'MPI_Get_processor_name'],
    kind: 'diagram', scene: helloScene(), steps: helloSteps({}),
    notes: ['The file is identical in behaviour to <code>1-hello.c</code>; it exists as the starting point for the "environment management" topic.']
  }));

  /* ---------- 2-hello2: timing + barrier ---------- */
  PDC.add(Object.assign({}, base, {
    id: '2-hello2', title: 'Timing with MPI_Wtime and a barrier', files: [D + '2-hello2.c'],
    summary: 'Each rank starts a timer, prints, and waits at <code>MPI_Barrier</code>. Rank 0 then reports the elapsed time, which includes the wait for the slowest rank.',
    concepts: ['MPI_Wtime', 'MPI_Barrier', 'measuring parallel time'],
    kind: 'diagram', scene: ranks(4, { nodes: { bar: { x: 300, y: 172, w: 160, h: 36, shape: 'pill', label: 'MPI_Barrier', cls: 'hot', hidden: true } }, outY: 224, outH: 80, H: 316 }),
    steps: [
      { t: 'Every rank starts a timer', show: R(4), set: cells([[co('t0', 'c0')], [co('t0', 'c1')], [co('t0', 'c2')], [co('t0', 'c3')]]), code: 'time = MPI_Wtime();', say: '<code>MPI_Wtime()</code> returns wall-clock seconds as a <code>double</code>. Each rank records its own start time.' },
      { t: 'Hello from each process', show: ['out'], set: printed(['Hello World from process 1', 'Hello World from process 0', 'Hello World from process 3', 'Hello World from process 2']), code: 'printf("Hello World from process %d\\n", rank);', say: 'The ranks print in any order.' },
      { t: 'Barrier: wait for everyone', show: ['bar'], flow: R(4).map(function (id, k) { return { from: id, to: 'bar', delay: k * 0.15 }; }), code: 'MPI_Barrier(MPI_COMM_WORLD);', say: '<code>MPI_Barrier</code> blocks each rank until <b>all</b> ranks of the communicator have reached it. The fast ranks idle until the slowest one arrives.' },
      { t: 'Elapsed time includes the waiting', hide: ['bar'], set: merge(cells([[co('Δt', 'ok')], [co('Δt', 'c1')], [co('Δt', 'c2')], [co('Δt', 'c3')]]), { out: { sub: 'Hello World from process 1\nHello World from process 0\nHello World from process 3\nHello World from process 2\nFrom process 0 execution time: 0.000123' } }), code: ['time = MPI_Wtime() - time;', 'printf("From process %d execution time: %lf\\n", rank, time);'],
        say: 'Rank 0 subtracts its start time and prints the result. Because of the barrier, it is the time of the <b>slowest</b> rank, which is what the user actually waits for.' }
    ],
    notes: ['Always put a barrier before taking the end time when you measure a parallel section, otherwise rank 0 may stop its clock early.']
  }));

  /* ---------- 3-block_comm ---------- */
  const pairCells = function (f) { return cells([0, 1, 2, 3].map(f)); };
  PDC.add(Object.assign({}, base, {
    id: '3-block_comm', title: 'Blocking send and receive', files: [D + '3-block_comm.c'],
    summary: 'Even rank <i>p</i> is paired with rank <i>p+1</i>. The even rank sends first and receives second; the odd rank receives first and sends second.',
    concepts: ['MPI_Send', 'MPI_Recv', 'blocking communication', 'deadlock avoidance', 'partner'],
    kind: 'diagram', scene: ranks(4, { sub: function (i) { return 'partner = ' + (i % 2 ? i - 1 : i + 1); }, cells: function () { return [co('msg ?', 'empty')]; }, cw: 64, nodes: {}, edges: [['r0', 'r1', { dash: true }], ['r2', 'r3', { dash: true }]] }),
    steps: [
      { t: 'Pair up the ranks', show: R(4), pulse: R(4), code: ['partner = proc_id + 1;', 'partner = proc_id - 1;'], say: 'Even ranks pick <code>proc_id + 1</code> as partner, odd ranks <code>proc_id - 1</code>: (0,1) and (2,3). The program requires an even number of processes.' },
      { t: 'Even ranks send first', flow: [{ from: 'r0', to: 'r1', label: '0' }, { from: 'r2', to: 'r3', label: '2' }], code: 'MPI_Send(&proc_id, 1, MPI_INT, partner, 1, MPI_COMM_WORLD);#1',
        say: 'Ranks 0 and 2 call <code>MPI_Send</code> with their own rank as the message. Meanwhile ranks 1 and 3 are already waiting in <code>MPI_Recv</code>, so the data can be delivered.' },
      { t: 'Odd ranks receive', set: pairCells(function (i) { return i % 2 ? [co('msg ' + (i - 1), 'ok')] : [co('msg ?', 'empty')]; }), code: 'MPI_Recv(&message, 1, MPI_INT, partner, 1, MPI_COMM_WORLD,#2', say: '<code>MPI_Recv</code> <b>blocks</b> until a matching message (same source, tag and communicator) arrives, then copies it into <code>message</code>.' },
      { t: 'Odd ranks reply', flow: [{ from: 'r1', to: 'r0', label: '1' }, { from: 'r3', to: 'r2', label: '3' }], code: 'MPI_Send(&proc_id, 1, MPI_INT, partner, 1, MPI_COMM_WORLD);#2', say: 'Now the odd ranks send their rank back. The even ranks are in their <code>MPI_Recv</code> by now.' },
      { t: 'Even ranks receive and everyone prints', set: pairCells(function (i) { return [co('msg ' + (i % 2 ? i - 1 : i + 1), 'ok')]; }), show: ['out'], code: 'printf("Process %d matched to process %d\\n", proc_id, message);',
        say: 'Every process now holds its partner\'s rank and prints "Process <i>p</i> matched to process <i>q</i>".' },
      { t: 'Why the order matters', set: { out: { sub: 'if both partners called MPI_Send first and the\nmessages are too big to be buffered, both wait\nforever for a receive: DEADLOCK', cls: 'bad' } }, pulse: ['out'], code: ['/* try to reverse their orders and see what may happen*/', '/* note that here send first, receive second */'],
        say: '<b>Hypothetical:</b> if both partners sent first, each <code>MPI_Send</code> may wait for the other side to post a receive. With small messages MPI usually buffers them and it "works", with large ones it deadlocks. The comment in the source invites you to try.' }
    ],
    notes: ['A blocking call returns when the buffer is safe to reuse (<code>Send</code>) or filled (<code>Recv</code>).', 'The next example, <code>MPI_Sendrecv</code>, removes the need for this careful ordering.']
  }));

  PDC.add(Object.assign({}, base, {
    id: '4-comb_sendrecv', title: 'MPI_Sendrecv: exchange in one call', files: [D + '4-comb_sendrecv.c'],
    summary: '<code>MPI_Sendrecv</code> performs the send and the receive together, so partners can swap values without caring who goes first.',
    concepts: ['MPI_Sendrecv', 'pairwise exchange', 'deadlock-free'],
    kind: 'diagram', scene: ranks(4, { sub: function (i) { return 'partner = ' + (i % 2 ? i - 1 : i + 1); }, cells: function () { return [co('msg 11', 'empty')]; }, cw: 64, edges: [['r0', 'r1', { dash: true }], ['r2', 'r3', { dash: true }]] }),
    steps: [
      { t: 'Same pairing, initial message = 11', show: R(4), code: ['int message = 11;', 'partner = proc_id + 1;'], say: 'Each rank starts with <code>message = 11</code> and the same partner as before.' },
      { t: 'One call, both directions', flow: [{ from: 'r0', to: 'r1', label: '0' }, { from: 'r1', to: 'r0', label: '1', delay: 0.05 }, { from: 'r2', to: 'r3', label: '2' }, { from: 'r3', to: 'r2', label: '3', delay: 0.05 }], code: ['MPI_Sendrecv(&proc_id, 1, MPI_INT, partner, 1, &message, 1, MPI_INT, partner,', '1, MPI_COMM_WORLD, &stat);'],
        say: '<code>MPI_Sendrecv</code> takes the <em>send</em> arguments and the <em>receive</em> arguments in one call. MPI schedules the two transfers itself, so it cannot deadlock on the ordering.' },
      { t: 'Both partners now hold the other\'s rank', set: cells([[co('msg 1', 'ok')], [co('msg 0', 'ok')], [co('msg 3', 'ok')], [co('msg 2', 'ok')]]), show: ['out'], code: 'printf("Process %d matched to process %d\\n", proc_id, message);', say: 'Each process prints the rank it received. The code is the same for every rank &mdash; no <code>if</code> on even/odd needed.' }
    ],
    notes: ['This is the standard way to do halo / neighbour exchanges in stencil codes.']
  }));

  /* ---------- 5..10 collectives ---------- */
  const ids4 = ['r0', 'r1', 'r2', 'r3'];
  PDC.add(Object.assign({}, base, {
    id: '5-broadcast', title: 'MPI_Bcast: one to all', files: [D + '5-broadcast.c'],
    summary: 'Rank 0 reads a letter from the keyboard and <code>MPI_Bcast</code> copies it into every other process.',
    concepts: ['MPI_Bcast', 'collective communication', 'root'],
    kind: 'diagram', scene: ranks(4, { cells: function () { return [co('0', 'empty')]; }, sub: function (i) { return i === 0 ? 'root' : ''; } }),
    steps: [
      { t: 'Before: only the root knows the secret', show: R(4), set: merge(cells([[co('?', 'hot')], [co('0', 'empty')], [co('0', 'empty')], [co('0', 'empty')]]), { r0: { cells: [co('?', 'hot')], sub: 'root (reads stdin)' } }), code: ['int secret = \'0\';', 'printf("Before bcast, process %d have secret: %c\\n", proc_id, (char)secret);'],
        say: 'Every process has a variable <code>secret</code>, initially the character \'0\'.' },
      { t: 'Root reads the letter', set: { r0: { cells: [co('X', 'c0')] } }, code: ['if(proc_id == 0){', 'secret = getchar();'], pulse: ['r0'], say: 'Only rank 0 reads standard input (all ranks reading stdin would be a mess). Suppose the user types <b>X</b>.' },
      { t: 'MPI_Bcast', flow: [{ from: 'r0', to: 'r1', label: 'X' }, { from: 'r0', to: 'r2', label: 'X', delay: 0.1 }, { from: 'r0', to: 'r3', label: 'X', delay: 0.2 }], set: cells([undefined, [co('X', 'c1')], [co('X', 'c2')], [co('X', 'c3')]]), code: 'MPI_Bcast(&secret, 1, MPI_INT, 0, MPI_COMM_WORLD);',
        say: 'Every rank calls <code>MPI_Bcast</code> with the <b>same</b> root (0). The root\'s <code>secret</code> is copied into the buffer of every other rank. Real implementations use a tree so the time grows like log&nbsp;N.' },
      { t: 'After: everyone has it', show: ['out'], set: printed(['After bcast, process 0 have secret: X', 'After bcast, process 1 have secret: X', 'After bcast, process 2 have secret: X', 'After bcast, process 3 have secret: X']), code: 'printf("After bcast, process %d have secret: %c\\n", proc_id, (char)secret);', say: 'All processes now print the same letter. Note the datatype used is <code>MPI_INT</code> even though the value is a char, so it is transferred as an <code>int</code>.' }
    ],
    notes: ['A collective call must be made by <b>all</b> ranks of the communicator with matching arguments.']
  }));

  PDC.add(Object.assign({}, base, {
    id: '6-gather', title: 'MPI_Gather: collect at one rank', files: [D + '6-gather.c'],
    summary: 'Each rank contributes <code>rank + 1</code>; <code>MPI_Gather</code> assembles them, in rank order, into an array on rank 2.',
    concepts: ['MPI_Gather', 'root = 2', 'rank-ordered array'],
    kind: 'diagram', scene: ranks(4, { h: 120, sub: function (i) { return i === 2 ? 'root of the gather' : ''; }, cells: function () { return [co('?', 'hot')]; } }),
    steps: [
      { t: 'Each rank makes its value', show: R(4), set: cells([[co(1, 'c0')], [co(2, 'c1')], [co(3, 'c2')], [co(4, 'c3')]]), code: 'data = proc_id + 1;', say: 'Rank <i>r</i> holds <code>data = r + 1</code>: 1, 2, 3, 4.' },
      { t: 'The root\'s result array is empty', set: { r2: { cells: [co(0, 'empty'), co(0, 'empty'), co(0, 'empty'), co(0, 'empty')], sub: 'data_gathered' } }, code: ['int data_gathered[DATA_COUNT] = {0};', 'printf("Before gathering, process %d: the array have: ", proc_id);'], say: 'Only the root (rank 2) needs a receive array; it is all zeros at the start.' },
      { t: 'MPI_Gather', flow: [{ from: 'r0', to: 'r2', label: '1' }, { from: 'r1', to: 'r2', label: '2', delay: 0.1 }, { from: 'r3', to: 'r2', label: '4', delay: 0.2 }], set: { r2: { cells: [co(1, 'c0'), co(2, 'c1'), co(3, 'c2'), co(4, 'c3')], sub: 'data_gathered' } },
        code: 'MPI_Gather(&data, 1, MPI_INT, data_gathered, 1, MPI_INT, 2, MPI_COMM_WORLD);', say: 'Every rank sends one <code>int</code>. The root stores the contribution of rank <i>r</i> in slot <i>r</i>, regardless of arrival order (its own value is copied locally). The count/type arguments after the buffer describe what the <em>root</em> receives from <em>each</em> rank.' },
      { t: 'Result: [1, 2, 3, 4] on rank 2 only', show: ['out'], pulse: ['r2'], set: printed(['After gathering, process 2: the array have: 1 2 3 4']), code: 'printf("After gathering, process %d: the array have: ", proc_id);', say: 'Only the root prints the array. The other ranks do not receive the combined data &mdash; for that use <code>MPI_Allgather</code>.' }
    ],
    notes: ['The program insists on exactly 4 processes because <code>DATA_COUNT</code> is 4.']
  }));

  PDC.add(Object.assign({}, base, {
    id: '7-scatter', title: 'MPI_Scatter: split one array', files: [D + '7-scatter.c'],
    summary: 'Rank 1 owns the array <code>[1,2,3,4]</code>; <code>MPI_Scatter</code> hands one element to each rank.',
    concepts: ['MPI_Scatter', 'root = 1', 'data distribution'],
    kind: 'diagram', scene: ranks(4, { h: 120, cells: function () { return [co(-1, 'empty')]; }, sub: function (i) { return i === 1 ? 'root of the scatter' : ''; } }),
    steps: [
      { t: 'Everyone starts with data = -1', show: R(4), code: ['int data = -1;', 'printf("Before scatter, process %d have data: %d\\n", proc_id, data);'], say: 'Each rank has a one-element variable <code>data</code> set to &minus;1.' },
      { t: 'The root prepares the full array', set: { r1: { cells: [co(1, 'c0'), co(2, 'c1'), co(3, 'c2'), co(4, 'c3')], sub: 'data_to_scatter' } }, pulse: ['r1'], code: ['if(proc_id == 1){', 'data_to_scatter[i] = i + 1;'], say: 'Rank 1 fills <code>data_to_scatter</code> with 1, 2, 3, 4. Other ranks do not need this array.' },
      { t: 'MPI_Scatter', flow: [{ from: 'r1', to: 'r0', label: '1' }, { from: 'r1', to: 'r2', label: '3', delay: 0.1 }, { from: 'r1', to: 'r3', label: '4', delay: 0.2 }], set: { r0: { cells: [co(1, 'c0')] }, r1: { cells: [co(2, 'c1')], sub: 'keeps its own piece' }, r2: { cells: [co(3, 'c2')] }, r3: { cells: [co(4, 'c3')] } },
        code: 'MPI_Scatter(data_to_scatter, 1, MPI_INT, &data, 1, MPI_INT, 1, MPI_COMM_WORLD);', say: 'The array is cut into equal pieces of one <code>int</code>; piece <i>r</i> goes to rank <i>r</i> (the root also keeps one). Scatter is the inverse of gather.' },
      { t: 'Each rank holds a different element', show: ['out'], set: printed(['After scatter, process 0 have data: 1', 'After scatter, process 1 have data: 2', 'After scatter, process 2 have data: 3', 'After scatter, process 3 have data: 4']), code: 'printf("After scatter, process %d have data: %d\\n", proc_id, data);', say: 'Same variable name, four different values: the basis of data decomposition in MPI.' }
    ]
  }));

  PDC.add(Object.assign({}, base, {
    id: '8-allgather', title: 'MPI_Allgather: gather to everyone', files: [D + '8-allgather.c'],
    summary: 'Like gather, but there is no root: every rank ends up with the whole array <code>[1,2,3,4]</code>.',
    concepts: ['MPI_Allgather', 'no root', 'replicated result'],
    kind: 'diagram', scene: ranks(4, { h: 120, cells: function (i) { return [co(0, 'empty'), co(0, 'empty'), co(0, 'empty'), co(0, 'empty')]; } }),
    steps: [
      { t: 'Each rank has its own value', show: R(4), set: { r0: { sub: 'data = 1' }, r1: { sub: 'data = 2' }, r2: { sub: 'data = 3' }, r3: { sub: 'data = 4' } }, code: ['data = proc_id + 1;', 'int data_gathered[DATA_COUNT] = {0};'], say: 'Each rank holds <code>data = rank + 1</code> and an empty result array.' },
      { t: 'MPI_Allgather: everyone sends to everyone', flow: [{ from: 'r0', to: 'r3', label: '1' }, { from: 'r1', to: 'r3', label: '2', delay: 0.1 }, { from: 'r2', to: 'r0', label: '3', delay: 0.2 }, { from: 'r3', to: 'r0', label: '4', delay: 0.3 }], code: 'MPI_Allgather(&data, 1, MPI_INT, data_gathered, 1, MPI_INT, MPI_COMM_WORLD);',
        say: 'Conceptually every rank sends its value to all others (implementations use rings or recursive doubling). There is <b>no root</b> argument.' },
      { t: 'All four arrays are identical', set: cells([0, 1, 2, 3].map(function () { return [co(1, 'c0'), co(2, 'c1'), co(3, 'c2'), co(4, 'c3')]; })), show: ['out'], code: 'printf("After gathering, process %d: the array have: ", proc_id);',
        say: 'After the call every process has <code>1 2 3 4</code>. This costs more than <code>Gather</code> but saves a broadcast afterwards.' }
    ]
  }));

  const reduceScene = function () { return ranks(4, { cells: function (i) { return [co(i + 1, 'c' + i)]; }, sub: function () { return 'data'; } }); };
  PDC.add(Object.assign({}, base, {
    id: '9-reduce', title: 'MPI_Reduce: combine to one rank', files: [D + '9-reduce.c'],
    summary: 'Every rank contributes <code>rank + 1</code>; <code>MPI_Reduce</code> with <code>MPI_SUM</code> delivers the sum (10) to rank 0 only.',
    concepts: ['MPI_Reduce', 'MPI_SUM', 'root', 'global operation'],
    kind: 'diagram', scene: (function () { const s = reduceScene(); s.nodes.sum = { x: 300, y: 190, w: 160, h: 50, shape: 'pill', label: 'sum  (tree of +)', cls: 'hot', hidden: true }; return s; })(),
    steps: [
      { t: 'Values 1, 2, 3, 4', show: R(4), code: 'data = proc_id + 1;', say: 'Each rank has one number to contribute.' },
      { t: 'The reduction combines them', show: ['sum'], flow: R(4).map(function (id, k) { return { from: id, to: 'sum', label: k + 1, delay: k * 0.12 }; }), code: 'MPI_Reduce(&data, &sum, 1, MPI_INT, MPI_SUM, 0, MPI_COMM_WORLD);',
        say: 'The values are combined with the operation <code>MPI_SUM</code>. MPI usually does this in a <b>tree</b>: (1+2) and (3+4) in parallel, then their sum.' },
      { t: 'Only the root receives the result', flow: [{ from: 'sum', to: 'r0', label: 10, cls: 'ok' }], set: { r0: { cells: [co(10, 'ok')], sub: 'sum = 10 (root)' }, r1: { sub: 'sum still 0' }, r2: { sub: 'sum still 0' }, r3: { sub: 'sum still 0' } }, hide: ['sum'], code: 'printf("  After reduction, process %d: the sum is %d\\n ", proc_id, sum);',
        say: 'Rank 0 now has <code>sum = 10</code>. On the other ranks the output buffer is <b>undefined</b> (here still 0 from initialisation), so only the root should use the result.' }
    ],
    notes: ['Other built-in operations: <code>MPI_MAX</code>, <code>MPI_MIN</code>, <code>MPI_PROD</code>, <code>MPI_LAND</code>, &hellip;; <code>MPI_Op_create</code> adds your own (see example 14).']
  }));
  PDC.add(Object.assign({}, base, {
    id: '10-allreduce', title: 'MPI_Allreduce: combine and share', files: [D + '10-allreduce.c'],
    summary: 'The same sum as <code>9-reduce.c</code>, but the result (10) is delivered to <b>every</b> rank.',
    concepts: ['MPI_Allreduce', 'global sum', 'used in distributed training'],
    kind: 'diagram', scene: (function () { const s = reduceScene(); s.nodes.sum = { x: 300, y: 190, w: 160, h: 50, shape: 'pill', label: 'sum  (tree of +)', cls: 'hot', hidden: true }; return s; })(),
    steps: [
      { t: 'Values 1, 2, 3, 4', show: R(4), code: 'data = proc_id + 1;', say: 'Same inputs as before.' },
      { t: 'Combine', show: ['sum'], flow: R(4).map(function (id, k) { return { from: id, to: 'sum', label: k + 1, delay: k * 0.12 }; }), code: 'MPI_Allreduce(&data, &sum, 1, MPI_INT, MPI_SUM, MPI_COMM_WORLD);', say: '<code>MPI_Allreduce</code> has no <code>root</code> argument: it is a reduce followed by a broadcast (done more cleverly, e.g. with a ring or recursive doubling).' },
      { t: 'Everyone has the sum', hide: ['sum'], flow: R(4).map(function (id, k) { return { from: 'sum', to: id, label: 10, cls: 'ok', delay: k * 0.1 }; }), set: cells([0, 1, 2, 3].map(function () { return [co(10, 'ok')]; })), code: 'printf("After reduction, process %d: the sum is %d\\n ", proc_id, sum);',
        say: 'All four ranks print <code>sum = 10</code>. This is exactly what <b>data-parallel deep learning</b> does to average gradients across GPUs.' }
    ],
    notes: ['Allreduce is the workhorse of distributed training: every worker ends up with the summed (then averaged) gradients.']
  }));

  /* ---------- 11 / 12 non-blocking ---------- */
  function nbSteps(order12) {
    return [
      { t: 'Pairs as before, message starts at 11', show: R(4), code: ['int message = 11;', 'MPI_Status stats[2];'], say: 'Each rank has <code>message = 11</code> and two request handles <code>reqs[2]</code>.' },
      { t: order12 ? 'Isend and Irecv, same code for all' : 'Post the receive, then the send', set: cells([0, 1, 2, 3].map(function () { return [co('11', 'hot')]; })),
        flow: [{ from: 'r0', to: 'r1', label: '0' }, { from: 'r1', to: 'r0', label: '1' }, { from: 'r2', to: 'r3', label: '2' }, { from: 'r3', to: 'r2', label: '3' }],
        code: order12 ? ['MPI_Isend(&proc_id, 1, MPI_INT, partner, 1, MPI_COMM_WORLD,', 'MPI_Irecv(&message, 1, MPI_INT, partner, 1, MPI_COMM_WORLD,'] : ['MPI_Irecv(&message, 1, MPI_INT, partner, 1, MPI_COMM_WORLD,', 'MPI_Isend(&proc_id, 1, MPI_INT, partner, 1, MPI_COMM_WORLD,'],
        say: '<code>MPI_Isend</code> and <code>MPI_Irecv</code> only <b>start</b> the transfer and return immediately with a request handle. ' + (order12 ? 'Because neither call blocks, <b>the order no longer matters</b>, so one code path works for even and odd ranks.' : 'Even and odd ranks are written separately here, but with non-blocking calls it would not be necessary (see the next example).') },
      { t: 'Compute while the message is in flight', show: ['out'], set: printed(['Msg may not be ready: Process 0\'s msg value is 11', 'Msg may not be ready: Process 1\'s msg value is 11']), code: 'printf("Msg may not be ready: Process %d\'s msg value is %d\\n", proc_id,',
        say: 'Between starting a transfer and finishing it, the process is free to do other work (here: print). But <code>message</code> is <b>not safe to read yet</b>; it may still hold 11, as the printed lines show.' },
      { t: 'MPI_Waitall', set: cells([[co('1', 'ok')], [co('0', 'ok')], [co('3', 'ok')], [co('2', 'ok')]]), code: 'MPI_Waitall(2, reqs, stats);', say: '<code>MPI_Waitall</code> blocks until <b>both</b> requests are complete. Only after it returns may the program use <code>message</code> or reuse the send buffer.' },
      { t: 'Now the data is valid', set: printed(['Msg may not be ready: Process 0\'s msg value is 11', 'Msg may not be ready: Process 1\'s msg value is 11', 'Process 0 matched to process 1', 'Process 1 matched to process 0']), code: 'printf("Process %d matched to process %d\\n", proc_id, message);', say: 'The partner\'s rank is now in <code>message</code>. Non-blocking communication lets you <b>overlap communication with computation</b>.' }
    ];
  }
  PDC.add(Object.assign({}, base, {
    id: '11-nonblock_comm', title: 'Non-blocking send / receive', files: [D + '11-nonblock_comm.c'],
    summary: '<code>MPI_Isend</code> / <code>MPI_Irecv</code> start transfers and return at once; <code>MPI_Waitall</code> completes them. The message must not be used before the wait.',
    concepts: ['MPI_Isend / Irecv', 'MPI_Request', 'MPI_Waitall', 'overlap'],
    kind: 'diagram', scene: ranks(4, { cells: function () { return [co('msg 11', 'hot')]; }, cw: 64, sub: function (i) { return 'partner = ' + (i % 2 ? i - 1 : i + 1); }, outH: 100 }), steps: nbSteps(false),
    notes: ['In this version even and odd ranks post the receive first and the send second; it works for any order.']
  }));
  PDC.add(Object.assign({}, base, {
    id: '12-nonblock_comm_2', title: 'Non-blocking: order does not matter', files: [D + '12-nonblock_comm_2.c'],
    summary: 'The simplified version: two lines (<code>Isend</code>, <code>Irecv</code>) for <em>all</em> ranks, then <code>Waitall</code>.',
    concepts: ['MPI_Isend / Irecv', 'simpler code', 'wait before use'],
    kind: 'diagram', scene: ranks(4, { cells: function () { return [co('msg 11', 'hot')]; }, cw: 64, sub: function (i) { return 'partner = ' + (i % 2 ? i - 1 : i + 1); }, outH: 100 }), steps: nbSteps(true),
    notes: ['Compare with <code>3-block_comm.c</code>: blocking calls needed an even/odd split to avoid deadlock; non-blocking calls do not.']
  }));

  /* ---------- 13-group ---------- */
  const g8 = ranks(8, { y: 70, h: 110, cw: 30, cells: function (i) { return [co(i, 'c' + (i % 4))]; }, sub: function () { return 'send_buf'; }, outY: 218, outH: 70, H: 300, groups: [{ x: 10, y: 40, w: 358, h: 160, label: 'group 1  (ranks 0-3)' }, { x: 392, y: 40, w: 358, h: 160, label: 'group 2  (ranks 4-7)' }] });
  PDC.add(Object.assign({}, base, {
    id: '13-group', title: 'Groups and communicators', files: [D + '13-group.c'],
    summary: 'Eight ranks are split into two groups of four. Each group gets its own communicator, and <code>Allreduce</code> then sums only within the group.',
    concepts: ['MPI_Group', 'MPI_Comm_create', 'sub-communicator', 'new rank in group'],
    kind: 'diagram', scene: g8,
    steps: [
      { t: 'Eight processes in MPI_COMM_WORLD', show: R(8), set: cells(Array.from({ length: 8 }, function (_, i) { return [co(i, 'c' + (i % 8))]; })), code: ['#define NPROCS 8', 'if (proc_cnt != NPROCS) {'], say: 'The program needs exactly 8 processes. Each holds <code>send_buf = its rank</code>.' },
      { t: 'Take the world group and pick members', pulse: R(8), code: ['MPI_Comm_group(MPI_COMM_WORLD, &orig_group);', 'MPI_Group_incl(orig_group, NPROCS/2, group1_ids, &new_group);'],
        say: '<code>MPI_Comm_group</code> gets the group of all processes. <code>MPI_Group_incl</code> builds a new group out of chosen ranks: processes 0&ndash;3 pick <code>{0,1,2,3}</code>, processes 4&ndash;7 pick <code>{4,5,6,7}</code>.' },
      { t: 'Create one communicator per group', pulse: R(8), code: 'MPI_Comm_create(MPI_COMM_WORLD, new_group, &new_comm);',
        say: '<code>MPI_Comm_create</code> is <b>collective over the whole world</b> and gives each process a communicator containing its group. Messages in one communicator never mix with messages in another.' },
      { t: 'Allreduce inside each group', flow: [0, 1, 2, 3].map(function (i) { return { from: 'r' + i, to: 'r' + ((i + 1) % 4), label: i, delay: i * 0.1 }; }).concat([4, 5, 6, 7].map(function (i) { return { from: 'r' + i, to: 'r' + (4 + (i - 3) % 4), label: i, delay: i * 0.05 }; })), code: 'MPI_Allreduce(&send_buf, &recv_buf, 1, MPI_INT, MPI_SUM, new_comm);',
        say: 'The sum is now computed <b>per communicator</b>: group 1 adds 0+1+2+3 = <b>6</b>, group 2 adds 4+5+6+7 = <b>22</b>. The two groups do not talk to each other.' },
      { t: 'New ranks and results', show: ['out'], set: merge(cells(Array.from({ length: 8 }, function (_, i) { return [co(i < 4 ? 6 : 22, i < 4 ? 'c0' : 'c1')]; })), printed(['rank= 0 newrank= 0 recvbuf= 6   ...   rank= 3 newrank= 3 recvbuf= 6', 'rank= 4 newrank= 0 recvbuf= 22  ...   rank= 7 newrank= 3 recvbuf= 22'])), code: ['MPI_Comm_rank(new_comm, &new_id);', 'printf("rank= %d newrank= %d recvbuf= %d\\n",proc_id, new_id, recv_buf);'],
        say: 'Inside a new communicator ranks are renumbered from 0: world rank 4 becomes <code>newrank = 0</code> of group 2. Communicators let libraries and sub-teams run collectives independently.' }
    ],
    notes: ['Real programs often use <code>MPI_Comm_split(color, key)</code>, which does the same job in one call.']
  }));

  /* ---------- 14-custom_type_op ---------- */
  PDC.add(Object.assign({}, base, {
    id: '14-custom_type_op', title: 'Custom datatype and reduction operator', files: [D + '14-custom_type_op.c'],
    summary: 'A C <code>struct item</code> is described to MPI with a derived datatype, and a user-defined operation adds the <code>weight</code> and <code>value</code> fields during an <code>MPI_Allreduce</code>.',
    concepts: ['derived datatype', 'MPI_Type_struct (create_struct)', 'MPI_Op_create', 'user-defined reduction'],
    kind: 'diagram',
    scene: (function () {
      const s = ranks(4, { y: 190, h: 96, cells: function (i) { return [co('w ' + (10 + i), 'c' + i), co('v ' + (100 + i), 'c' + i)]; }, cw: 58, outY: 300, outH: 56, H: 370, hidden: true });
      s.nodes.layout = { x: 80, y: 20, w: 600, h: 100, label: 'struct item in memory (24 bytes)', sub: 'offsets: id = 0     weight = 8     value = 16   (compiler padding around)', cls: 'mem', cells: [co('id (4B)', 'c0'), co('pad', 'empty'), co('weight (8B)', 'c1'), co('value (4B)', 'c2'), co('pad', 'empty')], cw: 112 };
      return s;
    })(),
    steps: [
      { t: 'The struct and its padding', code: ['struct item{', 'int id;'], say: 'A <code>struct item</code> has an <code>int</code>, a <code>double</code> and a <code>float</code>. The compiler inserts <b>padding</b> so the double is 8-byte aligned, so you cannot assume the fields are contiguous.' },
      { t: 'Find the real offsets', code: ['MPI_Get_address(&tmp.id, &offsets[0]);', 'offsets[0] -= base;'], pulse: ['layout'], say: '<code>MPI_Get_address</code> returns each field\'s address; subtracting the struct\'s base address gives the <b>offsets</b> (0, 8, 16) that MPI needs to describe the layout.' },
      { t: 'Build and commit the MPI datatype', code: ['ret = MPI_Type_struct(count, block_length, offsets, types, &new_type);', 'MPI_Type_commit(&new_type);'], say: '<code>MPI_Type_struct</code> (called <code>MPI_Type_create_struct</code> in MPI-3) combines blocks of basic types at given offsets into one new datatype. <code>MPI_Type_commit</code> makes it usable in communication.' },
      { t: 'Create the user-defined operation', code: ['void item_sum(void *vin, void *vinout, int *len, MPI_Datatype *dptr)', 'ret = MPI_Op_create(item_sum, 0, &mpi_item_sum);'], say: '<code>item_sum</code> receives two arrays: it must compute <code>inout[i] = in[i] <b>op</b> inout[i]</code>. Here it adds <code>weight</code> and <code>value</code>. <code>MPI_Op_create</code> registers it (the <code>0</code> says the operation is not commutative-safe to reorder).' },
      { t: 'Each rank fills its item', show: R(4), code: ['product.weight = proc_id + 10;', 'product.value = proc_id + 100;'], say: 'Rank <i>r</i> creates an item with weight 10+<i>r</i> and value 100+<i>r</i>.' },
      { t: 'Allreduce with the custom type and op', hide: ['layout'], flow: [{ from: 'r0', to: 'r1', label: 'item' }, { from: 'r2', to: 'r3', label: 'item', delay: 0.1 }, { from: 'r1', to: 'r3', label: 'item', delay: 0.5 }, { from: 'r3', to: 'r0', label: 'sum', delay: 0.9, cls: 'ok' }], code: 'MPI_Allreduce(&product, &sum, 1, mpi_item_type, mpi_item_sum, MPI_COMM_WORLD);',
        say: 'MPI moves whole <code>item</code> structs (it knows their layout) and combines pairs with <code>item_sum</code> as in a normal reduction tree.' },
      { t: 'Every rank gets the totals', show: ['out'], set: merge(cells([0, 1, 2, 3].map(function () { return [co('w 46', 'ok'), co('v 406', 'ok')]; })), printed(['After reduction, process 0: total weight is 46.000000, total value is 406.000000', '(same on every rank:  10+11+12+13 = 46,  100+101+102+103 = 406)'])), code: 'printf("After reduction, process %d: total weight is %lf, total value is %f\\n",', say: 'All ranks print 46 and 406. Only the <code>weight</code> and <code>value</code> fields are summed; <code>id</code> is not meaningful in the result.' }
    ],
    notes: ['Derived datatypes let you send structs, array columns or strided data in a single call.', '<code>MPI_Type_struct</code> was removed from the MPI-3 standard; recent MPI libraries need <code>MPI_Type_create_struct</code> (same arguments).']
  }));
})();
