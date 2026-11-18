# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Publish built archives as files of a GitHub release, with a catalog the app reads.

    python -I pipeline/publish.py stage  <tag> [--base <url>]
    python -I pipeline/publish.py upload <tag> --yes-publish
    python -I pipeline/publish.py verify <tag>

upload and verify need only the Python standard library, so they run with
Windows Python, where the GitHub command line tool is.

stage   Run this one in WSL: checking a raster archive needs GDAL.
        Checks each archive against the contract, and makes data/publish/<tag>/
        with the archives under flat names (<county>.<layer>.pmtiles) and a
        catalog.json. Nothing leaves this machine. With --base the catalog
        points at another server, for tests against this laptop.
upload  Creates the GitHub release <tag> and uploads the staged files. This is
        the step that publishes. It refuses to run without --yes-publish, and
        the owner's word is needed first (CLAUDE.md, rules 1 and 6). After the
        upload it reads each file back (see verify) and only then copies the
        catalog to catalog/catalog.json, which is the file the app fetches.
verify  Reads the first bytes of each published file back from its public
        address and compares them, and the file's size, with the staged copy.

A release tag is never reused. A phone in the middle of a download must keep
getting the same bytes, so new data goes out under a new tag and the catalog
moves to it.

County parcel archives are never published by this script. The list of layers
that may be published is PUBLISHABLE below. Adding "parcels" to it needs the
owner's plain word first and an entry in docs/DECISIONS.md (D15, D25).
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request

sys.dont_write_bytecode = True
_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.name == "nt" and "PMTILES" not in os.environ:
    os.environ["PMTILES"] = os.path.join(_REPO, ".tools", "pmtiles", "pmtiles.exe")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import mapdata as md  # noqa: E402

# Layers whose sources all allow redistribution (docs/DATA_SOURCES.md).
PUBLISHABLE = ("basemap", "aerial", "publicland")
NEVER = ("parcels",)

PUBLISH = os.path.join(md.REPO, "data", "publish")
CATALOG = os.path.join(md.REPO, "catalog", "catalog.json")
TAG_RE = re.compile(r"^data-\d{4}-\d{2}-\d{2}(-[a-z0-9]+)?$")
GITHUB_LIMIT = 2 * 1024**3  # each release file must be under 2 GiB


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def repo_slug():
    """owner/name of the origin remote."""
    # Read from .git/config, so this works in WSL too, where git refuses a
    # repository on the Windows drive.
    with open(os.path.join(md.REPO, ".git", "config"), encoding="utf-8") as f:
        m = re.search(r'\[remote "origin"\][^\[]*?url\s*=\s*\S*github\.com[:/]([^/\s]+/[^/\s]+?)(\.git)?\s', f.read())
    if not m:
        raise md.PipelineError("the origin remote is not a GitHub address")
    return m.group(1)


def check_tag(tag):
    if not TAG_RE.match(tag):
        raise md.PipelineError("the tag must look like data-2026-11-17 or data-2026-11-17-b")


def stage_dir(tag):
    return os.path.join(PUBLISH, tag)


def asset_name(county, layer):
    return f"{county}.{layer}.pmtiles"


def refuse_parcels(names):
    bad = [n for n in names if any(word in n.lower() for word in NEVER)]
    if bad:
        raise md.PipelineError("refusing to go on: parcel data is never published. Found: " + ", ".join(bad))


