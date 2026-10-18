# VitalKompass 1.8.1 – Gesamtupdate 1.6 bis 1.8

## Auslieferungsstatus
- **Einsatzbereit als Webapp** nach erfolgreichem Update-Test auf deinem iPhone: 7-Tage-Blutdruckprofil, Datenqualität-Check, Vorperiodenvergleich, Labortrend, Arztbericht-PDF, Senioreneinstellung, persönlicher Notfallplan, Kalenderdatei (.ics) und Backup-Prüfung.
- **Beta / am echten Messgerät nicht geprüft:** Import der AES-256-GCM-geschützten Dateien aus einer selbst eingerichteten ESP32-C6-Bridge; keine direkte BLE-Kommunikation mit iPhone-Safari, keine Hintergrundsynchro. Externe Firmware ist kein Teil des öffentlichen Webapp-Updates und muss separat auf einem Mac kompiliert und getestet werden.
- **Nicht enthalten:** Vollständige Arzneimittel-Wechselwirkungsdatenbank, medizinisch zertifizierte Diagnose/Notfall-Triage, Cloud- oder Push-Benachrichtigungen, vollständige Bildschirm-/Touch-Firmware für Waveshare CO5300/CST9220.

## Sicherheit
- GitHub-Paket enthält nur öffentliche Anwendungsdateien, keine eigenen/Patienten-Messdaten, keine persönlichen Transfer-Schlüssel oder WLAN-Passwörter.
- Bestehende IndexedDB `vitalkompass-secure-v1` bleibt erhalten; ältere Datensätze werden bei Entsperrung um neutrale Standardfelder ergänzt. Keine automatische Datensatzlöschung.
- Messungen aus ESP32-Export werden zunächst als nicht geprüft gespeichert. Vor der Übernahme den korrekten Patienten selbst bestätigen.
- PDFs und ICS-Dateien sind **nicht verschlüsselt**; vertraulich speichern. Die direkt auf dem ESP32 per HTTP angebotene Datei muss selbst bereits durch AES-256-GCM verschlüsselt sein. Nicht in fremden WLANs verwenden.
- Mit falschem Passwort gibt es keinen Datenrettungsweg – **vor Update verschlüsseltes Backup erstellen und außerhalb von Safari sicher verwahren**. Safari-Website-Daten NICHT löschen.
- Die App ist keine zertifizierte medizinische Entscheidungssoftware. Zu medizinischen Beschwerden wird eine ärztliche Beurteilung benötigt, bei akuter Gefahr 112.

## Installation
1. In VitalKompass 1.5.3 unter Backup & Updates eine verschlüsselte Sicherung erstellen und die Datei außerhalb des Browsers aufbewahren.
2. Die Dateien der **Update-ZIP** entpacken und im Stammverzeichnis des Repositories hochladen. Betroffen: `app.js`, `vkpro.js` (NEU), `index.html`, `style.css`, `sw.js`, `version.json`, `README.md`.
3. Über GitHub Pages öffnen. Nach Bedarf in Backup & Updates „Update suchen“ und „Installieren“. Prüfen: Version 1.8.0, Analyse Pro, Vorsorge & Notfallplan, Blutzucker ESP32-Beta.
4. Backup-Verifikation im Menü Backup & Updates testen. Danach Messwert-Vorschau kontrollieren.

## Einfache zeitliche Regeln
- Das 7-Tage-Blutdruckprofil benutzt die letzten sieben Kalendertage: Vormittag vor 12 Uhr, Abend ab 17 Uhr; Messungen dazwischen sind dort ausgeschlossen (bleiben gespeichert). Das stellt **keinen vollständigen ärztlichen Messstandard** dar.
- Vergleiche der letzten 30 Tage mit den davorliegenden 30 Tagen sind rein beschreibend; Datenlage bei weniger als drei bestätigten Werten je Zeitraum unzureichend.
- Die Laborwerte werden nur bei gleichem Namen **und identischer Einheit** miteinander verglichen.
- Ein Übereinstimmungsalarm von Medikament und Allergie ist nur ein **einfacher Textvergleich** – kein sicherer Ausschluss von Interaktionen.
- Kalenderexport (.ics) benötigt einen manuellen Import auf dem iPhone; automatische Erinnerungen bei geschlossener Webapp sind nicht garantiert.

## Grenzen beim Geräteimport
Das vorhandene ESP32-Firmware-BETA-Paket ist Entwicklungsquellcode, kein geprüftes fertiges Produkt und nicht automatisch kompatibel mit jeder Hardware-Revision des Waveshare ESP32-C6 Touch AMOLED 2.16. Kein Live-HTTPS-Zugriff von GitHub Pages auf das Geräte-AP zugesagt. Erst am echten Gerät über Mac kompilieren, koppeln, auslesen und mit Testwerten validieren. 

## Sicherheitspatch 1.8.1 (18.10.2026)

- Patientenprofil: Telefon- und Arztangaben werden HTML-sicher ausgegeben.
- PDF-Ausgabe: Die unverschlüsselte HTML-Zwischenkopie wird sofort entfernt. PDF-Objekt-URL und Dialog werden nach „Schließen“, „Sperren“ oder „Daten löschen“ freigegeben. Im iPhone für Ausdruck „PDF öffnen“ und den PDF-Betrachter nutzen.
- Backup: Vor Export und Sperren wird auf noch laufende lokale Speichervorgänge gewartet. Wiederherstellung prüft bei vorhandenen Angaben zusätzlich das Geburtsdatum.
- Privatimport: Eingaben werden in einer Arbeitskopie verarbeitet und nur nach erfolgreicher Validierung verschlüsselt übernommen.
- Importe erlauben nur erwartete Felder in Messwerten/Medikamenten/Laboren; BP-Puls wird zusätzlich validiert.
- Diagramme aggregieren bestätigte und unbestätigte Werte nicht länger zu einer gemeinsamen Zahl.
- Offline-Cache: „vkpro.js“ wird in Onlinebetrieb wie andere App-Dateien bevorzugt aus dem Netz aktualisiert.
- **Nicht** auf einem echten iPhone oder ESP32 getestet. Keine zertifizierte medizinische Software.

Installation: Unter Backup & Updates zuvor ein verschlüsseltes Backup erstellen, dann die geänderten öffentlichen Dateien ins Root des GitHub-Repos hochladen. Bestehende private Safari-/IndexedDB-Daten nicht löschen.
