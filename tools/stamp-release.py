#!/usr/bin/env python3
"""Stamp a staged static release, including every transitive JS import.
Usage: python3 tools/stamp-release.py /path/to/staged-release release-id
Run on a release copy, never the source checkout.
"""
from pathlib import Path
import re
import sys
from urllib.parse import quote

def stamp(root, release):
    version = quote(release, safe='')
    def update(match):
        return match[1] + match[2].split('?')[0] + '?v=' + version + match[3]
    imports = re.compile(r'''((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])([^"']+\.m?js(?:\?[^"']*)?)(["'])''')
    for path in (root/'src').rglob('*.js'):
        path.write_text(imports.sub(update,path.read_text()))
    assets = re.compile(r'''((?:src|href)=["'])(/[^"']+\.(?:js|css|webmanifest)(?:\?[^"']*)?)(["'])''')
    for path in root.glob('*.html'):
        path.write_text(assets.sub(update,path.read_text()))

if __name__ == '__main__':
    stamp(Path(sys.argv[1]), sys.argv[2])
