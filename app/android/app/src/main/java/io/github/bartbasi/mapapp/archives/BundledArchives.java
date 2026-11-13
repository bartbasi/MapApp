// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import android.content.res.AssetManager;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Archives shipped inside the APK under assets/archives/<county-id>/. They are
 * put there by "npm run stage-archives" before a build. The build stores
 * .pmtiles assets uncompressed (see app/build.gradle), which is what lets them
 * be read in place through the asset's file descriptor.
 */
public final class BundledArchives implements ArchiveLocation {

    private static final String ROOT = "archives";
    private final AssetManager assets;

    public BundledArchives(AssetManager assets) {
        this.assets = assets;
    }

    @Override
    public String name() {
        return "bundled";
    }

    @Override
    public List<Archive> list() throws IOException {
        List<Archive> out = new ArrayList<>();
        String[] counties = assets.list(ROOT);
        if (counties == null) return out;
        Arrays.sort(counties);
        for (String county : counties) {
            if (!ArchiveIds.isId(county)) continue;
            String[] files = assets.list(ROOT + "/" + county);
            if (files == null) continue;
            List<String> names = Arrays.asList(files);
            for (String file : files) {
                if (!file.endsWith(".pmtiles")) continue;
                String layer = file.substring(0, file.length() - ".pmtiles".length());
                if (!ArchiveIds.isId(layer) || !names.contains(layer + ".meta.json")) continue;
                out.add(new Bundled(county, layer));
            }
        }
        return out;
    }

    private final class Bundled implements Archive {
        private final String county;
        private final String layer;

        Bundled(String county, String layer) {
            this.county = county;
            this.layer = layer;
        }

        @Override
        public String county() {
            return county;
        }

        @Override
        public String layer() {
            return layer;
        }

        private String path(String suffix) {
            return ROOT + "/" + county + "/" + layer + suffix;
        }

        @Override
        public String readMeta() throws IOException {
            try (InputStream in = assets.open(path(".meta.json"))) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int n;
                while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
                return out.toString(StandardCharsets.UTF_8.name());
            }
        }

        @Override
        public ArchiveReader open() throws IOException {
            // openFd fails for a compressed asset, which would mean the build
            // setting that keeps .pmtiles uncompressed is missing.
            return ChannelArchiveReader.forAsset(assets.openFd(path(".pmtiles")));
        }
    }
}
