#!/usr/bin/env python3
"""Build the original ROOTPILOT PAL C64 intro. Requires py65==1.2.0."""
from pathlib import Path
import json
import math
import re
from py65.assembler import Assembler
from py65.devices.mpu6502 import MPU

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/examples/rootpilot-intro'
ORIGIN = 0xC000


def screen(text):
    return [ord(c) - 64 if 'A' <= c <= 'Z' else ord(c) for c in text]


def table(name, values):
    return name + ':\n' + '\n'.join(' .byte ' + ','.join(map(str, values[i:i+16]))
                                    for i in range(0, len(values), 16)) + '\n'


def assemble(source):
    names = re.findall(r'^([a-z][a-z0-9_]*):', source, re.M)
    pattern = r'\b(' + '|'.join(sorted(names, key=len, reverse=True)) + r')\b'
    labels, instructions = {}, []
    assembler = Assembler(MPU())
    address = ORIGIN

    def resolve(line, known):
        line = re.sub(r'([<>])([a-z][a-z0-9_]*)', lambda m: f'${((known.get(m[2], ORIGIN) & 255) if m[1] == "<" else (known.get(m[2], ORIGIN) >> 8)):02X}', line)
        line = re.sub(pattern, lambda m: f'${known.get(m[1], address):04X}', line)
        return re.sub(r'\$([0-9A-F]+)\+(\d+)', lambda m: f'${int(m[1], 16)+int(m[2]):04X}', line)

    for line in source.splitlines():
        line = line.strip()
        if not line:
            continue
        if ':' in line:
            label, line = line.split(':', 1)
            labels[label] = address
            line = line.strip()
        if not line:
            continue
        size = len(line[5:].split(',')) if line.startswith('.byte') else len(assembler.assemble(resolve(line, {}), address))
        instructions.append((address, line))
        address += size
    binary = bytearray()
    for address, line in instructions:
        if line.startswith('.byte'):
            binary.extend(map(int, line[5:].split(',')))
            continue
        resolved = resolve(line, labels)
        if resolved.split()[0] in ('BEQ', 'BNE', 'BPL', 'BMI', 'BCC', 'BCS'):
            target = int(resolved.split()[-1][1:], 16)
            assert -128 <= target-address-2 < 128, (line, target-address-2)
        binary.extend(assembler.assemble(resolved, address))
    assert ORIGIN + len(binary) < 0xD000
    return bytes(binary), labels


