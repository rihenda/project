const PENNYLANE_TOKEN = Deno.env.get('PENNYLANE_TOKEN')
const BASE_URL = 'https://app.pennylane.com/api/external/v1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

async function fetchPage(dateFrom: string, dateTo: string, page: number, per_page: number) {
  const filter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: dateFrom },
    { field: 'date', operator: 'lteq', value: dateTo },
  ])
  const params = new URLSearchParams({ filter, per_page: String(per_page), page: String(page) })
  const res = await fetch(`${BASE_URL}/supplier_invoices?${params}`, {
    headers: { Authorization: `Bearer ${PENNYLANE_TOKEN}` },
  })
  return res.json()
}

function mapInvoice(inv: any) {
  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    date: inv.date,
    deadline: inv.deadline,
    supplier_name: inv.supplier?.name || '—',
    supplier_source_id: inv.supplier?.source_id || null,
    amount_ht: parseFloat(inv.currency_amount_before_tax || '0'),
    amount_ttc: parseFloat(inv.currency_amount || '0'),
    amount_tax: parseFloat(inv.currency_tax || '0'),
    currency: inv.currency || 'EUR',
    paid: inv.paid,
    payment_status: inv.payment_status,
    status: inv.status,
    label: inv.label || '',
    filename: inv.filename,
    file_url: inv.file_url,
    categories: (inv.categories || []).map((c: any) => ({
      label: c.label,
      source_id: c.source_id,
    })),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url = new URL(req.url)
  const year = url.searchParams.get('year') || String(new Date().getFullYear())
  const month = url.searchParams.get('month') // "1"-"12" or null
  const page = parseInt(url.searchParams.get('page') || '1', 10)

  if (!PENNYLANE_TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing PENNYLANE_TOKEN' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    const y = parseInt(year, 10)
    let dateFrom: string
    let dateTo: string
    let per_page: number

    if (month) {
      // Month selected → load all invoices for the month in one shot (max ~300)
      const m = parseInt(month, 10)
      dateFrom = `${y}-${pad(m)}-01`
      dateTo = `${y}-${pad(m)}-${daysInMonth(y, m)}`
      per_page = 300
    } else {
      // Year only → paginate 50/page
      dateFrom = `${y}-01-01`
      dateTo = `${y}-12-31`
      per_page = 50
    }

    const first = await fetchPage(dateFrom, dateTo, 1, per_page)
    let allInvoices = (first.invoices || []).map(mapInvoice)

    // If month selected and there are more pages, fetch them all
    if (month && first.total_pages > 1) {
      const remaining = Array.from({ length: first.total_pages - 1 }, (_, i) => i + 2)
      for (let i = 0; i < remaining.length; i += 5) {
        const batch = remaining.slice(i, i + 5)
        const results = await Promise.all(batch.map((p) => fetchPage(dateFrom, dateTo, p, per_page)))
        results.forEach((r) => allInvoices.push(...(r.invoices || []).map(mapInvoice)))
      }
    }

    return new Response(
      JSON.stringify({
        invoices: month ? allInvoices : allInvoices,
        total_invoices: first.total_invoices,
        total_pages: month ? 1 : first.total_pages,
        current_page: month ? 1 : first.current_page,
        year,
        month: month || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
