/**
 * Tries to extract a billing period (month + year) from an invoice label.
 * Returns { year, month, quarter, label, confidence } or null.
 *
 * month: 1-12 or null (if only quarter known)
 * quarter: 1-4 or null
 * confidence: 'high' | 'low'
 */

const FR_MONTHS = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
}

function twoDigitYear(yy) {
  const n = parseInt(yy, 10)
  return n < 50 ? 2000 + n : 1900 + n
}

export function extractPeriod(text, invoiceDate) {
  if (!text) return null
  const t = text.trim()
  const invoiceYear = invoiceDate ? parseInt(invoiceDate.slice(0, 4), 10) : new Date().getFullYear()

  // ── 1. MM.YYYY  e.g. "11.2025", "01.2026"
  let m = t.match(/\b(0?[1-9]|1[0-2])\.(20\d{2})\b/)
  if (m) return { month: parseInt(m[1], 10), year: parseInt(m[2], 10), quarter: null, confidence: 'high' }

  // ── 2. MM/YYYY  e.g. "012/2025", "09/2025"
  m = t.match(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/)
  if (m) return { month: parseInt(m[1], 10), year: parseInt(m[2], 10), quarter: null, confidence: 'high' }

  // ── 3. YYYY-MM  e.g. "2025-12-001"
  m = t.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/)
  if (m) return { month: parseInt(m[2], 10), year: parseInt(m[1], 10), quarter: null, confidence: 'high' }

  // ── 4. DD/MM/YYYY - DD/MM/YYYY full range → use end date month
  //    e.g. "23/11/2025 - 22/11/2026"
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(20\d{2})/)
  if (m) {
    const endMonth = parseInt(m[5], 10)
    const endYear = parseInt(m[6], 10)
    return { month: endMonth, year: endYear, quarter: null, confidence: 'high' }
  }

  // ── 5. DD/MM - DD/MM short range (no year) → use invoice year, end month
  //    e.g. "21/11 - 20/12", "24/12 - 24/01"
  m = t.match(/(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\b/)
  if (m) {
    const startMonth = parseInt(m[2], 10)
    const endMonth = parseInt(m[4], 10)
    // If end month < start month → crosses new year, end year = invoiceYear + 1
    const endYear = endMonth < startMonth ? invoiceYear + 1 : invoiceYear
    return { month: endMonth, year: endYear, quarter: null, confidence: 'high' }
  }

  // ── 6. DD-MM-YY  e.g. "26-01-25"
  m = t.match(/\b(\d{2})-(\d{2})-(\d{2})\b/)
  if (m) {
    const mo = parseInt(m[2], 10)
    if (mo >= 1 && mo <= 12) {
      return { month: mo, year: twoDigitYear(m[3]), quarter: null, confidence: 'low' }
    }
  }

  // ── 7. French month names  e.g. "mars 2025", "Novembre 2025"
  const frRe = new RegExp(`\\b(${Object.keys(FR_MONTHS).join('|')})\\s+(20\\d{2})\\b`, 'i')
  m = t.match(frRe)
  if (m) {
    return {
      month: FR_MONTHS[m[1].toLowerCase()],
      year: parseInt(m[2], 10),
      quarter: null,
      confidence: 'high',
    }
  }

  // ── 8. Quarter  e.g. "4T25", "T4 2025", "Q4 25", "Q4 2025"
  m = t.match(/\b([1-4])T(\d{2,4})\b/i) || t.match(/\bT([1-4])\s*(20\d{2}|\d{2})\b/i) || t.match(/\bQ([1-4])\s*(20\d{2}|\d{2})\b/i)
  if (m) {
    const q = parseInt(m[1], 10)
    const yr = m[2].length === 2 ? twoDigitYear(m[2]) : parseInt(m[2], 10)
    return { month: null, quarter: q, year: yr, confidence: 'high' }
  }

  return null
}

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export function formatPeriod(period) {
  if (!period) return null
  if (period.month) return `${MONTHS_FR[period.month - 1]} ${period.year}`
  if (period.quarter) return `T${period.quarter} ${period.year}`
  return `${period.year}`
}
