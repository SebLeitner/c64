// Start/resume synchronously from the click gesture. Use the device's native
// sample rate; do not silently ignore a failed worklet or a suspended context.
export class SidAudio {
  constructor(workletUrl, readSamples, onChange) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass)
      throw new Error("Dieser Browser unterstützt Web Audio nicht.");
    this.context = new AudioContextClass();
    if (!this.context.audioWorklet) {
      this.context.close();
      throw new Error(
        "Audio benötigt HTTPS und einen Browser mit AudioWorklet-Unterstützung.",
      );
    }
    this.gain = this.context.createGain();
    this.gain.gain.value = 0.75;
    this.gain.connect(this.context.destination);
    this.muted = false;
    this.peak = 0;
    this.readSamples = readSamples;
    this.onChange = onChange;
    this.context.addEventListener("statechange", () => this.notify());
    // The resume call must precede asynchronous module loading on Safari/iOS.
    this.initializing = Promise.all([
      this.context.resume(),
      this.context.audioWorklet.addModule(workletUrl),
    ]).then(() => {
      this.node = new AudioWorkletNode(this.context, "c64-audio-processor", {
        outputChannelCount: [1],
      });
      this.node.connect(this.gain);
      this.node.port.onmessage = () => this.feed();
      this.feed();
      this.notify();
    });
  }
  get sampleRate() {
    return this.context.sampleRate;
  }
  get running() {
    return this.context.state === "running";
  }
  async resume() {
    const resumed = this.context.resume();
    await Promise.all([resumed, this.initializing]);
    if (!this.running)
      throw new Error(
        "Der Browser pausiert Audio. Bitte erneut auf TON FORTSETZEN klicken.",
      );
    this.notify();
  }
  feed() {
    const samples = this.readSamples();
    this.peak = 0;
    if (samples)
      for (const sample of samples)
        this.peak = Math.max(this.peak, Math.abs(sample));
    this.node?.port.postMessage(samples || new Float32Array(4096));
    this.notify();
  }
  setMuted(muted) {
    this.muted = muted;
    this.gain.gain.value = muted ? 0 : 0.75;
    this.notify();
  }
  async testTone() {
    await this.resume();
    this.setMuted(false);
    if (this.oscillator) return;
    const tone = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    tone.frequency.value = 440;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.15, now + 0.025);
    envelope.gain.setValueAtTime(0.15, now + 0.7);
    envelope.gain.linearRampToValueAtTime(0, now + 0.8);
    tone.connect(envelope);
    envelope.connect(this.gain);
    this.oscillator = tone;
    tone.onended = () => {
      tone.disconnect();
      envelope.disconnect();
      this.oscillator = null;
    };
    tone.start(now);
    tone.stop(now + 0.85);
  }
  notify() {
    this.onChange?.(this);
  }
  async destroy() {
    this.onChange = null;
    this.oscillator?.stop();
    this.node?.disconnect();
    this.gain.disconnect();
    await this.context.close();
  }
}
