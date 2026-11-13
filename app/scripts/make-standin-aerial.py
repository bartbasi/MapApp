# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

"""Makes stand-in aerial archives for testing the app before real imagery exists.

The tiles are synthetic: a labeled checkerboard, 512 pixels square, WebP,
opaque inside the county's bounding box and transparent beyond it (as a real
county aerial archive is). Zoom 10 to 13. Nothing here is real imagery.

Output, for each county that has a base map in data/build:
    data/fixtures/aerial-standin/<county-id>/aerial.pmtiles
    data/fixtures/aerial-standin/<county-id>/aerial.meta.json

The output is under data/, which git ignores. It is never written into
data/build/, where the pipeline puts the real archives. Point the dev server at
it with:
    MAPAPP_ARCHIVES="../data/build;../data/fixtures/aerial-standin" npm run dev

Usage: python -I app/scripts/make-standin-aerial.py
Needs Pillow with WebP support, and .tools/pmtiles/pmtiles.exe.
"""

import datetime
import json
import math
import sqlite3
import subprocess
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / "data" / "build"
OUT = ROOT / "data" / "fixtures" / "aerial-standin"
PMTILES = ROOT / ".tools" / "pmtiles" / "pmtiles.exe"
SIZE = 512
MINZOOM, MAXZOOM = 10, 13
# One pair of checker tones per county, so neighbouring archives are easy to tell apart.
TONES = [((92, 120, 70), (120, 150, 90)), ((140, 110, 80), (170, 140, 105)), ((80, 105, 130), (105, 135, 160))]


def lon_to_x(lon, z):
    return (lon + 180) / 360 * 2**z


def lat_to_y(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**z


def make_tile(county, z, x, y, bounds, tones):
    w, s, e, n = bounds
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    # The part of the tile inside the county's box, in tile pixels.
    px0 = max(0, (lon_to_x(w, z) - x) * SIZE)
    px1 = min(SIZE, (lon_to_x(e, z) - x) * SIZE)
    py0 = max(0, (lat_to_y(n, z) - y) * SIZE)
    py1 = min(SIZE, (lat_to_y(s, z) - y) * SIZE)
    if px1 <= px0 or py1 <= py0:
        return None
    draw = ImageDraw.Draw(img)
    step = 64
    for i in range(0, SIZE, step):
        for j in range(0, SIZE, step):
            draw.rectangle([i, j, i + step - 1, j + step - 1], fill=tones[((i + j) // step) % 2] + (255,))
    draw.rectangle([0, 0, SIZE - 1, SIZE - 1], outline=(255, 255, 255, 255), width=2)
    font = ImageFont.load_default(size=28)
    for k, line in enumerate(["STAND-IN IMAGERY", county, f"z{z} x{x} y{y}"]):
        draw.text((24, 24 + 36 * k), line, fill=(255, 255, 255, 255), font=font, stroke_width=3, stroke_fill=(0, 0, 0, 255))
    # Transparent outside the county's box.
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rectangle([px0, py0, px1 - 1, py1 - 1], fill=255)
    img.putalpha(mask)
    buf = BytesIO()
    img.save(buf, "WEBP", quality=70)
    return buf.getvalue()


def build(county, bounds, tones):
    folder = OUT / county
    folder.mkdir(parents=True, exist_ok=True)
    mbtiles = folder / "aerial.mbtiles"
    mbtiles.unlink(missing_ok=True)
    db = sqlite3.connect(mbtiles)
    db.execute("create table metadata (name text, value text)")
    db.execute("create table tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)")
    w, s, e, n = bounds
    meta = {
        "name": f"Stand-in aerial imagery, {county}",
        "format": "webp",
        "type": "overlay",
        "minzoom": str(MINZOOM),
        "maxzoom": str(MAXZOOM),
        "bounds": f"{w},{s},{e},{n}",
    }
    db.executemany("insert into metadata values (?, ?)", meta.items())
    count = 0
    for z in range(MINZOOM, MAXZOOM + 1):
        for x in range(int(lon_to_x(w, z)), int(lon_to_x(e, z)) + 1):
            for y in range(int(lat_to_y(n, z)), int(lat_to_y(s, z)) + 1):
                data = make_tile(county, z, x, y, bounds, tones)
                if data is None:
                    continue
                # MBTiles rows count from the bottom.
                db.execute("insert into tiles values (?, ?, ?, ?)", (z, x, 2**z - 1 - y, data))
                count += 1
    db.commit()
    db.close()
    pmtiles = folder / "aerial.pmtiles"
    pmtiles.unlink(missing_ok=True)
    subprocess.run([str(PMTILES), "convert", str(mbtiles), str(pmtiles)], check=True, capture_output=True)
    mbtiles.unlink()
    today = datetime.date.today().isoformat()
    meta_json = {
        "schema": 1,
        "layer": "aerial",
        "county": county,
        "countyName": f"{county} (stand-in)",
        "kind": "raster",
        "title": "Aerial imagery (stand-in)",
        "minzoom": MINZOOM,
        "maxzoom": MAXZOOM,
        "bounds": [w, s, e, n],
        "bytes": pmtiles.stat().st_size,
        "buildDate": today,
        "tileSize": SIZE,
        "sources": [
            {
                "name": "Stand-in test imagery (synthetic checkerboard)",
                "license": "None needed: generated by app/scripts/make-standin-aerial.py",
                "credit": "Stand-in imagery for testing. Not real.",
                "url": "",
                "dataDate": today,
            }
        ],
        "notes": "Synthetic tiles for testing the app before the real aerial archive exists. Never ship this.",
    }
    (folder / "aerial.meta.json").write_text(json.dumps(meta_json, indent=2), encoding="utf-8")
    print(f"{county}: {count} tiles, {pmtiles.stat().st_size} bytes")


def main():
    counties = sorted(p for p in BUILD.iterdir() if (p / "basemap.meta.json").is_file()) if BUILD.is_dir() else []
    if not counties:
        sys.exit(f"no base map archives in {BUILD} to take county bounds from")
    for i, folder in enumerate(counties):
        bounds = json.loads((folder / "basemap.meta.json").read_text(encoding="utf-8"))["bounds"]
        build(folder.name, bounds, TONES[i % len(TONES)])


if __name__ == "__main__":
    main()
