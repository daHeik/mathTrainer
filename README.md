# mathTrainer – 1×1 Trainer (mathServer)

| Projektinformationen | Stand |
| --- | --- |
| Projektablage | `/Users/heik/Dev/repos/mathServer` |
| Version | Basis `9277d57` mit lokalen Änderungen einschließlich Chicken Shooter mit schnellerem Flugtempo und besonderen Hühnern an Teich und Ställen; PWA-Cache `1x1-trainer-v62`, keine separate semantische App-Version |
| Letzte Quellcodeänderung | 2026-11-08 |
| Letzte Projekt-/README-Änderung | 2026-11-08 |
| HTML-Anleitung | [mathTrainer-Dokumentation.html](../manuals/mathTrainer-Dokumentation.html) |

## TL;DR – so funktioniert mathTrainer

mathTrainer übt Multiplikation, Division, römische Zahlen und weitere Rechenwege. Ein Lernplan pro Kind legt fest, welche Themen angeboten werden; anpassbare Vorschläge für Klasse 4 und 5 erleichtern die Auswahl. Aufgaben werden nach bisheriger Sicherheit wiederholt; richtige Antworten verdienen Spiele. Mehrere Profile haben eigene Lernstände, Avatare, Statistiken und Rekorde. Die App läuft vollständig im Browser als statische PWA: HTML, CSS und JavaScript ohne Backend, Datenbankdienst oder JavaScript-Buildsystem.

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
Anwendungs- und Spiellogik in `app.js`, `arcade-extra.js` sowie `frog-punch.js` und `chicken-shooter.js`. `flappy.html`, `tower.html`,
`gravity.html`, `brick.html`, `snake.html`, `snow.html`, `runner.html`,
`doodle.html`, `tiles.html`, `maze.html`, `asteroid.html`, `frog.html` und `chicken.html` sind
kleine Direktstarter, die dieselben integrierten Spiele ohne Lernbelohnung
öffnen. Dadurch gibt es keine doppelte Spiellogik.

## Anleitung – erste Runde, Elternbereich und Sicherung

1. Im Projektordner `python3 -m http.server 8080` starten und `http://localhost:8080/index.html` öffnen. Die App braucht für normalen Betrieb einen Webserver; `file://` prüft die PWA nicht vollständig.
2. Namen und Avatar wählen, danach auf der Startseite Lernmodus oder gemischte 1×1-Runde starten. Die zusätzlichen Modi erklären ihre Rechenwege; die Lernantworten verwenden Auswahl, Eingabe oder den eingestellten adaptiven Modus.
3. Nach falschen Antworten bleibt die Lösung bis zum nächsten Tippen/Klicken stehen. Bei richtigen Antworten automatisch warten oder durch Tippen/Klicken sofort weitergehen. Beantwortete Aufgaben und Belohnungen werden lokal gespeichert. Abbrechen verwirft nicht den bereits verdienten Fortschritt.
4. Über „Admin“ den Elternbereich öffnen. Der initiale Code `6969` lässt sich dort ändern. Unter „Lernen“ zuerst den Lernplan für das aktive Kind wählen: Vorschlag Klasse 4/5 oder einzelne Themen-Häkchen. Rundengröße, römischen Zahlenbereich und Belohnungsintervall anpassen und speichern. Weitere Zahlenreihen-/Eingabeoptionen sind eingeklappt. Name und Avatar bleiben frei bearbeitbar; der Wechsel zu einem anderen Kind braucht die Eltern-PIN.
5. Im Statistikbereich Tages-/Wochenwerte und Lernstände prüfen. Vor Browserwechsel oder Löschen lokaler Daten im Elternbereich eine JSON-Sicherung exportieren. Import ersetzt den geprüften lokalen Bestand; vorherige Sicherung behalten.
6. Verdiente Spiele in „Spiele“ auswählen. Erst die erste Spielaktion verbraucht ein Kontingent. Pause und ausgeblendete Ansichten verbrauchen keine aktive Spielzeit.

Normale Spiele laufen bis zu drei aktive Minuten pro Kontingent; **Bricks und 2048 bis zu fünf Minuten**. Diese Ausnahme ist in `gameDurationMs()` implementiert. Beim Zeitende endet der Durchlauf; mit weiterem Kontingent kann ein neues Belohnungsspiel gestartet werden. Drei verbrauchte Versuche beenden früher; **2048 bietet nur einen Versuch pro Kontingent** und endet bei einem vollständig belegten Feld ohne mögliche Verschmelzung. **Chicken Shooter bietet eine Runde mit 90 aktiven Sekunden pro Kontingent**. **Frog Punch hat stattdessen drei vollständige Runden à 40 Sekunden pro Kontingent**; verpasste Frösche kosten keine Versuche. Demo-Starter wie `snow.html` öffnen dieselbe Spielimplementierung ohne Lernbelohnung.

## Lernplan pro Kind – einfache Auswahl statt Ausweichen auf leichte Aufgaben

Der Elternbereich öffnet direkt den Reiter **Lernen**. Jedes Profil hat seinen eigenen Lernplan. Für die beiden Kinder jeweils ein Profil anlegen, das gewünschte Kind aktivieren und seinen Plan speichern. Namen und Avatar weiterhin über das Profil-Symbol gestalten. Zum Wechsel auf ein anderes Profil die Eltern-PIN eingeben; falsche PIN oder Abbruch ändern das aktive Kind nicht. Damit ist auch der Wechsel in das leichtere Geschwisterprofil über die normale Oberfläche geschützt.

1. Unter **Admin → Lernen** einen Ausgangspunkt antippen: **Vorschlag Klasse 4**, **Vorschlag Klasse 5** oder **Alle Themen**.
2. Bei Bedarf einzelne Themen an-/abwählen. Die drei halbschriftlichen Stufen haben eigene Häkchen. Mindestens ein Thema muss ausgewählt bleiben.
3. Für römische Zahlen einen Bereich zwischen 1 und 3999 festlegen, etwa 1–100, 1–1000 oder 100–3999. Beide Richtungen bleiben aktiv.
4. Aufgaben pro Runde und richtige Antworten pro Spiel einstellen. „Aufgaben pro Runde“ bestimmt die Rundengröße; weitere Runden sind möglich. Der interne Speichername `tasksPerDay` bleibt für alte Sicherungen erhalten.
5. **Änderungen speichern**. Erst jetzt wird der Plan aktiv; die laufende Aufgabenliste wird neu aufgebaut. Lernstände, Statistik und bereits verdiente Spiele bleiben erhalten.

| Vorschlag | Freigegebene Themen |
| --- | --- |
| Klasse 4 | Alle Themen außer halbschriftlicher Division mit selbst eingetragenen Anteilen und mit Rest; römischer Zahlenbereich 1–1000 |
| Klasse 5 | Punkt vor Strich, schriftliche Division, halbschriftliche Division mit selbst eingetragenen Anteilen/mit Rest, Division mit Rest, römische Zahlen; römischer Zahlenbereich 100–3999 |
| Alle Themen | Alle zwölf Themen; römischer Zahlenbereich 1–3999 |

Diese Vorschläge sind **keine vollständigen Klassenlehrpläne**. Sie wählen aus den vorhandenen Aufgabenfamilien aus. Insbesondere bleiben schriftliche und halbschriftliche Aufgaben dreistellig; Bruchrechnung, Dezimalzahlen und weitere Klasse-5-Themen werden dadurch nicht ergänzt. Die Vorschläge ändern außer Themen und römischem Zahlenbereich keine bisherigen Detaileinstellungen. Passe die Auswahl an den tatsächlichen Unterricht an.

Nur aktive Themen erscheinen auf der Startseite. Ist gemischtes 1×1 ausgeschaltet, verschwindet auch dessen Startbereich. Ausgeschaltete Themen lassen sich nicht über verbliebene Schaltflächen oder Wiederholungen starten. Der Zahlenreihen-Dialog und jede halbschriftliche Stufe beachten denselben Plan. Die weiterhin freigegebenen Aufgaben verdienen wie bisher Spiele; es gibt keine zweite Belohnungswährung und keine nachträgliche Aberkennung.

**Weitere Einstellungen** enthalten Zahlenbereich/aktive Reihen, neue Aufgaben, schrittweises Freischalten, Antwortmodus, normale Division, Lückenaufgaben, Sound und Akzentfarbe. Die alten Zahlenfilter betreffen weiterhin nur ihre jeweiligen Rechenfamilien; ein Klasse-5-Vorschlag macht aus einer bestehenden Aufgabe keine größere Aufgabe. Alte Profile ohne Plan behalten alle bisherigen Themen und erhalten zusätzlich römische Zahlen. Ein Import mit ausdrücklich leerer/ungültiger Themenliste fällt auf römische Zahlen zurück, damit eine spielbare Aufgabe bleibt und nicht ungewollt einfache Reihen geöffnet werden.

Die PIN ist eine lokale Bedienungssperre. Browserdaten lassen sich technisch verändern; ein gemeinsames Gerät erkennt nicht selbst, welches Kind davor sitzt. Eltern sollten das passende Profil aktivieren. Demo-Spielstarter funktionieren weiterhin ohne Lernkontingent; der Lernplan schränkt die reguläre Lern- und Belohnungsoberfläche ein und ist keine Gerätesperre.

## Römische Zahlen – beide Richtungen und Lösung nach Stellenwerten

Unter **Gezielt üben → Römische Zahlen** werden Zahlen aus dem eingestellten Bereich 1–3999 zufällig gewählt. Jede Runde ab zwei Aufgaben enthält beide Richtungen. Bei Rundengröße eins wird eine der Richtungen gewählt. Die Aufgabenstellung zeigt nur die umzuwandelnde Zahl mit `= ?`, beispielsweise `2026 = ?` oder `MMXXVI = ?`. Keine zusätzliche Richtungsangabe ist nötig: Die angebotenen Zeichen zeigen, welche Darstellung gefragt ist.

- Gesucht ist eine römische Zahl: kompakte Tasten **I, V, X, L, C, D, M**, Löschen und „Antwort prüfen“.
- Gesucht ist eine Zahl in Dezimalschreibweise: kompakte Tasten **0–9**, Löschen und „Antwort prüfen“.
- Alternativ im Eingabefeld mit der Tastatur schreiben. Kleinbuchstaben werden großgeschrieben, fremde Zeichen entfernt. Die Eingabe wird erst beim Prüfen gezählt; eine leere Eingabe zählt nicht. Führende Nullen bei Dezimalzahlen sind erlaubt.

**Cursor und Markierung:** Die app-eigenen Zeichen-/Zifferntasten fügen an der aktuellen Cursorposition ein. Markierter Text wird ersetzt. Die Löschtaste entfernt die Markierung oder das Zeichen direkt vor dem Cursor; am Textanfang bleibt die Eingabe unverändert. Das gilt in beiden Richtungen der römischen Zahlen und auch für den app-eigenen Ziffernblock bei Division mit Rest. Beispiel: Cursor zwischen `MM` und `VI`, dann `X` ergibt `MMXVI`. Die vorhandenen Eingabelimits bleiben bestehen; auch bei erreichter Maximallänge lässt sich eine Markierung ersetzen.

`editKeypadValue()` verwendet bei den zugehörigen Textfeldern `selectionStart`/`selectionEnd`, ändert nur den betroffenen Bereich und setzt den Cursor unmittelbar hinter die eingefügten Zeichen. Ein Pointerdown auf den Zeichentasten verhindert den Fokuswechsel zum Button, sodass die Auswahl beim Tippen erhalten bleibt. Die römische Eingabebereinigung schreibt unveränderte Werte nicht neu und übernimmt bei Großschreibung/Zeichenfilterung die entsprechend angepasste Auswahlposition. Die Tastatur setzt damit keine zusätzliche Prüfung oder Belohnung in Gang. Nach Abgabe/Abbruch bleiben die bisherigen Eingabesicherungen wirksam.

