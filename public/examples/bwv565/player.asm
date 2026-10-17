; Origin $C800; assembled by scripts/build-bwv565.py

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

        LDY #$01
        LDA ($FB),Y
        CMP old0
        BEQ skip0
        STA old0
        LDX #$10
        STX $D404
        CMP #$00
        BEQ skip0
        TAX
        LDA low,X
        STA $D400
        LDA high,X
        STA $D401
        LDA #$11
        STA $D404
skip0:

        LDY #$02
        LDA ($FB),Y
        CMP old1
        BEQ skip1
        STA old1
        LDX #$10
        STX $D40B
        CMP #$00
        BEQ skip1
        TAX
        LDA low,X
        STA $D407
        LDA high,X
        STA $D408
        LDA #$11
        STA $D40B
skip1:

        LDY #$03
        LDA ($FB),Y
        CMP old2
        BEQ skip2
        STA old2
        LDX #$10
        STX $D412
        CMP #$00
        BEQ skip2
        TAX
        LDA low,X
        STA $D40E
        LDA high,X
        STA $D40F
        LDA #$11
        STA $D412
skip2:

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
low: .byte 0,147,156,166,175,186,197,209,221,234,248,7,22,39,57,75,95,116,138,161,186,212,240,14,45,78,113,150,190,231,20,66,116,169,224,27,90,156,226,45,123,207,39,133,232,81,193,55,180,56,196,89,247,157,78,10,208,162,129,109,103,112,137,178,237,59,156,19,160,69,2,218,206,224,17,100,218,118,57,38,64,137,4,180,156,192,35,200,180,235,114,76,128,18,8,104,57,128,69,144,104,214,227,153,0,36,16,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255
high: .byte 0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,3,3,3,3,3,4,4,4,4,5,5,5,6,6,6,7,7,8,8,9,9,10,10,11,12,13,13,14,15,16,17,18,19,20,21,23,24,26,27,29,31,32,34,36,39,41,43,46,49,52,55,58,62,65,69,73,78,82,87,92,98,104,110,117,124,131,139,147,156,165,175,185,196,208,221,234,248,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255
