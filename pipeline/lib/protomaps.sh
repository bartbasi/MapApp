# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Choosing a Protomaps planet build, shared by the 'basemap' layer and the
# overview map. Source this file after lib/common.sh; do not run it.
#
# protomaps_choose_build sets these variables:
#   PM_KEY       the build's file name, for example 20261112.pmtiles
#   PM_VERSION   its tile layout version, for example 4.15.2 (always 4.x)
#   PM_URL       its address on the build server
#   PM_STEM      PM_KEY without .pmtiles
#   PM_CACHE     data/cache/protomaps, where the build list, metadata and cuts are kept
#   OSM_TIME     the OpenStreetMap data time of the build
#   OSM_DATE     OSM_TIME as YYYY-MM-DD
# PROTOMAPS_BUILD=<key> pins an older build while Protomaps still keeps it.
# Requests: the build list (one small file) every run, and the build's
# metadata (a few range reads) once per build.

PROTOMAPS_BUILDS_URL="https://build-metadata.protomaps.dev/builds.json"
PROTOMAPS_FILES_URL="https://build.protomaps.com"

protomaps_choose_build() {
  PM_CACHE="$CACHE_DIR/protomaps"
  mkdir -p "$PM_CACHE"

  # 1. The newest build listed, unless pinned.
  if curl -sSfL --retry 3 -A "$USER_AGENT" -o "$PM_CACHE/builds.json.part-$$" "$PROTOMAPS_BUILDS_URL"; then
    mv -f "$PM_CACHE/builds.json.part-$$" "$PM_CACHE/builds.json"
  else
    rm -f "$PM_CACHE/builds.json.part-$$"
    [ -f "$PM_CACHE/builds.json" ] || die "could not download the Protomaps build list"
    log "warning: using the cached Protomaps build list"
  fi
  PM_KEY="${PROTOMAPS_BUILD:-$(jq -r 'max_by(.uploaded) | .key' "$PM_CACHE/builds.json")}"
  PM_VERSION=$(jq -r --arg k "$PM_KEY" '.[] | select(.key == $k) | .version' "$PM_CACHE/builds.json")
  [ -n "$PM_VERSION" ] || die "Protomaps build '$PM_KEY' is not in the build list"
  [[ "$PM_VERSION" == 4.* ]] || die "Protomaps build $PM_KEY has layout version $PM_VERSION; the contract expects version 4"
  PM_URL="$PROTOMAPS_FILES_URL/$PM_KEY"
  PM_STEM="${PM_KEY%.pmtiles}"
  log "Protomaps build: $PM_KEY (layout version $PM_VERSION)"

  # 2. The build's metadata holds the OpenStreetMap data time.
  local meta="$PM_CACHE/$PM_STEM.metadata.json"
  if [ ! -s "$meta" ]; then
    "$PMTILES" show "$PM_URL" --metadata > "$meta.part-$$" || { rm -f "$meta.part-$$"; die "could not read metadata of $PM_URL"; }
    jq 'del(.vector_layers)' "$meta.part-$$" > "$meta.part2-$$" && rm -f "$meta.part-$$"
    mv -f "$meta.part2-$$" "$meta"
  fi
  OSM_TIME=$(jq -r '."planetiler:osm:osmosisreplicationtime" // empty' "$meta")
  [ -n "$OSM_TIME" ] || die "build $PM_KEY has no OpenStreetMap replication time in its metadata"
  OSM_DATE="${OSM_TIME:0:10}"
  log "OpenStreetMap data time: $OSM_TIME"
}
