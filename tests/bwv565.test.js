import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { C64Emulator } from "c64-ready/emulator";
import { FileBridge } from "../src/file-bridge.js";
import { KeyboardBuffer } from "../src/keyboard-buffer.js";

test("full BWV 565 PRG loads, sounds, finishes and restores BASIC; RUN/STOP also works", async () => {
  const base = new URL("../public/examples/bwv565/", import.meta.url);
  const metadata = JSON.parse(
    await readFile(new URL("metadata.json", base), "utf8"),
  );
  const score = await readFile(new URL("score.bin", base));
  assert.equal((score.length - 1) % 4, 0);
  let frames = 0;
  for (let i = 0; i < score.length - 1; i += 4) {
    assert.ok(score[i] > 0);
    for (const note of score.subarray(i + 1, i + 4))
      assert.ok(note === 0 || (note >= 36 && note <= 84));
    frames += score[i];
  }
  assert.equal(frames, metadata.pal_frames);
  assert.equal(frames, 28600);
  const wasm = await readFile(
    new URL("../node_modules/c64-ready/public/c64.wasm", import.meta.url),
  );
  const machine = await C64Emulator.load(
    `data:application/wasm;base64,${wasm.toString("base64")}`,
  );
  const bridge = new FileBridge(machine, () => {});
  const keyboard = new KeyboardBuffer(machine);
  machine.start();
  function step(count = 1) {
    for (let i = 0; i < count; i++) {
      machine.tick(20);
      bridge.poll();
      if (!bridge.pending) keyboard.pump();
    }
  }
  step(150);
  keyboard.add("LOAD\n");
  step(100);
  assert.equal(bridge.pending?.kind, "load");
  bridge.load(new Uint8Array(await readFile(new URL("bwv565.prg", base))));
  step(100);
  keyboard.add("RUN\n");
  let heard = false;
  for (let i = 0; i < 100; i++) {
    step();
    heard ||= machine.getSidBuffer().some((sample) => Math.abs(sample) > 0.001);
  }
  assert.equal(machine.cpuRead(1) & 7, 6);
  assert.ok(
    heard,
    "opening notes must produce SID audio, including between rests",
  );
  let elapsed = 0;
  while ((machine.cpuRead(1) & 7) === 6 && elapsed < 31000) {
    step();
    elapsed++;
  }
  assert.ok(
    elapsed > 27000,
    "the complete score must play, not just an excerpt",
  );
  assert.ok(elapsed < 31000, "player must return at the end");
  assert.equal(machine.cpuRead(1) & 7, 7);
  step(100);
  assert.ok(machine.getSidBuffer().every((sample) => Math.abs(sample) < 0.001));
  keyboard.add("RUN\n");
  step(100);
  assert.equal(machine.cpuRead(1) & 7, 6);
  machine.keyDown(30);
  step(15);
  machine.keyUp(30);
  step(100);
  assert.equal(machine.cpuRead(1) & 7, 7);
  keyboard.add("PRINT 6*7\n");
  step(100);
  const screen = Array.from({ length: 1000 }, (_, i) => {
    const c = machine.ramRead(0x400 + i) & 127;
    return String.fromCharCode(c < 32 ? c + 64 : c);
  }).join("");
  assert.match(screen, /42/);
});
