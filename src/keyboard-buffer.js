export function toPetscii(text) {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .toUpperCase();
  return Array.from(normalized, (char) => {
    if (char === "\n") return 13;
    if (char === "£") return 92;
    const code = char.charCodeAt(0);
    if (code < 32 || code > 95)
      throw new Error(`Zeichen „${char}“ gehört nicht zum C64-Zeichensatz.`);
    return code;
  });
}

export class KeyboardBuffer {
  constructor(machine) {
    this.machine = machine;
    this.queue = [];
  }
  add(text) {
    const codes = toPetscii(text);
    if (this.queue.length + codes.length > 65536)
      throw new Error("Bitte höchstens 64 KB Text auf einmal einfügen.");
    this.queue.push(...codes);
  }
  clear() {
    this.queue = [];
    this.machine.ramWrite(0xc6, 0);
  }
  pump() {
    if (!this.queue.length || this.machine.ramRead(0xc6)) return;
    let count = 0;
    while (count < 6 && this.queue.length) {
      const code = this.queue.shift();
      this.machine.ramWrite(0x277 + count++, code);
      if (code === 13) break;
    }
    this.machine.ramWrite(0xc6, count);
  }
}
