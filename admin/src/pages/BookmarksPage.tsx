/**
 * Bookmarks page (plugin menu entry). A native Strapi list page: header, search and filters,
 * a table (cards below the medium breakpoint) and pagination. Search, scope, content type,
 * sort and paging live in the URL and are applied by the server.
 */
import {
  Badge,
  Box,
  Button,
  Dialog,
  EmptyStateLayout,
  Flex,
  IconButton,
  Link,
  LinkButton,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
  VisuallyHidden,
} from '@strapi/design-system';
import { CaretDown, CaretUp } from '@strapi/icons';
import { EmptyDocuments } from '@strapi/icons/symbols';
import {
  ConfirmDialog,
  Layouts,
  Page,
  Pagination,
  SearchInput,
  useClipboard,
  useIsDesktop,
  useIsMobile,
  useNotification,
  useQueryParams,
  useRBAC,
} from '@strapi/strapi/admin';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { NavLink, useHref } from 'react-router-dom';
import { BookmarkActions } from '../components/BookmarkActions';
import { BookmarkFormModal } from '../components/BookmarkFormModal';
import { useBookmarksApi } from '../hooks/useBookmarksApi';
import { bookmarkLocation, useOpenBookmark } from '../hooks/useOpenBookmark';
import { useContentTypeNames } from '../hooks/useSchemas';
import { ALL_PERMISSIONS } from '../permissions';
import type { Bookmark, BookmarkList, Visibility } from '../types';
import { countConditions } from '../utils/filters';
import { getIcon } from '../utils/icons';
import { parseQuery } from '../utils/query';
import { msg } from '../utils/translations';

type Scope = 'all' | 'mine' | 'shared' | 'pinned';

interface PageQuery {
  _q?: string;
  scope?: Scope;
  contentType?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

/**
 * Badge colours per visibility. "Shared" uses primary100/primary700 instead of the Badge
 * `primary` variant: that variant (primary200 on primary700) measures 2.4:1 in the dark theme
 * of Design System 2.2.4, below WCAG 1.4.3. These pairs measure at least 4.9:1 in both themes.
 */
const VISIBILITY_BADGE: Record<
  Visibility,
  {
    backgroundColor: 'neutral200' | 'primary100' | 'secondary200';
    textColor: 'neutral700' | 'primary700' | 'secondary700';
    label: ReturnType<typeof msg>;
  }
> = {
  private: {
    backgroundColor: 'neutral200',
    textColor: 'neutral700',
    label: msg('visibility.private', 'Only me'),
  },
  shared: {
    backgroundColor: 'primary100',
    textColor: 'primary700',
    label: msg('visibility.shared', 'Shared'),
  },
  public: {
    backgroundColor: 'secondary200',
    textColor: 'secondary700',
    label: msg('visibility.public', 'All admins'),
  },
};

/**
 * Bookmarks page component, protected by `bookmarks.read` in App.
 */
export const BookmarksPage = () => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const api = useBookmarksApi();
  const openBookmark = useOpenBookmark();
  const { copy } = useClipboard();
  const isMobile = useIsMobile();
  // Tablet widths (768-1079 px) drop the Filters column so the row actions stay visible
  // without horizontal scrolling; the edit dialog still shows the saved filters.
  const showFiltersColumn = useIsDesktop();
  const { names } = useContentTypeNames();
  const { allowedActions } = useRBAC(ALL_PERMISSIONS);
  const [{ query }, setQuery] = useQueryParams<PageQuery>();

  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 25;
  const scope: Scope = (['all', 'mine', 'shared', 'pinned'] as Scope[]).includes(
    query.scope as Scope
  )
    ? (query.scope as Scope)
    : 'all';
  const sort =
    query.sort === 'name:desc' || query.sort === 'updatedAt:desc' || query.sort === 'updatedAt:asc'
      ? query.sort
      : 'name:asc';

