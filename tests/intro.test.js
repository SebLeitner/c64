import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { C64Emulator } from "c64-ready/emulator";
import { FileBridge } from "../src/file-bridge.js";
import { KeyboardBuffer } from "../src/keyboard-buffer.js";

test("ROOTPILOT intro animates actual VIC-II graphics, scrolls, plays SID and exits cleanly", async () => {
  const base = new URL("../public/examples/rootpilot-intro/", import.meta.url);
  const metadata = JSON.parse(
    await readFile(new URL("metadata.json", base), "utf8"),
  );
  const wasm = await readFile(
    new URL("../node_modules/c64-ready/public/c64.wasm", import.meta.url),
  );
  const machine = await C64Emulator.load(
    `data:application/wasm;base64,${wasm.toString("base64")}`,
  );
  const bridge = new FileBridge(machine, () => {});
  const keyboard = new KeyboardBuffer(machine);
  machine.start();
  function step(n = 1) {
    for (let i = 0; i < n; i++) {
      machine.tick(20);
      bridge.poll();
      if (!bridge.pending) keyboard.pump();
    }
  }
  const read = (address, n) =>
    Array.from({ length: n }, (_, i) => machine.ramRead(address + i));
  step(150);
  const oldBank = machine.cpuRead(0xdd00);
  const oldMode = machine.cpuRead(0xd018);
  keyboard.add("LOAD\n");
  step(100);
  assert.equal(bridge.pending?.kind, "load");
  bridge.load(
    new Uint8Array(await readFile(new URL("rootpilot-intro.prg", base))),
  );
  step(100);
  keyboard.add("RUN\n");
  step(100);
  assert.equal(
    machine.cpuRead(0xd015),
    255,
    "all eight logo sprites are enabled",
  );
  assert.deepEqual(
    read(0x45b, 18),
    Array.from("ROOTPILOT PRESENTS", (c) =>
      c >= "A" && c <= "Z" ? c.charCodeAt(0) - 64 : c.charCodeAt(0),
    ),
  );
  const before = read(metadata.labels.positions, 48);
  const oldPhase = machine.ramRead(metadata.labels.phase);
  const image = machine.getFrameBuffer().data.slice();
  const lowerBorder = (250 * 384 + 10) * 4;
  assert.deepEqual(
    Array.from(image.subarray(lowerBorder, lowerBorder + 3)),
    [0, 0, 0],
    "raster colors must return to black below the effects",
  );
  let heard = false;
  const borderColors = new Set();
  for (let i = 0; i < 180; i++) {
    // Different tick durations sample inside the frame, including raster bars.
    machine.tick(3);
    bridge.poll();
    heard ||= machine.getSidBuffer().some((sample) => Math.abs(sample) > 0.001);
    borderColors.add(machine.cpuRead(0xd020) & 15);
  }
  assert.notEqual(machine.ramRead(metadata.labels.phase), oldPhase);
  assert.notDeepEqual(
    read(metadata.labels.positions, 48),
    before,
    "stars move",
  );
  assert.notDeepEqual(
    machine.getFrameBuffer().data,
    image,
    "visible VIC-II frame changes",
  );
  assert.ok(heard, "original SID loop produces samples");
  assert.ok(
    borderColors.size >= 3,
    "raster program changes colors within frames",
  );
  step(500);
  assert.ok(
    read(0x770, 40).some((c) => c !== 32),
    "scrolling message enters the screen",
  );
  machine.keyDown(30);
  step(15);
  machine.keyUp(30);
  step(100);
  assert.equal(
    machine.cpuRead(0xd015),
    0,
    "sprites are disabled after RUN/STOP",
  );
  assert.equal(machine.cpuRead(0xd018), oldMode);
  assert.equal(machine.cpuRead(0xdd00), oldBank);
  assert.ok(machine.getSidBuffer().every((sample) => Math.abs(sample) < 0.001));
  keyboard.add("PRINT 6*7\n");
  step(100);
  const screen = read(0x400, 1000)
    .map((c) => String.fromCharCode((c & 127) < 32 ? (c & 127) + 64 : c & 127))
    .join("");
  assert.match(screen, /42/);
  keyboard.add("RUN\n");
  step(100);
  assert.equal(machine.cpuRead(0xd015), 255, "RUN restarts the intro");
  machine.keyDown(30);
  step(15);
  machine.keyUp(30);
  step(100);
  assert.equal(machine.cpuRead(0xd015), 0);
});
