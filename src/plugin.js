'use strict'

const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const core = require('./analytics-core.js')
const nativeNavigation = require('./native-navigation.js')
const untangleNetworkPositions = require('./graph-layout.js')
const { translator } = require('./i18n.js')

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
})

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
})

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
]

const NO_VALUE_OPERATORS = new Set(['exists', 'not-exists'])

function create(tag, attributes = {}, ...children) {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes || {})) {
    if (value == null) continue
    if (name === 'className') element.className = value
    else if (name === 'text') element.textContent = value
    else if (name === 'html') element.innerHTML = value
    else if (name === 'dataset') Object.assign(element.dataset, value)
    else if (name === 'style') Object.assign(element.style, value)
    else if (name === 'checked') element.checked = Boolean(value)
    else if (name === 'selected') element.selected = Boolean(value)
    else if (name === 'disabled') element.disabled = Boolean(value)
    else if (name === 'value') element.value = value
    else if (name === 'tabIndex') element.tabIndex = value
    else if (name === 'title') element.title = value
    else if (name === 'ariaLabel') element.setAttribute('aria-label', value)
    else if (name === 'role') element.setAttribute('role', value)
    else if (name === 'type') element.type = value
    else if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), value)
    } else element.setAttribute(name, value)
  }

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue
    element.append(child instanceof Node ? child : document.createTextNode(String(child)))
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
    hint ? create('span', { className: 'ta-hint', text: hint }) : null
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
  const base = defaultSettings()
  if (!value || typeof value !== 'object') return base
  const settings = { ...base, ...value }
  if ((value.settingsSchema || 0) < 2) settings.showUndated = true
  settings.settingsSchema = 2
  settings.entityFields = Array.isArray(value.entityFields) ? value.entityFields : []
  settings.fieldMappings = value.fieldMappings && typeof value.fieldMappings === 'object' ? value.fieldMappings : {}
  settings.facetFields = value.facetFields && typeof value.facetFields === 'object' ? value.facetFields : {}
  settings.visibleCharts = Array.isArray(value.visibleCharts) ? value.visibleCharts : base.visibleCharts
  settings.networkPositions = value.networkPositions && typeof value.networkPositions === 'object' ? value.networkPositions : {}
  settings.chartMappingsOpen = Boolean(value.chartMappingsOpen)
  settings.networkUniformNodes = Boolean(value.networkUniformNodes)
  settings.networkUniformLinks = Boolean(value.networkUniformLinks)
  settings.includeTags = Array.isArray(value.includeTags) ? value.includeTags : []
  settings.excludeTags = Array.isArray(value.excludeTags) ? value.excludeTags : []
  settings.collapsedGroups = Array.isArray(value.collapsedGroups)
    ? value.collapsedGroups.map(String)
    : []
  settings.density = ['comfortable', 'compact', 'condensed'].includes(value.density)
    ? value.density
    : base.density
  settings.conditions = Array.isArray(value.conditions)
    ? value.conditions.filter(condition => condition && typeof condition === 'object').map(condition => ({
      mode: condition.mode === 'exclude' ? 'exclude' : 'include',
      field: condition.field || core.INTERNAL_FIELDS.ALL,
      operator: OPERATORS.some(([operator]) => operator === condition.operator) ? condition.operator : 'contains',
      value: String(condition.value ?? '')
    }))
    : []
  return settings
}

function formatDateParts(parsed, locale, style = 'long') {
  if (!parsed) return ''
  if (parsed.precision === 'year') return String(parsed.year)
  const value = new Date(Date.UTC(2000, parsed.month - 1, parsed.day))
  value.setUTCFullYear(parsed.year)
  const options = parsed.precision === 'month'
    ? { year: 'numeric', month: style === 'short' ? 'short' : 'long', timeZone: 'UTC' }
    : { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }
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
  const key = String(color || '').trim().replace(/^color-/, '')
  const fallback = TAG_COLOR_FALLBACKS[key]
  return fallback ? `var(--color-${key}, ${fallback})` : 'var(--color-gray, #999)'
}

function thumbnailUrl(record, state, args) {
  const photoId = record.item?.photos?.[0]
  if (photoId == null || !args?.cache || !state?.project?.id) return null
  return pathToFileURL(join(args.cache, String(state.project.id), `${photoId}_512.webp`)).href
}

