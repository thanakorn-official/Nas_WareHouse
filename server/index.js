const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const DEFAULT_STATUSES = [
  { name: 'พร้อมขาย', color: '#18805a', sortOrder: 1 },
  { name: 'พักการขาย', color: '#b36e18', sortOrder: 2 },
  { name: 'รอตรวจสอบ', color: '#1769e0', sortOrder: 3 },
];

const parseId = value => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const normalizeColor = color => {
  const value = typeof color === 'string' ? color.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : null;
};

const parseProductPayload = ({ name, quantity, statusId }) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedQuantity = Number(quantity);
  const normalizedStatusId = Number(statusId);

  if (!normalizedName) return { error: 'กรุณาระบุชื่อสินค้า' };
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 0) {
    return { error: 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' };
  }
  if (!Number.isInteger(normalizedStatusId) || normalizedStatusId < 1) {
    return { error: 'กรุณาเลือกสถานะสินค้า' };
  }

  return { value: { name: normalizedName, quantity: normalizedQuantity, statusId: normalizedStatusId } };
};

const parseStatusPayload = ({ name, color, isActive = true }) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedColor = normalizeColor(color);

  if (!normalizedName) return { error: 'กรุณาระบุชื่อสถานะ' };
  if (normalizedName.length > 50) return { error: 'ชื่อสถานะต้องไม่เกิน 50 ตัวอักษร' };
  if (!normalizedColor) return { error: 'สีสถานะต้องเป็นรหัส Hex เช่น #1769E0' };

  return { value: { name: normalizedName, color: normalizedColor, isActive: Boolean(isActive) } };
};

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      quantity INT NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS statuses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      color VARCHAR(7) NOT NULL DEFAULT '#1769E0',
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const columns = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products' AND column_name IN ('price', 'status_id')
  `);
  const existingColumns = new Set(columns.rows.map(row => row.column_name));
  if (!existingColumns.has('status_id')) await pool.query('ALTER TABLE products ADD COLUMN status_id INT');
  if (existingColumns.has('price')) await pool.query('ALTER TABLE products DROP COLUMN IF EXISTS price');

  for (const status of DEFAULT_STATUSES) {
    await pool.query(
      `INSERT INTO statuses (name, color, sort_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [status.name, status.color, status.sortOrder],
    );
  }

  const defaultStatus = await pool.query('SELECT id FROM statuses ORDER BY sort_order, id LIMIT 1');
  if (defaultStatus.rows.length === 0) throw new Error('No product status is available');
  await pool.query('UPDATE products SET status_id = $1 WHERE status_id IS NULL', [defaultStatus.rows[0].id]);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_status_id_fkey') THEN
        ALTER TABLE products ADD CONSTRAINT products_status_id_fkey
          FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE RESTRICT;
      END IF;
    END $$;
  `);
  await pool.query('ALTER TABLE products ALTER COLUMN status_id SET NOT NULL');
}

const productSelect = `
  SELECT p.id, p.name, p.quantity,
    json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'isActive', s.is_active) AS status
  FROM products p JOIN statuses s ON s.id = p.status_id
`;

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`${productSelect} ORDER BY p.id DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
  }
});

app.post('/api/products', async (req, res) => {
  const parsed = parseProductPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { name, quantity, statusId } = parsed.value;
    const result = await pool.query(
      `INSERT INTO products (name, quantity, status_id)
       SELECT $1, $2, id FROM statuses WHERE id = $3 AND is_active = TRUE RETURNING id`,
      [name, quantity, statusId],
    );
    if (!result.rowCount) return res.status(400).json({ error: 'สถานะนี้ไม่พร้อมใช้งาน' });
    const product = await pool.query(`${productSelect} WHERE p.id = $1`, [result.rows[0].id]);
    return res.status(201).json(product.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถเพิ่มสินค้าได้' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = parseProductPayload(req.body);
  if (!id) return res.status(400).json({ error: 'รหัสสินค้าไม่ถูกต้อง' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { name, quantity, statusId } = parsed.value;
    const result = await pool.query(
      `UPDATE products SET name = $1, quantity = $2, status_id = $3
       WHERE id = $4 AND EXISTS (SELECT 1 FROM statuses WHERE id = $3 AND is_active = TRUE) RETURNING id`,
      [name, quantity, statusId, id],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'ไม่พบสินค้าหรือสถานะไม่พร้อมใช้งาน' });
    const product = await pool.query(`${productSelect} WHERE p.id = $1`, [id]);
    return res.json(product.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขสินค้าได้' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'รหัสสินค้าไม่ถูกต้อง' });
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'ไม่พบสินค้าที่ต้องการลบ' });
    return res.json({ id, message: 'ลบสินค้าเรียบร้อยแล้ว' });
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถลบสินค้าได้' });
  }
});

app.get('/api/statuses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.color, s.sort_order AS "sortOrder", s.is_active AS "isActive",
        COUNT(p.id)::int AS "productCount"
      FROM statuses s LEFT JOIN products p ON p.status_id = s.id
      GROUP BY s.id ORDER BY s.sort_order, s.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ไม่สามารถโหลดสถานะได้' });
  }
});

app.post('/api/statuses', async (req, res) => {
  const parsed = parseStatusPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { name, color, isActive } = parsed.value;
    const result = await pool.query(
      `INSERT INTO statuses (name, color, sort_order, is_active)
       VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM statuses), 1), $3)
       RETURNING id, name, color, sort_order AS "sortOrder", is_active AS "isActive"`,
      [name, color, isActive],
    );
    return res.status(201).json({ ...result.rows[0], productCount: 0 });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'มีชื่อสถานะนี้แล้ว' });
    return res.status(500).json({ error: 'ไม่สามารถเพิ่มสถานะได้' });
  }
});

app.put('/api/statuses/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = parseStatusPayload(req.body);
  if (!id) return res.status(400).json({ error: 'รหัสสถานะไม่ถูกต้อง' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { name, color, isActive } = parsed.value;
    if (!isActive) {
      const usage = await pool.query('SELECT COUNT(*)::int AS count FROM products WHERE status_id = $1', [id]);
      if (usage.rows[0].count > 0) return res.status(409).json({ error: 'ไม่สามารถปิดสถานะที่มีสินค้าใช้งานอยู่ได้' });
    }
    const result = await pool.query(
      `UPDATE statuses SET name = $1, color = $2, is_active = $3 WHERE id = $4
       RETURNING id, name, color, sort_order AS "sortOrder", is_active AS "isActive"`,
      [name, color, isActive, id],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'ไม่พบสถานะที่ต้องการแก้ไข' });
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM products WHERE status_id = $1', [id]);
    return res.json({ ...result.rows[0], productCount: count.rows[0].count });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'มีชื่อสถานะนี้แล้ว' });
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขสถานะได้' });
  }
});

app.delete('/api/statuses/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'รหัสสถานะไม่ถูกต้อง' });
  try {
    const usage = await pool.query('SELECT COUNT(*)::int AS count FROM products WHERE status_id = $1', [id]);
    if (usage.rows[0].count > 0) return res.status(409).json({ error: 'ไม่สามารถลบสถานะที่มีสินค้าใช้งานอยู่ได้' });
    const result = await pool.query('DELETE FROM statuses WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'ไม่พบสถานะที่ต้องการลบ' });
    return res.json({ id, message: 'ลบสถานะเรียบร้อยแล้ว' });
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถลบสถานะได้' });
  }
});

const PORT = process.env.PORT || 5000;
initializeDatabase()
  .then(() => app.listen(PORT, () => console.log(`Nas_WareHouse Server running on port ${PORT}`)))
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
