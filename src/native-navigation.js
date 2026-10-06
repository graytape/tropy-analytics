'use strict'
const core = require('./analytics-core')

module.exports = function nativeNavigation(settings, state) {
  const limitations = []
  const raw = String(settings.search || '').trim()
  // Analytics searches literal text. Quote punctuation/FTS operators rather
  // than accidentally interpreting a person's name as a query expression.
  let query = /[^\p{L}\p{N}\s]|\b(?:AND|OR|NOT|NEAR)\b/u.test(raw)
    ? `"${raw.replace(/"/g, '""')}"` : raw
  const listId = settings.listId
  const list = listId == null || listId === '' ? null : state.lists?.[listId]?.id ?? listId
  if (list != null && settings.includeDescendants && (state.lists?.[listId]?.children || []).length) limitations.push('nativeNested')
  let tags = (settings.includeTags || []).map(id => state.tags?.[id]?.id ?? id)
  if (settings.tagMode === 'any' && tags.length > 1) {
    tags = [] // Native Tropy combines selected tags with AND, not OR.
    limitations.push('nativeAnyTags')
  }
  if (settings.excludeTags?.length) limitations.push('nativeExcludedTags')
  if (settings.conditions?.length) limitations.push('nativeConditions')
  const from = core.parseDate(settings.from, settings.dateOrder)
  const to = core.parseDate(settings.to, settings.dateOrder)
  if (settings.from || settings.to) {
    const year = from?.year === to?.year ? from?.year : null
    if (!query && year != null && !settings.showUndated && !String(settings.dateField).startsWith('__')) {
      query = String(year)
      limitations.push('nativeYearText')
    } else limitations.push('nativeDates')
  }
  return {
    action: {
      type: 'nav.select',
      payload: { mode: 'project', list, tags, query, trash: null, imports: null },
      meta: { search: true }
    },
    limitations
  }
}
