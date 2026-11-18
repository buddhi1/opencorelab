/* Tiny syntax highlighter (C / C++ / CUDA / Python / shell / Makefile) - no dependencies.
   highlight(text, lang) -> array of HTML strings, one per source line. */
(function () {
  'use strict';
  const PDC = window.PDC;

  const C_KEYWORDS = new Set(('if else for while do switch case default break continue return goto sizeof typedef struct union enum ' +
    'static extern inline const volatile register restrict class template namespace using new delete public private ' +
    'true false NULL nullptr auto __global__ __device__ __host__ __shared__ __constant__ __restrict__ __forceinline__ __thread __syncthreads').split(' '));
  const C_TYPES = new Set(('int long short char float double void unsigned signed bool size_t ssize_t dim3 uint8_t int64_t ' +
    'cudaError_t cudaEvent_t cudaStream_t cudaDeviceProp pthread_t pthread_attr_t pthread_mutex_t pthread_cond_t pthread_barrier_t pthread_key_t ' +
    'MPI_Status MPI_Request MPI_Comm MPI_Group MPI_Datatype MPI_Op MPI_Aint FILE').split(' '));
  const C_API = /^(cuda\w+|cu[A-Z]\w+|MPI_\w+|pthread_\w+|omp_\w+|threadIdx|blockIdx|blockDim|gridDim|warpSize|atomicAdd|printf|malloc|free|rand_r|gettimeofday)$/;

  const PY_KEYWORDS = new Set(('import from as def class return if elif else for while in not and or is None True False with try except finally ' +
    'lambda pass break continue yield global nonlocal raise assert del print').split(' '));

  const RE_C = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[ \t]*\w+)|(\b0x[0-9a-fA-F]+\b|\b\d+\.?\d*(?:[eE][+-]?\d+)?[fFuUlL]*\b)|(<<<|>>>)|(\b[A-Za-z_]\w*\b)/gm;
  const RE_PY = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b0x[0-9a-fA-F]+\b|\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|(@\w+)|(\b[A-Za-z_]\w*\b)/g;
  const RE_SH = /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'[^'\n]*')|(\$\{?\w+\}?)|(\b\d+\b)|(\b[A-Za-z_][\w-]*\b)/g;

  function langOf(path) {
    const n = path.toLowerCase();
    if (/\.(c|h|cu|cuh|cpp|cc|hpp)$/.test(n)) return 'c';
    if (/\.(py|ipynb)$/.test(n)) return 'py';
    if (/\.(sh|job|bash)$/.test(n) || /makefile$/.test(n)) return 'sh';
    return 'txt';
  }

  /* Append piece (which may contain newlines) to line buffers, wrapping each line piece in a span. */
  function emit(lines, cls, text) {
    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push('');
      if (parts[i] === '') continue;
      const e = PDC.esc(parts[i]);
      lines[lines.length - 1] += cls ? '<span class="tk-' + cls + '">' + e + '</span>' : e;
    }
  }

  function run(text, re, classify) {
    const lines = [''];
    let last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) emit(lines, '', text.slice(last, m.index));
      const cls = classify(m);
      emit(lines, cls, m[0]);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < text.length) emit(lines, '', text.slice(last));
    return lines;
  }

  PDC.highlight = function (text, lang) {
    text = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    if (lang === 'c') {
      return run(text, RE_C, function (m) {
        if (m[1]) return 'cm';
        if (m[2]) return 'str';
        if (m[3]) return 'pp';
        if (m[4]) return 'num';
        if (m[5]) return 'launch';
        const w = m[6];
        if (C_API.test(w)) return 'api';
        if (C_KEYWORDS.has(w)) return 'kw';
        if (C_TYPES.has(w)) return 'ty';
        return '';
      });
    }
    if (lang === 'py') {
      return run(text, RE_PY, function (m) {
        if (m[1]) return 'cm';
        if (m[2]) return 'str';
        if (m[3]) return 'num';
        if (m[4]) return 'pp';
        return PY_KEYWORDS.has(m[5]) ? 'kw' : '';
      });
    }
    if (lang === 'sh') {
      return run(text, RE_SH, function (m) {
        if (m[1]) return /^#SBATCH/.test(m[1]) ? 'pp' : 'cm';
        if (m[2]) return 'str';
        if (m[3]) return 'api';
        if (m[4]) return 'num';
        return '';
      });
    }
    return text.split('\n').map(PDC.esc);
  };

  PDC.langOf = langOf;
})();
