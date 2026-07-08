// common/settingsMixin.js
// 全局设置响应式混入 —— 一行 mixins: [settingsMixin] 搞定所有
//
// 注入：
//   data:   appSettings, sizeClass, darkClass, themeClass
//   computed: themePrimary (当前主题色值)，themeAccent (浅底色)
//   methods: _onSettingsChanged（自动监听全局事件）
//
// 页面根元素：
//   <view class="page" :class="[sizeClass, darkClass, themeClass]">

import appSettings from './appSettings.js';

export default {
  data() {
    const s = appSettings.getAll();
    return {
      appSettings: s,
      sizeClass:  `size-${s.displaySize}`,
      darkClass:  s.darkMode === 'dark' ? 'theme-dark' : '',
      themeClass: `theme-${s.themeColor}`
    };
  },

  computed: {
    // 当前主题主色 #1677ff / #52c41a / ...
    themePrimary() {
      const c = appSettings.THEME_COLORS[this.appSettings.themeColor];
      return c ? c.primary : '#1677ff';
    },

    // 当前主题浅底色，适合做选中态高亮
    themeAccent() {
      const c = appSettings.THEME_COLORS[this.appSettings.themeColor];
      return c ? c.bg : 'rgba(22,119,255,0.05)';
    }
  },

  onLoad() {
    uni.$on('appSettingsChanged', this._onSettingsChanged);
  },

  onUnload() {
    uni.$off('appSettingsChanged', this._onSettingsChanged);
  },

  onShow() {
    // 从其他 tab 切回来时刷新设置
    this._refreshAll();
    // 同步导航栏颜色
    this._applyNavBar();
    // 同步 TabBar 颜色
    this._applyTabBar();
  },

  methods: {
    // 同步 TabBar 样式（每个页面显示时都调用，确保 TabBar 正确）
    _applyTabBar() {
      const s = this.appSettings;
      if (!s) return;
      const isDark = s.darkMode === 'dark';
      const theme = appSettings.THEME_COLORS[s.themeColor];
      const primaryColor = theme ? theme.primary : '#1677ff';
      
      uni.setTabBarStyle({
        color: isDark ? '#888888' : '#999999',
        selectedColor: primaryColor,
        backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
        borderStyle: isDark ? 'black' : 'white'
      });
    },

    // 每当页面显示时，同步导航栏颜色
    _applyNavBar() {
      const s = this.appSettings;
      if (!s) return;
      const isDark = s.darkMode === 'dark';
      uni.setNavigationBarColor({
        frontColor: isDark ? '#ffffff' : '#000000',
        backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
        animation: { timingFunc: 'easeIn', duration: 300 }
      });
    },

    _onSettingsChanged(payload) {
      if (payload.reset) {
        this.appSettings = appSettings.getAll();
      } else if (payload.key) {
        this.appSettings = { ...this.appSettings, [payload.key]: payload.value };
      } else if (payload.keys) {
        this.appSettings = { ...this.appSettings, ...payload.values };
      }
      this._refreshClasses();
      // 同步导航栏颜色
      this._applyNavBar();
      // 同步 TabBar 颜色
      this._applyTabBar();
      this.$forceUpdate();
    },

    _refreshAll() {
      this.appSettings = appSettings.getAll();
      this._refreshClasses();
      this._applyNavBar();
      this._applyTabBar();
    },

    _refreshClasses() {
      const s = this.appSettings;
      this.sizeClass  = `size-${s.displaySize}`;
      this.darkClass  = s.darkMode === 'dark' ? 'theme-dark' : '';
      this.themeClass = `theme-${s.themeColor}`;
    }
  }
};