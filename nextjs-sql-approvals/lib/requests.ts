// The ready-made requests. The hosted demo's backend (examples-infra,
// demo-api) keeps the same statements by id and only sends those for
// approval, so the demo cannot put arbitrary text on an approval page.
// Running the example yourself, any statement can be sent.

export interface Suggestion {
  id: string;
  sql: string;
}

export const SUGGESTIONS: Suggestion[] = [
  { id: 'orders-by-status', sql: 'SELECT status, count(*) AS orders, round(sum(total), 2) AS revenue\nFROM orders\nGROUP BY status\nORDER BY orders DESC' },
  {
    id: 'top-customers',
    sql: 'SELECT c.name, c.tier, round(sum(o.total), 2) AS spent\nFROM orders o JOIN customers c ON c.id = o.customer_id\nGROUP BY c.id\nORDER BY spent DESC\nLIMIT 5',
  },
  { id: 'idle-carts', sql: "DELETE FROM carts\nWHERE updated_at < datetime('now', '-30 days')" },
  { id: 'ship-paid', sql: "UPDATE orders SET status = 'shipped'\nWHERE status = 'paid' AND created_at < datetime('now', '-2 days')" },
  {
    id: 'gold-discount',
    sql: "UPDATE orders SET total = round(total * 0.9, 2)\nWHERE status = 'pending'\n  AND customer_id IN (SELECT id FROM customers WHERE tier = 'gold')",
  },
  { id: 'restock', sql: 'UPDATE products SET stock = stock + 20\nWHERE stock < 5' },
];
