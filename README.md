# mathServer – 1×1 Trainer

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)

<p align="center">
  <img src="icon-192.png" width="128" height="128" alt="App-Icon des 1×1 Trainers">
</p>

Eine kleine Web-App zum Üben von Multiplikation und optional Division mit Spaced Repetition:
Aufgaben, bei denen dein Kind schnell und richtig antwortet, kommen seltener
dran. Falsche oder langsame Antworten kommen öfter wieder – so wird gezielt
das geübt, was noch nicht sitzt.

Alles läuft direkt im Browser, Fortschritt wird lokal gespeichert
(`localStorage`). Es ist kein Backend und keine Datenbank nötig. Die App ist
eine PWA mit Service Worker: Einmal geladen, funktioniert sie auch offline
bzw. wenn der Server gerade nicht erreichbar ist.

Die App kommt ohne Werbung, Benutzerkonto, Tracker oder Telemetrie aus. Sie
überträgt selbst keine Lernstände oder Profildaten an einen Server.

Die Oberfläche liegt in `index.html`, das Styling in `styles.css` und die
Anwendungs- und Spiellogik in `app.js`. `flappy.html` und `tower.html` sind
kleine Direktstarter, die dieselben integrierten Spiele ohne Lernbelohnung
öffnen. Dadurch gibt es keine doppelte Spiellogik.

## Features

- Täglich eine konfigurierbare Anzahl Aufgaben (Standard: 5)
- Konfigurierbarer Zahlenbereich von 1 bis 20
- Einzelne Zahlen gezielt auswählbar; in normalen gemischten Runden kommen
  abgewählte Zahlen in keiner Aufgabe als Faktor vor. Optional werden gewählte
  Reihen schrittweise bei 80 % sicherem Lernstand freigeschaltet
- Gezielte Zahlenreihen-Runden: Auf der Startseite kann eine der konfigurierten
  Reihen ausgewählt werden. Die Runde nutzt die eingestellte Aufgabenanzahl und
  den normalen Lernfortschritt, enthält aber ausschließlich Aufgabenfamilien
  dieser Reihe. Der jeweils andere Faktor darf aus dem gesamten eingestellten
  Zahlenbereich stammen, auch wenn er nicht als eigene Reihe aktiviert ist.
  Freie Rundenplätze werden mit unterschiedlichen Aufgaben der Reihe gefüllt;
  das allgemeine Limit für neue Aufgaben gilt nur für gemischte Runden. Mit
  „Noch einmal“ wird anschließend dieselbe Zahlenreihe erneut gestartet
- Konfigurierbare Begrenzung neuer Aufgaben pro Runde; bekannte Wiederholungen
  haben Vorrang, neue Aufgaben werden innerhalb der Runde erneut abgefragt und
  die nächste Runde führt weitere neue Aufgaben ein
- Adaptive Wiederholung: schnelle richtige Antworten -> längere Pause bis zur
  nächsten Wiederholung; falsche/langsame Antworten -> kommen bald wieder;
  pro Runde wird eine ältere, überfällige Aufgabe aus einer höheren Lernstufe
  berücksichtigt, damit bereits Gelerntes regelmäßig wiederholt wird; eine
  Aufgabe steigt erst nach zwei richtigen Antworten in Folge auf
- Serien-Zähler (Tage in Folge geübt) und Fortschrittsübersicht; ein einzelner
  ausgelassener Tag lässt sich am Folgetag durch zwei vollständige Runden nachholen
- Falsche Aufgaben werden noch in derselben Runde wiederholt
- Antwort-Modus wählbar: Multiple-Choice, Eintippen per Ziffernblock oder
  adaptiv (neue Aufgaben antippen, ab Lernstufe 2 frei eintippen); bei
  eingetippten Antworten werden für die Lernstufen-Bewertung zwei Sekunden
  Eingabezeit abgezogen
- Optionale Lückenaufgaben (7 × ▢ = 56)
- Optionales Divisionstraining: Eltern können Division pro Profil aktivieren;
  zu einer Malaufgabe werden ab Lernstufe 4 die beiden passenden exakten
  Geteiltaufgaben freigeschaltet (z.B. 56 ÷ 7 und 56 ÷ 8). Multiplikation und
  Division behalten getrennte Lernstufen und Auswertungen, teilen sich aber
  Rundenumfang, neue Aufgaben und Belohnungsfortschritt. Sobald mindestens eine
  Geteiltaufgabe freigeschaltet ist, enthält jede neu gestartete Runde eine
  Divisionsaufgabe
- Belohnungen: Sticker pro geübtem Tag, Abzeichen für Serien-Meilensteine,
  Konfetti und Soundeffekte (abschaltbar)
- Drei Lernbelohnungen zur Auswahl: Dino-Sprung, Flattervogel und Turmbauer. Die benötigte
  Anzahl richtiger Antworten pro Spiel ist im Eltern-Bereich konfigurierbar
  (Standard: 10); die Startseite zeigt, wie viele richtige Antworten bis zum
  nächsten Spiel fehlen; nach 2 Minuten startet
  kein neuer Versuch mehr, ein bereits laufender Versuch darf noch bis zum
  nächsten Zusammenstoß fertiggespielt werden; spätestens nach 3 Versuchen ist
  Schluss; riskant platzierte Sterne, Combo-Multiplikatoren, fünf Sekunden
  Super-Dino nach jeweils drei Sternen, seltene Bonus-Versuch-Eier und ein
  persönlicher Punkterekord sorgen für Abwechslung; das Spiel wird in sechs
  Stufen zunehmend schneller und mischt unregelmäßige Abstände, kurze
  Kakteen-Paare und niedrig fliegende Hindernisse, bei denen man am Boden bleibt;
  nach Spielende kann bei vorhandenem Kontingent direkt das nächste
  Belohnungsspiel gewählt werden
