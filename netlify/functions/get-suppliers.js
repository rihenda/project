const PENNYLANE_TOKEN = process.env.PENNYLANE_TOKEN
const BASE_URL = 'https://app.pennylane.com/api/external/v1'

async function fetchPage(year, page) {
  const filter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: `${year}-01-01` },
    { field: 'date', operator: 'lteq', value: `${year}-12-31` },
  ])
  const params = new URLSearchParams({ filter, per_page: 100, page })
  const res = await fetch(`${BASE_URL}/supplier_invoices?${params}`, {
    headers: { Authorization: `Bearer ${PENNYLANE_TOKEN}` },
  })
  return res.json()
}

export default async (req) => {
  const url = new URL(req.url)
  const year = url.searchParams.get('year') || new Date().getFullYear()

  if (!PENNYLANE_TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing PENNYLANE_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // First page to get total
    const first = await fetchPage(year, 1)
    const totalPages = first.total_pages || 1
    const allInvoices = [...(first.invoices || [])]

    // Fetch remaining pages in parallel (batches of 10)
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    const BATCH_SIZE = 10
    for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
      const batch = remainingPages.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(batch.map((p) => fetchPage(year, p)))
      results.forEach((r) => allInvoices.push(...(r.invoices || [])))
    }

    // Deduplicate suppliers + aggregate stats
    const suppliersMap = new Map()
    for (const invoice of allInvoices) {
      const s = invoice.supplier
      if (!s) continue
      const key = s.source_id
      if (!suppliersMap.has(key)) {
        suppliersMap.set(key, {
          source_id: s.source_id,
          name: s.name,
          vat_number: s.vat_number || '',
          city: s.billing_address?.city || '',
          country: s.billing_address?.country_alpha2 || '',
          payment_conditions: s.payment_conditions || '',
          invoice_count: 0,
          total_amount: 0,
        })
      }
      const entry = suppliersMap.get(key)
      entry.invoice_count += 1
      entry.total_amount += parseFloat(invoice.currency_amount_before_tax || 0)
    }

    const suppliers = Array.from(suppliersMap.values()).sort((a, b) =>
      b.total_amount - a.total_amount
    )

    return new Response(
      JSON.stringify({ suppliers, total: suppliers.length, year }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/get-suppliers' }
