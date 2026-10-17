import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import readXlsxFile from 'read-excel-file/browser';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EMPTY_PRODUCT = { name: '', quantity: '1', statusId: '', projectId: '', customFields: [{ key: '', value: '' }], tags: [], tagInput: '' };
const EMPTY_PROJECT = { code: '', name: '' };
const EMPTY_STATUS = { name: '', color: '#1769E0', isActive: true };
const EMPTY_MEMBER = { fullName: '', username: '', role: 'employee', password: '', isActive: true };
const ROLE_META = {
  owner: { label: 'Owner', description: 'จัดการโปรเจค สมาชิก สินค้า และสถานะทั้งหมด' },
  manager: { label: 'Manager', description: 'สร้างโปรเจค และดู เพิ่ม แก้ไข ลบสินค้า พร้อมดูสถานะสินค้า' },
  employee: { label: 'Employee', description: 'ดู เพิ่ม และแก้ไขสินค้า พร้อมดูสถานะสินค้า' },
};

const savedToken = window.localStorage.getItem('nas-warehouse-token');
if (savedToken) axios.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
else delete axios.defaults.headers.common.Authorization;

axios.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && window.localStorage.getItem('nas-warehouse-token')) {
    window.dispatchEvent(new Event('nas:session-expired'));
  }
  return Promise.reject(error);
});