class AnalyticsPlugin {
  constructor(options, context) {
    this.options = options || {}
    this.context = context
    this.win = context?.window
    this.locale = this.win?.args?.locale || navigator.language || 'en'
    this.dark = this.detectDarkTheme()
    this.t = translator(this.locale)
    this.mapping = this.readMappings()
    this.settings = defaultSettings()
    this.projectKey = null
    this.unsubscribe = null
    this.panel = null
    this.launcher = null
    this.renderTimer = null
    this.ensureTimer = null
    this.lastStateRefs = null
    this.lastNavMode = null
    this.returnAvailable = false
    this.returnButton = null

    if (!this.win || this.win.type !== 'project') return
    if (globalThis.__tropyAnalyticsPlugin) {
      this.isDuplicate = true
      return
    }
    globalThis.__tropyAnalyticsPlugin = this

    this.injectStylesheet()
    this.handleToggle = state => {
      if (state === 'ready') this.connect()
    }
    this.handleSettingsUpdate = settings => {
      if (typeof settings?.dark === 'boolean') {
        this.dark = settings.dark
        this.applyTheme()
      }
      if (typeof settings?.theme === 'string') {
        this.dark = /dark/i.test(settings.theme)
        this.applyTheme()
      }

      if (!settings?.locale || settings.locale === this.locale) return
      this.locale = settings.locale
      this.t = translator(this.locale)
      if (this.launcher) {
        this.launcher.title = this.t('openAnalytics')
        this.launcher.setAttribute('aria-label', this.t('openAnalytics'))
      }
      if (this.returnButton) {
        this.returnButton.title = this.t('backToAnalytics')
        this.returnButton.setAttribute('aria-label', this.t('backToAnalytics'))
      }
      if (this.panel) {
        const wasOpen = this.isOpen
        this.detachHistoryNavigation()
        this.panel.remove()
        document.removeEventListener('keydown', this.handleKeydown, true)
        this.panel = null
        this.handleKeydown = null
        if (wasOpen) this.open()
      }
    }
    this.win.on('toggle', this.handleToggle)
    this.win.on('settings.update', this.handleSettingsUpdate)

    this.themeObserver = new MutationObserver(() => {
      this.dark = this.detectDarkTheme()
      this.applyTheme()
    })
    const themeAttributes = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'theme'] }
    this.themeObserver.observe(document.documentElement, themeAttributes)
    this.themeObserver.observe(document.body, themeAttributes)
    this.observer = new MutationObserver(() => {
      this.scheduleEnsureLauncher()
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
    this.scheduleEnsureLauncher()
    if (this.win.store) this.connect()
  }

  detectDarkTheme() {
    if (typeof this.win?.args?.dark === 'boolean') return this.win.args.dark
    if (typeof this.win?.args?.theme === 'string') return /dark/i.test(this.win.args.theme)
    const roots = [document.documentElement, document.body].filter(Boolean)
    const classNames = roots.map(root => `${typeof root.className === 'string' ? root.className : root.className?.baseVal || ''} ${root.getAttribute?.('data-theme') || ''} ${root.getAttribute?.('theme') || ''}`)
    if (classNames.some(name => /(?:^|[\s_-])(dark|night)(?:$|[\s_-])/i.test(name))) return true
    if (classNames.some(name => /(?:^|[\s_-])light(?:$|[\s_-])/i.test(name))) return false

    const styles = roots.map(root => getComputedStyle(root))
    if (styles.some(style => style.colorScheme?.includes('dark'))) return true
    if (styles.some(style => style.colorScheme?.includes('light'))) return false
    for (const style of styles) {
      const match = style.backgroundColor.match(/\d+(?:\.\d+)?/g)
      if (match?.length >= 3 && (match.length < 4 || Number(match[3]) > 0)) {
        const [r, g, b] = match.slice(0, 3).map(Number)
        return r * 0.2126 + g * 0.7152 + b * 0.0722 < 110
      }
    }
    return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  }

  readMappings() {
    const options = this.options || {}
    const read = (keys, fallback) => {
      for (const key of keys) {
        const value = options?.[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
      return fallback
    }
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
    const saved = this.settings?.fieldMappings || {}
    const get = (key, fallback) => Object.hasOwn(saved, key)
      ? (saved[key] === '__auto' ? fallback : saved[key] === '__none' ? '' : saved[key])
      : fallback
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
    const mapping = this.activeMappings()
    const fields = core.ensureStandardPeopleFields(core.buildFieldCatalog(state, this.locale))
    const byId = new Map(fields.map(field => [String(field.id), field]))
    const resolveRole = (id, role) => (id && byId.get(String(id))) || fields.find(field => core.fieldRole(field) === role) || byId.get(role === 'creator' ? core.DC_CREATOR : core.DC_AUDIENCE)
    const creator = resolveRole(mapping.creator, 'creator')
    const audience = resolveRole(mapping.audience, 'audience')
    const person = mapping.otherPerson ? byId.get(String(mapping.otherPerson)) : null
    const effectivePeople = [creator?.id, audience?.id, person?.id].filter(Boolean).map(String)
    const effectiveMapping = { ...mapping, creator: creator?.id || mapping.creator, audience: audience?.id || mapping.audience, otherPerson: person?.id || '' }
    const explicitPeople = [...new Set([...effectivePeople, ...this.settings.entityFields].filter(Boolean))]
      .map(id => byId.get(String(id)) || { id, label: String(id).split(/[\/#]/).pop(), count: 0, types: [], role: 'person' })
    const people = [...new Map([...fields.filter(field => ['creator', 'audience', 'person'].includes(field.role || core.fieldRole(field))), ...explicitPeople]
      .map(field => [String(field.id), { ...field, role: String(field.id) === String(effectiveMapping.creator) ? 'creator' : String(field.id) === String(effectiveMapping.audience) ? 'audience' : field.role || core.fieldRole(field) || 'person' }])).values()]
    const facets = { ...(this.options?.facets || {}), ...(this.settings.facetFields || {}) }
    const placeField = facets.place || mapping.place || ''
    const typeField = facets.sourceType || mapping.sourceType || ''
    for (const [id, label] of [[placeField, this.t('places')], [typeField, this.t('sourceTypes')]]) {
      if (id && !fields.some(field => String(field.id) === String(id))) fields.push({ id, label: String(id).split(/[\/#]/).pop() || label, count: 0, types: [] })
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
    })
    document.head.append(this.stylesheet)
  }

  connect() {
    if (!this.win?.store || this.unsubscribe) {
      this.scheduleEnsureLauncher()
      return
    }
    this.unsubscribe = this.win.store.subscribe(() => this.handleStoreChange())
    this.handleStoreChange(true)
    this.scheduleEnsureLauncher()
  }

  handleStoreChange(force = false) {
    const state = this.win.store.getState()
    const navMode = state?.nav?.mode
    const refs = [state.items, state.metadata, state.lists, state.tags, state.ontology, state.project?.id]
    const changed = force || !this.lastStateRefs || refs.some((value, index) => value !== this.lastStateRefs[index])
    this.lastStateRefs = refs
    this.updateProjectSettings(state)
    this.updateLauncher(state)
    if (this.lastNavMode === 'item' && navMode !== 'item' && this.returnAvailable && !this.isOpen) {
      this.returnAvailable = false
    }
    this.lastNavMode = navMode
    this.ensureReturnButton(state)
    if (changed && this.isOpen) this.scheduleRender()
  }

  updateProjectSettings(state) {
    const id = state?.project?.id
    if (id == null || String(id) === this.projectKey) return
    this.projectKey = String(id)
    this.personHistory = []
    this.personHistoryIndex = -1
    try {
      this.settings = safeSettings(JSON.parse(localStorage.getItem(this.storageKey)))
    } catch {
      this.settings = defaultSettings()
    }
    this.hydrateDefaults(state)
  }

  get storageKey() {
    return `tropy.analytics.${this.projectKey || 'none'}`
  }

  hydrateDefaults(state) {
    const fields = core.ensureStandardPeopleFields(core.buildFieldCatalog(state, this.locale))
    if (!fields.some(field => field.id === this.settings.dateField)) {
      this.settings.dateField = core.defaultField(fields, 'date')
    }
    if (!fields.some(field => field.id === this.settings.titleField)) {
      this.settings.titleField = core.defaultField(fields, 'title')
    }
  }

  persist() {
    if (!this.projectKey) return
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings))
    } catch (error) {
      this.context?.logger?.warn?.({ error }, 'Analytics could not save its filters')
    }
  }

  scheduleEnsureLauncher() {
    if (this.ensureTimer) return
    this.ensureTimer = requestAnimationFrame(() => {
      this.ensureTimer = null
      this.ensureLauncher()
    })
  }

  ensureLauncher() {
    const host = document.querySelector('#project-view .items > header .toolbar-right')
    if (host && !this.launcher?.isConnected) {
      this.launcher = create('button', {
        className: 'btn btn-icon ta-launcher',
        type: 'button',
        tabIndex: -1,
        title: this.t('openAnalytics'),
        ariaLabel: this.t('openAnalytics'),
        onclick: () => this.open()
      }, icon('analytics', 'icon'))
      host.insertBefore(this.launcher, host.firstChild)
      this.updateLauncher(this.win?.store?.getState())
    }
    this.ensureReturnButton(this.win?.store?.getState())
  }

  ensureReturnButton(state = this.win?.store?.getState()) {
    const shouldShow = this.returnAvailable && state?.nav?.mode === 'item'
    if (!shouldShow) {
      this.returnButton?.remove()
      this.returnButton = null
      return
    }

    const host = document.querySelector('.item-view .titlebar .toolbar-left .tool-group')
    if (!host || this.returnButton?.isConnected) return

    this.returnButton = create('button', {
      className: 'btn btn-md btn-icon ta-return-analytics',
      type: 'button',
      tabIndex: -1,
      title: this.t('backToAnalytics'),
      ariaLabel: this.t('backToAnalytics'),
      onmousedown: event => event.preventDefault(),
      onclick: event => {
        event.preventDefault()
        this.open()
      }
    }, icon('analytics', 'icon'))
    host.append(this.returnButton)
  }

  updateLauncher(state) {
    if (!this.launcher) return
    this.launcher.disabled = !state?.project?.id
    this.launcher.classList.toggle('disabled', !state?.project?.id)
  }

  get isOpen() {
    return Boolean(this.panel && !this.panel.hidden)
  }

  open() {
    const state = this.win?.store?.getState()
    if (!state?.project?.id) return
    this.updateProjectSettings(state)
    this.hydrateDefaults(state)
    if (!this.panel) this.buildPanel()
    this.panel.hidden = false
    document.body.classList.add('ta-analytics-open')
    this.searchInput.value = this.settings.search
    this.renderAll()
    this.panel.querySelector('.ta-search-input')?.focus()
  }

  close() {
    if (!this.panel) return
    this.panel.hidden = true
    document.body.classList.remove('ta-analytics-open')
    const state = this.win?.store?.getState()
    const target = state?.nav?.mode === 'item' && this.returnAvailable
      ? this.returnButton
      : this.launcher
    target?.focus()
  }

  buildPanel() {
    this.detachHistoryNavigation()
    this.panel = create('section', {
      className: 'ta-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': this.t('analytics')
    })

    this.filterButton = create('button', {
      className: 'ta-icon-button ta-filter-toggle',
      type: 'button',
      title: this.t('hideFilters'),
      ariaLabel: this.t('hideFilters'),
      onclick: () => {
        this.settings.filtersOpen = !this.settings.filtersOpen
        this.applyFilterVisibility()
        this.persist()
      }
    }, icon('filter'))

    this.summary = create('div', { className: 'ta-heading-summary', 'aria-live': 'polite' })
    const brand = create('div', { className: 'ta-brand' },
      icon('analytics', 'ta-brand-icon'),
      create('div', {},
        create('h1', { text: this.t('analytics') }),
        this.summary
      )
    )

    this.searchInput = create('input', {
      className: 'ta-input ta-search-input',
      type: 'search',
      value: this.settings.search,
      placeholder: this.t('searchPlaceholder'),
      ariaLabel: this.t('search'),
      oninput: event => {
        this.settings.search = event.target.value
        this.updateNativeButton()
        this.persist()
        this.scheduleRender(100)
      }
    })
    this.nativeButton = create('button', {
      className: 'ta-button ta-open-native', type: 'button',
      'aria-label': this.t('openInLibrary'),
      onclick: () => this.openInLibrary()
    }, icon('folder'), create('span', { text: this.t('openInLibrary') }))
    const search = create('div', { className: 'ta-search-actions' },
      create('div', { className: 'ta-search' }, icon('search'), this.searchInput), this.nativeButton)

    const reset = create('button', {
      className: 'ta-button ta-button-subtle',
      type: 'button',
      title: this.t('reset'),
      onclick: () => this.reset()
    }, icon('reset'), create('span', { text: this.t('reset') }))

    const close = create('button', {
      className: 'ta-icon-button',
      type: 'button',
      title: this.t('close'),
      ariaLabel: this.t('close'),
      onclick: () => this.close()
    }, icon('close'))

    const header = create('header', { className: 'ta-header' },
      create('div', { className: 'ta-header-left' }, this.filterButton, brand),
      search,
      create('div', { className: 'ta-header-actions' }, reset, close)
    )

    this.sidebar = create('aside', { className: 'ta-sidebar', 'aria-label': this.t('filters') })
    this.viewbar = create('div', { className: 'ta-viewbar' })
    this.histogram = create('div', { className: 'ta-histogram' })
    this.analytics = create('div', { className: 'ta-analytics' })
    this.scroller = create('div', { className: 'ta-scroller' }, this.analytics)
    const content = create('main', { className: 'ta-content' }, this.viewbar, this.histogram, this.scroller)
    this.shell = create('div', { className: 'ta-shell' }, this.sidebar, content)
    this.panel.append(header, this.shell)
    document.body.append(this.panel)
    this.applyTheme()

    this.handleKeydown = event => {
      if (!this.isOpen) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        this.close()
      }
    }
    document.addEventListener('keydown', this.handleKeydown, true)
    this.attachHistoryNavigation()
    this.updateNativeButton()
    this.applyFilterVisibility()
  }

  applyFilterVisibility() {
    if (!this.shell) return
    this.shell.classList.toggle('ta-filters-closed', !this.settings.filtersOpen)
    this.filterButton.classList.toggle('active', this.settings.filtersOpen)
    const key = this.settings.filtersOpen ? 'hideFilters' : 'showFilters'
    this.filterButton.title = this.t(key)
    this.filterButton.setAttribute('aria-label', this.t(key))
  }

  applyTheme() {
    if (!this.panel) return
    const dark = this.dark == null
      ? Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
      : this.dark
    this.panel.classList.toggle('ta-theme-dark', dark)
    this.panel.classList.toggle('ta-theme-light', !dark)
  }

  reset() {
    const state = this.win.store.getState()
    this.settings = defaultSettings()
    this.hydrateDefaults(state)
    this.persist()
    this.searchInput.value = ''
    this.renderAll()
  }

  renderAll() {
    if (!this.isOpen) return
    const state = this.win.store.getState()
    this.hydrateDefaults(state)
    this.renderSidebar(state)
    this.renderResults(state)
    this.updateNativeButton()
    this.applyFilterVisibility()
  }

  scheduleRender(delay = 40) {
    clearTimeout(this.renderTimer)
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null
      if (this.isOpen) this.renderResults(this.win.store.getState())
    }, delay)
  }

  changeSetting(key, value, { sidebar = false } = {}) {
    this.settings[key] = value
    this.persist()
    if (sidebar) this.renderSidebar(this.win.store.getState())
    this.scheduleRender(0)
  }

  makeSelect(values, current, onChange, className = 'ta-select') {
    const select = create('select', {
      className,
      onchange: event => onChange(event.target.value)
    })
    for (const [value, label] of values) select.append(option(value, label, String(value) === String(current)))
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
    ].filter(Boolean).map(String))
    const catalog = new Map([...core.buildFieldCatalog(state, this.locale),
      ...analysisFields.peopleFields].map(field => [String(field.id), field]))
    for (const id of selected) {
      if (!id.startsWith('__') && !catalog.has(id)) {
        catalog.set(id, { id, label: id.split(/[\/#]/).pop() || id, count: 0, types: [] })
      }
    }
    return [...catalog.values()].filter(field => field.count > 0 || selected.has(String(field.id)))
      .map(field => field.count > 0 ? field : { ...field, label: `${field.label} (0)` })
  }

  renderSidebar(state) {
    const active = document.activeElement
    const focusKey = active?.dataset?.focusKey
    const selectionStart = active?.selectionStart
    const analysisFields = this.fieldsForAnalysis(state)
    const fields = this.sidebarFields(state, analysisFields)
    const lists = core.flattenLists(state.lists, this.locale)
    const tags = Object.values(state.tags || {}).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), this.locale))

    this.sidebar.replaceChildren()
    this.sidebar.append(create('div', { className: 'ta-sidebar-heading' },
      create('h2', { text: this.t('filters') }),
      create('button', {
        className: 'ta-link-button',
        type: 'button',
        text: this.t('reset'),
        onclick: () => this.reset()
      })
    ))

    const dateValues = [
      [core.INTERNAL_FIELDS.CREATED, this.t('created')],
      [core.INTERNAL_FIELDS.MODIFIED, this.t('modified')],
      ...fields
        .slice()
        .sort((a, b) => Number(b.isDate) - Number(a.isDate) || a.label.localeCompare(b.label, this.locale))
        .map(field => [field.id, field.label])
    ]
    const titleValues = fields
      .slice()
      .sort((a, b) => Number(b.isTitle) - Number(a.isTitle) || a.label.localeCompare(b.label, this.locale))
      .map(field => [field.id, field.label])
    const propertyFields = fields.slice().sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.label.localeCompare(b.label, this.locale))
    const propertyValues = propertyFields.map(field => [String(field.id), `${field.label}${field.count ? ` (${field.count})` : ''}`])
    const automaticMapping = {
      creator: fields.find(field => core.fieldRole(field) === 'creator'),
      audience: fields.find(field => core.fieldRole(field) === 'audience')
    }
    const mappingValues = {
      creator: [['__auto', automaticMapping.creator?.label || this.t('creatorField')], ...propertyValues],
      audience: [['__auto', automaticMapping.audience?.label || this.t('audienceField')], ...propertyValues],
      otherPerson: [['__auto', this.t('recognizedPeople')], ['__none', this.t('notUsed')], ...propertyValues],
      place: [['__auto', this.t('placeField')], ...propertyValues],
      sourceType: [['__auto', this.t('sourceTypeField')], ...propertyValues]
    }
    const settingSelect = (key, label) => {
      const select = this.makeSelect(mappingValues[key], this.settings.fieldMappings[key] || '__auto', value => this.changeFieldMapping(key, value))
      select.dataset.focusKey = `chart-mapping-${key}`
      const row = controlGroup(label, select)
      row.classList.add('ta-mapping-row')
      return row
    }
    const chartToggles = [
      ['time', this.t('recordsOverTime')], ['types', this.t('sourceTypes')], ['places', this.t('places')],
      ['collections', this.t('collections')], ['people', this.t('people')], ['network', this.t('entityNetwork')]
    ].map(([key, label]) => {
      const selected = this.settings.visibleCharts.includes(key)
      return create('label', { className: `ta-checkbox ta-chart-toggle ${selected ? 'is-selected' : 'is-unselected'}` },
        create('input', { type: 'checkbox', checked: selected, 'aria-label': label, onchange: event => {
          const row = event.target.closest('.ta-chart-toggle')
          row?.classList.toggle('is-selected', event.target.checked)
          row?.classList.toggle('is-unselected', !event.target.checked)
          const status = row?.querySelector('.ta-chart-toggle-status')
          if (status) status.textContent = this.t(event.target.checked ? 'chartShown' : 'chartHidden')
          this.changeChartVisibility(key, event.target.checked)
        } }),
        create('span', { className: 'ta-chart-toggle-label', text: label }),
        create('span', { className: 'ta-chart-toggle-status', text: this.t(selected ? 'chartShown' : 'chartHidden') })
      )
    })
    const chartMappings = create('details', {
      className: 'ta-chart-mappings',
      open: this.settings.chartMappingsOpen ? '' : null,
      ontoggle: event => {
        const isOpen = event.currentTarget.open
        if (this.settings.chartMappingsOpen === isOpen) return
        this.settings.chartMappingsOpen = isOpen
        this.persist()
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
    ))
    const chartSettings = create('section', { className: 'ta-filter-section ta-chart-settings' },
      create('h3', { text: this.t('chartsToShow') }),
      create('div', { className: 'ta-chart-toggles' }, chartToggles),
      chartMappings
    )
    const entityCandidates = analysisFields.peopleFields
      .filter(field => fields.some(candidate => String(candidate.id) === String(field.id)))
      .map(field => ({ ...field, label: fields.find(candidate => String(candidate.id) === String(field.id)).label }))
    const mappedPeople = [analysisFields.roleFields.creator, analysisFields.roleFields.audience, analysisFields.roleFields.otherPerson].filter(Boolean).map(String)
    const mappingSignature = mappedPeople.join('|')
    if (!this.settings.peopleFieldsInitialized || this.settings.peopleMappingSignature !== mappingSignature) {
      const previouslyMapped = new Set((this.settings.mappedEntityFields || []).map(String))
      const manual = this.settings.entityFields.map(String).filter(id => !previouslyMapped.has(id))
      this.settings.entityFields = [...new Set([...mappedPeople, ...manual])]
      this.settings.mappedEntityFields = mappedPeople
      this.settings.peopleMappingSignature = mappingSignature
      this.settings.peopleFieldsInitialized = true
      this.persist()
    }
    const entitySelect = create('div', { className: 'ta-field-checks' })
    for (const field of entityCandidates) {
      const isSelected = this.settings.entityFields.includes(String(field.id))
      const role = field.role || core.fieldRole(field)
      const roleLabel = role === 'creator' ? this.t('creator') : role === 'audience' ? this.t('audience') : role === 'person' ? this.t('people') : ''
      entitySelect.append(create('label', { className: `ta-checkbox ta-person-field ${isSelected ? 'is-selected' : 'is-unselected'}` },
        create('input', { type: 'checkbox', checked: isSelected, onchange: event => {
          this.settings.entityFields = event.target.checked
            ? [...new Set([...this.settings.entityFields, String(field.id)])]
            : this.settings.entityFields.filter(id => id !== String(field.id))
          const row = event.target.closest('.ta-person-field')
          row?.classList.toggle('is-selected', event.target.checked)
          row?.classList.toggle('is-unselected', !event.target.checked)
          const status = row?.querySelector('.ta-person-field-status')
          if (status) status.textContent = this.t(event.target.checked ? 'includedInCharts' : 'excludedFromCharts')
          this.persist()
          this.scheduleRender(0)
        } }),
        create('span', { className: 'ta-person-field-name', title: field.label, text: `${field.label}${field.count ? ` · ${field.count}` : ''}` }),
        roleLabel ? create('span', { className: `ta-person-role ta-role-${role}`, text: roleLabel }) : null,
        create('span', { className: 'ta-person-field-status', text: this.t(isSelected ? 'includedInCharts' : 'excludedFromCharts') })
      ))
    }

    const dateSelect = this.makeSelect(dateValues, this.settings.dateField,
      value => this.changeSetting('dateField', value))
    const titleSelect = this.makeSelect(titleValues, this.settings.titleField,
      value => this.changeSetting('titleField', value))

    const listSelect = this.makeSelect([
      ['', this.t('allProject')],
      ...lists.map(list => [list.id, `${'\u00a0\u00a0'.repeat(list.depth)}${list.name}`])
    ], this.settings.listId, value => this.changeSetting('listId', value))

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
    )

    const from = create('input', {
      className: 'ta-input',
      type: 'text',
      value: this.settings.from,
      placeholder: this.t('from'),
      dataset: { focusKey: 'date-from' },
      oninput: event => this.changeSetting('from', event.target.value)
    })
    const to = create('input', {
      className: 'ta-input',
      type: 'text',
      value: this.settings.to,
      placeholder: this.t('to'),
      dataset: { focusKey: 'date-to' },
      oninput: event => this.changeSetting('to', event.target.value)
    })
    const dateOrder = this.makeSelect([
      ['DMY', this.t('dmy')], ['MDY', this.t('mdy')]
    ], this.settings.dateOrder, value => this.changeSetting('dateOrder', value))

    const range = create('section', { className: 'ta-filter-section' },
      create('h3', { text: this.t('dateRange') }),
      create('div', { className: 'ta-range' },
        controlGroup(this.t('from'), from),
        controlGroup(this.t('to'), to)
      ),
      controlGroup(this.t('dateOrder'), dateOrder)
    )

    const tagCloud = create('div', { className: 'ta-tag-cloud' })
    for (const tag of tags) {
      const id = String(tag.id)
      const tagState = this.settings.includeTags.map(String).includes(id)
        ? 'include'
        : this.settings.excludeTags.map(String).includes(id) ? 'exclude' : 'neutral'
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
      ))
    }

    const tagMode = this.makeSelect([
      ['all', this.t('allTags')], ['any', this.t('anyTag')]
    ], this.settings.tagMode, value => this.changeSetting('tagMode', value))

    const tagSection = create('section', { className: 'ta-filter-section' },
      create('h3', { text: this.t('tags') }),
      create('p', { className: 'ta-help', text: this.t('tagsHelp') }),
      tagCloud,
      controlGroup(this.t('tagMode'), tagMode)
    )

    const conditions = create('section', { className: 'ta-filter-section ta-conditions' },
      create('h3', { text: this.t('conditions') }),
      create('p', { className: 'ta-help', text: this.t('conditionsHelp') })
    )

    const conditionMode = this.makeSelect([
      ['all', this.t('matchAll')], ['any', this.t('matchAny')]
    ], this.settings.conditionMode, value => this.changeSetting('conditionMode', value))
    conditions.append(controlGroup(this.t('matchConditions'), conditionMode))

    const conditionFields = [
      [core.INTERNAL_FIELDS.ALL, this.t('allMetadata')],
      [core.INTERNAL_FIELDS.TITLE, this.t('itemTitle')],
      [core.INTERNAL_FIELDS.DATE, this.t('itemDate')],
      [core.INTERNAL_FIELDS.CREATED, this.t('created')],
      [core.INTERNAL_FIELDS.MODIFIED, this.t('modified')],
      [core.INTERNAL_FIELDS.TAGS, this.t('itemTags')],
      [core.INTERNAL_FIELDS.LISTS, this.t('itemLists')],
      ...fields.map(field => [field.id, field.label])
    ]

    const rows = create('div', { className: 'ta-condition-list' })
    this.settings.conditions.forEach((condition, index) => {
      rows.append(this.renderCondition(condition, index, conditionFields))
    })
    conditions.append(rows, create('button', {
      className: 'ta-button ta-add-condition',
      type: 'button',
      onclick: () => {
        this.settings.conditions.push({
          mode: 'include', field: core.INTERNAL_FIELDS.ALL, operator: 'contains', value: ''
        })
        this.persist()
        this.renderSidebar(state)
      }
    }, icon('plus'), create('span', { text: this.t('addCondition') })))

    const showUndated = create('label', { className: 'ta-checkbox' },
      create('input', {
        type: 'checkbox',
        checked: this.settings.showUndated,
        onchange: event => this.changeSetting('showUndated', event.target.checked)
      }),
      create('span', { text: this.t('showUndated') })
    )

    this.sidebar.append(chartSettings, scope, range, tagSection, conditions,
      create('section', { className: 'ta-filter-section' }, showUndated))

    if (focusKey) {
      const next = this.sidebar.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)
      next?.focus()
      if (Number.isInteger(selectionStart) && next?.setSelectionRange) {
        next.setSelectionRange(selectionStart, selectionStart)
      }
    }
  }

  changeFieldMapping(key, value) {
    this.settings.fieldMappings[key] = value
    if (['creator', 'audience', 'otherPerson'].includes(key)) this.settings.peopleFieldsInitialized = false
    this.persist()
    const state = this.win.store.getState()
    this.renderSidebar(state)
    this.scheduleRender(0)
  }

  changeChartVisibility(key, visible) {
    const selected = new Set(this.settings.visibleCharts)
    if (visible) selected.add(key)
    else selected.delete(key)
    this.settings.visibleCharts = [...selected]
    this.persist()
    this.scheduleRender(0)
  }

  renderCondition(condition, index, fields) {
    const mode = this.makeSelect([
      ['include', this.t('include')], ['exclude', this.t('exclude')]
    ], condition.mode, value => this.updateCondition(index, 'mode', value), 'ta-select ta-condition-mode')
    const field = this.makeSelect(fields, condition.field,
      value => this.updateCondition(index, 'field', value), 'ta-select ta-condition-field')
    const operator = this.makeSelect(OPERATORS.map(([value, label]) => [value, this.t(label)]),
      condition.operator, value => this.updateCondition(index, 'operator', value, true), 'ta-select ta-condition-operator')
    const value = create('input', {
      className: 'ta-input ta-condition-value',
      type: 'text',
      value: condition.value,
      placeholder: this.t('value'),
      disabled: NO_VALUE_OPERATORS.has(condition.operator),
      dataset: { focusKey: `condition-${index}` },
      oninput: event => this.updateCondition(index, 'value', event.target.value)
    })
    const remove = create('button', {
      className: 'ta-icon-button ta-remove-condition',
      type: 'button',
      title: this.t('removeCondition'),
      ariaLabel: this.t('removeCondition'),
      onclick: () => {
        this.settings.conditions.splice(index, 1)
        this.persist()
        this.renderSidebar(this.win.store.getState())
        this.scheduleRender(0)
      }
    }, icon('remove'))
    return create('div', { className: `ta-condition-row ${condition.mode}` }, mode, field, operator, value, remove)
  }

  updateCondition(index, key, value, rerender = false) {
    if (!this.settings.conditions[index]) return
    this.settings.conditions[index][key] = value
    this.persist()
    if (rerender) this.renderSidebar(this.win.store.getState())
    this.scheduleRender(0)
  }

  cycleTag(id, button) {
    id = String(id)
    const included = new Set(this.settings.includeTags.map(String))
    const excluded = new Set(this.settings.excludeTags.map(String))
    if (included.has(id)) {
      included.delete(id)
      excluded.add(id)
    } else if (excluded.has(id)) {
      excluded.delete(id)
    } else included.add(id)
    this.settings.includeTags = [...included]
    this.settings.excludeTags = [...excluded]
    this.persist()
    const tagState = included.has(id) ? 'include' : excluded.has(id) ? 'exclude' : 'neutral'
    const target = button || [...(this.sidebar?.querySelectorAll('.ta-tag-filter') || [])]
      .find(element => element.dataset.tagId === id)
    if (target) {
      target.classList.remove('include', 'exclude', 'neutral')
      target.classList.add(tagState)
      const name = target.dataset.tagName || ''
      target.title = tagState === 'include' ? this.t('includeTag') : tagState === 'exclude' ? this.t('excludeTag') : name
      target.setAttribute('aria-pressed', tagState === 'exclude' ? 'mixed' : String(tagState === 'include'))
      const status = target.querySelector('.ta-tag-state')
      if (status) status.textContent = tagState === 'include' ? '+' : tagState === 'exclude' ? '-' : ''
    }
    this.scheduleRender(0)
  }

  renderViewbar(data) {
    this.viewbar.replaceChildren()
    const countText = data.records.length === 1
      ? this.t('resultOne')
      : this.t('results', { count: data.records.length })
    const status = create('div', { className: 'ta-results-status' },
      create('strong', { text: countText }),
      create('span', { text: this.t('scopeCount', { count: data.scoped }) }),
      data.undated.length ? create('span', { text: this.t(this.settings.showUndated ? 'includedUndatedCount' : 'undatedCount', { count: data.undated.length }) }) : null
    )
    const allYears = Object.values(this.win.store.getState()?.items || {})
      .filter(item => item && !item.deleted)
      .map(item => {
        const metadata = this.win.store.getState()?.metadata?.[item.id] || {}
        const value = this.settings.dateField === core.INTERNAL_FIELDS.CREATED
          ? item.created
          : this.settings.dateField === core.INTERNAL_FIELDS.MODIFIED
            ? item.modified
            : metadata[this.settings.dateField]
        return core.parseDate(value, this.settings.dateOrder)?.year
      })
      .filter(Number.isFinite)
    const yearMin = allYears.length ? Math.min(...allYears) : 0
    const yearMax = allYears.length ? Math.max(...allYears) : 0
    const selectedFrom = this.settings.from ? core.parseDate(this.settings.from)?.year : yearMin
    const selectedTo = this.settings.to ? core.parseDate(this.settings.to)?.year : yearMax
    const slider = create('div', { className: 'ta-time-range' },
      create('strong', { text: this.t('timeWindow') }),
      create('div', { className: 'ta-time-labels' }, create('span', { text: String(selectedFrom || '—') }), create('span', { text: String(selectedTo || '—') })),
      create('div', { className: 'ta-dual-range' },
        create('input', { type: 'range', min: yearMin, max: Math.max(yearMin + 1, yearMax), value: selectedFrom || yearMin, 'aria-label': this.t('from'), oninput: event => this.updateYearRange(event.target.value, this.rangeUpper?.value) }),
        create('input', { type: 'range', min: yearMin, max: Math.max(yearMin + 1, yearMax), value: selectedTo || yearMax, 'aria-label': this.t('to'), oninput: event => this.updateYearRange(this.rangeLower?.value, event.target.value) })
      ),
      create('button', { className: 'ta-link-button ta-clear-range', type: 'button', text: this.t('clearRange'), onclick: () => { this.settings.from = ''; this.settings.to = ''; this.persist(); this.renderAll() } })
    )
    this.rangeLower = slider.querySelector('input:first-of-type')
    this.rangeUpper = slider.querySelector('input:last-of-type')
    this.viewbar.append(status, slider)
  }

  updateYearRange(from, to) {
    const low = Number(from)
    const high = Number(to)
    if (!Number.isFinite(low) || !Number.isFinite(high)) return
    this.settings.from = `${Math.min(low, high)}-01-01`
    this.settings.to = `${Math.max(low, high)}-12-31`
    this.persist()
    const labels = this.panel.querySelectorAll('.ta-time-labels span')
    if (labels[0]) labels[0].textContent = String(Math.min(low, high))
    if (labels[1]) labels[1].textContent = String(Math.max(low, high))
    clearTimeout(this.renderTimer)
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null
      if (this.isOpen) this.renderResults(this.win.store.getState())
    }, 120)
  }

  zoomToYear(start, end = start) {
    this.settings.from = `${start}-01-01`
    this.settings.to = `${end}-12-31`
    this.persist()
    this.renderAll()
  }

  renderHistogram(records) {
    this.histogram.replaceChildren()
    const datedRecords = records.filter(record => record.date)
    if (datedRecords.length < 1) {
      this.histogram.hidden = true
      return
    }
    this.histogram.hidden = false
    const buckets = core.buildHistogram(datedRecords)
    const max = Math.max(...buckets.map(bucket => bucket.count), 1)
    const chart = create('div', { className: 'ta-chart', role: 'list' })
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
      create('span', { className: 'ta-chart-label', text: bucket.label }))
      chart.append(bar)
    }
    this.histogram.append(chart)
  }

  renderResults(state) {
    if (!this.isOpen) return
    this.updateNativeButton()
    const scrollTop = this.scroller?.scrollTop || 0
    const analysis = this.fieldsForAnalysis(state)
    const entityFields = this.settings.entityFields.map(String)
    const data = core.buildAnalyticsData(state, {
      ...this.settings,
      entityFields,
      entityFieldsSet: true,
      includeUndated: this.settings.showUndated,
      roleFields: { creator: analysis.roleFields.creator, audience: analysis.roleFields.audience, person: analysis.roleFields.otherPerson },
      locale: this.locale
    })
    this.lastData = data
    this.renderViewbar(data)
    this.renderHistogram(data.records)
    this.analytics.replaceChildren()

    const countText = data.records.length === 1
      ? this.t('resultOne')
      : this.t('results', { count: data.records.length })
    const years = data.records.filter(record => record.date).map(record => record.date.year)
    const range = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : ''
    this.summary.textContent = range ? `${countText} | ${range}` : countText

    if (!data.records.length) {
      this.analytics.append(this.emptyState('filter', this.t('noResults'), this.t('noResultsHint')))
      return
    }
    const charts = this.visibleCharts()
    this.analytics.append(...[
      this.renderSummaryCards(data),
      charts.has('time') ? this.renderTrendChart(data) : null,
      charts.has('types') || charts.has('places') ? this.renderCategoryCharts(data, charts) : null,
      charts.has('collections') ? this.renderCollections(data) : null,
      charts.has('people') ? this.renderPeopleChart(data) : null,
      charts.has('network') ? this.renderNetwork(data) : null
    ].filter(Boolean))
    this.scroller.scrollTop = Math.min(scrollTop, Math.max(0, this.scroller.scrollHeight - this.scroller.clientHeight))
  }

  renderSummaryCards(data) {
    const count = data.records.length
    const dated = data.records.filter(record => record.date).length
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
    const byYear = new Map()
    for (const record of data.records) if (record.date) byYear.set(record.date.year, (byYear.get(record.date.year) || 0) + 1)
    const years = [...byYear].sort((a, b) => a[0] - b[0])
    const max = Math.max(1, ...years.map(([, count]) => count))
    const chart = create('div', { className: 'ta-bars', role: 'img', ariaLabel: this.t('recordsOverTime') })
    for (const [year, count] of years) {
      const bar = create('button', { className: 'ta-bar', type: 'button', title: `${year}: ${count}`, ariaLabel: `${year}: ${count}`, onclick: () => this.zoomToYear(year) },
        create('span', { className: 'ta-bar-fill', style: { height: `${Math.max(3, count / max * 120)}px` } }),
        create('span', { className: 'ta-bar-label', text: String(year) }))
      chart.append(bar)
    }
    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t('recordsOverTime') }), create('span', { text: this.t('clickYear') })), chart)
  }

  renderCategoryCharts(data, visible = new Set(['types', 'places'])) {
    const mapping = this.activeMappings()
    const candidates = data.fields.filter(field => /(^|\s)(type|format|genre|coverage|spatial|place|location|geographic|geographical)(\s|$)/i.test(`${field.label} ${field.id}`))
    const primary = (mapping.sourceType ? [data.fields.find(field => String(field.id) === String(mapping.sourceType))].filter(Boolean) : candidates.filter(field => /(^|\s)(type|format|genre)(\s|$)/i.test(`${field.label} ${field.id}`))).slice(0, 1)
    const places = (mapping.place ? [data.fields.find(field => String(field.id) === String(mapping.place))].filter(Boolean) : candidates.filter(field => /(^|\s)(coverage|spatial|place|location|geographic|geographical)(\s|$)/i.test(`${field.label} ${field.id}`))).slice(0, 1)
    const charts = [
      ...(visible.has('types') ? primary.map(field => this.renderCategoryChart(data, field, 'sourceTypes')) : []),
      ...(visible.has('places') ? places.map(field => this.renderCategoryChart(data, field, 'places')) : [])
    ]
    return charts.length ? create('div', { className: 'ta-chart-grid' }, charts) : null
  }

  renderCategoryChart(data, field, titleKey) {
    const allEntries = core.buildFacetCounts(data.records, field.id)
    const entries = allEntries.slice(0, 10)
    const max = Math.max(1, ...entries.map(entry => entry.count))
    const rows = entries.map(entry => create('div', { className: 'ta-rank-row ta-static-row' },
      create('span', { className: 'ta-rank-name', text: entry.name }),
      create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entry.count / max * 100}%` } })),
      create('strong', { className: 'ta-rank-count', text: String(entry.count) })
    ))
    const populatedSources = new Set(allEntries.flatMap(entry => [...entry.items])).size
    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t(titleKey) }), create('span', { text: `${field.label} · ${this.t('populatedSources', { count: populatedSources })}` })),
      rows.length ? create('div', { className: 'ta-rank-list' }, rows) : this.emptyState('search', this.t('noCategoryData'), field.label))
  }

  renderCollections(data) {
    const counts = new Map()
    for (const record of data.records) for (const list of record.lists) {
      const key = String(list.id)
      const entry = counts.get(key) || { ...list, count: 0 }
      entry.count += 1
      counts.set(key, entry)
    }
    const entries = [...counts.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path, this.locale)).slice(0, 10)
    const max = Math.max(1, ...entries.map(entry => entry.count))
    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t('collections') }), create('span', { text: this.t('folderDistribution') })),
      entries.length ? create('div', { className: 'ta-rank-list' }, entries.map(entry => create('button', { className: 'ta-rank-row', type: 'button', title: entry.path, onclick: () => { this.settings.listId = String(entry.id); this.persist(); this.renderAll() } },
        create('span', { className: 'ta-rank-name', text: entry.path }),
        create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entry.count / max * 100}%` } })),
        create('strong', { className: 'ta-rank-count', text: String(entry.count) })
      ))) : this.emptyState('folder', this.t('noCollections'), this.t('noResultsHint')))
  }

  renderRankChart(data) {
    const entities = data.entities.slice(0, 12)
    const max = Math.max(1, ...entities.map(entity => entity.count))
    const rows = entities.map(entity => create('button', { className: 'ta-rank-row', type: 'button', title: this.t('filterEntity', { name: entity.name }), onclick: () => this.searchEntity(entity.name) },
      create('span', { className: 'ta-rank-name', text: entity.name }),
      create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entity.count / max * 100}%` } })),
      create('strong', { className: 'ta-rank-count', text: String(entity.count) })
    ))
    return create('section', { className: 'ta-chart-card' }, create('header', {}, create('h2', { text: this.t('topEntities') }), create('span', { text: this.t('clickToSearch') })), rows.length ? create('div', { className: 'ta-rank-list' }, rows) : this.emptyState('search', this.t('noEntities'), this.t('chooseEntityFields')))
  }

  renderPeopleChart(data) {
    const people = data.entities.filter(entity => entity.roles.some(role => role === 'creator' || role === 'audience' || role === 'person'))
    const max = Math.max(1, ...people.map(entity => entity.count))
    const rows = people.slice(0, 12).map(entity => create('button', { className: 'ta-rank-row', type: 'button', title: this.t('filterEntity', { name: entity.name }), onclick: () => this.searchEntity(entity.name) },
      create('span', { className: 'ta-rank-name', text: entity.name }),
      create('span', { className: 'ta-rank-track' }, create('span', { className: 'ta-rank-fill', style: { width: `${entity.count / max * 100}%` } })),
      create('strong', { className: 'ta-rank-count', text: String(entity.count) })
    ))
    return create('section', { className: 'ta-chart-card' },
      create('header', {}, create('h2', { text: this.t('people') }), create('span', { text: `${this.t('peopleCreator')} · ${this.t('peopleAudience')}` })),
      rows.length ? create('div', { className: 'ta-rank-list' }, rows) : this.emptyState('search', this.t('noEntities'), this.t('chooseEntityFields')))
  }

  rememberPersonSearch() {
    const current = String(this.settings.search || '')
    if (!this.personHistory?.length) {
      this.personHistory = [current]
      this.personHistoryIndex = 0
    } else if (this.personHistory[this.personHistoryIndex] !== current) {
      this.personHistory = this.personHistory.slice(0, this.personHistoryIndex + 1)
      this.personHistory.push(current)
      this.personHistoryIndex = this.personHistory.length - 1
    }
  }

  searchEntity(name) {
    this.rememberPersonSearch()
    const next = String(name || '')
    if (next !== this.settings.search) {
      this.personHistory = this.personHistory.slice(0, this.personHistoryIndex + 1)
      this.personHistory.push(next)
      if (this.personHistory.length > 100) this.personHistory.shift()
      this.personHistoryIndex = this.personHistory.length - 1
    }
    this.applyPersonSearch(next)
  }

  applyPersonSearch(value) {
    clearTimeout(this.renderTimer)
    this.searchInput.value = value
    this.settings.search = value
    this.persist()
    this.renderAll()
  }

  navigatePeople(direction) {
    this.rememberPersonSearch()
    const next = this.personHistoryIndex + direction
    if (next < 0 || next >= this.personHistory.length) return
    this.personHistoryIndex = next
    this.applyPersonSearch(this.personHistory[next])
  }

  attachHistoryNavigation() {
    this.detachHistoryNavigation()
    const target = document.defaultView || document
    const consume = (event, direction, source) => {
      if (!this.isOpen) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const now = Date.now()
      // Some platforms report both a mouse press and an Electron app-command.
      const previous = this.lastHistoryEvent
      if (previous && previous.direction === direction && previous.source !== source && now - previous.time < 200) return
      this.lastHistoryEvent = { direction, source, time: now }
      this.navigatePeople(direction)
    }
    const mouse = event => {
      const direction = [3, 8].includes(event.button) ? -1 : [4, 9].includes(event.button) ? 1 : 0
      if (!direction || !this.isOpen) return
      if (event.type === 'mousedown') consume(event, direction, 'mouse')
      else { event.preventDefault(); event.stopImmediatePropagation() }
    }
    const key = event => {
      if (event.key === 'BrowserBack' || (event.altKey && event.key === 'ArrowLeft')) consume(event, -1, 'key')
      else if (event.key === 'BrowserForward' || (event.altKey && event.key === 'ArrowRight')) consume(event, 1, 'key')
    }
    const listeners = [
      ['mousedown', mouse], ['mouseup', mouse], ['auxclick', mouse], ['keydown', key],
      ['global:back', event => consume(event, -1, 'global')],
      ['global:forward', event => consume(event, 1, 'global')]
    ]
    for (const [name, handler] of listeners) target.addEventListener(name, handler, { capture: true, passive: false })
    this.historyEventCleanup = () => {
      for (const [name, handler] of listeners) target.removeEventListener(name, handler, true)
    }
  }

  detachHistoryNavigation() {
    this.historyEventCleanup?.()
    this.historyEventCleanup = null
    this.lastHistoryEvent = null
  }

  updateNativeButton() {
    if (!this.nativeButton) return
    const state = this.win?.store?.getState() || {}
    const transfer = nativeNavigation(this.settings, state)
    this.nativeButton.title = [this.t('nativeTransferHelp'), ...transfer.limitations.map(key => this.t(key))].join('\n')
  }

  openInLibrary() {
    const store = this.win?.store
    if (!store?.dispatch) return
    const transfer = nativeNavigation(this.settings, store.getState())
    store.dispatch(transfer.action)
    this.close()
  }

  renderNetwork(data) {
    this.settings = this.settings || defaultSettings()
    const activeLinks = (data.networkLinks || []).slice(0, 240)
    const nodeIds = new Set(activeLinks.flatMap(link => [link.source, link.target]))
    const nodes = data.nodes.filter(node => nodeIds.has(node.id)).slice(0, 24)
    const width = 900
    let height = Math.max(640, Math.min(4000, Number(this.settings.networkHeight) || 640))
    const maxCount = Math.max(1, ...nodes.map(node => Number(node.count) || 0))
    const nodeRadius = node => 25 * Math.sqrt(Math.max(0, Number(node.count) || 0) / maxCount)
    const displayedNodeRadius = node => this.settings.networkUniformNodes ? 13 : nodeRadius(node)
    const displayedLinkWidth = link => this.settings.networkUniformLinks ? 1.6 : Math.min(5, 1 + link.weight)
    const positions = new Map()
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * width / height)))
    const rows = Math.max(1, Math.ceil(nodes.length / columns))
    const cellWidth = (width - 150) / columns
    const cellHeight = (height - 140) / rows
    nodes.forEach((node, i) => {
      const saved = this.settings.networkPositions?.[node.id]
      const x = Number(saved?.x), y = Number(saved?.y)
      const padding = Math.max(34, nodeRadius(node) + 28)
      positions.set(node.id, Number.isFinite(x) && Number.isFinite(y)
        ? { x: Math.max(padding, Math.min(width - padding, x)), y: Math.max(padding, Math.min(height - padding, y)) }
        : { x: 75 + (i % columns + .5) * cellWidth, y: 70 + (Math.floor(i / columns) + .5) * cellHeight })
    })
    const namespace = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(namespace, 'svg')
    svg.setAttribute('class', 'ta-network')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.style.aspectRatio = `${width} / ${height}`
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', this.t('entityNetwork'))
    const edges = document.createElementNS(namespace, 'g')
    edges.setAttribute('class', 'ta-network-edges')
    const drawn = new Set()
    const edgeElements = new Map()
    const nodeElements = new Map()
    for (const link of activeLinks) {
      const pair = [link.source, link.target].sort().join('|')
      if (drawn.has(pair) || !positions.has(link.target) || !positions.has(link.source)) continue
      drawn.add(pair)
      const a = positions.get(link.source), b = positions.get(link.target)
      const edge = document.createElementNS(namespace, 'line')
      edge.setAttribute('x1', String(a.x))
      edge.setAttribute('y1', String(a.y))
      edge.setAttribute('x2', String(b.x))
      edge.setAttribute('y2', String(b.y))
      edge.setAttribute('stroke-width', String(displayedLinkWidth(link)))
      edge.setAttribute('data-weight', String(link.weight))
      edges.append(edge)
      edgeElements.set(pair, edge)
    }
    svg.append(edges)
    for (const node of nodes) {
      const point = positions.get(node.id)
      const group = document.createElementNS(namespace, 'g')
      group.setAttribute('class', 'ta-network-node')
      if (node.roles?.length) group.setAttribute('data-roles', node.roles.join(' '))
      group.setAttribute('transform', `translate(${point.x} ${point.y})`)
      group.setAttribute('tabindex', '0')
      group.setAttribute('role', 'button')
      const roleNames = (node.roles || []).map(role => this.t(role === 'creator' ? 'creator' : role === 'audience' ? 'audience' : 'people')).join(', ')
      group.setAttribute('aria-label', `${node.name}: ${node.count}${roleNames ? ` · ${roleNames}` : ''}`)
      let drag = null
      group.addEventListener('pointerdown', event => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false }
        group.classList.add('is-dragging')
        if (group.setPointerCapture && event.pointerId != null) group.setPointerCapture(event.pointerId)
      })
      group.addEventListener('pointermove', event => {
        if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return
        const rect = svg.getBoundingClientRect()
        const matrix = svg.getScreenCTM?.()
        let next
        if (matrix?.inverse && svg.createSVGPoint) {
          const cursor = svg.createSVGPoint()
          cursor.x = event.clientX
          cursor.y = event.clientY
          const mapped = cursor.matrixTransform(matrix.inverse())
          next = { x: mapped.x, y: mapped.y }
        } else if (rect.width && rect.height) {
          next = { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height }
        } else return
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true
        const padding = Math.max(34, nodeRadius(node) + 28)
        next.x = Math.max(padding, Math.min(width - padding, next.x))
        next.y = Math.max(padding, Math.min(height - padding, next.y))
        positions.set(node.id, next)
        group.setAttribute('transform', `translate(${next.x} ${next.y})`)
        for (const link of activeLinks) {
          if (link.source !== node.id && link.target !== node.id) continue
          const pair = [link.source, link.target].sort().join('|')
          const edge = edgeElements.get(pair)
          const source = positions.get(link.source), target = positions.get(link.target)
          if (!edge || !source || !target) continue
          edge.setAttribute('x1', String(source.x))
          edge.setAttribute('y1', String(source.y))
          edge.setAttribute('x2', String(target.x))
          edge.setAttribute('y2', String(target.y))
        }
      })
      const finishDrag = event => {
        if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return
        if (group.releasePointerCapture && event.pointerId != null && group.hasPointerCapture?.(event.pointerId)) group.releasePointerCapture(event.pointerId)
        if (drag.moved) {
          group.dataset.moved = 'true'
          this.settings.networkPositions = this.settings.networkPositions || {}
          this.settings.networkPositions[node.id] = { ...positions.get(node.id) }
          arrangedActive = false
          this.settings.networkLayoutSignature = null
          untangle.classList.remove('is-active')
          untangle.setAttribute('aria-pressed', 'false')
          this.persist()
        }
        drag = null
        group.classList.remove('is-dragging')
      }
      group.addEventListener('pointerup', finishDrag)
      group.addEventListener('pointercancel', finishDrag)
      group.addEventListener('click', () => {
        if (group.dataset.moved === 'true') { delete group.dataset.moved; return }
        this.searchEntity(node.name)
      })
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.searchEntity(node.name) }
      })
      const circle = document.createElementNS(namespace, 'circle')
      const radius = displayedNodeRadius(node)
      circle.setAttribute('r', String(displayedNodeRadius(node)))
      circle.setAttribute('data-source-count', String(node.count))
      const label = document.createElementNS(namespace, 'text')
      label.setAttribute('y', String(radius + 16))
      label.textContent = node.name.length > 14 ? `${node.name.slice(0, 12)}…` : node.name
      const title = document.createElementNS(namespace, 'title')
      title.textContent = `${node.name} · ${node.count} ${this.t(node.count === 1 ? 'sourceCountLabel' : 'sourcesCountLabel')}`
      group.append(circle, label, title)
      nodeElements.set(node.id, group)
      svg.append(group)
    }
    const layoutSignature = JSON.stringify([nodes.map(node => node.id), activeLinks.map(link => [link.source, link.target])])
    let arrangedActive = this.settings.networkLayoutSignature === layoutSignature
    const sizeHelp = create('span', { className: 'ta-network-size-help', text: this.t(this.settings.networkUniformNodes ? 'uniformNodesHelp' : 'nodeSizeHelp') })
    const legend = create('div', { className: 'ta-network-legend' },
      create('span', {}, create('i', { className: 'ta-legend-dot ta-role-creator' }), create('span', { text: this.t('creator') })),
      create('span', {}, create('i', { className: 'ta-legend-dot ta-role-audience' }), create('span', { text: this.t('audience') })),
      create('span', {}, create('i', { className: 'ta-legend-dot ta-role-person' }), create('span', { text: this.t('people') })),
      sizeHelp
    )
    const untangle = create('button', {
      className: `ta-button ta-network-control ta-network-untangle${arrangedActive ? ' is-active' : ''}`,
      'aria-pressed': String(arrangedActive),
      type: 'button',
      title: this.t('untangleHelp'),
      text: this.t('untangleNetwork'),
      onclick: () => {
        let arranged
        if (arrangedActive && this.settings.networkBeforeUntangle) {
          arranged = new Map(nodes.map(node => [node.id, this.settings.networkBeforeUntangle[node.id] || positions.get(node.id)]))
          height = Math.max(640, this.settings.networkBeforeHeight || 640)
          arrangedActive = false
        } else {
          this.settings.networkBeforeUntangle = Object.fromEntries([...positions].map(([id, point]) => [id, { ...point }]))
          this.settings.networkBeforeHeight = height
          arranged = untangleNetworkPositions(nodes, activeLinks, width, 640, displayedNodeRadius)
          height = arranged.height
          arrangedActive = true
        }
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
        svg.style.aspectRatio = `${width} / ${height}`
        this.settings.networkHeight = height
        this.settings.networkLayoutSignature = arrangedActive ? layoutSignature : null
        untangle.classList.toggle('is-active', arrangedActive)
        untangle.setAttribute('aria-pressed', String(arrangedActive))
        for (const node of nodes) {
          const point = arranged.get(node.id)
          positions.set(node.id, point)
          nodeElements.get(node.id)?.setAttribute('transform', `translate(${point.x} ${point.y})`)
        }
        for (const link of activeLinks) {
          const pair = [link.source, link.target].sort().join('|')
          const edge = edgeElements.get(pair)
          const source = positions.get(link.source), target = positions.get(link.target)
          if (!edge || !source || !target) continue
          edge.setAttribute('x1', String(source.x))
          edge.setAttribute('y1', String(source.y))
          edge.setAttribute('x2', String(target.x))
          edge.setAttribute('y2', String(target.y))
        }
        this.settings.networkPositions = { ...(this.settings.networkPositions || {}) }
        for (const node of nodes) this.settings.networkPositions[node.id] = { ...positions.get(node.id) }
        this.persist()
      }
    })
    const toggleButton = (key, label, help, update) => {
      const button = create('button', {
        className: `ta-button ta-network-control ta-network-option${this.settings[key] ? ' is-active' : ''}`,
        type: 'button', title: this.t(help), text: this.t(label),
        'aria-pressed': String(Boolean(this.settings[key])),
        onclick: () => {
          this.settings[key] = !this.settings[key]
          button.classList.toggle('is-active', this.settings[key])
          button.setAttribute('aria-pressed', String(this.settings[key]))
          update()
          this.persist()
        }
      })
      return button
    }
    const nodeSizeOption = toggleButton('networkUniformNodes', 'uniformNodes', 'uniformNodesHelp', () => {
      sizeHelp.textContent = this.t(this.settings.networkUniformNodes ? 'uniformNodesHelp' : 'nodeSizeHelp')
      for (const node of nodes) {
        const group = nodeElements.get(node.id)
        group?.querySelector('circle')?.setAttribute('r', String(displayedNodeRadius(node)))
        group?.querySelector('text')?.setAttribute('y', String(displayedNodeRadius(node) + 16))
      }
    })
    const linkWidthOption = toggleButton('networkUniformLinks', 'uniformLinks', 'uniformLinksHelp', () => {
      for (const [pair, edge] of edgeElements) {
        const link = activeLinks.find(entry => [entry.source, entry.target].sort().join('|') === pair)
        if (link) edge.setAttribute('stroke-width', String(displayedLinkWidth(link)))
      }
    })
    const header = create('header', { className: 'ta-network-header' },
      create('div', { className: 'ta-network-header-copy' },
        create('h2', { text: this.t('entityNetwork') }),
        create('span', { text: this.t('cooccurrenceHelp') })
      ),
      nodes.length ? create('div', { className: 'ta-network-actions' }, nodeSizeOption, linkWidthOption, untangle) : null
    )
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
    const collapsed = new Set(this.settings.collapsedGroups.map(String))
    if (collapsed.has(String(key))) collapsed.delete(String(key))
    else collapsed.add(String(key))
    this.settings.collapsedGroups = [...collapsed]
    this.persist()
    this.scheduleRender(0)
  }

  renderGroup(group, state, { className = '', label = null } = {}) {
    const key = String(group.key)
    const collapsed = this.settings.collapsedGroups.includes(key)
    const listId = `ta-period-${key.replace(/[^a-z0-9_-]/gi, '-')}`
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
    const src = thumbnailUrl(record, state, this.win.args)
    const thumbnail = src ? create('figure', { className: 'ta-thumbnail' },
      create('img', {
        src,
        alt: '',
        loading: 'lazy',
        onerror: event => event.currentTarget.closest('.ta-thumbnail')?.classList.add('missing')
      })
    ) : null

    const title = record.title === `#${record.id}`
      ? `${this.t('untitled')} #${record.id}`
      : record.title
    const titleButton = create('button', {
      className: 'ta-document-title',
      type: 'button',
      text: title,
      title: this.t('openDocument'),
      onclick: () => this.openDocument(record.id)
    })

    const badges = create('div', { className: 'ta-card-badges' })
    for (const tag of record.tags.slice(0, 5)) {
      badges.append(create('span', { className: 'ta-tag-badge' },
        create('span', { className: 'ta-tag-dot', style: { backgroundColor: tagColor(tag.color) } }),
        create('span', { text: tag.name })
      ))
    }
    if (record.tags.length > 5) badges.append(create('span', { className: 'ta-more', text: `+${record.tags.length - 5}` }))

    const list = record.lists[0]
    const secondary = this.secondaryMetadata(record)
    const details = create('div', { className: 'ta-card-details' },
      list ? create('span', { className: 'ta-list-path', title: list.path }, icon('folder'), create('span', { text: list.path })) : null,
      ...secondary.map(entry => create('span', { title: entry.label },
        create('strong', { text: `${entry.label}: ` }), create('span', { text: entry.value })))
    )

    const shownDate = record.rawDate || formatDateParts(record.date, this.locale)
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
    ]
    const fields = this.lastData?.fields || []
    const order = [
      ...preferred,
      ...fields.map(field => field.id)
    ]
    const seen = new Set([this.settings.titleField, this.settings.dateField, 'id'])
    const output = []
    for (const id of order) {
      if (seen.has(id)) continue
      seen.add(id)
      const value = core.textOf(record.metadata?.[id]).trim()
      if (!value) continue
      const label = fields.find(field => field.id === id)?.label || id.split(/[\/#]/).pop()
      output.push({ label, value })
      if (output.length === 2) break
    }
    return output
  }

  openDocument(id) {
    this.returnAvailable = true
    this.close()
    this.win.store.dispatch({
      type: 'item.open',
      payload: { id },
      meta: { cmd: 'project' }
    })
    this.scheduleEnsureLauncher()
  }

  unload() {
    if (this.isDuplicate) return
    this.detachHistoryNavigation()
    clearTimeout(this.renderTimer)
    if (this.ensureTimer) cancelAnimationFrame(this.ensureTimer)
    this.unsubscribe?.()
    this.observer?.disconnect()
    if (this.handleToggle) this.win?.removeListener('toggle', this.handleToggle)
    if (this.handleSettingsUpdate) this.win?.removeListener('settings.update', this.handleSettingsUpdate)
    if (this.handleKeydown) document.removeEventListener('keydown', this.handleKeydown, true)
    this.panel?.remove()
    this.launcher?.remove()
    this.returnButton?.remove()
    this.stylesheet?.remove()
    document.body.classList.remove('ta-analytics-open')
    if (globalThis.__tropyAnalyticsPlugin === this) {
      delete globalThis.__tropyAnalyticsPlugin
    }
  }
}

module.exports = AnalyticsPlugin
