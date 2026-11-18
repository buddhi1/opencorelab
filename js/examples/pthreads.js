/* POSIX threads examples (pdc/pthreads/src). */
(function () {
  'use strict';
  const D = 'pdc/pthreads/src/';
  const base = { course: 'pdc', topic: 'pthreads' };
  const T4 = ['main', 'T0', 'T1', 'T2', 'T3'];
  const forks = [[0, 1], [0, 2], [0, 3], [0, 4]];
  const each = function (txt, cls, span) { return [1, 2, 3, 4].map(function (l) { return [l, typeof txt === 'function' ? txt(l - 1) : txt, cls, span]; }); };

  /* ---------- 1-cancel ---------- */
  PDC.add(Object.assign({}, base, {
    id: '1-cancel', title: 'Create and cancel threads', files: [D + '1-cancel.c'],
    summary: 'Four threads are created and each prints its id. <code>main</code> sleeps, then asks the threads to stop with <code>pthread_cancel</code>.',
    concepts: ['pthread_create', 'pthread_cancel', 'thread function', 'argument passing'],
    kind: 'lanes', scene: { lanes: T4, colw: 112 },
    steps: [
      { t: 'main creates four threads', col: 0, ev: [[0, 'create ×4']].concat(each('start', 'sys')), link: forks, code: ['pthread_create(&threads[i]', 'int idx[TC];'],
        say: 'Each <code>pthread_create</code> starts a new thread running <code>thread_func</code>. The id is passed as a <em>pointer to <code>idx[i]</code></em> &mdash; every thread gets its own array element, so the ids cannot be overwritten by the loop counter.' },
      { t: 'The threads run concurrently', col: 1, ev: each(function (i) { return 'printf\n"I am thread ' + i + '"'; }), code: 'void *thread_func>>return NULL;',
        say: 'The threads print in <b>no guaranteed order</b> &mdash; it depends on the scheduler. After printing, <code>thread_func</code> returns and the thread ends.' },
      { t: 'main goes to sleep', col: 2, ev: [[0, 'sleep(5)', 'wait', 3]].concat(each('finished', 'done', 3)), code: 'sleep(5);',
        say: 'The comment says "kill all four threads after 5 seconds", but these short threads finished long ago.' },
      { t: 'pthread_cancel ×4', col: 5, ev: [[0, 'cancel ×4']].concat(each('(already done)', 'done')), link: forks, code: 'pthread_cancel(threads[i]);',
        say: '<code>pthread_cancel</code> only <em>requests</em> cancellation. A thread that is still running stops at its next <b>cancellation point</b> (such as <code>sleep</code> or <code>read</code>); a thread that has already returned is unaffected.' },
      { t: 'main returns', col: 6, ev: [[0, 'return 0', 'sys']], code: 'return 0;',
        say: 'When <code>main</code> returns, the whole process ends. Note that the threads were never <em>joined</em>; <code>2-join.c</code> shows the more usual way to wait for them.' }
    ],
    notes: ['Passing <code>&amp;idx[i]</code> (not <code>&amp;i</code>) avoids a data race on the loop variable.', 'Cancellation is cooperative: the target must reach a cancellation point.'],
    tryit: ['Make <code>thread_func</code> loop forever with <code>sleep(1)</code> inside and see <code>pthread_cancel</code> stop it.', 'Remove <code>sleep(5)</code>: do all four threads still get to print before <code>main</code> exits?']
  }));

  /* ---------- 2-join ---------- */
  PDC.add(Object.assign({}, base, {
    id: '2-join', title: 'Join: wait for threads to finish', files: [D + '2-join.c'],
    summary: 'The same four threads, but <code>main</code> calls <code>pthread_join</code> on each, so it cannot exit before the threads are done.',
    concepts: ['pthread_join', 'fork-join', 'synchronisation'],
    kind: 'lanes', scene: { lanes: T4, colw: 112 },
    steps: [
      { t: 'Fork: create the threads', col: 0, ev: [[0, 'create ×4']].concat(each('start', 'sys')), link: forks, code: 'pthread_create(&threads[i]',
        say: 'Same start as before: four threads begin executing <code>thread_func</code>.' },
      { t: 'main waits for T0', col: 1, ev: [[0, 'join(T0)', 'wait', 2]].concat(each(function (i) { return 'printf\n"I am thread ' + i + '"'; })), code: ['pthread_join(threads[i], NULL);', 'printf("I am thread'],
        say: '<code>pthread_join(threads[0])</code> <b>blocks</b> <code>main</code> until thread 0 returns. Meanwhile the other threads keep running; the print order is still arbitrary.' },
      { t: 'Joining T1, T2, T3', col: 3, ev: [[0, 'join T1…T3', 'wait']].concat(each('returned', 'done')), code: 'pthread_join(threads[i], NULL);',
        say: 'Threads that finished early are joined instantly. <code>join</code> also frees the thread\'s resources and can return the thread\'s result (here <code>NULL</code> is ignored).' },
      { t: 'Join: all threads done', col: 4, ev: [[0, 'return 0', 'good']], code: 'return 0;',
        say: 'The <b>fork-join</b> pattern: <code>main</code> forks work, then joins it. It is now guaranteed that all four threads completed before <code>main</code> returns.' }
    ],
    notes: ['Every joinable thread should be joined (or detached) exactly once.', 'Join is the simplest synchronisation: it orders "thread finished" before "main continues".'],
    tryit: ['Print the thread id <em>after</em> the join loop in <code>main</code>. Is the order now deterministic?']
  }));

  /* ---------- 3-detach ---------- */
  PDC.add(Object.assign({}, base, {
    id: '3-detach', title: 'Detached threads', files: [D + '3-detach.c'],
    summary: 'Threads block on <code>getchar()</code>. After 3 seconds <code>main</code> detaches them, so the following <code>pthread_join</code> calls fail instantly instead of waiting.',
    concepts: ['pthread_detach', 'joinable vs detached', 'process exit'],
    kind: 'lanes', scene: { lanes: T4, colw: 112 },
    steps: [
      { t: 'Threads start and block on input', col: 0, ev: [[0, 'create ×4']].concat(each('print id\ngetchar()', 'wait', 1)), link: forks, code: ['getchar();', 'pthread_create(&threads[i]'],
        say: 'Each thread prints its id, then waits for a key press (<code>getchar()</code>). Without a key press, they stay blocked.' },
      { t: 'main sleeps 3 seconds', col: 1, ev: [[0, 'sleep(3)', 'wait']], code: 'sleep(3);', say: 'The threads are still blocked in <code>getchar()</code>.' },
      { t: 'pthread_detach each thread', col: 2, ev: [[0, 'detach ×4', 'lock']], link: forks, code: 'pthread_detach(threads[i]);',
        say: 'A <b>detached</b> thread cleans up after itself when it ends, and can no longer be joined. The threads keep running &mdash; detaching does not stop them.' },
      { t: 'pthread_join now fails', col: 3, ev: [[0, 'join → EINVAL', 'bad']], code: 'pthread_join(threads[i], NULL);',
        say: 'Joining a detached thread returns an error immediately (the program ignores the return value), so <code>main</code> does <b>not</b> wait.' },
      { t: 'main returns: process exits', col: 4, ev: [[0, 'return 0', 'sys']].concat(each('killed', 'bad')), code: 'return 0;',
        say: 'Returning from <code>main</code> ends the process and takes every thread with it, even those still blocked. Detached threads do not keep a process alive.' }
    ],
    notes: ['Use <code>detach</code> for fire-and-forget threads whose result you do not need.', 'A detached thread must not use data that belongs to a function that has already returned.'],
    tryit: ['Press Enter several times while <code>main</code> is sleeping. Which threads finish?']
  }));

  /* ---------- 4-mutex ---------- */
  PDC.add(Object.assign({}, base, {
    id: '4-mutex', title: 'Mutex: protect a shared counter', files: [D + '4-mutex.c'],
    summary: 'Four threads increment one shared integer. A mutex lets only one thread at a time read-modify-write it, so no update is lost.',
    concepts: ['pthread_mutex_t', 'critical section', 'shared data', 'struct passed to threads'],
    kind: 'lanes', scene: { lanes: T4, colw: 118, vars: { shared: 10, mutex: { v: 'free', cls: 'good' } } },
    steps: [
      { t: 'Threads start; the mutex is free', col: 0, ev: [[0, 'init mutex\ncreate ×4']].concat(each('start', 'sys')), link: forks, code: ['pthread_mutex_init(&mutex, NULL);', 'pthread_create(&threads[i]'],
        say: 'Each thread receives a <code>thread_data</code> struct holding its id, a pointer to the shared integer and a pointer to the mutex.' },
      { t: 'T2 wins the lock', col: 1, ev: [[3, 'lock()', 'lock'], [1, 'lock() …', 'wait'], [2, 'lock() …', 'wait'], [4, 'lock() …', 'wait']], set: { mutex: { v: 'held by T2', cls: 'locked' } }, code: 'pthread_mutex_lock(data->mutex_pointer);',
        say: 'All threads call <code>lock</code> at about the same time. Exactly one succeeds (here T2); the others <b>block</b> until the mutex is released.' },
      { t: 'Critical section: read, add, write', col: 2, ev: [[3, 'old=10\nnew=11', 'lock']], set: { shared: 11 }, code: ['int oldValue = *(data->shared_pointer);', '(*data->shared_pointer)++;'],
        say: 'Only the lock holder executes this code, so the read&nbsp;&rarr;&nbsp;increment&nbsp;&rarr;&nbsp;write sequence cannot be interleaved with another thread.' },
      { t: 'Unlock: the next thread proceeds', col: 3, ev: [[3, 'unlock()', 'good'], [1, 'old=11\nnew=12', 'lock'], [2, 'lock() …', 'wait'], [4, 'lock() …', 'wait']], set: { shared: 12, mutex: { v: 'held by T0', cls: 'locked' } }, code: 'pthread_mutex_unlock(data->mutex_pointer);',
        say: '<code>unlock</code> wakes one waiter. The order in which waiting threads get the lock is up to the system.' },
      { t: 'The rest take their turn', col: 4, ev: [[1, 'unlock()', 'good'], [2, 'old=12\nnew=13', 'lock'], [4, 'lock() …', 'wait']], set: { shared: 13, mutex: { v: 'held by T1', cls: 'locked' } }, code: 'printf("Tid=%d => old_value=%d new_value=%d\\n",',
        say: 'Each thread prints the old and new value it saw. Because of the mutex, the values are always consecutive: 10&rarr;11, 11&rarr;12, 12&rarr;13, 13&rarr;14.' },
      { t: 'Join and print the final value', col: 6, ev: [[0, 'join ×4\nshared = 14', 'good'], [2, 'unlock()', 'good'], [4, 'old=13\nnew=14', 'lock']], set: { shared: 14, mutex: { v: 'free', cls: 'good' } }, code: ['pthread_mutex_destroy(&mutex);', 'printf("Final value of'],
        say: 'Four increments of 10 always give <b>14</b>. Without the mutex two threads could read the same old value and one update would be lost (see the <code>rc.c</code> OpenMP example for the same race).' }
    ],
    notes: ['The mutex and the data it protects must be shared by all threads (here through pointers in the struct).', 'Keep critical sections short: while one thread holds the lock, the others do nothing.'],
    tryit: ['Comment out the lock/unlock calls and run many times. Does <code>shared</code> ever end up below 14?']
  }));

  /* ---------- 5-barrier ---------- */
  PDC.add(Object.assign({}, base, {
    id: '5-barrier', title: 'Barrier: wait for everyone', files: [D + '5-barrier.c'],
    summary: 'Every thread prints "first part", then waits at a barrier. Nobody prints "second part" until all four have arrived.',
    concepts: ['pthread_barrier_t', 'phases', 'synchronisation point'],
    kind: 'lanes', scene: { lanes: T4, colw: 112 },
    steps: [
      { t: 'Barrier initialised for 4 threads', col: 0, ev: [[0, 'barrier_init(4)\ncreate ×4']].concat(each('start', 'sys')), link: forks, code: ['pthread_barrier_init(&barrier, NULL, TC);'],
        say: 'The barrier is told how many threads must arrive before it opens: <code>TC = 4</code>.' },
      { t: 'First part (any order)', col: 1, ev: each(function (i) { return 'first part\n(thread ' + i + ')'; }), code: 'printf("Thread %d in first part\\n", id);',
        say: 'The threads work on phase one at different speeds.' },
      { t: 'Early arrivals wait', col: 2, ev: [[1, 'barrier_wait', 'wait', 2], [2, 'barrier_wait', 'wait', 2], [3, 'barrier_wait', 'wait', 2]], code: 'pthread_barrier_wait(&barrier);',
        say: 'Threads that reach <code>pthread_barrier_wait</code> early are <b>blocked</b>. T0 and T1 are waiting for the slower threads.' },
      { t: 'The last thread arrives: barrier opens', col: 3, ev: [[4, 'barrier_wait\n(last!)', 'lock']], bar: { at: 4, lanes: 'all', label: 'barrier opens' }, code: 'pthread_barrier_wait(&barrier);',
        say: 'When the 4th thread arrives, all waiting threads are released together.' },
      { t: 'Second part: after everyone', col: 4, ev: each(function (i) { return 'second part\n(thread ' + i + ')'; }), code: 'printf("Thread %d in second part\\n", id);',
        say: 'Every "first part" line is guaranteed to appear before any "second part" line. Barriers separate the phases of a parallel algorithm.' }
    ],
    notes: ['A barrier needs <em>all</em> participating threads: if one thread never arrives, the others wait forever (deadlock).'],
    tryit: ['Change the barrier count to 5 while creating 4 threads. What happens?']
  }));

  /* ---------- 6-cond ---------- */
  PDC.add(Object.assign({}, base, {
    id: '6-cond', title: 'Condition variables: signal vs broadcast', files: [D + '6-cond.c'],
    summary: 'Threads sleep on a condition variable. <code>main</code> wakes them one at a time with <code>pthread_cond_signal</code>, then all at once with <code>pthread_cond_broadcast</code>.',
    concepts: ['pthread_cond_t', 'wait / signal / broadcast', 'mutex + condition', 'waiters counter'],
    kind: 'lanes', scene: { lanes: T4, colw: 118, vars: { waiters: 0, phase: 'one by one' } },
    steps: [
      { t: 'Threads go to sleep', col: 0, ev: each('lock;\nwaiters++\ncond_wait', 'wait'), set: { waiters: 4 }, code: ['waiters++;', 'pthread_cond_wait(&cond, &mutex);'],
        say: 'Each thread takes the mutex, increments <code>waiters</code>, then calls <code>pthread_cond_wait</code>. That call <b>atomically releases the mutex and sleeps</b>; when woken it re-acquires the mutex before returning.' },
      { t: 'main wakes ONE thread', col: 1, ev: [[0, 'Enter →\ncond_signal', 'lock'], [2, 'wakes up\n"Thread 1 wakes"', 'run']], set: { waiters: 3 }, link: [[0, 2]], code: ['pthread_cond_signal(&cond);', 'waiters--;'],
        say: '<code>pthread_cond_signal</code> wakes at least one waiting thread (usually exactly one). Which one is up to the system. <code>main</code> decremented <code>waiters</code> itself so it knows how many are left.' },
      { t: 'Repeat until nobody is waiting', col: 2, ev: [[0, 'signal ×3 more', 'lock'], [1, '"Thread 0 wakes"', 'run'], [3, '"Thread 2 wakes"', 'run'], [4, '"Thread 3 wakes"', 'run']], set: { waiters: 0 }, link: [[0, 1], [0, 3], [0, 4]], code: 'if(waiters > 0){',
        say: 'Each Enter key press wakes one more thread. When <code>waiters</code> reaches 0 the loop <code>break</code>s.' },
      { t: 'Barrier separates the two demos', col: 3, ev: [[0, 'barrier_wait', 'wait'], [1, 'barrier_wait', 'wait'], [2, 'barrier_wait', 'wait'], [3, 'barrier_wait', 'wait'], [4, 'barrier_wait', 'wait']], set: { phase: 'barrier' }, code: 'pthread_barrier_wait(&barrier);',
        say: 'The barrier has <code>TC+1</code> participants: the four threads <em>and</em> <code>main</code>. It makes sure all wake-ups of demo 1 are finished before demo 2 starts.' },
      { t: 'Threads sleep again', col: 4, ev: each('cond_wait', 'wait'), set: { waiters: 4, phase: 'all at once' }, code: ['waiters++;#2', 'pthread_cond_wait(&cond, &mutex);#2'],
        say: 'Each thread increments <code>waiters</code> and waits on the same condition variable a second time.' },
      { t: 'main broadcasts', col: 5, ev: [[0, 'cond_broadcast', 'lock']].concat(each('wakes', 'run')), set: { waiters: 0 }, link: forks, code: 'pthread_cond_broadcast(&cond);',
        say: '<code>pthread_cond_broadcast</code> wakes <b>all</b> waiting threads. They take the mutex one after another, so their "Thread n wakes" lines come out in some order.' }
    ],
    notes: ['A condition variable has no memory: a signal sent when nobody is waiting is lost. That is why the program counts <code>waiters</code>.', 'Always wait inside a <code>while</code> loop that re-checks the condition (see the producer / consumer example).'],
    tryit: ['Remove <code>sleep(1)</code> before the first signal. Can a signal now be lost?']
  }));

  /* ---------- 7-local_storage ---------- */
  PDC.add(Object.assign({}, base, {
    id: '7-local_storage', title: 'Thread-local storage (__thread)', files: [D + '7-local_storage.c'],
    summary: 'A global declared <code>__thread</code> looks like a normal global, but every thread gets its <em>own copy</em>.',
    concepts: ['__thread', 'thread-local storage', 'global vs thread-private'],
    kind: 'diagram',
    scene: {
      w: 760, h: 340,
      groups: [{ x: 10, y: 10, w: 740, h: 150, label: 'one process: the same variable name, four separate memory locations' }],
      nodes: {
        T0: { x: 30, y: 44, w: 150, h: 96, label: 'thread 0', sub: 'tls_data', c: 0, cells: ['?'] }, T1: { x: 204, y: 44, w: 150, h: 96, label: 'thread 1', sub: 'tls_data', c: 1, cells: ['?'] },
        T2: { x: 378, y: 44, w: 150, h: 96, label: 'thread 2', sub: 'tls_data', c: 2, cells: ['?'] }, T3: { x: 552, y: 44, w: 150, h: 96, label: 'thread 3', sub: 'tls_data', c: 3, cells: ['?'] },
        G: { x: 250, y: 205, w: 260, h: 100, label: 'plain global int (hypothetical)', sub: 'ONE copy shared by all four', cls: 'bad', cells: ['?'], hidden: true }
      }
    },
    steps: [
      { t: 'Each thread has its own tls_data', pulse: ['T0', 'T1', 'T2', 'T3'], code: '__thread int tls_data;',
        say: 'The <code>__thread</code> keyword (a GCC extension; C11 calls it <code>_Thread_local</code>) tells the compiler to create one instance of the variable <b>per thread</b>.' },
      { t: 'Every thread writes its id', set: { T0: { cells: [{ v: 0, c: 'c0' }] }, T1: { cells: [{ v: 1, c: 'c1' }] }, T2: { cells: [{ v: 2, c: 'c2' }] }, T3: { cells: [{ v: 3, c: 'c3' }] } }, code: ['tls_data = id;', 'printf("Thread %d set its value'],
        say: 'All four threads run <code>tls_data = id;</code> at the same time. There is no race, because they are writing different memory locations.' },
      { t: 'Barrier: everyone has written', pulse: ['T0', 'T1', 'T2', 'T3'], code: 'pthread_barrier_wait(&barrier);',
        say: 'The barrier guarantees every thread has finished writing before any thread reads. This is exactly the situation where a <em>shared</em> global would be overwritten.' },
      { t: 'Each thread reads back its own value', mark: { T0: [0], T1: [0], T2: [0], T3: [0] }, code: 'printf("Thread %d\'s thread-local-storage value is %d\\n", id, tls_data);',
        say: 'Every thread prints its <em>own</em> id. The values survived the other threads\' writes.' },
      { t: 'Contrast: a plain global', show: ['G'], set: { G: { cells: [{ v: 3, c: 'bad' }] } }, flow: [{ from: 'T0', to: 'G', label: '0', cls: 'bad' }, { from: 'T1', to: 'G', label: '1', cls: 'bad', delay: 0.2 }, { from: 'T2', to: 'G', label: '2', cls: 'bad', delay: 0.4 }, { from: 'T3', to: 'G', label: '3', cls: 'bad', delay: 0.6 }],
        say: 'Hypothetically, with an ordinary <code>int</code> global all threads would write the same location, and after the barrier every thread would see only the <b>last writer\'s</b> value.' }
    ],
    notes: ['Thread-local variables are initialised per thread and need no locking.', '<code>8-key.c</code> shows the older POSIX API for the same idea.']
  }));

  /* ---------- 8-key ---------- */
  PDC.add(Object.assign({}, base, {
    id: '8-key', title: 'Thread-specific data with keys', files: [D + '8-key.c'],
    summary: 'One shared <code>pthread_key_t</code> acts as a name; each thread stores its own pointer under that key with <code>pthread_setspecific</code>.',
    concepts: ['pthread_key_create', 'pthread_setspecific / getspecific', 'per-thread pointer'],
    kind: 'diagram',
    scene: {
      w: 760, h: 330,
      edges: [['K', 'S0', { dash: true }], ['K', 'S1', { dash: true }], ['K', 'S2', { dash: true }], ['K', 'S3', { dash: true }]],
      nodes: {
        K: { x: 280, y: 14, w: 200, h: 62, label: 'key (one shared handle)', sub: 'pthread_key_t key', cls: 'mem' },
        S0: { x: 20, y: 120, w: 160, h: 96, label: 'T0 slot[key]', c: 0, cells: ['NULL'] }, S1: { x: 200, y: 120, w: 160, h: 96, label: 'T1 slot[key]', c: 1, cells: ['NULL'] },
        S2: { x: 380, y: 120, w: 160, h: 96, label: 'T2 slot[key]', c: 2, cells: ['NULL'] }, S3: { x: 560, y: 120, w: 160, h: 96, label: 'T3 slot[key]', c: 3, cells: ['NULL'] },
        V0: { x: 20, y: 245, w: 160, h: 56, label: 'int id (T0 stack)', sub: 'value 0', c: 0, hidden: true }, V1: { x: 200, y: 245, w: 160, h: 56, label: 'int id (T1 stack)', sub: 'value 1', c: 1, hidden: true },
        V2: { x: 380, y: 245, w: 160, h: 56, label: 'int id (T2 stack)', sub: 'value 2', c: 2, hidden: true }, V3: { x: 560, y: 245, w: 160, h: 56, label: 'int id (T3 stack)', sub: 'value 3', c: 3, hidden: true }
      }
    },
    steps: [
      { t: 'main creates the key', pulse: ['K'], code: 'pthread_key_create(&key, NULL);',
        say: 'A key is a small integer-like handle that is <b>the same in every thread</b>. Behind it, the system keeps one slot per thread, initially <code>NULL</code>.' },
      { t: 'Each thread stores a pointer', show: ['V0', 'V1', 'V2', 'V3'], set: { S0: { cells: [{ v: '&id', c: 'c0' }] }, S1: { cells: [{ v: '&id', c: 'c1' }] }, S2: { cells: [{ v: '&id', c: 'c2' }] }, S3: { cells: [{ v: '&id', c: 'c3' }] } },
        flow: [{ from: 'V0', to: 'S0', cls: 'ok' }, { from: 'V1', to: 'S1', cls: 'ok' }, { from: 'V2', to: 'S2', cls: 'ok' }, { from: 'V3', to: 'S3', cls: 'ok' }], code: 'pthread_setspecific(key, &id);',
        say: '<code>pthread_setspecific(key, &amp;id)</code> writes <em>this thread\'s</em> slot. The value is just a <code>void*</code>, here the address of the thread\'s own local variable <code>id</code>.' },
      { t: 'Barrier', pulse: ['S0', 'S1', 'S2', 'S3'], code: 'pthread_barrier_wait(&barrier);', say: 'All slots are filled before anybody reads, again proving that threads do not overwrite one another.' },
      { t: 'getspecific returns my pointer', mark: { S0: [0], S1: [0], S2: [0], S3: [0] }, code: ['key_data = (int*)pthread_getspecific(key);', 'printf("Thread %d\'s thread-specific value is %d (addr %p) \\n"'],
        say: 'The same call <code>pthread_getspecific(key)</code> returns a <b>different pointer in each thread</b>. The printed addresses differ, and each value equals the thread\'s own id.' },
      { t: 'Delete the key', hide: ['V0', 'V1', 'V2', 'V3'], code: 'pthread_key_delete(key);', say: 'After all threads are joined, <code>main</code> deletes the key. (The optional destructor passed to <code>pthread_key_create</code> was <code>NULL</code> here.)' }
    ],
    notes: ['Compared with <code>__thread</code>, keys are dynamic: you can create them at run time and attach a destructor.', 'The slot stores a <em>pointer</em>; the thread is responsible for keeping what it points to alive.']
  }));

  /* ---------- 9-consumer_producer ---------- */
  PDC.add(Object.assign({}, base, {
    id: '9-consumer_producer', title: 'Producers and consumers', files: [D + '9-consumer_producer.c'],
    summary: 'Consumers wait until a product exists; producers make one and signal. A mutex protects the counter and a condition variable avoids busy-waiting.',
    concepts: ['condition variable', 'while-loop re-check', 'producer / consumer', 'avoid busy waiting'],
    kind: 'lanes', scene: { lanes: ['C0', 'C1', 'P0', 'P1'], colw: 124, vars: { products: 0 } },
    steps: [
      { t: 'Consumers arrive first', col: 0, ev: [[0, 'lock; products==0\ncond_wait', 'wait'], [1, 'lock; products==0\ncond_wait', 'wait']], code: ['while(products == 0)', 'pthread_cond_wait(&cond, &mutex);'],
        say: 'There is nothing to consume, so each consumer sleeps in <code>pthread_cond_wait</code> (the mutex is released while sleeping). <em>Four of each exist in the code; two are drawn.</em>' },
      { t: 'A producer makes a product', col: 1, ev: [[2, 'lock\nproducts++', 'lock']], set: { products: 1 }, code: ['products++;', 'printf("producer %d made a product\\n", id);'],
        say: 'The producer takes the mutex and increments the shared counter.' },
      { t: 'Signal and unlock', col: 2, ev: [[2, 'cond_signal\nunlock', 'good']], link: [[2, 0]], code: ['pthread_cond_signal(&cond);', 'pthread_mutex_unlock(&mutex);'],
        say: '<code>cond_signal</code> wakes one sleeping consumer. It cannot continue until the producer releases the mutex.' },
      { t: 'Consumer wakes and re-checks', col: 3, ev: [[0, 'wake; products=1\nproducts--', 'lock']], set: { products: 0 }, code: ['products--;', 'while(products == 0)'],
        say: 'The woken consumer re-acquires the mutex and <b>checks the condition again</b>. It finds a product, takes it (<code>products--</code>), and continues.' },
      { t: 'Why a while loop, not an if?', col: 4, ev: [[1, 'spurious wake-up\nproducts==0 → wait again', 'wait', 1], [0, 'consumed!', 'good']], code: 'while(products == 0)',
        say: 'Between the signal and the moment a thread actually runs, another thread may have taken the product, or the system may wake a thread <em>spuriously</em>. With <code>while</code>, a consumer that finds nothing simply goes back to sleep. With <code>if</code>, it would consume a product that does not exist.' },
      { t: 'The second pair', col: 5, ev: [[3, 'produce + signal', 'good'], [1, 'wakes; consumes', 'good']], link: [[3, 1]], set: { products: 0 }, code: ['pthread_join(consumers[i], NULL);', 'pthread_mutex_destroy(&mutex);'],
        say: 'Producer P1 repeats the cycle for consumer C1. In the real program all four consumers and four producers eventually pair up, <code>products</code> returns to 0, and <code>main</code> joins everyone.' }
    ],
    notes: ['Rule of thumb: <code>lock; while(!condition) wait; use; unlock</code>.', 'Producers that signal while holding the mutex are simple and safe; signalling after unlock is also legal.']
  }));

  /* ---------- Monte-Carlo pi: shared darts for 10, 11, 12 ---------- */
  const seed = (function () { let s = 7; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  const darts = [];
  for (let i = 0; i < 24; i++) { const x = seed(), y = seed(); darts.push({ x: x, y: y, t: Math.floor(i / 6), inside: (x - .5) * (x - .5) + (y - .5) * (y - .5) < .25 }); }
  const hitsBy = [0, 0, 0, 0]; darts.forEach(function (d) { if (d.inside) hitsBy[d.t]++; });
  const totalHits = hitsBy.reduce(function (a, b) { return a + b; }, 0);
  const piEst = (4 * totalHits / darts.length).toFixed(2);
  const piNodes = { board: { x: 30, y: 54, w: 220, h: 220, label: '', cls: '' }, circ: { x: 30, y: 54, w: 220, h: 220, shape: 'circle', label: '', cls: 'ok' },
    cap: { x: 30, y: 276, w: 220, h: 30, shape: 'text', label: 'unit square, circle of radius 0.5' } };
  darts.forEach(function (d, i) { piNodes['d' + i] = { x: 30 + d.x * 220 - 6, y: 54 + (1 - d.y) * 220 - 6, w: 12, h: 12, shape: 'circle', c: d.t, cls: d.inside ? '' : 'dim', hidden: true }; });
  for (let t = 0; t < 4; t++) piNodes['T' + t] = { x: 300, y: 36 + t * 66, w: 170, h: 56, label: 'thread ' + t, sub: '6 darts · hits = ?', c: t, hidden: true };
  piNodes.arr = { x: 520, y: 36, w: 220, h: 120, label: 'hits[ ] (shared array)', cells: ['?', '?', '?', '?'], cw: 40, cls: 'mem', hidden: true };
  piNodes.sum = { x: 520, y: 176, w: 220, h: 90, label: 'main', sub: 'total_hits = ?', hidden: true, cls: 'cpu' };
  const piScene = function () { return { w: 760, h: 330, nodes: JSON.parse(JSON.stringify(piNodes)) }; };
  const dartIds = function (t) { const a = []; darts.forEach(function (d, i) { if (d.t === t) a.push('d' + i); }); return a; };
  const allDarts = darts.map(function (_, i) { return 'd' + i; });
  const hitCells = hitsBy.map(function (h, i) { return { v: h, c: 'c' + i }; });

  PDC.add(Object.assign({}, base, {
    id: '10-pi', title: 'Monte Carlo π with local counters', files: [D + '10-pi.c'],
    summary: 'Threads throw random darts at a unit square; the fraction landing inside the inscribed circle estimates π/4. Each thread counts hits in a <em>local</em> variable.',
    concepts: ['data decomposition', 'rand_r (thread-safe RNG)', 'local accumulation', 'speed-up'],
    kind: 'diagram', scene: piScene(),
    steps: [
      { t: 'The idea', code: ['#define PI 3.1415926535', 'sample_points_per_thread = sample_points / num_threads;'],
        say: 'The circle (radius 0.5) covers π/4 &asymp; 78.5 % of the unit square, so <code>4 &times; hits / points</code> approaches π. The points are split evenly: <code>sample_points / num_threads</code> darts per thread. (The picture uses 24 darts, 6 per thread.)' },
      { t: 'Create the threads', show: ['T0', 'T1', 'T2', 'T3', 'arr', 'sum'], code: ['pthread_create(&p_threads[i], &attr, compute_pi', 'hits[i] = i;'],
        say: 'Each thread gets a pointer to its own slot <code>hits[i]</code>. The slot first holds the thread\'s <b>seed</b> (<code>hits[i] = i</code>), so the threads generate different random numbers.' },
      { t: 'All threads throw darts', show: allDarts, pulse: ['T0', 'T1', 'T2', 'T3'], code: ['rand_no_x =(double)(rand_r(&seed))/(double)(RAND_MAX);', 'local_hits ++;'],
        say: 'Each thread draws <code>x</code>, <code>y</code> with <code>rand_r</code> (the re-entrant generator: its state is the thread\'s own <code>seed</code>) and tests whether the point is inside the circle. Solid dots are hits.' },
      { t: 'Counting in a local variable', set: { T0: { sub: '6 darts · hits = ' + hitsBy[0] }, T1: { sub: '6 darts · hits = ' + hitsBy[1] }, T2: { sub: '6 darts · hits = ' + hitsBy[2] }, T3: { sub: '6 darts · hits = ' + hitsBy[3] } }, code: 'int local_hits;>>local_hits ++;',
        say: '<code>local_hits</code> lives in a register / the thread\'s stack, so incrementing it never touches memory shared with other threads. This is the fast version &mdash; compare with <code>11-pi_spaced_1.c</code>.' },
      { t: 'Write the result once', set: { arr: { cells: hitCells } }, flow: [0, 1, 2, 3].map(function (t) { return { from: 'T' + t, to: 'arr', label: hitsBy[t], delay: t * 0.12 }; }), code: '*hit_pointer = local_hits;',
        say: 'Only at the very end does each thread store its count into <code>hits[i]</code>: <b>one</b> shared write per thread.' },
      { t: 'Join and add up', set: { sum: { sub: 'total_hits = ' + totalHits } }, flow: [{ from: 'arr', to: 'sum', label: '+' }], code: ['pthread_join(p_threads[i], NULL);', 'total_hits += hits[i];'],
        say: '<code>main</code> joins each thread and adds its <code>hits[i]</code> to <code>total_hits</code>.' },
      { t: 'Estimate π', set: { sum: { sub: 'total_hits = ' + totalHits + '\nπ ≈ 4·' + totalHits + '/24 = ' + piEst, cls: 'ok' } }, code: 'computed_pi = 4.0*(double) total_hits',
        say: 'With only 24 darts the estimate is rough (' + piEst + '). With millions of points it converges to 3.14159&hellip;. The program then repeats everything with <b>1 thread</b> to print the measured speed-up.' }
    ],
    notes: ['The "sequential" run still creates one thread, so it includes a little thread overhead (the source comments say so).', 'Run it with 1, 2, 4, 8 threads on a large point count and plot the speed-up.'],
    tryit: ['Try <code>100000000</code> points with 1, 2, 4 and 8 threads. Where does the speed-up flatten?']
  }));

  /* false sharing diagrams */
  const cacheScene = function (sep) {
    const n = {};
    for (let c = 0; c < 4; c++) n['core' + c] = { x: 20 + c * 180, y: 224, w: 160, h: 94, label: 'core ' + c, sub: 'private L1 cache', c: c, cells: sep ? [{ v: '—', c: 'empty' }] : [{ v: '—', c: 'empty' }, { v: '—', c: 'empty' }, { v: '—', c: 'empty' }, { v: '—', c: 'empty' }], cw: 32 };
    if (!sep) {
      n.line = { x: 210, y: 42, w: 340, h: 92, label: 'ONE 64-byte cache line in memory', sub: 'hits[0..3] are neighbours', cls: 'mem', cells: [{ v: 'h0', c: 'c0' }, { v: 'h1', c: 'c1' }, { v: 'h2', c: 'c2' }, { v: 'h3', c: 'c3' }], cw: 46 };
    } else {
      for (let c = 0; c < 4; c++) n['line' + c] = { x: 20 + c * 180, y: 42, w: 160, h: 92, label: 'cache line ' + c, sub: 'counter + 31 unused', cls: 'mem', cells: [{ v: 'h' + c, c: 'c' + c }, { v: 'pad', c: 'empty' }], cw: 46 };
    }
    return { w: 760, h: 340, nodes: n };
  };
  PDC.add(Object.assign({}, base, {
    id: '11-pi_spaced_1', title: 'False sharing: adjacent counters', files: [D + '11-pi_spaced_1.c'],
    summary: 'Same π program, but each thread increments <code>hits[i]</code> directly in the loop. The four counters sit in one cache line, so the cores keep stealing it from each other.',
    concepts: ['false sharing', 'cache line', 'cache coherence', 'performance bug'],
    kind: 'diagram', scene: cacheScene(false),
    steps: [
      { t: 'Neighbouring counters, one cache line', pulse: ['line'], code: ['int total_hits, total_misses, hits[MAX_THREADS],', '(*hit_pointer)++;'],
        say: 'The array <code>hits[]</code> holds four <code>int</code>s next to each other: 16 bytes, i.e. <b>one</b> 64-byte cache line. Each thread only touches <em>its own</em> element &mdash; but the hardware moves data in whole cache lines.' },
      { t: 'Core 0 increments hits[0]', set: { core0: { cells: [{ v: 'h0', c: 'c0' }, { v: 'h1', c: 'c1' }, { v: 'h2', c: 'c2' }, { v: 'h3', c: 'c3' }] } }, flow: [{ from: 'line', to: 'core0', label: 'line', cls: 'hot' }], code: '(*hit_pointer)++;',
        say: 'Core 0 loads the line and gets exclusive ownership so it can write.' },
      { t: 'Core 1 increments hits[1]', set: { core0: { cells: [{ v: '✗', c: 'bad' }, { v: '✗', c: 'bad' }, { v: '✗', c: 'bad' }, { v: '✗', c: 'bad' }] }, core1: { cells: [{ v: 'h0', c: 'c0' }, { v: 'h1', c: 'c1' }, { v: 'h2', c: 'c2' }, { v: 'h3', c: 'c3' }] } },
        flow: [{ from: 'core0', to: 'core1', label: 'line', cls: 'bad' }], code: '(*hit_pointer)++;',
        say: 'Core 1 writes a <em>different</em> integer in the same line, so the coherence protocol <b>invalidates</b> core 0\'s copy and ships the line to core 1.' },
      { t: 'The line ping-pongs', set: { core1: { cells: [{ v: '✗', c: 'bad' }, { v: '✗', c: 'bad' }, { v: '✗', c: 'bad' }, { v: '✗', c: 'bad' }] }, core2: { cells: [{ v: 'h0', c: 'c0' }, { v: 'h1', c: 'c1' }, { v: 'h2', c: 'c2' }, { v: 'h3', c: 'c3' }] } },
        flow: [{ from: 'core1', to: 'core2', label: 'line', cls: 'bad' }, { from: 'core2', to: 'core3', label: 'line', cls: 'bad', delay: 0.5 }], code: 'for (i = 0; i < sample_points_per_thread; i++) {',
        say: 'Every increment in every thread now forces the line to move between cores. These coherence misses cost far more than the increment itself, and they happen millions of times.' },
      { t: 'Result: no speed-up (or slower)', code: ['//local_hits ++;', '(*hit_pointer)++;//Plot spaced_1'],
        say: 'The threads are logically independent but physically serialised. Compare the timings with <code>10-pi.c</code> (local counter) &mdash; the comment in the source says "observe the effect of false-sharing".' }
    ],
    notes: ['False sharing is invisible in the source: the program is <em>correct</em>, just slow.', 'Fixes: accumulate in a local variable (<code>10-pi.c</code>) or pad each counter to its own cache line (<code>12-pi_spaced_32.c</code>).'],
    tryit: ['Run <code>10-pi</code>, <code>11-pi_spaced_1</code> and <code>12-pi_spaced_32</code> with 8 threads and 10<sup>8</sup> points and compare the "Parallel Time".']
  }));

  PDC.add(Object.assign({}, base, {
    id: '12-pi_spaced_32', title: 'Fixing false sharing with padding', files: [D + '12-pi_spaced_32.c'],
    summary: 'The counters are declared <code>hits[MAX_THREADS][32]</code>: each thread uses element <code>[i][0]</code>, which is 128 bytes away from the next thread\'s counter.',
    concepts: ['padding', 'cache-line alignment', 'false sharing fix'],
    kind: 'diagram', scene: cacheScene(true),
    steps: [
      { t: 'Pad each counter', pulse: ['line0', 'line1', 'line2', 'line3'], code: ['#define MAX_SPACE  32', 'hits[MAX_THREADS][MAX_SPACE]'],
        say: 'A second dimension of 32 ints (128 bytes) is added. Thread <i>i</i> uses <code>hits[i][0]</code>; the other 31 ints are just spacing, so <b>each counter lives in its own cache line</b>.' },
      { t: 'Each core owns its line', set: { core0: { cells: [{ v: 'h0', c: 'c0' }] }, core1: { cells: [{ v: 'h1', c: 'c1' }] }, core2: { cells: [{ v: 'h2', c: 'c2' }] }, core3: { cells: [{ v: 'h3', c: 'c3' }] } },
        flow: [0, 1, 2, 3].map(function (c) { return { from: 'line' + c, to: 'core' + c, label: 'line', cls: 'ok' }; }), code: '(*hit_pointer)++;',
        say: 'Each core fetches <em>its</em> line once and then keeps it in its private cache.' },
      { t: 'No invalidations', pulse: ['core0', 'core1', 'core2', 'core3'], code: 'for (i = 0; i < sample_points_per_thread; i++) {',
        say: 'Increments hit in L1 and no other core ever touches those lines, so there is <b>no coherence traffic</b>. The four threads really do run in parallel.' },
      { t: 'Compare with the local-variable version', code: ['hits[i][0] = i;', 'total_hits += hits[i][0];'],
        say: 'Padding fixes the slowdown but wastes memory (127 of every 128 bytes unused here). Using a local accumulator, as in <code>10-pi.c</code>, is usually the better fix.' }
    ],
    notes: ['The source comment says "assess the secondary cache line size": 32 ints = 128 bytes covers 64- and 128-byte line sizes.'],
    tryit: ['Change <code>MAX_SPACE</code> to 4, 8, 16, 32 and watch where the speed-up appears.']
  }));
})();
