/**
 * Row actions of a bookmark: a pin toggle and a "More actions" menu (open, edit, duplicate,
 * copy link, delete). Actions the user may not perform are not rendered.
 */
import { Flex, IconButton, MenuItem, SimpleMenu } from '@strapi/design-system';
import { Duplicate, ExternalLink, Link as LinkIcon, More, Pencil, Pin, Trash } from '@strapi/icons';
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
}: BookmarkActionsProps) => {
  const { formatMessage } = useIntl();
  const name = { name: bookmark.name };
  const canEdit = permissions.canUpdate && bookmark.canEdit;
  const canDelete = permissions.canDelete && bookmark.canEdit;

  return (
    <Flex gap={1} justifyContent="flex-end">
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
      <SimpleMenu
        tag={IconButton}
        icon={<More />}
        label={formatMessage(msg('actions.moreNamed', 'More actions for {name}'), name)}
        variant="ghost"
        disabled={busy}
      >
        <MenuItem startIcon={<ExternalLink />} onSelect={onOpen} disabled={!bookmark.path}>
          {formatMessage(msg('actions.open', 'Open'))}
        </MenuItem>
        {canEdit ? (
          <MenuItem startIcon={<Pencil />} onSelect={onEdit}>
            {formatMessage(msg('actions.edit', 'Edit'))}
          </MenuItem>
        ) : null}
        {permissions.canCreate ? (
          <MenuItem startIcon={<Duplicate />} onSelect={onDuplicate} disabled={!bookmark.path}>
            {formatMessage(msg('actions.duplicate', 'Duplicate'))}
          </MenuItem>
        ) : null}
        <MenuItem startIcon={<LinkIcon />} onSelect={onCopyLink} disabled={!bookmark.path}>
          {formatMessage(msg('actions.copyLink', 'Copy link'))}
        </MenuItem>
        {canDelete ? (
          <MenuItem startIcon={<Trash />} variant="danger" onSelect={onDelete}>
            {formatMessage(msg('actions.delete', 'Delete'))}
          </MenuItem>
        ) : null}
      </SimpleMenu>
    </Flex>
  );
};
