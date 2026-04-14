import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const SUPABASE_URL = 'https://oqqydrbinqdqqvqbfmrv.supabase.co'
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[#0F172A] mb-1">{label}</p>
      <p className="text-[#2563EB]">{fmt(payload[0].value)}</p>
      {payload[0].payload.count && (
        <p className="text-[#64748B]">{payload[0].payload.count} facture{payload[0].payload.count > 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [invoices, setInvoices] = useState([])
  const [periods, setPeriods] = useState({})
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('categories')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setInvoices([])
    setPeriods({})

    async function load() {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-invoices?year=${year}&all=true`)
      const data = await res.json()
      if (cancelled) return

      const list = data.invoices || []
      setInvoices(list)

      if (list.length > 0) {
        const { data: rows } = await supabase
          .from('invoice_periods')
          .select('*')
          .in('invoice_id', list.map((i) => i.id))
        if (!cancelled && rows) {
          const map = {}
          rows.forEach((r) => { map[r.invoice_id] = r })
          setPeriods(map)
        }
      }

      if (!cancelled) setLoading(false)
    }

    load().catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [year])

  // ── Aggregations ──────────────────────────────────────────────────────────
  const categoryData = (() => {
    const map = {}
    invoices.forEach((inv) => {
      const key = inv.categories[0]?.label || 'Non catégorisé'
      if (!map[key]) map[key] = { name: key, total: 0, count: 0 }
      map[key].total += inv.amount_ttc
      map[key].count++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  const periodData = (() => {
    const map = {}
    invoices.forEach((inv) => {
      const p = periods[inv.id]
      if (!p?.billing_month) return
      const key = `${p.billing_year}-${String(p.billing_month).padStart(2, '0')}`
      const label = `${MONTHS_SHORT[p.billing_month - 1]} ${p.billing_year}`
      if (!map[key]) map[key] = { key, label, total: 0, count: 0 }
      map[key].total += inv.amount_ttc
      map[key].count++
    })
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
  })()

  const totalTTC = invoices.reduce((s, i) => s + i.amount_ttc, 0)
  const totalHT = invoices.reduce((s, i) => s + i.amount_ht, 0)
  const withPeriod = Object.keys(periods).length
  const pct = invoices.length ? Math.round((withPeriod / invoices.length) * 100) : 0
  const maxCat = categoryData[0]?.total || 1

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Dashboard</h1>
          <p className="text-sm text-[#64748B] mt-1">Vue agrégée des dépenses fournisseurs</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm font-medium text-[#0F172A] bg-transparent outline-none cursor-pointer">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#64748B]">Chargement des données {year}…</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total TTC', value: fmt(totalTTC) },
              { label: 'Total HT', value: fmt(totalHT) },
              { label: 'Factures', value: invoices.length.toLocaleString('fr-FR') },
              { label: 'Avec période P&L', value: `${withPeriod} / ${invoices.length}`, sub: `${pct}%` },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs text-[#64748B] font-medium uppercase tracking-wide mb-1">{card.label}</p>
                <p className="text-xl font-bold text-[#0F172A]">{card.value}</p>
                {card.sub && <p className="text-xs text-[#64748B] mt-0.5">{card.sub} assignées</p>}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
            {[['categories', 'Par catégorie'], ['periods', 'Par période P&L']].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white shadow-sm text-[#0F172A]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Par catégorie ──────────────────────────────────────────────── */}
          {activeTab === 'categories' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-[#0F172A] mb-5">
                Dépenses TTC par catégorie — {year}
              </h2>
              {categoryData.length === 0 ? (
                <p className="text-sm text-[#64748B]">Aucune donnée</p>
              ) : (
                <>
                  {/* Bar chart */}
                  <ResponsiveContainer width="100%" height={Math.max(300, categoryData.length * 28)}>
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ top: 0, right: 80, bottom: 0, left: 160 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={155}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {categoryData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={`rgba(37,99,235,${Math.max(0.25, 1 - i * 0.045)})`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Detail table */}
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-[1fr_120px_80px_80px] gap-2 text-xs text-[#64748B] font-medium uppercase tracking-wide px-1 mb-2">
                      <span>Catégorie</span>
                      <span className="text-right">Total TTC</span>
                      <span className="text-right">Factures</span>
                      <span className="text-right">% total</span>
                    </div>
                    {categoryData.map((cat) => (
                      <div key={cat.name}
                        className="grid grid-cols-[1fr_120px_80px_80px] gap-2 text-xs px-1 py-1.5 rounded hover:bg-slate-50 transition-colors">
                        <span className="text-[#0F172A] truncate" title={cat.name}>{cat.name}</span>
                        <span className="text-right font-semibold text-[#0F172A]">{fmt(cat.total)}</span>
                        <span className="text-right text-[#64748B]">{cat.count}</span>
                        <span className="text-right text-[#64748B]">{((cat.total / totalTTC) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Par période P&L ────────────────────────────────────────────── */}
          {activeTab === 'periods' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-[#0F172A] mb-1">
                Dépenses TTC par période P&L
              </h2>
              <p className="text-xs text-[#64748B] mb-5">
                Uniquement les factures avec une période saisie manuellement
              </p>
              {periodData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="w-10 h-10 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-medium text-[#64748B]">Aucune période P&L définie</p>
                  <p className="text-xs text-slate-400 mt-1">Assignez des périodes dans l'onglet Factures</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={periodData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="total" fill="#1B2659" radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Detail table */}
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-[100px_1fr_120px_80px] gap-2 text-xs text-[#64748B] font-medium uppercase tracking-wide px-1 mb-2">
                      <span>Période</span>
                      <span />
                      <span className="text-right">Total TTC</span>
                      <span className="text-right">Factures</span>
                    </div>
                    {periodData.map((p) => {
                      const maxTotal = Math.max(...periodData.map((x) => x.total))
                      return (
                        <div key={p.key}
                          className="grid grid-cols-[100px_1fr_120px_80px] gap-2 items-center text-xs px-1 py-1.5 rounded hover:bg-slate-50 transition-colors">
                          <span className="font-medium text-[#0F172A]">{p.label}</span>
                          <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full rounded-full bg-[#1B2659]"
                              style={{ width: `${(p.total / maxTotal) * 100}%` }} />
                          </div>
                          <span className="text-right font-semibold text-[#0F172A]">{fmt(p.total)}</span>
                          <span className="text-right text-[#64748B]">{p.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
