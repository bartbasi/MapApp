// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Font stacks for labels. Each name is a folder under public/fonts/ holding
// glyph files bundled with the app (see public/fonts/SOURCE.txt). Nothing is
// fetched from the network.

export const fonts = {
  regular: ['noto-sans-regular'],
  medium: ['noto-sans-medium'],
  italic: ['noto-sans-italic'],
};

/** The glyph URL template for a style, given the address the app is served from. */
export function glyphsUrl(origin: string): string {
  return `${origin}/fonts/{fontstack}/{range}.pbf`;
}