  const [result, setResult] = useState<BookmarkList | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Bookmark | null>(null);
  const [deleting, setDeleting] = useState(false);
  const focusMainAfterLoad = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .list(
        { page, pageSize, q: query._q, scope, sort, contentType: query.contentType },
        controller.signal
      )
      .then((data) => {
        setResult(data);
        setStatus('ready');
        if (data.meta.pagination.pageCount > 0 && page > data.meta.pagination.pageCount) {
          setQuery({ page: String(data.meta.pagination.pageCount) }, 'push', true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [api, page, pageSize, query._q, query.contentType, scope, sort, attempt, setQuery]);

  // Dialogs opened from a row menu return focus to that row's "More actions" button when
  // they close (Radix would restore it to the menu item, which is gone by then). After a
  // delete the row is gone too, so focus goes to the page content (the Page.Main skip target).
  const focusTarget = useRef<string | null>(null);
  const restoreFocus = useCallback(() => {
    const id = focusTarget.current;
    focusTarget.current = null;
    window.setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const trigger = id
        ? document.querySelector<HTMLElement>(`[data-bookmark-menu="${CSS.escape(id)}"]`)
        : null;
      (trigger ?? document.getElementById('main-content'))?.focus();
    }, 50);
  }, []);

  useEffect(() => {
    if (!focusMainAfterLoad.current || status !== 'ready') return;
    focusMainAfterLoad.current = false;
    restoreFocus();
  }, [result, status, restoreFocus]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const retry = () => {
    setStatus('loading');
    reload();
  };
  const bookmarks = result?.data ?? [];
  const pagination = result?.meta.pagination;
  const canShare = result?.meta.permissions.canShare ?? !!allowedActions.canShare;
  const isFiltered = !!query._q || scope !== 'all' || !!query.contentType;
  const permissions = {
    canCreate: !!allowedActions.canCreate,
    canUpdate: !!allowedActions.canUpdate,
    canDelete: !!allowedActions.canDelete,
  };

  const contentTypeOptions = useMemo(
    () => [...names.entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [names]
  );
  const adminHref = useHref('/');

  const setFilter = (patch: Partial<PageQuery>) => setQuery({ ...patch, page: '1' }, 'push', true);

  const togglePin = async (bookmark: Bookmark) => {
    setBusyId(bookmark.documentId);
    try {
      await api.pin(bookmark.documentId, !bookmark.isPinned);
      toggleNotification({
        type: 'success',
        message: formatMessage(
          bookmark.isPinned
            ? msg('notification.unpinned', 'Bookmark unpinned.')
            : msg('notification.pinned', 'Bookmark pinned.')
        ),
      });
      reload();
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage(msg('notification.pinError', 'The bookmark could not be pinned.')),
      });
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (bookmark: Bookmark) => {
    setBusyId(bookmark.documentId);
    try {
      await api.duplicate(
        bookmark.documentId,
        formatMessage(msg('actions.copyName', '{name} (copy)'), { name: bookmark.name }).slice(
          0,
          100
        )
      );
      toggleNotification({
        type: 'success',
        message: formatMessage(msg('notification.duplicated', 'Bookmark duplicated.')),
      });
      reload();
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage(
          msg('notification.duplicateError', 'The bookmark could not be duplicated.')
        ),
      });
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (bookmark: Bookmark) => {
    const target = bookmarkLocation(bookmark);
    if (!target) return;
    const base = adminHref.endsWith('/') ? adminHref.slice(0, -1) : adminHref;
    const url = new URL(
      `${base}${target.pathname}${target.search}`,
      window.location.origin
    ).toString();
    const copied = await copy(url);
    toggleNotification({
      type: copied ? 'success' : 'danger',
      message: formatMessage(
        copied
          ? msg('notification.linkCopied', 'Link copied.')
          : msg('notification.linkCopyError', 'The link could not be copied.')
      ),
    });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.remove(toDelete.documentId);
      toggleNotification({
        type: 'success',
        message: formatMessage(msg('notification.deleted', 'Bookmark deleted.')),
      });
      setToDelete(null);
      focusTarget.current = null;
      focusMainAfterLoad.current = true;
      reload();
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage(
          msg('notification.deleteError', 'The bookmark could not be deleted.')
        ),
      });
    } finally {
      setDeleting(false);
    }
  };

