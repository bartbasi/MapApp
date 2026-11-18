# Offline download screens: screenshots

Taken on 2026-11-17 in a desktop browser (Chromium through Playwright) on the development build, with owner names masked (`?maskOwners`). No owner name shows in any of them.

The screens ran against the in-memory stand-in service (`app/src/downloads/fake-service.ts`, opened with `?fakeDownloads`), not the real download manager. The stand-in downloads nothing. Its sizes follow the measurements in D33. The real manager was not connected to the screens when these were taken.

Sizes:

- **folded**: 344 x 882 CSS pixels (the cover screen).
- **unfolded**: 690 x 829 (the inner screen, upright), the size used in Step 2.
- **landscape**: 736 x 613 (the inner screen, turned).

Shots 01 and 02 use a development server that serves only the overview map (`MAPAPP_ARCHIVES` pointed at a folder holding `overview/` alone), as a phone would have before any download. The rest use the full county data in `data/build`, so the Aerial and Hybrid views have imagery to show.

Downloads in the "states" set (`?fakeDownloads=states`), newest first: North timber (downloading), Creek bottom (waiting to start), Champaign County (paused), Lake shore (waiting for a connection), Stand 5 to Stand 1 (stopped by each error: other, damaged part, server, phone full, newer data), an unreadable download (a record the phone could not read), Macon County (ready).

## Getting there

| File | What it shows |
|---|---|
| 01-folded-map-invite-nothing-downloaded.png | Zoomed in on Decatur with only the overview map: the card "Only a rough map here" with a Download maps button, under the top controls and away from the position controls. The Offline maps button sits under the Layers button. |
| 01-unfolded-map-invite-nothing-downloaded.png | The same, unfolded. |
| 01-landscape-map-invite-nothing-downloaded.png | The same, unfolded and turned. |
| 01-folded-map-overview-no-invite-zoomed-out.png | Zoomed out to zoom 10, where the overview map has detail: no card. |
| 02-folded-panel-nothing-downloaded.png | The Offline maps panel with nothing downloaded: a sentence on what downloading is for, Pick an area, then each county. |
| 02-unfolded-panel-nothing-downloaded.png | The same, beside the map. |
| 02-landscape-panel-nothing-downloaded.png | The same, turned. |

## Whole county

| File | What it shows |
|---|---|
| 03-folded-county-macon-imagery-preselected-hybrid.png | Macon County card with the Hybrid view on: Map always included, Public land on in Layers so always included, Aerial imagery ticked because the view shows it. Size per layer and total 138 MB. |
| 03-folded-county-macon-imagery-left-out.png | Imagery left out: the total drops to 4.2 MB. |
| 03-unfolded-county-cards-map-view.png | Both counties, Map view, so imagery starts unticked. |
| 03-landscape-county-macon-aerial-view.png | Macon County in the Aerial view, turned. |
| 18-folded-county-mobile-data-question.png | On mobile data, Download asks first: "Use 138 MB of mobile data?" with Download now and Not now. |
| 19-folded-county-not-enough-space.png | 60 MB free: the button is replaced by "Not enough space" with the two sizes and what to do. |
| 20-unfolded-offline-county-card-needs-connection.png | Offline: the card says "Downloading needs a connection." in place of the button. |

## Pick an area

| File | What it shows |
|---|---|
| 04-folded-pick-working-out-size.png | Just after opening: the frame on the map, "Working out the size" with a turning ring, the layers and the size of the area on the ground. Download is greyed. |
| 05-folded-pick-map-size-ready.png | Map view: imagery None, so 0.2 MB. |
| 05-folded-pick-aerial-size-ready.png | Aerial view: imagery starts at High, 1.9 MB. |
| 05-folded-pick-hybrid-size-ready.png | Hybrid view, the same area. |
| 05-unfolded-pick-map-size-ready.png, 05-unfolded-pick-aerial-size-ready.png, 05-unfolded-pick-hybrid-size-ready.png | The same, unfolded: the controls beside the map, the frame in the map. |
| 05-landscape-pick-map-size-ready.png, 05-landscape-pick-aerial-size-ready.png, 05-landscape-pick-hybrid-size-ready.png | The same, turned. |
| 06-folded-pick-detail-low-aerial.png | Imagery detail Low: "Fields, woods and ponds show. The smallest download." |
| 06-folded-pick-detail-medium-aerial.png | Medium: "Tree lines, field edges and buildings show." |
| 06-folded-pick-after-bigger-area-twice-aerial.png | After tapping Bigger area twice: four times the ground, and its size. |
| 07-folded-pick-nothing-here.png | The frame outside both counties: "Nothing to download here." |
| 07-unfolded-pick-nothing-here.png | The same, unfolded. |
| 08-folded-pick-offline.png | Offline: "You are offline. The size and the download need a connection." |
| 09-folded-pick-mobile-data-note.png | On mobile data: the size, and "You are on mobile data. This download uses your data plan." |
| 09-folded-pick-mobile-data-question.png | After tapping Download on mobile data: "Use 1.9 MB of mobile data?" |
| 09-unfolded-pick-mobile-data-question.png | The same, unfolded. |
| 10-folded-pick-not-enough-space.png | 1 MB free: "Not enough space" under the size, Download greyed. |
| 10-folded-pick-start-refused-no-space.png | 20 MB free, enough for the 1.9 MB but not for the room the service keeps spare: the start is refused and the reason is shown with both sizes. |
| 11-folded-pick-size-failed.png | The size could not be worked out: the reason and Try again. |
| 12-folded-pick-before-unfold.png | Picking, folded. |
| 12-unfolded-pick-after-unfold.png | After unfolding: the panel moves beside the map, the frame changes shape, the same middle and the same amount of ground stay framed (1.7 MB of imagery before and after). |
| 12-folded-pick-after-fold-again.png | Folded again: the same area as before the unfold. |
| 13-folded-list-after-start.png | After Download: back to the list, the new area at the top, its outline named on the map. |

