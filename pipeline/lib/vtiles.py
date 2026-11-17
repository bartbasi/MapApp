# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""A small reader for PMTiles version 3 archives and Mapbox Vector Tiles.

Pure Python with no outside packages, so the checks run anywhere. It reads:
the archive header, every tile entry (z, x, y, offset, length), the bytes of
one tile, and the layers, features, properties and geometry of a vector tile.

    from vtiles import Archive, decode_tile
    with Archive(path) as a:
        for z, x, y, off, length in a.entries():
            layers = decode_tile(a.tile_data(off, length))
"""

import gzip
import json
import math
import struct
import zlib

COMPRESSION = {0: "unknown", 1: "none", 2: "gzip", 3: "brotli", 4: "zstd"}
TILE_TYPE = {0: "unknown", 1: "mvt", 2: "png", 3: "jpeg", 4: "webp", 5: "avif"}


# ------------------------------------------------------------------ varints

def _varint(buf, pos):
    result = 0
    shift = 0
    while True:
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if b < 0x80:
            return result, pos
        shift += 7


def _zigzag(n):
    return (n >> 1) ^ -(n & 1)


def _packed(buf):
    out = []
    pos, end = 0, len(buf)
    while pos < end:
        v, pos = _varint(buf, pos)
        out.append(v)
    return out


def _fields(buf):
    """Yield (field number, wire type, value) of a protobuf message. Length
    delimited values come back as memoryview slices."""
    pos, end = 0, len(buf)
    while pos < end:
        key, pos = _varint(buf, pos)
        field, wire = key >> 3, key & 7
        if wire == 0:
            v, pos = _varint(buf, pos)
        elif wire == 2:
            n, pos = _varint(buf, pos)
            v = buf[pos:pos + n]
            pos += n
        elif wire == 1:
            v = buf[pos:pos + 8]
            pos += 8
        elif wire == 5:
            v = buf[pos:pos + 4]
            pos += 4
        else:
            raise ValueError(f"unsupported protobuf wire type {wire}")
        yield field, wire, v


# ------------------------------------------------------------------ tile ids

def _rotate(n, x, y, rx, ry):
    if ry == 0:
        if rx == 1:
            x = n - 1 - x
            y = n - 1 - y
        x, y = y, x
    return x, y


def zxy_to_tileid(z, x, y):
    acc = ((1 << (2 * z)) - 1) // 3
    n = 1 << z
    d = 0
    s = n >> 1
    tx, ty = x, y
    while s > 0:
        rx = 1 if tx & s else 0
        ry = 1 if ty & s else 0
        d += s * s * ((3 * rx) ^ ry)
        tx, ty = _rotate(n, tx, ty, rx, ry)
        s >>= 1
    return acc + d


def tileid_to_zxy(tile_id):
    acc = 0
    for z in range(32):
        count = 1 << (2 * z)
        if acc + count > tile_id:
            t = tile_id - acc
            n = 1 << z
            x = y = 0
            s = 1
            while s < n:
                rx = 1 & (t // 2)
                ry = 1 & (t ^ rx)
                x, y = _rotate(s, x, y, rx, ry)
                x += s * rx
                y += s * ry
                t //= 4
                s *= 2
            return z, x, y
        acc += count
    raise ValueError(f"tile id {tile_id} is out of range")


# ------------------------------------------------------------------ archive

def _decompress(data, kind):
    if kind in (0, 1):
        return bytes(data)
    if kind == 2:
        return gzip.decompress(data)
    raise ValueError(f"compression {COMPRESSION.get(kind, kind)} is not supported here")


class Archive:
    """A PMTiles v3 archive on disk."""

    def __init__(self, path):
        self.path = path
        self.f = open(path, "rb")
        h = self.f.read(127)
        if len(h) < 127 or h[:7] != b"PMTiles" or h[7] != 3:
            raise ValueError(f"{path} is not a PMTiles version 3 archive")
        u = struct.unpack_from("<QQQQQQQQQQQ", h, 8)
        (self.root_off, self.root_len, self.meta_off, self.meta_len, self.leaf_off, self.leaf_len,
         self.data_off, self.data_len, self.addressed, self.entries_count, self.contents) = u
        self.clustered = h[96]
        self.internal_compression = h[97]
        self.tile_compression = h[98]
        self.tile_type = h[99]
        self.minzoom = h[100]
        self.maxzoom = h[101]
        mnlon, mnlat, mxlon, mxlat = struct.unpack_from("<iiii", h, 102)
        self.bounds = [mnlon / 1e7, mnlat / 1e7, mxlon / 1e7, mxlat / 1e7]
        self.center_zoom = h[118]
        clon, clat = struct.unpack_from("<ii", h, 119)
        self.center = [clon / 1e7, clat / 1e7]

    def close(self):
        self.f.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def _read(self, off, length):
        self.f.seek(off)
        return self.f.read(length)

    def header(self):
        return {"tile_type": TILE_TYPE.get(self.tile_type, self.tile_type),
                "tile_compression": COMPRESSION.get(self.tile_compression, self.tile_compression),
                "minzoom": self.minzoom, "maxzoom": self.maxzoom, "bounds": self.bounds,
                "center": self.center + [self.center_zoom], "addressed_tiles": self.addressed,
                "tile_entries": self.entries_count, "tile_contents": self.contents}

    def metadata(self):
        raw = _decompress(self._read(self.meta_off, self.meta_len), self.internal_compression)
        return json.loads(raw) if raw else {}

    def _directory(self, off, length):
        buf = _decompress(self._read(off, length), self.internal_compression)
        n, pos = _varint(buf, 0)
        ids, runs, lens, offs = [], [], [], []
        last = 0
        for _ in range(n):
            v, pos = _varint(buf, pos)
            last += v
            ids.append(last)
        for _ in range(n):
            v, pos = _varint(buf, pos)
            runs.append(v)
        for _ in range(n):
            v, pos = _varint(buf, pos)
            lens.append(v)
        for i in range(n):
            v, pos = _varint(buf, pos)
            if v == 0 and i > 0:
                offs.append(offs[i - 1] + lens[i - 1])
            else:
                offs.append(v - 1)
        return list(zip(ids, runs, offs, lens))

    def entries(self):
        """Yield (z, x, y, data offset, data length) for every addressed tile,
        in tile id order. Offsets are absolute positions in the file."""
        def walk(off, length):
            for tid, run, o, ln in self._directory(off, length):
                if run == 0:
                    yield from walk(self.leaf_off + o, ln)
                else:
                    for k in range(run):
                        z, x, y = tileid_to_zxy(tid + k)
                        yield z, x, y, self.data_off + o, ln
        yield from walk(self.root_off, self.root_len)

    def tile_data(self, off, length):
        """The decompressed bytes of the tile stored at (off, length)."""
        return _decompress(self._read(off, length), self.tile_compression)

    def find(self, z, x, y):
        """(offset, length) of tile z/x/y, or None."""
        tid = zxy_to_tileid(z, x, y)
        off, length = self.root_off, self.root_len
        for _ in range(4):
            entries = self._directory(off, length)
            lo, hi = 0, len(entries) - 1
            best = None
            while lo <= hi:
                mid = (lo + hi) // 2
                if entries[mid][0] <= tid:
                    best = mid
                    lo = mid + 1
                else:
                    hi = mid - 1
            if best is None:
                return None
            eid, run, o, ln = entries[best]
            if run == 0:
                off, length = self.leaf_off + o, ln
                continue
            if tid < eid + run:
                return self.data_off + o, ln
            return None
        return None

    def tile(self, z, x, y):
        hit = self.find(z, x, y)
        return self.tile_data(*hit) if hit else None


# ------------------------------------------------------------------ vector tiles

def _value(buf):
    for field, wire, v in _fields(buf):
        if field == 1:
            return bytes(v).decode("utf-8")
        if field == 2:
            return struct.unpack("<f", v)[0]
        if field == 3:
            return struct.unpack("<d", v)[0]
        if field == 4:
            return v - (1 << 64) if v >= (1 << 63) else v
        if field == 5:
            return v
        if field == 6:
            return _zigzag(v)
        if field == 7:
            return bool(v)
    return None


def decode_tile(data, geometry=True, layer_names=None):
    """Decode a vector tile into {layer name: {"extent": n, "features": [...]}}.
    Each feature is {"id": int or None, "type": 1|2|3, "properties": {...},
    "geometry": [...]} where geometry is a list of rings (or lines, or points)
    of (x, y) tile coordinates. Pass geometry=False to skip geometry."""
    buf = memoryview(data)
    out = {}
    for field, wire, lbuf in _fields(buf):
        if field != 3:
            continue
        name, extent, keys, values, raw_feats = None, 4096, [], [], []
        for f2, w2, v in _fields(lbuf):
            if f2 == 1:
                name = bytes(v).decode("utf-8")
            elif f2 == 2:
                raw_feats.append(v)
            elif f2 == 3:
                keys.append(bytes(v).decode("utf-8"))
            elif f2 == 4:
                values.append(_value(v))
            elif f2 == 5:
                extent = v
        if layer_names is not None and name not in layer_names:
            continue
        feats = []
        for fb in raw_feats:
            fid, ftype, tags, geom = None, 0, [], None
            for f3, w3, v in _fields(fb):
                if f3 == 1:
                    fid = v
                elif f3 == 2:
                    tags = _packed(v)
                elif f3 == 3:
                    ftype = v
                elif f3 == 4:
                    geom = v
            props = {}
            for i in range(0, len(tags) - 1, 2):
                props[keys[tags[i]]] = values[tags[i + 1]]
            feat = {"id": fid, "type": ftype, "properties": props}
            if geometry and geom is not None:
                feat["geometry"] = _geometry(_packed(geom))
            feats.append(feat)
        out[name] = {"extent": extent, "features": feats}
    return out


def _geometry(cmds):
    """Decode a command stream into a list of parts (rings for polygons)."""
    parts, cur = [], None
    x = y = 0
    i, n = 0, len(cmds)
    while i < n:
        cmd = cmds[i] & 7
        count = cmds[i] >> 3
        i += 1
        if cmd == 1 or cmd == 2:
            for _ in range(count):
                x += _zigzag(cmds[i])
                y += _zigzag(cmds[i + 1])
                i += 2
                if cmd == 1:
                    cur = [(x, y)]
                    parts.append(cur)
                else:
                    cur.append((x, y))
        elif cmd == 7:
            if cur:
                cur.append(cur[0])
        else:
            raise ValueError(f"bad geometry command {cmd}")
    return parts


def ring_area(ring):
    """Signed area in tile units. Positive is an outer ring in vector tile
    terms (clockwise with y pointing down)."""
    a = 0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return a / 2


def polygons(rings):
    """Group the rings of a polygon feature into [[outer, hole, ...], ...]."""
    out = []
    for r in rings:
        a = ring_area(r)
        if a > 0:
            out.append([r])
        elif a < 0 and out:
            out[-1].append(r)
    return out


def tile_to_lonlat(z, x, y, extent, px, py):
    """Tile coordinate (px, py) of tile z/x/y to (lon, lat) in degrees."""
    n = (1 << z) * extent
    gx = x * extent + px
    gy = y * extent + py
    lon = gx / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * gy / n))))
    return lon, lat
