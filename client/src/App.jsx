import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import readXlsxFile from 'read-excel-file/browser';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EMPTY_PRODUCT = { name: '', productCode: '', quantity: '1', statusId: '', categoryId: '', projectId: '', customFields: [{ key: '', value: '' }], tags: [], tagInput: '' };
const EMPTY_PROJECT = { code: '', name: '' };
const EMPTY_STATUS = { name: '', color: '#1769E0', icon: 'box', isActive: true };
const STATUS_ICON_OPTIONS = [
  { value: 'box', label: 'กล่อง' },
  { value: 'computer', label: 'Computer' },
  { value: 'display', label: 'Monitor' },
  { value: 'printer', label: 'Printer' },
  { value: 'tools', label: 'เครื่องมือ' },
  { value: 'check', label: 'พร้อมใช้' },
  { value: 'clock', label: 'รอดำเนินการ' },
  { value: 'warning', label: 'ตรวจสอบ' },
  { value: 'repair', label: 'กำลังซ่อม' },
  { value: 'remove', label: 'ไม่ใช้งาน' },
  { value: 'star', label: 'อื่นๆ' },
];
const CATEGORY_ICON_OPTIONS = [
  { value: 'computer', label: 'Computer' }, { value: 'display', label: 'Monitor' },
  { value: 'ups', label: 'UPS' }, { value: 'printer', label: 'Printer' },
  { value: 'laptop', label: 'Laptop' }, { value: 'server', label: 'Server' },
  { value: 'network', label: 'เครือข่าย' }, { value: 'folder', label: 'อื่นๆ' },
];
const statusIconName = icon => STATUS_ICON_OPTIONS.find(option => option.value === icon)?.value || 'box';
const categoryIconName = icon => CATEGORY_ICON_OPTIONS.find(option => option.value === icon)?.value || 'folder';
const statusOptionMark = icon => ({ box: '▣', computer: '▦', display: '▱', printer: '▤', tools: '⚒', check: '✓', clock: '◷', warning: '△', repair: '✳', remove: '⊘', star: '✦' }[icon] || '▣');
const categoryOptionMark = icon => ({ computer: '▦', display: '▱', ups: '■', printer: '▤', laptop: '▱', server: '▥', network: '✶', folder: '▣' }[icon] || '▣');
const EMPTY_MEMBER = { fullName: '', username: '', role: 'employee', password: '', isActive: true };
const UI_TEXT = {
  filters: 'ตัวกรอง',
  goToPage: 'ไปยังหน้า',
  importTitle: 'นำเข้าจาก Excel',
  importHelp: 'เลือกไฟล์ Excel และกำหนดว่าแต่ละคอลัมน์จะนำไปใช้เป็นข้อมูลส่วนใด รหัสสินค้าจากไฟล์จะถูกนำมาใช้ตามที่กำหนด',
  worksheets: 'ชีตที่จะนำเข้า',
  worksheetMapping: 'ชีตที่กำลังจัดคู่คอลัมน์',
  columnMapping: 'จัดคู่คอลัมน์',
  mappingHelp: 'สามารถเลือกประเภทสินค้า ป้ายกำกับ และรายละเพิ่มเติมได้หลายคอลัมน์',
  quickAddType: 'เพิ่มประเภทใหม่',
  quickAddStatus: 'เพิ่มสถานะใหม่',
  firstItem: 'สินค้ารายการแรก',
  importItems: 'ชิ้น',
  cancel: 'ยกเลิก',
  import: 'นำเข้า',
  category: 'ประเภทสินค้า',
  allCategories: 'ทุกประเภท',
  unassigned: 'ไม่ระบุ',
  tag: 'ป้ายกำกับ',
  allTags: 'ทุกป้ายกำกับ',
  extraDetails: 'รายละเอียดเพิ่มเติม',
  searchPlaceholder: 'ชื่อสินค้า รหัส ป้ายกำกับ หรือรายละเอียดเพิ่มเติม...',
  clearFilters: 'ล้างตัวกรอง',
  allStatuses: 'ทุกสถานะ',
  productList: 'รายการสินค้า',
  searchHelp: 'ค้นหาชื่อ รหัส ป้ายกำกับ และรายละเพิ่มเติม',
  searchProducts: 'ค้นหาสินค้า',
  filterStatus: 'กรองตามสถานะ',
  product: 'สินค้า',
  quantity: 'จำนวน',
  status: 'สถานะ',
  addedByDate: 'เพิ่มโดย / วันที่',
  manage: 'จัดการ',
  loadingProducts: 'กำลังโหลดสินค้า...',
  noMatch: 'ไม่พบสินค้าที่ตรงกับคำค้นหาหรือตัวกรอง',
  noProducts: 'ยังไม่มีสินค้าในโปรเจกต์นี้',
  piece: 'ชิ้น',
  show: 'แสดง',
  of: 'จาก',
  records: 'รายการ',
  previous: 'ก่อนหน้า',
  page: 'หน้า',
  next: 'ถัดไป',
  statusSettings: 'จัดการสถานะและประเภทสินค้า',
  settings: 'ตั้งค่าระบบ',
  manageCategories: 'จัดการประเภทสินค้า',
  categoryHelp: 'Computer, Monitor, UPS และ Printer พร้อมเพิ่มหรือลบประเภทได้',
  categoryName: 'ชื่อประเภทสินค้า',
  exampleCategory: 'เช่น Laptop หรือ Server',
  addCategory: 'เพิ่มประเภท',
  noCategories: 'ยังไม่มีประเภทสินค้า',
  productStatuses: 'สถานะสินค้า',
  statusHelp: 'สถานะที่เปิดใช้จะแสดงในฟอร์มสินค้า',
  loading: 'กำลังโหลดข้อมูล...',
  statusActive: 'ใช้งาน',
  statusInactive: 'ปิดใช้งาน',
  productRecords: 'รายการสินค้า',
  addStatus: 'เพิ่มสถานะ',
};


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
    computer: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M8 9h8M8 12h5" /></>,
    display: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 22h8M12 18v4M7 8h10" /></>,
    printer: <><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7zM17 11h.01" /></>,
    tools: <><path d="M14.5 6.5a5 5 0 0 0-6.4 6.4L3 18l3 3 5.1-5.1a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z" /><path d="m16 16 5 5" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    repair: <><path d="M14.5 6.5a5 5 0 0 0-6.4 6.4L3 18l3 3 5.1-5.1a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z" /><path d="M19 14v6M16 17h6" /></>,
    remove: <><circle cx="12" cy="12" r="9" /><path d="m7 7 10 10" /></>,
    star: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></>,
    ups: <><rect x="3" y="6" width="17" height="12" rx="2" /><path d="M20 10h2v4h-2M12 8l-3 4h3l-1 4 4-5h-3l1-3" /></>,
    laptop: <><rect x="5" y="4" width="14" height="11" rx="1.5" /><path d="M3 19h18l-2-4H5l-2 4Z" /></>,
    server: <><rect x="4" y="3" width="16" height="8" rx="2" /><rect x="4" y="13" width="16" height="8" rx="2" /><path d="M8 7h.01M8 17h.01M12 7h4M12 17h4" /></>,
    network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="m10.8 7.2-4.6 8.5M13.2 7.2l4.6 8.5M7.5 18h9" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M3 10h18" /></>,
    tag: <><path d="M20.5 13 13 20.5 3.5 11V3.5H11L20.5 13Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    spreadsheet: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
    columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
    skip: <><path d="M5 5v14l11-7L5 5Z" /><path d="M19 5v14" /></>,
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.box}</svg>;
}

function StatusIcon({ name = 'box', size = 15 }) {
  return <span className="semantic-icon"><Icon name={statusIconName(name)} size={size} /></span>;
}

function CategoryIcon({ name = 'folder', size = 16 }) {
  return <span className="semantic-icon"><Icon name={categoryIconName(name)} size={size} /></span>;
}

function StatusBadge({ status }) {
  return <span className="stock-badge" style={{ '--status-color': status?.color || '#1769E0' }}><StatusIcon name={status?.icon} />{status?.name || 'ไม่ระบุ'}</span>;
}

function CheckboxFilterDropdown({ label, icon, options, selectedValues, onChange, searchable = true }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filteredOptions = options.filter(option => option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const toggle = value => {
    const normalized = String(value);
    onChange(selectedValues.includes(normalized) ? selectedValues.filter(item => item !== normalized) : [...selectedValues, normalized]);
  };

  return <div className="filter-dropdown" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button className={'filter-dropdown__trigger' + (open ? ' filter-dropdown__trigger--open' : '')} type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">{icon}</span><span>{label}</span>{selectedValues.length > 0 && <b>{selectedValues.length}</b>}<span className="filter-dropdown__chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="filter-dropdown__menu">
      {searchable && <input className="filter-dropdown__search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหา..." aria-label={'ค้นหา' + label} />}
      <div className="filter-dropdown__options">
        {filteredOptions.map(option => <label className="filter-dropdown__option" key={option.value}>
          <input type="checkbox" checked={selectedValues.includes(String(option.value))} onChange={() => toggle(option.value)} />
          <span className="filter-dropdown__option-icon" aria-hidden="true">{option.icon}</span><span className="filter-dropdown__option-label">{option.label}</span>
        </label>)}
        {filteredOptions.length === 0 && <span className="filter-dropdown__empty">ไม่พบรายการ</span>}
      </div>
    </div>}
  </div>;
}

