# Herkunft der Assets

Dieses Dokument hält die Herkunft der im Repository enthaltenen Bilddateien
fest. Dadurch lässt sich auch später nachvollziehen, ob für eine
Weiterverwendung zusätzliche Lizenzen beachtet werden müssen.

## App-Icon

Die Dateien `icon-192.png`, `icon-512.png` und
`assets/app-icon-source.png` wurden am 8. August 2026 eigens für dieses
Projekt mit OpenAI ImageGen erzeugt. Es wurden keine Vorlagen oder fremden
Bilder als Eingabe verwendet.

Das Motiv wurde ausdrücklich ohne Marken, Maskottchen, bekannte Spielfiguren,
Logos oder andere externe Assets generiert. Die kleineren Dateien sind reine
Skalierungen der Quelldatei.

Verwendete Gestaltungsanweisung, sinngemäß gekürzt:

> Eigenständiges, kinderfreundliches App-Icon für einen Multiplikationstrainer:
> zwei abstrakte Zahlenplättchen, ein Multiplikationszeichen, violetter Verlauf,
> weiße Formen und gelbe Akzente; keine Schrift, Marken, Figuren, Vögel,
> Dinosaurier, Spielreferenzen, Wasserzeichen oder Signaturen.

Die Icons werden zusammen mit dem übrigen Projekt unter der MIT-Lizenz
bereitgestellt.

## Weitere Darstellungen

Die Belohnungsspiele verwenden keine eingebetteten Bild-, Musik- oder
Sounddateien. Ihre Grafiken werden zur Laufzeit mit der Canvas-API gezeichnet;
die Töne werden mit der Web-Audio-API erzeugt. Emojis und Systemschriften
werden vom jeweiligen Betriebssystem bzw. Browser dargestellt und nicht mit
diesem Repository ausgeliefert.

## Oberfläche und Spielupdates aus Vocabulator

Am 18. Oktober 2026 wurden die helle App-Oberfläche, `icons.svg` und die sieben
Spielimplementierungen aus dem lokalen Schwesterprojekt `vocuabulator`
übernommen (MIT, Copyright 2026 Heiko Hanickel). Die ursprünglichen drei Spiele
stammen aus mathServer; Gravity Run, Bricks, Cleo und Schneefahrt wurden dort
eigenständig ergänzt. Die SVG-Linienicons und Canvas-Grafiken sind eigene
Geometrie, ohne externe Iconbibliotheken oder Originalassets anderer Spiele.
Die Spielprinzipien von Gravity Run bzw. Schneefahrt wurden durch JindoBlu
„2 Player Games“ bzw. Alto's Adventure inspiriert. Vokabel- oder Buchdaten
wurden nicht übernommen. Das bestehende Mathe-App-Icon bleibt unverändert.
