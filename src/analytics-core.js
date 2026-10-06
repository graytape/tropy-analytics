'use strict'

const DC_TITLE = 'http://purl.org/dc/elements/1.1/title'
const DC_DATE = 'http://purl.org/dc/elements/1.1/date'
const DCTERMS_DATE = 'http://purl.org/dc/terms/date'
const DC_CREATOR = 'http://purl.org/dc/elements/1.1/creator'
const DC_AUDIENCE = 'http://purl.org/dc/elements/1.1/audience'
const DCTERMS_AUDIENCE = 'http://purl.org/dc/terms/audience'
const TROPY_AUDIENCE = 'https://tropy.org/v1/tropy#audience'

const INTERNAL_FIELDS = Object.freeze({
  ALL: '__all',
  TITLE: '__title',
  DATE: '__date',
  CREATED: '__created',
  MODIFIED: '__modified',
  TAGS: '__tags',
  LISTS: '__lists'
})

const MONTHS = Object.freeze({
  jan: 1, january: 1, gennaio: 1, janvier: 1, enero: 1, januar: 1,
  feb: 2, february: 2, febbraio: 2, fevrier: 2, febrero: 2, februar: 2,
  mar: 3, march: 3, marzo: 3, mars: 3, marz: 3, maerz: 3,
  apr: 4, april: 4, aprile: 4, avril: 4, abril: 4,
  may: 5, maggio: 5, mai: 5, mayo: 5,
  jun: 6, june: 6, giugno: 6, juin: 6, junio: 6, juni: 6,
  jul: 7, july: 7, luglio: 7, juillet: 7, julio: 7, juli: 7,
  aug: 8, august: 8, agosto: 8, aout: 8,
  sep: 9, sept: 9, september: 9, settembre: 9, septembre: 9,
  septiembre: 9,
  oct: 10, october: 10, ottobre: 10, octobre: 10, octubre: 10, oktober: 10,
  nov: 11, november: 11, novembre: 11, noviembre: 11,
  dec: 12, december: 12, dicembre: 12, decembre: 12, diciembre: 12,
  dezember: 12
})

function textOf(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('; ')
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '')
    if ('value' in value) return textOf(value.value)
    if ('@value' in value) return textOf(value['@value'])
    if ('label' in value) return textOf(value.label)
    if ('name' in value) return textOf(value.name)
    return ''
  }
  return String(value)
}

