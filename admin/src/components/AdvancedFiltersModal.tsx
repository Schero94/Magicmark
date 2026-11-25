/**
 * Filter builder for a Content Manager list view.
 *
 * Reads like a sentence: "Show entries that match [all of these conditions]", then one line per
 * condition ("Category is news"). An optional group adds one level of nesting whose match is the
 * opposite of the top level: "all of (A, any of (B, C))" or "any of (A, all of (B, C))". A live
 * count shows how many entries match before applying. Applying writes the filters into the URL
 * with the admin's `useQueryParams`, like the native filters, so the list refetches without a
 * reload; with "all" the top-level conditions are native `$and` entries and show as native
 * filter tags. Query shapes and limits: see `utils/filters` (buildFilterTree).
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
  VisuallyHidden,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import {
  deepEncodeQueryValues,
  getFetchClient,
  useQueryParams,
  withEncodedUserParams,
} from '@strapi/strapi/admin';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useFilterFields } from '../hooks/useSchemas';
import { type MatchCount, useMatchCount } from '../hooks/useMatchCount';
import { fieldLabel, STATUS_LABELS } from '../utils/describe';
import {
  type FieldOption,
  type FilterGroup,
  type FilterItem,
  type FilterRow,
  type MatchMode,
  buildFilterTree,
  datetimeToInput,
  defaultsFor,
  hasTooManyValues,
  inputToDatetime,
  isDateOnly,
  isGroup,
  LIST_OPERATORS,
  MAX_ALL_CONDITIONS,
  MAX_GROUP_CONDITIONS,
  MAX_LIST_ITEMS,
  maxGroups,
  nextGroupId,
  nextRowId,
  NO_VALUE_OPERATORS,
  operatorChoices,
  parseFilterTree,
  RANGE_OPERATORS,
  relativeDay,
  splitList,
  STATUS_FIELD,
  STATUS_VALUES,
  toCountFilters,
  validateTree,
} from '../utils/filters';
import { keepFocusInside } from '../utils/focusLoop';
import { stringifyQuery } from '../utils/query';
import { TEXT_BUTTON_TARGET } from '../utils/targets';
import { msg, operatorLabel } from '../utils/translations';

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

/** Days offered as one-click values for date fields. */
const DATE_PRESETS = [0, 7, 30];

/** Focus target name for the "Add condition" button. */
const ADD = 'add';

type Part = 'field' | 'value';
type Register = (part: Part, element: HTMLElement | null) => void;

const emptyRow = (): FilterRow => ({ id: nextRowId(), field: '', operator: '$eq', value: '' });

/** A condition the user has not started (no field, no value) is ignored. */
const isBlank = (row: FilterRow) => !row.field && !row.value;

/** Drops blank conditions and empty groups. */
const pruneItems = (items: FilterItem[]): FilterItem[] =>
  items
    .map((item) =>
      isGroup(item) ? { ...item, conditions: item.conditions.filter((row) => !isBlank(row)) } : item
    )
    .filter((item) => (isGroup(item) ? item.conditions.length > 0 : !isBlank(item)));

/** Maps every condition of a list of items. */
const mapRows = (items: FilterItem[], fn: (row: FilterRow) => FilterRow): FilterItem[] =>
  items.map((item) =>
    isGroup(item) ? { ...item, conditions: item.conditions.map(fn) } : fn(item)
  );

/** Conditions in display order, groups included. */
const flatRows = (items: FilterItem[]): FilterRow[] =>
  items.flatMap((item) => (isGroup(item) ? item.conditions : [item]));

interface Removed {
  item: FilterItem;
  index: number;
  groupId?: string;
}

/**
 * @param props - `open`, `onOpenChange` and the content type `uid`.
 */
