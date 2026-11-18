/* CUDA matrix-multiply progression (pdc/cuda/src1.5): one block -> many blocks -> shared memory -> register tiling. */
(function () {
  'use strict';
  const D = 'pdc/cuda/src1.5/';
  const base = { course: 'pdc', topic: 'cuda-matmul' };
  const MM = PDC.MM;
  const rc = MM.rowcol;
  const ALL = 'all';

  /* ---------- one block, one thread per element ---------- */
  function oneBlockSteps(code) {
    const n = 4;
    return [
      { t: 'One block holds the whole matrix', own: 'none', eq: 'dim3 dimBlock(n, n);   dim3 dimGrid(1, 1);', C: { hl: ALL }, code: code.launch,
        say: 'The picture uses n = 4: <b>one block of 4 &times; 4 = 16 threads</b>, one thread for every element of C. (The real program allows n up to 32 because a block may hold at most 1024 threads.)' },
      { t: 'A thread finds its row and column', eq: 'col = threadIdx.x = 1      row = threadIdx.y = 2      →  C[2][1]', A: { hl: { row: 2 } }, B: { hl: { col: 1 } }, C: { hl: [[2, 1]] }, code: code.idx,
        say: 'CUDA puts <code>x</code> along the <b>column</b> and <code>y</code> along the <b>row</b> (see the comment in the source). Thread (y=2, x=1) therefore owns <code>C[2][1]</code>.' },
      { t: 'It computes one dot product', eq: '', sweep: rc(n, 2, 1), A: {}, B: {}, C: { hl: [[2, 1]] }, code: code.dot,
        say: 'The thread loops over <code>k</code>: it reads <code>A[row][k]</code> and <code>B[k][col]</code> and accumulates in a register. The 2-D index is <b>flattened</b> by hand: <code>A[row * n + k]</code>, because <code>cudaMalloc</code> gives a plain 1-D block of memory.' },
      { t: 'All 16 threads do this at once', C: { done: ALL }, eq: 'every C[row][col] is written by exactly one thread', code: code.store,
        say: 'The other 15 threads do the same for their own element, all at the same time, with no communication. Each writes <code>C[row*n+col] = sum</code>.' },
      { t: 'The limit: n&sup2; &le; 1024', C: { done: ALL }, eq: 'n = 32 → 1024 threads OK     n = 33 → 1089 > 1024: refused', code: code.limit,
        say: 'A block can contain at most <b>1024 threads</b>, so this layout stops at n = 32. The program checks this and tells you to use multiple blocks (next examples).' },
      { t: 'Copy back and verify', C: { done: ALL }, eq: 'C[0][0] = n  (A and B are all ones)', code: code.verify, say: 'A and B are filled with 1.0, so every element of C must equal <code>n</code>. The program checks all elements and prints PASS or FAIL.' }
    ];
  }
  const oneCode = { launch: ['dim3 dimBlock(n, n);', 'dim3 dimGrid(1, 1);'], idx: ['int col = threadIdx.x;', 'int row = threadIdx.y;'], dot: 'sum += A[row * n + k] * B[k * n + col];', store: 'C[row * n + col] = sum;',
    limit: 'if ((long long)n * n > 1024) {', verify: 'printf("Verification: %s\\n", errors == 0 ? "PASS" : "FAIL");' };
  const oneBlock = PDC.add(Object.assign({ id: 'MatMul_OneBlock' }, base, {
    title: 'One block: a thread per element', files: [D + 'MatMul_OneBlock.cu'], concepts: ['threadIdx.x / .y', '2-D thread block', 'row-major flattening', '1024-thread limit'],
    summary: 'The first matrix multiply: a <b>single</b> n&times;n block, one thread per element of C. Simple, but limited to n &le; 32.',
    kind: 'matmul', scene: { n: 4, own: 'none' }, steps: oneBlockSteps(oneCode),
    notes: ['This is the "thread block limit" slide of the course: a block is the unit that can share memory and synchronise, and it is limited in size.'], tryit: ['Run <code>./MatMul_OneBlock 32</code> and <code>./MatMul_OneBlock 33</code> and read the message.']
  }));
  PDC.add(Object.assign({}, oneBlock, { id: 'MatMul', title: 'MatMul.cu (introductory version)', files: [D + 'MatMul.cu', D + 'README.txt', D + 'run_examples.sh'],
    summary: 'Identical to <code>MatMul_OneBlock.cu</code>, with extra comments explaining row-major indexing. It exists so the compile command on the introductory slide works.',
    notes: ['Compare with <code>MatMul_OneBlock.cu</code>: only the comments on the <code>A[row * n + k]</code> line differ (C notation <code>A[row][k]</code> vs the flat CUDA form).'] }));

  /* ---------- timed one-block: CUDA events ---------- */
  PDC.add(Object.assign({ id: 'MatMul_OneBlock_Timed' }, base, {
    title: 'Timing a kernel with CUDA events', files: [D + 'MatMul_OneBlock_Timed.cu'], concepts: ['cudaEvent_t', 'warm-up launch', 'asynchronous launch', 'kernel-only timing'],
    summary: 'The one-block kernel again, now with a <b>warm-up launch</b> and CUDA events around the real launch, so the printed time covers the kernel only.',
    kind: 'gantt', scene: { rows: ['CPU (host)', 'GPU (stream 0)'], span: 14, labw: 130, unit: 'time (illustrative)' },
    steps: [
      { t: 'Warm-up: the first launch is slow', bars: [{ row: 0, s: 0, d: 1, label: 'launch', c: 1 }, { row: 1, s: 1, d: 5, label: 'context + kernel (slow)', c: 1 }, { row: 0, s: 1, d: 5, label: 'cudaDeviceSynchronize', cls: 'c7' }], code: ['/* Warm-up */', 'cudaDeviceSynchronize();'],
        say: 'The very first CUDA call/launch pays one-time costs (context creation, module loading, clocks ramping up). A warm-up launch absorbs these so they do not pollute the measurement.' },
      { t: 'Record a start event', bars: [{ row: 0, s: 6, d: 0.5, label: 'rec', c: 0 }], mark: { t: 6, label: 'start' }, code: 'cudaEventRecord(start);', say: '<code>cudaEventRecord(start)</code> puts a timestamp marker into the GPU\'s work queue (stream 0). It returns to the CPU immediately.' },
      { t: 'Launch the kernel (asynchronous)', bars: [{ row: 0, s: 6.5, d: 0.5, label: 'launch', c: 0 }, { row: 1, s: 7, d: 3, label: 'matMulOneBlock', c: 2 }], code: 'matMulOneBlock<<<1, block>>>(A, B, C, n);', say: 'The launch returns at once; the kernel runs on the GPU. The CPU is free to continue (here it just queues the next command).' },
      { t: 'Record the stop event and wait', bars: [{ row: 0, s: 7, d: 0.5, label: 'rec', c: 0 }, { row: 0, s: 7.5, d: 2.5, label: 'EventSynchronize', cls: 'c7' }], mark: { t: 10, label: 'stop' }, code: ['cudaEventRecord(stop);', 'cudaEventSynchronize(stop);'], say: 'The stop marker is queued <em>behind</em> the kernel. <code>cudaEventSynchronize(stop)</code> blocks the CPU until the GPU reaches it, i.e. until the kernel has finished.' },
      { t: 'Elapsed time = stop - start', total: 'cudaEventElapsedTime = 3 units (kernel only; copies are outside)', code: 'cudaEventElapsedTime(&ms, start, stop);', say: 'The time between the two events is the kernel time in milliseconds, measured by the GPU\'s own clock. Host&harr;device copies are deliberately outside the timed region.' }
    ],
    notes: ['A CPU timer around an asynchronous launch would measure only the launch overhead, not the kernel.']
  }));

  /* ---------- row bands ---------- */
  const n8 = 8;
  PDC.add(Object.assign({ id: 'MatMul_OneBlock_RowBands' }, base, {
    title: 'One block: each thread computes whole rows', files: [D + 'MatMul_OneBlock_RowBands.cu'], concepts: ['row bands', 'strided loop over rows', 'any n with one block', 'coarser work per thread'],
    summary: 'A 1-D block of T threads. Thread <code>t</code> computes rows <code>t, t+T, t+2T, &hellip;</code> of C completely &mdash; so n is no longer limited to 32.',
    kind: 'matmul', scene: { n: n8, T: 4, own: 'row' },
    steps: [
      { t: 'Rows are dealt out to threads', own: 'row', eq: '4 threads (T0…T3, coloured): row r belongs to thread r mod 4', C: {}, code: ['__global__ void matMulRowBands(', 'for (int row = tid; row < n; row += blockDim.x) {'],
        say: 'There is only <b>one thread index</b> (<code>threadIdx.x</code>) and <b>one block</b>. Rows are dealt out round-robin: thread 0 gets rows 0, 4, 8&hellip;; thread 1 gets rows 1, 5, 9&hellip;. (The picture uses 8 rows and 4 threads; the program defaults to n = 1000 and 256 threads.)' },
      { t: 'Thread 1 computes C[1][0], C[1][1], &hellip;', eq: 'thread 1: for col = 0..n-1: C[1][col] = Σk A[1][k]·B[k][col]', sweep: rc(n8, 1, 0), A: { hl: { row: 1 } }, B: { hl: { col: 0 } }, C: { hl: [[1, 0]] }, code: ['for (int col = 0; col < n; col++) {', 'sum += A[row*n + k] * B[k*n + col];'],
        say: 'For its row the thread runs an inner loop over <b>every column</b>, each with its own dot product. One thread therefore does n&sup2; multiply-adds per row.' },
      { t: 'A full row is finished by one thread', eq: 'row 1 done by thread 1', C: { done: { row: 1 }, hl: { row: 1 } }, A: { hl: { row: 1 } }, code: 'C[row*n + col] = sum;', say: 'After the column loop the whole row 1 of C is complete. All other threads do the same for their rows at the same time.' },
      { t: 'The loop wraps around: row += blockDim.x', eq: 'thread 1 also takes row 5 (1 + 4)', C: { done: { rows: [0, 3] }, hl: [[1, 0], [1, 1], [5, 0], [5, 1]] }, A: { hl: [{ row: 1 }, { row: 5 }] }, code: 'for (int row = tid; row < n; row += blockDim.x) {',
        say: 'When there are more rows than threads, each thread continues with <code>row + blockDim.x</code>. This <b>strided loop</b> lets a fixed number of threads handle any n.' },
      { t: 'What this version cannot do', eq: 'one block → one multiprocessor; the other SMs idle', C: { done: ALL }, code: ['matMulRowBands<<<1, threads>>>(A, B, C, n);', 'if (threads > 1024) threads = 1024;'], say: 'A single block runs on <b>one SM</b>; a GPU has dozens. This is a teaching step: it removes the n &le; 32 limit but uses only a sliver of the hardware. Also, <code>B[k*n + col]</code> walks down a column, which is slow &mdash; see the next example.' }
    ],
    notes: ['The kernel prints <code>C[0][0] = 2.5*n</code> because B is filled with 2.5 and A with 1.0.']
  }));

  PDC.add(Object.assign({ id: 'MatMul_OneBlock_RowBands_BT' }, base, {
    title: 'Row bands with B transposed', files: [D + 'MatMul_OneBlock_RowBands_BT.cu'], concepts: ['memory access pattern', 'transpose B', 'contiguous reads', 'cache friendliness'],
    summary: 'Same as row bands, but B is transposed on the host first, so the inner product walks <em>both</em> arrays left to right in memory.',
    kind: 'matmul', scene: { n: n8, T: 4, own: 'row' },
    steps: [
      { t: 'The problem: B is read down a column', eq: 'A[row*n + k]: contiguous    B[k*n + col]: jumps by n', mem: { title: 'B in memory (row-major, n = 8): the column col = 1 is touched at indices 1, 9, 17, …', len: 64, hl: [1, 9, 17, 25, 33, 41, 49, 57], note: 'Each access is <b>n words away</b> from the previous one: every read lands in a different cache line.' }, A: { hl: { row: 2 } }, B: { hl: { col: 1 } }, C: { hl: [[2, 1]] }, code: ['Original:', 'C[row][col] = sum A[row][k] * B[k][col]'],
        say: 'In the plain version a thread reads <code>B[k*n + col]</code> for k = 0, 1, 2, &hellip;: addresses <b>n elements apart</b>. Each read touches a different cache line and wastes most of it.' },
      { t: 'Transpose B on the host', eq: 'BT[col][row] = B[row][col]', mem: { title: 'BT in memory: what used to be column 1 of B is now row 1 of BT', len: 64, hl: [8, 9, 10, 11, 12, 13, 14, 15] }, B: { hl: { col: 1 } }, code: 'hBT[col*n + row] = hB[row*n + col];',
        say: 'Before copying to the GPU, the CPU builds <code>BT</code>, the transpose. A column of B becomes a <b>row</b> of BT.' },
      { t: 'Now both operands are read contiguously', eq: 'sum += A[row*n + k] * BT[col*n + k]', mem: { title: 'BT row 1 = indices 8 … 15, read in order', len: 64, hl: [8, 9, 10, 11, 12, 13, 14, 15], hl2: [16, 17, 18, 19, 20, 21, 22, 23], note: 'A row of A and a row of BT: <b>two sequential streams</b>, ideal for caches.' }, A: { hl: { row: 2 } }, C: { hl: [[2, 1]] }, code: 'sum += A[row*n + k] * BT[col*n + k];',
        say: 'The inner product is now a dot product of two <b>rows</b>, stored contiguously. Consecutive iterations touch consecutive addresses, so each cache line is fully used.' },
      { t: 'Same result, different speed', C: { done: ALL }, eq: 'C = A · B  (unchanged)', code: ['printf("MatMul kernel time: %.3f ms\\n", ms);', 'hC[0], 2.5f*n);'], say: 'The numerical result is identical; only the memory access pattern changed. Compare the printed kernel time with <code>MatMul_OneBlock_RowBands</code>.' }
    ],
    notes: ['Transposing costs O(n&sup2;) once on the host and saves O(n&sup3;) slow strided reads.']
  }));

  /* ---------- multiple blocks ---------- */
  PDC.add(Object.assign({ id: 'MatMul_MultipleBlock' }, base, {
    title: 'Many blocks: a 2-D grid', files: [D + 'MatMul_MultipleBlock.cu'], concepts: ['blockIdx / blockDim', 'global row & col', 'bounds check', 'any matrix size', 'CUDA events'],
    summary: 'One thread per element of C again, but now many blocks tile the matrix, so n is limited only by memory. Row and column come from <code>blockIdx</code>, <code>blockDim</code> and <code>threadIdx</code>.',
    kind: 'matmul', scene: { n: 8, tile: 4, own: 'tile' },
    steps: [
      { t: 'A grid of blocks covers C', eq: 'dimGrid = ceil(n/block) × ceil(n/block)   dimBlock = block × block', C: {}, code: ['dim3 dimBlock(blockSize, blockSize);', 'dim3 dimGrid((n + blockSize - 1) / blockSize,'],
        say: 'With n = 8 and 4&times;4 blocks the grid is 2&times;2: <b>four blocks</b> (the four colours), each responsible for one 4&times;4 tile of C. In the program n and the block size are command-line arguments (e.g. 1024 and 16).' },
      { t: 'Global row and column of one thread', eq: 'block (x=0, y=1), thread (x=3, y=2):  col = 0·4+3 = 3     row = 1·4+2 = 6   →  C[6][3]', A: { hl: { row: 6 } }, B: { hl: { col: 3 } }, C: { hl: [[6, 3]] }, code: ['int col = blockIdx.x * blockDim.x + threadIdx.x;', 'int row = blockIdx.y * blockDim.y + threadIdx.y;'],
        say: 'Each thread first computes its <b>global</b> position: block offset (<code>blockIdx &times; blockDim</code>) plus the position inside the block (<code>threadIdx</code>). This is the 2-D version of the index formula used for vector addition.' },
      { t: 'Its dot product', sweep: rc(8, 6, 3), A: { hl: { row: 6 } }, B: { hl: { col: 3 } }, C: { hl: [[6, 3]] }, eq: '', code: ['if (row < n && col < n) {', 'sum += A[row * n + k] * B[k * n + col];'],
        say: 'The thread then does the same dot product as before, reading <em>global memory</em> for every element. The <code>if (row &lt; n &amp;&amp; col &lt; n)</code> guard protects threads that fall outside the matrix when n is not a multiple of the block size.' },
      { t: 'All blocks run concurrently', C: { done: ALL }, eq: '4 blocks → up to 4 SMs busy at once', code: 'matMulMultipleBlock<<<dimGrid, dimBlock>>>(d_A, d_B, d_C, n);', say: 'The four blocks are scheduled onto free multiprocessors in any order. For n = 1024 there are 4096 blocks, queued onto however many SMs the GPU has.' },
      { t: 'Kernel-only timing and verification', C: { done: ALL }, eq: 'expected C[i][j] = n   (A = 1, B = 1)', code: ['cudaEventElapsedTime(&milliseconds, start, stop)', 'printf("Kernel time: %.3f ms\\n", milliseconds);'], say: 'CUDA events time just the kernel. This is the baseline against which <code>MatMul_SharedMemory</code> is compared.' }
    ],
    notes: ['Choose block sizes that are multiples of the warp size (32 threads): 16&times;16 = 256 and 32&times;32 = 1024 both are.'],
    tryit: ['Run <code>./MatMul_MultipleBlock 1024 16</code> and <code>./MatMul_MultipleBlock 1024 8</code>: how does block size change the time?']
  }));

  /* ---------- shared memory tiling ---------- */
  PDC.add(Object.assign({ id: 'MatMul_SharedMemory' }, base, {
    title: 'Shared-memory tiling', files: [D + 'MatMul_SharedMemory.cu'], concepts: ['__shared__ (dynamic)', 'tiles', '__syncthreads()', 'data reuse', 'coalesced loads'],
    summary: 'Each block cooperatively copies a tile of A and a tile of B into fast shared memory, computes a partial product from it, then moves on to the next pair of tiles.',
    kind: 'matmul', scene: { n: 8, tile: 4, own: 'tile' },
    steps: [
      { t: 'A block owns one tile of C', eq: 'block (0,1) (bottom-left tile) computes C[4..7][0..3]', C: { hl: { rect: [4, 0, 7, 3] } }, code: ['int tileSize = blockDim.x;', 'int row = blockIdx.y * tileSize + ty;'],
        say: 'Each block is responsible for a <b>tileSize &times; tileSize</b> piece of C. To compute it, the block needs the matching band of rows of A and band of columns of B &mdash; but it fetches them one tile at a time.' },
      { t: 'Shared memory is allocated dynamically', eq: 'sharedBytes = 2 · blockSize² · sizeof(float)', C: { hl: { rect: [4, 0, 7, 3] } }, sh: { title: 'extern __shared__ float shared[]  = As | Bs', A: { label: 'As (first half)', filled: false }, B: { label: 'Bs (second half)', filled: false } },
        code: ['extern __shared__ float shared[];', 'size_t sharedBytes = 2ULL * blockSize * blockSize * sizeof(float);', 'matMulShared<<<dimGrid, dimBlock, sharedBytes>>>(d_A, d_B, d_C, n);'],
        say: 'The tile size is only known at run time, so the shared array is <code>extern __shared__</code> and its size is the <b>third launch parameter</b>. The kernel splits it into <code>As</code> and <code>Bs</code>.' },
      { t: 'Phase 0: load tile 0 of A and of B', A: { hl: { rect: [4, 0, 7, 3] } }, B: { hl: { rect: [0, 0, 3, 3] } }, C: { hl: { rect: [4, 0, 7, 3] } }, sh: { A: { label: 'As = A[4..7][0..3]' }, B: { label: 'Bs = B[0..3][0..3]' } }, eq: 'each thread loads ONE element of A and ONE of B',
        code: ['As[ty * tileSize + tx] = A[row * n + aCol];', 'Bs[ty * tileSize + tx] = B[bRow * n + col];'],
        say: 'All threads of the block load <b>one element each</b> of the A tile and the B tile. Neighbouring threads (<code>tx</code>, <code>tx+1</code>) read neighbouring addresses, so the loads are <b>coalesced</b>. Out-of-range elements are replaced by 0.0.' },
      { t: 'Barrier, then compute from shared memory', A: { hl: { rect: [4, 0, 7, 3] } }, B: { hl: { rect: [0, 0, 3, 3] } }, C: { hl: [[5, 2]] }, sh: { A: { label: 'As', hl: [[1, 0], [1, 1], [1, 2], [1, 3]] }, B: { label: 'Bs', hl: [[0, 2], [1, 2], [2, 2], [3, 2]] } }, eq: 'thread (1,2): sum += As[1][k] · Bs[k][2]  for k = 0..3', code: ['__syncthreads();', 'sum += As[ty * tileSize + k] * Bs[k * tileSize + tx];'],
        say: '<code>__syncthreads()</code> waits until every thread has loaded its element. Then each thread does <b>tileSize multiply-adds</b>, reading only shared memory. Each loaded value is used tileSize times by different threads.' },
      { t: 'Second barrier, then the next tile pair', A: { hl: { rect: [4, 4, 7, 7] } }, B: { hl: { rect: [4, 0, 7, 3] } }, C: { hl: { rect: [4, 0, 7, 3] } }, sh: { A: { label: 'As = A[4..7][4..7]' }, B: { label: 'Bs = B[4..7][0..3]' } }, eq: 'phase t = 1: slide the tiles along the row of A and down the column of B',
        code: ['for (int t = 0; t < numTiles; t++) {', '/* Finish using this tile before any thread overwrites shared memory. */'],
        say: 'A second <code>__syncthreads()</code> at the end of each phase stops fast threads from overwriting the tile while slower threads are still reading it. Then the loop moves to tile <code>t + 1</code>. <code>numTiles = ceil(n / tileSize)</code> phases are needed.' },
      { t: 'Write the finished tile of C', C: { done: ALL, hl: { rect: [4, 0, 7, 3] } }, eq: 'C[row*n + col] = sum  (once per thread)', code: ['if (row < n && col < n)', 'C[row * n + col] = sum;'],
        say: 'After the last phase every thread holds the complete dot product and writes it once. The other tiles of C are produced the same way by the other blocks.' },
      { t: 'Why it is faster', C: { done: ALL }, eq: 'global reads per C element: naive 2n  →  tiled 2n / tileSize', code: 'matMulShared<<<dimGrid, dimBlock, sharedBytes>>>(d_A, d_B, d_C, n);',
        say: 'In the naive kernel every thread reads 2n values from global memory. With tiles each value is loaded <b>once per block</b> and reused by tileSize threads, cutting global traffic by a factor of <code>tileSize</code> (16 for the usual 16&times;16 block). Compare timings with <code>MatMul_MultipleBlock 1024 16</code>.' }
    ],
    notes: ['Shared memory is on-chip and roughly an order of magnitude faster than global memory, but small (tens of KB per block).', 'The two barriers are not optional: remove either and the result becomes wrong or non-deterministic.'],
    tryit: ['Run <code>./MatMul_MultipleBlock 1024 16</code> and <code>./MatMul_SharedMemory 1024 16</code> a few times each and compare the kernel times.']
  }));

  /* ---------- register tiling ---------- */
  PDC.add(Object.assign({ id: 'MatMul_SharedMemoryRegisterTiled' }, base, {
    title: 'Shared memory + register tiling', files: [D + 'MatMul_SharedMemoryRegisterTiled.cu'], concepts: ['register tiling', 'OUTS outputs per thread', 'compile-time TILE / OUTS', 'instruction-level parallelism'],
    summary: 'Each thread computes <code>OUTS</code> adjacent outputs instead of one, keeping the partial sums in registers. One value from the A tile is reused for all of them.',
    kind: 'matmul', scene: { n: 8, tile: 2, own: 'regs', T: 2 },
    steps: [
      { t: 'Each thread owns OUTS outputs', own: 'regs', eq: 'TILE = 2, OUTS = 2:  a 2×2 block of threads covers a 2 × 4 piece of C', C: { hl: { rect: [0, 0, 1, 3] } }, code: ['#define TILE 16', '#define OUTS 2', 'const int baseCol = blockIdx.x * (OUTS * TILE) + tx;'],
        say: 'The coloured cells show which thread owns which output. A block has <code>TILE&times;TILE</code> threads, but covers <code>TILE</code> rows and <code>OUTS&times;TILE</code> columns of C &mdash; so every thread produces <b>OUTS = 2</b> values (columns <code>tx</code> and <code>tx + TILE</code>). Real program: TILE = 16.' },
      { t: 'Load one A tile and an OUTS-wide B tile', own: 'regs', A: { hl: { rect: [0, 0, 1, 1] } }, B: { hl: { rect: [0, 0, 1, 3] } }, C: { hl: { rect: [0, 0, 1, 3] } }, eq: 'As is TILE×TILE;  Bs is TILE×(OUTS·TILE)', code: ['__shared__ float As[TILE][TILE];', '__shared__ float Bs[TILE][OUTS * TILE];', 'Bs[ty][tx + r * TILE] ='],
        say: 'Shared memory holds a normal tile of A but a <b>wider tile of B</b> (OUTS tiles side by side). For each <code>r</code>, threads with consecutive <code>tx</code> load consecutive columns, so every global load stays coalesced.' },
      { t: 'One A value, OUTS multiply-adds', own: 'regs', A: { hl: [[0, 0]] }, B: { hl: [[0, 0], [0, 2]] }, C: { hl: [[0, 0], [0, 2]] }, eq: 'a = As[ty][k];   sum[0] += a·Bs[k][tx];   sum[1] += a·Bs[k][tx + TILE]', code: ['const float a = As[ty][k];', 'sum[r] += a * Bs[k][tx + r * TILE];'],
        say: 'The thread reads <code>a = As[ty][k]</code> from shared memory <b>once</b> into a register and uses it for <b>OUTS</b> products. That halves the shared-memory reads per multiply-add and gives the GPU independent operations to overlap.' },
      { t: 'Partial sums live in registers', own: 'regs', C: { hl: [[0, 0], [0, 2]] }, eq: 'float sum[OUTS];   #pragma unroll', code: ['float sum[OUTS];', '#pragma unroll'],
        say: '<code>sum[OUTS]</code> is a small array indexed only by compile-time constants, and <code>#pragma unroll</code> unrolls the loops, so the compiler keeps the values in <b>registers</b>, the fastest memory there is.' },
      { t: 'Write OUTS results per thread', own: 'regs', C: { done: ALL }, eq: 'C[row][baseCol + r*TILE] = sum[r]', code: 'C[(size_t)row * n + col] = sum[r];',
        say: 'At the end each thread writes its OUTS values. <code>TILE</code> and <code>OUTS</code> are compile-time parameters (<code>-DTILE=16 -DOUTS=4</code>), so you can tune them for your GPU.' }
    ],
    notes: ['More outputs per thread means more registers per thread; too many reduces occupancy. Tuning TILE and OUTS is a trade-off.'],
    tryit: ['Build with <code>nvcc -O2 -DOUTS=4 -o rt MatMul_SharedMemoryRegisterTiled.cu</code> and compare with OUTS = 1, 2, 4.']
  }));

  /* ---------- reduction one block ---------- */
  PDC.add(Object.assign({ id: 'Reduction_OneBlock' }, base, {
    title: 'Reduction in one block', files: [D + 'Reduction_OneBlock.cu'], concepts: ['tree reduction', 'extern __shared__', '__syncthreads()', 'power-of-two size'],
    summary: 'Adds n numbers with n threads of a single block: load into shared memory, then halve the number of active threads each step.',
    kind: 'reduce', scene: { T: 8, values: [1, 1, 1, 1, 1, 1, 1, 1], name: 'sdata' },
    steps: [
      { t: 'Thread i loads element i', view: 'cache', code: ['extern __shared__ float sdata[];', 'sdata[tid] = A[tid];'], say: 'With <code>n = 8</code> (the program allows up to 1024), thread <code>tid</code> copies <code>A[tid]</code> into shared memory. All inputs are 1.0, so the answer must equal n.' },
      { t: 'Barrier', view: 'cache', code: '__syncthreads();', say: 'Everyone must have loaded before anyone reads a neighbour\'s element.' },
      { t: 'Stride 4: add the upper half to the lower half', view: 'tree', stride: 4, code: ['for (int stride = n / 2; stride > 0; stride /= 2) {', 'sdata[tid] += sdata[tid + stride];'], say: 'Threads with <code>tid &lt; stride</code> add <code>sdata[tid + stride]</code> to their own element. The other threads do nothing.' },
      { t: 'Stride 2', view: 'tree', stride: 2, code: '__syncthreads();#2', say: 'A barrier after every step makes sure the sums of the previous step are complete. Now only 2 threads are active.' },
      { t: 'Stride 1', view: 'tree', stride: 1, code: 'stride /= 2', say: 'After <b>log&#8322; n</b> steps the total is in <code>sdata[0]</code>.' },
      { t: 'Thread 0 stores the result', view: 'tree', out: true, outLabel: '*result = sdata[0]', code: ['if (tid == 0)', '*result = sdata[0];'], say: 'Only thread 0 writes the final sum to global memory; the host reads it back and checks <code>result == n</code>.' }
    ],
    notes: ['The code assumes n is a power of two (see <code>isPowerOfTwo</code>); otherwise the halving would skip elements.', 'For n larger than one block, each block produces a partial sum (see <code>dotproduct.cu</code>).']
  }));

  /* ---------- coalescing benchmark ---------- */
  PDC.add(Object.assign({ id: 'Coalescing_2D_Copy_Benchmark' }, base, {
    title: 'Coalesced vs non-coalesced copy', files: [D + 'Coalescing_2D_Copy_Benchmark.cu'], concepts: ['memory coalescing', 'warp', 'row-major layout', 'bandwidth benchmark'],
    summary: 'Two copy kernels do exactly the same work &mdash; copy an n&times;n matrix &mdash; but differ in which index <code>threadIdx.x</code> walks: columns (fast) or rows (slow).',
    kind: 'mem', scene: { mode: 'matrix', n: 8, warp: 8 },
    steps: [
      { t: 'Memory is row-major', layout: 'col', note: 'Picture scaled down: 8 threads per "warp", 8 words per cache line (real: 32 threads, 32 words = 128 bytes).', code: 'B[row * n + col] = A[row * n + col];', say: 'Element (row, col) lives at address <code>row*n + col</code>: <b>a row is contiguous in memory</b>, a column is not. A <b>warp</b> (32 threads) executes a load together, and the hardware serves it with as few memory transactions as the addresses allow.' },
      { t: 'copy_coalesced: threadIdx.x walks the COLUMN', layout: 'col', code: ['int col = blockIdx.x * blockDim.x + threadIdx.x;', 'int row = blockIdx.y * blockDim.y + threadIdx.y;'], say: 'In <code>copy_coalesced</code> the 32 threads of a warp have consecutive <code>threadIdx.x</code> and therefore consecutive <b>columns</b> of one row: <b>consecutive addresses</b>. One 128-byte transaction feeds the whole warp.' },
      { t: 'copy_noncoalesced: threadIdx.x walks the ROW', layout: 'row', code: ['int row = blockIdx.x * blockDim.x + threadIdx.x;', 'int col = blockIdx.y * blockDim.y + threadIdx.y;'], say: 'In <code>copy_noncoalesced</code> the roles are swapped: neighbouring threads now handle neighbouring <b>rows</b>, i.e. addresses <b>n words apart</b>. Every thread of the warp hits a different cache line &mdash; up to 32 transactions for one load.' },
      { t: 'The benchmark', layout: 'row', note: 'Block is 32 &times; 8 in both versions; only the index mapping differs.', code: ['dim3 block(32, 8);', 'printf("Slowdown:       %.2fx\\n", noncoal_ms / coal_ms);'], say: 'Each kernel is launched once as warm-up and then <code>reps</code> times between CUDA events; the average time and the <b>slowdown factor</b> are printed. Expect the non-coalesced copy to be several times slower on a large matrix.' }
    ],
    notes: ['Rule of thumb: let <code>threadIdx.x</code> index the <b>fastest-varying (contiguous)</b> dimension of your arrays.'],
    tryit: ['Run <code>./Coalescing_2D_Copy_Benchmark 8192 20</code> and report the slowdown on your GPU.']
  }));
})();
