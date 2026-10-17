import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EMPTY_PRODUCT = { name: '', quantity: '', statusId: '' };
const EMPTY_STATUS = { name: '', color: '#1769E0', isActive: true };
const LOW_STOCK_THRESHOLD = 5;

const getErrorMessage = error => error.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
const pageFromHash = hash => (hash === '#/statuses' ? 'statuses' : hash === '#/products' ? 'products' : 'dashboard');

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
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function StatCard({ icon, label, value, detail, tone }) {
  return <article className={`stat-card stat-card--${tone}`}><div className="stat-card__topline"><span className="stat-card__icon"><Icon name={icon} size={21} /></span><span className="stat-card__label">{label}</span></div><strong className="stat-card__value">{value}</strong><span className="stat-card__detail">{detail}</span></article>;
}

function StatusBadge({ status }) {
  return <span className="stock-badge" style={{ '--status-color': status?.color || '#1769E0' }}><span />{status?.name || 'ไม่ระบุ'}</span>;
}

function ProductTable({ products, loading, searchTerm, onSearchChange, onEdit, onDelete, deletingId }) {
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? products.filter(product => product.name.toLowerCase().includes(query)) : products;
  }, [products, searchTerm]);

  return <section className="products-panel"><div className="panel-heading"><div><h2>รายการสินค้า</h2><p>จัดการข้อมูลสินค้าและสถานะในคลัง</p></div><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">ค้นหาสินค้า</span><input type="search" value={searchTerm} onChange={onSearchChange} placeholder="ค้นหาชื่อสินค้า..." /></label></div><div className="table-wrap"><table className="products-table"><caption className="sr-only">รายการสินค้าในคลัง</caption><thead><tr><th>สินค้า</th><th>จำนวน</th><th>สถานะที่กำหนด</th><th>การจัดการ</th></tr></thead><tbody>{loading && <tr><td className="table-message" colSpan="4"><span className="spinner" />กำลังโหลดข้อมูล...</td></tr>}{!loading && filteredProducts.length === 0 && <tr><td className="table-message" colSpan="4">{searchTerm ? 'ไม่พบสินค้าที่ตรงกับคำค้นหา' : 'ยังไม่มีสินค้าในคลัง'}</td></tr>}{!loading && filteredProducts.map(product => <tr key={product.id}><td data-label="สินค้า"><div className="product-name"><span className="product-avatar"><Icon name="box" size={16} /></span><span><strong>{product.name}</strong><small>รหัสสินค้า #{product.id}</small></span></div></td><td data-label="จำนวน"><strong>{Number(product.quantity).toLocaleString('th-TH')}</strong> ชิ้น {Number(product.quantity) <= LOW_STOCK_THRESHOLD && <small className="low-stock-note">ใกล้หมด</small>}</td><td data-label="สถานะที่กำหนด"><StatusBadge status={product.status} /></td><td data-label="การจัดการ"><div className="row-actions"><button className="icon-button icon-button--edit" type="button" onClick={() => onEdit(product)} aria-label={`แก้ไข ${product.name}`}><Icon name="edit" size={17} /></button><button className="icon-button icon-button--delete" type="button" onClick={() => onDelete(product)} disabled={deletingId === product.id} aria-label={`ลบ ${product.name}`}><Icon name="trash" size={17} /></button></div></td></tr>)}</tbody></table></div><div className="panel-footer">แสดง {filteredProducts.length.toLocaleString('th-TH')} จาก {products.length.toLocaleString('th-TH')} รายการ</div></section>;
}

function ProductPage({ products, loading, searchTerm, onSearchChange, onCreate, onEdit, onDelete, deletingId }) {
  return <><section className="welcome-section"><div><p className="eyebrow">คลังสินค้า</p><h1>สินค้า</h1><p className="welcome-copy">เพิ่ม แก้ไข และลบรายการสินค้า</p></div><button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> เพิ่มสินค้า</button></section><ProductTable products={products} loading={loading} searchTerm={searchTerm} onSearchChange={onSearchChange} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} /></>;
}

