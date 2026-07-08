// common/appSettings.js
// 全局设置管理器 —— 所有配置的单一数据源
//
// 设计原则：
//   1. 所有设置持久化到 uni.storage
//   2. 变更时通过 uni.$emit('appSettingsChanged', { key, value }) 通知所有页面
//   3. 任何页面 import 后即可读写，无需 Vuex
//   4. H5 端直接操作 document.body.class 驱动 CSS 变量

const STORAGE_KEY = 'app_settings';

// ── 默认值 ────
const DEFAULTS = {
  displaySize: 'medium',    // 'small' | 'medium' | 'large'
  themeColor:  'blue',      // 'blue' | 'green' | 'orange' | 'purple'
  darkMode:    'light',     // 'light' | 'dark'
  vibration:   true,        // 震动反馈
  sound:       true         // 声音提示
};

// ── 主题色定义 ────
const THEME_COLORS = {
  blue:   { name: '蓝', primary: '#1677ff', light: 'rgba(22,119,255,0.08)', bg: 'rgba(22,119,255,0.05)' },
  green:  { name: '绿', primary: '#52c41a', light: 'rgba(82,196,26,0.08)',  bg: 'rgba(82,196,26,0.05)' },
  orange: { name: '橙', primary: '#fa8c16', light: 'rgba(250,140,22,0.08)', bg: 'rgba(250,140,22,0.05)' },
  purple: { name: '紫', primary: '#722ed1', light: 'rgba(114,46,209,0.08)', bg: 'rgba(114,46,209,0.05)' }
};

const SIZE_LABELS = { small: '小', medium: '中', large: '大' };
const DARK_LABELS = { light: '浅色', dark: '深色' };

// ── 内部状态（内存缓存，避免频繁读 storage） ────
let _settings = null;

// 读取全部设置
function loadSettings() {
  if (_settings) return { ..._settings };
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _settings = { ...DEFAULTS, ...parsed };
    } else {
      _settings = { ...DEFAULTS };
    }
  } catch (e) {
    console.warn('[appSettings] 读取失败，使用默认值:', e);
    _settings = { ...DEFAULTS };
  }
  return { ..._settings };
}

// 持久化
function saveSettings() {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(_settings));
  } catch (e) {
    console.error('[appSettings] 保存失败:', e);
  }
}

// ── 公开 API ────

// 获取单个设置项
function get(key) {
  const s = loadSettings();
  return s[key] !== undefined ? s[key] : DEFAULTS[key];
}

// 获取全部设置
function getAll() {
  return loadSettings();
}

// 更新单个设置项（会触发全局事件 + 同步 DOM）
function set(key, value) {
  loadSettings();
  if (_settings[key] === value) return;

  _settings[key] = value;
  saveSettings();

  // 同步 H5 DOM class
  applyDomClasses(key, value);

  // 通知所有页面
  uni.$emit('appSettingsChanged', { key, value });
}

// 批量更新设置
function setAll(patch) {
  loadSettings();
  Object.keys(patch).forEach(k => {
    if (patch[k] !== undefined) _settings[k] = patch[k];
  });
  saveSettings();
  applyAllDomClasses();
  uni.$emit('appSettingsChanged', { keys: Object.keys(patch), values: patch });
}

// 重置为默认值
function resetAll() {
  _settings = { ...DEFAULTS };
  saveSettings();
  applyAllDomClasses();
  uni.$emit('appSettingsChanged', { reset: true });
}

// 获取预设选项列表（给 UI 渲染用）
function getThemeColorOptions() {
  return Object.entries(THEME_COLORS).map(([value, info]) => ({
    value, label: info.name, color: info.primary
  }));
}

function getSizeOptions() {
  return Object.entries(SIZE_LABELS).map(([value, label]) => ({ value, label }));
}

function getDarkModeOptions() {
  return Object.entries(DARK_LABELS).map(([value, label]) => ({ value, label }));
}

// ── DOM class 同步（H5 端驱动 CSS 变量） ────
function applyDomClasses(key, value) {
  // #ifdef H5
  try {
    switch (key) {
      case 'displaySize':
        document.body.classList.remove('size-small', 'size-medium', 'size-large');
        document.body.classList.add(`size-${value}`);
        break;
      case 'themeColor':
        document.body.classList.remove('theme-blue', 'theme-green', 'theme-orange', 'theme-purple');
        document.body.classList.add(`theme-${value}`);
        break;
      case 'darkMode':
        document.body.classList.toggle('theme-dark', value === 'dark');
        break;
    }
  } catch (e) { /* 静默 */ }
  // #endif
}

function applyAllDomClasses() {
  const s = loadSettings();
  // #ifdef H5
  try {
    const body = document.body;
    body.classList.remove('size-small', 'size-medium', 'size-large');
    body.classList.add(`size-${s.displaySize}`);

    body.classList.remove('theme-blue', 'theme-green', 'theme-orange', 'theme-purple');
    body.classList.add(`theme-${s.themeColor}`);

    body.classList.toggle('theme-dark', s.darkMode === 'dark');
  } catch (e) { /* 静默 */ }
  // #endif
}

// 初始化（App.vue onLaunch 调用一次）
function init() {
  loadSettings();
  applyAllDomClasses();
}

export default {
  DEFAULTS,
  THEME_COLORS,
  SIZE_LABELS,
  DARK_LABELS,
  get,
  getAll,
  set,
  setAll,
  resetAll,
  getThemeColorOptions,
  getSizeOptions,
  getDarkModeOptions,
  init
};