function ProductTable({ products, statuses, loading, searchTerm, onSearchChange, onClearSearch, statusFilter, tagFilter, categoryFilter, onStatusFilterChange, onTagFilterChange, onCategoryFilterChange, onEdit, onDelete, deletingId, canDelete = true, availableTags, categories, totalCount, page, pageSize, onPageChange }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstItem = totalCount ? ((page - 1) * pageSize) + 1 : 0;
  const lastItem = Math.min(page * pageSize, totalCount);
  const selectedStatusIds = Array.isArray(statusFilter) ? statusFilter : statusFilter ? [String(statusFilter)] : [];
  const selectedCategoryIds = Array.isArray(categoryFilter) ? categoryFilter : categoryFilter ? [String(categoryFilter)] : [];
  const selectedTags = Array.isArray(tagFilter) ? tagFilter : tagFilter ? [String(tagFilter)] : [];
  const activeFilterCount = selectedStatusIds.length + selectedCategoryIds.length + selectedTags.length;
  const hasActiveFilters = Boolean(searchTerm.trim() || activeFilterCount);
  const jumpToPage = event => {
    const target = Math.min(totalPages, Math.max(1, Number.parseInt(event.currentTarget.value, 10) || 1));
    event.currentTarget.value = String(target);
    onPageChange(target);
  };
  const clearFilters = () => {
    onStatusFilterChange([]); onTagFilterChange([]); onCategoryFilterChange([]); onClearSearch();
  };
  return <section className="products-panel">
    <div className="panel-heading">
      <div><h2>{UI_TEXT.productList}</h2><p>{UI_TEXT.searchHelp}</p></div>
    </div>
    <div className="product-search-row"><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">{UI_TEXT.searchProducts}</span><input type="search" value={searchTerm} onChange={onSearchChange} placeholder={UI_TEXT.searchPlaceholder} /></label></div>
    <div className="product-filter-toggle-row"><button className={'filter-toggle' + (filtersOpen ? ' filter-toggle--open' : '')} type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}>{UI_TEXT.filters}{activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}<span aria-hidden="true">⌄</span></button></div>
    {filtersOpen && <div className="product-filters-panel">
      <CheckboxFilterDropdown label={UI_TEXT.status} icon={<Icon name="check" size={15} />} options={statuses.map(status => ({ value: status.id, label: status.name, icon: <StatusIcon name={status.icon} size={14} /> }))} selectedValues={selectedStatusIds} onChange={onStatusFilterChange} />
      <CheckboxFilterDropdown label={UI_TEXT.category} icon={<Icon name="folder" size={15} />} options={categories.map(category => ({ value: category.id, label: category.name, icon: <CategoryIcon name={category.icon} size={14} /> }))} selectedValues={selectedCategoryIds} onChange={onCategoryFilterChange} />
      <CheckboxFilterDropdown label={UI_TEXT.tag} icon={<Icon name="tag" size={15} />} options={availableTags.map(tag => ({ value: tag, label: tag, icon: <Icon name="tag" size={14} /> }))} selectedValues={selectedTags} onChange={onTagFilterChange} />
      {hasActiveFilters && <button className="filter-clear-button" type="button" onClick={clearFilters}>{UI_TEXT.clearFilters}</button>}
    </div>}
    <div className="table-wrap"><table className="products-table project-products-table">
      <caption className="sr-only">{UI_TEXT.productList}</caption>
      <thead><tr><th>{UI_TEXT.product}</th><th>{UI_TEXT.category}</th><th>{UI_TEXT.quantity}</th><th>{UI_TEXT.status}</th><th>{UI_TEXT.tag} / {UI_TEXT.extraDetails}</th><th>{UI_TEXT.addedByDate}</th><th>{UI_TEXT.manage}</th></tr></thead>
      <tbody>
        {loading && <tr><td className="table-message" colSpan="7"><span className="spinner" />{UI_TEXT.loadingProducts}</td></tr>}
        {!loading && products.length === 0 && <tr><td className="table-message" colSpan="7">{hasActiveFilters ? UI_TEXT.noMatch : UI_TEXT.noProducts}</td></tr>}
        {!loading && products.map(product => <tr key={product.id}>
          <td data-label={UI_TEXT.product}><div className="product-name"><span className="product-avatar"><Icon name="box" size={16} /></span><span><strong>{product.name}</strong><small>{product.productCode || ('#' + product.id)}</small></span></div></td>
          <td data-label={UI_TEXT.category}>{product.category?.name || UI_TEXT.unassigned}</td>
          <td data-label={UI_TEXT.quantity}><strong>{Number(product.quantity).toLocaleString('th-TH')}</strong> {UI_TEXT.piece}</td>
          <td data-label={UI_TEXT.status}><StatusBadge status={product.status} /></td>
          <td data-label={UI_TEXT.tag + ' / ' + UI_TEXT.extraDetails}><div className="product-extra">{(product.tags || []).map(tag => <span className="product-tag" key={tag}>{tag}</span>)}{Object.entries(product.customFields || {}).map(([key, value]) => <span className="product-custom-field" key={key}><strong>{key}:</strong> {value}</span>)}</div></td>
          <td data-label={UI_TEXT.addedByDate}><span className="product-created"><strong>{product.addedBy || '?'}</strong><small>{product.createdAt ? new Date(product.createdAt).toLocaleString('th-TH') : '?'}</small></span></td>
          <td data-label={UI_TEXT.manage}><div className="row-actions"><button className="icon-button icon-button--edit" type="button" onClick={() => onEdit(product)} aria-label={'แก้ไข ' + product.name}><Icon name="edit" size={17} /></button>{canDelete && <button className="icon-button icon-button--delete" type="button" onClick={() => onDelete(product)} disabled={deletingId === product.id} aria-label={'ลบ ' + product.name}><Icon name="trash" size={17} /></button>}</div></td>
        </tr>)}
      </tbody>
    </table></div>
    <div className="panel-footer product-pagination"><span>{UI_TEXT.show} {firstItem.toLocaleString()}-{lastItem.toLocaleString()} {UI_TEXT.of} {totalCount.toLocaleString()} {UI_TEXT.records}</span><div><button className="button button--secondary button--small" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1}>{UI_TEXT.previous}</button><label className="page-jump"><span className="sr-only">{UI_TEXT.goToPage}</span><input key={page} type="number" min="1" max={totalPages} defaultValue={page} onBlur={jumpToPage} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); jumpToPage(event); event.currentTarget.blur(); } }} disabled={loading} /><span>/ {totalPages.toLocaleString()}</span></label><button className="button button--secondary button--small" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || page >= totalPages}>{UI_TEXT.next}</button></div></div>
  </section>;
}
const DASHBOARD_DIMENSIONS = [
  { value: 'status', label: 'สถานะ', icon: 'check' },
  { value: 'category', label: 'ประเภทสินค้า', icon: 'folder' },
  { value: 'tag', label: 'ป้ายกำกับ', icon: 'tag' },
];
const DASHBOARD_PALETTE = ['#3478d4', '#3e9d83', '#efaa49', '#8d72cf', '#e47777', '#46a3b8', '#718096'];