export const AdvancedFiltersModal = ({ open, onOpenChange, uid }: AdvancedFiltersModalProps) => {
  const { formatMessage } = useIntl();
  const [{ query }, setQuery] = useQueryParams<{
    filters?: unknown;
    _q?: string;
    plugins?: { i18n?: { locale?: string } };
  }>();
  const { fields, isLoading, error, retry } = useFilterFields(open ? uid : null);
  const fieldMap = useMemo(() => new Map(fields.map((field) => [field.path, field])), [fields]);
  const locale = query.plugins?.i18n?.locale;

  // The modal is mounted when it opens, so the draft starts from the current URL filters.
  const [initial] = useState(() => {
    const tree = parseFilterTree(query.filters);
    return {
      ...tree,
      items: mapRows(tree.items, (row) => ({
        ...row,
        value: datetimeToInput(row.value),
        valueTo: row.valueTo && datetimeToInput(row.valueTo),
      })),
    };
  });
  // The control that opened the builder (toolbar button or filter chip) gets focus back on close:
  // the builder has no Radix trigger, so Radix would otherwise leave focus on the page body.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const [match, setMatch] = useState<MatchMode>(initial.match);
  const [items, setItems] = useState<FilterItem[]>(initial.items);
  const [unsupported, setUnsupported] = useState(initial.unsupported);
  const [showErrors, setShowErrors] = useState(false);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const inputs = useRef(new Map<string, HTMLElement>());
  // Element to focus after the next render (set by add, remove and undo).
  const pendingFocus = useRef<string | null>(null);
  const setFocusTarget = (key: string | null) => {
    pendingFocus.current = key;
  };

  // Moves focus after adding, removing or restoring a condition, once the DOM has updated.
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    inputs.current.get(key)?.focus();
  });

  /** Ref callback target: remembers the element for a focus key. */
  const registerInput = useCallback((key: string, element: HTMLElement | null) => {
    if (element) inputs.current.set(key, element);
    else inputs.current.delete(key);
  }, []);

  /** Conditions ready to validate and build: blanks dropped, date-times as ISO instants. */
  const prepared = useMemo(
    () =>
      mapRows(pruneItems(items), (row) =>
        fieldMap.get(row.field)?.type === 'datetime'
          ? {
              ...row,
              value: inputToDatetime(row.value),
              valueTo: row.valueTo && inputToDatetime(row.valueTo),
            }
          : row
      ),
    [items, fieldMap]
  );
  const ready = !isLoading && !error;
  const validation = useMemo(
    () => validateTree({ match, items: prepared }, fieldMap),
    [match, prepared, fieldMap]
  );
  const built = validation.valid ? buildFilterTree({ match, items: prepared }) : null;
  const countFilters =
    built === null || !ready
      ? null
      : built && toCountFilters(built, (path) => fieldMap.get(path)?.type);
  const count = useMatchCount(uid, open ? countFilters : null, locale);

  const groups = items.filter(isGroup);
  const topRows = items.length - groups.length;
  const canAddCondition =
    match === 'all' ? topRows < MAX_ALL_CONDITIONS : items.length < MAX_LIST_ITEMS;
  const canAddGroup = groups.length < maxGroups(match) && items.length < MAX_LIST_ITEMS;

  const change = (next: FilterItem[]) => {
    setItems(next);
    setRemoved(null);
  };

  const updateRow = (id: string, patch: Partial<FilterRow>) =>
    setItems((prev) => mapRows(prev, (row) => (row.id === id ? { ...row, ...patch } : row)));

  const addCondition = (groupId?: string, preset?: Partial<FilterRow>, focus: Part = 'field') => {
    const row = { ...emptyRow(), ...preset };
    change(
      groupId
        ? items.map((item) =>
            isGroup(item) && item.id === groupId
              ? { ...item, conditions: [...item.conditions, row] }
              : item
          )
        : [...items, row]
    );
    setFocusTarget(focus === 'value' ? `${row.id}:value` : row.id);
  };

  const addGroup = () => {
    const row = emptyRow();
    change([...items, { id: nextGroupId(), kind: 'group', conditions: [row] }]);
    setFocusTarget(row.id);
  };

  /**
   * Removes a condition, or a group when `id` is a group id or its last condition, and offers
   * undo. Focus moves to the next condition, or to "Add condition" when none is left.
   */
  const remove = (id: string, groupId?: string) => {
    let next: FilterItem[];
    let entry: Removed;
    const group = groupId ? (items.find((item) => item.id === groupId) as FilterGroup) : null;
    if (group && group.conditions.length > 1) {
      const index = group.conditions.findIndex((row) => row.id === id);
      entry = { item: group.conditions[index], index, groupId };
      next = items.map((item) =>
        item.id === group.id
          ? { ...group, conditions: group.conditions.filter((row) => row.id !== id) }
          : item
      );
    } else {
      const targetId = group ? group.id : id;
      const index = items.findIndex((item) => item.id === targetId);
      entry = { item: items[index], index };
      next = items.filter((item) => item.id !== targetId);
    }
    const before = flatRows(items);
    const after = flatRows(next);
    const position = Math.max(
      0,
      before.findIndex(
        (row) => row.id === (isGroup(entry.item) ? entry.item.conditions[0]?.id : id)
      )
    );
    setItems(next);
    setRemoved(entry);
    setFocusTarget(after.length ? after[Math.min(position, after.length - 1)].id : ADD);
  };

  const undo = () => {
    if (!removed) return;
    const { item, index, groupId } = removed;
    let next: FilterItem[];
    if (groupId) {
      next = items.map((entry) => {
        if (!isGroup(entry) || entry.id !== groupId) return entry;
        const conditions = [...entry.conditions];
        conditions.splice(index, 0, item as FilterRow);
        return { ...entry, conditions };
      });
    } else {
      next = [...items];
      next.splice(index, 0, item);
    }
    setItems(next);
    setRemoved(null);
    setFocusTarget(isGroup(item) ? (item.conditions[0]?.id ?? ADD) : item.id);
  };

  const apply = () => {
    setShowErrors(true);
    if (!validation.valid) {
      const first = [...validation.conditions.keys()][0];
      if (first) setFocusTarget(first);
      return;
    }
    setQuery(
      {
        ...withEncodedUserParams(query, { page: 1 }),
        filters: built ? deepEncodeQueryValues(built) : undefined,
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

  /** Error text of one part of a condition, or undefined. */
  const errorText = (row: FilterRow, part: string): string | undefined => {
    if (part === 'value' && hasTooManyValues(row)) {
      return formatMessage(
        msg(
          'filters.errorTooManyValues',
          'Enter at most {max} values. Strapi does not accept longer lists.'
        ),
        { max: MAX_LIST_ITEMS }
      );
    }
    const code = validation.conditions.get(row.id);
    // Placement errors show at once: they come from the structure, not from typing.
    if (part === 'field' && code === 'statusPlacement') {
      return formatMessage(
        msg(
          'filters.errorStatusPlacement',
          'Status works only as a main condition when all conditions must match.'
        )
      );
    }
    if (part === 'operator' && code === 'duplicateInGroup') {
      return formatMessage(
        msg(
          'filters.errorDuplicateInGroup',
          'This group already uses this field with this condition. Change one of them.'
        )
      );
    }
    if (!showErrors || code !== part) return undefined;
    if (part === 'field') return formatMessage(msg('filters.errorField', 'Choose a field.'));
    if (part === 'operator')
      return formatMessage(msg('filters.errorOperator', 'Choose a condition.'));
    return formatMessage(msg('filters.errorValue', 'Enter a value.'));
  };

  const word = (mode: MatchMode) =>
    formatMessage(mode === 'all' ? msg('summary.and', 'and') : msg('summary.or', 'or'));
  const groupMatch: MatchMode = match === 'all' ? 'any' : 'all';

  /** One-click starting points for the empty state, built from the fields this type has. */
  const textField = fields.find(
    (field) =>
      ['string', 'text'].includes(field.type) &&
      !field.path.includes('.') &&
      field.path !== 'documentId'
  );
  const examples: { label: string; row: Partial<FilterRow>; focus?: Part }[] = [];
  if (fieldMap.has('updatedAt')) {
    examples.push({
      label: formatMessage(msg('filters.exampleUpdated', 'Updated in the last 7 days')),
      row: { field: 'updatedAt', operator: '$gte', value: relativeDay(7, 'datetime') },
    });
  }
  if (fieldMap.has(STATUS_FIELD)) {
    examples.push({
      label: formatMessage(msg('filters.examplePublished', 'Published entries')),
      row: { field: STATUS_FIELD, operator: '$eq', value: 'published' },
    });
  } else if (fieldMap.has('createdAt')) {
    examples.push({
      label: formatMessage(msg('filters.exampleCreated', 'Created in the last 30 days')),
      row: { field: 'createdAt', operator: '$gte', value: relativeDay(30, 'datetime') },
    });
  }
  if (textField) {
    examples.push({
      label: formatMessage(msg('filters.exampleContains', '{field} contains …'), {
        field: textField.label,
      }),
      row: { field: textField.path, operator: '$containsi', value: '' },
      focus: 'value',
    });
  }

  const numbers = new Map(flatRows(items).map((row, index) => [row.id, index + 1]));
  const renderCondition = (row: FilterRow, group?: FilterGroup) => {
    const number = numbers.get(row.id) ?? 0;
    return (
      <ConditionEditor
        row={row}
        number={number}
        fields={fields}
        field={fieldMap.get(row.field)}
        allowStatus={!group && match === 'all'}
        onChange={(patch) => updateRow(row.id, patch)}
        onRemove={() => remove(row.id, group?.id)}
        errorText={(part) => errorText(row, part)}
        register={(part, element) =>
          registerInput(part === 'value' ? `${row.id}:value` : row.id, element)
        }
      />
    );
  };

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content
        onKeyDown={keepFocusInside}
        aria-describedby={undefined}
        onCloseAutoFocus={(event: Event) => {
          if (!opener?.isConnected) return;
          event.preventDefault();
          opener.focus();
        }}
      >
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
            <Flex direction="column" alignItems="stretch" gap={4}>
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

              {items.length === 0 ? (
                <Box background="neutral100" hasRadius padding={6}>
                  <Flex direction="column" alignItems="flex-start" gap={4}>
                    <Flex direction="column" alignItems="flex-start" gap={1}>
                      <Typography variant="delta" tag="h3">
                        {formatMessage(msg('filters.emptyTitle', 'Show only the entries you need'))}
                      </Typography>
                      <Typography variant="pi" textColor="neutral600">
                        {formatMessage(
                          msg(
                            'filters.emptyText',
                            'Start with an example or add your own condition. The number of matching entries updates as you go.'
                          )
                        )}
                      </Typography>
                    </Flex>
                    {examples.length ? (
                      <Flex
                        gap={2}
                        wrap="wrap"
                        role="group"
                        aria-label={formatMessage(msg('filters.examples', 'Examples'))}
                      >
                        {examples.map((example) => (
                          <Button
                            key={example.label}
                            variant="tertiary"
                            onClick={() => addCondition(undefined, example.row, example.focus)}
                          >
                            {example.label}
                          </Button>
                        ))}
                      </Flex>
                    ) : null}
                    <Button
                      ref={(element: HTMLButtonElement | null) => registerInput(ADD, element)}
                      variant="secondary"
                      startIcon={<Plus />}
                      onClick={() => addCondition()}
                    >
                      {formatMessage(msg('filters.add', 'Add condition'))}
                    </Button>
                  </Flex>
                </Box>
              ) : (
                <>
                  <Flex gap={2} wrap="wrap" alignItems="center">
                    <Typography>
                      {formatMessage(msg('filters.matchLead', 'Show entries that match'))}
                    </Typography>
                    <Box width="20rem" maxWidth="100%">
                      <SingleSelect
                        size="S"
                        aria-label={formatMessage(msg('filters.match', 'Show entries that match'))}
                        value={match}
                        onChange={(value: string | number) => {
                          setMatch(value as MatchMode);
                          setRemoved(null);
                        }}
                      >
                        <SingleSelectOption value="all">
                          {formatMessage(msg('filters.matchAll', 'all conditions'))}
                        </SingleSelectOption>
                        <SingleSelectOption value="any">
                          {formatMessage(msg('filters.matchAny', 'any condition'))}
                        </SingleSelectOption>
                      </SingleSelect>
                    </Box>
                  </Flex>

                  <Flex
                    direction="column"
                    alignItems="stretch"
                    gap={2}
                    tag="ol"
                    aria-label={formatMessage(msg('filters.conditions', 'Conditions'))}
                  >
                    {items.map((item, index) => (
                      <Flex key={item.id} tag="li" direction="column" alignItems="stretch" gap={2}>
                        {index > 0 ? <Connector word={word(match)} /> : null}
                        {isGroup(item) ? (
                          <GroupBox
                            match={groupMatch}
                            onRemove={() => remove(item.id, item.id)}
                            canAdd={item.conditions.length < MAX_GROUP_CONDITIONS}
                            onAdd={() => addCondition(item.id)}
                            tooLarge={validation.tooLargeGroups.has(item.id)}
                          >
                            {item.conditions.map((row, rowIndex) => (
                              <Flex key={row.id} direction="column" alignItems="stretch" gap={2}>
                                {rowIndex > 0 ? <Connector word={word(groupMatch)} /> : null}
                                {renderCondition(row, item)}
                              </Flex>
                            ))}
                          </GroupBox>
                        ) : (
                          renderCondition(item)
                        )}
                      </Flex>
                    ))}
                  </Flex>

                  <Flex gap={6} wrap="wrap" alignItems="center">
                    <TextButton
                      ref={(element: HTMLButtonElement | null) => registerInput(ADD, element)}
                      startIcon={<Plus />}
                      {...TEXT_BUTTON_TARGET}
                      disabled={!canAddCondition}
                      onClick={() => addCondition()}
                    >
                      {formatMessage(msg('filters.add', 'Add condition'))}
                    </TextButton>
                    <TextButton
                      startIcon={<Plus />}
                      {...TEXT_BUTTON_TARGET}
                      disabled={!canAddGroup}
                      aria-describedby={!canAddGroup ? 'magic-mark-group-limit' : undefined}
                      onClick={addGroup}
                    >
                      {formatMessage(
                        match === 'all'
                          ? msg('filters.addGroupAny', 'Add an “any of” group')
                          : msg('filters.addGroupAll', 'Add an “all of” group')
                      )}
                    </TextButton>
                  </Flex>
                  {!canAddGroup && match === 'all' ? (
                    <Typography id="magic-mark-group-limit" variant="pi" textColor="neutral600">
                      {formatMessage(
                        msg(
                          'filters.groupLimitAll',
                          'With “all”, one “any of” group is possible. Choose “any” at the top for more groups.'
                        )
                      )}
                    </Typography>
                  ) : null}
                  {validation.tooManyGroups ? (
                    <Typography variant="pi" textColor="danger600" role="alert">
                      {formatMessage(
                        msg(
                          'filters.errorTooManyGroups',
                          'With “all”, keep one group: the Content Manager cannot combine more. Remove a group or choose “any”.'
                        )
                      )}
                    </Typography>
                  ) : null}
                  {validation.tooManyItems || !canAddCondition ? (
                    <Typography
                      variant="pi"
                      textColor={validation.tooManyItems ? 'danger600' : 'neutral600'}
                      role={validation.tooManyItems ? 'alert' : undefined}
                    >
                      {formatMessage(
                        match === 'all'
                          ? msg(
                              'filters.maxConditionsAll',
                              'With “all”, a filter can have at most {max} main conditions. The Content Manager list does not open with more.'
                            )
                          : msg(
                              'filters.maxConditions',
                              'A filter can have at most {max} conditions, the most Strapi accepts.'
                            ),
                        { max: match === 'all' ? MAX_ALL_CONDITIONS : MAX_LIST_ITEMS }
                      )}
                    </Typography>
                  ) : null}
                </>
              )}

              {removed ? (
                <Flex gap={2} wrap="wrap" alignItems="center" role="status">
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage(
                      isGroup(removed.item)
                        ? msg('filters.removedGroup', 'Group removed.')
                        : msg('filters.removedCondition', 'Condition removed.')
                    )}
                  </Typography>
                  <TextButton {...TEXT_BUTTON_TARGET} onClick={undo}>
                    {formatMessage(msg('filters.undo', 'Undo'))}
                  </TextButton>
                </Flex>
              ) : null}

              <MatchCountLine
                count={count}
                hasConditions={prepared.length > 0}
                incomplete={built === null}
              />
            </Flex>
          )}
        </Modal.Body>
        {/* Cancel on the left and the actions on the right, like every other plugin and native
            dialog footer. Wraps on narrow screens: three buttons with longer labels (de) do not
            fit 320 px. */}
        <Modal.Footer wrap="wrap" gap={2}>
          <Modal.Close>
            <Button variant="tertiary">{formatMessage(msg('form.cancel', 'Cancel'))}</Button>
          </Modal.Close>
          <Flex gap={2} marginLeft="auto">
            <Button variant="danger-light" onClick={clearAll} disabled={!query.filters}>
              {formatMessage(msg('filters.clear', 'Clear filters'))}
            </Button>
            <Button onClick={apply} disabled={!ready}>
              {formatMessage(msg('filters.apply', 'Apply'))}
            </Button>
          </Flex>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

