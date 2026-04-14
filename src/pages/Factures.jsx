import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { formatPeriod } from '../lib/extractPeriod'

const SUPABASE_URL = 'https://oqqydrbinqdqqvqbfmrv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcXlkcmJpbnFkcXF2cWJmbXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjExNzUsImV4cCI6MjA5MTczNzE3NX0.zLNggRnCtvHN7mPrI726ZEDnKLtv-y-YqCMdsVzWWGE'
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const PAYMENT_STATUS = {
  to_be_paid:      { label: 'À payer',   color: 'bg-orange-100 text-orange-700' },
  to_be_processed: { label: 'À traiter', color: 'bg-yellow-100 text-yellow-700' },
  paid:            { label: 'Payée',      color: 'bg-green-100 text-green-700' },
  cancelled:       { label: 'Annulée',    color: 'bg-slate-100 text-slate-500' },
  unpaid:          { label: 'Impayée',    color: 'bg-red-100 text-red-700' },
}

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}
function fmtDate(s) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// ── Period picker ────────────────────────────────────────────────────────────
function PeriodCell({ invoice, savedPeriod, onSave }) {
  const [open, setOpen] = useState(false)
  const [selYear, setSelYear] = useState(CURRENT_YEAR)
  const [selMonth, setSelMonth] = useState(null)
  const [saving, setSaving] = useState(false)
  const btnRef = useRef(null)
  const dropRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const h = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const displayed = savedPeriod
    ? { month: savedPeriod.billing_month, quarter: savedPeriod.billing_quarter, year: savedPeriod.billing_year }
    : null

  const label = formatPeriod(displayed)

  function openPicker() {
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
    setSelYear(displayed?.year || CURRENT_YEAR)
    setSelMonth(displayed?.month || null)
    setOpen(true)
  }

  async function handleSave() {
    if (!selMonth) return
    setSaving(true)
    await onSave(invoice.id, { billing_year: selYear, billing_month: selMonth, billing_quarter: null, source: 'manual' })
    setSaving(false)
    setOpen(false)
  }

  async function handleClear() {
    await onSave(invoice.id, null)
    setOpen(false)
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={openPicker}
        className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${
          label
            ? 'bg-[#2563EB]/10 text-[#2563EB]'
            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-dashed border-slate-300'
        }`}
      >
        {label ? (
          <>{label}</>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Période
          </>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3"
        >
          {/* Year selector */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setSelYear(y => y - 1)} className="p-1 rounded hover:bg-slate-100 text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-sm text-[#0F172A]">{selYear}</span>
            <button onClick={() => setSelYear(y => y + 1)} className="p-1 rounded hover:bg-slate-100 text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {MONTHS_SHORT.map((mo, i) => (
              <button
                key={i}
                onClick={() => setSelMonth(i + 1)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selMonth === i + 1
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {mo}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!selMonth || saving}
              className="flex-1 bg-[#2563EB] text-white text-xs font-medium py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Envoi…
                </>
              ) : 'Confirmer'}
            </button>
            {savedPeriod && (
              <button
                onClick={handleClear}
                className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg"
              >
                Effacer
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ current, total, onChange }) {
  if (total <= 1) return null
  const pages = []
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i)

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button onClick={() => onChange(current - 1)} disabled={current === 1}
        className="px-2 py-1 rounded text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30">←</button>
      {pages[0] > 1 && (
        <>
          <button onClick={() => onChange(1)} className="px-2.5 py-1 rounded text-sm text-slate-600 hover:bg-slate-100">1</button>
          {pages[0] > 2 && <span className="text-slate-400 text-sm px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded text-sm font-medium ${p === current ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < total && (
        <>
          {pages[pages.length - 1] < total - 1 && <span className="text-slate-400 text-sm px-1">…</span>}
          <button onClick={() => onChange(total)} className="px-2.5 py-1 rounded text-sm text-slate-600 hover:bg-slate-100">{total}</button>
        </>
      )}
      <button onClick={() => onChange(current + 1)} disabled={current === total}
        className="px-2 py-1 rounded text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30">→</button>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Factures() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(null)   // null = tous les mois
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [periods, setPeriods] = useState({})
  const [filterCat, setFilterCat] = useState('all')
  const [categories, setCategories] = useState([])
  const [pdfUrl, setPdfUrl] = useState(null)

  // Load categories from Supabase once
  useEffect(() => {
    supabase.from('categories').select('id,name,pennylane_source_id').order('name')
      .then(({ data }) => { if (data) setCategories(data) })
  }, [])

  // Load invoices
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ year, page })
    if (month) params.set('month', month)

    fetch(`${SUPABASE_URL}/functions/v1/get-invoices?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [year, month, page])

  // Load saved periods from Supabase when invoices change
  useEffect(() => {
    if (!data?.invoices?.length) return
    const ids = data.invoices.map((i) => `"${i.id}"`).join(',')
    supabase
      .from('invoice_periods')
      .select('*')
      .in('invoice_id', data.invoices.map((i) => i.id))
      .then(({ data: rows }) => {
        if (!rows) return
        const map = {}
        rows.forEach((r) => { map[r.invoice_id] = r })
        setPeriods(map)
      })
  }, [data])

  async function handleSavePeriod(invoiceId, periodData) {
    if (!periodData) {
      await supabase.from('invoice_periods').delete().eq('invoice_id', invoiceId)
      setPeriods((prev) => {
        const next = { ...prev }
        delete next[invoiceId]
        return next
      })
    } else {
      const row = { invoice_id: invoiceId, ...periodData, updated_at: new Date().toISOString() }
      await supabase.from('invoice_periods').upsert(row)
      setPeriods((prev) => ({ ...prev, [invoiceId]: row }))

      // Write the label into Pennylane's "Libellé de l'écriture"
      const inv = (data?.invoices || []).find((i) => i.id === invoiceId)
      if (inv?.invoice_number && periodData.billing_month && periodData.billing_year) {
        const pad = (n) => String(n).padStart(2, '0')
        const period_label = `${pad(periodData.billing_month)}.${periodData.billing_year}`
        await fetch(`${SUPABASE_URL}/functions/v1/update-invoice-label`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            invoice_id: invoiceId,
            invoice_number: inv.invoice_number,
            period_label,
          }),
        }).catch((e) => console.error('update-invoice-label error:', e))
      }
    }
  }

  function handleYearChange(y) { setYear(Number(y)); setMonth(null); setPage(1); setFilterCat('all') }
  function handleMonthChange(m) { setMonth(m); setPage(1) }

  // Client-side category filter (applied on top of server-side date filter)
  const allInvoices = data?.invoices || []
  const invoices = filterCat === 'all'
    ? allInvoices
    : allInvoices.filter((inv) =>
        inv.categories.some((c) => {
          const cat = categories.find((k) => k.pennylane_source_id === c.source_id)
          return cat?.id === filterCat
        })
      )

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">Factures d'achats</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {data ? (
            <><span className="font-semibold text-[#0F172A]">{data.total_invoices.toLocaleString('fr-FR')}</span> factures en {year}</>
          ) : 'Factures fournisseurs par année d\'émission'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">

        {/* Year */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select value={year} onChange={(e) => handleYearChange(e.target.value)}
            className="text-sm font-medium text-[#0F172A] bg-transparent outline-none cursor-pointer">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Month */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm">
          <button
            onClick={() => handleMonthChange(null)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              !month ? 'bg-[#2563EB] text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Tous
          </button>
          {MONTHS_SHORT.map((mo, i) => (
            <button
              key={i}
              onClick={() => handleMonthChange(month === i + 1 ? null : i + 1)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                month === i + 1 ? 'bg-[#2563EB] text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {mo}
            </button>
          ))}
        </div>

        {/* Category */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            className="text-sm font-medium text-[#0F172A] bg-transparent outline-none cursor-pointer max-w-[200px]">
            <option value="all">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Count */}
        {data && !loading && (
          <span className="text-sm text-[#64748B] ml-auto">
            {filterCat !== 'all' ? (
              <><span className="font-semibold text-[#0F172A]">{invoices.length}</span> / {allInvoices.length} factures</>
            ) : month ? (
              <><span className="font-semibold text-[#0F172A]">{allInvoices.length}</span> factures en {MONTHS_FR[month - 1]} {year}</>
            ) : (
              <>Page <span className="font-semibold text-[#0F172A]">{data.current_page}</span> / {data.total_pages}</>
            )}
          </span>
        )}
      </div>

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

      {!loading && !error && invoices.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Date émission</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Période P&L</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">N° Facture</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Fournisseur</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Catégorie</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">Statut</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">HT</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">TTC</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#64748B] uppercase text-xs tracking-wide">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const status = PAYMENT_STATUS[inv.payment_status] || { label: inv.payment_status || '—', color: 'bg-slate-100 text-slate-500' }
                  return (
                    <tr key={inv.id}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                      <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{fmtDate(inv.date)}</td>
                      <td className="px-4 py-3">
                        <PeriodCell
                          invoice={inv}
                          savedPeriod={periods[inv.id] || null}
                          onSave={handleSavePeriod}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#0F172A]">{inv.invoice_number || '—'}</td>
                      <td className="px-4 py-3 font-medium text-[#0F172A] max-w-[160px] truncate" title={inv.supplier_name}>
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#0F172A]">{fmt(inv.amount_ht)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#0F172A]">{fmt(inv.amount_ttc)}</td>
                      <td className="px-4 py-3 text-center">
                        {inv.file_url ? (
                          <button
                            onClick={() => setPdfUrl(inv.file_url)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-[#2563EB]/10 hover:text-[#2563EB] text-slate-400 transition-colors"
                            title="Voir le PDF">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!month && (
            <Pagination
              current={page}
              total={data.total_pages}
              onChange={(p) => { setPage(p); window.scrollTo(0, 0) }}
            />
          )}
        </>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="text-center py-16 text-[#64748B]">
          Aucune facture trouvée pour {year}
        </div>
      )}

      {/* PDF modal */}
      {pdfUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPdfUrl(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl flex flex-col"
            style={{ width: '90vw', height: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
              <span className="text-sm font-medium text-[#0F172A]">Facture</span>
              <button
                onClick={() => setPdfUrl(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <iframe
              src={pdfUrl}
              className="flex-1 w-full rounded-b-xl"
              title="Facture PDF"
            />
          </div>
        </div>
      )}
    </div>
  )
}
