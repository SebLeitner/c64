# Bach: Toccata und Fuge d-Moll, BWV 565

**Vollständiger zeitlicher Ablauf**, für drei SID-Stimmen bearbeitet, PAL 50 Hz.
Länge: **9:32 Minuten**, 143 Takte. Dies ist eine reduzierte Orgelbearbeitung,
keine vollständige Wiedergabe aller gleichzeitig klingenden Originalstimmen.

## Im Emulator abspielen

1. `bwv565.prg` herunterladen, im Emulator **LOAD** wählen und die Datei öffnen.
2. **TON AN** aktivieren und `RUN` eingeben.
3. Mit **RUN/STOP** bzw. Escape abbrechen. Am Ende kehrt das Programm zu BASIC
   zurück; ein weiteres `RUN` startet es erneut.

Die PRG lädt die Daten direkt und startet über BASIC einen kleinen 6502-Spieler.
Das ist nötig, um schnelle Stellen unabhängig von der BASIC-Geschwindigkeit
abzuspielen. Die Noten liegen im RAM unter dem BASIC-ROM und oberhalb davon;
der Spieler blendet das BASIC-ROM während der Wiedergabe aus und danach wieder
ein. Die Datei benötigt einen unveränderten C64-Speicheraufbau und überschreibt
das aktuelle BASIC-Programm. `bwv565.bas` ist die vollständige BASIC-DATA-Fassung
mit demselben Maschinencode und denselben Noten; ihre READ-/POKE-Ladephase dauert
im getesteten Emulator ungefähr zwei Minuten. Sie wird über das BASIC-Eingabefeld eingefügt,
nicht über den binären PRG-Dateidialog.

## Quelle und Bearbeitung

Vollständige gemeinfreie Partitur des **Mutopia Project**, Referenz
**Mutopia-2011/09/11-1780**. Vorlage: **Bach-Gesellschaft Ausgabe, 1867**.
Die Notensatzdatei bezeichnet ihre Lizenz ausdrücklich als **Public Domain**.

- [Quellpartitur im Mutopia-Repository](https://github.com/MutopiaProject/MutopiaProject/blob/2144afd6f52d56c5b6995b8b589ef1268b3139f0/ftp/BachJS/BWV565/ToccataFugue/ToccataFugue.ly)
- Lokale Originalquelle: `ToccataFugue.ly` (unverändert).
- `bwv565.midi`: mit LilyPond 2.24.4 erzeugte MIDI-Datei der gesamten Partitur.

Die drei SID-Stimmen übernehmen jeweils den höchsten Ton der rechten Hand,
den höchsten Ton der linken Hand und den tiefsten Pedalton. Zusätzliche
Akkordtöne entfallen. Eng aufeinanderfolgende gleiche Tonhöhen können legato
zusammenfallen. Die MIDI-Ausgabe verwendet 60 Viertelnoten pro Minute;
die textlichen Tempoangaben, Fermaten und Verzierungen der Druckpartitur
werden nicht als freie musikalische Interpretation ergänzt. Auflösung: 20 ms.
Der Klang ist ein einfacher Dreieckwellen-Orgelklang ohne Dynamikbearbeitung.

## Reproduzieren

Die eigenen Konverter- und Spielerdateien stehen unter der MIT-Lizenz des
Repositories. Python-Abhängigkeiten werden nur für die Neuerzeugung gebraucht:

```sh
python3 -m venv /tmp/bwv565-build
/tmp/bwv565-build/bin/pip install mido==1.3.3 py65==1.2.0
/tmp/bwv565-build/bin/python scripts/build-bwv565.py
```

Um die mitgelieferte MIDI aus der Quelle neu zu erzeugen, mit LilyPond 2.24.4:

```sh
convert-ly public/examples/bwv565/ToccataFugue.ly > /tmp/bwv565-modern.ly
lilypond -dno-print-pages -dbackend=null -o /tmp/bwv565 /tmp/bwv565-modern.ly
```

LilyPond meldet bei der grafischen Auswertung dieser alten Vorlage Warnungen
zu zyklischen Layout-Abhängigkeiten, erzeugt aber erfolgreich die vollständige
MIDI. Es werden keine modernen Verlagsbearbeitungen oder Tonaufnahmen verwendet.
`metadata.json` hält Dauer, Speicheradressen und Prüfsummen fest.
