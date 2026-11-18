/* CUDA streams, multi-GPU, zero-copy, occupancy and cooperative groups (pdc/cuda/src2, NVIDIA CUDA Samples). */
(function () {
  'use strict';
  const D = 'pdc/cuda/src2/';
  const base = { course: 'pdc', topic: 'cuda-advanced' };
  const co = function (v, c) { return { v: v, c: c }; };

  /* ---------- simpleStreams ---------- */
  PDC.add(Object.assign({ id: 'simpleStreams' }, base, {
    title: 'Streams: overlap kernels and copies', files: [D + 'simpleStreams.cu'], concepts: ['cudaStream_t', 'cudaMemcpyAsync', 'pinned memory', 'cudaEvent timing', 'overlap'],
    summary: 'Without streams the GPU does kernel, then copy, then kernel, then copy. Splitting the array over 4 streams lets the copy of one piece run while the next piece is still being computed.',
    kind: 'gantt', scene: { rows: ['Kernel engine (SMs)', 'Copy engine (PCIe)'], span: 17, labw: 140, unit: 'illustrative time units' },
    steps: [
      { t: 'The default: one stream, strictly in order', bars: [{ row: 0, s: 0, d: 4, label: 'init_array', c: 0 }, { row: 1, s: 4, d: 4, label: 'memcpy D2H', c: 0 }, { row: 0, s: 8, d: 4, label: 'init_array', c: 0 }, { row: 1, s: 12, d: 4, label: 'memcpy D2H', c: 0 }], total: 'non-streamed: kernel + copy = 8 units per repetition', code: ['init_array<<<blocks, threads>>>(d_a, d_c, niterations);', 'checkCudaErrors(cudaMemcpy(hAligned_a, d_a, nbytes, cudaMemcpyDeviceToHost));'],
        say: 'In the "non-streamed" loop each repetition launches the kernel on the whole array and then copies the whole result back with a blocking <code>cudaMemcpy</code>. Kernel hardware and copy hardware <b>take turns</b>; one of them is always idle.' },
      { t: 'Split the work into 4 streams', clear: true, bars: [{ row: 0, s: 0, d: 1, label: 'k0', c: 0 }, { row: 0, s: 1, d: 1, label: 'k1', c: 1 }, { row: 0, s: 2, d: 1, label: 'k2', c: 2 }, { row: 0, s: 3, d: 1, label: 'k3', c: 3 }], code: ['init_array<<<blocks, threads, 0, streams[i]>>>(d_a + i * n / nstreams, d_c, niterations);', 'checkCudaErrors(cudaStreamCreate(&(streams[i])));'],
        say: 'A <b>stream</b> is an ordered queue of GPU work; different streams may overlap. Here the array is cut in 4 quarters and each quarter gets its own kernel launch in its own stream (<code>streams[i]</code>), so each kernel is only a quarter as long.' },
      { t: 'Copies start as soon as their kernel is done', bars: [{ row: 1, s: 1, d: 1, label: 'c0', c: 0 }, { row: 1, s: 2, d: 1, label: 'c1', c: 1 }, { row: 1, s: 3, d: 1, label: 'c2', c: 2 }, { row: 1, s: 4, d: 1, label: 'c3', c: 3 }], mark: { t: 5, label: 'done' }, total: '4 streams: 5 units  (vs 8)', code: ['checkCudaErrors(cudaMemcpyAsync(hAligned_a + i * n / nstreams,', 'printf("%d streams:\\t%.2f\\n", nstreams, elapsed_time / nreps);'],
        say: 'Quarter 0 is copied back (<code>cudaMemcpyAsync</code> in <code>streams[0]</code>) while quarter 1 is still being computed, and so on: a <b>pipeline</b>. Total time drops from 8 to about 5 units; the printout compares "non-streamed" with "4 streams".' },
      { t: 'Async copies need pinned memory', code: ['checkCudaErrors(cudaMallocHost((void **)pp_a, nbytes));', 'checkCudaErrors(cudaHostRegister(*ppAligned_a, nbytes, cudaHostRegisterMapped));'],
        say: '<code>cudaMemcpyAsync</code> can only overlap with other work if the host buffer is <b>pinned</b> (page-locked), so the DMA engine can read it directly. The program allocates it with <code>cudaMallocHost</code>, or pins ordinary <code>mmap</code> memory with <code>cudaHostRegister</code> (the default, <code>--use_generic_memory</code>).' },
      { t: 'CPU/GPU synchronisation method', code: ['checkCudaErrors(cudaSetDeviceFlags(device_sync_method | (bPinGenericMemory ? cudaDeviceMapHost : 0)));', 'int eventflags = ((device_sync_method == cudaDeviceBlockingSync) ? cudaEventBlockingSync : cudaEventDefault);'],
        say: 'The required <code>--sync_method=n</code> option chooses how the CPU waits for the GPU: spin, yield, or <em>blocking sync</em> (the CPU sleeps, giving low CPU use). It does not change the GPU work, only the cost of waiting.' },
      { t: 'The result is verified', code: 'bool bResults = correct_data(hAligned_a, n, c * nreps * niterations);', say: 'After all repetitions every element must equal <code>c &times; nreps &times; niterations</code>; <code>correct_data</code> checks this, proving that the streamed version computed the same thing.' }
    ],
    notes: ['The kernel <code>init_array</code> deliberately adds to <code>g_data[idx]</code> several times "to burn time" so that compute is comparable to the copy.', 'Different streams may overlap, but work <em>within</em> one stream stays in order.'],
    tryit: ['Run <code>./simpleStreams --sync_method=4</code> and compare the "non-streamed" and "4 streams" times.']
  }));

  /* ---------- simpleMultiCopy ---------- */
  const stagger = function () {
    const bars = [];
    for (let k = 0; k < 4; k++) {
      bars.push({ row: 0, s: 2 * k, d: 2, label: 'H2D ' + k, c: k });
      bars.push({ row: 1, s: 2 * k + 2, d: 2, label: 'kernel ' + k, c: k });
      bars.push({ row: 2, s: 2 * k + 4, d: 2, label: 'D2H ' + k, c: k });
    }
    return bars;
  };
  const serialBars = function () {
    const bars = [];
    for (let k = 0; k < 4; k++) { bars.push({ row: 0, s: 6 * k, d: 2, label: 'H2D', c: k }); bars.push({ row: 1, s: 6 * k + 2, d: 2, label: 'kernel', c: k }); bars.push({ row: 2, s: 6 * k + 4, d: 2, label: 'D2H', c: k }); }
    return bars;
  };
  PDC.add(Object.assign({ id: 'simpleMultiCopy' }, base, {
    title: 'Overlapping two copies with compute', files: [D + 'simpleMultiCopy.cu'], concepts: ['copy engines', 'cudaMemcpyAsync', 'cudaEvent', 'software pipelining'],
    summary: 'A GPU with two copy engines can upload one chunk, compute another and download a third <em>at the same time</em>. The program measures each piece, then compares a serialised run with a 4-stream pipeline.',
    kind: 'gantt', scene: { rows: ['Copy engine 1 (H2D)', 'Kernel engine', 'Copy engine 2 (D2H)'], span: 24, labw: 150, unit: 'illustrative time units' },
    steps: [
      { t: 'Measure the three pieces separately', bars: [{ row: 0, s: 0, d: 2, label: 'H2D', c: 0 }, { row: 1, s: 2, d: 2, label: 'kernel', c: 1 }, { row: 2, s: 4, d: 2, label: 'D2H', c: 2 }], total: 'host→device 2 + kernel 2 + device→host 2 = 6 units', code: ['float memcpy_h2d_time;', 'float memcpy_d2h_time;', 'float kernel_time;'],
        say: 'Using CUDA events, the program times one upload, one kernel and one download of a chunk, and prints their throughput in GB/s.' },
      { t: 'What overlap could give', total: 'no overlap: 6   ·   one copy overlaps compute: max(2+2, 2) = 4   ·   both copies overlap: max(2,2,2) = 2', code: ['printf("No overlap at all (transfer-kernel-transfer): %f ms \\n", memcpy_h2d_time + memcpy_d2h_time + kernel_time);', 'printf("Compute can overlap with both data transfers: %f ms\\n",'],
        say: 'From the three measurements it computes <b>theoretical limits</b> for one chunk: no overlap, overlap with one copy engine, or overlap with both. The device properties tell which case applies (<code>cudaDevAttrGpuOverlap</code>, <code>asyncEngineCount</code>).' },
      { t: 'Serialised: 4 chunks, one stream', bars: serialBars(), total: '4 chunks × 6 units = 24 units', clear: true, code: 'float serial_time  = processWithStreams(1);',
        say: '<code>processWithStreams(1)</code> uses a single stream, so each chunk goes upload &rarr; compute &rarr; download before the next starts. Two of the three engines are always idle.' },
      { t: 'Pipelined: 4 streams', bars: stagger(), clear: true, total: 'pipelined: 6 + 3·2 = 12 units  (2× faster)', mark: { t: 12, label: 'done' }, code: ['float overlap_time = processWithStreams(STREAM_COUNT);', 'incKernel<<<grid, block, 0, stream[current_stream]>>>('],
        say: 'With <code>STREAM_COUNT = 4</code> streams the chunks are staggered: while chunk 0 is downloaded, chunk 1 is being computed and chunk 2 uploaded. After the pipeline fills, all three engines are busy.' },
      { t: 'How the loop keeps the pipeline full', code: ['int next_stream = (current_stream + 1) % streams_used;', 'cudaEventSynchronize(cycleDone[next_stream]);', 'checkCudaErrors(cudaEventRecord(cycleDone[current_stream], stream[current_stream]));'],
        say: 'Every iteration launches a kernel in the current stream, starts the next chunk\'s upload in the <em>next</em> stream and the current chunk\'s download. An event (<code>cycleDone</code>) per stream lets the loop wait only when it would reuse a stream whose previous work is not finished.' },
      { t: 'Pinned host memory is required', code: 'checkCudaErrors(cudaHostAlloc(&h_data_in[i], memsize, cudaHostAllocDefault));', say: 'The host buffers are page-locked (<code>cudaHostAlloc</code>) so the copy engines can access them directly; with ordinary memory the copies would be staged and could not overlap.' }
    ],
    notes: ['Two copy engines (one per direction) exist on Tesla/Quadro-class GPUs; many consumer GPUs have only one, so the overlap is then limited.']
  }));

  /* ---------- simpleMultiGPU ---------- */
  PDC.add(Object.assign({ id: 'simpleMultiGPU' }, base, {
    title: 'Using several GPUs from one process', files: [D + 'simpleMultiGPU.cu', D + 'simpleMultiGPU.h'], concepts: ['cudaSetDevice', 'one stream per GPU', 'TGPUplan', 'domain decomposition', 'asynchronous multi-GPU'],
    summary: 'A large array is cut into one chunk per GPU. Each GPU gets a stream and runs a reduction kernel on its chunk concurrently; the CPU adds the partial sums and checks them against a CPU result.',
    kind: 'diagram',
    scene: {
      w: 760, h: 380,
      edges: [['host', 'gpu0', { dash: true }], ['host', 'gpu1', { dash: true }]],
      nodes: {
        host: { x: 20, y: 16, w: 720, h: 96, label: 'host: input array of DATA_N floats', cls: 'cpu', cells: [co('chunk 0', 'c0'), co('chunk 1', 'c1')], cw: 140 },
        gpu0: { x: 40, y: 160, w: 310, h: 120, label: 'GPU 0', sub: 'stream 0', c: 0, cells: [co('d_Data', 'empty'), co('d_Sum', 'empty')], cw: 110 },
        gpu1: { x: 410, y: 160, w: 310, h: 120, label: 'GPU 1', sub: 'stream 1', c: 1, cells: [co('d_Data', 'empty'), co('d_Sum', 'empty')], cw: 110 },
        sum: { x: 240, y: 310, w: 280, h: 56, label: 'sumGPU = partial 0 + partial 1', sub: 'compared with sumCPU', cls: 'ok', hidden: true }
      }
    },
    steps: [
      { t: 'Detect the GPUs', pulse: ['gpu0', 'gpu1'], code: ['checkCudaErrors(cudaGetDeviceCount(&GPU_N));', 'const int MAX_GPU_COUNT = 32;'], say: '<code>cudaGetDeviceCount</code> returns the number of CUDA GPUs (capped at 32). The picture shows two. (SLI must be disabled for them to appear as separate devices.)' },
      { t: 'Split the data into one chunk per GPU', code: ['plan[i].dataN = DATA_N / GPU_N;', 'plan[i].dataN++;'], pulse: ['host'], say: 'Each GPU gets <code>DATA_N / GPU_N</code> elements; the remainder is spread over the first GPUs. The <code>TGPUplan</code> struct in <code>simpleMultiGPU.h</code> holds each GPU\'s chunk size, host and device buffers and its <b>stream</b>.' },
      { t: 'Per GPU: select, create stream, allocate', set: { gpu0: { cells: [co('d_Data', 'c0'), co('d_Sum', 'c0')] }, gpu1: { cells: [co('d_Data', 'c1'), co('d_Sum', 'c1')] } }, code: ['checkCudaErrors(cudaSetDevice(i));', 'checkCudaErrors(cudaStreamCreate(&plan[i].stream));', 'checkCudaErrors(cudaMallocHost((void **)&plan[i].h_Data, plan[i].dataN * sizeof(float)));'],
        say: '<code>cudaSetDevice(i)</code> makes GPU <i>i</i> the target of all following CUDA calls <em>by this CPU thread</em>. For each GPU the program creates a stream, allocates device buffers, and pinned host memory (needed for async copies), and fills the chunk with random numbers.' },
      { t: 'Queue the work on every GPU without waiting', flow: [{ from: 'host', to: 'gpu0', label: 'chunk 0' }, { from: 'host', to: 'gpu1', label: 'chunk 1', delay: 0.15 }], pulse: ['gpu0', 'gpu1'], code: ['checkCudaErrors(cudaMemcpyAsync(', 'reduceKernel<<<BLOCK_N, THREAD_N, 0, plan[i].stream>>>(plan[i].d_Sum, plan[i].d_Data, plan[i].dataN);'],
        say: 'In <b>one loop</b> the CPU issues, for each GPU, an async upload, a kernel launch and an async download &mdash; all in that GPU\'s stream. Every call returns immediately, so all GPUs end up working <b>at the same time</b>.' },
      { t: 'Wait for each GPU and add the partials', show: ['sum'], flow: [{ from: 'gpu0', to: 'sum', label: 'p0', cls: 'ok' }, { from: 'gpu1', to: 'sum', label: 'p1', cls: 'ok', delay: 0.15 }], code: ['cudaStreamSynchronize(plan[i].stream);', 'sumGPU += h_SumGPU[i];'],
        say: 'A second loop calls <code>cudaStreamSynchronize</code> for each GPU, then finishes its reduction on the CPU (the kernel produces <code>BLOCK_N &times; THREAD_N</code> sums per GPU) and adds the GPU totals.' },
      { t: 'Verify against the CPU', code: ['diff = fabs(sumCPU - sumGPU) / fabs(sumCPU);', 'exit((diff < 1e-5) ? EXIT_SUCCESS : EXIT_FAILURE);'], say: 'The CPU sums the same data, and the program passes if the relative difference is below 10<sup>&minus;5</sup>. (The kernel itself is a simple grid-stride loop, <code>reduceKernel</code>.)' }
    ],
    notes: ['This single-thread, multi-stream approach scales to many GPUs. The HPML folder also shows the OpenMP alternative: one CPU thread per GPU (<code>matMulMultiGPU.cu</code>).']
  }));

  /* ---------- simpleZeroCopy ---------- */
  PDC.add(Object.assign({ id: 'simpleZeroCopy' }, base, {
    title: 'Zero-copy: the GPU reads host memory', files: [D + 'simpleZeroCopy.cu'], concepts: ['cudaHostAllocMapped', 'cudaHostGetDevicePointer', 'zero-copy', 'pinned memory'],
    summary: 'The vectors are allocated in <b>mapped pinned host memory</b>, so the kernel reads and writes them directly across the bus. There is no <code>cudaMemcpy</code> at all.',
    kind: 'diagram',
    scene: {
      w: 760, h: 330,
      edges: [['hostmem', 'gpu', { dash: true, label: 'PCIe / NVLink' }]],
      nodes: {
        cpu: { x: 20, y: 20, w: 210, h: 84, label: 'CPU code', sub: 'initialises a[], b[]', cls: 'cpu' },
        hostmem: { x: 20, y: 150, w: 330, h: 150, label: 'host memory (pinned, mapped)', sub: 'a[]  b[]  c[]', cls: 'mem', cells: [co('a', 'c0'), co('b', 'c1'), co('c', 'c2')], cw: 60, hidden: true },
        gpu: { x: 470, y: 150, w: 270, h: 150, label: 'GPU', sub: 'd_a, d_b, d_c are device pointers\nto the SAME bytes', cls: 'gpu', hidden: true },
        kern: { x: 470, y: 20, w: 270, h: 84, label: 'vectorAddGPU<<<grid, 256>>>', sub: 'c[idx] = a[idx] + b[idx]', cls: 'gpu', hidden: true }
      }
    },
    steps: [
      { t: 'Allocate mapped, pinned host memory', show: ['hostmem'], pulse: ['hostmem'], code: ['flags = cudaHostAllocMapped;', 'checkCudaErrors(cudaHostAlloc((void **)&a, bytes, flags));'], say: '<code>cudaHostAlloc(..., cudaHostAllocMapped)</code> returns page-locked CPU memory that is also <b>mapped into the GPU\'s address space</b>. (Option <code>--use_generic_memory</code> instead pins <code>malloc</code> memory with <code>cudaHostRegister</code>.)' },
      { t: 'Enable mapping before allocating', code: 'checkCudaErrors(cudaSetDeviceFlags(cudaDeviceMapHost));', say: 'The device must first be told to allow mapped host memory (<code>cudaDeviceMapHost</code>); the program also checks <code>canMapHostMemory</code> in the device properties.' },
      { t: 'The CPU fills the vectors', show: ['hostmem'], flow: [{ from: 'cpu', to: 'hostmem', label: 'a, b', cls: 'ok' }], code: 'a[n] = rand() / (float)RAND_MAX;', say: 'The CPU writes the input data directly into the buffers &mdash; nothing needs to be uploaded later.' },
      { t: 'Get device pointers to the same memory', show: ['gpu'], code: 'checkCudaErrors(cudaHostGetDevicePointer((void **)&d_a, (void *)a, 0));', say: '<code>cudaHostGetDevicePointer</code> returns the address that <em>GPU code</em> must use to reach the same bytes (on most 64-bit systems it equals the host pointer, but you should not assume that).' },
      { t: 'The kernel works on host memory directly', show: ['kern'], flow: [{ from: 'hostmem', to: 'kern', label: 'a, b' }, { from: 'kern', to: 'hostmem', label: 'c', cls: 'ok', delay: 0.5 }], code: ['vectorAddGPU<<<grid, block>>>(d_a, d_b, d_c, nelem);', 'checkCudaErrors(cudaDeviceSynchronize());'],
        say: 'Every load of <code>a[idx]</code> in the kernel travels across the PCIe / NVLink bus, and every store to <code>c[idx]</code> goes back. There is <b>no copy step</b>, but also no reuse: each byte crosses the bus once, which is only efficient if the data is touched once.' },
      { t: 'The CPU already has the result', code: ['ref  = a[n] + b[n];', 'printf("errorNorm=%f refNorm=%f\\n", errorNorm, refNorm);'], say: 'After synchronisation the CPU reads <code>c[]</code> from the very same memory and compares with its own sum (relative error below 10<sup>&minus;6</sup>).' }
    ],
    notes: ['Zero-copy shines on <b>integrated GPUs</b> (they share DRAM with the CPU) and for data that is read once. For data reused many times, an explicit copy into device memory is faster.']
  }));

  /* ---------- simpleOccupancy ---------- */
  const warps = function (n, blockWarps) { const a = []; for (let i = 0; i < 32; i++) a.push(i < n ? co('', 'c' + (Math.floor(i / blockWarps) % 8)) : co('', 'empty')); return a; };
  PDC.add(Object.assign({ id: 'simpleOccupancy' }, base, {
    title: 'Occupancy: choosing the block size', files: [D + 'simpleOccupancy.cu'], concepts: ['occupancy', 'cudaOccupancyMaxPotentialBlockSize', 'warps per SM', 'resident blocks'],
    summary: 'Occupancy = resident warps / maximum warps per SM. The program launches a kernel with a manual 32-thread block and with the size recommended by the occupancy API, and prints each configuration\'s potential occupancy.',
    kind: 'diagram',
    scene: {
      w: 760, h: 300,
      nodes: {
        sm: { x: 20, y: 20, w: 720, h: 96, label: 'one SM: 32 warp slots (example GPU: 1024 threads / 32)', cells: warps(0, 1), cw: 18, ch: 30, cls: 'gpu' },
        info: { x: 20, y: 140, w: 720, h: 140, label: '', sub: 'press the steps', cls: 'mem' }
      }
    },
    steps: [
      { t: 'An SM has a limited number of warp slots', set: { info: { label: 'What limits residency?', sub: 'max threads per SM, max blocks per SM,\nregisters per thread, shared memory per block' } }, code: ['int maxWarps;', 'maxWarps    = prop.maxThreadsPerMultiProcessor / prop.warpSize;'], say: 'An SM can keep only so many warps <b>resident</b> at once: limited by threads, blocks, registers and shared memory. More resident warps help hide memory latency. The picture shows an example SM with 32 slots.' },
      { t: 'Manual choice: 32 threads per block', set: { sm: { cells: warps(16, 1) }, info: { label: 'manualBlockSize = 32  →  1 warp per block', sub: 'at most 16 blocks fit on this SM\n16 blocks × 1 warp = 16 of 32 slots  →  50 % occupancy' } }, code: ['const int manualBlockSize = 32;', 'blockSize = manualBlockSize;'],
        say: 'With 32-thread blocks each block is a single warp. An SM can hold only a fixed maximum number of <em>blocks</em> (16 in this example), so just half of the warp slots are used: <b>50 % occupancy</b>. (Real numbers depend on the GPU.)' },
      { t: 'Ask the runtime for a good block size', set: { sm: { cells: warps(32, 8) }, info: { label: 'suggested blockSize = 256  →  8 warps per block', sub: '4 blocks × 8 warps = 32 of 32 slots  →  100 % occupancy' } }, code: 'cudaOccupancyMaxPotentialBlockSize(', pulse: ['sm'],
        say: '<code>cudaOccupancyMaxPotentialBlockSize</code> inspects the kernel (registers, shared memory) and the device and suggests a block size that maximises potential occupancy &mdash; here 256 threads, i.e. 4 blocks fill all warp slots. The program prints the suggestion and the "minimum grid size for maximum occupancy".' },
      { t: 'How the number is computed', code: ['checkCudaErrors(cudaOccupancyMaxActiveBlocksPerMultiprocessor(', 'activeWarps = numBlocks * blockSize / prop.warpSize;', 'occupancy = (double)activeWarps / maxWarps;'],
        say: '<code>cudaOccupancyMaxActiveBlocksPerMultiprocessor</code> tells how many blocks of the given size can be resident on one SM. Then <code>activeWarps = blocks &times; blockSize / 32</code> and <code>occupancy = activeWarps / maxWarps</code>.' },
      { t: 'Same kernel, different launch configurations', code: ['gridSize = (arrayCount + blockSize - 1) / blockSize;', 'square<<<gridSize, blockSize, dynamicSMemUsage>>>(array, arrayCount);'], say: 'Both runs launch the same <code>square</code> kernel on 10<sup>6</sup> elements; only <code>blockSize</code> differs. The program times each with CUDA events and checks the squares. Higher occupancy usually, <em>but not always</em>, means faster &mdash; always measure.' }
    ],
    notes: ['Occupancy is a means, not a goal: a kernel with high instruction-level parallelism can be fast at low occupancy.'],
    tryit: ['Add a large <code>__shared__</code> array to <code>square</code> and see how the suggested block size and the occupancy change.']
  }));

  /* ---------- simpleCooperativeGroups ---------- */
  const ranks16 = Array.from({ length: 16 }, function (_, i) { return i; });
  PDC.add(Object.assign({ id: 'simpleCooperativeGroups' }, base, {
    title: 'Cooperative groups: reduce any group', files: [D + 'simpleCooperativeGroups.cu'], concepts: ['thread_group', 'this_thread_block()', 'tiled_partition', 'g.sync()', 'generic reduction'],
    summary: 'One <code>sumReduction(thread_group g, ...)</code> function works on the whole thread block and on smaller tiles of it. Each thread contributes its rank in the group; the answer is checked against (n&minus;1)&middot;n/2.',
    kind: 'reduce', scene: { T: 16, values: ranks16, name: 'workspace' },
    steps: [
      { t: 'A group knows its size and each thread\'s rank', view: 'cache', code: ['thread_block threadBlockGroup', 'input = threadBlockGroup.thread_rank();'], say: 'The block is wrapped in a <code>thread_block</code> group. Each thread\'s <code>input</code> is its <b>rank within the group</b>. (Scaled down: 16 threads; the program uses 64.)' },
      { t: 'The generic reduction loop', view: 'cache', code: ['__device__ int sumReduction(thread_group g, int *x, int val)', 'for (int i = g.size() / 2; i > 0; i /= 2) {'], say: '<code>sumReduction</code> takes <em>any</em> <code>thread_group</code>. It halves the active range each step, exactly like the shared-memory tree reduction you saw earlier &mdash; but it only talks to <code>g</code>, never to <code>blockDim</code>.' },
      { t: 'Step 1: stride 8', view: 'tree', stride: 8, code: ['x[lane] = val;', 'if (lane < i)', 'val += x[lane + i];'], say: 'Each thread publishes its value in the workspace, the group synchronises, and the lower half adds the upper half.' },
      { t: 'Step 2: stride 4', view: 'tree', stride: 4, code: 'g.sync();', say: '<code>g.sync()</code> synchronises <b>the group</b> &mdash; the whole block here, but just a tile in the second part.' },
      { t: 'Steps 3, 4: strides 2 and 1', view: 'tree', stride: 2, code: 'i /= 2', say: 'Stride 2 &hellip;' },
      { t: 'Block total = 0+1+&hellip;+15 = 120', view: 'tree', stride: 1, out: true, outLabel: 'rank 0 returns the sum', code: ['expectedOutput = (threadBlockGroupSize - 1) * threadBlockGroupSize / 2;', 'if (g.thread_rank() == 0)'], say: 'Thread 0 returns 120, which equals the analytic <code>(n&minus;1)&middot;n/2</code>; all other threads return &minus;1. The kernel prints the result next to the expected value.' },
      { t: 'Partition the block into tiles', view: 'cache', rebase: { values: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3], group: 4 }, code: ['thread_block_tile<16> tiledPartition16 = tiled_partition<16>(threadBlockGroup);', 'input = tiledPartition16.thread_rank();'], say: '<code>tiled_partition&lt;16&gt;</code> cuts the block into tiles of 16 threads (scaled here to 4). Now each thread\'s rank is its rank <b>within its tile</b>: 0&hellip;3 repeated.' },
      { t: 'The same function, now per tile', view: 'tree', stride: 2, code: 'output = sumReduction(tiledPartition16, workspace + workspaceOffset, input);', say: 'The <b>same</b> <code>sumReduction</code> is called with the tile as the group. Each tile uses its own slice of the workspace (<code>workspace + workspaceOffset</code>), and all tiles run independently and simultaneously.' },
      { t: 'Each tile gets 0+1+2+3 = 6', view: 'tree', stride: 1, out: true, outLabel: 'tile rank 0 prints its tile sum', code: ['expectedOutput = 15 * 16 / 2;', 'printf("   Sum of all ranks 0..15 in this tiledPartition16 group is %d "'], say: 'Every tile arrives at the same answer (in the real program 0+&hellip;+15 = 120). Cooperative groups make such collective code <b>reusable</b> at block, tile and (with newer CUDA) grid level.' }
    ],
    notes: ['The kernel uses dynamic shared memory: <code>cgkernel&lt;&lt;&lt;1, 64, 64*sizeof(int)&gt;&gt;&gt;</code> provides the <code>workspace</code>.']
  }));
})();