/** "and" / "or" between two conditions (decorative: the list and group names say it too). */
const Connector = ({ word }: { word: string }) => (
  <Box paddingLeft={3}>
    <Typography variant="sigma" textColor="neutral600" aria-hidden>
      {word}
    </Typography>
  </Box>
);

interface GroupBoxProps {
  match: MatchMode;
  onRemove: () => void;
  onAdd: () => void;
  canAdd: boolean;
  tooLarge: boolean;
  children: React.ReactNode;
}

/** A group: its own match (the opposite of the top level), its conditions and actions. */
const GroupBox = ({ match, onRemove, onAdd, canAdd, tooLarge, children }: GroupBoxProps) => {
  const { formatMessage } = useIntl();
  const title = formatMessage(
    match === 'any'
      ? msg('filters.groupAny', 'Any of these')
      : msg('filters.groupAll', 'All of these')
  );
  return (
    <Box borderColor="neutral200" hasRadius padding={4} background="neutral0">
      <Flex direction="column" alignItems="stretch" gap={3} role="group" aria-label={title}>
        <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Flex direction="column" alignItems="flex-start" gap={1} minWidth={0}>
            <Typography variant="omega" fontWeight="bold">
              {title}
            </Typography>
            <Typography variant="pi" textColor="neutral600">
              {formatMessage(
                match === 'any'
                  ? msg('filters.groupAnyHint', 'At least one of these must match.')
                  : msg('filters.groupAllHint', 'Every one of these must match.')
              )}
            </Typography>
          </Flex>
          <IconButton
            label={formatMessage(msg('filters.removeGroup', 'Remove group'))}
            variant="ghost"
            onClick={onRemove}
          >
            <Trash />
          </IconButton>
        </Flex>
        <Flex direction="column" alignItems="stretch" gap={2}>
          {children}
        </Flex>
        <Box>
          <TextButton
            startIcon={<Plus />}
            {...TEXT_BUTTON_TARGET}
            disabled={!canAdd}
            onClick={onAdd}
          >
            {formatMessage(msg('filters.addToGroup', 'Add condition to this group'))}
          </TextButton>
        </Box>
        {tooLarge ? (
          <Typography variant="pi" textColor="danger600" role="alert">
            {formatMessage(
              msg('filters.errorGroupTooLarge', 'A group can have at most {max} conditions.'),
              { max: MAX_GROUP_CONDITIONS }
            )}
          </Typography>
        ) : null}
      </Flex>
    </Box>
  );
};