function ProjectDashboard({ statuses, categories, loading, totalCount, dashboardBy, onDashboardByChange, dashboardCounts = [] }) {
  const groupItems = dashboardCounts.map((item, index) => {
    const status = dashboardBy === 'status' ? statuses.find(option => String(option.id) === String(item.id)) : null;
    const category = dashboardBy === 'category' ? categories.find(option => String(option.id) === String(item.id)) : null;
    const fallbackColor = DASHBOARD_PALETTE[index % DASHBOARD_PALETTE.length];
    return {
      ...item,
      name: item.name || (item.id === 'unassigned' ? UI_TEXT.unassigned : 'ไม่ระบุ'),
      count: Number(item.count) || 0,
      icon: dashboardBy === 'status' ? (status?.icon || item.icon || 'box') : dashboardBy === 'category' ? (category?.icon || item.icon || 'folder') : 'tag',
      color: status?.color || fallbackColor,
    };
  });
  const aggregateTotal = groupItems.reduce((sum, item) => sum + item.count, 0);
  let currentAngle = 0;
  const segments = groupItems.filter(item => item.count > 0).map(item => {
    const start = currentAngle;
    currentAngle += (item.count / aggregateTotal) * 360;
    return item.color + ' ' + start + 'deg ' + currentAngle + 'deg';
  });
  const chartStyle = { background: aggregateTotal ? 'conic-gradient(' + segments.join(', ') + ')' : '#e9eef5' };
  const activeDimension = DASHBOARD_DIMENSIONS.find(item => item.value === dashboardBy) || DASHBOARD_DIMENSIONS[0];

  return <section className="status-chart-panel" aria-labelledby="status-chart-title">
    <div className="panel-heading">
      <div><h2 id="status-chart-title">ภาพรวมสินค้า</h2><p>สรุปรายการตามตัวกรองล่าสุด</p></div>
      <label className="dashboard-dimension"><span className="dashboard-dimension__label"><Icon name={activeDimension.icon} size={15} />แสดงตาม</span><select value={dashboardBy} onChange={event => onDashboardByChange(event.target.value)}>{DASHBOARD_DIMENSIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </div>
    <div className="status-chart-content">
      <div className="status-donut" style={chartStyle} role="img" aria-label={'สินค้า ' + totalCount + ' รายการ แยกตาม' + activeDimension.label}>
        <div className="status-donut__center"><strong>{loading ? '…' : Number(totalCount).toLocaleString('th-TH')}</strong><span>รายการ</span></div>
      </div>
      <div className={'status-chart-legend' + (groupItems.length > 5 ? ' status-chart-legend--scroll' : '')} aria-label={'รายละตาม' + activeDimension.label}>
        {groupItems.map((item, index) => <div className="status-chart-legend__item" key={item.id}>
          <span className="status-chart-legend__rank">{String(index + 1).padStart(2, '0')}</span>
          <span className="status-chart-legend__swatch" style={{ '--item-color': item.color }}>
            {dashboardBy === 'category' ? <CategoryIcon name={item.icon} size={15} /> : dashboardBy === 'status' ? <StatusIcon name={item.icon} size={15} /> : <Icon name="tag" size={15} />}
          </span>
          <span className="status-chart-legend__name">{item.name || UI_TEXT.unassigned}</span>
          <strong>{loading ? '—' : item.count.toLocaleString('th-TH')}</strong>
          <small>{aggregateTotal ? Math.round((item.count / aggregateTotal) * 100) + '%' : '0%'}</small>
        </div>)}
        {!loading && groupItems.length === 0 && <p className="status-chart-empty">ไม่มีรายการตามตัวกรอง</p>}
      </div>
    </div>
  </section>;
}
function ProjectsPage({ projects, loading, canCreate, canDelete, deletingProjectId, onCreate, onOpen, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredProjects = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? projects.filter(project => (project.name + ' ' + project.code).toLowerCase().includes(query)) : projects;
  }, [projects, searchTerm]);

  return <>
    <section className="welcome-section"><div><p className="eyebrow">Workspace</p><h1>Projects</h1><p className="welcome-copy">Choose a project to view and manage its inventory.</p></div>{canCreate && <button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> Create project</button>}</section>
    <div className="project-list-tools"><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Search projects</span><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search project name or code..." /></label><small>Showing {filteredProjects.length.toLocaleString()} of {projects.length.toLocaleString()} projects</small></div>
    <section className="project-grid" aria-label="Projects">
      {loading && <p className="table-message">Loading projects...</p>}
      {!loading && filteredProjects.map(project => <article className="project-card" key={project.id}>
        <button className="project-card__open" type="button" onClick={() => onOpen(project)}><span className="project-card__icon"><Icon name="package" size={21} /></span><span className="project-card__body"><strong>{project.name}</strong><small>Project code {project.code}</small></span><span className="project-card__count"><strong>{Number(project.productCount).toLocaleString()}</strong><small>products</small></span><span className="project-card__arrow">&rarr;</span></button>
        {canDelete && <button className="icon-button icon-button--delete project-card__delete" type="button" onClick={() => onDelete(project)} disabled={deletingProjectId !== null} aria-label={'Delete project ' + project.name}><Icon name="trash" size={17} /></button>}
      </article>)}
      {!loading && projects.length === 0 && <div className="project-empty"><span className="project-empty__icon"><Icon name="package" size={23} /></span><h2>No projects yet</h2><p>Create a project to start managing a separate inventory.</p>{canCreate && <button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> Create project</button>}</div>}
      {!loading && projects.length > 0 && filteredProjects.length === 0 && <div className="project-empty"><h2>No projects found</h2><p>Try another project name or code.</p></div>}
    </section>
  </>;
}

function ProjectDetailPage({ project, products, statuses, categories, loading, searchTerm, onSearchChange, onClearSearch, onBack, onCreateProduct, onImport, onEdit, onDelete, deletingId, canDelete, dashboardBy, onDashboardByChange, dashboardCounts, productStatusFilter, productTagFilter, productCategoryFilter, onStatusFilterChange, onTagFilterChange, onCategoryFilterChange, availableProductTags, productsTotal, productPage, onPageChange }) {
  if (!project && loading) return <div className="project-loading"><span className="spinner" />กำลังโหลดโปรเจกต์...</div>;
  if (!project) return <section className="project-not-found"><h1>ไม่พบโปรเจกต์</h1><p>โปรเจกต์นี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง</p><button className="button button--secondary" type="button" onClick={onBack}>กลับไปหน้าโปรเจกต์</button></section>;
  return <>
    <section className="welcome-section project-detail-heading">
      <div><button className="back-link" type="button" onClick={onBack}>&larr; โปรเจกต์ทั้งหมด</button><p className="eyebrow">โปรเจกต์ {project.code}</p><h1>{project.name}</h1><p className="welcome-copy">รหัสสินค้าในโปรเจกต์นี้ใช้ Prefix {project.code}-</p></div>
      <div className="project-actions"><button className="button button--secondary" type="button" onClick={onImport}>{'นำเข้า'} Excel</button><button className="button button--primary" type="button" onClick={onCreateProduct}><Icon name="plus" size={19} /> เพิ่มสินค้า</button></div>
    </section>
    <ProjectDashboard statuses={statuses} categories={categories} loading={loading} totalCount={productsTotal} dashboardBy={dashboardBy} onDashboardByChange={onDashboardByChange} dashboardCounts={dashboardCounts} />
    <ProductTable products={products} statuses={statuses} loading={loading} searchTerm={searchTerm} onSearchChange={onSearchChange} onClearSearch={onClearSearch} statusFilter={productStatusFilter} tagFilter={productTagFilter} categoryFilter={productCategoryFilter} onStatusFilterChange={onStatusFilterChange} onTagFilterChange={onTagFilterChange} onCategoryFilterChange={onCategoryFilterChange} availableTags={availableProductTags} categories={categories} totalCount={productsTotal} page={productPage} pageSize={100} onPageChange={onPageChange} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} canDelete={canDelete} />
  </>;
}
function ProjectModal({ open, form, submitting, error, onChange, onSubmit, onClose }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title"><div className="modal__header"><div><p className="eyebrow">พื้นที่ทำงาน</p><h2 id="project-form-title">สร้างโปรเจคใหม่</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={onSubmit}><label className="form-field"><span>รหัสโปรเจค <b>*</b></span><input name="code" type="text" value={form.code} onChange={onChange} maxLength="20" autoComplete="off" placeholder="เช่น coj" required /><small className="field-help">ใช้ a–z, 0–9, ขีดกลาง หรือขีดล่าง รหัสนี้จะเป็น Prefix ของสินค้า</small></label><label className="form-field"><span>ชื่อโปรเจค <b>*</b></span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="120" autoFocus required /></label><div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}สร้างโปรเจค</button></div></form></section></div>;
}

const normalizeExcelHeader = value => String(value ?? '').trim().toLowerCase().replace(/[\s_\-./()]+/g, '');
const isTagHeader = value => /(?:^|[^a-z])tags?(?:$|[^a-z])|ป้ายกำกับ/i.test(String(value ?? ''));

function inferExcelMappings(headers, dataRows) {
  const normalized = headers.map(normalizeExcelHeader);
  const findColumn = (aliases, thaiPattern) => normalized.findIndex(header => aliases.includes(header) || (thaiPattern && thaiPattern.test(header)));
  const hasCodeValues = index => {
    if (index < 0) return false;
    const values = dataRows.slice(0, 20).map(row => String(row[index] ?? '').trim()).filter(Boolean);
    return values.length > 0 && values.filter(value => /^[a-z0-9]{3,}[-_][a-z0-9-]{3,}$/i.test(value)).length / values.length >= 0.6;
  };
  let nameIndex = findColumn(['productname', 'product', 'name', 'item'], /^(?:ชื่อ|ชื่อสินค้า)$/);
  let productCodeIndex = findColumn(['productid', 'productcode', 'assetid', 'id', 'code'], /รหัส/);
  if (productCodeIndex < 0 && hasCodeValues(nameIndex)) productCodeIndex = nameIndex;
  if (productCodeIndex < 0) {
    const codeValueIndex = headers.findIndex((_, index) => hasCodeValues(index));
    if (codeValueIndex >= 0) productCodeIndex = codeValueIndex;
  }
  if (nameIndex === productCodeIndex) nameIndex = -1;
  if (nameIndex < 0) nameIndex = headers.findIndex((_, index) => index !== productCodeIndex && headers[index]);
  const quantityIndex = findColumn(['quantity', 'qty', 'amount'], /จำนวน/);
  const statusIndex = findColumn(['status', 'productstatus'], /สถานะ/);
  const categoryIndex = findColumn(['category', 'productcategory', 'type'], /ประเภท/);
  const duplicateHeaders = new Set(normalized.filter((header, index) => header && normalized.indexOf(header) !== index));
  return headers.map((header, index) => {
    if (!header) return 'ignore';
    if (index === nameIndex) return 'name';
    if (index === productCodeIndex) return 'productCode';
    if (index === quantityIndex) return 'quantity';
    if (index === statusIndex) return 'status';
    if (index === categoryIndex) return 'category';
    return isTagHeader(header) || duplicateHeaders.has(normalized[index]) ? 'tag' : 'field';
  });
}

