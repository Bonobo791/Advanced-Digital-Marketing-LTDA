#!/usr/bin/env bash
# Regenerates the subsetted Latin webfonts in static/fonts/.
#
# All three subsets must include the Latin-1 accented ranges below — without
# them, Portuguese headings (ã, ç, é, í, ó, …) fall back to the system font
# mid-word. The list also covers every non-ASCII symbol the rendered copy
# uses: © · × … and the ← ↑ → ↓ arrows.
#
# Requires fonttools + brotli (e.g. python3 -m venv /tmp/fonttools-venv).
# Source fonts (OFL), from the official google/fonts repo:
#   https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf
#   https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf
# Archivo Regular/SemiBold are instances of the variable font (v2.001).
set -euo pipefail

BLACK="${1:?usage: subset-fonts.sh /path/to/ArchivoBlack-Regular.ttf '/path/to/Archivo[wdth,wght].ttf'}"
VARIABLE="${2:?usage: subset-fonts.sh /path/to/ArchivoBlack-Regular.ttf '/path/to/Archivo[wdth,wght].ttf'}"
FONTS_DIR="$(dirname "$0")/../static/fonts"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

UNICODES="U+0020-007E,U+00A9,U+00B7,U+00C0-00C4,U+00C7-00CF,U+00D1-00D7,U+00D9-00DC,U+00E0-00E4,U+00E7-00EF,U+00F1-00F6,U+00F9-00FC,U+2014,U+2026,U+2190-2193"

subset() {
  pyftsubset "$1" \
    --output-file="$2" --flavor=woff2 \
    --unicodes="$UNICODES" \
    --layout-features='*' --no-hinting --desubroutinize
  echo "wrote $2"
}

fonttools varLib.instancer --update-name-table -o "$WORK/Archivo-Regular.ttf" "$VARIABLE" wdth=100 wght=400 >/dev/null
fonttools varLib.instancer --update-name-table -o "$WORK/Archivo-SemiBold.ttf" "$VARIABLE" wdth=100 wght=600 >/dev/null

subset "$BLACK" "$FONTS_DIR/ArchivoBlack-sub.woff2"
subset "$WORK/Archivo-Regular.ttf" "$FONTS_DIR/Archivo-Regular-sub.woff2"
subset "$WORK/Archivo-SemiBold.ttf" "$FONTS_DIR/Archivo-SemiBold-sub.woff2"
