import { useCallback, useEffect, useMemo, useState } from 'react'

const API = '/api'

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
    throw new Error(data.detail || `Request failed (${response.status})`)
  }
  return data
}

const emptyMaterial = () => ({
  material_name: '',
  unit: 'kg',
  rate: '',
})

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`

export default function CostCalculator() {
  const [materials, setMaterials] = useState([])
  const [materialForm, setMaterialForm] = useState(emptyMaterial)
  const [editingId, setEditingId] = useState(null)
  const [lines, setLines] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadMaterials = useCallback(async () => {
    try {
      setMaterials(await request('/cost-calculator/materials'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  const total = useMemo(
    () => lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.rate),
      0
    ),
    [lines]
  )

  function resetMaterialForm() {
    setMaterialForm(emptyMaterial())
    setEditingId(null)
  }

  async function saveMaterial(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      material_name: materialForm.material_name.trim(),
      unit: materialForm.unit.trim(),
      rate: Number(materialForm.rate),
    }

    try {
      const saved = await request(
        editingId
          ? `/cost-calculator/materials/${editingId}`
          : '/cost-calculator/materials',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      )

      setNotice(`${saved.material_name} ${editingId ? 'updated' : 'saved'} successfully.`)
      resetMaterialForm()
      await loadMaterials()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function editMaterial(material) {
    setEditingId(material.id)
    setMaterialForm({
      material_name: material.material_name,
      unit: material.unit,
      rate: String(material.rate),
    })
    setError('')
    setNotice('')
  }

  async function deleteMaterial(material) {
    if (!window.confirm(`Delete ${material.material_name} from the saved material list?`)) {
      return
    }

    try {
      await request(`/cost-calculator/materials/${material.id}`, {
        method: 'DELETE',
      })
      setLines(current => current.filter(line => line.materialId !== material.id))
      if (Number(selectedId) === material.id) setSelectedId('')
      if (editingId === material.id) resetMaterialForm()
      setNotice(`${material.material_name} deleted.`)
      await loadMaterials()
    } catch (err) {
      setError(err.message)
    }
  }

  function addLine() {
    const material = materials.find(item => item.id === Number(selectedId))
    const qty = Number(quantity)

    if (!material) {
      setError('Please select a saved raw material.')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a quantity greater than zero.')
      return
    }

    setLines(current => [
      ...current,
      {
        rowId: `${Date.now()}-${Math.random()}`,
        materialId: material.id,
        material_name: material.material_name,
        unit: material.unit,
        quantity: String(qty),
        rate: Number(material.rate),
      },
    ])
    setSelectedId('')
    setQuantity('1')
    setError('')
  }

  function updateLine(rowId, value) {
    setLines(current => current.map(line =>
      line.rowId === rowId
        ? { ...line, quantity: value }
        : line
    ))
  }

  function removeLine(rowId) {
    setLines(current => current.filter(line => line.rowId !== rowId))
  }

  return (
    <div className="cost-calculator-module">
      <section className="page-intro">
        <div>
          <p>Save raw materials once, then select and combine them whenever you calculate a product cost.</p>
        </div>
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      <section className="panel cost-master-panel">
        <div className="panel-heading">
          <div>
            <h2>Raw Material Master</h2>
            <p>Add each raw material once. It will remain available in the calculator list.</p>
          </div>
          <span className="module-count">{materials.length} MATERIALS</span>
        </div>

        <form className="cost-material-form" onSubmit={saveMaterial}>
          <label>
            Material Name *
            <input
              value={materialForm.material_name}
              onChange={event => setMaterialForm({
                ...materialForm,
                material_name: event.target.value,
              })}
              placeholder="e.g. Cotton"
              maxLength="160"
              required
            />
          </label>

          <label>
            Unit *
            <select
              value={materialForm.unit}
              onChange={event => setMaterialForm({
                ...materialForm,
                unit: event.target.value,
              })}
              required
            >
              {['kg', 'gram', 'meter', 'cm', 'piece', 'litre', 'bundle', 'roll', 'box', 'set', 'pcs'].map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>

          <label>
            Rate per Unit (₹) *
            <input
              type="number"
              min="0"
              step="0.01"
              value={materialForm.rate}
              onChange={event => setMaterialForm({
                ...materialForm,
                rate: event.target.value,
              })}
              placeholder="0.00"
              required
            />
          </label>

          <div className="cost-master-buttons">
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Material' : 'Save Material'}
            </button>
            {editingId && (
              <button className="secondary-btn" type="button" onClick={resetMaterialForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {loading ? (
          <div className="empty-state">Loading saved raw materials…</div>
        ) : materials.length === 0 ? (
          <div className="empty-state">No saved raw materials yet. Add your first material above.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unit</th>
                  <th>Rate per Unit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {materials.map(material => (
                  <tr key={material.id}>
                    <td><strong>{material.material_name}</strong></td>
                    <td>{material.unit}</td>
                    <td>{money(material.rate)}</td>
                    <td>
                      <div className="cost-row-actions">
                        <button className="edit-btn" type="button" onClick={() => editMaterial(material)}>Edit</button>
                        <button className="edit-btn cost-delete-btn" type="button" onClick={() => deleteMaterial(material)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel cost-builder-panel">
        <div className="panel-heading">
          <div>
            <h2>Calculate Manufacturing Cost</h2>
            <p>Select materials and keep adding them to build one combined raw-material cost.</p>
          </div>
        </div>

        <div className="cost-add-row">
          <label>
            Select Raw Material
            <select
              value={selectedId}
              onChange={event => setSelectedId(event.target.value)}
            >
              <option value="">Choose saved material…</option>
              {materials.map(material => (
                <option key={material.id} value={material.id}>
                  {material.material_name} — {money(material.rate)} / {material.unit}
                </option>
              ))}
            </select>
          </label>

          <label>
            Quantity
            <input
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
            />
          </label>

          <button
            className="primary-btn"
            type="button"
            onClick={addLine}
            disabled={materials.length === 0}
          >
            ＋ Add Material
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="empty-state">
            Select a saved raw material, enter its quantity and press “Add Material”.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Raw Material</th>
                  <th>Quantity</th>
                  <th>Rate / Unit</th>
                  <th>Line Cost</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.rowId}>
                    <td>
                      <strong>{line.material_name}</strong>
                      <div className="cost-unit-note">{line.unit}</div>
                    </td>
                    <td>
                      <input
                        className="cost-quantity-input"
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={event => updateLine(line.rowId, event.target.value)}
                      />
                    </td>
                    <td>{money(line.rate)} / {line.unit}</td>
                    <td className="cost-line-total">
                      {money(Number(line.quantity) * line.rate)}
                    </td>
                    <td>
                      <button
                        className="edit-btn cost-delete-btn"
                        type="button"
                        onClick={() => removeLine(line.rowId)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="cost-total-panel">
          <div>
            <span>COMBINED RAW-MATERIAL COST</span>
            <strong>{money(total)}</strong>
            <small>{lines.length} material {lines.length === 1 ? 'line' : 'lines'} included</small>
          </div>
          <button
            className="secondary-btn"
            type="button"
            onClick={() => setLines([])}
            disabled={lines.length === 0}
          >
            Clear Calculator
          </button>
        </div>

        <p className="cost-footnote">
          This is a calculation only. It does not deduct inventory, create purchases or save production transactions.
        </p>
      </section>
    </div>
  )
}
