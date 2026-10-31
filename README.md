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
Anwendungs- und Spiellogik in `app.js` und `arcade-extra.js`. `flappy.html`, `tower.html`,
`gravity.html`, `brick.html`, `snake.html`, `snow.html`, `runner.html`,
`doodle.html`, `tiles.html`, `maze.html` und `asteroid.html` sind
kleine Direktstarter, die dieselben integrierten Spiele ohne Lernbelohnung
öffnen. Dadurch gibt es keine doppelte Spiellogik.

## Features

Die Startseite zeigt anspruchsvollere/neue Modi zuerst: Punkt vor Strich,
halbschriftliche und schriftliche Division, Zahlenrätsel, Division mit Rest,
Rechnen mit 100ern, Rechenbegriffe und Zahlenreihen. Die gemischte 1×1-Runde
steht auf schmalen Displays darunter, auf breiten rechts daneben.

### Punkt vor Strich

Ein eigener Startbutton übt **Klammer vor Punkt vor Strich** mit einfachen
Zahlen. Vierzehn Aufgabenmuster mischen Plus, Minus, Mal und Geteilt, mit und
ohne Klammern – auch alle vier Rechenarten in einer Aufgabe. Ab zwei Fragen
enthält jede Runde sowohl Klammeraufgaben als auch Aufgaben ohne Klammern.
Die tatsächlich auszurechnenden Malaufgaben haben nur einstellige Faktoren,
auch nach dem Auflösen einer Klammer. Divisionen gehen ohne Rest auf; Divisor
oder Quotient ist höchstens 5 (z. B. 24 ÷ 6 oder 24 ÷ 4, nicht 56 ÷ 8).
Ergebnisse bleiben nichtnegative ganze Zahlen bis 100.

Die vier Auswahlantworten berücksichtigen typische Reihenfolgefehler:
Bei `3 × 4 + 2` erscheinen sowohl **14** als auch **18**. Nahe falsche Antworten
verhindern zusätzlich das Raten anhand der Größenordnung. Nach jeder Antwort
wird der Rechenweg erklärt. Rundengröße, Zahleneingabe beziehungsweise adaptive
Auswahl, Wiederholung, Statistik, Spielbelohnungen, Abbruch und Sicherungen
funktionieren wie in den anderen Modi. Der Lernstand wird separat gespeichert;
die Zahlenwahl der normalen Einmaleins-Runden begrenzt diesen Modus nicht.

### Automatische Spielsaisons und ruhige Tastatureingabe

Alle zwölf Spiele richten ihre Dekoration nach dem lokalen Gerätedatum aus,
jährlich wiederkehrend und auch offline:

- **Halloween, 20.–31. Oktober:** dunkle Paletten, Mond, Kürbisse, Spinnweben,
  Fledermäuse und Hexen; Cleos Kürbis-Futter, saisonale Kostüme und Metro-Deko.
- **Weihnachten, 1.–27. Dezember:** Schneeflocken, Lichterketten, geschmückte
  Tannen, Geschenke, Weihnachtsmützen, Schneemänner und gelegentlich ein Schlitten.
- Außerhalb dieser Zeitfenster kehren normale Farben und Figuren zurück,
  bei Cleo Obst statt Kürbisse beziehungsweise Geschenke.

Der Wechsel erfolgt beim nächsten Zeichnen, auch über einen lokalen
Mitternachtswechsel hinweg. Dekorationen nutzen nur aktive Spielzeit und
beeinflussen weder Spielphysik, Level-Zufall, Punkte noch Kontingente.
Selbst gewählte Avatar-Outfits bleiben unverändert. Reduzierte Bewegung wird
bei den saisonalen Animationen berücksichtigt; Blitze sind langsam und fern,
keine bildschirmfüllenden Lichtblitze.

Wiederholte Tastatur-/Viewport-Meldungen ohne tatsächliche Änderung lösen
keine erneuten CSS-/Scroll-Schreibzugriffe aus. Größenänderungen werden pro
Bild zusammengefasst; bloßes Scrollen baut Spiel-Canvases nicht neu auf.

### Division mit Rest

