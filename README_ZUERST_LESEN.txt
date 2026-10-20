VitalKompass 1.9.1 – gezielte Reparatur der Gewichtseingabe auf dem iPhone

PROBLEM
Das bisherige Feld verwendet HTML input type="number" und zeigt zugleich die deutsche Kommaeingabe als Beispiel. Das kann insbesondere in Safari die Absendung verhindern, bevor eine Fehlermeldung erscheint. Die genaue Ursache auf deinem iPhone kann erst durch einen Praxistest bestätigt werden.

KORREKTUREN
- Deutsches Dezimalkomma und Punkt akzeptieren: 130,5 / 130.5.
- Feld erhält weiterhin die iPhone-Dezimaltastatur.
- Keine stille Blockierung durch die HTML-Zahlenfeldvalidierung.
- Klare und sichtbare Fehlermeldung direkt am Eingabeformular.
- Doppeltes Tippen während eines laufenden Speichervorgangs blockieren.
- Wenn verschlüsseltes Speichern scheitert, wird eine nur vorläufig geänderte Gewichtsangabe im Arbeitsspeicher zurückgenommen.
- Versionsnummer 1.9.1, neuer Offline-Cache.
- KEINE automatische Sperre. Manuelle Sperre bleibt.
- Keine Änderungen an IndexedDB-Schlüsseln, Backup-Format oder bestehenden Gesundheitsdaten.

IPHONE-INSTALLATION
1. VORHER: Verschlüsseltes VitalKompass-Backup erstellen und in iOS-Dateien kontrollieren.
2. ZIP in der iPhone-Dateien-App entpacken.
3. Drei Dateien in das GitHub-Repository hochladen:
   - fix_weight_191.py im STAMMVERZEICHNIS (neben app.js).
   - test_weight_191.py im STAMMVERZEICHNIS.
   - vitalkompass-191.yml in den Pfad .github/workflows/
4. Auf GitHub Commit changes drücken. Ein GitHub-Actions-Workflow soll die App-Dateien nach erfolgreicher Prüfung ersetzen.
5. GitHub Actions und Pages prüfen. Danach auf dem iPhone VitalKompass 1.9.1 laden.
6. Probe: 130,5 und 130.5 mit Messzeitpunkt speichern, Bearbeiten und Löschen ausprobieren.

WICHTIG
Nur Programmdateien in das öffentliche GitHub-Repository laden – NIE Backups, Patientenangaben, Passwörter oder Gesundheitsdokumente.
Die vorbereiteten Dateien sind noch KEIN installiertes Update. GitHub-Schreibzugriff ist für diese Verbindung nicht freigegeben. Ein echter iPhone-Praxistest muss nach dem Upload erfolgen.
