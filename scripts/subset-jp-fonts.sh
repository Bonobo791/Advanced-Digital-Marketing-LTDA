#!/usr/bin/env bash
# Regenerates the subsetted Japanese webfonts in static/fonts/ from the
# variable Noto JP sources, covering every JP character used by live code
# in src/ (services, nav, steps, options, seals, footer tagline, …).
#
# The site renders Japanese via four @font-face families:
#   'ADM JP Sans 900'  -> jp-sans-900.woff2           (Noto Sans JP, 900)
#   'ADM JP'           -> NotoSansJP-Bold-sub.woff2   (Noto Sans JP, 700)
#   'ADM JP Serif 900' -> jp-serif-900.woff2          (Noto Serif JP, 900)
#   'ADM JP Serif'     -> NotoSerifJP-Bold-sub.woff2  (Noto Serif JP, 700)
#
# Because 'ADM JP Sans 900' falls back to 'ADM JP', BOTH the 900 display
# subsets and the 700 fallback subsets must carry every live glyph (e.g. the
# 自 / 動 of the AI Automation option) — otherwise the browser falls through
# to an OS font and can render tofu. The character set is extracted from the
# live src/ files, so adding new JP copy and re-running this script keeps the
# fonts in sync. It fails loudly (non-zero exit) if any live char is missing
# from a generated subset.
#
# Requires fonttools + brotli (e.g. python3 -m venv /tmp/fonttools-venv).
# Source fonts (OFL, from the official google/fonts repo):
#   https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf
#   https://github.com/google/fonts/raw/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf
set -euo pipefail

SANS_SRC="${1:?usage: subset-jp-fonts.sh /path/to/NotoSansJP[wght].ttf /path/to/NotoSerifJP[wght].ttf}"
SERIF_SRC="${2:?usage: subset-jp-fonts.sh /path/to/NotoSansJP[wght].ttf /path/to/NotoSerifJP[wght].ttf}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/static/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Collect every JP character used by live source files.
python3 - "$ROOT/src" "$TMP/live-jp-chars.txt" <<'PY'
import re
import sys

src_root, out_path = sys.argv[1], sys.argv[2]
pat = re.compile(
    r'[\u3000-\u30ff\u4e00-\u9fff\u2014\u2026\u3001\u3002\u201c\u201d'
    r'\u2018\u2019\u3010\u3011\u309b\u309c\uff01\uff1f\uff1a\uff1b'
    r'\uff08\uff09\u300c\u300d\u30fb]+'
)
chars: set[str] = set()
for dirpath, _dirnames, filenames in __import__('os').walk(src_root):
    for name in filenames:
        if not (name.endswith('.ts') or name.endswith('.svelte')):
            continue
        path = __import__('os').path.join(dirpath, name)
        with open(path, encoding='utf-8') as fh:
            text = fh.read()
        for match in pat.finditer(text):
            chars.update(match.group(0))
with open(out_path, 'w', encoding='utf-8') as fh:
    fh.write(''.join(sorted(chars)))
print(f'live JP chars: {len(chars)}')
PY

# 2. Instance the variable fonts at the two weights used by the site.
fonttools varLib.instancer "$SANS_SRC" wght=900 -o "$TMP/sans-900.ttf" >/dev/null
fonttools varLib.instancer "$SANS_SRC" wght=700 -o "$TMP/sans-700.ttf" >/dev/null
fonttools varLib.instancer "$SERIF_SRC" wght=900 -o "$TMP/serif-900.ttf" >/dev/null
fonttools varLib.instancer "$SERIF_SRC" wght=700 -o "$TMP/serif-700.ttf" >/dev/null

# 3. Subset each instance to the live glyphs.
subset() {
  local src="$1" out="$2"
  pyftsubset "$src" \
    --output-file="$out" --flavor=woff2 \
    --text-file="$TMP/live-jp-chars.txt" \
    --layout-features='*' --no-hinting --desubroutinize
}
subset "$TMP/sans-900.ttf" "$OUT_DIR/jp-sans-900.woff2"
subset "$TMP/sans-700.ttf" "$OUT_DIR/NotoSansJP-Bold-sub.woff2"
subset "$TMP/serif-900.ttf" "$OUT_DIR/jp-serif-900.woff2"
subset "$TMP/serif-700.ttf" "$OUT_DIR/NotoSerifJP-Bold-sub.woff2"

# 4. Fail loudly if any live glyph is missing from a generated subset.
python3 - "$TMP/live-jp-chars.txt" "$OUT_DIR" <<'PY'
import os
import sys

from fontTools.ttLib import TTFont

live_path, out_dir = sys.argv[1], sys.argv[2]
with open(live_path, encoding='utf-8') as fh:
    live = set(fh.read())
missing_any = False
for name in ('jp-sans-900.woff2', 'NotoSansJP-Bold-sub.woff2',
             'jp-serif-900.woff2', 'NotoSerifJP-Bold-sub.woff2'):
    font = TTFont(os.path.join(out_dir, name))
    covered = set(chr(c) for c in font.getBestCmap())
    missing = sorted(live - covered)
    if missing:
        missing_any = True
        print(f'MISSING in {name}: {"".join(missing)}')
    else:
        print(f'ok {name}: {len(covered)} glyphs, all live chars covered')
sys.exit(1 if missing_any else 0)
PY

echo "wrote JP subsets to $OUT_DIR"
