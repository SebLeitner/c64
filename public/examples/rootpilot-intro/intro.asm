; Origin $C000; build with scripts/build-intro.py

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
 LDA #$58
 STA $D000
 LDA #$C0
 STA $07F8
 LDA #$70
 STA $D002
 LDA #$C1
 STA $07F9
 LDA #$88
 STA $D004
 LDA #$C2
 STA $07FA
 LDA #$A0
 STA $D006
 LDA #$C3
 STA $07FB
 LDA #$B8
 STA $D008
 LDA #$C4
 STA $07FC
 LDA #$D0
 STA $D00A
 LDA #$C5
 STA $07FD
 LDA #$E8
 STA $D00C
 LDA #$C6
 STA $07FE
 LDA #$00
 STA $D00E
 LDA #$C7
 STA $07FF

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
 LDA phase
 CLC
 ADC #$00
 AND #$3F
 TAY
 LDA wave,Y
 STA $D001
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$00
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D027
 LDA phase
 CLC
 ADC #$03
 AND #$3F
 TAY
 LDA wave,Y
 STA $D003
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$01
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D028
 LDA phase
 CLC
 ADC #$06
 AND #$3F
 TAY
 LDA wave,Y
 STA $D005
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$02
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D029
 LDA phase
 CLC
 ADC #$09
 AND #$3F
 TAY
 LDA wave,Y
 STA $D007
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$03
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D02A
 LDA phase
 CLC
 ADC #$0C
 AND #$3F
 TAY
 LDA wave,Y
 STA $D009
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$04
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D02B
 LDA phase
 CLC
 ADC #$0F
 AND #$3F
 TAY
 LDA wave,Y
 STA $D00B
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$05
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D02C
 LDA phase
 CLC
 ADC #$12
 AND #$3F
 TAY
 LDA wave,Y
 STA $D00D
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$06
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D02D
 LDA phase
 CLC
 ADC #$15
 AND #$3F
 TAY
 LDA wave,Y
 STA $D00F
 LDA phase
 LSR A
 LSR A
 CLC
 ADC #$07
 AND #$0F
 TAY
 LDA rainbow,Y
 STA $D02E

 DEC scroll_phase
 BPL scroll_ready
 LDA #$07
 STA scroll_phase
 JSR shift_scroll
scroll_ready: SEI
bar_0: LDA $D012
 CMP #$A0
 BNE bar_0
 LDA #$06
 STA $D020
 STA $D021
bar_1: LDA $D012
 CMP #$A1
 BNE bar_1
 LDA #$0E
 STA $D020
 STA $D021
bar_2: LDA $D012
 CMP #$A2
 BNE bar_2
 LDA #$03
 STA $D020
 STA $D021
bar_3: LDA $D012
 CMP #$A3
 BNE bar_3
 LDA #$0D
 STA $D020
 STA $D021
bar_4: LDA $D012
 CMP #$A4
 BNE bar_4
 LDA #$01
 STA $D020
 STA $D021
bar_5: LDA $D012
 CMP #$A5
 BNE bar_5
 LDA #$07
 STA $D020
 STA $D021
bar_6: LDA $D012
 CMP #$A6
 BNE bar_6
 LDA #$0A
 STA $D020
 STA $D021
bar_7: LDA $D012
 CMP #$A7
 BNE bar_7
 LDA #$08
 STA $D020
 STA $D021
bar_8: LDA $D012
 CMP #$A8
 BNE bar_8
 LDA #$02
 STA $D020
 STA $D021
bar_9: LDA $D012
 CMP #$A9
 BNE bar_9
 LDA #$08
 STA $D020
 STA $D021
bar_10: LDA $D012
 CMP #$AA
 BNE bar_10
 LDA #$0A
 STA $D020
 STA $D021
bar_11: LDA $D012
 CMP #$AB
 BNE bar_11
 LDA #$07
 STA $D020
 STA $D021
