#!/usr/bin/env python3
"""VitalKompass 1.9.1: narrow, source-verified weight input hotfix.

Only program source files are read. Private data, backups and IndexedDB are not accessed.
Execute from the repository root on the GitHub Actions runner.
"""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "GitHub_Upload_1.9.1"
SOURCE_SHAS = {
    "app.js": "bac692cf48d478c584034d074e10490472080087",
    "style.css": "78346f4c474be90f242eb8edae84961d838cceb2",
    "sw.js": "cca01077fcbd1951276dd05bd36e2eaa5e298deb",
    "version.json": "bdf877c91aaadb32bda9793d99f4b72ecfa1f7b0",
}


def blob_sha(content: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()


def once(src: str, old: str, new: str) -> str:
    count = src.count(old)
    if count != 1:
        raise RuntimeError(f"Sicherheitsstopp: Anker {old[:100]!r} kommt {count}x statt genau 1x vor.")
    return src.replace(old, new, 1)


def load_source(filename: str) -> str:
    raw = (HERE / filename).read_bytes()
    sha = blob_sha(raw)
    if sha != SOURCE_SHAS[filename]:
        raise RuntimeError(f"Sicherheitsstopp: {filename} hat sich inzwischen verändert (SHA {sha}). Keine Aktualisierung.")
    return raw.decode("utf-8")


def patch_app(src: str) -> str:
    src = once(src, "/* VitalKompass v1.9.0", "/* VitalKompass v1.9.1")
    src = once(src, "const VERSION='1.9.0'", "const VERSION='1.9.1'")
    src = once(src, "let weightMealFilter='all';", "let weightMealFilter='all';\nlet weightSaveInProgress=false;")
    # HTML browser validation on iOS sometimes rejects German decimal commas before submit.
    # Use text+decimal keyboard so the JavaScript parser handles both 130,5 and 130.5.
    src = once(src, '<form id="weight-form"><input name="id" type="hidden">',
               '<form id="weight-form" novalidate><input name="id" type="hidden">')
    src = once(src,
        '<input name="kg" type="number" min="20" max="400" step="0.1" inputmode="decimal" required placeholder="z. B. 130,0">',
        '<input name="kg" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" required placeholder="z. B. 130,5" aria-describedby="weight-input-help">')
    src = once(src,
        '<div class="actions"><button class="primary" type="submit">Gewicht speichern</button></div></form>',
        '<p id="weight-input-help" class="section-note">Eingabe mit Komma oder Punkt möglich, z. B. 130,5 oder 130.5 kg.</p><div class="actions"><button class="primary" type="submit">Gewicht speichern</button></div><p id="weight-save-feedback" class="vk-save-feedback" role="status" aria-live="polite"></p></form>')
    src = once(src, "if(form.id==='weight-form'){", "if(form.id==='weight-form'){\n if(weightSaveInProgress)return;")
    src = once(src,
        "if(!Number.isFinite(kg)||kg<20||kg>400)throw Error('Bitte ein plausibles Körpergewicht zwischen 20 und 400 kg eingeben.');",
        "if(!Number.isFinite(kg)||kg<20||kg>400)throw Error('Bitte das Gewicht als Zahl eingeben, z. B. 130,5 (erlaubt: 20 bis 400 kg).');")
    src = once(src,
        "const at=data.weights.findIndex(x=>x.id===entryId);\n if(entryId&&at<0)throw Error('Dieser Gewichtseintrag wurde nicht gefunden.');\n if(at>=0)data.weights[at]=entry;else data.weights.push(entry);\n syncProfileWeight();await save();renderMain();toast('Gewicht verschlüsselt gespeichert.');return;",
        "const at=data.weights.findIndex(x=>x.id===entryId);\n if(entryId&&at<0)throw Error('Dieser Gewichtseintrag wurde nicht gefunden.');\n const previousWeights=data.weights.map(x=>({...x})),previousProfileWeight=data.profile.weight;\n weightSaveInProgress=true;\n try{\n  if(at>=0)data.weights[at]=entry;else data.weights.push(entry);\n  syncProfileWeight();\n  await save();\n }catch(error){data.weights=previousWeights;data.profile.weight=previousProfileWeight;throw error}\n finally{weightSaveInProgress=false}\n renderMain();toast('Gewicht gespeichert: '+nf(entry.kg,1)+' kg.');return;")
    # Visible validation feedback, even when native browser validation formerly swallowed submit.
    src = once(src,
        "}catch(err){alert(err.message||'Fehler beim Speichern')}}",
        "}catch(err){const message=err.message||'Fehler beim Speichern';if(form.id==='weight-form'){const target=$('#weight-save-feedback');if(target){target.textContent=message;target.classList.add('vk-save-error');target.scrollIntoView({block:'nearest'});}}alert(message)}}")
    return src


def patch_css(src: str) -> str:
    return src + "\n/* VitalKompass 1.9.1: iPhone-Eingabefeedback für Körpergewicht */\n#weight-form input[name=\"kg\"]{font-size:16px;min-height:48px}\n.vk-save-feedback{min-height:1.25em;margin:8px 0 0;color:#14624d;font-weight:600}\n.vk-save-feedback.vk-save-error{color:#a12c36}\n"


def patch_sw(src: str) -> str:
    src = once(src, "/* VitalKompass 1.9.0:", "/* VitalKompass 1.9.1:")
    return once(src, "const CACHE='vital-kompass-1.9.0-komplett';", "const CACHE='vital-kompass-1.9.1-gewicht-fix';")


def main():
    original = {filename: load_source(filename) for filename in SOURCE_SHAS}
    current = json.loads(original["version.json"])
    if current["version"] != "1.9.0":
        raise RuntimeError("Nur für VitalKompass 1.9.0 geeignet. Bitte neuen Quellcode prüfen.")
    new = {
        "app.js": patch_app(original["app.js"]),
        "style.css": patch_css(original["style.css"]),
        "sw.js": patch_sw(original["sw.js"]),
    }
    current["version"] = "1.9.1"
    current["released"] = "2026-10-20"
    current["notes"] = ("iPhone-Gewichtseingabe repariert: Dezimalkomma und Dezimalpunkt, "
        "sichtbare Fehlermeldungen, Speicherschutz gegen Doppeltippen und Datenrollback bei Speicherfehlern. "
        "Keine automatische Sperre; Daten bleiben verschlüsselt.")
    new["version.json"] = json.dumps(current, ensure_ascii=False, indent=2) + "\n"
    OUT.mkdir(exist_ok=True)
    for name, contents in new.items():
        (OUT / name).write_text(contents, encoding="utf-8")
        print("Erstellt:", OUT / name)
    print("Fertig. Quellcode wurde nur geprüft; die Originaldateien blieben unverändert.")


if __name__ == "__main__":
    main()