Die Umrechnung verwendet die übliche Schreibweise mit Subtraktionspaaren **IV, IX, XL, XC, CD, CM**. Beispielsweise ist für 4 `IV` richtig; `IIII` wird als falsche Antwort behandelt. Der Bereich endet bei 3999, damit keine Überstriche oder zusätzlichen Zeichen nötig sind. Für null gibt es hier keine römische Darstellung.

Die Rückmeldung zeigt den vollständigen Zusammenhang und die einzelnen **Stellenwerte**. Für 2026 beispielsweise:

| Stellenwert | Römisch |
| --- | --- |
| 2000 | MM |
| 20 | XX |
| 6 | VI |

In Gegenrichtung erscheint dieselbe Zerlegung als `MM = 2000; XX = 20; VI = 6`, anschließend `MMXXVI = 2026`. Nullstellen werden ausgelassen, etwa bei 2006 nur `2000 = MM; 6 = VI`. Die Lösung wird insbesondere nach Fehlern angezeigt; dann bleibt sie bis zum üblichen Weitertippen sichtbar. Richtige Antworten zeigen die Zerlegung ebenfalls kurz. Falsche Aufgaben werden nach den bestehenden Regeln höchstens zweimal erneut eingereiht. Vollständige richtige Antworten zählen für Lernstand, Statistik und Belohnung.

## Technischer Deep-Dive – Lernplan und römische Zahlen

Alles bleibt in `app.js`, `index.html` und `styles.css`; keine neue Laufzeitabhängigkeit oder externe Schnittstelle. `SESSION_MODES` enthält zwölf Modi einschließlich `roman`. `config.allowedModes` speichert eine validierte Liste dieser IDs pro Profil; `normalizedModes()` entfernt unbekannte Werte und Duplikate. Fehlt das Feld in alten Daten, werden alle Modi zugelassen. Eine explizit ungültige Liste erhält `['roman']`. `modeAllowed()` ist die gemeinsame Prüfung für Startseite, Übungsauswahl, Queue-Pool und Sitzungsstart; `onAnswer()` prüft ebenfalls den aktuellen Modus. `refreshDailySessionIfNeeded()` verwirft eine inzwischen gesperrte laufende Queue und erzeugt eine im ersten erlaubten Modus, auch beim Tageswechsel. Speichern und Abbrechen verwenden denselben erlaubten Standardmodus. Ausgeschaltete Lernstände bleiben gespeichert und zählen weiterhin zu historischen Belohnungssummen.

Die Lernplan-Häkchen und Vorschlagsknöpfe bearbeiten nur einen Entwurf. Der Speichern-Handler verlangt mindestens ein Thema, begrenzt `romanMin`/`romanMax` auf 1–3999 und baut die Runde neu auf. Bei vertauschtem Bereich wird die Obergrenze auf die Untergrenze angehoben. Wie bestehende Einstellungen gelten Änderungen erst nach Speichern. Der Profilwechsel über `openProfileOverlay()` öffnet `openPinPrompt(callback)`; nur erfolgreiche Prüfung führt den Wechsel aus, Schließen verwirft den Callback. Der normale Admin-Aufruf nutzt denselben Dialog ohne Callback.

`toRoman(number)` wandelt Ganzzahlen 1–3999 mittels absteigender Wert-/Zeichenpaare einschließlich Subtraktionspaaren um, ohne `eval`. `romanQuestion(direction)` zieht gleichverteilt aus dem konfigurierten Bereich und erstellt die Stellenwertzerlegung aus den von null verschiedenen Dezimalziffern. `renderRomanQuestion()` baut das Eingabeformular mit DOM-APIs auf; Zeichen und Länge sind begrenzt (maximal 15 römische Zeichen oder vier Dezimalziffern). Antworten werden kanonisch verglichen; mathematisch interpretierbare, aber unübliche römische Schreibweisen gelten nicht als richtig. Die normalen Auswahl-/Adaptiv-Einstellungen werden für diesen Modus bewusst durch die gewünschte Zeicheneingabe ersetzt.

Die zwei Richtungen verwenden getrennte Wiederholungsstände `profile.romanSkills.toRoman` und `.toArabic` mit IDs `roman:toRoman`/`roman:toArabic`. Es gibt keine Einzelaufzeichnung für jede Zahl. Beide Richtungen gehören ab zwei Aufgaben in jede neue Runde; wiederholte IDs erzeugen neue Zufallszahlen. `practiceSkill()`, `buildQueue()`, `applyAnswerResult()`, `correctAnswersForProfile()` und `onAnswer()` binden die Familie in bestehende Wiederholung, Serien, Belohnungen und Statistik ein. `history[date].byOperation.roman` enthält ihre Tageswerte. Normalisierung ergänzt fehlende Richtungsstände und Historienwerte, Sicherungen enthalten Plan, Zahlenbereich und Lernstände unter dem bestehenden Root-Key. Laufende Formulare sind mit `sessionRevision` und `answering` gegen doppelte oder nach Abbruch verspätete Abgabe geschützt.

Die erweiterten Integrationstests prüfen alle Umrechnungen 1–3999 mit unabhängiger Rückrechnung, Subtraktionsschreibweisen, beide Tastensätze, genaue Stellenwertlösungen, Retry-/Belohnungs-/Backupverhalten, Vorschlagsentwürfe/Speichern, leere Pläne, gesperrte Themen, Tageswechsel sowie richtige/falsche/abgebrochene Profil-PIN. Der DOM-Test ersetzt keine echte iPhone-Prüfung.

## Rückmeldungen und native iPhone-Tastatur

**Falsche Antwort:** Die Lösung bleibt ohne Zeitlimit stehen. Ein neues Tippen oder Klicken irgendwo im Aufgabenbildschirm zeigt die nächste Aufgabe. Es gibt keine bisherige Mindestwartezeit von 1,2 Sekunden mehr. Der Antwort-Klick selbst schließt die Rückmeldung nicht. Zurück- und Eltern-/Dialogbedienelemente behalten ihre normale Funktion.

**Richtige Antwort:** Die App wechselt wie bisher nach kurzer Zeit automatisch weiter (normal 1,4 Sekunden, bei neu gemeisterten Aufgaben 2,4 Sekunden und bei zusätzlicher Erklärung 4,5 Sekunden). Durch Tippen/Klicken kann die Wartezeit sofort übersprungen werden. Das gilt auch nach der letzten Antwort für den Wechsel zum Rundenabschluss. Nur vollständige abgegebene Antworten zählen; korrigierbare Zwischenfehler in schriftlichen/halbschriftlichen Rechenwegen bleiben im jeweiligen Arbeitsschritt.

`onAnswer()` setzt nach der Bewertung die gemeinsame Weiter-Bereitschaft `awaitTap`. Nur richtige Antworten erhalten einen Timer. `tapAdvance()` verarbeitet Klicks und Touchstart in der Capture-Phase, also vor dem Antwort-Handler eines Buttons. Dadurch zählt die ursprüngliche Antwortgeste nicht gleichzeitig als Weiter-Geste. Ein zum Weitergehen verwendetes Touchereignis wird unterdrückt, damit sein synthetischer Folge-Klick nicht versehentlich eine Antwort der nächsten Aufgabe auswählt. Ein zusätzliches `answerFeedbackToken` wird beim Rendern einer Aufgabe ungültig: Ein übersprungener alter Timer kann weder eine neue Zufallsaufgabe erzeugen noch eine spätere Fehlerlösung schließen. `sessionRevision` schützt weiterhin vor Callbacks nach Abbruch/Neustart.

### Halbschriftliche Division – Fertig, Rechenweg und Ergebnisstellen

Alle drei Stufen verwenden die native Zahlentastatur mit Eingabetaste und der angeforderten Beschriftung **„Fertig“**. Die Taste springt zuerst zum noch leeren, bearbeitbaren Feld des aktuellen Schritts. Beispiel: Nach Eingabe von `400` in `400 : 8 = …` fokussiert „Fertig“ das Teilergebnis für `50`, ohne die Aufgabe zu bewerten. Erst wenn beide Felder ausgefüllt sind, wird die Teilrechnung geprüft. Das gilt auch für Summe und Rest: Eine eingetragene Summe führt zuerst ins noch leere Restfeld; `0` gilt als ausgefüllter Rest.

Der Prüfknopf und die Enter-Taste auf Desktop-Tastaturen verwenden dieselbe Logik. Eine korrekte Teilrechnung fokussiert die nächste Eingabe. Leere Felder werden nicht als Fehler gewertet, fachlich falsche Zwischenangaben bleiben korrigierbar. Nach Bestätigung der Gesamtsumme einschließlich gegebenenfalls Rest ist die Aufgabe abgeschlossen und zählt genau einmal für Statistik und Belohnungen. **Es gibt keine abschließende Gegenrechnung oder Probe mehr.** Falsche Gesamtergebnisse verwenden weiterhin die normalen Fehler-/Wiederholungsregeln.

