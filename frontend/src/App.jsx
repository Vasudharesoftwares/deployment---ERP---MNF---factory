import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import EmployeeManagement from './EmployeeManagement'
import PurchaseManagement from './PurchaseManagement'
import ProductionManagement from './ProductionManagement'
import PackingManagement from './PackingManagement'
import ShipmentManagement from './ShipmentManagement'
import CostCalculator from './CostCalculator'
import InventoryManagement from './InventoryManagement'

const API = '/api'
const today = () => new Date().toISOString().slice(0, 10)

const modules = [
  { name: 'Dashboard', description: 'Factory overview and daily activity', icon: '▦' },
  { name: 'Employee Management', description: 'Employees, workers, attendance and wages', icon: '♙' },
  { name: 'Order Management', description: 'Customer orders and delivery dates', icon: '▤' },
  { name: 'Purchase Management', description: 'Suppliers and material purchases', icon: '⇩' },
  { name: 'Production Management', description: 'Production plans, progress and stages', icon: '⚙' },
  { name: 'Packing & Finished Goods', description: 'Packed products, rolls, boxes and weight', icon: '▣' },
  { name: 'Shipment Management', description: 'Dispatch records and transport details', icon: '➜' },
  { name: 'Manufacturing Cost Calculator', description: 'Calculate raw material costs', icon: '₹' },
  { name: 'Inventory Management', description: 'Raw materials and finished goods records', icon: '▥' },
]

const statuses = [
  'Pending', 'Confirmed', 'In Production',
  'Ready', 'Completed', 'Cancelled'
]

