#!/usr/bin/env python3
"""Render README.md to a self-contained ~/Dev/repos/manuals/<project>.html; --check never writes."""
import argparse
import hashlib
import html
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, quote, unquote

EXCLUDED = {'.git', '.venv', 'venv', '.runtime', '__pycache__', 'node_modules', 'data', 'dist', 'output', '.pytest_cache', '.mypy_cache', '.ruff_cache', '*.egg-info'}
SUFFIXES = {'.py', '.js', '.html', '.css', '.md', '.json', '.toml', '.yaml', '.yml', '.sh', '.txt', '.service', '.timer', '.conf', '.svg', '.webmanifest'}

def sources(root):
    paths = []
    for directory, folders, filenames in os.walk(root, followlinks=False):
        folders[:] = sorted(d for d in folders if d not in EXCLUDED and not d.endswith('.egg-info') and not (Path(directory) / d).is_symlink())
        for filename in filenames:
            path = Path(directory) / filename
            if path.is_symlink() or filename == 'documentation.html' or filename.startswith('.env'):
                continue
            if path.suffix in SUFFIXES:
                paths.append(path)
    yield from sorted(paths)

def fingerprint(root):
    digest = hashlib.sha256()
    for path in sources(root):
        digest.update(path.relative_to(root).as_posix().encode() + b'\0' + path.read_bytes() + b'\0')
    return digest.hexdigest()

CSS = '''
:root{color-scheme:light;--ink:#182b3a;--muted:#536575;--line:#dce4e9;--accent:#007c83;--paper:#fff;--back:#f3f6f8}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--back);color:var(--ink);font:16px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{color:var(--accent);text-underline-offset:3px;overflow-wrap:anywhere}a:hover{text-decoration-thickness:2px}.shell{max-width:1480px;margin:auto;display:grid;grid-template-columns:280px minmax(0,1fr);gap:42px;padding:32px}
nav{position:sticky;top:24px;align-self:start;max-height:calc(100vh - 48px);overflow:auto;font-size:14px;padding:12px 10px}nav .label{font-size:11px;letter-spacing:.15em;font-weight:800;color:var(--accent)}nav ul{list-style:none;padding-left:14px;margin:5px 0}nav>ul{padding-left:0}nav a{display:block;text-decoration:none;padding:5px 0;line-height:1.4;color:var(--muted)}nav a:hover{color:var(--accent)}
main{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:48px 56px;box-shadow:0 8px 40px #182b3a06}h1{font-size:clamp(30px,4vw,48px);line-height:1.14;letter-spacing:-.035em;margin:12px 0 28px}h2{font-size:26px;line-height:1.3;letter-spacing:-.02em;margin:0 0 22px}h3{font-size:19px;line-height:1.4;margin-top:30px}p,li{overflow-wrap:anywhere}section{border-top:1px solid var(--line);margin-top:42px;padding-top:32px}section:target{border-top-color:var(--accent)}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.17em;color:var(--accent);font-weight:800}.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:30px;flex-wrap:wrap}input,button{font:inherit;border:1px solid var(--line);border-radius:8px;background:var(--paper);padding:9px 12px;color:var(--ink)}input{width:100%;margin:14px 0}button{cursor:pointer}button:hover{border-color:var(--accent)}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #64c5ca;outline-offset:3px}#count{font-size:12px;color:var(--muted)}
pre{background:#152a36;color:#ecf4f6;padding:20px;border-radius:10px;overflow:auto;font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}code{font: .87em ui-monospace,SFMono-Regular,Menlo,monospace;background:#eaf0f3;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}pre code{background:transparent;padding:0;color:inherit;overflow-wrap:normal}blockquote{border-left:3px solid var(--accent);margin:24px 0;padding:2px 20px;background:#f2f9f9;color:var(--muted)}.table-wrap{overflow:auto;margin:24px 0}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:12px}th{background:#edf5f5}img{max-width:100%;height:auto}footer{margin-top:40px;font-size:12px;color:var(--muted);overflow-wrap:anywhere}[hidden]{display:none!important}.skip{position:absolute;left:-9999px}.skip:focus{left:12px;top:12px;background:white;padding:12px;z-index:2}
@media(max-width:950px){.shell{grid-template-columns:220px minmax(0,1fr);gap:18px;padding:20px}main{padding:32px}}
@media(max-width:700px){.shell{display:block;padding:12px}nav{position:static;max-height:none;padding:12px}nav>ul{max-height:240px;overflow:auto}main{padding:26px 20px;border-radius:14px}h2{font-size:23px}section{margin-top:30px;padding-top:26px}}
@media print{body{background:white;font-size:10pt}.shell{display:block;padding:0}nav,.toolbar,.skip{display:none}main{border:0;box-shadow:none;padding:0}section[hidden]{display:block!important}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f1f1;color:black}h2,h3{break-after:avoid}tr,pre{break-inside:avoid}a{color:inherit}section{margin-top:20px;padding-top:16px}}
'''
JS = '''
const input=document.querySelector('#search'), sections=[...document.querySelectorAll('main section')], count=document.querySelector('#count');
input.addEventListener('input',()=>{const q=input.value.trim().toLocaleLowerCase('de');let n=0;sections.forEach(s=>{s.hidden=!!q&&!s.textContent.toLocaleLowerCase('de').includes(q);if(!s.hidden)n++;});document.querySelectorAll('nav>ul>li').forEach(li=>{const link=li.querySelector('a');const target=link&&document.getElementById(decodeURIComponent(link.hash.slice(1)));li.hidden=!!(target&&target.closest('section')&&target.closest('section').hidden);});count.textContent=q?n+' passende Kapitel':'';});
document.querySelector('#print').addEventListener('click',()=>window.print());
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{if(input.value){input.value='';input.dispatchEvent(new Event('input'));}}));
'''