bar_12: LDA $D012
 CMP #$AC
 BNE bar_12
 LDA #$01
 STA $D020
 STA $D021
bar_13: LDA $D012
 CMP #$AD
 BNE bar_13
 LDA #$0D
 STA $D020
 STA $D021
bar_14: LDA $D012
 CMP #$AE
 BNE bar_14
 LDA #$03
 STA $D020
 STA $D021
bar_15: LDA $D012
 CMP #$AF
 BNE bar_15
 LDA #$0E
 STA $D020
 STA $D021

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
 LDA #$40
 STA $D404
 LDA lead,X
 TAY
 LDA freq_low,Y
 STA $D400
 LDA freq_high,Y
 STA $D401
 LDA #$41
 STA $D404
 LDA #$10
 STA $D40B
 LDA bass,X
 TAY
 LDA freq_low,Y
 STA $D407
 LDA freq_high,Y
 STA $D408
 LDA #$11
 STA $D40B
 LDA #$20
 STA $D412
 LDA arpeggio,X
 TAY
 LDA freq_low,Y
 STA $D40E
 LDA freq_high,Y
 STA $D40F
 LDA #$21
 STA $D412

 INX
 TXA
 AND #$0F
 STA music_step
 RTS
saved_vertical:
 .byte 0
saved_horizontal:
 .byte 0
saved_charset:
 .byte 0
saved_bank:
 .byte 0
saved_border:
 .byte 0
saved_background:
 .byte 0
saved_text:
 .byte 0
phase:
 .byte 0
music_step:
 .byte 0
music_ticks:
 .byte 0
star_ticks:
 .byte 0
scroll_phase:
 .byte 0
title:
 .byte 18,15,15,20,16,9,12,15,20,32,16,18,5,19,5,14
 .byte 20,19,32
caption:
 .byte 53,48,32,8,26,32,47,32,54,53,49,48,32,47,32,20
 .byte 8,18,5,5,32,19,9,4,32,22,15,9,3,5,19,32
footer:
 .byte 18,21,14,47,19,20,15,16,32,61,32,2,1,19,9,3
 .byte 32,32,32,32,15,18,9,7,9,14,1,12,32,19,9,4
 .byte 32,13,21,19,9,3,32,32
message:
 .byte 32,32,32,32,18,15,15,20,16,9,12,15,20,32,16,18
 .byte 5,19,5,14,20,19,32,46,46,46,32,2,1,3,11,32
 .byte 20,15,32,49,57,56,50,33,32,46,46,46,32,52,56,32
 .byte 19,20,1,18,19,44,32,56,32,19,16,18,9,20,5,19
 .byte 44,32,18,1,19,20,5,18,32,3,15,12,15,18,19,32
 .byte 1,14,4,32,20,8,18,5,5,32,19,9,4,32,22,15
 .byte 9,3,5,19,32,46,46,46,32,1,12,12,32,18,21,14
 .byte 14,9,14,7,32,15,14,32,20,8,5,32,3,54,52,32
 .byte 46,46,46,32,15,18,9,7,9,14,1,12,32,3,15,4
 .byte 5,32,1,14,4,32,13,21,19,9,3,32,46,46,46,32
 .byte 7,18,5,5,20,9,14,7,19,32,20,15,32,5,22,5
 .byte 18,25,15,14,5,32,19,20,9,12,12,32,20,25,16,9
 .byte 14,7,32,16,15,11,5,33,32,46,46,46,32,16,18,5
 .byte 19,19,32,18,21,14,47,19,20,15,16,32,20,15,32,18
 .byte 5,20,21,18,14,32,20,15,32,2,1,19,9,3,32,46
 .byte 46,46,32,32,32,32,0
initial_positions:
 .byte 0,17,34,18,35,12,36,13,30,14,31,8,32,9,26,10
 .byte 27,4,28,5,22,6,23,0,24,1,18,2,19,36,20,37
 .byte 14,38,15,32,16,33,10,34,11,28,12,29,6,30,7,24
