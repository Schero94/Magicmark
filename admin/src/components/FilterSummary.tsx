/**
 * Read-only summaries of a saved list view: its filters as tags (worded like the filter builder,
 * a group as a framed set of tags), the sort order and the locale; and a one-line text for lists.
 */
import { Box, Flex, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { useFilterFields } from '../hooks/useSchemas';
import { describeCondition, describeTree } from '../utils/describe';
import { isGroup, parseFilterTree } from '../utils/filters';
import { parseQuery } from '../utils/query';
import { msg } from '../utils/translations';

interface FilterSummaryProps {
  contentType: string | null;
  query: string;
}

/** One condition as a tag. */
const Tag = ({ label }: { label: string }) => (
  <Box
    background="primary100"
    borderColor="primary200"
    hasRadius
    paddingLeft={2}
    paddingRight={2}
    paddingTop={1}
    paddingBottom={1}
    minWidth={0}
  >
    <Typography variant="pi" fontWeight="bold" textColor="primary600">
      {label}
    </Typography>
  </Box>
);

/**
 * @param props - `contentType` uid and saved `query`.
 */
export const FilterSummary = ({ contentType, query }: FilterSummaryProps) => {
  const { formatMessage } = useIntl();
  const { fields } = useFilterFields(contentType);
  const parsed = parseQuery(query);
  const state = parseFilterTree(parsed.filters);
  const fieldMap = new Map(fields.map((field) => [field.path, field]));
  const labels = new Map(fields.map((field) => [field.path, field.label]));
  const describe = (row: Parameters<typeof describeCondition>[0]) =>
    describeCondition(row, fieldMap, formatMessage);
  const matchLabel = (match: 'all' | 'any') =>
    formatMessage(
      match === 'any' ? msg('summary.matchAny', 'Any of') : msg('summary.matchAll', 'All of')
    );

  const tags = state.items.map((item) =>
    isGroup(item) ? (
      <Flex
        key={item.id}
        gap={2}
        wrap="wrap"
        alignItems="center"
        borderColor="neutral200"
        hasRadius
        padding={2}
      >
        <Typography variant="pi" textColor="neutral600">
          {matchLabel(state.match === 'all' ? 'any' : 'all')}
        </Typography>
        {item.conditions.map((row) => (
          <Tag key={row.id} label={describe(row)} />
        ))}
      </Flex>
    ) : (
      <Tag key={item.id} label={describe(item)} />
    )
  );

  const sort = typeof parsed.sort === 'string' ? parsed.sort.split(':') : null;
  const locale = (parsed.plugins as { i18n?: { locale?: string } } | undefined)?.i18n?.locale;

  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {tags.length === 0 && !state.unsupported ? (
        <Typography variant="pi" textColor="neutral600">
          {formatMessage(msg('summary.noFilters', 'No filters. The bookmark opens the full list.'))}
        </Typography>
      ) : null}
      {tags.length > 0 ? (
        <Flex gap={2} wrap="wrap">
          <Typography variant="pi" textColor="neutral600">
            {matchLabel(state.match)}
          </Typography>
          {tags}
        </Flex>
      ) : null}
      {state.unsupported ? (
        <Typography variant="pi" textColor="neutral600">
          {formatMessage(msg('summary.customFilters', 'Includes filters set outside the editor.'))}
        </Typography>
      ) : null}
      {sort || locale ? (
        <Typography variant="pi" textColor="neutral600">
          {[
            sort
              ? formatMessage(msg('summary.sort', 'Sorted by {field}, {direction}'), {
                  field: labels.get(sort[0]) ?? sort[0],
                  direction: formatMessage(
                    sort[1]?.toUpperCase() === 'DESC'
                      ? msg('summary.descending', 'descending')
                      : msg('summary.ascending', 'ascending')
                  ),
                })
              : null,
            locale ? formatMessage(msg('summary.locale', 'Locale: {locale}'), { locale }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      ) : null}
    </Flex>
  );
};

/**
 * One-line description of a saved view's filters for the bookmark list ("Category is news or
 * Views is at least 50"), cut with an ellipsis; the full text is in the title.
 * @param props - `contentType` uid and saved `query`.
 */
export const FilterSummaryText = ({ contentType, query }: FilterSummaryProps) => {
  const { formatMessage } = useIntl();
  const { fields } = useFilterFields(contentType);
  const tree = parseFilterTree(parseQuery(query).filters);
  const fieldMap = new Map(fields.map((field) => [field.path, field]));
  const text = tree.items.length
    ? describeTree(tree, fieldMap, formatMessage)
    : tree.unsupported
      ? formatMessage(msg('summary.customFilters', 'Includes filters set outside the editor.'))
      : formatMessage(msg('summary.none', 'No filters'));
  return (
    <Typography textColor={tree.items.length ? 'neutral800' : 'neutral600'} ellipsis title={text}>
      {text}
    </Typography>
  );
};
