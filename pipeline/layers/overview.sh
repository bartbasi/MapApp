#!/usr/bin/env bash
# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# The overview map: a small, low-zoom base map of the whole area around the
# counties in pipeline/counties.json, shipped inside the app so the map and
# the area picker show something before any county is downloaded.
#
# It is a 'basemap' archive in every way the app sees (OpenStreetMap in the
# Protomaps layout, version 4, cut from the same planet build source), with
# 'county' "overview" in its metadata. The area is the bounding box of all
# counties plus a margin. The top zoom is measured, not fixed: the area is
# cut once at the highest candidate zoom by range reads, each lower candidate
# is cut from that local copy, and the highest zoom whose archive is under
# the size limit is kept.
#
# Usage: bash pipeline/layers/overview.sh        (no county: it covers all)
#
# Settings, all optional:
#   OUT_DIR=<dir>              where to write (default data/build/overview)
#   OVERVIEW_MARGIN=<degrees>  added on each side of the counties' box (0.5)
#   OVERVIEW_ZOOMS="9 10 11 12"  candidate top zooms
#   OVERVIEW_MAX_BYTES=<n>     size limit for the chosen archive (8000000)
#   OVERVIEW_MAXZOOM=<z>       keep this zoom whatever its size
#   PROTOMAPS_BUILD=<key>      repeat an older Protomaps build
#   REFRESH=1                  cut again even if a cached cut exists

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/common.sh"
source "$PIPELINE_DIR/lib/protomaps.sh"

