/**
 * Spacing props that give small Design System controls a 32 px pointer target without moving
 * them: the padding enlarges the clickable box, the negative margin keeps the text where it was.
 * 32 px is the target size the admin uses on small screens; WCAG 2.5.8 asks for 24 px.
 * 1rem is 10 px in the Strapi admin.
 */

/** For a DS `Link` whose text line is 20 px tall. */
export const LINK_TARGET = {
  paddingTop: '0.6rem',
  paddingBottom: '0.6rem',
  marginTop: '-0.6rem',
  marginBottom: '-0.6rem',
} as const;

/** For a DS `TextButton`, whose box is 16 px tall. */
export const TEXT_BUTTON_TARGET = {
  paddingTop: '0.8rem',
  paddingBottom: '0.8rem',
  marginTop: '-0.8rem',
  marginBottom: '-0.8rem',
} as const;
