// common/selectorConfig.js
// 选择器类型配置 —— 纯数据驱动，替代 CommonSelector 中的 switch/case 地狱
// 新增类型只需在此添加一个配置对象即可，无需修改 UI 组件

/**
 * 选择器类型配置
 * @property {string} title         弹窗标题
 * @property {string} placeholder   未选中时占位文字
 * @property {string} valueField    值字段名，用于 v-model 绑定
 * @property {Object} fieldMap      后端字段 → 前端标准化字段的映射 { name, code, desc }
 * @property {Object} apiParams     请求时构造搜索参数的函数 (searchState) => params
 * @property {Object} searchConfig  搜索框配置
 *   - mode: 'single' | 'dual'         单个搜索框还是两个并排搜索框
 *   - fields: [{ field, placeholder }] 搜索字段定义
 *   - apiKey: 发送到接口的参数字段名
 *   - localKeys: 本地过滤时匹配的字段名数组（用于静态数据源模式）
 *   - debounce: 防抖延迟（ms），默认 300
 * @property {Object|null} cascadeConfig 级联配置（district/storage 依赖父级的场景）
 *   - parentType: 父级选择器类型
 *   - parentField: 请求时携带的父级 id 参数名
 */

const SELECTOR_CONFIGS = {
  warehouse: {
    title: '选择仓库',
    placeholder: '请选择仓库',
    valueField: 'id',
    fieldMap: { name: 'areaName', code: 'areaSn', desc: 'areaDesc' },
    apiParams: () => ({}),
    searchConfig: {
      mode: 'single',
      fields: [{ field: 'keyword', placeholder: '搜索仓库', apiKey: 'keyWord' }],
      localKeys: ['areaName', 'areaSn'],
      debounce: 300
    },
    cascadeConfig: null
  },

  district: {
    title: '选择库区',
    placeholder: '请选择库区',
    valueField: 'id',
    fieldMap: { name: 'areaName', code: 'areaSn', desc: 'areaDesc' },
    apiParams: (searchState, parentValue) => {
      const params = {}
      if (parentValue) params.id = parentValue
      if (searchState.keyword) params.keyWord = searchState.keyword
      return params
    },
    searchConfig: {
      mode: 'single',
      fields: [{ field: 'keyword', placeholder: '搜索库区', apiKey: 'keyWord' }],
      localKeys: ['areaName', 'areaSn'],
      debounce: 300
    },
    cascadeConfig: { parentField: 'id', clearOnParentChange: true }
  },

  storage: {
    title: '选择库位',
    placeholder: '请选择库位',
    valueField: 'id',
    fieldMap: { name: 'areaName', code: 'areaSn', desc: 'areaDesc' },
    apiParams: (searchState, parentValue) => {
      const params = {}
      if (parentValue) params.id = parentValue
      if (searchState.keyword) params.keyWord = searchState.keyword
      return params
    },
    searchConfig: {
      mode: 'single',
      fields: [{ field: 'keyword', placeholder: '搜索库位', apiKey: 'keyWord' }],
      localKeys: ['areaName', 'areaSn'],
      debounce: 300
    },
    cascadeConfig: { parentField: 'id', clearOnParentChange: true }
  },

  itemCode: {
    title: '选择物料编码',
    placeholder: '请选择物料',
    valueField: 'id',
    fieldMap: { name: 'itemName', code: 'itemCode', desc: 'itemSpec' },
    apiParams: (searchState) => {
      const params = {}
      if (searchState.code) params.itemCode = searchState.code
      if (searchState.name) params.itemName = searchState.name
      return params
    },
    searchConfig: {
      mode: 'dual',
      fields: [
        { field: 'code', placeholder: '物料编码', apiKey: 'itemCode' },
        { field: 'name', placeholder: '物料名称', apiKey: 'itemName' }
      ],
      localKeys: ['itemCode', 'itemName'],
      debounce: 400
    },
    cascadeConfig: null
  },

  customer: {
    title: '选择客户',
    placeholder: '请选择客户',
    valueField: 'id',
    fieldMap: { name: 'customer', code: 'custCode', desc: 'custAbbreviation' },
    apiParams: (searchState) => {
      const params = {}
      if (searchState.code) params.custCode = searchState.code
      if (searchState.name) params.customer = searchState.name
      return params
    },
    searchConfig: {
      mode: 'dual',
      fields: [
        { field: 'code', placeholder: '客户编码', apiKey: 'custCode' },
        { field: 'name', placeholder: '客户名称', apiKey: 'customer' }
      ],
      localKeys: ['custCode', 'customer'],
      debounce: 400
    },
    cascadeConfig: null
  },

  supplier: {
    title: '选择供应商',
    placeholder: '请选择供应商',
    valueField: 'id',
    fieldMap: { name: 'supplierName', code: 'supplierCode', desc: 'supplierShortname' },
    apiParams: (searchState) => {
      const params = {}
      if (searchState.code) params.supplierCode = searchState.code
      if (searchState.name) params.supplierName = searchState.name
      return params
    },
    searchConfig: {
      mode: 'dual',
      fields: [
        { field: 'code', placeholder: '供应商编码', apiKey: 'supplierCode' },
        { field: 'name', placeholder: '供应商名称', apiKey: 'supplierName' }
      ],
      localKeys: ['supplierCode', 'supplierName'],
      debounce: 400
    },
    cascadeConfig: null
  },

  status: {
    title: '选择库存状态',
    placeholder: '请选择状态',
    valueField: 'id',
    fieldMap: { name: 'name', code: 'code', desc: 'desc' },
    apiParams: () => ({}),
    searchConfig: {
      mode: 'single',
      fields: [{ field: 'keyword', placeholder: '搜索状态', apiKey: 'keyWord' }],
      localKeys: ['name', 'code'],
      debounce: 200
    },
    cascadeConfig: null
  }
}

/**
 * 获取指定类型的配置
 * @param {string} type 选择器类型
 * @returns {Object} 配置对象
 */
export function getSelectorConfig(type) {
  const config = SELECTOR_CONFIGS[type]
  if (!config) {
    console.warn(`[selectorConfig] 未知选择器类型: ${type}，使用默认配置`)
    return {
      title: '选择',
      placeholder: '请选择',
      valueField: 'id',
      fieldMap: { name: 'name', code: 'code', desc: 'desc' },
      apiParams: () => ({}),
      searchConfig: {
        mode: 'single',
        fields: [{ field: 'keyword', placeholder: '搜索...', apiKey: 'keyWord' }],
        localKeys: ['name', 'code'],
        debounce: 300
      },
      cascadeConfig: null
    }
  }
  return config
}

/**
 * 注册自定义选择器类型（业务方可动态扩展）
 * @param {string} type  新类型名
 * @param {Object} config 同 SELECTOR_CONFIGS 格式的配置对象
 */
export function registerSelectorType(type, config) {
  if (SELECTOR_CONFIGS[type]) {
    console.warn(`[selectorConfig] 类型 "${type}" 已被覆盖`)
  }
  SELECTOR_CONFIGS[type] = config
}

/**
 * 将后端返回的原始项按照 fieldMap 标准化为 { id, name, code, desc }
 */
export function normalizeItem(raw, config) {
  const { fieldMap, valueField } = config
  return {
    id: raw[valueField] ?? raw.id,
    name: raw[fieldMap.name] || raw.name || '',
    code: raw[fieldMap.code] || raw.code || '',
    desc: raw[fieldMap.desc] || raw.desc || '',
    _raw: raw
  }
}

export { SELECTOR_CONFIGS }
export default SELECTOR_CONFIGS