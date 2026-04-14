const PENNYLANE_TOKEN = Deno.env.get('PENNYLANE_TOKEN')
const BASE_URL = 'https://app.pennylane.com/api/external/v1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url = new URL(req.url)
  const year = url.searchParams.get('year') || String(new Date().getFullYear())
  const page = url.searchParams.get('page') || '1'
  const per_page = '50'

  if (!PENNYLANE_TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing PENNYLANE_TOKEN' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    const filter = JSON.stringify([
      { field: 'date', operator: 'gteq', value: `${year}-01-01` },
      { field: 'date', operator: 'lteq', value: `${year}-12-31` },
    ])
    const params = new URLSearchParams({ filter, per_page, page })
    const res = await fetch(`${BASE_URL}/supplier_invoices?${params}`, {
      headers: { Authorization: `Bearer ${PENNYLANE_TOKEN}` },
    })
    const data = await res.json()

    const invoices = (data.invoices || []).map((inv: any) => ({
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
    }))

    return new Response(
      JSON.stringify({
        invoices,
        total_invoices: data.total_invoices,
        total_pages: data.total_pages,
        current_page: data.current_page,
        year,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
