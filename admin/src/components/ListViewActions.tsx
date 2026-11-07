/**
 * Controls injected into the Content Manager list view toolbar (`listView.actions`), next to
 * the native "View settings" button and in the same style: two icon buttons.
 *
 * - "Advanced filters" opens the filter editor (any admin who sees the list).
 * - "Bookmarks" opens a popover with the bookmarks of this content type, "Save view" and a
 *   link to the bookmark page (needs `bookmarks.read`).
 */
import { IconButton } from '@strapi/design-system';
import { SlidersHorizontal } from '@strapi/icons';
import { useRBAC } from '@strapi/strapi/admin';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { ALL_PERMISSIONS } from '../permissions';
import { parseListViewPath } from '../utils/listView';
import { msg } from '../utils/translations';
import { AdvancedFiltersModal } from './AdvancedFiltersModal';
import { BookmarksPopover } from './BookmarksPopover';

/**
 * Rendered by the Content Manager without props; reads the content type from the URL.
 */
export const ListViewActions = () => {
  const { formatMessage } = useIntl();
  const { pathname } = useLocation();
  const listView = parseListViewPath(pathname);
  const { allowedActions, isLoading } = useRBAC(ALL_PERMISSIONS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  if (!listView || listView.kind !== 'collection-types') return null;

  return (
    <>
      <IconButton
        label={formatMessage(msg('filters.title', 'Advanced filters'))}
        onClick={() => setFiltersOpen(true)}
      >
        <SlidersHorizontal />
      </IconButton>
      {filtersOpen ? (
        <AdvancedFiltersModal open={filtersOpen} onOpenChange={setFiltersOpen} uid={listView.uid} />
      ) : null}
      {!isLoading && allowedActions.canRead ? (
        <BookmarksPopover
          listView={listView}
          canCreate={!!allowedActions.canCreate}
          canUpdate={!!allowedActions.canUpdate}
          canShare={!!allowedActions.canShare}
        />
      ) : null}
    </>
  );
};

export default ListViewActions;