- Flattervogel mit touchfreundlicher Ein-Tipp-Steuerung, zunehmend schnelleren
  Röhren und kleiner werdenden Lücken sowie eigenem Punkterekord; das Spiel kann
  zum Ausprobieren auch direkt über `flappy.html` gestartet werden
- Turmbauer mit Ein-Tipp-Steuerung, schneller werdenden Bausteinen, perfekten
  Platzierungen und eigenem Punkterekord; direkt über `tower.html` spielbar
- Mehrere Kind-Profile mit getrenntem Fortschritt
- Eltern-Bereich (Zahnrad oben rechts, PIN-geschützt): Zahlenbereich,
  Reihen, neue und gesamte Aufgaben, richtige Antworten pro Belohnung,
  Antwort-Modus, Division aktivieren, PIN ändern, Fortschritt für Multiplikation
  und Division getrennt einsehen, Problemaufgaben und 7-Tage-Genauigkeit
  auswerten, Backup exportieren/importieren, Profile verwalten;
  gegliedert in die Tabs „Übersicht“, „Lernen“ und „Verwaltung“. Der initiale
  Elterncode lautet `6969` und sollte nach dem ersten Öffnen geändert werden
- Responsives Design – passt sich an iPhone, iPad und Desktop an
- Pro Profil auswählbare Akzentfarbe: Lila, Blau, Grün, Orange oder Rosa
- Als Home-Bildschirm-App installierbar (iOS "Zum Home-Bildschirm hinzufügen"),
  funktioniert dank Service Worker auch offline

## Hosting auf dem Raspberry Pi

Am einfachsten mit einem simplen Webserver, z.B. `nginx` oder Python:

### Option A: Python (schnell zum Testen)

```bash
cd mathServer
python3 -m http.server 8080
```

Dann im Netzwerk aufrufen: `http://<pi-ip>:8080/index.html`

**Achtung:** So gestartet läuft der Server nur, solange die SSH-Sitzung offen
ist, und übersteht keinen Reboot. Für Dauerbetrieb Option B (nginx) nutzen
oder den Python-Server als systemd-Dienst einrichten:

```ini
# /etc/systemd/system/mathserver.service
[Unit]
Description=1x1 Trainer Webserver
After=network.target

[Service]
WorkingDirectory=/home/pi/mathServer
ExecStart=/usr/bin/python3 -m http.server 8080
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mathserver
```

### Option B: nginx (dauerhaft, startet automatisch mit)

```bash
sudo apt install nginx
sudo cp index.html styles.css app.js flappy.html tower.html manifest.json sw.js icon-192.png icon-512.png /var/www/html/
```

Danach ist die Seite über `http://<pi-ip>/` erreichbar.

### Auf iPad/iPhone als App nutzen

Im Safari-Browser die Seite öffnen, auf "Teilen" tippen, dann
"Zum Home-Bildschirm" wählen. Die App startet danach ohne Browser-Leiste,
wie eine echte App.

## Veröffentlichung mit GitHub Pages

Das Repository enthält unter `.github/workflows/pages.yml` einen Workflow für
GitHub Pages. Im öffentlichen GitHub-Repository muss **vor dem ersten
erfolgreichen Workflow-Lauf** einmal unter **Settings → Pages → Build and
deployment** die Quelle **GitHub Actions** gewählt werden. Ohne diese einmalige
Aktivierung meldet `configure-pages` den Fehler `Get Pages site failed: Not
Found`. Danach veröffentlicht jeder Push auf `main` automatisch die aktuelle
statische App.

## Hinweis zum Fortschritt

Der Fortschritt wird pro Gerät/Browser lokal gespeichert. Übt dein Kind auf
mehreren Geräten, gibt es entsprechend getrennte Fortschritte.

## Datenschutz

Profile, Einstellungen, Lernstände und Statistiken werden ausschließlich im
`localStorage` des verwendeten Browsers gespeichert. Die App enthält keine
Analyse- oder Werbedienste und sendet diese Daten nicht an Dritte. Beim
Exportieren eines Backups wird eine JSON-Datei lokal im Browser erzeugt; beim
Importieren wird nur die vom Nutzer ausgewählte Datei verarbeitet.

Wer die App öffentlich hostet, muss unabhängig davon die Datenschutz- und
Protokollierungsbedingungen des gewählten Hosting-Anbieters beachten.

Bei einer Bereitstellung über GitHub Pages wird die Website von GitHub, Inc.
ausgeliefert. GitHub protokolliert dabei nach eigenen Angaben die IP-Adressen
der Besucher zu Sicherheitszwecken – unabhängig davon, ob sie bei GitHub
angemeldet sind. Die App selbst hat keinen Zugriff auf diese Serverprotokolle
und übermittelt weiterhin keine Lernstände, Profile oder Nutzungsstatistiken
an GitHub. Weitere Informationen enthält die
[GitHub-Datenschutzerklärung](https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement).

## Lizenz und Assets

Der Quellcode und die mitgelieferten Projekt-Assets stehen unter der
[MIT-Lizenz](LICENSE). Die Herkunft der Bilddateien und die Erzeugung des
eigenständigen App-Icons sind in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md)
dokumentiert.

Beiträge und Verbesserungsvorschläge sind über Issues und Pull Requests
willkommen.
