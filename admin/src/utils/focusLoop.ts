/**
 * Keeps keyboard focus inside a Design System modal.
 *
 * DS 2.2.4 wraps every Combobox trigger in a Radix FocusScope that stays mounted while the list
 * is closed. Mounting it pauses the focus scope of the surrounding Modal, so Tab walks out of the
 * dialog into the page behind it (measured in the bookmark and Advanced filters dialogs; native
 * Strapi modals without a Combobox keep focus). This handler restores the loop: Tab on the last
 * focusable element moves to the first one, Shift+Tab on the first moves to the last.
 */
import type { KeyboardEvent } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/**
 * Element that should receive focus instead of the browser default, or null to let the browser
 * move focus.
 * @param nodes - Focusable elements of the dialog in tab order.
 * @param active - Currently focused element.
 * @param backwards - True for Shift+Tab.
 * @returns The element to focus, or null.
 */
export const loopTarget = <T>(nodes: T[], active: T | null, backwards: boolean): T | null => {
  if (!nodes.length) return null;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const index = active === null ? -1 : nodes.indexOf(active);
  if (index === -1) return backwards ? last : first;
  if (!backwards && active === last) return first;
  if (backwards && active === first) return last;
  return null;
};

/**
 * `onKeyDown` handler for `Modal.Content`.
 * @param event - Keyboard event from the modal content.
 * @sideeffect Moves focus and prevents the default Tab behaviour at the ends of the dialog.
 */
export const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  const container = event.currentTarget;
  const active = document.activeElement as HTMLElement | null;
  // Keys pressed inside an open list (rendered in a portal) belong to that list.
  if (active && !container.contains(active)) return;
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.getClientRects().length > 0 && node.getAttribute('aria-hidden') !== 'true'
  );
  const target = loopTarget(nodes, active, event.shiftKey);
  if (target) {
    event.preventDefault();
    target.focus();
  }
};
