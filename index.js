/* Tropy Analytics 1.8.1 - AGPL-3.0-or-later */
'use strict';

const require$$0 = require('node:path');
const require$$1 = require('node:url');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var analyticsCore;
var hasRequiredAnalyticsCore;

function requireAnalyticsCore () {
	if (hasRequiredAnalyticsCore) return analyticsCore;
	hasRequiredAnalyticsCore = 1;

	const DC_TITLE = 'http://purl.org/dc/elements/1.1/title';
	const DC_DATE = 'http://purl.org/dc/elements/1.1/date';
	const DCTERMS_DATE = 'http://purl.org/dc/terms/date';
	const DC_CREATOR = 'http://purl.org/dc/elements/1.1/creator';
	const DC_AUDIENCE = 'http://purl.org/dc/elements/1.1/audience';
	const DCTERMS_AUDIENCE = 'http://purl.org/dc/terms/audience';
	const TROPY_AUDIENCE = 'https://tropy.org/v1/tropy#audience';

	const INTERNAL_FIELDS = Object.freeze({
	  ALL: '__all',
	  TITLE: '__title',
	  DATE: '__date',
	  CREATED: '__created',
	  MODIFIED: '__modified',
	  TAGS: '__tags',
	  LISTS: '__lists'
	});

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
	});

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
	  const max = new Date(Date.UTC(year, month, 0)).getUTCDate();
	  return day <= max
	}

	function makeDate(year, month = 1, day = 1, precision = 'year', source = '') {
	  year = Number(year);
	  month = Number(month);
	  day = Number(day);
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

	  const source = textOf(input).trim();
	  if (!source) return null

	  const cleaned = normalize(source)
	    .replace(/\b(?:circa|ca|c|approx|approximately|vers|um|about)\.?\s*/g, '')
	    .replace(/[\[\]()?]/g, ' ')
	    .replace(/[–—]/g, '-')
	    .replace(/\s+/g, ' ')
	    .trim();

	  let match = cleaned.match(/(?:^|[^\d])(-?\d{3,4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:$|[^\d])/); 
	  if (match) {
	    const year = Number(match[1]);
	    const month = Number(match[2]);
	    const day = match[3] == null ? 1 : Number(match[3]);
	    const parsed = makeDate(year, month, day, match[3] == null ? 'month' : 'day', source);
	    if (parsed) return parsed
	  }

	  match = cleaned.match(/(?:^|[^\d])(\d{1,2})[/.\-](\d{1,2})[/.\-](-?\d{3,4})(?:$|[^\d])/); 
	  if (match) {
	    const first = Number(match[1]);
	    const second = Number(match[2]);
	    const year = Number(match[3]);
	    const month = dateOrder === 'MDY' ? first : second;
	    const day = dateOrder === 'MDY' ? second : first;
	    const parsed = makeDate(year, month, day, 'day', source);
	    if (parsed) return parsed
	  }

	  match = cleaned.match(/(?:^|\s)(\d{1,2})\s+([a-z.]+)\s*,?\s*(-?\d{3,4})(?:$|\s)/);
	  if (match) {
	    const parsed = makeDate(
	      Number(match[3]), monthNumber(match[2]), Number(match[1]), 'day', source
	    );
	    if (parsed) return parsed
	  }

	  match = cleaned.match(/(?:^|\s)([a-z.]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(-?\d{3,4})(?:$|\s)/);
	  if (match) {
	    const parsed = makeDate(
	      Number(match[3]), monthNumber(match[1]), Number(match[2]), 'day', source
	    );
	    if (parsed) return parsed
	  }

	  match = cleaned.match(/(?:^|\s)([a-z.]+)\s+(-?\d{3,4})(?:$|\s)/);
	  if (match) {
	    const parsed = makeDate(Number(match[2]), monthNumber(match[1]), 1, 'month', source);
	    if (parsed) return parsed
	  }

	  match = cleaned.match(/(?:^|[^\d])(-?\d{3,4})(?:$|[^\d])/); 
	  if (match) return makeDate(Number(match[1]), 1, 1, 'year', source)

	  return null
	}

	function upperSortKey(parsed) {
	  if (!parsed) return null
	  if (parsed.precision === 'year') return (parsed.year * 10000) + 1231
	  if (parsed.precision === 'month') {
	    const day = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
	    return (parsed.year * 10000) + (parsed.month * 100) + day
	  }
	  return parsed.sortKey
	}

	function localizedLabel(value, locale = 'en') {
	  if (value == null) return ''
	  if (typeof value === 'string') return value
	  if (Array.isArray(value)) {
	    const exact = value.find(entry => entry?.language === locale || entry?.['@language'] === locale);
	    return textOf(exact || value[0])
	  }
	  if (typeof value === 'object') {
	    return textOf(value[locale] ?? value[locale.split('-')[0]] ?? value.en ?? value.it ?? value)
	  }
	  return String(value)
	}

	function compactProperty(id) {
	  const hash = id.lastIndexOf('#');
	  const slash = id.lastIndexOf('/');
	  return id.slice(Math.max(hash, slash) + 1) || id
	}

	function buildFieldCatalog(state, locale = 'en') {
	  const properties = new Map();
	  const templateLabels = new Map();

	  for (const template of Object.values(state?.ontology?.template || {})) {
	    for (const field of template?.fields || []) {
	      if (!field?.property) continue
	      if (field.label && !templateLabels.has(field.property)) {
	        templateLabels.set(field.property, localizedLabel(field.label, locale));
	      }
	      const existing = properties.get(field.property) || {
	        id: field.property,
	        count: 0,
	        types: new Set()
	      };
	      if (field.datatype) existing.types.add(field.datatype);
	      properties.set(field.property, existing);
	    }
	  }

	  for (const item of Object.values(state?.items || {})) {
	    if (!item || item.deleted) continue
	    const metadata = state?.metadata?.[item.id] || {};
	    for (const [id, value] of Object.entries(metadata || {})) {
	      if (id === 'id') continue
	      const existing = properties.get(id) || { id, count: 0, types: new Set() };
	      existing.count += (Array.isArray(value) ? value.some(entry => textOf(entry).trim()) : textOf(value).trim()) ? 1 : 0;
	      if (value?.type) existing.types.add(value.type);
	      properties.set(id, existing);
	    }
	  }

	  const fields = [...properties.values()].map(field => {
	    const ontologyProperty = state?.ontology?.props?.[field.id];
	    const label = templateLabels.get(field.id) ||
	      localizedLabel(ontologyProperty?.label || ontologyProperty?.name, locale) ||
	      compactProperty(field.id);
	    const searchable = normalize(`${label} ${field.id} ${compactProperty(field.id)}`);
	    const types = [...field.types];

	    return {
	      id: field.id,
	      label,
	      count: field.count,
	      types,
	      isDate: types.some(type => /(?:date|datetime)$/i.test(type)) || /\b(date|data|datum)\b/.test(searchable),
	      isTitle: field.id === DC_TITLE || /\b(title|titolo|titre|titulo|titel)\b/.test(searchable),
	      role: fieldRole({ id: field.id, label })
	    }
	  });

	  return fields.sort((a, b) => a.label.localeCompare(b.label, locale))
	}

	function defaultField(fields, kind) {
	  const exact = kind === 'date' ? [DC_DATE, DCTERMS_DATE] : [DC_TITLE];
	  for (const id of exact) {
	    if (fields.some(field => field.id === id)) return id
	  }

	  const marked = fields.find(field => kind === 'date' ? field.isDate : field.isTitle);
	  return marked?.id || (kind === 'title' ? fields[0]?.id : null) || null
	}

	function flattenLists(lists = {}, locale = 'en') {
	  const result = [];
	  const entries = Object.values(lists);
	  const root = entries.find(list => list?.parent == null) || lists[0] || lists['0'];
	  const visited = new Set();

	  function walk(id, depth, names) {
	    const key = String(id);
	    if (visited.has(key)) return
	    visited.add(key);
	    const list = lists[id] || lists[key];
	    if (!list) return
	    const path = list === root ? names : [...names, list.name].filter(Boolean);
	    if (list !== root) {
	      result.push({
	        id: list.id,
	        name: list.name || `#${list.id}`,
	        depth,
	        path: path.join(' / ')
	      });
	    }
	    for (const child of list.children || []) walk(child, depth + (list === root ? 0 : 1), path);
	  }

	  if (root) walk(root.id, 0, []);
	  for (const list of entries) {
	    if (list && !visited.has(String(list.id))) walk(list.id, 0, []);
	  }

	  return result.sort((a, b) => a.path.localeCompare(b.path, locale))
	}

	function descendantIds(lists = {}, id) {
	  const result = new Set();
	  const pending = [id];
	  while (pending.length) {
	    const current = pending.pop();
	    const key = String(current);
	    if (result.has(key)) continue
	    result.add(key);
	    const list = lists[current] || lists[key];
	    for (const child of list?.children || []) pending.push(child);
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
	  const value = conditionValue(record, condition.field);
	  const normalizedValue = normalize(value);
	  const expected = normalize(condition.value);

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
	      const actual = dateValue(record, condition.field, dateOrder) || parseDate(value, dateOrder);
	      const target = parseDate(condition.value, dateOrder);
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
	  const included = conditions.filter(condition => condition.mode !== 'exclude');
	  const excluded = conditions.filter(condition => condition.mode === 'exclude');

	  const inclusionPasses = included.length === 0 || (mode === 'any'
	    ? included.some(condition => matchesCondition(record, condition, dateOrder))
	    : included.every(condition => matchesCondition(record, condition, dateOrder)));

	  if (!inclusionPasses) return false
	  return !excluded.some(condition => matchesCondition(record, condition, dateOrder))
	}

	function itemLists(item, lists, flattened) {
	  const paths = new Map(flattened.map(list => [String(list.id), list]));
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
	  const fields = buildFieldCatalog(state, options.locale);
	  const dateField = options.dateField || defaultField(fields, 'date');
	  const titleField = options.titleField || defaultField(fields, 'title');
	  const dateOrder = options.dateOrder || 'DMY';
	  const flattened = flattenLists(state?.lists || {}, options.locale);
	  const selectedLists = options.listId == null || options.listId === ''
	    ? null
	    : (options.includeDescendants === false
	        ? new Set([String(options.listId)])
	        : descendantIds(state?.lists || {}, options.listId));
	  const requiredTags = new Set((options.includeTags || []).map(String));
	  const forbiddenTags = new Set((options.excludeTags || []).map(String));
	  const from = parseDate(options.from, dateOrder);
	  const to = parseDate(options.to, dateOrder);
	  const search = normalize(options.search);
	  const records = [];
	  const undated = [];
	  let scoped = 0;

	  for (const item of Object.values(state?.items || {})) {
	    if (!item || item.deleted) continue

	    const itemListIds = new Set((item.lists || []).map(String));
	    if (selectedLists && ![...selectedLists].some(id => itemListIds.has(id))) continue

	    const itemTagIds = new Set((item.tags || []).map(String));
	    if (requiredTags.size) {
	      const passes = options.tagMode === 'any'
	        ? [...requiredTags].some(id => itemTagIds.has(id))
	        : [...requiredTags].every(id => itemTagIds.has(id));
	      if (!passes) continue
	    }
	    if ([...forbiddenTags].some(id => itemTagIds.has(id))) continue

	    scoped += 1;
	    const metadata = state?.metadata?.[item.id] || {};
	    const rawDate = dateField === INTERNAL_FIELDS.CREATED
	      ? textOf(item.created)
	      : dateField === INTERNAL_FIELDS.MODIFIED
	        ? textOf(item.modified)
	        : metadataValue(metadata, dateField);
	    const parsed = parseDate(rawDate, dateOrder);
	    const title = metadataValue(metadata, titleField) || `#${item.id}`;
	    const tags = (item.tags || [])
	      .map(id => state?.tags?.[id] || state?.tags?.[String(id)])
	      .filter(Boolean)
	      .map(tag => ({ id: tag.id, name: tag.name || `#${tag.id}`, color: tag.color }));
	    const lists = itemLists(item, state?.lists || {}, flattened);

	    const record = {
	      id: item.id,
	      item,
	      metadata,
	      date: parsed,
	      rawDate,
	      title,
	      tags,
	      lists
	    };

	    if (search) {
	      const haystack = normalize([
	        title,
	        ...Object.values(metadata).map(textOf),
	        ...tags.map(tag => tag.name),
	        ...lists.map(list => list.path)
	      ].join(' '));
	      if (!haystack.includes(search)) continue
	    }

	    if (!appliesConditions(record, options.conditions, options.conditionMode, dateOrder)) continue

	    if (!parsed) {
	      undated.push(record);
	      continue
	    }
	    if (from && parsed.sortKey < from.sortKey) continue
	    if (to && parsed.sortKey > upperSortKey(to)) continue
	    records.push(record);
	  }

	  const direction = options.direction === 'desc' ? -1 : 1;
	  records.sort((a, b) => direction * (
	    a.date.sortKey - b.date.sortKey || String(a.title).localeCompare(String(b.title), options.locale)
	  ));
	  undated.sort((a, b) => String(a.title).localeCompare(String(b.title), options.locale));

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
	  const { year, month, day } = record.date;
	  if (granularity === 'year') return `${year}`
	  if (granularity === 'day') return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	  return `${year}-${String(month).padStart(2, '0')}`
	}

	function groupRecords(records, granularity = 'month') {
	  const groups = [];
	  let current = null;
	  for (const record of records) {
	    const key = groupKey(record, granularity);
	    if (!current || current.key !== key) {
	      current = { key, date: record.date, records: [] };
	      groups.push(current);
	    }
	    current.records.push(record);
	  }
	  return groups
	}

	function buildHistogram(records, maxBuckets = 48) {
	  if (!records.length) return []
	  const counts = new Map();
	  for (const record of records) {
	    if (!record?.date) continue
	    const year = record.date.year;
	    counts.set(year, (counts.get(year) || 0) + 1);
	  }
	  if (!counts.size) return []
	  const years = [...counts.keys()].sort((a, b) => a - b);
	  const min = years[0];
	  const max = years[years.length - 1];
	  const span = Math.max(1, Math.ceil((max - min + 1) / maxBuckets));
	  const buckets = [];

	  for (let start = min; start <= max; start += span) {
	    const end = Math.min(max, start + span - 1);
	    let count = 0;
	    for (let year = start; year <= end; year += 1) count += counts.get(year) || 0;
	    buckets.push({ start, end, count, label: start === end ? `${start}` : `${start}-${end}` });
	  }
	  return buckets
	}

	function splitEntities(value) {
	  const raw = textOf(value).trim();
	  if (!raw) return []
	  return [...new Set(raw.split(/\s*(?:;|\n|\||\s+\/\s+)\s*/).map(name => name.trim()).filter(Boolean))]
	}

	function fieldRole(field) {
	  const id = String(field?.id || '').toLowerCase();
	  if (id === DC_CREATOR || id.endsWith('#creator') || id.endsWith('/creator')) return 'creator'
	  if ([DC_AUDIENCE, DCTERMS_AUDIENCE, TROPY_AUDIENCE].includes(id) || id.endsWith('#audience') || id.endsWith('/audience')) return 'audience'
	  const key = normalize(`${field?.label || ''} ${field?.id || ''} ${field?.types?.join(' ') || ''}`)
	    .replace(/[^a-z0-9]+/g, ' ')
	    .trim();
	  if (/(^|\s)(creator|creators|author|authors|auteur|auteure|creador|autora)(\s|$)/.test(key)) return 'creator'
	  if (/(^|\s)(audience|public|recipient|recipients|addressee|addressees|destinataire|destinatario|audiencia)(\s|$)/.test(key)) return 'audience'
	  if (/(^|\s)(person|people|contributor|contributors)(\s|$)/.test(key)) return 'person'
	  return null
	}

	function ensureStandardPeopleFields(fields = []) {
	  const result = [...fields];
	  const known = new Set(result.map(field => String(field.id).toLowerCase()));
	  for (const [id, label, role] of [
	    [DC_CREATOR, 'Creator', 'creator'],
	    [DC_AUDIENCE, 'Audience', 'audience']
	  ]) {
	    if (known.has(id.toLowerCase())) continue
	    result.push({ id, label, count: 0, types: [], role });
	  }
	  return result
	}

	function buildAnalyticsData(state, options = {}) {
	  const data = buildTimelineData(state, options);
	  const records = [...data.records, ...(options.includeUndated ? data.undated : [])];
	  const selectedFields = Array.isArray(options.entityFields) ? options.entityFields : [];
	  const fieldEntries = selectedFields.map(fieldId => data.fields.find(field => String(field.id) === String(fieldId))).filter(Boolean);
	  const roleFields = options.roleFields || {};
	  const roles = new Set(options.entityRoles || ['creator', 'audience', 'person']);
	  const peopleFields = ensureStandardPeopleFields(data.fields)
	    .map(field => ({ ...field, role: String(field.id) === String(roleFields.creator) ? 'creator' : String(field.id) === String(roleFields.audience) ? 'audience' : String(field.id) === String(roleFields.person) ? 'person' : fieldRole(field) }))
	    .filter(field => field.role && roles.has(field.role) && (!options.entityFieldsSet || selectedFields.map(String).includes(String(field.id))));
	  const selected = new Set(selectedFields.map(String));
	  const fields = [...new Map([...peopleFields, ...fieldEntries]
	    .filter(field => field.role ? roles.has(field.role) : selected.has(String(field.id)))
	    .map(field => [String(field.id), { ...field, role: field.role || (String(field.id) === String(roleFields.creator) ? 'creator' : String(field.id) === String(roleFields.audience) ? 'audience' : String(field.id) === String(roleFields.person) ? 'person' : fieldRole(field)) }])).values()];
	  const counts = new Map();
	  const graph = new Map();
	  const annualLinks = new Map();

	  for (const record of records) {
	    const entities = new Map();
	    for (const field of fields) {
	      for (const name of splitEntities(record.metadata?.[field.id])) {
	        const key = normalize(name);
	        if (!key) continue
	        if (!entities.has(key)) entities.set(key, { name, roles: new Set() });
	        if (field.role) entities.get(key).roles.add(field.role);
	      }
	    }
	    const normalized = [...entities];
	    for (const [key, entity] of normalized) {
	      const current = counts.get(key) || { name: entity.name, count: 0, items: new Set(), byYear: new Map(), roles: new Set() };
	      const firstInRecord = !current.items.has(String(record.id));
	      current.items.add(String(record.id));
	      current.count = current.items.size;
	      for (const role of entity.roles) current.roles.add(role);
	      if (firstInRecord && record.date) current.byYear.set(record.date.year, (current.byYear.get(record.date.year) || 0) + 1);
	      counts.set(key, current);
	      if (!graph.has(key)) graph.set(key, { name: entity.name, count: 0, roles: new Set(), neighbors: new Map() });
	      graph.get(key).count = current.count;
	      for (const role of entity.roles) graph.get(key).roles.add(role);
	    }

	    const addLink = (map, a, b) => {
	      if (a === b) return
	      const [source, target] = [a, b].sort();
	      const pair = `${source}\u0000${target}`;
	      const link = map.get(pair) || { source, target, weight: 0 };
	      link.weight += 1;
	      map.set(pair, link);
	    };
	    const sourceLinks = new Map();
	    for (let i = 0; i < normalized.length; i += 1) {
	      for (let j = i + 1; j < normalized.length; j += 1) {
	        addLink(sourceLinks, normalized[i][0], normalized[j][0]);
	      }
	    }
	    for (const link of sourceLinks.values()) {
	      addLink(annualLinks, link.source, link.target);
	      graph.get(link.source)?.neighbors.set(link.target, (graph.get(link.source)?.neighbors.get(link.target) || 0) + link.weight);
	      graph.get(link.target)?.neighbors.set(link.source, (graph.get(link.target)?.neighbors.get(link.source) || 0) + link.weight);
	    }

	  }

	  const entities = [...counts.values()].map(entity => ({
	    ...entity,
	    items: [...entity.items],
	    roles: [...entity.roles],
	    byYear: [...entity.byYear].map(([year, count]) => ({ year, count }))
	  }))
	    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, options.locale));
	  const topKeys = new Set(entities.slice(0, 24).map(entity => normalize(entity.name)));
	  const nodes = [...graph].filter(([key]) => topKeys.has(key)).map(([id, node]) => ({
	    id, name: node.name, count: node.count, roles: [...node.roles],
	    neighbors: [...node.neighbors].filter(([key]) => topKeys.has(key)).map(([target, weight]) => ({ target, weight }))
	  }));
	  const networkLinks = [...annualLinks.values()].filter(link => topKeys.has(link.source) && topKeys.has(link.target));

	  for (const node of nodes) {
	    node.neighbors = networkLinks.filter(link => link.source === node.id || link.target === node.id)
	      .map(link => ({ target: link.source === node.id ? link.target : link.source, weight: link.weight }));
	  }

	  return { ...data, records, entityFields: fields, entities, nodes, networkLinks }
	}

	function buildFacetCounts(records, fieldId) {
	  const counts = new Map();
	  for (const record of records || []) {
	    const values = splitEntities(record.metadata?.[fieldId]);
	    for (const value of values) {
	      const key = normalize(value);
	      if (!key) continue
	      const entry = counts.get(key) || { name: value, count: 0, items: new Set() };
	      entry.items.add(String(record.id));
	      entry.count = entry.items.size;
	      counts.set(key, entry);
	    }
	  }
	  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
	}

	analyticsCore = {
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
	};
	return analyticsCore;
}

