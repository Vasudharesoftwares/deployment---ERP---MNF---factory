import { useCallback, useEffect, useMemo, useState } from 'react'

const API = '/api/packing'
const today = () => new Date().toISOString().slice(0, 10)

const blankForm = () => ({
  order_reference: '',
  product_name: '',
  required_quantity: '1',
  receiver_party: '',
  via: '',
  status: 'In Progress',
  completed_quantity: '',
  completion_date: '',
  remarks: '',
})

async function request(path = '', options = {}) {
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

function PackingManagement() {
  const [records, setRecords] = useState([])
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
      setRecords(await request(`?q=${encodeURIComponent(search)}`))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadRecords(query), 200)
    return () => clearTimeout(timer)
  }, [query, loadRecords])

  const stats = useMemo(() => ({
    total: records.length,
    progress: records.filter(item => item.status === 'In Progress').length,
    completed: records.filter(item => item.status === 'Completed').length,
  }), [records])

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({
      ...current,
      [name]: value,
      ...(name === 'status' && value === 'In Progress'
        ? { completed_quantity: '', completion_date: '' }
        : {}),
    }))
  }

  function openNew() {
    setEditingId(null)
    setForm(blankForm())
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function editRecord(item) {
    setEditingId(item.id)
    setForm({
      order_reference: item.order_reference || '',
      product_name: item.product_name || '',
      required_quantity: String(item.required_quantity ?? ''),
      receiver_party: item.receiver_party || '',
      via: item.via || '',
      status: item.status || 'In Progress',
      completed_quantity: item.completed_quantity == null ? '' : String(item.completed_quantity),
      completion_date: item.completion_date || '',
      remarks: item.remarks || '',
    })
    setError('')
    setNotice('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitForm(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      ...form,
      required_quantity: Number(form.required_quantity),
      completed_quantity: form.status === 'Completed'
        ? Number(form.completed_quantity)
        : null,
      completion_date: form.status === 'Completed'
        ? form.completion_date
        : null,
      via: form.via.trim() || null,
      remarks: form.remarks.trim() || null,
    }

    try {
      const saved = await request(editingId ? `/${editingId}` : '', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setShowForm(false)
      setEditingId(null)
      setForm(blankForm())
      setNotice(`${saved.packing_number} ${editingId ? 'updated' : 'created'} successfully.`)
      await loadRecords(query)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord(item) {
    if (!window.confirm(`Delete ${item.packing_number}? This cannot be undone.`)) return
    setError('')
    setNotice('')
    try {
      await request(`/${item.id}`, { method: 'DELETE' })
      setNotice(`${item.packing_number} deleted successfully.`)
      await loadRecords(query)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="packing-module">
      <section className="page-intro">
        <div>
          <h2>Packing & Finished Goods</h2>
          <p>Track packing progress against your existing customer order references.</p>
        </div>
        <button className="primary-btn" onClick={openNew}>＋ New Packing Entry</button>
      </section>

      <div className="packing-info">
        <strong>Stock transfer on completion</strong>
        <span>Completing a packing entry transfers accepted finished goods into Packed Goods inventory. Only posted stock is available for dispatch.</span>
      </div>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {showForm && (
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h2>{editingId ? 'Edit Packing Entry' : 'New Packing Entry'}</h2>
              <p>Enter the existing order reference manually.</p>
            </div>
            <button type="button" className="close-btn" onClick={() => setShowForm(false)}>×</button>
          </div>

          <form onSubmit={submitForm}>
            <div className="packing-form-grid">
              <label>Order ID / Reference *
                <input name="order_reference" value={form.order_reference} onChange={updateField} required maxLength="120" placeholder="Enter existing order reference" />
              </label>
              <label>Product Details *
                <input name="product_name" value={form.product_name} onChange={updateField} required maxLength="200" placeholder="Product or piece details" />
              </label>
              <label>Required Quantity *
                <input type="number" name="required_quantity" value={form.required_quantity} onChange={updateField} min="0.001" step="any" required />
              </label>
              <label>Receiver Party *
                <input name="receiver_party" value={form.receiver_party} onChange={updateField} required maxLength="200" placeholder="Customer / receiver name" />
              </label>
              <label>Via
                <input name="via" value={form.via} onChange={updateField} maxLength="160" placeholder="Transporter, courier, pickup etc." />
              </label>
              <label>Packing Status *
                <select name="status" value={form.status} onChange={updateField}>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </label>

              {form.status === 'Completed' && <>
                <label>Actual Completed Quantity *
                  <input type="number" name="completed_quantity" value={form.completed_quantity} onChange={updateField} min="0.001" step="any" required />
                </label>
                <label>Completion Date *
                  <input type="date" name="completion_date" value={form.completion_date} onChange={updateField} max={today()} required />
                  <button type="button" className="packing-today-btn" onClick={() => setForm(current => ({ ...current, completion_date: today() }))}>Use today</button>
                </label>
              </>}

              <label className="packing-wide">Remarks
                <textarea name="remarks" value={form.remarks} onChange={updateField} rows="3" maxLength="2000" placeholder="Optional notes" />
              </label>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Packing Entry'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="stats-grid compact-stats">
        <div className="stat-card"><div><span>Total Entries</span><strong>{stats.total}</strong></div></div>
        <div className="stat-card"><div><span>In Progress</span><strong>{stats.progress}</strong></div></div>
        <div className="stat-card"><div><span>Completed</span><strong>{stats.completed}</strong></div></div>
      </section>

      <section className="panel">
        <div className="list-toolbar">
          <div><h2>Packing History</h2><p>Newest entries appear first.</p></div>
          <input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search order, product, receiver…" aria-label="Search packing entries" />
        </div>

        {loading
          ? <div className="empty-state">Loading packing entries…</div>
          : records.length === 0
            ? <div className="empty-state">{query ? 'No packing entries match your search.' : 'No packing entries yet. Select “New Packing Entry” to begin.'}</div>
            : <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Packing No.</th>
                      <th>Order Reference</th>
                      <th>Product</th>
                      <th>Required Qty.</th>
                      <th>Completed Qty.</th>
                      <th>Receiver</th>
                      <th>Via</th>
                      <th>Status</th>
                      <th>Completion Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(item => (
                      <tr key={item.id}>
                        <td className="order-number">{item.packing_number}</td>
                        <td>{item.order_reference}</td>
                        <td>{item.product_name}</td>
                        <td>{Number(item.required_quantity).toLocaleString('en-IN')}</td>
                        <td>{item.completed_quantity == null ? '—' : Number(item.completed_quantity).toLocaleString('en-IN')}</td>
                        <td>{item.receiver_party}</td>
                        <td>{item.via || '—'}</td>
                        <td><span className={`status-pill ${item.status === 'Completed' ? 'completed' : 'in-progress'}`}>{item.status}</span></td>
                        <td>{item.completion_date || '—'}</td>
                        <td>
                          <div className="packing-actions">
                            {item.stock_posted ? <span className="inventory-status normal">Stock Posted</span> : <><button className="edit-btn" onClick={() => editRecord(item)}>Edit</button><button className="edit-btn danger-btn" onClick={() => deleteRecord(item)}>Delete</button></>}
                          </div>
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

export default PackingManagement
