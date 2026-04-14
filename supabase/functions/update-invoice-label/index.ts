const PENNYLANE_TOKEN = Deno.env.get('PENNYLANE_TOKEN')
const BASE_URL_V1 = 'https://app.pennylane.com/api/external/v1'
const BASE_URL_V2 = 'https://app.pennylane.com/api/external/v2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const hdrs = () => ({
  Authorization: `Bearer ${PENNYLANE_TOKEN}`,
  'Content-Type': 'application/json',
})

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
    // invoice_id: Pennylane v1 ID (e.g. "PXFMMYGCGL")
    // invoice_number: human-readable (e.g. "F-(2025)-(01)09202645")
    // period_label: P&L period string (e.g. "04.2026")

    if (!invoice_id || !invoice_number || !period_label) {
      return new Response(JSON.stringify({ error: 'Missing required fields: invoice_id, invoice_number, period_label' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const newLabel = `${invoice_number} / ${period_label}`

    // Step 1: Get the v2_id from the v1 invoice
    const v1Res = await fetch(`${BASE_URL_V1}/supplier_invoices/${invoice_id}`, { headers: hdrs() })
    if (!v1Res.ok) {
      const text = await v1Res.text()
      throw new Error(`Failed to fetch invoice: ${v1Res.status} ${text}`)
    }
    const v1Data = await v1Res.json()
    const v2Id = (v1Data.invoice || v1Data).v2_id
    if (!v2Id) throw new Error(`No v2_id found for invoice ${invoice_id}`)

    // Step 2: PUT on v2/supplier_invoices with just the label — preserves everything else
    const putRes = await fetch(`${BASE_URL_V2}/supplier_invoices/${v2Id}`, {
      method: 'PUT',
      headers: hdrs(),
      body: JSON.stringify({ label: newLabel }),
    })
    const putData = await putRes.json()
    if (!putRes.ok) throw new Error(`PUT failed: ${putRes.status} ${JSON.stringify(putData)}`)

    return new Response(
      JSON.stringify({ success: true, label: putData.label, v2_id: v2Id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
