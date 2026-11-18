/**
 * Advanced filters for a Content Manager list view.
 *
 * One "match" choice (all / any) and a flat list of conditions. Applying writes the filters
 * into the URL with the admin's `useQueryParams`, the same way the native filters do, so the
 * list refetches without a page reload. With "all" the conditions use the native `$and`
 * shape and appear as native filter tags.
 */
import {
  Alert,
  Box,
  Button,
  Combobox,
  ComboboxOption,
  Field,
  Flex,
  Grid,
  IconButton,
  Loader,
  Modal,
  MultiSelect,
  MultiSelectOption,
  SingleSelect,
  SingleSelectOption,
  TextButton,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { deepEncodeQueryValues, useQueryParams, withEncodedUserParams } from '@strapi/strapi/admin';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useFilterFields } from '../hooks/useSchemas';
import {
  LIST_OPERATORS,
  MAX_LIST_ITEMS,
  NO_VALUE_OPERATORS,
  maxConditions,
  RANGE_OPERATORS,
  type FieldOption,
  type FilterRow,
  type MatchMode,
  buildFilters,
  datetimeToInput,
  fitsAdminQueryDepth,
  hasTooManyValues,
  inputToDatetime,
  isDateOnly,
  nextRowId,
  operatorsForType,
  parseFilters,
  splitList,
  validateRow,
} from '../utils/filters';
import { msg, operatorLabel } from '../utils/translations';
import { keepFocusInside } from '../utils/focusLoop';
import { TEXT_BUTTON_TARGET } from '../utils/targets';

interface AdvancedFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
}

const INPUT_TYPES: Record<string, string> = {
  integer: 'number',
  biginteger: 'text',
  float: 'number',
  decimal: 'number',
  date: 'date',
  time: 'time',
  datetime: 'datetime-local',
  email: 'text',
};

const emptyRow = (): FilterRow => ({ id: nextRowId(), field: '', operator: '$eq', value: '' });

/**
 * @param props - `open`, `onOpenChange` and the content type `uid`.
 */