  const ownerLabel = (bookmark: Bookmark) => {
    if (bookmark.isOwner) return formatMessage(msg('owner.you', 'You'));
    if (!bookmark.owner || bookmark.owner.isDeleted)
      return formatMessage(msg('owner.deleted', 'Deleted user'));
    return bookmark.owner.name ?? formatMessage(msg('owner.unnamed', 'Unnamed user'));
  };

  const contentTypeLabel = (bookmark: Bookmark) =>
    bookmark.contentType ? (names.get(bookmark.contentType) ?? bookmark.contentType) : '—';

  const conditions = (bookmark: Bookmark) => countConditions(parseQuery(bookmark.query).filters);

  const actionsFor = (bookmark: Bookmark, parts: 'all' | 'pin' | 'menu' = 'all') => (
    <BookmarkActions
      parts={parts}
      bookmark={bookmark}
      permissions={permissions}
      busy={busyId === bookmark.documentId}
      onOpen={() => openBookmark(bookmark)}
      onPin={() => togglePin(bookmark)}
      onEdit={() => {
        focusTarget.current = bookmark.documentId;
        setEditId(bookmark.documentId);
      }}
      onDuplicate={() => duplicate(bookmark)}
      onCopyLink={() => copyLink(bookmark)}
      onDelete={() => {
        focusTarget.current = bookmark.documentId;
        setToDelete(bookmark);
      }}
    />
  );

