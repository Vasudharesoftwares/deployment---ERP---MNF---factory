import { useCallback, useEffect, useMemo, useState } from 'react'

const API = '/api'
const today = () => new Date().toISOString().slice(0, 10)
const statuses = ['Not Started', 'In Production', 'On Hold']
const blankMaterial = () => ({ material_name: '', quantity: '1', unit: 'pcs' })

const blankForm = () => ({
  order_reference: '',
  product_name: '',
  order_quantity: '1',
  delivery_date: '',
  status: 'Not Started',
  remarks: '',
  materials: [blankMaterial()],
})

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

const number = value => Number(value || 0).toLocaleString('en-IN', {
  maximumFractionDigits: 3,
})

export default function ProductionManagement() {
  const [records, setRecords] = useState([])
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRecords(await request('/production'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visibleRecords = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return records
    return records.filter(record =>
      [
        record.production_number,
        record.order_reference,
        record.product_name,
        record.status,
        ...(record.materials || []).map(item => item.material_name),
      ].some(value => String(value || '').toLowerCase().includes(term))
    )
  }, [records, query])

  const counts = useMemo(() => ({
    total: records.length,
    notStarted: records.filter(x => x.status === 'Not Started').length,
    inProduction: records.filter(x => x.status === 'In Production').length,
    completed: records.filter(x => x.status === 'Completed').length,
  }), [records])

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  function updateMaterial(index, field, value) {
    setForm(current => ({
      ...current,
      materials: current.materials.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  function openNew() {
    setEditingId(null)
    setForm(blankForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  function editRecord(record) {
    setEditingId(record.id)
    setForm({
      order_reference: record.order_reference || '',
      product_name: record.product_name || '',
      order_quantity: String(record.order_quantity ?? 1),
      delivery_date: record.delivery_date || '',
      status: record.status || 'Not Started',
      remarks: record.remarks || '',
      materials: (record.materials || []).map(item => ({
        material_name: item.material_name,
        quantity: String(item.quantity),
        unit: item.unit,
      })),
    })
    setShowForm(true)
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(blankForm())
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      ...form,
      order_reference: form.order_reference.trim(),
      product_name: form.product_name.trim(),
      order_quantity: Number(form.order_quantity),
      delivery_date: form.delivery_date || null,
      remarks: form.remarks.trim() || null,
      materials: form.materials.map(item => ({
        material_name: item.material_name.trim(),
        quantity: Number(item.quantity),
        unit: item.unit.trim(),
      })),
    }

    try {
      const saved = await request(
        editingId ? `/production/${editingId}` : '/production',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      )
      setNotice(`${saved.production_number} ${editingId ? 'updated' : 'created'} successfully.`)
      closeForm()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function postStockAction(record, action) {
    setError('')
    setNotice('')
    try {
      let payload = {}
      if (action === 'complete') {
        const value = window.prompt(`Accepted finished quantity to receive into inventory for ${record.production_number}:`, String(record.order_quantity))
        if (value === null) return
        payload = { quantity: Number(value) }
        if (!(payload.quantity > 0)) throw new Error('Enter a quantity greater than zero.')
      }
      const result = await request(`/production/${record.id}/${action}`, {
        method: 'POST', body: JSON.stringify(payload),
      })
      setNotice(action === 'issue'
        ? `Raw materials issued for ${record.production_number}.`
        : `${number(payload.quantity)} ${record.product_name} received into Finished Goods inventory.`)
      await load()
    } catch (err) { setError(err.message) }
  }

  async function deleteRecord(record) {
    if (!window.confirm(`Delete production record ${record.production_number}?`)) return
    setError('')
    setNotice('')
    try {
      await request(`/production/${record.id}`, { method: 'DELETE' })
      setNotice(`${record.production_number} deleted successfully.`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="production-module">
      <section className="page-intro">
        <div>
          <h2>Production Register</h2>
          <p>Manually plan and track manufacturing against customer order references.</p>
        </div>
        <button className="primary-btn" onClick={openNew}>＋ New Production</button>
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      <div className="production-info">
        <strong>Production planning only</strong>
        <span>Raw-material requirements are recorded for planning. Saving production does not deduct inventory.</span>
      </div>

      <section className="stats-grid compact-stats">
        <div className="stat-card"><span>Production Records</span><strong>{counts.total}</strong></div>
        <div className="stat-card"><span>Not Started</span><strong>{counts.notStarted}</strong></div>
        <div className="stat-card"><span>In Production</span><strong>{counts.inProduction}</strong></div>
        <div className="stat-card"><span>Completed</span><strong>{counts.completed}</strong></div>
      </section>

      {showForm && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{editingId ? 'Edit Production Record' : 'New Production Entry'}</h2>
              <p>Enter the customer order reference and manufacturing requirements.</p>
            </div>
            <button type="button" className="close-btn" onClick={closeForm}>×</button>
          </div>

          <form onSubmit={save}>
            <div className="production-form-grid">
              <label>Order ID / Reference *
                <input
                  name="order_reference"
                  value={form.order_reference}
                  onChange={updateField}
                  required
                  maxLength="100"
                  placeholder="Enter customer order ID"
                />
              </label>
              <label>Product to Manufacture *
                <input
                  name="product_name"
                  value={form.product_name}
                  onChange={updateField}
                  required
                  maxLength="200"
                  placeholder="Product / item name"
                />
              </label>
              <label>Order Quantity *
                <input
                  type="number"
                  name="order_quantity"
                  value={form.order_quantity}
                  onChange={updateField}
                  min="0.001"
                  step="any"
                  required
                />
              </label>
              <label>Delivery Date
                <input
                  type="date"
                  name="delivery_date"
                  value={form.delivery_date}
                  onChange={updateField}
                />
              </label>
              <label>Production Status
                <select name="status" value={form.status} onChange={updateField}>
                  {statuses.map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="production-wide">Remarks
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={updateField}
                  rows="2"
                  maxLength="2000"
                  placeholder="Optional production notes"
                />
              </label>
            </div>

            <div className="production-material-heading">
              <div>
                <h3>Raw Material Requirements</h3>
                <p>Enter total material quantities required for this production batch. Stock is deducted only when you select Issue Materials.</p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setForm(current => ({
                  ...current,
                  materials: [...current.materials, blankMaterial()],
                }))}
              >＋ Add Material</button>
            </div>

            <div className="production-material-list">
              {form.materials.map((material, index) => (
                <div className="production-material-row" key={index}>
                  <label>Material *
                    <input
                      value={material.material_name}
                      onChange={e => updateMaterial(index, 'material_name', e.target.value)}
                      required
                      maxLength="160"
                      placeholder="e.g. Cotton yarn"
                    />
                  </label>
                  <label>Required Quantity *
                    <input
                      type="number"
                      value={material.quantity}
                      onChange={e => updateMaterial(index, 'quantity', e.target.value)}
                      min="0.001"
                      step="any"
                      required
                    />
                  </label>
                  <label>Unit *
                    <input
                      value={material.unit}
                      onChange={e => updateMaterial(index, 'unit', e.target.value)}
                      required
                      maxLength="30"
                      placeholder="kg, meter, pcs"
                    />
                  </label>
                  <button
                    type="button"
                    className="production-remove-btn"
                    disabled={form.materials.length === 1}
                    onClick={() => setForm(current => ({
                      ...current,
                      materials: current.materials.filter((_, i) => i !== index),
                    }))}
                    aria-label={`Remove material ${index + 1}`}
                  >Remove</button>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={closeForm}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Production'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="list-toolbar">
          <div>
            <h2>All Production Records</h2>
            <p>Search by production number, order reference, product or material.</p>
          </div>
          <input
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search production…"
            aria-label="Search production records"
          />
        </div>

        {loading ? <div className="empty-state">Loading production records…</div>
          : visibleRecords.length === 0
            ? <div className="empty-state">
                {query ? 'No production records match your search.' : 'No production records yet. Select “New Production” to add one.'}
              </div>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Production No.</th>
                      <th>Order ID</th>
                      <th>Product</th>
                      <th>Order Qty</th>
                      <th>Delivery</th>
                      <th>Raw Materials Required</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map(record => (
                      <tr key={record.id}>
                        <td className="order-number">{record.production_number}</td>
                        <td>{record.order_reference}</td>
                        <td>{record.product_name}</td>
                        <td>{number(record.order_quantity)}</td>
                        <td>{record.delivery_date || '—'}</td>
                        <td className="production-material-summary">
                          {(record.materials || []).map(item =>
                            `${item.material_name}: ${number(item.quantity)} ${item.unit}`
                          ).join(', ')}
                        </td>
                        <td>
                          <span className={`status-pill ${record.status.toLowerCase().replaceAll(' ', '-')}`}>
                            {record.status}
                          </span>
                        </td>
                        <td>
                          <div className="production-actions">
                            {!record.materials_issued && Number(record.completed_quantity || 0) === 0 && <button className="edit-btn" onClick={() => editRecord(record)}>Edit</button>}
                            {!record.materials_issued && <button className="edit-btn" onClick={() => postStockAction(record, 'issue')}>Issue Materials</button>}
                            {record.materials_issued && <button className="edit-btn" onClick={() => postStockAction(record, 'complete')}>Receive Finished</button>}
                            <button className="production-delete-btn" onClick={() => deleteRecord(record)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </section>
    </div>
  )
}
