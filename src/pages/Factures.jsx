import { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://oqqydrbinqdqqvqbfmrv.supabase.co'
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

const PAYMENT_STATUS = {
  to_be_paid:      { label: 'À payer',      color: 'bg-orange-100 text-orange-700' },
  to_be_processed: { label: 'À traiter',    color: 'bg-yellow-100 text-yellow-700' },
  paid:            { label: 'Payée',         color: 'bg-green-100 text-green-700' },
  cancelled:       { label: 'Annulée',       color: 'bg-slate-100 text-slate-500' },
  unpaid:          { label: 'Impayée',       color: 'bg-red-100 text-red-700' },
}

function fmt(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}
function fmtDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function StatusBadge({ status }) {
  const s = PAYMENT_STATUS[status] || { label: status || '—', color: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

function Pagination({ current, total, onChange }) {
  if (total <= 1) return null
  const pages = []
  const delta = 2
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) pages.push(i)

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="px-2 py-1 rounded text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30"
      >
        ←
      </button>
      {pages[0] > 1 && (
        <>
          <button onClick={() => onChange(1)} className="px-2.5 py-1 rounded text-sm text-slate-600 hover:bg-slate-100">1</button>
          {pages[0] > 2 && <span className="text-slate-400 text-sm px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded text-sm font-medium ${
            p === current ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < total && (
        <>
          {pages[pages.length - 1] < total - 1 && <span className="text-slate-400 text-sm px-1">…</span>}
          <button onClick={() => onChange(total)} className="px-2.5 py-1 rounded text-sm text-slate-600 hover:bg-slate-100">{total}</button>
        </>
      )}
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="px-2 py-1 rounded text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30"
      >
        →
      </button>
    </div>
  )
}

export default function Factures() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${SUPABASE_URL}/functions/v1/get-invoices?year=${year}&page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [year, page])

  function handleYearChange(y) {
    setYear(y)
    setPage(1)
  }

  const invoices = data?.invoices || []

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">Factures d'achats</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {data ? (
            <>
              <span className="font-semibold text-[#0F172A]">
                {data.total_invoices.toLocaleString('fr-FR')}
              </span> factures en {year}
            </>
          ) : 'Factures fournisseurs par année d\'émission'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select
            value={year}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="text-sm font-medium text-[#0F172A] bg-transparent outline-none cursor-pointer"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {data && (
          <span className="text-sm text-[#64748B] ml-auto">
            Page <span className="font-semibold text-[#0F172A]">{data.current_page}</span> / {data.total_pages}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#64748B]">Chargement des factures {year}…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          Erreur : {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && invoices.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">N° Facture</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Fournisseur</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Catégorie</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Statut</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">HT</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">TVA</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">TTC</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr
                    key={inv.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                  >
                    <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{fmtDate(inv.date)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#0F172A]">{inv.invoice_number || '—'}</td>
                    <td className="px-4 py-3 font-medium text-[#0F172A] max-w-[180px] truncate" title={inv.supplier_name}>
                      {inv.supplier_name}
                    </td>
                    <td className="px-4 py-3">
                      {inv.categories[0] ? (
                        <span className="text-xs text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full">
                          {inv.categories[0].label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.payment_status} />
                    </td>
                    <td className="px-4 py-3 text-right text-[#0F172A]">{fmt(inv.amount_ht)}</td>
                    <td className="px-4 py-3 text-right text-[#64748B]">{fmt(inv.amount_tax)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0F172A]">{fmt(inv.amount_ttc)}</td>
                    <td className="px-4 py-3 text-center">
                      {inv.file_url ? (
                        <a
                          href={inv.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-[#2563EB]/10 hover:text-[#2563EB] text-slate-400 transition-colors"
                          title="Voir le PDF"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            current={page}
            total={data.total_pages}
            onChange={(p) => { setPage(p); window.scrollTo(0, 0) }}
          />
        </>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="text-center py-16 text-[#64748B]">
          Aucune facture trouvée pour {year}
        </div>
      )}
    </div>
  )
}
