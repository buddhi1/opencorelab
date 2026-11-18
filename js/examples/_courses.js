/* Course and topic structure. The order here is the order of the sidebar. */
PDC.defineCourse({
  id: 'pdc', short: 'PDC', title: 'Parallel & Distributed Computing',
  blurb: 'Shared-memory threads, message passing, GPUs and distributed deep learning &mdash; from <code>pthread_create</code> to multi-GPU training.',
  topics: [
    { id: 'pthreads', title: 'POSIX threads', blurb: 'Create, join, cancel and detach threads; protect shared data with mutexes; coordinate with barriers and condition variables; see false sharing.' },
    { id: 'gdb', title: 'Debugging with gdb', blurb: 'Four tiny C programs with a planted bug each. Watch a debugger session find the bug.' },
    { id: 'openmp-basics', title: 'OpenMP basics', blurb: 'Parallel regions, thread ids, race conditions and the two ways to fix them, and the first work-sharing loops.' },
    { id: 'openmp-directives', title: 'OpenMP directives & clauses', blurb: 'One program per directive or clause: <code>sections</code>, <code>single</code>, <code>task</code>, <code>private</code>, <code>reduction</code>, <code>schedule</code>, <code>nowait</code>.' },
    { id: 'mpi', title: 'MPI', blurb: 'Distributed-memory programming: ranks, point-to-point messages, collectives, non-blocking communication, communicators and custom datatypes.' },
    { id: 'cuda-basics', title: 'CUDA basics', blurb: 'Kernels, grids, blocks and threads; the host/device workflow; shared-memory reductions; CPU vs GPU matrix multiply.' },
    { id: 'cuda-debug', title: 'cuda-gdb & profiling', blurb: 'Stepping through a kernel with <code>cuda-gdb</code> and reading Nsight Systems timelines.' },
    { id: 'cuda-matmul', title: 'CUDA matrix-multiply progression', blurb: 'From one block, to many blocks, to shared-memory tiles and register tiling &mdash; plus reductions and a coalescing benchmark.' },
    { id: 'cuda-advanced', title: 'CUDA streams, multi-GPU & occupancy', blurb: 'NVIDIA-sample programs: overlapping copies with compute, several GPUs, zero-copy memory, occupancy and cooperative groups.' },
    { id: 'openmp-offload', title: 'OpenMP GPU offload', blurb: 'The CUDA matrix-multiply and reduction kernels rewritten with <code>target teams</code> &mdash; teams are blocks, threads are threads.' },
    { id: 'dnn', title: 'Distributed DNN training', blurb: 'Data parallelism with TensorFlow, pipeline parallelism and mixed precision in PyTorch, and Horovod.' }
  ]
});

PDC.defineCourse({
  id: 'hpml', short: 'HPML', title: 'High-Performance Machine Learning',
  blurb: 'GPU performance for ML workloads and scaling training across GPUs and nodes with TensorFlow, Keras 3, JAX and PyTorch.',
  topics: [
    { id: 'cluster', title: 'Working on the cluster', blurb: 'Getting files onto an HPC cluster, reserving GPUs with SLURM and setting up the conda environments the examples expect.' },
    { id: 'cuda-fundamentals', title: 'CUDA fundamentals & multi-GPU', blurb: 'The CUDA basics with proper timing, atomics vs shared memory, and two ways to drive several GPUs for one matrix multiply.' },
    { id: 'cuda-performance', title: 'CUDA performance pitfalls', blurb: 'Warp divergence, uncoalesced memory access and shared-memory bank conflicts &mdash; each with a benchmark and an Nsight Compute metric.' },
    { id: 'tensorflow', title: 'TensorFlow introduction', blurb: 'Tensors, a first neural network, convolutions and transfer learning from the Colab notebooks.' },
    { id: 'dp-single-node', title: 'Data parallelism: one node', blurb: 'MirroredStrategy, CentralStorage, Keras 3 on JAX (data and model parallel), and PyTorch DDP.' },
    { id: 'dp-multi-node', title: 'Data parallelism: many nodes', blurb: 'MultiWorkerMirroredStrategy with a custom loop, ParameterServerStrategy, and cross-node JAX collectives.' },
    { id: 'homework', title: 'Homework', blurb: 'The 2026 data-parallel assignment: VGG16 on CIFAR-100 with MirroredStrategy.' }
  ]
});
