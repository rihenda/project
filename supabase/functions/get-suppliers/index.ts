const PENNYLANE_TOKEN = Deno.env.get('PENNYLANE_TOKEN')
const DB_URL = 'https://oqqydrbinqdqqvqbfmrv.supabase.co'
const DB_KEY = Deno.env.get('DB_SERVICE_ROLE_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

async function fetchInvoicePage(year: number, page: number) {
  const filter = JSON.stringify([
    { field: 'date', operator: 'gteq', value: `${year}-01-01` },
    { field: 'date', operator: 'lteq', value: `${year}-12-31` },
  ])
  const params = new URLSearchParams({ filter, per_page: '100', page: String(page) })
  const res = await fetch(`https://app.pennylane.com/api/external/v1/supplier_invoices?${params}`, {
    headers: { Authorization: `Bearer ${PENNYLANE_TOKEN}` },
  })
  return res.json()
}

async function dbGet(path: string) {
  const res = await fetch(`${DB_URL}/rest/v1/${path}`, {
    headers: { apikey: DB_KEY!, Authorization: `Bearer ${DB_KEY}` },
  })
  return res.json()
}

async function dbUpsert(table: string, rows: any[], onConflict: string) {
  await fetch(`${DB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: DB_KEY!,
      Authorization: `Bearer ${DB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: `resolution=merge-duplicates,return=minimal`,
    },
    body: JSON.stringify(rows),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url = new URL(req.url)
  const year = Number(url.searchParams.get('year') || new Date().getFullYear())

  if (!PENNYLANE_TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing PENNYLANE_TOKEN' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    // 1. Fetch all invoice pages in parallel batches
    const first = await fetchInvoicePage(year, 1)
    const totalPages = first.total_pages || 1
    const allInvoices = [...(first.invoices || [])]

    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    for (let i = 0; i < remaining.length; i += 10) {
      const batch = remaining.slice(i, i + 10)
      const results = await Promise.all(batch.map((p) => fetchInvoicePage(year, p)))
      results.forEach((r) => allInvoices.push(...(r.invoices || [])))
    }

    // 2. Load existing categories from Supabase (keyed by pennylane_source_id)
    const dbCats: any[] = await dbGet('categories?select=id,name,color,pennylane_source_id')
    const catByPLId: Record<string, any> = {}
    dbCats.forEach((c) => { if (c.pennylane_source_id) catByPLId[c.pennylane_source_id] = c })

    // 3. Build suppliers map + track dominant Pennylane category per supplier
    const suppliersMap = new Map<string, any>()
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
          // Track category votes: { pennylane_source_id: count }
          _cat_votes: {} as Record<string, number>,
        })
      }
      const entry = suppliersMap.get(key)!
      entry.invoice_count += 1
      entry.total_amount += parseFloat(invoice.currency_amount_before_tax || '0')

      // Vote for each category on this invoice
      for (const cat of (invoice.categories || [])) {
        if (!cat.source_id) continue
        entry._cat_votes[cat.source_id] = (entry._cat_votes[cat.source_id] || 0) + 1
      }
    }

    // 4. Determine dominant category per supplier & sync to Supabase
    const categoryMappings: any[] = []
    for (const [, s] of suppliersMap) {
      const votes = s._cat_votes as Record<string, number>
      const topPLCatId = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (topPLCatId && catByPLId[topPLCatId]) {
        categoryMappings.push({
          supplier_source_id: s.source_id,
          supplier_name: s.name,
          category_id: catByPLId[topPLCatId].id,
          updated_at: new Date().toISOString(),
        })
      }
      delete s._cat_votes
    }

    // Upsert all mappings (Pennylane is the source of truth)
    if (categoryMappings.length > 0) {
      await dbUpsert('supplier_categories', categoryMappings, 'supplier_source_id')
    }

    // 5. Reload mappings to return fresh data
    const mappings: any[] = await dbGet('supplier_categories?select=supplier_source_id,category_id')
    const catMap: Record<string, string> = {}
    mappings.forEach((m) => { catMap[m.supplier_source_id] = m.category_id })

    const suppliers = Array.from(suppliersMap.values())
      .map((s) => ({ ...s, category_id: catMap[s.source_id] || null }))
      .sort((a, b) => b.total_amount - a.total_amount)

    return new Response(JSON.stringify({ suppliers, total: suppliers.length, year }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
