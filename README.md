# VitalKompass 1.2.0

Private Blutzucker-, Blutdruck- und Gesundheits-Webapp (Progressive Web App / PWA), für große Schaltflächen und iPhone-Nutzung ausgelegt.

## Sichere Nutzung

1. Nur den **öffentlichen App-Ordner** oder die Datei `VitalKompass_PUBLIC_GitHub.zip` auf GitHub Pages veröffentlichen. Der Ordner enthält **keine** persönlichen Patientendaten.
2. Die Website **über HTTPS** öffnen (z. B. über `https://<konto>.github.io/<repository>/`). Ein starker Passwortschutz wird bei der ersten Nutzung angelegt. Passwort sicher aufbewahren, es gibt keine Zurücksetzen-Funktion.
3. Die **separate** persönliche Ralf-Importdatei auf dem persönlichen Gerät speichern. Sie enthält hochsensible Daten und darf **nicht** zu GitHub oder anderem öffentlichem Hosting hochgeladen werden.
4. In der App `Backup & Updates > Privaten Notfallpass / historische Werte importieren` öffnen, die private Datei auswählen und importieren. Alle aus Fotos übertragenen Messwerte und Medikamentenpläne sind **ungeprüft** und müssen kontrolliert werden.
5. Unter `Backup & Updates` nach der Einrichtung ein **verschlüsseltes Backup** herunterladen und mit bekanntem Passwort sicher aufbewahren. Browser-Datenlöschung kann alle lokalen App-Daten löschen.
6. Auf dem iPhone in Safari `Teilen > Zum Home-Bildschirm` wählen, um die PWA mit eigenem Icon zu starten.

## Funktionsumfang

- Blutzucker (Eingabe mg/dl oder mmol/l; interne Speicherung mg/dl; Nüchtern, vor und nach Essen)
- Blutdruck, Puls; getrennte Kurven und Farb-Legenden; einstellbare Orientierungsgrenzen
- Laborparameter (>100) einschließlich HbA1c, Insulin, Nierenwerte, Ferritin, Eisen, PSA gesamt/frei, Prostata und Urin
- Medikamentenplan sowie statische Hinweise zu **ausgewählten** Risiken. Kein vollständiger automatischer Wechselwirkungscheck!
- Allergien, Vorerkrankungen, Medikamentenliste, Kontakte und medizinische Historie im Notfallpass
- Berichte für den laufenden Monat und das laufende Jahr, über die Browser-Druckfunktion als PDF speicherbar
- Lokale AES-256-GCM-Verschlüsselung mit PBKDF2-SHA-256 (270.000 Iterationen) im Browser, IndexedDB
- Passwortgeschützter verschlüsselter Backup-Export sowie Restore und privater Dateiimport
- PWA-Cache für Offline-Nutzung nach der ersten vollständigen Onlinenutzung
- Update-Suche via `version.json` und Service Worker: **nur wenn eine neue App-Version tatsächlich online veröffentlicht wurde**
- Allgemeine Krankenkassenleistungen mit offiziellen Links und einer kopierbaren Musteranfrage

## Grenzen

- Die App ersetzt weder ärztliche Therapieanweisungen noch eine verbindliche Interaktionsdatenbank. Medikamente nicht aufgrund der App wechseln, starten oder absetzen.
- Medizinische Alarmgrenzen sind Orientierungswerte. Grenzwerte für eine konkrete Person müssen ärztlich angepasst werden.
- Referenzbereiche für Laborparameter müssen aus dem jeweiligen Befund übernommen werden. Unbekannte Referenzbereiche bleiben unbekannt.
- Die Angaben aus dem Foto wurden nicht unabhängig überprüft. Auf der handschriftlichen Liste steht `mmol/l`, die Werte um 100–200 sind aber vermutlich `mg/dl`. **Erst anhand des Original-Messgeräts bestätigen!** Uhrzeiten erscheinen in der Spalte `Insulin` und wurden nur als Uhrzeiten, nicht als Insulineinheiten importiert.
- Die Karte mit Blutgruppe im Notfallpass ersetzt keinen aktuellen Transfusionsbefund.
- Medizinische Links benötigen Internet; die App-Funktionen laufen nach Laden des PWA-Cache offline.
- PDF-Export erfolgt über `Drucken` → `Als PDF sichern`; keine externe PDF-Bibliothek oder Server notwendig.
- **Kein Hintergrundabgleich** von Arzneimitteln, Sozialrecht, Preisen oder Kassenentscheidungen. Die Leistungen sind generelle Hinweise, Anträge werden nicht an eine Versicherung gesendet.
- Das Browser-Passwort schützt ruhende App-Daten, schützt aber nicht gegen eine kompromittierte Gerätesoftware oder aktive Browser-Erweiterungen.

## Updates für Entwickler

1. `app.js` Versionskonstante, `version.json` und Service Worker Cache-Key (`sw.js`) gemeinsam erhöhen.
2. Die geänderten **öffentlichen** Dateien auf GitHub Pages hochladen.
3. In der App `Backup & Updates > Update suchen` und ggf. `Update installieren` ausführen.

## Technisches

Statische, externe-bibliotheksfreie HTML/CSS/JS-Anwendung. Kein Build-System nötig. Veröffentlichen über HTTPS. Keine personenbezogenen Daten im öffentlichen Projektordner.

Stand: 18.10.2026. Kein zertifiziertes Medizinprodukt.

## Version 1.2.0 (18.10.2026)

- Neue **PSA-Schnelleingabe** mit Gesamt-PSA, freiem PSA und bei vorhandenen Werten automatisch berechnetem Verhältnis. Kein pauschaler Grenzwert.
- **Patientenabgleich bei Importen:** Ein Import muss den Patienten namentlich nennen; eine abweichende Identität oder ein widersprechendes Geburtsdatum werden abgewiesen. Anonyme Laborimporte werden abgewiesen.
- Bereits importierte Laborwerte können nach Abgleich mit dem Original bestätigt/korrigiert werden.
- Die Blutzucker-Kurven verbinden jetzt Werte derselben Messsituation. Puls erscheint zusätzlich in der Monats- und Jahresstatistik.
- **Keine Befunde einer anderen Person** in öffentlichen App-Dateien oder der ausgelieferten privaten Ralf-Datei.
- Versionsnummer in App, Versionsdatei und Service-Worker-Cache konsistent.

**Privatsphäre:** Die Datei mit persönlichen Notfalldaten und Laboren ist absichtlich *nicht* Bestandteil dieses ZIP-Archivs. Sie muss ausschließlich innerhalb der laufenden App über die lokale Importfunktion verarbeitet werden. Das JSON ist vor dem Import noch nicht verschlüsselt; entsprechend vertraulich behandeln und nach Erzeugung eines verschlüsselten Backups sicher verwahren.
