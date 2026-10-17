# C64 · rootpilot

Ein Commodore 64 im Browser, vorgesehen für **https://c64.rootpilot.de**.
Der C64 läuft lokal im Browser: echte BASIC-V2-Tokenisierung und Ausführung,
6510-CPU, VIC-II-Grafik, Sprites und SID-Ton über den WASM-Emulator
[`c64-ready` 3.1.0](https://www.npmjs.com/package/c64-ready).
Es gibt keinen Server, auf den persönliche Programmdateien hochgeladen werden.

## Starten

Node.js **24.14 oder neuer**, npm und Git werden benötigt.

```bash
git clone https://github.com/SebLeitner/c64.git
cd c64
./setup.sh check
./setup.sh dev
```

`check` installiert exakt das Lockfile, testet mit der echten WASM-Maschine und
baut die statische Website nach `dist/`. `dev` startet Vite auf Port 5173.
`./setup.sh build` erstellt nur den Produktionsbuild.

## Bedienung

Auf den Bildschirm klicken und BASIC eingeben, beispielsweise:

```basic
10 FOR I=1 TO 10
20 PRINT "HALLO WELT";I
30 NEXT I
RUN
```

- `LIST`, `RUN`, `NEW`, `FOR/NEXT`, `IF/THEN`, `GOSUB/RETURN`, `DATA/READ`,
  `INPUT`, `POKE`, `PEEK`, `SYS` usw. werden vom emulierten BASIC ausgeführt.
- **`LOAD`** oder `LOAD "NAME",8`: Dialog öffnen und lokale `.prg`-Datei laden.
  BASIC anschließend mit `RUN` starten. `LOAD "NAME",8,1` berücksichtigt die
  Ladeadresse im PRG-Header, etwa für Maschinencode. Bei Sekundäradresse 0 wird
  wie beim C64 an die von BASIC vorgegebene Zieladresse geladen.
- **`SAVE`** oder `SAVE "NAME",8`: Dialog zum Speichern einer echten binären
  PRG-Datei. Chromium verwendet den nativen Speicherdialog. Andere Browser
  verwenden einen Dateidownload; dessen Ziel/Dateidialog bestimmt die
  Download-Einstellung des Browsers. Der vorgeschlagene Name ist editierbar.
- **`VERIFY "NAME",8`** vergleicht eine lokale PRG-Datei mit dem Speicher.
- Die LOAD-/SAVE-Schaltflächen tippen denselben BASIC-Befehl ein. Während ein
  Programm läuft, zuerst **RUN/STOP** drücken.
- **Escape** = RUN/STOP; Alt = Commodore; F1–F8, Home, Insert und Cursortasten
  werden an die C64-Tastatur weitergegeben. Auf dem Bildschirm funktioniert
  Strg/Cmd+V zum Einfügen von BASIC. Das aufklappbare Eingabefeld funktioniert
  auch auf Mobilgeräten. Es akzeptiert den C64-Zeichensatz, keine Unicode-Emojis.
- **TON AN** aktiviert SID-Audio nach einer Benutzeraktion. RESET verliert
  ungespeicherte Programme und fragt deshalb vorher nach.

### Kompatibilitätsgrenzen

Das ist ein echter Emulator, aber keine Zusicherung für jedes C64-Programm oder
jede Peripherie. RESTORE ist im verwendeten WASM-Core eingeschränkt.
LOAD/SAVE/VERIFY werden über die KERNAL-Vektoren `$0330`/`$0332` auf Browserdateien
umgeleitet; die beiden freien RAM-Bytes `$02A7`/`$02A8` dienen als RTS-Traps.
Programme, die eigene Fastloader, KERNAL-ROM-Routinen direkt oder diesen
Speicherbereich verwenden, können die Browser-Anbindung umgehen oder stören.
Kassetten, D64-Laufwerke, Erweiterungshardware und `OPEN`/`CLOSE`/`PRINT#` für
Browserdateien werden hier nicht nachgebildet. `.bas`-Text wird über das
Eingabefeld eingefügt; LOAD erwartet binäre PRG-Dateien. Geladene Programme
werden nicht automatisch gestartet. Emulator und Weboberfläche haben keine
Verbindung zum Betriebssystem außerhalb der bestätigten Dateidialoge.

## AWS veröffentlichen

Der Quellcode liegt auf GitHub, das Hosting erfolgt auf AWS:

- privater, verschlüsselter S3-Bucket, Zugriff ausschließlich über CloudFront OAC;
- CloudFront mit HTTPS-Weiterleitung und TLS 1.2;
- kostenloses öffentliches ACM-Zertifikat in `us-east-1`;
- DNS-Validierung und A/AAAA-Aliase in der **vorhandenen öffentlichen
  Route-53-Zone `rootpilot.de`**;
- MIME-Type `application/wasm`, immutable Assets und revalidiertes HTML;
- Security-Header einschließlich CSP; keine externen Fonts oder Laufzeit-CDNs.

**Voraussetzungen:** Terraform >=1.9 (getestet: 1.13.4), AWS CLI v2 und ein
funktionierendes AWS-Profil mit Berechtigungen für S3, CloudFront, ACM,
Route 53 und STS. Die DNS-Zone muss im ausgewählten AWS-Konto liegen und ihre
Nameserver müssen beim Registrar delegiert sein. Existierende DNS-Einträge
werden nicht automatisch überschrieben. Wenn DNS bei einem anderen Anbieter
liegt, ist diese Terraform-Variante vor Veröffentlichung anzupassen.

```bash
aws sso login --profile rootpilot   # falls dein Profil AWS SSO verwendet
AWS_PROFILE=rootpilot aws sts get-caller-identity
AWS_PROFILE=rootpilot ./setup.sh plan
AWS_PROFILE=rootpilot ./setup.sh deploy
```

`deploy` baut und testet, erstellt einen gespeicherten Terraform-Plan und zeigt
ihn vor der Bestätigung `yes` an. Es wendet exakt diesen Plan an, wartet auf
CloudFront, leert den Cache und prüft danach über HTTPS HTML, JavaScript, CSS,
Worklet und WASM gegen den lokalen Build. AWS erzeugt dabei laufende Kosten
für Hosting, DNS und Datenverkehr. Zertifikat-/CloudFront-Bereitstellung kann
einige Minuten dauern. Keine AWS-Schlüssel in Dateien oder Git eintragen.

Optionen werden an `terraform plan` weitergereicht:

```bash
AWS_PROFILE=rootpilot ./setup.sh deploy -var=aws_region=eu-central-1
```

**State:** `infra/terraform.tfstate` und Backups aufbewahren und vertraulich
behandeln; sie sind vom Git-Repository ausgeschlossen. Nicht aus einem frischen
Clone ohne vorhandenen State erneut deployen. Für Team-/CI-Deployment zuerst
einen separaten S3-State-Backend mit Locking einrichten und bestehenden State
mit `terraform init -migrate-state` migrieren. Die GitHub-Action prüft nur und
veröffentlicht bewusst keine Infrastruktur mit flüchtigem lokalem State.

## Tests

Falls Terraform fehlt, installiert `./setup.sh tools` die Version 1.13.4 lokal
unter `.tools/terraform`, mit fest hinterlegten offiziellen SHA-256-Prüfsummen.
Linux und macOS auf x64/ARM64 werden unterstützt; `curl` und `unzip` müssen vorhanden sein.
`plan` und `deploy` installieren Terraform bei Bedarf automatisch.

```bash
npm test
npx playwright install chromium
npm run test:e2e
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra test
```

Bei vorhandenem System-Chromium:
`CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.
Die Maschinentests booten die echte WASM-Datei und prüfen BASIC-Ausführung,
Speicherzugriffe, Maschinencode, tokenisiertes SAVE/LOAD, VERIFY,
Dialog-Abbruch und Neustart. Browsertests prüfen native Tastatureingabe,
PRG-Download/Upload-Rundlauf, fehlerhafte Dateien, Abbruch und Mobilansicht.
Terraform-Tests verwenden gemockte AWS-Provider und ersetzen keinen echten
AWS-Plan oder eine veröffentlichte HTTPS-Prüfung.

## Lizenzen

Die eigenen Dateien stehen unter MIT, siehe `LICENSE`.
`c64-ready` (MIT, Copyright 2026 hayesmaker) basiert auf c64.js/lvllvl von James.
Die mitgelieferte Attribution wird unter `/third-party-notices.txt` ausgeliefert.
Es werden keine Spiele oder kommerziellen Programmdateien mitgeliefert.
