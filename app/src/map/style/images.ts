// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The small images the style uses: the hatch over closed and restricted
// public land, and the route number shields. Drawn here pixel by pixel, so
// there is no sprite file to fetch and nothing to keep in step with it. The
// map adds an image the first time the style asks for it (map-view.ts).

import { positionPalette as pos, publicLandStyle as pl, relationPalette as rel, shieldPalette as sh } from './palette';

export const IMAGE_HATCH_CLOSED = 'pl-hatch-closed';
export const IMAGE_HATCH_RESTRICTED = 'pl-hatch-restricted';
export const IMAGE_SHIELD_MAJOR = 'shield-major';
export const IMAGE_SHIELD_COUNTY = 'shield-county';
export const IMAGE_POSITION_HEADING = 'position-heading';
export const IMAGE_PARCEL_TICK = 'parcel-tick';

/** Every image the style may ask for. */
export const STYLE_IMAGE_IDS = [IMAGE_HATCH_CLOSED, IMAGE_HATCH_RESTRICTED, IMAGE_SHIELD_MAJOR, IMAGE_SHIELD_COUNTY, IMAGE_POSITION_HEADING, IMAGE_PARCEL_TICK] as const;

export interface StyleImage {
  data: { width: number; height: number; data: Uint8ClampedArray };
  options: {
    pixelRatio: number;
    stretchX?: [number, number][];
    stretchY?: [number, number][];
    content?: [number, number, number, number];
  };
}

type Rgba = [number, number, number, number];

function rgb(hex: string, alpha = 1): Rgba {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** Paints `top` over `bottom` (straight alpha, 0 to 1). */
function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3] + bottom[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  const mix = (i: number) => (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) / a;
  return [mix(0), mix(1), mix(2), a];
}

function image(width: number, height: number, pixel: (x: number, y: number) => Rgba) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const i = (y * width + x) * 4;
      // Premultiplied colors are not expected by addImage: store straight alpha.
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(a * 255);
    }
  }
  return { width, height, data };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * A diagonal hatch that tiles without seams: a dark line with a light line
 * beside it, so it shows on the pale map and on dark imagery alike.
 * `spacing` is the gap between lines in screen pixels.
 */
function hatch(spacing: number, ratio: number): StyleImage {
  // Whole screen pixels per tile, so the tile is the same at every pixel ratio.
  const size = Math.round(spacing * Math.SQRT2) * ratio;
  const dark = rgb(pl.hatchDark, pl.hatchDarkOpacity);
  const light = rgb(pl.hatchLight, pl.hatchLightOpacity);
  const darkW = 1.3 * Math.SQRT2 * ratio;
  const lightW = 1.0 * Math.SQRT2 * ratio;
  const data = image(size, size, (x, y) => {
    const d = (x + y) % size;
    // Soft edges, about one pixel wide.
    const inDark = clamp01(Math.min(d + 0.5, darkW - d + 0.5));
    const inLight = clamp01(Math.min(d - darkW + 0.5, darkW + lightW - d + 0.5));
    return over([...dark.slice(0, 3), dark[3] * inDark] as Rgba, [...light.slice(0, 3), light[3] * inLight] as Rgba);
  });
  return { data, options: { pixelRatio: ratio } };
}

/** A rounded rectangle that stretches to fit its text. */
function shield(fill: string, border: string, ratio: number): StyleImage {
  const w = 20 * ratio;
  const h = 20 * ratio;
  const r = 4 * ratio;
  const bw = 1.5 * ratio;
  const f = rgb(fill);
  const b = rgb(border);
  const data = image(w, h, (x, y) => {
    // Signed distance to the rounded rectangle's edge, inset by half a pixel.
    const qx = Math.abs(x - w / 2) - (w / 2 - 0.5 - r);
    const qy = Math.abs(y - h / 2) - (h / 2 - 0.5 - r);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    const outer = clamp01(0.5 - d);
    const inner = clamp01(0.5 - (d + bw));
    const c = over([...f.slice(0, 3), inner] as Rgba, [...b.slice(0, 3), outer] as Rgba);
    return c;
  });
  const s = (a: number, z: number): [number, number] => [a * ratio, z * ratio];
  return {
    data,
    options: { pixelRatio: ratio, stretchX: [s(6, 14)], stretchY: [s(6, 14)], content: [5 * ratio, 4 * ratio, 15 * ratio, 16 * ratio] },
  };
}

