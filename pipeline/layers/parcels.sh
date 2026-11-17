#!/usr/bin/env bash
# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Layer 'parcels': property lines with parcel ID, owner name and acreage, zoom
# 13 to 16, from the county's own parcel service. The work is in parcels.py;
# where each county's parcels come from is in parcels-services.json.
#
# Usage: bash pipeline/layers/parcels.sh <county-id>   (normally via build.sh)

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/common.sh"

require_tools python3 tippecanoe pmtiles
python3 -I "$PIPELINE_DIR/layers/parcels.py" "$1"
