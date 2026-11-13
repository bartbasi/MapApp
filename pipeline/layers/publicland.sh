#!/usr/bin/env bash
# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Layer 'publicland': public land boundaries and managers, zoom 6 to 14, from
# USGS PAD-US 4.1 with open-data corrections. The work is in publicland.py;
# the mapping tables are in publicland-mapping.json.
#
# Usage: bash pipeline/layers/publicland.sh <county-id>   (normally via build.sh)

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/common.sh"

require_tools python3 tippecanoe pmtiles
python3 -I "$PIPELINE_DIR/layers/publicland.py" "$1"
