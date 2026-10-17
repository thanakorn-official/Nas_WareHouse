const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('node:crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

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
const ROLES = ['owner', 'manager', 'employee'];
const TOKEN_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

const signToken = memberId => {
  const payload = Buffer.from(JSON.stringify({ sub: memberId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifyToken = token => {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isInteger(decoded.sub) && decoded.exp > Math.floor(Date.now() / 1000) ? decoded.sub : null;
  } catch {
    return null;
  }
};

const hashPassword = password => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const passwordMatches = (password, stored) => {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const publicMember = row => ({
  id: row.id,
  fullName: row.full_name,
  username: row.username,
  role: row.role,
  isActive: row.is_active,
  createdAt: row.created_at,
});

const parseMemberPayload = (body = {}, { creating = false } = {}) => {
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!fullName || fullName.length > 120) return { error: 'กรุณาระบุชื่อสมาชิกไม่เกิน 120 ตัวอักษร' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{2,49}$/u.test(username)) return { error: 'ชื่อผู้ใช้ต้องยาว 3–50 ตัว และใช้ตัวอักษร ตัวเลข จุด ขีดล่าง หรือขีดกลาง' };
  if (!ROLES.includes(role)) return { error: 'กรุณาเลือกบทบาทสมาชิกให้ถูกต้อง' };
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') return { error: 'สถานะบัญชีสมาชิกไม่ถูกต้อง' };
  if (creating && password.length < 8) return { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' };
  if (!creating && password && password.length < 8) return { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' };
  return { value: { fullName, username, role, password, isActive: body.isActive !== false } };
};

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const memberId = verifyToken(token);
  if (!memberId) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
  try {
    const result = await pool.query('SELECT id, full_name, username, role, is_active, created_at FROM members WHERE id = $1', [memberId]);
    const member = result.rows[0];
    if (!member || !member.is_active) return res.status(401).json({ error: 'บัญชีนี้ถูกปิดใช้งานหรือไม่พบสมาชิก' });
    req.member = publicMember(member);
    next();
  } catch (error) {
    return res.status(500).json({ error: 'ไม่สามารถตรวจสอบสิทธิ์สมาชิกได้' });
  }
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.member || !roles.includes(req.member.role)) return res.status(403).json({ error: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้' });
  next();
};

const parseId = value => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const normalizeColor = color => {
  const value = typeof color === 'string' ? color.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : null;
};

const parseProductPayload = ({ name, quantity, statusId, projectId, customFields = {}, tags = [] }, { allowZeroQuantity = false, allowLargeQuantity = false } = {}) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedQuantity = Number(quantity);
  const normalizedStatusId = Number(statusId);
  const normalizedProjectId = Number(projectId);
  const normalizedTags = Array.isArray(tags)
    ? [...new Set(tags.map(tag => String(tag).trim()).filter(Boolean))].slice(0, 50)
    : null;
  const normalizedCustomFields = customFields && typeof customFields === 'object' && !Array.isArray(customFields)
    ? Object.fromEntries(Object.entries(customFields)
      .map(([key, value]) => [String(key).trim().slice(0, 80), String(value ?? '').trim().slice(0, 1000)])
      .filter(([key, value]) => key && value))
    : null;

  if (!normalizedName) return { error: 'กรุณาระบุชื่อสินค้า' };
  if (normalizedName.length > 100) return { error: 'ชื่อสินค้าต้องไม่เกิน 100 ตัวอักษร' };
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < (allowZeroQuantity ? 0 : 1) || (!allowLargeQuantity && normalizedQuantity > 500)) {
    return { error: 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' };
  }
  if (!Number.isInteger(normalizedProjectId) || normalizedProjectId < 1) return { error: 'กรุณาเลือกโปรเจคสินค้า' };
  if (!Number.isInteger(normalizedStatusId) || normalizedStatusId < 1) {
    return { error: 'กรุณาเลือกสถานะสินค้า' };
  }
  if (!normalizedTags || normalizedTags.some(tag => tag.length > 60)) return { error: 'แท็กสินค้าไม่ถูกต้อง (ไม่เกิน 60 ตัวอักษรต่อแท็ก)' };
  if (!normalizedCustomFields || Object.keys(normalizedCustomFields).length > 50) return { error: 'Custom Fields ไม่ถูกต้อง (เพิ่มได้ไม่เกิน 50 ช่อง)' };

  return { value: { name: normalizedName, quantity: normalizedQuantity, statusId: normalizedStatusId, projectId: normalizedProjectId, customFields: normalizedCustomFields, tags: normalizedTags } };
};

const parseStatusPayload = ({ name, color, isActive = true }) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedColor = normalizeColor(color);

  if (!normalizedName) return { error: 'กรุณาระบุชื่อสถานะ' };
  if (normalizedName.length > 50) return { error: 'ชื่อสถานะต้องไม่เกิน 50 ตัวอักษร' };
  if (!normalizedColor) return { error: 'สีสถานะต้องเป็นรหัส Hex เช่น #1769E0' };

  return { value: { name: normalizedName, color: normalizedColor, isActive: Boolean(isActive) } };
};

const parseProjectPayload = ({ code, name }) => {
  const normalizedCode = typeof code === 'string' ? code.trim().toLowerCase() : '';
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!/^[a-z0-9][a-z0-9_-]{0,19}$/.test(normalizedCode)) return { error: 'รหัสโปรเจคต้องมี 1–20 ตัว ใช้ a-z, 0-9, ขีดกลาง หรือขีดล่าง' };
  if (!normalizedName || normalizedName.length > 120) return { error: 'กรุณาระบุชื่อโปรเจคไม่เกิน 120 ตัวอักษร' };
  return { value: { code: normalizedCode, name: normalizedName } };
};

const publicProject = row => ({
  id: row.id,
  code: row.code,
  name: row.name,
  productCount: row.productCount ?? 0,
  createdAt: row.createdAt,
  createdBy: row.createdBy ?? null,
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      username VARCHAR(50),
      email VARCHAR(255) UNIQUE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'employee')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('ALTER TABLE members ADD COLUMN IF NOT EXISTS username VARCHAR(50)');
  await pool.query('ALTER TABLE members ALTER COLUMN email DROP NOT NULL');
  await pool.query("UPDATE members SET username = 'member_' || id::text WHERE username IS NULL OR BTRIM(username) = ''");
  await pool.query('ALTER TABLE members ALTER COLUMN username SET NOT NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS members_username_unique_idx ON members (username)');
  await pool.query('ALTER TABLE members DROP CONSTRAINT IF EXISTS members_role_check');
  await pool.query("UPDATE members SET role = CASE role WHEN 'admin' THEN 'owner' WHEN 'staff' THEN 'employee' ELSE role END WHERE role IN ('admin', 'staff')");
  await pool.query("ALTER TABLE members ADD CONSTRAINT members_role_check CHECK (role IN ('owner', 'manager', 'employee'))");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      quantity INT NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      next_product_number INT NOT NULL DEFAULT 1,
      created_by INT REFERENCES members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    WHERE table_name = 'products' AND column_name IN ('price', 'status_id', 'project_id')
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
  const existingProducts = existingColumns.has('project_id')
    ? await pool.query('SELECT EXISTS (SELECT 1 FROM products WHERE project_id IS NULL) AS needed')
    : await pool.query('SELECT EXISTS (SELECT 1 FROM products) AS needed');
  let defaultProjectId = null;
  if (existingProducts.rows[0].needed) {
    const defaultProject = await pool.query(
      `INSERT INTO projects (code, name) VALUES ('main', 'คลังหลัก')
       ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id`,
    );
    defaultProjectId = defaultProject.rows[0].id;
  }
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS project_id INT REFERENCES projects(id) ON DELETE RESTRICT');
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(40)');
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]');
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS added_by INT REFERENCES members(id) ON DELETE SET NULL');
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await pool.query(
    'UPDATE products SET project_id = $1 WHERE project_id IS NULL',
    [defaultProjectId],
  );
  await pool.query(
    `UPDATE products p SET product_code = pr.code || '-' || LPAD(p.id::text, 4, '0')
     FROM projects pr WHERE pr.id = p.project_id AND p.product_code IS NULL`,
  );
  await pool.query('ALTER TABLE products ALTER COLUMN project_id SET NOT NULL');
  await pool.query('ALTER TABLE products ALTER COLUMN product_code SET NOT NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS products_project_code_unique_idx ON products(project_id, product_code)');
  await pool.query(
    `UPDATE projects pr SET next_product_number = GREATEST(pr.next_product_number,
      COALESCE((SELECT MAX(p.id) + 1 FROM products p WHERE p.project_id = pr.id), 1))`,
  );
}

const productSelect = `
  SELECT p.id, p.name, p.quantity, p.product_code AS "productCode",
    p.project_id AS "projectId", pr.code AS "projectCode", p.custom_fields AS "customFields", p.tags,
    p.created_at AS "createdAt", p.added_by AS "addedById", m.full_name AS "addedBy",
    json_build_object('id', s.id, 'name', s.name, 'color', s.color, 'isActive', s.is_active) AS status
  FROM products p JOIN statuses s ON s.id = p.status_id
  JOIN projects pr ON pr.id = p.project_id
  LEFT JOIN members m ON m.id = p.added_by
`;

app.get('/api/auth/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT EXISTS (SELECT 1 FROM members) AS "setupComplete"');
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'ไม่สามารถตรวจสอบสถานะระบบสมาชิกได้' });
  }
});

