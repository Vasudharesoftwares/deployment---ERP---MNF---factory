import { useCallback, useEffect, useMemo, useState } from 'react'

const API = '/api'
const today = () => new Date().toISOString().slice(0, 10)
const blankLine = () => ({ inventory_item_id: '', quantity: '1', rate: '0' })

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`)
  return data
}

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`

export default function PurchaseManagement() {
  const [suppliers, setSuppliers] = useState([])
  const [materials, setMaterials] = useState([])
  const [purchases, setPurchases] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(today())
  const [invoice, setInvoice] = useState('')
  const [lines, setLines] = useState([blankLine()])
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showSupplier, setShowSupplier] = useState(false)
  const [showMaterial, setShowMaterial] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [materialForm, setMaterialForm] = useState({ item_name: '', unit: 'pcs', minimum_quantity: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, m, p] = await Promise.all([
        request('/suppliers'),
        request('/inventory/raw-materials'),
        request('/purchases'),
      ])
      setSuppliers(s)
      setMaterials(m)
      setPurchases(p)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const total = useMemo(() => lines.reduce((sum, line) =>
    sum + (Number(line.quantity) || 0) * (Number(line.rate) || 0), 0), [lines])

  function resetForm() {
    setEditingId(null)
    setSupplierId('')
    setPurchaseDate(today())
    setInvoice('')
    setLines([blankLine()])
    setShowForm(false)
  }

  function updateLine(index, field, value) {
    setLines(current => current.map((line, i) =>
      i === index ? { ...line, [field]: value } : line))
  }

  async function savePurchase(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        supplier_id: Number(supplierId),
        purchase_date: purchaseDate,
        invoice_reference: invoice.trim() || null,
        items: lines.map(line => ({
          inventory_item_id: Number(line.inventory_item_id),
          quantity: Number(line.quantity),
          rate: Number(line.rate),
        })),
      }
      const saved = await request(
        editingId ? `/purchases/${editingId}` : '/purchases',
        { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      )
      setNotice(`${saved.purchase_number} ${editingId ? 'updated' : 'saved'}. Raw-material stock has been adjusted.`)
      resetForm()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function editPurchase(id) {
    setError('')
    try {
      const purchase = await request(`/purchases/${id}`)
      setEditingId(id)
      setSupplierId(String(purchase.supplier_id))
      setPurchaseDate(purchase.purchase_date)
      setInvoice(purchase.invoice_reference || '')
      setLines(purchase.items.map(item => ({
        inventory_item_id: String(item.inventory_item_id),
        quantity: String(item.quantity),
        rate: String(item.rate),
      })))
      setShowForm(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    }
  }

  async function deletePurchase(purchase) {
    if (!window.confirm(
      `Delete ${purchase.purchase_number}? Its stock quantity will be reversed.`
    )) return
    setError('')
    setNotice('')
    try {
      await request(`/purchases/${purchase.id}`, { method: 'DELETE' })
      setNotice(`${purchase.purchase_number} deleted and stock adjusted.`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveSupplier(event) {
    event.preventDefault()
    try {
      const saved = await request('/suppliers', {
        method: 'POST', body: JSON.stringify(supplierForm),
      })
      setSupplierId(String(saved.id))
      setSupplierForm({ name: '', phone: '', email: '', address: '' })
      setShowSupplier(false)
      await load()
      setNotice(`Supplier ${saved.name} added.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveMaterial(event) {
    event.preventDefault()
    try {
      const saved = await request('/inventory/raw-materials', {
        method: 'POST',
        body: JSON.stringify({
          ...materialForm,
          minimum_quantity: materialForm.minimum_quantity === ''
            ? null : Number(materialForm.minimum_quantity),
        }),
      })
      setLines(current => current.map((line, index) =>
        index === current.length - 1
          ? { ...line, inventory_item_id: String(saved.id) } : line))
      setMaterialForm({ item_name: '', unit: 'pcs', minimum_quantity: '' })
      setShowMaterial(false)
      await load()
      setNotice(`${saved.item_name} added to Raw Material Inventory.`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="purchase-module">
      <section className="page-intro">
        <div>
          <h2>Purchase Management</h2>
          <p>Record supplier purchases and automatically update raw-material stock.</p>
        </div>
        <button className="primary-btn" onClick={() => {
          resetForm()
          setShowForm(true)
          setError('')
          setNotice('')
        }}>＋ New Purchase</button>
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      <div className="purchase-info">
        <strong>Automatic inventory update</strong>
        <span>Raw-material quantities increase immediately when a purchase is saved.</span>
      </div>

      <section className="stats-grid compact-stats">
        <div className="stat-card"><span>Purchase Documents</span><strong>{purchases.length}</strong></div>
        <div className="stat-card"><span>Suppliers</span><strong>{suppliers.length}</strong></div>
        <div className="stat-card"><span>Raw Materials</span><strong>{materials.length}</strong></div>
        <div className="stat-card"><span>Total Purchase Value</span><strong>{money(purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0))}</strong></div>
      </section>

      {showForm && <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{editingId ? 'Edit Purchase' : 'New Purchase Entry'}</h2>
            <p>One invoice can contain multiple raw materials.</p>
          </div>
          <button className="close-btn" onClick={resetForm}>×</button>
        </div>

        <form onSubmit={savePurchase}>
          <div className="purchase-header-grid">
            <label>Supplier *
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Purchase Date *
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
            </label>
            <label>Supplier Invoice Reference
              <input value={invoice} onChange={e => setInvoice(e.target.value)} maxLength="100" placeholder="Invoice / bill number" />
            </label>
          </div>

          <div className="purchase-lines-heading">
            <div><h3>Purchased Items</h3><p>Select raw materials and enter quantity and purchase rate.</p></div>
            <button type="button" className="secondary-btn" onClick={() => setShowMaterial(v => !v)}>＋ Add Raw Material</button>
          </div>

          {showMaterial && <div className="purchase-inline-form">
            <form onSubmit={saveMaterial}>
              <label>Material Name *
                <input required value={materialForm.item_name} onChange={e => setMaterialForm({ ...materialForm, item_name: e.target.value })} />
              </label>
              <label>Unit *
                <input required value={materialForm.unit} onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })} placeholder="kg, meter, pcs..." />
              </label>
              <label>Minimum Stock
                <input type="number" min="0" step="any" value={materialForm.minimum_quantity} onChange={e => setMaterialForm({ ...materialForm, minimum_quantity: e.target.value })} />
              </label>
              <button className="primary-btn" type="submit">Create Material</button>
            </form>
          </div>}

          {suppliers.length === 0 && <div className="empty-state">Add a supplier before recording a purchase.</div>}
          {materials.length === 0 && <div className="empty-state">Add your first raw material using “Add Raw Material”.</div>}

          <div className="table-wrap">
            <table className="purchase-table">
              <thead><tr><th>Raw Material *</th><th>Quantity *</th><th>Rate *</th><th>Line Total</th><th></th></tr></thead>
              <tbody>
                {lines.map((line, index) => {
                  const material = materials.find(m => String(m.id) === line.inventory_item_id)
                  const lineTotal = (Number(line.quantity) || 0) * (Number(line.rate) || 0)
                  return <tr key={index}>
                    <td>
                      <select required value={line.inventory_item_id} onChange={e => updateLine(index, 'inventory_item_id', e.target.value)}>
                        <option value="">Select material</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.item_name} ({m.unit})</option>)}
                      </select>
                      {material && <small>Current stock: {Number(material.current_quantity).toLocaleString('en-IN')} {material.unit}</small>}
                    </td>
                    <td><input required type="number" min="0.001" step="any" value={line.quantity} onChange={e => updateLine(index, 'quantity', e.target.value)} /></td>
                    <td><input required type="number" min="0" step="any" value={line.rate} onChange={e => updateLine(index, 'rate', e.target.value)} /></td>
                    <td className="purchase-line-total">{money(lineTotal)}</td>
                    <td><button type="button" className="edit-btn" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Remove</button></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>

          <div className="purchase-add-row">
            <button type="button" className="secondary-btn" onClick={() => setLines(current => [...current, blankLine()])}>＋ Add Another Item</button>
            <div className="purchase-total">Invoice Total <strong>{money(total)}</strong></div>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={resetForm}>Cancel</button>
            <button className="primary-btn" type="submit" disabled={saving || suppliers.length === 0 || materials.length === 0}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Purchase & Update Stock'}
            </button>
          </div>
        </form>
      </section>}

      <section className="panel">
        <div className="list-toolbar">
          <div><h2>Purchase History</h2><p>Latest purchase documents appear first.</p></div>
        </div>
        {loading ? <div className="empty-state">Loading purchases…</div>
          : purchases.length === 0 ? <div className="empty-state">No purchases recorded yet. Select “New Purchase” to enter your first supplier invoice.</div>
          : <div className="table-wrap">
            <table>
              <thead><tr><th>Purchase No.</th><th>Date</th><th>Supplier</th><th>Invoice Ref.</th><th>Items</th><th>Total</th><th>Actions</th></tr></thead>
              <tbody>{purchases.map(p => <tr key={p.id}>
                <td className="order-number">{p.purchase_number}</td>
                <td>{p.purchase_date}</td>
                <td>{p.supplier_name}</td>
                <td>{p.invoice_reference || '—'}</td>
                <td>{p.item_count}</td>
                <td>{money(p.total_amount)}</td>
                <td className="purchase-actions">
                  <button className="edit-btn" onClick={() => editPurchase(p.id)}>Edit</button>
                  <button className="edit-btn danger-btn" onClick={() => deletePurchase(p)}>Delete</button>
                </td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Supplier Directory</h2><p>Suppliers available for purchase entries.</p></div>
          <button className="secondary-btn" onClick={() => setShowSupplier(v => !v)}>＋ Add Supplier</button>
        </div>
        {showSupplier && <form className="supplier-form" onSubmit={saveSupplier}>
          <label>Supplier Name *<input required value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} /></label>
          <label>Phone<input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></label>
          <label>Email<input type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} /></label>
          <label>Address<input value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} /></label>
          <button className="primary-btn" type="submit">Save Supplier</button>
        </form>}
        {suppliers.length === 0 ? <div className="empty-state">No suppliers added yet.</div>
          : <div className="supplier-list">{suppliers.map(s => <div key={s.id}><strong>{s.name}</strong><span>{s.phone || 'No phone'} {s.email ? `· ${s.email}` : ''}</span></div>)}</div>}
      </section>
    </div>
  )
}
