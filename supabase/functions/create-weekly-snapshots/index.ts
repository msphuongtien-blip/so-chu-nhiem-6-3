import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * Server-side weekly snapshot.
 * record_history is an immutable copy of valid +/- records for audit/review.
 * The browser never edits snapshot rows.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TIME_ZONE = 'Asia/Ho_Chi_Minh'
const BASE_SCORE = 81
const VALID_SCORES = new Set([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5])

function localDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function monday(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return date.toISOString().slice(0, 10)
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function previousCompletedWeek(): string {
  return addDays(monday(localDate()), -7)
}

function rolloverStart(score: number): number {
  if (score >= 91) return 91
  if (score >= 81) return 81
  if (score >= 66) return 71
  if (score >= 50) return 61
  return 51
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Number(score) || BASE_SCORE))
}

function recordWeek(record: Record<string, unknown>): string {
  return monday(String(record.week ?? record.week_start ?? record.date ?? ''))
}

function historyWeeks(records: Record<string, unknown>[], studentId: string): string[] {
  return [...new Set(
    records.filter((r) => String(r.student_id) === String(studentId))
      .map(recordWeek).filter(Boolean),
  )].sort()
}

function validScore(record: Record<string, unknown>): number | null {
  const score = Number(record.score ?? record.points)
  return VALID_SCORES.has(score) ? score : null
}

function calculateWeekScore(records: Record<string, unknown>[], studentId: string, targetWeek: string) {
  const weeks = historyWeeks(records, studentId).filter((week) => week <= targetWeek)
  if (!weeks.length) {
    return { startScore: BASE_SCORE, totalPlus: 0, totalMinus: 0, totalChange: 0, finalScore: BASE_SCORE }
  }

  let startScore = BASE_SCORE
  let currentWeek = weeks[0]

  while (currentWeek <= targetWeek) {
    const validRows = records.filter((record) =>
      String(record.student_id) === String(studentId) &&
      recordWeek(record) === currentWeek && validScore(record) !== null,
    )
    const totalChange = validRows.reduce((sum, record) => sum + Number(validScore(record)), 0)
    const endScore = clamp(startScore + totalChange)

    if (currentWeek === targetWeek) {
      const totalPlus = validRows.filter((r) => Number(validScore(r)) > 0)
        .reduce((sum, r) => sum + Number(validScore(r)), 0)
      const totalMinus = validRows.filter((r) => Number(validScore(r)) < 0)
        .reduce((sum, r) => sum + Number(validScore(r)), 0)
      return { startScore, totalPlus, totalMinus, totalChange, finalScore: endScore }
    }

    startScore = rolloverStart(endScore)
    currentWeek = addDays(currentWeek, 7)
  }

  return { startScore: BASE_SCORE, totalPlus: 0, totalMinus: 0, totalChange: 0, finalScore: BASE_SCORE }
}

function groupForScore(score: number): string {
  if (score >= 91) return 'Kim cương'
  if (score >= 81) return 'Vàng'
  if (score >= 66) return 'Bạc'
  if (score >= 50) return 'Đồng'
  return 'Sắt'
}

function rankScores(scores: number[]): number[] {
  let previous: number | null = null
  let rank = 0
  return scores.map((score, index) => {
    if (index === 0 || score !== previous) {
      rank = index + 1
      previous = score
    }
    return rank
  })
}

async function supabaseFetch(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`)
  if (!text.trim()) return null
  return JSON.parse(text)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const targetWeek = previousCompletedWeek()
  const weekEnd = addDays(targetWeek, 6)

  try {
    const [students, records] = await Promise.all([
      supabaseFetch('students?select=id&order=id.asc'),
      supabaseFetch(`competition_records?select=id,student_id,score,points,week,week_start,date,category_id,criteria,note,created_at,updated_at&or=(week.lte.${targetWeek},week_start.lte.${targetWeek},date.lte.${weekEnd})`),
    ])

    const calculations = students.map((student: { id: string }) => ({
      studentId: student.id,
      ...calculateWeekScore(records, student.id, targetWeek),
    }))

    const ordered = [...calculations].sort((a, b) =>
      b.finalScore - a.finalScore || String(a.studentId).localeCompare(String(b.studentId)),
    )
    const ranks = rankScores(ordered.map((row) => row.finalScore))
    const rankByStudent = new Map(ordered.map((row, index) => [row.studentId, ranks[index]]))

    const snapshots = calculations.map((row) => {
      const recordHistory = records
        .filter((record: Record<string, unknown>) =>
          String(record.student_id) === String(row.studentId) &&
          recordWeek(record) === targetWeek &&
          validScore(record) !== null,
        )
        .map((record: Record<string, unknown>) => ({
          id: record.id,
          student_id: record.student_id,
          date: record.date,
          category_id: record.category_id,
          criteria: record.criteria,
          points: validScore(record),
          note: record.note,
          created_at: record.created_at,
          updated_at: record.updated_at,
        }))

      return {
        student_id: row.studentId,
        week: targetWeek,
        week_end: weekEnd,
        start_score: row.startScore,
        total_plus: row.totalPlus,
        total_minus: row.totalMinus,
        total_change: row.totalChange,
        final_score: row.finalScore,
        group_name: groupForScore(row.finalScore),
        rank: rankByStudent.get(row.studentId) ?? null,
        record_history: recordHistory,
      }
    })

    if (snapshots.length) {
      await supabaseFetch('competition_weekly_snapshots?on_conflict=student_id%2Cweek', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(snapshots),
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      week: targetWeek,
      week_end: weekEnd,
      students: snapshots.length,
      snapshots_upserted: snapshots.length,
      records_snapshotted: snapshots.reduce((sum, row) => sum + row.record_history.length, 0),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[create-weekly-snapshots]', error)
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
