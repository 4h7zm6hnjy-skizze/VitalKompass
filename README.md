# VitalKompass 1.8.3 – Durchgezogene Messwertlinien und farbliches Gesundheitsjournal

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
1. In der derzeit installierten VitalKompass-Version unter Backup & Updates eine verschlüsselte Sicherung erstellen und die Datei außerhalb des Browsers aufbewahren.
2. Die fünf Dateien der **1.8.2-Update-ZIP** entpacken und im Stammverzeichnis des Repositories hochladen: `app.js`, `style.css`, `sw.js`, `version.json`, `README.md`. Andere Dateien bleiben erhalten.
3. Über GitHub Pages öffnen. Nach Bedarf in Backup & Updates „Update suchen“ und „Installieren“. Prüfen: Version 1.8.2, farbige Navigation, Analyse Pro, Vorsorge & Notfallplan.
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


## Version 1.8.2 – farblich strukturierte Oberfläche

- Türkis = Blutzucker und Symptome; Blau = Blutdruck und Analysen; Violett = Labor, GdB und Nachweise; Orange = Medikamente und Einnahmen; Grün = Vorsorge und Termine; Rot kennzeichnet den Notfallpass.
- Bereichsfarben dienen nur der Navigation. Medizinische Warnhinweise verwenden gesonderte, beschriftete Statusfelder; keine Einstufung aus der Dekorationsfarbe ableiten.
- Navigation mit klarer aktiver Markierung, Übersichtskarten, farblicher Bereichsüberschrift und farbiger Startseiten-Schnellnavigation.
- Responsive Darstellung für iPhone-Portrait; Senior-Modus bleibt vorhanden. Kein externes Icon-/Schrift-/Tracking-CDN.
- Keine Änderung an bestehendem lokalem Datenmodell, Backupformat oder Passwortverfahren.
- Vor der Installation verschlüsseltes Backup erstellen. Nur die 5 öffentlichen Update-Dateien in den GitHub-Repository-Stamm laden. Keine privaten Gesundheitsdaten hochladen.
- iPhone-Safari-Test mit echten Patientendaten steht aus; Ergebnis der synthetischen Browserprüfungen siehe Prüfbericht.


## Version 1.8.3 – klare Linienführung

- Blutzucker-, Blutdruck- und Pulsdiagramme zeichnen **alle tatsächlichen Messwerte als durchgezogene Kurven**; im bisherigen Stand wurden ungeprüfte Werte gestrichelt verbunden.
- Referenz-/Grenzlinien bleiben **gestrichelt** und sind in der Legende ausdrücklich benannt.
- Ungeprüfte Messwerte behalten eine eigene Kennzeichnung durch **offene Kreise** und ein Tooltip. Sie werden durch die neue Linienart nicht als bestätigt eingestuft.
- Laborverläufe bleiben durchgezogen; ungeprüfte Laborpunkte erscheinen ebenfalls als offene Kreise. Für Laborparameter werden keine pauschalen Referenzlinien erfunden.
- Die Linien sind zur besseren Lesbarkeit geringfügig verstärkt. Auch in aus der App erzeugten PDF-Berichten übernimmt der SVG-Konverter die Unterscheidung anhand der Linienart.
- **Keine Änderung** am privaten Datenformat, der Verschlüsselung, gespeicherten Gesundheitswerten, der medizinischen Auswertungslogik oder der ESP32-Beta-Funktion.
- Aktualisierung: Verschlüsseltes Backup außerhalb des Browsers aufbewahren, dann `app.js`, `style.css`, `sw.js`, `version.json`, `README.md` entpackt ins Stammverzeichnis hochladen.
- Prüfung am echten iPhone weiterhin erforderlich.


## VitalKompass 2.0.2 (29.10.2026) – 7 Tage und Ampel

