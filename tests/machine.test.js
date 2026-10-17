import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { C64Emulator } from "c64-ready/emulator";
import {
  FileBridge,
  decodePrg,
  safeFilename,
  word,
} from "../src/file-bridge.js";
import { KeyboardBuffer, toPetscii } from "../src/keyboard-buffer.js";

async function computer() {
  const binary = await readFile(
    new URL("../node_modules/c64-ready/public/c64.wasm", import.meta.url),
  );
  const m = await C64Emulator.load(
    `data:application/wasm;base64,${binary.toString("base64")}`,
  );
  const bridge = new FileBridge(m, () => {});
  const keys = new KeyboardBuffer(m);
  m.start();
  const step = (count = 1) => {
    for (let i = 0; i < count; i++) {
      m.tick(20);
      bridge.poll();
      if (!bridge.pending) keys.pump();
    }
  };
  const until = (predicate, description) => {
    for (let i = 0; i < 1500; i++) {
      if (predicate()) return;
      step();
    }
    assert.fail(`Timeout: ${description}; PC=$${m.getPC().toString(16)}`);
  };
  until(() => bridge.installed && word(m, 0x2b) === 0x801, "BASIC boot");
  step(50);
  const command = (text) => {
    keys.add(`${text}\n`);
    step(100);
  };
  const screen = () =>
    Array.from({ length: 1000 }, (_, i) => {
      const c = m.ramRead(0x400 + i) & 0x7f;
      return String.fromCharCode(c < 32 ? c + 64 : c);
    }).join("");
  return { m, bridge, keys, step, until, command, screen };
}

test("PRG validation and PETSCII handle malformed files and unsupported characters", () => {
  assert.throws(() => decodePrg(new Uint8Array([1, 8])), /Ladeadresse/);
  assert.throws(
    () => decodePrg(new Uint8Array([255, 255, 1, 2])),
    /Adressraum/,
  );
  assert.equal(
    decodePrg(new Uint8Array([0, 192, 96]), 0, 0x801).address,
    0x801,
  );
  assert.deepEqual(
    toPetscii('print "hi"\r\n'),
    [80, 82, 73, 78, 84, 32, 34, 72, 73, 34, 13],
  );
  assert.throws(() => toPetscii("🙂"), /Zeichensatz/);
  assert.equal(safeFilename("../../demo"), "....demo.prg");
  assert.equal(safeFilename(""), "programm.prg");
});

test("real C64 boots, tokenizes BASIC, runs loops, DATA/READ, POKE, PEEK and SYS", async () => {
  const { m, command, screen } = await computer();
  assert.match(screen(), /COMMODORE 64 BASIC V2/);
  command("10 FOR I=1 TO 5:READ A:S=S+A:NEXT");
  command("20 DATA 2,4,6,8,10");
  command('30 POKE 49152,S:PRINT "RESULT";PEEK(49152)');
  command("RUN");
  assert.equal(m.ramRead(49152), 30);
  assert.match(screen(), /RESULT 30/);
  command('POKE 49153,96:SYS 49153:PRINT "SYS OK"');
  assert.match(screen(), /SYS OK/);
  command("POKE 53280,2:POKE 53281,0");
  assert.equal(m.cpuRead(53280) & 15, 2);
  assert.equal(m.cpuRead(53281) & 15, 0);
  command("POKE 54296,15:POKE 54272,97:POKE 54273,16");
  command("POKE 54277,9:POKE 54278,240:POKE 54276,17");
  assert.ok(
    m.getSidBuffer().some((sample) => Math.abs(sample) > 0.001),
    "SID produces audio samples",
  );
});

test("real KERNAL SAVE/LOAD round trip produces interoperable PRG and resumes BASIC", async () => {
  const { m, bridge, command, screen, step, until } = await computer();
  command('10 PRINT "ROUND TRIP":POKE 49152,42');
  command('SAVE "DEMO",8');
  assert.equal(bridge.pending?.kind, "save");
  assert.equal(bridge.pending.name, "DEMO");
  const bytes = bridge.saveBytes();
  assert.equal(bytes[0] | (bytes[1] << 8), 0x801);
  assert.ok(bytes.includes(0x99), "PRINT token is present");
  bridge.finish();
  step(100);
  assert.equal(bridge.pending, null);
  command("NEW");
  assert.equal(word(m, 0x2d), 0x803);
  command('LOAD "DEMO",8');
  assert.equal(bridge.pending?.kind, "load");
  bridge.load(bytes);
  step(100);
  command("RUN");
  assert.match(screen(), /ROUND TRIP/);
  assert.equal(m.ramRead(49152), 42);
  command("LIST");
  assert.match(screen(), /10 PRINT/);
  command('VERIFY "DEMO",8');
  assert.equal(bridge.pending?.verify, true);
  assert.equal(bridge.load(bytes).verified, true);
  step(100);
  assert.match(screen(), /OK/);
  m.ramWrite(0x806, m.ramRead(0x806) ^ 1);
  command('VERIFY "DEMO",8');
  assert.equal(bridge.load(bytes).verified, false);
  step(100);
  assert.match(screen(), /VERIFY\s+ERROR/);
  command("LOAD");
  assert.equal(bridge.pending?.kind, "load");
  bridge.cancel();
  step(100);
  assert.match(screen(), /FILE NOT FOUND/);
  // A cancelled dialog must leave BASIC usable.
  command("PRINT 6*7");
  assert.match(screen(), /42/);
  command('LOAD "MACHINE",8,1');
  bridge.load(new Uint8Array([0, 192, 0xa9, 77, 0x8d, 1, 192, 0x60]));
  step(100);
  command("SYS 49152");
  assert.equal(m.ramRead(49153), 77);
  bridge.reset();
  m.reset();
  m.start();
  until(() => bridge.installed, "reinstall browser drive after reset");
  step(100);
  command('PRINT "RESET OK"');
  assert.match(screen(), /RESET OK/);
});
