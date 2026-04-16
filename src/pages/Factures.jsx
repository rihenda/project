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
  to_be_paid:      { label: 'À payer',   dot: 'bg-amber-400',   text: 'text-amber-700' },
  to_be_processed: { label: 'À traiter', dot: 'bg-blue-400',    text: 'text-blue-700' },
  paid:            { label: 'Payée',     dot: 'bg-emerald-400', text: 'text-emerald-700' },
  cancelled:       { label: 'Annulée',   dot: 'bg-slate-300',   text: 'text-slate-500' },
  unpaid:          { label: 'Impayée',   dot: 'bg-red-400',     text: 'text-red-600' },
  paid_offline:    { label: 'Payée',     dot: 'bg-emerald-400', text: 'text-emerald-700' },
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

    fetch(`${SUPABASE_URL}/functions/v1/get-invoices?${params}`, {
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
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
        (inv.categories || []).some((c) => {
          const cat = categories.find((k) => k.pennylane_source_id === c.source_id)
          return cat?.id === filterCat
        })
      )

  // Computed stats for visible invoices
  const totalTTC = allInvoices.reduce((s, i) => s + i.amount_ttc, 0)
  const countToPay = allInvoices.filter(i => i.payment_status === 'to_be_paid' || i.payment_status === 'unpaid').length

  return (
    <div className="min-h-screen bg-[#F7F8FA]">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/80 px-8 h-16 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-slate-900">Factures fournisseurs</h1>
          <span className="text-slate-300 text-lg font-light select-none">·</span>
          <span className="text-[13px] text-slate-400 font-medium">{year}</span>
          {loading && <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin ml-1" />}
        </div>

        {/* KPI chips */}
        {data && !loading && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Factures</span>
              <span className="text-[13px] font-bold text-slate-800 tabular-nums">
                {month ? allInvoices.length : (data.total_invoices ?? 0)}
              </span>
            </div>
            {month && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total TTC</span>
                <span className="text-[13px] font-bold text-slate-800 tabular-nums">{fmt(totalTTC)}</span>
              </div>
            )}
            {countToPay > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">À payer</span>
                <span className="text-[13px] font-bold text-amber-700 tabular-nums">{countToPay}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-8 py-5">

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mb-5">

          {/* Year */}
          <select
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12.5px] font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-300 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Month pills */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <button
              onClick={() => handleMonthChange(null)}
              className={`px-2.5 h-7 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap ${
                !month ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >Tous</button>
            {MONTHS_SHORT.map((mo, i) => (
              <button
                key={i}
                onClick={() => handleMonthChange(month === i + 1 ? null : i + 1)}
                className={`px-2 h-7 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap ${
                  month === i + 1 ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >{mo}</button>
            ))}
          </div>

          {/* Category */}
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12.5px] font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-300 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] max-w-[210px]"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {filterCat !== 'all' && (
            <span className="text-[11.5px] text-slate-500 bg-white border border-slate-200 px-2.5 h-8 flex items-center rounded-lg font-semibold">
              {invoices.length} / {allInvoices.length}
            </span>
          )}
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <div className="w-6 h-6 border-[2.5px] border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            <p className="text-[12px] text-slate-400 font-medium">Chargement…</p>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-[13px]">
            {error}
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        {!loading && !error && invoices.length > 0 && (
          <>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">Fournisseur</th>
                    <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">Catégorie</th>
                    <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">N° Facture</th>
                    <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">Période P&L</th>
                    <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">Statut</th>
                    <th className="text-right px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">HT</th>
                    <th className="text-right px-5 py-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">TTC</th>
                    <th className="w-12 px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const status = PAYMENT_STATUS[inv.payment_status] || { label: inv.payment_status || '—', dot: 'bg-slate-300', text: 'text-slate-500' }
                    return (
                      <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors group">
                        {/* Fournisseur */}
                        <td className="px-5 py-3.5">
                          <span className="text-[13px] font-semibold text-slate-900 block truncate max-w-[180px]" title={inv.supplier_name}>
                            {inv.supplier_name}
                          </span>
                        </td>
                        {/* Catégorie */}
                        <td className="px-5 py-3.5">
                          {inv.categories?.[0]
                            ? <span className="inline-block text-[11.5px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{inv.categories[0].label}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Date */}
                        <td className="px-5 py-3.5 text-[12.5px] text-slate-400 tabular-nums whitespace-nowrap">{fmtDate(inv.date)}</td>
                        {/* N° */}
                        <td className="px-5 py-3.5 font-mono text-[11.5px] text-slate-400 whitespace-nowrap">{inv.invoice_number || '—'}</td>
                        {/* Période */}
                        <td className="px-5 py-3.5">
                          <PeriodCell invoice={inv} savedPeriod={periods[inv.id] || null} onSave={handleSavePeriod} />
                        </td>
                        {/* Statut */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${status.text}`}>
                            <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>
                        {/* HT */}
                        <td className="px-5 py-3.5 text-right text-[12.5px] text-slate-400 tabular-nums">{fmt(inv.amount_ht)}</td>
                        {/* TTC */}
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold text-slate-800 tabular-nums">{fmt(inv.amount_ttc)}</td>
                        {/* Actions */}
                        <td className="px-5 py-3.5 text-center">
                          {inv.file_url && (
                            <button
                              onClick={() => setPdfUrl(inv.file_url)}
                              className="w-6 h-6 rounded-md bg-slate-100 hover:bg-[#2563EB] hover:text-white text-slate-400 transition-all inline-flex items-center justify-center opacity-0 group-hover:opacity-100"
                              title="Voir le PDF"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}
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

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!loading && !error && invoices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-slate-500">Aucune facture</p>
            <p className="text-[12px] text-slate-400 mt-0.5">{month ? `${MONTHS_FR[month - 1]} ${year}` : year}</p>
          </div>
        )}
      </div>

      {/* ── PDF modal ─────────────────────────────────────────────────────── */}
      {pdfUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPdfUrl(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ width: '90vw', height: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-[13px] font-semibold text-slate-700">Aperçu facture</span>
              <button
                onClick={() => setPdfUrl(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <iframe src={pdfUrl} className="flex-1 w-full" title="Facture PDF" />
          </div>
        </div>
      )}
    </div>
  )
}