## The list of downloads

| File | What it shows |
|---|---|
| 14-folded-map-button-progress-and-stopped.png | The Offline maps button on the map while downloads run: a ring filling with progress, and a warning triangle because one has stopped. |
| 15-folded-list-01-north-timber.png | Downloading, 47%: progress bar, "2.6 of 5.6 MB", Pause, Show on map, Delete. Every download's outline is dashed on the map. |
| 15-folded-list-02-creek-bottom.png | Waiting to start: "Starts when the download before it is done." |
| 15-folded-list-03-champaign-county.png | Paused: striped bar, "Tap Resume to go on.", Resume. |
| 15-folded-list-04-lake-shore.png | Waiting for a connection: "Goes on by itself when the phone is online." |
| 15-folded-list-05-stand-5.png | Stopped by an error (other): Try again. |
| 15-folded-list-06-stand-4.png | Stopped: part of it arrived damaged. Download again. |
| 15-folded-list-07-stand-3.png | Stopped: the download server did not answer. Try again. |
| 15-folded-list-08-stand-2.png | Stopped: the phone is full, with how much to free. Try again. |
| 15-folded-list-09-stand-1.png | Stopped: newer map data came out. Download again. |
| 15-folded-list-10-unreadable-download.png | A record the phone could not read: "Unreadable download", only Delete, no outline on the map. |
| 15-folded-list-11-macon-county-complete.png | Ready to use offline, with the free space on the phone under the list. |
| 15-folded-whole-county-card-on-this-phone.png | With Macon County downloaded (`?fakeDownloads=county`), its county card says "On this phone." in place of the Download button, because a download would only repeat it. |
| 15-unfolded-list-failed-cards.png | Failed cards, unfolded. |
| 15-landscape-list-failed-cards.png | Failed cards, turned. |
| 16-folded-delete-asks-first.png | Delete asks first, inside the card: "Delete Macon County from this phone? This place will no longer have a map when you are offline." Delete and Keep it. |
| 17-folded-show-on-map-map.png, 17-folded-show-on-map-aerial.png, 17-folded-show-on-map-hybrid.png | Show on map for North timber: the map moves to it above the sheet, its outline drawn heavier and named, in each view. |
| 17-unfolded-show-on-map-map.png, 17-unfolded-show-on-map-aerial.png, 17-unfolded-show-on-map-hybrid.png | Show on map for Macon County, unfolded, in each view. |
| 17-landscape-show-on-map-map.png, 17-landscape-show-on-map-aerial.png, 17-landscape-show-on-map-hybrid.png | The same, turned. |

## Connection

| File | What it shows |
|---|---|
| 08-folded-list-offline-note.png | Offline: "You are offline. Maps already on this phone still work, and so does your position. Sizes and new downloads need a connection." |
| 18-folded-list-mobile-data-note.png | On mobile data: "Downloads use your data plan. You are asked before each one starts." |
| 20-folded-offline-no-list-of-counties.png | Offline and the list of counties never fetched: it says the list needs a connection the first time. |
| 20-unfolded-offline-county-on-phone.png | Offline with Macon County downloaded. |

## Sources and licenses

| File | What it shows |
|---|---|
| 21-folded-sources-grouped-by-layer.png | The Sources and licenses screen now lists each layer once, with each place it covers under it (overview map, each county, later each download), and each source once. |
| 21-unfolded-sources-grouped-by-layer.png | The same, unfolded. |
