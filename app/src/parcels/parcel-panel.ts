// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// What the details panel says about the parcels at a tapped point. The panel
// shows owner name, acreage, parcel ID, county and data date, and nothing
// else (D8, D25).

import { formatDate } from '../ui/format';
import { acresText, ownerText } from './owner-text';
import { isNamedParcel } from './parcel-record';
import type { ParcelDetails, ParcelLookup } from './parcel-source';
import { GAP_TEXT, SURVEY_TEXT, parcelLabel } from './readout-view';

export interface ParcelFact {
  label: string;
  value: string;
}

export interface ParcelCard {
  /** pid and county, for highlighting it on the map. */
  pid: string;
  county: string;
  owner: string;
  facts: ParcelFact[];
}

export type ParcelPanel =
  | {
      kind: 'parcels';
      /** The smallest parcel at the point, in full. */
      first: ParcelCard;
      /** Other parcels at the same point (stacked records), one line each. */
      others: string[];
      survey: string;
    }
  /** The point is in no parcel, or only in a record with no parcel ID. */
  | { kind: 'gap'; title: string; text: string }
  /** No parcel data here, or it could not be read. */
  | { kind: 'no-data'; title: string; text: string };

function card(p: ParcelDetails, masked: boolean): ParcelCard {
  return {
    pid: p.pid,
    county: p.county,
    owner: ownerText(p.owner, masked, 'full'),
    facts: [
      { label: 'Acreage', value: acresText(p.acres) },
      { label: 'Parcel ID', value: p.pid },
      { label: 'County', value: p.countyName || p.county },
      { label: 'Data date', value: p.dataDate ? formatDate(p.dataDate) : 'Not stated' },
    ],
  };
}

/**
 * The panel's parcel part for a lookup.
 * @param countiesWithLines display names of the counties with property lines installed
 */
export function parcelPanel(lookup: ParcelLookup, masked: boolean, countiesWithLines: readonly string[]): ParcelPanel {
  if (lookup.coverage === 'read-error') {
    return { kind: 'no-data', title: 'The property lines could not be read here.', text: 'The map file may be damaged.' };
  }
  if (lookup.coverage !== 'ok') {
    const names = countiesWithLines.length ? ` Property lines are installed for ${countiesWithLines.join(', ')} only.` : '';
    return { kind: 'no-data', title: 'No property lines for this place yet.', text: names.trim() };
  }
  const named = lookup.parcels.filter(isNamedParcel);
  const first = named[0];
  if (!first) return { kind: 'gap', title: 'Not in a parcel.', text: GAP_TEXT };
  return {
    kind: 'parcels',
    first: card(first, masked),
    others: named.slice(1).map((p) => `${parcelLabel(p, masked)}, ${acresText(p.acres).replace('Acreage not listed in the county record', 'acreage not listed')}`),
    survey: SURVEY_TEXT,
  };
}
