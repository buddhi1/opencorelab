/* HPML CUDA examples: hpml/cuda/src1 (fundamentals + multi-GPU) and hpml/cuda/src2 (performance pitfalls). */
(function () {
  'use strict';
  const S1 = 'hpml/cuda/src1/', S2 = 'hpml/cuda/src2/';
  const B = PDC.cudaBuilders;
  const f1 = { course: 'hpml', topic: 'cuda-fundamentals' }, f2 = { course: 'hpml', topic: 'cuda-performance' };
  const co = function (v, c) { return { v: v, c: c }; };
  const aN = function (n, f) { return Array.from({ length: n }, function (_, i) { return f(i); }); };
  const rc = PDC.MM.rowcol;

  /* ---------- reused builders ---------- */
  PDC.add(B.add(Object.assign({ id: 'add' }, f1, { files: [S1 + 'add.cu'] })));

  PDC.add(B.hello(Object.assign({ id: 'helloworld' }, f1, {
    title: 'Hello world from the GPU', files: [S1 + 'helloworld.cu'], concepts: ['printf in kernels', 'asynchronous launch', 'cudaDeviceReset'],
    summary: 'Two blocks of ten GPU threads print a greeting. This HPML version ends with <code>cudaDeviceReset()</code> instead of <code>cudaDeviceSynchronize()</code>, which also waits for the GPU and flushes the output.',
    notes: ['<code>cudaDeviceReset()</code> destroys the CUDA context; before it does, it waits for all pending work, so printf output is flushed.', 'Compare with the PDC version, which uses <code>&lt;&lt;&lt;1,10&gt;&gt;&gt;</code> and <code>cudaDeviceSynchronize()</code>.']
  }), { gx: 2, bd: 10, line: function () { return 'From GPU Hello, world!'; }, perBlock: 4, hostLine: '*** From CPU Hello, world! ***',
    syncTitle: 'cudaDeviceReset waits for the GPU', syncText: '<code>cudaDeviceReset()</code> tears down the CUDA context: it first waits for the kernel to finish and flushes its printf buffer',
    syncSay: '<code>cudaDeviceReset()</code> implicitly synchronises with the device (it must finish all work before destroying the context), so every GPU line is flushed before the CPU prints.',
    code: { launch: 'kernel<<<2,10>>>();', kernel: 'printf("From GPU Hello, world!\\n");', sync: 'cudaDeviceReset();', host: 'printf("*** From CPU Hello, world! ***\\n");' } }));

  PDC.add(B.hello(Object.assign({ id: 'helloworld-2' }, f1, {
    title: 'Block and thread ids', files: [S1 + 'helloworld-2.cu'], concepts: ['blockIdx', 'threadIdx', 'launch configuration', 'cudaDeviceReset'],
    summary: 'Three blocks of eight threads print their own <code>blockIdx.x</code> and <code>threadIdx.x</code> (24 lines, in an undefined order).',
    notes: ['Compare with the PDC version (5 blocks of 10): same idea, different grid.']
  }), { gx: 3, bd: 8, line: function (k, t) { return 'From GPU [block id: ' + k + ', thread id: ' + t + '] Hello, world!'; }, perBlock: 3, order: [2, 0, 1],
    syncTitle: 'cudaDeviceReset waits for the GPU', syncText: '<code>cudaDeviceReset()</code> waits for the kernel and flushes the printf buffer',
    code: { launch: 'kernel<<<3,8>>>();', kernel: 'printf("From GPU [block id: %d, thread id: %d] Hello, world!\\n", blockIdx.x, threadIdx.x);', sync: 'cudaDeviceReset();', host: 'printf("From CPU Hello, world!\\n");' } }));

  const vecBase = { concepts: [] };
  PDC.add(B.vec(Object.assign({ id: 'vecsum-sb', title: 'Vector add: one block, N threads' }, f1, {
    files: [S1 + 'vecsum-sb.cu'], concepts: ['threadIdx.x', 'single block'], summary: 'Ten threads in <b>one block</b> add two 10-element vectors; thread <code>t</code> handles element <code>t</code>.',
    notes: ['Same program as the PDC version, written with <code>-O3</code> and compact style.']
  }), { mode: 'tid', gx: 1, bd: 10, N: 10, a: aN(10, function (i) { return -i; }), b: aN(10, function (i) { return i * i; }),
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<1,N>>>', kernel: ['int tid = threadIdx.x;', 'c[tid] = a[tid] + b[tid];'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' } }));
  PDC.add(B.vec(Object.assign({ id: 'vecsum-mb', title: 'Vector add: N blocks, one thread each' }, f1, {
    files: [S1 + 'vecsum-mb.cu'], concepts: ['blockIdx.x', 'inefficient 1-thread blocks'], summary: '<code>N</code> blocks with a <b>single thread each</b>: it works but wastes 31 of 32 lanes of every warp.',
    notes: ['A block of one thread still occupies a full warp slot.']
  }), { mode: 'bid', gx: 10, bd: 1, N: 10, a: aN(10, function (i) { return -i; }), b: aN(10, function (i) { return i * i; }), individual: 3,
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<N,1>>>', kernel: ['int bid = blockIdx.x;', 'c[bid] = a[bid] + b[bid];'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' } }));
  const mbA = aN(9, function (k) { return -(k % 3); }), mbB = aN(9, function (k) { return (k % 3) * (k % 3); });
  PDC.add(B.vec(Object.assign({ id: 'vecsum-mb-mb', title: 'Vector add: 3 blocks of 3 threads' }, f1, {
    files: [S1 + 'vecsum-mb-mb.cu'], concepts: ['global thread index', 'blockDim.x', 'many blocks and threads'],
    summary: 'The general pattern at small scale: <code>index = blockIdx.x * blockDim.x + threadIdx.x</code> with 3 blocks of 3 threads covering N = 9 elements.',
    notes: ['The source checks <code>if(tid &lt; N)</code> (the thread id within the block) rather than <code>index &lt; N</code>. It works here because N equals the number of threads, but the idiomatic guard is on the <em>global</em> index.']
  }), { mode: 'linear', gx: 3, bd: 3, N: 9, a: mbA, b: mbB, individual: 2,
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<N/THREADS_PER_BLOCK, THREADS_PER_BLOCK>>>', kernel: ['int index = bid*blockDim.x+tid;', 'c[index] = a[index] + b[index];'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' } }));
  const gA = aN(27, function (k) { return -(k % 3); }), gB = aN(27, function (k) { return (k % 3) * (k % 3); });
  PDC.add(B.vec(Object.assign({ id: 'vecsum-grid', title: 'Vector add with a 2-D grid (N&times;N blocks)' }, f1, {
    files: [S1 + 'vecsum-grid.cu'], concepts: ['dim3 gridDIM(N, N, 1)', 'gridDim.y', 'flattening a 2-D grid'],
    summary: 'A <b>3 &times; 3 grid</b> of blocks with 3 threads each covers 27 elements; the kernel combines <code>blockIdx.x</code>, <code>blockIdx.y</code> and <code>threadIdx.x</code> into one index.',
    notes: ['This version flattens with <code>bidx*blockDim.x*gridDim.y + bidy*blockDim.x + tid</code> (x-major); the PDC version uses a y-major flattening. Both cover every element exactly once.']
  }), { mode: 'grid2d-xy', gx: 3, gy: 3, bd: 3, N: 27, a: gA, b: gB, individual: 2,
    code: { alloc: 'cudaMalloc(', h2d: 'cudaMemcpyHostToDevice', launch: 'add<<<gridDIM,N>>>', kernel: ['int index = bidx*blockDim.x*gridDim.y + bidy*blockDim.x + tid;', 'c[index] = a[index] + b[index];'], d2h: 'cudaMemcpyDeviceToHost', free: 'cudaFree(' },
    say: { rest: 'The other blocks run concurrently. Here block numbers vary fastest along <code>y</code>: <code>index = bx&middot;(blockDim.x&middot;gridDim.y) + by&middot;blockDim.x + tid</code>.' } }));

  PDC.add(B.dot(Object.assign({ id: 'dotproduct' }, f1, { files: [S1 + 'dotproduct.cu'], summary: 'Each block computes one partial dot product (grid-stride loop + shared-memory tree); the CPU adds the partials and this version checks them against a plain CPU <code>dot_product()</code> function.' })));
  PDC.add(B.info(Object.assign({ id: 'info' }, f2, { files: [S2 + 'info.cu'], summary: 'Prints compute capability, memory sizes, warp size and thread limits for <b>every</b> GPU. Run it first on a new machine: these numbers set the limits for every later experiment.' }),
    { dev: 'for (int iDev = 0; iDev < deviceCount; iDev++) {', get: 'cudaGetDeviceProperties(&iProp, iDev)' }));

  PDC.add(B.matmul(Object.assign({ id: 'matMul' }, f1, { files: [S1 + 'matMul.cu'], title: 'Matrix multiply: serial, OpenMP, GPU, GPU shared (1024 &times; 1024)' }),
    { cmp: ['int matCompare(', 'int pass_omp = matCompare(h_C_Serial, h_C_OMP, WIDTH);'],
      notes: ['<b>HPML improvements over the PDC version:</b> the matrices are 1024&times;1024; CPU runs are timed with <code>omp_get_wtime()</code> (wall clock) and GPU kernels with CUDA events; the Makefile uses <code>-O3 -Xcompiler -fopenmp</code>, so the OpenMP version really runs in parallel (<code>OMP_NUM_THREADS=8 ./matMul</code>).'] }));

  /* ---------- dotproductTiming (HPML): shared reduction vs atomics ---------- */
  PDC.add(Object.assign({ id: 'dotproductTiming' }, f1, {
    title: 'Dot product: shared-memory tree vs atomicAdd', files: [S1 + 'dotproductTiming.cu'], concepts: ['atomicAdd', 'contention', 'shared-memory reduction', 'cudaEvent timing', 'cudaMemset'],
    summary: 'Both kernels sum per-thread partial results of a dot product. <code>dot_shared</code> combines them with a tree in shared memory; <code>dot_no_shared</code> lets every thread <code>atomicAdd</code> into the same address.',
    kind: 'reduce', scene: { T: 8, values: [2, 2, 2, 2, 2, 2, 2, 2], name: 'cache' },
    steps: [
      { t: 'Same first phase: private partial sums', view: 'cache', code: ['float temp = 0;', 'temp += a[tid] * b[tid];', 'tid += blockDim.x * gridDim.x;'], say: 'Both kernels begin identically: each thread walks the vectors with a grid-stride loop and accumulates in a register. (a = b = 1 here, so a thread with 2 elements holds 2.) They differ in the <em>combine</em> phase. (8 threads drawn instead of 256.)' },
      { t: 'Kernel 1: tree in shared memory', view: 'tree', stride: 4, code: ['__shared__ float cache[threadsPerBlock];', 'cache[cacheIndex] += cache[cacheIndex + i];'], say: '<code>dot_shared</code> stores the partials in <code>__shared__</code> memory and halves the active threads each step. Strides 4, 2, 1: <b>log&#8322;(threads)</b> steps, no contention.' },
      { t: 'Strides 2 and 1', view: 'tree', stride: 2, code: '__syncthreads();#2', say: 'Each step is separated by <code>__syncthreads()</code>.' },
      { t: 'One result per block', view: 'tree', stride: 1, out: true, outLabel: 'c[blockIdx.x] = cache[0]', code: 'c[blockIdx.x] = cache[0];', say: 'Thread 0 writes the block total. One plain store per block.' },
      { t: 'Kernel 2: everyone adds atomically', view: 'atomic', done: 0, code: ['__global__ void dot_no_shared(float* a, float* b, float* c) {', 'atomicAdd(&c[blockIdx.x], temp);'], say: '<code>dot_no_shared</code> uses no shared memory. Every thread does <code>atomicAdd(&amp;c[blockIdx.x], temp)</code> on the <b>same address</b>. The hardware guarantees correctness but must <b>serialise</b> the updates.' },
      { t: 'The updates queue up', view: 'atomic', done: 3, code: 'atomicAdd(&c[blockIdx.x], temp);', say: 'While one thread\'s read-modify-write is in flight, the others wait: 256 threads per block = 256 serialised updates (the cost grows linearly with contending threads).' },
      { t: 'Correct, but slower', view: 'atomic', done: 8, code: 'cudaMemset(dev_partial_c, 0, blocksPerGrid * sizeof(float));', say: 'The result is the same. Note <code>cudaMemset</code> before kernel 2: atomics <em>accumulate</em>, so the output must start at 0. (Floating-point addition order differs between the kernels, so the last digits can too.)' },
      { t: 'Timing both', view: 'cache', code: ['printf("Kernel1 (Shared Memory) Time: %.4f ms | Result: %.2f\\n", milliseconds, c);', 'printf("Kernel2 (No Shared Mem) Time: %.4f ms | Result: %.2f\\n", milliseconds, c);'], say: 'Each kernel is timed with CUDA events. Expect the shared-memory tree to win clearly; the exact ratio depends on the GPU (modern GPUs have fast atomics, so the gap can be smaller than you expect &mdash; measure!).' }
    ],
    notes: ['With <code>a[i] = b[i] = 1</code> the correct answer is exactly <code>N</code> (printed as "Expected Result").', 'Modern architectures improve atomics with L2 hardware support, but a tree reduction still wins when many threads hit one address.']
  }));

  /* ---------- matMulMultiGPU: OpenMP, one CPU thread per GPU ---------- */
  PDC.add(Object.assign({ id: 'matMulMultiGPU' }, f1, {
    title: 'Multi-GPU matrix multiply (one OpenMP thread per GPU)', files: [S1 + 'matMulMultiGPU.cu'], concepts: ['row-band decomposition', 'omp parallel num_threads(deviceCount)', 'cudaSetDevice', 'replicating B', 'cudaMemcpyAsync'],
    summary: 'C = A&middot;B is split by <b>rows</b>: each GPU gets a band of A, a full copy of B, and produces the matching band of C. One OpenMP thread drives each GPU.',
    kind: 'matmul', scene: { n: 8, tile: 4, own: 'gpu', G: 2 },
    steps: [
      { t: 'Baselines first', own: 'none', eq: 'serial CPU  ·  single GPU (device 0)  →  both are timed and used to verify the multi-GPU result', C: {}, code: ['if (deviceCount < 2) {', 'matMulSerial(h_A, h_B, h_C_Serial, WIDTH);', '// PART 1: SINGLE GPU BASELINE'], say: 'The program needs at least 2 GPUs. It first computes a serial CPU result and a single-GPU result (device 0), so it can check correctness and report the speed-up.' },
      { t: 'Decompose by rows', own: 'gpu', eq: 'rowsPerGPU = WIDTH / deviceCount;   rowOffset = devId * rowsPerGPU', A: { hl: { rows: [0, 3] } }, B: {}, C: { hl: { rows: [0, 3] } }, code: ['int rowsPerGPU = WIDTH / deviceCount;', 'int rowOffset  = devId * rowsPerGPU;'],
        say: 'With 2 GPUs, GPU 0 computes rows 0&ndash;3 of C (needing rows 0&ndash;3 of A) and GPU 1 computes rows 4&ndash;7. The last GPU also takes any remainder rows (<code>rowsPerGPU = WIDTH - rowOffset</code>). Different bands of C are <b>independent</b>, so no communication between GPUs is needed.' },
      { t: 'B must be replicated on every GPU', own: 'gpu', eq: 'GPU g needs ALL of B (every C element reads a whole column of B)', A: { hl: { rows: [4, 7] } }, B: { hl: ALLCELLS() }, C: { hl: { rows: [4, 7] } }, code: ['size_t sizeB_full  = WIDTH * WIDTH * sizeof(float);', 'cudaMalloc(&d_B_local, sizeB_full);'],
        say: 'Each output element needs a full column of B, so <b>all of B</b> is copied to <em>each</em> GPU, while A and C are only chunked. Memory traffic for B grows with the number of GPUs: this is the price of this simple decomposition.' },
      { t: 'One CPU thread per GPU', own: 'gpu', eq: '#pragma omp parallel num_threads(deviceCount)   →   devId = omp_get_thread_num(); cudaSetDevice(devId);', A: {}, B: {}, C: {}, code: ['#pragma omp parallel num_threads(deviceCount)', 'int devId = omp_get_thread_num();', 'cudaSetDevice(devId);'],
        say: 'OpenMP creates one CPU thread per GPU. Each calls <code>cudaSetDevice(devId)</code>: CUDA\'s current device is <b>per CPU thread</b>, so the threads can talk to different GPUs independently.' },
      { t: 'Each thread: copy in, compute, copy out', own: 'gpu', eq: 'cudaMemcpyAsync(A chunk, B)  →  matMulGPUShared<<<>>>  →  cudaMemcpyAsync(C chunk)', A: { hl: { rows: [0, 3] } }, B: { hl: ALLCELLS() }, C: { hl: { rows: [0, 3] } }, code: ['cudaMemcpyAsync(d_A_local, h_A + (rowOffset * WIDTH), sizeA_chunk, cudaMemcpyHostToDevice);', 'matMulGPUShared<<<dimGridMulti, dimBlock>>>(d_A_local, d_B_local, d_C_local, WIDTH, rowsPerGPU);', 'cudaMemcpyAsync(h_C_Multi + (rowOffset * WIDTH), d_C_local, sizeC_chunk, cudaMemcpyDeviceToHost);'],
        say: 'Each thread allocates its buffers, copies its band of A and all of B, launches the <b>same tiled shared-memory kernel</b> (with a <code>height</code> argument = rows in its band), and copies its band of C back into the right place of the host matrix. The host buffers are pinned so the copies are truly asynchronous.' },
      { t: 'Wait, then join', own: 'gpu', C: { done: 'all' }, eq: 'cudaDeviceSynchronize() per thread;  the end of the parallel region is a barrier', A: {}, B: {}, code: ['cudaDeviceSynchronize();', '} // End Parallel Region - An implicit barrier here waits for all CPU threads to finish'],
        say: 'Each thread synchronises its own GPU. The implicit barrier at the end of the OpenMP region guarantees <b>all GPUs are done</b> before the stop event is recorded.' },
      { t: 'Fair timing: warm up the GPUs', own: 'gpu', C: { done: 'all' }, eq: 'cudaFree(0) forces context creation before the clock starts', A: {}, B: {}, code: ['cudaFree(0);', 'cudaEventRecord(start_multi);'], say: 'CUDA creates a context lazily on the first call. <code>cudaFree(0)</code> is a dummy call that forces it, so context-creation time is not counted in the multi-GPU timing (the streams version <em>does</em> include it, which is why the two programs report different times).' },
      { t: 'Compare and verify', own: 'gpu', C: { done: 'all' }, eq: 'Serial CPU  vs  Single GPU  vs  Multi-GPU', A: {}, B: {}, code: ['printf("Multi-GPU Time:  %.2f ms\\n", multi_gpu_ms);', 'int pass_multi = matCompare(h_C_Serial, h_C_Multi, WIDTH);'], say: 'The program prints the three times and checks both GPU results against the serial one. For small matrices the copies and launches dominate and multi-GPU can even be <em>slower</em>; the benefit appears at larger sizes.' }
    ],
    notes: ['Domain decomposition by rows is the simplest scheme; 2-D (SUMMA-style) decompositions reduce the data each GPU must hold but need more communication logic.'],
    tryit: ['Raise <code>WIDTH</code> to 4096 and see when multi-GPU starts to beat a single GPU.']
  }));
  function ALLCELLS() { return 'all'; }

  /* ---------- matMulStreams: one thread, many streams ---------- */
  PDC.add(Object.assign({ id: 'matMulStreams' }, f1, {
    title: 'Multi-GPU matrix multiply with CUDA streams', files: [S1 + 'matMulStreams.cu'], concepts: ['one stream per GPU', 'single CPU thread', 'asynchronous issue', 'cudaStreamSynchronize'],
    summary: 'The same row-band decomposition, but <b>one CPU thread</b> queues asynchronous work on every GPU through per-GPU streams and then waits for them all.',
    kind: 'gantt', scene: { rows: ['CPU (one thread)', 'GPU 0 stream', 'GPU 1 stream'], span: 14, labw: 140, unit: 'illustrative time units' },
    steps: [
      { t: 'Create a stream on each device', bars: [{ row: 0, s: 0, d: 1, label: 'streams', c: 0 }], code: ['cudaSetDevice(devId);', 'cudaStreamCreate(&streams[devId]);'], say: 'A single thread loops over the devices, selecting each with <code>cudaSetDevice</code> and creating a stream on it.' },
      { t: 'Queue the work on GPU 0', bars: [{ row: 0, s: 1, d: 1, label: 'issue GPU 0', c: 1 }, { row: 1, s: 2, d: 2, label: 'copy in', c: 1 }, { row: 1, s: 4, d: 5, label: 'matMulGPUShared', c: 1 }, { row: 1, s: 9, d: 1.5, label: 'copy out', c: 1 }], code: ['cudaMemcpyAsync(d_A_local[devId], h_A + (rowOffset * WIDTH), sizeA_chunk, cudaMemcpyHostToDevice, streams[devId]);', 'matMulGPUShared<<<dimGridMulti, dimBlock, 0, streams[devId]>>>('],
        say: 'For GPU 0 the thread issues an async upload, the kernel launch and an async download, all tagged with <code>streams[devId]</code>. These calls return almost immediately; the GPU does the work later, in order.' },
      { t: 'Immediately queue GPU 1', bars: [{ row: 0, s: 2, d: 1, label: 'issue GPU 1', c: 2 }, { row: 1 + 1, s: 3, d: 2, label: 'copy in', c: 2 }, { row: 2, s: 5, d: 5, label: 'matMulGPUShared', c: 2 }, { row: 2, s: 10, d: 1.5, label: 'copy out', c: 2 }], code: 'for (int devId = 0; devId < deviceCount; devId++) {', say: 'The CPU does not wait for GPU 0: it moves on and queues GPU 1\'s work. Now <b>both GPUs are busy at the same time</b> although only one CPU thread exists.' },
      { t: 'Wait for each stream, then clean up', bars: [{ row: 0, s: 3, d: 8.5, label: 'cudaStreamSynchronize (each GPU in turn)', cls: 'c7' }], mark: { t: 11.5, label: 'all done' }, code: ['cudaStreamSynchronize(streams[devId]);', 'cudaStreamDestroy(streams[devId]);'], say: 'A second loop blocks on each GPU\'s stream and then frees its resources. Total time ≈ the slower GPU, not the sum.' },
      { t: 'Streams vs the OpenMP version', total: 'streams: 1 CPU thread, async calls     OpenMP: N CPU threads, simpler per-GPU code', code: ['We use OpenMP to launch parallel GPU threads', 'Async memory copyin is not must here since CPU threads take care of the parallelism'], say: 'The file header comment describes the OpenMP approach (and the two header comments in the pair of files are swapped). Rule of thumb: <b>streams</b> need asynchronous calls and pinned memory but only one CPU thread; <b>OpenMP threads</b> allow ordinary blocking calls per GPU and help when the CPU has heavy host-side work per GPU.' }
    ],
    notes: ['Both programs use the same kernel and the same decomposition; the difference is only <em>how work is issued</em> to the GPUs.', 'Pinned host memory (<code>cudaMallocHost</code>) is required for the async copies to overlap.']
  }));

  /* ===================== src2: performance pitfalls ===================== */
  PDC.add(Object.assign({ id: 'warp' }, f2, {
    title: 'Warp divergence', files: [S2 + 'warp.cu'], concepts: ['SIMT', 'warp', 'branch divergence', 'active mask', 'ncu WarpStateStats'],
    summary: 'In <code>divergentKernel</code> odd and even threads of a warp take different branches; in <code>sortedKernel</code> whole warps take the same branch. The GPU executes both paths of a divergent branch one after the other.',
    kind: 'mem', scene: { mode: 'diverge' },
    steps: [
      { t: 'A warp executes one instruction at a time', pattern: 'evenodd', pass: -1, code: ['__global__ void divergentKernel(float *out) {', 'if (idx % 2 == 0) {'], note: 'Even lanes (blue) want path A, odd lanes (orange) want path B.',
        say: 'The 32 threads of a <b>warp</b> share one instruction pointer: they execute the <em>same</em> instruction together (SIMT). In <code>divergentKernel</code> the branch condition <code>idx % 2 == 0</code> splits every warp into two halves.' },
      { t: 'Pass 1: even lanes work, odd lanes wait', pattern: 'evenodd', pass: 0, code: 'val = heavyMath(2.0f);', note: '16 of 32 lanes are active; the other 16 are masked off.', say: 'The warp first runs the <code>if</code> branch for the even lanes while the odd lanes are <b>masked off</b> (idle).' },
      { t: 'Pass 2: odd lanes work, even lanes wait', pattern: 'evenodd', pass: 1, code: 'val = heavyMath(3.0f);', note: 'The warp needs two passes, so the compute-bound loop takes about twice as long.', say: 'Then it runs the <code>else</code> branch for the odd lanes. The two paths are <b>serialised</b>: total time ≈ pass 1 + pass 2.' },
      { t: 'sortedKernel: branch on the warp id', pattern: 'warp', pass: 0, code: ['int warpId = threadIdx.x / 32;', 'if (warpId % 2 == 0) {'], note: 'Whole warps take the same branch: no lane is masked off, no serialisation.', say: 'If the branch condition is <b>the same for all 32 lanes of a warp</b> (here based on <code>warpId</code>), the warp executes only one path. Different warps may go different ways without penalty. The result of the computation per thread is identical to the divergent version.' },
      { t: 'What the profiler says', pattern: 'evenodd', pass: -1, note: 'ncu --section WarpStateStats:  divergentKernel: Avg. Active Threads Per Warp = <b>16</b>   sortedKernel: <b>32</b>', code: ['Avg. Active Threads Per Warp', 'divergentKernel(): 16', 'sortedKernel(): 32 (perfect number)'], say: 'The recorded Nsight Compute output in the source shows <b>16</b> average active threads per warp for the divergent kernel and the perfect <b>32</b> for the sorted one. That is the metric to look for.' },
      { t: 'How to avoid divergence', pattern: 'warp', pass: 0, code: ['__device__ float heavyMath(float x) {', 'volatile float v = x;'], say: 'Restructure so that threads in a warp take the same branch: sort or group data, use warp-aligned conditions, or replace branches with arithmetic. <code>heavyMath</code> is a long compute-bound loop (kept alive by <code>volatile</code>) so the branch cost dominates the runtime.' }
    ],
    notes: ['Divergence only costs when branches have substantial work; a short <code>if</code> is just predicated.', 'Run: <code>ncu --section WarpStateStats ./warp</code>.']
  }));

  PDC.add(Object.assign({ id: 'mem' }, f2, {
    title: 'Memory coalescing: stride 1 vs stride 32', files: [S2 + 'mem.cu'], concepts: ['global memory coalescing', 'sectors per request', 'strided access', 'ncu memory metrics'],
    summary: '<code>coalescedKernel</code> reads <code>input[idx]</code>; <code>stridedKernel</code> reads <code>input[idx * 32]</code>, so the 32 threads of a warp touch 32 different 128-byte lines instead of one.',
    kind: 'mem', scene: { mode: 'coalesce' },
    steps: [
      { t: 'One warp, one load instruction', stride: 1, code: ['__global__ void coalescedKernel(int *input, int *output, int n) {', 'output[idx] = input[idx];'], say: 'When a warp executes <code>input[idx]</code>, lane <i>i</i> reads word <i>i</i>. The 32 consecutive 4-byte words fall into <b>one 128-byte cache line</b> (4 sectors of 32 B): the hardware serves the warp with a single wide transaction. This is <b>coalescing</b>.' },
      { t: 'Stride 2', stride: 2, code: 'output[idx] = input[idx];', say: 'With stride 2 the same 32 loads spread over 2 cache lines: half of every fetched line is wasted.' },
      { t: 'Stride 32: every lane hits its own line', stride: 32, code: ['#define STRIDE 32', 'output[idx] = input[idx * STRIDE];'], say: 'In <code>stridedKernel</code> lane <i>i</i> reads word <code>32&middot;i</code>: addresses <b>128 bytes apart</b>. Each of the 32 lanes touches a <em>different</em> cache line, so one load needs <b>32 memory transactions</b> instead of 1, and 124 of every 128 fetched bytes are unused.' },
      { t: 'The recorded profile', stride: 32, note: 'l1tex__average_t_sectors_per_request: <b>4</b> (coalesced) vs <b>32</b> (strided)', code: ['l1tex__average_t_sectors_per_request_pipe_lsu_mem_global_op_ld', 'in coalescedKernel() - 4', 'in stridedKernel() - 32'], say: 'The Nsight Compute metric in the source: 4 sectors per request for the coalesced kernel, 32 for the strided one. Note the timings recorded <em>under the profiler</em> (about 206 ms vs 205 ms) are almost equal because profiling serialises and slows both kernels; the sector count is the reliable evidence.' },
      { t: 'Measure without the profiler', stride: 1, code: ['measureExecutionTime(coalescedKernel, d_in, d_out, N_THREADS, "Coalesced (Stride 1)");', 'double bandwidth = (2.0 * 4.0 * n) / (time * 1e6);'], say: '<code>measureExecutionTime</code> times each kernel with CUDA events and prints the <b>effective bandwidth</b> (useful bytes / time). Run <code>./mem</code> directly (not under <code>ncu</code>) to see the strided kernel\'s bandwidth collapse.' }
    ],
    notes: ['The strided kernel needs a 32&times; larger input array, which is why the program allocates <code>N_THREADS * STRIDE</code> elements.', 'Run: <code>ncu --metrics l1tex__average_t_sectors_per_request_pipe_lsu_mem_global_op_ld ./mem</code>.']
  }));

  PDC.add(Object.assign({ id: 'bankconf' }, f2, {
    title: 'Shared-memory bank conflicts', files: [S2 + 'bankconf.cu'], concepts: ['32 banks', 'bank conflict', 'serialised accesses', 'ncu bank-conflict metric'],
    summary: 'Shared memory has 32 banks. <code>noBankConflictKernel</code> lets thread <i>t</i> read word <i>t</i>; <code>bankConflictKernel</code> reads word <code>t&middot;32</code>, so the whole warp hits bank 0.',
    kind: 'mem', scene: { mode: 'banks' },
    steps: [
      { t: 'Shared memory is split into 32 banks', stride: 1, pass: -1, code: ['__shared__ volatile int sharedMem[SHMEM_SIZE];', '#define SHMEM_SIZE 1024'], say: 'Consecutive 4-byte words of shared memory live in consecutive <b>banks</b>: word <i>w</i> is in bank <code>w mod 32</code>. All 32 banks can be read in <b>one cycle</b>, but only if each bank is asked for at most one address.' },
      { t: 'No conflict: thread t reads word t', stride: 1, pass: 0, code: ['int index = tid;', 'val += sharedMem[index];'], say: 'In <code>noBankConflictKernel</code> the 32 lanes read 32 consecutive words &rarr; 32 different banks &rarr; <b>one pass</b>. Recorded Nsight Compute value: <code>0</code> bank conflicts.' },
      { t: 'Stride 32: all lanes hit bank 0', stride: 32, pass: -1, code: 'int index = (tid * 32) % SHMEM_SIZE;', say: 'In <code>bankConflictKernel</code> lane <i>t</i> reads word <code>(t&middot;32) mod 1024</code>. Every multiple of 32 maps to <b>bank 0</b>, so all 32 lanes want <em>different words in the same bank</em>: a <b>32-way bank conflict</b>.' },
      { t: 'The hardware serialises the 32 accesses', stride: 32, pass: 3, code: 'val += sharedMem[index];', note: 'The queue in bank 0 is served one lane per pass: the load needs 32 passes instead of 1.', say: 'The bank can serve only one address per cycle, so the warp\'s load is replayed <b>32 times</b>. Here pass 4 of 32 is shown.' },
      { t: 'Padding fixes the conflict', stride: 33, pass: 0, code: ['// 32 banks * 32 stride = SHMEM_SIZE ints ensures enough space for stride tricks', '// Bank index = (Address) % 32.'], say: 'A common fix is to <b>pad</b> the array so the stride is 33: addresses <code>33&middot;t mod 32 = t</code> cover all banks again (a stride that is odd, and in particular coprime to 32, is conflict-free). Matrix-transpose kernels use <code>tile[32][33]</code> for exactly this reason.' },
      { t: 'The recorded profile', stride: 32, pass: -1, code: ['l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum', '968,936,000 bank conflicts'], note: 'ncu: no-conflict kernel = <b>0</b> conflicts; conflict kernel = <b>968,936,000</b> conflicts (config: N = 10<sup>6</sup>, 256 threads, 1000 iterations).', say: 'The recorded numbers show 0 versus 968,936,000 conflicts. The measured run times (about 139 ms vs 163 ms on that GPU) differ by much less than 32&times;: the loop has other costs, and these numbers were recorded on a compute-capability 7.5 GPU while profiling.' }
    ],
    notes: ['Run: <code>ncu --metrics l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum ./bankconf</code>.', 'All lanes reading the <em>same</em> address in a bank is a <b>broadcast</b> and is not a conflict.']
  }));
})();
