/**
 * Read-only summary of a saved list view: its filters as tags (worded like the native filter
 * tags), the sort order and the locale.
 */
import { Box, Flex, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { useFilterFields } from '../hooks/useSchemas';
import { NO_VALUE_OPERATORS, RANGE_OPERATORS, parseFilters } from '../utils/filters';
import { parseQuery } from '../utils/query';
import { msg, operatorLabel } from '../utils/translations';

interface FilterSummaryProps {
  contentType: string | null;
  query: string;
}

/**
 * @param props - `contentType` uid and saved `query`.
 */
export const FilterSummary = ({ contentType, query }: FilterSummaryProps) => {
  const { formatMessage } = useIntl();
  const { fields } = useFilterFields(contentType);
  const parsed = parseQuery(query);
  const state = parseFilters(parsed.filters);
  const labels = new Map(fields.map((field) => [field.path, field.label]));

  const tags = state.rows.map((row) => {
    const field = labels.get(row.field) ?? row.field;
    const op = formatMessage(operatorLabel(row.operator));
    if (NO_VALUE_OPERATORS.includes(row.operator)) return `${field} ${op}`;
    if (RANGE_OPERATORS.includes(row.operator)) {
      return formatMessage(msg('summary.range', '{field} {operator} {from} and {to}'), {
        field,
        operator: op,
        from: row.value,
        to: row.valueTo ?? '',
      });
    }
    return `${field} ${op} ${row.value}`;
  });

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
            {formatMessage(
              state.match === 'any'
                ? msg('summary.matchAny', 'Any of')
                : msg('summary.matchAll', 'All of')
            )}
          </Typography>
          {tags.map((label, index) => (
            <Box
              key={`${index}-${label}`}
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
          ))}
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
