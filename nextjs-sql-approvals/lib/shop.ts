// The shop database: SQLite (sql.js) in the page, standing in for your own
// database server. The approval steps are the same ones your server runs
// (hibira.io/use-cases/database-write-approvals): reads on a read-only
// connection, a dry run that rolls back to estimate the rows, and the
// approved statement run exactly once.
import initSqlJs, { type Database } from 'sql.js';
import { BASE_PATH } from './demo';

export interface Table {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface Shop {
  /** Runs a read with writes switched off, so a misjudged statement fails instead of writing. */
  read(sql: string): Table;
  /** Runs the statement inside a savepoint and rolls it back: the rows it would change, and the query plan. */
  dryRun(sql: string): { rows: number; plan: string };
  /** Runs an approved change; returns the rows changed. */
  write(sql: string): number;
  counts(): Record<string, number>;
  reset(): void;
}

const SEED = `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, tier TEXT NOT NULL);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), total REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE carts (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), items INTEGER NOT NULL, updated_at TEXT NOT NULL);
INSERT INTO customers (id, name, tier) VALUES
  (1, 'Aiko Tanaka', 'gold'), (2, 'Bao Nguyen', 'silver'), (3, 'Chen Wei', 'gold'), (4, 'Dara Kim', 'standard'),
  (5, 'Emi Sato', 'silver'), (6, 'Farid Rahman', 'standard'), (7, 'Ga-eun Park', 'gold'), (8, 'Hana Lee', 'standard'),
  (9, 'Indra Wijaya', 'silver'), (10, 'Jun Ito', 'standard'), (11, 'Kanya Srisuk', 'gold'), (12, 'Linh Tran', 'standard');
INSERT INTO products (id, name, price, stock) VALUES
  (1, 'Snow boots', 129, 3), (2, 'Wool beanie', 24, 42), (3, 'Down jacket', 219, 7), (4, 'Ski goggles', 89, 2),
  (5, 'Thermal gloves', 35, 18), (6, 'Hand warmers (10)', 12, 4), (7, 'Fleece scarf', 29, 25), (8, 'Snowboard wax', 15, 60);
`;

function seed(db: Database) {
  db.exec(SEED);
  // Orders and carts spread over the last 60 days, the same on every load,
  // off the hour and day marks so a filter's count holds between the dry
  // run and the approved run.
  const statuses = ['pending', 'paid', 'paid', 'shipped', 'shipped', 'delivered', 'delivered', 'refunded'];
  const orders = db.prepare("INSERT INTO orders (customer_id, total, status, created_at) VALUES (?, ?, ?, datetime('now', ?))");
  for (let i = 0; i < 48; i++) {
    const customer = (i * 7) % 12 + 1;
    const total = Math.round((24 + ((i * 53) % 400) + (i % 3) * 0.5) * 100) / 100;
    const status = statuses[(i * 5) % statuses.length];
    orders.run([customer, total, status, `-${((i * 29) % 1440) + 0.5} hours`]);
  }
  orders.free();
  const carts = db.prepare("INSERT INTO carts (customer_id, items, updated_at) VALUES (?, ?, datetime('now', ?))");
  for (let i = 0; i < 26; i++) carts.run([(i * 5) % 12 + 1, 1 + (i % 4), `-${((i * 3) % 60) + 0.25} days`]);
  carts.free();
}

function table(db: Database, sql: string): Table {
  const [res] = db.exec(sql);
  return res ? { columns: res.columns, rows: res.values as Table['rows'] } : { columns: [], rows: [] };
}

export async function openShop(): Promise<Shop> {
  const SQL = await initSqlJs({ locateFile: (file) => `${BASE_PATH}/${file}` });
  let db = new SQL.Database();
  seed(db);
  return {
    read(sql) {
      db.exec('PRAGMA query_only = ON');
      try {
        return table(db, sql);
      } finally {
        db.exec('PRAGMA query_only = OFF');
      }
    },
    dryRun(sql) {
      const plan = table(db, `EXPLAIN QUERY PLAN ${sql}`).rows.map((r) => String(r[r.length - 1])).join('\n');
      db.exec('SAVEPOINT dry_run');
      try {
        db.run(sql);
        return { rows: db.getRowsModified(), plan };
      } finally {
        db.exec('ROLLBACK TO dry_run; RELEASE dry_run');
      }
    },
    write(sql) {
      db.run(sql);
      return db.getRowsModified();
    },
    counts() {
      const out: Record<string, number> = {};
      for (const name of ['orders', 'carts', 'products', 'customers']) out[name] = Number(table(db, `SELECT count(*) FROM ${name}`).rows[0][0]);
      return out;
    },
    reset() {
      db.close();
      db = new SQL.Database();
      seed(db);
    },
  };
}
