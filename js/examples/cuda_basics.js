/* CUDA basics (pdc/cuda/src). The builders are also used by hpml_cuda.js for the HPML copies of the same programs. */
(function () {
  'use strict';
  const D = 'pdc/cuda/src/';
  const B = (PDC.cudaBuilders = {});
  const co = function (v, c) { return { v: v, c: c }; };
  const merge = function () { return Object.assign.apply(null, [{}].concat(Array.prototype.slice.call(arguments))); };

  /* ---------- add.cu ---------- */
  B.add = function (o) {
    return merge({
      title: 'Your first kernel: add two numbers', concepts: ['__global__', '<<<blocks, threads>>>', 'cudaMalloc / cudaMemcpy', 'host vs device memory'],
      summary: 'The smallest complete CUDA program: one thread on the GPU adds two integers and the result is copied back to the CPU.',
      kind: 'diagram',
      scene: {
        w: 760, h: 300,
        edges: [['hostmem', 'kernel', { dash: true }], ['kernel', 'devmem', { dash: true }]],
        nodes: {
          hostmem: { x: 20, y: 30, w: 220, h: 110, label: 'CPU (host) memory', sub: 'int c', cls: 'cpu', cells: [co('?', 'empty')], cw: 60 },
          kernel: { x: 290, y: 20, w: 180, h: 100, label: 'kernel add', sub: '<<<1, 1>>>\n1 block × 1 thread', cls: 'gpu', hidden: true },
          devmem: { x: 520, y: 30, w: 220, h: 110, label: 'GPU (device) memory', sub: 'int *dev_c', cls: 'gpu', cells: [co('', 'empty')], cw: 60, hidden: true },
          out: { x: 20, y: 200, w: 720, h: 60, label: 'stdout', sub: '', cls: 'mem', hidden: true }
        }
      },
      steps: [
        { t: 'The CPU asks for GPU memory', show: ['devmem'], set: { devmem: { cells: [co('?', 'empty')] } }, pulse: ['devmem'], code: 'cudaMalloc((void**)&dev_c, sizeof(int));',
          say: '<code>cudaMalloc</code> reserves room for one <code>int</code> in <b>GPU memory</b> and stores its address in <code>dev_c</code>. The CPU can hold that pointer but cannot dereference it: CPU and GPU have separate memories.' },
        { t: 'Launch the kernel: <<<1,1>>>', show: ['kernel'], flow: [{ from: 'hostmem', to: 'kernel', label: '2, 7' }], code: ['add<<<1,1>>>', '__global__ void add'],
          say: 'The <code>&lt;&lt;&lt;1,1&gt;&gt;&gt;</code> launch configuration asks for <b>one block of one thread</b>. The arguments <code>2</code> and <code>7</code> are passed <em>by value</em> to the GPU; <code>dev_c</code> tells it where to write.' },
        { t: 'One GPU thread does the addition', flow: [{ from: 'kernel', to: 'devmem', label: '9', cls: 'ok' }], set: { devmem: { cells: [co(9, 'ok')] } }, pulse: ['kernel'], code: '*c = a + b;',
          say: '<code>__global__</code> marks a function that runs on the GPU but is launched from the CPU. The single thread executes <code>*c = a + b</code> and writes 9 into GPU memory.' },
        { t: 'Copy the result back', flow: [{ from: 'devmem', to: 'hostmem', label: '9', cls: 'ok' }], set: { hostmem: { cells: [co(9, 'ok')] } }, code: 'cudaMemcpy(&c, dev_c, sizeof(int), cudaMemcpyDeviceToHost);',
          say: '<code>cudaMemcpy</code> with <code>cudaMemcpyDeviceToHost</code> copies the value across. It also <b>waits</b> for the kernel to finish, so no explicit synchronisation is needed here.' },
        { t: 'Print and free', show: ['out'], set: { out: { sub: '2 + 7 = 9' } }, hide: ['kernel'], code: ['2 + 7 = %d', 'cudaFree('], say: 'The CPU prints the result and releases the GPU memory with <code>cudaFree</code>.' }
      ],
      notes: ['Every CUDA program follows this pattern: <b>allocate &rarr; copy in &rarr; launch &rarr; copy out &rarr; free</b>.'],
      tryit: ['Change the launch to <code>&lt;&lt;&lt;1,4&gt;&gt;&gt;</code>: four threads now all write the same answer. Why is that harmless here?']
    }, o);
  };

  /* ---------- hello world (both variants) ---------- */
  B.hello = function (o, v) {
    const scene = { mode: 'hello', gx: v.gx, bd: v.bd, console: true };
    return merge({
      kind: 'cudagrid', scene: scene,
      steps: PDC.CG.hello(scene, { code: v.code, text: 'Hello, world!', line: v.line, perBlock: v.perBlock || 3, order: v.order, syncTitle: v.syncTitle, syncText: v.syncText, syncSay: v.syncSay, hostLine: v.hostLine })
    }, o);
  };

  /* ---------- vecsum family ---------- */
  function vecScene(mode, gx, gy, bd, N, a, b) {
    const s = { mode: mode, gx: gx, gy: gy || 1, bd: bd, N: N };
    if (a) s.a = a; if (b) s.b = b;
    return s;
  }
  B.vec = function (o, v) {
    const scene = vecScene(v.mode, v.gx, v.gy, v.bd, v.N, v.a, v.b);
    return merge({ kind: 'cudagrid', scene: scene, steps: PDC.CG.auto(scene, { kernel: 'add', code: v.code, say: v.say, individual: v.individual }) }, o);
  };

  /* ---------- dot product (shared memory reduction) ---------- */
  const dotData0 = (function () { const a = []; for (let q = 0; q < 8; q++) a.push(2 * q * q); for (let q = 16; q < 24; q++) a.push(2 * q * q); return a; })();
  const dotB1 = (function () { let s = 0; for (let q = 8; q < 16; q++) s += 2 * q * q; return s; })();
  const dotB0 = dotData0.reduce(function (x, y) { return x + y; }, 0);
  B.dot = function (o, v) {
    v = v || {};
    return merge({
      title: 'Dot product: grid-stride loop and shared-memory reduction', concepts: ['__shared__', '__syncthreads()', 'grid-stride loop', 'tree reduction', 'per-block partial results'],
      summary: 'Each block computes one partial dot product: threads accumulate a strided slice, then reduce it in shared memory; the CPU adds the per-block results.',
      kind: 'reduce', scene: { T: 8, data: dotData0, name: 'cache' },
      steps: [
        { t: 'Scaled-down picture', view: 'data', acc: 0, code: ['const int threadsPerBlock = 256;', 'const int blocksPerGrid = imin(32, (N+threadsPerBlock-1) / threadsPerBlock);'],
          say: 'The real program uses 256 threads &times; 32 blocks. The picture shows <b>one block of 8 threads</b> in a grid of 2 blocks. The 16 boxes are the products <code>a[i]*b[i]</code> that <em>this</em> block handles (the other block takes elements 8&ndash;15).' },
        { t: 'Round 1: thread t takes element t', view: 'data', acc: 1, code: ['float temp = 0;', 'temp += a[tid] * b[tid];'], say: 'Each thread starts with <code>temp = 0</code> in a register and adds the product for its first element.' },
        { t: 'Round 2: jump by the grid size', view: 'data', acc: 2, code: 'tid += blockDim.x * gridDim.x;', say: 'The <b>grid-stride loop</b>: after each element the thread jumps ahead by the <em>total number of threads in the grid</em> (blockDim &times; gridDim = 16 here). This lets a fixed-size grid process any N, and keeps neighbouring threads on neighbouring addresses (coalesced).' },
        { t: 'Store the per-thread sums in shared memory', view: 'cache', code: ['cache[cacheIndex] = temp;', '__syncthreads();'], say: 'Each thread writes its running sum into the block\'s <code>__shared__ float cache[]</code>. <code>__syncthreads()</code> is a barrier for the block: nobody reads before everybody has written.' },
        { t: 'Reduction step 1: stride 4', view: 'tree', stride: 4, code: ['int i = blockDim.x/2;', 'cache[cacheIndex] += cache[cacheIndex + i];'], say: 'Threads 0&ndash;3 each add the value 4 places to their right. Half of the threads become idle. (The code needs <code>threadsPerBlock</code> to be a power of two.)' },
        { t: 'Step 2: stride 2', view: 'tree', stride: 2, code: ['__syncthreads();#2', 'i /= 2;'], say: 'After another <code>__syncthreads()</code> the stride halves. Threads 0 and 1 add their neighbours two places away.' },
        { t: 'Step 3: stride 1', view: 'tree', stride: 1, code: 'while (i != 0){', say: 'In <b>log&#8322;(8) = 3 steps</b> the whole block\'s sum is in <code>cache[0]</code>. A serial loop would need 7 additions one after another.' },
        { t: 'Thread 0 writes the block\'s result', view: 'tree', out: true, outLabel: 'c[blockIdx.x] = cache[0]', code: ['if (cacheIndex == 0)', 'c[blockIdx.x] = cache[0];'], say: 'Only thread 0 writes: one partial sum per block goes to global memory (<code>dev_partial_c</code>).' },
        { t: 'The CPU adds the block results', view: 'blocks', partials: [dotB0, dotB1], final: dotB0 + dotB1, finalLabel: 'host loop: c += partial_c[i]', code: ['c += partial_c[i];', 'cudaMemcpy(partial_c,dev_partial_c, blocksPerGrid*sizeof(float), cudaMemcpyDeviceToHost);'],
          say: 'Only <code>blocksPerGrid</code> numbers are copied back (32 in the real program, 2 here). The CPU finishes the sum with a trivial loop and compares with the analytic result (a closed formula in the source).' }
      ],
      notes: ['This is the standard pattern for reductions on GPUs: <b>per-thread accumulate &rarr; per-block tree in shared memory &rarr; combine blocks</b>.', 'Blocks cannot synchronise with each other inside one kernel, which is why the last step happens on the CPU (or in a second kernel).']
    }, o);
  };

  /* ---------- info.cu ---------- */
  B.info = function (o, v) {
    v = v || {};
    const props = [
      ['name', 'Device 0: (your GPU)'], ['multiprocessors', 'multiProcessorCount: number of SMs'], ['constant memory', 'totalConstMem: 64 KB typical'], ['shared memory / block', 'sharedMemPerBlock: 48 KB typical'],
      ['registers / block', 'regsPerBlock: 65536 typical'], ['warp size', 'warpSize: 32'], ['max threads / block', 'maxThreadsPerBlock: 1024'], ['max threads / SM', 'maxThreadsPerMultiProcessor: 1024-2048'], ['max warps / SM', 'threads per SM / warp size']
    ];
    const sm = {};
    for (let k = 0; k < 8; k++) sm['sm' + k] = { x: 30 + (k % 4) * 80, y: 70 + Math.floor(k / 4) * 70, w: 66, h: 56, label: 'SM', c: k % 4, hidden: false };
    return merge({
      title: 'Querying the GPU', concepts: ['cudaGetDeviceProperties', 'SM (multiprocessor)', 'warp size', 'resource limits'],
      summary: 'Asks the CUDA runtime what the GPU looks like &mdash; number of multiprocessors, memory sizes, warp size and thread limits &mdash; which determine good launch configurations.',
      kind: 'diagram',
      scene: { w: 760, h: 320, groups: [{ x: 10, y: 36, w: 350, h: 170, label: 'GPU (device 0)' }], nodes: merge(sm, { props: { x: 390, y: 14, w: 360, h: 290, label: 'cudaDeviceProp iProp', sub: '', cls: 'gpu' }, big: { x: 30, y: 215, w: 320, h: 90, shape: 'text', label: 'SM = streaming multiprocessor:\nruns blocks, owns registers and shared memory' } }) },
      steps: [
        { t: 'The GPU is made of SMs', pulse: ['sm0', 'sm1', 'sm2', 'sm3', 'sm4', 'sm5', 'sm6', 'sm7'], code: v.dev || 'int iDev = 0;', say: 'A GPU consists of many <b>streaming multiprocessors</b> (SMs). Each runs whole thread blocks and has its own registers and shared memory. Which device to query is chosen by <code>iDev</code>.' },
        { t: 'cudaGetDeviceProperties fills a struct', set: { props: { sub: props[0][1] } }, pulse: ['props'], code: v.get || 'cudaGetDeviceProperties(&iProp, iDev)', say: '<code>cudaGetDeviceProperties</code> fills a <code>cudaDeviceProp</code> structure; the program prints selected fields.' },
        { t: 'How many SMs?', set: { props: { sub: props.slice(0, 2).map(function (p) { return p[1]; }).join('\n') } }, code: 'iProp.multiProcessorCount', say: 'More SMs means more blocks can run at the same time. A launch with fewer blocks than SMs leaves SMs idle.' },
        { t: 'On-chip memory sizes', set: { props: { sub: props.slice(0, 5).map(function (p) { return p[1]; }).join('\n') } }, code: ['iProp.totalConstMem', 'iProp.sharedMemPerBlock', 'iProp.regsPerBlock'], say: 'Constant memory, <b>shared memory per block</b> and <b>registers per block</b> limit how big tiles can be and how many blocks fit on an SM at once (this is what <em>occupancy</em> is about).' },
        { t: 'Warps and thread limits', set: { props: { sub: props.map(function (p) { return p[1]; }).join('\n') } }, code: ['iProp.warpSize', 'iProp.maxThreadsPerBlock', 'iProp.maxThreadsPerMultiProcessor'], say: 'Threads execute in groups of <b>32 (a warp)</b>. A block may have at most 1024 threads, and an SM can hold a fixed maximum of resident threads, so max warps per SM = max threads per SM &divide; 32.' }
      ],
      notes: ['Run the program on your own GPU and note the numbers: they are the budget your kernels must fit in.', 'The HPML version also prints compute capability and total global memory for every device.']
    }, o);
  };

  /* ---------- matMul.cu (serial / OpenMP / GPU / GPU shared) ---------- */
  B.matmul = function (o, v) {
    v = v || {};
    const n = 8;
    return merge({
      title: 'Matrix multiply four ways', concepts: ['serial vs OpenMP vs CUDA', 'one thread per output element', 'shared-memory tiling', 'result verification'],
      summary: 'The same matrix product computed serially, with OpenMP threads, on the GPU with one thread per element, and on the GPU with shared-memory tiles &mdash; each checked against the serial result.',
      kind: 'matmul', scene: { n: n, tile: 4, own: 'none' },
      steps: [
        { t: 'Serial: one core, three nested loops', eq: 'C[i][j] = Σk A[i][k] · B[k][j]', sweep: PDC.MM.rowcol(n, 2, 5), A: { hl: { row: 2 } }, B: { hl: { col: 5 } }, C: { hl: [[2, 5]] }, code: v.serial || 'void matMulSerial(',
          say: 'Every element of C is a dot product of a row of A with a column of B. The serial version loops over all <b>n&sup2; elements</b>, each costing <b>n</b> multiply-adds: O(n&sup3;) work, one element after another.' },
        { t: 'OpenMP: rows are shared among CPU threads', own: 'row', eq: '#pragma omp parallel for  →  each thread takes whole rows', A: {}, B: {}, C: { done: [] }, code: v.omp || ['void matMulOpenMP(', '#pragma omp parallel for'],
          say: 'The outer <code>i</code> loop is split among the CPU cores (here 4 threads, coloured). Each core still does ordinary loops &mdash; a few tens of threads at most. (The PDC Makefile compiles without <code>-fopenmp</code>, so this runs serially there; the HPML Makefile enables it.)' },
        { t: 'GPU: one thread per C element', own: 'tile', eq: 'row = blockIdx.y·blockDim.y + threadIdx.y     col = blockIdx.x·blockDim.x + threadIdx.x', C: { hl: [[5, 2]] }, A: { hl: { row: 5 } }, B: { hl: { col: 2 } }, code: ['__global__ void matMulGPU(', 'int col = blockIdx.x * blockDim.x + threadIdx.x;'],
          say: 'On the GPU every C element gets <b>its own thread</b>. Threads are grouped in 2-D blocks (coloured tiles); each thread computes its <code>row</code> and <code>col</code> from the block and thread ids and loops over <code>k</code>. Thousands of dot products run at once.' },
        { t: 'Naive GPU: every thread re-reads global memory', own: 'tile', sweep: PDC.MM.rowcol(n, 5, 2), A: { hl: { row: 5 } }, B: { hl: { col: 2 } }, C: { hl: [[5, 2]] }, code: 'sum += A[row * width + k] * B[k * width + col];',
          say: 'Each thread reads a whole row of A and a whole column of B from slow <b>global memory</b>. Neighbouring threads read the <em>same</em> rows and columns again and again &mdash; lots of wasted traffic.' },
        { t: 'Shared memory: load a tile once, use it many times', own: 'tile', eq: 'phase t: As = tile of A,  Bs = tile of B  (loaded cooperatively), then 4 multiply-adds from fast shared memory', A: { hl: { rect: [4, 0, 7, 3] } }, B: { hl: { rect: [0, 0, 3, 3] } }, C: { hl: { rect: [4, 0, 7, 3] } }, sh: { A: { label: 'tile of A', hl: [[1, 0], [1, 1], [1, 2], [1, 3]] }, B: { label: 'tile of B', hl: [[0, 2], [1, 2], [2, 2], [3, 2]] } },
          code: ['__shared__ float As[BLOCK_SIZE][BLOCK_SIZE];', 'As[threadIdx.y][threadIdx.x] = A[row * width + tile * BLOCK_SIZE + threadIdx.x];'],
          say: 'In <code>matMulGPUShared</code> a block loads a <b>BLOCK_SIZE &times; BLOCK_SIZE tile</b> of A and of B into <code>__shared__</code> arrays (each thread loads one element of each), then every thread reuses those values BLOCK_SIZE times. Global-memory traffic drops by a factor of BLOCK_SIZE.' },
        { t: 'Barriers keep the tile consistent', own: 'tile', A: { hl: { rect: [4, 4, 7, 7] } }, B: { hl: { rect: [4, 0, 7, 3] } }, C: { hl: { rect: [4, 0, 7, 3] } }, sh: { A: { label: 'next tile of A', hl: [[1, 0], [1, 1], [1, 2], [1, 3]] }, B: { label: 'next tile of B', hl: [[0, 2], [1, 2], [2, 2], [3, 2]] } }, code: ['__syncthreads();', 'for (int k = 0; k < BLOCK_SIZE; k++) {'],
          say: 'One <code>__syncthreads()</code> after loading ensures the tile is complete before anyone uses it; a second one before the next phase ensures nobody overwrites it while others still read. The outer loop walks along the row of tiles (<code>tile = 0 &hellip; width/BLOCK_SIZE-1</code>).' },
        { t: 'Compare every result with the serial one', own: 'tile', C: { done: 'all' }, eq: 'matCompare(serial, openmp) · matCompare(serial, gpu) · matCompare(serial, gpu_shared)', code: v.cmp || ['int matCompare(', 'if (matricesAreEqual1) {'],
          say: 'The program compares each result matrix with the serial one and prints PASS/FAIL, together with the four timings. (Inputs are 2 and 3, so every element of C is an exact multiple &mdash; exact comparison of floats works here.)' }
      ],
      notes: ['The picture uses 8&times;8 matrices and 4&times;4 tiles for clarity; the PDC file uses WIDTH = 32 (one block), the HPML file WIDTH = 1024 (1024 blocks).'].concat(v.notes || []),
      tryit: ['Increase <code>WIDTH</code> and watch how the speed-up of the GPU over the CPU grows.']
    }, o);
  };

  /* ===================== register the PDC examples ===================== */
  const base = { course: 'pdc', topic: 'cuda-basics' };
  PDC.add(B.add(Object.assign({ id: 'add' }, base, { files: [D + 'add.cu'] })));

  PDC.add(B.hello(Object.assign({ id: 'helloworld' }, base, {
    title: 'Hello world from the GPU', files: [D + 'helloworld.cu'], concepts: ['printf in kernels', 'asynchronous launch', 'cudaDeviceSynchronize'],
    summary: 'Ten GPU threads print a greeting; the CPU prints after <code>cudaDeviceSynchronize()</code>. Shows that kernel launches are asynchronous.',
    notes: ['Device <code>printf</code> output is buffered and only flushed at synchronisation points.'], tryit: ['Remove <code>cudaDeviceSynchronize()</code> and run: you may see no GPU output at all.']
  }), { gx: 1, bd: 10, line: function () { return 'From GPU Hello, world!'; }, perBlock: 4,
    code: { launch: 'kernel<<<1,10>>>();', kernel: '__global__ void kernel(void){>>}', sync: 'cudaDeviceSynchronize();', host: 'printf("From CPU Hello, world!\\n");', end: 'return 0;' } }));

  PDC.add(B.hello(Object.assign({ id: 'helloworld-2' }, base, {
    title: 'Block and thread ids', files: [D + 'helloworld-2.cu'], concepts: ['blockIdx', 'threadIdx', 'launch configuration', 'unordered output'],
    summary: 'Five blocks of ten threads each print their own <code>blockIdx.x</code> and <code>threadIdx.x</code>. The order of the 50 lines is not defined.',
    notes: ['Blocks are scheduled independently, so all of block 3 may print before block 0.'], tryit: ['Change to <code>&lt;&lt;&lt;2, 40&gt;&gt;&gt;</code>: threads of one block are grouped into warps of 32, so lines of a warp often appear together.']
  }), { gx: 5, bd: 10, line: function (k, t) { return 'From GPU [block id: ' + k + ', thread id: ' + t + '] Hello, world!'; }, perBlock: 3, order: [3, 0, 4, 1, 2],
    code: { launch: 'kernel<<<5,10>>>();', kernel: 'printf("From GPU [block id: %d, thread id: %d] Hello, world!\\n", blockIdx.x, threadIdx.x);', sync: 'cudaDeviceSynchronize();', host: 'printf("From CPU Hello, world!\\n");' } }));

  const aN = function (n, f) { return Array.from({ length: n }, function (_, i) { return f(i); }); };
  PDC.add(B.vec(Object.assign({ id: 'vecsum-sb', title: 'Vector add: one block, N threads' }, base, {
    files: [D + 'vecsum-sb.cu'], concepts: ['threadIdx.x', 'single block', 'element-per-thread'],
    summary: 'Ten threads in <b>one block</b> add two 10-element vectors. Thread <code>t</code> handles element <code>t</code>.',
    notes: ['A single block is limited to 1024 threads, so this layout cannot handle large vectors.'], tryit: ['Change <code>N</code> to 2000. What error does <code>cudaGetLastError()</code> report?']
  }), { mode: 'tid', gx: 1, bd: 10, N: 10, a: aN(10, function (i) { return -i; }), b: aN(10, function (i) { return i * i; }),
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<1,N>>>', kernel: ['int tid = threadIdx.x;', 'c[tid] = a[tid] + b[tid];'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' } }));

  PDC.add(B.vec(Object.assign({ id: 'vecsum-mb', title: 'Vector add: N blocks, one thread each' }, base, {
    files: [D + 'vecsum-mb.cu'], concepts: ['blockIdx.x', 'many blocks', 'inefficient 1-thread blocks'],
    summary: 'The opposite layout: <code>N</code> blocks with a <b>single thread each</b>. It works, but wastes the GPU, since a warp then has 1 active thread out of 32.',
    notes: ['The GPU runs threads in warps of 32. A block of 1 thread still occupies a whole warp slot, so 31/32 of the lanes are idle.'], tryit: ['Time this against <code>vecsum-mb-mb</code> for N = 10<sup>7</sup>.']
  }), { mode: 'bid', gx: 10, bd: 1, N: 10, a: aN(10, function (i) { return -i; }), b: aN(10, function (i) { return i * i; }), individual: 3,
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<N,1>>>', kernel: ['int bid = blockIdx.x;', 'c[bid] = a[bid] + b[bid];'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' } }));

  PDC.add(B.vec(Object.assign({ id: 'vecsum-mb-mb', title: 'Vector add: many blocks, many threads' }, base, {
    files: [D + 'vecsum-mb-mb.cu'], concepts: ['global thread index', 'ceil(N / threads)', 'bounds check', 'the standard CUDA pattern'],
    summary: 'The general pattern: <code>idx = blockIdx.x * blockDim.x + threadIdx.x</code>, with enough blocks to cover N and an <code>if (idx &lt; n)</code> guard.',
    notes: ['<code>blocks = (N + THREADS_PER_BLOCK - 1) / THREADS_PER_BLOCK</code> is the integer ceiling of N/THREADS_PER_BLOCK.', 'Use multiples of 32 threads per block for best performance (the comment in the source says so).'], tryit: ['Set <code>N = 18</code> and watch the guard stop the extra threads of the last block.']
  }), { mode: 'linear', gx: 4, bd: 4, N: 16, a: aN(16, function (i) { return i; }), b: aN(16, function (i) { return i * i; }),
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<blocks, THREADS_PER_BLOCK>>>', kernel: ['int idx = bid * blockDim.x + tid;', 'if (idx < n) {'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' } }));

  PDC.add(B.vec(Object.assign({ id: 'vecsum-grid', title: 'Vector add with a 2-D grid of blocks' }, base, {
    files: [D + 'vecsum-grid.cu'], concepts: ['dim3', 'gridDim', 'blockIdx.y', 'flattening a 2-D grid'],
    summary: '27 elements are covered by a <b>3 &times; 3 grid</b> of blocks with 3 threads each. The kernel flattens <code>(blockIdx.x, blockIdx.y)</code> into one linear block number first.',
    notes: ['2-D grids are convenient for 2-D data; for 1-D data the kernel must flatten the block coordinates itself.'], tryit: ['Use <code>dim3 numBlocks(9, 1)</code> instead. Does the result change?']
  }), { mode: 'grid2d-yx', gx: 3, gy: 3, bd: 3, N: 27, a: aN(27, function (i) { return i; }), b: aN(27, function (i) { return i * i; }), individual: 2,
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<numBlocks, threadsPerBlock>>>', kernel: ['int blockId = blockIdx.y * blocksPerRow + blockIdx.x;', 'int idx = blockId * blockDim.x + threadIdx.x;'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' },
    say: { rest: 'The remaining blocks run concurrently. Block ids are numbered row by row: block (x, y) has number <code>y &times; gridDim.x + x</code>.' } }));

  PDC.add(B.dot(Object.assign({ id: 'dotproduct' }, base, { files: [D + 'dotproduct.cu'] })));

  /* ---------- dotproductTiming (PDC version): shared vs global memory ---------- */
  PDC.add(Object.assign({ id: 'dotproductTiming' }, base, {
    title: 'Dot product timing: shared vs global memory', files: [D + 'dotproductTiming.cu'], concepts: ['cudaEvent timing', 'shared-memory reduction', 'sequential reduction', 'global memory traffic'],
    summary: 'Two kernels compute the same dot product: <code>dot1</code> reduces in shared memory with a tree, while <code>dot_global</code> + <code>reduce_global</code> store every partial in global memory and let one thread per block add them one by one.',
    kind: 'gantt', scene: { rows: ['dot1: accumulate', 'dot1: tree reduce', 'dot_global: accumulate', 'dot_global: write partials', 'reduce_global: 1 thread / block'], span: 20, labw: 168, unit: 'illustrative time units - the real ratio depends on the GPU' },
    steps: [
      { t: 'Two ways to finish a reduction', code: ['__global__ void dot1(', '__global__ void dot_global('], say: 'Both kernels first accumulate a per-thread sum with the same grid-stride loop. They differ in <em>how the per-thread sums are combined</em>.' },
      { t: 'Kernel 1: tree in shared memory', bars: [{ row: 0, s: 0, d: 6, label: 'grid-stride', c: 0 }, { row: 1, s: 6, d: 2, label: '8 steps', c: 2 }], mark: { t: 8, label: 'dot1 done' }, total: 'dot1: 6 + 2 = 8 units', code: ['__shared__ float cache[threadsPerBlock];', 'cache[cacheIndex] += cache[cacheIndex + i];'],
        say: 'The 256 sums of a block are combined by a <b>tree</b>: 8 parallel steps (log&#8322; 256), all in fast on-chip shared memory.' },
      { t: 'Kernel 2: partials go to global memory', bars: [{ row: 2, s: 9, d: 6, label: 'grid-stride', c: 1 }, { row: 3, s: 15, d: 2, label: 'store', c: 1 }], code: ['partial[index] = temp;', '__global__ void dot_global('], total: 'dot_global so far: 6 + 2 units',
        say: '<code>dot_global</code> writes <b>every thread\'s sum</b> to a global array <code>partial[index]</code>: far more memory traffic than one value per block.' },
      { t: 'Then one thread per block adds them one by one', bars: [{ row: 4, s: 17, d: 3, label: '255 adds in a loop', c: 1 }], mark: { t: 20, label: 'finished' }, total: 'dot_global: 6 + 2 + 3 + 9 (separate launch) ≈ longer', code: ['if (threadIdx.x == 0) {', 'sum += partial[i];'],
        say: 'In <code>reduce_global</code> only <code>threadIdx.x == 0</code> works: it loops over the block\'s 256 values <b>sequentially</b> (255 dependent additions) while 255 threads sit idle, and it needs a second kernel launch.' },
      { t: 'Measured with CUDA events', code: ['cudaEventRecord(start1);', 'cudaEventElapsedTime(&kernel1, start1, stop1);'], say: 'Each variant is timed with <code>cudaEventRecord</code> / <code>cudaEventElapsedTime</code>, which measure time on the GPU itself, not on the CPU. The shared-memory version is expected to be clearly faster.' }
    ],
    notes: ['<b>Heads-up for instructors:</b> in this PDC version <code>dev_partial_c2</code> holds only <code>blocksPerGrid</code> floats, but <code>dot_global</code> writes one float per <em>thread</em> into it, which overruns the buffer. The HPML version (<code>hpml/cuda/src1/dotproductTiming.cu</code>) replaces it with a clean shared-memory vs atomic comparison.']
  }));

  PDC.add(B.info(Object.assign({ id: 'info' }, base, { files: [D + 'info.cu'] })));
  PDC.add(B.matmul(Object.assign({ id: 'matMul' }, base, { files: [D + 'matMul.cu'], title: 'Matrix multiply: serial, OpenMP, GPU, GPU shared' })));
})();
