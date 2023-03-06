export function generateJson (page) {
  return page.evaluate(() => {
    function parseHTMLTableElem (tableEl) {
      const columns = Array.from(tableEl.querySelectorAll('tr:first-child > td')).map(it => it.textContent)

      const rows = tableEl.querySelectorAll('tr:not(:first-child)')

      let categoryIndex = -1

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

      const result = days.reduce((prev, cur) => ({ ...prev, [cur]: [] }), {})

      for (const row of Array.from(rows)) {
        const cells = Array.from(row.querySelectorAll('td'))

        if (cells[0].classList.contains('darkbold')) {
          categoryIndex++
          continue
        }

        const isEmpty = !cells[1].textContent.trim()

        if (isEmpty) {
          continue
        }

        result[days[categoryIndex]].push(columns.reduce((obj, col, idx) => {
          obj[col] = cells[idx].textContent
          return obj
        }
        , {}))
      }

      return { days: result }
    }

    console.clear()

    return parseHTMLTableElem(document.querySelector('#divTT > table:nth-child(2)'))
  })
}
