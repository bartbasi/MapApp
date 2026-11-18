// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Request paths for bundled and downloaded archives, and everything refused. */
public class ArchiveIdsTest {

    @Test
    public void bundledPaths() {
        assertEquals("il-macon/basemap", ArchiveIds.keyFromPath("/_tiles/il-macon/basemap.pmtiles"));
        assertEquals("overview/basemap", ArchiveIds.keyFromPath("/_tiles/overview/basemap.pmtiles"));
    }

    @Test
    public void areaPaths() {
        assertEquals("_area/deer-camp-1/il-macon/aerial", ArchiveIds.keyFromPath("/_tiles/_area/deer-camp-1/il-macon/aerial.pmtiles"));
        assertEquals(ArchiveIds.key("a1", "il-macon", "aerial"), ArchiveIds.keyFromPath("/_tiles/_area/a1/il-macon/aerial.pmtiles"));
        assertEquals(ArchiveIds.key(null, "il-macon", "aerial"), ArchiveIds.keyFromPath("/_tiles/il-macon/aerial.pmtiles"));
    }

    @Test
    public void areaAndCountyKeysNeverCollide() {
        // "_area" cannot be a county ID, so it cannot appear as a bundled archive's county.
        assertFalse(ArchiveIds.isId("_area"));
        assertNull(ArchiveIds.keyFromPath("/_tiles/_area/basemap.pmtiles"));
    }

    @Test
    public void escapesAndOddNamesAreRefused() {
        String[] bad = {
            null,
            "",
            "/_tiles/",
            "/_tiles/../secret.pmtiles",
            "/_tiles/il-macon/../basemap.pmtiles",
            "/_tiles/_area/../il-macon/basemap.pmtiles",
            "/_tiles/_area/a1/../../basemap.pmtiles",
            "/_tiles/_area/a1/il-macon/../aerial.pmtiles",
            "/_tiles/_area/a1/il-macon/sub/aerial.pmtiles",
            "/_tiles/_area/A1/il-macon/aerial.pmtiles",
            "/_tiles/_area/-a/il-macon/aerial.pmtiles",
            "/_tiles/_area/.staging/il-macon/aerial.pmtiles",
            "/_tiles/_area/a1/il-macon/aerial.meta.json",
            "/_tiles/_area/a1/il-macon/aerial.pmtiles/",
            "/_tiles/_area/a1/il-macon/aerial.pmtiles\n",
            "/_tiles/IL-macon/basemap.pmtiles",
            "/_tiles/il macon/basemap.pmtiles",
            "/_tiles/il-macon/basemap.pmtiles.part",
            "/_tiles/il-macon/basemap",
            "//_tiles/il-macon/basemap.pmtiles",
            "/x/_tiles/il-macon/basemap.pmtiles",
        };
        for (String p : bad) assertNull(String.valueOf(p), ArchiveIds.keyFromPath(p));
    }

    @Test
    public void ids() {
        assertTrue(ArchiveIds.isId("a"));
        assertTrue(ArchiveIds.isId("0-9"));
        assertFalse(ArchiveIds.isId(null));
        assertFalse(ArchiveIds.isId("-a"));
        assertFalse(ArchiveIds.isId(".trash-a"));
        assertFalse(ArchiveIds.isId("a_b"));
        assertFalse(ArchiveIds.isId(new String(new char[65]).replace('\0', 'a')));
    }
}
