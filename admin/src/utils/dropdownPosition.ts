export interface DropdownRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface DropdownViewport {
  width: number;
  height: number;
}

export interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openAbove: boolean;
}

/** Fits a fixed dropdown above or below its trigger without leaving the viewport. */
export function calculateDropdownPosition(
  trigger: DropdownRect,
  viewport: DropdownViewport,
  preferredHeight = 400,
  gap = 4,
  gutter = 8,
): DropdownPosition {
  const verticalGutter = Math.min(gutter, Math.max(0, viewport.height / 2));
  const horizontalGutter = Math.min(gutter, Math.max(0, viewport.width / 2));
  const maxAvailableHeight = Math.max(0, viewport.height - verticalGutter * 2);
  const desiredHeight = Math.min(preferredHeight, maxAvailableHeight);
  const spaceAbove = Math.max(0, trigger.top - gap - verticalGutter);
  const spaceBelow = Math.max(0, viewport.height - trigger.bottom - gap - verticalGutter);
  const minimumUsefulHeight = Math.min(desiredHeight, 240);
  const openAbove = spaceBelow < minimumUsefulHeight && spaceAbove > spaceBelow;
  const availableHeight = openAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(desiredHeight, availableHeight);
  const maxAvailableWidth = Math.max(0, viewport.width - horizontalGutter * 2);
  const width = Math.min(Math.max(0, trigger.width), maxAvailableWidth);
  const left = Math.min(
    Math.max(trigger.left, horizontalGutter),
    viewport.width - horizontalGutter - width,
  );
  const top = openAbove
    ? trigger.top - gap - maxHeight
    : trigger.bottom + gap;

  return { top, left, width, maxHeight, openAbove };
}