[ $# -eq 0 ] || die "the overview map covers every county in counties.json and takes no county. Run: bash pipeline/layers/overview.sh"

AREA=overview
OUT_DIR="${OUT_DIR:-$BUILD_ROOT/$AREA}"
MARGIN="${OVERVIEW_MARGIN:-0.5}"
CANDIDATES="${OVERVIEW_ZOOMS:-9 10 11 12}"
LIMIT="${OVERVIEW_MAX_BYTES:-8000000}"

require_tools pmtiles jq curl python3
for z in $CANDIDATES; do [[ "$z" =~ ^[0-9]+$ ]] && [ "$z" -ge 1 ] && [ "$z" -le 14 ] || die "bad candidate zoom '$z' (1 to 14)"; done
TOP=$(printf '%s\n' $CANDIDATES | sort -n | tail -1)
if [ -n "${OVERVIEW_MAXZOOM:-}" ]; then
  printf '%s\n' $CANDIDATES | grep -qx "$OVERVIEW_MAXZOOM" || die "OVERVIEW_MAXZOOM=$OVERVIEW_MAXZOOM is not one of the candidates ($CANDIDATES)"
fi
mkdir -p "$OUT_DIR"

# 1. The area: every county's outline box, widened by the margin. The county
# outlines come from the cache (or one small Census query per new county).
BOUNDS=$(mapdata region-bounds "$MARGIN")
BBOX=$(jq -r 'map(tostring) | join(",")' <<<"$BOUNDS")
log "Area: $BBOX (all counties in counties.json plus $MARGIN degrees on each side)"

# 2. The Protomaps build.
protomaps_choose_build

# 3. Cut the area at the top candidate zoom (range reads only, cached per
# build, area and zoom), then each lower candidate from that local copy.
CUT_DIR="$PM_CACHE/$PM_STEM/$AREA-$(tr ',' '_' <<<"$BBOX")"
mkdir -p "$CUT_DIR"
cut_path() { printf '%s/z0-%s.pmtiles' "$CUT_DIR" "$1"; }
TOP_CUT=$(cut_path "$TOP")
if [ -s "$TOP_CUT" ] && [ "${REFRESH:-0}" != 1 ]; then
  log "Reusing cached cut $TOP_CUT"
else
  log "Extracting zoom 0 to $TOP inside $BBOX from $PM_URL"
  "$PMTILES" extract "$PM_URL" "$TOP_CUT.part-$$" --bbox="$BBOX" --maxzoom="$TOP" 2> >(tee "$CUT_DIR/extract-z$TOP.log" >&2) \
    || { rm -f "$TOP_CUT.part-$$"; die "pmtiles extract failed"; }
  mv -f "$TOP_CUT.part-$$" "$TOP_CUT"
  # Tiles moved and requests made, as pmtiles reported them.
  grep -iE 'fetch|request|bytes|tiles' "$CUT_DIR/extract-z$TOP.log" >&2 || true
fi

CHOSEN=""
log ""
log "Candidate top zooms (limit $LIMIT bytes):"
for z in $(printf '%s\n' $CANDIDATES | sort -n); do
  c=$(cut_path "$z")
  if [ "$z" != "$TOP" ] && { [ ! -s "$c" ] || [ "$c" -ot "$TOP_CUT" ]; }; then
    "$PMTILES" extract "$TOP_CUT" "$c.part-$$" --maxzoom="$z" --quiet || { rm -f "$c.part-$$"; die "local extract to zoom $z failed"; }
    mv -f "$c.part-$$" "$c"
  fi
  size=$(stat -c %s "$c")
  mark=""
  [ "$size" -lt "$LIMIT" ] && CHOSEN="$z" && mark="under the limit"
  log "  zoom 0 to $z: $size bytes ($(human_size "$size")) $mark"
done
if [ -n "${OVERVIEW_MAXZOOM:-}" ]; then
  CHOSEN="$OVERVIEW_MAXZOOM"
  log "OVERVIEW_MAXZOOM is set: keeping zoom 0 to $CHOSEN"
fi
[ -n "$CHOSEN" ] || die "no candidate zoom gives an archive under $LIMIT bytes"
log "Keeping zoom 0 to $CHOSEN"

# 4. Publish the archive, then its metadata.
TMP="$OUT_DIR/.basemap.pmtiles.tmp-$$"
cp "$(cut_path "$CHOSEN")" "$TMP"
publish "$TMP" "$OUT_DIR/basemap.pmtiles"
report_archive "$OUT_DIR/basemap.pmtiles"

COUNTY_IDS=$(jq -c '[.[].id]' "$PIPELINE_DIR/counties.json")
PROV=$(jq -n --arg key "$PM_KEY" --arg url "$PM_URL" --arg ver "$PM_VERSION" --arg osm "$OSM_TIME" \
  --arg tool "$("$PMTILES" version | head -1)" --argjson counties "$COUNTY_IDS" \
  --arg margin "$MARGIN" --arg limit "$LIMIT" --arg cands "$CANDIDATES" --arg chosen "$CHOSEN" \
  '{protomapsBuild: $key, protomapsBuildUrl: $url, protomapsLayoutVersion: $ver,
    osmReplicationTime: $osm,
    method: ("pmtiles extract --bbox=<box of all counties plus " + $margin + " degrees> --maxzoom=" + $chosen),
    area: {counties: $counties, marginDegrees: ($margin | tonumber)},
    zoomChoice: {candidates: ($cands | split(" ") | map(select(. != "") | tonumber)),
                 limitBytes: ($limit | tonumber), chosen: ($chosen | tonumber)},
    tool: $tool}')
NOTES="A low-detail map of the region that comes with the app, so there is a map to look at before any county is downloaded. It shows towns, main roads, rivers and lakes, and stops at a middle zoom level; download a county for the detailed map. Cut from the Protomaps planet build $PM_KEY, with OpenStreetMap data as of $OSM_TIME. The lowest zoom levels also carry Natural Earth data (public domain), as the Protomaps build supplies it. OpenStreetMap is edited by volunteers and can be wrong or out of date; it does not show property lines."

mapdata write-meta --layer basemap --county "$AREA" --archive "$OUT_DIR/basemap.pmtiles" \
  --out "$OUT_DIR/basemap.meta.json" --bounds "$BOUNDS" \
  --sources "[[\"openstreetmap\", \"$OSM_DATE\"], [\"protomaps-basemap\", \"$OSM_DATE\"]]" \
  --notes "$NOTES" --provenance "$PROV"
mapdata validate-meta "$OUT_DIR/basemap.meta.json" "$OUT_DIR/basemap.pmtiles"
log "Wrote $OUT_DIR/basemap.meta.json"