var nativeNavigation;
var hasRequiredNativeNavigation;

function requireNativeNavigation () {
	if (hasRequiredNativeNavigation) return nativeNavigation;
	hasRequiredNativeNavigation = 1;
	const core = requireAnalyticsCore();

	nativeNavigation = function nativeNavigation(settings, state) {
	  const limitations = [];
	  const raw = String(settings.search || '').trim();
	  // Analytics searches literal text. Quote punctuation/FTS operators rather
	  // than accidentally interpreting a person's name as a query expression.
	  let query = /[^\p{L}\p{N}\s]|\b(?:AND|OR|NOT|NEAR)\b/u.test(raw)
	    ? `"${raw.replace(/"/g, '""')}"` : raw;
	  const listId = settings.listId;
	  const list = listId == null || listId === '' ? null : state.lists?.[listId]?.id ?? listId;
	  if (list != null && settings.includeDescendants && (state.lists?.[listId]?.children || []).length) limitations.push('nativeNested');
	  let tags = (settings.includeTags || []).map(id => state.tags?.[id]?.id ?? id);
	  if (settings.tagMode === 'any' && tags.length > 1) {
	    tags = []; // Native Tropy combines selected tags with AND, not OR.
	    limitations.push('nativeAnyTags');
	  }
	  if (settings.excludeTags?.length) limitations.push('nativeExcludedTags');
	  if (settings.conditions?.length) limitations.push('nativeConditions');
	  const from = core.parseDate(settings.from, settings.dateOrder);
	  const to = core.parseDate(settings.to, settings.dateOrder);
	  if (settings.from || settings.to) {
	    const year = from?.year === to?.year ? from?.year : null;
	    if (!query && year != null && !settings.showUndated && !String(settings.dateField).startsWith('__')) {
	      query = String(year);
	      limitations.push('nativeYearText');
	    } else limitations.push('nativeDates');
	  }
	  return {
	    action: {
	      type: 'nav.select',
	      payload: { mode: 'project', list, tags, query, trash: null, imports: null },
	      meta: { search: true }
	    },
	    limitations
	  }
	};
	return nativeNavigation;
}

var graphLayout;
var hasRequiredGraphLayout;

function requireGraphLayout () {
	if (hasRequiredGraphLayout) return graphLayout;
	hasRequiredGraphLayout = 1;

	// Deterministic multistart layout: source counts control centrality, while
	// optimization balances label clearance, node spacing and edge crossings.
	graphLayout = function untangleNetworkPositions(nodes, links, width, height, radiusFor) {
	  height = Math.max(640, height);
	  const result = new Map();
	  result.height = height;
	  if (!nodes.length) return result
	  const ranked = nodes.slice().sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.id).localeCompare(String(b.id)));
	  const n = ranked.length, index = new Map(ranked.map((node, i) => [node.id, i]));
	  const seen = new Set();
	  const edges = links.flatMap(link => {
	    const a = index.get(link.source), b = index.get(link.target);
	    if (a == null || b == null || a === b) return []
	    const key = [a, b].sort((x, y) => x - y).join(':');
	    if (seen.has(key)) return []
	    seen.add(key);
	    return [{ a, b, weight: Number(link.weight) || 1 }]
	  });
	  const edgePairs = [];
	  for (let i = 0; i < edges.length; i += 1) for (let j = i + 1; j < edges.length; j += 1) {
	    const e = edges[i], f = edges[j];
	    if (e.a !== f.a && e.a !== f.b && e.b !== f.a && e.b !== f.b) edgePairs.push([e.a, e.b, f.a, f.b]);
	  }
	  const cx = width / 2, cy = height / 2 - 12;
	  const rx = width / 2 - 80, ry = height / 2 - 72;
	  const radii = ranked.map(node => Math.max(13, radiusFor(node)));
	  const targets = ranked.map((_, i) => i === 0 ? 0 : .32 + .66 * Math.sqrt((i - 1) / Math.max(1, n - 2)));
	  const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
	  const score = points => {
	    let cost = 0;
	    for (let i = 0; i < n; i += 1) {
	      const a = points[i];
	      const radial = Math.hypot((a.x - cx) / rx, (a.y - cy) / ry);
	      cost += 100 * (radial - targets[i]) ** 2;
	      for (let j = i + 1; j < n; j += 1) {
	        const b = points[j], dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
	        const d = Math.hypot(dx, dy);
	        // Central nodes receive extra breathing room. Boxes include labels.
	        const clearance = radii[i] + radii[j] + (i < 3 ? 60 : 40);
	        cost += 16 * (100 / Math.max(1, d)) ** 2;
	        cost += 1500 * Math.max(0, 1 - d / clearance) ** 2;
	        const boxHeight = Math.max(radii[i], radii[j]) * 2 + 38;
	        if (dx < 112 && dy < boxHeight) cost += 3000 * Math.min(1 - dx / 112, 1 - dy / boxHeight) ** 2;
	      }
	    }
	    for (const e of edges) {
	      const a = points[e.a], b = points[e.b], dx = b.x - a.x, dy = b.y - a.y;
	      const length2 = dx * dx + dy * dy;
	      cost += .2 * Math.sqrt(length2) / 100;
	      for (let i = 0; i < n; i += 1) {
	        if (i === e.a || i === e.b) continue
	        const p = points[i], t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length2 || 1);
	        if (t <= 0 || t >= 1) continue
	        const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
	        cost += 60 * Math.max(0, 1 - d / (radii[i] + 8)) ** 2;
	      }
	    }
	    for (const [a, b, c, d] of edgePairs) {
	      if (orient(points[a], points[b], points[c]) * orient(points[a], points[b], points[d]) < 0 &&
	          orient(points[c], points[d], points[a]) * orient(points[c], points[d], points[b]) < 0) cost += 35;
	    }
	    return cost
	  };
	  let seed = 72391;
	  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 };
	  let bestCost = Infinity, best;
	  // Dense networks have inherently unavoidable crossings; cap the work budget.
	  const steps = edges.length > 100 ? 1000 : 2200;
	  for (let trial = 0; trial < 3; trial += 1) {
	    const points = ranked.map((_, i) => {
	      const angle = i * 2.399963229728653 + trial * .7;
	      return { x: cx + rx * targets[i] * Math.cos(angle), y: cy + ry * targets[i] * Math.sin(angle) }
	    });
	    let current = score(points);
	    if (current < bestCost) { bestCost = current; best = points.map(p => ({ ...p })); }
	    for (let step = 0; step < steps && n > 1; step += 1) {
	      const i = 1 + Math.floor(random() * (n - 1)), old = points[i];
	      const progress = step / steps, angle = Math.atan2((old.y - cy) / ry, (old.x - cx) / rx);
	      const nextAngle = angle + (random() - .5) * (1.4 * (1 - progress) + .12);
	      const radial = Math.max(.15, Math.min(1, targets[i] + (random() - .5) * .26));
	      points[i] = { x: cx + rx * radial * Math.cos(nextAngle), y: cy + ry * radial * Math.sin(nextAngle) };
	      let swappedIndex = null, swappedOld = null;
	      if (n > 2 && random() < .2) {
	        const j = 1 + Math.floor(random() * (n - 1));
	        if (j !== i) {
	          swappedIndex = j; swappedOld = points[j];
	          const otherAngle = Math.atan2((swappedOld.y - cy) / ry, (swappedOld.x - cx) / rx);
	          const otherRadial = Math.hypot((swappedOld.x - cx) / rx, (swappedOld.y - cy) / ry);
	          const oldRadial = Math.hypot((old.x - cx) / rx, (old.y - cy) / ry);
	          points[i] = { x: cx + rx * oldRadial * Math.cos(otherAngle), y: cy + ry * oldRadial * Math.sin(otherAngle) };
	          points[j] = { x: cx + rx * otherRadial * Math.cos(angle), y: cy + ry * otherRadial * Math.sin(angle) };
	        }
	      }
	      const candidate = score(points), temperature = 9 * (1 - progress) ** 2 + .02;
	      if (candidate < current || random() < Math.exp((current - candidate) / temperature)) current = candidate;
	      else { points[i] = old; if (swappedIndex != null) points[swappedIndex] = swappedOld; }
	      if (current < bestCost) { bestCost = current; best = points.map(p => ({ ...p })); }
	    }
	  }
	  // Final separation handles the last few pixels of label/circle collisions.
	  for (let pass = 0; pass < 100; pass += 1) {
	    let changed = false;
	    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
	      const a = best[i], b = best[j], dx = b.x - a.x, dy = b.y - a.y;
	      const hx = 114 - Math.abs(dx), hy = Math.max(radii[i], radii[j]) * 2 + 40 - Math.abs(dy);
	      if (hx <= 0 || hy <= 0) continue
	      const axis = hx < hy ? 'x' : 'y', delta = (axis === 'x' ? hx : hy) + .5;
	      const sign = (axis === 'x' ? dx : dy) >= 0 ? 1 : -1;
	      b[axis] += sign * delta * (i === 0 ? 1 : .5);
	      if (i !== 0) a[axis] -= sign * delta * .5;
	      changed = true;
	    }
	    for (let i = 1; i < n; i += 1) {
	      best[i].x = Math.max(65, Math.min(width - 65, best[i].x));
	      best[i].y = Math.max(45, Math.min(height - 65, best[i].y));
	    }
	    if (!changed) break
	  }
	  ranked.forEach((node, i) => result.set(node.id, best[i]));
	  return result
	};
	return graphLayout;
}

var i18n;
var hasRequiredI18n;

