/**
 * Builds the advanced filter field list from Content Manager schemas. Pure module.
 */
import type { FieldOption } from './filters';

export interface Attribute {
  type: string;
  enum?: string[];
  target?: string;
  targetModel?: string;
  component?: string;
  repeatable?: boolean;
  private?: boolean;
  relation?: string;
}

export interface SchemaInfo {
  uid: string;
  displayName: string;
  attributes: Record<string, Attribute>;
}

export interface InitData {
  contentTypes: {
    uid: string;
    info?: { displayName?: string };
    attributes: Record<string, Attribute>;
  }[];
  components: {
    uid: string;
    info?: { displayName?: string };
    attributes: Record<string, Attribute>;
  }[];
}

export interface Metadata {
  list?: { label?: string; mainField?: string | { name?: string } };
  edit?: { label?: string; mainField?: string | { name?: string } };
}

/** Attribute types the native filters exclude, plus relations to admin users. */
const NOT_FILTERABLE = new Set([
  'json',
  'component',
  'media',
  'richtext',
  'dynamiczone',
  'password',
  'blocks',
  'relation',
]);

const SCALAR_SUB_TYPES = new Set([
  'string',
  'text',
  'email',
  'uid',
  'integer',
  'biginteger',
  'float',
  'decimal',
  'date',
  'datetime',
  'time',
  'boolean',
  'enumeration',
]);

const mainFieldName = (meta?: Metadata): string | undefined => {
  const main = meta?.list?.mainField ?? meta?.edit?.mainField;
  return typeof main === 'string' ? main : main?.name;
};

/**
 * Builds the filterable fields of a content type, the way the native filters do, plus
 * relation main fields and the scalar fields of non-repeatable components.
 * @param uid - Content type uid.
 * @param init - Schemas from /content-manager/init.
 * @param metadatas - List metadatas of the content type.
 * @param readable - Field names the user may read, or null when unknown.
 * @returns Field options in display order.
 */
export const buildFieldOptions = (
  uid: string,
  init: InitData,
  metadatas: Record<string, Metadata>,
  readable: string[] | null
): FieldOption[] => {
  const schema = init.contentTypes.find((ct) => ct.uid === uid);
  if (!schema) return [];
  const fields: FieldOption[] = [
    { path: 'id', label: 'id', type: 'integer' },
    { path: 'documentId', label: 'documentId', type: 'string' },
  ];
  const canRead = (name: string) =>
    readable === null || readable.some((field) => field === name || field.startsWith(`${name}.`));

  for (const [name, attribute] of Object.entries(schema.attributes)) {
    if (!canRead(name) || attribute.private) continue;
    const label = metadatas[name]?.list?.label || metadatas[name]?.edit?.label || name;

    if (attribute.type === 'relation') {
      const target = attribute.targetModel ?? attribute.target;
      if (!target || target === 'admin::user') continue;
      const targetSchema = init.contentTypes.find((ct) => ct.uid === target);
      const main = mainFieldName(metadatas[name]);
      const mainType = main ? targetSchema?.attributes?.[main]?.type : undefined;
      if (main && mainType && SCALAR_SUB_TYPES.has(mainType)) {
        fields.push({
          path: `${name}.${main}`,
          label: `${label} (${main})`,
          type: mainType,
          group: label,
        });
      }
      fields.push({ path: `${name}.id`, label: `${label} (id)`, type: 'integer', group: label });
      continue;
    }

    if (attribute.type === 'component' && !attribute.repeatable && attribute.component) {
      const component = init.components.find((c) => c.uid === attribute.component);
      for (const [subName, sub] of Object.entries(component?.attributes ?? {})) {
        if (!SCALAR_SUB_TYPES.has(sub.type) || sub.private) continue;
        fields.push({
          path: `${name}.${subName}`,
          label: `${label} (${subName})`,
          type: sub.type,
          enum: sub.enum,
          group: label,
        });
      }
      continue;
    }

    if (NOT_FILTERABLE.has(attribute.type)) continue;
    fields.push({ path: name, label, type: attribute.type, enum: attribute.enum });
  }

  for (const name of ['createdAt', 'updatedAt']) {
    if (!fields.some((field) => field.path === name)) {
      fields.push({ path: name, label: metadatas[name]?.list?.label || name, type: 'datetime' });
    }
  }
  return fields;
};
