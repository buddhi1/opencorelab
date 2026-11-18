/* OpenMP GPU offload (pdc/openmp/src1.5): the CUDA teaching kernels re-expressed with `target teams`. */
(function () {
  'use strict';
  const D = 'pdc/openmp/src1.5/';
  const base = { course: 'pdc', topic: 'openmp-offload' };
  const rc = PDC.MM.rowcol;
  const ALL = 'all';

  /* ---------- overview: CUDA <-> OpenMP vocabulary ---------- */
  const pairs = [
    ['grid of blocks', 'league of teams', '<<<grid, block>>>', 'num_teams(n) thread_limit(t)'],
    ['thread block', 'team', 'blockIdx', 'omp_get_team_num()'],
    ['thread', 'OpenMP thread in a team', 'threadIdx', 'omp_get_thread_num()'],
    ['__shared__ array', 'array declared inside the teams region', '__shared__ float As[..]', 'float As[..]; (one per team)'],
    ['__syncthreads()', 'barrier', '__syncthreads();', '#pragma omp barrier'],
    ['cudaMemcpy H2D / D2H', 'map clauses', 'cudaMemcpy(...)', 'map(to: A) map(from: C)']
  ];
  const nodes = {};
  pairs.forEach(function (p, i) {
    nodes['c' + i] = { x: 20, y: 24 + i * 52, w: 300, h: 40, shape: 'pill', label: p[0], c: 0, hidden: false };
    nodes['o' + i] = { x: 440, y: 24 + i * 52, w: 300, h: 40, shape: 'pill', label: p[1], c: 3, hidden: false };
  });
  nodes.hc = { x: 20, y: -4, w: 300, h: 20, shape: 'text', label: 'CUDA' }; nodes.ho = { x: 440, y: -4, w: 300, h: 20, shape: 'text', label: 'OpenMP target' };
  PDC.add(Object.assign({ id: 'cuda-to-openmp', title: 'From CUDA to OpenMP: the vocabulary' }, base, {
    files: [D + 'README.txt', D + 'run_gpu.sh', D + 'run_host_fallback.sh'], concepts: ['target teams', 'thread_limit', 'map clauses', 'omp_is_initial_device'],
    summary: 'The five programs in this folder re-implement the CUDA teaching kernels with <code>#pragma omp target teams</code>. This page lines up the two vocabularies, so every later example can be read side by side with its CUDA original.',
    kind: 'diagram', scene: { w: 760, h: 348, nodes: nodes, edges: pairs.map(function (_, i) { return ['c' + i, 'o' + i, { dash: true }]; }) },
    steps: [
      { t: 'Same hardware, different notation', code: ['These files adapt the original CUDA-like mapping', 'OpenMP NVIDIA GPU validation (Enterprise1)'], say: 'The kernels are the same as in <code>pdc/cuda/src1.5</code>. The goal is to express them in standard OpenMP, which also runs on AMD and Intel GPUs, or on the CPU as a fallback.' },
      { t: 'Grid and block &rarr; league and team', pulse: ['c0', 'o0', 'c1', 'o1'], code: 'The tiled program keeps As and Bs team-local', say: '<code>target teams num_teams(N)</code> creates a <b>league of N teams</b>: the analogue of a grid of blocks. Teams do not synchronise with each other, just as blocks do not. <code>thread_limit(t)</code> bounds the threads per team, like the block size.' },
      { t: 'Threads and ids', pulse: ['c2', 'o2'], say: 'Inside a team, <code>#pragma omp parallel</code> starts threads; <code>omp_get_team_num()</code> and <code>omp_get_thread_num()</code> are <code>blockIdx</code> and <code>threadIdx</code>.' },
      { t: 'Shared memory and barriers', pulse: ['c3', 'o3', 'c4', 'o4'], say: 'A variable declared in the <code>teams</code> region exists <b>once per team</b> and is shared by that team\'s threads. That mirrors <code>__shared__</code>. <b>Caveat:</b> portable OpenMP does not promise it lives in the GPU\'s physical shared memory. <code>#pragma omp barrier</code> plays the role of <code>__syncthreads()</code>.' },
      { t: 'Data movement', pulse: ['c5', 'o5'], code: ['export OMP_TARGET_OFFLOAD=MANDATORY', 'CFLAGS="-O2 -fopenmp -foffload=nvptx-none -fcf-protection=none -fno-stack-protector"'], say: '<code>map(to: A, B) map(from: C)</code> (usually inside <code>target data</code>) replaces <code>cudaMemcpy</code>. <code>run_gpu.sh</code> builds with <code>-foffload=nvptx-none</code> and sets <code>OMP_TARGET_OFFLOAD=MANDATORY</code> so the run fails instead of silently falling back to the CPU.' }
    ],
    notes: ['Every program prints <code>Execution: target device</code> or <code>host fallback</code> by testing <code>omp_is_initial_device()</code> inside a tiny target region.', '<code>run_host_fallback.sh</code> builds the same sources without offloading, so you can run them on any machine.']
  }));

  /* ---------- common first steps ---------- */
  const mapStep = function (extra) {
    return Object.assign({ t: 'Map the data to the device', eq: 'target data map(to: A, B) map(from: C)', A: { hl: ALL }, B: { hl: ALL }, C: {}, own: 'none',
      code: '#pragma omp target data map(to: A[0:count], B[0:count]) map(from: C[0:count])',
      say: '<code>target data</code> copies A and B to the device (<code>map(to:)</code>) and arranges for C to be copied back at the end (<code>map(from:)</code>). They stay on the device while the compute region runs &mdash; this is <code>cudaMalloc</code> + <code>cudaMemcpy</code> in one line.' }, extra || {});
  };
  const whereStep = function () {
    return { t: 'Did it really run on the GPU?', eq: 'ran_on_device = !omp_is_initial_device();', A: {}, B: {}, C: {}, own: 'none', code: ['#pragma omp target map(from: ran_on_device)', 'ran_on_device = !omp_is_initial_device();'],
      say: 'A one-line <code>target</code> region asks "am I on the initial (host) device?". The answer is printed as <code>Execution: target device</code> or <code>host fallback</code>, so students can <em>verify</em> the offload happened.' };
  };
  const verifyStep = function () {
    return { t: 'Verify and report', eq: 'C[i] == n for every i   (A = B = 1)', C: { done: ALL }, A: {}, B: {}, code: ['printf("Execution: %s\\n", ran_on_device ? "target device" : "host fallback");', 'printf("Verification: %s\\n", errors == 0 ? "PASS" : "FAIL");'],
      say: 'The host checks every element of C and prints PASS/FAIL, the compute-region time, and which device was used.' };
  };

  /* ---------- OneBlock ---------- */
  const oneSteps = function () {
    const n = 4;
    return [
      mapStep(),
      whereStep(),
      { t: 'One team, one requested thread per element', own: 'none', eq: 'num_teams(1) thread_limit(n*n)   →   16 threads requested for 16 outputs', C: { hl: ALL }, A: {}, B: {}, code: ['#pragma omp target teams num_teams(1) thread_limit(threads)', '#pragma omp parallel num_threads(threads)'],
        say: '<code>num_teams(1)</code> is the one-<em>block</em> kernel. <code>parallel num_threads(n*n)</code> <b>requests</b> n&sup2; threads. An OpenMP runtime is allowed to give fewer, so the code must not assume it got them all.' },
      { t: 'Robust mapping: stride by the real thread count', own: 'col', T: 4, eq: 'for (tid = omp_get_thread_num(); tid < n*n; tid += omp_get_num_threads())  →  thread 2 handles tid 2, 6, 10, 14', C: { hl: [[0, 2], [1, 2], [2, 2], [3, 2]] }, A: {}, B: {},
        code: ['int actual_threads = omp_get_num_threads();', 'for (int tid = omp_get_thread_num(); tid < threads; tid += actual_threads) {'],
        say: 'Suppose only 4 threads were actually created. Thread 2 then handles output numbers 2, 6, 10 and 14 (the coloured column) instead of just one. This <b>strided loop</b> is the same idea as the grid-stride loop in CUDA, and it guarantees that <em>every</em> output is computed.' },
      { t: 'Output number &rarr; row and column', own: 'none', eq: 'tid = 6:   row = tid / n = 1     col = tid % n = 2   →  C[1][2]', A: { hl: { row: 1 } }, B: { hl: { col: 2 } }, C: { hl: [[1, 2]] }, code: ['int row = tid / n;', 'int col = tid % n;'],
        say: 'The flat thread number is converted to a row and column (CUDA gets these from <code>threadIdx.y</code> and <code>.x</code>).' },
      { t: 'The dot product', own: 'none', eq: '', sweep: rc(n, 1, 2), A: { hl: { row: 1 } }, B: { hl: { col: 2 } }, C: { hl: [[1, 2]] }, code: 'sum += A[row * n + k] * B[k * n + col];', say: 'Same inner loop as in CUDA.' },
      verifyStep()
    ];
  };
  const oneBlock = PDC.add(Object.assign({ id: 'MatMul_OneBlock_OpenMP_Target' }, base, {
    title: 'One team: matrix multiply', files: [D + 'MatMul_OneBlock_OpenMP_Target.c'], concepts: ['target data / map', 'target teams num_teams(1)', 'parallel num_threads', 'strided thread loop'],
    summary: 'OpenMP version of <code>MatMul_OneBlock.cu</code>: one <em>team</em> computes the whole product, one requested thread per element of C.',
    kind: 'matmul', scene: { n: 4, own: 'none' }, steps: oneSteps(),
    notes: ['Limit: n&sup2; &le; 1024 requested threads, exactly as in the CUDA version.'], tryit: ['Run <code>sh run_host_fallback.sh</code> and <code>sh run_gpu.sh</code> and compare the "Compute-region time".']
  }));
  PDC.add(Object.assign({}, oneBlock, { id: 'MatMul_OpenMP_Target', title: 'MatMul_OpenMP_Target.c (copy of the one-team version)', files: [D + 'MatMul_OpenMP_Target.c'],
    summary: 'Byte-for-byte the same program as <code>MatMul_OneBlock_OpenMP_Target.c</code> (the analogue of <code>MatMul.cu</code> in the CUDA folder). The run scripts do not build it separately.' }));

  /* ---------- MultipleBlock ---------- */
  PDC.add(Object.assign({ id: 'MatMul_MultipleBlock_OpenMP_Target' }, base, {
    title: 'Many teams: a league of tiles', files: [D + 'MatMul_MultipleBlock_OpenMP_Target.c'], concepts: ['num_teams', 'omp_get_team_num', 'thread_limit', 'CUDA-like 2-D mapping'],
    summary: 'OpenMP version of <code>MatMul_MultipleBlock.cu</code>: a league of teams, one team per tile of C, one thread per element of the tile.',
    kind: 'matmul', scene: { n: 8, tile: 4, own: 'tile' },
    steps: [
      mapStep({ own: 'tile' }),
      { t: 'A league of numTeams teams', own: 'tile', eq: 'gridX = ceil(n/block) = 2   numTeams = gridX² = 4   threadsPerTeam = block² = 16', A: {}, B: {}, C: {}, code: ['int gridX = (n + blockSize - 1) / blockSize;', '#pragma omp target teams num_teams(numTeams) thread_limit(threadsPerTeam)'],
        say: 'Each coloured tile of C belongs to one <b>team</b>. <code>num_teams</code> and <code>thread_limit</code> are the launch configuration (<code>&lt;&lt;&lt;grid, block&gt;&gt;&gt;</code> in CUDA).' },
      { t: 'Team number &rarr; block coordinates', own: 'tile', eq: 'team 2:   blockRow = 2 / gridX = 1     blockCol = 2 % gridX = 0   →  tile (1,0)', C: { hl: { rect: [4, 0, 7, 3] } }, A: {}, B: {}, code: ['int team = omp_get_team_num();', 'int blockRow = team / gridX;', 'int blockCol = team % gridX;'],
        say: 'OpenMP has only a 1-D team number, so the program derives the 2-D block coordinates by division and remainder (CUDA provides <code>blockIdx.y</code> and <code>.x</code> directly).' },
      { t: 'Thread number &rarr; position inside the tile', own: 'tile', eq: 'tid = 14 → ty = 14 / 4 = 3, tx = 14 % 4 = 2 → row = 1·4+3 = 7, col = 0·4+2 = 2', C: { hl: [[7, 2]] }, A: { hl: { row: 7 } }, B: { hl: { col: 2 } }, code: ['int ty = tid / blockSize;', 'int row = blockRow * blockSize + ty;', 'int col = blockCol * blockSize + tx;'],
        say: 'Inside the team the same flat-to-2-D conversion gives the thread\'s position in the tile; adding the tile offset gives the <b>global</b> row and column, exactly like <code>blockIdx*blockDim + threadIdx</code>.' },
      { t: 'Bounds check and dot product', own: 'tile', sweep: rc(8, 7, 2), eq: '', C: { hl: [[7, 2]] }, A: { hl: { row: 7 } }, B: { hl: { col: 2 } }, code: ['if (row < n && col < n) {', 'sum += A[row * n + k] * B[k * n + col];'], say: 'The guard skips positions beyond the matrix when n is not a multiple of the block size. Then comes the usual dot product.' },
      verifyStep()
    ],
    notes: ['The teams run independently, in any order &mdash; just like blocks.']
  }));

  /* ---------- SharedMemory ---------- */
  PDC.add(Object.assign({ id: 'MatMul_SharedMemory_OpenMP_Target' }, base, {
    title: 'Team-local tiles (shared-memory tiling)', files: [D + 'MatMul_SharedMemory_OpenMP_Target.c'], concepts: ['team-local arrays', '#pragma omp barrier', 'tiling', 'strided loops over tile entries'],
    summary: 'OpenMP version of <code>MatMul_SharedMemory.cu</code>: <code>As</code> and <code>Bs</code> are arrays declared per team and shared by its threads; barriers separate loading from computing.',
    kind: 'matmul', scene: { n: 8, tile: 4, own: 'tile' },
    steps: [
      mapStep({ own: 'tile' }),
      { t: 'Arrays declared in the teams region', own: 'tile', C: { hl: { rect: [0, 4, 3, 7] } }, A: {}, B: {}, sh: { title: 'One copy of As, Bs and sums per TEAM, shared by its threads', A: { label: 'As', filled: false }, B: { label: 'Bs', filled: false } }, eq: 'float As[MAX_TILE*MAX_TILE]; float Bs[...]; float sums[...];',
        code: ['float As[MAX_TILE * MAX_TILE];', '#pragma omp parallel num_threads(threadsPerTeam) shared(As, Bs, sums)'],
        say: 'Variables declared inside the <code>target teams</code> block are allocated <b>once per team</b>, and <code>shared(As, Bs, sums)</code> makes them visible to all of the team\'s threads &mdash; the structure of CUDA <code>__shared__</code>. <em>Whether they are placed in the GPU\'s real shared memory is up to the compiler.</em>' },
      { t: 'Phase t: load a tile of A and of B', own: 'tile', A: { hl: { rect: [0, 0, 3, 3] } }, B: { hl: { rect: [0, 4, 3, 7] } }, C: { hl: { rect: [0, 4, 3, 7] } }, sh: { A: { label: 'As = A tile t' }, B: { label: 'Bs = B tile t' } }, eq: 'As[idx] = A[row][aCol] (or 0.0 outside)', code: ['As[idx] = (row < n && aCol < n) ? A[row * n + aCol] : 0.0f;', 'Bs[idx] = (bRow < n && col < n) ? B[bRow * n + col] : 0.0f;'],
        say: 'Each <em>actual</em> thread loads as many tile entries as needed (<code>idx += actual_threads</code>), so the code works even if fewer threads exist than requested. Entries outside the matrix are padded with 0.' },
      { t: 'Barrier, compute from the tile', own: 'tile', A: { hl: { rect: [0, 0, 3, 3] } }, B: { hl: { rect: [0, 4, 3, 7] } }, C: { hl: [[1, 5]] }, sh: { A: { label: 'As', hl: [[1, 0], [1, 1], [1, 2], [1, 3]] }, B: { label: 'Bs', hl: [[0, 1], [1, 1], [2, 1], [3, 1]] } }, eq: 'sums[idx] += As[ty][k] · Bs[k][tx]   for k < tileSize', code: ['#pragma omp barrier', 'sums[idx] += As[ty * tileSize + k] * Bs[k * tileSize + tx];'],
        say: '<code>#pragma omp barrier</code> (= <code>__syncthreads()</code>) ensures the tile is fully loaded. Then each thread accumulates tileSize products from team-local memory into <code>sums[idx]</code>.' },
      { t: 'Second barrier, next tile', own: 'tile', A: { hl: { rect: [0, 4, 3, 7] } }, B: { hl: { rect: [4, 4, 7, 7] } }, C: { hl: { rect: [0, 4, 3, 7] } }, sh: { A: { label: 'next As' }, B: { label: 'next Bs' } }, eq: 'for (t = 0; t < numTiles; t++)', code: ['for (int t = 0; t < numTiles; t++) {', 'int numTiles = (n + tileSize - 1) / tileSize;'],
        say: 'A barrier after the compute loop prevents the next load from overwriting the tile while slower threads still read it. The loop repeats for every pair of tiles along the row of A and column of B.' },
      { t: 'Write the tile of C', own: 'tile', C: { done: { rect: [0, 4, 3, 7] }, hl: { rect: [0, 4, 3, 7] } }, A: {}, B: {}, eq: 'C[row][col] = sums[idx]', code: 'C[row * n + col] = sums[idx];', say: 'After the last tile the accumulated sums are written to C.' },
      verifyStep()
    ],
    notes: ['The program accepts tile sizes up to 32 (<code>MAX_TILE</code>); <code>tile&sup2;</code> must be &le; 1024.']
  }));

  /* ---------- Reduction ---------- */
  PDC.add(Object.assign({ id: 'Reduction_OneBlock_OpenMP_Target' }, base, {
    title: 'Tree reduction in one team', files: [D + 'Reduction_OneBlock_OpenMP_Target.c'], concepts: ['team-local array', 'barrier per step', 'strided loops', 'tree reduction'],
    summary: 'OpenMP version of <code>Reduction_OneBlock.cu</code>: an explicit tree reduction in a team-local array, kept (instead of <code>reduction(+:)</code>) to teach the algorithm.',
    kind: 'reduce', scene: { T: 8, values: [1, 1, 1, 1, 1, 1, 1, 1], name: 'sdata' },
    steps: [
      { t: 'One team, n threads', view: 'cache', code: ['#pragma omp target teams num_teams(1) thread_limit(n)', 'float sdata[MAX_THREADS];'], say: 'A single team with a team-local array <code>sdata</code> (the analogue of the shared array in the CUDA version). n must be a power of two, &le; 1024.' },
      { t: 'Load A into sdata', view: 'cache', code: ['for (int i = tid; i < n; i += actual_threads)', 'sdata[i] = A[i];'], say: 'Each real thread copies a strided subset of A, so every element is loaded even if the runtime started fewer than n threads.' },
      { t: 'Barrier', view: 'cache', code: '#pragma omp barrier', say: 'All loads must complete before any thread reads a neighbour\'s element.' },
      { t: 'Stride 4', view: 'tree', stride: 4, code: ['for (int stride = n / 2; stride > 0; stride /= 2) {', 'sdata[i] += sdata[i + stride];'], say: 'For <code>i &lt; stride</code>, add <code>sdata[i + stride]</code>. Again the loop strides by the real thread count.' },
      { t: 'Stride 2', view: 'tree', stride: 2, code: '#pragma omp barrier#2', say: 'A barrier after each step orders the tree levels.' },
      { t: 'Stride 1', view: 'tree', stride: 1, code: 'stride /= 2', say: 'After log&#8322; n steps <code>sdata[0]</code> holds the total.' },
      { t: 'Thread 0 writes the result', view: 'tree', out: true, outLabel: 'result[0] = sdata[0]', code: ['if (tid == 0)', 'result[0] = sdata[0];'], say: 'Thread 0 stores the sum into the mapped result, which comes back to the host when the <code>target data</code> region ends. The host checks <code>result == n</code>.' }
    ],
    notes: ['In production OpenMP code you would simply write <code>reduction(+:sum)</code> on a <code>distribute parallel for</code> loop.']
  }));
})();