function requireI18n () {
	if (hasRequiredI18n) return i18n;
	hasRequiredI18n = 1;

	const en = {
	  openInLibrary: "Open in Tropy", recognizedPeople: "Recognized people", nativeTransferHelp: "Open the library with the supported list, search and required tags. Results may differ from Analytics.", nativeNested: "Nested lists are not included in Tropy’s list filter.", nativeAnyTags: "Multiple tags in “Match any” mode cannot be transferred.", nativeExcludedTags: "Excluded tags are not transferred.", nativeConditions: "Additional conditions are not transferred.", nativeYearText: "The year is searched as text, not as a date field filter.", nativeDates: "The date range is not transferred.",
	  analytics: 'Analytics', openAnalytics: 'Open analytics', close: 'Close', filters: 'Filters',
	  hideFilters: 'Hide filters', showFilters: 'Show filters', reset: 'Reset', dateField: 'Date field',
	  titleField: 'Title field', list: 'List / folder', allProject: 'Entire project',
	  includeSublists: 'Include nested lists', dateRange: 'Date range', from: 'From', to: 'To',
	  search: 'Search sources', searchPlaceholder: 'Title, metadata, tag, or list…', tags: 'Tags',
	  tagsHelp: 'Click a tag to require it; click again to exclude it.', includeTag: 'Required',
	  excludeTag: 'Excluded', tagMode: 'Required tags', allTags: 'Match all', anyTag: 'Match any',
	  conditions: 'Additional conditions',
	  conditionsHelp: 'Inclusion conditions are combined below; any matching exclusion removes a document.',
	  addCondition: 'Add condition', include: 'Include', exclude: 'Exclude', matchConditions: 'Inclusion rules',
	  matchAll: 'Match all', matchAny: 'Match any', field: 'Field', operator: 'Operator', value: 'Value',
	  removeCondition: 'Remove condition', contains: 'contains', notContains: 'does not contain', equals: 'equals',
	  notEquals: 'does not equal', startsWith: 'starts with', endsWith: 'ends with', exists: 'exists',
	  notExists: 'is empty', before: 'is before', after: 'is after', onOrBefore: 'is on or before',
	  onOrAfter: 'is on or after', matches: 'matches regex', allMetadata: 'All metadata',
	  itemTitle: 'Selected title', itemDate: 'Selected date', created: 'Date added', modified: 'Date modified',
	  itemTags: 'Tags', itemLists: 'Lists / folders', order: 'Order', ascending: 'Oldest first',
	  descending: 'Newest first', groupBy: 'Group by', years: 'Year', months: 'Month', days: 'Day',
	  density: 'Density', comfortable: 'Comfortable', compact: 'Compact', condensed: 'Condensed',
	  showUndated: 'Include sources without dates in statistics', results: '{count} documents', resultOne: '1 document',
	  scopeCount: '{count} in scope', range: '{start}–{end}', noResults: 'No documents match these filters.',
	  noResultsHint: 'Change the list, tags, date range, or additional conditions.',
	  undated: 'Without a recognizable date', undatedCount: '{count} undated', includedUndatedCount: 'including {count} without a date', untitled: 'Untitled document',
	  openDocument: 'Open document in Tropy', backToAnalytics: 'Back to analytics', clearSearch: 'Clear search',
	  collapsePeriod: 'Collapse period', expandPeriod: 'Expand period', previousPeriod: 'Previous period',
	  nextPeriod: 'Next period', datesNotFound: 'Choose a metadata field containing document dates.',
	  invalidProject: 'Open a Tropy project before using Analytics.', liveUpdate: 'Analytics updated',
	  dateOrder: 'Numeric date order', dmy: 'Day / month / year', mdy: 'Month / day / year',
	  entityFields: 'People fields', entityFieldsHelp: 'Choose which detected or mapped fields to count as people. Use Additional people above to add a custom field.',
	  includedInCharts: 'Included in charts', excludedFromCharts: 'Excluded from charts', noPeopleFields: 'No people fields selected', mapPeopleFieldsFirst: 'Choose creator, audience, or an additional people field above.', populatedSources: '{count} sources with values',
	  chartSettings: 'Field associations', chartSettingsSummary: 'Configure chart properties', chartSettingsHelp: 'Choose the Tropy property for each chart. The number in parentheses shows how many sources contain a value. Automatic uses detected fields.', chartsToShow: 'Charts to display',
	  automatic: 'Automatic', autoDetect: 'Automatic detection', autoDetectPeople: 'Automatic: include recognized person fields', notUsed: 'Do not use an additional field',
	  creator: 'Creator', audience: 'Audience / recipient', creatorField: "Author", creatorFieldHelp: 'Select the field where you record the source creator or author.',
	  audienceField: "Recipient", audienceFieldHelp: 'Select the field where you record recipients, addressees, or audience.',
	  additionalPersonField: "Additional people", additionalPersonFieldHelp: 'Optional: include another field containing people’s names.',
	  placeField: "Place", placeFieldHelp: 'Select the field containing places. Automatic detection can use location or coverage fields.',
	  sourceTypeField: "Source type", sourceTypeFieldHelp: 'Select the field containing document types or genres.',
	  timeWindow: 'Time window', documents: 'Documents', matchingDocuments: 'Matching current filters',
	  creators: 'People', uniqueEntities: 'Distinct names in selected fields', datedShare: 'Dated records', recordsWithDates: 'Share with a recognized date',
	  recordsOverTime: 'Sources over time', clickYear: 'Select a year to focus the dashboard', topEntities: 'Most frequent people',
	  clickToSearch: 'Select a name to filter sources', filterEntity: 'Filter sources mentioning {name}', noEntities: 'No people to chart',
	  chooseEntityFields: 'Map creator or recipient fields above, or select a detected people field below.', entityNetwork: 'People appearing together',
	  cooccurrenceHelp: 'Drag a point to arrange the graph; select a person to filter sources. Thicker lines indicate more shared sources.', noConnections: 'No shared appearances',
	  chartShown: 'Shown', chartHidden: 'Hidden',
	  connectionHint: 'Map creator/author and recipient/audience fields above. Undated sources are included in these statistics.', clearRange: 'Clear range',
	  sourceTypes: 'Source types', places: 'Places', collections: 'Collections', folderDistribution: 'Sources by collection',
	  noCategoryData: 'No values in this field', noCollections: 'No collection data', peopleCreator: 'Creators', peopleAudience: 'Audience and recipients',
	  sharedSources: '{count} shared sources', people: 'People',
	  untangleNetwork: 'Untangle graph', untangleHelp: 'Separate groups and reduce crossings. Click again to restore the previous layout.', nodeSizeHelp: 'Circle area is proportional to the number of sources.', sourceCountLabel: 'source', sourcesCountLabel: 'sources', uniformNodes: 'Same-size nodes', uniformLinks: 'Same-width lines', uniformNodesHelp: 'Show every node at the same size.', uniformLinksHelp: 'Show every connection at the same line width.',
	};

	const it = {
	  openInLibrary: "Apri in Tropy", recognizedPeople: "Persone riconosciute", nativeTransferHelp: "Apre la libreria con lista, ricerca e tag positivi supportati. I risultati possono differire da Analytics.", nativeNested: "Le sottoliste non sono incluse nel filtro lista di Tropy.", nativeAnyTags: "I tag multipli in modalità “uno qualsiasi” non sono trasferibili.", nativeExcludedTags: "I tag esclusi non vengono trasferiti.", nativeConditions: "Le condizioni aggiuntive non vengono trasferite.", nativeYearText: "L’anno viene cercato come testo, non come filtro sul campo data.", nativeDates: "L’intervallo di date non viene trasferito.",
	  analytics: 'Analisi', openAnalytics: 'Apri le analisi', close: 'Chiudi', filters: 'Filtri',
	  hideFilters: 'Nascondi filtri', showFilters: 'Mostra filtri', reset: 'Azzera', dateField: 'Campo data',
	  titleField: 'Campo titolo', list: 'Lista / cartella', allProject: 'Intero progetto',
	  includeSublists: 'Includi le sottoliste', dateRange: 'Intervallo di date', from: 'Dal', to: 'Al',
	  search: 'Cerca nelle analisi', searchPlaceholder: 'Titolo, metadati, tag o lista…', tags: 'Tag',
	  tagsHelp: 'Clicca un tag per richiederlo; clicca di nuovo per escluderlo.', includeTag: 'Richiesta',
	  excludeTag: 'Esclusa', tagMode: 'Tag richieste', allTags: 'Tutte', anyTag: 'Almeno una',
	  conditions: 'Condizioni aggiuntive',
	  conditionsHelp: 'Le condizioni di inclusione sono combinate come indicato; ogni esclusione corrispondente elimina il documento.',
	  addCondition: 'Aggiungi condizione', include: 'Includi', exclude: 'Escludi',
	  matchConditions: 'Regole di inclusione', matchAll: 'Tutte', matchAny: 'Almeno una', field: 'Campo',
	  operator: 'Operatore', value: 'Valore', removeCondition: 'Rimuovi condizione', contains: 'contiene',
	  notContains: 'non contiene', equals: 'è uguale a', notEquals: 'non è uguale a', startsWith: 'inizia con',
	  endsWith: 'termina con', exists: 'è compilato', notExists: 'è vuoto', before: 'precede', after: 'segue',
	  onOrBefore: 'è precedente o uguale', onOrAfter: 'è successivo o uguale', matches: 'corrisponde alla regex',
	  allMetadata: 'Tutti i metadati', itemTitle: 'Titolo selezionato', itemDate: 'Data selezionata',
	  created: 'Data di inserimento', modified: 'Data di modifica', itemTags: 'Tag', itemLists: 'Liste / cartelle',
	  order: 'Ordinamento', ascending: 'Dalla più antica', descending: 'Dalla più recente',
	  groupBy: 'Raggruppa per', years: 'Anno', months: 'Mese', days: 'Giorno', density: 'Densità',
	  comfortable: 'Comoda', compact: 'Compatta', condensed: 'Densa', showUndated: 'Includi nelle statistiche le fonti senza data',
	  results: '{count} documenti', resultOne: '1 documento', scopeCount: '{count} nell’ambito scelto',
	  range: '{start}–{end}', noResults: 'Nessun documento corrisponde a questi filtri.',
	  noResultsHint: 'Modifica lista, tag, intervallo o condizioni aggiuntive.',
	  undated: 'Senza una data riconoscibile', undatedCount: '{count} senza data', includedUndatedCount: 'di cui {count} senza data',
	  untitled: 'Documento senza titolo', openDocument: 'Apri il documento in Tropy',
	  backToAnalytics: 'Torna alla analytics', clearSearch: 'Cancella la ricerca',
	  collapsePeriod: 'Comprimi periodo', expandPeriod: 'Espandi periodo',
	  previousPeriod: 'Periodo precedente', nextPeriod: 'Periodo successivo',
	  datesNotFound: 'Scegli il campo dei metadati che contiene le date dei documenti.',
	  invalidProject: 'Apri un progetto Tropy prima di usare Analytics.', liveUpdate: 'Analytics aggiornata',
	  dateOrder: 'Ordine delle date numeriche', dmy: 'Giorno / mese / anno', mdy: 'Mese / giorno / anno',
	  entityFields: 'Campi delle persone', entityFieldsHelp: 'Scegli quali campi rilevati o associati contare come persone. Usa “Campo aggiuntivo per le persone” sopra per aggiungere un campo personalizzato.',
	  includedInCharts: 'Incluso nei grafici', excludedFromCharts: 'Escluso dai grafici', noPeopleFields: 'Nessun campo persona selezionato', mapPeopleFieldsFirst: 'Scegli sopra i campi creatore, destinatario o un campo aggiuntivo per le persone.', populatedSources: '{count} fonti con valori',
	  chartSettings: 'Associa i campi', chartSettingsSummary: 'Configura le proprietà dei grafici', chartSettingsHelp: 'Associa ogni grafico a una proprietà Tropy. Il numero tra parentesi indica quante fonti contengono un valore. Automatico usa i campi riconosciuti.', chartsToShow: 'Grafici da visualizzare',
	  automatic: 'Automatico', autoDetect: 'Rilevamento automatico', autoDetectPeople: 'Automatico: includi i campi riconosciuti come persone', notUsed: 'Non usare un campo aggiuntivo',
	  creator: 'Creatore', audience: 'Destinatario / audience', creatorField: "Autore", creatorFieldHelp: 'Scegli il campo in cui registri il creatore o l’autore della fonte.',
	  audienceField: "Destinatario", audienceFieldHelp: 'Scegli il campo in cui registri destinatari, corrispondenti o audience.',
	  additionalPersonField: "Persone aggiuntive", additionalPersonFieldHelp: 'Facoltativo: includi un altro campo che contiene nomi di persone.',
	  placeField: "Luogo", placeFieldHelp: 'Scegli il campo che contiene luoghi. Il rilevamento automatico usa campi come luogo o copertura.',
	  sourceTypeField: "Tipo di fonte", sourceTypeFieldHelp: 'Scegli il campo che contiene i tipi o i generi documentari.',
	  timeWindow: 'Intervallo temporale', documents: 'Fonti', matchingDocuments: 'Corrispondenti ai filtri', creators: 'Persone',
	  uniqueEntities: 'Nominativi distinti nei campi scelti', datedShare: 'Fonti datate', recordsWithDates: 'Quota con data riconosciuta',
	  recordsOverTime: 'Fonti nel tempo', clickYear: 'Seleziona un anno per restringere l’analisi', topEntities: 'Persone più ricorrenti',
	  clickToSearch: 'Seleziona un nome per filtrare le fonti', filterEntity: 'Filtra le fonti che menzionano {name}', noEntities: 'Nessuna persona da visualizzare',
	  chooseEntityFields: 'Associa sopra i campi creatore o destinatario, oppure seleziona qui un campo rilevato come persona.', entityNetwork: 'Persone presenti insieme',
	  cooccurrenceHelp: 'Trascina un punto per riordinare il grafo; seleziona una persona per filtrare le fonti. Le linee più spesse indicano più fonti condivise.', noConnections: 'Nessuna presenza condivisa',
	  chartShown: 'Visibile', chartHidden: 'Nascosto',
	  connectionHint: 'Associa sopra i campi creatore/autore e destinatario/audience. Le fonti senza data sono incluse in queste statistiche.', clearRange: 'Azzera intervallo',
	  sourceTypes: 'Tipi di fonte', places: 'Luoghi', collections: 'Collezioni', folderDistribution: 'Fonti per collezione',
	  noCategoryData: 'Nessun valore in questo campo', noCollections: 'Nessun dato sulle collezioni', peopleCreator: 'Creatori', peopleAudience: 'Destinatari e audience',
	  sharedSources: '{count} fonti condivise', people: 'Persone',
	  untangleNetwork: 'Districa il grafo', untangleHelp: 'Separa i gruppi e riduce gli incroci. Clicca di nuovo per ripristinare la disposizione precedente.', nodeSizeHelp: 'L’area dei cerchi è proporzionale al numero di fonti.', sourceCountLabel: 'fonte', sourcesCountLabel: 'fonti', uniformNodes: 'Nodi uguali', uniformLinks: 'Linee uguali', uniformNodesHelp: 'Mostra tutti i nodi con la stessa dimensione.', uniformLinksHelp: 'Mostra tutti i collegamenti con lo stesso spessore.',
	};

	const fr = {
	  openInLibrary: "Ouvrir dans Tropy", recognizedPeople: "Personnes reconnues", nativeTransferHelp: "Ouvre la bibliothèque avec la liste, la recherche et les tags requis pris en charge. Les résultats peuvent différer d’Analytics.", nativeNested: "Les sous-listes ne sont pas incluses dans le filtre de Tropy.", nativeAnyTags: "Plusieurs tags en mode « au moins un » ne peuvent pas être transférés.", nativeExcludedTags: "Les tags exclus ne sont pas transférés.", nativeConditions: "Les conditions supplémentaires ne sont pas transférées.", nativeYearText: "L’année est recherchée comme texte et non comme filtre de date.", nativeDates: "La plage de dates n’est pas transférée.",
	  analytics: 'Analyses', openAnalytics: 'Ouvrir les analyses', close: 'Fermer', filters: 'Filtres',
	  hideFilters: 'Masquer les filtres', showFilters: 'Afficher les filtres', reset: 'Réinitialiser',
	  dateField: 'Champ de date', titleField: 'Champ de titre', list: 'Liste / dossier', allProject: 'Projet entier',
	  includeSublists: 'Inclure les sous-listes', dateRange: 'Intervalle de dates', from: 'Du', to: 'Au',
	  search: 'Rechercher dans les sources', searchPlaceholder: 'Titre, métadonnées, tag ou liste…',
	  tags: 'Tags', tagsHelp: 'Cliquez pour exiger un tag ; cliquez à nouveau pour l’exclure.',
	  includeTag: 'Requis', excludeTag: 'Exclu', tagMode: 'Tags requis', allTags: 'Tous', anyTag: 'Au moins un',
	  conditions: 'Conditions supplémentaires',
	  conditionsHelp: 'Les inclusions sont combinées ; toute exclusion correspondante retire le document.',
	  addCondition: 'Ajouter une condition', include: 'Inclure', exclude: 'Exclure',
	  matchConditions: 'Règles d’inclusion', matchAll: 'Toutes', matchAny: 'Au moins une', field: 'Champ',
	  operator: 'Opérateur', value: 'Valeur', removeCondition: 'Supprimer la condition', contains: 'contient',
	  notContains: 'ne contient pas', equals: 'est égal à', notEquals: 'n’est pas égal à',
	  startsWith: 'commence par', endsWith: 'se termine par', exists: 'est renseigné', notExists: 'est vide',
	  before: 'est antérieur à', after: 'est postérieur à', onOrBefore: 'est antérieur ou égal à',
	  onOrAfter: 'est postérieur ou égal à', matches: 'correspond à la regex', allMetadata: 'Toutes les métadonnées',
	  itemTitle: 'Titre sélectionné', itemDate: 'Date sélectionnée', created: 'Date d’ajout',
	  modified: 'Date de modification', itemTags: 'Tags', itemLists: 'Listes / dossiers', order: 'Ordre',
	  ascending: 'Plus anciens d’abord', descending: 'Plus récents d’abord', groupBy: 'Regrouper par',
	  years: 'Année', months: 'Mois', days: 'Jour', density: 'Densité', comfortable: 'Confortable',
	  compact: 'Compacte', condensed: 'Dense', showUndated: 'Inclure les sources sans date dans les statistiques', results: '{count} documents',
	  resultOne: '1 document', scopeCount: '{count} dans le périmètre', range: '{start}–{end}',
	  noResults: 'Aucun document ne correspond à ces filtres.',
	  noResultsHint: 'Modifiez la liste, les tags, les dates ou les conditions.',
	  undated: 'Sans date reconnaissable', undatedCount: '{count} non datés', includedUndatedCount: 'dont {count} sans date', untitled: 'Document sans titre',
	  openDocument: 'Ouvrir le document dans Tropy', backToAnalytics: 'Retour aux analyses',
	  clearSearch: 'Effacer la recherche', collapsePeriod: 'Réduire la période',
	  expandPeriod: 'Développer la période', previousPeriod: 'Période précédente', nextPeriod: 'Période suivante',
	  datesNotFound: 'Choisissez le champ de métadonnées contenant les dates.',
	  invalidProject: 'Ouvrez un projet Tropy avant d’utiliser Analytics.', liveUpdate: 'Analyses mises à jour',
	  dateOrder: 'Ordre des dates numériques', dmy: 'Jour / mois / année', mdy: 'Mois / jour / année',
	  entityFields: 'Champs des personnes', entityFieldsHelp: 'Choisissez les champs utilisés pour identifier les personnes.', timeWindow: 'Période',
	  includedInCharts: 'Inclus dans les graphiques', excludedFromCharts: 'Exclu des graphiques', noPeopleFields: 'Aucun champ de personne sélectionné', mapPeopleFieldsFirst: 'Choisissez ci-dessus les champs créateur, destinataire ou personne supplémentaire.', populatedSources: '{count} sources renseignées',
	  chartSettings: 'Configuration des graphiques', chartSettingsHelp: 'Associez chaque graphique à une propriété Tropy. Le nombre entre parenthèses indique les sources renseignées. Le mode automatique utilise les champs reconnus.',
	  automatic: 'Automatique', autoDetect: 'Détection automatique', autoDetectPeople: 'Automatique : inclure les champs de personnes reconnus', notUsed: 'Ne pas utiliser de champ supplémentaire',
	  creator: 'Créateur', audience: 'Destinataire / public', creatorField: "Auteur", creatorFieldHelp: 'Choisissez le champ qui contient le créateur ou l’auteur de la source.',
	  audienceField: "Destinataire", audienceFieldHelp: 'Choisissez le champ qui contient les destinataires ou le public.', additionalPersonField: "Personnes supplémentaires", additionalPersonFieldHelp: 'Facultatif : inclure un autre champ contenant des noms de personnes.',
	  placeField: "Lieu", placeFieldHelp: 'Choisissez le champ contenant les lieux. La détection automatique utilise les champs de lieu ou de couverture.', sourceTypeField: "Type de source", sourceTypeFieldHelp: 'Choisissez le champ contenant les types ou genres de documents.',
	  documents: 'Sources', matchingDocuments: 'Correspondant aux filtres', creators: 'Personnes', uniqueEntities: 'Noms distincts', datedShare: 'Sources datées', recordsWithDates: 'Part avec une date reconnue',
	  recordsOverTime: 'Sources au fil du temps', clickYear: 'Sélectionnez une année pour filtrer', topEntities: 'Personnes les plus fréquentes', clickToSearch: 'Sélectionnez un nom pour filtrer',
	  filterEntity: 'Filtrer les sources mentionnant {name}', noEntities: 'Aucune personne à afficher', chooseEntityFields: 'Choisissez des champs comme créateur ou destinataire.',
	  entityNetwork: 'Personnes apparaissant ensemble', cooccurrenceHelp: 'Faites glisser un point pour réorganiser le graphe ; sélectionnez une personne pour filtrer.', noConnections: 'Aucune cooccurrence', connectionHint: 'Sélectionnez créateur et destinataire pour construire le graphe.', clearRange: 'Effacer la période', chartShown: 'Visible', chartHidden: 'Masqué', chartSettings: 'Associer les champs', chartSettingsSummary: 'Configurer les propriétés', chartsToShow: 'Graphiques à afficher', untangleNetwork: 'Démêler le graphe', untangleHelp: 'Sépare les groupes et réduit les croisements. Cliquez à nouveau pour rétablir la disposition précédente.', nodeSizeHelp: 'La surface des cercles est proportionnelle aux sources.', sourceCountLabel: 'source', sourcesCountLabel: 'sources', uniformNodes: 'Nœuds égaux', uniformLinks: 'Liens égaux', uniformNodesHelp: 'Afficher tous les nœuds de la même taille.', uniformLinksHelp: 'Afficher tous les liens avec la même épaisseur.',
	  sourceTypes: 'Types de sources', places: 'Lieux', collections: 'Collections', folderDistribution: 'Sources par collection', noCategoryData: 'Aucune valeur dans ce champ', noCollections: 'Aucune donnée de collection', peopleCreator: 'Créateurs', peopleAudience: 'Public et destinataires', sharedSources: '{count} sources partagées', people: 'Personnes'
	};

	const es = {
	  openInLibrary: "Abrir en Tropy", recognizedPeople: "Personas reconocidas", nativeTransferHelp: "Abre la biblioteca con la lista, búsqueda y etiquetas requeridas compatibles. Los resultados pueden diferir de Analytics.", nativeNested: "Las sublistas no se incluyen en el filtro de Tropy.", nativeAnyTags: "No se pueden transferir varias etiquetas en modo «cualquiera».", nativeExcludedTags: "Las etiquetas excluidas no se transfieren.", nativeConditions: "Las condiciones adicionales no se transfieren.", nativeYearText: "El año se busca como texto, no como filtro de fecha.", nativeDates: "El intervalo de fechas no se transfiere.",
	  analytics: 'Análisis', openAnalytics: 'Abrir análisis', close: 'Cerrar', filters: 'Filtros',
	  hideFilters: 'Ocultar filtros', showFilters: 'Mostrar filtros', reset: 'Restablecer', dateField: 'Campo de fecha',
	  titleField: 'Campo de título', list: 'Lista / carpeta', allProject: 'Proyecto completo',
	  includeSublists: 'Incluir sublistas', dateRange: 'Intervalo de fechas', from: 'Desde', to: 'Hasta',
	  search: 'Buscar en las fuentes', searchPlaceholder: 'Título, metadatos, etiqueta o lista…',
	  tags: 'Etiquetas', tagsHelp: 'Haz clic para exigir una etiqueta; vuelve a hacer clic para excluirla.',
	  includeTag: 'Requerida', excludeTag: 'Excluida', tagMode: 'Etiquetas requeridas', allTags: 'Todas',
	  anyTag: 'Al menos una', conditions: 'Condiciones adicionales',
	  conditionsHelp: 'Las inclusiones se combinan; cualquier exclusión coincidente elimina el documento.',
	  addCondition: 'Añadir condición', include: 'Incluir', exclude: 'Excluir', matchConditions: 'Reglas de inclusión',
	  matchAll: 'Todas', matchAny: 'Al menos una', field: 'Campo', operator: 'Operador', value: 'Valor',
	  removeCondition: 'Eliminar condición', contains: 'contiene', notContains: 'no contiene', equals: 'es igual a',
	  notEquals: 'no es igual a', startsWith: 'empieza por', endsWith: 'termina en', exists: 'tiene valor',
	  notExists: 'está vacío', before: 'es anterior a', after: 'es posterior a',
	  onOrBefore: 'es anterior o igual a', onOrAfter: 'es posterior o igual a', matches: 'coincide con regex',
	  allMetadata: 'Todos los metadatos', itemTitle: 'Título seleccionado', itemDate: 'Fecha seleccionada',
	  created: 'Fecha de incorporación', modified: 'Fecha de modificación', itemTags: 'Etiquetas',
	  itemLists: 'Listas / carpetas', order: 'Orden', ascending: 'Más antiguos primero',
	  descending: 'Más recientes primero', groupBy: 'Agrupar por', years: 'Año', months: 'Mes', days: 'Día',
	  density: 'Densidad', comfortable: 'Cómoda', compact: 'Compacta', condensed: 'Densa',
	  showUndated: 'Incluir fuentes sin fecha en las estadísticas', results: '{count} documentos', resultOne: '1 documento',
	  scopeCount: '{count} en el ámbito', range: '{start}–{end}', noResults: 'Ningún documento coincide con estos filtros.',
	  noResultsHint: 'Cambia la lista, las etiquetas, las fechas o las condiciones.', undated: 'Sin fecha reconocible',
	  undatedCount: '{count} sin fecha', includedUndatedCount: 'incluidas {count} sin fecha', untitled: 'Documento sin título', openDocument: 'Abrir el documento en Tropy',
	  backToAnalytics: 'Volver al análisis', clearSearch: 'Borrar búsqueda',
	  collapsePeriod: 'Contraer periodo', expandPeriod: 'Expandir periodo',
	  previousPeriod: 'Periodo anterior', nextPeriod: 'Periodo siguiente',
	  datesNotFound: 'Elige el campo de metadatos que contiene las fechas.',
	  invalidProject: 'Abre un proyecto Tropy antes de usar Análisis.', liveUpdate: 'Análisis actualizado',
	  dateOrder: 'Orden de fechas numéricas', dmy: 'Día / mes / año', mdy: 'Mes / día / año',
	  entityFields: 'Campos de personas', entityFieldsHelp: 'Elige los campos para identificar personas en los gráficos.', timeWindow: 'Intervalo temporal',
	  includedInCharts: 'Incluido en los gráficos', excludedFromCharts: 'Excluido de los gráficos', noPeopleFields: 'No hay campos de personas seleccionados', mapPeopleFieldsFirst: 'Elige arriba los campos de creador, destinatario o personas adicionales.', populatedSources: '{count} fuentes con valores',
	  chartSettings: 'Configuración de gráficos', chartSettingsHelp: 'Asocia cada gráfico a una propiedad de Tropy. El número entre paréntesis indica las fuentes con un valor. El modo automático usa los campos reconocidos.',
	  automatic: 'Automático', autoDetect: 'Detección automática', autoDetectPeople: 'Automático: incluir los campos de personas reconocidos', notUsed: 'No usar un campo adicional',
	  creator: 'Creador', audience: 'Destinatario / público', creatorField: "Autor", creatorFieldHelp: 'Elige el campo donde registras al creador o autor de la fuente.',
	  audienceField: "Destinatario", audienceFieldHelp: 'Elige el campo donde registras destinatarios o público.', additionalPersonField: "Personas adicionales", additionalPersonFieldHelp: 'Opcional: incluye otro campo que contenga nombres de personas.',
	  placeField: "Lugar", placeFieldHelp: 'Elige el campo que contiene lugares. La detección automática usa campos de ubicación o cobertura.', sourceTypeField: "Tipo de fuente", sourceTypeFieldHelp: 'Elige el campo que contiene tipos o géneros documentales.',
	  documents: 'Fuentes', matchingDocuments: 'Coincidentes con los filtros', creators: 'Personas', uniqueEntities: 'Nombres distintos', datedShare: 'Fuentes con fecha', recordsWithDates: 'Porcentaje con fecha reconocida',
	  recordsOverTime: 'Fuentes a lo largo del tiempo', clickYear: 'Selecciona un año para filtrar', topEntities: 'Personas más frecuentes', clickToSearch: 'Selecciona un nombre para filtrar',
	  filterEntity: 'Filtrar fuentes que mencionan {name}', noEntities: 'No hay personas para mostrar', chooseEntityFields: 'Elige campos como creador o destinatario.',
	  entityNetwork: 'Personas que aparecen juntas', cooccurrenceHelp: 'Arrastra un punto para reorganizar el grafo; selecciona una persona para filtrar.', noConnections: 'Sin coincidencias compartidas', connectionHint: 'Selecciona creador y destinatario para crear el grafo.', clearRange: 'Borrar intervalo', chartShown: 'Visible', chartHidden: 'Oculto', chartSettings: 'Asociar campos', chartSettingsSummary: 'Configurar propiedades', chartsToShow: 'Gráficos que mostrar', untangleNetwork: 'Desenredar grafo', untangleHelp: 'Separa los grupos y reduce los cruces. Haz clic de nuevo para restaurar la disposición anterior.', nodeSizeHelp: 'El área de los círculos es proporcional al número de fuentes.', sourceCountLabel: 'fuente', sourcesCountLabel: 'fuentes', uniformNodes: 'Nodos iguales', uniformLinks: 'Líneas iguales', uniformNodesHelp: 'Mostrar todos los nodos del mismo tamaño.', uniformLinksHelp: 'Mostrar todas las conexiones con el mismo grosor.',
	  sourceTypes: 'Tipos de fuente', places: 'Lugares', collections: 'Colecciones', folderDistribution: 'Fuentes por colección', noCategoryData: 'Sin valores en este campo', noCollections: 'Sin datos de colección', peopleCreator: 'Creadores', peopleAudience: 'Público y destinatarios', sharedSources: '{count} fuentes compartidas', people: 'Personas'
	};

	const messages = Object.freeze({ en, it, fr, es });

	function translator(locale = 'en') {
	  const language = String(locale).toLowerCase().split(/[-_]/)[0];
	  const dictionary = messages[language] || en;
	  return (key, values = {}) => {
	    let output = dictionary[key] ?? en[key] ?? key;
	    for (const [name, value] of Object.entries(values)) {
	      output = output.replaceAll(`{${name}}`, String(value));
	    }
	    return output
	  }
	}

	i18n = { messages, translator };
	return i18n;
}

