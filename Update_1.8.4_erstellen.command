#!/bin/bash
# Startet ausschließlich einen lokalen Code-Download und erstellt das GitHub-Upload-Paket.
# Es werden keinerlei Gesundheitsdaten oder iPhone-Speicher gelesen.
cd "$(dirname "$0")" || exit 1
printf '\nVitalKompass 1.8.4 – GitHub-Uploaddateien erstellen\n'
printf '==================================================\n\n'
if ! command -v python3 >/dev/null 2>&1; then
  printf 'Python 3 ist auf diesem Mac nicht verfügbar.\n'
  printf 'Bitte Python 3 installieren oder den Befehl nach der Installation erneut starten.\n\n'
  read -r -p 'Eingabetaste zum Schließen ...' ignore
  exit 1
fi
python3 "$(dirname "$0")/prepare_update.py"
status=$?
printf '\n'
if [ "$status" -eq 0 ]; then
  printf 'Fertig: Der Ordner GitHub_Upload_1.8.4 und die ZIP-Datei wurden erstellt.\n'
  printf 'Lade die vier enthaltenen Dateien in das Stammverzeichnis deines GitHub-Repositories hoch.\n'
  open "$(dirname "$0")/GitHub_Upload_1.8.4" 2>/dev/null || true
else
  printf 'Die Erstellung wurde gestoppt. Es wurden keine vorhandenen Repository-Dateien verändert.\n'
  printf 'Prüfe die Fehlermeldung oben.\n'
fi
printf '\n'
read -r -p 'Eingabetaste zum Schließen ...' ignore
exit "$status"