function DashboardPage({ products, stats, loading, onCreate, onEdit, onDelete, deletingId }) {
  return <><section className="welcome-section"><div><p className="eyebrow">ภาพรวมคลังสินค้า</p><h1>Dashboard</h1><p className="welcome-copy">ติดตามสินค้าและสถานะคลังของคุณได้ในที่เดียว</p></div><button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> เพิ่มสินค้า</button></section><section className="stats-grid"><StatCard icon="package" tone="blue" label="รายการสินค้าทั้งหมด" value={products.length.toLocaleString('th-TH')} detail="รายการในระบบ" /><StatCard icon="chart" tone="teal" label="จำนวนสินค้ารวม" value={stats.totalQuantity.toLocaleString('th-TH')} detail="ชิ้นในคลัง" /><StatCard icon="box" tone="violet" label="สถานะพร้อมขาย" value={stats.readyCount.toLocaleString('th-TH')} detail="รายการสินค้า" /><StatCard icon="warning" tone="orange" label="สินค้าใกล้หมด" value={stats.lowStockCount.toLocaleString('th-TH')} detail={`จำนวนไม่เกิน ${LOW_STOCK_THRESHOLD} ชิ้น`} /></section><ProductTable products={products} loading={loading} searchTerm="" onSearchChange={() => {}} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} /></>;
}