interface MatchCountLineProps {
  count: MatchCount;
  hasConditions: boolean;
  incomplete: boolean;
}

/** Live "12 entries match." line (polite live region). */
const MatchCountLine = ({ count, hasConditions, incomplete }: MatchCountLineProps) => {
  const { formatMessage } = useIntl();
  let text: string;
  let strong = false;
  if (incomplete) {
    text = formatMessage(
      msg('filters.countIncomplete', 'Complete the conditions to see how many entries match.')
    );
  } else if (count.status === 'ready') {
    strong = true;
    text = hasConditions
      ? formatMessage(
          msg(
            'filters.count',
            '{count, plural, =0 {No entries match. Try fewer conditions or “any”.} one {# entry matches.} other {# entries match.}}'
          ),
          { count: count.count }
        )
      : formatMessage(
          msg(
            'filters.countAll',
            '{count, plural, one {No conditions yet: # entry is shown.} other {No conditions yet: all # entries are shown.}}'
          ),
          { count: count.count }
        );
  } else if (count.status === 'error') {
    text = formatMessage(
      msg('filters.countError', 'The number of matching entries could not be counted.')
    );
  } else {
    text = formatMessage(msg('filters.counting', 'Counting matching entries…'));
  }
  return (
    <Box background="neutral100" hasRadius padding={3}>
      <Typography
        variant="omega"
        fontWeight={strong ? 'bold' : undefined}
        textColor={strong ? 'neutral800' : 'neutral600'}
        role="status"
      >
        {text}
      </Typography>
    </Box>
  );
};

