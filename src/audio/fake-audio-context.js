// A minimal stand-in for AudioContext, used by the unit tests. It records every
// node it creates so tests can check what a sound or a music step built.
class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }
  setValueAtTime(v, t) {
    this.value = v;
    this.events.push(['set', v, t]);
  }
  linearRampToValueAtTime(v, t) {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error('non-finite ramp');
    this.events.push(['linear', v, t]);
  }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0) || !Number.isFinite(t)) throw new Error(`invalid exponential ramp to ${v}`);
    this.events.push(['exp', v, t]);
  }
  setTargetAtTime(v, t, c) {
    this.value = v;
    this.events.push(['target', v, t, c]);
  }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.outputs = [];
    ctx.nodes.push(this);
  }
  connect(dest) {
    this.outputs.push(dest);
    return dest;
  }
  disconnect() {
    this.outputs = [];
  }
}

export class FakeAudioContext {
  constructor() {
    this.nodes = [];
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.destination = new FakeNode(this, 'destination');
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    const n = new FakeNode(this, 'gain');
    n.gain = new FakeParam(1);
    return n;
  }
  createOscillator() {
    const n = new FakeNode(this, 'oscillator');
    n.frequency = new FakeParam(440);
    n.detune = new FakeParam(0);
    n.start = (t) => (n.startTime = t);
    n.stop = (t) => (n.stopTime = t);
    return n;
  }
  createBiquadFilter() {
    const n = new FakeNode(this, 'biquad');
    n.frequency = new FakeParam(350);
    n.Q = new FakeParam(1);
    return n;
  }
  createBufferSource() {
    const n = new FakeNode(this, 'buffer');
    n.start = (t) => (n.startTime = t);
    n.stop = (t) => (n.stopTime = t);
    return n;
  }
  createDynamicsCompressor() {
    const n = new FakeNode(this, 'compressor');
    n.threshold = new FakeParam(-24);
    n.ratio = new FakeParam(12);
    return n;
  }
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { length, sampleRate, numberOfChannels: channels, getChannelData: () => data };
  }
  count(kind) {
    return this.nodes.filter((n) => n.kind === kind).length;
  }
}
