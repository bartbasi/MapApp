// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The phone's compass, read from the browser engine's orientation events.
// Android's WebView sends deviceorientationabsolute, measured from north.
// Safari on an iPhone sends webkitCompassHeading on deviceorientation instead
// (it also needs a permission call from a tap, left for the iPhone version).
// A desktop browser usually has neither, and then no reading ever arrives.

import { normalizeDeg } from './geo';
import { compassFromOrientation } from './heading';

export interface CompassSensor {
  /** Starts listening. Each reading is the heading of the top of the screen, degrees clockwise from north. */
  start(onReading: (deg: number) => void): void;
  stop(): void;
}

interface SafariOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

function screenAngle(): number {
  const a = typeof screen !== 'undefined' ? screen.orientation?.angle : undefined;
  return typeof a === 'number' ? a : 0;
}

export class DeviceCompass implements CompassSensor {
  private handler: ((e: Event) => void) | null = null;
  private eventName: string | null = null;

  start(onReading: (deg: number) => void): void {
    if (this.handler || typeof window === 'undefined') return;
    const absolute = 'ondeviceorientationabsolute' in window;
    this.eventName = absolute ? 'deviceorientationabsolute' : 'deviceorientation';
    this.handler = (raw: Event) => {
      const e = raw as SafariOrientationEvent;
      if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
        onReading(normalizeDeg(e.webkitCompassHeading + screenAngle()));
        return;
      }
      // A relative reading (absolute false) is not tied to north and is no use here.
      if (!absolute || e.alpha === null || !Number.isFinite(e.alpha)) return;
      onReading(compassFromOrientation(e.alpha, screenAngle()));
    };
    window.addEventListener(this.eventName, this.handler);
  }

  stop(): void {
    if (this.handler && this.eventName) window.removeEventListener(this.eventName, this.handler);
    this.handler = null;
    this.eventName = null;
  }
}