interface ConditionEditorProps {
  row: FilterRow;
  number: number;
  fields: FieldOption[];
  field?: FieldOption;
  allowStatus: boolean;
  onChange: (patch: Partial<FilterRow>) => void;
  onRemove: () => void;
  errorText: (part: string) => string | undefined;
  register: Register;
}

/**
 * One condition: field, operator and value, with a remove button. The labels are visually
 * hidden (the row reads as a sentence) but name every control for assistive technology.
 */
const ConditionEditor = ({
  row,
  number,
  fields,
  field,
  allowStatus,
  onChange,
  onRemove,
  errorText,
  register,
}: ConditionEditorProps) => {
  const { formatMessage } = useIntl();
  const type = field?.type;
  const operators = field ? operatorChoices(field.type, row.field.includes('.'), row.operator) : [];
  const needsValue = !NO_VALUE_OPERATORS.includes(row.operator);
  const position = { number };
  const options = fields.filter(
    (option) => option.path !== STATUS_FIELD || allowStatus || row.field === STATUS_FIELD
  );

  return (
    <Box background="neutral100" hasRadius padding={3}>
      <Grid.Root gap={2}>
        <Grid.Item col={4} s={12} xs={12} direction="column" alignItems="stretch">
          <Field.Root name={`field-${row.id}`} error={errorText('field')}>
            <VisuallyHidden>
              <Field.Label>
                {formatMessage(
                  msg('filters.fieldNumbered', 'Field of condition {number}'),
                  position
                )}
              </Field.Label>
            </VisuallyHidden>
            <Combobox
              ref={(element: HTMLInputElement | null) => register('field', element)}
              value={row.field}
              onChange={(value?: string) => {
                const next = fields.find((f) => f.path === value);
                onChange({
                  field: value ?? '',
                  ...(next ? defaultsFor(next) : { operator: '$eq', value: '' }),
                  valueTo: undefined,
                });
              }}
              placeholder={formatMessage(msg('filters.fieldPlaceholder', 'Choose a field'))}
              noOptionsMessage={() => formatMessage(msg('filters.noFields', 'No matching fields'))}
            >
              {options.map((option) => (
                <ComboboxOption key={option.path} value={option.path}>
                  {fieldLabel(option.path, option, formatMessage)}
                </ComboboxOption>
              ))}
            </Combobox>
            <Field.Error />
          </Field.Root>
        </Grid.Item>
        <Grid.Item col={3} s={12} xs={12} direction="column" alignItems="stretch">
          <Field.Root name={`operator-${row.id}`} error={errorText('operator')}>
            <VisuallyHidden>
              <Field.Label>
                {formatMessage(msg('filters.operatorNumbered', 'Condition {number}'), position)}
              </Field.Label>
            </VisuallyHidden>
            <SingleSelect
              value={field ? row.operator : undefined}
              disabled={!field}
              placeholder={formatMessage(msg('filters.operatorPlaceholder', 'Condition'))}
              onChange={(value: string | number) => {
                const operator = String(value);
                const listChange =
                  LIST_OPERATORS.includes(operator) !== LIST_OPERATORS.includes(row.operator);
                onChange({
                  operator,
                  ...(NO_VALUE_OPERATORS.includes(operator)
                    ? { value: '', valueTo: undefined }
                    : {}),
                  ...(listChange && type === 'enumeration' ? { value: '' } : {}),
                });
              }}
            >
              {operators.map((op) => (
                <SingleSelectOption key={op} value={op}>
                  {formatMessage(operatorLabel(op, type))}
                </SingleSelectOption>
              ))}
            </SingleSelect>
            <Field.Error />
          </Field.Root>
        </Grid.Item>
        <Grid.Item col={4} s={10} xs={10} direction="column" alignItems="stretch">
          {needsValue && field ? (
            <ValueInput
              row={row}
              field={field}
              number={number}
              onChange={onChange}
              errorText={errorText}
              register={register}
            />
          ) : null}
        </Grid.Item>
        <Grid.Item col={1} s={2} xs={2} direction="column" alignItems="flex-end">
          <IconButton
            label={formatMessage(msg('filters.remove', 'Remove condition {number}'), position)}
            variant="ghost"
            onClick={onRemove}
          >
            <Trash />
          </IconButton>
        </Grid.Item>
      </Grid.Root>
    </Box>
  );
};