`renderSemiDivision()` nutzt `type="number"` mit `enterkeyhint="done"`, ohne `inputmode="numeric"` oder Ziffern-`pattern`. Diese bisherigen Hinweise würden auf iOS das reine Ziffernpad ohne Eingabetaste auswählen; die Unterscheidung ist in den [WebKit-Keyboardtests](https://github.com/WebKit/WebKit/blob/main/Tools/TestWebKitAPI/Tests/ios/KeyboardInputTestsIOS.mm) belegt. Beschriftung und Farbe bestimmt das Betriebssystem. Enter unterdrückt die implizite Browser-Abgabe und führt den gemeinsamen Formular-Handler aus. Gedrückthalten und laufende Texteingabe-Komposition lösen keine doppelte Prüfung aus. `form.noValidate` hält die fachliche JavaScript-Validierung maßgeblich. Ziffernfolgen sind auf drei Stellen begrenzt; Dezimal-, Exponential- und negative Schreibweisen werden bei der Prüfung abgewiesen. Kein `setSelectionRange()` auf Zahlenfeldern; Desktop-Zahlenschalter bleiben ausgeblendet. `sessionRevision`/`answering` schützen vor verspäteten und doppelten Abgaben.

### Rechnen untereinander und fortlaufende Ergebnisanzeige

Die ursprüngliche Division steht oben im Rechenweg, darunter folgen bestätigte Teilrechnungen in ausgerichteten Zeilen. Nach einer Trennlinie erscheint die nächste noch zu teilende Zahl deutlich hervorgehoben. Zusätzlich benennt die Eingabeseite den aktuellen Schritt, beispielsweise **„Schritt 2: 32 weiter aufteilen“**. Das bisherige alleinstehende „Noch aufzuteilen“ entfällt.

```text
432 : 8 = _ 5 _
400 : 8 = 50
---------------
 32 : 8 = ?       Jetzt weiterteilen
```

Oben sind von Anfang an drei Stellen für **Hunderter / Zehner / Einer** sichtbar: `_ _ _`. Nach `400 : 8 = 50` werden daraus `_ 5 _`; nach weiteren `32 : 8 = 4` steht dort `_ 5 4`. Die Anzeige ist als **„Bisher errechnet“** beschriftet und zeigt die Summe der bestätigten Teilergebnisse. Diese Summe ist vorläufig: Beim vorgeschriebenen Weg für `276 : 4` ergeben `200 : 4 = 50` und `60 : 4 = 15` nacheinander `_ 5 _` und `_ 6 5`. Bereits angezeigte Ziffern können sich durch das Addieren also noch ändern.

Während noch weiter geteilt wird, bleiben Nullstellen als Platzhalter leer. Sobald alle teilbaren Anteile verteilt sind, werden echte Nullziffern des Ergebnisses sichtbar: Bei `848 : 8` nach `800 : 8 = 100` zunächst `1 _ _`, nach `40 : 8 = 5` zunächst `1 _ 5` und nach `8 : 8 = 1` schließlich `1 0 6`. Führende Nullen werden nie ergänzt; bei 54 bleibt die Hunderterstelle leer. Bei Restaufgaben gilt der teilbare Anteil bereits als verteilt, sobald der verbleibende Betrag kleiner als der Divisor ist. Ein Rest erscheint dann als **„Rest: …“**, nicht als weitere Division; bei null wird keine unnötige `0 : … = ?`-Zeile erzeugt.

`equation()` erzeugt Zeilen mit denselben fünf CSS-Spalten für Dividend, Doppelpunkt, Divisor, Gleichheitszeichen und Ergebnis. `showRemaining()` aktualisiert die hervorgehobene Folgezeile und die drei Ergebnisstellen aus `quotients`, `remaining` und `phase`. Diese Darstellung ändert keine Aufgabenwerte und keine gespeicherten Lernstände. Der Ablauf hat nur die Phasen `parts` und `total`; die frühere `proof`-Phase und ihr Formularfeld sind entfernt. Auch bisherige Sicherungen mit normalen Semi-Lernständen bleiben verwendbar, da keine neuen Speicherkeys nötig sind.

### Große Stellenwertanteile mit Abkürzung

Die Teilbeträge bleiben an Stellenwerte gebunden: Erlaubt sind jeweils der **größte ohne Rest teilbare Hunderteranteil** und der **größte teilbare Zehneranteil**. Dadurch dürfen Hunderter mit passenden Zehnern zusammengefasst werden: Bei `843 : 3` sind sowohl `600 : 3` als auch direkt `840 : 3` erlaubt, weil 84 durch 3 teilbar ist. Erst wenn weder ein Hunderter- noch ein Zehneranteil möglich ist, folgt der Eineranteil. Der Divisor bleibt unverändert.

```text
843 : 3 = _ _ _
600 : 3 = 200
---------------
243 : 3 = ?
240 : 3 = 80
---------------
  3 : 3 = 1
Ergebnis: 281
```

Für `432 : 8` bleibt der Weg `400 : 8 = 50`, danach `32 : 8 = 4`: Von 32 lässt sich weder ein Hunderter- noch ein voller Zehneranteil durch 8 teilen. Bei `864 : 8` sind der Weg `800`, `40`, `24` und die Abkürzung `840`, `24` erlaubt. Beliebige kleinere Teilstücke bleiben ausgeschlossen: Bei `843 : 3` werden etwa 300, 30 und 3 als erster Teil abgewiesen, ebenso die vorzeitige Einer-Abkürzung 843. „Selbst aufteilen“ lässt zwischen den passenden großen Anteilen wählen; „Mit Hilfe“ gibt weiterhin den Hunderterweg vor. Bei „Mit Rest“ endet das Teilen, sobald weniger als der Divisor übrig ist.

`semiAllowedParts()` sucht für die Stellen 100 und 10 jeweils absteigend den größten genau teilbaren Betrag bis zum verbleibenden Dividenden und entfernt doppelte Werte. Nur wenn beide fehlen, wird der größte teilbare Eineranteil zugelassen. `semiSuggestedPart()` liefert den ersten, gröberen Vorschlag für die Hilfestufe. `checkSemiPart()` akzeptiert jeden dieser großen Anteile mit richtigem Teilquotienten. Ein abweichender Betrag erzeugt einen korrigierbaren Hinweis auf die erlaubten Anteile; er schreibt keinen endgültigen Lernfehler und verändert die Ergebnisstellen nicht. Einführung, Tipp, Schrittüberschrift und Eltern-Themenbezeichnung verwenden denselben Ablauf. Die gespeicherten Modus-IDs `semi`, `semiFree`, `semiRest` und die bisherigen Lernstände bleiben erhalten.

### iPad im Querformat – Rechenweg und Eingabe nebeneinander

Ab 760 Pixeln Breite im Querformat stehen links die Originalaufgabe mit Ergebnisstellen, die bestätigten Teilrechnungen und der nächste offene Teil untereinander. Rechts bleiben Schrittüberschrift, aktuelle Zahlenfelder und Prüf-/Tippknöpfe sichtbar. In der Ergebnisphase stehen Summe und Rest nebeneinander. Die Aufteilung gilt für alle drei Stufen bereits vor dem Öffnen der Tastatur.

Die Tabletansicht spart Außenabstände und leere Hinweise, behält aber mindestens **48 Pixel hohe Eingabefelder und Knöpfe**. Nur sehr lange Listen erledigter Teilrechnungen scrollen separat; Originalaufgabe und aktive Folgezeile bleiben außerhalb dieser Liste sichtbar. Die Liste bleibt benannt, fokussierbar und vollständig erhalten; ihre Höhe richtet sich nach `--app-height`, also dem sichtbaren Bereich oberhalb der Tastatur. Auf schmalen Geräten und im Hochformat stehen die Bereiche untereinander. Bei außergewöhnlich kleiner Höhe oder großer Schrift bleibt die ganze Ansicht scrollbar, statt Inhalte abzuschneiden oder Schrift zu verkleinern. Die Fertig-Taste ist unabhängig vom Layout nutzbar.

Zur Sichtprüfung `http://localhost:8080/tests/layout-preview.html?layout=tablet` öffnen: Die Rahmen mit **1024 × 400** und **1194 × 470** Pixeln bilden begrenzte sichtbare Bereiche nach, keine native iPad-Tastatur. In Safari wurde der neue Ablauf mit vorhandenen Testdaten geprüft: Eingabe eines Teildividenden, Enter-Wechsel ins leere Teilergebnis, aktualisierte Ergebnisstellen, hervorgehobene Folgezeile sowie Abschluss nach der Summe ohne Probe. Die Integrationstests sichern zusätzlich das Beispiel `432 : 8`, alle drei Stufen, fehlende Felder, Nullrest, vorgeschriebene Stellenwertfolgen mit wechselnden Teilsummen, echte Nullziffern und einmalige Belohnungen ab. Der physische iPad-/iPhone-Tastaturtest bleibt davon getrennt.

### Sichtbarer Aufgabenbereich über der Tastatur

Bei halbschriftlicher Division öffnet das Eingabefeld die native Zahlentastatur. Auf der installierten iPhone-App kann iOS den sichtbaren Bereich dabei nicht nur verkleinern, sondern auch nach oben oder unten verschieben. Zuvor übernahm die Lernansicht nur `visualViewport.height`; eine zusätzliche Verschiebung konnte oberhalb der Tastatur eine freie graue Fläche hinterlassen. Die Lernansicht berücksichtigt nun auch `visualViewport.offsetTop`.

Solange eine native Eingabe in `screen-question` aktiv ist und nicht gezoomt wird, setzt `updateViewport()` die Klasse `learning-input-viewport`, `--app-height` auf die sichtbare Höhe und `--app-top` auf deren oberen Versatz. CSS verankert die App-Hülle währenddessen per `position:fixed` an diesem sichtbaren Rechteck. `keepLearningInputVisible()` scrollt ausschließlich den Aufgabenbereich und nur so weit, dass das aktive Feld mit 12 Pixeln Rand sichtbar ist. Das gilt für alle drei halbschriftlichen Stufen ebenso wie für andere native Lernfelder. Dialoge behalten ihre separate Höhen-/Positionsbehandlung.

Bei Fokusverlust oder Verlassen der Lernansicht werden Position und Eingabehöhe zurückgenommen; installierte Apps nutzen dann weiterhin `100vh`, Browseransichten `100dvh`. Ein Bildschirmwechsel stößt die Aktualisierung ausdrücklich an, auch wenn das Fokusereignis später eintrifft. Pinch-Zoom bleibt erhalten; bei verändertem Zoomfaktor greift die Positionskorrektur nicht ein. Ohne VisualViewport-API gelten die normalen CSS-Höhen. Identische gerundete Messwerte verursachen weiterhin keine wiederholten CSS-/Scroll-Schreibzugriffe.

Die Lernmodustests simulieren die installierte App mit sichtbarer Höhe und versetztem Tastaturbereich, prüfen alle halbschriftlichen Stufen, minimale Scrollkorrekturen, ruhige Eingabe, Zoom sowie Zurücksetzen beim Schließen/Verlassen. Zusätzliche Tests sichern manuelles/automatisches Weitergehen und veraltete Timer ab. Die Fehlerlösung wurde in Safari am Desktop geprüft; eine native iPhone-Tastatur lässt sich damit nicht nachweisen. Der ursprüngliche graue Bereich ist auf dem physischen iPhone noch nachzuprüfen. Änderungen sind lokal vorbereitet, nicht automatisch veröffentlicht.

## Technischer Deep-Dive – Sprache, Aufbau und Kommunikation

Die App besteht aus `index.html` (Ansichten/Formulare), `styles.css` (Layout), `icons.svg` (lokale Symbole), `app.js` (Lern-, Profil- und ursprüngliche Spiellogik) sowie `arcade-extra.js` (vier zusätzliche Spiele) und `frog-punch.js` (Frog-Punch-Zustand, Zeitsteuerung und Bestenlisten-Normalisierung). `manifest.json` enthält Installationsmetadaten, `sw.js` den Service Worker. Direkte Spiel-HTMLs starten den gemeinsamen Code im Demo-Modus, statt Spiellogik zu duplizieren.

```text
Statischer Webserver → HTML/CSS/JavaScript → Browser-DOM und Canvas
                                           ↕ localStorage (Profile/Fortschritt)
                                           ↕ Service Worker / Cache Storage (Appdateien)
```

Es gibt keine Anwendungs-REST-API, keine WebSockets und keine Gerätesynchronisierung. Der Browser lädt Dateien über HTTP(S), kann auf die System-Sprachfunktionen zugreifen und erzeugt Backupdateien lokal. iPhone, iPad und Desktop haben getrennte Stände, selbst wenn dasselbe Profil benannt wird. Ein Geräteabgleich wie beim Vocabulator ist hier nicht implementiert. Node dient nur den Tests, Python nur einem möglichen lokalen statischen Server.

Die JavaScript-Struktur verwendet überwiegend `var` und Funktionen, ergänzt um moderne Browser-APIs. DOM-Daten werden möglichst über `textContent` gesetzt. Neue Funktionen sollen ohne Paketmanager lauffähig bleiben. Ein großer Teil des Codes liegt bewusst in `app.js`; für einen Einstieg nach Funktionsnamen wie `normalizeProfile`, `buildQueue`, `onAnswer`, `gameDurationMs` oder nach den unten genannten Speicherpräfixen suchen.

## Technischer Deep-Dive – Aufgabenfamilien und Wiederholungsplanung

Multiplikationsfamilien werden kanonisch mit `a <= b` gespeichert, beispielsweise `3x8`; die Anzeige darf die Faktoren tauschen. Division referenziert dieselbe Familie mit `d:3x8`, hat aber einen eigenen Lernstand unter `fact.division`. Sie wird dauerhaft ab Multiplikationsstufe 4 freigegeben. Bei eingeschalteter Division und geeigneten Familien wird pro neu geplanter gemischter Runde mindestens ein Divisionsplatz reserviert.

Acht Stufen verwenden 1, 1, 2, 4, 7, 12, 20 und 32 Tage Wiederholungsabstand. Zwei richtige Abrufe in Folge sind für Aufstieg erforderlich. Schnelle richtige Antworten können zwei Stufen gewinnen, normale eine, langsame keine; Fehler setzen die richtige Folge zurück und senken um zwei Stufen. Reaktionszeit hat hier also eine andere Bedeutung als im Vokabeltrainer. Anzeigen von Rechenwegen verwenden `·` und `:`, gespeicherte IDs behalten ASCII-`x`.

Neue-Aufgaben-Limit gilt pro Runde. `newFactsPerDay` bleibt nur als Kompatibilitätsspiegel von `newFactsPerRound` erhalten. Fokussierte Reihenrunden speichern `today.focusTable`; die gewählte Reihe kommt aus `enabledTables`, der zweite Faktor aber aus dem ganzen konfigurierten Zahlenbereich. Fällige Wiederholungen haben Vorrang, die übrigen Plätze werden mit verschiedenen Reihenmitgliedern gefüllt.

## Technischer Deep-Dive – zusätzliche Lernmodi und stabile IDs

| Modus | Datenbereich / Identität | Besondere Regel |
| --- | --- | --- |
| Römische Zahlen | `roman:toRoman`, `roman:toArabic`, `profile.romanSkills` | Beide Richtungen, Bereich pro Profil, freie Zeicheneingabe |
| Hunderter | `h:m:`, `h:d:`, `fact.hundreds` | Eigene Stände; Division unabhängig vom normalen Divisionsschalter |
| Rechenbegriffe | `t:`, `profile.termSkills` | Textantworten verwenden Auswahl |
| Zahlenrätsel | `r:`, `profile.riddleSkills` | Eigene Generatoren und Historie |
| Punkt vor Strich | `p:type`, `profile.precedenceSkills` | Elf aktive Muster, alte 14 Speicherkeys bleiben erhalten |
| Division mit Rest | `rd:3x7`, `fact.remainder` | Rest explizit eingeben, auch wenn er null ist |
| Schriftliche Division | `w:divisor:digits`, `profile.writtenSkills` | 16 Stände für Divisoren 2–9 und zwei-/dreistellige Ergebnisse |
| Halbschriftliche Division | `sd:mode:divisor`, `profile.semiSkills` | Drei Stufen × acht Divisoren, insgesamt 24 Stände |

`today.mode` erhält den Modus beim Wiederholen; der normale Startknopf beginnt eine neue gemischte Runde. Zusätzliche Lernstände müssen in Normalisierung, Belohnungssumme, Statistik und Backup enthalten bleiben. Historische Schlüssel dürfen nicht bloß wegen geänderter Generatoren gelöscht werden.

Punkt-vor-Strich-Aufgaben bestehen aus genau zwei Operationen, auch in Klammern, mit nichtnegativen ganzzahligen Ergebnissen bis 100. Die Auswertung verwendet kein `eval`. Vier eindeutige Auswahlantworten enthalten typische Fehlvorstellungen; ab zwei Fragen werden Klammer- und Nichtklammermuster gemischt. Alte Warteschlangenschlüssel erzeugen kompatible einfachere Aufgaben.

## Technischer Deep-Dive – schriftliche und halbschriftliche Division

Schriftliche Stellenwertdivision zerlegt den Quotienten nach Stellen und lässt Nullbeiträge aus. Bei `848 : 8 = 106` sind die Arbeitsschritte `800 : 8 = 100` und `48 : 8 = 6`; keine künstliche Zwischenzeile `0 : 8 = 0`. Drei H/T/U-Zellen pro Zahl erhalten ihre Stellenposition, Leerstellen gelten als null und werden nicht nachträglich rechtsbündig verschoben. Zeilen werden der Reihe nach geprüft, erst danach die Summe oben. Die komplette Aufgabe zählt einmal.

Halbschriftliche Modi `semi`, `semiFree` und `semiRest` erzeugen dreistellige Dividenden 100–999 und Divisoren 2–9. Alle verwenden große teilbare Hunderter- oder Zehneranteile; die gröbere Stufe darf durch Zusammenfassen übersprungen werden. Einer folgen erst, wenn keine größere Stufe mehr möglich ist. Der Divisor bleibt unverändert. Am Ende werden Summe und gegebenenfalls Rest bestätigt, ohne zusätzliche Multiplikationsprobe.

Zwischenfehler und Hinweise erlauben Korrektur; erst das bestätigte Gesamtergebnis einschließlich gegebenenfalls Rest löst eine gezählte Antwort aus. Gesamtergebnisfehler verwenden die üblichen Wiederholungen. Formularcallbacks werden mit Sitzungsrevision und Antwortsperre geschützt, damit alte Ereignisse nach Abbruch/Neustart keinen fremden Fortschritt buchen.

## Technischer Deep-Dive – Profile, Migration und Backup

Aktueller Wurzelschlüssel ist `km_1x1_trainer_v2`; `km_1x1_trainer_v1` dient als ältere Einzelprofil-Migrationsquelle. `normalizeProfile()` ergänzt sichere Vorgaben und erhält Fortschritt, Profile, Einstellungen, Serien, Sticker und Rekorde. Eine inkompatible Struktur braucht eine ausdrückliche Migration, keine stille Rücksetzung. Einstellungen können die aktive Aufgabenwarteschlange neu aufbauen.

Backups sind lokal erzeugte JSON-Dateien und werden vor Übernahme geprüft. Neue Lern- oder Rekordfelder brauchen Normalisierung und Import-/Exportunterstützung. `gamesPlayed` beginnt bei Migration mit null und `gamesTrackedSince`; historische Spielzahlen dürfen nicht aus Belohnungen geschätzt werden. Der Eltern-PIN ist eine lokale Bedienungssperre und keine Zugriffskontrolle gegen Personen mit Browser-/Dateizugriff.

## Technischer Deep-Dive – Belohnungen, Canvas und Spielphysik

Die ursprünglichen zwölf Canvas-Spiele teilen Lebenszyklus, Pause, erste-Spielaktion-Buchung, Profilrekorde und Touchabbildung. Das dreizehnte Spiel, Frog Punch, verwendet SVG-/DOM-Ziele und drei Zeitrunden; es ist in dieselbe Auswahl, Pause und Kontingentbuchung integriert. Als vierzehntes Spiel ergänzt Chicken Shooter eine eigenständige 90-Sekunden-Partie mit saisonalem Hühnerhof und eigener Top-5-Liste. Die ursprünglichen Spiele liegen in `app.js`, Doodle/2048/Pac-Man/Asteroids in `arcade-extra.js` mit `VocabArcade.create()` als Schnittstelle. Ein Spiel auf der Auswahlseite zu öffnen bucht noch nichts ab. Aktive Spielzeit und Versuchszahl werden unabhängig vom Öffnen der Spielauswahl geführt. Eine Verlängerung derselben Welt wie in Vocabulator ist hier nicht implementiert.

### 2048: Start, ein Versuch und endgültiges Spielende

Ein Tipp/Klick auf das Spielfeld startet die aktive Zeit und bucht genau ein
Kontingent, ohne Zahlen zu bewegen oder einen neuen Stein zu erzeugen. Wischen,
Pfeiltasten und Bildschirmtasten können ebenfalls starten und bewegen die Zahlen.
Das Öffnen der Spielauswahl oder des Bereitschaftsbildschirms allein verbraucht
weiterhin kein Kontingent. Die maximale Dauer bleibt bei fünf aktiven Minuten;
Pause und ausgeblendete Ansichten halten die Zeit an.

`canMove()` in `arcade-extra.js` lässt das Spiel bei jedem freien Feld weiterlaufen.
Auch ein vollständig gefülltes Feld bleibt spielbar, wenn gleiche benachbarte
Zahlen noch verschmelzen können. Erst ein volles, blockiertes Feld meldet
„Kein Zug mehr möglich“. Ein unveränderter Zug erzeugt keinen neuen Stein.
Die Prüfung nach einem Zug wartet dessen kurze Animation ab.

`loseArcadeAttempt()` in `app.js` beendet 2048 bereits nach diesem ersten Versuch.
Die frühere Rettung durch Entfernen der zwei kleinsten Steine entfällt. Sie war
der Grund für freie Felder unter der Blockiert-Meldung. `finishArcadeGame()`
stoppt die Simulation, löscht vorgemerkte Züge und die Animation und zeichnet das
unveränderte endgültige Brett. Taps, Wischbewegungen, Pfeile und weitere Updates
können es anschließend nicht fortsetzen. Ein neuer Durchlauf benötigt ein neues
Kontingent; Demos können wie bisher ohne Lernkontingent neu gestartet werden.
Der Profilrekord wird gespeichert; Profil- und Backupformat ändern sich nicht.
Die übrigen Spiele behalten ihre Versuchszahl.

Canvas-Zeichenauflösung folgt Anzeige und Pixeldichte, logische Weltkoordinaten und Kollisionen bleiben davon getrennt. Physik darf nicht von Retina-Pixelmaßen abhängen. Pause und versteckte Ansichten stoppen aktive Zeit. `gameDurationMs()` liefert die Sonderdauer für Bricks/2048 und muss in HUD, Zeitende und Versuchswiederaufnahme konsistent verwendet werden.

Bricks nutzt `351 * 1.25^(level-1)` als Grundtempo; Extras multiplizieren dieses zusätzlich. Tower speichert unveränderliche Welt-Y-Positionen und verschiebt nur die Kamera einschließlich Boden und Kulisse. Cleo kollidiert rasterbasiert, zeichnet interpoliert und puffert höchstens einen nächsten Richtungswechsel. Schneefahrt startet mit 286 px/s, verwendet 100–200 % mit +20 Prozentpunkten pro gelandetem Flip und aktivem Abbau von einem Punkt pro Sekunde. Der Verfolger hält sein beim Start festgelegtes Tempo und stürzt nach mindestens 20 aktiven Sekunden an der nächsten Schlucht ab. Asteroids behält Geschwindigkeit als Vektor; Fingerkontakt richtet und beschleunigt, setzt die Geschwindigkeit aber nicht direkt.

Automatische Saisons stammen aus einer gemeinsamen lokalen Kalendersteuerung. Dekoration und reduzierte Bewegung ändern keine Trefferflächen oder Level-Zufallswerte. Konfetti erscheint beim Lernabschluss und bei einer perfekten Frog-Punch-Runde; beim Ansichtswechsel und vor der nächsten Frog-Punch-Runde wird es entfernt. Herkunft und bewusst abweichende Regeln gegenüber Vocabulator sind in `agent.md` dokumentiert.

## Frog Punch – Bedienung und Bestenliste

Unter **Spiele → Frog Punch** öffnet sich eine Teichwiese mit 15 Froschlöchern. Im schmalen Hochformat stehen sie in drei Spalten und fünf Reihen, im breiten/Querformat in fünf Spalten und drei Reihen. Die Löcher haben große, voneinander getrennte Touchflächen; Frösche und ovale Lochränder sind lokale SVG-Grafiken in leicht schräger Vogelperspektive. **Erste Runde starten** beginnt die Zeit und verbraucht genau ein freigeschaltetes Spiel. Die bloße Auswahl verbraucht nichts.

- Ein Spielkontingent umfasst **drei Runden à 40 aktive Sekunden**, insgesamt zwei aktive Minuten.
- Ein zufälliger Frosch taucht animiert auf und ist nach insgesamt **750 Millisekunden** wieder verschwunden. Rechtzeitiges Antippen gibt genau **einen Punkt**; wiederholtes Tippen desselben Auftauchens gibt keine weiteren Punkte. Leere Löcher kosten nichts. Maus und Tastatur (Tab, Enter/Leertaste auf dem Loch) funktionieren ebenfalls.
- Etwa alle 15 Sekunden tauchen zwei verschiedene Frösche gleichzeitig auf; beide haben dann jeweils **eine volle Sekunde** Zeit. Sonst ist ein Frosch aktiv; die Pausen zwischen Auftauchvorgängen schwanken leicht. Es gibt keine steigende Schwierigkeit.
- Nach Runde eins erscheint **Noch 2 Runden**, danach **Noch 1 Runde**, schließlich **Spiel beendet**. Die nächste Runde startet erst per Taste und kostet kein weiteres Kontingent. Rundenpunkte und Gesamtpunkte werden angezeigt.
- Wurde in einer Runde **jeder aufgetauchte Frosch** getroffen, erscheint Konfetti. Dafür zählt jedes Auftauchen der Runde, nicht nur das einmalige Treffen aller 15 Positionen. Bei reduzierter Bewegung werden Auf-/Abtauchen sofort dargestellt und Konfetti unterdrückt.
- Pause und ein ausgeblendeter Browser-Tab frieren Uhr und Frösche ein. Nach dem Zurückkehren per Fortsetzen weiterspielen. Wartezeit zwischen den Runden zählt nicht.

Die stets sichtbare **Top-5-Bestenliste** gehört zum aktiven Profil auf diesem Browser. Gewertet werden die **Gesamtpunkte eines vollständig abgeschlossenen Spiels aus drei Runden**. Jede Platzierung zeigt das lokale Spieldatum als `dd.mm` und die Punkte; Rangnummern erläutern die Reihenfolge. Höhere Punkte stehen oben. Bei Gleichstand gewinnt das neuere Datum, innerhalb desselben Tages der spätere Zeitpunkt; bei exakt gleichem Zeitstempel der neu eingefügte Eintrag. Das aktuelle abgeschlossene Spiel wird, falls es unter die besten fünf kommt, goldfarben hervorgehoben und für assistive Technik als aktuell markiert. Beim erneuten Öffnen werden die gespeicherten Werte ohne aktuelle Markierung angezeigt.

**Spiel beenden**, der Wechsel zur Übersicht oder Neuladen beendet das laufende Spiel; ungespielte Runden dieses bereits angebuchten Kontingents werden nicht später wiederhergestellt. Ein abgebrochenes Spiel wird nicht in die Top 5 eingetragen. Der persönliche Rekord kann bereits einen erreichten Zwischenstand enthalten. Der Direktstarter `frog.html` beziehungsweise `index.html?demo=frog` bietet dieselben drei Runden kostenlos; Demos ändern weder Spielstatistik noch Rekord oder Bestenliste.

## Technischer Deep-Dive – Frog-Punch-Runden, Eingabe und Rangliste

`frog-punch.js` veröffentlicht `window.FrogPunch` und wird vor `app.js` geladen, weil auch die Profilnormalisierung `topFive()` verwendet. Das reine Zustandsmodell bietet `create(random)`, `beginRound(game)`, `advance(game, seconds)`, `hit(game, index)`, `pose(game, hole, reducedMotion)` und `topFive(entries)`. Es besitzt keine Netzwerk- oder Speicherzugriffe. Ein injizierbarer Zufallsgenerator macht Zeit- und Doppelereignisse reproduzierbar testbar.

`app.js` verbindet das Modell über `startFrogGame()`, `frogStep()`, `tapFrog()` und `frogRoundEnded()` mit Auswahl, gemeinsamer Vollbild-/Pausefunktion, RAF-Schleife, Kontingent und Profil. `consumeRewardPlay()` wird erst beim ersten Rundenstart aufgerufen; `rewardConsumed` verhindert weitere Buchungen für die zweite und dritte Runde. `gamesPlayed` zählt das eine gestartete Kontingent, nicht jede Teilrunde. SVG-Zeichenknoten werden einmal erzeugt und per Transform versetzt; die Trefferfläche bleibt das jeweilige Loch, unabhängig von Pixeldichte und Animationshöhe. Pointerdown reagiert sofort; ein zusätzlicher Click kann dank `hitAt` nicht doppelt punkten. Native Button-Clicks erlauben Tastaturbedienung.

Der flüchtige Zustand hält unter anderem `round`, `completedRounds`, `elapsed`, `roundScore`, kumulatives `score`, `spawned`, `missed`, `nextWave`, `nextDouble` und 15 Lochzustände `{born, hitAt, duration}`. `born`/`hitAt` sind Sekunden aktiver Rundenzeit oder `null`. Aufsteigen dauert 0,16 Sekunden, Absteigen die letzten 0,18 Sekunden des jeweiligen Reaktionsfensters (0,75 Sekunden einzeln, 1 Sekunde bei Paaren); ein Treffer lässt den Frosch binnen 0,16 Sekunden abtauchen. Das nächste Auftauchen beginnt nach 1,25–1,55 Sekunden, eine Doppelwelle wird jeweils nach weiteren zufälligen 13–17 Sekunden fällig. Die Startwelle kommt nach 0,35 Sekunden; in der letzten Sekunde werden keine neuen Frösche mehr erzeugt, sodass jede Erscheinung ihr volles Reaktionsfenster hat. Große Frame-Abstände werden chronologisch verarbeitet: abgelaufene Frösche zählen als verpasst, eine Runde endet genau einmal bei Sekunde 40. Vor jedem Treffer wird die Zeit bis zum Pointerereignis fortgeschrieben; ein veraltetes sichtbares Bild gewährt keinen Treffer nach Ablauf.

Persistiert werden im bestehenden Profil unter `reward` der nichtnegative `bestFrogScore` und `frogLeaderboard` mit höchstens fünf `{id, at, score}`-Einträgen. `at` ist ein vollständiger Epoch-Zeitstempel in Millisekunden; nur die Darstellung kürzt auf Tag/Monat. Nach dem dritten Rundenabschluss wird ein Eintrag erzeugt und sofort gespeichert. `topFive()` kopiert, validiert, dedupliziert IDs, sortiert Punkte absteigend und Zeitstempel absteigend und begrenzt auf fünf. Fehlende Felder alter Profile werden zu `0`/`[]`; ungültige Einträge werden verworfen. Backup-Export/-Import erhält die Liste über dieselbe Normalisierung, ohne Mathe-Lernstände oder bestehende Rekorde zu ändern. Eine Veröffentlichung, geräteübergreifende Rangliste oder Übertragung an einen Server findet nicht statt.

Fehlende Spielkontingente verhindern normale Starts. Pause blockiert Eingaben und Zeitfortschritt. Verlassen der Ansicht stoppt RAF und löscht den flüchtigen Spielzustand sowie Konfetti. Im nativen Browser-Vollbild sitzt Frog-Punch-Konfetti innerhalb des Spielbildschirms, damit es dort sichtbar bleibt. Das SVG-/DOM-Spiel braucht keinen Canvas-Resizepfad; CSS passt das Raster bei Rotation an und die Lochindizes bleiben gleich. Die Teichszene ist ganzjährig und verändert die zwölf saisonalen Canvas-Spiele nicht.

## Technischer Deep-Dive – Offline, Aktualisierung und Hosting

`sw.js` installiert eine feste App-Dateiliste unter `1x1-trainer-v62`, entfernt alte Cacheversionen dieses Projekts und verwendet anschließend Netzwerk zuerst mit Cache-Fallback. Das Manifest und die Icons erlauben eine Home-Bildschirm-Installation. Zuverlässiger Service-Worker-Betrieb benötigt localhost oder HTTPS; HTTP auf einer Pi-LAN-IP allein garantiert keine Offline-PWA auf iOS.

Statische Bereitstellung benötigt keinen Appprozess. Für einen dauerhaft laufenden Pi sind nginx/Apache oder ein ausdrücklich eingerichteter systemd-Testserver möglich. Der vorhandene Pages-Workflow veröffentlicht bei Push auf `main` das Repository als statische Seite. Vor Veröffentlichung daher den ausgelieferten Dateiumfang prüfen; technische Dokumentation mit privaten Projektpfaden ist nicht automatisch für die Öffentlichkeit bestimmt. Diese Dokumentationsarbeit löst keinen Push oder Deployment aus.

## Tests und Fehlersuche

```sh
node tests/learning-modes.test.js
node tests/arcade-extra.test.js
node tests/frog-punch.test.js
node tests/offline.test.js
```

Die Lernmodustests prüfen Generatoren, Antworten, Wiederholungen, Belohnungen, Migration und Rundenabschluss mit einem DOM-Ersatz. Die Arcadetests prüfen echte Mechanikinvarianten wie 2048-Verschmelzen, erreichbare Plattformen und Labyrinthverbindungen. Frog-Punch-Tests prüfen 750-ms-Einzelfenster und Einsekunden-Paare, Doppelwellen, drei Zeitrunden, Punktzählung, Pause und sichere Top-5-Sortierung; die App-Integration prüft Kontingent, Demo-Isolation, Konfetti, Backup und Hervorhebung. Offlineprüfungen kontrollieren Appdateien/Cacheintegration. Diese Prüfungen ersetzen keine Sichtprüfung auf einem physischen iPhone/iPad.

Bei scheinbar verlorenem Fortschritt zuerst Origin, Browser und aktives Profil prüfen. Vor Cache-/Browserbereinigung eine Sicherung exportieren. Bei alter Oberfläche Netzwerk und Service Worker unterscheiden; bei fehlender Division Freigabestufe und Einstellung kontrollieren. Die Aussage in der älteren `agent.md`, es gebe keine Tests, ist durch die genannten vorhandenen Tests überholt.

## Features

Malaufgaben verwenden den Mittelpunkt `·`, Geteiltaufgaben den Doppelpunkt
`:` – auch in Rechenwegen und Lernstatistiken. Die Augenfarbe des Avatars lässt sich
über einen Farbpicker frei wählen; bisherige Augenfarben bleiben erhalten.

Die Startseite zeigt anspruchsvollere/neue Modi zuerst: Punkt vor Strich,
halbschriftliche und schriftliche Division, Zahlenrätsel, Division mit Rest,
Rechnen mit 100ern, Rechenbegriffe und Zahlenreihen. Die gemischte 1×1-Runde
steht auf schmalen Displays darunter, auf breiten rechts daneben.

### Punkt vor Strich

Ein eigener Startbutton übt **Klammer vor Punkt vor Strich** mit einfachen
Zahlen. Elf Aufgabenmuster mischen Plus, Minus, Mal und Geteilt, mit und
ohne Klammern. Jede Aufgabe enthält nur zwei Rechenoperationen insgesamt;
Operationen innerhalb einer Klammer zählen mit. Ab zwei Fragen
enthält jede Runde sowohl Klammeraufgaben als auch Aufgaben ohne Klammern.
Die tatsächlich auszurechnenden Malaufgaben haben nur einstellige Faktoren,
auch nach dem Auflösen einer Klammer. Divisionen gehen ohne Rest auf; Divisor
oder Quotient ist höchstens 5 (z. B. 24 : 6 oder 24 : 4, nicht 56 : 8).
Ergebnisse bleiben nichtnegative ganze Zahlen bis 100.

Die vier Auswahlantworten berücksichtigen typische Reihenfolgefehler:
Bei `3 · 4 + 2` erscheinen sowohl **14** als auch **18**. Nahe falsche Antworten
verhindern zusätzlich das Raten anhand der Größenordnung. Nach jeder Antwort
wird der Rechenweg erklärt. Rundengröße, Zahleneingabe beziehungsweise adaptive
Auswahl, Wiederholung, Statistik, Spielbelohnungen, Abbruch und Sicherungen
funktionieren wie in den anderen Modi. Der Lernstand wird separat gespeichert;
die Zahlenwahl der normalen Einmaleins-Runden begrenzt diesen Modus nicht.

### Automatische Spielsaisons und ruhige Tastatureingabe

Die zwölf Canvas-Spiele richten ihre Dekoration nach dem lokalen Gerätedatum aus,
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
Beispiel: `28 : 5 = 5 R 3`. Divisor 1 wird ausgeschlossen.
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
teilen und Teilergebnisse addieren.
Beispiel: 843 : 3 → 600 : 3 = 200, 240 : 3 = 80 und 3 : 3 = 1 → 281.
Alternativ ist die Abkürzung 840 : 3 = 280, danach 3 : 3 = 1 erlaubt. Kleine beliebige Teilstücke sind ausgeschlossen. Eine zusätzliche Gegenrechnung wird nicht abgefragt.

- **Mit Hilfe:** dreistellige Aufgaben bis 999; passende Teile sind vorgegeben.
- **Selbst aufteilen:** dreistellige Aufgaben bis 999, passende große Stellenwertanteile selbst eintragen.
- **Mit Rest:** ebenfalls bis 999, Stellenwertanteile selbst eintragen, Rest kleiner als der Divisor.

Die Einführung erklärt den Stellenwertweg und die erlaubte Abkürzung an einem vollständigen Beispiel. Tipps und
gezielte Rückmeldungen unterstützen beim Üben. Alle Stufen teilen durch
2 bis 9; sie sind unabhängig von der Freischaltung normaler Divisionsaufgaben.
Eine vollständig bestätigte Gesamtsumme einschließlich gegebenenfalls Rest zählt einmal für Statistik und
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
- Die zwölf Canvas-Spiele zeichnen mit einem Retina-Backing-Store für schärfere
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
  gestartet. Nach „Fertig für heute“ bietet die Startseite wieder die im Lernplan
  freigegebenen Themen, gegebenenfalls gemischte Runden oder andere Zahlenreihen an
- Konfigurierbare Begrenzung neuer Aufgaben pro Runde; bekannte Wiederholungen
  haben Vorrang, neue Aufgaben werden innerhalb der Runde erneut abgefragt und
  die nächste Runde führt weitere neue Aufgaben ein
- Vier zusätzliche Lernmodi auf der Startseite:
  - „Rechnen mit 100ern“: alle Aufgabenfamilien des kleinen Einmaleins von
    1 bis 10 mit Zehnerzahlen, z.B. `70 · 7 = 490` und `210 : 30 = 7`.
    Multiplikation und Division sind in diesem Modus direkt verfügbar;
    Ergebnisse können bis 1000 reichen. Auswahlantworten enthalten auch typische
    Zehnerfehler, z.B. `90` statt `9` bei `450 : 50` oder eine fehlende Null
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
- Bei Textaufgaben bleiben zusammengehörige Rechnungen wie `40 : 4` und
  Gleichungen in einer Zeile. Reicht der Platz hinter dem Text nicht aus,
  beginnt die Rechnung als Ganzes in der nächsten Zeile. Das gilt auch für
  die erklärenden Rückmeldungen und die Eingabe bei Textaufgaben.
- Optionale Lückenaufgaben (7 · ▢ = 56)
- Optionales Divisionstraining: Eltern können Division pro Profil aktivieren;
  zu einer Malaufgabe werden ab Lernstufe 4 die beiden passenden exakten
  Geteiltaufgaben freigeschaltet (z.B. 56 : 7 und 56 : 8). Multiplikation und
  Division behalten getrennte Lernstufen und Auswertungen, teilen sich aber
  Rundenumfang, neue Aufgaben und Belohnungsfortschritt. Sobald mindestens eine
  Geteiltaufgabe freigeschaltet ist, enthält jede neu gestartete Runde eine
  Divisionsaufgabe
- Belohnungen: Sticker pro geübtem Tag (zuerst noch nicht gesammelte, danach
  möglichst gleichmäßig verteilt und ohne direkte Wiederholung), Abzeichen für Serien-Meilensteine,
  Konfetti zum Abschluss einer Rechenrunde und Soundeffekte (abschaltbar).
  Bei den Canvas-Spielen erscheint beim Spielende oder erneuten Spielen kein Konfetti; Frog Punch feiert jede perfekte Runde.
- Bereits gesammelte doppelte Sticker werden beim Laden oder Sicherungsimport
  durch noch fehlende Motive ersetzt; Anzahl und Sammeltage bleiben erhalten.
  Es gibt 80 verschiedene Motive; erst bei mehr als 80 Stickern sind
  Wiederholungen unvermeidbar.
- Laufende Rechenrunden können abgebrochen werden. Bereits beantwortete Aufgaben
  bleiben in Lernstand und Statistik, freigeschaltete Belohnungsspiele bleiben
  verfügbar. Ein Abbruch zählt nicht als Rundenabschluss für Sticker und Serie;
  die nächste Runde beginnt neu.
- Vierzehn Lernbelohnungen zur Auswahl: Dino-Sprung, Flattervogel, Turmbauer,
  Gravity Run, Bricks, Cleo, Schneefahrt, Metro Run, Doodle Jump, 2048,
  Pac-Man, Asteroids, Frog Punch und Chicken Shooter. Die benötigte
  Anzahl richtiger Antworten pro Spiel ist im Eltern-Bereich konfigurierbar
  (Standard: 10); die Startseite zeigt, wie viele richtige Antworten bis zum
  nächsten Spiel fehlen. Bricks und 2048 enden nach höchstens fünf aktiven Minuten,
  Chicken Shooter nach 90 Sekunden, die übrigen Canvas-Spiele nach drei Minuten. Frog Punch bietet stattdessen drei Runden à 40 Sekunden;
  Pausen, Wartezeit vor Versuchen und ausgeblendete Ansichten zählen nicht mit.
  Bei den übrigen Canvas-Spielen beenden drei Fehlversuche das Spiel (Dino kann einen Bonusversuch sammeln); 2048 hat nur einen Versuch und endet endgültig bei vollem, blockiertem Feld.
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
  pro Profil und verbrauchen erst beim Spielstart ein Kontingent (2048 auch durch bloßes Tippen auf das Spielfeld).
- Die aktuelle App-Version steht dezent in Hellgrau unten auf der Startseite.
- Die Spieleauswahl nutzt die eingefärbten SVG-Icons aus dem Vocabulator.
- Vier weitere Spiele aus dem Vocabulator: Doodle Jump mit automatischen
  Sprüngen, schmaler werdenden beweglichen/brüchigen Plattformen und Federn;
  2048 mit animierten Zahlenverschmelzungen; Pac-Man mit wechselnden Labyrinthen,
  vier Geistern und acht Sekunden Kraftpunkten; Asteroids mit trägem Raumflug,
  automatischem Feuer und zerfallenden Asteroiden. Alle haben Touch-/Tastensteuerung,
  Pause, Vollbild und eigene Profilrekorde. Fehlversuche erhalten Welt und Punkte;
  2048 ist die Ausnahme mit nur einem Versuch: Ein vollständig belegtes Feld
  ohne mögliche Verschmelzung beendet das Spiel. Es werden keine Steine entfernt
  und keine weiteren Eingaben angenommen. Langes Halten der Bildschirmtasten löst keine Textauswahl aus.
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
- Während der Halloween-Saison (20.–31. Oktober) Dekoration aus dem Vocabulator in allen zwölf Canvas-Spielen:
  Kürbisse, Spinnweben, Fledermäuse und Hexen; bei Metro Run zusätzlich lustige
  Straßenschilder, tanzende Skelette und Geisterballons. Rein gezeichnete Deko
  ohne zusätzliche Hindernisse oder Änderungen der Trefferflächen.
  Die Spielwelten nutzen dunkle Dämmerungs-/Nachtpaletten, Mondlicht, Nebel
  und gelegentliche langsam verblassende Blitze im Hintergrund statt Sonne.
  Keine bildschirmfüllenden Lichtblitze; bei reduzierter Bewegung bleiben
  diese Wettereffekte statisch und die Blitze aus. Cleo sammelt leuchtend
  orange Kürbisse statt Obst; Bomben behalten eine deutlich helle Kontur.
- Schneefahrt: Die Kamera folgt weiterhin vorausschauend dem Gelände am rechten
  Bildschirmrand, begrenzt diese Ausrichtung aber zugunsten des Snowboarders:
  Bei Bodenfahrt und Grinds bleiben Kopf und Board zwischen 20 und 80 % der
  sichtbaren Spielfeldhöhe. Im Sprung reicht die untere Grenze bis 90 %;
  die obere bleibt bei 20 %. Damit verschwindet die Figur bei steilen Abfahrten
  nicht am oberen Bildrand. Tiefe Geländestellen werden berücksichtigt, soweit
  diese Grenzen es erlauben; die Sichtbarkeit der Figur hat Vorrang.
  `updateSnowCamera()` begrenzt Zielposition und geglättete Kameraposition anhand
  der aktuellen Canvas-Höhe. `resizeSnowCanvas()` wendet die Grenzen sofort auch
  nach Größen- und Orientierungswechseln an. Die Kamerabewegung verändert weder
  Weltpositionen noch Kollisionen oder Sprungphysik. Regressionstests prüfen
  Geländeausblick, obere Grenze, 80-/90-%-Grenzen, Grinds und mehrere Bildhöhen.
  Gedrückthalten im Flug dreht den Salto mit 5 statt bisher 4,34 Radiant pro
  Sekunde (rund 15 % schneller). Eine volle Drehung dauert etwa 1,26 Sekunden;
  Sprunghöhe, Schwerkraft und die Ausrichtung nach Loslassen bleiben gleich.
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
  Nach Schanzen und Girlanden reserviert die Streckenplanung einen Landebereich
  ohne nachfolgende Schlucht: Ab dem Ende der letzten Schanze bzw. Girlande
  bleiben mindestens 1716 Weltpixel frei von neuen Schluchten. Das entspricht
  drei Sekunden Fahrt bei Höchsttempo und bietet Raum für Flug, Landung und
  Reaktion. Auch die Anfahrtsschanze der nächsten Schlucht beginnt erst hinter
  dieser Reserve. Doppel-Schanzen und die Girlanden im Bergdorf zählen mit;
  die Reserve wird unabhängig vom aktuellen Tempo bemessen und bleibt bestehen,
  wenn die vorherige Schanze/Girlande bereits aus den Objektlisten entfernt ist.
  Dadurch kann ein späterer Tempo-Boost den Schutz nicht verkürzen.

  `spawnSnowTerrain()` führt diese monotone Weltgrenze in `safeLandingUntilX`
  und berücksichtigt sie vor der Geländesuche für den nächsten Schluchtabschnitt.
  Andere Abschnitte werden dadurch nicht pauschal auseinandergezogen. Die
  bewusst zusammengehörige Schanze vor einer Schlucht bleibt möglich: Zwischen
  deren Absprung und dem Schluchtanfang liegen nur 25 Weltpixel, sodass die
  Schlucht beim Absprung bereits innerhalb des 480 Pixel breiten Ausblicks
  vor der Figur liegt. Es wird keine Schlucht nachträglich in die reservierte
  Landestrecke eingefügt. Der Zustand gilt nur für das laufende Spiel, wird beim
  Neustart zurückgesetzt und verändert weder Profile noch Backups. Tests prüfen
  alle Schanzen-/Girlandenarten bei 100 und 200 %, Objektbereinigung und Boosts.

  Das Grundtempo bleibt konstant bei 286 Pixeln/Sekunde (+30 %), ohne zeitabhängigen
  Anstieg. Der Verfolger startet mit dem dann aktuellen Fahrtempo plus
  16 Pixeln/Sekunde, begrenzt auf 140 % des Grundtempos (400,4 Pixel/Sekunde).
  Das entspricht dem Tempo nach zwei gelandeten Saltos ausgehend von 100 %.
  Er behält dieses festgelegte Tempo während der Verfolgung bei; spätere Boosts
  erhöhen es nicht. Unterhalb dieser Grenze kann er weiterhin aufholen, bei
  höherem Fahrtempo kann die Spielfigur Abstand gewinnen. Der aktive Tempoabbau
  der Spielfigur bleibt bestehen.
  Nach mindestens 20 aktiven Verfolgungssekunden stürzt er an der nächsten
  vorhandenen Schlucht ab, deren Anfang er erreicht. Es entsteht keine zusätzliche
  Schlucht. Saltos und großer Abstand verkürzen diese Mindestzeit nicht mehr.
  Der Sturz bringt einmalig 250 Punkte; die nächste Verfolgung beginnt frühestens
  30 aktive Sekunden später. Aufholen allein kostet keinen Versuch: Der
  Verfolger bleibt in Fahrtrichtung höchstens auf gleicher Position und fährt
  am Boden unter einem springenden Snowboarder oder einer erhöhten Girlande
  weiter. Erst die Berührung beider Figuren kostet einen Versuch, etwa beim
  Landen auf dem Verfolger oder direktem Bodenkontakt. Eine niedrige Girlande
  schützt deshalb nur, solange die Figuren sich tatsächlich nicht berühren.
  Tempo-Boosts können den Abstand wieder vergrößern. Pause und Warten halten
  die Verfolgung und die Sturzanimation an.

  Die obere Statusleiste belegt nur noch 32 statt 102 logische Canvas-Pixel und
  zeigt Münzen, Saltos, Combo, Tempo und Strecke in einer Zeile. Abschnittsnamen
  entfallen. Warnungen und kurze Ereignismeldungen erscheinen bei Bedarf in
  einer schmalen, an die Textbreite angepassten Fläche darunter. Verfolgerwarnungen
  haben Vorrang vor Ereignismeldungen, diese wiederum vor Tempo-/Schutzhinweisen.

  Technisch verwaltet `updateSnowChaser()` das Alter der laufenden Verfolgung
  in `chaser.age` und nach dem Abschütteln die Weltposition und Animationszeit
  in `chaserFall`. Nach der Mindestzeit prüft es die vom Verfolger während des
  Frames überquerten Schluchtanfänge; auch eine schmale Schlucht wird dadurch
  nicht übersprungen. Der horizontale Abstand ist auf mindestens null begrenzt;
  die Schluchtprüfung berücksichtigt die dadurch begrenzte tatsächliche Bewegung.
  Die Kollision verwendet `snowRiderPolygon()` (inklusive Drehung und Grindneigung)
  und eine zur gezeichneten Verfolgerfigur passende Kontur am Boden. Höhenabstand
  verhindert Treffer; die bestehende Schutzzeit unterdrückt auch diese Kollision. Bereits vor der Zeitgrenze betretene Schluchten zählen nicht.
  Solange eine Verfolgung läuft, bleiben Schluchten hinter der Kamera bis zum
  Passieren durch den Verfolger erhalten. Diese Zustände gelten nur für das
  laufende Spiel und ändern weder Profilspeicher noch Backupformat.
  `drawSnowGame()` zeichnet den Fall für bis zu 1,2 aktive Sekunden; bei
  reduzierter Bewegung entfällt die Drehung. Nach einem verlorenen Versuch
  löscht `snowRecover()` beide Verfolgerzustände und plant den Neustart nach
  30 aktiven Sekunden. Die Integrationstests prüfen Mindestzeit, nächste vorhandene
  Schlucht, einmalige Punkte, Pause, Fallposition, Wiederanlauf und Berührungen bei Sprüngen/Grinds/Landungen.
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
sudo cp index.html styles.css app.js arcade-extra.js frog-punch.js frog.html icons.svg flappy.html tower.html gravity.html brick.html snake.html snow.html runner.html doodle.html tiles.html maze.html asteroid.html manifest.json sw.js icon-192.png icon-512.png /var/www/html/
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

Upload und Deployment verwenden denselben Namen
`github-pages-${{ github.run_id }}-${{ github.run_attempt }}`. Die Lauf-ID trennt
Workflow-Läufe; die Versuchsnummer trennt Wiederholungen desselben Laufs.
So wird ausschließlich das Artefakt des aktuellen Versuchs veröffentlicht,
auch wenn ältere Versuche bereits ein Pages-Artefakt hochgeladen hatten.
Beide Schritte bleiben im selben Job, sodass ein erneuter Job-Lauf das passende
Artefakt neu hochlädt, bevor er es bereitstellt.

Bei `Multiple artifacts named "github-pages" ... Artifact count is 2` hat die
Deploy-Action mehrere gleichnamige Artefakte gefunden. Die zusätzliche Meldung
über `githubstatus.com` ist ihre allgemeine Fehlermeldung und belegt hier keine
GitHub-Störung. Frühere Artefakte müssen für die Namenskorrektur nicht gelöscht
werden. Nach Übernahme der Korrektur einen **neuen** Lauf über **Actions → GitHub
Pages → Run workflow** auf dem aktualisierten Branch starten oder den nächsten
Push auf `main` verwenden. Ein alter Lauf verwendet bei „Re-run jobs“ weiterhin
seine alte Workflow-Fassung und profitiert nicht nachträglich von der Änderung.

Die Meldung zur Umstellung von `ubuntu-latest` auf Ubuntu 26 ist ein Hinweis zur
Runner-Umgebung und unabhängig von der mehrdeutigen Artefaktauswahl. Der Workflow
verwendet weiterhin `ubuntu-latest`; diese Korrektur ändert keine Action-Version,
App-Datei, Lernstände oder PWA-Cachekennung. Die Inputs sind in den offiziellen
Definitionen von [upload-pages-artifact](https://github.com/actions/upload-pages-artifact/blob/v5/action.yml)
(`name`) und [deploy-pages](https://github.com/actions/deploy-pages/blob/v5/action.yml)
(`artifact_name`) beschrieben. Lokal können Namensgleichheit und YAML-Struktur
geprüft werden; ein erfolgreicher GitHub-Deployment-Lauf ist erst nach Übernahme
und Ausführung auf GitHub belegt. Lokale Doku-Erzeugung startet kein Deployment.

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


## Dokumentation pflegen

`README.md` ist die zentrale Inhaltsquelle; [mathTrainer-Dokumentation.html](../manuals/mathTrainer-Dokumentation.html) ist die daraus erzeugte, lokal im Browser lesbare Ausgabe mit Inhaltsverzeichnis, Kapitelsuche und Druckansicht. Die HTML-Datei nicht von Hand bearbeiten. Alle HTML-Dokumentationen werden zentral unter `/Users/heik/Dev/repos/manuals/` abgelegt, je Projekt als `<Projektname>-Dokumentation.html`. Der Produktname steht in `scripts/documentation.json`. Referenzierte lokale Medien werden in den eigenen Ordner `<Projektname>-assets/` kopiert; Dateinamen enthalten einen Inhalts-Hash. Damit überschneiden sich die Medienbestände der Dokumentationen nicht. Fehlende oder veränderte Medien lassen den Check fehlschlagen. Externe Bilder müssen vorab lokal bereitgestellt werden. Links zu README und Detaildateien werden beim Erzeugen auf den neuen Ablageort umgerechnet.

Bei jeder Projektänderung betroffene Bedienungs-, Architektur-, Schnittstellen- und Betriebsabschnitte anhand des Codes prüfen und im selben Arbeitsschritt aktualisieren. Im Header Projektstand und Änderungsdatum nachführen; keine Anwendungsrelease-Version erfinden. Unveränderte Kapitel müssen nicht neu geschrieben werden.

```sh
python3 -m venv /private/tmp/project-docs-venv
/private/tmp/project-docs-venv/bin/python -m pip install -r scripts/requirements-docs.txt
/private/tmp/project-docs-venv/bin/python scripts/build_docs.py
/private/tmp/project-docs-venv/bin/python scripts/build_docs.py --check
```

Die Markdown-Abhängigkeit ist nur für die Dokumentation nötig. Die fertige HTML-Datei funktioniert ohne Installation und ohne externe Ressourcen. `--check` schreibt nichts und vergleicht die gesamte Ausgabe einschließlich eines SHA-256-Fingerabdrucks der relevanten Quell- und Dokumentationsdateien. Ausgenommen sind unter anderem private `data/`, Laufzeitdaten, Build-Ausgaben und virtuelle Umgebungen. Die Prüfung erkennt einen geänderten Quellstand, ersetzt aber keine inhaltliche Prüfung der README. Änderungen durch beliebige Editoren lösen keinen Hintergrundjob aus; Codex erhält die Pflegepflicht über `AGENTS.md` und den Skill `project-documentation`.

Die Dokumentation wird hier lokal gepflegt. Eine Bereitstellung auf dem Pi oder einer öffentlichen Website ist ein eigener Deployment-Schritt; bestehende App-Builds und deren Dateifreigaben werden dadurch nicht erweitert. Der CI-Job erzeugt die zentrale Ausgabe in einer isolierten Testablage und prüft ihre Reproduzierbarkeit; die persönliche zentrale HTML-Datei wird dort nicht vorausgesetzt.


## Chicken Shooter – Konfetti auf dem Hühnerhof

**Bedienung:** In der Spielübersicht „Chicken Shooter“ wählen und „Spiel starten“ drücken. Erst der Start verbraucht genau ein verdientes Spiel; die Auswahl bleibt kostenlos. Eine Partie dauert 90 aktive Sekunden ohne Verlust von Versuchen. Ein Huhn anklicken oder antippen: Es verschwindet in buntem Konfetti mit der Anzeige „Gack!“. Es gibt weder Blut noch tote Tiere. Kleine und schnelle Hühner bringen mehr Punkte; verpasste Schüsse kosten keine Punkte. Sechs Konfettischüsse stehen bereit, danach wird automatisch eine aktive Sekunde nachgeladen. Die Taste „Nachladen“ oder R bei fokussiertem Spielfeld lädt auch vorzeitig nach. Währenddessen sind keine Treffer möglich. Tastatur: Pfeile bewegen das sichtbare Fadenkreuz, Leertaste gibt einen einzelnen Schuss ab. Mit Tab lässt sich das Spielfeld erreichen. Pinch-Zoom bleibt verfügbar.

Die hügelige Landschaft besitzt drei farblich gestaffelte Tiefenebenen mit jeweils Baum und Scheune. Ein drehendes Windrad, ein kleiner Wald, ein geschwungener Feldweg mit Fahrspuren, Ackerfurchen, ein Teich mit Schilf, Zaun, Blumen, vorbeiziehende mehrteilige Wolken und drei kleine laufende Kühe beleben den Hof. Die Kühe drehen sich am Wendepunkt passend zu ihrer tatsächlichen Laufrichtung um. Schnee beziehungsweise fallendes Herbstlaub und eine saisonale Farbpalette passen die Umgebung an. Diese Hintergrunddetails sind keine zusätzlichen Deckungen. Hühner fliegen in unterschiedlichen Größen, Richtungen und Geschwindigkeiten, schlagen gelegentlich einen Looping oder fahren mit Flugzeug, Heißluftballon und Paraglider. Im schmalen Feld (Weltbreite unter 600) sind höchstens fünf fliegende Hühner gleichzeitig aktiv, sonst sieben; alle 0,9–1,5 aktiven Sekunden kann eines hinzukommen, sofern Platz ist. Jedes Huhn erhält unabhängig Flugstil, Tempo, Beschleunigungsschwankung, Frequenz, Amplitude und Startphase. Es gibt ruhiges Fliegen, weite Bögen, unregelmäßiges Flattern, Zickzack, kurzes Schweben sowie langsame Ballon- und Paragliderbahnen. Flugzeuge sind schneller; Ballons deutlich langsamer. Besondere Fahrzeuge wechseln in gelegentlichen Auftritten durch alle drei Varianten. Niedrige Flugbahnen führen hinter Deckungen vorbei. Nur freie Stellen eines Huhns sind treffbar; ein vorderer Baum oder eine Scheune schützt auch Hühner dahinter. Die ganze Figur zählt als Treffer: Körper, Kopf, Kamm, Schnabel, Füße, Schwanzfedern, Schleife, Schal und Feiertagskopfschmuck. Bei Fahrzeugen zählen auch Flugzeug, Ballonhülle/-korb und Paraglider-Kappe; die dünnen Leinen sind keine eigene Trefferfläche. Die Trefferprüfung dreht und spiegelt die Eingabe mit derselben Pose wie die Zeichnung. Sechs unterschiedlich gefärbte Charaktere tragen unter anderem Schleife, Blume, Fliegerbrille, Schal oder Weste; mehrteilige Schwanzfedern, Gefiederdetails, Lichtverläufe und eigene Flügelschlagfrequenzen unterscheiden sie. Dunkle Konturen und ein heller Saum halten die Hühner auch vor Schnee und dunklem Laub erkennbar. Touch-Trefferflächen sind mindestens 44 CSS-Pixel breit, während die sichtbaren Hühner ihre verschiedenen Größen behalten.

| Landschaft | Lokaler Kalenderzeitraum, einschließlich |
| --- | --- |
| Winter | 1. Dezember–31. März |
| Frühling | 1. April–30. Juni |
| Sommer | 1. Juli–14. September |
| Herbst | 15. September–30. November |
| Halloween-Dekoration | 20.–31. Oktober, entsprechend den bestehenden Spielen |
| Weihnachtsdekoration | 1.–27. Dezember, entsprechend den bestehenden Spielen |
| Osterdekoration | 7 Tage vor bis 7 Tage nach dem berechneten gregorianischen Ostersonntag |

Halloween bringt Kürbisse, Hexenhüte und einen dunkleren Himmel; Weihnachten Geschenke und Weihnachtsmützen; Ostern Eier und Hasenohren. Der Osterzeitraum ist neu, da die vorhandenen Spiele bislang keinen definierten Osterzeitraum besitzen. Jahreszeit und Feiertag werden bei jeder neuen Partie nach dem lokalen Datum bestimmt. Die Feiertagsdekoration ändert weder Trefferpunkte noch Deckungsgeometrie. Bei reduzierter Bewegung entfallen zusätzliche Vogelrotation, Flügelschlag, Windradrotation, Kuhgang und Wolkendrift; die für das Spiel nötigen Flugbahnen bleiben bestehen.

**Bestenliste:** Analog zur vorhandenen Frosch-Bestenliste zeigt „Top 5“ pro Kinderprofil die fünf besten vollständig beendeten Partien mit Datum und Punkten. Höhere Punktzahl gewinnt, bei Gleichstand das neuere Datum, bei exakt gleichem Zeitpunkt der neu eingefügte Eintrag. Das aktuelle Ergebnis wird hervorgehoben, sofern es in den Top 5 bleibt. Teilspiele beim Verlassen oder Neuladen werden nicht eingetragen und nicht fortgesetzt. `reward.bestChickenScore` und `reward.chickenLeaderboard` werden lokal gespeichert und im normalen JSON-Backup mitgeführt. Der Rekord wird bei vollständigem Spielabschluss aktualisiert. Der Direktstarter `chicken.html` beziehungsweise `index.html?demo=chicken` spielt ohne Belohnungsverbrauch und verändert weder Rekord noch Bestenliste.

### Besondere Hühner am Teich und in den Ställen

Zusätzlich zu den fliegenden Hühnern erscheinen gelegentlich bis zu zwei ortsgebundene Ziele: eines am Teich und eines in einer Stalltür. Im Frühling, Sommer und Herbst schaut ein Huhn mit türkisfarbener Taucherbrille und Schnorchel aus dem Wasser. Es taucht innerhalb eines insgesamt **zwei aktive Sekunden** langen Auftritts auf und wieder unter. Wasserlinie und Auftauchhöhe begrenzen die Trefferfläche; bereits untergetauchte Teile sind nicht treffbar. Ein Treffer bringt **65 Punkte**.

Im **Winter ist der Teich zugefroren** und zeigt helle Eisspuren. Statt des Taucherhuhns läuft dort für **sechs aktive Sekunden** ein Huhn mit Schal und Schlittschuhen hin und her. Seine Blickrichtung folgt der tatsächlichen Gleitrichtung. Ein Treffer bringt **60 Punkte**. Die jahreszeitliche Variante richtet sich nach der beim Spielstart bestimmten Landschaft; Winter-Weihnachtsschmuck bleibt erhalten.

Etwa alle **9–16 aktiven Sekunden** öffnet sich eine zufällig ausgewählte Stalltür. Ein neugieriges Huhn schaut **2,6–3,4 Sekunden** heraus und zieht sich wieder zurück. Nur die im Türfenster sichtbaren Teile zählen; Wände und andere vorgelagerte Deckungen bleiben geschützt. Ein Treffer bringt **55 Punkte**. Der erste Stallbesuch ist nach etwa vier Sekunden, der erste Teichbesuch nach etwa sieben Sekunden vorgesehen. Nach jedem vorgesehenen Teichauftritt liegt eine Pause von 8–15 aktiven Sekunden bis zum nächsten Besuch. Ein früher Treffer zieht diesen Termin nicht vor. Direkt vor Spielende startet kein Besuch mehr, dessen vollständige Dauer nicht in die verbleibende Spielzeit passt.

Alle Auftritte verwenden ausschließlich aktive Spielzeit: Pause friert Erscheinung und Rückzug ein. Treffer lösen dieselbe kindgerechte Konfetti-Anzeige aus. Verpasste Besuche kosten keine Punkte oder Versuche. Die Gäste werden als flüchtige `visitors` separat von den Flugzielen verwaltet und verschwinden beim Verlassen der Partie. `position()` und `birdHit()` verwenden dieselbe Auftauch-/Türgeometrie; der Stallbesuch wird im offenen Türfenster gezeichnet, das Teichhuhn vor der Uferkulisse und oberhalb der Wasserlinie. Bei reduzierter Bewegung erscheinen Taucher- und Stallhühner ohne zusätzliches Ein-/Ausblenden, bleiben aber nur für ihre festgelegte aktive Dauer sichtbar.

### Chicken Shooter: Implementierung, Zustände und Prüfung

`chicken-shooter.js` stellt das lokale `window.ChickenShooter` bereit und wird vor `app.js` geladen, weil die Profilnormalisierung `topFive()` benötigt. Das Modul enthält Kalender-/Osterberechnung, Simulation, gemeinsame Deckungsgeometrie, Trefferprüfung und die selbst gezeichnete Canvas-Grafik. Es lädt keine externen Bilder, Schriften oder Dienste. Die Grafiken wurden für dieses Spiel im Code erstellt; es wurden keine Moorhuhn-Grafiken übernommen.

`create()` erzeugt eine wartende Partie. Der Host in `app.js` verwaltet Belohnung, Start/Ende, Animation, Fokus, HUD, Bestenliste und vorhandene Vollbild-/Pausensteuerung. `advance()` verarbeitet ausschließlich aktive Sekunden in maximal 50-ms-Simulationsschritten, erzeugt Ziele und beendet einmalig bei 90 Sekunden. Vor jedem Schuss aktualisiert der Host zuerst die Zeit, damit bereits abgelaufene Spiele keine Treffer mehr annehmen. `shoot()` prüft Vordergrund vor Hintergrund und dieselben Baum-/Scheunenflächen, die der Renderer zeichnet. Ein Treffer entfernt genau ein Ziel und addiert dessen ganzzahlige Punkte. Für fliegende Hühner ergeben sich die Punkte gerundet in Fünferschritten aus `18 + (39 − Größe) · 1,5 + Geschwindigkeit · 0,18`; die Größenbasis liegt zwischen 24 und 39, die Grundgeschwindigkeit normaler Hühner zwischen 90 und 351 Weltpixeln pro Sekunde. Alle Grundgeschwindigkeiten wurden um 80 % erhöht. Ballons fliegen mit 61,2–104,4, Paraglider mit 108–180, Flugzeuge mit 225–342; individuelle Temposchwankungen und Schwebephasen kommen hinzu. Die Tiefenebene skaliert zusätzlich die sichtbare Größe. Die Szene passt ihre Weltbreite an die verfügbare Fläche an; `resize()` erhält dabei Zielalter, Manöver und relative horizontale Positionen. Die Canvas-Auflösung berücksichtigt bis zu zweifache Pixeldichte.

Simulationszustand: `elapsed`, `running`, `pausedAt`, `targets`, `visitors`, `nextPond`, `nextPeek`, `effects`, `ammo`, `reloadUntil`, `score` und zufällige Spawnparameter. Zeit und Nachladen stehen bei Pause still, und Treffer werden abgewiesen. Das Verbergen der Seite aktiviert die gemeinsame Pause. Ziel-/Effektzustände existieren nur im Arbeitsspeicher. Persistiert werden nur abgeschlossene Ergebnisse `{id, at, score}` und der Rekord. `topFive()` validiert IDs mit Präfix `chicken-`, endliche Zeitstempel und nichtnegative sichere ganzzahlige Punkte, entfernt doppelte IDs und begrenzt auf fünf Einträge. Fehlende Altprofilfelder erhalten 0 beziehungsweise eine leere Liste; andere Lern-/Profildaten bleiben bestehen. Alle Dateien und der Direktstarter sind im PWA-App-Cache enthalten (Cache-/UI-Kennung 62).

Prüfung aus dem Projektordner:

```sh
node tests/chicken-shooter.test.js
node tests/learning-modes.test.js
node tests/frog-punch.test.js
node tests/arcade-extra.test.js
node tests/offline.test.js
```

Der neue Modultest prüft Saison-/Feiertagsgrenzen einschließlich des beweglichen Osterfests, verschiedene Fahrzeuge und Tiefen, vollständige Trefferflächen einschließlich Schleife/Kamm/Schwanz bei Drehung und Spiegelung, begrenzte Zieldichte, stabile Größenänderungen, Treffer/Deckung, Nachladen, Pause, Spielende und ungültige Bestenlisteneinträge. Die Integration prüft Belohnungsverbrauch, Spielabschluss, aktuellen Top-5-Eintrag, Backup-Normalisierung, Teilspielabbruch und Demo-Isolation. DOM-Stand-ins ersetzen keine Prüfung auf einem echten iPhone/iPad; die reale Touch-Bedienung und installierte Offline-PWA sind separat auf dem Zielgerät zu prüfen.

Für die visuelle Kontrolle mit lokalem HTTP-Server öffnet `tests/chicken-preview.html` sechs reproduzierbare Ansichten (vier Jahreszeiten, Halloween und Ostern) und eine eingebettete 390 × 760-Spielansicht. Die Beispielansichten sind eine lokale Testhilfe und werden nicht im PWA-App-Dateisatz vorgehalten. Die neue Gestaltung wurde in Safari breit und in der schmalen eingebetteten Ansicht geprüft; dies ersetzt keinen realen iPhone-Touch- oder Offline-Neuladetest.
