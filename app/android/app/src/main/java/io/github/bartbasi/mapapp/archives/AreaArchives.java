// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import io.github.bartbasi.mapapp.downloads.AreaLayout;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * The archives of downloaded areas (downloads/AreaLayout). Only an area whose
 * "complete" file exists is listed, so an area still downloading, or one whose
 * last file is half written, is never opened as map data.
 */
final class AreaArchives implements ArchiveLocation {

    private final File root;

    AreaArchives(File root) {
        this.root = root;
    }

    @Override
    public String name() {
        return "downloaded";
    }

    @Override
    public List<Archive> list() {
        List<Archive> out = new ArrayList<>();
        File[] areas = root.listFiles();
        if (areas == null) return out;
        Arrays.sort(areas);
        for (File areaDir : areas) {
            String area = areaDir.getName();
            if (!ArchiveIds.isId(area) || !areaDir.isDirectory() || !AreaLayout.isComplete(areaDir)) continue;
            File[] counties = areaDir.listFiles();
            if (counties == null) continue;
            Arrays.sort(counties);
            for (File countyDir : counties) {
                String county = countyDir.getName();
                if (!ArchiveIds.isId(county) || !countyDir.isDirectory()) continue;
                String[] files = countyDir.list();
                if (files == null) continue;
                Arrays.sort(files);
                for (String file : files) {
                    if (!file.endsWith(".pmtiles")) continue;
                    String layer = file.substring(0, file.length() - ".pmtiles".length());
                    if (!ArchiveIds.isId(layer) || !AreaLayout.meta(areaDir, county, layer).isFile()) continue;
                    out.add(new Downloaded(area, county, layer, areaDir));
                }
            }
        }
        return out;
    }

    private static final class Downloaded implements Archive {
        private final String area;
        private final String county;
        private final String layer;
        private final File areaDir;

        Downloaded(String area, String county, String layer, File areaDir) {
            this.area = area;
            this.county = county;
            this.layer = layer;
            this.areaDir = areaDir;
        }

        @Override
        public String area() {
            return area;
        }

        @Override
        public String county() {
            return county;
        }

        @Override
        public String layer() {
            return layer;
        }

        @Override
        public String readMeta() throws IOException {
            try (InputStream in = new FileInputStream(AreaLayout.meta(areaDir, county, layer))) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int n;
                while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
                return out.toString(StandardCharsets.UTF_8.name());
            }
        }

        @Override
        public ArchiveReader open() throws IOException {
            return ChannelArchiveReader.forFile(AreaLayout.archive(areaDir, county, layer));
        }
    }
}
