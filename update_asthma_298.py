#!/usr/bin/env python3
"""Patch an existing Asthma- repo in place to v2.9.8.
No local patient data, encrypted IndexedDB records or user settings are modified.
"""
import argparse
import json
import re
from pathlib import Path

VERSION = '2.9.8'
SCRIPT_TAG = '<script defer src="./physiosport298.js?v=2.9.8"></script>'


def patch_repo(root):
    root = Path(root)
    required = ('index.html', 'app.js', 'sw.js', 'version.json', 'physiosport298.js')
    missing = [name for name in required if not (root / name).is_file()]
    if missing:
        raise ValueError('Erforderliche App-Dateien fehlen: ' + ', '.join(missing))

    updates = {}
    html = (root / 'index.html').read_text(encoding='utf-8')
    # The existing HTML may contain the script before <head> and inside a broken </head ...>.
    scripts = re.compile(r'<script\b[^>]*\bsrc\s*=\s*["\'](?:\./)?physiosport298\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\s*', re.IGNORECASE)
    fixed = scripts.sub('', html)
    fixed = re.sub(r'</head\s+>', '</head>', fixed, flags=re.IGNORECASE)
    # Safety: never rewrite an unexpected file structure.
    if fixed.count('<head>') != 1 or fixed.count('</head>') != 1 or fixed.count('<body>') != 1:
        raise ValueError('index.html: HTML-Kopf oder Body nicht eindeutig; automatische Reparatur abgebrochen')
    if fixed.find('<head>') > fixed.find('</head>') or fixed.find('</head>') > fixed.find('<body>'):
        raise ValueError('index.html: Reihenfolge von head/body inkonsistent')
    fixed = fixed.replace('</head>', SCRIPT_TAG + '\n</head>', 1)
    if fixed.count('physiosport298.js') != 1:
        raise ValueError('index.html: PhysioSport-Script nicht eindeutig')
    updates['index.html'] = fixed

    app = (root / 'app.js').read_text(encoding='utf-8')
    version_pattern = r"(const VERSION\s*=\s*['\"])(\d+\.\d+\.\d+)(['\"]\s*;)"
    app2, count = re.subn(version_pattern, lambda m: m[1] + VERSION + m[3], app, count=1)
    if count != 1:
        raise ValueError('app.js: Versionskonstante nicht gefunden')
    updates['app.js'] = app2

    sw = (root / 'sw.js').read_text(encoding='utf-8')
    sw2, count = re.subn(r"(?m)^const VERSION\s*=\s*['\"][^'\"]+['\"]\s*;", "const VERSION='2.9.8-physiosport-offline';", sw, count=1)
    if count != 1:
        raise ValueError('sw.js: Cache-Version nicht gefunden')
    # Precache the new module. Supports offline app launches, too.
    match = re.search(r'const ASSETS\s*=\s*(\[[^;]+\])\s*;', sw2, flags=re.S)
    if not match:
        raise ValueError('sw.js: Precache-Dateiliste nicht erkannt')
    assets = json.loads(match.group(1))
    if './physiosport298.js' not in assets:
        assets.append('./physiosport298.js')
    sw2 = sw2[:match.start(1)] + json.dumps(assets, ensure_ascii=False, separators=(',', ':')) + sw2[match.end(1):]
    # Preserve the established network-first behaviour and offline query fallback.
    m = re.search(r"if\((\[[^\]]*\])\.some\(suffix=>path\.endsWith\(suffix\)\)\)", sw2)
    if not m:
        raise ValueError('sw.js: Netzwerk-Cache-Strategie nicht gefunden')
    paths = re.findall(r"'([^']+)'", m.group(1))
    if '/physiosport298.js' not in paths:
        paths.append('/physiosport298.js')
    sub = '[' + ','.join(repr(x) for x in paths) + ']'
    sw2 = sw2[:m.start(1)] + sub + sw2[m.end(1):]
    if 'ignoreSearch:true' not in sw2:
        raise ValueError('sw.js: Offline-Fallback für Version-Query fehlt')
    updates['sw.js'] = sw2

    version = json.loads((root / 'version.json').read_text(encoding='utf-8'))
    version['version'] = VERSION
    version['released'] = '2026-10-23'
    version['notes'] = ('PhysioSport-Termine mit Status Offen/Erledigt/Abgesagt/Verschoben, '
                        'Notizen und Datum-/Uhrzeitbearbeitung; lokaler Import wichtiger '
                        'Lungenfunktionswerte vom 23.10.2026; reparierte HTML-Einbindung, '
                        'Offline-Cache und einheitliche Versionsanzeige. '
                        'Bestehender AES-GCM-Tresor und frühere Untersuchungen unverändert.')
    updates['version.json'] = json.dumps(version, ensure_ascii=False, indent=2) + '\n'

    # Read-only checks before any write: no partial patch after a failed check.
    assert SCRIPT_TAG in updates['index.html']
    assert VERSION in updates['app.js'] and './physiosport298.js' in updates['sw.js']
    changed = []
    for name, value in updates.items():
        f = root / name
        if f.read_text(encoding='utf-8') != value:
            f.write_text(value, encoding='utf-8')
            changed.append(name)
    return changed


def check_repo(root):
    root = Path(root)
    html = (root / 'index.html').read_text(encoding='utf-8')
    app = (root / 'app.js').read_text(encoding='utf-8')
    sw = (root / 'sw.js').read_text(encoding='utf-8')
    manifest = json.loads((root / 'version.json').read_text(encoding='utf-8'))
    assert html.count('<head>') == 1 and html.count('</head>') == 1
    assert html.count('<body>') == 1
    assert html.count(SCRIPT_TAG) == 1
    assert '<head>' in html[:100] and html.index('<head>') < html.index(SCRIPT_TAG) < html.index('</head>')
    assert "const VERSION = '2.9.8';" in app or re.search(r'const VERSION\s*=\s*["\']2\.9\.8["\']', app)
    assert manifest['version'] == '2.9.8'
    assert "const VERSION='2.9.8-physiosport-offline';" in sw
    assert './physiosport298.js' in json.loads(re.search(r'const ASSETS\s*=\s*(\[[^;]+\])\s*;', sw, flags=re.S).group(1))
    assert '/physiosport298.js' in sw and 'ignoreSearch:true' in sw
    return True


def main():
    parser = argparse.ArgumentParser(description='Komplettes, idempotentes Asthma-Update 2.9.8')
    parser.add_argument('repo', nargs='?', default='.', help='Pfad zum bisherigen Asthma-Repository')
    args = parser.parse_args()
    changed = patch_repo(args.repo)
    check_repo(args.repo)
    print('Prüfung bestanden. Geänderte Dateien:', ', '.join(changed) if changed else 'keine (bereits aktuell)')


if __name__ == '__main__':
    main()
