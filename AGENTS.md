# Projektanweisungen

Die ergänzenden Implementierungsregeln in `agent.md` lesen. Dort ist der Satz, es gebe keine automatisierten Tests, überholt; vorhandene Tests stehen in README.md.

<!-- project-documentation -->
## Dokumentation bei Änderungen

Bei jeder Projektanpassung den Skill `project-documentation` verwenden. Hauptquelle:
`/Users/heik/Library/Mobile Documents/com~apple~CloudDocs/Skill-Marketplace/plugins/project-documentation/skills/project-documentation/SKILL.md`.
README.md anhand der geänderten Implementierung inhaltlich pflegen, belegte Version und
letztes Projekt-/README-Änderungsdatum im Header nachführen und `/Users/heik/Dev/repos/manuals/mathTrainer-Dokumentation.html`
im selben Arbeitsschritt neu erzeugen. Technische Einheiten mit Ablauf, Datenmodell,
Schnittstellen und Fehlerverhalten erklären; vorhandene private Daten nicht veröffentlichen.
Zugehörige Medien ausschließlich unter `/Users/heik/Dev/repos/manuals/mathTrainer-assets/` ablegen; andere Dokumentationen nicht überschreiben. HTML nicht von Hand bearbeiten. Doku-Abhängigkeit: `scripts/requirements-docs.txt`.
Aus dem Projektordner mit einer Umgebung, in der diese Abhängigkeit installiert ist:
`python3 scripts/build_docs.py` und `python3 scripts/build_docs.py --check` ausführen.
Der Check erkennt veraltete HTML-/Quellstände, ersetzt keinen Inhaltsreview.
Lokale Doku-Erzeugung erlaubt keine automatische Veröffentlichung oder Pi-Bereitstellung.
<!-- /project-documentation -->