Der eigene Startbutton übt Division mit den eingestellten Zahlenreihen und
der üblichen Rundengröße. Pro Aufgabe beträgt die Wahrscheinlichkeit für
einen Rest 95 %, für Rest 0 sind es 5 % (keine feste Quote pro kurzer Runde).
Beispiel: `28 ÷ 5 = 5 R 3`. Divisor 1 wird ausgeschlossen.
Das Ergebnis wird wie gewohnt aus vier Antworten gewählt oder per Zahleneingabe
eingegeben; der adaptive Modus schaltet nach demselben Lernstand um wie bei
normaler Division. Der Rest wird immer in ein eigenes R-Feld eingetragen,
auch die 0 muss ausdrücklich eingegeben werden. Eine Antwort zählt erst,
wenn Ergebnis und Rest gemeinsam geprüft wurden. Lernstand, Fehlerwiederholungen,
Statistik und Spielbelohnungen werden wie üblich gespeichert; normale Division
und halbschriftliches Dividieren behalten ihre eigenen Lernstände.

### Halbschriftlich dividieren (Klasse 4)

Ein eigener Startseiten-Modus vermittelt schrittweises Dividieren: den
Dividenden in gut teilbare Teile zerlegen, jeden Teil durch denselben Divisor
teilen, Teilergebnisse addieren und mit der Umkehraufgabe prüfen.
Beispiel: 276 : 4 → 240 : 4 = 60 und 36 : 4 = 9 → 69;
Probe: 69 × 4 = 276. Auch andere passende Zerlegungen sind richtig.

- **Mit Hilfe:** dreistellige Aufgaben bis 999; passende Teile sind vorgegeben.
- **Eigener Rechenweg:** dreistellige Aufgaben bis 999, Teile selbst wählen.
- **Mit Rest:** ebenfalls bis 999, eigene Zerlegung, Rest kleiner als der Divisor und Probe
  `Ergebnis × Divisor + Rest = Dividend`.

Die Einführung erklärt den Weg und vergleicht zwei Zerlegungen. Tipps und
gezielte Rückmeldungen unterstützen beim Üben. Alle Stufen teilen durch
2 bis 9; sie sind unabhängig von der Freischaltung normaler Divisionsaufgaben.
Eine vollständige Aufgabe einschließlich Probe zählt einmal für Statistik und
Spielbelohnungen, nicht jede einzelne Teilrechnung. Fehler im Gesamtergebnis
werden wie in anderen Lernmodi wiederholt. Lernstände, gewählte Stufe und
Sicherungen bleiben erhalten; der bisherige Modus „Schriftlich dividieren“
bleibt unverändert verfügbar.