positions:
 .byte 0,17,34,18,35,12,36,13,30,14,31,8,32,9,26,10
 .byte 27,4,28,5,22,6,23,0,24,1,18,2,19,36,20,37
 .byte 14,38,15,32,16,33,10,34,11,28,12,29,6,30,7,24
row_low:
 .byte 200,224,200,224,200,224,200,224,200,224,200,224,200,224,240,8
 .byte 240,8,240,8,240,8,240,8,240,8,240,8,24,48,24,48
 .byte 24,48,24,48,24,48,24,48,24,48,64,88,64,88,64,88
row_high:
 .byte 4,5,4,5,4,5,4,5,4,5,4,5,4,5,4,6
 .byte 4,6,4,6,4,6,4,6,4,6,4,6,5,6,5,6
 .byte 5,6,5,6,5,6,5,6,5,6,5,6,5,6,5,6
speeds:
 .byte 2,1,1,2,1,1,2,1,1,2,1,1,2,1,1,2
 .byte 1,1,2,1,1,2,1,1,2,1,1,2,1,1,2,1
 .byte 1,2,1,1,2,1,1,2,1,1,2,1,1,2,1,1
shapes:
 .byte 42,46,46,42,46,46,42,46,46,42,46,46,42,46,46,42
 .byte 46,46,42,46,46,42,46,46,42,46,46,42,46,46,42,46
 .byte 46,42,46,46,42,46,46,42,46,46,42,46,46,42,46,46
shades:
 .byte 1,12,15,1,15,12,1,12,15,1,15,12,1,12,15,1
 .byte 15,12,1,12,15,1,15,12,1,12,15,1,15,12,1,12
 .byte 15,1,15,12,1,12,15,1,15,12,1,12,15,1,15,12
wave:
 .byte 86,87,88,89,89,90,91,92,92,93,93,94,94,95,95,95
 .byte 95,95,95,95,94,94,93,93,92,92,91,90,89,89,88,87
 .byte 86,85,84,83,83,82,81,80,80,79,79,78,78,77,77,77
 .byte 77,77,77,77,78,78,79,79,80,80,81,82,83,83,84,85
rainbow:
 .byte 1,7,10,8,2,4,6,14,3,13,5,12,11,15,1,7
lead:
 .byte 60,67,72,70,67,63,65,67,60,63,67,75,74,70,67,65
bass:
 .byte 36,36,36,36,44,44,44,44,41,41,41,41,43,43,43,43
arpeggio:
 .byte 48,55,60,63,56,60,63,68,53,60,65,68,55,59,62,67
freq_low:
 .byte 0,147,156,166,175,186,197,209,221,234,248,7,22,39,57,75
 .byte 95,116,138,161,186,212,240,14,45,78,113,150,190,231,20,66
 .byte 116,169,224,27,90,156,226,45,123,207,39,133,232,81,193,55
 .byte 180,56,196,89,247,157,78,10,208,162,129,109,103,112,137,178
 .byte 237,59,156,19,160,69,2,218,206,224,17,100,218,118,57,38
 .byte 64,137,4,180,156,192,35,200,180,235,114,76,128,18,8,104
 .byte 57,128,69,144,104,214,227,153,0,36,16,255,255,255,255,255
 .byte 255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255
freq_high:
 .byte 0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1
 .byte 1,1,1,1,1,1,1,2,2,2,2,2,2,2,3,3
 .byte 3,3,3,4,4,4,4,5,5,5,6,6,6,7,7,8
 .byte 8,9,9,10,10,11,12,13,13,14,15,16,17,18,19,20
 .byte 21,23,24,26,27,29,31,32,34,36,39,41,43,46,49,52
 .byte 55,58,62,65,69,73,78,82,87,92,98,104,110,117,124,131
 .byte 139,147,156,165,175,185,196,208,221,234,248,255,255,255,255,255
 .byte 255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255
