const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function mdToHtml(md: string): string {
  if (!md) return ''
  const lines = md.replace(/\r/g, '').split('\n')
  let html = ''
  let i = 0
  const inline = (t: string): string =>
    escapeHtml(t)
      .replace(/`([^`]+)`/g, '<code class="ic">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\$\$([^$]+)\$\$/g, '<span class="eq">$1</span>')
      .replace(/\\\[(.+?)\\\]/g, '<span class="eq">$1</span>')
      .replace(/\$([^$]+)\$/g, '<span class="eq">$1</span>')
      .replace(/\\\((.+?)\\\)/g, '<span class="eq">$1</span>')

  while (i < lines.length) {
    const l = lines[i]
    if (/^```/.test(l)) {
      let code = ''
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        code += lines[i] + '\n'
        i++
      }
      i++
      html += `<pre class="cb"><code>${escapeHtml(code)}</code></pre>`
      continue
    }
    if (l.trim() === '\\[') {
      i++
      const exprLines: string[] = []
      while (i < lines.length && lines[i].trim() !== '\\]') {
        if (lines[i].trim() !== '') exprLines.push(lines[i].trim())
        i++
      }
      i++
      html += `<p><span class="eq">${escapeHtml(exprLines.join(' ').trim())}</span></p>`
      continue
    }
    if (
      /^\s*\|.*\|\s*$/.test(l) &&
      i + 1 < lines.length &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])
    ) {
      const rows: string[] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i])
        i++
      }
      const cells = (r: string): string[] =>
        r
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      html +=
        '<table class="tb"><thead><tr>' +
        head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'
      continue
    }
    if (/^\s*[-*] /.test(l)) {
      let items = ''
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        items += `<li>${inline(lines[i].replace(/^\s*[-*] /, ''))}</li>`
        i++
      }
      html += `<ul>${items}</ul>`
      continue
    }
    if (/^\s*\d+\. /.test(l)) {
      let items = ''
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        items += `<li>${inline(lines[i].replace(/^\s*\d+\. /, ''))}</li>`
        i++
      }
      html += `<ol>${items}</ol>`
      continue
    }
    if (/^> /.test(l)) {
      const q = inline(l.replace(/^> /, ''))
      html += `<blockquote>${q}</blockquote>`
      i++
      continue
    }
    const headingMatch = l.match(/^(#{1,})\s*(.*)$/)
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3)
      const text = headingMatch[2].replace(/\s*#+\s*$/, '').trim()
      html += `<h${level}>${inline(text)}</h${level}>`
      i++
      continue
    }
    if (/^---\s*$/.test(l)) {
      html += '<hr/>'
      i++
      continue
    }
    if (l.trim() === '') {
      i++
      continue
    }
    html += `<p>${inline(l)}</p>`
    i++
  }
  return html
}
