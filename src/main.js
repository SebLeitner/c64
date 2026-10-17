import { C64Emulator } from "c64-ready/emulator";
import InputHandler from "c64-ready/player/input-handler";
import { SidAudio } from "./sid-audio.js";
import wasmUrl from "c64-ready/wasm?url";
import workletUrl from "../node_modules/c64-ready/public/audio-worklet-processor.js?url";
import { FileBridge, safeFilename } from "./file-bridge.js";
import { KeyboardBuffer } from "./keyboard-buffer.js";
import { KeyLatch } from "./key-latch.js";
import "./style.css";

const $ = (id) => document.getElementById(id);
const canvas = $("screen");
const context = canvas.getContext("2d", { alpha: false });
const dialog = $("file-dialog");
const help = $("help-dialog");
const setStatus = (text) => {
  $("status").textContent = text;
};
let machine, bridge, keyboard, input, audio, keyLatch;
let busy = false;
let ready = false;

function releaseKeys() {
  keyLatch?.clear();
}

function showFile(request) {
  releaseKeys();
  const save = request.kind === "save";
  $("file-title").textContent =
    request.verify && !save
      ? "Programm vergleichen"
      : save
        ? "Programm speichern"
        : "Programm laden";
  $("file-description").textContent = save
    ? "Speichere das Programm als C64-PRG-Datei auf deinem Gerät."
    : "Wähle eine lokale PRG-Datei. Danach kannst du das BASIC-Programm mit RUN starten oder mit LIST ansehen.";
  $("open-label").hidden = save;
  $("name-label").hidden = !save;
  $("save-name").value = safeFilename(request.name);
  $("open-file").value = "";
  $("file-error").textContent = "";
  $("file-confirm").textContent = save ? "SPEICHERN" : "LADEN";
  dialog.showModal();
  setStatus(
    save ? "SAVE wartet auf Dateiziel" : "LOAD wartet auf lokale Datei",
  );
}

function command(text) {
  if (!ready || bridge.pending || keyboard.queue.length) return;
  keyboard.add(`${text}\n`);
  canvas.focus();
}