const getErrorMessage = error => error.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
const pageFromHash = hash => (hash.startsWith('#/projects/') ? 'project-detail' : hash === '#/members' ? 'members' : hash === '#/statuses' ? 'statuses' : hash === '#/roles' ? 'roles' : 'projects');
const projectIdFromHash = hash => {
  const id = Number(hash.match(/^#\/projects\/(\d+)/)?.[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

function Icon({ name, size = 20 }) {
  const paths = {
    box: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    edit: <><path d="m4 16-.8 4.8L8 20l11.5-11.5-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
    trash: <><path d="M4 7h16M10 11v5M14 11v5" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    package: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 4-6" /></>,
    warning: <><path d="m12 4 9 16H3L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1M4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1M15 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1-.1M9 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1M4.6 15l-.1.1a2 2 0 1 0 2.8 2.8l-.1-.1M19.4 9l-.1-.1a2 2 0 1 0-2.8-2.8l-.1.1M9 4.6l-.1-.1a2 2 0 1 0-2.8-2.8l.1.1M15 19.4l.1.1a2 2 0 1 0-2.8-2.8l-.1-.1" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    members: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14a5.7 5.7 0 0 1 3.5 5.3" /></>,
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function StatusBadge({ status }) {
  return <span className="stock-badge" style={{ '--status-color': status?.color || '#1769E0' }}><span />{status?.name || 'ไม่ระบุ'}</span>;
}

function ProductTable({ products, loading, searchTerm, onSearchChange, onEdit, onDelete, deletingId, canDelete = true }) {
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? products.filter(product => [product.name, product.productCode, ...(product.tags || [])].some(value => String(value || '').toLowerCase().includes(query))) : products;
  }, [products, searchTerm]);

  return <section className="products-panel"><div className="panel-heading"><div><h2>รายการสินค้า</h2><p>จัดการข้อมูลสินค้าและสถานะในคลัง</p></div><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">ค้นหาสินค้า</span><input type="search" value={searchTerm} onChange={onSearchChange} placeholder="ค้นหาชื่อ รหัสสินค้า หรือแท็ก..." /></label></div><div className="table-wrap"><table className="products-table project-products-table"><caption className="sr-only">รายการสินค้าในโปรเจค</caption><thead><tr><th>สินค้า</th><th>จำนวน</th><th>สถานะ</th><th>Tags / Custom Fields</th><th>เพิ่มโดย / เมื่อ</th><th>การจัดการ</th></tr></thead><tbody>{loading && <tr><td className="table-message" colSpan="6"><span className="spinner" />กำลังโหลดข้อมูล...</td></tr>}{!loading && filteredProducts.length === 0 && <tr><td className="table-message" colSpan="6">{searchTerm ? 'ไม่พบสินค้าที่ตรงกับคำค้นหา' : 'ยังไม่มีสินค้าในโปรเจคนี้'}</td></tr>}{!loading && filteredProducts.map(product => <tr key={product.id}><td data-label="สินค้า"><div className="product-name"><span className="product-avatar"><Icon name="box" size={16} /></span><span><strong>{product.name}</strong><small>{product.productCode || `#${product.id}`}</small></span></div></td><td data-label="จำนวน"><strong>{Number(product.quantity).toLocaleString('th-TH')}</strong> ชิ้น</td><td data-label="สถานะ"><StatusBadge status={product.status} /></td><td data-label="Tags / Custom Fields"><div className="product-extra">{(product.tags || []).map(tag => <span className="product-tag" key={tag}>{tag}</span>)}{Object.entries(product.customFields || {}).map(([key, value]) => <span className="product-custom-field" key={key}><strong>{key}:</strong> {value}</span>)}</div></td><td data-label="เพิ่มโดย / เมื่อ"><span className="product-created"><strong>{product.addedBy || '—'}</strong><small>{product.createdAt ? new Date(product.createdAt).toLocaleString('th-TH') : '—'}</small></span></td><td data-label="การจัดการ"><div className="row-actions"><button className="icon-button icon-button--edit" type="button" onClick={() => onEdit(product)} aria-label={`แก้ไข ${product.name}`}><Icon name="edit" size={17} /></button>{canDelete && <button className="icon-button icon-button--delete" type="button" onClick={() => onDelete(product)} disabled={deletingId === product.id} aria-label={`ลบ ${product.name}`}><Icon name="trash" size={17} /></button>}</div></td></tr>)}</tbody></table></div><div className="panel-footer">แสดง {filteredProducts.length.toLocaleString('th-TH')} จาก {products.length.toLocaleString('th-TH')} รายการ</div></section>;
}

function StatusPieChart({ products, statuses, loading }) {
  const statusCounts = statuses.map(status => ({
    ...status,
    count: products.filter(product => String(product.status?.id) === String(status.id)).length,
  }));
  const total = statusCounts.reduce((sum, status) => sum + status.count, 0);
  let currentAngle = 0;
  const segments = statusCounts.filter(status => status.count > 0).map(status => {
    const start = currentAngle;
    currentAngle += (status.count / total) * 360;
    return `${status.color || '#aeb8c5'} ${start}deg ${currentAngle}deg`;
  });
  const chartStyle = {
    background: total ? `conic-gradient(${segments.join(', ')})` : '#e9eef5',
  };

  return <section className="status-chart-panel" aria-labelledby="status-chart-title">
    <div className="panel-heading">
      <div><h2 id="status-chart-title">สัดส่วนสินค้าตามสถานะ</h2><p>จำนวนรายการสินค้าแยกตามสถานะที่ตั้งค่าไว้</p></div>
    </div>
    <div className="status-chart-content">
      <div className="status-donut" style={chartStyle} role="img" aria-label={`สินค้า ${total} รายการ แบ่งตาม ${statusCounts.length} สถานะ`}>
        <div className="status-donut__center"><strong>{loading ? '…' : total.toLocaleString('th-TH')}</strong><span>รายการ</span></div>
      </div>
      <div className="status-chart-legend" aria-label="รายละเอียดจำนวนสินค้าตามสถานะ">
        {statusCounts.map(status => <div className="status-chart-legend__item" key={status.id}>
          <span className="status-chart-legend__swatch" style={{ background: status.color || '#aeb8c5' }} />
          <span className="status-chart-legend__name">{status.name}</span>
          <strong>{loading ? '—' : status.count.toLocaleString('th-TH')}</strong>
          <small>{total ? `${Math.round((status.count / total) * 100)}%` : '0%'}</small>
        </div>)}
        {!loading && statuses.length === 0 && <p className="status-chart-empty">ยังไม่มีสถานะในระบบ</p>}
      </div>
    </div>
  </section>;
}

function ProjectsPage({ projects, loading, canCreate, onCreate, onOpen }) {
  return <><section className="welcome-section"><div><p className="eyebrow">พื้นที่ทำงาน</p><h1>โปรเจค</h1><p className="welcome-copy">เลือกโปรเจคเพื่อดูและจัดการสินค้าในพื้นที่นั้น</p></div>{canCreate && <button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> สร้างโปรเจคใหม่</button>}</section><section className="project-grid" aria-label="รายการโปรเจค">{loading && <p className="table-message">กำลังโหลดโปรเจค...</p>}{!loading && projects.map(project => <button className="project-card" key={project.id} type="button" onClick={() => onOpen(project)}><span className="project-card__icon"><Icon name="package" size={21} /></span><span className="project-card__body"><strong>{project.name}</strong><small>รหัสโปรเจค {project.code}</small></span><span className="project-card__count"><strong>{Number(project.productCount).toLocaleString('th-TH')}</strong><small>รายการสินค้า</small></span><span className="project-card__arrow">→</span></button>)}{!loading && projects.length === 0 && <div className="project-empty"><span className="project-empty__icon"><Icon name="package" size={23} /></span><h2>ยังไม่มีโปรเจค</h2><p>สร้างโปรเจคเพื่อเริ่มจัดการสินค้าแยกเป็นชุดงาน</p>{canCreate && <button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> สร้างโปรเจคใหม่</button>}</div>}</section></>;
}

function ProjectDetailPage({ project, products, statuses, loading, searchTerm, onSearchChange, onBack, onCreateProduct, onImport, onEdit, onDelete, deletingId, canDelete }) {
  if (!project && loading) return <div className="project-loading"><span className="spinner" />กำลังโหลดโปรเจค...</div>;
  if (!project) return <section className="project-not-found"><h1>ไม่พบโปรเจค</h1><p>โปรเจคนี้อาจถูกลบหรือไม่มีสิทธิ์เข้าถึง</p><button className="button button--secondary" type="button" onClick={onBack}>กลับไปหน้าโปรเจค</button></section>;
  return <><section className="welcome-section project-detail-heading"><div><button className="back-link" type="button" onClick={onBack}>← โปรเจคทั้งหมด</button><p className="eyebrow">โปรเจค {project.code}</p><h1>{project.name}</h1><p className="welcome-copy">สินค้าในโปรเจคนี้จะแยกรหัสตาม Prefix {project.code}-</p></div><div className="project-actions"><button className="button button--secondary" type="button" onClick={onImport}>Import Excel</button><button className="button button--primary" type="button" onClick={onCreateProduct}><Icon name="plus" size={19} /> เพิ่มสินค้า</button></div></section><StatusPieChart products={products} statuses={statuses} loading={loading} /><ProductTable products={products} loading={loading} searchTerm={searchTerm} onSearchChange={onSearchChange} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} canDelete={canDelete} /></>;
}

function ProjectModal({ open, form, submitting, error, onChange, onSubmit, onClose }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title"><div className="modal__header"><div><p className="eyebrow">พื้นที่ทำงาน</p><h2 id="project-form-title">สร้างโปรเจคใหม่</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={onSubmit}><label className="form-field"><span>รหัสโปรเจค <b>*</b></span><input name="code" type="text" value={form.code} onChange={onChange} maxLength="20" autoComplete="off" placeholder="เช่น coj" required /><small className="field-help">ใช้ a–z, 0–9, ขีดกลาง หรือขีดล่าง รหัสนี้จะเป็น Prefix ของสินค้า</small></label><label className="form-field"><span>ชื่อโปรเจค <b>*</b></span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="120" autoFocus required /></label><div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}สร้างโปรเจค</button></div></form></section></div>;
}

const normalizeExcelHeader = value => String(value ?? '').trim().toLowerCase().replace(/[\s_\-./()]+/g, '');
const isTagHeader = value => /(?:^|[^a-z])tags?(?:$|[^a-z])|แท็ก/i.test(String(value ?? ''));

function ExcelImportModal({ open, project, activeStatuses, submitting, apiError, onImport, onClearError, onClose }) {
  const [items, setItems] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  if (!open) return null;

  const handleFileChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    onClearError();
    setError('');
    setItems([]);
    setFileName(file.name);
    if (file.size > 10 * 1024 * 1024) { setError('ไฟล์ต้องมีขนาดไม่เกิน 10 MB'); return; }
    setReading(true);
    try {
      const rows = await readXlsxFile(file);
      if (rows.length < 2) throw new Error('ไฟล์ต้องมีแถวหัวข้อและข้อมูลสินค้าอย่างน้อยหนึ่งรายการ');
      const headers = rows[0].map(value => String(value ?? '').trim());
      const normalized = headers.map(normalizeExcelHeader);
      const findColumn = aliases => normalized.findIndex(header => aliases.includes(header));
      const nameIndex = findColumn(['ชื่อสินค้า', 'ชื่อ', 'สินค้า', 'รายการสินค้า', 'productname', 'product', 'name', 'item']);
      if (nameIndex < 0) throw new Error('ไม่พบหัวข้อชื่อสินค้า (ใช้ “ชื่อสินค้า”, “Product Name” หรือ “Name”)');
      const quantityIndex = findColumn(['จำนวนสินค้า', 'จำนวนคงเหลือ', 'จำนวน', 'quantity', 'qty', 'amount']);
      const statusIndex = findColumn(['ชื่อสถานะ', 'สถานะ', 'สถานะสินค้า', 'status', 'productstatus']);
      const duplicateHeaders = new Set(normalized.filter((header, index) => header && normalized.indexOf(header) !== index));
      const tagIndexes = [];
      const customIndexes = [];
      headers.forEach((header, index) => {
        if (!header || [nameIndex, quantityIndex, statusIndex].includes(index)) return;
        if (isTagHeader(header) || duplicateHeaders.has(normalized[index])) tagIndexes.push(index);
        else customIndexes.push(index);
      });
      const defaultStatusId = activeStatuses[0]?.id;
      if (!defaultStatusId) throw new Error('ต้องมีสถานะที่ใช้งานได้ก่อนนำเข้าสินค้า');
      const imported = rows.slice(1).filter(row => row.some(value => String(value ?? '').trim() !== '')).map(row => {
        const name = String(row[nameIndex] ?? '').trim();
        const rawQuantity = quantityIndex < 0 || String(row[quantityIndex] ?? '').trim() === '' ? 1 : Number(row[quantityIndex]);
        const rawStatus = statusIndex < 0 ? '' : String(row[statusIndex] ?? '').trim().toLowerCase();
        const matchingStatus = activeStatuses.find(status => status.name.trim().toLowerCase() === rawStatus);
        const tags = tagIndexes.flatMap(index => String(row[index] ?? '').split(/[,;|\n]/).map(tag => tag.trim()).filter(Boolean));
        const customFields = Object.fromEntries(customIndexes.map(index => [headers[index], String(row[index] ?? '').trim()]).filter(([key, value]) => key && value));
        return { name, quantity: rawQuantity, statusId: matchingStatus?.id || defaultStatusId, invalidStatus: Boolean(rawStatus && !matchingStatus), tags: [...new Set(tags)], customFields };
      });
      if (!imported.length) throw new Error('ไม่พบแถวข้อมูลสินค้าในไฟล์');
      if (imported.length > 500) throw new Error('นำเข้าได้สูงสุด 500 รายการต่อครั้ง');
      const missingNameRow = imported.findIndex(item => !item.name);
      if (missingNameRow >= 0) throw new Error(`กรุณาระบุชื่อสินค้าในแถวที่ ${missingNameRow + 2}`);
      const invalidQuantityRow = imported.findIndex(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 500);
      if (invalidQuantityRow >= 0) throw new Error(`จำนวนสินค้าในแถวที่ ${invalidQuantityRow + 2} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);
      const invalidStatusRow = imported.findIndex(item => item.invalidStatus);
      if (invalidStatusRow >= 0) throw new Error(`ไม่พบสถานะที่ตรงกับข้อมูลในแถวที่ ${invalidStatusRow + 2}`);
      setItems(imported.map(({ name, quantity, statusId, tags, customFields }) => ({ name, quantity, statusId, tags, customFields })));
    } catch (parseError) {
      setError(parseError.message || 'อ่านไฟล์ Excel ไม่สำเร็จ');
    } finally {
      setReading(false);
      event.target.value = '';
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !submitting && !reading) onClose(); }}><section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-form-title"><div className="modal__header"><div><p className="eyebrow">โปรเจค {project.code}</p><h2 id="import-form-title">นำเข้าสินค้าจาก Excel</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" disabled={submitting}><Icon name="close" size={20} /></button></div><p className="import-help">หัวตารางชื่อสินค้า / จำนวน / สถานะจะใช้เป็นข้อมูลหลัก หัวข้อที่มีคำว่า Tag หรือชื่อหัวข้อซ้ำจะเป็นแท็ก ส่วนหัวข้ออื่นจะบันทึกเป็น Custom Fields</p><label className="file-picker"><span>{fileName || 'เลือกไฟล์ Excel (.xlsx)'}</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} disabled={reading || submitting} /></label>{reading && <p className="import-state"><span className="spinner" />กำลังอ่านไฟล์...</p>}{error && <div className="form-error" role="alert">{error}</div>}{apiError && <div className="form-error" role="alert">{apiError}</div>}{items.length > 0 && <div className="import-preview"><strong>พร้อมนำเข้า {items.length.toLocaleString('th-TH')} รายการ</strong><small>สินค้าแรก: {items[0].name}{items.length > 1 ? ` · สินค้าสุดท้าย: ${items[items.length - 1].name}` : ''}</small></div>}<div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose} disabled={submitting}>ยกเลิก</button><button className="button button--primary" type="button" onClick={() => onImport(items)} disabled={!items.length || submitting || reading}>{submitting && <span className="spinner spinner--light" />}นำเข้า {items.length ? `${items.length.toLocaleString('th-TH')} รายการ` : 'สินค้า'}</button></div></section></div>;
}

function StatusesPage({ statuses, loading, onCreate, onEdit, onDelete }) {
  return <><section className="welcome-section"><div><p className="eyebrow">ตั้งค่าระบบ</p><h1>จัดการสถานะ</h1><p className="welcome-copy">กำหนดชื่อ สี และการใช้งานของสถานะสินค้าได้เอง</p></div><button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> เพิ่มสถานะ</button></section><section className="status-panel"><div className="panel-heading"><div><h2>สถานะสินค้า</h2><p>{statuses.length} สถานะในระบบ · สถานะที่ใช้งานได้จะแสดงในฟอร์มสินค้า</p></div></div><div className="status-grid">{loading && <p className="table-message">กำลังโหลดข้อมูล...</p>}{!loading && statuses.map(status => <article className="status-card" key={status.id}><div className="status-card__title"><span className="status-color" style={{ background: status.color }} /><div><strong>{status.name}</strong><small>{status.productCount} รายการสินค้า</small></div><span className={`status-state ${status.isActive ? 'status-state--active' : ''}`}>{status.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></div><div className="status-card__actions"><button className="button button--secondary button--small" type="button" onClick={() => onEdit(status)}><Icon name="edit" size={15} /> แก้ไข</button><button className="button button--danger button--small" type="button" onClick={() => onDelete(status)}><Icon name="trash" size={15} /> ลบ</button></div></article>)}{!loading && statuses.length === 0 && <p className="table-message">ยังไม่มีสถานะ</p>}</div></section></>;
}

function MembersPage({ members, loading, currentUser, onCreate, onEdit, onDeactivate }) {
  return <><section className="welcome-section"><div><p className="eyebrow">ตั้งค่าระบบ</p><h1>สมาชิกและสิทธิ์</h1><p className="welcome-copy">กำหนดบทบาทและสิทธิ์เข้าถึงของทีมคลังสินค้า</p></div><button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> เพิ่มสมาชิก</button></section><section className="role-grid" aria-label="บทบาทและสิทธิ์"><article className="role-card role-card--owner"><span className="role-card__icon"><Icon name="settings" size={18} /></span><div><strong>{ROLE_META.owner.label}</strong><p>{ROLE_META.owner.description}</p></div></article><article className="role-card role-card--manager"><span className="role-card__icon"><Icon name="chart" size={18} /></span><div><strong>{ROLE_META.manager.label}</strong><p>{ROLE_META.manager.description}</p></div></article><article className="role-card role-card--employee"><span className="role-card__icon"><Icon name="members" size={18} /></span><div><strong>{ROLE_META.employee.label}</strong><p>{ROLE_META.employee.description}</p></div></article></section><section className="products-panel members-panel"><div className="panel-heading"><div><h2>รายชื่อสมาชิก</h2><p>{members.length} บัญชีในระบบ · สมาชิกที่ปิดใช้งานจะเข้าสู่ระบบไม่ได้</p></div></div><div className="table-wrap"><table className="products-table members-table"><caption className="sr-only">รายชื่อสมาชิกและบทบาท</caption><thead><tr><th>สมาชิก</th><th>บทบาท</th><th>สถานะบัญชี</th><th>วันที่เพิ่ม</th><th>การจัดการ</th></tr></thead><tbody>{loading && <tr><td className="table-message" colSpan="5"><span className="spinner" />กำลังโหลดสมาชิก...</td></tr>}{!loading && members.length === 0 && <tr><td className="table-message" colSpan="5">ยังไม่มีสมาชิก</td></tr>}{!loading && members.map(member => <tr key={member.id}><td><div className="member-name"><span className="member-avatar">{member.fullName.slice(0, 1)}</span><span><strong>{member.fullName}{member.id === currentUser.id && <small className="you-label">บัญชีของคุณ</small>}</strong><small>ชื่อผู้ใช้: {member.username}</small></span></div></td><td><span className={`role-badge role-badge--${member.role}`}>{ROLE_META[member.role]?.label || member.role}</span></td><td><span className={`member-state ${member.isActive ? 'member-state--active' : ''}`}><i />{member.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></td><td>{new Date(member.createdAt).toLocaleDateString('th-TH')}</td><td><div className="row-actions"><button className="icon-button icon-button--edit" type="button" onClick={() => onEdit(member)} aria-label={`แก้ไขสมาชิก ${member.fullName}`}><Icon name="edit" size={17} /></button><button className="icon-button icon-button--delete" type="button" onClick={() => onDeactivate(member)} disabled={!member.isActive || member.id === currentUser.id} aria-label={`ปิดใช้งานสมาชิก ${member.fullName}`}><Icon name="trash" size={17} /></button></div></td></tr>)}</tbody></table></div><div className="panel-footer">บทบาทถูกตรวจสอบทุกครั้งที่เรียก API · เปลี่ยนบทบาทแล้วมีผลทันที</div></section></>;
}

function RolesPage() {
  return <><section className="welcome-section"><div><p className="eyebrow">&#x0e23;&#x0e30;&#x0e1a;&#x0e1a;&#x0e2a;&#x0e21;&#x0e32;&#x0e0a;&#x0e34;&#x0e01;</p><h1>&#x0e1a;&#x0e17;&#x0e1a;&#x0e32;&#x0e17;&#x0e41;&#x0e25;&#x0e30;&#x0e2a;&#x0e34;&#x0e17;&#x0e18;&#x0e34;&#x0e4c;</h1><p className="welcome-copy">&#x0e1a;&#x0e17;&#x0e1a;&#x0e32;&#x0e17;&#x0e43;&#x0e19;&#x0e23;&#x0e30;&#x0e1a;&#x0e1a; NAS Warehouse</p></div></section><section className="role-grid" aria-label="&#x0e1a;&#x0e17;&#x0e1a;&#x0e32;&#x0e17;&#x0e1c;&#x0e39;&#x0e49;&#x0e43;&#x0e0a;&#x0e49;"><article className="role-card role-card--owner"><span className="role-card__icon"><Icon name="settings" size={18} /></span><div><strong>{ROLE_META.owner.label}</strong><p>{ROLE_META.owner.description}</p></div></article><article className="role-card role-card--manager"><span className="role-card__icon"><Icon name="chart" size={18} /></span><div><strong>{ROLE_META.manager.label}</strong><p>{ROLE_META.manager.description}</p></div></article><article className="role-card role-card--employee"><span className="role-card__icon"><Icon name="members" size={18} /></span><div><strong>{ROLE_META.employee.label}</strong><p>{ROLE_META.employee.description}</p></div></article></section></>;
}

function AuthScreen({ mode, error, onAuthenticated }) {
  const [form, setForm] = useState({ fullName: '', username: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const isSetup = mode === 'setup';

  const handleChange = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/${isSetup ? 'setup' : 'login'}`, form);
      onAuthenticated(response.data);
    } catch (requestError) {
      window.dispatchEvent(new CustomEvent('nas:auth-error', { detail: getErrorMessage(requestError) }));
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="auth-screen"><section className="auth-card"><a className="brand auth-brand" href="#/" aria-label="Nas Warehouse"><span className="brand__mark"><Icon name="box" size={22} /></span><span><strong>Nas</strong><small>WAREHOUSE</small></span></a><p className="eyebrow">ระบบสมาชิกคลังสินค้า</p><h1>{isSetup ? 'ตั้งค่า Owner' : 'เข้าสู่ระบบ'}</h1><p className="auth-copy">{isSetup ? 'สร้างบัญชี Owner คนแรกเพื่อเริ่มจัดการสมาชิกและคลังสินค้า' : 'เข้าสู่ระบบด้วยบัญชีสมาชิกของคุณ'}</p>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={handleSubmit}>{isSetup && <label className="form-field"><span>ชื่อ Owner <b>*</b></span><input name="fullName" value={form.fullName} onChange={handleChange} maxLength="120" autoComplete="name" required /></label>}<label className="form-field"><span>ชื่อผู้ใช้ <b>*</b></span><input name="username" value={form.username} onChange={handleChange} minLength="3" maxLength="50" autoComplete="username" required /></label><label className="form-field"><span>รหัสผ่าน <b>*</b></span><input name="password" type="password" value={form.password} onChange={handleChange} minLength="8" autoComplete={isSetup ? 'new-password' : 'current-password'} required /></label>{isSetup && <p className="auth-hint">ชื่อผู้ใช้ 3–50 ตัวอักษร · รหัสผ่านอย่างน้อย 8 ตัวอักษร</p>}<button className="button button--primary auth-submit" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{isSetup ? 'สร้างบัญชีผู้ดูแล' : 'เข้าสู่ระบบ'}</button></form><div className="auth-roles"><strong>บทบาทในระบบ</strong><span>Owner · Manager · Employee</span></div></section></main>;
}

function MemberModal({ open, editingMember, currentUserId, form, submitting, error, onChange, onSubmit, onClose }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="member-form-title"><div className="modal__header"><div><p className="eyebrow">จัดการทีม</p><h2 id="member-form-title">{editingMember ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'}</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={onSubmit}><label className="form-field"><span>ชื่อสมาชิก <b>*</b></span><input name="fullName" type="text" value={form.fullName} onChange={onChange} maxLength="120" autoFocus required /></label><label className="form-field"><span>ชื่อผู้ใช้ <b>*</b></span><input name="username" type="text" value={form.username} onChange={onChange} minLength="3" maxLength="50" autoComplete="off" required /><small className="field-help">3–50 ตัวอักษร ใช้ตัวอักษร ตัวเลข จุด ขีดล่าง หรือขีดกลาง</small></label><label className="form-field"><span>บทบาท <b>*</b></span><select name="role" value={form.role} onChange={onChange} required disabled={editingMember?.id === currentUserId}>{Object.entries(ROLE_META).map(([role, details]) => <option value={role} key={role}>{details.label}</option>)}</select><small className="field-help">{ROLE_META[form.role]?.description}</small></label><label className="form-field"><span>รหัสผ่าน {editingMember ? '(เว้นว่างไว้เพื่อไม่เปลี่ยน)' : <b>*</b>}</span><input name="password" type="password" value={form.password} onChange={onChange} minLength="8" autoComplete="new-password" required={!editingMember} /></label>{editingMember && <label className="toggle-field"><input name="isActive" type="checkbox" checked={form.isActive} onChange={onChange} /><span>เปิดใช้งานบัญชีนี้</span></label>}<div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{editingMember ? 'บันทึกสมาชิก' : 'เพิ่มสมาชิก'}</button></div></form></section></div>;
}

function ProductModal({ open, project, editingProduct, form, activeStatuses, submitting, error, onChange, onCustomFieldChange, onAddCustomField, onRemoveCustomField, onAddTag, onRemoveTag, onSubmit, onClose }) {
  if (!open) return null;
  const selectableStatuses = [...activeStatuses];
  if (editingProduct?.status && !selectableStatuses.some(status => status.id === editingProduct.status.id)) selectableStatuses.push(editingProduct.status);
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal product-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title"><div className="modal__header"><div><p className="eyebrow">{project ? `โปรเจค ${project.code}` : 'ข้อมูลสินค้า'}</p><h2 id="product-form-title">{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}{!editingProduct && project && <p className="product-code-hint">รหัสสินค้าจะถูกสร้างแยกตาม item: <strong>{project.code}-0001, {project.code}-0002...</strong></p>}<form onSubmit={onSubmit}><label className="form-field"><span>ชื่อสินค้า <b>*</b></span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="100" autoFocus required /></label><div className="form-grid"><label className="form-field"><span>{editingProduct ? 'จำนวน item ในแถวนี้' : 'จำนวน item ที่ต้องการสร้าง'} <b>*</b></span><input name="quantity" type="number" min={editingProduct ? '0' : '1'} max={editingProduct ? undefined : '500'} step="1" value={form.quantity} onChange={onChange} required readOnly={Boolean(editingProduct)} /><small className="field-help">{editingProduct ? 'จำนวน item เดิมคงไว้ หากต้องการเพิ่ม ใช้ปุ่ม “เพิ่มสินค้า”' : 'ระบบจะสร้าง item แยกแถวพร้อมรหัสแต่ละรายการ'}</small></label><label className="form-field"><span>สถานะ <b>*</b></span><select name="statusId" value={form.statusId} onChange={onChange} required><option value="">เลือกสถานะ</option>{selectableStatuses.map(status => <option key={status.id} value={status.id}>{status.name}{!status.isActive ? ' (ปิดใช้งาน)' : ''}</option>)}</select></label></div><div className="form-field"><span>Tags</span><div className="tag-editor">{form.tags.length > 0 && <div className="tag-editor__chips">{form.tags.map(tag => <span className="tag-editor__chip" key={tag}>{tag}<button type="button" onClick={() => onRemoveTag(tag)} aria-label={`ลบแท็ก ${tag}`}>&times;</button></span>)}</div>}<input name="tagInput" type="text" value={form.tagInput} onChange={onChange} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onAddTag(form.tagInput); } }} placeholder="พิมพ์แท็กแล้วกด Enter" maxLength="60" /><small className="field-help">กด Enter เพื่อเพิ่มแท็กทีละรายการ</small></div></div><div className="custom-fields-editor"><div className="custom-fields-editor__heading"><div><strong>Custom Fields</strong><small>ข้อมูลเพิ่มเติม เช่น หมายเลขครุภัณฑ์หรือ Serial Number</small></div><button className="button button--secondary button--small" type="button" onClick={onAddCustomField}>เพิ่มช่อง</button></div>{form.customFields.map((field, index) => <div className="custom-field-row" key={index}><input aria-label="ชื่อ Custom Field" value={field.key} onChange={event => onCustomFieldChange(index, 'key', event.target.value)} placeholder="ชื่อช่อง เช่น Serial Number" maxLength="80" /><input aria-label="ค่า Custom Field" value={field.value} onChange={event => onCustomFieldChange(index, 'value', event.target.value)} placeholder="ค่า" maxLength="1000" /><button className="icon-button icon-button--delete" type="button" onClick={() => onRemoveCustomField(index)} aria-label="ลบช่อง"><Icon name="trash" size={16} /></button></div>)}</div><div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{editingProduct ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button></div></form></section></div>;
}

function StatusModal({ open, editingStatus, form, submitting, error, onChange, onSubmit, onClose }) {
  if (!open) return null;

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="status-form-title"><div className="modal__header"><div><p className="eyebrow">ตั้งค่าระบบ</p><h2 id="status-form-title">{editingStatus ? 'แก้ไขสถานะ' : 'เพิ่มสถานะ'}</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={onSubmit}><label className="form-field"><span>ชื่อสถานะ <b>*</b></span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="50" autoFocus required /></label><label className="form-field color-field"><span>สีสถานะ <b>*</b></span><div><input name="color" type="color" value={form.color} onChange={onChange} /><code>{form.color}</code></div></label><label className="toggle-field"><input name="isActive" type="checkbox" checked={form.isActive} onChange={onChange} /><span>เปิดใช้งานสถานะนี้</span></label><div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{editingStatus ? 'บันทึกการแก้ไข' : 'เพิ่มสถานะ'}</button></div></form></section></div>;
}

function App() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  const [selectedProjectId, setSelectedProjectId] = useState(() => projectIdFromHash(window.location.hash));
  const [authState, setAuthState] = useState('checking');
  const [authUser, setAuthUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [products, setProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [members, setMembers] = useState([]);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [statusForm, setStatusForm] = useState(EMPTY_STATUS);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isStatusFormOpen, setIsStatusFormOpen] = useState(false);
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);

  const navigate = useCallback(nextPage => {
    window.location.hash = nextPage === 'dashboard' || nextPage === 'projects' ? '#/projects' : `#/${nextPage}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const status = await axios.get(`${API_URL}/api/auth/status`);
        if (cancelled) return;
        if (!status.data.setupComplete) {
          setAuthState('setup');
          return;
        }
        const token = window.localStorage.getItem('nas-warehouse-token');
        if (!token) {
          setAuthState('login');
          return;
        }
        const response = await axios.get(`${API_URL}/api/auth/me`);
        if (cancelled) return;
        setAuthUser(response.data);
        setAuthState('app');
      } catch (requestError) {
        if (cancelled) return;
        window.localStorage.removeItem('nas-warehouse-token');
        delete axios.defaults.headers.common.Authorization;
        setAuthError(getErrorMessage(requestError));
        setAuthState('login');
      }
    };
    const handleSessionExpired = () => {
      window.localStorage.removeItem('nas-warehouse-token');
      delete axios.defaults.headers.common.Authorization;
      setAuthUser(null);
      setAuthError('เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
      setAuthState('login');
    };
    const handleAuthError = event => setAuthError(event.detail);
    window.addEventListener('nas:session-expired', handleSessionExpired);
    window.addEventListener('nas:auth-error', handleAuthError);
    restoreSession();
    return () => {
      cancelled = true;
      window.removeEventListener('nas:session-expired', handleSessionExpired);
      window.removeEventListener('nas:auth-error', handleAuthError);
    };
  }, []);

  const fetchProducts = useCallback(async projectId => {
    try {
      const response = await axios.get(`${API_URL}/api/products`, { params: projectId ? { projectId } : {} });
      setProducts(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/statuses`);
      setStatuses(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects`);
      setProjects(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/members`);
      setMembers(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const refreshData = useCallback(async (projectId = selectedProjectId) => {
    setLoading(true);
    setError('');
    if (!projectId) setProducts([]);
    await Promise.all([projectId ? fetchProducts(projectId) : Promise.resolve(), fetchStatuses(), fetchProjects()]);
    setLoading(false);
  }, [fetchProducts, fetchProjects, fetchStatuses, selectedProjectId]);

  useEffect(() => {
    const handleHashChange = () => {
      setPage(pageFromHash(window.location.hash));
      setSelectedProjectId(projectIdFromHash(window.location.hash));
      setSearchTerm('');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (authState !== 'app') return;
    const timer = window.setTimeout(() => refreshData(page === 'project-detail' ? selectedProjectId : null), 0);
    return () => window.clearTimeout(timer);
  }, [authState, page, refreshData, selectedProjectId]);

  useEffect(() => {
    if (authState !== 'app' || page !== 'members' || authUser?.role !== 'owner') return;
    const timer = window.setTimeout(fetchMembers, 0);
    return () => window.clearTimeout(timer);
  }, [authState, page, authUser, fetchMembers]);

  useEffect(() => {
    if (authState !== 'app') return;
    if (page === 'members' && authUser?.role !== 'owner') navigate('projects');
    if (page === 'statuses' && authUser?.role !== 'owner') navigate('projects');
  }, [authState, authUser, navigate, page]);

  useEffect(() => {
    if (!isProductFormOpen && !isStatusFormOpen && !isMemberFormOpen && !isProjectFormOpen && !isImportOpen) return undefined;
    const handleEscape = event => {
      if (event.key === 'Escape') {
        setIsProductFormOpen(false);
        setIsStatusFormOpen(false);
        setIsMemberFormOpen(false);
        setIsProjectFormOpen(false);
        setIsImportOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isProductFormOpen, isStatusFormOpen, isMemberFormOpen, isProjectFormOpen, isImportOpen]);

  const activeStatuses = statuses.filter(status => status.isActive);
  const activeProject = projects.find(project => String(project.id) === String(selectedProjectId)) || null;
  const canCreateProjects = authUser?.role === 'owner' || authUser?.role === 'manager';

  const handleAuthenticated = session => {
    window.localStorage.setItem('nas-warehouse-token', session.token);
    axios.defaults.headers.common.Authorization = `Bearer ${session.token}`;
    setAuthUser(session.user);
    setAuthError('');
    setAuthState('app');
  };

  const handleLogout = () => {
    window.localStorage.removeItem('nas-warehouse-token');
    delete axios.defaults.headers.common.Authorization;
    setAuthUser(null);
    setAuthError('');
    setAuthState('login');
    navigate('projects');
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({ ...EMPTY_PRODUCT, projectId: String(activeProject?.id || ''), statusId: activeStatuses[0]?.id ? String(activeStatuses[0].id) : '' });
    setError('');
    setIsProductFormOpen(true);
  };

  const openEditProduct = product => {
    setEditingProduct(product);
    const customFields = Object.entries(product.customFields || {}).map(([key, value]) => ({ key, value: String(value) }));
    setProductForm({ projectId: String(product.projectId), name: product.name, quantity: String(product.quantity), statusId: String(product.status?.id || ''), customFields: customFields.length ? customFields : [{ key: '', value: '' }], tags: product.tags || [], tagInput: '' });
    setError('');
    setIsProductFormOpen(true);
  };

  const openCreateProject = () => {
    setProjectForm({ ...EMPTY_PROJECT });
    setError('');
    setIsProjectFormOpen(true);
  };

  const openProject = project => { window.location.hash = `#/projects/${project.id}`; };

  const openCreateStatus = () => {
    setEditingStatus(null);
    setStatusForm({ ...EMPTY_STATUS });
    setError('');
    setIsStatusFormOpen(true);
  };

  const openEditStatus = status => {
    setEditingStatus(status);
    setStatusForm({ name: status.name, color: status.color, isActive: status.isActive });
    setError('');
    setIsStatusFormOpen(true);
  };

  const openCreateMember = () => {
    setEditingMember(null);
    setMemberForm({ ...EMPTY_MEMBER });
    setError('');
    setIsMemberFormOpen(true);
  };

  const openEditMember = member => {
    setEditingMember(member);
    setMemberForm({ fullName: member.fullName, username: member.username, role: member.role, password: '', isActive: member.isActive });
    setError('');
    setIsMemberFormOpen(true);
  };

  const handleProductChange = event => setProductForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const handleAddTag = value => setProductForm(current => { const tag = String(value || '').trim(); if (!tag || current.tags.some(existing => existing.toLowerCase() === tag.toLowerCase())) return { ...current, tagInput: '' }; return { ...current, tags: [...current.tags, tag], tagInput: '' }; });
  const handleRemoveTag = tag => setProductForm(current => ({ ...current, tags: current.tags.filter(existing => existing !== tag) }));
  const handleCustomFieldChange = (index, field, value) => setProductForm(current => ({
    ...current,
    customFields: current.customFields.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const handleAddCustomField = () => setProductForm(current => ({ ...current, customFields: [...current.customFields, { key: '', value: '' }] }));
  const handleRemoveCustomField = index => setProductForm(current => ({ ...current, customFields: current.customFields.filter((_, itemIndex) => itemIndex !== index) }));
  const handleStatusChange = event => setStatusForm(current => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const handleMemberChange = event => setMemberForm(current => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const handleProjectChange = event => setProjectForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const handleProjectSubmit = async event => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      const response = await axios.post(`${API_URL}/api/projects`, projectForm);
      setIsProjectFormOpen(false);
      setSuccess(`สร้างโปรเจค ${response.data.code} เรียบร้อยแล้ว`);
      await fetchProjects();
      openProject(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMemberSubmit = async event => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      if (editingMember) {
        const response = await axios.put(`${API_URL}/api/members/${editingMember.id}`, memberForm);
        if (editingMember.id === authUser.id) setAuthUser(response.data);
        setSuccess('บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว');
      } else {
        await axios.post(`${API_URL}/api/members`, memberForm);
        setSuccess('เพิ่มสมาชิกเรียบร้อยแล้ว');
      }
      setIsMemberFormOpen(false);
      await fetchMembers();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivateMember = async member => {
    if (!window.confirm(`ปิดใช้งานบัญชีของ “${member.fullName}” ใช่หรือไม่?`)) return;
    try {
      await axios.delete(`${API_URL}/api/members/${member.id}`);
      setSuccess('ปิดใช้งานสมาชิกเรียบร้อยแล้ว');
      await fetchMembers();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleProductSubmit = async event => {
    event.preventDefault();
    const payload = {
      projectId: Number(productForm.projectId),
      name: productForm.name.trim(),
      quantity: editingProduct ? Number(editingProduct.quantity) : Number(productForm.quantity),
      statusId: Number(productForm.statusId),
      customFields: Object.fromEntries(productForm.customFields.map(field => [field.key.trim(), field.value.trim()]).filter(([key, value]) => key && value)),
      tags: productForm.tags,
    };
    if (!payload.projectId || !payload.name || !Number.isInteger(payload.quantity) || payload.quantity < (editingProduct ? 0 : 1) || payload.quantity > (editingProduct ? Number.MAX_SAFE_INTEGER : 500) || !payload.statusId) {
      setError('กรุณาตรวจสอบชื่อสินค้า จำนวน และสถานะให้ถูกต้อง');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      if (editingProduct) {
        await axios.put(`${API_URL}/api/products/${editingProduct.id}`, payload);
        setSuccess('แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว');
      } else {
        await axios.post(`${API_URL}/api/products`, payload);
        setSuccess('เพิ่มสินค้าใหม่เรียบร้อยแล้ว');
      }
      setIsProductFormOpen(false);
      await refreshData(payload.projectId);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportProducts = async items => {
    if (!activeProject) return;
    try {
      setSubmitting(true);
      setError('');
      const response = await axios.post(`${API_URL}/api/projects/${activeProject.id}/products/import`, { items });
      setIsImportOpen(false);
      setSuccess(`นำเข้าสินค้า ${response.data.importedCount.toLocaleString('th-TH')} รายการเรียบร้อยแล้ว`);
      await refreshData(activeProject.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusSubmit = async event => {
    event.preventDefault();
    if (!statusForm.name.trim()) {
      setError('กรุณาระบุชื่อสถานะ');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      if (editingStatus) {
        await axios.put(`${API_URL}/api/statuses/${editingStatus.id}`, statusForm);
        setSuccess('แก้ไขสถานะเรียบร้อยแล้ว');
      } else {
        await axios.post(`${API_URL}/api/statuses`, statusForm);
        setSuccess('เพิ่มสถานะเรียบร้อยแล้ว');
      }
      setIsStatusFormOpen(false);
      await refreshData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async product => {
    if (!window.confirm(`ต้องการลบ “${product.name}” ออกจากรายการใช่หรือไม่?`)) return;
    try {
      setDeletingId(product.id);
      await axios.delete(`${API_URL}/api/products/${product.id}`);
      setProducts(current => current.filter(item => item.id !== product.id));
      setSuccess('ลบสินค้าเรียบร้อยแล้ว');
      await fetchProjects();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteStatus = async status => {
    if (!window.confirm(`ต้องการลบสถานะ “${status.name}” ใช่หรือไม่?`)) return;
    try {
      await axios.delete(`${API_URL}/api/statuses/${status.id}`);
      setSuccess('ลบสถานะเรียบร้อยแล้ว');
      await refreshData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const canDeleteProducts = authUser?.role !== 'employee';
  const projectProducts = activeProject ? products.filter(product => String(product.projectId) === String(activeProject.id)) : [];

  if (authState === 'checking') return <main className="auth-screen"><div className="auth-loading"><span className="spinner" />กำลังตรวจสอบบัญชีสมาชิก...</div></main>;
  if (authState === 'setup' || authState === 'login') return <AuthScreen mode={authState} error={authError} onAuthenticated={handleAuthenticated} />;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#/projects" aria-label="Nas Warehouse หน้าหลัก"><span className="brand__mark"><Icon name="box" size={22} /></span><span><strong>Nas</strong><small>WAREHOUSE</small></span></a>
      <nav className="main-nav" aria-label="เมนูหลัก">
        <button className={page === 'projects' || page === 'project-detail' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('projects')}>โปรเจค</button>
        <button className={page === 'roles' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('roles')}><Icon name="members" size={15} /> บทบาท</button>
        {authUser.role === 'owner' && <button className={page === 'statuses' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('statuses')}><Icon name="settings" size={15} /> จัดการสถานะ</button>}
        {authUser.role === 'owner' && <button className={page === 'members' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('members')}><Icon name="members" size={15} /> สมาชิก</button>}
      </nav>
      <div className="account-area"><span className="account-role"><strong>{authUser.fullName}</strong><small>{ROLE_META[authUser.role]?.label}</small></span><button className="button button--secondary button--small logout-button" type="button" onClick={handleLogout}>ออกจากระบบ</button></div>
    </header>
    <main className="dashboard">
      {success && <div className="alert alert--success" role="status">{success}<button type="button" onClick={() => setSuccess('')} aria-label="ปิดข้อความแจ้งเตือน"><Icon name="close" size={16} /></button></div>}
      {error && !isProductFormOpen && !isStatusFormOpen && !isMemberFormOpen && !isProjectFormOpen && !isImportOpen && <div className="alert alert--error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="ปิดข้อความผิดพลาด"><Icon name="close" size={16} /></button></div>}
      {page === 'projects' && <ProjectsPage projects={projects} loading={loading} canCreate={canCreateProjects} onCreate={openCreateProject} onOpen={openProject} />}
      {page === 'roles' && <RolesPage />}
      {page === 'project-detail' && <ProjectDetailPage project={activeProject} products={projectProducts} statuses={statuses} loading={loading} searchTerm={searchTerm} onSearchChange={event => setSearchTerm(event.target.value)} onBack={() => navigate('projects')} onCreateProduct={openCreateProduct} onImport={() => { setError(''); setIsImportOpen(true); }} onEdit={openEditProduct} onDelete={handleDeleteProduct} deletingId={deletingId} canDelete={canDeleteProducts} />}
      {page === 'statuses' && authUser.role === 'owner' && <StatusesPage statuses={statuses} loading={loading} onCreate={openCreateStatus} onEdit={openEditStatus} onDelete={handleDeleteStatus} />}
      {page === 'members' && authUser.role === 'owner' && <MembersPage members={members} loading={membersLoading} currentUser={authUser} onCreate={openCreateMember} onEdit={openEditMember} onDeactivate={handleDeactivateMember} />}
    </main>
    <ProjectModal open={isProjectFormOpen} form={projectForm} submitting={submitting} error={error} onChange={handleProjectChange} onSubmit={handleProjectSubmit} onClose={() => setIsProjectFormOpen(false)} />
    <ExcelImportModal key={isImportOpen ? 'import-open' : 'import-closed'} open={isImportOpen} project={activeProject} activeStatuses={activeStatuses} submitting={submitting} apiError={error} onImport={handleImportProducts} onClearError={() => setError('')} onClose={() => setIsImportOpen(false)} />
    <ProductModal open={isProductFormOpen} project={activeProject} editingProduct={editingProduct} form={productForm} activeStatuses={activeStatuses} submitting={submitting} error={error} onChange={handleProductChange} onCustomFieldChange={handleCustomFieldChange} onAddCustomField={handleAddCustomField} onRemoveCustomField={handleRemoveCustomField} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} onSubmit={handleProductSubmit} onClose={() => setIsProductFormOpen(false)} />
    <StatusModal open={isStatusFormOpen} editingStatus={editingStatus} form={statusForm} submitting={submitting} error={error} onChange={handleStatusChange} onSubmit={handleStatusSubmit} onClose={() => setIsStatusFormOpen(false)} />
    <MemberModal open={isMemberFormOpen} editingMember={editingMember} currentUserId={authUser.id} form={memberForm} submitting={submitting} error={error} onChange={handleMemberChange} onSubmit={handleMemberSubmit} onClose={() => setIsMemberFormOpen(false)} />
  </div>;
}

export default App;