export const AdvancedFiltersModal = ({ open, onOpenChange, uid }: AdvancedFiltersModalProps) => {
  const { formatMessage } = useIntl();
  const [{ query }, setQuery] = useQueryParams<{ filters?: unknown; _q?: string }>();
  const { fields, isLoading, error, retry } = useFilterFields(open ? uid : null);
  const fieldMap = useMemo(() => new Map(fields.map((field) => [field.path, field])), [fields]);

  // The modal is mounted when it opens, so the draft starts from the current URL filters.
  const [initial] = useState(() => parseFilters(query.filters));
  const [match, setMatch] = useState<MatchMode>(initial.match);
  const [rows, setRows] = useState<FilterRow[]>(() =>
    initial.rows.length
      ? initial.rows.map((row) => ({
          ...row,
          value: datetimeToInput(row.value),
          valueTo: row.valueTo && datetimeToInput(row.valueTo),
        }))
      : [emptyRow()]
  );
  const [unsupported, setUnsupported] = useState(initial.unsupported);
  const [showErrors, setShowErrors] = useState(false);

  const updateRow = (id: string, patch: Partial<FilterRow>) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const activeRows = rows.filter((row) => row.field || row.value);
  const rowErrors = new Map(activeRows.map((row) => [row.id, validateRow(row, fieldMap)]));
  // Strapi accepts at most 100 conditions in one $or list (400 above that); with "all" the
  // Content Manager list renders at most 20 (see maxConditions).
  const rowLimit = maxConditions(match);
  const tooManyRows = activeRows.length > rowLimit;
  const atRowLimit = rows.length >= rowLimit;
  const hasErrors = tooManyRows || [...rowErrors.values()].some(Boolean);

  const apply = () => {
    setShowErrors(true);
    if (hasErrors) return;
    const prepared = activeRows.map((row) =>
      fieldMap.get(row.field)?.type === 'datetime'
        ? {
            ...row,
            value: inputToDatetime(row.value),
            valueTo: row.valueTo && inputToDatetime(row.valueTo),
          }
        : row
    );
    const filters = buildFilters(match, prepared);
    if (filters && !fitsAdminQueryDepth(filters)) return;
    setQuery(
      {
        ...withEncodedUserParams(query, { page: 1 }),
        filters: filters ? deepEncodeQueryValues(filters) : undefined,
      },
      'push',
      true
    );
    onOpenChange(false);
  };

  const clearAll = () => {
    setQuery({ ...withEncodedUserParams(query, { page: 1 }), filters: undefined }, 'push', true);
    onOpenChange(false);
  };

  const errorText = (row: FilterRow, part: string) => {
    // A list that is too long is shown while typing, so the limit is clear before applying.
    if (part === 'value' && hasTooManyValues(row)) {
      return formatMessage(
        msg(
          'filters.errorTooManyValues',
          'Enter at most {max} values. Strapi does not accept longer lists.'
        ),
        { max: MAX_LIST_ITEMS }
      );
    }
    if (!showErrors || rowErrors.get(row.id) !== part) return undefined;
    if (part === 'field') return formatMessage(msg('filters.errorField', 'Choose a field.'));
    if (part === 'operator')
      return formatMessage(msg('filters.errorOperator', 'Choose a condition.'));
    return formatMessage(msg('filters.errorValue', 'Enter a value.'));
  };

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content onKeyDown={keepFocusInside} aria-describedby={undefined}>
        <Modal.Header closeLabel={formatMessage(msg('form.close', 'Close'))}>
          <Modal.Title>{formatMessage(msg('filters.title', 'Advanced filters'))}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isLoading ? (
            <Flex justifyContent="center" padding={6}>
              <Loader small>{formatMessage(msg('state.loading', 'Loading'))}</Loader>
            </Flex>
          ) : error ? (
            <Alert
              variant="danger"
              closeLabel={formatMessage(msg('form.close', 'Close'))}
              title={formatMessage(msg('filters.loadErrorTitle', 'Fields could not be loaded'))}
              action={
                <Button variant="secondary" size="S" onClick={retry}>
                  {formatMessage(msg('state.retry', 'Try again'))}
                </Button>
              }
            >
              {formatMessage(
                msg('filters.loadError', 'The fields of this content type could not be loaded.')
              )}
            </Alert>
          ) : (
            <Flex direction="column" alignItems="stretch" gap={6}>
              {unsupported ? (
                <Alert
                  variant="warning"
                  closeLabel={formatMessage(msg('form.close', 'Close'))}
                  onClose={() => setUnsupported(false)}
                >
                  {formatMessage(
                    msg(
                      'filters.unsupported',
                      'The list has filters this editor cannot show. Applying replaces them.'
                    )
                  )}
                </Alert>
              ) : null}

              <Field.Root
                name="match"
                hint={
                  match === 'any'
                    ? formatMessage(
                        msg(
                          'filters.matchAnyHint',
                          'These conditions are not shown as filter tags above the list.'
                        )
                      )
                    : undefined
                }
              >
                <Field.Label>
                  {formatMessage(msg('filters.match', 'Show entries that match'))}
                </Field.Label>
                <SingleSelect
                  value={match}
                  onChange={(value: string | number) => setMatch(value as MatchMode)}
                >
                  <SingleSelectOption value="all">
                    {formatMessage(msg('filters.matchAll', 'All conditions'))}
                  </SingleSelectOption>
                  <SingleSelectOption value="any">
                    {formatMessage(msg('filters.matchAny', 'Any condition'))}
                  </SingleSelectOption>
                </SingleSelect>
                <Field.Hint />
              </Field.Root>

              <Flex
                direction="column"
                alignItems="stretch"
                gap={4}
                tag="ol"
                aria-label={formatMessage(msg('filters.conditions', 'Conditions'))}
              >
                {rows.map((row, index) => (
                  <Box key={row.id} tag="li" background="neutral100" hasRadius padding={4}>
                    <FilterRowEditor
                      row={row}
                      index={index}
                      fields={fields}
                      field={fieldMap.get(row.field)}
                      onChange={(patch) => updateRow(row.id, patch)}
                      onRemove={() =>
                        setRows((prev) => {
                          const next = prev.filter((r) => r.id !== row.id);
                          return next.length ? next : [emptyRow()];
                        })
                      }
                      errorText={(part) => errorText(row, part)}
                    />
                  </Box>
                ))}
              </Flex>
              <Flex direction="column" alignItems="flex-start" gap={2}>
                <TextButton
                  startIcon={<Plus />}
                  {...TEXT_BUTTON_TARGET}
                  disabled={atRowLimit}
                  aria-describedby={atRowLimit ? 'magic-mark-filters-row-limit' : undefined}
                  onClick={() => setRows((prev) => [...prev, emptyRow()])}
                >
                  {formatMessage(msg('filters.add', 'Add condition'))}
                </TextButton>
                {atRowLimit ? (
                  <Typography
                    id="magic-mark-filters-row-limit"
                    variant="pi"
                    textColor={tooManyRows ? 'danger600' : 'neutral600'}
                    role={tooManyRows ? 'alert' : undefined}
                  >
                    {formatMessage(
                      match === 'all'
                        ? tooManyRows
                          ? msg(
                              'filters.errorTooManyConditionsAll',
                              'With All conditions, keep at most {max} conditions: the Content Manager list does not open with more. Remove conditions or choose Any condition.'
                            )
                          : msg(
                              'filters.maxConditionsAll',
                              'With All conditions, a filter can have at most {max} conditions. The Content Manager list does not open with more.'
                            )
                        : tooManyRows
                          ? msg(
                              'filters.errorTooManyConditions',
                              'Remove conditions until at most {max} are left. Strapi does not accept more.'
                            )
                          : msg(
                              'filters.maxConditions',
                              'A filter can have at most {max} conditions, the most Strapi accepts.'
                            ),
                      { max: rowLimit }
                    )}
                  </Typography>
                ) : null}
              </Flex>
            </Flex>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger-light" onClick={clearAll} disabled={!query.filters}>
            {formatMessage(msg('filters.clear', 'Clear all'))}
          </Button>
          <Flex gap={2}>
            <Modal.Close>
              <Button variant="tertiary">{formatMessage(msg('form.cancel', 'Cancel'))}</Button>
            </Modal.Close>
            <Button onClick={apply} disabled={isLoading || !!error}>
              {formatMessage(msg('filters.apply', 'Apply'))}
            </Button>
          </Flex>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

interface FilterRowEditorProps {
  row: FilterRow;
  index: number;
  fields: FieldOption[];
  field?: FieldOption;
  onChange: (patch: Partial<FilterRow>) => void;
  onRemove: () => void;
  errorText: (part: string) => string | undefined;
}

/**
 * One condition: field, operator and value, with a remove button.
 */
const FilterRowEditor = ({
  row,
  index,
  fields,
  field,
  onChange,
  onRemove,
  errorText,
}: FilterRowEditorProps) => {
  const { formatMessage } = useIntl();
  const operators = field ? operatorsForType(field.type, row.field.includes('.')) : [];
  const needsValue = !NO_VALUE_OPERATORS.includes(row.operator);
  const position = { number: index + 1 };

  return (
    <Grid.Root gap={4}>
      <Grid.Item col={4} s={6} xs={12} direction="column" alignItems="stretch">
        <Field.Root name={`field-${row.id}`} error={errorText('field')}>
          <Field.Label>{formatMessage(msg('filters.field', 'Field'))}</Field.Label>
          <Combobox
            value={row.field}
            onChange={(value?: string) => {
              const next = fields.find((f) => f.path === value);
              const ops = next ? operatorsForType(next.type, (value ?? '').includes('.')) : [];
              onChange({
                field: value ?? '',
                operator: ops.includes(row.operator) ? row.operator : (ops[0] ?? '$eq'),
                value: '',
                valueTo: undefined,
              });
            }}
            placeholder={formatMessage(msg('filters.fieldPlaceholder', 'Choose a field'))}
            noOptionsMessage={() => formatMessage(msg('filters.noFields', 'No matching fields'))}
          >
            {fields.map((option) => (
              <ComboboxOption key={option.path} value={option.path}>
                {option.label}
              </ComboboxOption>
            ))}
          </Combobox>
          <Field.Error />
        </Field.Root>
      </Grid.Item>
      <Grid.Item col={3} s={6} xs={12} direction="column" alignItems="stretch">
        <Field.Root name={`operator-${row.id}`} error={errorText('operator')}>
          <Field.Label>{formatMessage(msg('filters.operator', 'Condition'))}</Field.Label>
          <SingleSelect
            value={row.operator}
            disabled={!field}
            onChange={(value: string | number) => onChange({ operator: String(value) })}
          >
            {operators.map((op) => (
              <SingleSelectOption key={op} value={op}>
                {formatMessage(operatorLabel(op))}
              </SingleSelectOption>
            ))}
          </SingleSelect>
          <Field.Error />
        </Field.Root>
      </Grid.Item>
      <Grid.Item col={4} s={10} xs={10} direction="column" alignItems="stretch">
        {needsValue ? (
          <ValueInput row={row} field={field} onChange={onChange} errorText={errorText} />
        ) : null}
      </Grid.Item>
      <Grid.Item
        col={1}
        s={2}
        xs={2}
        direction="column"
        alignItems="flex-end"
        justifyContent="flex-end"
      >
        <IconButton
          label={formatMessage(msg('filters.remove', 'Remove condition {number}'), position)}
          variant="ghost"
          onClick={onRemove}
        >
          <Trash />
        </IconButton>
      </Grid.Item>
    </Grid.Root>
  );
};

interface ValueInputProps {
  row: FilterRow;
  field?: FieldOption;
  onChange: (patch: Partial<FilterRow>) => void;
  errorText: (part: string) => string | undefined;
}

/**
 * Value input that matches the field type and the operator.
 */
const ValueInput = ({ row, field, onChange, errorText }: ValueInputProps) => {
  const { formatMessage } = useIntl();
  const valueLabel = formatMessage(msg('filters.value', 'Value'));
  const isList = LIST_OPERATORS.includes(row.operator);
  const isRange = RANGE_OPERATORS.includes(row.operator);
  const type = field?.type ?? 'string';

  if (type === 'boolean') {
    return (
      <Field.Root name={`value-${row.id}`} error={errorText('value')}>
        <Field.Label>{valueLabel}</Field.Label>
        <SingleSelect
          value={row.value}
          onChange={(value: string | number) => onChange({ value: String(value) })}
        >
          <SingleSelectOption value="true">
            {formatMessage(msg('filters.true', 'true'))}
          </SingleSelectOption>
          <SingleSelectOption value="false">
            {formatMessage(msg('filters.false', 'false'))}
          </SingleSelectOption>
        </SingleSelect>
        <Field.Error />
      </Field.Root>
    );
  }

  if (type === 'enumeration' && field?.enum) {
    return isList ? (
      <Field.Root name={`value-${row.id}`} error={errorText('value')}>
        <Field.Label>{valueLabel}</Field.Label>
        <MultiSelect
          withTags
          value={splitList(row.value)}
          onChange={(values: string[]) => onChange({ value: values.join(', ') })}
        >
          {field.enum.map((option) => (
            <MultiSelectOption key={option} value={option}>
              {option}
            </MultiSelectOption>
          ))}
        </MultiSelect>
        <Field.Error />
      </Field.Root>
    ) : (
      <Field.Root name={`value-${row.id}`} error={errorText('value')}>
        <Field.Label>{valueLabel}</Field.Label>
        <SingleSelect
          value={row.value}
          onChange={(value: string | number) => onChange({ value: String(value) })}
        >
          {field.enum.map((option) => (
            <SingleSelectOption key={option} value={option}>
              {option}
            </SingleSelectOption>
          ))}
        </SingleSelect>
        <Field.Error />
      </Field.Root>
    );
  }

  // A date-only value on a datetime field (as the native 5.62 filters save it) means the whole
  // day; a date input keeps it date-only instead of showing an empty date-time input.
  const keepsDay = type === 'datetime' && !isRange && isDateOnly(row.value);
  const inputType = isList ? 'text' : keepsDay ? 'date' : (INPUT_TYPES[type] ?? 'text');

  if (isRange) {
    return (
      <Flex gap={2} alignItems="flex-start">
        <Field.Root name={`from-${row.id}`} error={errorText('value')} flex={1} minWidth={0}>
          <Field.Label>{formatMessage(msg('filters.from', 'From'))}</Field.Label>
          <TextInput
            type={inputType}
            value={row.value}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ value: event.target.value })
            }
          />
          <Field.Error />
        </Field.Root>
        <Field.Root name={`to-${row.id}`} error={errorText('valueTo')} flex={1} minWidth={0}>
          <Field.Label>{formatMessage(msg('filters.to', 'To'))}</Field.Label>
          <TextInput
            type={inputType}
            value={row.valueTo ?? ''}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ valueTo: event.target.value })
            }
          />
          <Field.Error />
        </Field.Root>
      </Flex>
    );
  }

  return (
    <Field.Root
      name={`value-${row.id}`}
      error={errorText('value')}
      hint={
        isList ? formatMessage(msg('filters.listHint', 'Separate values with commas.')) : undefined
      }
    >
      <Field.Label>{valueLabel}</Field.Label>
      <TextInput
        type={inputType}
        value={row.value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange({ value: event.target.value })
        }
      />
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  );
};

export default AdvancedFiltersModal;