app.post('/api/auth/setup', async (req, res) => {
  const parsed = parseMemberPayload({ ...(req.body || {}), role: 'owner' }, { creating: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(68120419)');
    const existing = await client.query('SELECT id FROM members LIMIT 1');
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ระบบมีผู้ดูแลแล้ว กรุณาเข้าสู่ระบบ' });
    }
    const { fullName, username, password } = parsed.value;
    const created = await client.query(
      `INSERT INTO members (full_name, username, role, password_hash)
       VALUES ($1, $2, 'owner', $3)
       RETURNING id, full_name, username, role, is_active, created_at`,
      [fullName, username, hashPassword(password)],
    );
    await client.query('COMMIT');
    const user = publicMember(created.rows[0]);
    return res.status(201).json({ token: signToken(user.id), user });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีในระบบแล้ว' });
    return res.status(500).json({ error: 'ไม่สามารถสร้างบัญชีผู้ดูแลได้' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  try {
    const result = await pool.query(
      `SELECT id, full_name, username, email, role, is_active, password_hash, created_at
       FROM members WHERE username = $1 OR email = $1
       ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END LIMIT 1`,
      [username],
    );
    const member = result.rows[0];
    if (!member || !member.is_active || !passwordMatches(password, member.password_hash)) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกปิดใช้งาน' });
    }
    const user = publicMember(member);
    return res.json({ token: signToken(user.id), user });
  } catch (error) {
    return res.status(500).json({ error: 'ไม่สามารถเข้าสู่ระบบได้' });
  }
});

app.use('/api', requireAuth);

app.get('/api/auth/me', (req, res) => res.json(req.member));

app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.code, pr.name, pr.created_at AS "createdAt", m.full_name AS "createdBy",
        COUNT(p.id)::int AS "productCount"
      FROM projects pr LEFT JOIN products p ON p.project_id = pr.id
      LEFT JOIN members m ON m.id = pr.created_by
      GROUP BY pr.id, m.full_name ORDER BY pr.created_at DESC, pr.id DESC
    `);
    return res.json(result.rows.map(publicProject));
  } catch (error) {
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการโปรเจคได้' });
  }
});

app.post('/api/projects', requireRoles('owner', 'manager'), async (req, res) => {
  const parsed = parseProjectPayload(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { code, name } = parsed.value;
    const result = await pool.query(
      `INSERT INTO projects (code, name, created_by) VALUES ($1, $2, $3)
       RETURNING id, code, name, created_at AS "createdAt"`,
      [code, name, req.member.id],
    );
    return res.status(201).json(publicProject(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'รหัสโปรเจคนี้มีในระบบแล้ว' });
    return res.status(500).json({ error: 'ไม่สามารถสร้างโปรเจคได้' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'รหัสโปรเจคไม่ถูกต้อง' });
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.code, pr.name, pr.created_at AS "createdAt", m.full_name AS "createdBy",
        COUNT(p.id)::int AS "productCount"
      FROM projects pr LEFT JOIN products p ON p.project_id = pr.id
      LEFT JOIN members m ON m.id = pr.created_by
      WHERE pr.id = $1 GROUP BY pr.id, m.full_name
    `, [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'ไม่พบโปรเจคนี้' });
    return res.json(publicProject(result.rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลโปรเจคได้' });
  }
});

