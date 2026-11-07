'use strict';

/**
 * In-memory stand-in for the parts of Strapi the plugin's services use: `db.query(uid)`,
 * `documents(uid)`, `db.transaction`, `store`, `log` and the admin permission service.
 * Where clauses support the operators the plugin sends ($and, $or, $in, $ne, $null,
 * $notNull, $containsi, $gt and nested relation objects).
 */
const crypto = require('node:crypto');

const isOperatorObject = (value) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).some((k) => k.startsWith('$'));

const matchValue = (actual, condition) => {
  if (isOperatorObject(condition)) {
    return Object.entries(condition).every(([op, expected]) => {
      switch (op) {
        case '$eq':
          return actual === expected;
        case '$ne':
          return actual !== null && actual !== undefined && actual !== expected;
        case '$in':
          return expected.includes(actual);
        case '$null':
          return expected
            ? actual === null || actual === undefined
            : actual !== null && actual !== undefined;
        case '$notNull':
          return expected
            ? actual !== null && actual !== undefined
            : actual === null || actual === undefined;
        case '$containsi':
          return (
            typeof actual === 'string' &&
            actual.toLowerCase().includes(String(expected).toLowerCase())
          );
        case '$gt':
          return actual > expected;
        default:
          throw new Error(`fake db: unsupported operator ${op}`);
      }
    });
  }
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    return actual && typeof actual === 'object' && matches(actual, condition);
  }
  return actual === condition;
};

const matches = (row, where = {}) =>
  Object.entries(where).every(([key, condition]) => {
    if (key === '$and') return condition.every((c) => matches(row, c));
    if (key === '$or') return condition.some((c) => matches(row, c));
    if (key === '$not') return !matches(row, condition);
    return matchValue(row[key], condition);
  });

const sortRows = (rows, sort) => {
  const list = Array.isArray(sort) ? sort : sort ? [sort] : [];
  return [...rows].sort((a, b) => {
    for (const entry of list) {
      const [field, dir] = Object.entries(entry)[0];
      if (a[field] < b[field]) return dir === 'desc' ? 1 : -1;
      if (a[field] > b[field]) return dir === 'desc' ? -1 : 1;
    }
    return 0;
  });
};

const pick = (row, fields) => {
  if (!fields) return { ...row };
  const out = { id: row.id, documentId: row.documentId };
  for (const field of fields) out[field] = row[field];
  return out;
};

const createFakeStrapi = ({ tables = {}, store = {} } = {}) => {
  const data = new Map();
  let nextId = 1;
  const calls = { queries: [] };
  const table = (uid) => {
    if (!data.has(uid)) data.set(uid, []);
    return data.get(uid);
  };
  const insert = (uid, row) => {
    const full = {
      id: nextId++,
      documentId: crypto.randomBytes(12).toString('hex').slice(0, 24),
      ...row,
    };
    table(uid).push(full);
    return full;
  };
  for (const [uid, rows] of Object.entries(tables)) for (const row of rows) insert(uid, row);

  const query = (uid) => ({
    async findMany({ where, select, orderBy, limit, populate } = {}) {
      calls.queries.push({ uid, op: 'findMany' });
      let rows = sortRows(
        table(uid).filter((r) => matches(r, where)),
        orderBy
      );
      if (limit) rows = rows.slice(0, limit);
      return rows.map((r) => {
        const out = pick(r, select);
        if (populate)
          for (const rel of Array.isArray(populate) ? populate : Object.keys(populate))
            out[rel] = r[rel];
        return out;
      });
    },
    async findOne({ where, select, populate } = {}) {
      const [row] = await this.findMany({ where, select, populate });
      return row ?? null;
    },
    async findPage({ where, select, orderBy, page = 1, pageSize = 10 }) {
      const all = await this.findMany({ where, select, orderBy });
      return {
        results: all.slice((page - 1) * pageSize, page * pageSize),
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(all.length / pageSize),
          total: all.length,
        },
      };
    },
    async count({ where } = {}) {
      return table(uid).filter((r) => matches(r, where)).length;
    },
    async create({ data: row }) {
      return insert(uid, row);
    },
    async createMany({ data: rows }) {
      rows.forEach((row) => insert(uid, row));
      return { count: rows.length };
    },
    async updateMany({ where, data: patch }) {
      const rows = table(uid).filter((r) => matches(r, where));
      rows.forEach((r) => Object.assign(r, patch));
      return { count: rows.length };
    },
    async deleteMany({ where }) {
      const keep = table(uid).filter((r) => !matches(r, where));
      const count = table(uid).length - keep.length;
      data.set(uid, keep);
      return { count };
    },
  });

  const documents = (uid) => ({
    async findFirst({ filters, fields }) {
      const row = table(uid).find((r) => matches(r, filters));
      return row ? pick(row, fields) : null;
    },
    async findMany({ filters, fields, sort, start = 0, limit } = {}) {
      calls.queries.push({ uid, op: 'documents.findMany' });
      const rows = sortRows(
        table(uid).filter((r) => matches(r, filters)),
        sort
      );
      return rows.slice(start, limit ? start + limit : undefined).map((r) => pick(r, fields));
    },
    async count({ filters } = {}) {
      return table(uid).filter((r) => matches(r, filters)).length;
    },
    async create({ data: row }) {
      return insert(uid, {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...row,
      });
    },
    async update({ documentId, data: patch }) {
      const row = table(uid).find((r) => r.documentId === documentId);
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      return row;
    },
    async delete({ documentId }) {
      data.set(
        uid,
        table(uid).filter((r) => r.documentId !== documentId)
      );
      return { documentId };
    },
  });

  const storeValues = new Map(Object.entries(store));
  const logs = [];
  const services = {};
  const strapi = {
    data,
    calls,
    logs,
    table,
    insert,
    db: {
      query,
      transaction: async (cb) => cb({}),
      lifecycles: {
        subscribe: (sub) => {
          strapi.subscriber = sub;
          return () => {
            strapi.subscriber = null;
          };
        },
      },
    },
    documents,
    store: () => ({
      get: async ({ key }) => storeValues.get(key),
      set: async ({ key, value }) => storeValues.set(key, value),
      delete: async ({ key }) => storeValues.delete(key),
    }),
    storeValues,
    log: Object.fromEntries(
      ['debug', 'info', 'warn', 'error'].map((level) => [
        level,
        (...args) => logs.push({ level, args }),
      ])
    ),
    admin: {
      services: {
        permission: {
          createMany: async (permissions) =>
            permissions.map((p) => insert('admin::permission', { ...p, role: { id: p.role } })),
          actionProvider: {
            registerMany: async (actions) => {
              strapi.registeredActions = actions;
            },
          },
        },
      },
    },
    hooks: {},
    hook: (name) => ({
      register: (fn) => {
        strapi.hooks[name] = fn;
      },
    }),
    plugin: () => ({ service: (name) => services[name] }),
    services,
  };
  return strapi;
};

module.exports = { createFakeStrapi, matches };
