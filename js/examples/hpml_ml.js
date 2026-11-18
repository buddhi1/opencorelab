/* HPML machine-learning examples: TensorFlow intro notebooks, data-parallel scripts, homework, cluster notes. */
(function () {
  'use strict';
  const H = 'hpml/', DP = 'hpml/data_parallel/';
  const TFI = H + 'tensorflow/TensorFlow_Introduction_HPML_Spring_2025.ipynb', CVN = H + 'tensorflow/Computer_Vision.ipynb';
  const tf = { course: 'hpml', topic: 'tensorflow' }, one = { course: 'hpml', topic: 'dp-single-node' }, multi = { course: 'hpml', topic: 'dp-multi-node' };
  const co = function (v, c) { return { v: v, c: c }; };
  const merge = function () { return Object.assign.apply(null, [{}].concat(Array.prototype.slice.call(arguments))); };
  const seq = function (n, f) { return Array.from({ length: n }, function (_, i) { return f(i); }); };

  /* ======================================================================
     TensorFlow introduction (notebooks)
     ====================================================================== */
  PDC.add(Object.assign({ id: 'tensors' }, tf, {
    title: 'Tensors: rank, shape, reshape, slicing', files: [TFI], concepts: ['tf.constant vs tf.Variable', 'rank', 'shape', 'tf.reshape', 'slicing'],
    summary: 'A tensor is an n-dimensional array; its <b>rank</b> is the number of dimensions and its <b>shape</b> lists the size of each. The notebook shows how to create, reshape and slice them.',
    kind: 'diagram',
    scene: {
      w: 760, h: 300,
      nodes: {
        s0: { x: 20, y: 30, w: 120, h: 96, label: 'rank 0', sub: 'scalar\nshape ()', cells: [co('5.0', 'c0')], cw: 56 },
        s1: { x: 160, y: 30, w: 180, h: 96, label: 'rank 1', sub: 'vector\nshape (3,)', cells: [co(1, 'c1'), co(2, 'c1'), co(3, 'c1')], cw: 44, hidden: true },
        s2: { x: 360, y: 30, w: 190, h: 110, label: 'rank 2', sub: 'matrix  shape (2, 3)', cells: [1, 2, 3, 4, 5, 6].map(function (v) { return co(v, 'c2'); }), cols: 3, cw: 44, hidden: true },
        s3: { x: 570, y: 30, w: 170, h: 110, label: 'rank 3', sub: 'shape (1, 2, 3)', cells: [1, 1, 1, 1, 1, 1].map(function (v) { return co(v, 'c4'); }), cols: 3, cw: 44, hidden: true },
        k: { x: 20, y: 30, w: 330, h: 100, label: 'tf.constant(5.0)', sub: 'immutable tensor:  tensor.assign(10.0) → error', cells: [co('5.0', 'c0')], cw: 56, hidden: true },
        v: { x: 410, y: 30, w: 330, h: 100, label: 'tf.Variable(5.0)', sub: 'mutable: variable.assign(10.0) is allowed', cells: [co('5.0', 'c1')], cw: 56, hidden: true },
        r1: { x: 20, y: 30, w: 220, h: 110, label: 'ones([1,2,3])', sub: 'shape (1, 2, 3)', cells: seq(6, function () { return co(1, 'c4'); }), cols: 3, cw: 44, hidden: true },
        r2: { x: 270, y: 30, w: 220, h: 110, label: 'reshape → [2,3,1]', sub: 'same 6 numbers', cells: seq(6, function () { return co(1, 'c2'); }), cols: 2, cw: 44, hidden: true },
        r3: { x: 520, y: 30, w: 220, h: 110, label: 'reshape → [3,-1]', sub: '-1 = "work it out" → shape (3, 2)', cells: seq(6, function () { return co(1, 'c1'); }), cols: 2, cw: 44, hidden: true },
        m: { x: 150, y: 30, w: 460, h: 220, label: 'matrix 4 × 5   (int32)', sub: 'tensor = tf.Variable(matrix)', cells: seq(20, function (i) { return co(i + 1, 'c0'); }), cols: 5, cw: 60, hidden: true },
        cap: { x: 120, y: 262, w: 520, h: 30, shape: 'text', label: '', hidden: true }
      }
    },
    steps: [
      { t: 'Rank 0: a scalar', code: ['number = tf.Variable(324, tf.int16)', 'floating = tf.Variable(3.567, tf.float64)'], pulse: ['s0'], say: 'A tensor with <b>no dimensions</b> is a scalar: a single number (or string). TensorFlow numbers have explicit types such as <code>tf.int16</code> or <code>tf.float64</code>.' },
      { t: 'Rank 1: a vector', show: ['s1'], code: 'rank1_tensor = tf.Variable( ["Test"], tf.string )', pulse: ['s1'], say: 'One level of nesting gives a <b>vector</b>. The rank equals the depth of nested lists: <code>["Test"]</code> is rank 1.' },
      { t: 'Rank 2: a matrix', show: ['s2'], code: ['rank2_tensor = tf.Variable( [["test", "ok"], ["test", "yes"]], tf.string )', 'tf.rank(rank2_tensor)'], pulse: ['s2'], say: 'Two levels of nesting give a matrix. <code>tf.rank(t)</code> returns the rank; <code>t.shape</code> returns the size of each dimension. Shape mismatches are the most common TensorFlow error, so check them early.' },
      { t: 'Higher ranks', show: ['s3'], code: 'tensor1 = tf.ones([1,2,3])', pulse: ['s3'], say: 'Images (height, width, channels), batches of images (batch, h, w, c) and so on are rank 3 or 4 tensors. <code>tf.ones([1,2,3])</code> makes a rank-3 tensor of ones.' },
      { t: 'Constant vs Variable', hide: ['s0', 's1', 's2', 's3'], show: ['k', 'v'], code: ['tensor = tf.constant(5.0)', 'variable = tf.Variable(5.0)', 'variable.assign(10.0)'], set: { v: { cells: [co('10.0', 'ok')] } }, pulse: ['v'], say: 'A <b>tensor</b> (<code>tf.constant</code>) is immutable. A <b>Variable</b> is a mutable tensor whose value can be changed with <code>assign</code>: this is how model weights are stored and updated during training.' },
      { t: 'Reshape: same data, new shape', hide: ['k', 'v'], show: ['r1', 'r2', 'r3'], code: ['tensor2 = tf.reshape(tensor1, [2,3,1])', 'tensor3 = tf.reshape(tensor2, [3, -1])'], flow: [{ from: 'r1', to: 'r2', label: 'reshape' }, { from: 'r2', to: 'r3', label: 'reshape', delay: 0.3 }],
        say: '<code>tf.reshape</code> reinterprets the <b>same elements</b> with a different shape: (1,2,3) &rarr; (2,3,1) &rarr; (3,&minus;1). The product of the dimensions (here 6) must stay the same, and <code>-1</code> means "calculate this dimension". (The notebook comment says the last shape is [3,3]; with 6 elements it is actually <b>[3,2]</b>.)' },
      { t: 'Slicing: one element', hide: ['r1', 'r2', 'r3'], show: ['m'], code: 'three = tensor[0,2]', mark: { m: [2] }, say: 'Slicing uses NumPy-style indices. <code>tensor[0,2]</code> selects row 0, column 2: the value 3.' },
      { t: 'Slicing: a column', code: 'column1 = tensor[:, 0]', mark: { m: [0, 5, 10, 15] }, say: '<code>[:, 0]</code> means "all rows, column 0": the first column <code>[1, 6, 11, 16]</code>.' },
      { t: 'Slicing: every second row', code: 'row_2_and_4 = tensor[1::2]', mark: { m: [5, 6, 7, 8, 9, 15, 16, 17, 18, 19] }, say: '<code>[1::2]</code> starts at row 1 and takes every 2nd row: the second and fourth rows.' },
      { t: 'Slicing: a range of rows and one column', code: 'column_1_in_row_2_and_3 = tensor[1:3, 0]', mark: { m: [5, 10] }, say: '<code>[1:3, 0]</code>: rows 1 and 2 (the end index is exclusive), column 0 &rarr; <code>[6, 11]</code>.' }
    ],
    notes: ['The notebook runs on Google Colab; the cell <code>%tensorflow_version 2.x</code> only works there.']
  }));

  /* ---------- first neural network ---------- */
  PDC.add(Object.assign({ id: 'nn-fashion' }, tf, {
    title: 'A first neural network: Fashion-MNIST', files: [TFI], concepts: ['Sequential model', 'Dense layers', 'ReLU / softmax', 'compile / fit / evaluate / predict', 'overfitting'],
    summary: 'A 784&rarr;128&rarr;10 network classifies 28&times;28 clothing images: flatten the image, one hidden layer with ReLU, ten softmax outputs. The notebook then trains, evaluates and predicts.',
    kind: 'diagram',
    scene: {
      w: 760, h: 330,
      edges: [['img', 'flat'], ['flat', 'hid'], ['hid', 'out'], ['out', 'pred']],
      nodes: {
        img: { x: 10, y: 40, w: 120, h: 110, label: 'image', sub: '28 × 28 pixels\n0 … 255', cls: 'mem', cells: [co('255', 'c0'), co('12', 'c0')], cw: 44 },
        flat: { x: 150, y: 40, w: 130, h: 110, label: 'Flatten', sub: '784 inputs', cls: 'gpu' },
        hid: { x: 300, y: 40, w: 150, h: 110, label: 'Dense(128)', sub: 'ReLU\n100,480 weights', c: 3 },
        out: { x: 470, y: 40, w: 140, h: 110, label: 'Dense(10)', sub: 'softmax\n1,290 weights', c: 4 },
        pred: { x: 630, y: 40, w: 120, h: 110, label: 'class', sub: 'argmax', cls: 'ok', cells: [co('?', 'empty')], cw: 80 },
        probs: { x: 120, y: 190, w: 520, h: 110, label: 'predictions[0]: probability for each class', sub: 'T-shirt  Trouser  Pullover  Dress  Coat  Sandal  Shirt  Sneaker  Bag  Ankle boot', cls: 'mem', cells: seq(10, function () { return co('', 'empty'); }), cw: 44, hidden: true }
      }
    },
    steps: [
      { t: 'The data: 60,000 small grey images', pulse: ['img'], code: ['fashion_mnist = keras.datasets.fashion_mnist', 'train_images.shape'], say: 'Fashion-MNIST has 60,000 training and 10,000 test images of 28&times;28 pixels in 10 classes (T-shirt, Trouser, &hellip;). Labels are integers 0&ndash;9.' },
      { t: 'Scale pixels to 0 &hellip; 1', set: { img: { cells: [co('1.0', 'c0'), co('0.05', 'c0')] } }, code: ['train_images = train_images / 255.0', 'test_images = test_images / 255.0'], say: 'Pixel values 0&ndash;255 are divided by 255. Networks train much better with small inputs of similar scale.' },
      { t: 'Layer 1: Flatten', flow: [{ from: 'img', to: 'flat', label: '28×28' }], pulse: ['flat'], code: 'keras.layers.Flatten(input_shape=(28, 28)),', say: '<code>Flatten</code> turns the 28&times;28 grid into a vector of <b>784</b> numbers (no weights).' },
      { t: 'Layer 2: Dense(128, relu)', flow: [{ from: 'flat', to: 'hid', label: '784' }], pulse: ['hid'], code: "keras.layers.Dense(128, activation='relu'),", say: 'Every one of the 128 neurons is connected to all 784 inputs: <code>784 &times; 128 + 128 = 100,480</code> trainable parameters (weights + biases). <b>ReLU</b> = <code>max(0, x)</code> adds the non-linearity that lets the network learn more than a straight line.' },
      { t: 'Layer 3: Dense(10, softmax)', flow: [{ from: 'hid', to: 'out', label: '128' }], pulse: ['out'], code: "keras.layers.Dense(10, activation='softmax')", say: 'One output per class: <code>128 &times; 10 + 10 = 1,290</code> parameters. <b>Softmax</b> converts the 10 raw scores into probabilities that sum to 1.' },
      { t: 'Compile: loss, optimizer, metrics', pulse: ['out'], code: "model.compile(optimizer='adam',", say: 'Training needs an <b>optimizer</b> (Adam: a gradient-descent variant that adapts step sizes), a <b>loss</b> to minimise (<code>sparse_categorical_crossentropy</code> compares the probabilities with the integer label) and metrics to report (accuracy).' },
      { t: 'Fit: adjust the weights', pulse: ['hid', 'out'], flow: [{ from: 'out', to: 'hid', label: '∇', cls: 'hot' }], code: 'model.fit(train_images, train_labels, epochs=10)', say: 'For each batch the network predicts, the loss measures the error, <b>backpropagation</b> computes the gradient of the loss with respect to every weight, and the optimizer nudges the weights. One pass over all 60,000 images is an <b>epoch</b>; this runs 10.' },
      { t: 'Evaluate on unseen images', code: ['test_loss, test_acc = model.evaluate(test_images,  test_labels, verbose=1)', "print('Test accuracy:', test_acc)"], say: 'Accuracy on the 10,000 <b>test</b> images is usually a little lower than the training accuracy printed during <code>fit</code>. That gap is <b>overfitting</b>: the model has partly memorised the training set.' },
      { t: 'Predict one image', show: ['probs'], set: { pred: { cells: [co('Ankle boot', 'ok')] }, probs: { cells: [0, 0, 0, 0, 0, 0.01, 0, 0.02, 0, 0.97].map(function (p, i) { return co(p, i === 9 ? 'ok' : 'empty'); }) } }, flow: [{ from: 'out', to: 'probs', label: 'p' }, { from: 'out', to: 'pred', label: 'argmax', cls: 'ok', delay: 0.3 }], code: ['predictions = model.predict(test_images)', 'np.argmax(predictions[0])'],
        say: '<code>model.predict</code> returns 10 probabilities per image (the values drawn are illustrative); <code>np.argmax</code> picks the largest, here class 9 = "Ankle boot". Compare with <code>test_labels[0]</code> to see whether it is right.' }
    ],
    notes: ['The same recipe &mdash; <em>define layers, compile, fit, evaluate</em> &mdash; is what all the distributed examples later in this course wrap in a <code>strategy.scope()</code>.']
  }));

  /* ---------- GradientTape ---------- */
  PDC.add(Object.assign({ id: 'gradient-tape' }, tf, {
    title: 'GradientTape: a hand-written training step', files: [TFI], concepts: ['tf.GradientTape', 'automatic differentiation', 'apply_gradients', 'custom training loop'],
    summary: 'Instead of <code>model.fit</code>, the notebook computes one training step by hand: record the forward pass on a "tape", differentiate the loss, and apply the gradients.',
    kind: 'diagram',
    scene: {
      w: 760, h: 300,
      edges: [['x', 'fwd'], ['fwd', 'loss'], ['loss', 'grad'], ['grad', 'opt']],
      nodes: {
        x: { x: 10, y: 20, w: 130, h: 86, label: 'inputs x', cells: [1, 2, 3].map(function (v) { return co(v, 'c0'); }), cw: 34, cls: 'mem' },
        fwd: { x: 170, y: 20, w: 150, h: 86, label: 'model(x)', sub: 'Dense(1): w·x + b', c: 1 },
        loss: { x: 350, y: 20, w: 160, h: 86, label: 'MSE loss', sub: 'vs y = 2, 4, 6', c: 3 },
        grad: { x: 540, y: 20, w: 200, h: 86, label: 'tape.gradient', sub: '∂loss/∂w, ∂loss/∂b', cls: 'hot' },
        opt: { x: 540, y: 170, w: 200, h: 86, label: 'Adam.apply_gradients', sub: 'w ← w − step', cls: 'ok' },
        tape: { x: 170, y: 170, w: 340, h: 86, label: 'GradientTape', sub: 'records ops on trainable variables', cls: 'mem', hidden: true }
      }
    },
    steps: [
      { t: 'Model, loss and optimizer', code: ['model = tf.keras.Sequential([tf.keras.layers.Dense(1)])', 'loss_fn = tf.keras.losses.MeanSquaredError()', 'optimizer = tf.keras.optimizers.Adam(learning_rate=0.01)'], say: 'A one-neuron model that should learn <code>y = 2x</code>, a mean-squared-error loss and the Adam optimizer: the same ingredients <code>fit</code> hides.' },
      { t: 'Record the forward pass on a tape', show: ['tape'], flow: [{ from: 'x', to: 'fwd', label: 'x' }, { from: 'fwd', to: 'loss', label: 'ŷ', delay: 0.3 }], code: ['with tf.GradientTape() as tape:', 'predictions = model(tf.constant([[1.0], [2.0], [3.0]]))', 'loss = loss_fn(tf.constant([[2.0], [4.0], [6.0]]), predictions)'], say: 'Inside <code>with tf.GradientTape()</code> TensorFlow <b>records</b> every operation involving trainable variables: the model call and the loss.' },
      { t: 'Differentiate: tape.gradient', flow: [{ from: 'loss', to: 'grad', label: 'loss', cls: 'hot' }], pulse: ['grad'], code: 'grads = tape.gradient(loss, model.trainable_variables)', say: '<code>tape.gradient(loss, variables)</code> replays the tape <b>backwards</b> (automatic differentiation) to get the derivative of the loss with respect to every trainable variable.' },
      { t: 'Apply the update', flow: [{ from: 'grad', to: 'opt', label: '∇', cls: 'ok' }], pulse: ['opt'], code: 'optimizer.apply_gradients(zip(grads, model.trainable_variables))', say: '<code>apply_gradients</code> takes (gradient, variable) pairs and updates the weights. Repeating this in a loop <em>is</em> training. In <code>hpml/data_parallel/n_nodes/sync/main.py</code> exactly this step is wrapped in <code>strategy.run</code> to run on many GPUs.' }
    ],
    notes: ['A custom step gives full control: gradient clipping, multiple losses, GANs, or distributed all-reduce in your own way.']
  }));

  /* ---------- GPU use ---------- */
  PDC.add(Object.assign({ id: 'use-gpu' }, tf, {
    title: 'Using a GPU from TensorFlow', files: [TFI], concepts: ['list_physical_devices', 'tf.device', 'GPU placement'],
    summary: 'Check that TensorFlow sees a GPU and run a training step on it explicitly with <code>with tf.device("/GPU:0")</code>.',
    kind: 'diagram',
    scene: {
      w: 760, h: 270,
      edges: [['py', 'rt'], ['rt', 'cpu'], ['rt', 'gpu']],
      nodes: {
        py: { x: 10, y: 20, w: 180, h: 80, label: 'your Python code', sub: 'model.fit(...)', cls: 'cpu' },
        rt: { x: 250, y: 20, w: 220, h: 80, label: 'TensorFlow runtime', sub: 'places each op on a device', cls: 'mem' },
        cpu: { x: 540, y: 20, w: 200, h: 80, label: '/CPU:0', sub: 'input pipeline, small ops', cls: 'cpu' },
        gpu: { x: 540, y: 150, w: 200, h: 90, label: '/GPU:0', sub: 'convolutions, matmuls', cls: 'gpu', hidden: true },
        out: { x: 10, y: 150, w: 480, h: 90, label: 'output', sub: '', cls: 'mem', hidden: true }
      }
    },
    steps: [
      { t: 'Does TensorFlow see a GPU?', show: ['out'], set: { out: { sub: 'Num GPUs Available: 1\n[PhysicalDevice(name=\'/physical_device:GPU:0\')]' } }, code: ['print("Num GPUs Available:", len(tf.config.experimental.list_physical_devices(\'GPU\')))', "print(tf.config.list_physical_devices('GPU'))"], say: '<code>list_physical_devices(\'GPU\')</code> lists the GPUs TensorFlow can use (needs a CUDA-enabled TensorFlow, e.g. <code>pip install tensorflow[and-cuda]</code>). An empty list means everything runs on the CPU.' },
      { t: 'Automatic placement', show: ['gpu'], flow: [{ from: 'rt', to: 'gpu', label: 'matmul' }, { from: 'rt', to: 'cpu', label: 'data', delay: 0.2 }], say: 'By default TensorFlow places supported operations on the GPU when one exists, and keeps the rest (the input pipeline, small ops) on the CPU.' },
      { t: 'Explicit placement', show: ['gpu'], pulse: ['gpu'], code: ["with tf.device('/GPU:0'):", 'history = model.fit(x_train, y_train,'], say: '<code>with tf.device(\'/GPU:0\')</code> forces the enclosed operations onto the first GPU. For <b>several</b> GPUs use a <code>tf.distribute</code> strategy instead (see the data-parallel examples).' }
    ]
  }));

  /* ---------- convolution family (Computer_Vision.ipynb) ---------- */
  const edgeImg = seq(6, function () { return [0, 0, 0, 1, 1, 1]; });
  PDC.add(Object.assign({ id: 'convolution' }, tf, {
    title: 'Convolution: sliding a filter over an image', files: [CVN], concepts: ['Conv2D', 'filter / kernel', 'feature map', 'weight sharing'],
    summary: 'A 3&times;3 filter slides across the image; at each position it multiplies and adds the 9 pixels under it. The result, the <b>feature map</b>, shows where the pattern the filter looks for occurs.',
    kind: 'conv', scene: { img: edgeImg, kernel: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], k: 3, stride: 1, pad: 0, mode: 'conv' },
    steps: [
      { t: 'An image with a vertical edge', p: -1, code: 'model.add(layers.Conv2D(32, (3, 3), activation=\'relu\', input_shape=(32, 32, 3)))', say: 'The left 3 columns are dark (0) and the right 3 are bright (1): a <b>vertical edge</b>. The filter on the right is a <em>vertical-edge detector</em>: negative on its left, positive on its right. In a CNN such filters are <b>learned</b>, not hand-written.' },
      { t: 'Position 0: flat region', p: 0, code: 'model.add(layers.Conv2D(64, (3, 3), activation=\'relu\'))', say: 'The window sits over pixels that are all 0, so the output is 0: nothing to detect here.' },
      { t: 'Position 1: the edge enters the window', p: 1, say: 'Now the window covers columns 1&ndash;3: two dark pixels and one bright pixel per row. The positive filter weight meets the bright pixel: output <b>3</b>.' },
      { t: 'Position 2: edge in the middle', p: 2, say: 'Output 3 again: the edge is still inside the window.' },
      { t: 'Position 3: flat bright region', p: 3, say: 'All pixels under the window are 1; the left and right weights cancel: output 0. The filter responds only at the edge.' },
      { t: 'Slide over the whole image', all: true, say: 'The same 9 weights are reused at every position (<b>weight sharing</b>), so a detector for "vertical edge" works wherever the edge appears. The output (4&times;4 because a 3&times;3 window fits 4 times along a row of 6) is the <b>feature map</b>. A <code>Conv2D(32, (3,3))</code> layer learns 32 such filters.' }
    ],
    notes: ['Parameter count of <code>Conv2D(32, (3,3))</code> on an RGB input: <code>3&times;3&times;3&times;32 + 32 = 896</code>.']
  }));
  PDC.add(Object.assign({ id: 'padding-stride' }, tf, {
    title: 'Padding and stride', files: [CVN], concepts: ['padding', 'stride', 'output size'],
    summary: 'Padding adds a border of zeros so the filter can be centred on edge pixels; a stride larger than 1 skips positions and shrinks the output.',
    kind: 'conv', scene: { img: [[1, 2, 0, 1, 3], [0, 1, 3, 1, 2], [2, 1, 0, 2, 1], [1, 0, 2, 3, 0], [3, 1, 1, 0, 2]], kernel: [[1, 0, 1], [0, 1, 0], [1, 0, 1]], k: 3, stride: 2, pad: 1, mode: 'conv' },
    steps: [
      { t: 'The border problem', p: -1, say: 'A 3&times;3 filter fits only 3&times;3 times in a 5&times;5 image, so the output would be <em>smaller</em> and edge pixels would be used less often. <b>Zero padding</b> (dashed cells) adds a border so the filter can be centred on every pixel.' },
      { t: 'Position 0 (top-left)', p: 0, say: 'With padding 1 the first window includes the zero border. Window size 3, padding 1, <b>stride 2</b>.' },
      { t: 'Position 1: the window jumps 2 pixels', p: 1, say: 'Stride 2 moves the filter <b>two</b> pixels at a time instead of one.' },
      { t: 'Next row', p: 3, say: 'After the first row the window moves down 2 rows.' },
      { t: 'Output size = floor((n + 2p &minus; k) / s) + 1', all: true, say: '(5 + 2&middot;1 &minus; 3) / 2 + 1 = <b>3</b>. Padding keeps spatial size (stride 1, padding "same"), while stride downsamples. In Keras: <code>padding="same"</code> / <code>"valid"</code> and <code>strides=(2,2)</code>.' }
    ]
  }));
  PDC.add(Object.assign({ id: 'pooling' }, tf, {
    title: 'Max pooling', files: [CVN], concepts: ['MaxPooling2D', 'downsampling', 'translation invariance'],
    summary: '<code>MaxPooling2D((2,2))</code> keeps only the largest value in each 2&times;2 window, halving the width and height of a feature map.',
    kind: 'conv', scene: { img: [[1, 3, 2, 1], [4, 6, 5, 2], [7, 2, 1, 0], [3, 8, 4, 9]], k: 2, stride: 2, pad: 0, mode: 'pool' },
    steps: [
      { t: 'A feature map to shrink', p: -1, code: 'model.add(layers.MaxPooling2D((2, 2)))', say: 'After a convolution the feature map is still large. Pooling <b>downsamples</b> it: fewer values, less computation, and some tolerance to small shifts of the pattern.' },
      { t: 'Top-left window', p: 0, say: 'The largest of 1, 3, 4, 6 is <b>6</b>.' },
      { t: 'Next window (stride 2)', p: 1, say: 'The window moves by its own size, so windows do not overlap: max(2, 1, 5, 2) = 5.' },
      { t: 'All windows', all: true, say: '4&times;4 became 2&times;2. In the CIFAR-10 model each <code>MaxPooling2D((2,2))</code> halves the spatial size (30&rarr;15, 13&rarr;6); there are <b>no weights</b> to learn.' }
    ]
  }));

  /* ---------- CIFAR CNN architecture ---------- */
  const cnnNodes = {};
  const cnnLayers = [
    ['Input', '32×32×3', 'cls:mem', 0], ['Conv2D(32,3×3)', '30×30×32\n896 params', 'c0'], ['MaxPool 2×2', '15×15×32\n0 params', 'c1'], ['Conv2D(64,3×3)', '13×13×64\n18,496 params', 'c0'],
    ['MaxPool 2×2', '6×6×64\n0 params', 'c1'], ['Conv2D(64,3×3)', '4×4×64\n36,928 params', 'c0'], ['Flatten', '1024', 'c2'], ['Dense(64, relu)', '64\n65,600 params', 'c3'], ['Dense(10)', '10 logits\n650 params', 'c4']
  ];
  cnnLayers.forEach(function (l, i) {
    const row = i < 6 ? 0 : 1, col = i < 6 ? i : 5 - (i - 6);   // second row runs right-to-left so the flow stays short
    cnnNodes['n' + i] = { x: 8 + col * 124, y: row ? 170 : 30, w: 116, h: 100, label: l[0], sub: l[1], hidden: i > 0, c: l[2] === 'cls:mem' ? undefined : ({ c0: 0, c1: 1, c2: 2, c3: 3, c4: 4 })[l[2]], cls: l[2] === 'cls:mem' ? 'mem' : '' };
  });
  PDC.add(Object.assign({ id: 'cnn-cifar' }, tf, {
    title: 'A small CNN for CIFAR-10: shapes and parameters', files: [CVN], concepts: ['Conv2D / MaxPooling2D', 'Flatten + Dense', 'model.summary()', 'parameter count'],
    summary: 'Three convolution layers and two poolings turn a 32&times;32&times;3 image into 1,024 features; two dense layers classify them. Follow the tensor shape and the parameter count layer by layer.',
    kind: 'diagram', scene: { w: 760, h: 290, nodes: cnnNodes, edges: seq(8, function (i) { return ['n' + i, 'n' + (i + 1)]; }) },
    steps: [
      { t: 'Input: 32 &times; 32 colour images', show: ['n0'], code: ['(train_images, train_labels), (test_images, test_labels) = datasets.cifar10.load_data()', 'train_images, test_images = train_images / 255.0, test_images / 255.0'], say: 'CIFAR-10: 60,000 colour images (32&times;32 pixels, 3 channels) in 10 classes. Pixels are scaled to 0&ndash;1.' },
      { t: 'Conv2D(32): 30 &times; 30 &times; 32', show: ['n1'], flow: [{ from: 'n0', to: 'n1', label: 'conv' }], code: "model.add(layers.Conv2D(32, (3, 3), activation='relu', input_shape=(32, 32, 3)))", say: '32 filters of size 3&times;3&times;3 (+ 1 bias each) = <b>896</b> parameters. Without padding the 3&times;3 window fits 30 times along 32 pixels, so the map is 30&times;30 with 32 channels.' },
      { t: 'MaxPooling: 15 &times; 15 &times; 32', show: ['n2'], flow: [{ from: 'n1', to: 'n2', label: 'max' }], code: 'model.add(layers.MaxPooling2D((2, 2)))', say: 'Pooling halves width and height; there are no parameters.' },
      { t: 'Conv2D(64): 13 &times; 13 &times; 64', show: ['n3'], flow: [{ from: 'n2', to: 'n3', label: 'conv' }], code: "model.add(layers.Conv2D(64, (3, 3), activation='relu'))", say: 'Each of the 64 filters spans all 32 input channels: <code>3&times;3&times;32 + 1 = 289</code> weights &times; 64 = <b>18,496</b>. The channel depth grows while the spatial size shrinks: the network trades "where" for "what".' },
      { t: 'MaxPooling and the last Conv2D', show: ['n4', 'n5'], flow: [{ from: 'n3', to: 'n4', label: 'max' }, { from: 'n4', to: 'n5', label: 'conv', delay: 0.3 }], code: ['model.add(layers.MaxPooling2D((2, 2)))', "model.add(layers.Conv2D(64, (3, 3), activation='relu'))"], say: '13&rarr;6 by pooling (floor of 6.5), then 6&rarr;4 by the third convolution: a 4&times;4&times;64 feature volume. <code>3&times;3&times;64 + 1 = 577</code> weights &times; 64 = <b>36,928</b>.' },
      { t: 'Flatten and classify', show: ['n6', 'n7', 'n8'], flow: [{ from: 'n5', to: 'n6', label: '4×4×64' }, { from: 'n6', to: 'n7', label: '1024', delay: 0.3 }, { from: 'n7', to: 'n8', label: '64', delay: 0.6 }], code: ['model.add(layers.Flatten())', "model.add(layers.Dense(64, activation='relu'))", 'model.add(layers.Dense(10))'],
        say: '<code>Flatten</code> unrolls 4&times;4&times;64 = 1024 numbers; <code>Dense(64)</code> has <code>1024&times;64 + 64 = 65,600</code> parameters; <code>Dense(10)</code> outputs 10 <em>logits</em> (<code>from_logits=True</code> in the loss applies the softmax internally).' },
      { t: 'Total: 122,570 parameters', pulse: ['n1', 'n3', 'n5', 'n7', 'n8'], code: ['model.summary()  # let\'s have a look at our model so far', "history = model.fit(train_images, train_labels, epochs=4,"], say: '896 + 18,496 + 36,928 + 65,600 + 650 = <b>122,570</b>, exactly what <code>model.summary()</code> prints. Training for 4 epochs gives about 70 % test accuracy, as the notebook notes &mdash; the cue to try data augmentation and transfer learning.' }
    ],
    notes: ['Most of the compute is in the convolutions; most of the parameters are in the dense layers. This asymmetry matters for model- vs data-parallel strategies.']
  }));

  /* ---------- data augmentation ---------- */
  PDC.add(Object.assign({ id: 'augmentation' }, tf, {
    title: 'Data augmentation', files: [CVN], concepts: ['ImageDataGenerator', 'rotation / shift / shear / zoom / flip', 'overfitting on small datasets'],
    summary: 'With few training images a CNN overfits. Data augmentation creates new training images on the fly by applying random transformations to the existing ones.',
    kind: 'diagram',
    scene: {
      w: 760, h: 290,
      nodes: Object.assign({ orig: { x: 20, y: 20, w: 190, h: 100, label: 'one training image', sub: 'train_images[20]', cls: 'mem' } },
        ['rotation_range=40', 'width/height_shift=0.2', 'shear_range=0.2', 'zoom_range=0.2', 'horizontal_flip=True'].reduce(function (o, t, i) { o['a' + i] = { x: 270 + (i % 2) * 245, y: 12 + Math.floor(i / 2) * 90, w: 230, h: 76, label: t, sub: 'random variant ' + (i + 1), c: i, hidden: true }; return o; }, {}))
    },
    steps: [
      { t: 'The problem: too little data', pulse: ['orig'], code: ['test_img = train_images[20]', 'datagen = ImageDataGenerator('], say: 'A model trained on a few thousand images memorises them. More (varied) data helps &mdash; but collecting it is expensive.' },
      { t: 'Define the random transformations', show: ['a0', 'a1', 'a2', 'a3', 'a4'], flow: ['a0', 'a1', 'a2', 'a3', 'a4'].map(function (a, i) { return { from: 'orig', to: a, delay: i * 0.1 }; }), code: ['datagen = ImageDataGenerator(', 'rotation_range=40,', 'horizontal_flip=True,', "fill_mode='nearest')"], say: '<code>ImageDataGenerator</code> describes <b>ranges</b> of random changes: rotate up to 40&deg;, shift by up to 20 %, shear, zoom, flip horizontally. <code>fill_mode=\'nearest\'</code> fills pixels that the transformation uncovers.' },
      { t: 'Generate endless variants', pulse: ['a0', 'a1', 'a2', 'a3', 'a4'], code: ['for batch in datagen.flow(img, save_prefix=\'test\', save_format=\'jpeg\'):', 'if i > 4:  # show 4 images'], say: '<code>datagen.flow</code> yields a <b>new random variant on every iteration, forever</b> (so the loop must <code>break</code>). During training each epoch sees slightly different images, which acts as a regulariser.' }
    ],
    notes: ['In current Keras the same idea is available as layers (<code>RandomFlip</code>, <code>RandomRotation</code>) that run on the GPU as part of the model; <code>ImageDataGenerator</code> is deprecated.']
  }));

  /* ---------- transfer learning ---------- */
  PDC.add(Object.assign({ id: 'transfer-learning' }, tf, {
    title: 'Transfer learning with a frozen MobileNetV2', files: [CVN], concepts: ['pretrained model', 'freezing layers', 'GlobalAveragePooling2D', 'cats vs dogs', 'fine tuning'],
    summary: 'Re-use a network trained on 1.4 million ImageNet images as a fixed feature extractor, and train only a tiny new classifier on top for cats vs dogs.',
    kind: 'diagram',
    scene: {
      w: 760, h: 300,
      edges: [['img', 'base'], ['base', 'gap'], ['gap', 'head']],
      nodes: {
        img: { x: 10, y: 40, w: 130, h: 100, label: 'image', sub: 'resized to\n160 × 160 × 3\nvalues −1 … 1', cls: 'mem' },
        base: { x: 170, y: 20, w: 190, h: 140, label: 'MobileNetV2 base', sub: 'include_top=False\nweights=\'imagenet\'\nout: 5 × 5 × 1280', c: 0 },
        gap: { x: 390, y: 40, w: 160, h: 100, label: 'GlobalAverage\nPooling2D', sub: '1280 numbers', c: 2 },
        head: { x: 580, y: 40, w: 160, h: 100, label: 'Dense(1)', sub: 'cat or dog\n1,281 params', c: 3 },
        note: { x: 170, y: 200, w: 570, h: 80, label: '', sub: '', cls: 'mem', hidden: true }
      }
    },
    steps: [
      { t: 'Prepare the images', pulse: ['img'], code: ['IMG_SIZE = 160 # All images will be resized to 160x160', 'image = (image/127.5) - 1', 'image = tf.image.resize(image, (IMG_SIZE, IMG_SIZE))'], say: 'Images come in different sizes, so they are resized to 160&times;160 and scaled to the range &minus;1&hellip;1 that MobileNetV2 expects. The dataset is split 80 / 10 / 10 % into train, validation, test.' },
      { t: 'Load a pretrained base', flow: [{ from: 'img', to: 'base', label: 'pixels' }], pulse: ['base'], code: ['base_model = tf.keras.applications.MobileNetV2(input_shape=IMG_SHAPE,', "weights='imagenet')"], say: 'MobileNetV2 was trained on ImageNet. <code>include_top=False</code> drops its 1000-class classifier and keeps the <b>convolutional base</b>, which already detects edges, textures and parts. An image becomes a 5&times;5&times;1280 feature volume.' },
      { t: 'Freeze the base', set: { base: { cls: 'dim', sub: 'FROZEN: trainable = False\nout: 5 × 5 × 1280' } }, code: 'base_model.trainable = False', say: '<b>Freezing</b> disables training for the base: its millions of weights stay fixed. This protects the learned features, and makes training fast because no gradients are needed for the base.' },
      { t: 'Add a small classifier', flow: [{ from: 'base', to: 'gap', label: '5×5×1280' }, { from: 'gap', to: 'head', label: '1280', delay: 0.3 }], pulse: ['gap', 'head'], code: ['global_average_layer = tf.keras.layers.GlobalAveragePooling2D()', 'prediction_layer = keras.layers.Dense(1)'], say: '<code>GlobalAveragePooling2D</code> averages each of the 1280 feature maps over its 5&times;5 area &rarr; 1280 numbers. A single <code>Dense(1)</code> neuron then outputs one score (positive = dog, negative = cat). Only these <b>1,281 parameters</b> will be trained.' },
      { t: 'Train with a very small learning rate', code: ['base_learning_rate = 0.0001', 'history = model.fit(train_batches,'], say: 'The new head is trained for 3 epochs with RMSprop at a small learning rate. Even this tiny training gives high accuracy, because the base already does the hard work. <code>BinaryCrossentropy(from_logits=True)</code> is the loss for two classes.' },
      { t: 'Save and reload', code: ['model.save("dogs_vs_cats.h5")', "new_model = tf.keras.models.load_model('dogs_vs_cats.h5')"], say: 'The whole model can be saved and later reloaded. <b>Fine-tuning</b> would unfreeze the last few base layers and continue training with an even smaller learning rate (described in the notebook).' }
    ],
    notes: ['Transfer learning is why a few thousand images can be enough: you reuse features learned from millions.']
  }));

  /* ======================================================================
     Cluster notes
     ====================================================================== */
  PDC.add(Object.assign({ id: 'faq' }, { course: 'hpml', topic: 'cluster' }, {
    title: 'Getting files onto the cluster', files: [H + 'faq.txt'], concepts: ['scp / sftp', 'git', 'Globus', 'clipboard'],
    summary: 'The course FAQ: four ways to move code and data from your laptop to a cluster node.',
    kind: 'diagram',
    scene: {
      w: 760, h: 300,
      nodes: {
        pc: { x: 10, y: 90, w: 190, h: 110, label: 'your computer', sub: 'code + data', cls: 'cpu' },
        cl: { x: 560, y: 90, w: 190, h: 110, label: 'cluster node', sub: 'where jobs run', cls: 'gpu' },
        m1: { x: 270, y: 14, w: 220, h: 50, shape: 'pill', label: 'a) clipboard', c: 0, hidden: true },
        m2: { x: 270, y: 80, w: 220, h: 50, shape: 'pill', label: 'b) scp / sftp', c: 1, hidden: true },
        m3: { x: 270, y: 146, w: 220, h: 50, shape: 'pill', label: 'c) git push / pull', c: 2, hidden: true },
        m4: { x: 270, y: 212, w: 220, h: 50, shape: 'pill', label: 'd) Globus', c: 3, hidden: true }
      }
    },
    steps: [
      { t: 'The question', code: '1) How to copy files/data from my local pc to a node in the cluster?', say: 'Your code lives on your laptop but runs on the cluster. There is no single right way; the FAQ lists four.' },
      { t: 'a) Clipboard', show: ['m1'], flow: [{ from: 'pc', to: 'm1', label: 'paste' }, { from: 'm1', to: 'cl', delay: 0.4 }], code: ['a) Using clipboard.', 'You can use copy paste file contents'], say: 'Copy the text of a file and paste it into an editor in the terminal session. Fine for one or two <b>small</b> files.' },
      { t: 'b) scp or sftp', show: ['m2'], flow: [{ from: 'pc', to: 'm2', label: 'files' }, { from: 'm2', to: 'cl', delay: 0.4 }], code: 'b) Using scp or sftp.', say: '<code>scp -r mydir user@cluster:~/</code> copies files over SSH; an <code>sftp</code> session lets you browse and transfer interactively.' },
      { t: 'c) Git', show: ['m3'], flow: [{ from: 'pc', to: 'm3', label: 'push' }, { from: 'm3', to: 'cl', label: 'pull', delay: 0.4 }], code: 'c) Using git.', say: 'Push your project to a repository and <code>git pull</code> on the cluster. Best for code: you also get version history, and updating is one command.' },
      { t: 'd) Globus', show: ['m4'], flow: [{ from: 'pc', to: 'm4', label: 'bulk' }, { from: 'm4', to: 'cl', delay: 0.4 }], code: 'd) Using Globus', say: '<b>Globus</b> is a managed transfer service for <em>large datasets</em> between sites (reliable, restartable). It may not be available on every cluster (the FAQ mentions Indiana Jetstream2).' }
    ]
  }));

  PDC.add(Object.assign({ id: 'slurm-setup' }, { course: 'hpml', topic: 'cluster' }, {
    title: 'Reserving GPUs and setting up conda (ARC)', files: [DP + 'commandsForArc.txt'], concepts: ['srun --pty', 'SLURM partition', 'conda environment', 'tensorflow[and-cuda]', '$SLURM_NODELIST'],
    summary: 'The commands used on the ARC cluster: reserve an interactive node with GPUs, create the conda environments, and find the other nodes of a multi-node allocation.',
    kind: 'diagram',
    scene: {
      w: 760, h: 300,
      edges: [['login', 'node1', { dash: true }], ['node1', 'node2', { dash: true, label: 'ssh' }]],
      nodes: {
        login: { x: 10, y: 100, w: 150, h: 90, label: 'login node', sub: 'no GPUs: only edit & submit', cls: 'cpu' },
        node1: { x: 270, y: 20, w: 230, h: 110, label: 'compute node 1', sub: 'srun --pty bash', cls: 'gpu', cells: [co('GPU', 'c0'), co('GPU', 'c0')], cw: 50, hidden: true },
        node2: { x: 540, y: 150, w: 200, h: 110, label: 'compute node 2', sub: '(multi-node runs)', cls: 'gpu', cells: [co('GPU', 'c1'), co('GPU', 'c1')], cw: 50, hidden: true },
        env: { x: 270, y: 180, w: 230, h: 90, label: 'conda env tf310', sub: 'python 3.10\ntf[and-cuda], tf_keras', cls: 'mem', hidden: true }
      }
    },
    steps: [
      { t: 'Ask SLURM for an interactive GPU node', show: ['node1'], flow: [{ from: 'login', to: 'node1', label: 'srun' }], code: ['srun -p gpu2v100 -gres=gpu:2 -N 1 -n 1 -t 0:30:0 --pty bash', 'Secure resources'], say: '<code>srun -p gpu2v100 --gres=gpu:2 -N 1 -n 1 -t 0:30:0 --pty bash</code> reserves <b>one node, 2 V100 GPUs, for 30 minutes</b> and gives you a shell on it (<code>--pty</code>). The file writes <code>-gres</code>; SLURM\'s option is spelled <code>--gres</code>. Heavy work must never run on the login node.' },
      { t: 'Load Anaconda and create an environment', show: ['env'], code: ['ml  anaconda3', 'conda create --name tf310 python=3.10 -y', 'conda activate tf310', 'pip install tensorflow[and-cuda]', 'pip install tf_keras'], say: '<code>ml anaconda3</code> loads the module. The one-time setup creates a Python 3.10 environment and installs a CUDA-enabled TensorFlow plus <code>tf_keras</code> (the legacy Keras 2 that several scripts select with <code>TF_USE_LEGACY_KERAS=1</code>).' },
      { t: 'Multi-node: two nodes', show: ['node2'], flow: [{ from: 'login', to: 'node2', label: 'srun -N 2' }], code: ['srun -p compute1 -N 2 -n 2 -t 0:30:0 --pty bash', 'Multi node multi device experiments. Legacy Keras.'], say: 'For distributed examples ask for <code>-N 2</code> nodes (and 2 tasks). A different environment, <code>tf310_216</code>, pins <b>TensorFlow 2.16.1</b>, the version the multi-worker scripts were written for.' },
      { t: 'Find the other node and hop to it', code: ['echo $SLURM_NODELIST', 'ssh <other node id>'], say: '<code>echo $SLURM_NODELIST</code> lists the allocated nodes; <code>ssh</code> to the second one to start the second worker by hand (as <code>n1.sh</code> / <code>n2.sh</code> do), then <code>conda activate tf310_216</code> there as well.' }
    ],
    notes: ['The exact partition names (<code>gpu2v100</code>, <code>compute1</code>, <code>gpu4v100</code>) belong to the "ARC" cluster used in class; replace them with your own cluster\'s partitions.']
  }));

  /* ======================================================================
     Data parallelism: single node
     ====================================================================== */
  PDC.add(Object.assign({ id: 'strategies-overview' }, one, {
    title: 'Which tf.distribute strategy?', files: [DP + 'commandsForArc.txt'], concepts: ['MirroredStrategy', 'CentralStorageStrategy', 'MultiWorkerMirroredStrategy', 'ParameterServerStrategy'],
    summary: 'Four ways TensorFlow distributes training. They differ in <em>where the variables live</em> and <em>how updates are combined</em>; the next pages show each one running.',
    kind: 'diagram',
    scene: {
      w: 760, h: 340,
      groups: [{ x: 6, y: 6, w: 366, h: 160, label: 'synchronous' }, { x: 388, y: 6, w: 366, h: 160, label: 'synchronous, many machines' }, { x: 6, y: 176, w: 366, h: 160, label: 'synchronous, central variables' }, { x: 388, y: 176, w: 366, h: 160, label: 'asynchronous' }],
      nodes: {
        m1: { x: 20, y: 34, w: 80, h: 56, label: 'GPU', cells: [co('W', 'c0')], cw: 32, c: 0 }, m2: { x: 110, y: 34, w: 80, h: 56, label: 'GPU', cells: [co('W', 'c1')], cw: 32, c: 1 }, m3: { x: 200, y: 34, w: 80, h: 56, label: 'GPU', cells: [co('W', 'c2')], cw: 32, c: 2 }, m4: { x: 290, y: 34, w: 70, h: 56, label: 'GPU', cells: [co('W', 'c3')], cw: 32, c: 3 },
        mt: { x: 20, y: 104, w: 340, h: 50, shape: 'pill', label: 'MirroredStrategy: all-reduce on one machine', cls: 'hot' },
        w1: { x: 400, y: 34, w: 160, h: 56, label: 'worker 0 (2 GPUs)', cls: 'gpu', hidden: false }, w2: { x: 580, y: 34, w: 160, h: 56, label: 'worker 1 (2 GPUs)', cls: 'gpu' },
        wt: { x: 400, y: 104, w: 340, h: 50, shape: 'pill', label: 'MultiWorkerMirrored: all-reduce across machines', cls: 'hot' },
        cpu: { x: 20, y: 200, w: 340, h: 50, label: 'CPU memory holds the variables', cls: 'mem' }, c1: { x: 20, y: 262, w: 80, h: 46, label: 'GPU', c: 0 }, c2: { x: 110, y: 262, w: 80, h: 46, label: 'GPU', c: 1 }, c3: { x: 200, y: 262, w: 80, h: 46, label: 'GPU', c: 2 }, c4: { x: 290, y: 262, w: 70, h: 46, label: 'GPU', c: 3 },
        ps: { x: 400, y: 200, w: 340, h: 50, label: 'parameter server holds the variables', cls: 'mem' }, p1: { x: 400, y: 262, w: 100, h: 46, label: 'worker', c: 0 }, p2: { x: 510, y: 262, w: 100, h: 46, label: 'worker', c: 1 }, p3: { x: 620, y: 262, w: 120, h: 46, label: 'chief (coordinator)', cls: 'cpu' }
      },
      edges: [['cpu', 'c1', { dash: true }], ['cpu', 'c2', { dash: true }], ['cpu', 'c3', { dash: true }], ['cpu', 'c4', { dash: true }], ['ps', 'p1', { dash: true }], ['ps', 'p2', { dash: true }]]
    },
    steps: [
      { t: 'Data parallelism in one sentence', code: ['Single node multi device experiments. Legacy Keras', 'Multi node multi device experiments. Legacy Keras.'], say: 'In every strategy each worker computes gradients on a <b>different slice of the data</b>; the strategies differ in how those gradients are combined and where the weights are stored. The cluster notes in this file cover the single-node and multi-node set-ups.' },
      { t: 'MirroredStrategy', pulse: ['m1', 'm2', 'm3', 'm4', 'mt'], say: '<b>One machine, N GPUs.</b> Every GPU keeps a full copy of the variables; gradients are combined with an <b>all-reduce</b> (NCCL) so all copies get the same update. The default and usually the fastest choice on a single node.' },
      { t: 'MultiWorkerMirroredStrategy', pulse: ['w1', 'w2', 'wt'], say: 'The same idea across <b>several machines</b>: collective all-reduce over the network. Needs a <code>TF_CONFIG</code> describing the cluster, one process per worker.' },
      { t: 'CentralStorageStrategy', pulse: ['cpu', 'c1', 'c2', 'c3', 'c4'], say: '<b>Variables live on the CPU</b>; the GPUs only compute. Each step copies the weights to the GPUs and sends gradients back to be combined on the CPU. Useful when the model does not fit comfortably replicated, or GPUs have no fast interconnect; usually slower than mirroring.' },
      { t: 'ParameterServerStrategy', pulse: ['ps', 'p1', 'p2', 'p3'], say: '<b>Asynchronous.</b> Variables live on parameter servers; each worker fetches weights, computes gradients and pushes them <em>without waiting for the others</em>; a chief schedules the work. Tolerates slow or failing workers, at the price of stale gradients.' }
    ]
  }));

  PDC.add(PDC.cudaBuilders.mirrored(Object.assign({ id: 'mnist_multigpu' }, one, {
    files: [DP + '1_node/keras/mnist_multigpu.py', DP + '1_node/keras/mnist_job.sh'],
    notes: ['This is the same script as <code>pdc/dnn/tensorflow_1_node-n_gpu/mnist_parallel.py</code> (plus a conda comment at the top). <code>mnist_job.sh</code> submits it to a <code>gpu4v100</code> node with 4 GPUs, activates <code>tf310_216</code> and runs it with <code>srun</code>.', 'The logs <code>tf_out.out</code> / <code>tf_error.err</code> in the same folder are from a 4-GPU run (global batch 256).']
  })));

  /* ---------- ctl/keras_dist.py ---------- */
  const lrCells = seq(12, function (e) { const v = e < 3 ? '1e-3' : e < 7 ? '1e-4' : '1e-5'; return co(v, e < 3 ? 'c0' : e < 7 ? 'c1' : 'c2'); });
  PDC.add(Object.assign({ id: 'keras_dist' }, one, {
    title: 'MirroredStrategy with tf.data and callbacks', files: [DP + '1_node/ctl/keras_dist.py'], concepts: ['tensorflow_datasets', 'tf.data pipeline', 'callbacks', 'LearningRateScheduler', 'checkpoints'],
    summary: 'MNIST from <code>tfds</code> with a small CNN on <code>MirroredStrategy</code>, showing the complete training workflow: input pipeline, learning-rate schedule, TensorBoard, checkpoints, and restoring the latest checkpoint for evaluation.',
    kind: 'diagram',
    scene: {
      w: 760, h: 340,
      edges: [['load', 'map'], ['map', 'cache'], ['cache', 'shuffle'], ['shuffle', 'batch'], ['batch', 'gpus']],
      nodes: {
        load: { x: 4, y: 20, w: 110, h: 70, label: 'tfds.load', sub: 'mnist', cls: 'mem' }, map: { x: 130, y: 20, w: 110, h: 70, label: '.map(scale)', sub: 'uint8 → 0..1', c: 0 }, cache: { x: 256, y: 20, w: 100, h: 70, label: '.cache()', sub: 'keep in RAM', c: 1 },
        shuffle: { x: 372, y: 20, w: 120, h: 70, label: '.shuffle(10000)', c: 2 }, batch: { x: 508, y: 20, w: 120, h: 70, label: '.batch(64×N)', sub: 'global batch', c: 3 }, gpus: { x: 644, y: 20, w: 106, h: 70, label: 'N GPUs', sub: 'one slice each', cls: 'gpu' },
        lr: { x: 20, y: 130, w: 720, h: 96, label: 'LearningRateScheduler(decay): learning rate per epoch (12 epochs)', cells: lrCells, cw: 54, cls: 'hot', hidden: true },
        cb: { x: 20, y: 246, w: 720, h: 80, label: 'callbacks', sub: 'TensorBoard · ModelCheckpoint · LearningRateScheduler · PrintLR', cls: 'mem', hidden: true }
      }
    },
    steps: [
      { t: 'Inspect the GPUs', code: ['gpus = tf.config.list_physical_devices(\'GPU\')', 'details = tf.config.experimental.get_device_details(gpu)'], say: 'The script first lists the GPUs and prints their details (name, compute capability), a quick sanity check on a new machine.' },
      { t: 'Load MNIST with tensorflow_datasets', pulse: ['load'], code: ["datasets, info = tfds.load(name='mnist', with_info=True, as_supervised=True)", "num_train_examples = info.splits['train'].num_examples"], say: '<code>tfds.load</code> returns <code>tf.data.Dataset</code> objects (image, label) and a <code>DatasetInfo</code> with metadata such as the number of examples.' },
      { t: 'Global batch size', code: ['strategy = tf.distribute.MirroredStrategy()', 'BATCH_SIZE_PER_REPLICA = 64', 'BATCH_SIZE = BATCH_SIZE_PER_REPLICA * strategy.num_replicas_in_sync'], say: 'As always: 64 images per GPU &times; number of replicas.' },
      { t: 'The input pipeline', flow: [{ from: 'load', to: 'map' }, { from: 'map', to: 'cache', delay: 0.15 }, { from: 'cache', to: 'shuffle', delay: 0.3 }, { from: 'shuffle', to: 'batch', delay: 0.45 }, { from: 'batch', to: 'gpus', delay: 0.6 }], code: ['def scale(image, label):', 'train_dataset = mnist_train.map(scale).cache().shuffle(BUFFER_SIZE).batch(BATCH_SIZE)'],
        say: 'Preprocessing runs on the CPU as a chain of <code>tf.data</code> stages: <code>map</code> converts pixels to 0&ndash;1 floats, <code>cache</code> keeps the result in memory after the first epoch, <code>shuffle</code> randomises order, <code>batch</code> makes global batches that the strategy slices across GPUs.' },
      { t: 'Model and optimizer inside the scope', code: ['with strategy.scope():', 'tf.keras.layers.Conv2D(32, 3, activation=\'relu\', input_shape=(28, 28, 1)),', 'optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),'], say: 'The CNN (Conv, MaxPool, Flatten, Dense, Dense) and its optimizer are created inside <code>strategy.scope()</code> so their variables are mirrored.' },
      { t: 'Learning-rate schedule', show: ['lr'], code: ['def decay(epoch):', 'tf.keras.callbacks.LearningRateScheduler(decay),'], say: '<code>decay(epoch)</code> returns 1e&minus;3 for epochs 0&ndash;2, 1e&minus;4 for 3&ndash;6, 1e&minus;5 afterwards. The <code>LearningRateScheduler</code> callback applies it at the start of each epoch: big steps early, fine steps later.' },
      { t: 'More callbacks', show: ['cb'], code: ['class PrintLR(tf.keras.callbacks.Callback):', 'tf.keras.callbacks.TensorBoard(log_dir=\'./logs\'),', 'tf.keras.callbacks.ModelCheckpoint(filepath=checkpoint_prefix,'], say: '<code>TensorBoard</code> logs curves to <code>./logs</code>, <code>ModelCheckpoint</code> saves weights every epoch (<code>ckpt_0001.weights.h5</code>, &hellip;), and the custom <code>PrintLR</code> callback prints the learning rate after each epoch.' },
      { t: 'Train 12 epochs', code: ['EPOCHS = 12', 'model.fit(train_dataset, epochs=EPOCHS, callbacks=callbacks)'], say: '<code>fit</code> runs the distributed training; all callbacks fire at the end of each epoch.' },
      { t: 'Restore the latest checkpoint and evaluate', code: ['latest_checkpoint = sorted(pathlib.Path(checkpoint_dir).glob(\'*\'))[-1]', 'model.load_weights(latest_checkpoint)', 'eval_loss, eval_acc = model.evaluate(eval_dataset)'], say: 'After training, the newest checkpoint is loaded back into the model and evaluated on the test set: proof that checkpoints are restorable and the saved weights are the final ones.' }
    ]
  }));

  /* ---------- central_storage.py ---------- */
  PDC.add(Object.assign({ id: 'central_storage' }, one, {
    title: 'CentralStorageStrategy: variables on the CPU', files: [DP + '1_node/keras3/centralStrategy/central_storage.py'], concepts: ['CentralStorageStrategy', 'variables on CPU', 'Keras 3 + TensorFlow backend', 'KERAS_BACKEND'],
    summary: 'The model\'s variables are stored once, in <b>CPU memory</b>; each GPU gets a copy of the weights for its part of the batch, computes gradients, and sends them back to be applied centrally.',
    kind: 'diagram',
    scene: {
      w: 760, h: 330,
      edges: [['cpu', 'g0', { dash: true }], ['cpu', 'g1', { dash: true }], ['cpu', 'g2', { dash: true }], ['cpu', 'g3', { dash: true }]],
      nodes: {
        cpu: { x: 160, y: 14, w: 440, h: 100, label: 'CPU (host) memory', sub: 'the ONE copy of the variables', cls: 'cpu', cells: [co('W', 'ok')], cw: 60 },
        g0: { x: 20, y: 190, w: 165, h: 110, label: 'GPU 0', c: 0, cells: [], cw: 60 }, g1: { x: 205, y: 190, w: 165, h: 110, label: 'GPU 1', c: 1, cells: [], cw: 60 },
        g2: { x: 390, y: 190, w: 165, h: 110, label: 'GPU 2', c: 2, cells: [], cw: 60 }, g3: { x: 575, y: 190, w: 165, h: 110, label: 'GPU 3', c: 3, cells: [], cw: 60 }
      }
    },
    steps: [
      { t: 'Choose the backend and strategy', code: ['os.environ["KERAS_BACKEND"] = "tensorflow"', 'strategy = tf.distribute.experimental.CentralStorageStrategy()'], say: 'Keras 3 supports several backends; the script pins <b>TensorFlow</b> (needed for <code>tf.distribute</code>). <code>CentralStorageStrategy</code> is still in the <code>experimental</code> namespace.' },
      { t: 'Variables are created on the CPU', pulse: ['cpu'], code: ['with strategy.scope():', 'x = keras.layers.Conv2D(32, 3, activation=\'relu\')(inputs_layer)'], say: 'Inside <code>strategy.scope()</code> every variable is placed on the <b>CPU</b>. There is exactly one copy (not one per GPU as in <code>MirroredStrategy</code>).' },
      { t: 'Weights are sent to the GPUs each step', flow: ['g0', 'g1', 'g2', 'g3'].map(function (g, i) { return { from: 'cpu', to: g, label: 'W', delay: i * 0.1 }; }), set: { g0: { cells: [co('W', 'c0'), co('64', 'c0')] }, g1: { cells: [co('W', 'c1'), co('64', 'c1')] }, g2: { cells: [co('W', 'c2'), co('64', 'c2')] }, g3: { cells: [co('W', 'c3'), co('64', 'c3')] } }, code: ['global_batch_size = 128', 'dataset = tf.data.Dataset.from_tensor_slices((inputs, labels)).batch(global_batch_size)'], say: 'For each step the current weights are copied to every GPU, which also gets its slice of the global batch (128 images split across the GPUs).' },
      { t: 'GPUs compute gradients', set: { g0: { cells: [co('W', 'c0'), co('∇', 'hot')] }, g1: { cells: [co('W', 'c1'), co('∇', 'hot')] }, g2: { cells: [co('W', 'c2'), co('∇', 'hot')] }, g3: { cells: [co('W', 'c3'), co('∇', 'hot')] } }, pulse: ['g0', 'g1', 'g2', 'g3'], code: 'model.fit(dataset, epochs=5)', say: 'The heavy computation (forward and backward) happens on the GPUs.' },
      { t: 'Gradients go back, the CPU updates', flow: ['g0', 'g1', 'g2', 'g3'].map(function (g, i) { return { from: g, to: 'cpu', label: '∇', cls: 'hot', delay: i * 0.1 }; }), set: { cpu: { cells: [co("W'", 'ok')] } }, code: 'print(f"\\nTraining completed in {time.time() - start_time:.2f} seconds.")', say: 'The gradients are aggregated and applied <b>on the CPU</b> to the single copy of the weights. Every step moves weights down and gradients up across PCIe, which is why this strategy is usually slower than <code>MirroredStrategy</code> when GPUs are connected by fast links.' }
    ],
    notes: ['It can help when the model is too large to replicate on every GPU, or when GPUs lack peer-to-peer links; the script prints "Variables are stored centrally!".']
  }));

  /* ---------- jax_multigpu.py ---------- */
  PDC.add(Object.assign({ id: 'jax_multigpu' }, one, {
    title: 'Keras 3 on JAX: data and model parallelism', files: [DP + '1_node/keras3/jax/jax_multigpu.py'], concepts: ['keras.distribution', 'DataParallel', 'DeviceMesh / LayoutMap', 'ModelParallel', 'sharded weights'],
    summary: 'The same small network trained two ways on 2 GPUs: <b>DataParallel</b> (replicate the model, split the batch) and <b>ModelParallel</b> (split one layer\'s weights across the GPUs).',
    kind: 'diagram',
    scene: {
      w: 760, h: 340,
      nodes: {
        data: { x: 250, y: 6, w: 260, h: 56, label: 'batch of 16 images', cls: 'mem' },
        g0: { x: 60, y: 110, w: 280, h: 150, label: 'GPU 0', c: 0, cells: [], cw: 80 }, g1: { x: 420, y: 110, w: 280, h: 150, label: 'GPU 1', c: 1, cells: [], cw: 80 },
        cap: { x: 60, y: 276, w: 640, h: 56, shape: 'text', label: '', hidden: true }
      }
    },
    steps: [
      { t: 'Use the JAX backend; keep TensorFlow off the GPUs', code: ['os.environ["KERAS_BACKEND"] = "jax"', "tf.config.set_visible_devices([], 'GPU')"], say: 'Keras 3 runs on JAX when <code>KERAS_BACKEND=jax</code>. TensorFlow is imported only for <code>tf.data</code>, so it is told to see <b>no GPUs</b> &mdash; otherwise it would reserve their memory and starve JAX.' },
      { t: 'Find the GPUs', code: ['devices = jax.devices("gpu")', 'print(f"Found {len(devices)} GPUs: {devices}")'], pulse: ['g0', 'g1'], say: '<code>jax.devices("gpu")</code> lists the GPUs JAX can use (two in the demo).' },
      { t: 'DataParallel: replicate the model', set: { g0: { sub: 'full model', cells: [co('dense_1 W', 'c0'), co('dense_2 W', 'c0')] }, g1: { sub: 'full model', cells: [co('dense_1 W', 'c1'), co('dense_2 W', 'c1')] } }, code: ['data_parallel = keras.distribution.DataParallel(devices=devices)', 'keras.distribution.set_distribution(data_parallel)'], say: 'With <code>DataParallel</code> every device gets a <b>complete copy</b> of the model weights &mdash; the same idea as <code>MirroredStrategy</code>.' },
      { t: 'DataParallel: split the batch', flow: [{ from: 'data', to: 'g0', label: '8 imgs' }, { from: 'data', to: 'g1', label: '8 imgs', delay: 0.15 }], code: ['model_dp = build_model()', 'model_dp.fit(dataset, epochs=2)'], say: 'Each training batch is sharded across the GPUs (here 8 images each); gradients are averaged automatically. The user code is just <code>fit</code>: no <code>strategy.scope()</code>, because the distribution is set <b>globally</b>.' },
      { t: 'ModelParallel: a 1 &times; 2 device mesh', set: { g0: { sub: 'mesh position (data 0, model 0)', cells: [] }, g1: { sub: 'mesh position (data 0, model 1)', cells: [] } }, code: ['mesh_1x2 = keras.distribution.DeviceMesh(', 'layout_map = keras.distribution.LayoutMap(mesh_1x2)'], say: 'A <b>DeviceMesh</b> arranges devices on named axes: <code>shape=(1, 2)</code> with axes <code>("data", "model")</code> means 1 device along "data" and 2 along "model". A <code>LayoutMap</code> says which weights are split along which axis.' },
      { t: 'Shard dense_1\'s kernel across the model axis', set: { g0: { sub: 'half of dense_1 kernel', cells: [co('W[:, 0:100]', 'c0'), co('bias[0:100]', 'c0')] }, g1: { sub: 'other half of dense_1 kernel', cells: [co('W[:, 100:200]', 'c1'), co('bias[100:200]', 'c1')] } }, code: ['layout_map["dense_1/kernel"] = (None, "model") # Shard this kernel', 'layout_map["dense_1/bias"] = ("model",)        # Shard this bias'], say: '<code>(None, "model")</code> means: do not split the first dimension, split the second one over the "model" axis. So each GPU holds <b>half of the 200 output neurons</b> of <code>dense_1</code>. This is how a layer too big for one GPU is distributed.' },
      { t: 'Train the model-parallel version', flow: [{ from: 'data', to: 'g0', label: 'all 16' }, { from: 'data', to: 'g1', label: 'all 16', delay: 0.15 }, { from: 'g0', to: 'g1', label: 'partial', delay: 0.5, cls: 'hot' }], code: ['model_parallel = keras.distribution.ModelParallel(', 'model_mp.fit(dataset, epochs=2)'], say: 'Now both GPUs see the <b>whole batch</b> (the data axis has size 1) but each computes only its half of the layer; intermediate results are exchanged between the GPUs as needed. JAX inserts these collectives automatically from the layout.' },
      { t: 'When to use which', code: ['def build_model():', 'print("Demo Complete!")'], say: '<b>Data parallelism</b>: model fits on one GPU, you want more throughput. <b>Model parallelism</b>: the model (or a layer) does not fit on one GPU, so its weights are split. Large systems combine both on a 2-D mesh.' }
    ]
  }));

  /* ---------- torch_multigpu.py ---------- */
  PDC.add(Object.assign({ id: 'torch_multigpu' }, one, {
    title: 'PyTorch DistributedDataParallel (DDP)', files: [DP + '1_node/keras3/torch/torch_multigpu.py'], concepts: ['mp.spawn', 'init_process_group("nccl")', 'DistributedDataParallel', 'DistributedSampler', 'checkpoint & resume'],
    summary: 'One <b>process per GPU</b>, each with its own model replica and its own shard of the data. Gradients are all-reduced during <code>backward()</code>; rank 0 saves a checkpoint so training can resume after an interruption.',
    kind: 'diagram',
    scene: {
      w: 760, h: 340,
      edges: [['r0', 'r1', { dash: true, label: 'NCCL all-reduce' }]],
      nodes: {
        main: { x: 250, y: 6, w: 260, h: 56, label: 'main: mp.spawn(...)', cls: 'cpu' },
        r0: { x: 60, y: 110, w: 280, h: 130, label: 'process rank 0 (GPU 0)', c: 0, cells: [], cw: 72 }, r1: { x: 420, y: 110, w: 280, h: 130, label: 'process rank 1 (GPU 1)', c: 1, cells: [], cw: 72 },
        ck: { x: 250, y: 270, w: 260, h: 56, label: 'ddp_survival_backup.pt', sub: 'checkpoint on disk', cls: 'mem', hidden: true }
      }
    },
    steps: [
      { t: 'Spawn one process per GPU', show: ['r0', 'r1'], flow: [{ from: 'main', to: 'r0', label: 'spawn' }, { from: 'main', to: 'r1', label: 'spawn', delay: 0.15 }], code: ['world_size = torch.cuda.device_count()', 'mp.spawn(train, args=(world_size,), nprocs=world_size, join=True)'], say: '<code>mp.spawn</code> starts <code>world_size</code> Python processes, each running <code>train(rank, world_size)</code> with its own <code>rank</code> (= GPU index). Unlike TensorFlow\'s single-process <code>MirroredStrategy</code>, <b>DDP is multi-process</b>.' },
      { t: 'Join the NCCL process group', pulse: ['r0', 'r1'], code: ['os.environ[\'MASTER_ADDR\'] = \'localhost\'', 'torch.distributed.init_process_group("nccl", rank=rank, world_size=world_size)'], say: 'The processes rendezvous at <code>MASTER_ADDR:MASTER_PORT</code> and form a <b>process group</b> using the NCCL backend (GPU collectives).' },
      { t: 'Each rank builds the model on its GPU', set: { r0: { cells: [co('W', 'c0')] }, r1: { cells: [co('W', 'c1')] } }, code: ['model = SimpleCNN().to(rank)', 'optimizer = optim.Adam(model.parameters())'], say: 'Every process creates the same model and moves it to its own GPU (<code>.to(rank)</code>).' },
      { t: 'Restore a checkpoint if one exists', show: ['ck'], flow: [{ from: 'ck', to: 'r0', label: 'state', cls: 'ok' }, { from: 'ck', to: 'r1', label: 'state', cls: 'ok', delay: 0.15 }], code: ['if os.path.exists(checkpoint_path):', "model.load_state_dict(checkpoint['model_state_dict'])", "start_epoch = checkpoint['epoch'] + 1"], say: 'If a backup file exists (from an earlier, interrupted run) every rank loads the weights and optimizer state and continues from the <b>next epoch</b>. This happens <em>before</em> wrapping with DDP.' },
      { t: 'Wrap the model in DDP', code: 'ddp_model = DDP(model, device_ids=[rank])', say: '<code>DDP</code> registers hooks on the parameters. During <code>backward()</code> it <b>all-reduces the gradients</b> across ranks (overlapped with the backward computation), so every replica applies the same update.' },
      { t: 'DistributedSampler: each rank a different shard', set: { r0: { cells: [co('W', 'c0'), co('shard 0', 'hot')] }, r1: { cells: [co('W', 'c1'), co('shard 1', 'hot')] } }, code: ['sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)', 'sampler.set_epoch(epoch)'], say: '<code>DistributedSampler</code> gives each rank a disjoint part of the dataset. <code>set_epoch(epoch)</code> reshuffles differently every epoch (forgetting it makes every epoch use the same order).' },
      { t: 'Training step: backward triggers all-reduce', flow: [{ from: 'r0', to: 'r1', label: '∇', cls: 'hot' }, { from: 'r1', to: 'r0', label: '∇', cls: 'hot', delay: 0.1 }], pulse: ['r0', 'r1'], code: ['loss.backward()', 'optimizer.step()'], say: 'After <code>loss.backward()</code> every rank holds the <b>same averaged gradient</b>, so <code>optimizer.step()</code> keeps all replicas identical.' },
      { t: 'Rank 0 saves a "survival backup"', flow: [{ from: 'r0', to: 'ck', label: 'save', cls: 'ok' }], show: ['ck'], code: ['if rank == 0:', 'torch.save({', "'model_state_dict': ddp_model.module.state_dict(),"], say: 'Only <b>rank 0</b> writes the checkpoint (all replicas are identical, so one copy is enough, and writing from every rank would collide). <code>ddp_model.module</code> unwraps the DDP layer to save plain weights.' },
      { t: 'Load for inference', hide: ['r0', 'r1'], code: ['def load_and_predict(filepath="ddp_survival_backup.pt"):', 'model.eval()', 'predicted_class = torch.argmax(predictions, dim=1).item()'], say: '<code>load_and_predict</code> rebuilds the <em>blank</em> architecture, loads the saved <code>state_dict</code> onto the CPU, calls <code>model.eval()</code> (disables dropout) and predicts under <code>torch.no_grad()</code>. Uncomment the call at the end of <code>main()</code> to try it.' }
    ],
    notes: ['DDP is the standard PyTorch data-parallel tool; Horovod and TensorFlow\'s MirroredStrategy use the same synchronous all-reduce idea.']
  }));

  /* ======================================================================
     Data parallelism: many nodes
     ====================================================================== */
  const mwNodes = {
    w0: { x: 20, y: 70, w: 340, h: 130, label: 'worker 0 (node A)', sub: 'TF_CONFIG task index 0', c: 0, cells: [co('GPU', 'c0'), co('GPU', 'c0')], cw: 80 },
    w1: { x: 400, y: 70, w: 340, h: 130, label: 'worker 1 (node B)', sub: 'TF_CONFIG task index 1', c: 1, cells: [co('GPU', 'c1'), co('GPU', 'c1')], cw: 80 },
    net: { x: 250, y: 6, w: 260, h: 44, shape: 'pill', label: 'network (gRPC / collectives)', cls: 'hot', hidden: true },
    ck: { x: 20, y: 240, w: 340, h: 60, label: 'chief: ckpt directory', sub: 'worker 0 writes real checkpoints', cls: 'mem', hidden: true },
    tmp: { x: 400, y: 240, w: 340, h: 60, label: 'other workers: temp dirs', sub: 'workertemp_1 (deleted after save)', cls: 'dim', hidden: true }
  };
  PDC.add(Object.assign({ id: 'sync-main' }, multi, {
    title: 'MultiWorkerMirrored: a custom training loop', files: [DP + 'n_nodes/sync/main.py', DP + 'n_nodes/sync/mnist.py'], concepts: ['MultiWorkerMirroredStrategy', 'TF_CONFIG', 'strategy.run / reduce', 'compute_average_loss', 'chief checkpointing', 'resume training'],
    summary: 'Synchronous data parallelism across machines with an explicit loop: each worker is a process described by <code>TF_CONFIG</code>; gradients are all-reduced over the network; the chief saves checkpoints and training can resume after a failure.',
    kind: 'diagram', scene: { w: 760, h: 316, nodes: mwNodes, edges: [['w0', 'w1', { dash: true }]] },
    steps: [
      { t: 'Each process learns its role from TF_CONFIG', code: ["tf_config = json.loads(os.environ['TF_CONFIG'])", 'num_workers = len(tf_config[\'cluster\'][\'worker\'])'], pulse: ['w0', 'w1'], say: 'The environment variable <code>TF_CONFIG</code> holds the whole cluster (a list of <code>host:port</code> workers) and <b>this</b> process\'s <code>task</code> (type and index). The same script runs on every node; only <code>index</code> differs.' },
      { t: 'Global batch = per-worker batch &times; workers', code: ['per_worker_batch_size = 64', 'global_batch_size = per_worker_batch_size * num_workers'], say: 'With 2 workers the global batch is 128. (Each worker may also have several GPUs; the strategy splits its share further.)' },
      { t: 'Create the strategy: workers connect', show: ['net'], flow: [{ from: 'w0', to: 'net', label: 'hello' }, { from: 'w1', to: 'net', label: 'hello', delay: 0.15 }], code: ['os.environ["TF_USE_LEGACY_KERAS"] = "1"', 'strategy = tf.distribute.MultiWorkerMirroredStrategy()'], say: '<code>MultiWorkerMirroredStrategy()</code> blocks until <b>all workers have started</b> and connected. The legacy-Keras switch is needed for this strategy with recent TensorFlow.' },
      { t: 'Mirrored model, optimizer, metrics, loss', code: ['with strategy.scope():', 'multi_worker_model = mnist.build_cnn_model()', 'optimizer = tf.keras.optimizers.RMSprop(learning_rate=0.001)'], say: 'Everything stateful (model, optimizer, accuracy metric, <code>epoch</code> and <code>step_in_epoch</code> counters) is created inside the scope so it is mirrored across <b>all replicas on all workers</b>.' },
      { t: 'Each worker gets its own data shard', code: ['multi_worker_dataset = strategy.distribute_datasets_from_function(', 'lambda input_context: mnist.dataset_fn(global_batch_size, input_context))'], say: '<code>distribute_datasets_from_function</code> calls <code>dataset_fn</code> on each worker with an <code>input_context</code>, so the function can shard the data by worker (see <code>mnist.py</code>).' },
      { t: 'train_step: run on every replica', code: ['@tf.function', 'def train_step(iterator):', 'per_replica_losses = strategy.run(step_fn, args=(next(iterator),))'], say: '<code>strategy.run(step_fn, ...)</code> executes the step function on every replica. Inside it, <code>GradientTape</code> computes the gradient, and <code>optimizer.apply_gradients</code> <b>all-reduces</b> it across all replicas (over the network) before updating.' },
      { t: 'Scale the loss by the GLOBAL batch size', code: ['loss = tf.nn.compute_average_loss(per_example_loss, global_batch_size=global_batch_size)', 'return strategy.reduce(tf.distribute.ReduceOp.SUM, per_replica_losses, axis=None)'], say: 'Each replica sees only part of the batch. <code>compute_average_loss(..., global_batch_size=...)</code> divides by the <b>global</b> batch size, so that <em>summing</em> the replicas\' losses (and gradients) gives the correct mean. <code>strategy.reduce(SUM)</code> then produces one number for logging.' },
      { t: 'Only the chief writes checkpoints', show: ['ck', 'tmp'], code: ['def _is_chief(task_type, task_id, cluster_spec):', 'def write_filepath(filepath, task_type, task_id, cluster_spec):'], say: 'Every worker must call <code>checkpoint_manager.save()</code> (it involves collectives), but only the <b>chief</b> (worker 0 when no explicit chief exists) writes to the real directory; the others write to a temporary folder (<code>workertemp_&lt;id&gt;</code>) and delete it afterwards.' },
      { t: 'Resume after a failure', code: ['latest_checkpoint = tf.train.latest_checkpoint(checkpoint_dir)', 'checkpoint.restore(latest_checkpoint)', 'while epoch.numpy() < num_epochs:'], say: 'On start-up the newest checkpoint is restored, including the <code>epoch</code> and <code>step_in_epoch</code> variables, so a restarted job <b>continues where it stopped</b>. The loop then runs epochs and steps, printing accuracy and loss.' },
      { t: 'The recorded run', code: ["print('Epoch: %d, accuracy: %f, train_loss: %f.'", 'num_epochs = 3'], say: 'The committed log (<code>tf_out.out</code>) shows 2 workers and: epoch 0: accuracy 0.931, loss 0.235; epoch 1: 0.981, 0.075; epoch 2: 0.987, 0.050. The sibling log <code>tf_error.err</code> ends with the other worker reported "unhealthy", a typical failure when one node stops.' }
    ],
    notes: ['Start one process per node with the right <code>TF_CONFIG</code>; <code>n1.sh</code>/<code>n2.sh</code> do this by hand and <code>mnode_mnist.sh</code> does it via SLURM.']
  }));

  /* ---------- sync/mnist.py: sharded input pipeline ---------- */
  const shardNodes = {
    full: { x: 20, y: 10, w: 720, h: 84, label: 'full dataset: 60,000 images (first 12 shown), shuffled', cells: seq(12, function (i) { return co(i, 'empty'); }), cw: 46, cls: 'mem' },
    w0: { x: 20, y: 150, w: 350, h: 104, label: 'worker 0: shard(2, 0)', sub: 'takes every 2nd element starting at 0', c: 0, cells: [], cw: 46, hidden: true },
    w1: { x: 390, y: 150, w: 350, h: 104, label: 'worker 1: shard(2, 1)', sub: 'takes every 2nd element starting at 1', c: 1, cells: [], cw: 46, hidden: true }
  };
  PDC.add(Object.assign({ id: 'sync-mnist' }, multi, {
    title: 'Sharding the input data per worker', files: [DP + 'n_nodes/sync/mnist.py'], concepts: ['dataset.shard', 'input_context', 'repeat before batch', 'AutoShardPolicy.OFF', 'drop_remainder'],
    summary: 'The helper module used by the multi-worker program: it builds the dataset <em>per worker</em>, so no two workers train on the same images in the same step.',
    kind: 'diagram', scene: { w: 760, h: 270, nodes: shardNodes, edges: [['full', 'w0', { dash: true }], ['full', 'w1', { dash: true }]] },
    steps: [
      { t: 'Load and scale', code: ['def mnist_dataset(batch_size):', 'x_train = x_train / np.float32(255)', 'y_train = y_train.astype(np.int64)'], say: 'Every worker loads the <b>complete</b> MNIST training set, scales pixels to 0&ndash;1 and converts labels to <code>int64</code>.' },
      { t: 'Shuffle the whole set', set: { full: { cells: [5, 0, 9, 3, 7, 1, 11, 4, 8, 2, 10, 6].map(function (v) { return co(v, 'empty'); }) } }, code: '.shuffle(60000)', say: '<code>shuffle(60000)</code> randomises the whole dataset (the buffer is as large as the data set, so it is a perfect shuffle). With the same seed, all workers must see the same order for sharding to be consistent.' },
      { t: 'Per-replica batch size', code: ['def dataset_fn(global_batch_size, input_context):', 'batch_size = input_context.get_per_replica_batch_size(global_batch_size)'], say: '<code>input_context</code> describes this worker\'s position in the cluster. <code>get_per_replica_batch_size</code> divides the global batch size by the number of replicas in sync.' },
      { t: 'Shard: every worker takes a different part', show: ['w0', 'w1'], set: { w0: { cells: [5, 9, 7, 11, 8, 10].map(function (v) { return co(v, 'c0'); }) }, w1: { cells: [0, 3, 1, 4, 2, 6].map(function (v) { return co(v, 'c1'); }) } }, flow: [{ from: 'full', to: 'w0', label: '0,2,4..' }, { from: 'full', to: 'w1', label: '1,3,5..', delay: 0.15 }], code: ['dataset = dataset.shard(input_context.num_input_pipelines,', 'input_context.input_pipeline_id)'], say: '<code>dataset.shard(num_shards, index)</code> keeps every <i>num_shards</i>-th element starting at <i>index</i>. Without it both workers would read the same images and compute <b>the same gradients</b> &mdash; wasted work.' },
      { t: 'Repeat, then batch', code: ['dataset = dataset.repeat()', 'dataset = dataset.batch(batch_size, drop_remainder=True)'], say: '<code>repeat()</code> comes <b>before</b> <code>batch</code> so batches never run out mid-epoch (the loop controls epochs by steps). <code>drop_remainder=True</code> guarantees every batch has the same shape, which collective operations require.' },
      { t: 'Turn off auto-sharding', code: ['options.experimental_distribute.auto_shard_policy = tf.data.experimental.AutoShardPolicy.OFF', 'dataset = dataset.with_options(options)'], say: 'The strategy would normally shard automatically. Since the data was already sharded by hand, auto-sharding is <b>switched off</b> so the data is not split twice.' },
      { t: 'The model', code: ['def build_cnn_model():', 'regularizer = tf.keras.regularizers.L2(1e-5)', 'tf.keras.layers.Conv2D(32, 3,'], say: '<code>build_cnn_model</code> returns a small CNN (Reshape &rarr; Conv2D 32 &rarr; Flatten &rarr; Dense 128 &rarr; Dense 10) with L2 regularisation, which adds extra terms to <code>model.losses</code>; the training loop scales those with <code>tf.nn.scale_regularization_loss</code>.' }
    ]
  }));

  /* ---------- launch scripts ---------- */
  const launchNodes = {
    job: { x: 10, y: 10, w: 230, h: 70, label: 'sbatch mnode_mnist.sh', sub: '#SBATCH --nodes, --ntasks', cls: 'cpu' },
    hosts: { x: 270, y: 10, w: 250, h: 70, label: 'scontrol show hostnames', sub: '$SLURM_JOB_NODELIST', cls: 'mem' },
    arr: { x: 550, y: 10, w: 200, h: 70, label: 'WORKER_ARRAY', sub: '"gpu039:2222", "gpu040:2222"', cls: 'hot' },
    n0: { x: 60, y: 140, w: 300, h: 100, label: 'node 0 ($SLURM_NODEID = 0)', sub: 'TF_CONFIG index 0 → python main.py', c: 0, hidden: true },
    n1: { x: 400, y: 140, w: 300, h: 100, label: 'node 1 ($SLURM_NODEID = 1)', sub: 'TF_CONFIG index 1 → python main.py', c: 1, hidden: true }
  };
  PDC.add(Object.assign({ id: 'sync-launch' }, multi, {
    title: 'Launching workers: TF_CONFIG and SLURM scripts', files: [DP + 'n_nodes/sync/mnode_mnist.sh', DP + 'n_nodes/sync/n1.sh', DP + 'n_nodes/sync/n2.sh'], concepts: ['TF_CONFIG', 'SLURM_NODEID', 'srun bash -c', 'one worker per node'],
    summary: 'Two ways to start the multi-worker program: by hand on each node (<code>n1.sh</code>, <code>n2.sh</code>) and automatically from one SLURM job (<code>mnode_mnist.sh</code>), which builds <code>TF_CONFIG</code> for every node.',
    kind: 'diagram', scene: { w: 760, h: 260, nodes: launchNodes, edges: [['job', 'hosts'], ['hosts', 'arr']] },
    steps: [
      { t: 'By hand: n1.sh and n2.sh', show: ['n0', 'n1'], code: ['export TF_CONFIG=\'{', '"worker": ["gpu039:2242", "gpu040:2242"]', '"task": {"type": "worker", "index": 0}'], say: 'Run <code>n1.sh</code> on the first node and <code>n2.sh</code> on the second. The two files are identical except for <code>"index": 0</code> vs <code>1</code>; both list the <b>same two workers</b> (<code>host:port</code>) and then run <code>python main.py</code>. Commented lines show variants (one worker; two workers on <code>localhost</code>).' },
      { t: 'SLURM: reserve the nodes', hide: ['n0', 'n1'], pulse: ['job'], code: ['#SBATCH --nodes=1', '#SBATCH --ntasks=4', 'conda activate tf310_216'], say: 'The batch script declares its resources (<code>gpu4v100</code> partition, 4 GPUs) and activates the TensorFlow 2.16 environment. (Edit <code>--nodes</code> for a real multi-node run.)' },
      { t: 'Turn the node list into worker addresses', flow: [{ from: 'job', to: 'hosts', label: 'nodes' }, { from: 'hosts', to: 'arr', label: 'host:port', delay: 0.3 }], code: ['HOSTNAMES=$(scontrol show hostnames $SLURM_JOB_NODELIST)', 'PORT=2222', 'WORKER_ARRAY+="\\"${NODE}:${PORT}\\""', 'export WORKER_ARRAY'], say: '<code>scontrol show hostnames</code> expands SLURM\'s compact list (<code>gpu[039-040]</code>) into names; a loop appends <code>host:2222</code> to a JSON array held in <code>WORKER_ARRAY</code>, exported so <code>srun</code> can pass it on.' },
      { t: 'srun starts one task per node', show: ['n0', 'n1'], flow: [{ from: 'arr', to: 'n0', label: 'TF_CONFIG' }, { from: 'arr', to: 'n1', label: 'TF_CONFIG', delay: 0.2 }], code: ["srun --ntasks-per-node=1 bash -c '", '\\"index\\": $SLURM_NODEID', 'python main.py'], say: '<code>srun --ntasks-per-node=1 bash -c \'...\'</code> runs the quoted script on every node. Because of the single quotes, <code>$SLURM_NODEID</code> is evaluated <b>on each node</b>, giving index 0, 1, &hellip; automatically; each node builds its own <code>TF_CONFIG</code>, echoes it for the log, and launches <code>main.py</code>.' },
      { t: 'Reading the logs', code: ['echo "--- Node $SLURM_NODEID TF_CONFIG ---"', 'echo "Job complete!"'], say: 'The folder holds two sets of logs. <code>tf_out.out</code> is a successful 2-worker run. The <code>*2</code> logs are a run where each task ended with the cuDNN error <b>"No DNN in stream executor"</b> &mdash; usually a missing CUDA/cuDNN module or GPU visibility problem; a good troubleshooting exercise.' }
    ]
  }));

  /* ---------- parameter server ---------- */
  function psBuilder(o, v) {
    const nodes = {
      ps: { x: 280, y: 30, w: 200, h: 90, label: 'parameter server', sub: 'role "ps"  ' + v.psAddr, cls: 'mem', cells: [co('W', 'ok')], cw: 60 },
      chief: { x: 280, y: 190, w: 200, h: 90, label: 'chief (coordinator)', sub: 'role "chief"  CPU only', cls: 'cpu' }
    };
    for (let i = 0; i < v.workers; i++) nodes['wk' + i] = { x: v.workers === 1 ? 560 : 20 + i * 540, y: 100, w: 190, h: 110, label: 'worker ' + i, sub: v.wAddr[i], c: i, cells: [], cw: 60 };
    const edges = [['chief', 'ps', { dash: true }]];
    for (let i = 0; i < v.workers; i++) { edges.push(['ps', 'wk' + i, { dash: true }]); edges.push(['chief', 'wk' + i, { dash: true }]); }
    const W = []; for (let i = 0; i < v.workers; i++) W.push('wk' + i);
    return merge({
      kind: 'diagram', scene: { w: 760, h: 310, nodes: nodes, edges: edges },
      steps: [
        { t: 'Three roles, one script', pulse: ['chief', 'ps'].concat(W), code: ["parser.add_argument('--role', type=str, required=True, choices=['chief', 'worker', 'ps'])", 'cluster_dict = {'], say: 'The same file is started once per <b>role</b>: <code>--role ps</code>, <code>--role worker --index n</code> and <code>--role chief</code>. The cluster is described by <code>TF_CONFIG</code> built from hard-coded IPs (edit <code>cluster_dict</code> for your machines).' },
        { t: 'Hide the GPUs from the chief and the server', code: ["if args.role in ['chief', 'ps']:", "tf.config.set_visible_devices([], 'GPU')"], say: 'The chief and the parameter server do no GPU computation; hiding the GPUs stops them from reserving memory that the workers need on the same machine.' },
        { t: 'Servers and workers just listen', code: ["if cluster_resolver.task_type in ['ps', 'worker']:", 'server = tf.distribute.Server(', 'server.join()'], say: 'A <code>ps</code> or <code>worker</code> process starts a gRPC <code>tf.distribute.Server</code> and then <b>blocks in <code>server.join()</code></b>, waiting for instructions from the chief. They contain no training code of their own.' },
        { t: 'The chief creates the strategy', flow: [{ from: 'chief', to: 'ps', label: 'place vars' }].concat(W.map(function (w, i) { return { from: 'chief', to: w, label: 'connect', delay: 0.2 + i * 0.1 }; })), code: ['strategy = tf.distribute.ParameterServerStrategy(cluster_resolver)', 'num_workers = cluster_resolver.cluster_spec().num_tasks(\'worker\')'], say: 'Only the chief reaches this line. <code>ParameterServerStrategy</code> places the model <b>variables on the parameter server</b> and turns the chief into a <em>coordinator</em> that schedules work on the workers.' },
        { t: 'Build the model under the strategy scope', set: { ps: { cells: [co('W', 'ok'), co('b', 'ok')] } }, code: ['with strategy.scope():', 'steps_per_execution=' + v.spe], say: 'The model\'s weights and biases are created on the parameter server. <code>steps_per_execution=' + v.spe + '</code> makes each scheduled function run ' + v.spe + ' training steps, <b>reducing the coordination overhead</b>' + (v.spe > 10 ? ' (raised to 50 here to hide network latency)' : '') + '.' },
        { t: 'Workers pull weights and compute gradients', flow: W.map(function (w, i) { return { from: 'ps', to: w, label: 'W', delay: i * 0.15 }; }), set: merge.apply(null, W.map(function (w, i) { const o2 = {}; o2[w] = { cells: [co('W', 'c' + i), co('∇', 'hot')] }; return o2; })), code: 'model.fit(dataset, steps_per_epoch=' + v.steps, say: 'Each worker reads the current weights from the parameter server, computes gradients on its <b>own batches</b> from the repeated dataset (<code>dataset.repeat().batch(' + v.batch + ')</code>) and does not wait for the other workers.' },
        { t: 'Push updates asynchronously', flow: W.map(function (w, i) { return { from: w, to: 'ps', label: '∇', cls: 'hot', delay: i * 0.3 }; }), pulse: ['ps'], code: 'model.fit(dataset, steps_per_epoch=' + v.steps, say: 'Gradients are applied to the parameter server <b>as soon as they arrive</b>. Workers may therefore compute on slightly <em>stale</em> weights (asynchronous SGD): there is no barrier, so a slow or crashed worker does not stop the others.' },
        { t: 'The chief drives training with fit()', code: ['model.fit(dataset, steps_per_epoch=' + v.steps + ', epochs=' + v.epochs + ')', 'print(f"Training finished on {args.role} {args.index}!")'], say: 'Keras <code>fit</code> on the chief automatically creates a <code>ClusterCoordinator</code> that dispatches <code>steps_per_execution</code>-step functions to whichever worker is free. ' + v.last }
      ]
    }, o);
  }
  PDC.add(psBuilder(Object.assign({ id: 'async-test_ps', title: 'ParameterServerStrategy: minimal example' }, multi, {
    files: [DP + 'n_nodes/async/test_ps.py'], concepts: ['ParameterServerStrategy', 'chief / ps / worker', 'asynchronous training', 'steps_per_execution'],
    summary: 'The smallest parameter-server cluster: one chief, one parameter server and <b>one</b> worker, training a tiny CNN on random data to verify that the cluster works.',
    notes: ['Start order: <code>ps</code>, <code>chief</code> on one node and <code>worker</code> on the other (see the docstring). The docstring still names the file <code>parameter_server.py</code>.']
  }), { workers: 1, wAddr: ['169.254.150.235:2000'], psAddr: ':2001', spe: 10, steps: 50, batch: 64, epochs: 2, last: 'With a single worker this is effectively sequential, but it exercises every component of the cluster.' }));
  PDC.add(psBuilder(Object.assign({ id: 'async-mnist', title: 'ParameterServerStrategy: MNIST with two workers' }, multi, {
    files: [DP + 'n_nodes/async/mnist.py'], concepts: ['ParameterServerStrategy', 'two workers', 'larger batch hides latency', 'port cleanup'],
    summary: 'A heavier CNN on real MNIST with <b>two workers</b> (one on each machine), batch 1024 and <code>steps_per_execution=50</code> to keep the GPUs busy despite network latency.',
    notes: ['The docstring ends with a debugging command to free stuck ports: <code>lsof -t -i:2000,2001,2002 | xargs -r kill -9</code>.', 'Workers can sit on the same machine as the PS/chief (the cluster dict gives Sulu both a PS and a worker).']
  }), { workers: 2, wAddr: ['169.254.150.235:2000', '169.254.225.101:2002'], psAddr: ':2001', spe: 50, steps: 58, batch: 1024, epochs: 5, last: '60,000 images / batch 1024 &asymp; 58 steps per epoch; the chief runs 5 epochs.' }));

  /* ---------- test_jax.py ---------- */
  PDC.add(Object.assign({ id: 'jax-multinode' }, multi, {
    title: 'JAX across two nodes: an NCCL all-reduce test', files: [DP + '1_node/keras3/jax/test_jax.py'], concepts: ['jax.distributed.initialize', 'pmap + psum', 'NCCL environment variables', 'coordinator address'],
    summary: 'A smoke test for a two-node JAX cluster: connect the nodes, give each GPU a 1.0, and sum across <em>all</em> GPUs of the cluster with <code>psum</code> &mdash; every GPU must print the global GPU count.',
    kind: 'diagram',
    scene: {
      w: 760, h: 320,
      edges: [['n0', 'n1', { dash: true, label: 'NCCL over TCP' }]],
      nodes: {
        n0: { x: 30, y: 60, w: 310, h: 130, label: 'node 0 (process_id 0)', sub: 'the coordinator', c: 0, cells: [co('GPU 0', 'c0')], cw: 70 },
        n1: { x: 420, y: 60, w: 310, h: 130, label: 'node 1 (process_id 1)', sub: '', c: 1, cells: [co('GPU 0', 'c1')], cw: 70 },
        co: { x: 250, y: 220, w: 260, h: 70, label: 'coordinator 169.254.225.101:12345', sub: 'rendezvous service', cls: 'mem', hidden: true }
      }
    },
    steps: [
      { t: 'Fix the NCCL network settings', code: ['os.environ["NCCL_SOCKET_IFNAME"] = "enp101s0f1"', 'os.environ["NCCL_IB_DISABLE"] = "1"', 'os.environ["NCCL_P2P_DISABLE"] = "1"'], say: 'On this pair of machines NCCL must be told which network interface to use (<code>NCCL_SOCKET_IFNAME</code>) and to <b>avoid</b> InfiniBand, peer-to-peer and shared-memory transports (<code>NCCL_IB/P2P/SHM_DISABLE</code>), otherwise it hangs. <code>NCCL_DEBUG=INFO</code> prints what it chooses.' },
      { t: 'Keep TensorFlow away from the GPUs', code: ["import tensorflow as tf", "tf.config.set_visible_devices([], 'GPU')"], say: 'If TensorFlow is installed in the same conda environment it could grab GPU memory when imported; hiding the GPUs from it leaves them to JAX.' },
      { t: 'Start the same script on both nodes', code: ["python test_jax.py --coordinator=169.254.225.101:12345 --num_nodes=2 --node_id=0", 'parser.add_argument(\'--node_id\', type=int, required=True)'], say: 'The docstring shows the two commands: node 0 ("Sulu") with <code>--node_id=0</code> and node 1 ("Spock") with <code>--node_id=1</code>, both pointing at the coordinator\'s <code>host:port</code>.' },
      { t: 'jax.distributed.initialize', show: ['co'], flow: [{ from: 'n0', to: 'co', label: 'join' }, { from: 'n1', to: 'co', label: 'join', delay: 0.2 }], code: ['jax.distributed.initialize(', 'coordinator_address=args.coordinator,', 'process_id=args.node_id'], say: 'Each process registers with the <b>coordinator</b>, which assigns the global device order. After this call JAX sees the GPUs of <em>all</em> nodes.' },
      { t: 'Local and global device counts', set: { n0: { sub: 'Local GPUs: 1 | Global GPUs: 2' }, n1: { sub: 'Local GPUs: 1 | Global GPUs: 2' } }, code: ['local_gpus = jax.local_device_count()', 'global_gpus = jax.device_count()'], say: '<code>jax.local_device_count()</code> is this node\'s GPUs, <code>jax.device_count()</code> all GPUs in the cluster. Each process prints both.' },
      { t: 'Each GPU starts with a 1', set: { n0: { cells: [co('1.0', 'c0')] }, n1: { cells: [co('1.0', 'c1')] } }, code: 'local_data = jnp.ones(local_gpus)', say: 'A vector of ones, one element per <em>local</em> GPU, is the test input.' },
      { t: 'psum: an all-reduce across the whole cluster', flow: [{ from: 'n0', to: 'n1', label: '1.0', cls: 'hot' }, { from: 'n1', to: 'n0', label: '1.0', cls: 'hot', delay: 0.1 }], set: { n0: { cells: [co('2.0', 'ok')] }, n1: { cells: [co('2.0', 'ok')] } }, code: ["return jax.lax.psum(x, axis_name='global_mesh')", "parallel_sum = jax.pmap(cross_node_sum, axis_name='global_mesh')", 'result = parallel_sum(local_data)'], say: '<code>jax.pmap</code> runs the function on every local GPU in parallel; <code>jax.lax.psum</code> adds the value across <b>all GPUs of the named axis</b>, which spans both nodes, using an NCCL all-reduce over the network. With 2 GPUs every GPU gets 1 + 1 = 2.0 (with 4 GPUs it would be 4.0).' },
      { t: 'SUCCESS', code: 'print(f"SUCCESS! Node {args.node_id} result after sync: {result}")', say: 'If both nodes print the global GPU count, GPU-to-GPU communication across nodes works. If it hangs, check the interface name and the NCCL variables first.' }
    ],
    notes: ['The file is under <code>1_node/keras3/jax/</code> but demonstrates <b>multi-node</b> JAX; the IP addresses and interface name are specific to the machines used in class.']
  }));

  /* ======================================================================
     Data distribution notebook
     ====================================================================== */
  PDC.add(Object.assign({ id: 'intro_tf' }, one, {
    title: 'Global vs local batch size, and sharding', files: [DP + 'data_distribution/intro_tf.ipynb'], concepts: ['global batch size', 'per-replica batch', 'dataset.shard', 'auto-shard', 'from_tensor_slices'],
    summary: 'A notebook on two classic mistakes: confusing the per-GPU batch with the global batch, and forgetting to shard the data so every worker trains on the same images.',
    kind: 'diagram',
    scene: {
      w: 760, h: 330,
      nodes: {
        cfg: { x: 10, y: 6, w: 740, h: 90, label: 'per_replica_batch_size = 64', sub: 'what ONE GPU can hold', cls: 'mem', cells: [], cw: 60 },
        g0: { x: 20, y: 130, w: 165, h: 90, label: 'GPU 0', c: 0, cells: [co(64, 'c0')], cw: 60 }, g1: { x: 205, y: 130, w: 165, h: 90, label: 'GPU 1', c: 1, cells: [co(64, 'c1')], cw: 60 },
        g2: { x: 390, y: 130, w: 165, h: 90, label: 'GPU 2', c: 2, cells: [co(64, 'c2')], cw: 60 }, g3: { x: 575, y: 130, w: 165, h: 90, label: 'GPU 3', c: 3, cells: [co(64, 'c3')], cw: 60 },
        total: { x: 190, y: 250, w: 380, h: 60, label: 'global batch = 64 × 4 = 256', sub: 'what the optimizer sees per step', cls: 'ok' }
      }
    },
    steps: [
      { t: 'The classic mistake', code: ['# Global vs. Local Batch Size', 'per_replica_batch_size = 64'], say: 'Students set the batch size to 64 and assume the whole cluster processes 64 images. In reality <b>each replica</b> processes 64.' },
      { t: 'Compute the global batch size', pulse: ['g0', 'g1', 'g2', 'g3'], code: ['num_workers = strategy.num_replicas_in_sync', 'global_batch_size = per_replica_batch_size * num_workers'], say: 'With 4 GPUs the optimizer actually sees <b>256</b> images per step. The code should compute it from <code>strategy.num_replicas_in_sync</code>, not hard-code it. (Remember to adjust the learning rate when the global batch grows.)' },
      { t: 'Report the numbers', code: ['print(f"Local Batch Size: {per_replica_batch_size}")', 'print(f"Global Batch Size: {global_batch_size}")'], say: 'Printing both numbers at start-up makes the setup visible in the logs and catches the mistake early.' },
      { t: 'Why you must shard', code: ['dataset = dataset.shard(num_shards=total_nodes, index=node_index)', 'print(f"Node {node_index} | Size AFTER sharding: {sharded_size} images")'], say: 'If both nodes load all 60,000 images and do not shard, they read the same data and compute <b>identical gradients</b>. <code>dataset.shard(num_shards, index)</code> gives each node a disjoint 30,000-image part; the notebook prints the size before and after.' },
      { t: 'Build the whole pipeline', code: ['dataset = tf.data.Dataset.from_tensor_slices((x_train, y_train))', 'dataset = dataset.cache()', 'dataset = dataset.prefetch(tf.data.AUTOTUNE)'], say: '<code>from_tensor_slices</code> turns the NumPy arrays into a <code>tf.data</code> pipeline (slicing along the first dimension); then <code>cache</code>, <code>shuffle</code>, <code>repeat</code>, <code>batch(global_batch_size, drop_remainder=True)</code> and <code>prefetch(AUTOTUNE)</code> (load the next batch while the GPUs compute).' },
      { t: 'Single node: let the strategy do it', code: ['distributed_dataset = strategy.experimental_distribute_dataset(normal_dataset)', "print(f\"Per-GPU Batch Size:     {local_batch_size} (Sent to each GPU)\")"], say: 'On one machine, build an ordinary dataset with the <b>global</b> batch size and call <code>strategy.experimental_distribute_dataset</code>: the strategy automatically slices every global batch across the local GPUs (<b>auto-sharding</b>).' }
    ]
  }));

  /* ======================================================================
     Homework
     ====================================================================== */
  const hwNodes = {
    img: { x: 10, y: 20, w: 160, h: 100, label: 'CIFAR-100 image', sub: '32 × 32 × 3\n100 classes', cls: 'mem' },
    pre: { x: 195, y: 20, w: 170, h: 100, label: 'preprocess', sub: 'resize 224×224\nvgg16.preprocess_input', c: 0 },
    vgg: { x: 390, y: 20, w: 180, h: 100, label: 'VGG16 (weights=None)', sub: 'trained from scratch', c: 1 },
    head: { x: 595, y: 20, w: 155, h: 100, label: 'head', sub: 'Flatten → Dense 512\nDropout .5 → Dense 100', c: 3 },
    g0: { x: 20, y: 190, w: 165, h: 100, label: 'GPU 0', c: 0, cells: [co('32', 'c0')], cw: 50 }, g1: { x: 205, y: 190, w: 165, h: 100, label: 'GPU 1', c: 1, cells: [co('32', 'c1')], cw: 50 },
    g2: { x: 390, y: 190, w: 165, h: 100, label: 'GPU 2', c: 2, cells: [co('32', 'c2')], cw: 50 }, g3: { x: 575, y: 190, w: 165, h: 100, label: 'GPU 3', c: 3, cells: [co('32', 'c3')], cw: 50 }
  };
  PDC.add(Object.assign({ id: 'mirrored' }, { course: 'hpml', topic: 'homework' }, {
    title: 'VGG16 on CIFAR-100 with MirroredStrategy', files: ['hpml26-dataparallel_hw/mirrored.py', 'hpml26-dataparallel_hw/mirrored.sh'], concepts: ['MirroredStrategy', 'tf.data pipeline', 'VGG16 from scratch', 'SGD + momentum', 'SLURM job on Delta'],
    summary: 'The assignment: train a VGG16 network from scratch on CIFAR-100 (images upscaled to 224&times;224) on a 4-GPU node with <code>MirroredStrategy</code>, checkpointing every epoch, then evaluate on the test set.',
    kind: 'diagram', scene: { w: 760, h: 320, nodes: hwNodes, edges: [['img', 'pre'], ['pre', 'vgg'], ['vgg', 'head']] },
    steps: [
      { t: 'Ask SLURM for 4 A100 GPUs', code: ['#SBATCH --partition=gpuA100x4', '#SBATCH --gpus-per-node=4', '#SBATCH --mem=48G', 'module load aws-ofi-nccl/1.14.2'], say: '<code>mirrored.sh</code> requests one node of the <b>NCSA Delta</b> <code>gpuA100x4</code> partition with 4 GPUs, 48 GB of memory and 30 minutes, loads the TensorFlow conda module and the <code>aws-ofi-nccl</code> plugin (fast NCCL communication), then runs <code>python mirrored.py</code>. Replace <code>--account</code> with your own allocation.' },
      { t: 'Strategy and global batch size', pulse: ['g0', 'g1', 'g2', 'g3'], code: ['strategy = tf.distribute.MirroredStrategy()', 'global_batch_size = BATCH_SIZE_PER_REPLICA * num_replicas'], say: '32 images per GPU &times; 4 replicas = global batch <b>128</b>. Legacy Keras 2 is forced with <code>TF_USE_LEGACY_KERAS=1</code>.' },
      { t: 'Preprocess each image', flow: [{ from: 'img', to: 'pre', label: '32×32' }], pulse: ['pre'], code: ['def preprocess(x, y):', 'x = tf.image.resize(x, (IMG_SIZE, IMG_SIZE))', 'x = tf.keras.applications.vgg16.preprocess_input(x)'], say: 'CIFAR images are 32&times;32 but VGG16 expects 224&times;224, so they are <b>resized</b> and normalised the way VGG was trained (<code>preprocess_input</code>). This is expensive: a good reason for <code>num_parallel_calls=AUTOTUNE</code>.' },
      { t: 'The input pipeline', code: ['train_ds = train_ds.shuffle(50000)', 'train_ds = train_ds.batch(global_batch_size, drop_remainder=True)', 'train_ds = train_ds.prefetch(tf.data.AUTOTUNE)'], say: 'Shuffle all 50,000 training images, map the preprocessing in parallel, <code>repeat()</code>, batch with the <b>global</b> size (MirroredStrategy splits each batch across GPUs), and <code>prefetch</code> so the GPUs never wait for data.' },
      { t: 'Build VGG16 inside the scope', flow: [{ from: 'pre', to: 'vgg', label: '224²' }, { from: 'vgg', to: 'head', delay: 0.3 }], pulse: ['vgg', 'head'], code: ['with strategy.scope():', 'base_model = tf.keras.applications.VGG16(', 'weights=None,', 'x = tf.keras.layers.Flatten()(base_model.output)'], say: '<code>weights=None</code> means <b>random initialisation</b>: no pretrained weights. A new head (Flatten &rarr; Dense 512 &rarr; Dropout 0.5 &rarr; Dense 100) outputs logits for the 100 classes. The VGG16 body has about 14.7 million parameters, the head about 12.9 million.' },
      { t: 'Compile with SGD + momentum', code: ['optimizer=tf.keras.optimizers.SGD(learning_rate=0.01, momentum=0.9),', 'loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),'], say: 'SGD with momentum 0.9 and learning rate 0.01; sparse categorical cross-entropy on logits.' },
      { t: 'Train with a checkpoint every epoch', flow: ['g0', 'g1', 'g2', 'g3'].map(function (g, i) { return { from: 'vgg', to: g, label: '∇', cls: 'hot', delay: i * 0.1 }; }), code: ["filepath=os.path.join(checkpoint_dir, 'ckpt-{epoch}'),", 'model.fit(', 'steps_per_epoch=400,'], say: 'The data set repeats forever, so an "epoch" is defined as <b>400 steps</b> (<code>steps_per_epoch=400</code>, i.e. 51,200 images); 30 epochs in total. <code>ModelCheckpoint</code> saves the weights after every epoch.' },
      { t: 'Evaluate', code: ['eval_result = model.evaluate(test_ds)', 'print("Test Loss & Accuracy:", eval_result)'], say: 'Finally the model is evaluated on the 10,000 test images (batched with the global batch size). Training a deep network from scratch on 32&times;32 data with so few epochs will not reach high accuracy &mdash; part of the assignment is to explain why and to measure scaling with 1, 2 and 4 GPUs.' }
    ],
    notes: ['Typical analysis for the assignment: time per epoch vs number of GPUs, speed-up and efficiency, and where the input pipeline limits scaling.', 'Related: <code>hpml/data_parallel/1_node/keras/mnist_multigpu.py</code> (the simpler MNIST version).']
  }));
})();
