#!/usr/bin/env bash
# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Layer 'aerial': NAIP natural color imagery, WebP 512 px tiles, zoom 10 to
# 16, clipped to the county outline plus about 300 m. The work is in
# aerial.py. The first run downloads several GB; images are cached per image
# under data/cache/naip/ and a rerun skips the ones already saved.
#
# Usage: bash pipeline/layers/aerial.sh <county-id>   (normally via build.sh)

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/common.sh"

require_tools python3 gdalinfo gdal_translate gdalbuildvrt gdalwarp gdaladdo pmtiles
python3 -I "$PIPELINE_DIR/layers/aerial.py" "$1"
