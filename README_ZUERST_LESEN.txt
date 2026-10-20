VitalKompass 1.9.0 – gemeinsames Update aus 1.8.5 und 1.9.0

KEINE AUTOMATISCHE SPERRE. Die bestehende manuelle Sperrfunktion bleibt erhalten.

INHALTE
- Bugfix: Gewicht im Profil wird nach dem Löschen des letzten Tagebucheintrags korrigiert.
- Backup-Prüfung und Restore-Limit auf 32 MB erhöht. Backup bleibt verschlüsselt.
- Feste iPhone-Schnellnavigation: Start, Gewicht, Asthma, Medikamente, Statistik.
- Durch Antippen der Diagrammpunkte lassen sich Werte anzeigen.
- Gewichtsziel, Startgewicht und Fortschrittsanzeige.
- Asthma-Tagebuch: Atemnot 0–10, dokumentierte Bedarfsanwendungen,
  Peak-Flow, FEV1 % Soll, Trigger, Notizen, Trend und Monats-/Jahresbericht.
- Medikamentenvorrat und manuelle Bestandsgrenzen.
- Erinnerungen für Messungen, vorhandener iPhone-Kalenderexport über ICS.
- Persönliches Dashboard und 30-/90-Tage-Vergleiche.
- Arztberichte: Zeitraum/Bereiche auswählen und PDF lokal erstellen.
- Keine automatische Sperre, keine externen Analytics, keine echten Push-Zusagen.

INSTALLATION AUF DEM IPHONE OHNE MAC
1. Zuerst VitalKompass 1.8.4 öffnen und ein verschlüsseltes Backup in Dateien
   sichern. Prüfen, dass die Datei tatsächlich vorhanden ist.
2. Diese ZIP-Datei in der iPhone-App Dateien entpacken.
3. Auf GitHub das Repository 4h7zm6hnjy-skizze/VitalKompass öffnen.
4. Aus dem entpackten Hauptordner diese DREI Textdateien in das
   Stammverzeichnis des GitHub-Repositories hochladen:
     upgrade_vitalkompass_190.py
     vk190_features.js
     vk190_styles.css
   Commit changes bestätigen. Noch nicht die Workflow-Datei ausführen.
5. In GitHub: Add file > Create new file. Als Dateinamen genau
   .github/workflows/vitalkompass-190.yml
   angeben. Den Inhalt aus der gleichnamigen Datei im entpackten
   Unterordner .github/workflows kopieren und einfügen.
   Commit changes bestätigen.
6. GitHub Actions startet automatisch, testet JavaScript und erzeugt
   anschließend die 1.9.0-App-Dateien. Unter Actions den grünen Haken abwarten.
7. In der Webapp nach Updates suchen bzw. neu öffnen. Anschließend prüfen,
   ob VitalKompass 1.9.0 angezeigt wird.

GitHub-Code und GitHub Pages sind öffentlich. KEINE Gesundheitsdaten,
Passwörter, Backups, Arztberichte oder sonstige privaten Dateien hochladen!
Die GitHub-Aktion braucht für das Repository Schreibzugriff über
Settings > Actions > General > Workflow permissions > Read and write permissions.
Falls fehlende Berechtigung, bitte zuerst die Einstellung überprüfen.

TECHNIK UND SICHERHEIT
- Der Updater verändert nur vier öffentliche Programmdateien.
- Er prüft die erwarteten SHA-Dateistände aus 1.8.4 und stoppt bei
  Änderungen statt Daten oder Programmdateien ungeprüft zu überschreiben.
- Der iPhone-Speicher/IndexedDB bleibt unberührt; die neuen Felder werden
  beim Entsperren ergänzt. Bestehende Backups bleiben einlesbar.
- Die bestehende manuelle App-Sperre bleibt unverändert.
- Keine Garantie für Hintergrund-Benachrichtigungen ohne laufende Webapp.
- Syntax und isolierte Funktionstests bestanden. Ein vollständiger
  realer iPhone-End-to-End-Test ist erst nach der Veröffentlichung möglich.