def stage(tag, base):
    check_tag(tag)
    final = stage_dir(tag)
    if os.path.exists(final):
        raise md.PipelineError(f"{final} exists already. Remove it or use a new tag.")
    out = final + ".tmp"
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    base = base or f"https://github.com/{repo_slug()}/releases/download/{tag}/"
    if not base.endswith("/"):
        base += "/"
    entries = []
    for county in md.load_counties():
        for layer in PUBLISHABLE:
            archive = os.path.join(md.BUILD, county["id"], f"{layer}.pmtiles")
            meta_path = os.path.join(md.BUILD, county["id"], f"{layer}.meta.json")
            if not os.path.exists(archive):
                md.log(f"  {county['id']}/{layer}: not built, left out")
                continue
            meta = md.read_json(meta_path)
            problems = md.validate_meta(meta, archive)
            size = os.path.getsize(archive)
            if meta.get("bytes") != size:
                problems.append(f"metadata says {meta.get('bytes')} bytes, the file has {size}")
            if size >= GITHUB_LIMIT:
                problems.append("the file is 2 GiB or more and must be split first")
            if problems:
                raise md.PipelineError(f"{county['id']}/{layer} does not match the contract:\n  " + "\n  ".join(problems))
            name = asset_name(county["id"], layer)
            dest = os.path.join(out, name)
            try:
                os.link(archive, dest)
            except OSError:
                shutil.copyfile(archive, dest)
            public_meta = {k: v for k, v in meta.items() if k != "provenance"}
            entries.append({"county": county["id"], "layer": layer, "file": name, "bytes": size, "sha256": sha256(dest), "meta": public_meta})
            md.log(f"  {name}: {size:,} bytes")
    if not entries:
        raise md.PipelineError("nothing to publish")
    refuse_parcels(os.listdir(out))
    catalog = {
        "schema": 1,
        "release": tag,
        "published": datetime.date.today().isoformat(),
        "base": base,
        "archives": entries,
    }
    md.atomic_write_json(os.path.join(out, "catalog.json"), catalog)
    with open(os.path.join(out, "RELEASE_NOTES.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(release_notes(catalog))
    total = sum(e["bytes"] for e in entries)
    os.rename(out, final)
    md.log(f"staged {len(entries)} archives, {total:,} bytes, in {final}")
    return catalog


def release_notes(catalog):
    lines = [
        "Map data for MapApp. The app downloads these files. They are not meant to be opened by hand.",
        "",
        "Each file is a PMTiles archive of one layer for one county. No county parcel data is published here.",
        "",
        "| File | Size | Sources and licenses |",
        "|---|---|---|",
    ]
    for e in catalog["archives"]:
        src = "; ".join(f"{s['name']} ({s['license']})" for s in e["meta"]["sources"])
        lines.append(f"| `{e['file']}` | {e['bytes'] / 1e6:.1f} MB | {src} |")
    credits = []
    for e in catalog["archives"]:
        for s in e["meta"]["sources"]:
            if s.get("credit") and s["credit"] not in credits:
                credits.append(s["credit"])
    lines += ["", "Credits:", ""] + [f"- {c}" for c in credits] + [""]
    return "\n".join(lines)


def staged_catalog(tag):
    path = os.path.join(stage_dir(tag), "catalog.json")
    if not os.path.exists(path):
        raise md.PipelineError(f"{tag} is not staged. Run: publish.py stage {tag}")
    return md.read_json(path)


def check_staged(tag, catalog):
    """Every staged file still has the size and checksum the catalog gives.
    The staged files may be hard links to data/build, so a rebuild since
    staging could have changed them under the catalog."""
    for e in catalog["archives"]:
        path = os.path.join(stage_dir(tag), e["file"])
        if os.path.getsize(path) != e["bytes"] or sha256(path) != e["sha256"]:
            raise md.PipelineError(f"{e['file']} changed since it was staged. Stage again under a new folder.")


def read_back(url, length):
    """(the first `length` bytes, the whole file's size) from a public address."""
    req = urllib.request.Request(url, headers={"Range": f"bytes=0-{length - 1}", "User-Agent": md.USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
        total = r.headers.get("Content-Range", "").rpartition("/")[2]
        if r.status != 206 or not total.isdigit():
            raise md.PipelineError(f"{url} did not answer a byte range request (status {r.status})")
        return data, int(total)


def verify(tag):
    check_tag(tag)
    catalog = staged_catalog(tag)
    ok = True
    for e in catalog["archives"]:
        local = os.path.join(stage_dir(tag), e["file"])
        with open(local, "rb") as f:
            head = f.read(16384)
        data, total = read_back(catalog["base"] + e["file"], len(head))
        good = data == head and total == e["bytes"]
        ok = ok and good
        md.log(f"  {e['file']}: {'matches' if good else 'DIFFERS'} ({total:,} bytes published)")
    if not ok:
        raise md.PipelineError("a published file differs from the staged copy")
    return catalog


def upload(tag, yes):
    check_tag(tag)
    if not yes:
        raise md.PipelineError("upload publishes files to the public repository. It needs the owner's word and --yes-publish.")
    catalog = staged_catalog(tag)
    out = stage_dir(tag)
    refuse_parcels(os.listdir(out))
    if "github.com/" not in catalog["base"]:
        raise md.PipelineError("this staging was made with --base for a test server. Stage again without --base.")
    check_staged(tag, catalog)
    files = [os.path.join(out, e["file"]) for e in catalog["archives"]] + [os.path.join(out, "catalog.json")]
    subprocess.run(
        ["gh", "release", "create", tag, "--repo", repo_slug(), "--title", f"Map data {tag[5:]}",
         "--notes-file", os.path.join(out, "RELEASE_NOTES.md"), "--latest=false", *files],
        check=True, cwd=md.REPO)
    verify(tag)
    os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
    md.atomic_write_json(CATALOG, catalog)
    md.log(f"published. Commit and push {os.path.relpath(CATALOG, md.REPO)} to point the app at {tag}.")


def main(argv):
    ap = argparse.ArgumentParser(prog="publish.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("stage")
    a.add_argument("tag")
    a.add_argument("--base", help="address the catalog points at, for a test server")
    a = sub.add_parser("upload")
    a.add_argument("tag")
    a.add_argument("--yes-publish", action="store_true")
    a = sub.add_parser("verify")
    a.add_argument("tag")
    args = ap.parse_args(argv)
    if args.cmd == "stage":
        stage(args.tag, args.base)
    elif args.cmd == "upload":
        upload(args.tag, args.yes_publish)
    else:
        verify(args.tag)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except md.PipelineError as e:
        md.log(f"error: {e}")
        sys.exit(2)
    except subprocess.CalledProcessError as e:
        md.log(f"error: {' '.join(str(x) for x in e.cmd[:3])} failed with status {e.returncode}")
        sys.exit(2)
