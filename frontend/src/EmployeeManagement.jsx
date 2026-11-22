import { useCallback, useEffect, useState } from 'react'

const API = '/api'
const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => today().slice(0, 7)
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

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

const blankLabourForm = () => ({
  name: '',
  size: '',
  weight: '',
  quantity: '',
  rate: '',
})

const blankEmployee = () => ({
  name: '',
  worker_type: 'Salaried',
  phone: '',
  joining_date: today(),
  monthly_salary: '',
  daily_wage: '',
  piece_rate: '',
  pay_mode: 'Piece Based',
  job_description: '',
})

function EmployeeManagement() {
  const [salariedEmployees, setSalariedEmployees] = useState([])
  const [labourEmployees, setLabourEmployees] = useState([])
  const [salariedQuery, setSalariedQuery] = useState('')
  const [labourQuery, setLabourQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [month, setMonth] = useState(currentMonth())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankEmployee)
  const [labourForm, setLabourForm] = useState(blankLabourForm)
  const [attendance, setAttendance] = useState([])
  const [workEntries, setWorkEntries] = useState([])
  const [pieceOptions, setPieceOptions] = useState({ sizes: [], weights: [], rates: [] })
  const [workQuantity, setWorkQuantity] = useState('')
  const [workRate, setWorkRate] = useState('')
  const [payments, setPayments] = useState([])
  const [summary, setSummary] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadEmployees = useCallback(async () => {
    try {
      const salariedParams = new URLSearchParams({
        q: salariedQuery,
        worker_type: 'Salaried',
        active_only: 'true',
      })
      const labourParams = new URLSearchParams({
        q: labourQuery,
        worker_type: 'Labour',
        active_only: 'true',
      })
      const [salaried, labour] = await Promise.all([
        request(`/employees?${salariedParams}`),
        request(`/employees?${labourParams}`),
      ])
      setSalariedEmployees(salaried)
      setLabourEmployees(labour)
    } catch (err) {
      setError(err.message)
    }
  }, [salariedQuery, labourQuery])

  const loadDetails = useCallback(async employee => {
    if (!employee) return
    try {
      const id = employee.id
      const [a, w, p, s] = await Promise.all([
        employee.worker_type === 'Salaried'
          ? request(`/employees/${id}/attendance?month=${month}`)
          : Promise.resolve([]),
        employee.worker_type === 'Labour'
          ? request(`/employees/${id}/work-entries?month=${month}`)
          : Promise.resolve([]),
        request(`/employees/${id}/payments?month=${month}`),
        request(`/employees/${id}/summary?month=${month}`),
      ])
      setAttendance(a)
      setWorkEntries(w)
      setPayments(p)
      setSummary(s)
    } catch (err) {
      setError(err.message)
    }
  }, [month])

  useEffect(() => { loadEmployees() }, [loadEmployees])
  useEffect(() => { loadDetails(selected) }, [selected, loadDetails])

  useEffect(() => {
    if (selected?.worker_type === 'Labour') {
      request('/employees/piece-work-options')
        .then(setPieceOptions)
        .catch(err => setError(err.message))
    } else {
      setPieceOptions({ sizes: [], weights: [], rates: [] })
    }
    setWorkQuantity('')
    setWorkRate('')
  }, [selected?.id, selected?.worker_type])

  async function createEmployee(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const payload = {
      ...form,
      pay_mode: form.worker_type === 'Labour' ? 'Piece Based' : form.pay_mode,
      phone: form.phone.trim() || null,
      joining_date: form.joining_date || null,
      monthly_salary: form.monthly_salary === '' ? null : Number(form.monthly_salary),
      daily_wage: form.daily_wage === '' ? null : Number(form.daily_wage),
      piece_rate: form.piece_rate === '' ? null : Number(form.piece_rate),
      job_description: form.job_description.trim() || null,
    }
    try {
      const saved = await request('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setShowForm(false)
      setForm(blankEmployee())
      setNotice(`${saved.name} added successfully (${saved.employee_code}).`)
      await loadEmployees()
      setSelected(saved)
      setTab('Overview')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function createLabourWithWork(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    const quantity = Number(labourForm.quantity)
    const rate = Number(labourForm.rate)

    try {
      const saved = await request('/employees/labour-with-first-work', {
        method: 'POST',
        body: JSON.stringify({
          name: labourForm.name.trim(),
          work_date: today(),
          size: labourForm.size.trim(),
          weight: Number(labourForm.weight),
          quantity,
          rate,
        }),
      })

      setShowForm(false)
      setLabourForm(blankLabourForm())
      setNotice(
        `${saved.employee.name} added successfully with first piece-work entry. Total: ${money(saved.work_entry.total_amount)}.`
      )
      setSelected(null)
      await loadEmployees()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitRecord(event, endpoint, payload, successMessage) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(`/employees/${selected.id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setNotice(successMessage)
      await loadDetails(selected)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function changeActiveStatus() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await request(`/employees/${selected.id}/${selected.is_active ? 'deactivate' : 'reactivate'}`, {
        method: 'POST',
      })
      const updated = { ...selected, is_active: selected.is_active ? 0 : 1 }
      setSelected(updated)
      setNotice(updated.is_active ? 'Employee reactivated.' : 'Employee deactivated.')
      await loadEmployees()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function updateEmployeeField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  return (
    <section className="employee-module">
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      {!selected ? <>
        <div className="page-intro employee-toolbar">
          <div>
            <h2>People & Workforce</h2>
            <p>Manage salaried employees and piece-based labour workers.</p>
          </div>

        </div>

        {showForm && (form.worker_type === 'Labour' ? (
          <div className="labour-create-overlay">
            <section className="panel labour-create-dialog">
              <div className="panel-heading">
                <div>
                  <h2>Add Labour & Piece Details</h2>
                  <p>Enter the worker and their first piece-work entry</p>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowForm(false)}>×</button>
              </div>

              <form onSubmit={createLabourWithWork}>
                <div className="labour-create-grid">
                  <label className="employee-wide">Employee Name *
                    <input
                      value={labourForm.name}
                      onChange={event => setLabourForm(current => ({ ...current, name: event.target.value }))}
                      maxLength="160"
                      required
                      autoFocus
                    />
                  </label>

                  <label>Piece Size *
                    <input
                      value={labourForm.size}
                      onChange={event => setLabourForm(current => ({ ...current, size: event.target.value }))}
                      maxLength="100"
                      placeholder="Enter piece size"
                      required
                    />
                  </label>

                  <label>Piece Weight (kg) *
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={labourForm.weight}
                      onChange={event => setLabourForm(current => ({ ...current, weight: event.target.value }))}
                      placeholder="Enter weight"
                      required
                    />
                  </label>

                  <label>Quantity (Pieces) *
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={labourForm.quantity}
                      onChange={event => setLabourForm(current => ({ ...current, quantity: event.target.value }))}
                      required
                    />
                  </label>

                  <label>Price per Piece (₹) *
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={labourForm.rate}
                      onChange={event => setLabourForm(current => ({ ...current, rate: event.target.value }))}
                      required
                    />
                  </label>
                </div>

                <div className="labour-create-total">
                  <span>Total Amount</span>
                  <strong>{money((Number(labourForm.quantity) || 0) * (Number(labourForm.rate) || 0))}</strong>
                  <small>Quantity × Price per Piece</small>
                </div>

                <div className="form-actions">
                  <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                  <button className="primary-btn" disabled={busy}>
                    {busy ? 'Saving…' : 'Save Labour & Piece Details'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : (
          <div className="labour-create-overlay">
            <section className="panel labour-create-dialog salaried-create-dialog">
            <div className="panel-heading">
              <div>
                <h2>Add Salaried Employee</h2>
                <p>Enter the employee's basic details and monthly salary.</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={createEmployee}>
              <div className="employee-form-grid">
                <label>Employee Name *
                  <input name="name" value={form.name} onChange={updateEmployeeField} required maxLength="160" />
                </label>
                <label>Phone Number
                  <input name="phone" value={form.phone} onChange={updateEmployeeField} maxLength="30" />
                </label>
                <label>Joining Date
                  <input type="date" name="joining_date" value={form.joining_date} onChange={updateEmployeeField} />
                </label>
                <label>Fixed Monthly Salary (₹) *
                  <input type="number" name="monthly_salary" value={form.monthly_salary} onChange={updateEmployeeField} min="0" step="0.01" required />
                </label>
                <label className="employee-wide">Job Description / Role
                  <input name="job_description" value={form.job_description} onChange={updateEmployeeField} maxLength="500" placeholder="e.g. Supervisor, accountant" />
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="primary-btn" disabled={busy}>{busy ? 'Saving…' : 'Save Employee'}</button>
              </div>
            </form>
            </section>
          </div>
        ))}

        <div className="employee-category-grid">
          <EmployeeDirectoryPanel
            title="Salaried Employees"
            subtitle="Fixed monthly salary"
            employees={salariedEmployees}
            query={salariedQuery}
            onQuery={setSalariedQuery}
            onAdd={() => {
              setForm({ ...blankEmployee(), worker_type: 'Salaried' })
              setShowForm(true)
              setError('')
              setNotice('')
            }}
            onOpen={employee => {
              setSelected(employee)
              setTab('Overview')
              setError('')
              setNotice('')
            }}
          />
          <EmployeeDirectoryPanel
            title="Labour Based"
            subtitle="Piece-based labour workers"
            employees={labourEmployees}
            query={labourQuery}
            onQuery={setLabourQuery}
            onAdd={() => {
              setForm({ ...blankEmployee(), worker_type: 'Labour', pay_mode: 'Piece Based' })
              setLabourForm(blankLabourForm())
              setShowForm(true)
              setError('')
              setNotice('')
            }}
            onOpen={employee => {
              setSelected(employee)
              setTab('Overview')
              setError('')
              setNotice('')
            }}
          />
        </div>
      </> : <>
        <div className="page-intro employee-profile">
          <div>
            <button className="back-link" onClick={() => { setSelected(null); setError(''); setNotice('') }}>← Employee Directory</button>
            <h2>{selected.name}</h2>
            <p>{selected.employee_code} · {selected.worker_type} · {selected.job_description || 'No role specified'}</p>
          </div>
          <div className="employee-profile-actions">
            <span className={`status-pill ${selected.is_active ? 'confirmed' : 'cancelled'}`}>{selected.is_active ? 'Active' : 'Inactive'}</span>
            <button className="secondary-btn" disabled={busy} onClick={changeActiveStatus}>{selected.is_active ? 'Deactivate' : 'Reactivate'}</button>
          </div>
        </div>

        <div className="employee-detail-toolbar">
          <div className="employee-tabs">
            {(selected.worker_type === 'Labour' ? ['Overview', 'Piece Work', 'Payments'] : ['Overview', 'Attendance', 'Payments']).map(item =>
              <button key={item} className={tab === item ? 'employee-tab active' : 'employee-tab'} onClick={() => setTab(item)}>{item}</button>
            )}
          </div>
          <label className="month-picker">Payroll Month
            <input type="month" value={month} onChange={event => setMonth(event.target.value)} />
          </label>
        </div>

        {tab === 'Overview' && <>
          <div className="stats-grid employee-summary-grid">
            <Stat label="Total Earnings" value={money(summary?.total_earnings)} />
            <Stat label="Total Paid" value={money(summary?.total_paid)} />
            <Stat label="Advances" value={money(summary?.advances)} />
            <Stat label="Outstanding" value={money(summary?.outstanding)} />
          </div>
          <div className="employee-overview-grid">
            <section className="panel">
              <h2>Monthly Earnings Summary</h2>
              <p className="employee-muted">{month}</p>
              {selected.worker_type === 'Salaried' ? <>
                <SummaryRow label="Fixed monthly salary" value={money(selected.monthly_salary)} />
                <SummaryRow label="Calculated salary" value={money(summary?.monthly_salary_earnings)} />
              </> : <>
                <SummaryRow label="Piece Based earnings" value={money(summary?.piece_based_earnings)} />
                <SummaryRow label="Piece quantity completed" value={Number(summary?.piece_based_quantity || 0).toLocaleString('en-IN')} />
              </>}
              <SummaryRow label="Total earnings" value={money(summary?.total_earnings)} strong />
              <SummaryRow label="Payments & advances" value={money(summary?.total_paid)} />
              <SummaryRow label="Outstanding balance" value={money(summary?.outstanding)} strong />
            </section>
            {selected.worker_type === 'Salaried' && <section className="panel">
              <h2>Attendance Summary</h2>
              <p className="employee-muted">Recorded attendance for {month}</p>
              <SummaryRow label="Present days" value={summary?.present_days ?? 0} />
              <SummaryRow label="Half days" value={summary?.half_days ?? 0} />
              <SummaryRow label="Absent days" value={summary?.absent_days ?? 0} />
              <SummaryRow label="Leave days" value={summary?.leave_days ?? 0} />
              <SummaryRow label="Paid attendance days" value={summary?.paid_days ?? 0} strong />
            </section>}
          </div>
          <section className="panel">
            <h2>Employee Details</h2>
            <div className="employee-info-grid">
              {selected.worker_type === 'Salaried' && <>
                <SummaryRow label="Phone" value={selected.phone || '—'} />
                <SummaryRow label="Joining date" value={selected.joining_date || '—'} />
                <SummaryRow label="Job / Role" value={selected.job_description || '—'} />
              </>}
              <SummaryRow label="Category" value={selected.worker_type} />
              {selected.worker_type === 'Salaried'
                ? <SummaryRow label="Monthly salary" value={money(selected.monthly_salary)} />
                : <>
                    <SummaryRow label="Payment arrangement" value="Piece Based" />
                  </>}
            </div>
          </section>
        </>}

        {selected.worker_type === 'Salaried' && tab === 'Attendance' && <>
          <section className="panel">
            <div className="panel-heading"><div><h2>Record Attendance</h2><p>One attendance record per employee per day.</p></div></div>
            <form className="inline-entry-form" onSubmit={event => {
              const data = new FormData(event.currentTarget)
              submitRecord(event, 'attendance', {
                attendance_date: data.get('attendance_date'),
                status: data.get('status'),
                hours_worked: data.get('hours_worked') ? Number(data.get('hours_worked')) : null,
                remarks: data.get('remarks') || null,
              }, 'Attendance saved successfully.')
            }}>
              <label>Date<input type="date" name="attendance_date" defaultValue={today()} required /></label>
              <label>Status<select name="status"><option>Present</option><option>Half Day</option><option>Absent</option><option>Leave</option></select></label>
              <label>Hours worked<input type="number" name="hours_worked" min="0" max="24" step="0.5" placeholder="Optional" /></label>
              <label>Remarks<input name="remarks" placeholder="Optional" /></label>
              <button className="primary-btn" disabled={busy}>Save Attendance</button>
            </form>
          </section>
          <section className="panel">
            <h2>Attendance Records — {month}</h2>
            <RecordTable headers={['Date', 'Status', 'Hours', 'Remarks']} rows={attendance.map(row => [row.attendance_date, row.status, row.hours_worked ?? '—', row.remarks || '—'])} />
          </section>
        </>}

        {tab === 'Piece Work' && <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Record Piece Work</h2>
                <p>Enter the completed quantity and labour rate. Saved sizes, weights and rates are available as suggestions for all labour employees.</p>
              </div>
            </div>
            <form className="inline-entry-form" onSubmit={event => {
              const formElement = event.currentTarget
              const data = new FormData(formElement)
              const quantity = Number(data.get('quantity'))
              const rate = Number(data.get('rate'))
              submitRecord(event, 'work-entries', {
                work_date: data.get('work_date'),
                work_description: 'Piece Work',
                product_name: null,
                quantity,
                quantity_unit: 'piece',
                rate,
                size: data.get('size') || null,
                weight: data.get('weight') ? Number(data.get('weight')) : null,
                custom_fields: {},
                machine_type: null,
                machine_name: null,
                machine_size: null,
                machine_weight: null,
                remarks: null,
              }, `Piece work saved. Total labour payment: ${money(quantity * rate)}.`).then(saved => {
                if (saved) {
                  formElement.reset()
                  setWorkQuantity('')
                  setWorkRate('')
                  request('/employees/piece-work-options')
                    .then(setPieceOptions)
                    .catch(err => setError(err.message))
                }
              })
            }}>
              <label>Date
                <input type="date" name="work_date" defaultValue={today()} required />
              </label>
              <label>Piece Size
                <input name="size" list="piece-size-options" placeholder="Select or enter a size" />
                <datalist id="piece-size-options">
                  {pieceOptions.sizes.map(value => <option key={value} value={value} />)}
                </datalist>
              </label>
              <label>Piece Weight (kg)
                <input type="number" name="weight" list="piece-weight-options" min="0" step="any" placeholder="Select or enter weight" />
                <datalist id="piece-weight-options">
                  {pieceOptions.weights.map(value => <option key={value} value={value} />)}
                </datalist>
              </label>
              <label>Quantity (Pieces) *
                <input type="number" name="quantity" min="0.001" step="any"
                  value={workQuantity}
                  onChange={event => setWorkQuantity(event.target.value)} required />
              </label>
              <label>Rate / Price per Piece (₹) *
                <input type="number" name="rate" list="piece-rate-options" min="0" step="0.01"
                  value={workRate}
                  onChange={event => setWorkRate(event.target.value)} required />
                <datalist id="piece-rate-options">
                  {pieceOptions.rates.map(value => <option key={value} value={value} />)}
                </datalist>
              </label>
              <div className="work-entry-total">
                <span>Total Labour Payment</span>
                <strong>{money((Number(workQuantity) || 0) * (Number(workRate) || 0))}</strong>
                <small>Quantity × Rate per Piece</small>
              </div>
              <button className="primary-btn" disabled={busy}>Save Work Entry</button>
            </form>
          </section>
          <section className="panel">
            <h2>Piece Work History — {month}</h2>
            <RecordTable
              headers={['Date', 'Size', 'Weight', 'Quantity', 'Rate per Piece', 'Total Labour Payment']}
              rows={workEntries.map(row => [
                row.work_date,
                row.size || row.machine_size || '—',
                row.weight == null
                  ? (row.machine_weight == null ? '—' : `${row.machine_weight} kg`)
                  : `${row.weight} kg`,
                `${Number(row.quantity).toLocaleString('en-IN')} ${row.quantity_unit || 'piece'}`,
                money(row.rate),
                money(row.total_amount),
              ])}
            />
          </section>
        </>}

        {tab === 'Payments' && <>
          <section className="panel">
            <div className="panel-heading"><div><h2>Record Payment / Advance</h2><p>Advances are recorded separately and included in total paid.</p></div></div>
            <form className="inline-entry-form" onSubmit={event => {
              const data = new FormData(event.currentTarget)
              submitRecord(event, 'payments', {
                payment_date: data.get('payment_date'),
                payment_period: data.get('payment_period'),
                payment_type: data.get('payment_type'),
                amount: Number(data.get('amount')),
                remarks: data.get('remarks') || null,
              }, 'Payment recorded successfully.')
              event.currentTarget.reset()
            }}>
              <label>Payment Date<input type="date" name="payment_date" defaultValue={today()} required /></label>
              <label>For Month<input type="month" name="payment_period" defaultValue={month} required /></label>
              <label>Payment Type<select name="payment_type">
                {selected.worker_type === 'Salaried'
                  ? <><option>Advance</option><option>Salary</option><option>Other</option></>
                  : <><option>Advance</option><option>Piece Based</option><option>Other</option></>}
              </select></label>
              <label>Amount (₹)<input type="number" name="amount" min="0.01" step="0.01" required /></label>
              <label>Remarks<input name="remarks" placeholder="Optional" /></label>
              <button className="primary-btn" disabled={busy}>Save Payment</button>
            </form>
          </section>
          <section className="panel">
            <h2>Payment History — {month}</h2>
            <RecordTable headers={['Date', 'Payment Type', 'Amount', 'Remarks']} rows={payments.map(row => [row.payment_date, row.payment_type, money(row.amount), row.remarks || '—'])} />
          </section>
        </>}
      </>}
    </section>
  )
}

function EmployeeDirectoryPanel({ title, subtitle, employees, query, onQuery, onAdd, onOpen }) {
  return (
    <section className="panel employee-category-panel">
      <div className="employee-category-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          <span className="employee-count">{employees.length} employee(s)</span>
        </div>
        <button className="primary-btn employee-add-btn" onClick={onAdd}>＋ Add</button>
      </div>
      <input
        className="search-input employee-category-search"
        value={query}
        onChange={event => onQuery(event.target.value)}
        placeholder="Search name, code or phone…"
      />
      {employees.length === 0
        ? <div className="employee-category-empty">No {title.toLowerCase()} found.</div>
        : <div className="table-wrap employee-category-table-wrap">
            <table>
              <thead>
                <tr><th>Employee</th><th>Code</th><th>Phone</th><th></th></tr>
              </thead>
              <tbody>
                {employees.map(employee => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.name}</strong>
                      <div className="employee-subtext">{employee.job_description || '—'}</div>
                    </td>
                    <td className="order-number">{employee.employee_code || '—'}</td>
                    <td>{employee.phone || '—'}</td>
                    <td><button className="edit-btn" onClick={() => onOpen(employee)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </section>
  )
}

function SummaryRow({ label, value, strong = false }) {
  return <div className={`summary-row ${strong ? 'summary-strong' : ''}`}><span>{label}</span><strong>{value ?? '—'}</strong></div>
}

function Stat({ label, value }) {
  return <div className="stat-card"><div><span>{label}</span><strong>{value}</strong></div></div>
}

function RecordTable({ headers, rows }) {
  if (!rows.length) return <div className="empty-state">No records for this month yet.</div>
  return <div className="table-wrap"><table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>
    {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
  </tbody></table></div>
}

export default EmployeeManagement