function normalize(value) {
  return textOf(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function validParts(year, month = 1, day = 1) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const max = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= max
}

function makeDate(year, month = 1, day = 1, precision = 'year', source = '') {
  year = Number(year)
  month = Number(month)
  day = Number(day)
  if (!validParts(year, month, day)) return null

  return {
    year,
    month,
    day,
    precision,
    sortKey: (year * 10000) + (month * 100) + day,
    source: String(source)
  }
}

function monthNumber(token) {
  return MONTHS[normalize(token).replace(/\.$/, '')] || null
}

function parseDate(input, dateOrder = 'DMY') {
  if (input instanceof Date && !Number.isNaN(input.valueOf())) {
    return makeDate(
      input.getFullYear(), input.getMonth() + 1, input.getDate(), 'day', input.toISOString()
    )
  }

  const source = textOf(input).trim()
  if (!source) return null

  const cleaned = normalize(source)
    .replace(/\b(?:circa|ca|c|approx|approximately|vers|um|about)\.?\s*/g, '')
    .replace(/[\[\]()?]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  let match = cleaned.match(/(?:^|[^\d])(-?\d{3,4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:$|[^\d])/) 
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = match[3] == null ? 1 : Number(match[3])
    const parsed = makeDate(year, month, day, match[3] == null ? 'month' : 'day', source)
    if (parsed) return parsed
  }

  match = cleaned.match(/(?:^|[^\d])(\d{1,2})[/.\-](\d{1,2})[/.\-](-?\d{3,4})(?:$|[^\d])/) 
  if (match) {
    const first = Number(match[1])
    const second = Number(match[2])
    const year = Number(match[3])
    const month = dateOrder === 'MDY' ? first : second
    const day = dateOrder === 'MDY' ? second : first
    const parsed = makeDate(year, month, day, 'day', source)
    if (parsed) return parsed
  }

  match = cleaned.match(/(?:^|\s)(\d{1,2})\s+([a-z.]+)\s*,?\s*(-?\d{3,4})(?:$|\s)/)
  if (match) {
    const parsed = makeDate(
      Number(match[3]), monthNumber(match[2]), Number(match[1]), 'day', source
    )
    if (parsed) return parsed
  }

  match = cleaned.match(/(?:^|\s)([a-z.]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(-?\d{3,4})(?:$|\s)/)
  if (match) {
    const parsed = makeDate(
      Number(match[3]), monthNumber(match[1]), Number(match[2]), 'day', source
    )
    if (parsed) return parsed
  }

  match = cleaned.match(/(?:^|\s)([a-z.]+)\s+(-?\d{3,4})(?:$|\s)/)
  if (match) {
    const parsed = makeDate(Number(match[2]), monthNumber(match[1]), 1, 'month', source)
    if (parsed) return parsed
  }

  match = cleaned.match(/(?:^|[^\d])(-?\d{3,4})(?:$|[^\d])/) 
  if (match) return makeDate(Number(match[1]), 1, 1, 'year', source)

  return null
}

function upperSortKey(parsed) {
  if (!parsed) return null
  if (parsed.precision === 'year') return (parsed.year * 10000) + 1231
  if (parsed.precision === 'month') {
    const day = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate()
    return (parsed.year * 10000) + (parsed.month * 100) + day
  }
  return parsed.sortKey
}

function localizedLabel(value, locale = 'en') {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const exact = value.find(entry => entry?.language === locale || entry?.['@language'] === locale)
    return textOf(exact || value[0])
  }
  if (typeof value === 'object') {
    return textOf(value[locale] ?? value[locale.split('-')[0]] ?? value.en ?? value.it ?? value)
  }
  return String(value)
}

function compactProperty(id) {
  const hash = id.lastIndexOf('#')
  const slash = id.lastIndexOf('/')
  return id.slice(Math.max(hash, slash) + 1) || id
}

function buildFieldCatalog(state, locale = 'en') {
  const properties = new Map()
  const templateLabels = new Map()

  for (const template of Object.values(state?.ontology?.template || {})) {
    for (const field of template?.fields || []) {
      if (!field?.property) continue
      if (field.label && !templateLabels.has(field.property)) {
        templateLabels.set(field.property, localizedLabel(field.label, locale))
      }
      const existing = properties.get(field.property) || {
        id: field.property,
        count: 0,
        types: new Set()
      }
      if (field.datatype) existing.types.add(field.datatype)
      properties.set(field.property, existing)
    }
  }

  for (const item of Object.values(state?.items || {})) {
    if (!item || item.deleted) continue
    const metadata = state?.metadata?.[item.id] || {}
    for (const [id, value] of Object.entries(metadata || {})) {
      if (id === 'id') continue
      const existing = properties.get(id) || { id, count: 0, types: new Set() }
      existing.count += (Array.isArray(value) ? value.some(entry => textOf(entry).trim()) : textOf(value).trim()) ? 1 : 0
      if (value?.type) existing.types.add(value.type)
      properties.set(id, existing)
    }
  }

  const fields = [...properties.values()].map(field => {
    const ontologyProperty = state?.ontology?.props?.[field.id]
    const label = templateLabels.get(field.id) ||
      localizedLabel(ontologyProperty?.label || ontologyProperty?.name, locale) ||
      compactProperty(field.id)
    const searchable = normalize(`${label} ${field.id} ${compactProperty(field.id)}`)
    const types = [...field.types]

    return {
      id: field.id,
      label,
      count: field.count,
      types,
      isDate: types.some(type => /(?:date|datetime)$/i.test(type)) || /\b(date|data|datum)\b/.test(searchable),
      isTitle: field.id === DC_TITLE || /\b(title|titolo|titre|titulo|titel)\b/.test(searchable),
      role: fieldRole({ id: field.id, label })
    }
  })

  return fields.sort((a, b) => a.label.localeCompare(b.label, locale))
}

function defaultField(fields, kind) {
  const exact = kind === 'date' ? [DC_DATE, DCTERMS_DATE] : [DC_TITLE]
  for (const id of exact) {
    if (fields.some(field => field.id === id)) return id
  }

  const marked = fields.find(field => kind === 'date' ? field.isDate : field.isTitle)
  return marked?.id || (kind === 'title' ? fields[0]?.id : null) || null
}

function flattenLists(lists = {}, locale = 'en') {
  const result = []
  const entries = Object.values(lists)
  const root = entries.find(list => list?.parent == null) || lists[0] || lists['0']
  const visited = new Set()

  function walk(id, depth, names) {
    const key = String(id)
    if (visited.has(key)) return
    visited.add(key)
    const list = lists[id] || lists[key]
    if (!list) return
    const path = list === root ? names : [...names, list.name].filter(Boolean)
    if (list !== root) {
      result.push({
        id: list.id,
        name: list.name || `#${list.id}`,
        depth,
        path: path.join(' / ')
      })
    }
    for (const child of list.children || []) walk(child, depth + (list === root ? 0 : 1), path)
  }

  if (root) walk(root.id, 0, [])
  for (const list of entries) {
    if (list && !visited.has(String(list.id))) walk(list.id, 0, [])
  }

  return result.sort((a, b) => a.path.localeCompare(b.path, locale))
}

function descendantIds(lists = {}, id) {
  const result = new Set()
  const pending = [id]
  while (pending.length) {
    const current = pending.pop()
    const key = String(current)
    if (result.has(key)) continue
    result.add(key)
    const list = lists[current] || lists[key]
    for (const child of list?.children || []) pending.push(child)
  }
  return result
}

function metadataValue(metadata, field) {
  return textOf(metadata?.[field])
}

function dateValue(record, field, dateOrder) {
  if (field === INTERNAL_FIELDS.DATE) return record.date
  if (field === INTERNAL_FIELDS.CREATED) return parseDate(record.item.created, dateOrder)
  if (field === INTERNAL_FIELDS.MODIFIED) return parseDate(record.item.modified, dateOrder)
  return parseDate(metadataValue(record.metadata, field), dateOrder)
}

function conditionValue(record, field) {
  switch (field) {
    case INTERNAL_FIELDS.ALL:
      return Object.values(record.metadata || {}).map(textOf).join(' ')
    case INTERNAL_FIELDS.TITLE:
      return record.title
    case INTERNAL_FIELDS.DATE:
      return record.rawDate
    case INTERNAL_FIELDS.CREATED:
      return record.item.created
    case INTERNAL_FIELDS.MODIFIED:
      return record.item.modified
    case INTERNAL_FIELDS.TAGS:
      return record.tags.map(tag => tag.name).join(' ')
    case INTERNAL_FIELDS.LISTS:
      return record.lists.map(list => list.path || list.name).join(' ')
    default:
      return metadataValue(record.metadata, field)
  }
}

function matchesCondition(record, condition, dateOrder = 'DMY') {
  const value = conditionValue(record, condition.field)
  const normalizedValue = normalize(value)
  const expected = normalize(condition.value)

  switch (condition.operator) {
    case 'exists':
      return normalizedValue.length > 0
    case 'not-exists':
      return normalizedValue.length === 0
    case 'equals':
      return normalizedValue === expected
    case 'not-equals':
      return normalizedValue !== expected
    case 'starts-with':
      return normalizedValue.startsWith(expected)
    case 'ends-with':
      return normalizedValue.endsWith(expected)
    case 'not-contains':
      return !normalizedValue.includes(expected)
    case 'matches':
      try {
        return new RegExp(condition.value, 'iu').test(textOf(value))
      } catch {
        return false
      }
    case 'before':
    case 'after':
    case 'on-or-before':
    case 'on-or-after': {
      const actual = dateValue(record, condition.field, dateOrder) || parseDate(value, dateOrder)
      const target = parseDate(condition.value, dateOrder)
      if (!actual || !target) return false
      if (condition.operator === 'before') return actual.sortKey < target.sortKey
      if (condition.operator === 'after') return actual.sortKey > upperSortKey(target)
      if (condition.operator === 'on-or-before') return actual.sortKey <= upperSortKey(target)
      return actual.sortKey >= target.sortKey
    }
    case 'contains':
    default:
      return normalizedValue.includes(expected)
  }
}

function appliesConditions(record, conditions = [], mode = 'all', dateOrder = 'DMY') {
  const included = conditions.filter(condition => condition.mode !== 'exclude')
  const excluded = conditions.filter(condition => condition.mode === 'exclude')

  const inclusionPasses = included.length === 0 || (mode === 'any'
    ? included.some(condition => matchesCondition(record, condition, dateOrder))
    : included.every(condition => matchesCondition(record, condition, dateOrder)))

  if (!inclusionPasses) return false
  return !excluded.some(condition => matchesCondition(record, condition, dateOrder))
}

function itemLists(item, lists, flattened) {
  const paths = new Map(flattened.map(list => [String(list.id), list]))
  return (item.lists || [])
    .map(id => paths.get(String(id)) || lists[id] || lists[String(id)])
    .filter(Boolean)
    .map(list => ({
      id: list.id,
      name: list.name || `#${list.id}`,
      path: list.path || list.name || `#${list.id}`
    }))
}

function buildTimelineData(state, options = {}) {
  const fields = buildFieldCatalog(state, options.locale)
  const dateField = options.dateField || defaultField(fields, 'date')
  const titleField = options.titleField || defaultField(fields, 'title')
  const dateOrder = options.dateOrder || 'DMY'
  const flattened = flattenLists(state?.lists || {}, options.locale)
  const selectedLists = options.listId == null || options.listId === ''
    ? null
    : (options.includeDescendants === false
        ? new Set([String(options.listId)])
        : descendantIds(state?.lists || {}, options.listId))
  const requiredTags = new Set((options.includeTags || []).map(String))
  const forbiddenTags = new Set((options.excludeTags || []).map(String))
  const from = parseDate(options.from, dateOrder)
  const to = parseDate(options.to, dateOrder)
  const search = normalize(options.search)
  const records = []
  const undated = []
  let scoped = 0

  for (const item of Object.values(state?.items || {})) {
    if (!item || item.deleted) continue

    const itemListIds = new Set((item.lists || []).map(String))
    if (selectedLists && ![...selectedLists].some(id => itemListIds.has(id))) continue

    const itemTagIds = new Set((item.tags || []).map(String))
    if (requiredTags.size) {
      const passes = options.tagMode === 'any'
        ? [...requiredTags].some(id => itemTagIds.has(id))
        : [...requiredTags].every(id => itemTagIds.has(id))
      if (!passes) continue
    }
    if ([...forbiddenTags].some(id => itemTagIds.has(id))) continue

    scoped += 1
    const metadata = state?.metadata?.[item.id] || {}
    const rawDate = dateField === INTERNAL_FIELDS.CREATED
      ? textOf(item.created)
      : dateField === INTERNAL_FIELDS.MODIFIED
        ? textOf(item.modified)
        : metadataValue(metadata, dateField)
    const parsed = parseDate(rawDate, dateOrder)
    const title = metadataValue(metadata, titleField) || `#${item.id}`
    const tags = (item.tags || [])
      .map(id => state?.tags?.[id] || state?.tags?.[String(id)])
      .filter(Boolean)
      .map(tag => ({ id: tag.id, name: tag.name || `#${tag.id}`, color: tag.color }))
    const lists = itemLists(item, state?.lists || {}, flattened)

    const record = {
      id: item.id,
      item,
      metadata,
      date: parsed,
      rawDate,
      title,
      tags,
      lists
    }

    if (search) {
      const haystack = normalize([
        title,
        ...Object.values(metadata).map(textOf),
        ...tags.map(tag => tag.name),
        ...lists.map(list => list.path)
      ].join(' '))
      if (!haystack.includes(search)) continue
    }

    if (!appliesConditions(record, options.conditions, options.conditionMode, dateOrder)) continue

    if (!parsed) {
      undated.push(record)
      continue
    }
    if (from && parsed.sortKey < from.sortKey) continue
    if (to && parsed.sortKey > upperSortKey(to)) continue
    records.push(record)
  }

  const direction = options.direction === 'desc' ? -1 : 1
  records.sort((a, b) => direction * (
    a.date.sortKey - b.date.sortKey || String(a.title).localeCompare(String(b.title), options.locale)
  ))
  undated.sort((a, b) => String(a.title).localeCompare(String(b.title), options.locale))

  return {
    records,
    undated,
    fields,
    dateField,
    titleField,
    scoped,
    min: records.length ? Math.min(...records.map(record => record.date.sortKey)) : null,
    max: records.length ? Math.max(...records.map(record => record.date.sortKey)) : null
  }
}

function groupKey(record, granularity = 'month') {
  const { year, month, day } = record.date
  if (granularity === 'year') return `${year}`
  if (granularity === 'day') return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return `${year}-${String(month).padStart(2, '0')}`
}

function groupRecords(records, granularity = 'month') {
  const groups = []
  let current = null
  for (const record of records) {
    const key = groupKey(record, granularity)
    if (!current || current.key !== key) {
      current = { key, date: record.date, records: [] }
      groups.push(current)
    }
    current.records.push(record)
  }
  return groups
}

function buildHistogram(records, maxBuckets = 48) {
  if (!records.length) return []
  const counts = new Map()
  for (const record of records) {
    if (!record?.date) continue
    const year = record.date.year
    counts.set(year, (counts.get(year) || 0) + 1)
  }
  if (!counts.size) return []
  const years = [...counts.keys()].sort((a, b) => a - b)
  const min = years[0]
  const max = years[years.length - 1]
  const span = Math.max(1, Math.ceil((max - min + 1) / maxBuckets))
  const buckets = []

  for (let start = min; start <= max; start += span) {
    const end = Math.min(max, start + span - 1)
    let count = 0
    for (let year = start; year <= end; year += 1) count += counts.get(year) || 0
    buckets.push({ start, end, count, label: start === end ? `${start}` : `${start}-${end}` })
  }
  return buckets
}

function splitEntities(value) {
  const raw = textOf(value).trim()
  if (!raw) return []
  return [...new Set(raw.split(/\s*(?:;|\n|\||\s+\/\s+)\s*/).map(name => name.trim()).filter(Boolean))]
}

function fieldRole(field) {
  const id = String(field?.id || '').toLowerCase()
  if (id === DC_CREATOR || id.endsWith('#creator') || id.endsWith('/creator')) return 'creator'
  if ([DC_AUDIENCE, DCTERMS_AUDIENCE, TROPY_AUDIENCE].includes(id) || id.endsWith('#audience') || id.endsWith('/audience')) return 'audience'
  const key = normalize(`${field?.label || ''} ${field?.id || ''} ${field?.types?.join(' ') || ''}`)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (/(^|\s)(creator|creators|author|authors|auteur|auteure|creador|autora)(\s|$)/.test(key)) return 'creator'
  if (/(^|\s)(audience|public|recipient|recipients|addressee|addressees|destinataire|destinatario|audiencia)(\s|$)/.test(key)) return 'audience'
  if (/(^|\s)(person|people|contributor|contributors)(\s|$)/.test(key)) return 'person'
  return null
}

function ensureStandardPeopleFields(fields = []) {
  const result = [...fields]
  const known = new Set(result.map(field => String(field.id).toLowerCase()))
  for (const [id, label, role] of [
    [DC_CREATOR, 'Creator', 'creator'],
    [DC_AUDIENCE, 'Audience', 'audience']
  ]) {
    if (known.has(id.toLowerCase())) continue
    result.push({ id, label, count: 0, types: [], role })
  }
  return result
}

function buildAnalyticsData(state, options = {}) {
  const data = buildTimelineData(state, options)
  const records = [...data.records, ...(options.includeUndated ? data.undated : [])]
  const selectedFields = Array.isArray(options.entityFields) ? options.entityFields : []
  const fieldEntries = selectedFields.map(fieldId => data.fields.find(field => String(field.id) === String(fieldId))).filter(Boolean)
  const roleFields = options.roleFields || {}
  const roles = new Set(options.entityRoles || ['creator', 'audience', 'person'])
  const peopleFields = ensureStandardPeopleFields(data.fields)
    .map(field => ({ ...field, role: String(field.id) === String(roleFields.creator) ? 'creator' : String(field.id) === String(roleFields.audience) ? 'audience' : String(field.id) === String(roleFields.person) ? 'person' : fieldRole(field) }))
    .filter(field => field.role && roles.has(field.role) && (!options.entityFieldsSet || selectedFields.map(String).includes(String(field.id))))
  const selected = new Set(selectedFields.map(String))
  const fields = [...new Map([...peopleFields, ...fieldEntries]
    .filter(field => field.role ? roles.has(field.role) : selected.has(String(field.id)))
    .map(field => [String(field.id), { ...field, role: field.role || (String(field.id) === String(roleFields.creator) ? 'creator' : String(field.id) === String(roleFields.audience) ? 'audience' : String(field.id) === String(roleFields.person) ? 'person' : fieldRole(field)) }])).values()]
  const counts = new Map()
  const graph = new Map()
  const annualLinks = new Map()

  for (const record of records) {
    const entities = new Map()
    for (const field of fields) {
      for (const name of splitEntities(record.metadata?.[field.id])) {
        const key = normalize(name)
        if (!key) continue
        if (!entities.has(key)) entities.set(key, { name, roles: new Set() })
        if (field.role) entities.get(key).roles.add(field.role)
      }
    }
    const normalized = [...entities]
    for (const [key, entity] of normalized) {
      const current = counts.get(key) || { name: entity.name, count: 0, items: new Set(), byYear: new Map(), roles: new Set() }
      const firstInRecord = !current.items.has(String(record.id))
      current.items.add(String(record.id))
      current.count = current.items.size
      for (const role of entity.roles) current.roles.add(role)
      if (firstInRecord && record.date) current.byYear.set(record.date.year, (current.byYear.get(record.date.year) || 0) + 1)
      counts.set(key, current)
      if (!graph.has(key)) graph.set(key, { name: entity.name, count: 0, roles: new Set(), neighbors: new Map() })
      graph.get(key).count = current.count
      for (const role of entity.roles) graph.get(key).roles.add(role)
    }

    const addLink = (map, a, b) => {
      if (a === b) return
      const [source, target] = [a, b].sort()
      const pair = `${source}\u0000${target}`
      const link = map.get(pair) || { source, target, weight: 0 }
      link.weight += 1
      map.set(pair, link)
    }
    const sourceLinks = new Map()
    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        addLink(sourceLinks, normalized[i][0], normalized[j][0])
      }
    }
    for (const link of sourceLinks.values()) {
      addLink(annualLinks, link.source, link.target)
      graph.get(link.source)?.neighbors.set(link.target, (graph.get(link.source)?.neighbors.get(link.target) || 0) + link.weight)
      graph.get(link.target)?.neighbors.set(link.source, (graph.get(link.target)?.neighbors.get(link.source) || 0) + link.weight)
    }

  }

  const entities = [...counts.values()].map(entity => ({
    ...entity,
    items: [...entity.items],
    roles: [...entity.roles],
    byYear: [...entity.byYear].map(([year, count]) => ({ year, count }))
  }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, options.locale))
  const topKeys = new Set(entities.slice(0, 24).map(entity => normalize(entity.name)))
  const nodes = [...graph].filter(([key]) => topKeys.has(key)).map(([id, node]) => ({
    id, name: node.name, count: node.count, roles: [...node.roles],
    neighbors: [...node.neighbors].filter(([key]) => topKeys.has(key)).map(([target, weight]) => ({ target, weight }))
  }))
  const networkLinks = [...annualLinks.values()].filter(link => topKeys.has(link.source) && topKeys.has(link.target))

  for (const node of nodes) {
    node.neighbors = networkLinks.filter(link => link.source === node.id || link.target === node.id)
      .map(link => ({ target: link.source === node.id ? link.target : link.source, weight: link.weight }))
  }

  return { ...data, records, entityFields: fields, entities, nodes, networkLinks }
}

function buildFacetCounts(records, fieldId) {
  const counts = new Map()
  for (const record of records || []) {
    const values = splitEntities(record.metadata?.[fieldId])
    for (const value of values) {
      const key = normalize(value)
      if (!key) continue
      const entry = counts.get(key) || { name: value, count: 0, items: new Set() }
      entry.items.add(String(record.id))
      entry.count = entry.items.size
      counts.set(key, entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

module.exports = {
  DC_TITLE,
  DC_DATE,
  DCTERMS_DATE,
  DC_CREATOR,
  DC_AUDIENCE,
  DCTERMS_AUDIENCE,
  TROPY_AUDIENCE,
  fieldRole,
  ensureStandardPeopleFields,
  INTERNAL_FIELDS,
  appliesConditions,
  buildFieldCatalog,
  buildHistogram,
  buildAnalyticsData,
  buildFacetCounts,
  buildTimelineData,
  defaultField,
  descendantIds,
  flattenLists,
  groupRecords,
  matchesCondition,
  normalize,
  parseDate,
  textOf,
  upperSortKey,
  splitEntities
}