interface ValueInputProps {
  row: FilterRow;
  field: FieldOption;
  number: number;
  onChange: (patch: Partial<FilterRow>) => void;
  errorText: (part: string) => string | undefined;
  register: Register;
}

/**
 * Value input that matches the field type and the operator: a choice for status, booleans and
 * enumerations, suggestions for relations, one-click days for dates, two inputs for "between".
 */
const ValueInput = ({ row, field, number, onChange, errorText, register }: ValueInputProps) => {
  const { formatMessage } = useIntl();
  const isList = LIST_OPERATORS.includes(row.operator);
  const isRange = RANGE_OPERATORS.includes(row.operator);
  const { type } = field;
  const ref = (element: HTMLElement | null) => register('value', element);
  const label = (
    <VisuallyHidden>
      <Field.Label>
        {formatMessage(msg('filters.valueNumbered', 'Value of condition {number}'), { number })}
      </Field.Label>
    </VisuallyHidden>
  );

  const select = (choices: { value: string; label: string }[]) => (
    <Field.Root name={`value-${row.id}`} error={errorText('value')}>
      {label}
      <SingleSelect
        ref={ref}
        value={row.value || undefined}
        placeholder={formatMessage(msg('filters.valuePlaceholder', 'Value'))}
        onChange={(value: string | number) => onChange({ value: String(value) })}
      >
        {choices.map((choice) => (
          <SingleSelectOption key={choice.value} value={choice.value}>
            {choice.label}
          </SingleSelectOption>
        ))}
      </SingleSelect>
      <Field.Error />
    </Field.Root>
  );

  if (type === 'status') {
    return select(
      STATUS_VALUES.map((value) => ({ value, label: formatMessage(STATUS_LABELS[value]) }))
    );
  }
  if (type === 'boolean') {
    return select([
      { value: 'true', label: formatMessage(msg('filters.true', 'Yes')) },
      { value: 'false', label: formatMessage(msg('filters.false', 'No')) },
    ]);
  }
  if (type === 'enumeration' && field.enum) {
    if (!isList) return select(field.enum.map((value) => ({ value, label: value })));
    return (
      <Field.Root name={`value-${row.id}`} error={errorText('value')}>
        {label}
        <MultiSelect
          withTags
          placeholder={formatMessage(msg('filters.valuesPlaceholder', 'Values'))}
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
    );
  }
  if (field.relation && !isList) {
    return (
      <RelationValueInput
        row={row}
        relation={field.relation}
        label={label}
        inputRef={ref}
        onChange={onChange}
        error={errorText('value')}
      />
    );
  }

  // A date-only value on a datetime field (as the native filters save it) means the whole day;
  // a date input keeps it date-only instead of showing an empty date-time input.
  const keepsDay = type === 'datetime' && !isRange && isDateOnly(row.value);
  const inputType = isList ? 'text' : keepsDay ? 'date' : (INPUT_TYPES[type] ?? 'text');

  if (isRange) {
    return (
      <Flex gap={2} alignItems="flex-start">
        <Field.Root name={`from-${row.id}`} error={errorText('value')} flex={1} minWidth={0}>
          <VisuallyHidden>
            <Field.Label>
              {formatMessage(msg('filters.fromNumbered', 'From, condition {number}'), {
                number,
              })}
            </Field.Label>
          </VisuallyHidden>
          <TextInput
            ref={ref}
            type={inputType}
            placeholder={formatMessage(msg('filters.from', 'From'))}
            value={row.value}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ value: event.target.value })
            }
          />
          <Field.Error />
        </Field.Root>
        <Field.Root name={`to-${row.id}`} error={errorText('valueTo')} flex={1} minWidth={0}>
          <VisuallyHidden>
            <Field.Label>
              {formatMessage(msg('filters.toNumbered', 'To, condition {number}'), { number })}
            </Field.Label>
          </VisuallyHidden>
          <TextInput
            type={inputType}
            placeholder={formatMessage(msg('filters.to', 'To'))}
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

  const presets =
    (type === 'date' || type === 'datetime') && !isList && !row.value ? (
      <Flex gap={4} wrap="wrap" paddingTop={2}>
        {DATE_PRESETS.map((days) => (
          <TextButton
            key={days}
            {...TEXT_BUTTON_TARGET}
            onClick={() => onChange({ value: relativeDay(days, type) })}
          >
            {formatMessage(
              msg(
                'filters.daysAgo',
                '{days, plural, =0 {Today} one {Yesterday} other {# days ago}}'
              ),
              { days }
            )}
          </TextButton>
        ))}
      </Flex>
    ) : null;

  return (
    <Field.Root
      name={`value-${row.id}`}
      error={errorText('value')}
      hint={
        isList ? formatMessage(msg('filters.listHint', 'Separate values with commas.')) : undefined
      }
    >
      {label}
      <TextInput
        ref={ref}
        type={inputType}
        placeholder={formatMessage(msg('filters.valuePlaceholder', 'Value'))}
        value={row.value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange({ value: event.target.value })
        }
      />
      <Field.Hint />
      <Field.Error />
      {presets}
    </Field.Root>
  );
};

