/**
 * Create or edit a bookmark in a Design System modal.
 *
 * Create: the list view (content type, filters, sort) is captured from the Content Manager
 * and shown read-only at the top, then name, description, icon and, with the share
 * permission, who can see it. Edit: the same form without the capture; the saved view is
 * changed with "Update with current view" in the Content Manager.
 */
import {
  Box,
  Button,
  Field,
  Flex,
  Loader,
  Modal,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Textarea,
  Typography,
} from '@strapi/design-system';
import { useNotification } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useBookmarksApi } from '../hooks/useBookmarksApi';
import { useContentTypeNames } from '../hooks/useSchemas';
import type { Bookmark } from '../types';
import { fieldErrors } from '../utils/errors';
import { ICON_OPTIONS } from '../utils/icons';
import { msg } from '../utils/translations';
import { ICON_LABELS } from '../utils/iconLabels';
import { FilterSummary } from './FilterSummary';
import { SharingFields, type SharingValue } from './SharingFields';

export interface CapturedView {
  path: string;
  query: string;
  contentType: string;
  contentTypeName: string;
}

interface BookmarkFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create mode: the captured list view. */
  view?: CapturedView;
  /** Edit mode: the bookmark's documentId. */
  bookmarkId?: string;
  canShare: boolean;
  onSaved: (bookmark: Bookmark) => void;
}

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

/**
 * @param props - See BookmarkFormModalProps.
 */
