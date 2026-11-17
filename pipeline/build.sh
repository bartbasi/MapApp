#!/usr/bin/env bash
# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Build one layer for one county:
#
#     bash pipeline/build.sh <layer> <county-id>
#
# Layers are the scripts in pipeline/layers/<layer>.sh. Counties are the
# entries of pipeline/counties.json. Downloads are cached in data/cache/,
# outputs go to data/build/<county-id>/. Set REFRESH=1 to download again.
# The overview map, which covers all counties, has its own entry point:
# bash pipeline/layers/overview.sh

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

usage() {
  local layers
  layers=$(cd "$PIPELINE_DIR/layers" && ls -1 *.sh 2>/dev/null | sed 's/\.sh$//' | grep -vx overview | tr '\n' ' ')
  log "usage: bash pipeline/build.sh <layer> <county-id>"
  log "  layers:   $layers"
  log "  counties: $(jq -r '[.[].id] | join(" ")' "$PIPELINE_DIR/counties.json")"
  exit 2
}

[ $# -eq 2 ] || usage
LAYER="$1"
COUNTY="$2"

require_tools python3 jq curl
[[ "$LAYER" =~ ^[a-z0-9_-]+$ ]] || { log "error: bad layer name '$LAYER'"; usage; }
[ "$LAYER" != overview ] || die "the overview map is not a county layer. Run: bash pipeline/layers/overview.sh"
SCRIPT="$PIPELINE_DIR/layers/$LAYER.sh"
[ -f "$SCRIPT" ] || { log "error: unknown layer '$LAYER'"; usage; }
jq -e --arg id "$COUNTY" 'any(.[]; .id == $id)' "$PIPELINE_DIR/counties.json" >/dev/null \
  || { log "error: unknown county '$COUNTY'"; usage; }

OUT_DIR="$BUILD_ROOT/$COUNTY"
mkdir -p "$OUT_DIR" "$CACHE_DIR"
export LAYER COUNTY OUT_DIR

log "== Building layer '$LAYER' for county '$COUNTY' ($(mapdata county-field "$COUNTY" name), $(mapdata county-field "$COUNTY" stateName))"
start=$(date +%s)
bash "$SCRIPT" "$COUNTY"
mapdata validate-meta "$OUT_DIR/$LAYER.meta.json" "$OUT_DIR/$LAYER.pmtiles"
log "== Done in $(( $(date +%s) - start )) s: $OUT_DIR/$LAYER.pmtiles and $LAYER.meta.json"