interface RelationValueInputProps {
  row: FilterRow;
  relation: { target: string; mainField: string };
  label: React.ReactNode;
  inputRef: (element: HTMLElement | null) => void;
  onChange: (patch: Partial<FilterRow>) => void;
  error?: string;
}

/** Wait after typing before asking for relation suggestions. */
const SUGGEST_DELAY_MS = 250;

/**
 * Value of a relation's main field with suggestions from the related entries (the Content
 * Manager list of the target type, searched with `_q`). Free text stays possible; without read
 * access to the target type the request fails and the input works without suggestions.
 */
const RelationValueInput = ({
  row,
  relation,
  label,
  inputRef,
  onChange,
  error,
}: RelationValueInputProps) => {
  const { formatMessage } = useIntl();
  const [suggestions, setSuggestions] = useState<{ key: string; values: string[] }>({
    key: '',
    values: [],
  });
  const key = JSON.stringify([relation.target, relation.mainField, row.value]);

  useEffect(() => {
    const [target, mainField, text] = JSON.parse(key) as [string, string, string];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      getFetchClient()
        .get<{ results?: Record<string, unknown>[] }>(
          `/content-manager/collection-types/${target}`,
          {
            params: stringifyQuery({
              page: 1,
              pageSize: 10,
              sort: `${mainField}:ASC`,
              ...(text ? { _q: text } : {}),
            }),
            signal: controller.signal,
          }
        )
        .then(({ data }) => {
          const values = (data?.results ?? [])
            .map((entry) => entry[mainField])
            .filter((value) => typeof value === 'string' || typeof value === 'number')
            .map(String)
            .filter(Boolean);
          setSuggestions({ key, values: [...new Set(values)] });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions({ key, values: [] });
        });
    }, SUGGEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return (
    <Field.Root name={`value-${row.id}`} error={error}>
      {label}
      <Combobox
        ref={inputRef}
        allowCustomValue
        autocomplete="none"
        textValue={row.value}
        onTextValueChange={(text: string) => onChange({ value: text })}
        onChange={(value?: string) => {
          if (value !== undefined) onChange({ value });
        }}
        loading={suggestions.key !== key}
        loadingMessage={formatMessage(msg('filters.loadingSuggestions', 'Loading suggestions'))}
        placeholder={formatMessage(msg('filters.relationPlaceholder', 'Type or pick an entry'))}
        noOptionsMessage={() => formatMessage(msg('filters.noSuggestions', 'No matching entries'))}
      >
        {suggestions.values.map((value) => (
          <ComboboxOption key={value} value={value}>
            {value}
          </ComboboxOption>
        ))}
      </Combobox>
      <Field.Error />
    </Field.Root>
  );
};

export default AdvancedFiltersModal;
