import { useCallback, useEffect, useState } from 'react'

const API = '/api'

const blankForm = () => ({
  item_code: '',
  item_name: '',
  item_type: 'Raw Material',
  unit: 'kg',
  minimum_quantity: '',
  remarks: '',
})

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || `Request failed (${response.status})`)
  }
  return data
}

function number(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 3,
  })
}

export default function InventoryManagement() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [ledger, setLedger] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [lowOnly, setLowOnly] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (category !== 'All') params.set('item_type', category)
      if (lowOnly) params.set('low_stock', 'true')

      const [list, totals] = await Promise.all([
        api(`/inventory/items?${params.toString()}`),
        api('/inventory/summary'),
        api('/inventory/ledger'),
      ])

      setItems(list)
      setSummary(totals)
      setLedger(await api('/inventory/ledger'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [query, category, lowOnly])

  useEffect(() => {
    const timer = setTimeout(load, 200)
    return () => clearTimeout(timer)
  }, [load])

  function openNew() {
    setEditingId(null)
    setForm(blankForm())
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({
      item_code: item.item_code || '',
      item_name: item.item_name || '',
      item_type: item.item_type,
      unit: item.unit || 'pcs',
      minimum_quantity: item.minimum_quantity ?? '',
      remarks: item.remarks || '',
    })
    setError('')
    setNotice('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      ...form,
      item_code: form.item_code.trim() || null,
      minimum_quantity:
        form.minimum_quantity === '' ? null : Number(form.minimum_quantity),
      remarks: form.remarks.trim() || null,
    }

    try {
      await api(
        editingId
          ? `/inventory/items/${editingId}`
          : '/inventory/items',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      )

      setShowForm(false)
      setEditingId(null)
      setForm(blankForm())
      setNotice(editingId ? 'Inventory item updated.' : 'Inventory item created.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete "${item.item_name}"? This cannot be undone.`)) {
      return
    }

    setError('')
    setNotice('')

    try {
      await api(`/inventory/items/${item.id}`, { method: 'DELETE' })
      setNotice('Inventory item deleted.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="inventory-module">
      <section className="page-intro">
        <div>
          <h2>Inventory Register</h2>
          <p>View and manage raw materials and finished goods.</p>
        </div>
        <button className="primary-btn" onClick={openNew}>
          ＋ Add Inventory Item
        </button>
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      <section className="inventory-stats">
        <div className="stat-card">
          <div><span>Total Items</span><strong>{summary?.total_items ?? '—'}</strong></div>
        </div>
        <div className="stat-card">
          <div><span>Raw Materials</span><strong>{summary?.raw_materials ?? '—'}</strong></div>
        </div>
        <div className="stat-card">
          <div><span>Finished Goods</span><strong>{summary?.finished_goods ?? '—'}</strong></div>
        </div>
        <div className="stat-card">
          <div><span>Low Stock Items</span><strong>{summary?.low_stock ?? '—'}</strong></div>
        </div>
      </section>

      {showForm && (
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h2>{editingId ? 'Edit Inventory Item' : 'Add Inventory Item'}</h2>
              <p>Stock changes only through recorded purchase, production, packing and dispatch transactions.</p>
            </div>
            <button className="close-btn" onClick={() => setShowForm(false)}>×</button>
          </div>

          <form onSubmit={submit}>
            <div className="inventory-form-grid">
              <label>Item Name *
                <input
                  name="item_name"
                  value={form.item_name}
                  onChange={updateField}
                  required
                  maxLength="160"
                  placeholder="Enter item name"
                />
              </label>

              <label>Item Code
                <input
                  name="item_code"
                  value={form.item_code}
                  onChange={updateField}
                  maxLength="50"
                  placeholder="Optional unique code"
                />
              </label>

              <label>Category *
                <select name="item_type" value={form.item_type} onChange={updateField}>
                  <option>Raw Material</option>
                  <option>Finished Goods</option>\n                  <option>Packed Goods</option>
                </select>
              </label>

              <label>Unit *
                <select name="unit" value={form.unit} onChange={updateField}>
                  {['kg', 'gram', 'meter', 'cm', 'piece', 'pcs', 'litre', 'bundle', 'roll', 'box', 'set', 'ton'].map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>

              <label>Minimum Stock Level
                <input
                  type="number"
                  name="minimum_quantity"
                  value={form.minimum_quantity}
                  onChange={updateField}
                  min="0"
                  step="any"
                  placeholder="Optional"
                />
              </label>

              <label className="inventory-wide">Remarks
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={updateField}
                  rows="3"
                  maxLength="2000"
                  placeholder="Optional notes"
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button className="primary-btn" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Item'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="list-toolbar inventory-toolbar">
          <div>
            <h2>All Inventory Items</h2>
            <p>Stock quantities are shown from the existing inventory records.</p>
          </div>
          <input
            className="search-input"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search item name or code…"
            aria-label="Search inventory"
          />
        </div>

        <div className="inventory-filters">
          <select value={category} onChange={event => setCategory(event.target.value)}>
            <option value="All">All Categories</option>
            <option value="Raw Material">Raw Materials</option>
            <option value="Finished Goods">Finished Goods</option>\n            <option value="Packed Goods">Packed Goods</option>
          </select>

          <label className="inventory-low-filter">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={event => setLowOnly(event.target.checked)}
            />
            Show low stock only
          </label>
        </div>

        {loading ? (
          <div className="empty-state">Loading inventory…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            {query || lowOnly || category !== 'All'
              ? 'No inventory items match these filters.'
              : 'No inventory items yet. Add your first raw material or finished good.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Current Stock</th>
                  <th>Minimum Stock</th>
                  <th>Stock Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const low = item.minimum_quantity != null &&
                    Number(item.current_quantity) <= Number(item.minimum_quantity)

                  return (
                    <tr key={item.id}>
                      <td className="inventory-code">{item.item_code || '—'}</td>
                      <td>
                        <strong>{item.item_name}</strong>
                        {item.remarks && <small className="inventory-remarks">{item.remarks}</small>}
                      </td>
                      <td>{item.item_type}</td>
                      <td>{item.unit}</td>
                      <td className="inventory-quantity">{number(item.current_quantity)}</td>
                      <td>{item.minimum_quantity == null ? '—' : number(item.minimum_quantity)}</td>
                      <td>
                        {low
                          ? <span className="inventory-status low">Low Stock</span>
                          : <span className="inventory-status normal">Available</span>}
                      </td>
                      <td>
                        <div className="inventory-actions">
                          <button className="edit-btn" onClick={() => openEdit(item)}>Edit</button>
                          <button className="edit-btn inventory-delete" onClick={() => remove(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="list-toolbar"><div><h2>Stock Movement Ledger</h2><p>Every posted stock movement is recorded here for traceability.</p></div></div>
        {ledger.length === 0 ? <div className="empty-state">No new stock movements recorded yet. Opening demo balances are treated as opening stock.</div> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Movement</th><th>Reference</th><th>Item</th><th>In</th><th>Out</th><th>Balance</th></tr></thead><tbody>{ledger.map(x => <tr key={x.id}><td>{x.date}</td><td>{x.type}</td><td>{x.reference}</td><td>{x.item_name}</td><td>{x.quantity_in ? number(x.quantity_in) : '—'} {x.quantity_in ? x.unit : ''}</td><td>{x.quantity_out ? number(x.quantity_out) : '—'} {x.quantity_out ? x.unit : ''}</td><td>{number(x.balance_after)} {x.unit}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="inventory-footnote">Opening quantities are starting balances. New purchases increase raw materials; Issue Materials deducts raw materials; Receive Finished increases finished goods; completed packing transfers finished goods to Packed Goods; shipment dispatch deducts packed goods.</p>
    </div>
  )
}
