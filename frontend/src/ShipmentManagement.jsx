import { useCallback, useEffect, useMemo, useState } from 'react'

const API = '/api'
const today = () => new Date().toISOString().slice(0, 10)

const blankForm = () => ({
  packing_id: '',
  quantity_dispatched: '1',
  dispatch_date: today(),
  transporter: '',
  vehicle_number: '',
  tracking_details: '',
  remarks: '',
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
  if (!response.ok) {
    const detail = data.detail
    throw new Error(Array.isArray(detail)
      ? detail.map(item => item.msg).join(', ')
      : detail || `Request failed (${response.status})`)
  }
  return data
}

function ShipmentManagement() {
  const [records, setRecords] = useState([])
  const [packingOptions, setPackingOptions] = useState([])
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRecords = useCallback(async (search = '') => {
    try {
      setRecords(await request(`/shipments?q=${encodeURIComponent(search)}`))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPacking = useCallback(async () => {
    try {
      const rows = await request('/packing?status=Completed')
      setPackingOptions(rows)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    loadPacking()
  }, [loadPacking])

  useEffect(() => {
    const timer = setTimeout(() => loadRecords(query), 200)
    return () => clearTimeout(timer)
  }, [query, loadRecords])

  const stats = useMemo(() => ({
    total: records.length,
    quantity: records.reduce((sum, item) => sum + Number(item.quantity_dispatched || 0), 0),
    today: records.filter(item => item.dispatch_date === today()).length,
  }), [records])

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  function openNew() {
    setEditingId(null)
    setForm(blankForm())
    setError('')
    setNotice('')
    setShowForm(true)
    loadPacking()
  }

  function editRecord(item) {
    setEditingId(item.id)
    setForm({
      packing_id: String(item.packing_id),
      quantity_dispatched: String(item.quantity_dispatched),
      dispatch_date: item.dispatch_date || today(),
      transporter: item.transporter || '',
      vehicle_number: item.vehicle_number || '',
      tracking_details: item.tracking_details || '',
      remarks: item.remarks || '',
    })
    setError('')
    setNotice('')
    setShowForm(true)
    loadPacking()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitForm(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      ...form,
      packing_id: Number(form.packing_id),
      quantity_dispatched: Number(form.quantity_dispatched),
      transporter: form.transporter.trim() || null,
      vehicle_number: form.vehicle_number.trim() || null,
      tracking_details: form.tracking_details.trim() || null,
      remarks: form.remarks.trim() || null,
    }

    try {
      const saved = await request(
        editingId ? `/shipments/${editingId}` : '/shipments',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      )

      const wasEditing = Boolean(editingId)
      setShowForm(false)
      setEditingId(null)
      setForm(blankForm())
      setNotice(`${saved.shipment_number} ${wasEditing ? 'updated' : 'created'} successfully.`)
      await loadRecords(query)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord(item) {
    if (!window.confirm(`Delete ${item.shipment_number}? This cannot be undone.`)) return

    setError('')
    setNotice('')
    try {
      await request(`/shipments/${item.id}`, { method: 'DELETE' })
      setNotice(`${item.shipment_number} deleted successfully.`)
      await loadRecords(query)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="shipment-module">
      <section className="page-intro">
        <div>
          <h2>Shipment Management</h2>
          <p>Record dispatches using completed Packing entries as the source.</p>
        </div>
        <button className="primary-btn" onClick={openNew}>＋ New Shipment</button>
      </section>

      <div className="shipment-info">
        <strong>Dispatch deducts packed stock</strong>
        <span>Saving a dispatch deducts the dispatched quantity from Packed Goods inventory. Posted dispatches are locked to preserve the stock audit trail.</span>
      </div>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {showForm && (
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h2>{editingId ? 'Edit Shipment' : 'New Shipment'}</h2>
              <p>Select a completed packing entry and enter actual dispatch details.</p>
            </div>
            <button type="button" className="close-btn" onClick={() => setShowForm(false)}>×</button>
          </div>

          <form onSubmit={submitForm}>
            <div className="shipment-form-grid">
              <label className="shipment-wide">Completed Packing Entry *
                <select name="packing_id" value={form.packing_id} onChange={updateField} required>
                  <option value="">Select completed packing</option>
                  {packingOptions.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.packing_number} · {item.order_reference} · {item.product_name} · {item.receiver_party} · Completed: {item.completed_quantity}
                    </option>
                  ))}
                </select>
                {packingOptions.length === 0 && (
                  <span className="shipment-hint">No completed packing entries are available. Complete a packing entry first.</span>
                )}
              </label>

              <label>Quantity Dispatched *
                <input type="number" name="quantity_dispatched" value={form.quantity_dispatched} onChange={updateField} min="0.001" step="any" required />
              </label>

              <label>Dispatch Date *
                <input type="date" name="dispatch_date" value={form.dispatch_date} onChange={updateField} required />
              </label>

              <label>Transporter / Courier
                <input name="transporter" value={form.transporter} onChange={updateField} maxLength="200" placeholder="Transport company or courier" />
              </label>

              <label>Vehicle Number
                <input name="vehicle_number" value={form.vehicle_number} onChange={updateField} maxLength="80" placeholder="Vehicle registration number" />
              </label>

              <label className="shipment-wide">LR / Tracking Number
                <input name="tracking_details" value={form.tracking_details} onChange={updateField} maxLength="200" placeholder="LR number, docket or tracking ID" />
              </label>

              <label className="shipment-wide">Remarks
                <textarea name="remarks" value={form.remarks} onChange={updateField} rows="3" maxLength="2000" placeholder="Optional dispatch notes" />
              </label>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving || packingOptions.length === 0 || !form.packing_id}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Shipment'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="stats-grid compact-stats">
        <div className="stat-card"><div><span>Total Shipments</span><strong>{stats.total}</strong></div></div>
        <div className="stat-card"><div><span>Total Quantity Dispatched</span><strong>{stats.quantity.toLocaleString('en-IN')}</strong></div></div>
        <div className="stat-card"><div><span>Dispatched Today</span><strong>{stats.today}</strong></div></div>
      </section>

      <section className="panel">
        <div className="list-toolbar">
          <div><h2>Shipment History</h2><p>Newest dispatches appear first.</p></div>
          <input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search shipment, order, receiver, tracking…" aria-label="Search shipments" />
        </div>

        {loading
          ? <div className="empty-state">Loading shipments…</div>
          : records.length === 0
            ? <div className="empty-state">{query ? 'No shipments match your search.' : 'No shipments recorded yet. Select “New Shipment” to begin.'}</div>
            : <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Shipment No.</th>
                      <th>Packing No.</th>
                      <th>Order Reference</th>
                      <th>Product</th>
                      <th>Receiver</th>
                      <th>Dispatched Qty.</th>
                      <th>Dispatch Date</th>
                      <th>Transporter</th>
                      <th>Vehicle</th>
                      <th>LR / Tracking</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(item => (
                      <tr key={item.id}>
                        <td className="order-number">{item.shipment_number}</td>
                        <td>{item.packing_number}</td>
                        <td>{item.order_reference}</td>
                        <td>{item.product_name}</td>
                        <td>{item.customer_name}</td>
                        <td>{Number(item.quantity_dispatched).toLocaleString('en-IN')}</td>
                        <td>{item.dispatch_date}</td>
                        <td>{item.transporter || '—'}</td>
                        <td>{item.vehicle_number || '—'}</td>
                        <td>{item.tracking_details || '—'}</td>
                        <td>
                          <span className="inventory-status normal">Posted</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </section>
    </div>
  )
}

export default ShipmentManagement
