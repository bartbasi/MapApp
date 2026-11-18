# Offline download screens: screenshots

Taken on 2026-11-17 in a desktop browser (Chromium through Playwright) on the development build, with owner names masked (`?maskOwners`). No owner name shows in any of them.

Shots 01 to 21 and 50 to 58 ran against the in-memory stand-in service (`app/src/downloads/fake-service.ts`, opened with `?fakeDownloads`), which downloads nothing, so every status and error can be shown. Its sizes follow the measurements in D33. Shots 30 to 46 and 60 to 66 ran against the real download manager (`app/src/downloads/service.ts`) with the browser stand-in for the phone's downloader, reading the test release from the local release test server on port 8765, with only the overview map and the Macon County property lines installed (`data/dev-step3`), as the phone build carries.

Sizes are in decimal units everywhere: 1 MB is 1,000,000 bytes, as Android's own storage settings count them (`app/src/ui/format.ts`). All shots were retaken after that change.

The outlines of downloads are a map layer under the position marker (`app/src/map/style/download-areas.ts`). The picker's frame stays drawn over the map, so it can stay still while the map moves, and it leaves a clear circle around the position marker and its accuracy circle (shots 35 and 46).

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
| 03-folded-county-macon-imagery-preselected-hybrid.png | Macon County card with the Hybrid view on: Map always included, Public land on in Layers so always included, Aerial imagery ticked because the view shows it. Size per layer and total 145 MB, the sentence saying property lines come with the app and are not part of the download, and, under the Download button until a first download has started, "Android may ask about notifications. They only show progress, and the download works either way." |
| 03-folded-county-macon-imagery-left-out.png | Imagery left out: the total drops to 4.4 MB. |
| 03-unfolded-county-cards-map-view.png | Both counties, Map view, so imagery starts unticked. |
| 03-landscape-county-macon-aerial-view.png | Macon County in the Aerial view, turned. |
| 18-folded-county-mobile-data-question.png | On mobile data, Download asks first: "Use 145 MB of mobile data?" with Download now and Not now. |
| 19-folded-county-not-enough-space.png | 60 MB free: the button is replaced by "Not enough space. It needs 197 MB free (the download and some room to spare) and the phone has 60.0 MB." and what to do. |
| 20-unfolded-offline-county-card-needs-connection.png | Offline: the card says "Downloading needs a connection." in place of the button. |

## Pick an area

| File | What it shows |
|---|---|
| 04-folded-pick-working-out-size.png | Just after opening: the frame on the map, "Working out the size" with a turning ring, the layers and the size of the area on the ground. Download is greyed. |
| 05-folded-pick-map-size-ready.png | Map view: imagery None, so 0.1 MB. The sentence about property lines sits under the imagery choice. The name ("Name: Macon County area 1", with Change) sits in the foot with the size and the Download button, so it is always in view. |
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
| 10-folded-pick-not-enough-space.png | 1 MB free: "Not enough space. It needs 54.3 MB free (the download and some room to spare) and the phone has 1.0 MB." Download greyed. The screens add the same room the service keeps spare (`SPACE_MARGIN_BYTES`), so a download they offer is one the service starts. |
| 11-folded-pick-size-failed.png | The size could not be worked out: the reason and Try again. |
| 12-folded-pick-before-unfold.png | Picking, folded. |
| 12-unfolded-pick-after-unfold.png | After unfolding: the panel moves beside the map, the frame changes shape, the same middle and the same amount of ground stay framed (1.7 MB of imagery before and after). |
| 12-folded-pick-after-fold-again.png | Folded again: the same area as before the unfold. |
| 13-folded-list-after-start.png | After Download: back to the list, the new area at the top, its outline named on the map. |

## The list of downloads

| File | What it shows |
|---|---|
| 14-folded-map-button-progress-and-stopped.png | The Offline maps button on the map while downloads run: a ring filling with progress, and a warning triangle because one has stopped. |
| 15-folded-list-01-north-timber.png | Downloading: progress bar, "2.6 of 5.6 MB", Pause, Show on map, Delete. Every download's outline is dashed on the map. |
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
| 15-folded-whole-county-card-on-this-phone.png | With Macon County downloaded with every layer (`?fakeDownloads=county`), each layer of its county card says "On this phone." and the foot says "All of these are on this phone." |
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

## Against the real download manager