app.get('/api/members', requireRoles('owner'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, username, role, is_active, created_at FROM members ORDER BY created_at DESC, id DESC',
    );
    return res.json(result.rows.map(publicMember));
  } catch (error) {
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายชื่อสมาชิกได้' });
  }
});

app.post('/api/members', requireRoles('owner'), async (req, res) => {
  const parsed = parseMemberPayload(req.body, { creating: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { fullName, username, role, password, isActive } = parsed.value;
    const result = await pool.query(
      `INSERT INTO members (full_name, username, role, is_active, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, username, role, is_active, created_at`,
      [fullName, username, role, isActive, hashPassword(password)],
    );
    return res.status(201).json(publicMember(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีในระบบแล้ว' });
    return res.status(500).json({ error: 'ไม่สามารถเพิ่มสมาชิกได้' });
  }
});

app.put('/api/members/:id', requireRoles('owner'), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = parseMemberPayload(req.body);
  if (!id) return res.status(400).json({ error: 'รหัสสมาชิกไม่ถูกต้อง' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (id === req.member.id && (parsed.value.role !== req.member.role || !parsed.value.isActive)) {
    return res.status(409).json({ error: 'ไม่สามารถลดสิทธิ์หรือปิดใช้งานบัญชีของตัวเองได้' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(68120419)');
    const currentResult = await client.query('SELECT role, is_active FROM members WHERE id = $1 FOR UPDATE', [id]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ไม่พบสมาชิกที่ต้องการแก้ไข' });
    }
    if (current.role === 'owner' && current.is_active && (parsed.value.role !== 'owner' || !parsed.value.isActive)) {
      const remaining = await client.query("SELECT COUNT(*)::int AS count FROM members WHERE role = 'owner' AND is_active = TRUE AND id <> $1", [id]);
      if (remaining.rows[0].count === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'ระบบต้องมีผู้ดูแลที่ใช้งานได้อย่างน้อยหนึ่งบัญชี' });
      }
    }
    const { fullName, username, role, password, isActive } = parsed.value;
    const values = [fullName, username, role, isActive, id];
    const passwordSql = password ? ', password_hash = $6' : '';
    if (password) values.push(hashPassword(password));
    const result = await client.query(
      `UPDATE members SET full_name = $1, username = $2, role = $3, is_active = $4,
       updated_at = NOW()${passwordSql} WHERE id = $5
       RETURNING id, full_name, username, role, is_active, created_at`,
      values,
    );
    await client.query('COMMIT');
    return res.json(publicMember(result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีในระบบแล้ว' });
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขสมาชิกได้' });
  } finally {
    client.release();
  }
});

app.delete('/api/members/:id', requireRoles('owner'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'รหัสสมาชิกไม่ถูกต้อง' });
  if (id === req.member.id) return res.status(409).json({ error: 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(68120419)');
    const currentResult = await client.query('SELECT role, is_active FROM members WHERE id = $1 FOR UPDATE', [id]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ไม่พบสมาชิกที่ต้องการปิดใช้งาน' });
    }
    if (current.role === 'owner' && current.is_active) {
      const remaining = await client.query("SELECT COUNT(*)::int AS count FROM members WHERE role = 'owner' AND is_active = TRUE AND id <> $1", [id]);
      if (remaining.rows[0].count === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'ระบบต้องมีผู้ดูแลที่ใช้งานได้อย่างน้อยหนึ่งบัญชี' });
      }
    }
    await client.query('UPDATE members SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]);
    await client.query('COMMIT');
    return res.json({ id, message: 'ปิดใช้งานสมาชิกเรียบร้อยแล้ว' });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'ไม่สามารถปิดใช้งานสมาชิกได้' });
  } finally {
    client.release();
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const projectId = req.query.projectId === undefined ? null : parseId(req.query.projectId);
    if (req.query.projectId !== undefined && !projectId) return res.status(400).json({ error: 'รหัสโปรเจคไม่ถูกต้อง' });
    const result = await pool.query(
      `${productSelect}${projectId ? ' WHERE p.project_id = $1' : ''} ORDER BY p.id DESC`,
      projectId ? [projectId] : [],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
  }
});

app.post('/api/products', requireRoles('owner', 'manager', 'employee'), async (req, res) => {
  const parsed = parseProductPayload(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query('SELECT id, code, next_product_number FROM projects WHERE id = $1 FOR UPDATE', [parsed.value.projectId]);
    if (!project.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '??????????????' });
    }
    const { name, quantity: count, statusId, customFields, tags } = parsed.value;
    let nextNumber = project.rows[0].next_product_number;
    const createdIds = [];
    for (let index = 0; index < count; index += 1) {
      const productCode = `${project.rows[0].code}-${String(nextNumber).padStart(4, '0')}`;
      const inserted = await client.query(
        `INSERT INTO products (project_id, product_code, name, quantity, status_id, custom_fields, tags, added_by)
         SELECT $1, $2, $3, 1, id, $5::jsonb, $6::text[], $7 FROM statuses WHERE id = $4 AND is_active = TRUE
         RETURNING id`,
        [parsed.value.projectId, productCode, name, statusId, JSON.stringify(customFields), tags, req.member.id],
      );
      if (!inserted.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '??????????????????????' });
      }
      createdIds.push(inserted.rows[0].id);
      nextNumber += 1;
    }
    await client.query('UPDATE projects SET next_product_number = $1 WHERE id = $2', [nextNumber, parsed.value.projectId]);
    const products = await client.query(`${productSelect} WHERE p.id = ANY($1::int[]) ORDER BY p.id`, [createdIds]);
    await client.query('COMMIT');
    return res.status(201).json({ createdCount: products.rowCount, products: products.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: '???????????????????????' });
  } finally {
    client.release();
  }
});

