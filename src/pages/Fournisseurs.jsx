import { useState, useEffect } from 'react'

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

export default function Fournisseurs() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSuppliers([])

    fetch(`/api/get-suppliers?year=${year}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        setSuppliers(data.suppliers || [])
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [year])

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

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
        {/* Year selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm font-medium text-[#0F172A] bg-transparent outline-none cursor-pointer"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
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

        {/* Count badge */}
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
          Aucun fournisseur ne correspond à "{search}"
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