/**
 * The heading wedge: a fan pointing straight up from the image's center,
 * strongest near the dot and fading outward, with a pale rim so it shows on
 * dark imagery. The map turns it to the heading.
 */
function headingWedge(ratio: number): StyleImage {
  const size = 96 * ratio;
  const c = size / 2;
  const outer = 44 * ratio;
  const halfAngle = (32 * Math.PI) / 180;
  const fill = rgb(pos.wedge);
  const rim = rgb(pos.wedgeRim);
  const rimW = 1.4 * ratio;
  const data = image(size, size, (x, y) => {
    const dx = x - c;
    const dy = c - y;
    const r = Math.hypot(dx, dy);
    // Distance in pixels outside the fan's straight sides and its round end.
    const angle = Math.abs(Math.atan2(dx, dy));
    const side = angle <= halfAngle ? -r * Math.sin(halfAngle - angle) : r * Math.sin(Math.min(angle - halfAngle, Math.PI / 2));
    const d = Math.max(side, r - outer);
    const inside = clamp01(0.5 - d);
    if (inside === 0) return [0, 0, 0, 0];
    const fade = 0.92 - 0.6 * clamp01(r / outer);
    const onRim = clamp01(0.5 - Math.abs(d + rimW / 2) + rimW / 2) * clamp01(r / (12 * ratio));
    return over([...rim.slice(0, 3), 0.75 * onRim * inside] as Rgba, [...fill.slice(0, 3), fade * inside] as Rgba);
  });
  return { data, options: { pixelRatio: ratio } };
}

/**
 * The tick where the connector meets the property line: a short bar lying
 * east to west, in the connector's blue with a white rim. The map turns it to
 * lie along the line.
 */
function tick(ratio: number): StyleImage {
  const w = 24 * ratio;
  const h = 10 * ratio;
  const halfLen = 10 * ratio;
  const halfThick = 1.8 * ratio;
  const rimW = 1.6 * ratio;
  const core = rgb(rel.tick);
  const rim = rgb(rel.tickRim);
  const data = image(w, h, (x, y) => {
    // Distance outside a rounded bar centered in the image.
    const qx = Math.max(Math.abs(x - w / 2) - (halfLen - halfThick), 0);
    const d = Math.hypot(qx, Math.abs(y - h / 2)) - halfThick;
    const inCore = clamp01(0.5 - d);
    const inRim = clamp01(0.5 - (d - rimW));
    return over([...core.slice(0, 3), inCore] as Rgba, [...rim.slice(0, 3), inRim] as Rgba);
  });
  return { data, options: { pixelRatio: ratio } };
}

/** The image the style asks for, drawn for the screen's pixel ratio, or null if the name is unknown. */
export function styleImage(id: string, pixelRatio = 2): StyleImage | null {
  const ratio = Math.max(1, Math.min(4, Math.round(pixelRatio)));
  switch (id) {
    case IMAGE_HATCH_CLOSED:
      return hatch(pl.hatchClosedSpacing, ratio);
    case IMAGE_HATCH_RESTRICTED:
      return hatch(pl.hatchRestrictedSpacing, ratio);
    case IMAGE_SHIELD_MAJOR:
      return shield(sh.major, sh.majorBorder, ratio);
    case IMAGE_SHIELD_COUNTY:
      return shield(sh.county, sh.countyBorder, ratio);
    case IMAGE_POSITION_HEADING:
      return headingWedge(ratio);
    case IMAGE_PARCEL_TICK:
      return tick(ratio);
    default:
      return null;
  }
}