function ExcelImportModal({ open, project, activeStatuses, categories, submitting, apiError, onImport, onClearError, onClose }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [workbookSheets, setWorkbookSheets] = useState([]);
  const [sheetConfigs, setSheetConfigs] = useState({});
  const [selectedSheetIndex, setSelectedSheetIndex] = useState('0');
  const [selectedSheetIndices, setSelectedSheetIndices] = useState(['0']);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  if (!open) return null;

  const prepareSheet = sheet => {
    const sheetRows = Array.isArray(sheet?.data)
      ? sheet.data
      : Array.isArray(sheet?.rows)
        ? sheet.rows
        : Array.isArray(sheet)
          ? sheet
          : [];
    const normalizedRows = sheetRows.map(row => Array.isArray(row) ? row : [row]);
    if (normalizedRows.length < 2) throw new Error('ชีตต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 แถว');
    const nextHeaders = normalizedRows[0].map(value => String(value ?? '').trim());
    const nextRows = normalizedRows.slice(1).filter(row => row.some(value => String(value ?? '').trim() !== ''));
    if (!nextRows.length) throw new Error('ไม่พบแถวข้อมูลสินค้าในชีตนี้');
    return { headers: nextHeaders, rows: nextRows, mappings: inferExcelMappings(nextHeaders, nextRows), defaultCategoryId: '' };
  };

  const activateSheet = config => {
    setHeaders(config.headers);
    setRows(config.rows);
    setMappings(config.mappings);
    setDefaultCategoryId(config.defaultCategoryId || '');
  };

  const handleFileChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    onClearError();
    setError('');
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setWorkbookSheets([]);
    setSheetConfigs({});
    setSelectedSheetIndex('0');
    setSelectedSheetIndices([]);
    setDefaultCategoryId('');
    setFileName(file.name);
    if (file.size > 10 * 1024 * 1024) { setError('ขนาดไฟล์ต้องไม่เกิน 10 MB'); return; }
    setReading(true);
    try {
      const parsedWorkbook = await readXlsxFile(file);
      const sheets = Array.isArray(parsedWorkbook)
        && parsedWorkbook.some(sheet => sheet && typeof sheet === 'object' && ('data' in sheet || 'rows' in sheet))
        ? parsedWorkbook
        : [{ sheet: 'ชีต 1', data: parsedWorkbook }];
      const usableSheets = [];
      const nextSheetConfigs = {};
      sheets.forEach(sheet => {
        try {
          const config = prepareSheet(sheet);
          nextSheetConfigs[String(usableSheets.length)] = config;
          usableSheets.push(sheet);
        } catch {
          // Skip empty worksheets; a workbook may contain tabs without product rows.
        }
      });
      if (!usableSheets.length) throw new Error('ไม่พบชีตที่มีแถวหัวตารางและข้อมูล');
      setWorkbookSheets(usableSheets);
      setSheetConfigs(nextSheetConfigs);
      setSelectedSheetIndex('0');
      setSelectedSheetIndices(['0']);
      activateSheet(nextSheetConfigs['0']);
    } catch (parseError) {
      setError(parseError.message || 'อ่านไฟล์ Excel นี้ไม่ได้');
    } finally {
      setReading(false);
      event.target.value = '';
    }
  };

  const handleSheetChange = event => {
    const index = event.target.value;
    setSelectedSheetIndex(index);
    setError('');
    const config = sheetConfigs[index];
    if (config) {
      activateSheet(config);
    } else {
      setHeaders([]);
      setRows([]);
      setMappings([]);
       setError('อ่านชีตนี้ไม่ได้');
    }
  };

  const updateMapping = (columnIndex, nextKind) => {
    const nextMappings = mappings.map((kind, index) => {
      if (index === columnIndex) return nextKind;
      if (['name', 'productCode', 'quantity', 'status', 'category'].includes(nextKind) && kind === nextKind) return 'field';
      return kind;
    });
    setMappings(nextMappings);
    setSheetConfigs(current => ({
      ...current,
      [selectedSheetIndex]: { ...current[selectedSheetIndex], mappings: nextMappings },
    }));
    setError('');
  };

  const updateDefaultCategory = event => {
    const nextCategoryId = event.target.value;
    setDefaultCategoryId(nextCategoryId);
    setSheetConfigs(current => ({
      ...current,
      [selectedSheetIndex]: { ...current[selectedSheetIndex], defaultCategoryId: nextCategoryId },
    }));
  };

  const toggleSheetSelection = index => {
    const key = String(index);
    setSelectedSheetIndices(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key].sort((left, right) => Number(left) - Number(right)));
    setError('');
  };

  const mapSheetProducts = config => {
    if (!config) return [];
    const { headers: sheetHeaders, rows: sheetRows, mappings: sheetMappings } = config;
    const nameIndex = sheetMappings.indexOf('name');
    const codeIndex = sheetMappings.indexOf('productCode');
    const quantityIndex = sheetMappings.indexOf('quantity');
    const statusIndex = sheetMappings.indexOf('status');
    const categoryIndex = sheetMappings.indexOf('category');
    const defaultStatusId = activeStatuses[0]?.id;
    return sheetRows.map(row => {
      const name = nameIndex < 0 ? '' : String(row[nameIndex] ?? '').trim();
      const rawCode = codeIndex < 0 ? '' : String(row[codeIndex] ?? '').trim();
      const rawQuantity = quantityIndex < 0 || String(row[quantityIndex] ?? '').trim() === '' ? 1 : Number(row[quantityIndex]);
      const rawStatus = statusIndex < 0 ? '' : String(row[statusIndex] ?? '').trim();
      const rawCategory = categoryIndex < 0 ? '' : String(row[categoryIndex] ?? '').trim();
      const matchingCategory = categories.find(category => category.name.trim().toLowerCase() === rawCategory.toLowerCase() || String(category.id) === rawCategory);
      const matchingStatus = activeStatuses.find(status => status.name.trim().toLowerCase() === rawStatus.toLowerCase() || String(status.id) === rawStatus);
      const tags = sheetMappings.flatMap((kind, index) => kind === 'tag' ? String(row[index] ?? '').split(/[,;|]/).map(tag => tag.trim()).filter(Boolean) : []);
      const customFields = {};
      sheetMappings.forEach((kind, index) => {
        if (kind !== 'field') return;
        const value = String(row[index] ?? '').trim();
        if (!value) return;
        const baseKey = sheetHeaders[index] || ('รายละเพิ่มเติม ' + (index + 1));
        let key = baseKey;
        let suffix = 2;
        while (Object.prototype.hasOwnProperty.call(customFields, key)) key = baseKey + ' (' + suffix++ + ')';
        customFields[key] = value;
      });
      const sheetDefaultCategoryId = config.defaultCategoryId || '';
      return { name: name || 'unaname', productCode: rawCode || undefined, quantity: rawQuantity, statusId: matchingStatus?.id || defaultStatusId, categoryId: matchingCategory?.id || (!rawCategory && sheetDefaultCategoryId ? Number(sheetDefaultCategoryId) : null), invalidStatus: Boolean(rawStatus && !matchingStatus), invalidCategory: Boolean(rawCategory && !matchingCategory), tags: [...new Set(tags)], customFields };
    });
  };

  const mappedProducts = () => selectedSheetIndices.flatMap(index => mapSheetProducts(sheetConfigs[index]));

  const importProducts = () => {
    const items = mappedProducts();
    if (!selectedSheetIndices.length) { setError('เลือกชีตที่ต้องการนำเข้าอย่างน้อย 1 ชีต'); return; }
    if (!activeStatuses.length) { setError('เพิ่มสถานะสินค้าก่อนนำเข้า'); return; }
    const invalidQuantity = items.findIndex(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000);
    if (invalidQuantity >= 0) { setError('จำนวนต้องเป็นเลขเต็ม 1 ถึง 10,000 ในแถวที่ ' + (invalidQuantity + 2) + ' ของไฟล์'); return; }
    if (items.length > 10000) { setError('นำเข้าได้ไม่เกิน 10,000 แถวต่อครั้ง'); return; }
    if (items.some(item => item.productCode && item.quantity > 1)) { setError('รายการที่มีรหัสสินค้าในไฟล์ต้องมีจำนวน 1 ชิ้น'); return; }
    if (items.reduce((sum, item) => sum + item.quantity, 0) > 10000) { setError('นำเข้าได้ไม่เกิน 10,000 ชิ้นต่อครั้ง'); return; }
    const invalidStatus = items.findIndex(item => item.invalidStatus);
    if (invalidStatus >= 0) { setError('ไม่พบสถานะที่แถว ' + (invalidStatus + 2) + ' ของไฟล์'); return; }
    const invalidCategory = items.findIndex(item => item.invalidCategory);
    if (invalidCategory >= 0) { setError('ไม่พบประเภทสินค้าที่แถว ' + (invalidCategory + 2) + ' ของไฟล์'); return; }
    onImport(items);
  };

  const selectedProducts = mappedProducts();
  const totalRows = selectedProducts.length;
  const totalItems = selectedProducts.reduce((sum, item) => sum + (Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0), 0);
  const mappingOptions = [
    ['ignore', '— ' + 'ไม่ใช้'],
    ['name', '□ ' + 'ชื่อสินค้า'],
    ['productCode', '# ' + 'รหัสสินค้า'],
    ['quantity', '≣ ' + 'จำนวน'],
    ['status', '◉ ' + UI_TEXT.status],
    ['category', '▣ ' + UI_TEXT.category],
    ['tag', '◇ ' + UI_TEXT.tag],
    ['field', '☷ ' + UI_TEXT.extraDetails],
  ];

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !submitting && !reading) onClose(); }}>
    <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-form-title">
      <div className="modal__header import-header">
        <div><p className="eyebrow">{'โปรเจก'} {project.code}</p><h2 id="import-form-title">{UI_TEXT.importTitle}</h2></div>
        <button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" disabled={submitting}><Icon name="close" size={20} /></button>
      </div>
      <p className="import-help">{UI_TEXT.importHelp}</p>
      <label className="file-picker"><span>{fileName || 'เลือกไฟล์ Excel (.xlsx)'}</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} disabled={reading || submitting} /></label>
      {workbookSheets.length > 0 && <fieldset className="import-sheet-selection"><legend>{UI_TEXT.worksheets}</legend><div>{workbookSheets.map((sheet, index) => <label key={index}><input type="checkbox" checked={selectedSheetIndices.includes(String(index))} onChange={() => toggleSheetSelection(index)} disabled={reading || submitting} /><span className="import-sheet-selection__number">{String(index + 1).padStart(2, '0')}</span><Icon name="spreadsheet" size={15} /><span>{sheet.sheet || sheet.name || ('ชีต ' + (index + 1))}</span></label>)}</div></fieldset>}
      {reading && <p className="import-state"><span className="spinner" />{'กำลังอ่านไฟล์...'}</p>}
      {headers.length > 0 && <div className="import-column-mappings">
        <div className="import-column-mappings__heading"><div><strong><span className="semantic-icon"><Icon name="columns" size={17} /></span>{UI_TEXT.columnMapping}</strong><small>{UI_TEXT.mappingHelp}</small></div>{workbookSheets.length > 0 && <label className="import-sheet-picker"><span><span className="semantic-icon"><Icon name="spreadsheet" size={15} /></span>{UI_TEXT.worksheetMapping}</span><select value={selectedSheetIndex} onChange={handleSheetChange} disabled={reading || submitting}>{workbookSheets.map((sheet, index) => <option value={String(index)} key={index}>{String(index + 1).padStart(2, '0') + ' · ' + (sheet.sheet || sheet.name || ('ชีต ' + (index + 1)))}</option>)}</select></label>}</div>
        <label className="import-default-category"><span><CategoryIcon name={categories.find(category => String(category.id) === String(defaultCategoryId))?.icon || 'folder'} />{UI_TEXT.category}</span><select value={defaultCategoryId} onChange={updateDefaultCategory} disabled={reading || submitting}><option value="">{'— ' + UI_TEXT.unassigned}</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {headers.map((header, index) => <label className="import-column-mapping" key={index}><span className="import-column-mapping__number">{String(index + 1).padStart(2, '0')}</span><span className="import-column-mapping__header"><strong>{header || ('คอลัมน์ ' + (index + 1))}</strong><small>{String(rows[0]?.[index] ?? '').slice(0, 60) || 'ไม่มีตัวอย่าง'}</small></span><select value={mappings[index] || 'ignore'} onChange={event => updateMapping(index, event.target.value)}>{mappingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}
      </div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {apiError && <div className="form-error" role="alert">{apiError}</div>}
      {selectedProducts.length > 0 && <div className="import-preview"><strong>{'พร้อมนำเข้า'} {totalRows.toLocaleString('th-TH')} {'แถว ('}{totalItems.toLocaleString('th-TH')} {'ชิ้น)'}</strong><small>{UI_TEXT.firstItem}: {selectedProducts[0]?.name || 'เลือกคอลัมน์ชื่อสินค้า'}</small></div>}
      <div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose} disabled={submitting}>{UI_TEXT.cancel}</button><button className="button button--primary" type="button" onClick={importProducts} disabled={!selectedProducts.length || submitting || reading}>{submitting && <span className="spinner spinner--light" />}{UI_TEXT.import} {totalItems ? totalItems.toLocaleString('th-TH') + ' ' + UI_TEXT.importItems : UI_TEXT.product}</button></div>
    </section>
  </div>;
}

function StatusesPage({ statuses, loading, productCategories, isOwner, onCreate, onEdit, onDelete, onCreateCategory, onUpdateCategory, onDeleteCategory }) {
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('folder');
  const [categoryError, setCategoryError] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('folder');
  const [categoryIconSaving, setCategoryIconSaving] = useState(false);

  const submitCategory = async event => {
    event.preventDefault();
    if (!categoryName.trim()) { setCategoryError('กรุณกรอกชื่อประเภท'); return; }
    setCategorySubmitting(true); setCategoryError('');
    try { await onCreateCategory(categoryName.trim(), categoryIcon); setCategoryName(''); setCategoryIcon('folder'); }
    catch (error) { setCategoryError(error.message || 'เพิ่มประเภทไม่สำเร็จ'); }
    finally { setCategorySubmitting(false); }
  };

  const saveCategoryIcon = async category => {
    setCategoryIconSaving(true); setCategoryError('');
    try { await onUpdateCategory(category.id, editingCategoryIcon); setEditingCategoryId(null); }
    catch (error) { setCategoryError(error.message || 'บันทึกไอคอนไม่สำเร็จ'); }
    finally { setCategoryIconSaving(false); }
  };

  const startEditingIcon = category => {
    setEditingCategoryId(category.id);
    setEditingCategoryIcon(category.icon || 'folder');
  };

  return <>
    <section className="welcome-section"><div><p className="eyebrow">{UI_TEXT.settings}</p><h1>{UI_TEXT.statusSettings}</h1><p className="welcome-copy">{UI_TEXT.statusHelp}</p></div></section>
    <section className="status-panel"><div className="panel-heading"><div><h2>{UI_TEXT.manageCategories}</h2><p>{UI_TEXT.categoryHelp}</p></div></div>
      <form className="category-create-form" onSubmit={submitCategory}>
        <label className="form-field"><span>{UI_TEXT.categoryName}</span><input value={categoryName} onChange={event => setCategoryName(event.target.value)} maxLength="60" placeholder={UI_TEXT.exampleCategory} required /></label>
        <label className="category-icon-select"><span>ไอคอน</span><span className="select-with-icon"><CategoryIcon name={categoryIcon} size={16} /><select value={categoryIcon} onChange={event => setCategoryIcon(event.target.value)}>{CATEGORY_ICON_OPTIONS.map(option => <option key={option.value} value={option.value}>{categoryOptionMark(option.value) + ' ' + option.label}</option>)}</select></span></label>
        <button className="button button--primary" type="submit" disabled={categorySubmitting}><Icon name="plus" size={17} /> {UI_TEXT.addCategory}</button>
      </form>
      {categoryError && <p className="form-error category-error" role="alert">{categoryError}</p>}
      <div className="category-list">{productCategories.map((category, index) => <article className={'category-chip' + (editingCategoryId === category.id ? ' category-chip--editing' : '')} key={category.id}>
        <span className="category-chip__number">{String(index + 1).padStart(2, '0')}</span>
        <CategoryIcon name={editingCategoryId === category.id ? editingCategoryIcon : category.icon} size={17} />
        <span className="category-chip__name">{category.name}</span>
        {isOwner && editingCategoryId === category.id ? <>
          <select className="category-icon-editor" value={editingCategoryIcon} onChange={event => setEditingCategoryIcon(event.target.value)} aria-label={'ไอคอน ' + category.name}>{CATEGORY_ICON_OPTIONS.map(option => <option key={option.value} value={option.value}>{categoryOptionMark(option.value) + ' ' + option.label}</option>)}</select>
          <button className="icon-button category-icon-save" type="button" onClick={() => saveCategoryIcon(category)} disabled={categoryIconSaving} aria-label={'Save icon for ' + category.name}><Icon name="check" size={15} /></button>
          <button className="icon-button" type="button" onClick={() => setEditingCategoryId(null)} disabled={categoryIconSaving} aria-label="Cancel icon editing"><Icon name="close" size={15} /></button>
        </> : isOwner && <button className="icon-button category-icon-edit" type="button" onClick={() => startEditingIcon(category)} aria-label={'Edit icon for ' + category.name}><Icon name="edit" size={15} /></button>}
        {isOwner && <button className="icon-button icon-button--delete" type="button" onClick={() => onDeleteCategory(category)} aria-label={'Delete category ' + category.name}><Icon name="trash" size={16} /></button>}
      </article>)}{productCategories.length === 0 && <p className="table-message">{UI_TEXT.noCategories}</p>}</div>
    </section>
    <section className="status-panel"><div className="panel-heading"><div><h2>{UI_TEXT.productStatuses}</h2><p>{statuses.length} {UI_TEXT.statusHelp}</p></div><button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> {UI_TEXT.addStatus}</button></div><div className="status-grid">{loading && <p className="table-message">{UI_TEXT.loading}</p>}{!loading && statuses.map(status => <article className="status-card" key={status.id}><div className="status-card__title"><span className="status-card__icon" style={{ '--status-color': status.color }}><StatusIcon name={status.icon} size={18} /></span><div><strong>{status.name}</strong><small>{status.productCount} {UI_TEXT.productRecords}</small></div><span className={'status-state ' + (status.isActive ? 'status-state--active' : '')}>{status.isActive ? UI_TEXT.statusActive : UI_TEXT.statusInactive}</span></div>{isOwner && <div className="status-card__actions"><button className="button button--secondary button--small" type="button" onClick={() => onEdit(status)}><Icon name="edit" size={15} /> Edit</button><button className="button button--danger button--small" type="button" onClick={() => onDelete(status)}><Icon name="trash" size={15} /> Delete</button></div>}</article>)}{!loading && statuses.length === 0 && <p className="table-message">No statuses</p>}</div></section>
  </>;
}function MembersPage({ members, loading, currentUser, onCreate, onEdit, onDeleteMember }) {
  return <><section className="welcome-section"><div><p className="eyebrow">ตั้งค่าระบบ</p><h1>สมาชิกและสิทธิ์</h1><p className="welcome-copy">กำหนดบทบาทและสิทธิ์เข้าถึงของทีมคลังสินค้า</p></div><button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" size={19} /> เพิ่มสมาชิก</button></section><section className="role-grid" aria-label="บทบาทและสิทธิ์"><article className="role-card role-card--owner"><span className="role-card__icon"><Icon name="settings" size={18} /></span><div><strong>{ROLE_META.owner.label}</strong><p>{ROLE_META.owner.description}</p></div></article><article className="role-card role-card--manager"><span className="role-card__icon"><Icon name="chart" size={18} /></span><div><strong>{ROLE_META.manager.label}</strong><p>{ROLE_META.manager.description}</p></div></article><article className="role-card role-card--employee"><span className="role-card__icon"><Icon name="members" size={18} /></span><div><strong>{ROLE_META.employee.label}</strong><p>{ROLE_META.employee.description}</p></div></article></section><section className="products-panel members-panel"><div className="panel-heading"><div><h2>รายชื่อสมาชิก</h2><p>{members.length} บัญชีในระบบ · สมาชิกที่ปิดใช้งานจะเข้าสู่ระบบไม่ได้</p></div></div><div className="table-wrap"><table className="products-table members-table"><caption className="sr-only">รายชื่อสมาชิกและบทบาท</caption><thead><tr><th>สมาชิก</th><th>บทบาท</th><th>สถานะบัญชี</th><th>วันที่เพิ่ม</th><th>การจัดการ</th></tr></thead><tbody>{loading && <tr><td className="table-message" colSpan="5"><span className="spinner" />กำลังโหลดสมาชิก...</td></tr>}{!loading && members.length === 0 && <tr><td className="table-message" colSpan="5">ยังไม่มีสมาชิก</td></tr>}{!loading && members.map(member => <tr key={member.id}><td><div className="member-name"><span className="member-avatar">{member.fullName.slice(0, 1)}</span><span><strong>{member.fullName}{member.id === currentUser.id && <small className="you-label">บัญชีของคุณ</small>}</strong><small>ชื่อผู้ใช้: {member.username}</small></span></div></td><td><span className={`role-badge role-badge--${member.role}`}>{ROLE_META[member.role]?.label || member.role}</span></td><td><span className={`member-state ${member.isActive ? 'member-state--active' : ''}`}><i />{member.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></td><td>{new Date(member.createdAt).toLocaleDateString('th-TH')}</td><td><div className="row-actions"><button className="icon-button icon-button--edit" type="button" onClick={() => onEdit(member)} aria-label={`แก้ไขสมาชิก ${member.fullName}`}><Icon name="edit" size={17} /></button><button className="icon-button icon-button--delete" type="button" onClick={() => onDeleteMember(member)} disabled={member.id === currentUser.id} aria-label={`Permanently delete member ${member.fullName}`}><Icon name="trash" size={17} /></button></div></td></tr>)}</tbody></table></div><div className="panel-footer">บทบาทถูกตรวจสอบทุกครั้งที่เรียก API · เปลี่ยนบทบาทแล้วมีผลทันที</div></section></>;
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

function InlineTypeCreator({ label, placeholder, onCreate, onCreated }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async event => {
    event?.preventDefault();
    if (!value.trim()) { setError('กรุณากรอกชื่อ'); return; }
    setSubmitting(true);
    setError('');
    try {
      const created = await onCreate(value.trim());
      setValue('');
      setOpen(false);
      onCreated?.(created);
    } catch (requestError) {
      setError(requestError.message || 'เพิ่มรายการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="inline-type-creator">
    {!open ? <button className="inline-add-button" type="button" onClick={() => setOpen(true)}>+ {label}</button> : <div className="inline-type-create">
      <input value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submit(event); if (event.key === 'Escape') setOpen(false); }} placeholder={placeholder} maxLength="60" autoFocus />
      <button className="button button--secondary button--small" type="button" onClick={submit} disabled={submitting}>{submitting && <span className="spinner" />}บันทึก</button>
      <button className="inline-cancel-button" type="button" onClick={() => { setOpen(false); setError(''); }} disabled={submitting}>ยกเลิก</button>
    </div>}
    {error && <small className="inline-type-error" role="alert">{error}</small>}
  </div>;
}

function ProductModal({ open, project, editingProduct, form, activeStatuses, categories, canManageTypes, onCreateStatus, onCreateCategory, onSelectStatus, onSelectCategory, submitting, error, onChange, onCustomFieldChange, onAddCustomField, onRemoveCustomField, onAddTag, onRemoveTag, onSubmit, onClose }) {
  if (!open) return null;
  const selectableStatuses = [...activeStatuses];
  if (editingProduct?.status && !selectableStatuses.some(status => status.id === editingProduct.status.id)) selectableStatuses.push(editingProduct.status);
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal product-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
    <div className="modal__header"><div><p className="eyebrow">{project ? 'Project ' + project.code : UI_TEXT.product}</p><h2 id="product-form-title">{editingProduct ? 'Edit product' : 'Add product'}</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {editingProduct && <label className="form-field"><span>Product ID <b>*</b></span><input name="productCode" type="text" value={form.productCode} onChange={onChange} maxLength="40" required /><small className="field-help">Product IDs must be unique within this project.</small></label>}
    {!editingProduct && project && <p className="product-code-hint">Product IDs will be generated separately for each item: <strong>{project.code}-0001, {project.code}-0002...</strong></p>}
    <form onSubmit={onSubmit}>
      <label className="form-field"><span>{UI_TEXT.product}</span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="100" autoFocus placeholder="Blank names are saved as &quot;unaname&quot;" /></label>
      <div className="form-grid">
        <div className="form-field"><span>{UI_TEXT.category}</span><div className="select-with-icon"><CategoryIcon name={categories.find(category => String(category.id) === String(form.categoryId))?.icon || 'folder'} size={16} /><select name="categoryId" value={form.categoryId || ''} onChange={onChange}><option value="">{'▣ ' + UI_TEXT.unassigned}</option>{categories.map(category => <option value={category.id} key={category.id}>{categoryOptionMark(category.icon) + ' ' + category.name}</option>)}</select></div>{canManageTypes && <InlineTypeCreator label={UI_TEXT.quickAddType} placeholder={UI_TEXT.categoryName} onCreate={onCreateCategory} onCreated={onSelectCategory} />}</div>
        <label className="form-field"><span>{editingProduct ? 'Quantity in this item' : 'Number of items to create'} <b>*</b></span><input name="quantity" type="number" min={editingProduct ? '0' : '1'} max={editingProduct ? undefined : '10000'} step="1" value={form.quantity} onChange={onChange} required readOnly={Boolean(editingProduct)} /></label>
        <div className="form-field"><span>{UI_TEXT.status} <b>*</b></span><div className="select-with-icon"><StatusIcon name={selectableStatuses.find(status => String(status.id) === String(form.statusId))?.icon || 'box'} size={16} /><select name="statusId" value={form.statusId} onChange={onChange} required><option value="">{'◉ ' + 'เลอกสถานะ'}</option>{selectableStatuses.map(status => <option key={status.id} value={status.id}>{statusOptionMark(status.icon) + ' ' + status.name + (!status.isActive ? ' (inactive)' : '')}</option>)}</select></div>{canManageTypes && <InlineTypeCreator label={UI_TEXT.quickAddStatus} placeholder={UI_TEXT.status} onCreate={onCreateStatus} onCreated={onSelectStatus} />}</div>
      </div>
      <div className="form-field"><span>{UI_TEXT.tag}</span><div className="tag-editor">{form.tags.length > 0 && <div className="tag-editor__chips">{form.tags.map(tag => <span className="tag-editor__chip" key={tag}>{tag}<button type="button" onClick={() => onRemoveTag(tag)} aria-label={'Remove ' + UI_TEXT.tag + ' ' + tag}>&times;</button></span>)}</div>}<input name="tagInput" type="text" value={form.tagInput} onChange={onChange} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onAddTag(form.tagInput); } }} placeholder={'Type ' + UI_TEXT.tag + ' and press Enter'} maxLength="1024" /><small className="field-help">Press Enter to add one {UI_TEXT.tag} at a time.</small></div></div>
      <div className="custom-fields-editor"><div className="custom-fields-editor__heading"><div><strong>{UI_TEXT.extraDetails}</strong><small>For example: asset number or Serial Number</small></div><button className="button button--secondary button--small" type="button" onClick={onAddCustomField}>Add detail</button></div>{form.customFields.map((field, index) => <div className="custom-field-row" key={index}><input aria-label="Detail name" value={field.key} onChange={event => onCustomFieldChange(index, 'key', event.target.value)} placeholder="Detail name, for example Serial Number" maxLength="80" /><input aria-label="Detail value" value={field.value} onChange={event => onCustomFieldChange(index, 'value', event.target.value)} placeholder="Value" maxLength="1000" /><button className="icon-button icon-button--delete" type="button" onClick={() => onRemoveCustomField(index)} aria-label="Remove detail"><Icon name="trash" size={16} /></button></div>)}</div>
      <div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{editingProduct ? 'Save changes' : 'Add product'}</button></div>
    </form>
  </section></div>;
}
function StatusModal({ open, editingStatus, form, submitting, error, onChange, onIconChange, onSubmit, onClose }) {
  if (!open) return null;

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="status-form-title"><div className="modal__header"><div><p className="eyebrow">ตั้งค่าระบบ</p><h2 id="status-form-title">{editingStatus ? 'แก้ไขสถานะ' : 'เพิ่มสถานะ'}</h2></div><button className="icon-button icon-button--close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง"><Icon name="close" size={20} /></button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={onSubmit}><label className="form-field"><span>ชื่อสถานะ <b>*</b></span><input name="name" type="text" value={form.name} onChange={onChange} maxLength="50" autoFocus required /></label><fieldset className="status-icon-field"><legend>ไอคอนสถานะ</legend><div className="status-icon-picker">{STATUS_ICON_OPTIONS.map(option => <button className={'status-icon-picker__option' + (form.icon === option.value ? ' status-icon-picker__option--selected' : '')} type="button" key={option.value} aria-pressed={form.icon === option.value} onClick={() => onIconChange(option.value)}><Icon name={option.value} size={20} /><small>{option.label}</small></button>)}</div></fieldset><label className="form-field color-field"><span>สีสถานะ <b>*</b></span><div><input name="color" type="color" value={form.color} onChange={onChange} /><code>{form.color}</code></div></label><label className="toggle-field"><input name="isActive" type="checkbox" checked={form.isActive} onChange={onChange} /><span>เปิดใช้งานสถานะนี้</span></label><div className="modal__actions"><button className="button button--secondary" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting && <span className="spinner spinner--light" />}{editingStatus ? 'บันทึกการแก้ไข' : 'เพิ่มสถานะ'}</button></div></form></section></div>;
}