def sprites():
    font = {
        'R': ['11110','10001','10001','11110','10100','10010','10001'],
        'O': ['01110','10001','10001','10001','10001','10001','01110'],
        'T': ['11111','00100','00100','00100','00100','00100','00100'],
        'P': ['11110','10001','10001','11110','10000','10000','10000'],
        'I': ['11111','00100','00100','00100','00100','00100','11111'],
        'L': ['10000','10000','10000','10000','10000','10000','11111'],
    }
    pixels = [[0]*192 for _ in range(21)]
    for n, char in enumerate('ROOTPILOT'):
        for y, row in enumerate(font[char]):
            for x, bit in enumerate(row):
                if bit == '1':
                    for dy in range(3):
                        for dx in range(3):
                            pixels[y*3+dy][16+n*18+x*3+dx] = 1
    data = bytearray()
    for sprite in range(8):
        for row in pixels:
            for byte in range(3):
                value = 0
                for bit in row[sprite*24+byte*8:sprite*24+byte*8+8]:
                    value = (value << 1) | bit
                data.append(value)
        data.append(0)
    return bytes(data)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = '''
start: PHP
 CLD
 LDA $FB
 PHA
 LDA $FC
 PHA
 LDA $D011
 STA saved_vertical
 LDA $D016
 STA saved_horizontal
 LDA $D018
 STA saved_charset
 LDA $DD00
 STA saved_bank
 ORA #$03
 STA $DD00
 LDA $D020
 STA saved_border
 LDA $D021
 STA saved_background
 LDA $0286
 STA saved_text
 LDA #$00
 STA $D020
 STA $D021
 STA $D015
 STA phase
 STA music_step
 STA scroll_phase
 LDA #$01
 STA music_ticks
 STA star_ticks
 LDA #$1B
 STA $D011
 LDA #$08
 STA $D016
 LDA #$14
 STA $D018
 LDX #$00
 LDA #$20
clear_screen: STA $0400,X
 STA $0500,X
 STA $0600,X
 STA $0700,X
 INX
 BNE clear_screen
 LDX #$00
 LDA #$0F
clear_colors: STA $D800,X
 STA $D900,X
 STA $DA00,X
 STA $DB00,X
 INX
 BNE clear_colors
 LDX #$11
title_loop: LDA title,X
 STA $045B,X
 DEX
 BPL title_loop
 LDX #$1E
caption_loop: LDA caption,X
 STA $074C,X
 DEX
 BPL caption_loop
 LDX #$26
footer_loop: LDA footer,X
 STA $07C0,X
 DEX
 BPL footer_loop
 LDX #$2F
reset_stars: LDA initial_positions,X
 STA positions,X
 DEX
 BPL reset_stars
 LDA #<message
 STA scroll_read+1
 LDA #>message
 STA scroll_read+2
 LDX #$18
 LDA #$00
clear_sid: STA $D400,X
 DEX
 BPL clear_sid
 LDA #$0C
 STA $D418
 LDA #$08
 STA $D403
 STA $D405
 LDA #$A4
 STA $D406
 LDA #$09
 STA $D40C
 LDA #$C4
 STA $D40D
 LDA #$02
 STA $D413
 LDA #$64
 STA $D414
 LDA #$00
 STA $D017
 STA $D01D
 STA $D01C
 STA $D01B
 LDA #$80
 STA $D010
'''
    for i in range(8):
        source += f' LDA #${(88+24*i)&255:02X}\n STA ${0xD000+2*i:04X}\n LDA #${192+i:02X}\n STA ${0x07F8+i:04X}\n'
    source += '''
 LDA #$FF
 STA $D015
frame_leave: LDA $D012
 BNE frame_wait
 LDA $D011
 BPL frame_leave
frame_wait: LDA $D011
 BMI frame_wait
 LDA $D012
 BNE frame_wait
 INC phase
 JSR music
 DEC star_ticks
 BNE animate_logo
 LDA #$03
 STA star_ticks
 JSR stars
animate_logo:
'''
    for i in range(8):
        source += f''' LDA phase
 CLC
 ADC #${i*3:02X}
 AND #$3F
 TAY
 LDA wave,Y
 STA ${0xD001+i*2:04X}
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #${i:02X}
 AND #$0F
 TAY
 LDA rainbow,Y
 STA ${0xD027+i:04X}
'''
    source += '''
 DEC scroll_phase
 BPL scroll_ready
 LDA #$07
 STA scroll_phase
 JSR shift_scroll
scroll_ready: SEI
'''
    for i, color in enumerate([6, 14, 3, 13, 1, 7, 10, 8, 2, 8, 10, 7, 1, 13, 3, 14]):
        source += f'bar_{i}: LDA $D012\n CMP #${160+i:02X}\n BNE bar_{i}\n LDA #${color:02X}\n STA $D020\n STA $D021\n'
    source += '''
bar_end: LDA $D012
 CMP #$B0
 BNE bar_end
 LDA #$00
 STA $D020
 STA $D021
scroll_split: LDA $D012
 CMP #$E0
 BNE scroll_split
 LDA scroll_phase
 STA $D016
 LDA #$06
 STA $D021
scroll_end: LDA $D012
 CMP #$EC
 BNE scroll_end
 LDA #$08
 STA $D016
 LDA #$00
 STA $D021
 CLI
 JSR $FFE1
 BEQ finish
 JMP frame_leave
finish: LDA #$00
 STA $D015
 STA $D404
 STA $D40B
 STA $D412
 STA $D418
 LDA saved_vertical
 STA $D011
 LDA saved_horizontal
 STA $D016
 LDA saved_charset
 STA $D018
 LDA saved_bank
 STA $DD00
 LDA saved_border
 STA $D020
 LDA saved_background
 STA $D021
 LDA saved_text
 STA $0286
 JSR $E544
 PLA
 STA $FC
 PLA
 STA $FB
 PLP
 RTS
stars: LDX #$2F
star_loop: LDA row_low,X
 STA $FB
 LDA row_high,X
 STA $FC
 LDY positions,X
 LDA #$20
 STA ($FB),Y
 LDA positions,X
 SEC
 SBC speeds,X
 BCS star_within
 ADC #$28
star_within: STA positions,X
 TAY
 LDA shapes,X
 STA ($FB),Y
 LDA row_high,X
 CLC
 ADC #$D4
 STA $FC
 LDA shades,X
 STA ($FB),Y
 DEX
 BPL star_loop
 RTS
shift_scroll: LDX #$00
shift_char: LDA $0771,X
 STA $0770,X
 INX
 CPX #$27
 BNE shift_char
scroll_read: LDA message
 BNE scroll_write
 LDA #<message
 STA scroll_read+1
 LDA #>message
 STA scroll_read+2
 JMP scroll_read
scroll_write: STA $0797
 INC scroll_read+1
 BNE scroll_return
 INC scroll_read+2
scroll_return: RTS
music: DEC music_ticks
 BEQ music_note
 RTS
music_note: LDA #$0A
 STA music_ticks
 LDX music_step
'''
    for voice, melody, waveform in [(0, 'lead', 0x41), (1, 'bass', 0x11), (2, 'arpeggio', 0x21)]:
        reg = 0xD400 + voice*7
        source += f''' LDA #${waveform-1:02X}
 STA ${reg+4:04X}
 LDA {melody},X
 TAY
 LDA freq_low,Y
 STA ${reg:04X}
 LDA freq_high,Y
 STA ${reg+1:04X}
 LDA #${waveform:02X}
 STA ${reg+4:04X}
'''
    source += '''
 INX
 TXA
 AND #$0F
 STA music_step
 RTS
'''
    for name in ['saved_vertical', 'saved_horizontal', 'saved_charset', 'saved_bank', 'saved_border', 'saved_background', 'saved_text', 'phase', 'music_step', 'music_ticks', 'star_ticks', 'scroll_phase']:
        source += table(name, [0])
    source += table('title', screen('ROOTPILOT PRESENTS '))
    source += table('caption', screen('50 HZ / 6510 / THREE SID VOICES '))
    source += table('footer', screen('RUN/STOP = BASIC    ORIGINAL SID MUSIC  '))
    source += table('message', screen('    ROOTPILOT PRESENTS ... BACK TO 1982! ... 48 STARS, 8 SPRITES, RASTER COLORS AND THREE SID VOICES ... ALL RUNNING ON THE C64 ... ORIGINAL CODE AND MUSIC ... GREETINGS TO EVERYONE STILL TYPING POKE! ... PRESS RUN/STOP TO RETURN TO BASIC ...    ') + [0])
    positions = [(i*17 + i//3*7) % 40 for i in range(48)]
    rows = [5 + (i*7+i//14) % 14 for i in range(48)]
    source += table('initial_positions', positions)
    source += table('positions', positions)
    source += table('row_low', [(0x400+row*40) & 255 for row in rows])
    source += table('row_high', [(0x400+row*40) >> 8 for row in rows])
    source += table('speeds', [1 + (i % 3 == 0) for i in range(48)])
    source += table('shapes', [42 if i % 3 == 0 else 46 for i in range(48)])
    source += table('shades', [1 if i % 3 == 0 else 12 if i % 2 else 15 for i in range(48)])
    source += table('wave', [86+round(9*math.sin(i*math.tau/64)) for i in range(64)])
    source += table('rainbow', [1,7,10,8,2,4,6,14,3,13,5,12,11,15,1,7])
    source += table('lead', [60,67,72,70,67,63,65,67,60,63,67,75,74,70,67,65])
    source += table('bass', [36]*4+[44]*4+[41]*4+[43]*4)
    source += table('arpeggio', [48,55,60,63,56,60,63,68,53,60,65,68,55,59,62,67])
    frequencies = [0]+[min(65535, round(440*2**((note-69)/12)*16777216/985248)) for note in range(1,128)]
    source += table('freq_low', [f & 255 for f in frequencies])
    source += table('freq_high', [f >> 8 for f in frequencies])
    binary, labels = assemble(source)
    # Small tokenized BASIC launcher. Reset VARTAB because LOAD includes RAM up
    # to the player at $C000, above BASIC's normal memory ceiling.
    body = [(10, b'\x8f ROOTPILOT INTRO'),
            (20, b'\x97 45,0:\x97 46,9:\x9c'),
            (30, b'\x9e 49152'), (40, b'\x80')]
    header, address = bytearray((1,8)), 0x801
    for number, tokens in body:
        address += len(tokens)+5
        header.extend((address & 255, address >> 8, number & 255, number >> 8))
        header.extend(tokens); header.append(0)
    header.extend((0,0))
    assert address < 0x900
    prg = bytearray(ORIGIN+len(binary)-0x801+2)
    prg[:len(header)] = header
    prg[2+0x3000-0x801:2+0x3200-0x801] = sprites()
    prg[2+ORIGIN-0x801:] = binary
    (OUT/'rootpilot-intro.prg').write_bytes(prg)
    (OUT/'intro.asm').write_text('; Origin $C000; build with scripts/build-intro.py\n'+source)
    (OUT/'metadata.json').write_text(json.dumps(dict(origin=ORIGIN, code_bytes=len(binary), labels=labels, pal_hz=50, stars=48, sprites=8), indent=2)+'\n')
    print(f'ROOTPILOT intro: {len(binary)} code/data bytes, {len(prg)} PRG bytes')


if __name__ == '__main__':
    main()