- Diagramme: Tag / Letzte 7 Tage / Woche / Monat / Jahr / 10 Jahre. Die rollierenden sieben Tage umfassen heute und die sechs vorigen Kalendertage; die Woche beginnt am Montag.
- Punkte: grün im Orientierungs-/eigenen Referenzbereich, gelb auffällig, rot deutlich auffällig, grau nicht sicher einordenbar. Die Linienfarben bleiben zur Trennung von Messreihen erhalten.
- Blutdruck, Puls und Blutzucker: bestehende Nutzergrenzen. Gewicht: grobe BMI-Orientierung nur für Erwachsene mit hinterlegter Körpergröße. Peak-Flow ohne persönlichen Bestwert bleibt grau. Laborwert-Ampel nur bei vorhandenen Laborreferenzgrenzen; kein universeller Wert wird erfunden.
- Die Einordnung stellt keine Diagnose oder Entwarnung dar. Aggregierte Tages-/Wochen-/Monatspunkte sind Durchschnittswerte und können einzelne Extremwerte verdecken.
- Keine Änderung am Datenmodell, Verschlüsselungsalgorithmus, vorhandenen Patientenwerten oder Berichtszeitraum. Vor dem Update extern ein verschlüsseltes Backup anlegen und Safari-Website-Daten keinesfalls löschen.


## Version 2.0.3 – Slide-out-Menü und automatische Körpermaße

- Menü oben links öffnet ein gruppiertes Seitenmenü; Bereiche sind groß beschriftet und durchsuchbar. Es schließt durch Auswahl, Schließen-Taste, den dunklen Hintergrund oder Escape.
- Die untere Schnellnavigation zeigt nur Diabetes, Prostata, Blutdruck. Startseite bietet sechs häufig verwendete Aktionen, alle weiteren Punkte sind im Menü erreichbar.
- BMI=Gewicht(kg)/Körpergröße(m)^2; Körperoberfläche nach Mosteller = Quadratwurzel aus (Größe(cm)×Gewicht(kg)/3600). Neueste gespeicherte Messung hat Vorrang vor dem Profilgewicht. Vorschau aktualisiert sich beim Tippen oder nach dem Speichern, speichert aber keine Werte selbst.
- Vor Installation verschlüsseltes Backup erstellen. Safari-Websitedaten nicht löschen. Es werden nur öffentliche Programmdateien verändert, keine persönlichen Patientendaten.
- Browser-Syntax und strukturelle Regressionen im GitHub-Workflow; echter iPhone-Safari-Test ist noch erforderlich.


## VitalKompass 2.0.5 – Blutsauerstoff und Perfusionsindex
- Neuer gemeinsamer Menüpunkt „Blutsauerstoff & Durchblutung (PI)“: SpO₂ in Prozent (Pflicht), PI in Prozent (optional), Datum/Uhrzeit, Messsituation (Raumluft/Sauerstoff), Notiz.
- Werte lokal AES-GCM verschlüsselt; bearbeiten/löschen. Alter Datensatz und Passwortspeicher bleiben unverändert.
- Zwei unabhängige SVG-Diagramme: Tag, letzte 7 Tage, Woche, Monat, Jahr, 10 Jahre; zeitliche Mittelwerte sind entsprechend gekennzeichnet.
- SpO₂-Ampel dient der allgemeinen Orientierung (≥95, 93–94, ≤92 %); individuelle klinische Zielwerte können abweichen. PI ohne universelle Ampelschwellen.
- Beide Werte in Monats-/Jahresstatistik und separat auswählbaren PDF-Berichten enthalten. PDF-Export ist unverschlüsselt; nur sicher speichern.
- Vor dem Installieren Backup speichern, Safari-Website-Daten nicht löschen. Kein direkter Hardware-Datenaustausch.


## VitalKompass 2.0.5 – Krankenhaus-Scans und kompakte Berichte
- Krankenhausaufenthalte mit Aufnahme/Entlassung, Krankenhaus, Fachabteilung, Diagnosen, Behandlung, Nachsorge und iPhone-Kamerascan oder PDF-Upload. Originaldokumente bleiben verschlüsselt auf dem Gerät. Kein automatisches OCR.
- Monats-/Jahresberichte: diagrammgestützte Messarten mit Minimum, Mittelwert und Maximum; keine doppelten Einzeltabellen.
- Beschriftungen im SVG mit Kollisionsschutz und Ausdünnung bei vielen Messpunkten.
- SpO₂ und PI im Bericht und PDF sowie Klinikaufenthalte als Berichtsthema.
