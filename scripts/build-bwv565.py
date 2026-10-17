#!/usr/bin/env python3
"""Build a three-voice PAL SID arrangement of the full Mutopia BWV 565 MIDI.

Optional build dependencies: mido==1.3.3 py65==1.2.0.
The checked-in MIDI was generated from the public-domain LilyPond score with
LilyPond 2.24.4 after convert-ly. No proprietary recording or arrangement is used.
"""
from pathlib import Path
from collections import Counter, defaultdict
import hashlib
import json
import re
import mido
from py65.assembler import Assembler
from py65.devices.mpu6502 import MPU

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/examples/bwv565'
START = 0xC800
SCORE = 0xA000
FPS = 50


def arrange():
    midi = mido.MidiFile(OUT / 'bwv565.midi')
    merged = mido.merge_tracks(midi.tracks)
    tempo = 500000
    seconds = 0
    events = defaultdict(list)
    # LilyPond channels 0/1 are the manuals, channel 2 is the pedal.
    # Preserve the highest sounding pitch in each manual and the lowest pedal.
    tracks = midi.tracks[1:]
    for voice, track in enumerate(tracks):
        tempo = 500000
        seconds = 0
        # Tempo is stored in the conductor, so use the complete merged timeline.
        # Match by track identity through absolute ticks rather than MIDI channel.
        tick = 0
        own = defaultdict(list)
        for msg in track:
            tick += msg.time
            if msg.type in ('note_on', 'note_off'):
                own[tick].append(msg)
        tick = 0
        for msg in merged:
            seconds += mido.tick2second(msg.time, midi.ticks_per_beat, tempo)
            tick += msg.time
            if tick in own:
                for note in own.pop(tick):
                    events[round(seconds * FPS)].append((voice, note.note, note.type == 'note_on' and note.velocity > 0))
            if msg.type == 'set_tempo':
                tempo = msg.tempo
        assert not own
    active = [Counter() for _ in tracks]
    state = (0, 0, 0)
    previous = 0
    segments = []
    for frame, changes in sorted(events.items()):
        for voice, note, pressed in changes:
            active[voice][note] += 1 if pressed else -1
            if active[voice][note] <= 0:
                del active[voice][note]
        new = tuple((max(notes) if voice < 2 else min(notes)) if notes else 0 for voice, notes in enumerate(active))
        if new != state:
            if frame > previous:
                segments.append((frame - previous, state))
            previous, state = frame, new
    end = round(midi.length * FPS)
    if previous < end:
        segments.append((end - previous, state))
    data = bytearray()
    for duration, notes in segments:
        while duration > 255:
            data.extend((255, *notes))
            duration -= 255
        if duration:
            data.extend((duration, *notes))
    data.append(0)
    assert SCORE + len(data) < START, 'SID data overlaps player'
    return bytes(data), len(segments), midi.length


def player():
    asm = '''
        PHP
        CLD
        LDA $FB
        PHA
        LDA $FC
        PHA
        LDA $01
        STA bank
        AND #$FE
        STA $01
        LDA #$00
        LDX #$18
clear:  STA $D400,X
        DEX
        BPL clear
        LDA #$0C
        STA $D418
        LDA #$F4
        STA $D406
        STA $D40D
        STA $D414
        LDA #$00
        STA old0
        STA old1
        STA old2
        STA $FB
        LDA #$A0
        STA $FC
next:   LDY #$00
        LDA ($FB),Y
        BNE play
        JMP finish
play:   STA delay
'''
    for voice in range(3):
        reg = 0xD400 + voice * 7
        asm += f'''
        LDY #${voice + 1:02X}
        LDA ($FB),Y
        CMP old{voice}
        BEQ skip{voice}
        STA old{voice}
        LDX #$10
        STX ${reg + 4:04X}
        CMP #$00
        BEQ skip{voice}
        TAX
        LDA low,X
        STA ${reg:04X}
        LDA high,X
        STA ${reg + 1:04X}
        LDA #$11
        STA ${reg + 4:04X}
skip{voice}:
'''
    asm += '''
leave:  LDA $D012
        CMP #$FA
        BEQ leave
wait:   JSR $FFE1
        BNE check
        JMP finish
check:  LDA $D012
        CMP #$FA
        BNE wait
        DEC delay
        BNE leave
        CLC
        LDA $FB
        ADC #$04
        STA $FB
        BCC advance
        INC $FC
advance: JMP next
finish: LDA #$00
        STA $D404
        STA $D40B
        STA $D412
        STA $D418
        LDA bank
        STA $01
        PLA
        STA $FC
        PLA
        STA $FB
        PLP
        RTS
bank:   .byte 0
delay:  .byte 0
old0:   .byte 0
old1:   .byte 0
old2:   .byte 0
'''
    frequency = [0] + [min(65535, round(440 * 2 ** ((note - 69) / 12) * 16777216 / 985248)) for note in range(1, 128)]
    asm += 'low: .byte ' + ','.join(str(value & 255) for value in frequency) + '\n'
    asm += 'high: .byte ' + ','.join(str(value >> 8) for value in frequency) + '\n'
    lines = []
    labels = {}
    address = START
    assembler = Assembler(MPU())
    for source in asm.splitlines():
        source = source.strip()
        if not source:
            continue
        if ':' in source:
            label, source = source.split(':', 1)
            labels[label] = address
            source = source.strip()
        if not source:
            continue
        if source.startswith('.byte'):
            size = len(source[5:].split(','))
        else:
            dummy = re.sub(r'\b(?:bank|delay|old[0-2]|low|high|next|play|skip[0-2]|leave|wait|check|advance|finish|clear)\b', f'${address:04X}', source)
            size = len(assembler.assemble(dummy, address))
        lines.append((address, source))
        address += size
    output = bytearray()
    for address, source in lines:
        if source.startswith('.byte'):
            output.extend(map(int, source[5:].split(',')))
        else:
            for label, value in labels.items():
                source = re.sub(r'\b' + label + r'\b', f'${value:04X}', source)
            if source.split()[0] in ('BEQ', 'BNE', 'BPL', 'BCC'):
                target = int(source.split()[-1][1:], 16)
                assert -128 <= target - address - 2 < 128, source
            output.extend(assembler.assemble(source, address))
    assert START + len(output) < 0xD000
    return bytes(output), asm, labels


