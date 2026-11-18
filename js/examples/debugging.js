/* Debugging: pdc/gdb_src (gdb exercises) and pdc/cuda/cuda_gdb (cuda-gdb + Nsight Systems). */
(function () {
  'use strict';
  const G = 'pdc/gdb_src/', CG = 'pdc/cuda/cuda_gdb/';
  const gdb = { course: 'pdc', topic: 'gdb' }, cgdb = { course: 'pdc', topic: 'cuda-debug' };

  /* ---------- factorial ---------- */
  PDC.add(Object.assign({ id: 'factorial' }, gdb, {
    title: 'factorial: an off-by-one loop bound', files: [G + 'factorial.c'], concepts: ['break / run / next', 'display', 'print', 'off-by-one error'],
    summary: 'The program prints 24 for 5! instead of 120. Watch gdb step through the loop and expose the bug: the loop stops one iteration early.',
    kind: 'trace', scene: { title: 'gdb ./factorial' },
    steps: [
      { t: 'The symptom', term: ['$ gcc -g -o factorial factorial.c', '$ ./factorial', 'Factorial of 5 is: 24'], out: ['Factorial of 5 is: 24'], code: ['printf("Factorial of %d is: %ld\\n", num, fact);', '// Error: i<=n. \'=\' is missing'],
        say: '5! is 120, but the program prints <b>24</b> (which is 4!). Compile with <code>-g</code> so the debugger can map machine code back to source lines and variable names.' },
      { t: 'Set a breakpoint in factorial', term: ['$ gdb ./factorial', '(gdb) break factorial', 'Breakpoint 1 at 0x1189: file factorial.c, line 6.'], code: 'long factorial(int n) {', say: '<code>break factorial</code> makes the program stop when that function is entered. Nothing has run yet.' },
      { t: 'Run until the breakpoint', term: ['(gdb) run', 'Breakpoint 1, factorial (n=5) at factorial.c:6', '6	    long result=1;'], stack: ['factorial (n=5)', 'main ()'], vars: { n: 5 }, code: 'long result=1;',
        say: 'Execution stopped at the first line of <code>factorial</code>. The <b>call stack</b> shows <code>factorial</code> was called from <code>main</code>, and the argument <code>n = 5</code> is visible.' },
      { t: 'Display the variables of interest', term: ['(gdb) display i', '(gdb) display result', '(gdb) next', '(gdb) next', '1: i = 21845', '2: result = 1'], vars: { n: 5, result: 1, i: '21845 (uninitialised)' }, code: ['long result=1;', 'int i;'],
        say: '<code>display expr</code> re-prints an expression after every stop. <code>next</code> executes one line (stepping <em>over</em> calls; <code>step</code> would enter them). <code>i</code> has not been assigned yet, so it shows garbage.' },
      { t: 'Iteration i = 1, 2', term: ['(gdb) next', '(gdb) next', '1: i = 1', '2: result = 1', '(gdb) next', '(gdb) next', '1: i = 2', '2: result = 2'], vars: { n: 5, result: 2, i: 2 }, code: ['for (i=1; i<n; i++) {', 'result*=i;'], say: 'Each pass multiplies <code>result</code> by <code>i</code>: 1&times;1 = 1, then 1&times;2 = 2.' },
      { t: 'Iteration i = 3, 4', term: ['... next ...', '1: i = 3', '2: result = 6', '... next ...', '1: i = 4', '2: result = 24'], vars: { n: 5, result: 24, i: 4 }, code: 'result*=i;', say: 'result becomes 6, then <b>24</b>.' },
      { t: 'The loop exits too early', term: ['(gdb) next', '1: i = 5', '2: result = 24', '(gdb) print i < n', '$1 = 0', '(gdb) next', '9	    return result;'], vars: { n: 5, result: 24, i: 5 }, code: ['for (i=1; i<n; i++) {', 'return result;'],
        say: 'Now <code>i = 5</code> and <code>i &lt; n</code> is false (<code>print i &lt; n</code> gives 0), so the loop ends <b>before multiplying by 5</b>. The condition should be <code>i &lt;= n</code>.' },
      { t: 'Fix and confirm', term: ['(gdb) quit', '$ sed -i "s/i<n/i<=n/" factorial.c && gcc -g -o factorial factorial.c && ./factorial', 'Factorial of 5 is: 120'], out: ['Factorial of 5 is: 120'], vars: { n: 5, result: 120, i: 6 }, code: 'for (i=1; i<n; i++) {', say: 'With <code>i &lt;= n</code> the loop runs for i = 1&hellip;5 and the answer is 120.' }
    ],
    notes: ['Useful gdb commands: <code>break</code>, <code>run</code>, <code>next</code>, <code>step</code>, <code>print</code>, <code>display</code>, <code>watch</code>, <code>bt</code> (backtrace), <code>continue</code>, <code>finish</code>.', 'The terminal text is an <b>abridged, illustrative</b> session: addresses and exact wording differ on your machine, and the uninitialised value of <code>i</code> will vary.']
  }));

  /* ---------- divide ---------- */
  PDC.add(Object.assign({ id: 'divide' }, gdb, {
    title: 'divide: division by zero', files: [G + 'divide.c'], concepts: ['finish', 'continue', 'floating-point inf', 'defensive check'],
    summary: 'Dividing a <code>float</code> by 0 does not crash; it silently produces <code>inf</code>. Use gdb to catch the second call and see its arguments and return value.',
    kind: 'trace', scene: { title: 'gdb ./divide' },
    steps: [
      { t: 'The symptom: "inf", not a crash', term: ['$ gcc -g -o divide divide.c', '$ ./divide', 'Result of 5 / 3: 1.67', 'Result of 4 / 0: inf'], out: ['Result of 5 / 3: 1.67', 'Result of 4 / 0: inf'], code: ['result1 = divide(5.0, 3.0);', 'result2 = divide(4.0, 0.0);'],
        say: 'Unlike <em>integer</em> division by zero (which raises SIGFPE), IEEE-754 <em>floating-point</em> division by zero quietly yields <code>inf</code>, so nothing alerts you.' },
      { t: 'Break in divide and run', term: ['$ gdb ./divide', '(gdb) break divide', 'Breakpoint 1 at 0x1151: file divide.c, line 8.', '(gdb) run', 'Breakpoint 1, divide (numerator=5, denominator=3) at divide.c:8'], stack: ['divide (numerator=5, denominator=3)', 'main ()'], vars: { numerator: 5, denominator: 3 }, code: 'float divide(float numerator, float denominator) {', say: 'The first call: 5 / 3. Everything looks fine.' },
      { t: 'continue to the second call', term: ['(gdb) continue', 'Result of 5 / 3: 1.67', 'Breakpoint 1, divide (numerator=4, denominator=0) at divide.c:8'], out: ['Result of 5 / 3: 1.67'], vars: { numerator: 4, denominator: 0 }, stack: ['divide (numerator=4, denominator=0)', 'main ()'], code: 'result2 = divide(4.0, 0.0);',
        say: '<code>continue</code> runs until the next breakpoint. We are in the second call and can already see the problem: <b><code>denominator = 0</code></b>.' },
      { t: 'finish: what does the function return?', term: ['(gdb) finish', 'Run till exit from #0  divide (numerator=4, denominator=0) ...', 'Value returned is $1 = inf'], vars: { numerator: 4, denominator: 0, 'return value': 'inf' }, code: 'return numerator/denominator;', say: '<code>finish</code> runs until the current function returns and prints the returned value: <b>inf</b>.' },
      { t: 'The fix: check the denominator', term: ['(gdb) quit', '# uncomment the guard in divide():', '#   if (denominator == 0) { printf("Error: ..."); return 0; }'], code: ['// if (denominator == 0) {', '//     printf("Error: Division by zero is not allowed.\\n");'], vars: {}, say: 'The commented-out guard shows the intended fix: detect a zero denominator and report an error instead of returning <code>inf</code>.' }
    ],
    notes: ['In gdb, <code>print numerator/denominator</code> evaluates expressions without changing the program; <code>set var denominator = 1</code> changes a variable on the fly.']
  }));

  /* ---------- prefixsum ---------- */
  const arrInit = [1, 2, 3, 4, 5, 6, 7, 8, 9, 50];
  const withGuards = function (mid) { return ['?'].concat(mid).concat(['?']); };
  PDC.add(Object.assign({ id: 'prefixsum' }, gdb, {
    title: 'prefixsum: wrong index and out-of-bounds access', files: [G + 'prefixsum.c'], concepts: ['array bounds', 'watch', 'print arr[i-2]', 'undefined behaviour'],
    summary: 'The prefix sum of <code>{1,2,3,&hellip;}</code> should be <code>1 3 6 10 &hellip;</code>, but <code>arr[i-2]</code> is used instead of <code>arr[i-1]</code> &mdash; and the loop even touches elements outside the array.',
    kind: 'trace', scene: { title: 'gdb ./prefixsum' },
    steps: [
      { t: 'The symptom', term: ['$ ./prefixsum', 'Array: 1 2 3 4 5 6 7 8 9 50', 'Prefix Sum Array: 1 2 4 6 9 12 16 20 25 70'], out: ['Array: 1 2 3 4 5 6 7 8 9 50', 'Prefix Sum Array: 1 2 4 6 9 12 16 20 25 70', '(expected:        1 3 6 10 15 21 28 36 45 95)'], vars: { n: 10 }, arr: { name: 'arr', v: arrInit.slice(), at: [] }, code: ['int arr[10]={1, 2, 3, 4, 5, 6, 7, 8, 9, 50};', 'prefixsum(arr, n);'],
        say: 'A prefix sum should be <code>arr[i] = arr[0] + &hellip; + arr[i]</code>, computed by adding the <em>previous</em> element: <code>1 3 6 10 15 &hellip;</code>. The output is wrong from the second element on.' },
      { t: 'Break inside the loop', term: ['(gdb) break 7', 'Breakpoint 1 at ...: file prefixsum.c, line 7.', '(gdb) run', 'Breakpoint 1, prefixsum (arr=0x7ffe..., n=10) at prefixsum.c:7', '(gdb) display i', '(gdb) display arr[i-2]'], stack: ['prefixsum (arr=0x7ffe..., n=10)', 'main ()'], vars: { n: 10, i: 1 }, arr: { name: 'arr', v: withGuards(arrInit), off: -1, at: [2] }, code: 'arr[i]=arr[i]+arr[i-2];',
        say: 'We stop on the line that updates the array. <code>display</code> will show <code>i</code> and the element we are adding on every stop.' },
      { t: 'First iteration reads arr[-1]', term: ['1: i = 1', '2: arr[i-2] = 0      <- arr[-1]: NOT part of the array!', '(gdb) print &arr[-1]', '$1 = (int *) 0x7ffe...  (stack memory before arr)'], vars: { n: 10, i: 1, 'arr[i-2]': '0 (arr[-1], out of bounds)' }, arr: { name: 'arr', v: withGuards(arrInit), off: -1, at: [2], bad: [0] }, code: ['for (i=1; i<=n; i++) {', 'arr[i]=arr[i]+arr[i-2];'],
        say: 'With <code>i = 1</code>, <code>arr[i-2]</code> is <code>arr[-1]</code>: memory <b>before</b> the array. Reading it is undefined behaviour (it happens to be 0 here). The intended <code>arr[i-1]</code> would be <code>arr[0]</code>.' },
      { t: 'Wrong elements get added', term: ['(gdb) next', '(gdb) next', '1: i = 2', '2: arr[i-2] = 1', '(gdb) print arr', '$2 = {1, 2, 4, 4, 5, 6, 7, 8, 9, 50}'], vars: { n: 10, i: 2, 'arr[i-2]': 1 }, arr: { name: 'arr', v: withGuards([1, 2, 4, 4, 5, 6, 7, 8, 9, 50]), off: -1, at: [3, 1] }, code: 'arr[i]=arr[i]+arr[i-2];',
        say: 'At <code>i = 2</code> the code adds <code>arr[0]</code> (=1) to <code>arr[2]</code> (=3) and gets 4. The correct prefix sum would add <code>arr[1]</code> (=3 so far) to get 6: every element skips its neighbour.' },
      { t: 'The loop runs one step too far', term: ['(gdb) continue', '... i = 10 ...', '(gdb) print i', '$3 = 10', '(gdb) print arr[10]', '$4 = <value from the stack after the array>'], vars: { n: 10, i: 10 }, arr: { name: 'arr', v: withGuards([1, 2, 4, 6, 9, 12, 16, 20, 25, 70]).concat(['✗']), off: -1, at: [], bad: [11] }, code: ['for (i=1; i<=n; i++) {', 'int arr[10]'], say: 'The condition <code>i &lt;= n</code> lets <code>i</code> reach 10, but valid indices are 0&hellip;9: <code>arr[10] = ...</code> <b>writes outside the array</b> and can corrupt neighbouring variables. The loop should be <code>i &lt; n</code>.' },
      { t: 'The fixes', term: ['arr[i] = arr[i] + arr[i-1];   // add the previous element', 'for (i = 1; i < n; i++)       // stay inside the array', '$ ./prefixsum', 'Prefix Sum Array: 1 3 6 10 15 21 28 36 45 95'], out: ['Prefix Sum Array: 1 3 6 10 15 21 28 36 45 95'], vars: { n: 10 }, arr: { name: 'arr', v: [1, 3, 6, 10, 15, 21, 28, 36, 45, 95], at: [] }, code: '// Error: [i-2] should be replaced with [i-1]', say: 'Two edits fix it: use <code>arr[i-1]</code> and loop while <code>i &lt; n</code>. (The comment in the source names only the first; the second bug is a bonus.) Tools such as <code>valgrind</code> or <code>-fsanitize=address</code> catch out-of-bounds accesses automatically.' }
    ],
    notes: ['<code>watch arr[3]</code> stops the program whenever that element changes, a good way to find out <em>who</em> overwrote a value.', 'The same bug in a parallel program is much harder to see, because it may also be a data race.']
  }));

  /* ---------- parallel_sum ---------- */
  PDC.add(Object.assign({ id: 'parallel_sum' }, gdb, {
    title: 'parallel_sum: an off-by-one in an OpenMP loop', files: [G + 'parallel_sum.c'], concepts: ['OpenMP + gdb', 'info threads', 'reduction', 'debug prints with #ifdef'],
    summary: 'A parallel sum of the numbers 0&hellip;4 should give 10, but the loop condition <code>i &lt;= N</code> adds a sixth iteration, so the result is 15.',
    kind: 'iters', scene: { threads: 2, order: false, partials: true, rows: [{ name: 'for (i = 0; i <= N; i++)   with N = 5', n: 6 }] },
    steps: [
      { t: 'The symptom', note: '<code>$ ./parallel_sum</code> &rarr; "Sum of 5 is 15". Expected: 0+1+2+3+4 = 10.', code: ['printf("Sum of %d is %d\\n", N, sum);', '// Calculates sum of values in an array in parallel'], say: 'The program prints <b>15</b> instead of 10.' },
      { t: 'Debug prints show who does what', a: [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1], [5, 1]], code: ['#define _DEBUG_', 'printf("Thread %d is working on iteration %d\\n", omp_get_thread_num(), i);'], note: 'Output (order varies): "Thread 1 is working on iteration 3", &hellip; up to iteration <b>5</b>.',
        say: 'Compiling with <code>_DEBUG_</code> defined prints the iteration each thread handles. Six iterations appear (0&hellip;5), although only five numbers should be summed &mdash; one too many.' },
      { t: 'Each thread keeps a private partial sum', part: { 0: 3, 1: 12 }, code: ['#pragma omp parallel for reduction(+:sum)', 'sum+=i;'], say: 'With <code>reduction(+:sum)</code> thread 0 sums 0+1+2 = 3 and thread 1 sums 3+4+5 = 12. (Inside gdb, <code>info threads</code> lists the threads and <code>thread 2</code> switches to the second one.)' },
      { t: 'The reduction combines them', final: 15, code: 'for (i=0; i<=N; i++) {  // Introduce an error by using "<=" instead of "<"', say: 'The reduction itself is correct: 3 + 12 = 15. The bug is purely the loop bound <code>i &lt;= N</code> (the comment in the source says so).' },
      { t: 'The fix: i < N', reset: true, a: [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1]], part: { 0: 3, 1: 7 }, final: 10, note: 'With <code>i &lt; N</code> only i = 0&hellip;4 run: 3 + 7 = 10.', code: 'for (i=0; i<=N; i++) {', say: 'Changing the condition to <code>i &lt; N</code> gives five iterations and the correct total of 10.' }
    ],
    notes: ['Debugging tip: in gdb use <code>break parallel_sum.c:15</code>, <code>run</code>, <code>info threads</code>, <code>print i</code>, <code>print sum</code> to inspect each thread; build with <code>-fopenmp -g</code>.', 'Beware: stopping at breakpoints changes thread timing, which can hide race conditions.']
  }));

  /* ---------- cuda-gdb ---------- */
  PDC.add(Object.assign({ id: 'debug' }, cgdb, {
    title: 'cuda-gdb: stepping into a kernel', files: [CG + 'debug.cu', CG + 'Makefile'], concepts: ['nvcc -g -G', 'cuda-gdb', 'block / thread focus', 'info cuda', 'breakpoint in a kernel'],
    summary: 'Vector addition with 10,000 elements and 128 threads per block (79 blocks). Use <code>cuda-gdb</code> to stop inside the kernel, switch between threads and inspect the index arithmetic.',
    kind: 'trace', scene: { title: 'cuda-gdb ./debug', prompt: '(cuda-gdb)' },
    steps: [
      { t: 'Compile for debugging: -g -G', term: ['$ nvcc -g -G debug.cu -o debug'], code: ['compile: nvcc -g -G debug.cu -o debug', '%: %.cu>>$(CC) -g -G -o $@ $<'], say: '<code>-g</code> adds host debug info, and <code>-G</code> adds <b>device</b> debug info <em>and turns off GPU optimisations</em> so that variables and lines are meaningful. Never time a <code>-G</code> build.' },
      { t: 'Start the debugger, break in the kernel', term: ['$ cuda-gdb ./debug', '(cuda-gdb) break addArrays', 'Breakpoint 1 at 0x...: file debug.cu, line 13.', '(cuda-gdb) run'], code: '__global__ void addArrays(int *a, int *b, int *c, int size) {', say: 'A breakpoint on a <code>__global__</code> function stops when the first thread reaches it. The CPU code before the launch runs normally.' },
      { t: 'The launch configuration', term: ['[Switching focus to CUDA kernel 0, grid 1, block (0,0,0), thread (0,0,0), device 0, sm 0, warp 0, lane 0]', 'Thread 1 "debug" hit Breakpoint 1, addArrays<<<(79,1,1),(128,1,1)>>> (a=0x..., b=0x..., c=0x..., size=10000) at debug.cu:13'], stack: ['addArrays<<<(79,1,1),(128,1,1)>>> (size=10000)'], vars: { size: 10000, 'blockIdx.x': 0, 'threadIdx.x': 0 }, code: ['dim3 dimGrid((ARRAY_SIZE + THREADS_PER_BLOCK - 1) / THREADS_PER_BLOCK, 1, 1);', 'addArrays<<<dimGrid, dimBlock>>>(dev_a, dev_b, dev_c, ARRAY_SIZE);'],
        say: 'cuda-gdb reports the <b>grid (79 blocks)</b> and <b>block (128 threads)</b> that were launched and the thread it stopped in: block 0, thread 0. 79 = ceil(10000 / 128), the "ceiling" formula in the source.' },
      { t: 'List kernels and threads', term: ['(cuda-gdb) info cuda kernels', '  Kernel Parent Dev Grid Status   SMs Mask  GridDim BlockDim Invocation', '*      0      -   0    1 Active ...       (79,1,1) (128,1,1) addArrays(...)', '(cuda-gdb) info cuda threads', '  BlockIdx ThreadIdx To BlockIdx ThreadIdx Count  ...', '* (0,0,0)  (0,0,0)    (0,0,0)  (31,0,0)    32'], code: 'addArrays<<<dimGrid, dimBlock>>>(dev_a, dev_b, dev_c, ARRAY_SIZE);', say: '<code>info cuda kernels</code> shows running kernels; <code>info cuda threads</code> shows threads grouped by block and warp. Threads in one <b>warp</b> (32) always execute in lock-step, so they are listed together.' },
      { t: 'Switch focus to another thread', term: ['(cuda-gdb) cuda block 5 thread 3', '[Switching focus to CUDA kernel 0, grid 1, block (5,0,0), thread (3,0,0), device 0, sm 1, warp 0, lane 3]', '(cuda-gdb) print blockIdx.x', '$1 = 5', '(cuda-gdb) print threadIdx.x', '$2 = 3'], stack: ['addArrays<<<(79,1,1),(128,1,1)>>> (size=10000)  [block 5, thread 3]'], vars: { size: 10000, 'blockIdx.x': 5, 'threadIdx.x': 3 }, code: 'int tid = threadIdx.x + blockIdx.x * blockDim.x;',
        say: '<code>cuda block 5 thread 3</code> changes the <b>focus</b> to a different thread: all variable prints now refer to that thread\'s registers. Built-in variables <code>blockIdx</code>, <code>threadIdx</code> are visible.' },
      { t: 'Execute one line and inspect tid', term: ['(cuda-gdb) next', '14	    if (tid < size) {', '(cuda-gdb) print tid', '$3 = 643', '(cuda-gdb) print blockDim.x', '$4 = 128'], vars: { size: 10000, 'blockIdx.x': 5, 'threadIdx.x': 3, tid: '643  (= 3 + 5*128)' }, code: ['int tid = threadIdx.x + blockIdx.x * blockDim.x;', 'if (tid < size) {'], say: 'After <code>next</code>, <code>tid = 3 + 5 &times; 128 = <b>643</b></code>. This thread will compute <code>c[643]</code>. Stepping works per <em>warp</em>, so the other threads of the warp advance too.' },
      { t: 'The guard for the extra threads', term: ['(cuda-gdb) cuda block 78 thread 127', '(cuda-gdb) next', '(cuda-gdb) print tid', '$5 = 10111', '(cuda-gdb) print tid < size', '$6 = 0'], vars: { size: 10000, 'blockIdx.x': 78, 'threadIdx.x': 127, tid: '10111', 'tid < size': 0 }, code: ['// condition omits the extra threads launched', 'if (tid < size) {'],
        say: '79 &times; 128 = 10112 threads exist but only 10000 elements. The last thread (block 78, thread 127) has <code>tid = 10111 &ge; size</code>, so <code>if (tid &lt; size)</code> is false and it does nothing &mdash; without the guard it would write out of bounds.' },
      { t: 'Let the kernel finish', term: ['(cuda-gdb) delete', '(cuda-gdb) continue', '0 + 0 = 0', '1 + 2 = 3', '...', '[Inferior 1 (process 4242) exited normally]'], code: 'c[tid] = a[tid] + b[tid];', say: 'Delete the breakpoint and <code>continue</code>: every thread (in bounds) computes <code>c[tid] = a[tid] + b[tid]</code>, and the CPU prints the 10,000 sums.' }
    ],
    notes: ['The terminal text is <b>abridged and illustrative</b> (block, SM and warp numbers will differ on your GPU).', 'This folder also holds prebuilt debug binaries (<code>debug</code>, <code>info</code>, <code>matMul</code>) and two Nsight Systems captures (<code>report1.nsys-rep</code>, <code>report2.nsys-rep</code>); see the next pages.', 'Useful commands: <code>info cuda kernels|blocks|threads|devices</code>, <code>cuda block X thread Y</code>, <code>set cuda memcheck on</code>.']
  }));

  /* ---------- reuse info / matMul with cuda-gdb compile flags ---------- */
  PDC.add(PDC.cudaBuilders.info(Object.assign({ id: 'info' }, cgdb, { files: [CG + 'info.cu'], title: 'info.cu (debug build)', summary: 'The device-query program from the CUDA basics, built with <code>-g -G</code> so it can be stepped through in <code>cuda-gdb</code>.',
    notes: ['Same program as <code>pdc/cuda/src/info.cu</code>; only the compile comment differs (<code>-g -G</code>).', 'Try <code>break main</code>, <code>next</code>, <code>print iProp.warpSize</code> in <code>cuda-gdb</code> after the properties are filled in.'] })));
  PDC.add(PDC.cudaBuilders.matmul(Object.assign({ id: 'matMul' }, cgdb, { files: [CG + 'matMul.cu'], title: 'matMul.cu (debug build)', summary: 'The four-way matrix multiply built with <code>-g -G</code> to practise debugging a kernel with shared memory and <code>__syncthreads()</code>.' }),
    { notes: ['Same source as <code>pdc/cuda/src/matMul.cu</code>; the comment at the top gives the debug compile line (<code>nvcc -g -G -o matMul matMul.cu</code>).', 'In <code>cuda-gdb</code>: <code>break matMulGPUShared</code>, then <code>print As[0][0]</code> or <code>info cuda blocks</code>.'] }));

  /* ---------- Nsight Systems timeline (illustrative) ---------- */
  PDC.add(Object.assign({ id: 'nsys-timeline' }, cgdb, {
    title: 'Reading an Nsight Systems timeline', files: [CG + 'matMul.cu'], concepts: ['nsys profile', 'timeline rows', 'H2D / D2H memcpy', 'kernel duration', 'CUDA API vs GPU time'],
    summary: 'The folder contains two Nsight Systems captures of the matrix-multiply program. This page explains how such a timeline is read: CPU rows, CUDA API calls, memory copies and kernels.',
    kind: 'gantt', scene: { rows: ['CPU thread (main)', 'CUDA API calls', 'GPU: memory copies', 'GPU: kernels'], span: 20, labw: 140, unit: 'illustrative - open report1.nsys-rep / report2.nsys-rep for the real numbers' },
    steps: [
      { t: 'Capture with nsys', code: ['compile: nvcc -g -G -o matMul matMul.cu', 'run: ./matMul'], total: '$ nsys profile -o report1 ./matMul', say: '<code>nsys profile -o report1 ./matMul</code> runs the program and records a timeline (<code>report1.nsys-rep</code>) that you open in the Nsight Systems GUI or summarise with <code>nsys stats</code>.' },
      { t: 'CPU: allocation and setup', bars: [{ row: 0, s: 0, d: 4, label: 'malloc + init', c: 0 }, { row: 1, s: 4, d: 2, label: 'cudaMalloc', c: 4 }], code: ['h_A = (float *)malloc(size);', 'cudaMalloc((void**)&d_A, size);'], say: 'Host-side set-up and the first <code>cudaMalloc</code> (which also creates the CUDA context) appear in the CPU and CUDA-API rows. The first CUDA call is typically the slowest.' },
      { t: 'Host-to-device copies', bars: [{ row: 1, s: 6, d: 1, label: 'cudaMemcpy', c: 4 }, { row: 2, s: 6, d: 1.5, label: 'HtoD A', c: 1 }, { row: 2, s: 7.5, d: 1.5, label: 'HtoD B', c: 1 }], code: 'cudaMemcpy(d_A, h_A, size, cudaMemcpyHostToDevice);', say: 'Each <code>cudaMemcpy</code> in the API row corresponds to a bar in the GPU <em>memory</em> row. The API call may start earlier than the actual transfer.' },
      { t: 'The two kernels', bars: [{ row: 1, s: 9, d: 0.5, label: 'launch', c: 4 }, { row: 3, s: 9.5, d: 5, label: 'matMulGPU (global memory)', c: 2 }, { row: 1, s: 14.5, d: 0.5, label: 'launch', c: 4 }, { row: 3, s: 15, d: 2.5, label: 'matMulGPUShared', c: 3 }], code: ['matMulGPU<<<dimGrid, dimBlock>>>(d_A, d_B, d_C1, WIDTH);', 'matMulGPUShared<<<dimGrid, dimBlock>>>(d_A, d_B, d_C2, WIDTH);'],
        say: 'A launch is a short API call; the kernel itself appears in the GPU kernel row and is usually much longer. Here the shared-memory kernel bar is shorter than the global-memory one &mdash; that comparison is the point of the program. (Bar lengths are illustrative.)' },
      { t: 'Device-to-host copy and finish', bars: [{ row: 1, s: 17.5, d: 1, label: 'cudaMemcpy', c: 4 }, { row: 2, s: 17.5, d: 1.5, label: 'DtoH', c: 1 }, { row: 0, s: 19, d: 1, label: 'compare', c: 0 }], mark: { t: 19, label: 'results compared' }, code: ['cudaMemcpy(h_C2, d_C2, size, cudaMemcpyDeviceToHost);', 'int matricesAreEqual3 = matCompare(h_C3, h_C2, WIDTH);'],
        say: 'The results are copied back (<code>cudaMemcpy</code> waits for the kernels) and compared on the CPU. Gaps in the GPU rows are time the GPU is idle &mdash; what you look for when optimising.' }
    ],
    notes: ['<code>report1.nsys-rep</code> and <code>report2.nsys-rep</code> are <b>real</b> captures committed in the repository: open them with <code>nsys-ui</code> or run <code>nsys stats report1.nsys-rep</code>.', 'The times on this page are <b>illustrative</b>; they show the structure of a timeline, not measured values.']
  }));
})();
