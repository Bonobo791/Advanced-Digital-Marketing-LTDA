#!/usr/bin/env bash
# Regenerates the subsetted Latin webfonts in static/fonts/.
#
# The display font ArchivoBlack-sub.woff2 must include the Latin-1 accented
# ranges below — without them, Portuguese headings (ã, ç, é, í, ó, …) fall
# back to the system font mid-word.
#
# Requires fonttools + brotli (e.g. python3 -m venv /tmp/fonttools-venv).
# Source font: Archivo Black (OFL), from the official google/fonts repo:
#   https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf
set -euo pipefail

SRC="${1:?usage: subset-fonts.sh /path/to/ArchivoBlack-Regular.ttf}"
OUT="$(dirname "$0")/../static/fonts/ArchivoBlack-sub.woff2"

pyftsubset "$SRC" \
  --output-file="$OUT" --flavor=woff2 \
  --unicodes="U+0020-007E,U+00C0-00C4,U+00C7-00CF,U+00D1-00D6,U+00D9-00DC,U+00E0-00E4,U+00E7-00EF,U+00F1-00F6,U+00F9-00FC,U+2014,U+2192-2193" \
  --layout-features='*' --no-hinting --desubroutinize

echo "wrote $OUT"
