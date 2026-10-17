// Browser events can press and release a key between two PAL keyboard scans.
// Keep short taps down for at least two frames, retaining normal held-key repeat.
export class KeyLatch {
  constructor(machine) {
    this.machine = machine;
    this.held = new Map();
    this.adapter = new Proxy(machine, {
      get: (target, property) => {
        if (property === "keyDown") return (key) => this.down(key);
        if (property === "keyUp") return (key) => this.up(key);
        const value = target[property];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  down(key) {
    const prior = this.held.get(key);
    if (prior && !prior.timer) return;
    if (prior) clearTimeout(prior.timer);
    this.held.set(key, { at: performance.now(), timer: null });
    this.machine.keyDown(key);
  }
  up(key) {
    const entry = this.held.get(key);
    if (!entry) {
      this.machine.keyUp(key);
      return;
    }
    if (entry.timer) return;
    const release = () => {
      this.machine.keyUp(key);
      this.held.delete(key);
    };
    const remaining = 40 - (performance.now() - entry.at);
    if (remaining <= 0) release();
    else entry.timer = setTimeout(release, remaining);
  }
  clear() {
    for (const entry of this.held.values()) clearTimeout(entry.timer);
    this.held.clear();
    for (let key = 0; key <= 64; key++) this.machine.keyUp(key);
  }
}
