# ROOTPILOT PRESENTS

Ein eigenes kleines Demoszene-Intro für den PAL-C64, mit:

- einem wellenförmig bewegten ROOTPILOT-Logo aus acht echten Hardware-Sprites;
- 48 Sternen mit zwei Geschwindigkeiten;
- farbigen Rasterbalken;
- horizontaler Pixel-Laufschrift mittels VIC-II-Rastersplit;
- eigener Musik in drei SID-Stimmen: Pulswellen-Melodie, Dreieck-Bass und Sägezahn-Arpeggio.

## Starten

`rootpilot-intro.prg` herunterladen, im Emulator **LOAD** anklicken und die
Datei auswählen. **TON AN** aktivieren und `RUN` eingeben. Das Intro läuft in
einer Schleife. **RUN/STOP** bzw. Escape beendet es und stellt den BASIC-Bildschirm
wieder her. Ein weiteres `RUN` startet das Intro erneut.

Es ist ein C64-Programm mit einem kurzen BASIC-Startprogramm und 6502-Code
bei `$C000`. Sprites liegen ab `$3000`.
Die PRG ersetzt das aktuell geladene Programm. Vorher eigene Arbeit speichern.
Die Raster- und Musikzeiten sind für PAL (50 Hz) ausgelegt; auf NTSC läuft das
Intro schneller. Es benötigt den normalen C64-Speicheraufbau mit KERNAL-IRQ.

## Quelltext und Neubau

Code, Logo und Musik sind für dieses Projekt erstellt und stehen unter der
MIT-Lizenz des Repositories. `intro.asm` enthält den vollständigen generierten
6502-Quelltext; die Erzeugung und Sprite-Zeichnung stehen in
`scripts/build-intro.py`.

```sh
python3 -m venv /tmp/rootpilot-intro-build
/tmp/rootpilot-intro-build/bin/pip install py65==1.2.0
/tmp/rootpilot-intro-build/bin/python scripts/build-intro.py
node --test tests/intro.test.js
```

`metadata.json` hält Speicheradressen für die Emulator-Tests fest. Die Tests
prüfen Grafikänderungen, bewegte Sterne, Laufschrift, Rasterfarben, SID-Samples,
Abbruch, Register-Rücksetzung und erneutes Starten auf dem echten WASM-Core.
