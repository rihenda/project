import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = 'https://oqqydrbinqdqqvqbfmrv.supabase.co'
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

const PAYMENT_LABELS = {
  '30_days': '30 jours',
  '60_days': '60 jours',
  '45_days': '45 jours',
  'upon_receipt': 'À réception',
  'advance': 'Avance',
}

function fmt(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ── Category pill ────────────────────────────────────────────────────────────
function CategoryCell({ supplier, categories, onAssign, onCreateAndAssign, syncing }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) { setSearch(''); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  const current = categories.find((c) => c.id === supplier.category_id)
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const noMatch = search.trim() && filtered.length === 0

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !syncing && setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          current ? 'text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
        } ${syncing ? 'opacity-70 cursor-wait' : ''}`}
        style={current ? { backgroundColor: current.color } : {}}
      >
        {syncing ? (
          <>
            <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
            Sync…
          </>
        ) : (
          <>
            {current ? current.name : '+ Catégorie'}
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-8 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Search */}
          <div className="px-3 pt-2 pb-1 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher une catégorie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && noMatch) {
                  onCreateAndAssign(supplier, search.trim())
                  setOpen(false)
                }
              }}
              className="w-full text-sm outline-none placeholder-slate-400 py-1"
            />
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onAssign(supplier, cat); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-[#0F172A] flex-1">{cat.name}</span>
                {cat.pennylane_source_id && (
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">PL</span>
                )}
                {cat.id === supplier.category_id && (
                  <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}

            {noMatch && (
              <button
                onClick={() => { onCreateAndAssign(supplier, search.trim()); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-[#2563EB] hover:bg-blue-50 flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Créer "{search.trim()}"
              </button>
            )}
          </div>

          {/* Remove */}
          {current && (
            <div className="border-t border-slate-100 py-1">
              <button
                onClick={() => { onAssign(supplier, null); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Retirer la catégorie
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Fournisseurs() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [suppliers, setSuppliers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  // Load suppliers from Pennylane (via Edge Function)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSuppliers([])

    fetch(`${SUPABASE_URL}/functions/v1/get-suppliers?year=${year}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        setSuppliers(data.suppliers || [])
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [year])

  // Load categories + supplier mappings from Supabase
  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('supplier_categories').select('*'),
    ]).then(([catsRes, mappingsRes]) => {
      if (catsRes.data) setCategories(catsRes.data)
      if (mappingsRes.data) {
        const map = {}
        mappingsRes.data.forEach((m) => { map[m.supplier_source_id] = m.category_id })
        setSuppliers((prev) =>
          prev.map((s) => ({ ...s, category_id: map[s.source_id] || null }))
        )
      }
    })
  }, [suppliers.length]) // re-run when suppliers load

  async function handleAssign(supplier, category) {
    const category_id = category?.id || null

    // Optimistic update
    setSuppliers((prev) =>
      prev.map((s) => s.source_id === supplier.source_id ? { ...s, category_id, syncing: true } : s)
    )

    if (category_id && category.pennylane_source_id) {
      // Push to Pennylane + Supabase via Edge Function
      await fetch(`${SUPABASE_URL}/functions/v1/update-supplier-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_source_id: supplier.source_id,
          supplier_name: supplier.name,
          category_id,
          pennylane_category_source_id: category.pennylane_source_id,
        }),
      })
    } else if (category_id) {
      // Custom category (no Pennylane source) — Supabase only
      await supabase.from('supplier_categories').upsert({
        supplier_source_id: supplier.source_id,
        supplier_name: supplier.name,
        category_id,
        updated_at: new Date().toISOString(),
      })
    } else {
      await supabase.from('supplier_categories').delete().eq('supplier_source_id', supplier.source_id)
    }

    setSuppliers((prev) =>
      prev.map((s) => s.source_id === supplier.source_id ? { ...s, syncing: false } : s)
    )
  }

  async function handleCreateAndAssign(supplier, name) {
    // Pick a color from a palette
    const COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#BE185D']
    const color = COLORS[categories.length % COLORS.length]

    const { data: newCat, error } = await supabase
      .from('categories')
      .insert({ name, color })
      .select()
      .single()

    if (error || !newCat) return
    setCategories((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)))
    await handleAssign(supplier, newCat)
  }

  // Merge category_id into suppliers when categories load
  useEffect(() => {
    supabase.from('supplier_categories').select('*').then(({ data }) => {
      if (!data) return
      const map = {}
      data.forEach((m) => { map[m.supplier_source_id] = m.category_id })
      setSuppliers((prev) =>
        prev.map((s) => ({ ...s, category_id: map[s.source_id] ?? s.category_id ?? null }))
      )
    })
  }, [categories])

  const filtered = suppliers
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => filterCat === 'all' || s.category_id === filterCat || (filterCat === 'none' && !s.category_id))

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 font-medium">
              <span>HostnFly</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <span>Fournisseurs</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fournisseurs</h1>
          </div>
          {!loading && (
            <span className="text-xs text-slate-400">
              {filtered.length} fournisseur{filtered.length > 1 ? 's' : ''} · {year}
            </span>
          )}
        </div>
      </div>

      <div className="px-8 py-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Year */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-colors">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-[13px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-colors">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-[13px] font-semibold text-slate-700 bg-transparent outline-none cursor-pointer max-w-[220px]"
          >
            <option value="all">Toutes les catégories</option>
            <option value="none">Sans catégorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-colors flex-1 max-w-xs">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un fournisseur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-[13px] font-semibold text-slate-700 bg-transparent outline-none w-full placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <div className="w-7 h-7 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] text-slate-400">Chargement des fournisseurs {year}…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          Erreur : {error}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em]">Fournisseur</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em]">Catégorie</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em]">Ville</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em]">N° TVA</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em]">Conditions</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em]">Factures</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em]">Montant HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.source_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <span className="text-[13px] font-semibold text-slate-900">{s.name}</span>
                  </td>
                  <td className="px-5 py-4">
                    <CategoryCell
                      supplier={s}
                      categories={categories}
                      onAssign={handleAssign}
                      onCreateAndAssign={handleCreateAndAssign}
                      syncing={s.syncing}
                    />
                  </td>
                  <td className="px-5 py-4 text-[13px] text-slate-500">{s.city || '—'}</td>
                  <td className="px-5 py-4 font-mono text-[12px] text-slate-400">{s.vat_number || '—'}</td>
                  <td className="px-5 py-4 text-[13px] text-slate-500">
                    {PAYMENT_LABELS[s.payment_conditions] || s.payment_conditions || '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="inline-flex items-center justify-center bg-[#2563EB]/10 text-[#2563EB] font-semibold rounded-full px-2 py-0.5 text-[12px] min-w-[28px]">
                      {s.invoice_count}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-[13px] font-semibold text-slate-900">
                    {fmt(s.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && suppliers.length > 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-slate-500">Aucun résultat</p>
        </div>
      )}

      {!loading && !error && suppliers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-slate-500">Aucune facture fournisseur</p>
          <p className="text-[12px] text-slate-400 mt-0.5">{year}</p>
        </div>
      )}
      </div>
    </div>
  )
}