def output_path(root, output_dir):
    config_file = root / 'scripts/documentation.json'
    config = json.loads(config_file.read_text(encoding='utf-8')) if config_file.exists() else {}
    name = config.get('name', root.name)
    if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', name):
        raise SystemExit('Ungültiger Dokumentationsname in scripts/documentation.json (nur Buchstaben, Zahlen, - und _).')
    return output_dir / (name + '-Dokumentation.html')

def relocate_links(body, root, target):
    # Each manual owns a separate media namespace; rendering/checking never writes.
    assets = {}
    asset_dir = target.stem.removesuffix('-Dokumentation') + '-assets'
    def replace(match):
        attribute, delimiter, value = match.groups()
        parts = urlsplit(html.unescape(value))
        if parts.scheme == 'data' or not parts.path:
            return match.group(0)
        if parts.scheme or parts.netloc:
            if attribute in ('src', 'poster'):
                raise SystemExit('Externe Medien zuerst lokal bereitstellen: ' + value)
            return match.group(0)
        if parts.path.startswith('/'):
            destination = Path(unquote(parts.path))
        else:
            destination = (root / unquote(parts.path)).resolve()
        if attribute in ('src', 'poster'):
            if not destination.is_file():
                raise SystemExit('Referenzierte Mediendatei fehlt: ' + str(destination))
            content = destination.read_bytes()
            filename = hashlib.sha256(content).hexdigest()[:16] + '-' + destination.name
            path = asset_dir + '/' + filename
            assets[target.parent / path] = content
        else:
            path = os.path.relpath(destination, target.parent).replace(os.sep, '/')
        url = urlunsplit(('', '', quote(path, safe='/'), parts.query, parts.fragment))
        return attribute + '=' + delimiter + html.escape(url, quote=True) + delimiter
    body = re.sub(r"(href|src|poster)=([\"'])(.*?)\2", replace, body)
    return body, assets

def render(root, target):
    try:
        import markdown
    except ImportError:
        raise SystemExit('Bitte zuerst installieren: python3 -m pip install -r scripts/requirements-docs.txt')
    readme = (root / 'README.md').read_text(encoding='utf-8')
    title = next((line[2:] for line in readme.splitlines() if line.startswith('# ')), root.name)
    md = markdown.Markdown(extensions=['fenced_code', 'tables', 'toc', 'sane_lists'], extension_configs={'toc': {'toc_depth': '2-3'}})
    body, assets = relocate_links(md.convert(readme), root, target)
    chunks = re.split(r'(?=<h2\b)', body)
    body = chunks[0] + ''.join('<section>' + chunk + '</section>' for chunk in chunks[1:])
    body = re.sub(r'(<table>.*?</table>)', r'<div class="table-wrap">\1</div>', body, flags=re.S)
    toc = md.toc.strip().removeprefix('<div class="toc">').removesuffix('</div>')
    sha = fingerprint(root)
    readme_url = html.escape(quote(os.path.relpath(root / 'README.md', target.parent).replace(os.sep, '/'), safe='/'), quote=True)
    result = f'''<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="source-sha256" content="{sha}"><meta name="project-source" content="{html.escape(str(root), quote=True)}"><title>{html.escape(title)} · Dokumentation</title><style>{CSS}</style></head>
<body><a class="skip" href="#content">Zum Inhalt</a><div class="shell"><nav aria-label="Inhaltsverzeichnis"><div class="label">Projektdokumentation</div><label for="search">Kapitel durchsuchen</label><input id="search" type="search" placeholder="z. B. Synchronisierung"><div id="count" role="status" aria-live="polite"></div>{toc}</nav><main id="content"><div class="eyebrow">Wissen · Bedienung · Technik</div><div class="toolbar"><button id="print" type="button">Drucken / PDF</button><a href="{readme_url}">README öffnen</a></div>{body}<footer>Aus README.md erzeugt · Generator 1.1.0 · ohne externe Ressourcen<br>Quellstand SHA-256: {sha}<br>Inhaltliche Pflege: README bearbeiten, danach scripts/build_docs.py ausführen.</footer></main></div><script>{JS}</script></body></html>
'''
    return result, assets

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output-dir', type=Path, default=Path.home() / 'Dev/repos/manuals', help='Nur für isolierte Tests/CI abweichend setzen.')
    args = parser.parse_args()
    root = args.root.resolve()
    target = output_path(root, args.output_dir.expanduser().resolve())
    if target.parent == root or root in target.parent.parents:
        parser.error('HTML-Dokumentation gehört in den zentralen manuals-Ordner, nicht in den Projektstamm.')
    if target.exists():
        owner = re.search(r'<meta name="project-source" content="([^"]+)">', target.read_text(encoding='utf-8'))
        if not owner or html.unescape(owner.group(1)) != str(root):
            raise SystemExit('Ziel gehört einer anderen oder unbekannten Dokumentation: ' + str(target))
    result, assets = render(root, target)
    if args.check:
        if not target.exists() or target.read_text(encoding='utf-8') != result or any(not path.is_file() or path.read_bytes() != content for path, content in assets.items()):
            raise SystemExit('Dokumentation veraltet: README inhaltlich prüfen, danach python3 scripts/build_docs.py ausführen.')
        print(f'OK: {target} ist aktuell.')
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        for path, content in assets.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        target.write_text(result, encoding='utf-8')
        print(f'Erzeugt: {target}')

if __name__ == '__main__':
    main()