TOKENS = {'END': 0x80, 'FOR': 0x81, 'NEXT': 0x82, 'DATA': 0x83,
          'READ': 0x87, 'REM': 0x8F, 'POKE': 0x97, 'PRINT': 0x99,
          'SYS': 0x9E, 'CLR': 0x9C, 'TO': 0xA4, '+': 0xAA, '=': 0xB2}


def tokenize(lines):
    program = bytearray((1, 8))
    address = 0x801
    for number, source in lines:
        body = bytearray()
        quoted = False
        while source:
            if not quoted:
                token = next((key for key in TOKENS if source.startswith(key)), None)
                if token:
                    body.append(TOKENS[token])
                    source = source[len(token):]
                    if token in ('DATA', 'REM'):
                        body.extend(source.encode('ascii'))
                        break
                    continue
            char, source = source[0], source[1:]
            if char == '"':
                quoted = not quoted
            body.append(ord(char))
        address += len(body) + 5
        program.extend((address & 255, address >> 8, number & 255, number >> 8))
        program.extend(body)
        program.append(0)
    program.extend((0, 0))
    assert address + 2 < 0x9E00, 'BASIC program needs room for variables'
    return bytes(program)


def main():
    data, segments, seconds = arrange()
    code, assembly, labels = player()
    lines = [(10, 'REM BACH BWV565 - MUTOPIA PUBLIC DOMAIN'),
             (20, 'PRINT "SID-SPIELER WIRD GELADEN"'),
             (30, f'FOR I=0 TO {len(code)-1}:READ X:POKE {START}+I,X:NEXT I'),
             (40, 'PRINT "NOTEN WERDEN GELADEN - BITTE WARTEN"'),
             (50, f'FOR I=0 TO {len(data)-1}:READ X:POKE {SCORE}+I,X:NEXT I'),
             (60, 'PRINT "BACH BWV565 - RUN/STOP BEENDET"'),
             (70, f'SYS {START}'), (80, 'END')]
    for first_line, values in ((100, code), (1000, data)):
        line = first_line
        chunk = []
        for value in values:
            if len('DATA ' + ','.join(map(str, chunk + [value]))) > 65:
                lines.append((line, 'DATA ' + ','.join(map(str, chunk))))
                line += 10
                chunk = []
            chunk.append(value)
        if chunk:
            lines.append((line, 'DATA ' + ','.join(map(str, chunk))))
    assert len({number for number, _ in lines}) == len(lines)
    (OUT / 'bwv565.bas').write_text('\n'.join(f'{number} {text}' for number, text in lines) + '\n', encoding='ascii')
    # Preload the same data in the PRG to avoid thousands of slow READ/POKEs.
    # LOAD extends VARTAB past $A000, so the first executable line restores it
    # before any BASIC variables or strings are allocated. Program ends < $0900.
    wrapper = [(10, 'REM BACH BWV565 - MUTOPIA PUBLIC DOMAIN'),
               (20, 'POKE 45,0:POKE 46,9:CLR'),
               (30, 'PRINT "BACH BWV565 - RUN/STOP BEENDET"'),
               (40, f'SYS {START}'), (50, 'END')]
    prg = bytearray(START + len(code) - 0x801 + 2)
    header = tokenize(wrapper)
    prg[:len(header)] = header
    prg[2 + SCORE - 0x801:2 + SCORE - 0x801 + len(data)] = data
    prg[2 + START - 0x801:] = code
    (OUT / 'bwv565.prg').write_bytes(prg)
    (OUT / 'player.asm').write_text('; Origin $C800; assembled by scripts/build-bwv565.py\n' + assembly)
    (OUT / 'score.bin').write_bytes(data)
    (OUT / 'player.bin').write_bytes(code)
    metadata = dict(duration_seconds=seconds, pal_frames=round(seconds*FPS), segments=segments,
                    player_address=START, score_address=SCORE, labels=labels,
                    midi_sha256=hashlib.sha256((OUT / 'bwv565.midi').read_bytes()).hexdigest(),
                    score_sha256=hashlib.sha256(data).hexdigest())
    (OUT / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'BWV 565: {seconds:.1f}s, {segments} segments, {len(data)} score bytes, {len(code)} player bytes, {len(prg)} PRG bytes')


if __name__ == '__main__':
    main()