app.post('/api/projects/:id/products/import', requireRoles('owner', 'manager', 'employee'), async (req, res) => {
  const projectId = parseId(req.params.id);
  if (!projectId) return res.status(400).json({ error: 'รหัสโปรเจคไม่ถูกต้อง' });
  if (!Array.isArray(req.body?.items) || req.body.items.length < 1 || req.body.items.length > 500) {
    return res.status(400).json({ error: 'ไฟล์นำเข้าต้องมีสินค้า 1–500 รายการต่อครั้ง' });
  }
  const parsedItems = req.body.items.map(item => parseProductPayload({ ...item, projectId }));
  const invalidIndex = parsedItems.findIndex(item => item.error);
  if (invalidIndex !== -1) return res.status(400).json({ error: `แถวที่ ${invalidIndex + 2}: ${parsedItems[invalidIndex].error}` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query('SELECT id, code, next_product_number FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
    if (!project.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ไม่พบโปรเจคนี้' });
    }
    let nextNumber = project.rows[0].next_product_number;
    const createdIds = [];
    for (const { value } of parsedItems) {
      for (let copy = 0; copy < value.quantity; copy += 1) {
        const productCode = `${project.rows[0].code}-${String(nextNumber).padStart(4, '0')}`;
        const inserted = await client.query(
          `INSERT INTO products (project_id, product_code, name, quantity, status_id, custom_fields, tags, added_by)
           SELECT $1, $2, $3, 1, id, $5::jsonb, $6::text[], $7 FROM statuses WHERE id = $4 AND is_active = TRUE
           RETURNING id`,
          [projectId, productCode, value.name, value.statusId, JSON.stringify(value.customFields), value.tags, req.member.id],
        );
        if (!inserted.rowCount) throw new Error('inactive-status');
        createdIds.push(inserted.rows[0].id);
        nextNumber += 1;
      }
    }
    await client.query('UPDATE projects SET next_product_number = $1 WHERE id = $2', [nextNumber, projectId]);
    const products = await client.query(`${productSelect} WHERE p.id = ANY($1::int[]) ORDER BY p.id`, [createdIds]);
    await client.query('COMMIT');
    return res.status(201).json({ importedCount: products.rowCount, products: products.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: error.message.startsWith('สถานะสินค้าในรายการ') ? error.message : 'ไม่สามารถนำเข้าสินค้าได้' });
  } finally {
    client.release();
  }
});

app.put('/api/products/:id', requireRoles('owner', 'manager', 'employee'), async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = parseProductPayload(req.body || {}, { allowZeroQuantity: true, allowLargeQuantity: true });
  if (!id) return res.status(400).json({ error: 'รหัสสินค้าไม่ถูกต้อง' });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { name, quantity, statusId, customFields, tags } = parsed.value;
    const result = await pool.query(
      `UPDATE products SET name = $1, quantity = $2, status_id = $3, custom_fields = $4::jsonb, tags = $5
       WHERE id = $6 AND EXISTS (SELECT 1 FROM statuses s WHERE s.id = $3 AND (s.is_active OR EXISTS (SELECT 1 FROM products current_product WHERE current_product.id = $6 AND current_product.status_id = s.id))) RETURNING id`,
      [name, quantity, statusId, JSON.stringify(customFields), tags, id],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'ไม่พบสินค้าหรือสถานะไม่พร้อมใช้งาน' });
    const product = await pool.query(`${productSelect} WHERE p.id = $1`, [id]);
    return res.json(product.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขสินค้าได้' });
  }
});

app.delete('/api/products/:id', requireRoles('owner', 'manager'), async (req, res) => {
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

app.post('/api/statuses', requireRoles('owner'), async (req, res) => {
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

app.put('/api/statuses/:id', requireRoles('owner'), async (req, res) => {
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

app.delete('/api/statuses/:id', requireRoles('owner'), async (req, res) => {
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
