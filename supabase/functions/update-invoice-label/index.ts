const PENNYLANE_TOKEN = Deno.env.get('PENNYLANE_TOKEN')
const BASE_URL_V1 = 'https://app.pennylane.com/api/external/v1'
const BASE_URL_V2 = 'https://app.pennylane.com/api/external/v2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const headers = () => ({
  Authorization: `Bearer ${PENNYLANE_TOKEN}`,
  'Content-Type': 'application/json',
})

// Find the ledger entry for a given invoice (piece_number = invoice v1 id)
async function findLedgerEntry(invoiceId: string) {
  const filter = JSON.stringify([{ field: 'piece_number', operator: 'eq', value: invoiceId }])
  const params = new URLSearchParams({ filter })
  const res = await fetch(`${BASE_URL_V2}/ledger_entries?${params}`, { headers: headers() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to fetch ledger entries: ${res.status} ${text}`)
  }
  const data = await res.json()
  const entries = data.ledger_entries || data.entries || data
  if (!Array.isArray(entries) || entries.length === 0) return null
  // Return the most recent one (highest id)
  return entries.sort((a: any, b: any) => b.id - a.id)[0]
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
    const { invoice_id, invoice_number, period_label } = body
    // invoice_id: Pennylane v1 invoice ID (e.g. "PXFMMYGCGL")
    // invoice_number: human-readable invoice number (e.g. "F-(2025)-(01)09202645")
    // period_label: P&L period string (e.g. "04.2026" or "T1 2025")

    if (!invoice_id || !invoice_number || !period_label) {
      return new Response(JSON.stringify({ error: 'Missing required fields: invoice_id, invoice_number, period_label' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const newLabel = `${invoice_number} / ${period_label}`

    // Step 1: Find the ledger entry
    const entry = await findLedgerEntry(invoice_id)
    if (!entry) {
      return new Response(JSON.stringify({ error: `No ledger entry found for invoice ${invoice_id}` }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const entryId = entry.id
    const date = entry.date
    const due_date = entry.due_date
    const journal_id = entry.journal?.id || entry.journal_id
    const lines = (entry.ledger_entry_lines || []).map((line: any) => ({
      debit: line.debit,
      credit: line.credit,
      label: line.label || '',
      ledger_account_id: line.ledger_account?.id || line.ledger_account_id,
    }))

    if (!journal_id || lines.length === 0) {
      return new Response(JSON.stringify({ error: 'Ledger entry missing journal_id or lines', entry }), {
        status: 422, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Step 2: DELETE the existing entry
    const delRes = await fetch(`${BASE_URL_V2}/ledger_entries/${entryId}`, {
      method: 'DELETE',
      headers: headers(),
    })
    if (!delRes.ok && delRes.status !== 204) {
      const text = await delRes.text()
      throw new Error(`DELETE failed: ${delRes.status} ${text}`)
    }

    // Step 3: POST new entry with updated label, same piece_number
    const payload = {
      label: newLabel,
      date,
      due_date,
      journal_id,
      piece_number: invoice_id,
      ledger_entry_lines: lines,
    }

    const postRes = await fetch(`${BASE_URL_V2}/ledger_entries`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    })
    const postData = await postRes.json()
    if (!postRes.ok) {
      throw new Error(`POST failed: ${postRes.status} ${JSON.stringify(postData)}`)
    }

    return new Response(
      JSON.stringify({ success: true, label: newLabel, ledger_entry_id: postData.id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
