#!/usr/bin/env bash
# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Layer 'basemap': OpenStreetMap vector tiles in the Protomaps layout,
# version 4, zoom 0 to 15, cut from the newest Protomaps planet build along
# the county outline. pmtiles extract copies whole tiles, so tiles that
# reach past the county line are complete (contract rule 1).
#
# Usage: bash pipeline/layers/basemap.sh <county-id>   (normally via build.sh)
# Set PROTOMAPS_BUILD=<key>, for example 20261112.pmtiles, to repeat an
# older build while Protomaps still keeps it (about 60 days).

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/common.sh"
source "$PIPELINE_DIR/lib/protomaps.sh"

COUNTY="$1"
OUT_DIR="${OUT_DIR:-$BUILD_ROOT/$COUNTY}"
MAXZOOM=15

require_tools pmtiles jq curl python3
mkdir -p "$OUT_DIR"

OUTLINE=$(mapdata outline "$COUNTY")

# 1 and 2. Choose the Protomaps build and read its OpenStreetMap data time.
protomaps_choose_build
KEY="$PM_KEY"; VERSION="$PM_VERSION"; BUILD_URL="$PM_URL"; STEM="$PM_STEM"

# 3. Cut the county's tiles (cached per build and county).
CUT="$PM_CACHE/$STEM/$COUNTY.pmtiles"
if [ -s "$CUT" ] && [ "${REFRESH:-0}" != 1 ]; then
  log "Reusing cached cut $CUT"
else
  mkdir -p "$(dirname "$CUT")"
  log "Extracting zoom 0 to $MAXZOOM along the county outline from $BUILD_URL"
  "$PMTILES" extract "$BUILD_URL" "$CUT.part-$$" --region="$OUTLINE" --maxzoom="$MAXZOOM" \
    || { rm -f "$CUT.part-$$"; die "pmtiles extract failed"; }
  mv -f "$CUT.part-$$" "$CUT"
fi

# 4. Publish the archive, then its metadata.
TMP="$OUT_DIR/.basemap.pmtiles.tmp-$$"
cp "$CUT" "$TMP"
publish "$TMP" "$OUT_DIR/basemap.pmtiles"
report_archive "$OUT_DIR/basemap.pmtiles"

OUTLINE_PROV=$(cat "${OUTLINE%.geojson}.source.json")
PROV=$(jq -n --arg key "$KEY" --arg url "$BUILD_URL" --arg ver "$VERSION" --arg osm "$OSM_TIME" \
  --arg tool "$("$PMTILES" version | head -1)" --argjson outline "$OUTLINE_PROV" \
  '{protomapsBuild: $key, protomapsBuildUrl: $url, protomapsLayoutVersion: $ver,
    osmReplicationTime: $osm, method: "pmtiles extract --region=<county outline> --maxzoom=15",
    tool: $tool, countyOutline: $outline}')
NOTES="Cut from the Protomaps planet build $KEY, with OpenStreetMap data as of $OSM_TIME. Tiles are whole: they include map data past the county line. The lowest zoom levels also carry Natural Earth data (public domain), as the Protomaps build supplies it. OpenStreetMap is edited by volunteers and can be wrong or out of date; it does not show property lines."

mapdata write-meta --layer basemap --county "$COUNTY" --archive "$OUT_DIR/basemap.pmtiles" \
  --out "$OUT_DIR/basemap.meta.json" \
  --sources "[[\"openstreetmap\", \"$OSM_DATE\"], [\"protomaps-basemap\", \"$OSM_DATE\"]]" \
  --notes "$NOTES" --provenance "$PROV"
log "Wrote $OUT_DIR/basemap.meta.json"