function StatusesPage({ statuses, loading, onCreate, onEdit, onDelete }) {
  return <><section className="welcome-section"><div><p className="eyebrow">ตั้งค่าระบบ</p><h1>จัดการสถานะ</h1><p className="welcome-copy">กำหนดชื่อ สี และการใช้งานของสถานะสินค้าได้เอง</p></div><button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> เพิ่มสถานะ</button></section><section className="status-panel"><div className="panel-heading"><div><h2>สถานะสินค้า</h2><p>{statuses.length} สถานะในระบบ · สถานะที่ใช้งานได้จะแสดงในฟอร์มสินค้า</p></div></div><div className="status-grid">{loading && <p className="table-message">กำลังโหลดข้อมูล...</p>}{!loading && statuses.map(status => <article className="status-card" key={status.id}><div className="status-card__title"><span className="status-color" style={{ background: status.color }} /><div><strong>{status.name}</strong><small>{status.productCount} รายการสินค้า</small></div><span className={`status-state ${status.isActive ? 'status-state--active' : ''}`}>{status.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></div><div className="status-card__actions"><button className="button button--secondary button--small" type="button" onClick={() => onEdit(status)}><Icon name="edit" size={15} /> แก้ไข</button><button className="button button--danger button--small" type="button" onClick={() => onDelete(status)}><Icon name="trash" size={15} /> ลบ</button></div></article>)}{!loading && statuses.length === 0 && <p className="table-message">ยังไม่มีสถานะ</p>}</div></section></>;
}

function ProductModal({ open, editingProduct, form, activeStatuses, submitting, error, onChange, onSubmit, onClose }) {
  if (!open) return null;

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title"><div className="modal__header"><div><p className="eyebrow">{editingProduct ? 'แก้ไขข้อมูล' : 'เพิ่มรายการใหม่'}</p><h2 id="product-form-title">{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={onSubmit}><label className="form-field"><span>ชื่อสินค้า <b>*</b></span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="100" autoFocus required /></label><div className="form-grid"><label className="form-field"><span>จำนวนสินค้า <b>*</b></span><input name="quantity" type="number" min="0" step="1" value={form.quantity} onChange={onChange} required /></label><label className="form-field"><span>สถานะ <b>*</b></span><select name="statusId" value={form.statusId} onChange={onChange} required><option value="">เลือกสถานะ</option>{activeStatuses.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label></div><div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{editingProduct ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button></div></form></section></div>;
}

function StatusModal({ open, editingStatus, form, submitting, error, onChange, onSubmit, onClose }) {
  if (!open) return null;

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="status-form-title"><div className="modal__header"><div><p className="eyebrow">ตั้งค่าระบบ</p><h2 id="status-form-title">{editingStatus ? 'แก้ไขสถานะ' : 'เพิ่มสถานะ'}</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={onSubmit}><label className="form-field"><span>ชื่อสถานะ <b>*</b></span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="50" autoFocus required /></label><label className="form-field color-field"><span>สีสถานะ <b>*</b></span><div><input name="color" type="color" value={form.color} onChange={onChange} /><code>{form.color}</code></div></label><label className="toggle-field"><input name="isActive" type="checkbox" checked={form.isActive} onChange={onChange} /><span>เปิดใช้งานสถานะนี้</span></label><div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{editingStatus ? 'บันทึกการแก้ไข' : 'เพิ่มสถานะ'}</button></div></form></section></div>;
}

function App() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  const [products, setProducts] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [statusForm, setStatusForm] = useState(EMPTY_STATUS);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isStatusFormOpen, setIsStatusFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/products`);
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

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError('');
    await Promise.all([fetchProducts(), fetchStatuses()]);
    setLoading(false);
  }, [fetchProducts, fetchStatuses]);

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    const timer = window.setTimeout(refreshData, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [refreshData]);

  useEffect(() => {
    if (!isProductFormOpen && !isStatusFormOpen) return undefined;
    const handleEscape = event => {
      if (event.key === 'Escape') {
        setIsProductFormOpen(false);
        setIsStatusFormOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isProductFormOpen, isStatusFormOpen]);

  const stats = useMemo(() => ({
    totalQuantity: products.reduce((sum, product) => sum + Number(product.quantity), 0),
    readyCount: products.filter(product => product.status?.name === 'พร้อมขาย').length,
    lowStockCount: products.filter(product => Number(product.quantity) <= LOW_STOCK_THRESHOLD).length,
  }), [products]);

  const activeStatuses = statuses.filter(status => status.isActive);

  const navigate = nextPage => {
    window.location.hash = nextPage === 'dashboard' ? '#/' : `#/${nextPage}`;
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({ ...EMPTY_PRODUCT, statusId: activeStatuses[0]?.id ? String(activeStatuses[0].id) : '' });
    setError('');
    setIsProductFormOpen(true);
  };

  const openEditProduct = product => {
    setEditingProduct(product);
    setProductForm({ name: product.name, quantity: String(product.quantity), statusId: String(product.status?.id || '') });
    setError('');
    setIsProductFormOpen(true);
  };

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

  const handleProductChange = event => setProductForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const handleStatusChange = event => setStatusForm(current => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const handleProductSubmit = async event => {
    event.preventDefault();
    const payload = { name: productForm.name.trim(), quantity: Number(productForm.quantity), statusId: Number(productForm.statusId) };
    if (!payload.name || !Number.isInteger(payload.quantity) || payload.quantity < 0 || !payload.statusId) {
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
      await refreshData();
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

  const productTableProps = { products, loading, searchTerm, onSearchChange: event => setSearchTerm(event.target.value), onEdit: openEditProduct, onDelete: handleDeleteProduct, deletingId };

  return <div className="app-shell"><header className="topbar"><a className="brand" href="#/" aria-label="Nas Warehouse หน้าหลัก"><span className="brand__mark"><Icon name="box" size={22} /></span><span><strong>Nas</strong><small>WAREHOUSE</small></span></a><nav className="main-nav" aria-label="เมนูหลัก"><button className={page === 'dashboard' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('dashboard')}>Dashboard</button><button className={page === 'products' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('products')}>สินค้า</button><button className={page === 'statuses' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('statuses')}><Icon name="settings" size={15} /> จัดการสถานะ</button></nav><div className="topbar__status"><span className="status-dot" />ระบบพร้อมใช้งาน</div></header><main className="dashboard">{success && <div className="alert alert--success" role="status">{success}<button type="button" onClick={() => setSuccess('')} aria-label="ปิดข้อความแจ้งเตือน"><Icon name="close" size={16} /></button></div>}{error && !isProductFormOpen && !isStatusFormOpen && <div className="alert alert--error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="ปิดข้อความผิดพลาด"><Icon name="close" size={16} /></button></div>}{page === 'dashboard' && <DashboardPage products={products} stats={stats} loading={loading} onCreate={openCreateProduct} onEdit={openEditProduct} onDelete={handleDeleteProduct} deletingId={deletingId} />}{page === 'products' && <ProductPage {...productTableProps} onCreate={openCreateProduct} />}{page === 'statuses' && <StatusesPage statuses={statuses} loading={loading} onCreate={openCreateStatus} onEdit={openEditStatus} onDelete={handleDeleteStatus} />}</main><ProductModal open={isProductFormOpen} editingProduct={editingProduct} form={productForm} activeStatuses={activeStatuses} submitting={submitting} error={error} onChange={handleProductChange} onSubmit={handleProductSubmit} onClose={() => setIsProductFormOpen(false)} /><StatusModal open={isStatusFormOpen} editingStatus={editingStatus} form={statusForm} submitting={submitting} error={error} onChange={handleStatusChange} onSubmit={handleStatusSubmit} onClose={() => setIsStatusFormOpen(false)} /></div>;
}

export default App;