Didaktische Grundlage: [Mahiko/DZLM: Übungsreihe halbschriftliche Division](https://mahiko.dzlm.de/zahlraum-bis-1000-ueberblick/halbschriftliche-division/uebungen)
und [KIRA/DZLM: flexible Rechenwege und typische Schwierigkeiten](https://kira.dzlm.de/arithmetik/halbschriftliches-rechnen/halbschriftliche-division).
Umgesetzt ist die universell nutzbare Strategie „schrittweise“, nicht ein
festgeschriebener schriftlicher Ziffernalgorithmus. Voraussetzung sind ein
grundlegendes Verständnis des Teilens sowie das kleine Einmaleins. Texte,
Aufgabengenerator und Oberfläche sind eigenständig; keine fremden Arbeitsblätter,
Bilder oder Videos werden eingebunden.

### Weitere Lern- und Spielfunktionen

- Name und Avatar lassen sich ohne Eltern-PIN über die Figur neben der
  Begrüßung oder das Profil-Symbol gestalten. Haut-/Augen-/Haarfarben,
  Frisuren, Brille, Kleidung, Kostüme und Accessoires werden pro Profil lokal
  gespeichert und mitgesichert. Beim ersten normalen Start eines namenlosen
  Profils erscheint die Auswahl; Demo-Spiele überspringen sie. Name und Avatar
  sind von den Mathe-Einstellungen getrennt, bestehende Lernstände bleiben erhalten.
  Es gibt neun Oberteil-Schnitte und zwölf Unterteile, jeweils mit eigener frei
  wählbarer Farbe, außerdem weich nach innen fallende schulterlange Wellen
  und glatte Haare bis zum Bauch.
  Bisherige Kleidungsfarben und Kostüme bleiben bei der Umstellung erhalten.
  Beim Bearbeiten bleibt die Avatar-Vorschau sichtbar; nur die Auswahl scrollt.
  Ein Hinweis erklärt, wenn ein Kostüm die Alltagskleidung überdeckt.
- Alle zwölf Spiele zeichnen mit einem Retina-Backing-Store für schärfere
  Darstellung auf hochauflösenden Bildschirmen. Spielkoordinaten und
  Touch-Steuerung bleiben davon unabhängig. Dialoge berücksichtigen die
  Bildschirmtastatur, ohne die darunterliegende App zu verkleinern.
  Pinch-Zoom bleibt im Mathetrainer nutzbar.
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
  „Noch einmal“ wird auf dem Abschlussbildschirm dieselbe Zahlenreihe erneut
  gestartet. Nach „Fertig für heute“ bietet die Startseite wieder eine
  gemischte Runde oder die Auswahl einer anderen Zahlenreihe an
- Konfigurierbare Begrenzung neuer Aufgaben pro Runde; bekannte Wiederholungen
  haben Vorrang, neue Aufgaben werden innerhalb der Runde erneut abgefragt und
  die nächste Runde führt weitere neue Aufgaben ein
- Vier zusätzliche Lernmodi auf der Startseite:
  - „Rechnen mit 100ern“: alle Aufgabenfamilien des kleinen Einmaleins von
    1 bis 10 mit Zehnerzahlen, z.B. `70 × 7 = 490` und `210 ÷ 30 = 7`.
    Multiplikation und Division sind in diesem Modus direkt verfügbar;
    Ergebnisse können bis 1000 reichen. Auswahlantworten enthalten auch typische
    Zehnerfehler, z.B. `90` statt `9` bei `450 ÷ 50` oder eine fehlende Null
    bei Multiplikationen.
  - „Rechenbegriffe lernen“: Rechenarten erkennen (Addition, Subtraktion,
    Multiplikation, Division) und Textaufgaben zu Summe, Differenz, Produkt
    und Quotient lösen. Antwortmöglichkeiten stammen aus den verschiedenen
    Rechenarten mit denselben Zahlen; gleiche Ergebnisse erscheinen nur einmal.
    Nahe gelegene falsche Ergebnisse ergänzen die Auswahl auf vier Antworten.
    Die Rückmeldung verbindet die Begriffe mit der Rechnung.
  - „Zahlenrätsel lösen“: zwei Rechenschritte in einer Textaufgabe verbinden,
    z.B. „Addiere die Hälfte von 100 mit 20“. Die Rückmeldung erklärt beide Schritte.
    Falsche Auswahlantworten bilden typische Fehler ab, etwa einen ausgelassenen
    Schritt oder eine falsch angewandte Verdopplung/Halbierung. Die Auswahl
    enthält immer vier unterschiedliche, nichtnegative ganze Zahlen.
  - „Schriftlich dividieren“: dreistellige Zahlen durch 2 bis 9 ohne Rest,
    unabhängig von der Reihenauswahl. Die Maske hat eine Teilrechnung pro
    Ergebnisstelle ungleich 0, also höchstens drei. Beispiel:
    `232 : 4` wird in `200 : 4 = 50` und `32 : 4 = 8` zerlegt.
    `848 : 8 = 106` benötigt ebenfalls nur zwei Zeilen: `800 : 8 = 100`
    und `48 : 8 = 6`; für die Null an der Zehnerstelle ist keine Zeile nötig.
    Die Zahlen und Teilergebnisse werden
    selbst eingegeben. Jede Zahl hat drei einzelne, senkrecht ausgerichtete
    Stellenfelder mit `?` als Platzhalter. Jede Ziffer führt automatisch zur
    nächsten Stelle; leere Felder zählen als 0 (`?32` ist 32, `32?` ist 320).
    Enter/Weiter überspringt eine leere Stelle, Rücktaste im leeren Feld geht
    zur vorherigen Stelle. Nach jeder geprüften Zeile geht der Fokus weiter,
    danach zum Gesamtergebnis oben. Die Eingabe beginnt automatisch links im
    ersten Feld der ersten Teilrechnung. Es wird immer die Zahleneingabe
    verwendet, unabhängig vom Multiple-Choice-/Adaptiv-Schalter. Eine Aufgabe
    zählt nach Eingabe des Gesamtergebnisses einmal für Statistik und Belohnungen;
    Teilrechnungen können vorher korrigiert werden. Lernstände werden getrennt
    nach Divisor und zwei-/dreistelligem Ergebnis gespeichert.
  Diese Modi nutzen die eingestellte Rundengröße und eigene Lernstände. Sie
  zählen für Tagesabschluss, Serie und Belohnungen und bleiben in Sicherungen
  erhalten. „Noch einmal“ wiederholt den gewählten Modus. Der gesamte Aufgabenpool
  ist unabhängig von der Reihenauswahl der gemischten Runden verfügbar;
  das Limit neuer Aufgaben gilt hier nicht.
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
  Eingabezeit abgezogen. Das gilt auch für Hunderter-Aufgaben und alle
  Zahlenrätsel. Diese nutzen ihre eigenen Lernstände: Hunderteraufgaben je
  Aufgabenfamilie und Rechenart, Zahlenrätsel je Rätseltyp. Die Umschaltung
  setzt Lernstufe 2 voraus, nicht nur eine bestimmte Gesamtzahl richtiger
  Antworten; sehr langsame Antworten erhöhen die Lernstufe nicht.
- Bei Textaufgaben bleiben zusammengehörige Rechnungen wie `40 ÷ 4` und
  Gleichungen in einer Zeile. Reicht der Platz hinter dem Text nicht aus,
  beginnt die Rechnung als Ganzes in der nächsten Zeile. Das gilt auch für
  die erklärenden Rückmeldungen und die Eingabe bei Textaufgaben.
- Optionale Lückenaufgaben (7 × ▢ = 56)
- Optionales Divisionstraining: Eltern können Division pro Profil aktivieren;
  zu einer Malaufgabe werden ab Lernstufe 4 die beiden passenden exakten
  Geteiltaufgaben freigeschaltet (z.B. 56 ÷ 7 und 56 ÷ 8). Multiplikation und
  Division behalten getrennte Lernstufen und Auswertungen, teilen sich aber
  Rundenumfang, neue Aufgaben und Belohnungsfortschritt. Sobald mindestens eine
  Geteiltaufgabe freigeschaltet ist, enthält jede neu gestartete Runde eine
  Divisionsaufgabe
- Belohnungen: Sticker pro geübtem Tag (zuerst noch nicht gesammelte, danach
  möglichst gleichmäßig verteilt und ohne direkte Wiederholung), Abzeichen für Serien-Meilensteine,
  Konfetti zum Abschluss einer Rechenrunde und Soundeffekte (abschaltbar).
  Beim Spielende oder erneuten Spielen erscheint kein Konfetti.
- Bereits gesammelte doppelte Sticker werden beim Laden oder Sicherungsimport
  durch noch fehlende Motive ersetzt; Anzahl und Sammeltage bleiben erhalten.
  Es gibt 80 verschiedene Motive; erst bei mehr als 80 Stickern sind
  Wiederholungen unvermeidbar.
- Laufende Rechenrunden können abgebrochen werden. Bereits beantwortete Aufgaben
  bleiben in Lernstand und Statistik, freigeschaltete Belohnungsspiele bleiben
  verfügbar. Ein Abbruch zählt nicht als Rundenabschluss für Sticker und Serie;
  die nächste Runde beginnt neu.
- Zwölf Lernbelohnungen zur Auswahl: Dino-Sprung, Flattervogel, Turmbauer,
  Gravity Run, Bricks, Cleo, Schneefahrt, Metro Run, Doodle Jump, 2048,
  Pac-Man und Asteroids. Die benötigte
  Anzahl richtiger Antworten pro Spiel ist im Eltern-Bereich konfigurierbar
  (Standard: 10); die Startseite zeigt, wie viele richtige Antworten bis zum
  nächsten Spiel fehlen. Bricks und 2048 enden nach höchstens fünf aktiven Minuten,
  die anderen Spiele nach drei;
  Pausen, Wartezeit vor Versuchen und ausgeblendete Ansichten zählen nicht mit.
  Drei Fehlversuche beenden das Spiel (Dino kann einen Bonusversuch sammeln).
  Beim Dino sorgen riskant platzierte Sterne, Combo-Multiplikatoren, fünf Sekunden
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
- Im Turmbauer folgt die Kamera dem wachsenden Turm: Rasen und Umgebung wandern
  nach unten aus dem Bild. Ab Etage 10 fliegen Vögel vorbei, ab 20 Flugzeuge
  mit „Mathe-Air“-Banner. Zwischen 20 und 30 geht der Himmel fließend in ein
  Sternenfeld über. Bei 30 erscheint ein Shuttle, bei 40 eine Raumstation;
  danach wechseln sich beide alle zehn Etagen ab. Animationen pausieren mit
  dem Spiel. Fehlversuche setzen weder Turmhöhe noch Umgebung zurück.
- Gravity Run: per Tipp zwischen Boden und Decke wechseln, Hindernissen ausweichen
  und Extras sammeln; Bricks: Ball und direkt per Finger/Maus steuerbarer Schläger,
  mehrere Steinbilder und Extras; Cleo: Regenbogenraupe mit umlaufenden Rändern,
  Richtungskreuz, Wischsteuerung und Bomben. Cleo gleitet flüssig zwischen den
  Rasterzellen; Richtungswechsel erfolgen erst am nächsten Zellpunkt, mit
  höchstens einem vorgemerkten Wechsel zusätzlich zur laufenden Bewegung.
  Schneefahrt: Snowboard-Runner mit
  Sprüngen, Saltos, Grinds, Boosts und Verfolger. Alle Spiele speichern Rekorde
  pro Profil und verbrauchen erst beim ersten Spielzug ein Kontingent.
- Die aktuelle App-Version steht dezent in Hellgrau unten auf der Startseite.
- Die Spieleauswahl nutzt die eingefärbten SVG-Icons aus dem Vocabulator.
- Vier weitere Spiele aus dem Vocabulator: Doodle Jump mit automatischen
  Sprüngen, schmaler werdenden beweglichen/brüchigen Plattformen und Federn;
  2048 mit animierten Zahlenverschmelzungen; Pac-Man mit wechselnden Labyrinthen,
  vier Geistern und acht Sekunden Kraftpunkten; Asteroids mit trägem Raumflug,
  automatischem Feuer und zerfallenden Asteroiden. Alle haben Touch-/Tastensteuerung,
  Pause, Vollbild und eigene Profilrekorde. Fehlversuche erhalten Welt und Punkte;
  bei blockiertem 2048 werden für den nächsten Versuch die zwei kleinsten Steine
  entfernt. Langes Halten der Bildschirmtasten löst keine Textauswahl aus.
  Doodle Jump steigert die Schwierigkeit nur mit aktiver Spielzeit und erreicht
  das Maximum frühestens nach 120 Sekunden. Plattformen werden von 84 auf 48
  Pixel schmaler, seitliche Abstände wachsen von 86–110 auf 102–136,
  Höhenabstände von 70–82 auf 94–106 Pixel. Die erreichte Höhe beschleunigt
  diesen Verlauf nicht. Brüchige Plattformen verschwinden nach dem Absprung und kehren nach
  vier aktiven Spielsekunden zurück. Pause und Wartezeit frieren diese Zeit ein;
  nach einem Fehlversuch startet die Figur nur auf einer intakten Plattform.
  Asteroids lässt sich direkt mit dem Finger im Spielfeld steuern: Halten und
  Bewegen richtet das Schiff zum Finger aus und gibt Schub. Die bisherige
  Bewegung bleibt durch Trägheit erhalten; beim Loslassen gleitet es weiter.
  Tastensteuerung und automatisches Feuer bleiben verfügbar.
- Metro Run: Perspektivischer Drei-Spuren-Runner mit Zügen und Schranken.
  Wischen, Pfeiltasten/WASD oder Bildschirmtasten zum Ausweichen, Springen und
  Rutschen; Tippen/Leertaste springt. Münzen geben je 20 Punkte, Schild schützt
  maximal 8 Sekunden bis zum ersten Treffer, Magnet sammelt 10 Sekunden lang.
  Drei aktive Minuten und drei Versuche, Fortsetzung erhält Strecke und Punkte;
  eigener Profilrekord und offline spielbarer Demo-Einstieg über `runner.html`.
- Während der Halloween-Saison (20.–31. Oktober) Dekoration aus dem Vocabulator in allen Spielen:
  Kürbisse, Spinnweben, Fledermäuse und Hexen; bei Metro Run zusätzlich lustige
  Straßenschilder, tanzende Skelette und Geisterballons. Rein gezeichnete Deko
  ohne zusätzliche Hindernisse oder Änderungen der Trefferflächen.
  Die Spielwelten nutzen dunkle Dämmerungs-/Nachtpaletten, Mondlicht, Nebel
  und gelegentliche langsam verblassende Blitze im Hintergrund statt Sonne.
  Keine bildschirmfüllenden Lichtblitze; bei reduzierter Bewegung bleiben
  diese Wettereffekte statisch und die Blitze aus. Cleo sammelt leuchtend
  orange Kürbisse statt Obst; Bomben behalten eine deutlich helle Kontur.
- Schneefahrt: Die Kamera folgt vorausschauend dem Gelände am rechten Bildschirmrand
  und hält tiefe Stellen im sichtbaren Abschnitt frühzeitig im Bild.
  Jeder erfolgreich gelandete Backflip bringt +20 Prozentpunkte
  Tempo (Doppelsalto +40), maximal 200 % des aktuellen Grundtempos. Pro voller
  aktiver Sekunde sinkt es um einen Prozentpunkt bis mindestens 100 %;
  Pause und Warten zählen nicht. Der Prozentwert steht im Spielfeld. Ab
  150 % zertrümmert die Figur Steine bei Kontakt. Für eine aktive Sekunde nach
  einer Landung gilt das auch bei niedrigerem Tempo. Sprungimpuls, Rampen und
  Schwerkraft skalieren gemeinsam: bis 50 % mehr Sprunghöhe bei ähnlicher
  Flugzeit. Gelände wird bei hohem Tempo weiter voraus erzeugt. Eis beschleunigt
  auf mindestens 150 % und nutzt dieselbe Begrenzung/Abklingregel statt eines
  zusätzlichen, unbegrenzten Tempoaufschlags.
  Das Grundtempo bleibt konstant bei 286 Pixeln/Sekunde (+30 %), ohne zeitabhängigen
  Anstieg. Der Verfolger startet mit dem dann aktuellen Fahrtempo plus
  16 Pixeln/Sekunde und behält dieses Tempo während der Verfolgung bei.
- Bricks steigert das Grundtempo mit jedem Level um 25 % gegenüber dem
  vorherigen Level. Ab Level 3 wechseln Treppe, Raute, Doppeltürme, Schachbrett,
  Festung und Wellen; spätere Felder haben robustere Steine und ab Level 5
  sanft bewegte Reihen. Tempo-Extras wirken zusätzlich und bleiben beim
  Levelwechsel erhalten. Drei Fehlversuche beenden das Spiel weiterhin früher.
- Löcher bei Gravity Run sind schwarz mit weißen Kanten, gelb-schwarzen
  Warnmarkierungen und „LÜCKE“ beschriftet – an Boden und Decke. Während
  Superman zeigt eine cyanfarbene Linie die vorübergehend sichere Brücke.
- Helle App-Oberfläche aus dem Vocabulator mit SVG-Symbolen und den Bereichen
  Lernen, Spiele und Statistik: unten eine Tab-Leiste, auf breiten Ansichten
  eine Seitenleiste. Lernrunden blenden die Navigation aus; Spiele öffnen
  bildschirmfüllend mit Pause- und optionaler Browser-Vollbildtaste. Safe Areas,
  Hoch-/Querformat und verfügbare Fensterhöhe werden berücksichtigt.
- Statistik zeigt beantwortete Aufgaben heute, letzte sieben Tage und insgesamt
  sowie gespielte Spiele. Die Spielzählung beginnt ab diesem Update mit sichtbarem
  Startdatum; alte Rekorde und unverbrauchte Kontingente bleiben erhalten.
  Sticker und Erfolge sind über den Statistikbereich erreichbar.
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
sudo cp index.html styles.css app.js arcade-extra.js icons.svg flappy.html tower.html gravity.html brick.html snake.html snow.html runner.html doodle.html tiles.html maze.html asteroid.html manifest.json sw.js icon-192.png icon-512.png /var/www/html/
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
