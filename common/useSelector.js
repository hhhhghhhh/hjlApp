// common/useSelector.js
// 选择器逻辑层（mixin）—— 将数据加载、搜索防抖、缓存、分页从 UI 组件中分离
//
// 职责：纯逻辑，不包含任何 DOM / 样式
// UI 组件只负责渲染，通过 this.xxx 调用这些方法与数据

import { getSelectorConfig, normalizeItem } from './selectorConfig'

/**
 * 创建选择器逻辑 mixin
 * @param {Object} defaults 组件级别的默认配置（可被子组件覆盖）
 * @returns {Object} Vue mixin
 */
export function createSelectorMixin(defaults = {}) {
  return {
    props: {
      type:       { type: String,  default: defaults.type || '' },
      value:      { type: [String, Number, Object], default: null },
      parentValue:{ type: [String, Number], default: null },
      disabled:   { type: Boolean, default: false },
      apiUrl:     { type: String,  default: '' },
      apiParams:  { type: Object,  default: () => ({}) },
      dataSource: { type: Array,   default: () => [] },       // 静态数据源
      pageSize:   { type: Number,  default: 20 },
      placeholder:{ type: String,  default: '' },
      requireParent: { type: Boolean, default: false },
      // 显示控制
      showCode:     { type: Boolean, default: false },
      codePosition: { type: String,  default: 'right' },     // 'right' | 'bottom'
      listInline:   { type: Boolean, default: false }
    },

    data() {
      return {
        // 内部状态
        list: [],
        filteredList: [],
        selectedItem: null,
        loading: false,
        pageNo: 1,
        noMore: false,

        // 搜索
        searchState: {},   // 动态 key-value，对应 config.searchConfig.fields

        // 缓存
        _dataCache: new Map(),
        _cachedParams: null,
        _debounceTimer: null,

        // 弹窗
        popupVisible: false
      }
    },

    computed: {
      selectorConfig() {
        return getSelectorConfig(this.type)
      },

      displayText() {
        if (!this.selectedItem) return this.effectivePlaceholder
        return this.selectedItem.name || ''
      },

      displayCode() {
        if (!this.selectedItem) return ''
        return this.selectedItem.code || ''
      },

      effectivePlaceholder() {
        return this.placeholder || this.selectorConfig.placeholder
      },

      effectiveApiUrl() {
        return this.apiUrl || defaults.apiUrl || ''
      },

      // 是否含有搜索关键词
      isSearching() {
        const cfg = this.selectorConfig.searchConfig
        if (!cfg) return false
        return cfg.fields.some(f => !!this.searchState[f.field])
      },

      // 父级缺失
      parentMissing() {
        return this.requireParent && !this.parentValue
      }
    },

    watch: {
      value: {
        immediate: true,
        handler(v) { this._syncSelectedFromValue(v) }
      },

      parentValue: {
        handler(newVal) {
          if (!newVal && this.selectorConfig.cascadeConfig?.clearOnParentChange) {
            this.clearAll()
          } else if (newVal) {
            this._clearCache()
            this.loadData(true)
          }
        }
      },

      dataSource: {
        immediate: true,
        handler(arr) {
          if (arr && arr.length > 0) {
            this.list = arr.map(item => normalizeItem(item, this.selectorConfig))
            this.filteredList = [...this.list]
            this._syncSelectedFromValue(this.value)
          }
        }
      }
    },

    methods: {
      // ── 弹窗控制 ────
      openPopup() {
        if (this.disabled || this.parentMissing) return
        this.popupVisible = true
        this._resetSearch()
        this._restoreOrLoad()
      },

      closePopup() {
        this.popupVisible = false
      },

      // ── 数据加载 ────
      async loadData(resetPage = true) {
        if (this.loading) return

        // 静态数据源
        if (this.dataSource && this.dataSource.length > 0) {
          this.list = this.dataSource.map(item => normalizeItem(item, this.selectorConfig))
          this.filteredList = [...this.list]
          this._syncSelectedFromValue(this.value)
          return
        }

        // 无 API
        if (!this.effectiveApiUrl) return

        this.loading = true
        if (resetPage) { this.pageNo = 1; this.noMore = false }

        try {
          const cfg = this.selectorConfig
          const params = {
            ...this.apiParams,
            pageNo: this.pageNo,
            pageSize: this.pageSize,
            ...cfg.apiParams(this.searchState, this.parentValue)
          }

          const res = await this.$request({ url: this.effectiveApiUrl, method: 'GET', data: params })
          if (!res.data?.success) return

          const records = (res.data.result?.records || res.data.result || [])
            .map(item => normalizeItem(item, cfg))

          if (resetPage) {
            this.list = records
            this._setCache(records)
          } else {
            this.list = [...this.list, ...records]
            this._appendCache(records)
          }

          this.filteredList = [...this.list]
          this._cachedParams = this._snapshotParams()
          this._syncSelectedFromValue(this.value)

          if (records.length < this.pageSize) this.noMore = true
        } catch (e) {
          console.error(`[useSelector] ${this.type} 加载失败:`, e)
        } finally {
          this.loading = false
        }
      },

      async loadMore() {
        if (this.loading || this.noMore || !this.effectiveApiUrl) return
        this.pageNo++
        await this.loadData(false)
      },

      // ── 搜索 ────
      onSearchInput(field, value) {
        this.searchState = { ...this.searchState, [field]: value }
        clearTimeout(this._debounceTimer)
        const debounce = this.selectorConfig.searchConfig?.debounce || 300
        this._debounceTimer = setTimeout(() => {
          if (this.effectiveApiUrl) {
            this.loadData(true)
          } else {
            this._localFilter()
          }
        }, debounce)
      },

      clearSearch() {
        this.searchState = {}
        if (this.effectiveApiUrl) {
          this.loadData(true)
        } else {
          this.filteredList = [...this.list]
        }
      },

      // ── 选择 ────
      selectItem(item) {
        this.selectedItem = item
        this.$emit('input', this._outputValue(item))
        this.$emit('change', this._outputValue(item))
        this.closePopup()
      },

      clearSelection() {
        this.selectedItem = null
        this.$emit('input', null)
        this.$emit('change', null)
        this.$emit('clear')
      },

      clearAll() {
        this.clearSelection()
        this._clearCache()
        this.list = []
        this.filteredList = []
        this.searchState = {}
      },

      // ── 内部方法 ────

      _syncSelectedFromValue(val) {
        if (!val) { this.selectedItem = null; return }
        if (typeof val === 'object') { this.selectedItem = normalizeItem(val, this.selectorConfig); return }

        const idKey = this.selectorConfig.valueField
        const found = this.list.find(item => (item.id ?? item[idKey]) === val)
        this.selectedItem = found || null
      },

      _outputValue(item) {
        const cfg = this.selectorConfig
        return { id: item.id, name: item.name, code: item.code }
      },

      _localFilter() {
        const keys = this.selectorConfig.searchConfig?.localKeys || ['name', 'code']
        const hasKeyword = this.selectorConfig.searchConfig.fields.some(f => this.searchState[f.field])
        if (!hasKeyword) { this.filteredList = [...this.list]; return }

        this.filteredList = this.list.filter(item => {
          return this.selectorConfig.searchConfig.fields.some(f => {
            const kw = (this.searchState[f.field] || '').toLowerCase()
            if (!kw) return false
            return keys.some(k => (item[k] || '').toLowerCase().includes(kw))
          })
        })
      },

      _resetSearch() {
        this.searchState = {}
      },

      _restoreOrLoad() {
        const cacheKey = this._cacheKey()
        const cached = this._dataCache.get(cacheKey)
        if (cached && cached.length > 0) {
          this.list = [...cached]
          this.filteredList = [...cached]
          this._syncSelectedFromValue(this.value)
          return
        }
        this.loadData(true)
      },

      _cacheKey() {
        return [
          this.type,
          this.parentValue || '',
          ...this.selectorConfig.searchConfig.fields.map(f => this.searchState[f.field] || ''),
          JSON.stringify(this.apiParams)
        ].join('|')
      },

      _snapshotParams() {
        return {
          type: this.type,
          parentValue: this.parentValue,
          searchState: { ...this.searchState },
          apiParams: { ...this.apiParams }
        }
      },

      _setCache(records) {
        this._dataCache.set(this._cacheKey(), [...records])
      },

      _appendCache(records) {
        const key = this._cacheKey()
        const existing = this._dataCache.get(key) || []
        this._dataCache.set(key, [...existing, ...records])
      },

      _clearCache() {
        this._dataCache.clear()
        this._cachedParams = null
      }
    }
  }
}

/**
 * 快速创建带默认 type 的选择器逻辑 mixin
 * 用法：export default { mixins: [useSelector('warehouse')], ... }
 */
export function useSelector(type, overrides = {}) {
  return createSelectorMixin({ type, ...overrides })
}

export default { createSelectorMixin, useSelector }