| File | What it shows |
|---|---|
| 30-real-folded-invite.png | Zoomed in on Decatur with only the overview map and the property lines: the "Only a rough map here" card. |
| 31-real-folded-county-champaign-lines-note.png | The real list of counties. Champaign County card, with "Property lines are not part of the download, and none are offered for Champaign County yet." Map 12.0 MB (12,035,805 bytes). |
| 31-real-folded-county-macon-lines-note.png | Macon County card: "Property lines are not part of the download: they come with the app for Macon County and work offline." |
| 32-real-folded-pick-none.png, 32-real-folded-pick-low.png, 32-real-folded-pick-medium.png, 32-real-folded-pick-high.png | One area at each imagery detail, sized by the real manager: 0.6, 0.8, 1.0 and 1.5 MB. |
| 33-real-folded-list-downloading.png | Taken just after starting a 0.6 MB area. The test server is local, so it was already complete; the downloading state is in shot 37. |
| 34-real-folded-list-complete-outline-map.png, 34-real-folded-list-complete-outline-aerial.png | The finished area in the list and its outline, drawn by the map under the marker, named at its corner. |
| 35-real-folded-pick-marker-on-frame-map.png | The phone's position on the frame's left edge: the frame's line and dimming leave a clear circle around the dot and its accuracy circle. |
| 36-real-folded-pick-larger-area-high.png | A larger area at high detail: 3.4 MB. |
| 37-real-folded-list-downloading.png | Downloading, 0%: "0 of 3.4 MB". |
| 38-real-folded-list-paused.png | Paused: "0.8 of 3.4 MB. Tap Resume to go on." |
| 39-real-folded-list-complete.png | Resumed and complete. |
| 40-real-folded-show-on-map-hybrid.png | The downloaded imagery in the Hybrid view, with the outline named. |
| 41-real-folded-delete-asks.png | Delete asks first. |
| 42-real-folded-after-delete.png | Deleted: the list is empty again. |
| 43-real-unfolded-county-macon-lines-note.png | The Macon County card unfolded, with the property lines sentence. |
| 44-real-unfolded-pick-high.png | Picking an area unfolded, with the property lines sentence under the imagery choice. |
| 45-real-unfolded-list-outline-hybrid.png, 45-real-landscape-list-outline-hybrid.png | A finished area's outline in the Hybrid view, unfolded and turned. In the turned shot the area runs past the top of the map, so its name sits under the base view switch. |
| 46-real-unfolded-pick-marker-on-frame-hybrid.png | The position marker on the frame's top edge in the Hybrid view, with the position readout: the frame leaves the dot and its accuracy circle clear and stops above the readout. |
| 46-real-folded-pick-marker-after-fold-hybrid.png | The same after folding: the same ground, the marker still clear. |

## The back button

It can only be confirmed on the phone. In the browser the Escape key runs the same step (`app/src/ui/back.ts`, unit tested in `back.test.ts`). Against the real manager: from picking an area, back went to the list ("Offline maps"); from the list, back closed the panel; with nothing open, `window.mapappBack()` returned false, which leaves the press to the system.

## Third round: the tester's findings on the emulator

The tester's report is in `../emulator/README.md`. These shots show the fixes, in the browser. A phone keyboard cannot be shown in a browser, so shot 55 makes the page 430 px tall instead, about what is left of the cover screen with the keyboard up.

| File | Finding | What it shows |
|---|---|---|
| 50-folded-county-map-on-phone-imagery-missing.png | F4 | Macon County's map and public land are on the phone (`?fakeDownloads=county-map`) and imagery is not. The card says so layer by layer ("On this phone." against the first two) and "To download 141 MB": only the imagery. |
| 51-folded-list-two-macon-downloads.png | F4 | After Download: the new download is named "Macon County, aerial imagery" and holds only imagery, so the two Macon County entries read apart. |
| 52-folded-county-all-on-phone-after-imagery.png | F4 | Once the imagery is in: every layer "On this phone." and "All of these are on this phone." |
| 53-folded-pick-name-in-foot-and-notification-note.png | F2, F6 | Folded picker at rest: the name in the foot above the size, with Change, and the notification sentence under the Download button. |
| 54-folded-pick-naming.png | F2 | After Change: the name field opens in the foot, in place of the size, with Done. |
| 55-folded-pick-naming-keyboard-up.png | F2 | The page cut to 430 px tall, as with the keyboard up: the field and what was typed stay in view above the Download button. The frame keeps the ground it held while the name is typed. |
| 56-folded-pick-named-keyboard-down.png | F2 | After Done: "Name: Macon County area 1 north". |
| 57-folded-pick-both-counties-name.png | F9 | An area reaching into both counties is named "Champaign and Macon area 1". |
| 58-unfolded-pick-name-in-foot.png | F2 | The name in the foot, unfolded. |
| 60-real-folded-county-map-on-phone-imagery-ticked.png | F4 | The real manager: after a Macon County download of map and public land, imagery ticked: "To download 141 MB". |
| 61-real-folded-hybrid-outside-imagery-card.png | F3 | The Hybrid view in Decatur, outside the one area with imagery: "No imagery here on this phone. The Aerial and Hybrid views show only imagery you have downloaded." with Download imagery and Show the map. |
| 61-real-landscape-hybrid-outside-imagery-card.png | F3 | The same, unfolded and turned. |
| 62-real-landscape-after-show-the-map.png | F3 | After Show the map: the Map view, no card. |
| 63-real-folded-sources-collapsed.png, 63-real-unfolded-sources-collapsed.png | F8 | Sources and licenses with four downloads of Macon County: one line per layer for them, "Macon County, in 4 downloads. Built November 12, 2026, 6.3 MB in all." |
| 64-real-unfolded-list.png | F4 | The list with several Macon County downloads, each named by what it is. |
| 65-real-landscape-card-becomes-pill-for-marker.png | D26 | The phone's position where the whole imagery card would cover it: the card shrinks to a one-line "No imagery here" pill, which still opens the downloads. |
| 66-real-landscape-card-steps-away-from-marker.png | D26 | The position where even the pill would cover it: the card steps away. |

Bigger area and Smaller area (F9), measured on the picker's own size line, folded, starting 2.1 km across: three quick taps of Bigger area gave 17 km (8 times, exactly three doublings, though the taps came faster than the map moved), then each Smaller area tap gave 8.5, 4.2 and 2.1 km. Each tap now doubles or halves the width, about the frame's middle, from where the last tap was going.
