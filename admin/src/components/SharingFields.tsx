/**
 * Visibility and share targets of a bookmark: "Only me", "Specific roles and users" or
 * "All admin users". Roles come from a multi select, users from a server-side search.
 */
import {
  Box,
  Combobox,
  ComboboxOption,
  Field,
  Flex,
  MultiSelect,
  MultiSelectOption,
  Radio,
  Tag,
  Typography,
} from '@strapi/design-system';
import { Cross } from '@strapi/icons';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useBookmarksApi } from '../hooks/useBookmarksApi';
import type { ShareRole, ShareUser, Visibility } from '../types';
import { msg } from '../utils/translations';

export interface SharingValue {
  visibility: Visibility;
  roles: string[];
  users: ShareUser[];
}

interface SharingFieldsProps {
  value: SharingValue;
  onChange: (next: SharingValue) => void;
  error?: string;
}

/**
 * @param props - Controlled `value`, `onChange` and an optional `error` for the targets.
 */
export const SharingFields = ({ value, onChange, error }: SharingFieldsProps) => {
  const { formatMessage } = useIntl();
  const api = useBookmarksApi();
  const [roles, setRoles] = useState<ShareRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ShareUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    api
      .roles()
      .then((data) => active && setRoles(data))
      .catch(() => active && setLoadError(true))
      .finally(() => active && setRolesLoading(false));
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (value.visibility !== 'shared') return undefined;
    const controller = new AbortController();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setUsersLoading(true);
      api
        .users(search.trim(), 1, controller.signal)
        .then(({ data }) => setResults(data))
        .catch(() => {
          if (!controller.signal.aborted) setLoadError(true);
        })
        .finally(() => !controller.signal.aborted && setUsersLoading(false));
    }, 250);
    return () => {
      controller.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [api, search, value.visibility]);

  const userLabel = (user: ShareUser) =>
    [
      user.name ?? formatMessage(msg('sharing.unnamedUser', 'Unnamed user')),
      user.email ? `(${user.email})` : '',
    ]
      .filter(Boolean)
      .join(' ');

  const selectedIds = new Set(value.users.map((user) => user.documentId));
  const options = results.filter((user) => !selectedIds.has(user.documentId));

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <Field.Root name="visibility">
        <Field.Label>{formatMessage(msg('form.visibility', 'Who can see it'))}</Field.Label>
        <Radio.Group
          value={value.visibility}
          onValueChange={(next: string) => onChange({ ...value, visibility: next as Visibility })}
          aria-label={formatMessage(msg('form.visibility', 'Who can see it'))}
        >
          <Radio.Item value="private">
            {formatMessage(msg('visibility.private', 'Only me'))}
          </Radio.Item>
          <Radio.Item value="shared">
            {formatMessage(msg('visibility.sharedOption', 'Specific roles and users'))}
          </Radio.Item>
          <Radio.Item value="public">
            {formatMessage(msg('visibility.publicOption', 'All admin users'))}
          </Radio.Item>
        </Radio.Group>
      </Field.Root>

      {value.visibility === 'shared' ? (
        <Box background="neutral100" hasRadius padding={4}>
          <Flex direction="column" alignItems="stretch" gap={4}>
            {loadError ? (
              <Typography variant="pi" textColor="danger600">
                {formatMessage(
                  msg(
                    'sharing.loadError',
                    'Roles and users could not be loaded. Close the dialog and try again.'
                  )
                )}
              </Typography>
            ) : null}
            <Field.Root name="roles" error={error}>
              <Field.Label>{formatMessage(msg('form.roles', 'Roles'))}</Field.Label>
              <MultiSelect
                withTags
                loading={rolesLoading}
                value={value.roles}
                onChange={(next: string[]) => onChange({ ...value, roles: next })}
                placeholder={formatMessage(msg('form.rolesPlaceholder', 'Choose roles'))}
              >
                {roles.map((role) => (
                  <MultiSelectOption key={role.documentId} value={role.documentId}>
                    {role.name}
                  </MultiSelectOption>
                ))}
              </MultiSelect>
              <Field.Error />
            </Field.Root>

            <Field.Root
              name="users"
              hint={formatMessage(msg('form.usersHint', 'Type a name to search admin users.'))}
            >
              <Field.Label>{formatMessage(msg('form.users', 'Users'))}</Field.Label>
              <Combobox
                value=""
                textValue={search}
                onTextValueChange={setSearch}
                loading={usersLoading}
                loadingMessage={formatMessage(msg('sharing.searching', 'Searching users'))}
                noOptionsMessage={() => formatMessage(msg('sharing.noUsers', 'No matching users'))}
                placeholder={formatMessage(msg('form.usersPlaceholder', 'Search users'))}
                onChange={(id?: string) => {
                  const user = options.find((option) => option.documentId === id);
                  if (user) onChange({ ...value, users: [...value.users, user] });
                  setSearch('');
                }}
              >
                {options.map((user) => (
                  <ComboboxOption key={user.documentId} value={user.documentId}>
                    {userLabel(user)}
                  </ComboboxOption>
                ))}
              </Combobox>
              <Field.Hint />
            </Field.Root>

            {value.users.length ? (
              <Flex gap={2} wrap="wrap">
                {value.users.map((user) => (
                  <Tag
                    key={user.documentId}
                    icon={<Cross />}
                    label={formatMessage(msg('sharing.removeUser', 'Remove {name}'), {
                      name: userLabel(user),
                    })}
                    onClick={() =>
                      onChange({
                        ...value,
                        users: value.users.filter((u) => u.documentId !== user.documentId),
                      })
                    }
                  >
                    {userLabel(user)}
                  </Tag>
                ))}
              </Flex>
            ) : null}
          </Flex>
        </Box>
      ) : null}
    </Flex>
  );
};