async function writeFile(bytes, name) {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [
        {
          description: "Commodore 64 Programm",
          accept: { "application/octet-stream": [".prg"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
  } else {
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/octet-stream" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

$("file-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !bridge.pending) return;
  busy = true;
  $("file-confirm").disabled = true;
  $("file-cancel").disabled = true;
  try {
    if (bridge.pending.kind === "save") {
      const bytes = bridge.saveBytes();
      const name = safeFilename($("save-name").value);
      await writeFile(bytes, name);
      bridge.finish();
      setStatus(`${name} · ${bytes.length} Bytes gespeichert`);
    } else {
      const file = $("open-file").files[0];
      if (!file) throw new Error("Bitte wähle eine PRG-Datei aus.");
      if (file.size > 65538)
        throw new Error("Die Datei ist größer als der C64-Adressraum.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const verify = bridge.pending.verify;
      const result = bridge.load(bytes);
      setStatus(
        verify
          ? result.verified
            ? "VERIFY erfolgreich"
            : "VERIFY: Datei und Speicher unterscheiden sich"
          : `${file.name} · ${bytes.length - 2} Bytes geladen`,
      );
    }
    dialog.close();
    canvas.focus();
  } catch (error) {
    $("file-error").textContent =
      error.name === "AbortError"
        ? "Speichern abgebrochen. Wähle ein Ziel oder brich SAVE ab."
        : error.message;
  } finally {
    busy = false;
    $("file-confirm").disabled = false;
    $("file-cancel").disabled = false;
  }
});

function cancelFile() {
  if (busy) return;
  bridge.cancel();
  dialog.close();
  setStatus("Dateivorgang abgebrochen");
  canvas.focus();
}
$("file-cancel").addEventListener("click", cancelFile);
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  cancelFile();
});
$("load").addEventListener("click", () => command("LOAD"));
$("save").addEventListener("click", () => command("SAVE"));
$("stop").addEventListener("click", () => {
  keyboard.clear();
  machine.keyDown(30);
  setTimeout(() => machine.keyUp(30), 150);
  canvas.focus();
});
$("reset").addEventListener("click", () => {
  if (!confirm("C64 neu starten? Nicht gespeicherte Programme gehen verloren."))
    return;
  releaseKeys();
  keyboard.clear();
  bridge.reset();
  machine.reset();
  machine.start();
  ready = false;
  $("boot").hidden = false;
  setStatus("C64 startet neu");
});
function updateAudio(state) {
  const label = !state.running
    ? "TON FORTSETZEN"
    : state.muted
      ? "TON AUS"
      : "TON AN";
  if ($("sound").textContent !== label) $("sound").textContent = label;
  $("sound").setAttribute(
    "aria-pressed",
    String(state.running && !state.muted),
  );
  const status = !state.running
    ? "Audio: Browser pausiert"
    : state.muted
      ? "Audio: stummgeschaltet"
      : state.peak > 0.001
        ? "Audio: C64-Signal vorhanden"
        : "Audio: C64 erzeugt gerade keinen Ton";
  if ($("audio-status").textContent !== status) $("audio-status").textContent = status;
}

function ensureAudio() {
  if (!audio) {
    audio = new SidAudio(
      workletUrl,
      () => (bridge.pending ? new Float32Array(4096) : machine.getSidBuffer()),
      updateAudio,
    );
    machine.setSampleRate(audio.sampleRate);
  }
  return audio;
}

async function audioError(error) {
  setStatus(error.message);
  if (audio) await audio.destroy();
  audio = null;
  $("sound").textContent = "TON AUS";
  $("sound").setAttribute("aria-pressed", "false");
  $("audio-status").textContent = `Audiofehler: ${error.message}`;
}

$("sound").addEventListener("click", async () => {
  try {
    const existing = audio;
    const state = ensureAudio();
    if (existing && state.running) state.setMuted(!state.muted);
    else state.setMuted(false);
    await state.resume();
  } catch (error) {
    await audioError(error);
  }
  canvas.focus();
});
$("audio-test").addEventListener("click", async () => {
  try {
    await ensureAudio().testTone();
    setStatus(
      "440-Hz-Testton gestartet. Falls stumm: Tab-Lautstärke, Systemlautstärke und Ausgabegerät prüfen.",
    );
  } catch (error) {
    await audioError(error);
  }
});
$("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await canvas.requestFullscreen();
  } catch {
    setStatus("Vollbild ist in diesem Browser nicht verfügbar.");
  }
  canvas.focus();
});
$("help").addEventListener("click", () => {
  releaseKeys();
  help.showModal();
});
$("help-close").addEventListener("click", () => {
  help.close();
  canvas.focus();
});
$("type").addEventListener("click", () => {
  try {
    keyboard.add($("paste").value.replace(/\n?$/, "\n"));
    canvas.focus();
  } catch (error) {
    setStatus(error.message);
  }
});
canvas.addEventListener("paste", (event) => {
  event.preventDefault();
  try {
    keyboard.add(event.clipboardData.getData("text/plain"));
  } catch (error) {
    setStatus(error.message);
  }
});
canvas.addEventListener("keydown", (event) => {
  // Let the browser generate the paste event and retain ordinary browser shortcuts.
  if (
    event.metaKey ||
    (event.ctrlKey &&
      ["v", "c", "x", "r", "l", "t", "w"].includes(event.key.toLowerCase()))
  )
    event.stopImmediatePropagation();
});
canvas.addEventListener("blur", releaseKeys);
window.addEventListener("blur", releaseKeys);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseKeys();
});

async function boot() {
  machine = await C64Emulator.load(wasmUrl);
  bridge = new FileBridge(machine, showFile);
  keyboard = new KeyboardBuffer(machine);
  keyLatch = new KeyLatch(machine);
  input = new InputHandler(keyLatch.adapter, canvas);
  input.setInputMode("keyboard");
  input.attach();
  machine.onFrame = ({ data, width, height }) =>
    context.putImageData(
      new ImageData(new Uint8ClampedArray(data), width, height),
      0,
      0,
    );
  machine.start();
  let previous = performance.now();
  let elapsed = 0;
  function frame(now) {
    const delta = Math.min(now - previous, 40);
    previous = now;
    elapsed += delta;
    // Emulate PAL time, without speeding the machine up on 120/144-Hz displays.
    if (!document.hidden && elapsed >= 20) {
      machine.tick(elapsed);
      elapsed = 0;
      bridge.poll();
      if (
        !ready &&
        bridge.installed &&
        machine.ramRead(0x2b) === 1 &&
        machine.ramRead(0x2c) === 8
      ) {
        ready = true;
        $("boot").hidden = true;
        setStatus("Bereit. Klicke auf den Bildschirm und tippe los.");
        for (const id of [
          "load",
          "save",
          "stop",
          "sound",
          "audio-test",
          "reset",
          "type",
        ])
          $(id).disabled = false;
      }
      if (ready && !bridge.pending) keyboard.pump();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
boot().catch((error) => {
  $("boot").textContent = "START FEHLGESCHLAGEN";
  setStatus(
    `Emulator konnte nicht starten: ${error.message}. Bitte neu laden.`,
  );
  console.error(error);
});
