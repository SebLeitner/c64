// Browser file I/O at the documented KERNAL LOAD/SAVE RAM vectors.
// BASIC itself (including its tokenizer and error handling) runs unchanged.
export const LOAD_TRAP = 0x02a7;
export const SAVE_TRAP = 0x02a8;

export function word(machine, address) {
  return machine.ramRead(address) | (machine.ramRead(address + 1) << 8);
}

export function decodePrg(bytes, secondary = 1, destination = 0x0801) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 3) {
    throw new Error(
      "Die PRG-Datei braucht eine Ladeadresse und mindestens ein Datenbyte.",
    );
  }
  const address = secondary === 0 ? destination : bytes[0] | (bytes[1] << 8);
  if (address + bytes.length - 2 > 0x10000) {
    throw new Error("Das Programm passt nicht in den 64-KB-Adressraum.");
  }
  return { address, data: bytes.subarray(2), end: address + bytes.length - 2 };
}

export function safeFilename(name) {
  const cleaned =
    name
      .replace(/[\x00-\x1f<>:"/\\|?*]/g, "")
      .trim()
      .slice(0, 100) || "programm";
  return /\.prg$/i.test(cleaned) ? cleaned : `${cleaned}.prg`;
}

export class FileBridge {
  constructor(machine, onRequest) {
    this.machine = machine;
    // c64-ready's public JS object owns the low-level, version-pinned WASM API.
    // Keep this dependency in one adapter; integration tests exercise real WASM.
    this.cpu = machine.wasm.exports;
    this.onRequest = onRequest;
    this.installed = false;
    this.pending = null;
  }

  poll() {
    if (!this.installed) {
      if (
        word(this.machine, 0x330) !== 0xf4a5 ||
        word(this.machine, 0x332) !== 0xf5ed
      )
        return;
      this.install();
    }
    if (this.pending || this.cpu.debugger_isRunning()) return;
    const pc = this.machine.getPC();
    if (pc !== LOAD_TRAP && pc !== SAVE_TRAP) return;
    const m = this.machine;
    const length = m.ramRead(0xb7);
    const pointer = word(m, 0xbb);
    const name = Array.from({ length }, (_, i) =>
      String.fromCharCode(m.ramRead((pointer + i) & 0xffff) & 0x7f),
    ).join("");
    this.pending = {
      kind: pc === LOAD_TRAP ? "load" : "save",
      pc,
      name,
      verify: m.getRegA() === 1,
      secondary: m.ramRead(0xb9),
      destination: m.getRegX() | (m.getRegY() << 8),
      // The $FFD8 entry has already copied A/X/Y to KERNAL workspace
      // before dispatching through $0332; registers no longer contain them.
      start: word(m, 0xc1),
      end: word(m, 0xae),
    };
    this.onRequest(this.pending);
  }

  install() {
    const m = this.machine;
    for (const [vector, trap] of [
      [0x330, LOAD_TRAP],
      [0x332, SAVE_TRAP],
    ]) {
      m.ramWrite(trap, 0x60); // RTS: resume the original KERNAL caller after the dialog.
      m.ramWrite(vector, trap & 0xff);
      m.ramWrite(vector + 1, trap >> 8);
      this.cpu.breakpoints_pcAdd(trap);
    }
    this.installed = true;
  }

  load(bytes) {
    if (this.pending?.kind !== "load") throw new Error("Kein LOAD aktiv.");
    const { address, data, end } = decodePrg(
      bytes,
      this.pending.secondary,
      this.pending.destination,
    );
    let mismatch = false;
    for (let i = 0; i < data.length; i++) {
      if (this.pending.verify)
        mismatch ||= this.machine.ramRead(address + i) !== data[i];
      else this.machine.ramWrite(address + i, data[i]);
    }
    this.cpu.c64_setRegX(end & 0xff);
    this.cpu.c64_setRegY((end >> 8) & 0xff);
    this.finish(0, mismatch ? 0x10 : 0);
    return { address, end, verified: !mismatch };
  }

  saveBytes() {
    if (this.pending?.kind !== "save") throw new Error("Kein SAVE aktiv.");
    const { start, end } = this.pending;
    if (end <= start) throw new Error("Ungültiger Speicherbereich für SAVE.");
    const bytes = new Uint8Array(end - start + 2);
    bytes[0] = start & 0xff;
    bytes[1] = start >> 8;
    for (let i = start; i < end; i++)
      bytes[i - start + 2] = this.machine.ramRead(i);
    return bytes;
  }

  finish(error = 0, status = 0) {
    if (!this.pending) return;
    const { pc } = this.pending;
    this.machine.ramWrite(0x90, status);
    this.cpu.c64_setRegA(error);
    this.cpu.c64_setFlagC(error ? 1 : 0);
    this.cpu.breakpoint_pcSetEnabled(pc, 0);
    // A loaded machine-code file may itself have overwritten our two-byte stub.
    const original = this.machine.ramRead(pc);
    this.machine.ramWrite(pc, 0x60);
    this.cpu.debugger_step();
    this.machine.ramWrite(pc, original);
    this.cpu.breakpoint_pcSetEnabled(pc, 1);
    this.pending = null;
    this.cpu.debugger_play();
  }

  cancel() {
    this.finish(4);
  }

  reset() {
    this.cpu.breakpoint_pcRemove(LOAD_TRAP);
    this.cpu.breakpoint_pcRemove(SAVE_TRAP);
    this.pending = null;
    this.installed = false;
  }
}
