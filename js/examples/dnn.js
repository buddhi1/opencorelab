/* Distributed DNN training (pdc/dnn): TensorFlow MirroredStrategy, PyTorch pipeline + MoE + mixed precision, Horovod ring all-reduce. */
(function () {
  'use strict';
  const D = 'pdc/dnn/';
  const base = { course: 'pdc', topic: 'dnn' };
  const co = function (v, c) { return { v: v, c: c }; };
  const merge = function () { return Object.assign.apply(null, [{}].concat(Array.prototype.slice.call(arguments))); };
  const G4 = ['g0', 'g1', 'g2', 'g3'];

  /* ======================= MirroredStrategy (one node, several GPUs) ======================= */
  function mirroredScene() {
    const nodes = { data: { x: 250, y: 8, w: 260, h: 64, label: 'training data', sub: '60,000 MNIST images', cls: 'mem' } };
    for (let i = 0; i < 4; i++) nodes['g' + i] = { x: 20 + i * 182, y: 120, w: 165, h: 126, label: 'GPU ' + i, sub: 'replica ' + i, c: i, cells: [] , cw: 70, hidden: false };
    nodes.ar = { x: 150, y: 288, w: 460, h: 46, shape: 'pill', label: 'all-reduce (NCCL): sum the gradients', cls: 'hot', hidden: true };
    return { w: 760, h: 350, nodes: nodes };
  }
  const mirroredSteps = function (code) {
    return [
      { t: 'The strategy finds the GPUs', pulse: G4, set: { g0: { sub: '/device:GPU:0' }, g1: { sub: '/device:GPU:1' }, g2: { sub: '/device:GPU:2' }, g3: { sub: '/device:GPU:3' } }, code: [code.strategy, code.devices],
        say: '<code>tf.distribute.MirroredStrategy()</code> detects <b>all GPUs on this machine</b> (the sample run in the repo used 8 A100s; the picture shows 4). <code>strategy.num_replicas_in_sync</code> is the number of <b>replicas</b>.' },
      { t: 'Global batch = per-replica batch &times; replicas', flow: G4.map(function (g, i) { return { from: 'data', to: g, label: 64, delay: i * 0.1 }; }), set: { data: { sub: 'one global batch = 256 images' }, g0: { cells: [co('64 imgs', 'c0')] }, g1: { cells: [co('64 imgs', 'c1')] }, g2: { cells: [co('64 imgs', 'c2')] }, g3: { cells: [co('64 imgs', 'c3')] } }, code: [code.per, code.batch],
        say: 'The code asks for <b>64 images per GPU</b>, so the batch given to <code>fit</code> is <code>64 &times; N</code>. With 4 GPUs: 256 images, which Keras splits into 4 shards of 64.' },
      { t: 'The model is built inside strategy.scope()', set: { g0: { cells: [co('W', 'c0'), co('64 imgs', 'c0')] }, g1: { cells: [co('W', 'c1'), co('64 imgs', 'c1')] }, g2: { cells: [co('W', 'c2'), co('64 imgs', 'c2')] }, g3: { cells: [co('W', 'c3'), co('64 imgs', 'c3')] } }, pulse: G4, code: [code.scope, code.model],
        say: 'Everything created inside <code>with strategy.scope():</code> is <b>mirrored</b>: every GPU gets its own <em>identical copy</em> of the weights (a <code>MirroredVariable</code>). Model and optimizer must be created in this scope.' },
      { t: 'Each GPU: forward and backward on its shard', set: { g0: { cells: [co('W', 'c0'), co('∇₀', 'hot')] }, g1: { cells: [co('W', 'c1'), co('∇₁', 'hot')] }, g2: { cells: [co('W', 'c2'), co('∇₂', 'hot')] }, g3: { cells: [co('W', 'c3'), co('∇₃', 'hot')] } }, pulse: G4, code: code.fit,
        say: 'Every GPU runs the model on <b>its own 64 images</b> and computes the gradient <code>&nabla;</code> of the loss with respect to its (identical) weights. Because the data differ, the four gradients differ.' },
      { t: 'All-reduce: add the gradients across GPUs', show: ['ar'], flow: G4.map(function (g, i) { return { from: g, to: 'ar', label: '∇', cls: 'hot', delay: i * 0.1 }; }), code: code.fit,
        say: 'The gradients are combined with an <b>all-reduce</b> (NCCL by default on GPUs; <code>HierarchicalCopyAllReduce</code> and <code>ReductionToOneDevice</code> are alternatives). This is the only communication in a training step.' },
      { t: 'Everyone applies the same update', hide: ['ar'], flow: G4.map(function (g, i) { return { from: 'ar', to: g, label: 'Σ∇', cls: 'ok', delay: i * 0.1 }; }), set: { g0: { cells: [co("W'", 'ok'), co('Σ∇', 'ok')] }, g1: { cells: [co("W'", 'ok'), co('Σ∇', 'ok')] }, g2: { cells: [co("W'", 'ok'), co('Σ∇', 'ok')] }, g3: { cells: [co("W'", 'ok'), co('Σ∇', 'ok')] } }, code: code.compile,
        say: 'Each GPU receives the <b>same summed gradient</b> and runs the same optimizer step (Adam), so all replicas stay <b>bit-for-bit identical</b>. That is <em>synchronous data parallelism</em>.' },
      { t: 'Checkpoint and evaluate', code: [code.ckpt, code.eval], say: '<code>ModelCheckpoint</code> saves the weights after each epoch (any replica holds the full model), and <code>model.evaluate</code> measures accuracy on the test set (about 97 % after 2 epochs in the sample output).' }
    ];
  };
  const mnistCode = { strategy: 'strategy = tf.distribute.MirroredStrategy()', devices: "print('Number of devices: {}'.format(strategy.num_replicas_in_sync))", per: 'BATCH_SIZE_PER_REPLICA = 64', batch: 'BATCH_SIZE = BATCH_SIZE_PER_REPLICA * strategy.num_replicas_in_sync',
    scope: 'with strategy.scope():', model: 'model = tf.keras.models.Sequential([', compile: "model.compile(optimizer='adam',", fit: 'model.fit(x_train, y_train, epochs=2, batch_size=BATCH_SIZE, callbacks=[cp_callback])',
    ckpt: 'cp_callback = tf.keras.callbacks.ModelCheckpoint(filepath=checkpoint_path,', eval: 'model.evaluate(x_test,  y_test, verbose=2)' };
  PDC.cudaBuilders.mirrored = function (o) {
    return merge({
      title: 'MirroredStrategy: data parallelism on one node', concepts: ['tf.distribute.MirroredStrategy', 'replicas', 'global vs per-replica batch', 'all-reduce of gradients', 'strategy.scope()'],
      summary: 'A large MLP is trained on MNIST with <b>synchronous data parallelism</b>: every GPU holds a full copy of the model, processes its own slice of each batch, and gradients are summed across GPUs.',
      kind: 'diagram', scene: mirroredScene(), steps: mirroredSteps(mnistCode),
      notes: ['The effective batch size grows with the number of GPUs; learning rates are often scaled accordingly.', 'Throughput scales almost linearly until the all-reduce (bandwidth) or the input pipeline becomes the bottleneck.'],
      tryit: ['Run with <code>CUDA_VISIBLE_DEVICES=0</code>, <code>0,1</code>, <code>0,1,2,3</code> and compare the time per epoch.']
    }, o);
  };
  PDC.add(PDC.cudaBuilders.mirrored(Object.assign({ id: 'mnist_parallel' }, base, {
    files: [D + 'tensorflow_1_node-n_gpu/mnist_parallel.py', D + 'tensorflow_1_node-n_gpu/mnist_parallel.job'],
    links: [{ label: 'Hands-on slides (PPTX)', href: PDC.repoUrl(D + 'tensorflow_1_node-n_gpu/data_parallel-handson.pptx') }, { label: 'Hands-on slides (PDF)', href: PDC.repoUrl(D + 'tensorflow_1_node-n_gpu/data_parallel-handson.pdf') }, { label: 'Sample output (DGX A100)', href: PDC.repoUrl(D + 'tensorflow_1_node-n_gpu/output-dgx.txt') }]
  })));

  /* ======================= Pipeline parallelism (gantt) ======================= */
  const P = D + 'pytorch/pipeline_plus_mixedprecision.py';
  const pipeBars = function (f1, f2, m, off) {
    const bars = [];
    for (let k = 0; k < m; k++) {
      bars.push({ row: 0, s: off + k * f1, d: f1, label: 'F' + k, c: k });
      bars.push({ row: 1, s: off + (k + 1) * f1 - f1 + f1, d: f2, label: 'F' + k, c: k });
    }
    return bars;
  };
  PDC.add(Object.assign({ id: 'pipeline_plus_mixedprecision' }, base, {
    title: 'Pipeline parallelism (GPipe) across two GPUs', files: [P], concepts: ['model parallelism', 'fairscale Pipe', 'micro-batches (chunks)', 'pipeline bubble', 'stage balancing'],
    summary: 'The network is cut into two <b>stages</b>, one per GPU. A batch is split into 4 micro-batches that flow through the stages like an assembly line, so both GPUs are busy at once.',
    kind: 'gantt', scene: { rows: ['GPU 0: stage 1 (conv + FC)', 'GPU 1: stage 2 (gate + experts)'], span: 14, labw: 178, unit: 'illustrative time units' },
    steps: [
      { t: 'Cut the model into stages', code: ['class MoEStage1(nn.Module):', 'class MoEStage2(nn.Module):'], say: 'Model parallelism puts <em>different layers</em> on different GPUs, useful when the model does not fit on one GPU. <code>MoEStage1</code> (conv trunk + fully connected layers) goes to <code>cuda:0</code>, <code>MoEStage2</code> (gate + experts) to <code>cuda:1</code>.' },
      { t: 'Naive: one batch at a time', bars: [{ row: 0, s: 0, d: 4, label: 'forward', c: 0 }, { row: 1, s: 4, d: 4, label: 'forward', c: 0 }, { row: 1, s: 8, d: 4, label: 'backward', c: 1 }, { row: 0, s: 12, d: 2, label: 'bwd', c: 1 }], total: 'each GPU idles about half of the time', code: ['s1   = MoEStage1(base).to("cuda:0")', 's2   = MoEStage2(base).to("cuda:1")'],
        say: 'If the whole batch goes through stage 1 and <em>then</em> stage 2, GPU 1 waits for GPU 0 and the other way round: at any moment only one GPU is working.' },
      { t: 'GPipe: split the batch into micro-batches', clear: true, bars: [{ row: 0, s: 0, d: 1, label: 'F0', c: 0 }, { row: 0, s: 1, d: 1, label: 'F1', c: 1 }, { row: 0, s: 2, d: 1, label: 'F2', c: 2 }, { row: 0, s: 3, d: 1, label: 'F3', c: 3 }, { row: 1, s: 1, d: 1, label: 'F0', c: 0 }, { row: 1, s: 2, d: 1, label: 'F1', c: 1 }, { row: 1, s: 3, d: 1, label: 'F2', c: 2 }, { row: 1, s: 4, d: 1, label: 'F3', c: 3 }], code: ['pipe  = Pipe(', 'chunks=chunks,', 'def build_moe_pipeline(num_gpus=2, chunks=4, **moe_kwargs):'],
        say: '<code>chunks=4</code> cuts every batch into <b>4 micro-batches</b>. As soon as stage 1 finishes micro-batch 0, stage 2 starts on it while stage 1 already works on micro-batch 1. Now both GPUs overlap.' },
      { t: 'The backward pass runs in reverse', bars: [{ row: 1, s: 5, d: 1, label: 'B3', c: 3 }, { row: 1, s: 6, d: 1, label: 'B2', c: 2 }, { row: 1, s: 7, d: 1, label: 'B1', c: 1 }, { row: 1, s: 8, d: 1, label: 'B0', c: 0 }, { row: 0, s: 6, d: 1, label: 'B3', c: 3 }, { row: 0, s: 7, d: 1, label: 'B2', c: 2 }, { row: 0, s: 8, d: 1, label: 'B1', c: 1 }, { row: 0, s: 9, d: 1, label: 'B0', c: 0 }], mark: { t: 10, label: 'optimizer step' }, code: ['scaler.scale(loss).backward()', 'scaler.step(optimizer)'],
        say: 'Gradients flow backwards through the micro-batches, again overlapped. After all micro-batches are done the optimizer takes <b>one</b> step with the accumulated gradients.' },
      { t: 'The pipeline bubble', total: 'idle ("bubble") fraction = (stages - 1) / (micro-batches + stages - 1) = 1/5 = 20 %', code: 'balance=[1, 1],', say: 'At the start and end some GPU is unavoidably idle &mdash; the <b>bubble</b>. More micro-batches shrink it: with <i>m</i> micro-batches and <i>p</i> stages it is <code>(p&minus;1)/(m+p&minus;1)</code>. <code>balance=[1, 1]</code> puts one stage on each GPU.' },
      { t: 'This example\'s stages are unbalanced', clear: true, bars: [{ row: 0, s: 0, d: 1.5, label: 'F0', c: 0 }, { row: 0, s: 1.5, d: 1.5, label: 'F1', c: 1 }, { row: 0, s: 3, d: 1.5, label: 'F2', c: 2 }, { row: 0, s: 4.5, d: 1.5, label: 'F3', c: 3 }, { row: 1, s: 1.5, d: 0.5, label: 'F0', c: 0 }, { row: 1, s: 3, d: 0.5, label: 'F1', c: 1 }, { row: 1, s: 4.5, d: 0.5, label: 'F2', c: 2 }, { row: 1, s: 6, d: 0.5, label: 'F3', c: 3 }], total: 'stage 1 is much heavier: GPU 1 is mostly idle', code: '# this is kind of dumb because that first stage is much heavier',
        say: 'The source itself admits it: stage 1 (conv layers) is far heavier than stage 2 (the gating and expert heads). A pipeline is only as fast as its <b>slowest stage</b>, so good partitioning (equal work per stage) matters as much as micro-batching.' },
      { t: 'Data placement across GPUs', code: ['images = images.to("cuda:0")', 'labels = labels.to("cuda:1")'], say: 'Inputs go to the first stage\'s GPU; the labels go to the <b>last</b> stage\'s GPU, where the loss is computed.' }
    ],
    notes: ['Pipeline parallelism splits the <em>model</em>; data parallelism (MirroredStrategy, DDP) splits the <em>data</em>. Large systems combine both.', 'Requires <code>fairscale</code> and two GPUs; defaults (batch 4096, 100 epochs) are heavy.']
  }));

  /* ======================= Mixture of experts with loss-free balancing (diagram) ======================= */
  const expertScene = function () {
    const nodes = { h: { x: 20, y: 90, w: 150, h: 84, label: 'features h', sub: 'one vector / image', cls: 'mem' }, gate: { x: 215, y: 90, w: 190, h: 84, label: 'gating + expert_bias', sub: 'argmax picks ONE expert', cls: 'hot' } };
    for (let e = 0; e < 4; e++) nodes['e' + e] = { x: 470, y: 8 + e * 76, w: 270, h: 66, label: 'expert ' + e, sub: 'Linear(4096 → 100)', c: e, cells: [co('0', 'empty')], cw: 40 };
    nodes.bias = { x: 215, y: 215, w: 190, h: 70, label: 'expert_bias', sub: 'not trained by SGD', cls: 'mem', cells: [co('0', 'empty'), co('0', 'empty'), co('0', 'empty'), co('0', 'empty')], cw: 36 };
    return { w: 760, h: 312, nodes: nodes, edges: [['h', 'gate'], ['gate', 'e0', { dash: true }], ['gate', 'e1', { dash: true }], ['gate', 'e2', { dash: true }], ['gate', 'e3', { dash: true }], ['bias', 'gate', { dash: true }]] };
  };
  const cnt = function (a) { return { e0: { cells: [co(a[0], 'c0')] }, e1: { cells: [co(a[1], 'c1')] }, e2: { cells: [co(a[2], 'c2')] }, e3: { cells: [co(a[3], 'c3')] } }; };
  PDC.add(Object.assign({ id: 'moe_loss_free' }, base, {
    title: 'Mixture of experts with loss-free load balancing', files: [P], concepts: ['mixture of experts', 'top-1 gating', 'expert_bias', 'auxiliary-loss-free balancing'],
    summary: 'The classifier head has 4 expert layers; a gate sends each image to <b>one</b> of them. Instead of an extra loss term, a small bias is nudged after every batch to even out how often each expert is used.',
    kind: 'diagram', scene: expertScene(),
    steps: [
      { t: 'A shared trunk, several experts', code: ['class AlexNetMoELossFree(nn.Module):', 'self.experts     = nn.ModuleList(['], say: 'The conv trunk and two fully connected layers produce a feature vector <code>h</code> per image. Instead of one output layer there are <code>num_experts</code> separate output layers, the <b>experts</b>.' },
      { t: 'The gate scores the experts', flow: [{ from: 'h', to: 'gate', label: 'h' }], pulse: ['gate'], code: ['gate_scores = self.gating(h)', 'gate_scores + self.expert_bias'], say: '<code>self.gating(h)</code> gives one score per expert. The <code>expert_bias</code> buffer is <b>added</b> to those scores before choosing.' },
      { t: 'Each image goes to exactly one expert', flow: [{ from: 'gate', to: 'e0', label: '×5' }, { from: 'gate', to: 'e1', label: '×1', delay: 0.1 }, { from: 'gate', to: 'e2', label: '×2', delay: 0.2 }], set: cnt([5, 1, 2, 0]), code: ['torch.argmax(biased, dim=1)', 'self.experts[chosen[i]](h[i])'],
        say: '<code>argmax</code> picks the top-scoring expert per image (top-1 routing); only that expert runs. In this (made-up) batch of 8 images: expert 0 gets 5, expert 1 gets 1, expert 2 gets 2, expert 3 gets none &mdash; <b>unbalanced</b>.' },
      { t: 'Count the load', pulse: ['e0', 'e3'], code: ['expected = B / float(self.num_experts)', 'counts[idx] += 1'], say: '<code>update_expert_bias()</code> counts how many images each expert received and compares with the fair share <code>B / num_experts</code> = 8 / 4 = <b>2</b>.' },
      { t: 'Overloaded: bias down. Underloaded: bias up', set: { bias: { cells: [co('−γ', 'bad'), co('−γ', 'bad'), co('0', 'empty'), co('+γ', 'ok')] } }, flow: [{ from: 'e0', to: 'bias', label: '−γ', cls: 'bad' }, { from: 'e3', to: 'bias', label: '+γ', cls: 'ok', delay: 0.2 }], code: ['if counts[i] > expected:', 'self.expert_bias[i] -= self.gamma', 'elif counts[i] < expected:', 'self.expert_bias[i] += self.gamma'],
        say: 'Experts that got more than their share have their bias <b>lowered</b> by &gamma; (0.001); those with less get it <b>raised</b>. The bias is a registered <em>buffer</em>, updated by this rule, not by gradient descent.' },
      { t: 'Next batch is routed more evenly', set: merge(cnt([2, 2, 2, 2]), { bias: { cells: [co('−γ', 'bad'), co('0', 'empty'), co('0', 'empty'), co('+γ', 'ok')] } }), flow: [{ from: 'gate', to: 'e0', label: '×2' }, { from: 'gate', to: 'e1', label: '×2', delay: 0.1 }, { from: 'gate', to: 'e2', label: '×2', delay: 0.2 }, { from: 'gate', to: 'e3', label: '×2', delay: 0.3 }], code: 'stage2.update_expert_bias()',
        say: 'Over many batches the biases shift routing until each expert gets a fair share. This is called <b>loss-free</b> balancing because no auxiliary loss term is added to the training objective; the training loop simply calls <code>stage2.update_expert_bias()</code> after every optimizer step.' },
      { t: 'In the pipeline version', code: ['class MoEStage2(nn.Module):', 'self.register_buffer("expert_bias", moe_model.expert_bias.clone())'], say: '<code>MoEStage2</code> (the second pipeline stage, on <code>cuda:1</code>) holds the gate, the experts and their own copy of <code>expert_bias</code>, and exposes the same update function.' }
    ],
    notes: ['Mixture-of-experts models scale parameter count without scaling compute per input, because only one expert runs per image.', 'The per-sample Python loop over experts is simple but slow; production code uses batched dispatch.']
  }));

  /* ======================= Mixed precision (diagram) ======================= */
  PDC.add(Object.assign({ id: 'mixed_precision' }, base, {
    title: 'Automatic mixed precision (autocast + GradScaler)', files: [P], concepts: ['torch.cuda.amp', 'autocast', 'GradScaler / loss scaling', 'FP16 vs FP32', 'tensor cores'],
    summary: 'The forward pass runs in 16-bit floating point where safe (faster, half the memory); a loss scale keeps tiny gradients from vanishing; the weights themselves stay in 32-bit.',
    kind: 'diagram',
    scene: {
      w: 760, h: 350,
      edges: [['master', 'fwd'], ['fwd', 'loss'], ['loss', 'scaled'], ['scaled', 'bwd'], ['bwd', 'unscale'], ['unscale', 'opt'], ['opt', 'master', { dash: true }]],
      nodes: {
        master: { x: 20, y: 20, w: 200, h: 74, label: 'weights (FP32)', sub: 'master copy', cls: 'mem' },
        fwd: { x: 280, y: 20, w: 200, h: 74, label: 'forward (FP16)', sub: 'with autocast():', cls: 'gpu' },
        loss: { x: 540, y: 20, w: 200, h: 74, label: 'loss (FP32)', sub: 'CrossEntropyLoss', cls: 'cpu' },
        scaled: { x: 540, y: 140, w: 200, h: 74, label: 'loss × S', sub: 'S = scale factor, e.g. 65536', cls: 'hot' },
        bwd: { x: 280, y: 140, w: 200, h: 74, label: 'backward (FP16)', sub: 'gradients are scaled by S', cls: 'gpu' },
        unscale: { x: 20, y: 140, w: 200, h: 74, label: 'unscale ÷ S', sub: 'skip step if inf / NaN', cls: 'hot' },
        opt: { x: 20, y: 260, w: 200, h: 74, label: 'optimizer.step()', sub: 'updates FP32 weights', cls: 'ok' },
        upd: { x: 280, y: 260, w: 200, h: 74, label: 'scaler.update()', sub: 'grow S, or halve it after inf', cls: 'hot' }
      }
    },
    steps: [
      { t: 'Why mixed precision?', pulse: ['fwd'], code: ['from torch.cuda.amp import autocast, GradScaler', 'scaler    = GradScaler()'], say: 'FP16 uses half the memory and runs several times faster on tensor cores, but it has a small range and precision. <b>Mixed precision</b> uses FP16 where safe and keeps critical values (weights, loss, optimizer state) in FP32.' },
      { t: 'autocast: ops run in FP16 where safe', flow: [{ from: 'master', to: 'fwd', label: 'cast', cls: 'ok' }], pulse: ['fwd'], code: ['with autocast():', 'outputs = pipe_model(images)'], say: 'Inside <code>with autocast():</code>, PyTorch picks the precision per operation: convolutions and matrix multiplies run in FP16 on the fly (casting the FP32 weights), while loss-like and reduction ops stay in FP32.' },
      { t: 'The loss is computed in FP32', flow: [{ from: 'fwd', to: 'loss', label: 'out' }], pulse: ['loss'], code: 'loss = criterion(outputs, labels)', say: 'The loss function is evaluated inside <code>autocast</code> too, which keeps it in FP32 for accuracy.' },
      { t: 'Scale the loss up', flow: [{ from: 'loss', to: 'scaled', label: '×S', cls: 'hot' }], pulse: ['scaled'], code: 'scaler.scale(loss).backward()', say: 'Gradients in FP16 can be so small that they <b>underflow to zero</b>. <code>scaler.scale(loss)</code> multiplies the loss by a large factor <i>S</i> first; by the chain rule every gradient is multiplied by <i>S</i> too, pulling them into FP16\'s representable range.' },
      { t: 'Backward in FP16', flow: [{ from: 'scaled', to: 'bwd', label: '∇×S' }], pulse: ['bwd'], code: 'scaler.scale(loss).backward()', say: '<code>.backward()</code> computes the scaled gradients (they are stored as FP32 in the <code>.grad</code> fields of FP32 parameters).' },
      { t: 'Unscale, and skip the step on overflow', flow: [{ from: 'bwd', to: 'unscale', label: '÷S', cls: 'hot' }], pulse: ['unscale'], code: 'scaler.step(optimizer)', say: '<code>scaler.step(optimizer)</code> divides the gradients by <i>S</i> and checks for <b>inf/NaN</b>. If an overflow occurred, this optimizer step is <em>skipped</em> for the batch.' },
      { t: 'Update the FP32 weights', flow: [{ from: 'unscale', to: 'opt', label: '∇' }, { from: 'opt', to: 'master', label: 'W\'', cls: 'ok', delay: 0.4 }], pulse: ['opt', 'master'], code: 'scaler.step(optimizer)', say: 'The optimizer (SGD with momentum) updates the <b>FP32 master weights</b>: small updates are not lost to FP16 rounding.' },
      { t: 'Adapt the scale', pulse: ['upd'], code: ['scaler.update()', 'stage2.update_expert_bias()'], say: '<code>scaler.update()</code> adjusts <i>S</i>: after a run of good steps it grows, after an overflow it is halved. Finally the MoE bias update runs, then the loop repeats.' }
    ],
    notes: ['Newer PyTorch warns that <code>torch.cuda.amp</code> is deprecated in favour of <code>torch.amp</code>; the idea is the same.', 'BF16 has FP32\'s range, so with bfloat16 no loss scaling is needed.']
  }));

  /* ======================= Horovod: ring all-reduce (no source file; slides) ======================= */
  function ring() {
    const N = 4, steps = [];
    let g = [[1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3], [4, 4, 4, 4]];
    const cells = function (gr) { const o = {}; for (let i = 0; i < N; i++) o['g' + i] = { cells: gr[i].map(function (v, c) { return co(v, 'c' + c); }) }; return o; };
    const label = function (c) { return String.fromCharCode(97 + c); };
    steps.push({ t: 'Four workers, four gradient chunks', set: cells(g), pulse: G4, say: 'Each of the 4 GPUs has computed the gradient of its own mini-batch, cut into <b>4 chunks</b> (a, b, c, d &mdash; the four colours). Goal: every GPU must end up with the <b>sum</b> of all four gradients. (Values: GPU <i>i</i> holds <i>i</i>+1 in every chunk.)' });
    steps.push({ t: 'Naive all-reduce is a bottleneck', say: 'Sending everything to one GPU and back puts <em>all</em> the traffic on one link. Horovod uses a <b>ring all-reduce</b>: every GPU talks only to its two neighbours, and every link is busy all the time. The total data each GPU sends is about <code>2 &middot; (N&minus;1)/N</code> of the gradient size, <b>independent of N</b> &mdash; bandwidth-optimal.' });
    for (let s = 0; s < N - 1; s++) {
      const before = g.map(function (r) { return r.slice(); }), flows = [];
      for (let i = 0; i < N; i++) { const c = ((i - s) % N + N) % N, to = (i + 1) % N; g[to][c] = before[to][c] + before[i][c]; flows.push({ from: 'g' + i, to: 'g' + to, label: label(c), delay: i * 0.05, cls: 'hot' }); }
      steps.push({ t: 'Reduce-scatter, step ' + (s + 1) + ' of 3', set: cells(g), flow: flows, say: 'Every GPU sends one chunk to its right neighbour, which <b>adds</b> it to its own copy of that chunk. All four transfers happen at the same time on different links.' + (s === N - 2 ? ' Now every GPU owns <b>one chunk that is the complete sum</b> (value 10).' : '') });
    }
    for (let s = 0; s < N - 1; s++) {
      const before = g.map(function (r) { return r.slice(); }), flows = [];
      for (let i = 0; i < N; i++) { const c = (((i + 1 - s) % N) + N) % N, to = (i + 1) % N; g[to][c] = before[i][c]; flows.push({ from: 'g' + i, to: 'g' + to, label: label(c), delay: i * 0.05, cls: 'ok' }); }
      steps.push({ t: 'All-gather, step ' + (s + 1) + ' of 3', set: cells(g), flow: flows, say: 'Now the finished chunks travel around the ring and are simply <b>copied</b> (no addition). After 3 steps every GPU has all four summed chunks.' });
    }
    steps.push({ t: 'Done: every GPU has the same sum', set: cells(g), pulse: G4, say: 'The summed gradient is divided by the number of workers (averaging) and applied by the optimizer, so all replicas stay identical. Total: <code>2(N&minus;1)</code> = 6 steps, each moving 1/N of the data.' });
    return steps;
  }
  const horovodIntro = [
    { t: 'horovodrun starts one process per GPU', say: 'Horovod launches <b>one process per GPU</b> (using MPI under the hood for coordination). <code>hvd.init()</code> lets each process learn its <code>rank</code> and the world size, and each pins itself to its own GPU.' },
  ];
  const hvNodes = {};
  [[40, 24], [480, 24], [480, 190], [40, 190]].forEach(function (p, i) { hvNodes['g' + i] = { x: p[0], y: p[1], w: 240, h: 104, label: 'GPU ' + i + ' (rank ' + i + ')', c: i, cells: [co('', 'empty'), co('', 'empty'), co('', 'empty'), co('', 'empty')], cw: 48 }; });
  PDC.add(Object.assign({ id: 'horovod' }, base, {
    title: 'Horovod: ring all-reduce', files: [],
    links: [{ label: 'Horovod talk (PPTX, 14 slides)', href: PDC.repoUrl(D + 'horovod/horovod_iqrah.pptx') }],
    concepts: ['Horovod', 'hvd.DistributedOptimizer', 'ring all-reduce', 'synchronous data parallelism', 'MPI + NCCL'],
    summary: 'From the guest talk on distributed U-Net training for sea-ice classification: Horovod averages gradients across GPUs with a <b>ring all-reduce</b>. The animation runs the algorithm on 4 GPUs. (This folder has slides only, no code.)',
    kind: 'diagram', scene: { w: 760, h: 312, edges: [['g0', 'g1'], ['g1', 'g2'], ['g2', 'g3'], ['g3', 'g0']], nodes: hvNodes },
    steps: [].concat(horovodIntro.map(function (s) { return Object.assign({}, s, { set: { g0: { cells: [co('init', 'c0'), co('', 'empty'), co('', 'empty'), co('', 'empty')] }, g1: { cells: [co('init', 'c1'), co('', 'empty'), co('', 'empty'), co('', 'empty')] }, g2: { cells: [co('init', 'c2'), co('', 'empty'), co('', 'empty'), co('', 'empty')] }, g3: { cells: [co('init', 'c3'), co('', 'empty'), co('', 'empty'), co('', 'empty')] } } }); }), [
      { t: 'Wrap the optimizer; broadcast the start weights', flow: [{ from: 'g0', to: 'g1', label: 'W' }, { from: 'g1', to: 'g2', label: 'W', delay: 0.15 }, { from: 'g2', to: 'g3', label: 'W', delay: 0.3 }], say: '<code>opt = hvd.DistributedOptimizer(opt)</code> wraps the normal optimizer: its <code>compute_gradients</code> now includes an all-reduce. <code>hvd.broadcast_variables(root_rank=0)</code> copies rank 0\'s initial weights to everybody so all replicas start identical.' }
    ], ring()),
    notes: ['The talk trained a U-Net (4,224 images of 256&times;256, batch 32, 50 epochs) on a DGX A100 with 8 GPUs, using synchronized data parallelism <em>without</em> parameter servers.', 'Compare with <code>MirroredStrategy</code> in TensorFlow (same idea, built in) and <code>DistributedDataParallel</code> in PyTorch (HPML: <code>torch_multigpu.py</code>).']
  }));
})();
