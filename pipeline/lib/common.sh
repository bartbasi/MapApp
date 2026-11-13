# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Shared bash helpers for the layer scripts. Source this file; do not run it.
# Nothing here names a county: counties come from pipeline/counties.json.

PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(dirname "$PIPELINE_DIR")"
CACHE_DIR="$REPO_DIR/data/cache"
BUILD_ROOT="$REPO_DIR/data/build"
PMTILES_SRC="$REPO_DIR/.tools/pmtiles-linux/pmtiles"
# Generic client name. Never put a person's or the project's name in requests.
USER_AGENT="map-data-build"

# Starting the 57 MB PMTiles binary from the Windows drive takes 20 to 50
# seconds each time, so run a copy kept on the WSL file system.
if [ -z "${PMTILES:-}" ]; then
  PMTILES="$HOME/.cache/map-data-build/pmtiles"
  if [ -x "$PMTILES_SRC" ] && { [ ! -x "$PMTILES" ] || [ "$PMTILES_SRC" -nt "$PMTILES" ] \
       || [ "$(stat -c %s "$PMTILES_SRC")" != "$(stat -c %s "$PMTILES")" ]; }; then
    mkdir -p "$(dirname "$PMTILES")"
    cp "$PMTILES_SRC" "$PMTILES.part-$$" && chmod +x "$PMTILES.part-$$" && mv -f "$PMTILES.part-$$" "$PMTILES"
  fi
  [ -x "$PMTILES" ] || PMTILES="$PMTILES_SRC"
fi
export PMTILES

# Keep __pycache__ folders out of the repository.
export PYTHONDONTWRITEBYTECODE=1

log() { printf '%s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# Run the shared Python helper in isolated mode (it reads downloaded files).
mapdata() { python3 -I "$PIPELINE_DIR/lib/mapdata.py" "$@"; }

require_tools() {
  local t
  for t in "$@"; do
    if [ "$t" = pmtiles ]; then
      [ -x "$PMTILES" ] || die "PMTiles tool not found at $PMTILES_SRC. Download go-pmtiles v1.31.2 for Linux x86_64 into .tools/pmtiles-linux/."
    else
      command -v "$t" >/dev/null 2>&1 || die "'$t' is not installed in this environment"
    fi
  done
}

# fetch <url> <dest>: download to a temporary name, then rename.
fetch() {
  local url="$1" dest="$2" tmp
  mkdir -p "$(dirname "$dest")"
  tmp="$dest.part-$$"
  if ! curl -sSfL --retry 4 --retry-delay 10 -A "$USER_AGENT" -o "$tmp" "$url"; then
    rm -f "$tmp"
    die "download failed: $url"
  fi
  mv -f "$tmp" "$dest"
}

# publish <tmp> <final>: move a finished file into place in one rename.
publish() {
  local tmp="$1" final="$2"
  mkdir -p "$(dirname "$final")"
  if ! mv -f "$tmp" "$final"; then
    rm -f "$tmp"
    die "could not replace $final. Is it open in another program?"
  fi
}

human_size() { numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || printf '%s bytes' "$1"; }

# Print the archive's header and size.
report_archive() {
  local f="$1"
  log "Wrote $f ($(stat -c %s "$f") bytes, $(human_size "$(stat -c %s "$f")"))"
  "$PMTILES" show "$f" | sed -n '1,12p' >&2
}
