/**
 * Readable summary of the active filter in the list view toolbar, shown when the filter has
 * parts the native filter tags do not show ("any" conditions or a group). Without it a list
 * filtered with "any" would look unfiltered apart from its entry count. The chip opens the
 * filter builder; the button next to it removes every filter.
 */
import { Box, Button, Flex, IconButton, Tooltip, Typography } from '@strapi/design-system';
import { Cross, Filter } from '@strapi/icons';
import { useQueryParams, withEncodedUserParams } from '@strapi/strapi/admin';
import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useFilterFields } from '../hooks/useSchemas';
import { describeTree } from '../utils/describe';
import { isGroup, parseFilterTree } from '../utils/filters';
import { msg } from '../utils/translations';

interface ActiveFilterChipProps {
  uid: string;
  onOpen: () => void;
}

/**
 * @param props - Content type `uid` and `onOpen` (opens the filter builder).
 */
export const ActiveFilterChip = ({ uid, onOpen }: ActiveFilterChipProps) => {
  const { formatMessage } = useIntl();
  const [{ query }, setQuery] = useQueryParams<{ filters?: unknown; _q?: string }>();
  const tree = useMemo(() => parseFilterTree(query.filters), [query.filters]);
  const hidden = tree.match === 'any' || tree.items.some(isGroup) || tree.unsupported;
  const { fields } = useFilterFields(hidden ? uid : null);
  const fieldMap = useMemo(() => new Map(fields.map((field) => [field.path, field])), [fields]);

  if (!hidden || (!tree.items.length && !tree.unsupported)) return null;

  const description = tree.unsupported
    ? formatMessage(msg('summary.customFilters', 'Includes filters set outside the editor.'))
    : describeTree(tree, fieldMap, formatMessage);

  return (
    <Flex gap={1}>
      <Tooltip label={description}>
        <Button
          variant="secondary"
          startIcon={<Filter />}
          onClick={onOpen}
          aria-label={formatMessage(msg('chip.label', 'Edit filter: {description}'), {
            description,
          })}
        >
          {/* The native toolbar row does not wrap from 768 px: keep the chip narrow there. */}
          <Box maxWidth={{ initial: '16rem', medium: '10rem', large: '24rem' }}>
            <Typography ellipsis textColor="primary600" fontWeight="bold" variant="pi">
              {description}
            </Typography>
          </Box>
        </Button>
      </Tooltip>
      <IconButton
        label={formatMessage(msg('chip.clear', 'Remove all filters'))}
        onClick={() =>
          setQuery(
            { ...withEncodedUserParams(query, { page: 1 }), filters: undefined },
            'push',
            true
          )
        }
      >
        <Cross />
      </IconButton>
    </Flex>
  );
};