const blankForm = () => ({
  customer_name: '',
  order_date: today(),
  product_name: '',
  quantity: '1',
  agreed_price: '',
  delivery_date: '',
  status: 'Pending',
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

function App() {
  const [active, setActive] = useState('Dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await api('/dashboard'))
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const loadOrders = useCallback(async (search = '') => {
    try {
      setOrders(await api(`/orders?q=${encodeURIComponent(search)}`))
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    let alive = true

    Promise.all([api('/dashboard'), api('/orders')])
      .then(([dash, list]) => {
        if (alive) {
          setDashboard(dash)
          setOrders(list)
          setError('')
        }
      })
      .catch(err => {
        if (alive) setError(err.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (active !== 'Order Management') return
    const timer = setTimeout(() => loadOrders(query), 250)
    return () => clearTimeout(timer)
  }, [active, query, loadOrders])

  function openNewOrder() {
    setEditingId(null)
    setForm(blankForm())
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function editOrder(order) {
    setEditingId(order.id)
    setForm({
      customer_name: order.customer_name || '',
      order_date: order.order_date || today(),
      product_name: order.product_name || '',
      quantity: String(order.quantity ?? 1),
      agreed_price: order.agreed_price == null ? '' : String(order.agreed_price),
      delivery_date: order.delivery_date || '',
      status: order.status || 'Pending',
      remarks: order.remarks || '',
    })
    setError('')
    setNotice('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateField(event) {
    setForm(current => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  async function submitOrder(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      ...form,
      quantity: Number(form.quantity),
      agreed_price: form.agreed_price === '' ? null : Number(form.agreed_price),
      delivery_date: form.delivery_date || null,
      remarks: form.remarks.trim() || null,
    }

    try {
      const saved = await api(
        editingId ? `/orders/${editingId}` : '/orders',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      )

      const wasEditing = Boolean(editingId)
      setShowForm(false)
      setEditingId(null)
      setForm(blankForm())
      setNotice(`${saved.order_number} ${wasEditing ? 'updated' : 'created'} successfully.`)

      await Promise.all([loadOrders(query), loadDashboard()])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalValue = useMemo(
    () => orders.reduce(
      (sum, order) => sum + Number(order.agreed_price || 0) * Number(order.quantity || 0),
      0,
    ),
    [orders],
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div><strong>BUSINESS</strong><span>CENTRAL</span></div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {modules.map(module => (
            <button
              key={module.name}
              className={`nav-item ${active === module.name ? 'active' : ''}`}
              onClick={() => {
                setActive(module.name)
                setError('')
                setNotice('')
              }}
            >
              <span className="nav-icon">{module.icon}</span>
              <span>{module.name}</span>
              {module.name !== 'Dashboard' && module.name !== 'Order Management' && module.name !== 'Employee Management' && module.name !== 'Purchase Management' && module.name !== 'Production Management' && module.name !== 'Packing & Finished Goods' && module.name !== 'Manufacturing Cost Calculator' && module.name !== 'Inventory Management' &&
                <span className="nav-soon">Soon</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">Simple manufacturing management</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">MANUFACTURING WORKSPACE</span>
            <h1>{active === 'Dashboard' ? 'Factory Dashboard' : active}</h1>
          </div>
          <div className="status"><span /> Demo mode</div>
        </header>

        {error && <div className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert success" role="status">{notice}</div>}

        {active === 'Dashboard' && <>
          <section className="welcome">
            <div>
              <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
              <h2>Run your factory, simply.</h2>
              <p>Manage orders, purchases, production, people and dispatch from one place.</p>
            </div>
            <div className="welcome-symbol">V</div>
          </section>

          <div className="section-heading">
            <div>
              <h2>Factory Overview</h2>
              <p>Sample figures in this interactive browser demo.</p>
            </div>
            <span className="module-count">DEMO DATA</span>
          </div>

          {loading
            ? <div className="empty-state">Loading factory data…</div>
            : <div className="stats-grid">
                <Stat label="Total Orders" value={dashboard?.orders_total ?? 0} />
                <Stat label="Active Orders" value={dashboard?.orders_active ?? 0} />
                <Stat label="Pending Orders" value={dashboard?.orders_pending ?? 0} />
                <Stat label="Completed Orders" value={dashboard?.orders_completed ?? 0} />
              </div>
          }

          <div className="section-heading">
            <div><h2>Factory Modules</h2><p>Choose a module to get started.</p></div>
            <span className="module-count">9 MODULES</span>
          </div>

          <section className="module-grid">
            {modules.map(module => (
              <button
                className="module-card"
                key={module.name}
                onClick={() => setActive(module.name)}
              >
                <div className="module-card-top">
                  <span className="module-icon">{module.icon}</span>
                  <span className="module-arrow">↗</span>
                </div>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
              </button>
            ))}
          </section>
        </>}

        {active === 'Order Management' && <>
          <section className="page-intro">
            <div><h2>Customer Orders</h2><p>Create, track and update customer orders.</p></div>
            <button className="primary-btn" onClick={openNewOrder}>＋ New Order</button>
          </section>

          {showForm && <section className="panel form-panel">
            <div className="panel-heading">
              <div>
                <h2>{editingId ? 'Edit Order' : 'Create New Order'}</h2>
                <p>Fields marked with * are required.</p>
              </div>
              <button className="close-btn" onClick={() => setShowForm(false)}>×</button>
            </div>

            <form onSubmit={submitOrder}>
              <div className="form-grid">
                <label>Customer Name *
                  <input name="customer_name" value={form.customer_name} onChange={updateField} required maxLength="160" placeholder="Customer or company name" />
                </label>
                <label>Order Date *
                  <input type="date" name="order_date" value={form.order_date} onChange={updateField} required />
                </label>
                <label>Product / Item *
                  <input name="product_name" value={form.product_name} onChange={updateField} required maxLength="200" placeholder="Product or item name" />
                </label>
                <label>Quantity *
                  <input type="number" name="quantity" value={form.quantity} onChange={updateField} min="0.001" step="any" required />
                </label>
                <label>Agreed Price (optional)
                  <input type="number" name="agreed_price" value={form.agreed_price} onChange={updateField} min="0" step="0.01" placeholder="₹ 0.00" />
                </label>
                <label>Delivery Date (optional)
                  <input type="date" name="delivery_date" value={form.delivery_date} onChange={updateField} min={form.order_date} />
                </label>
                <label>Order Status
                  <select name="status" value={form.status} onChange={updateField}>
                    {statuses.map(status => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label className="wide-field">Remarks (optional)
                  <textarea name="remarks" value={form.remarks} onChange={updateField} rows="3" maxLength="2000" />
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="primary-btn" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Order'}
                </button>
              </div>
            </form>
          </section>}

          <section className="stats-grid compact-stats">
            <Stat label="Total Orders" value={dashboard?.orders_total ?? 0} />
            <Stat label="Active Orders" value={dashboard?.orders_active ?? 0} />
            <Stat label="Completed" value={dashboard?.orders_completed ?? 0} />
            <Stat label="Listed Order Value" value={`₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
          </section>

          <section className="panel">
            <div className="list-toolbar">
              <div><h2>All Orders</h2><p>Newest orders appear first.</p></div>
              <input
                className="search-input"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search order, customer or product…"
                aria-label="Search orders"
              />
            </div>

            {orders.length === 0
              ? <div className="empty-state">
                  {query ? 'No orders match your search.' : 'No orders yet. Select “New Order” to create your first customer order.'}
                </div>
              : <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order No.</th><th>Customer</th><th>Product / Item</th>
                        <th>Quantity</th><th>Order Date</th><th>Delivery</th><th>Status</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id}>
                          <td className="order-number">{order.order_number || `Order #${order.id}`}</td>
                          <td>{order.customer_name}</td>
                          <td>{order.product_name}</td>
                          <td>{Number(order.quantity).toLocaleString('en-IN')}</td>
                          <td>{order.order_date}</td>
                          <td>{order.delivery_date || '—'}</td>
                          <td><span className={`status-pill ${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span></td>
                          <td><button className="edit-btn" onClick={() => editOrder(order)}>Edit</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </section>
        </>}

        {active === 'Employee Management' && <EmployeeManagement />}
        {active === 'Purchase Management' && <PurchaseManagement />}
        {active === 'Production Management' && <ProductionManagement />}
        {active === 'Packing & Finished Goods' && <PackingManagement />}
        {active === 'Shipment Management' && <ShipmentManagement />}
        {active === 'Manufacturing Cost Calculator' && <CostCalculator />}
        {active === 'Inventory Management' && <InventoryManagement />}

        {active !== 'Dashboard' && active !== 'Order Management' && active !== 'Employee Management' && active !== 'Purchase Management' && active !== 'Production Management' && active !== 'Packing & Finished Goods' && active !== 'Shipment Management' && active !== 'Manufacturing Cost Calculator' && active !== 'Inventory Management' &&
          <section className="coming-soon panel">
            <h2>{active}</h2>
            <p>This module is planned for a future Business Central development step. Your existing data is unaffected.</p>
            <button className="secondary-btn" onClick={() => setActive('Dashboard')}>Back to Dashboard</button>
          </section>
        }

        <footer>BUSINESS CENTRAL <span>·</span> Initial development release 0.1.0</footer>
      </main>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  )
}

export default App
