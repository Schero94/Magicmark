/**
 * Row actions of a bookmark: a pin toggle and a "More actions" menu (open, edit, duplicate,
 * copy link, delete). Actions the user may not perform are not rendered.
 *
 * In the table each part goes in its own cell (`parts`), like the single "Row actions" button
 * of the native Content Manager list: a Design System table cell that holds more than one
 * button calls preventDefault on every key event, including the Escape that bubbles (through
 * React) from the portalled menu, so the menu would not close with Escape.
 */
import { Flex, IconButton, Menu } from '@strapi/design-system';
import { Duplicate, ExternalLink, Link as LinkIcon, More, Pencil, Pin, Trash } from '@strapi/icons';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import type { Bookmark } from '../types';
import { msg } from '../utils/translations';

export interface BookmarkPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

interface BookmarkActionsProps {
  bookmark: Bookmark;
  permissions: BookmarkPermissions;
  busy: boolean;
  onOpen: () => void;
  onPin: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  /** Which controls to render. Default: both. */
  parts?: 'all' | 'pin' | 'menu';
}

/**
 * @param props - The bookmark, the user's permissions and the action callbacks.
 */
export const BookmarkActions = ({
  bookmark,
  permissions,
  busy,
  onOpen,
  onPin,
  onEdit,
  onDuplicate,
  onCopyLink,
  onDelete,
  parts = 'all',
}: BookmarkActionsProps) => {
  const { formatMessage } = useIntl();
  const name = { name: bookmark.name };
  const canEdit = permissions.canUpdate && bookmark.canEdit;
  const canDelete = permissions.canDelete && bookmark.canEdit;
  // Controlled like the native Content Manager row menu (DocumentActionsMenu).
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Flex gap={1} justifyContent="flex-end">
      {parts !== 'menu' ? (
        <IconButton
          label={formatMessage(
            bookmark.isPinned
              ? msg('actions.unpinNamed', 'Unpin {name}')
              : msg('actions.pinNamed', 'Pin {name}'),
            name
          )}
          variant={bookmark.isPinned ? 'secondary' : 'ghost'}
          aria-pressed={bookmark.isPinned}
          disabled={busy}
          onClick={onPin}
        >
          <Pin />
        </IconButton>
      ) : null}
      {parts !== 'pin' ? (
        <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Menu.Trigger
            tag={IconButton}
            icon={<More />}
            label={formatMessage(msg('actions.moreNamed', 'More actions for {name}'), name)}
            variant="ghost"
            disabled={busy}
            data-bookmark-menu={bookmark.documentId}
          />
          <Menu.Content popoverPlacement="bottom-end">
            <Menu.Item startIcon={<ExternalLink />} onSelect={onOpen} disabled={!bookmark.path}>
              {formatMessage(msg('actions.open', 'Open'))}
            </Menu.Item>
            {canEdit ? (
              <Menu.Item startIcon={<Pencil />} onSelect={onEdit}>
                {formatMessage(msg('actions.edit', 'Edit'))}
              </Menu.Item>
            ) : null}
            {permissions.canCreate ? (
              <Menu.Item startIcon={<Duplicate />} onSelect={onDuplicate} disabled={!bookmark.path}>
                {formatMessage(msg('actions.duplicate', 'Duplicate'))}
              </Menu.Item>
            ) : null}
            <Menu.Item startIcon={<LinkIcon />} onSelect={onCopyLink} disabled={!bookmark.path}>
              {formatMessage(msg('actions.copyLink', 'Copy link'))}
            </Menu.Item>
            {canDelete ? (
              <Menu.Item startIcon={<Trash />} variant="danger" onSelect={onDelete}>
                {formatMessage(msg('actions.delete', 'Delete'))}
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu.Root>
      ) : null}
    </Flex>
  );
};
