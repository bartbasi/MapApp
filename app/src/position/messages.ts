// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Every word the app says about the position: the accuracy line and the
// messages for a refusal, Location switched off, the wait for a first fix and
// a fix that has gone stale. Plain words, one idea per sentence.

import type { PositionSnapshot } from './store';

const FEET_PER_METER = 3.28084;
/** Keeps a number on the same line as its unit. */
const NBSP = '\u00a0';

/** A distance in US units first, meters after: "13 ft (4 m)", or miles and kilometers when long. Number and unit never part at a line end. */
export function formatDistance(m: number): string {
  const ft = m * FEET_PER_METER;
  if (ft < 1000) {
    const roundFt = ft < 100 ? Math.max(1, Math.round(ft)) : Math.round(ft / 10) * 10;
    return `${roundFt}${NBSP}ft (${Math.max(1, Math.round(m))}${NBSP}m)`;
  }
  const mi = m / 1609.344;
  const km = m / 1000;
  return `${mi.toFixed(1)}${NBSP}mi (${km.toFixed(1)}${NBSP}km)`;
}

/** "GPS accurate to about 13 ft (4 m)". */
export function accuracyText(accuracyM: number): string {
  return `GPS accurate to about ${formatDistance(accuracyM)}`;
}

/** "45 s", "3 min", "2 h". */
export function formatAge(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h`;
}

export type PositionMessageKind = 'denied' | 'location-off' | 'unavailable' | 'waiting' | 'stale';

export interface PositionMessage {
  kind: PositionMessageKind;
  /** The one line that says what is wrong. */
  title: string;
  /** What to do about it. */
  body: string;
  /** A settings page that would fix it, when the platform can open one. */
  settings: 'app' | 'location' | null;
  /** The user may close it. */
  dismissible: boolean;
}

/** What the phone can do about a refusal, which differs by platform. */
export interface MessageContext {
  /** Running inside the Android app, where Android's settings apply. */
  android: boolean;
  /** The platform can open its settings pages from a button. */
  canOpenSettings: boolean;
}

/** The message to show for the current position state, or null for none. */
export function positionMessage(s: PositionSnapshot, ctx: MessageContext): PositionMessage | null {
  if (s.error) {
    switch (s.error.kind) {
      case 'denied':
        return {
          kind: 'denied',
          title: 'MapApp is not allowed to use your location.',
          body: ctx.android
            ? 'To allow it, open the app settings, choose Permissions, then Location, then Allow only while using the app. Then tap the position button again.'
            : 'To allow it, open this site’s settings in your browser and allow location. Then tap the position button again.',
          settings: ctx.canOpenSettings && ctx.android ? 'app' : null,
          dismissible: true,
        };
      case 'location-off':
        return {
          kind: 'location-off',
          title: 'Location is switched off on this phone.',
          body: 'Turn on Location in the phone’s quick settings. Then tap the position button again.',
          settings: ctx.canOpenSettings && ctx.android ? 'location' : null,
          dismissible: true,
        };
      default:
        return {
          kind: 'unavailable',
          title: 'The position could not be read.',
          body: 'This phone or browser did not report a position. Tap the position button to try again.',
          settings: null,
          dismissible: true,
        };
    }
  }
  if (!s.on) return null;
  if (!s.fix) {
    return {
      kind: 'waiting',
      title: 'Waiting for the first GPS position.',
      body: 'This can take a minute. It is quicker under open sky.',
      settings: null,
      dismissible: false,
    };
  }
  if (s.stale && s.ageMs !== null) {
    return {
      kind: 'stale',
      title: `Last position ${formatAge(s.ageMs)} ago.`,
      body: 'The GPS has not reported since. The marker is gray until it does.',
      settings: null,
      dismissible: false,
    };
  }
  return null;
}