var plugin$1;
var hasRequiredPlugin;

function requirePlugin () {
	if (hasRequiredPlugin) return plugin$1;
	hasRequiredPlugin = 1;

	const { join } = require$$0;
	const { pathToFileURL } = require$$1;
	const core = requireAnalyticsCore();
	const nativeNavigation = requireNativeNavigation();
	const untangleNetworkPositions = requireGraphLayout();
	const { translator } = requireI18n();

	const ICONS = Object.freeze({
	  analytics: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19V5m0 14h18M7 15l4-5 3 2 6-7"/></svg>',
	  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
	  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
	  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V4m0 0h4M5 4l3.2 3.2A7 7 0 1 1 5.6 14"/></svg>',
	  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
	  remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
	  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></svg>',
	  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm2-2v4m10-4v4M3 9h18"/></svg>',
	  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 2h9v11H3z"/></svg>',
	  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>'
	});

	const TAG_COLOR_FALLBACKS = Object.freeze({
	  red: '#f66',
	  orange: '#ff8c19',
	  yellow: '#ffc200',
	  green: '#66bf39',
	  blue: '#5c73e6',
	  purple: '#a6507b',
	  gray: '#999',
	  brown: '#b37459',
	  apricot: '#ebc2a7',
	  'dark-green': '#0f9468',
	  'light-blue': '#4dbeff',
	  lavender: '#a28ae6'
	});

	const OPERATORS = [
	  ['contains', 'contains'],
	  ['not-contains', 'notContains'],
	  ['equals', 'equals'],
	  ['not-equals', 'notEquals'],
	  ['starts-with', 'startsWith'],
	  ['ends-with', 'endsWith'],
	  ['exists', 'exists'],
	  ['not-exists', 'notExists'],
	  ['before', 'before'],
	  ['after', 'after'],
	  ['on-or-before', 'onOrBefore'],
	  ['on-or-after', 'onOrAfter'],
	  ['matches', 'matches']
	];

	const NO_VALUE_OPERATORS = new Set(['exists', 'not-exists']);

	function create(tag, attributes = {}, ...children) {
	  const element = document.createElement(tag);
	  for (const [name, value] of Object.entries(attributes || {})) {
	    if (value == null) continue
	    if (name === 'className') element.className = value;
	    else if (name === 'text') element.textContent = value;
	    else if (name === 'html') element.innerHTML = value;
	    else if (name === 'dataset') Object.assign(element.dataset, value);
	    else if (name === 'style') Object.assign(element.style, value);
	    else if (name === 'checked') element.checked = Boolean(value);
	    else if (name === 'selected') element.selected = Boolean(value);
	    else if (name === 'disabled') element.disabled = Boolean(value);
	    else if (name === 'value') element.value = value;
	    else if (name === 'tabIndex') element.tabIndex = value;
	    else if (name === 'title') element.title = value;
	    else if (name === 'ariaLabel') element.setAttribute('aria-label', value);
	    else if (name === 'role') element.setAttribute('role', value);
	    else if (name === 'type') element.type = value;
	    else if (name.startsWith('on') && typeof value === 'function') {
	      element.addEventListener(name.slice(2).toLowerCase(), value);
	    } else element.setAttribute(name, value);
	  }

	  for (const child of children.flat(Infinity)) {
	    if (child == null || child === false) continue
	    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
	  }
	  return element
	}

	function icon(name, className = '') {
	  return create('span', {
	    className: `ta-icon ${className}`.trim(),
	    html: ICONS[name] || ICONS.analytics,
	    'aria-hidden': 'true'
	  })
	}

	function option(value, label, selected = false) {
	  return create('option', { value, text: label, selected })
	}

	function controlGroup(label, control, hint) {
	  return create('label', { className: 'ta-field' },
	    create('span', { className: 'ta-label', text: label }),
	    control,
	    null
	  )
	}


	function defaultSettings() {
	  return {
	    dateField: null,
	    entityFields: [],
	    peopleFieldsInitialized: false,
	    settingsSchema: 2,
	    fieldMappings: {},
	    facetFields: {},
	    visibleCharts: ['people', 'time', 'types', 'places', 'collections', 'network'],
	    titleField: null,
	    listId: '',
	    includeDescendants: true,
	    includeTags: [],
	    excludeTags: [],
	    tagMode: 'all',
	    from: '',
	    to: '',
	    search: '',
	    conditions: [],
	    conditionMode: 'all',
	    direction: 'asc',
	    granularity: 'month',
	    density: 'comfortable',
	    showUndated: true,
	    filtersOpen: true,
	    collapsedGroups: [],
	    networkPositions: {},
	    chartMappingsOpen: false,
	    networkUniformNodes: false,
	    networkUniformLinks: false,
	    dateOrder: 'DMY'
	  }
	}

	function safeSettings(value) {
	  const base = defaultSettings();
	  if (!value || typeof value !== 'object') return base
	  const settings = { ...base, ...value };
	  if ((value.settingsSchema || 0) < 2) settings.showUndated = true;
	  settings.settingsSchema = 2;
	  settings.entityFields = Array.isArray(value.entityFields) ? value.entityFields : [];
	  settings.fieldMappings = value.fieldMappings && typeof value.fieldMappings === 'object' ? value.fieldMappings : {};
	  settings.facetFields = value.facetFields && typeof value.facetFields === 'object' ? value.facetFields : {};
	  settings.visibleCharts = Array.isArray(value.visibleCharts) ? value.visibleCharts : base.visibleCharts;
	  settings.networkPositions = value.networkPositions && typeof value.networkPositions === 'object' ? value.networkPositions : {};
	  settings.chartMappingsOpen = Boolean(value.chartMappingsOpen);
	  settings.networkUniformNodes = Boolean(value.networkUniformNodes);
	  settings.networkUniformLinks = Boolean(value.networkUniformLinks);
	  settings.includeTags = Array.isArray(value.includeTags) ? value.includeTags : [];
	  settings.excludeTags = Array.isArray(value.excludeTags) ? value.excludeTags : [];
	  settings.collapsedGroups = Array.isArray(value.collapsedGroups)
	    ? value.collapsedGroups.map(String)
	    : [];
	  settings.density = ['comfortable', 'compact', 'condensed'].includes(value.density)
	    ? value.density
	    : base.density;
	  settings.conditions = Array.isArray(value.conditions)
	    ? value.conditions.filter(condition => condition && typeof condition === 'object').map(condition => ({
	      mode: condition.mode === 'exclude' ? 'exclude' : 'include',
	      field: condition.field || core.INTERNAL_FIELDS.ALL,
	      operator: OPERATORS.some(([operator]) => operator === condition.operator) ? condition.operator : 'contains',
	      value: String(condition.value ?? '')
	    }))
	    : [];
	  return settings
	}

	function formatDateParts(parsed, locale, style = 'long') {
	  if (!parsed) return ''
	  if (parsed.precision === 'year') return String(parsed.year)
	  const value = new Date(Date.UTC(2000, parsed.month - 1, parsed.day));
	  value.setUTCFullYear(parsed.year);
	  const options = parsed.precision === 'month'
	    ? { year: 'numeric', month: style === 'short' ? 'short' : 'long', timeZone: 'UTC' }
	    : { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };
	  try {
	    return new Intl.DateTimeFormat(locale, options).format(value)
	  } catch {
	    return parsed.source || `${parsed.year}-${parsed.month}-${parsed.day}`
	  }
	}

	function formatGroup(group, granularity, locale) {
	  if (granularity === 'year') return String(group.date.year)
	  if (granularity === 'day') return formatDateParts({ ...group.date, precision: 'day' }, locale)
	  return formatDateParts({ ...group.date, precision: 'month' }, locale)
	}

	function tagColor(color) {
	  const key = String(color || '').trim().replace(/^color-/, '');
	  const fallback = TAG_COLOR_FALLBACKS[key];
	  return fallback ? `var(--color-${key}, ${fallback})` : 'var(--color-gray, #999)'
	}

	function thumbnailUrl(record, state, args) {
	  const photoId = record.item?.photos?.[0];
	  if (photoId == null || !args?.cache || !state?.project?.id) return null
	  return pathToFileURL(join(args.cache, String(state.project.id), `${photoId}_512.webp`)).href
	}

	class AnalyticsPlugin {
	  constructor(options, context) {
	    this.options = options || {};
	    this.context = context;
	    this.win = context?.window;
	    this.locale = this.win?.args?.locale || navigator.language || 'en';
	    this.dark = this.detectDarkTheme();
	    this.t = translator(this.locale);
	    this.mapping = this.readMappings();
	    this.settings = defaultSettings();
	    this.projectKey = null;
	    this.unsubscribe = null;
	    this.panel = null;
	    this.launcher = null;
	    this.renderTimer = null;
	    this.ensureTimer = null;
	    this.lastStateRefs = null;
	    this.lastNavMode = null;
	    this.returnAvailable = false;
	    this.returnButton = null;

	    if (!this.win || this.win.type !== 'project') return
	    if (globalThis.__tropyAnalyticsPlugin) {
	      this.isDuplicate = true;
	      return
	    }
	    globalThis.__tropyAnalyticsPlugin = this;

	    this.injectStylesheet();
	    this.handleToggle = state => {
	      if (state === 'ready') this.connect();
	    };
	    this.handleSettingsUpdate = settings => {
	      if (typeof settings?.dark === 'boolean') {
	        this.dark = settings.dark;
	        this.applyTheme();
	      }
	      if (typeof settings?.theme === 'string') {
	        this.dark = /dark/i.test(settings.theme);
	        this.applyTheme();
	      }

	      if (!settings?.locale || settings.locale === this.locale) return
	      this.locale = settings.locale;
	      this.t = translator(this.locale);
	      if (this.launcher) {
	        this.launcher.title = this.t('openAnalytics');
	        this.launcher.setAttribute('aria-label', this.t('openAnalytics'));
	      }
	      if (this.returnButton) {
	        this.returnButton.title = this.t('backToAnalytics');
	        this.returnButton.setAttribute('aria-label', this.t('backToAnalytics'));
	      }
	      if (this.panel) {
	        const wasOpen = this.isOpen;
	        this.detachHistoryNavigation();
	        this.panel.remove();
	        document.removeEventListener('keydown', this.handleKeydown, true);
	        this.panel = null;
	        this.handleKeydown = null;
	        if (wasOpen) this.open();
	      }
	    };
	    this.win.on('toggle', this.handleToggle);
	    this.win.on('settings.update', this.handleSettingsUpdate);

	    this.themeObserver = new MutationObserver(() => {
	      this.dark = this.detectDarkTheme();
	      this.applyTheme();
	    });
	    const themeAttributes = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'theme'] };
	    this.themeObserver.observe(document.documentElement, themeAttributes);
	    this.themeObserver.observe(document.body, themeAttributes);
	    this.observer = new MutationObserver(() => {
	      this.scheduleEnsureLauncher();
	    });
	    this.observer.observe(document.body, { childList: true, subtree: true });
	    this.scheduleEnsureLauncher();
	    if (this.win.store) this.connect();
	  }

	  detectDarkTheme() {
	    if (typeof this.win?.args?.dark === 'boolean') return this.win.args.dark
	    if (typeof this.win?.args?.theme === 'string') return /dark/i.test(this.win.args.theme)
	    const roots = [document.documentElement, document.body].filter(Boolean);
	    const classNames = roots.map(root => `${typeof root.className === 'string' ? root.className : root.className?.baseVal || ''} ${root.getAttribute?.('data-theme') || ''} ${root.getAttribute?.('theme') || ''}`);
	    if (classNames.some(name => /(?:^|[\s_-])(dark|night)(?:$|[\s_-])/i.test(name))) return true
	    if (classNames.some(name => /(?:^|[\s_-])light(?:$|[\s_-])/i.test(name))) return false

	    const styles = roots.map(root => getComputedStyle(root));
	    if (styles.some(style => style.colorScheme?.includes('dark'))) return true
	    if (styles.some(style => style.colorScheme?.includes('light'))) return false
	    for (const style of styles) {
	      const match = style.backgroundColor.match(/\d+(?:\.\d+)?/g);
	      if (match?.length >= 3 && (match.length < 4 || Number(match[3]) > 0)) {
	        const [r, g, b] = match.slice(0, 3).map(Number);
	        return r * 0.2126 + g * 0.7152 + b * 0.0722 < 110
	      }
	    }
	    return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
	  }

	  readMappings() {
	    const options = this.options || {};
	    const read = (keys, fallback) => {
	      for (const key of keys) {
	        const value = options?.[key];
	        if (typeof value === 'string' && value.trim()) return value.trim()
	      }
	      return fallback
	    };
	    return {
	      creator: read(['creatorField', 'creator', 'creator-field'], core.DC_CREATOR),
	      audience: read(['audienceField', 'audience', 'audience-field'], core.DCTERMS_AUDIENCE),
	      otherPerson: read(['otherPersonField', 'personField'], ''),
	      place: read(['placeField', 'place', 'place-field'], ''),
	      sourceType: read(['typeField', 'sourceTypeField', 'sourceType', 'type-field'], ''),
	      collection: read(['collectionField', 'collection', 'collection-field'], '')
	    }
	  }

	  activeMappings() {
	    const saved = this.settings?.fieldMappings || {};
	    const get = (key, fallback) => Object.hasOwn(saved, key)
	      ? (saved[key] === '__auto' ? fallback : saved[key] === '__none' ? '' : saved[key])
	      : fallback;
	    return {
	      ...this.mapping,
	      creator: get('creator', this.mapping.creator),
	      audience: get('audience', this.mapping.audience),
	      otherPerson: get('otherPerson', ''),
	      place: get('place', ''),
	      sourceType: get('sourceType', '')
	    }
	  }

	  visibleCharts() {
	    return new Set(this.settings?.visibleCharts || defaultSettings().visibleCharts)
	  }

	  fieldsForAnalysis(state) {
	    const mapping = this.activeMappings();
	    const fields = core.ensureStandardPeopleFields(core.buildFieldCatalog(state, this.locale));
	    const byId = new Map(fields.map(field => [String(field.id), field]));
	    const resolveRole = (id, role) => (id && byId.get(String(id))) || fields.find(field => core.fieldRole(field) === role) || byId.get(role === 'creator' ? core.DC_CREATOR : core.DC_AUDIENCE);
	    const creator = resolveRole(mapping.creator, 'creator');
	    const audience = resolveRole(mapping.audience, 'audience');
	    const person = mapping.otherPerson ? byId.get(String(mapping.otherPerson)) : null;
	    const effectivePeople = [creator?.id, audience?.id, person?.id].filter(Boolean).map(String);
	    const effectiveMapping = { ...mapping, creator: creator?.id || mapping.creator, audience: audience?.id || mapping.audience, otherPerson: person?.id || '' };
	    const explicitPeople = [...new Set([...effectivePeople, ...this.settings.entityFields].filter(Boolean))]
	      .map(id => byId.get(String(id)) || { id, label: String(id).split(/[\/#]/).pop(), count: 0, types: [], role: 'person' });
	    const people = [...new Map([...fields.filter(field => ['creator', 'audience', 'person'].includes(field.role || core.fieldRole(field))), ...explicitPeople]
	      .map(field => [String(field.id), { ...field, role: String(field.id) === String(effectiveMapping.creator) ? 'creator' : String(field.id) === String(effectiveMapping.audience) ? 'audience' : field.role || core.fieldRole(field) || 'person' }])).values()];
	    const facets = { ...(this.options?.facets || {}), ...(this.settings.facetFields || {}) };
	    const placeField = facets.place || mapping.place || '';
	    const typeField = facets.sourceType || mapping.sourceType || '';
	    for (const [id, label] of [[placeField, this.t('places')], [typeField, this.t('sourceTypes')]]) {
	      if (id && !fields.some(field => String(field.id) === String(id))) fields.push({ id, label: String(id).split(/[\/#]/).pop() || label, count: 0, types: [] });
	    }
	    return { fields, peopleFields: people, placeField, typeField, collectionField: facets.collection || mapping.collection || '', roleFields: effectiveMapping }
	  }

	  injectStylesheet() {
	    if (document.getElementById('tropy-analytics-styles')) return
	    this.stylesheet = create('link', {
	      id: 'tropy-analytics-styles',
	      rel: 'stylesheet',
	      charset: 'utf-8',
	      href: pathToFileURL(join(__dirname, 'analytics.css')).href
	    });
	    document.head.append(this.stylesheet);
	  }

	  connect() {
	    if (!this.win?.store || this.unsubscribe) {
	      this.scheduleEnsureLauncher();
	      return
	    }
	    this.unsubscribe = this.win.store.subscribe(() => this.handleStoreChange());
	    this.handleStoreChange(true);
	    this.scheduleEnsureLauncher();
	  }

	  handleStoreChange(force = false) {
	    const state = this.win.store.getState();
	    const navMode = state?.nav?.mode;
	    const refs = [state.items, state.metadata, state.lists, state.tags, state.ontology, state.project?.id];
	    const changed = force || !this.lastStateRefs || refs.some((value, index) => value !== this.lastStateRefs[index]);
	    this.lastStateRefs = refs;
	    this.updateProjectSettings(state);
	    this.updateLauncher(state);
	    if (this.lastNavMode === 'item' && navMode !== 'item' && this.returnAvailable && !this.isOpen) {
	      this.returnAvailable = false;
	    }
	    this.lastNavMode = navMode;
	    this.ensureReturnButton(state);
	    if (changed && this.isOpen) this.scheduleRender();
	  }

	  updateProjectSettings(state) {
	    const id = state?.project?.id;
	    if (id == null || String(id) === this.projectKey) return
	    this.projectKey = String(id);
	    this.personHistory = [];
	    this.personHistoryIndex = -1;
	    try {
	      this.settings = safeSettings(JSON.parse(localStorage.getItem(this.storageKey)));
	    } catch {
	      this.settings = defaultSettings();
	    }
	    this.hydrateDefaults(state);
	  }

	  get storageKey() {
	    return `tropy.analytics.${this.projectKey || 'none'}`
	  }

	  hydrateDefaults(state) {
	    const fields = core.ensureStandardPeopleFields(core.buildFieldCatalog(state, this.locale));
	    if (!fields.some(field => field.id === this.settings.dateField)) {
	      this.settings.dateField = core.defaultField(fields, 'date');
	    }
	    if (!fields.some(field => field.id === this.settings.titleField)) {
	      this.settings.titleField = core.defaultField(fields, 'title');
	    }
	  }

	  persist() {
	    if (!this.projectKey) return
	    try {
	      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
	    } catch (error) {
	      this.context?.logger?.warn?.({ error }, 'Analytics could not save its filters');
	    }
	  }

	  scheduleEnsureLauncher() {
	    if (this.ensureTimer) return
	    this.ensureTimer = requestAnimationFrame(() => {
	      this.ensureTimer = null;
	      this.ensureLauncher();
	    });
	  }

	  ensureLauncher() {
	    const host = document.querySelector('#project-view .items > header .toolbar-right');
	    if (host && !this.launcher?.isConnected) {
	      this.launcher = create('button', {
	        className: 'btn btn-icon ta-launcher',
	        type: 'button',
	        tabIndex: -1,
	        title: this.t('openAnalytics'),
	        ariaLabel: this.t('openAnalytics'),
	        onclick: () => this.open()
	      }, icon('analytics', 'icon'));
	      host.insertBefore(this.launcher, host.firstChild);
	      this.updateLauncher(this.win?.store?.getState());
	    }
	    this.ensureReturnButton(this.win?.store?.getState());
	  }

	  ensureReturnButton(state = this.win?.store?.getState()) {
	    const shouldShow = this.returnAvailable && state?.nav?.mode === 'item';
	    if (!shouldShow) {
	      this.returnButton?.remove();
	      this.returnButton = null;
	      return
	    }

	    const host = document.querySelector('.item-view .titlebar .toolbar-left .tool-group');
	    if (!host || this.returnButton?.isConnected) return

	    this.returnButton = create('button', {
	      className: 'btn btn-md btn-icon ta-return-analytics',
	      type: 'button',
	      tabIndex: -1,
	      title: this.t('backToAnalytics'),
	      ariaLabel: this.t('backToAnalytics'),
	      onmousedown: event => event.preventDefault(),
	      onclick: event => {
	        event.preventDefault();
	        this.open();
	      }
	    }, icon('analytics', 'icon'));
	    host.append(this.returnButton);
	  }

	  updateLauncher(state) {
	    if (!this.launcher) return
	    this.launcher.disabled = !state?.project?.id;
	    this.launcher.classList.toggle('disabled', !state?.project?.id);
	  }

	  get isOpen() {
	    return Boolean(this.panel && !this.panel.hidden)
	  }

	  open() {
	    const state = this.win?.store?.getState();
	    if (!state?.project?.id) return
	    this.updateProjectSettings(state);
	    this.hydrateDefaults(state);
	    if (!this.panel) this.buildPanel();
	    this.panel.hidden = false;
	    document.body.classList.add('ta-analytics-open');
	    this.searchInput.value = this.settings.search;
	    this.renderAll();
	    this.panel.querySelector('.ta-search-input')?.focus();
	  }

	  close() {
	    if (!this.panel) return
	    this.panel.hidden = true;
	    document.body.classList.remove('ta-analytics-open');
	    const state = this.win?.store?.getState();
	    const target = state?.nav?.mode === 'item' && this.returnAvailable
	      ? this.returnButton
	      : this.launcher;
	    target?.focus();
	  }

	  buildPanel() {
	    this.detachHistoryNavigation();
	    this.panel = create('section', {
	      className: 'ta-overlay',
	      role: 'dialog',
	      'aria-modal': 'true',
	      'aria-label': this.t('analytics')
	    });

	    this.filterButton = create('button', {
	      className: 'ta-icon-button ta-filter-toggle',
	      type: 'button',
	      title: this.t('hideFilters'),
	      ariaLabel: this.t('hideFilters'),
	      onclick: () => {
	        this.settings.filtersOpen = !this.settings.filtersOpen;
	        this.applyFilterVisibility();
	        this.persist();
	      }
	    }, icon('filter'));

	    this.summary = create('div', { className: 'ta-heading-summary', 'aria-live': 'polite' });
	    const brand = create('div', { className: 'ta-brand' },
	      icon('analytics', 'ta-brand-icon'),
	      create('div', {},
	        create('h1', { text: this.t('analytics') }),
	        this.summary
	      )
	    );

	    this.searchInput = create('input', {
	      className: 'ta-input ta-search-input',
	      type: 'search',
	      value: this.settings.search,
	      placeholder: this.t('searchPlaceholder'),
	      ariaLabel: this.t('search'),
	      oninput: event => {
	        this.settings.search = event.target.value;
	        this.updateNativeButton();
	        this.persist();
	        this.scheduleRender(100);
	      }
	    });
	    this.nativeButton = create('button', {
	      className: 'ta-button ta-open-native', type: 'button',
	      'aria-label': this.t('openInLibrary'),
	      onclick: () => this.openInLibrary()
	    }, icon('folder'), create('span', { text: this.t('openInLibrary') }));
	    const search = create('div', { className: 'ta-search-actions' },
	      create('div', { className: 'ta-search' }, icon('search'), this.searchInput), this.nativeButton);

	    const reset = create('button', {
	      className: 'ta-button ta-button-subtle',
	      type: 'button',
	      title: this.t('reset'),
	      onclick: () => this.reset()
	    }, icon('reset'), create('span', { text: this.t('reset') }));

	    const close = create('button', {
	      className: 'ta-icon-button',
	      type: 'button',
	      title: this.t('close'),
	      ariaLabel: this.t('close'),
	      onclick: () => this.close()
	    }, icon('close'));

	    const header = create('header', { className: 'ta-header' },
	      create('div', { className: 'ta-header-left' }, this.filterButton, brand),
	      search,
	      create('div', { className: 'ta-header-actions' }, reset, close)
	    );

	    this.sidebar = create('aside', { className: 'ta-sidebar', 'aria-label': this.t('filters') });
	    this.viewbar = create('div', { className: 'ta-viewbar' });
	    this.histogram = create('div', { className: 'ta-histogram' });
	    this.analytics = create('div', { className: 'ta-analytics' });
	    this.scroller = create('div', { className: 'ta-scroller' }, this.analytics);
	    const content = create('main', { className: 'ta-content' }, this.viewbar, this.histogram, this.scroller);
	    this.shell = create('div', { className: 'ta-shell' }, this.sidebar, content);
	    this.panel.append(header, this.shell);
	    document.body.append(this.panel);
	    this.applyTheme();

	    this.handleKeydown = event => {
	      if (!this.isOpen) return
	      if (event.key === 'Escape') {
	        event.preventDefault();
	        event.stopPropagation();
	        this.close();
	      }
	    };
	    document.addEventListener('keydown', this.handleKeydown, true);
	    this.attachHistoryNavigation();
	    this.updateNativeButton();
	    this.applyFilterVisibility();
	  }

	  applyFilterVisibility() {
	    if (!this.shell) return
	    this.shell.classList.toggle('ta-filters-closed', !this.settings.filtersOpen);
	    this.filterButton.classList.toggle('active', this.settings.filtersOpen);
	    const key = this.settings.filtersOpen ? 'hideFilters' : 'showFilters';
	    this.filterButton.title = this.t(key);
	    this.filterButton.setAttribute('aria-label', this.t(key));
	  }

	  applyTheme() {
	    if (!this.panel) return
	    const dark = this.dark == null
	      ? Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
	      : this.dark;
	    this.panel.classList.toggle('ta-theme-dark', dark);
	    this.panel.classList.toggle('ta-theme-light', !dark);
	  }

	  reset() {
	    const state = this.win.store.getState();
	    this.settings = defaultSettings();
	    this.hydrateDefaults(state);
	    this.persist();
	    this.searchInput.value = '';
	    this.renderAll();
	  }

	  renderAll() {
	    if (!this.isOpen) return
	    const state = this.win.store.getState();
	    this.hydrateDefaults(state);
	    this.renderSidebar(state);
	    this.renderResults(state);
	    this.updateNativeButton();
	    this.applyFilterVisibility();
	  }

	  scheduleRender(delay = 40) {
	    clearTimeout(this.renderTimer);
	    this.renderTimer = setTimeout(() => {
	      this.renderTimer = null;
	      if (this.isOpen) this.renderResults(this.win.store.getState());
	    }, delay);
	  }

	  changeSetting(key, value, { sidebar = false } = {}) {
	    this.settings[key] = value;
	    this.persist();
	    if (sidebar) this.renderSidebar(this.win.store.getState());
	    this.scheduleRender(0);
	  }

	  makeSelect(values, current, onChange, className = 'ta-select') {
	    const select = create('select', {
	      className,
	      onchange: event => onChange(event.target.value)
	    });
	    for (const [value, label] of values) select.append(option(value, label, String(value) === String(current)));
	    return select
	  }

	  sidebarFields(state, analysisFields) {
	    // Keep configured empty fields identifiable without offering unused templates.
	    const selected = new Set([
	      this.settings.dateField, this.settings.titleField,
	      ...Object.values(this.settings.fieldMappings || {}),
	      ...(this.settings.conditions || []).map(condition => condition.field),
	      ...(this.settings.entityFields || []).filter(id =>
	        !(this.settings.mappedEntityFields || []).includes(id))
	    ].filter(Boolean).map(String));
	    const catalog = new Map([...core.buildFieldCatalog(state, this.locale),
	      ...analysisFields.peopleFields].map(field => [String(field.id), field]));
	    for (const id of selected) {
	      if (!id.startsWith('__') && !catalog.has(id)) {
	        catalog.set(id, { id, label: id.split(/[\/#]/).pop() || id, count: 0, types: [] });
	      }
	    }
	    return [...catalog.values()].filter(field => field.count > 0 || selected.has(String(field.id)))
	      .map(field => field.count > 0 ? field : { ...field, label: `${field.label} (0)` })
	  }

	  renderSidebar(state) {
	    const active = document.activeElement;
	    const focusKey = active?.dataset?.focusKey;
	    const selectionStart = active?.selectionStart;
	    const analysisFields = this.fieldsForAnalysis(state);
	    const fields = this.sidebarFields(state, analysisFields);
	    const lists = core.flattenLists(state.lists, this.locale);
	    const tags = Object.values(state.tags || {}).sort((a, b) =>
	      String(a.name).localeCompare(String(b.name), this.locale));

	    this.sidebar.replaceChildren();
	    this.sidebar.append(create('div', { className: 'ta-sidebar-heading' },
	      create('h2', { text: this.t('filters') }),
	      create('button', {
	        className: 'ta-link-button',
	        type: 'button',
	        text: this.t('reset'),
	        onclick: () => this.reset()
	      })
	    ));

	    const dateValues = [
	      [core.INTERNAL_FIELDS.CREATED, this.t('created')],
	      [core.INTERNAL_FIELDS.MODIFIED, this.t('modified')],
	      ...fields
	        .slice()
	        .sort((a, b) => Number(b.isDate) - Number(a.isDate) || a.label.localeCompare(b.label, this.locale))
	        .map(field => [field.id, field.label])
	    ];
	    const titleValues = fields
	      .slice()
	      .sort((a, b) => Number(b.isTitle) - Number(a.isTitle) || a.label.localeCompare(b.label, this.locale))
	      .map(field => [field.id, field.label]);
	    const propertyFields = fields.slice().sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.label.localeCompare(b.label, this.locale));
	    const propertyValues = propertyFields.map(field => [String(field.id), `${field.label}${field.count ? ` (${field.count})` : ''}`]);
	    const automaticMapping = {
	      creator: fields.find(field => core.fieldRole(field) === 'creator'),
	      audience: fields.find(field => core.fieldRole(field) === 'audience')
	    };
	    const mappingValues = {
	      creator: [['__auto', automaticMapping.creator?.label || this.t('creatorField')], ...propertyValues],
	      audience: [['__auto', automaticMapping.audience?.label || this.t('audienceField')], ...propertyValues],
	      otherPerson: [['__auto', this.t('recognizedPeople')], ['__none', this.t('notUsed')], ...propertyValues],
	      place: [['__auto', this.t('placeField')], ...propertyValues],
	      sourceType: [['__auto', this.t('sourceTypeField')], ...propertyValues]
	    };
	    const settingSelect = (key, label) => {
	      const select = this.makeSelect(mappingValues[key], this.settings.fieldMappings[key] || '__auto', value => this.changeFieldMapping(key, value));
	      select.dataset.focusKey = `chart-mapping-${key}`;
	      const row = controlGroup(label, select);
	      row.classList.add('ta-mapping-row');
	      return row
	    };
	    const chartToggles = [
	      ['time', this.t('recordsOverTime')], ['types', this.t('sourceTypes')], ['places', this.t('places')],
	      ['collections', this.t('collections')], ['people', this.t('people')], ['network', this.t('entityNetwork')]
	    ].map(([key, label]) => {
	      const selected = this.settings.visibleCharts.includes(key);
	      return create('label', { className: `ta-checkbox ta-chart-toggle ${selected ? 'is-selected' : 'is-unselected'}` },
	        create('input', { type: 'checkbox', checked: selected, 'aria-label': label, onchange: event => {
	          const row = event.target.closest('.ta-chart-toggle');
	          row?.classList.toggle('is-selected', event.target.checked);
	          row?.classList.toggle('is-unselected', !event.target.checked);
	          const status = row?.querySelector('.ta-chart-toggle-status');
	          if (status) status.textContent = this.t(event.target.checked ? 'chartShown' : 'chartHidden');
	          this.changeChartVisibility(key, event.target.checked);
	        } }),
	        create('span', { className: 'ta-chart-toggle-label', text: label }),
	        create('span', { className: 'ta-chart-toggle-status', text: this.t(selected ? 'chartShown' : 'chartHidden') })
	      )
	    });
	    const chartMappings = create('details', {
	      className: 'ta-chart-mappings',
	      open: this.settings.chartMappingsOpen ? '' : null,
	      ontoggle: event => {
	        const isOpen = event.currentTarget.open;
	        if (this.settings.chartMappingsOpen === isOpen) return
	        this.settings.chartMappingsOpen = isOpen;
	        this.persist();
	      }
	    },
	    create('summary', {}, create('span', { text: this.t('chartSettings') }), create('small', { text: this.t('chartSettingsSummary') })),
	    create('div', { className: 'ta-chart-mapping-fields' },
	      create('p', { className: 'ta-help', text: this.t('chartSettingsHelp') }),
	      settingSelect('creator', this.t('creatorField')),
	      settingSelect('audience', this.t('audienceField')),
	      settingSelect('otherPerson', this.t('additionalPersonField')),
	      settingSelect('place', this.t('placeField')),
	      settingSelect('sourceType', this.t('sourceTypeField'))
	    ));
	    const chartSettings = create('section', { className: 'ta-filter-section ta-chart-settings' },
	      create('h3', { text: this.t('chartsToShow') }),
	      create('div', { className: 'ta-chart-toggles' }, chartToggles),
	      chartMappings
	    );
	    const entityCandidates = analysisFields.peopleFields
	      .filter(field => fields.some(candidate => String(candidate.id) === String(field.id)))
	      .map(field => ({ ...field, label: fields.find(candidate => String(candidate.id) === String(field.id)).label }));
	    const mappedPeople = [analysisFields.roleFields.creator, analysisFields.roleFields.audience, analysisFields.roleFields.otherPerson].filter(Boolean).map(String);
	    const mappingSignature = mappedPeople.join('|');
	    if (!this.settings.peopleFieldsInitialized || this.settings.peopleMappingSignature !== mappingSignature) {
	      const previouslyMapped = new Set((this.settings.mappedEntityFields || []).map(String));
	      const manual = this.settings.entityFields.map(String).filter(id => !previouslyMapped.has(id));
	      this.settings.entityFields = [...new Set([...mappedPeople, ...manual])];
	      this.settings.mappedEntityFields = mappedPeople;
	      this.settings.peopleMappingSignature = mappingSignature;
	      this.settings.peopleFieldsInitialized = true;
	      this.persist();
	    }
	    const entitySelect = create('div', { className: 'ta-field-checks' });
	    for (const field of entityCandidates) {
	      const isSelected = this.settings.entityFields.includes(String(field.id));
	      const role = field.role || core.fieldRole(field);
	      const roleLabel = role === 'creator' ? this.t('creator') : role === 'audience' ? this.t('audience') : role === 'person' ? this.t('people') : '';
	      entitySelect.append(create('label', { className: `ta-checkbox ta-person-field ${isSelected ? 'is-selected' : 'is-unselected'}` },
	        create('input', { type: 'checkbox', checked: isSelected, onchange: event => {
	          this.settings.entityFields = event.target.checked
	            ? [...new Set([...this.settings.entityFields, String(field.id)])]
	            : this.settings.entityFields.filter(id => id !== String(field.id));
	          const row = event.target.closest('.ta-person-field');
	          row?.classList.toggle('is-selected', event.target.checked);
	          row?.classList.toggle('is-unselected', !event.target.checked);
	          const status = row?.querySelector('.ta-person-field-status');
	          if (status) status.textContent = this.t(event.target.checked ? 'includedInCharts' : 'excludedFromCharts');
	          this.persist();
	          this.scheduleRender(0);
	        } }),
	        create('span', { className: 'ta-person-field-name', title: field.label, text: `${field.label}${field.count ? ` · ${field.count}` : ''}` }),
	        roleLabel ? create('span', { className: `ta-person-role ta-role-${role}`, text: roleLabel }) : null,
	        create('span', { className: 'ta-person-field-status', text: this.t(isSelected ? 'includedInCharts' : 'excludedFromCharts') })
	      ));
	    }

	    const dateSelect = this.makeSelect(dateValues, this.settings.dateField,
	      value => this.changeSetting('dateField', value));
	    const titleSelect = this.makeSelect(titleValues, this.settings.titleField,
	      value => this.changeSetting('titleField', value));

	    const listSelect = this.makeSelect([
	      ['', this.t('allProject')],
	      ...lists.map(list => [list.id, `${'\u00a0\u00a0'.repeat(list.depth)}${list.name}`])
	    ], this.settings.listId, value => this.changeSetting('listId', value));

	    const scope = create('section', { className: 'ta-filter-section' },
	      create('h3', { text: this.t('entityFields') }),
	      create('p', { className: 'ta-help', text: this.t('entityFieldsHelp') }),
	      entitySelect.childElementCount ? entitySelect : this.emptyState('search', this.t('noPeopleFields'), this.t('mapPeopleFieldsFirst')),
	      controlGroup(this.t('dateField'), dateSelect),
	      controlGroup(this.t('titleField'), titleSelect),
	      controlGroup(this.t('list'), listSelect),
	      create('label', { className: 'ta-checkbox' },
	        create('input', {
	          type: 'checkbox',
	          checked: this.settings.includeDescendants,
	          onchange: event => this.changeSetting('includeDescendants', event.target.checked)
	        }),
	        create('span', { text: this.t('includeSublists') })
	      )
	    );

	    const from = create('input', {
	      className: 'ta-input',
	      type: 'text',
	      value: this.settings.from,
	      placeholder: this.t('from'),
	      dataset: { focusKey: 'date-from' },
	      oninput: event => this.changeSetting('from', event.target.value)
	    });
	    const to = create('input', {
	      className: 'ta-input',
	      type: 'text',
	      value: this.settings.to,
	      placeholder: this.t('to'),
	      dataset: { focusKey: 'date-to' },
	      oninput: event => this.changeSetting('to', event.target.value)
	    });
	    const dateOrder = this.makeSelect([
	      ['DMY', this.t('dmy')], ['MDY', this.t('mdy')]
	    ], this.settings.dateOrder, value => this.changeSetting('dateOrder', value));

	    const range = create('section', { className: 'ta-filter-section' },
	      create('h3', { text: this.t('dateRange') }),
	      create('div', { className: 'ta-range' },
	        controlGroup(this.t('from'), from),
	        controlGroup(this.t('to'), to)
	      ),
	      controlGroup(this.t('dateOrder'), dateOrder)
	    );

	    const tagCloud = create('div', { className: 'ta-tag-cloud' });
	    for (const tag of tags) {
	      const id = String(tag.id);
	      const tagState = this.settings.includeTags.map(String).includes(id)
	        ? 'include'
	        : this.settings.excludeTags.map(String).includes(id) ? 'exclude' : 'neutral';
	      tagCloud.append(create('button', {
	        className: `ta-tag-filter ${tagState}`,
	        type: 'button',
	        title: tagState === 'include' ? this.t('includeTag') : tagState === 'exclude' ? this.t('excludeTag') : tag.name,
	        dataset: { tagId: id, tagName: tag.name },
	        'aria-pressed': tagState === 'exclude' ? 'mixed' : String(tagState === 'include'),
	        onclick: event => this.cycleTag(id, event.currentTarget)
	      },
	      create('span', { className: 'ta-tag-dot', style: { backgroundColor: tagColor(tag.color) } }),
	      create('span', { text: tag.name }),
	      create('strong', { className: 'ta-tag-state', 'aria-hidden': 'true', text: tagState === 'include' ? '+' : tagState === 'exclude' ? '-' : '' })
	      ));
	    }

	    const tagMode = this.makeSelect([
	      ['all', this.t('allTags')], ['any', this.t('anyTag')]
	    ], this.settings.tagMode, value => this.changeSetting('tagMode', value));

	    const tagSection = create('section', { className: 'ta-filter-section' },
	      create('h3', { text: this.t('tags') }),
	      create('p', { className: 'ta-help', text: this.t('tagsHelp') }),
	      tagCloud,
	      controlGroup(this.t('tagMode'), tagMode)
	    );

	    const conditions = create('section', { className: 'ta-filter-section ta-conditions' },
	      create('h3', { text: this.t('conditions') }),
	      create('p', { className: 'ta-help', text: this.t('conditionsHelp') })
	    );

	    const conditionMode = this.makeSelect([
	      ['all', this.t('matchAll')], ['any', this.t('matchAny')]
	    ], this.settings.conditionMode, value => this.changeSetting('conditionMode', value));
	    conditions.append(controlGroup(this.t('matchConditions'), conditionMode));

	    const conditionFields = [
	      [core.INTERNAL_FIELDS.ALL, this.t('allMetadata')],
	      [core.INTERNAL_FIELDS.TITLE, this.t('itemTitle')],
	      [core.INTERNAL_FIELDS.DATE, this.t('itemDate')],
	      [core.INTERNAL_FIELDS.CREATED, this.t('created')],
	      [core.INTERNAL_FIELDS.MODIFIED, this.t('modified')],
	      [core.INTERNAL_FIELDS.TAGS, this.t('itemTags')],
	      [core.INTERNAL_FIELDS.LISTS, this.t('itemLists')],
	      ...fields.map(field => [field.id, field.label])
	    ];

	    const rows = create('div', { className: 'ta-condition-list' });
	    this.settings.conditions.forEach((condition, index) => {
	      rows.append(this.renderCondition(condition, index, conditionFields));
	    });
	    conditions.append(rows, create('button', {
	      className: 'ta-button ta-add-condition',
	      type: 'button',
	      onclick: () => {
	        this.settings.conditions.push({
	          mode: 'include', field: core.INTERNAL_FIELDS.ALL, operator: 'contains', value: ''
	        });
	        this.persist();
	        this.renderSidebar(state);
	      }
	    }, icon('plus'), create('span', { text: this.t('addCondition') })));

	    const showUndated = create('label', { className: 'ta-checkbox' },
	      create('input', {
	        type: 'checkbox',
	        checked: this.settings.showUndated,
	        onchange: event => this.changeSetting('showUndated', event.target.checked)
	      }),
	      create('span', { text: this.t('showUndated') })
	    );

	    this.sidebar.append(chartSettings, scope, range, tagSection, conditions,
	      create('section', { className: 'ta-filter-section' }, showUndated));

	    if (focusKey) {
	      const next = this.sidebar.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
	      next?.focus();
	      if (Number.isInteger(selectionStart) && next?.setSelectionRange) {
	        next.setSelectionRange(selectionStart, selectionStart);
	      }
	    }
	  }

	  changeFieldMapping(key, value) {
	    this.settings.fieldMappings[key] = value;
	    if (['creator', 'audience', 'otherPerson'].includes(key)) this.settings.peopleFieldsInitialized = false;
	    this.persist();
	    const state = this.win.store.getState();
	    this.renderSidebar(state);
	    this.scheduleRender(0);
	  }

	  changeChartVisibility(key, visible) {
	    const selected = new Set(this.settings.visibleCharts);
	    if (visible) selected.add(key);
	    else selected.delete(key);
	    this.settings.visibleCharts = [...selected];
	    this.persist();
	    this.scheduleRender(0);
	  }

	  renderCondition(condition, index, fields) {
	    const mode = this.makeSelect([
	      ['include', this.t('include')], ['exclude', this.t('exclude')]
	    ], condition.mode, value => this.updateCondition(index, 'mode', value), 'ta-select ta-condition-mode');
	    const field = this.makeSelect(fields, condition.field,
	      value => this.updateCondition(index, 'field', value), 'ta-select ta-condition-field');
	    const operator = this.makeSelect(OPERATORS.map(([value, label]) => [value, this.t(label)]),
	      condition.operator, value => this.updateCondition(index, 'operator', value, true), 'ta-select ta-condition-operator');
	    const value = create('input', {
	      className: 'ta-input ta-condition-value',
	      type: 'text',
	      value: condition.value,
	      placeholder: this.t('value'),
	      disabled: NO_VALUE_OPERATORS.has(condition.operator),
	      dataset: { focusKey: `condition-${index}` },
	      oninput: event => this.updateCondition(index, 'value', event.target.value)
	    });
	    const remove = create('button', {
	      className: 'ta-icon-button ta-remove-condition',
	      type: 'button',
	      title: this.t('removeCondition'),
	      ariaLabel: this.t('removeCondition'),
	      onclick: () => {
	        this.settings.conditions.splice(index, 1);
	        this.persist();
	        this.renderSidebar(this.win.store.getState());
	        this.scheduleRender(0);
	      }
	    }, icon('remove'));
	    return create('div', { className: `ta-condition-row ${condition.mode}` }, mode, field, operator, value, remove)
	  }

	  updateCondition(index, key, value, rerender = false) {
	    if (!this.settings.conditions[index]) return
	    this.settings.conditions[index][key] = value;
	    this.persist();
	    if (rerender) this.renderSidebar(this.win.store.getState());
	    this.scheduleRender(0);
	  }

	  cycleTag(id, button) {
	    id = String(id);
	    const included = new Set(this.settings.includeTags.map(String));
	    const excluded = new Set(this.settings.excludeTags.map(String));
	    if (included.has(id)) {
	      included.delete(id);
	      excluded.add(id);
	    } else if (excluded.has(id)) {
	      excluded.delete(id);
	    } else included.add(id);
	    this.settings.includeTags = [...included];
	    this.settings.excludeTags = [...excluded];
	    this.persist();
	    const tagState = included.has(id) ? 'include' : excluded.has(id) ? 'exclude' : 'neutral';
	    const target = button || [...(this.sidebar?.querySelectorAll('.ta-tag-filter') || [])]
	      .find(element => element.dataset.tagId === id);
	    if (target) {
	      target.classList.remove('include', 'exclude', 'neutral');
	      target.classList.add(tagState);
	      const name = target.dataset.tagName || '';
	      target.title = tagState === 'include' ? this.t('includeTag') : tagState === 'exclude' ? this.t('excludeTag') : name;
	      target.setAttribute('aria-pressed', tagState === 'exclude' ? 'mixed' : String(tagState === 'include'));
	      const status = target.querySelector('.ta-tag-state');
	      if (status) status.textContent = tagState === 'include' ? '+' : tagState === 'exclude' ? '-' : '';
	    }
	    this.scheduleRender(0);
	  }

	  renderViewbar(data) {
	    this.viewbar.replaceChildren();
	    const countText = data.records.length === 1
	      ? this.t('resultOne')
	      : this.t('results', { count: data.records.length });
	    const status = create('div', { className: 'ta-results-status' },
	      create('strong', { text: countText }),
	      create('span', { text: this.t('scopeCount', { count: data.scoped }) }),
	      data.undated.length ? create('span', { text: this.t(this.settings.showUndated ? 'includedUndatedCount' : 'undatedCount', { count: data.undated.length }) }) : null
	    );
	    const allYears = Object.values(this.win.store.getState()?.items || {})
	      .filter(item => item && !item.deleted)
	      .map(item => {
	        const metadata = this.win.store.getState()?.metadata?.[item.id] || {};
	        const value = this.settings.dateField === core.INTERNAL_FIELDS.CREATED
	          ? item.created
	          : this.settings.dateField === core.INTERNAL_FIELDS.MODIFIED
	            ? item.modified
	            : metadata[this.settings.dateField];
	        return core.parseDate(value, this.settings.dateOrder)?.year
	      })
	      .filter(Number.isFinite);
	    const yearMin = allYears.length ? Math.min(...allYears) : 0;
	    const yearMax = allYears.length ? Math.max(...allYears) : 0;
	    const selectedFrom = this.settings.from ? core.parseDate(this.settings.from)?.year : yearMin;
	    const selectedTo = this.settings.to ? core.parseDate(this.settings.to)?.year : yearMax;
	    const slider = create('div', { className: 'ta-time-range' },
	      create('strong', { text: this.t('timeWindow') }),
	      create('div', { className: 'ta-time-labels' }, create('span', { text: String(selectedFrom || '—') }), create('span', { text: String(selectedTo || '—') })),
	      create('div', { className: 'ta-dual-range' },
	        create('input', { type: 'range', min: yearMin, max: Math.max(yearMin + 1, yearMax), value: selectedFrom || yearMin, 'aria-label': this.t('from'), oninput: event => this.updateYearRange(event.target.value, this.rangeUpper?.value) }),
	        create('input', { type: 'range', min: yearMin, max: Math.max(yearMin + 1, yearMax), value: selectedTo || yearMax, 'aria-label': this.t('to'), oninput: event => this.updateYearRange(this.rangeLower?.value, event.target.value) })
	      ),
	      create('button', { className: 'ta-link-button ta-clear-range', type: 'button', text: this.t('clearRange'), onclick: () => { this.settings.from = ''; this.settings.to = ''; this.persist(); this.renderAll(); } })
	    );
	    this.rangeLower = slider.querySelector('input:first-of-type');
	    this.rangeUpper = slider.querySelector('input:last-of-type');
	    this.viewbar.append(status, slider);
	  }

	  updateYearRange(from, to) {
	    const low = Number(from);
	    const high = Number(to);
	    if (!Number.isFinite(low) || !Number.isFinite(high)) return
	    this.settings.from = `${Math.min(low, high)}-01-01`;
	    this.settings.to = `${Math.max(low, high)}-12-31`;
	    this.persist();
	    const labels = this.panel.querySelectorAll('.ta-time-labels span');
	    if (labels[0]) labels[0].textContent = String(Math.min(low, high));
	    if (labels[1]) labels[1].textContent = String(Math.max(low, high));
	    clearTimeout(this.renderTimer);
	    this.renderTimer = setTimeout(() => {
	      this.renderTimer = null;
	      if (this.isOpen) this.renderResults(this.win.store.getState());
	    }, 120);
	  }

	  zoomToYear(start, end = start) {
	    this.settings.from = `${start}-01-01`;
	    this.settings.to = `${end}-12-31`;
	    this.persist();
	    this.renderAll();
	  }

	  renderHistogram(records) {
	    this.histogram.replaceChildren();
	    const datedRecords = records.filter(record => record.date);
	    if (datedRecords.length < 1) {
	      this.histogram.hidden = true;
	      return
	    }
	    this.histogram.hidden = false;
	    const buckets = core.buildHistogram(datedRecords);
	    const max = Math.max(...buckets.map(bucket => bucket.count), 1);
	    const chart = create('div', { className: 'ta-chart', role: 'list' });
	    for (const bucket of buckets) {
	      const bar = create('button', {
	        className: 'ta-chart-bucket',
	        type: 'button',
	        title: `${bucket.label}: ${bucket.count}`,
	        ariaLabel: `${bucket.label}: ${bucket.count}`,
	        role: 'listitem',
	      onclick: () => this.zoomToYear(bucket.start, bucket.end)
	      },
	      create('span', {
	        className: 'ta-chart-bar',
	        style: { height: `${Math.max(4, Math.round((bucket.count / max) * 46))}px` }
	      }),
	      create('span', { className: 'ta-chart-label', text: bucket.label }));
	      chart.append(bar);
	    }
	    this.histogram.append(chart);
	  }

	  renderResults(state) {
	    if (!this.isOpen) return
	    this.updateNativeButton();
	    const scrollTop = this.scroller?.scrollTop || 0;
	    const analysis = this.fieldsForAnalysis(state);
	    const entityFields = this.settings.entityFields.map(String);
	    const data = core.buildAnalyticsData(state, {
	      ...this.settings,
	      entityFields,
	      entityFieldsSet: true,
	      includeUndated: this.settings.showUndated,
	      roleFields: { creator: analysis.roleFields.creator, audience: analysis.roleFields.audience, person: analysis.roleFields.otherPerson },
	      locale: this.locale
	    });
	    this.lastData = data;
	    this.renderViewbar(data);
	    this.renderHistogram(data.records);
	    this.analytics.replaceChildren();

	    const countText = data.records.length === 1
	      ? this.t('resultOne')
	      : this.t('results', { count: data.records.length });
	    const years = data.records.filter(record => record.date).map(record => record.date.year);
	    const range = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : '';
	    this.summary.textContent = range ? `${countText} | ${range}` : countText;

	    if (!data.records.length) {
	      this.analytics.append(this.emptyState('filter', this.t('noResults'), this.t('noResultsHint')));
	      return
	    }
	    const charts = this.visibleCharts();
	    this.analytics.append(...[
	      this.renderSummaryCards(data),
	      charts.has('time') ? this.renderTrendChart(data) : null,
	      charts.has('types') || charts.has('places') ? this.renderCategoryCharts(data, charts) : null,
	      charts.has('collections') ? this.renderCollections(data) : null,
	      charts.has('people') ? this.renderPeopleChart(data) : null,
	      charts.has('network') ? this.renderNetwork(data) : null
	    ].filter(Boolean));
	    this.scroller.scrollTop = Math.min(scrollTop, Math.max(0, this.scroller.scrollHeight - this.scroller.clientHeight));
	  }

	  renderSummaryCards(data) {
	    const count = data.records.length;
	    const dated = data.records.filter(record => record.date).length;
	    return create('section', { className: 'ta-kpi-grid' },
	      this.kpi(this.t('documents'), String(count), this.t('matchingDocuments')),
	      this.kpi(this.t('creators'), String(data.entities.length), this.t('uniqueEntities')),
	      this.kpi(this.t('datedShare'), `${count ? Math.round(dated / count * 100) : 0}%`, this.t('recordsWithDates'))
	    )
	  }

	  kpi(label, value, hint) {
	    return create('article', { className: 'ta-kpi' }, create('span', { text: label }), create('strong', { text: value }), create('small', { text: hint }))
	  }

	  renderTrendChart(data) {
	    const byYear = new Map();
	    for (const record of data.records) if (record.date) byYear.set(record.date.year, (byYear.get(record.date.year) || 0) + 1);
	    const years = [...byYear].sort((a, b) => a[0] - b[0]);
	    const max = Math.max(1, ...years.map(([, count]) => count));
	    const chart = create('div', { className: 'ta-bars', role: 'img', ariaLabel: this.t('recordsOverTime') });
	    for (const [year, count] of years) {
	      const bar = create('button', { className: 'ta-bar', type: 'button', title: `${year}: ${count}`, ariaLabel: `${year}: ${count}`, onclick: () => this.zoomToYear(year) },
	        create('span', { className: 'ta-bar-fill', style: { height: `${Math.max(3, count / max * 120)}px` } }),
	        create('span', { className: 'ta-bar-label', text: String(year) }));
	      chart.append(bar);
	    }
	    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t('recordsOverTime') }), create('span', { text: this.t('clickYear') })), chart)
	  }

	  renderCategoryCharts(data, visible = new Set(['types', 'places'])) {
	    const mapping = this.activeMappings();
	    const candidates = data.fields.filter(field => /(^|\s)(type|format|genre|coverage|spatial|place|location|geographic|geographical)(\s|$)/i.test(`${field.label} ${field.id}`));
	    const primary = (mapping.sourceType ? [data.fields.find(field => String(field.id) === String(mapping.sourceType))].filter(Boolean) : candidates.filter(field => /(^|\s)(type|format|genre)(\s|$)/i.test(`${field.label} ${field.id}`))).slice(0, 1);
	    const places = (mapping.place ? [data.fields.find(field => String(field.id) === String(mapping.place))].filter(Boolean) : candidates.filter(field => /(^|\s)(coverage|spatial|place|location|geographic|geographical)(\s|$)/i.test(`${field.label} ${field.id}`))).slice(0, 1);
	    const charts = [
	      ...(visible.has('types') ? primary.map(field => this.renderCategoryChart(data, field, 'sourceTypes')) : []),
	      ...(visible.has('places') ? places.map(field => this.renderCategoryChart(data, field, 'places')) : [])
	    ];
	    return charts.length ? create('div', { className: 'ta-chart-grid' }, charts) : null
	  }

	  renderCategoryChart(data, field, titleKey) {
	    const allEntries = core.buildFacetCounts(data.records, field.id);
	    const entries = allEntries.slice(0, 10);
	    const max = Math.max(1, ...entries.map(entry => entry.count));
	    const rows = entries.map(entry => create('div', { className: 'ta-rank-row ta-static-row' },
	      create('span', { className: 'ta-rank-name', text: entry.name }),
	      create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entry.count / max * 100}%` } })),
	      create('strong', { className: 'ta-rank-count', text: String(entry.count) })
	    ));
	    const populatedSources = new Set(allEntries.flatMap(entry => [...entry.items])).size;
	    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t(titleKey) }), create('span', { text: `${field.label} · ${this.t('populatedSources', { count: populatedSources })}` })),
	      rows.length ? create('div', { className: 'ta-rank-list' }, rows) : this.emptyState('search', this.t('noCategoryData'), field.label))
	  }

	  renderCollections(data) {
	    const counts = new Map();
	    for (const record of data.records) for (const list of record.lists) {
	      const key = String(list.id);
	      const entry = counts.get(key) || { ...list, count: 0 };
	      entry.count += 1;
	      counts.set(key, entry);
	    }
	    const entries = [...counts.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path, this.locale)).slice(0, 10);
	    const max = Math.max(1, ...entries.map(entry => entry.count));
	    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t('collections') }), create('span', { text: this.t('folderDistribution') })),
	      entries.length ? create('div', { className: 'ta-rank-list' }, entries.map(entry => create('button', { className: 'ta-rank-row', type: 'button', title: entry.path, onclick: () => { this.settings.listId = String(entry.id); this.persist(); this.renderAll(); } },
	        create('span', { className: 'ta-rank-name', text: entry.path }),
	        create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entry.count / max * 100}%` } })),
	        create('strong', { className: 'ta-rank-count', text: String(entry.count) })
	      ))) : this.emptyState('folder', this.t('noCollections'), this.t('noResultsHint')))
	  }

	  renderRankChart(data) {
	    const entities = data.entities.slice(0, 12);
	    const max = Math.max(1, ...entities.map(entity => entity.count));
	    const rows = entities.map(entity => create('button', { className: 'ta-rank-row', type: 'button', title: this.t('filterEntity', { name: entity.name }), onclick: () => this.searchEntity(entity.name) },
	      create('span', { className: 'ta-rank-name', text: entity.name }),
	      create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entity.count / max * 100}%` } })),
	      create('strong', { className: 'ta-rank-count', text: String(entity.count) })
	    ));
	    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t('topEntities') }), create('span', { text: this.t('clickToSearch') })), rows.length ? create('div', { className: 'ta-rank-list' }, rows) : this.emptyState('search', this.t('noEntities'), this.t('chooseEntityFields')))
	  }

	  renderPeopleChart(data) {
	    const people = data.entities.filter(entity => entity.roles.some(role => role === 'creator' || role === 'audience' || role === 'person'));
	    const max = Math.max(1, ...people.map(entity => entity.count));
	    const rows = people.slice(0, 12).map(entity => create('button', { className: 'ta-rank-row', type: 'button', title: this.t('filterEntity', { name: entity.name }), onclick: () => this.searchEntity(entity.name) },
	      create('span', { className: 'ta-rank-name', text: entity.name }),
	      create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entity.count / max * 100}%` } })),
	      create('strong', { className: 'ta-rank-count', text: String(entity.count) })
	    ));
	    return create('section', { className: 'ta-chart-card' },
	      create('header', {}, create('h2', { text: this.t('people') }), create('span', { text: `${this.t('peopleCreator')} · ${this.t('peopleAudience')}` })),
	      rows.length ? create('div', { className: 'ta-rank-list' }, rows) : this.emptyState('search', this.t('noEntities'), this.t('chooseEntityFields')))
	  }

	  rememberPersonSearch() {
	    const current = String(this.settings.search || '');
	    if (!this.personHistory?.length) {
	      this.personHistory = [current];
	      this.personHistoryIndex = 0;
	    } else if (this.personHistory[this.personHistoryIndex] !== current) {
	      this.personHistory = this.personHistory.slice(0, this.personHistoryIndex + 1);
	      this.personHistory.push(current);
	      this.personHistoryIndex = this.personHistory.length - 1;
	    }
	  }

	  searchEntity(name) {
	    this.rememberPersonSearch();
	    const next = String(name || '');
	    if (next !== this.settings.search) {
	      this.personHistory = this.personHistory.slice(0, this.personHistoryIndex + 1);
	      this.personHistory.push(next);
	      if (this.personHistory.length > 100) this.personHistory.shift();
	      this.personHistoryIndex = this.personHistory.length - 1;
	    }
	    this.applyPersonSearch(next);
	  }

	  applyPersonSearch(value) {
	    clearTimeout(this.renderTimer);
	    this.searchInput.value = value;
	    this.settings.search = value;
	    this.persist();
	    this.renderAll();
	  }

	  navigatePeople(direction) {
	    this.rememberPersonSearch();
	    const next = this.personHistoryIndex + direction;
	    if (next < 0 || next >= this.personHistory.length) return
	    this.personHistoryIndex = next;
	    this.applyPersonSearch(this.personHistory[next]);
	  }

	  attachHistoryNavigation() {
	    this.detachHistoryNavigation();
	    const target = document.defaultView || document;
	    const consume = (event, direction, source) => {
	      if (!this.isOpen) return
	      event.preventDefault();
	      event.stopImmediatePropagation();
	      const now = Date.now();
	      // Some platforms report both a mouse press and an Electron app-command.
	      const previous = this.lastHistoryEvent;
	      if (previous && previous.direction === direction && previous.source !== source && now - previous.time < 200) return
	      this.lastHistoryEvent = { direction, source, time: now };
	      this.navigatePeople(direction);
	    };
	    const mouse = event => {
	      const direction = [3, 8].includes(event.button) ? -1 : [4, 9].includes(event.button) ? 1 : 0;
	      if (!direction || !this.isOpen) return
	      if (event.type === 'mousedown') consume(event, direction, 'mouse');
	      else { event.preventDefault(); event.stopImmediatePropagation(); }
	    };
	    const key = event => {
	      if (event.key === 'BrowserBack' || (event.altKey && event.key === 'ArrowLeft')) consume(event, -1, 'key');
	      else if (event.key === 'BrowserForward' || (event.altKey && event.key === 'ArrowRight')) consume(event, 1, 'key');
	    };
	    const listeners = [
	      ['mousedown', mouse], ['mouseup', mouse], ['auxclick', mouse], ['keydown', key],
	      ['global:back', event => consume(event, -1, 'global')],
	      ['global:forward', event => consume(event, 1, 'global')]
	    ];
	    for (const [name, handler] of listeners) target.addEventListener(name, handler, { capture: true, passive: false });
	    this.historyEventCleanup = () => {
	      for (const [name, handler] of listeners) target.removeEventListener(name, handler, true);
	    };
	  }

	  detachHistoryNavigation() {
	    this.historyEventCleanup?.();
	    this.historyEventCleanup = null;
	    this.lastHistoryEvent = null;
	  }

	  updateNativeButton() {
	    if (!this.nativeButton) return
	    const state = this.win?.store?.getState() || {};
	    const transfer = nativeNavigation(this.settings, state);
	    this.nativeButton.title = [this.t('nativeTransferHelp'), ...transfer.limitations.map(key => this.t(key))].join('\n');
	  }

	  openInLibrary() {
	    const store = this.win?.store;
	    if (!store?.dispatch) return
	    const transfer = nativeNavigation(this.settings, store.getState());
	    store.dispatch(transfer.action);
	    this.close();
	  }

	  renderNetwork(data) {
	    this.settings = this.settings || defaultSettings();
	    const activeLinks = (data.networkLinks || []).slice(0, 240);
	    const nodeIds = new Set(activeLinks.flatMap(link => [link.source, link.target]));
	    const nodes = data.nodes.filter(node => nodeIds.has(node.id)).slice(0, 24);
	    const width = 900;
	    let height = Math.max(640, Math.min(4000, Number(this.settings.networkHeight) || 640));
	    const maxCount = Math.max(1, ...nodes.map(node => Number(node.count) || 0));
	    const nodeRadius = node => 25 * Math.sqrt(Math.max(0, Number(node.count) || 0) / maxCount);
	    const displayedNodeRadius = node => this.settings.networkUniformNodes ? 13 : nodeRadius(node);
	    const displayedLinkWidth = link => this.settings.networkUniformLinks ? 1.6 : Math.min(5, 1 + link.weight);
	    const positions = new Map();
	    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * width / height)));
	    const rows = Math.max(1, Math.ceil(nodes.length / columns));
	    const cellWidth = (width - 150) / columns;
	    const cellHeight = (height - 140) / rows;
	    nodes.forEach((node, i) => {
	      const saved = this.settings.networkPositions?.[node.id];
	      const x = Number(saved?.x), y = Number(saved?.y);
	      const padding = Math.max(34, nodeRadius(node) + 28);
	      positions.set(node.id, Number.isFinite(x) && Number.isFinite(y)
	        ? { x: Math.max(padding, Math.min(width - padding, x)), y: Math.max(padding, Math.min(height - padding, y)) }
	        : { x: 75 + (i % columns + .5) * cellWidth, y: 70 + (Math.floor(i / columns) + .5) * cellHeight });
	    });
	    const namespace = 'http://www.w3.org/2000/svg';
	    const svg = document.createElementNS(namespace, 'svg');
	    svg.setAttribute('class', 'ta-network');
	    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	    svg.style.aspectRatio = `${width} / ${height}`;
	    svg.setAttribute('role', 'img');
	    svg.setAttribute('aria-label', this.t('entityNetwork'));
	    const edges = document.createElementNS(namespace, 'g');
	    edges.setAttribute('class', 'ta-network-edges');
	    const drawn = new Set();
	    const edgeElements = new Map();
	    const nodeElements = new Map();
	    for (const link of activeLinks) {
	      const pair = [link.source, link.target].sort().join('|');
	      if (drawn.has(pair) || !positions.has(link.target) || !positions.has(link.source)) continue
	      drawn.add(pair);
	      const a = positions.get(link.source), b = positions.get(link.target);
	      const edge = document.createElementNS(namespace, 'line');
	      edge.setAttribute('x1', String(a.x));
	      edge.setAttribute('y1', String(a.y));
	      edge.setAttribute('x2', String(b.x));
	      edge.setAttribute('y2', String(b.y));
	      edge.setAttribute('stroke-width', String(displayedLinkWidth(link)));
	      edge.setAttribute('data-weight', String(link.weight));
	      edges.append(edge);
	      edgeElements.set(pair, edge);
	    }
	    svg.append(edges);
	    for (const node of nodes) {
	      const point = positions.get(node.id);
	      const group = document.createElementNS(namespace, 'g');
	      group.setAttribute('class', 'ta-network-node');
	      if (node.roles?.length) group.setAttribute('data-roles', node.roles.join(' '));
	      group.setAttribute('transform', `translate(${point.x} ${point.y})`);
	      group.setAttribute('tabindex', '0');
	      group.setAttribute('role', 'button');
	      const roleNames = (node.roles || []).map(role => this.t(role === 'creator' ? 'creator' : role === 'audience' ? 'audience' : 'people')).join(', ');
	      group.setAttribute('aria-label', `${node.name}: ${node.count}${roleNames ? ` · ${roleNames}` : ''}`);
	      let drag = null;
	      group.addEventListener('pointerdown', event => {
	        if (event.button !== 0) return
	        event.preventDefault();
	        event.stopPropagation();
	        drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
	        group.classList.add('is-dragging');
	        if (group.setPointerCapture && event.pointerId != null) group.setPointerCapture(event.pointerId);
	      });
	      group.addEventListener('pointermove', event => {
	        if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return
	        const rect = svg.getBoundingClientRect();
	        const matrix = svg.getScreenCTM?.();
	        let next;
	        if (matrix?.inverse && svg.createSVGPoint) {
	          const cursor = svg.createSVGPoint();
	          cursor.x = event.clientX;
	          cursor.y = event.clientY;
	          const mapped = cursor.matrixTransform(matrix.inverse());
	          next = { x: mapped.x, y: mapped.y };
	        } else if (rect.width && rect.height) {
	          next = { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
	        } else return
	        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
	        const padding = Math.max(34, nodeRadius(node) + 28);
	        next.x = Math.max(padding, Math.min(width - padding, next.x));
	        next.y = Math.max(padding, Math.min(height - padding, next.y));
	        positions.set(node.id, next);
	        group.setAttribute('transform', `translate(${next.x} ${next.y})`);
	        for (const link of activeLinks) {
	          if (link.source !== node.id && link.target !== node.id) continue
	          const pair = [link.source, link.target].sort().join('|');
	          const edge = edgeElements.get(pair);
	          const source = positions.get(link.source), target = positions.get(link.target);
	          if (!edge || !source || !target) continue
	          edge.setAttribute('x1', String(source.x));
	          edge.setAttribute('y1', String(source.y));
	          edge.setAttribute('x2', String(target.x));
	          edge.setAttribute('y2', String(target.y));
	        }
	      });
	      const finishDrag = event => {
	        if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return
	        if (group.releasePointerCapture && event.pointerId != null && group.hasPointerCapture?.(event.pointerId)) group.releasePointerCapture(event.pointerId);
	        if (drag.moved) {
	          group.dataset.moved = 'true';
	          this.settings.networkPositions = this.settings.networkPositions || {};
	          this.settings.networkPositions[node.id] = { ...positions.get(node.id) };
	          arrangedActive = false;
	          this.settings.networkLayoutSignature = null;
	          untangle.classList.remove('is-active');
	          untangle.setAttribute('aria-pressed', 'false');
	          this.persist();
	        }
	        drag = null;
	        group.classList.remove('is-dragging');
	      };
	      group.addEventListener('pointerup', finishDrag);
	      group.addEventListener('pointercancel', finishDrag);
	      group.addEventListener('click', () => {
	        if (group.dataset.moved === 'true') { delete group.dataset.moved; return }
	        this.searchEntity(node.name);
	      });
	      group.addEventListener('keydown', event => {
	        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.searchEntity(node.name); }
	      });
	      const circle = document.createElementNS(namespace, 'circle');
	      const radius = displayedNodeRadius(node);
	      circle.setAttribute('r', String(displayedNodeRadius(node)));
	      circle.setAttribute('data-source-count', String(node.count));
	      const label = document.createElementNS(namespace, 'text');
	      label.setAttribute('y', String(radius + 16));
	      label.textContent = node.name.length > 14 ? `${node.name.slice(0, 12)}…` : node.name;
	      const title = document.createElementNS(namespace, 'title');
	      title.textContent = `${node.name} · ${node.count} ${this.t(node.count === 1 ? 'sourceCountLabel' : 'sourcesCountLabel')}`;
	      group.append(circle, label, title);
	      nodeElements.set(node.id, group);
	      svg.append(group);
	    }
	    const layoutSignature = JSON.stringify([nodes.map(node => node.id), activeLinks.map(link => [link.source, link.target])]);
	    let arrangedActive = this.settings.networkLayoutSignature === layoutSignature;
	    const sizeHelp = create('span', { className: 'ta-network-size-help', text: this.t(this.settings.networkUniformNodes ? 'uniformNodesHelp' : 'nodeSizeHelp') });
	    const legend = create('div', { className: 'ta-network-legend' },
	      create('span', {}, create('i', { className: 'ta-legend-dot ta-role-creator' }), create('span', { text: this.t('creator') })),
	      create('span', {}, create('i', { className: 'ta-legend-dot ta-role-audience' }), create('span', { text: this.t('audience') })),
	      create('span', {}, create('i', { className: 'ta-legend-dot ta-role-person' }), create('span', { text: this.t('people') })),
	      sizeHelp
	    );
	    const untangle = create('button', {
	      className: `ta-button ta-network-control ta-network-untangle${arrangedActive ? ' is-active' : ''}`,
	      'aria-pressed': String(arrangedActive),
	      type: 'button',
	      title: this.t('untangleHelp'),
	      text: this.t('untangleNetwork'),
	      onclick: () => {
	        let arranged;
	        if (arrangedActive && this.settings.networkBeforeUntangle) {
	          arranged = new Map(nodes.map(node => [node.id, this.settings.networkBeforeUntangle[node.id] || positions.get(node.id)]));
	          height = Math.max(640, this.settings.networkBeforeHeight || 640);
	          arrangedActive = false;
	        } else {
	          this.settings.networkBeforeUntangle = Object.fromEntries([...positions].map(([id, point]) => [id, { ...point }]));
	          this.settings.networkBeforeHeight = height;
	          arranged = untangleNetworkPositions(nodes, activeLinks, width, 640, displayedNodeRadius);
	          height = arranged.height;
	          arrangedActive = true;
	        }
	        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	        svg.style.aspectRatio = `${width} / ${height}`;
	        this.settings.networkHeight = height;
	        this.settings.networkLayoutSignature = arrangedActive ? layoutSignature : null;
	        untangle.classList.toggle('is-active', arrangedActive);
	        untangle.setAttribute('aria-pressed', String(arrangedActive));
	        for (const node of nodes) {
	          const point = arranged.get(node.id);
	          positions.set(node.id, point);
	          nodeElements.get(node.id)?.setAttribute('transform', `translate(${point.x} ${point.y})`);
	        }
	        for (const link of activeLinks) {
	          const pair = [link.source, link.target].sort().join('|');
	          const edge = edgeElements.get(pair);
	          const source = positions.get(link.source), target = positions.get(link.target);
	          if (!edge || !source || !target) continue
	          edge.setAttribute('x1', String(source.x));
	          edge.setAttribute('y1', String(source.y));
	          edge.setAttribute('x2', String(target.x));
	          edge.setAttribute('y2', String(target.y));
	        }
	        this.settings.networkPositions = { ...(this.settings.networkPositions || {}) };
	        for (const node of nodes) this.settings.networkPositions[node.id] = { ...positions.get(node.id) };
	        this.persist();
	      }
	    });
	    const toggleButton = (key, label, help, update) => {
	      const button = create('button', {
	        className: `ta-button ta-network-control ta-network-option${this.settings[key] ? ' is-active' : ''}`,
	        type: 'button', title: this.t(help), text: this.t(label),
	        'aria-pressed': String(Boolean(this.settings[key])),
	        onclick: () => {
	          this.settings[key] = !this.settings[key];
	          button.classList.toggle('is-active', this.settings[key]);
	          button.setAttribute('aria-pressed', String(this.settings[key]));
	          update();
	          this.persist();
	        }
	      });
	      return button
	    };
	    const nodeSizeOption = toggleButton('networkUniformNodes', 'uniformNodes', 'uniformNodesHelp', () => {
	      sizeHelp.textContent = this.t(this.settings.networkUniformNodes ? 'uniformNodesHelp' : 'nodeSizeHelp');
	      for (const node of nodes) {
	        const group = nodeElements.get(node.id);
	        group?.querySelector('circle')?.setAttribute('r', String(displayedNodeRadius(node)));
	        group?.querySelector('text')?.setAttribute('y', String(displayedNodeRadius(node) + 16));
	      }
	    });
	    const linkWidthOption = toggleButton('networkUniformLinks', 'uniformLinks', 'uniformLinksHelp', () => {
	      for (const [pair, edge] of edgeElements) {
	        const link = activeLinks.find(entry => [entry.source, entry.target].sort().join('|') === pair);
	        if (link) edge.setAttribute('stroke-width', String(displayedLinkWidth(link)));
	      }
	    });
	    const header = create('header', { className: 'ta-network-header' },
	      create('div', { className: 'ta-network-header-copy' },
	        create('h2', { text: this.t('entityNetwork') }),
	        create('span', { text: this.t('cooccurrenceHelp') })
	      ),
	      nodes.length ? create('div', { className: 'ta-network-actions' }, nodeSizeOption, linkWidthOption, untangle) : null
	    );
	    return create('section', { className: 'ta-chart-card' }, header, nodes.length ? [legend, svg] : this.emptyState('search', this.t('noConnections'), this.t('connectionHint')))
	  }

	  emptyState(iconName, title, text) {
	    return create('div', { className: 'ta-empty' },
	      icon(iconName),
	      create('h2', { text: title }),
	      text ? create('p', { text }) : null
	    )
	  }

	  toggleGroup(key) {
	    const collapsed = new Set(this.settings.collapsedGroups.map(String));
	    if (collapsed.has(String(key))) collapsed.delete(String(key));
	    else collapsed.add(String(key));
	    this.settings.collapsedGroups = [...collapsed];
	    this.persist();
	    this.scheduleRender(0);
	  }

	  renderGroup(group, state, { className = '', label = null } = {}) {
	    const key = String(group.key);
	    const collapsed = this.settings.collapsedGroups.includes(key);
	    const listId = `ta-period-${key.replace(/[^a-z0-9_-]/gi, '-')}`;
	    return create('section', {
	      className: `ta-period ${className} ${collapsed ? 'collapsed' : ''}`.trim(),
	      dataset: { year: String(group.date.year), groupKey: group.key }
	    },
	    create('header', { className: 'ta-period-header' },
	      create('button', {
	        className: 'ta-period-toggle',
	        type: 'button',
	        title: collapsed ? this.t('expandPeriod') : this.t('collapsePeriod'),
	        ariaLabel: collapsed ? this.t('expandPeriod') : this.t('collapsePeriod'),
	        'aria-expanded': String(!collapsed),
	        'aria-controls': listId,
	        onclick: () => this.toggleGroup(key)
	      },
	      create('h2', { text: label || formatGroup(group, this.settings.granularity, this.locale) }),
	      icon('chevron', 'ta-collapse-icon')),
	      create('span', { className: 'ta-period-count', text: String(group.records.length) })
	    ),
	    create('div', {
	      id: listId,
	      className: 'ta-card-list',
	      hidden: collapsed ? '' : null
	    }, group.records.map(record => this.renderCard(record, state))))
	  }

	  renderCard(record, state) {
	    const src = thumbnailUrl(record, state, this.win.args);
	    const thumbnail = src ? create('figure', { className: 'ta-thumbnail' },
	      create('img', {
	        src,
	        alt: '',
	        loading: 'lazy',
	        onerror: event => event.currentTarget.closest('.ta-thumbnail')?.classList.add('missing')
	      })
	    ) : null;

	    const title = record.title === `#${record.id}`
	      ? `${this.t('untitled')} #${record.id}`
	      : record.title;
	    const titleButton = create('button', {
	      className: 'ta-document-title',
	      type: 'button',
	      text: title,
	      title: this.t('openDocument'),
	      onclick: () => this.openDocument(record.id)
	    });

	    const badges = create('div', { className: 'ta-card-badges' });
	    for (const tag of record.tags.slice(0, 5)) {
	      badges.append(create('span', { className: 'ta-tag-badge' },
	        create('span', { className: 'ta-tag-dot', style: { backgroundColor: tagColor(tag.color) } }),
	        create('span', { text: tag.name })
	      ));
	    }
	    if (record.tags.length > 5) badges.append(create('span', { className: 'ta-more', text: `+${record.tags.length - 5}` }));

	    const list = record.lists[0];
	    const secondary = this.secondaryMetadata(record);
	    const details = create('div', { className: 'ta-card-details' },
	      list ? create('span', { className: 'ta-list-path', title: list.path }, icon('folder'), create('span', { text: list.path })) : null,
	      ...secondary.map(entry => create('span', { title: entry.label },
	        create('strong', { text: `${entry.label}: ` }), create('span', { text: entry.value })))
	    );

	    const shownDate = record.rawDate || formatDateParts(record.date, this.locale);
	    return create('article', { className: 'ta-card', dataset: { itemId: String(record.id) } },
	      create('div', { className: 'ta-card-date', title: record.rawDate }, shownDate),
	      create('span', { className: 'ta-axis-dot' }),
	      create('div', { className: 'ta-card-surface' },
	        thumbnail,
	        create('div', { className: 'ta-card-body' }, titleButton, details, badges)
	      )
	    )
	  }

	  secondaryMetadata(record) {
	    const preferred = [
	      'http://purl.org/dc/elements/1.1/creator',
	      'http://purl.org/dc/elements/1.1/type',
	      'http://purl.org/dc/elements/1.1/source'
	    ];
	    const fields = this.lastData?.fields || [];
	    const order = [
	      ...preferred,
	      ...fields.map(field => field.id)
	    ];
	    const seen = new Set([this.settings.titleField, this.settings.dateField, 'id']);
	    const output = [];
	    for (const id of order) {
	      if (seen.has(id)) continue
	      seen.add(id);
	      const value = core.textOf(record.metadata?.[id]).trim();
	      if (!value) continue
	      const label = fields.find(field => field.id === id)?.label || id.split(/[\/#]/).pop();
	      output.push({ label, value });
	      if (output.length === 2) break
	    }
	    return output
	  }

	  openDocument(id) {
	    this.returnAvailable = true;
	    this.close();
	    this.win.store.dispatch({
	      type: 'item.open',
	      payload: { id },
	      meta: { cmd: 'project' }
	    });
	    this.scheduleEnsureLauncher();
	  }

	  unload() {
	    if (this.isDuplicate) return
	    this.detachHistoryNavigation();
	    clearTimeout(this.renderTimer);
	    if (this.ensureTimer) cancelAnimationFrame(this.ensureTimer);
	    this.unsubscribe?.();
	    this.observer?.disconnect();
	    if (this.handleToggle) this.win?.removeListener('toggle', this.handleToggle);
	    if (this.handleSettingsUpdate) this.win?.removeListener('settings.update', this.handleSettingsUpdate);
	    if (this.handleKeydown) document.removeEventListener('keydown', this.handleKeydown, true);
	    this.panel?.remove();
	    this.launcher?.remove();
	    this.returnButton?.remove();
	    this.stylesheet?.remove();
	    document.body.classList.remove('ta-analytics-open');
	    if (globalThis.__tropyAnalyticsPlugin === this) {
	      delete globalThis.__tropyAnalyticsPlugin;
	    }
	  }
	}

	plugin$1 = AnalyticsPlugin;
	return plugin$1;
}

var pluginExports = requirePlugin();
const plugin = /*@__PURE__*/getDefaultExportFromCjs(pluginExports);

module.exports = plugin;
