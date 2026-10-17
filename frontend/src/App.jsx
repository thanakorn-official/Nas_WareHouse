import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', quantity: 0, price: 0 });

  const fetchProducts = async () => {
    const res = await axios.get('http://localhost:5000/api/products');
    setProducts(res.data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('http://localhost:5000/api/products', form);
    setForm({ name: '', quantity: 0, price: 0 });
    fetchProducts();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Nas_WareHouse System</h1>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input type="text" placeholder="ชื่อสินค้า" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required style={{marginRight: '10px'}}/>
        <input type="number" placeholder="จำนวน" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required style={{marginRight: '10px'}}/>
        <input type="number" placeholder="ราคา" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required style={{marginRight: '10px'}}/>
        <button type="submit">เพิ่มสินค้า</button>
      </form>

      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th>ID</th>
            <th>ชื่อสินค้า</th>
            <th>จำนวน</th>
            <th>ราคา</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.quantity}</td>
              <td>{p.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;