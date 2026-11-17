// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Every word the position readout says (D26), from the readout model in
// readout.ts. Plain words, one idea per sentence, feet first with meters in
// brackets. Each state differs in words and icon as well as colour, so the
// colour is never the only signal.

import { accuracyText, formatDistance as formatApprox } from '../position/messages';
import { formatDate } from '../ui/format';
import { formatDistance } from './format';
import { acresText, ownerText } from './owner-text';
import type { ParcelDetails } from './parcel-source';
import type { LineReadout, PlaceReadout, Readout } from './readout';

/** The statement shown with every parcel answer. */
export const SURVEY_TEXT = 'From county tax records. Not a legal survey.';

/** What a place with no parcel usually is. */
export const GAP_TEXT = 'This is often a road or a railway.';

/**
 * - clear: the phone is placed (inside a parcel, or clearly in no parcel).
 * - caution: on or near a line, either side possible.
 * - weak: the GPS is too poor to place the phone.
 * - none: no parcel answer for this place.
 */
export type ReadoutTone = 'clear' | 'caution' | 'weak' | 'none';
export type ReadoutIcon = 'parcel' | 'caution' | 'gap' | 'weak-gps' | 'no-lines';

export interface ReadoutView {
  kind: Readout['kind'] | 'pending';
  tone: ReadoutTone;
  icon: ReadoutIcon;
  /** The first line, large. */
  title: string;
  /** Lines under the title, normal size. */
  lines: string[];
  /** In the caution state: what lies on each of the two sides. */
  sides: string[];
  /** Small lines at the foot. */
  small: string[];
  /** Shown when the readout is opened. */
  more: string[];
  /** A heading for moreList, when there is one. */
  moreListTitle: string;
  /** Long lists (many parcels stacked on one spot), shown when opened, in a scrolling box. */
  moreList: string[];
  /** Whether there is anything to open. */
  expandable: boolean;
}

export interface ReadoutViewOptions {
  /** Development only: owner names replaced (see owner-text.ts). */
  masked: boolean;
  /** The fix is old: the readout says so. */
  staleFix: boolean;
  /** The counties that have property lines installed, by display name, for the no-data message. */
  countiesWithLines: readonly string[];
}

const NBSP = ' ';
/** "85 ft (26 m)", never broken across lines. */
const dist = (m: number) => formatDistance(m).text.replace(/ /g, NBSP);

/** "85 ft (26 m) to the NE", kept on one line. */
function distanceAndWay(l: LineReadout): string {
  return `${dist(l.distanceM)}${NBSP}to${NBSP}the${NBSP}${l.compass}`;
}

function lineText(l: LineReadout): string {
  return `Property line ${distanceAndWay(l)}`;
}

/** "OWNER, parcel 12-34-567". */
export function parcelLabel(p: ParcelDetails, masked: boolean): string {
  return `${ownerText(p.owner, masked, 'short')}, parcel ${p.pid}`;
}

function moreAtSpot(n: number): string {
  return n === 1 ? 'and 1 more parcel at this spot' : `and ${n} more parcels at this spot`;
}

/** One side of a line in the caution state: the first parcel, how many more, or no parcel. */
function sideText(side: readonly ParcelDetails[], masked: boolean): string {
  const first = side[0];
  if (!first) return 'No parcel. Often a road or a railway.';
  return side.length > 1 ? `${parcelLabel(first, masked)}, ${moreAtSpot(side.length - 1)}` : parcelLabel(first, masked);
}

function countyLine(p: ParcelDetails): string {
  const county = p.countyName || p.county;
  return p.dataDate ? `${county}. County data of ${formatDate(p.dataDate)}.` : `${county}.`;
}

