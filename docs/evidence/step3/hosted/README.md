# The first data release on GitHub, read back

2026-11-18. The owner said yes to publishing the six map archives. Release `data-2026-11-18`,
six archives, 382,678,011 bytes, no parcel data. Published with
`python -I pipeline/publish.py upload data-2026-11-18 --yes-publish`.

## What the publishing script read back

After the upload it read the first 16,384 bytes and the size of each file from its public address
and compared them with the staged copy.

    il-champaign.basemap.pmtiles: matches (12,035,805 bytes published)
    il-champaign.aerial.pmtiles: matches (225,572,890 bytes published)
    il-champaign.publicland.pmtiles: matches (132,841 bytes published)
    il-macon.basemap.pmtiles: matches (4,271,625 bytes published)
    il-macon.aerial.pmtiles: matches (140,565,035 bytes published)
    il-macon.publicland.pmtiles: matches (99,815 bytes published)

## The download manager against GitHub's real servers

`MAPAPP_CHECK_HOSTED=1 npx vitest run src/downloads/hosted-release.test.ts --silent=false --reporter=verbose`,
run from this laptop before `catalog/catalog.json` was pushed. Three tests, all passed. This is the
TypeScript manager with the in-memory downloader, in Node. It is not the Android downloader.

    published release, two signed addresses: [{"host":"release-assets.githubusercontent.com","status":206,"range":"bytes 0-126/132841","etag":"\"0x8DF4570780E1E5F\"","encoding":null},{"host":"release-assets.githubusercontent.com","status":206,"range":"bytes 0-126/132841","etag":"\"0x8DF4570780E1E5F\"","encoding":null}]
    published release, 3 km box: 1596855 bytes (basemap 707136, aerial 880388, publicland 9331); 4 planning reads in 236 ms, 46 download reads in 2385 ms
    published release, Macon County map and public land: 4371440 bytes in 349 ms, 3 reads

What this shows about the points D33 listed as untested:

- The release address answers with a redirect to `release-assets.githubusercontent.com`.
- That address answers a byte range with 206 and the right Content-Range.
- The ETag is the same across two separately issued signed addresses.
- 50 range reads in a row were answered, and every tile of the 3 km box matched the staged files.
- A whole county's files arrived whole and passed their checksums.

Not shown here: what a signed address answers once it has run out, rate limits under heavy use,
and the Android downloader itself against GitHub.