  const nameCell = (bookmark: Bookmark) => {
    const Icon = getIcon(bookmark.icon);
    const target = bookmarkLocation(bookmark);
    return (
      <Flex gap={3} alignItems="flex-start" minWidth={0}>
        <Box paddingTop={1} color="neutral600">
          <Icon aria-hidden />
        </Box>
        <Flex direction="column" alignItems="flex-start" minWidth={0}>
          {target ? (
            <Link
              tag={NavLink}
              to={target}
              onClick={(event: React.MouseEvent) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                openBookmark(bookmark);
              }}
            >
              {bookmark.name}
            </Link>
          ) : (
            <Typography fontWeight="semiBold">{bookmark.name}</Typography>
          )}
          {bookmark.description ? (
            <Typography variant="pi" textColor="neutral600">
              {bookmark.description}
            </Typography>
          ) : null}
        </Flex>
      </Flex>
    );
  };

  const sortHeader = (field: 'name' | 'updatedAt', label: string) => {
    const active = sort.startsWith(`${field}:`);
    const ascending = sort.endsWith(':asc');
    const next = active && ascending ? `${field}:desc` : `${field}:asc`;
    return (
      <Th
        action={
          <IconButton
            label={formatMessage(msg('table.sortBy', 'Sort by {column}'), { column: label })}
            variant="ghost"
            onClick={() => setFilter({ sort: next })}
          >
            {active && !ascending ? <CaretDown /> : <CaretUp />}
          </IconButton>
        }
      >
        <Typography variant="sigma" textColor="neutral600">
          {label}
        </Typography>
      </Th>
    );
  };

  const title = formatMessage(msg('page.title', 'Magic Mark'));

  if (status === 'loading' && !result) {
    return <Page.Loading />;
  }

  return (
    <Page.Main aria-labelledby="magic-mark-title">
      <Page.Title>{title}</Page.Title>
      <Layouts.Header
        id="magic-mark-title"
        title={title}
        subtitle={formatMessage(
          msg('page.subtitle', 'Saved Content Manager views. Open a bookmark to apply its filters.')
        )}
        primaryAction={
          <LinkButton tag={NavLink} to="/content-manager" variant="secondary">
            {formatMessage(msg('page.openContentManager', 'Open Content Manager'))}
          </LinkButton>
        }
      />
      <Layouts.Action
        startActions={
          <Flex gap={2} wrap="wrap">
            <SearchInput label={formatMessage(msg('page.search', 'Search bookmarks'))} />
            <Box minWidth="16rem">
              <SingleSelect
                size="S"
                aria-label={formatMessage(msg('page.scope', 'Show'))}
                value={scope}
                onChange={(value: string | number) => setFilter({ scope: value as Scope })}
              >
                <SingleSelectOption value="all">
                  {formatMessage(msg('scope.all', 'All bookmarks'))}
                </SingleSelectOption>
                <SingleSelectOption value="mine">
                  {formatMessage(msg('scope.mine', 'Created by me'))}
                </SingleSelectOption>
                <SingleSelectOption value="shared">
                  {formatMessage(msg('scope.shared', 'Shared with me'))}
                </SingleSelectOption>
                <SingleSelectOption value="pinned">
                  {formatMessage(msg('scope.pinned', 'Pinned'))}
                </SingleSelectOption>
              </SingleSelect>
            </Box>
            <Box minWidth="20rem">
              <SingleSelect
                size="S"
                aria-label={formatMessage(msg('page.contentType', 'Content type'))}
                value={query.contentType ?? ''}
                onChange={(value: string | number) =>
                  setFilter({ contentType: String(value) || undefined })
                }
              >
                <SingleSelectOption value="">
                  {formatMessage(msg('page.allContentTypes', 'All content types'))}
                </SingleSelectOption>
                {contentTypeOptions.map(([uid, name]) => (
                  <SingleSelectOption key={uid} value={uid}>
                    {name}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Box>
          </Flex>
        }
      />
      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={4} paddingBottom={8}>
          {status === 'error' ? (
            <Page.Error
              content={formatMessage(msg('page.error', 'Bookmarks could not be loaded.'))}
              action={
                <Button variant="secondary" onClick={retry}>
                  {formatMessage(msg('state.retry', 'Try again'))}
                </Button>
              }
            />
          ) : bookmarks.length === 0 ? (
            <EmptyStateLayout
              icon={<EmptyDocuments width="16rem" />}
              content={
                isFiltered
                  ? formatMessage(
                      msg('page.noResults', 'No bookmarks match your search or filter.')
                    )
                  : formatMessage(
                      msg(
                        'page.empty',
                        'No bookmarks yet. Filter a list in the Content Manager, then save the view.'
                      )
                    )
              }
              action={
                isFiltered ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setQuery(
                        { _q: undefined, scope: undefined, contentType: undefined, page: '1' },
                        'push',
                        true
                      )
                    }
                  >
                    {formatMessage(msg('page.clearFilters', 'Clear filters'))}
                  </Button>
                ) : (
                  <LinkButton tag={NavLink} to="/content-manager" variant="secondary">
                    {formatMessage(msg('page.openContentManager', 'Open Content Manager'))}
                  </LinkButton>
                )
              }
            />
          ) : isMobile ? (
            <Flex direction="column" alignItems="stretch" gap={3} tag="ul">
              {bookmarks.map((bookmark) => (
                <Box
                  key={bookmark.documentId}
                  tag="li"
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                  padding={4}
                >
                  <Flex direction="column" alignItems="stretch" gap={3}>
                    <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
                      {nameCell(bookmark)}
                      {actionsFor(bookmark)}
                    </Flex>
                    <Flex gap={2} wrap="wrap">
                      <Badge
                        backgroundColor={VISIBILITY_BADGE[bookmark.visibility].backgroundColor}
                        textColor={VISIBILITY_BADGE[bookmark.visibility].textColor}
                      >
                        {formatMessage(VISIBILITY_BADGE[bookmark.visibility].label)}
                      </Badge>
                      <Typography variant="pi" textColor="neutral600">
                        {contentTypeLabel(bookmark)} ·{' '}
                        {formatMessage(
                          msg(
                            'table.conditionCount',
                            '{count, plural, =0 {No filters} one {# filter} other {# filters}}'
                          ),
                          {
                            count: conditions(bookmark),
                          }
                        )}{' '}
                        · {ownerLabel(bookmark)}
                      </Typography>
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Flex>
          ) : (
            <Table colCount={showFiltersColumn ? 7 : 6} rowCount={bookmarks.length + 1}>
              <Thead>
                <Tr>
                  {sortHeader('name', formatMessage(msg('table.name', 'Name')))}
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage(msg('table.contentType', 'Content type'))}
                    </Typography>
                  </Th>
                  {showFiltersColumn ? (
                    <Th>
                      <Typography variant="sigma" textColor="neutral600">
                        {formatMessage(msg('table.filters', 'Filters'))}
                      </Typography>
                    </Th>
                  ) : null}
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage(msg('table.visibility', 'Visibility'))}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage(msg('table.owner', 'Owner'))}
                    </Typography>
                  </Th>
                  <Th>
                    <VisuallyHidden>{formatMessage(msg('scope.pinned', 'Pinned'))}</VisuallyHidden>
                  </Th>
                  <Th>
                    <VisuallyHidden>
                      {formatMessage(msg('table.actions', 'Actions'))}
                    </VisuallyHidden>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {bookmarks.map((bookmark) => (
                  <Tr key={bookmark.documentId}>
                    <Td maxWidth="40rem">{nameCell(bookmark)}</Td>
                    <Td>
                      <Typography textColor="neutral800">{contentTypeLabel(bookmark)}</Typography>
                    </Td>
                    {showFiltersColumn ? (
                      <Td>
                        <Typography textColor="neutral800">
                          {formatMessage(
                            msg(
                              'table.conditionCount',
                              '{count, plural, =0 {No filters} one {# filter} other {# filters}}'
                            ),
                            {
                              count: conditions(bookmark),
                            }
                          )}
                        </Typography>
                      </Td>
                    ) : null}
                    <Td>
                      <Badge
                        backgroundColor={VISIBILITY_BADGE[bookmark.visibility].backgroundColor}
                        textColor={VISIBILITY_BADGE[bookmark.visibility].textColor}
                      >
                        {formatMessage(VISIBILITY_BADGE[bookmark.visibility].label)}
                      </Badge>
                    </Td>
                    <Td>
                      <Typography textColor="neutral800">{ownerLabel(bookmark)}</Typography>
                    </Td>
                    <Td>{actionsFor(bookmark, 'pin')}</Td>
                    <Td>{actionsFor(bookmark, 'menu')}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {pagination && pagination.total > 0 ? (
            <Pagination.Root
              pageCount={pagination.pageCount}
              total={pagination.total}
              defaultPageSize={25}
            >
              <Pagination.PageSize />
              <Pagination.Links />
            </Pagination.Root>
          ) : null}
        </Flex>
      </Layouts.Content>

      {editId ? (
        <BookmarkFormModal
          open={!!editId}
          onOpenChange={(next) => {
            if (next) return;
            setEditId(null);
            restoreFocus();
          }}
          bookmarkId={editId}
          canShare={canShare}
          onSaved={() => {
            setEditId(null);
            reload();
            restoreFocus();
          }}
        />
      ) : null}

      <Dialog.Root
        open={!!toDelete}
        onOpenChange={(next: boolean) => {
          if (next || deleting) return;
          setToDelete(null);
          restoreFocus();
        }}
      >
        <ConfirmDialog
          title={formatMessage(msg('delete.title', 'Delete bookmark?'))}
          endAction={
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              {formatMessage(msg('delete.confirm', 'Delete'))}
            </Button>
          }
        >
          {formatMessage(
            msg(
              'delete.body',
              '"{name}" will be deleted for everyone it is shared with. The entries in the Content Manager are not affected. This cannot be undone.'
            ),
            { name: toDelete?.name ?? '' }
          )}
        </ConfirmDialog>
      </Dialog.Root>
    </Page.Main>
  );
};

export default BookmarksPage;
