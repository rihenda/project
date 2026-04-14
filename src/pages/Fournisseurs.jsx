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
function CategoryCell({ supplier, categories, onAssign, onCreateAndAssign }) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = categories.find((c) => c.id === supplier.category_id)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          current
            ? 'text-white'
            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
        }`}
        style={current ? { backgroundColor: current.color } : {}}
      >
        {current ? current.name : '+ Catégorie'}
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-8 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 overflow-hidden">
          {categories.length > 0 && (
            <>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { onAssign(supplier, cat); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-[#0F172A]">{cat.name}</span>
                  {cat.id === supplier.category_id && (
                    <svg className="w-3.5 h-3.5 text-[#2563EB] ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="border-t border-slate-100 my-1" />
            </>
          )}

          {/* Remove */}
          {current && (
            <>
              <button
                onClick={() => { onAssign(supplier, null); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Retirer la catégorie
              </button>
              <div className="border-t border-slate-100 my-1" />
            </>
          )}

          {/* Create new */}
          <div className="px-3 py-2">
            <input
              type="text"
              placeholder="Nouvelle catégorie…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  onCreateAndAssign(supplier, newName.trim())
                  setNewName('')
                  setOpen(false)
                }
              }}
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#2563EB] placeholder-slate-400"
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">Appuie sur Entrée pour créer</p>
          </div>
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
      prev.map((s) => s.source_id === supplier.source_id ? { ...s, category_id } : s)
    )

    if (category_id) {
      await supabase.from('supplier_categories').upsert({
        supplier_source_id: supplier.source_id,
        supplier_name: supplier.name,
        category_id,
        updated_at: new Date().toISOString(),
      })
    } else {
      await supabase.from('supplier_categories').delete().eq('supplier_source_id', supplier.source_id)
    }
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
    <div className="p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">Fournisseurs</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Fournisseurs ayant au moins une facture sur l'année sélectionnée
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Year */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm font-medium text-[#0F172A] bg-transparent outline-none cursor-pointer"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-sm font-medium text-[#0F172A] bg-transparent outline-none cursor-pointer"
          >
            <option value="all">Toutes les catégories</option>
            <option value="none">Sans catégorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm flex-1 max-w-xs">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm text-[#0F172A] bg-transparent outline-none w-full placeholder-slate-400"
          />
        </div>

        {!loading && (
          <span className="text-sm text-[#64748B] ml-auto">
            <span className="font-semibold text-[#0F172A]">{filtered.length}</span> fournisseur{filtered.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#64748B]">Chargement des fournisseurs {year}…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          Erreur : {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Fournisseur</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Catégorie</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Ville</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">N° TVA</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Conditions</th>
                <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Factures</th>
                <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.source_id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}
                >
                  <td className="px-4 py-3 font-medium text-[#0F172A]">{s.name}</td>
                  <td className="px-4 py-3">
                    <CategoryCell
                      supplier={s}
                      categories={categories}
                      onAssign={handleAssign}
                      onCreateAndAssign={handleCreateAndAssign}
                    />
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{s.city || '—'}</td>
                  <td className="px-4 py-3 text-[#64748B] font-mono text-xs">{s.vat_number || '—'}</td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {PAYMENT_LABELS[s.payment_conditions] || s.payment_conditions || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-center bg-[#2563EB]/10 text-[#2563EB] font-semibold rounded-full px-2 py-0.5 text-xs min-w-[28px]">
                      {s.invoice_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#0F172A]">
                    {fmt(s.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && suppliers.length > 0 && (
        <div className="text-center py-16 text-[#64748B]">
          Aucun résultat pour cette recherche
        </div>
      )}

      {!loading && !error && suppliers.length === 0 && (
        <div className="text-center py-16 text-[#64748B]">
          Aucune facture fournisseur trouvée pour {year}
        </div>
      )}
    </div>
  )
}
