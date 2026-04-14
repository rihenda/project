const PENNYLANE_TOKEN = Deno.env.get('PENNYLANE_TOKEN')
const DB_URL = 'https://oqqydrbinqdqqvqbfmrv.supabase.co'
const DB_KEY = Deno.env.get('DB_SERVICE_ROLE_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

async function fetchInvoicePage(supplierSourceId: string, page: number) {
  const filter = JSON.stringify([
    { field: 'supplier_id', operator: 'eq', value: supplierSourceId },
  ])
  const params = new URLSearchParams({ filter, per_page: '100', page: String(page) })
  const res = await fetch(
    `https://app.pennylane.com/api/external/v1/supplier_invoices?${params}`,
    { headers: { Authorization: `Bearer ${PENNYLANE_TOKEN}` } }
  )
  return res.json()
}

async function updateInvoiceCategory(invoiceId: string, pennylaneSourceId: string) {
  const res = await fetch(
    `https://app.pennylane.com/api/external/v1/supplier_invoices/${invoiceId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${PENNYLANE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice: {
          categories: [{ source_id: pennylaneSourceId, weight: 1 }],
        },
      }),
    }
  )
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const { supplier_source_id, supplier_name, category_id, pennylane_category_source_id } =
    await req.json()

  if (!supplier_source_id || !category_id || !pennylane_category_source_id) {
    return new Response(
      JSON.stringify({ error: 'Missing supplier_source_id, category_id or pennylane_category_source_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  try {
    // 1. Fetch all invoices for this supplier (all pages, all years)
    const first = await fetchInvoicePage(supplier_source_id, 1)
    const totalPages = first.total_pages || 1
    const allInvoices = [...(first.invoices || [])]

    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    for (let i = 0; i < remaining.length; i += 10) {
      const batch = remaining.slice(i, i + 10)
      const results = await Promise.all(batch.map((p) => fetchInvoicePage(supplier_source_id, p)))
      results.forEach((r) => allInvoices.push(...(r.invoices || [])))
    }

    // 2. Update all invoices in Pennylane (batches of 10)
    let updated = 0
    let failed = 0
    for (let i = 0; i < allInvoices.length; i += 10) {
      const batch = allInvoices.slice(i, i + 10)
      const results = await Promise.all(
        batch.map((inv: any) => updateInvoiceCategory(inv.id, pennylane_category_source_id))
      )
      results.forEach((ok) => ok ? updated++ : failed++)
    }

    // 3. Update supplier_categories in Supabase
    await fetch(`${DB_URL}/rest/v1/supplier_categories`, {
      method: 'POST',
      headers: {
        apikey: DB_KEY!,
        Authorization: `Bearer ${DB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        supplier_source_id,
        supplier_name,
        category_id,
        updated_at: new Date().toISOString(),
      }),
    })

    return new Response(
      JSON.stringify({
        success: true,
        invoices_updated: updated,
        invoices_failed: failed,
        total_invoices: allInvoices.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
