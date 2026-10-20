VitalKompass 1.8.4 – Gewichtstagebuch und Backup-Layout
Stand: 20.10.2026

WAS DIE ERWEITERUNG UMFASST
- Tägliche Gewichtseingabe (kg mit einer Nachkommastelle) mit Datum, Uhrzeit und Notiz.
- Sechs auswählbare Situationen: vor/nach Frühstück, Mittagessen, Abendessen.
- Gewichtsdiagramm in den fünf Zeiträumen Tag, Woche, Monat, Jahr und 10 Jahre.
- Durchgezogene Gewichtskurve; bei Tagesansicht alle einzelnen Werte, pro Woche/Monat je ein täglicher Messpunkt, in der Jahresansicht Wochenmittel und in der 10-Jahres-Ansicht Monatsmittel.
- Ergänzung der Monats- und Jahresstatistik um Gewicht, Mittel, Minimum, Maximum und Veränderung, einschließlich Tabelle und Kurve.
- Zwei visuell getrennte Karten für iPhone-Backup-Erstellung und Backup-Import aus der iPhone-App „Dateien“.
- iPhone-Sicherung in zwei klaren Schritten: (1) Backup verschlüsselt vorbereiten, (2) im iOS-Teilen-Menü „In Dateien sichern“ wählen. Alternativ Datei herunterladen.
- Die Teilen-Schaltfläche wird nach der Vorbereitung direkt durch eine neue Berührung ausgelöst, damit Safari das iOS-Teilen-Menü öffnen kann.
- Wiederherstellung nur mit Backup-Passwort, Formatprüfung und Überschreibungsbestätigung.
- Alte Backups aus Version 1.8.3 bleiben einlesbar. Bereits vorhandene Profildaten bleiben erhalten.

WICHTIG: WAS DIE DATEIEN SIND
Dies ist ein Update-Generator für den Mac – NOCH KEIN bereits installiertes App-Update.
GitHub hat den direkten Schreibzugriff der KI verweigert (HTTP 403).
Der Generator lädt deshalb ausschließlich die öffentlichen Programmdateien deines GitHub-Repositories auf deinen Mac und erzeugt daraus die vier aktualisierten Upload-Dateien.

IPHONE-BACKUP IN DER VITALKOMPASS-WEBAPP (NACH DEM UPDATE)
1. VitalKompass auf dem iPhone in Safari oder über die Home-Bildschirm-Verknüpfung öffnen und anmelden.
2. „Backup & Updates“ öffnen.
3. „1. Verschlüsseltes Backup vorbereiten“ tippen.
4. „In Dateien sichern (iPhone)“ tippen. Im iOS-Teilen-Menü „In Dateien sichern“ auswählen.
5. Ordner in „Auf meinem iPhone“ oder iCloud Drive selbst auswählen und bestätigen. Eine Speicherung auf iCloud Drive erfolgt nur, wenn sie im Teilen-Menü ausgewählt wird.
6. In der iPhone-App „Dateien“ prüfen, dass die .json-Datei tatsächlich existiert.
7. Bei Problemen mit der Teilen-Funktion alternativ „Alternative: Datei herunterladen“ tippen und Downloads in „Dateien“ kontrollieren.
8. Unter „Backup importieren“ kannst du auf dem iPhone dieselbe Datei wieder auswählen. ACHTUNG: Dieser Vorgang ersetzt den bisherigen Datenbestand nach erfolgreicher Entschlüsselung und zwei Bestätigungen.

Das Backup selbst braucht KEINEN Mac und keine zusätzliche iOS-App. Der Mac wird nur für die technische Vorbereitung des GitHub-App-Updates benötigt. Der aktuelle GitHub-Code wurde wegen HTTP 403 nicht direkt geändert.

ANLEITUNG AUF DEM MAC
1. ZIP entpacken.
2. "Update_1.8.4_erstellen.command" doppelklicken.
   Falls macOS die Datei blockiert: Terminal öffnen, in den entpackten Ordner wechseln und ausführen:
   python3 prepare_update.py
3. Benötigt werden eine Internetverbindung und Python 3 auf dem Mac. Der Generator kontrolliert, dass die GitHub-Ausgangsversion 1.8.3 unverändert ist; bei Abweichung bricht er zur Sicherheit ab.
4. Nach Erfolg im erzeugten Ordner "GitHub_Upload_1.8.4" vier Dateien finden:
   app.js
   style.css
   sw.js
   version.json
5. Auf GitHub das Repository öffnen:
   https://github.com/4h7zm6hnjy-skizze/VitalKompass
6. Die VIER EINZELDATEIEN, nicht die ZIP, ins Stammverzeichnis des Repositories hochladen und die vorhandenen Dateien gleichen Namens ersetzen. Auf "Commit changes" klicken.
7. Nach Veröffentlichung VitalKompass neu laden. In den Einstellungen / Backup & Updates die neue Versionsnummer kontrollieren.

VOR DEM UPDATE
Die aktuelle Version 1.8.3 bietet bereits einen verschlüsselten Backup-Download. Nutze diesen VOR dem Update und kontrolliere in der iPhone-App „Dateien“, ob die Sicherung vorhanden ist. Das neue Teilen-Menü ist erst nach Veröffentlichung dieses Updates verfügbar.
Keine Gesundheitsdaten, Passwörter oder Backup-Dateien in ein öffentliches GitHub-Repository hochladen!

TECHNIK / STATUS
- Daten bleiben im bestehenden lokal verschlüsselten IndexedDB-Speicher.
- Die Datenmigration ergänzt bei älteren Daten das leere Feld "weights"; historische Gewichtsmessungen werden nicht erfunden.
- Sicherheitsstopp, wenn GitHub-Quellcode seit der erwarteten Version verändert wurde.
- Der neue JavaScript-Code für die fünf Ansichten wurde in einer isolierten Testumgebung geprüft.
- Vollständige End-to-End-Tests auf deinem iPhone sind noch nicht durchgeführt; dafür muss das Paket erzeugt und veröffentlicht werden.
- Die aktuelle Datenwiederherstellung ERSETZT alle vorhandenen Einträge; kein Zusammenführen.

PRÜFUNG / STATUS DES NEUEN IPHONE-WEGS
- Der Generatorskript-Code besteht die Python-Syntaxprüfung. Die eingefügten JavaScript-Bausteine bestehen eine isolierte Node.js-Syntaxprüfung.
- Ein vollständiger Lauf des Generators ist in der aktuellen Ausführungsumgebung ohne externen Netzwerkzugriff nicht möglich. Er überprüft auf deinem Mac vor dem Schreiben die GitHub-Basisdateien und den JavaScript-Syntaxstatus.
- Die iPhone-Teilen-Funktion wurde noch nicht auf einem realen iPhone ausgeführt; Safari-Unterstützung und die tatsächlich erfolgte Dateispeicherung sind vor Ort zu prüfen.