function App() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  const [selectedProjectId, setSelectedProjectId] = useState(() => projectIdFromHash(window.location.hash));
  const [authState, setAuthState] = useState('checking');
  const [authUser, setAuthUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [products, setProducts] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [availableProductTags, setAvailableProductTags] = useState([]);
  const [dashboardCounts, setDashboardCounts] = useState([]);
  const [dashboardBy, setDashboardBy] = useState('status');
  const [productPage, setProductPage] = useState(1);
  const [productStatusFilter, setProductStatusFilter] = useState([]);
  const [productTagFilter, setProductTagFilter] = useState([]);
  const [productCategoryFilter, setProductCategoryFilter] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productReloadKey, setProductReloadKey] = useState(0);
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
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
  const [deletingProjectId, setDeletingProjectId] = useState(null);
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
        window.location.hash = '#/projects';
      }
    };
    const handleSessionExpired = () => {
      window.localStorage.removeItem('nas-warehouse-token');
      delete axios.defaults.headers.common.Authorization;
      setAuthUser(null);
      setAuthError('เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
      setAuthState('login');
      window.location.hash = '#/projects';
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

  const fetchProducts = useCallback(async (projectId, params = {}, signal) => {
    try {
      const response = await axios.get(`${API_URL}/api/products`, { params: { projectId, limit: 100, ...params }, paramsSerializer: { indexes: null }, signal });
      if (signal?.aborted) return;
      setProducts(response.data.items || []);
      const total = Number(response.data.total) || 0;
      setProductsTotal(total);
      const requestedPage = Math.floor((Number(params.offset) || 0) / 100) + 1;
      const lastPage = Math.max(1, Math.ceil(total / 100));
      if (requestedPage > lastPage) setProductPage(current => current === requestedPage ? lastPage : current);
      setAvailableProductTags(response.data.tags || []);
      setDashboardCounts(response.data.dashboardCounts || []);
    } catch (requestError) {
      if (signal?.aborted) return;
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

  const fetchProductCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/product-categories`);
      setProductCategories(response.data);
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
    if (!projectId) {
      setProducts([]);
      setProductsTotal(0);
      setAvailableProductTags([]);
      setDashboardCounts([]);
    }
    await Promise.all([fetchStatuses(), fetchProjects(), fetchProductCategories()]);
    setLoading(false);
  }, [fetchProductCategories, fetchProjects, fetchStatuses, selectedProjectId]);

  useEffect(() => {
    const handleHashChange = () => {
      setPage(pageFromHash(window.location.hash));
      setSelectedProjectId(projectIdFromHash(window.location.hash));
      setSearchTerm('');
      setProductPage(1);
      setProductStatusFilter([]);
      setProductTagFilter([]);
      setProductCategoryFilter([]);
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
    if (authState !== 'app' || page !== 'project-detail' || !selectedProjectId) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setProductsLoading(true);
      await fetchProducts(selectedProjectId, {
        offset: (productPage - 1) * 100,
        q: searchTerm.trim(),
        statusIds: productStatusFilter,
        tags: productTagFilter,
        categoryIds: productCategoryFilter,
        dashboardBy,
      }, controller.signal);
      if (!controller.signal.aborted) setProductsLoading(false);
    }, searchTerm ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [authState, dashboardBy, fetchProducts, page, productCategoryFilter, productPage, productReloadKey, productStatusFilter, productTagFilter, searchTerm, selectedProjectId]);

  useEffect(() => {
    if (authState !== 'app' || page !== 'members' || authUser?.role !== 'owner') return;
    const timer = window.setTimeout(fetchMembers, 0);
    return () => window.clearTimeout(timer);
  }, [authState, page, authUser, fetchMembers]);

  useEffect(() => {
    if (authState !== 'app') return;
    if (page === 'members' && authUser?.role !== 'owner') navigate('projects');
    if (page === 'statuses' && !['owner', 'manager'].includes(authUser?.role)) navigate('projects');
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
    setProductForm({ projectId: String(product.projectId), productCode: product.productCode || '', name: product.name, quantity: String(product.quantity), statusId: String(product.status?.id || ''), categoryId: String(product.category?.id || ''), customFields: customFields.length ? customFields : [{ key: '', value: '' }], tags: product.tags || [], tagInput: '' });
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
    setStatusForm({ name: status.name, color: status.color, icon: status.icon || 'box', isActive: status.isActive });
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

  const handleDeleteProject = async project => {
    const itemCount = Number(project.productCount) || 0;
    const confirmation = 'Delete project "' + project.name + '" and all ' + itemCount.toLocaleString() + ' related products? This cannot be undone.';
    if (!window.confirm(confirmation)) return;
    try {
      setDeletingProjectId(project.id);
      setError('');
      await axios.delete(API_URL + '/api/projects/' + project.id);
      setProjects(current => current.filter(item => item.id !== project.id));
      setProducts(current => current.filter(item => String(item.projectId) !== String(project.id)));
      if (String(selectedProjectId) === String(project.id)) {
        setProductsTotal(0);
        setAvailableProductTags([]);
        setDashboardCounts([]);
      }
      if (String(selectedProjectId) === String(project.id)) navigate('projects');
      setSuccess('Project deleted.');
      setSearchTerm('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeletingProjectId(null);
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

  const handleDeleteMember = async member => {
    if (!window.confirm('Permanently delete member "' + member.fullName + '"? This cannot be undone.')) return;
    try {
      await axios.delete(API_URL + '/api/members/' + member.id);
      setMembers(current => current.filter(item => item.id !== member.id));
      setSuccess('Member permanently deleted.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleProductSubmit = async event => {
    event.preventDefault();
    const payload = {
      projectId: Number(productForm.projectId),
      name: productForm.name.trim() || 'unaname',
      productCode: editingProduct ? productForm.productCode.trim() : undefined,
      quantity: editingProduct ? Number(editingProduct.quantity) : Number(productForm.quantity),
      statusId: Number(productForm.statusId),
      categoryId: productForm.categoryId ? Number(productForm.categoryId) : null,
      customFields: Object.fromEntries(productForm.customFields.map(field => [field.key.trim(), field.value.trim()]).filter(([key, value]) => key && value)),
      tags: productForm.tags,
    };
    if (!payload.projectId || !Number.isInteger(payload.quantity) || payload.quantity < (editingProduct ? 0 : 1) || payload.quantity > (editingProduct ? Number.MAX_SAFE_INTEGER : 10000) || !payload.statusId) {
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
      setProductPage(1);
      setProductReloadKey(current => current + 1);
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
      setProductPage(1);
      setProductReloadKey(current => current + 1);
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
      setProductReloadKey(current => current + 1);
      await refreshData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async (name, icon = 'folder') => {
    try {
      const response = await axios.post(`${API_URL}/api/product-categories`, { name, icon });
      setProductCategories(current => [...current, response.data].sort((left, right) => left.name.localeCompare(right.name)));
      setSuccess('Product category added.');
      setProductReloadKey(current => current + 1);
      return response.data;
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError), { cause: requestError });
    }
  };

  const handleUpdateCategoryIcon = async (id, icon) => {
    try {
      const response = await axios.put(`${API_URL}/api/product-categories/${id}/icon`, { icon });
      setProductCategories(current => current.map(category => category.id === id ? response.data : category));
      setSuccess('Category icon updated.');
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError), { cause: requestError });
    }
  };

  const handleCreateStatus = async name => {
    try {
      const response = await axios.post(API_URL + '/api/statuses', { name, color: '#1769E0', isActive: true });
      setStatuses(current => [...current, response.data].sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0)));
      setSuccess('Product status added.');
      setProductReloadKey(current => current + 1);
      return response.data;
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError), { cause: requestError });
    }
  };

  const handleDeleteCategory = async category => {
    if (!window.confirm(`Delete category "${category.name}"? Products using it will remain and have no category.`)) return;
    try {
      await axios.delete(`${API_URL}/api/product-categories/${category.id}`);
      setProductCategories(current => current.filter(item => item.id !== category.id));
      setProductCategoryFilter(current => current.filter(item => String(item) !== String(category.id)));
      setProductReloadKey(current => current + 1);
      setSuccess('Product category deleted.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleDeleteProduct = async product => {
    if (!window.confirm(`ต้องการลบ “${product.name}” ออกจากรายการใช่หรือไม่?`)) return;
    try {
      setDeletingId(product.id);
      await axios.delete(`${API_URL}/api/products/${product.id}`);
      setProducts(current => current.filter(item => item.id !== product.id));
      setProductsTotal(current => Math.max(0, current - 1));
      if (products.length === 1 && productPage > 1) setProductPage(current => Math.max(1, current - 1));
      setProductReloadKey(current => current + 1);
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
      setProductReloadKey(current => current + 1);
      await refreshData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const canDeleteProducts = authUser?.role !== 'employee';
  const canManageTypes = ['owner', 'manager'].includes(authUser?.role);
  const projectProducts = activeProject ? products.filter(product => String(product.projectId) === String(activeProject.id)) : [];

  if (authState === 'checking') return <main className="auth-screen"><div className="auth-loading"><span className="spinner" />กำลังตรวจสอบบัญชีสมาชิก...</div></main>;
  if (authState === 'setup' || authState === 'login') return <AuthScreen mode={authState} error={authError} onAuthenticated={handleAuthenticated} />;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#/projects" aria-label="Nas Warehouse หน้าหลัก"><span className="brand__mark"><Icon name="box" size={22} /></span><span><strong>Nas</strong><small>WAREHOUSE</small></span></a>
      <nav className="main-nav" aria-label="เมนูหลัก">
        <button className={page === 'projects' || page === 'project-detail' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('projects')}>โปรเจค</button>
        <button className={page === 'roles' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('roles')}><Icon name="members" size={15} /> บทบาท</button>
        {['owner', 'manager'].includes(authUser.role) && <button className={page === 'statuses' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('statuses')}><Icon name="settings" size={15} /> จัดการสถานะ</button>}
        {authUser.role === 'owner' && <button className={page === 'members' ? 'nav-link nav-link--active' : 'nav-link'} type="button" onClick={() => navigate('members')}><Icon name="members" size={15} /> สมาชิก</button>}
      </nav>
      <div className="account-area"><span className="account-role"><strong>{authUser.fullName}</strong><small>{ROLE_META[authUser.role]?.label}</small></span><button className="button button--secondary button--small logout-button" type="button" onClick={handleLogout}>ออกจากระบบ</button></div>
    </header>
    <main className="dashboard">
      {success && <div className="alert alert--success" role="status">{success}<button type="button" onClick={() => setSuccess('')} aria-label="ปิดข้อความแจ้งเตือน"><Icon name="close" size={16} /></button></div>}
      {error && !isProductFormOpen && !isStatusFormOpen && !isMemberFormOpen && !isProjectFormOpen && !isImportOpen && <div className="alert alert--error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="ปิดข้อความผิดพลาด"><Icon name="close" size={16} /></button></div>}
      {page === 'projects' && <ProjectsPage projects={projects} loading={loading} canCreate={canCreateProjects} canDelete={canCreateProjects} deletingProjectId={deletingProjectId} onCreate={openCreateProject} onOpen={openProject} onDelete={handleDeleteProject} />}
      {page === 'roles' && <RolesPage />}
      {page === 'project-detail' && <ProjectDetailPage project={activeProject} products={projectProducts} statuses={statuses} categories={productCategories} loading={loading || productsLoading} searchTerm={searchTerm} onSearchChange={event => { setSearchTerm(event.target.value); setProductPage(1); }} onClearSearch={() => { setSearchTerm(''); setProductPage(1); }} dashboardBy={dashboardBy} onDashboardByChange={setDashboardBy} dashboardCounts={dashboardCounts} productStatusFilter={productStatusFilter} productTagFilter={productTagFilter} productCategoryFilter={productCategoryFilter} onStatusFilterChange={value => { setProductStatusFilter(value); setProductPage(1); }} onTagFilterChange={value => { setProductTagFilter(value); setProductPage(1); }} onCategoryFilterChange={value => { setProductCategoryFilter(value); setProductPage(1); }} availableProductTags={availableProductTags} productsTotal={productsTotal} productPage={productPage} onPageChange={setProductPage} onBack={() => navigate('projects')} onCreateProduct={openCreateProduct} onImport={() => { setError(''); setIsImportOpen(true); }} onEdit={openEditProduct} onDelete={handleDeleteProduct} deletingId={deletingId} canDelete={canDeleteProducts} />}
      {page === 'statuses' && ['owner', 'manager'].includes(authUser.role) && <StatusesPage statuses={statuses} loading={loading} productCategories={productCategories} isOwner={authUser.role === 'owner'} onCreate={openCreateStatus} onEdit={openEditStatus} onDelete={handleDeleteStatus} onCreateCategory={handleCreateCategory} onUpdateCategory={handleUpdateCategoryIcon} onDeleteCategory={handleDeleteCategory} />}
      {page === 'members' && authUser.role === 'owner' && <MembersPage members={members} loading={membersLoading} currentUser={authUser} onCreate={openCreateMember} onEdit={openEditMember} onDeleteMember={handleDeleteMember} />}
    </main>
    <ProjectModal open={isProjectFormOpen} form={projectForm} submitting={submitting} error={error} onChange={handleProjectChange} onSubmit={handleProjectSubmit} onClose={() => setIsProjectFormOpen(false)} />
    <ExcelImportModal key={isImportOpen ? 'import-open' : 'import-closed'} open={isImportOpen} project={activeProject} activeStatuses={activeStatuses} categories={productCategories} submitting={submitting} apiError={error} onImport={handleImportProducts} onClearError={() => setError('')} onClose={() => setIsImportOpen(false)} />
    <ProductModal open={isProductFormOpen} project={activeProject} editingProduct={editingProduct} form={productForm} activeStatuses={activeStatuses} categories={productCategories} canManageTypes={canManageTypes} onCreateStatus={handleCreateStatus} onCreateCategory={handleCreateCategory} onSelectStatus={status => setProductForm(current => ({ ...current, statusId: String(status.id) }))} onSelectCategory={category => setProductForm(current => ({ ...current, categoryId: String(category.id) }))} submitting={submitting} error={error} onChange={handleProductChange} onCustomFieldChange={handleCustomFieldChange} onAddCustomField={handleAddCustomField} onRemoveCustomField={handleRemoveCustomField} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} onSubmit={handleProductSubmit} onClose={() => setIsProductFormOpen(false)} />
    <StatusModal open={isStatusFormOpen} editingStatus={editingStatus} form={statusForm} submitting={submitting} error={error} onChange={handleStatusChange} onIconChange={icon => setStatusForm(current => ({ ...current, icon }))} onSubmit={handleStatusSubmit} onClose={() => setIsStatusFormOpen(false)} />
    <MemberModal open={isMemberFormOpen} editingMember={editingMember} currentUserId={authUser.id} form={memberForm} submitting={submitting} error={error} onChange={handleMemberChange} onSubmit={handleMemberSubmit} onClose={() => setIsMemberFormOpen(false)} />
  </div>;
}

export default App;