function joinCounties(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function empty(kind: ReadoutView['kind'], tone: ReadoutTone, icon: ReadoutIcon, title: string): ReadoutView {
  return { kind, tone, icon, title, lines: [], sides: [], small: [], more: [], moreListTitle: '', moreList: [], expandable: false };
}

function finish(v: ReadoutView): ReadoutView {
  return { ...v, expandable: v.more.length > 0 || v.moreList.length > 0 };
}

/** A short summary of a guess, for the poor-fix state. */
function guessText(g: PlaceReadout, masked: boolean): string {
  switch (g.kind) {
    case 'inside':
      return `Probably: ${parcelLabel(g.parcel, masked)}.`;
    case 'near-line': {
      const ids = [g.thisSide[0], g.otherSide[0]].map((p) => (p ? `parcel ${p.pid}` : 'no parcel'));
      return `Probably: near the line between ${ids[0]} and ${ids[1]}.`;
    }
    case 'no-parcel':
      return 'Probably: not in a parcel.';
  }
}

/** The readout's words for a readout model, or for none yet ('pending'). */
export function readoutView(r: Readout | null, options: ReadoutViewOptions): ReadoutView {
  const { masked } = options;
  const stale = options.staleFix ? ['From the last GPS position.'] : [];
  if (!r) {
    return empty('pending', 'none', 'no-lines', 'Checking the property lines here.');
  }
  switch (r.kind) {
    case 'no-data': {
      if (r.reason === 'stale') return empty('pending', 'none', 'no-lines', 'Checking the property lines here.');
      if (r.reason === 'read-error') {
        return { ...empty('no-data', 'none', 'no-lines', 'The property lines could not be read here.'), lines: ['The map file may be damaged.'] };
      }
      const v = empty('no-data', 'none', 'no-lines', 'No property lines for this place yet.');
      const counties = joinCounties(options.countiesWithLines);
      return { ...v, lines: counties ? [`Property lines are installed for ${counties} only.`] : [] };
    }
    case 'inside': {
      const v = empty('inside', 'clear', 'parcel', ownerText(r.parcel.owner, masked, 'short'));
      v.lines = [r.line ? lineText(r.line) : `No property line within ${dist(r.searchRadiusM)}`];
      if (r.alsoIn.length) v.lines.push(moreAtSpot(r.alsoIn.length));
      v.small = [`Parcel ${r.parcel.pid} · ${accuracyText(r.accuracyM)}`, ...stale];
      if (r.neighbour) v.more.push(`Across that line: ${parcelLabel(r.neighbour, masked)}.`);
      else if (r.line) v.more.push('Across that line: no parcel. Often a road or a railway.');
      v.more.push(`Parcel ${r.parcel.pid}: ${acresText(r.parcel.acres)}.`, countyLine(r.parcel), SURVEY_TEXT);
      if (r.alsoIn.length) {
        v.moreListTitle = 'Also at this spot';
        v.moreList = r.alsoIn.map((p) => parcelLabel(p, masked));
      }
      return finish(v);
    }
    case 'near-line': {
      const v = empty('near-line', 'caution', 'caution', 'On or near a property line.');
      v.lines = ['GPS cannot tell which side.'];
      v.sides = [sideText(r.thisSide, masked), sideText(r.otherSide, masked)];
      v.small = [accuracyText(r.accuracyM), ...stale];
      const first = r.thisSide[0] ?? r.otherSide[0];
      v.more.push(`The line is ${distanceAndWay(r.line)}.`);
      if (first) v.more.push(countyLine(first));
      v.more.push(SURVEY_TEXT);
      const extra = [...r.thisSide.slice(1), ...r.otherSide.slice(1)];
      if (extra.length) {
        v.moreListTitle = 'Also at these spots';
        v.moreList = extra.map((p) => parcelLabel(p, masked));
      }
      return finish(v);
    }
    case 'no-parcel': {
      const v = empty('no-parcel', 'clear', 'gap', 'Not in a parcel.');
      v.lines = [GAP_TEXT];
      const nearest = r.line ? [`Nearest property line ${distanceAndWay(r.line)}`] : [];
      v.small = [...nearest, accuracyText(r.accuracyM), ...stale];
      if (r.nearest) v.more.push(`Across that line: ${parcelLabel(r.nearest, masked)}.`);
      v.more.push(SURVEY_TEXT);
      return finish(v);
    }
    case 'poor-fix': {
      const v = empty('poor-fix', 'weak', 'weak-gps', 'GPS is too weak to place you.');
      v.lines = [Number.isFinite(r.accuracyM) ? `Accurate to about ${formatApprox(r.accuracyM)}.` : 'Its accuracy is not known.', guessText(r.guess, masked)];
      v.small = [...stale];
      v.more.push('Wait for a better signal, or move into the open.', SURVEY_TEXT);
      return finish(v);
    }
  }
}
