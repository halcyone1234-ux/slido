// 複習題庫 ⇄ 純文字 的轉換（主持人在黑板上用 textarea 改題用）。
//
// 文字格式（與期中考複習卷的排版一致，方便直接從 Word 貼過來）：
//
//   # 量化研究法（上）期中考複習          ← 標題（可省略）
//   [W01｜內生性四張臉]                   ← 章節，之後的題目都沿用，直到下一個 [ ]
//   1. 題目文字（可多行）
//   (A) 選項 A
//   (B) 選項 B
//   (C) 選項 C
//   (D) 選項 D
//   答：C
//   解：解析（可省略，可多行）
//
//   2. 下一題…

export const CHOICES = ['A', 'B', 'C', 'D']

const RE_SECTION = /^\[(.+)\]\s*$/
const RE_TITLE = /^#\s*(.+)$/
const RE_QUESTION = /^(\d{1,3})\s*[.、)．]\s*(.*)$/
const RE_OPTION = /^[（(]?([A-Da-d])[)）.．、:：]\s*(.*)$/
const RE_ANSWER = /^(答|答案|正解|Ans|ans)\s*[:：]\s*[（(]?([A-Da-d])/
const RE_EXPLAIN = /^(解|解析|說明)\s*[:：]\s*(.*)$/

export function parseBankText(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  let title = ''
  let section = ''
  const questions = []
  let cur = null
  let field = null // 'text' | 'A'..'D' | 'explain'

  const flush = () => {
    if (cur) questions.push(cur)
    cur = null
    field = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    let m
    if ((m = line.match(RE_TITLE)) && !cur) {
      title = m[1].trim()
      continue
    }
    if ((m = line.match(RE_SECTION))) {
      flush()
      section = m[1].trim()
      continue
    }
    if ((m = line.match(RE_QUESTION))) {
      flush()
      cur = { section, text: m[2].trim(), options: { A: '', B: '', C: '', D: '' }, answer: '', explain: '' }
      field = 'text'
      continue
    }
    if (!cur) continue
    if ((m = line.match(RE_ANSWER))) {
      cur.answer = m[2].toUpperCase()
      field = null
      continue
    }
    if ((m = line.match(RE_EXPLAIN))) {
      cur.explain = m[2].trim()
      field = 'explain'
      continue
    }
    if ((m = line.match(RE_OPTION))) {
      const letter = m[1].toUpperCase()
      cur.options[letter] = m[2].trim()
      field = letter
      continue
    }
    // 其餘行：接到目前欄位後面（題目／選項／解析可多行）
    if (field === 'text') cur.text = `${cur.text} ${line}`.trim()
    else if (field === 'explain') cur.explain = `${cur.explain} ${line}`.trim()
    else if (field && CHOICES.includes(field)) cur.options[field] = `${cur.options[field]} ${line}`.trim()
  }
  flush()

  const errors = []
  questions.forEach((q, i) => {
    if (!q.text) errors.push(`第 ${i + 1} 題沒有題目文字`)
    const missing = CHOICES.filter((c) => !q.options[c])
    if (missing.length) errors.push(`第 ${i + 1} 題缺少選項 ${missing.join('、')}`)
    if (!CHOICES.includes(q.answer)) errors.push(`第 ${i + 1} 題沒有「答：」或答案不是 A–D`)
  })
  if (questions.length === 0) errors.push('沒有解析到任何題目（每題以「1.」「2.」開頭）')

  return { title, questions, errors }
}

export function formatBankText(title, questions) {
  const out = []
  if (title) out.push(`# ${title}`, '')
  let lastSection = null
  questions.forEach((q, i) => {
    if (q.section !== lastSection) {
      out.push(`[${q.section || '未分章節'}]`)
      lastSection = q.section
    }
    out.push(`${i + 1}. ${q.text}`)
    for (const c of CHOICES) out.push(`(${c}) ${q.options[c] || ''}`)
    out.push(`答：${q.answer}`)
    if (q.explain) out.push(`解：${q.explain}`)
    out.push('')
  })
  return out.join('\n')
}

// 分數：答對題數換算成百分制（25 題＝每題 4 分，與期中考一致）
export function toScore(correct, total) {
  if (!total) return 0
  return Math.round((correct / total) * 100)
}
