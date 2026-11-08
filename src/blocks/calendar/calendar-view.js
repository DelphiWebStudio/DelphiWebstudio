export function connectCalendar(calendar) {
  const monthPanel = calendar.querySelector('[data-ws-calendar-month]')
  const label = calendar.querySelector('[data-ws-calendar-label]')
  const days = calendar.querySelector('[data-ws-calendar-days]')
  const agenda = calendar.querySelector('[data-ws-calendar-events]')
  const empty = calendar.querySelector('[data-ws-calendar-empty]')
  const formatMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
  const today = new Date()
  let month = new Date(today.getFullYear(), today.getMonth(), 1)

  function displayMonth() {
    label.textContent = formatMonth.format(month)
    const year = month.getFullYear()
    const index = month.getMonth()
    const monthKey = String(year).padStart(4, '0') + '-' + String(index + 1).padStart(2, '0')
    const eventDays = new Map()
    for (const event of agenda.children) {
      const date = event.dataset.wsEventDate
      event.hidden = !date.startsWith(monthKey + '-')
      if (!event.hidden) {
        const day = Number(date.slice(-2))
        eventDays.set(day, (eventDays.get(day) || 0) + 1)
      }
    }
    empty.hidden = eventDays.size > 0
    const firstDay = month.getDay()
    const lastDate = new Date(year, index + 1, 0).getDate()
    days.replaceChildren()
    for (let cell = 0; cell < firstDay + lastDate; cell += 7) {
      const row = days.insertRow()
      for (let weekday = 0; weekday < 7; weekday++) {
        const date = cell + weekday - firstDay + 1
        const square = row.insertCell()
        if (date < 1 || date > lastDate) continue
        const count = eventDays.get(date)
        square.textContent = String(date)
        if (count) {
          square.dataset.wsCalendarHasEvents = ''
          square.setAttribute('aria-label', date + ' · ' + count + (count === 1 ? ' event' : ' events'))
        }
        if (year === today.getFullYear() && index === today.getMonth() && date === today.getDate()) {
          square.setAttribute('aria-current', 'date')
        }
      }
    }
  }

  function changeMonth(event) {
    const button = event.target.closest('[data-ws-calendar-step]')
    if (!button) return
    const step = Number(button.dataset.wsCalendarStep)
    month = step ? new Date(month.getFullYear(), month.getMonth() + step, 1) : new Date(today.getFullYear(), today.getMonth(), 1)
    displayMonth()
  }

  const observer = new MutationObserver(displayMonth)
  observer.observe(agenda, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ws-event-date'] })
  monthPanel.addEventListener('click', changeMonth)
  displayMonth()
  monthPanel.hidden = false
  return () => {
    observer.disconnect()
    monthPanel.removeEventListener('click', changeMonth)
  }
}