export const BookmarkFormModal = ({
  open,
  onOpenChange,
  view,
  bookmarkId,
  canShare,
  onSaved,
}: BookmarkFormModalProps) => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const api = useBookmarksApi();
  const { names } = useContentTypeNames();
  const isEdit = !!bookmarkId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('bookmark');
  const [sharing, setSharing] = useState<SharingValue>({
    visibility: 'private',
    roles: [],
    users: [],
  });
  const [loaded, setLoaded] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(!!bookmarkId);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The modal is mounted when it opens; in edit mode it loads the bookmark once.
  useEffect(() => {
    if (!bookmarkId) return undefined;
    let active = true;
    api
      .get(bookmarkId)
      .then((bookmark) => {
        if (!active) return;
        setLoaded(bookmark);
        setName(bookmark.name);
        setDescription(bookmark.description ?? '');
        setIcon(bookmark.icon);
        setSharing({
          visibility: bookmark.visibility,
          roles: bookmark.sharing?.roles.map((role) => role.documentId) ?? [],
          users: bookmark.sharing?.users ?? [],
        });
      })
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bookmarkId, api]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = formatMessage(msg('form.nameRequired', 'Enter a name.'));
    else if (name.trim().length > NAME_MAX) {
      next.name = formatMessage(msg('form.nameTooLong', 'Use at most {max} characters.'), {
        max: NAME_MAX,
      });
    }
    if (description.length > DESCRIPTION_MAX) {
      next.description = formatMessage(
        msg('form.descriptionTooLong', 'Use at most {max} characters.'),
        {
          max: DESCRIPTION_MAX,
        }
      );
    }
    if (
      canShare &&
      sharing.visibility === 'shared' &&
      !sharing.roles.length &&
      !sharing.users.length
    ) {
      next.roles = formatMessage(msg('form.targetsRequired', 'Choose at least one role or user.'));
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    const sharingInput = canShare
      ? {
          visibility: sharing.visibility,
          roles: sharing.visibility === 'shared' ? sharing.roles : [],
          users: sharing.visibility === 'shared' ? sharing.users.map((u) => u.documentId) : [],
        }
      : {};
    try {
      const saved = isEdit
        ? await api.update(bookmarkId as string, {
            name: name.trim(),
            description: description.trim(),
            icon,
            ...sharingInput,
          })
        : await api.create({
            name: name.trim(),
            description: description.trim(),
            icon,
            path: view?.path,
            query: view?.query ?? '',
            ...sharingInput,
          });
      toggleNotification({
        type: 'success',
        message: formatMessage(
          isEdit
            ? msg('notification.updated', 'Bookmark saved.')
            : msg('notification.created', 'Bookmark created.')
        ),
      });
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      const fields = fieldErrors(error);
      if (Object.keys(fields).length) {
        setErrors({
          ...(fields.name
            ? { name: formatMessage(msg('form.nameInvalid', 'Check the name.')) }
            : {}),
          ...(fields.roles || fields.users
            ? {
                roles: formatMessage(
                  msg('form.targetsInvalid', 'One of the roles or users no longer exists.')
                ),
              }
            : {}),
        });
      }
      toggleNotification({
        type: 'danger',
        message: formatMessage(
          msg(
            'notification.saveError',
            'The bookmark could not be saved. Your changes are still in the form.'
          )
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit
    ? formatMessage(msg('form.editTitle', 'Edit bookmark'))
    : formatMessage(msg('form.createTitle', 'Save view as bookmark'));
  const contentType = view?.contentType ?? loaded?.contentType ?? null;
  const query = view?.query ?? loaded?.query ?? '';

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content>
        <Modal.Header closeLabel={formatMessage(msg('form.close', 'Close'))}>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <Flex justifyContent="center" padding={6}>
              <Loader small>{formatMessage(msg('state.loading', 'Loading'))}</Loader>
            </Flex>
          ) : loadFailed ? (
            <Typography textColor="danger600">
              {formatMessage(msg('form.loadError', 'The bookmark could not be loaded.'))}
            </Typography>
          ) : (
            <Flex direction="column" alignItems="stretch" gap={6}>
              <Box background="neutral100" hasRadius padding={4}>
                <Flex direction="column" alignItems="stretch" gap={2}>
                  <Typography variant="sigma" textColor="neutral600" tag="h3">
                    {formatMessage(msg('form.savedView', 'Saved view'))}
                  </Typography>
                  <Typography fontWeight="semiBold">
                    {view?.contentTypeName ??
                      (contentType ? (names.get(contentType) ?? contentType) : '')}
                  </Typography>
                  <FilterSummary contentType={contentType} query={query} />
                </Flex>
              </Box>

              <Field.Root name="name" error={errors.name} required>
                <Field.Label>{formatMessage(msg('form.name', 'Name'))}</Field.Label>
                <TextInput
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setName(event.target.value)
                  }
                  placeholder={formatMessage(
                    msg('form.namePlaceholder', 'e.g. Drafts waiting for review')
                  )}
                />
                <Field.Error />
              </Field.Root>

              <Field.Root
                name="description"
                error={errors.description}
                hint={formatMessage(msg('form.descriptionHint', 'Optional. Shown below the name.'))}
              >
                <Field.Label>{formatMessage(msg('form.description', 'Description'))}</Field.Label>
                <Textarea
                  value={description}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setDescription(event.target.value)
                  }
                />
                <Field.Hint />
                <Field.Error />
              </Field.Root>

              <Field.Root name="icon">
                <Field.Label>{formatMessage(msg('form.icon', 'Icon'))}</Field.Label>
                <SingleSelect
                  value={icon}
                  onChange={(value: string | number) => setIcon(String(value))}
                >
                  {ICON_OPTIONS.map(({ key, Icon }) => (
                    <SingleSelectOption key={key} value={key} startIcon={<Icon aria-hidden />}>
                      {formatMessage(ICON_LABELS[key])}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Field.Root>

              {canShare ? (
                <SharingFields value={sharing} onChange={setSharing} error={errors.roles} />
              ) : null}
            </Flex>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">{formatMessage(msg('form.cancel', 'Cancel'))}</Button>
          </Modal.Close>
          <Button onClick={submit} loading={saving} disabled={loading || loadFailed}>
            {formatMessage(msg('form.save', 'Save'))}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};
