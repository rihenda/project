const PENNYLANE_TOKEN = Deno.env.get('PENNYLANE_TOKEN')
const BASE_URL_V2 = 'https://app.pennylane.com/api/external/v2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const hdrs = () => ({
  Authorization: `Bearer ${PENNYLANE_TOKEN}`,
  'Content-Type': 'application/json',
})

// Find the ledger entry for a given invoice by scanning date-filtered results
// Returns the most recent entry (highest id) with matching piece_number
async function findLedgerEntry(invoiceId: string, invoiceDate: string) {
  const filter = JSON.stringify([{ field: 'date', operator: 'eq', value: invoiceDate }])
  let cursor: string | null = null
  let best: any = null
  let iterations = 0

  while (iterations < 20) {
    iterations++
    const params = new URLSearchParams({ filter, limit: '50' })
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`${BASE_URL_V2}/ledger_entries?${params}`, { headers: hdrs() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to fetch ledger entries: ${res.status} ${text}`)
    }
    const data = await res.json()
    const items: any[] = data.items || []

    for (const e of items) {
      if (e.piece_number === invoiceId) {
        if (!best || e.id > best.id) best = e
      }
    }

    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }

  return best
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  if (!PENNYLANE_TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing PENNYLANE_TOKEN' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    const body = await req.json()
    const { invoice_id, invoice_number, invoice_date, period_label } = body

    if (!invoice_id || !invoice_number || !invoice_date || !period_label) {
      return new Response(JSON.stringify({ error: 'Missing required fields: invoice_id, invoice_number, invoice_date, period_label' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const newLabel = `${invoice_number} / ${period_label}`

    // Step 1: Find the ledger entry by date + piece_number scan
    const entry = await findLedgerEntry(invoice_id, invoice_date)
    if (!entry) {
      return new Response(JSON.stringify({ error: `No ledger entry found for invoice ${invoice_id} on ${invoice_date}` }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const entryId = entry.id
    const journal_id = entry.journal?.id || entry.journal_id
    const date = entry.date

    // Step 2: Try PUT first (works for API-created entries, preserves lines automatically)
    const putRes = await fetch(`${BASE_URL_V2}/ledger_entries/${entryId}`, {
      method: 'PUT',
      headers: hdrs(),
      body: JSON.stringify({ label: newLabel, date, journal_id, piece_number: invoice_id }),
    })

    if (putRes.ok) {
      const putData = await putRes.json()
      return new Response(
        JSON.stringify({ success: true, method: 'PUT', label: newLabel, ledger_entry_id: putData.id }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const putError = await putRes.json().catch(() => ({}))

    // Step 3: Fallback → fetch full entry detail for lines, DELETE + POST
    const detailRes = await fetch(`${BASE_URL_V2}/ledger_entries/${entryId}`, { headers: hdrs() })
    if (!detailRes.ok) throw new Error(`Failed to fetch entry detail: ${detailRes.status}`)
    const detail = await detailRes.json()

    const lines = (detail.ledger_entry_lines || []).map((line: any) => ({
      debit: line.debit,
      credit: line.credit,
      label: line.label || '',
      ledger_account_id: line.ledger_account?.id || line.ledger_account_id,
    }))

    if (lines.length === 0) {
      throw new Error(`PUT failed (${putRes.status}: ${JSON.stringify(putError)}) and entry has no lines to re-POST`)
    }

    const delRes = await fetch(`${BASE_URL_V2}/ledger_entries/${entryId}`, {
      method: 'DELETE',
      headers: hdrs(),
    })
    if (!delRes.ok && delRes.status !== 204) {
      const text = await delRes.text()
      throw new Error(`PUT failed (${JSON.stringify(putError)}) and DELETE also failed: ${delRes.status} ${text}`)
    }

    const payload: any = {
      label: newLabel,
      date,
      journal_id,
      piece_number: invoice_id,
      ledger_entry_lines: lines,
    }
    if (detail.due_date) payload.due_date = detail.due_date

    const postRes = await fetch(`${BASE_URL_V2}/ledger_entries`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify(payload),
    })
    const postData = await postRes.json()
    if (!postRes.ok) throw new Error(`POST failed: ${postRes.status} ${JSON.stringify(postData)}`)

    return new Response(
      JSON.stringify({ success: true, method: 'DELETE+POST', label: newLabel, ledger_entry_id: postData.id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
