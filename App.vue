<script>
	import { isOpen, openDb, selectSql, executeSql, transaction, closeDb, initDb } from "utils/dbUtils.js";
	import appSettings from 'common/appSettings.js';

	export default {
		globalData: {
			DB_FILE: 'WMS-699.db',
			DATABASE_PATH: '_doc/WMS-699.db',
			DATABASE_NAME: 'main',
		},
		onLaunch: function() {
			// 初始化全局设置（加载持久化配置 + 同步 CSS 变量到 DOM）
			appSettings.init();
			
			// ── 核心：监听设置变更，同步系统 UI ──
			uni.$on('appSettingsChanged', this.onSettingsChanged);
			
			// 首次启动立即执行一次（延迟确保 tabBar 渲染完成）
			setTimeout(() => {
				this.applySystemTheme();
			}, 100);
			
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show');
			// 每次 App 从后台切回前台时，重新应用主题（确保 TabBar 正确）
			this.applySystemTheme();
		},
		onHide: function() {
			console.log('App Hide')
		},
		beforeDestroy() {
			uni.$off('appSettingsChanged', this.onSettingsChanged);
		},
		methods: {
			onSettingsChanged(payload) {
				// 只关心影响系统 UI 的 key
				if (!payload || payload.key) {
					const key = payload?.key;
					if (key === 'darkMode' || key === 'themeColor' || key === 'displaySize') {
						this.applySystemTheme();
					}
				} else if (payload.keys || payload.reset) {
					this.applySystemTheme();
				}
			},

			applySystemTheme() {
				const s = appSettings.getAll();
				const isDark = s.darkMode === 'dark';
				const theme = appSettings.THEME_COLORS[s.themeColor];
				const primaryColor = theme ? theme.primary : '#1677ff';

				// ── 1. TabBar ──（控制底部 Tab 栏）
				uni.setTabBarStyle({
					color: isDark ? '#888888' : '#999999',
					selectedColor: primaryColor,
					backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
					borderStyle: isDark ? 'black' : 'white'
				});

				// ── 2. 全局页面背景 ──（下拉刷新区域）
				uni.setBackgroundColor({
					backgroundColor: isDark ? '#0f0f1a' : '#f0f2f5',
					backgroundColorTop: isDark ? '#0f0f1a' : '#f0f2f5',
					backgroundColorBottom: isDark ? '#0f0f1a' : '#f0f2f5'
				});

				// ── 3. 当前页导航栏 ──
				uni.setNavigationBarColor({
					frontColor: isDark ? '#ffffff' : '#000000',
					backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
					animation: { timingFunc: 'easeIn', duration: 300 }
				});
				
				console.log('系统主题已同步:', { isDark, primaryColor });
			}
		}
	}
</script>

<style>
	@import url("./common/uni.css");
	@import url("static/iconfont.css");

	/* CSS 变量定义 */
	:root {
		--color-primary: #1677ff;
		--color-primary-bg: rgba(22, 119, 255, 0.05);
		--color-bg-page: #f0f2f5;
		--color-bg-card: #ffffff;
		--color-text: #1a1a2e;
		--color-text-sub: #6b7280;
		--color-text-hint: #9ca3af;
		--color-border: #e5e7eb;
		--color-divider: #f0f0f0;
		--color-success: #52c41a;
		--color-error: #ff4d4f;
		--color-warning: #fa8c16;
	}

	/* 深色模式 CSS 变量 */
	.theme-dark {
		--color-primary: #3c7eff;
		--color-primary-bg: rgba(60, 126, 255, 0.08);
		--color-bg-page: #0f0f1a;
		--color-bg-card: #1a1a2e;
		--color-text: #e0e0e0;
		--color-text-sub: #888;
		--color-text-hint: #666;
		--color-border: #2a2a45;
		--color-divider: #2a2a45;
	}

	.page {
		font-weight: bold;
		padding-bottom: 100px;
		box-sizing: border-box;
		background: var(--color-bg-page);
		color: var(--color-text);
	}

	.uni-card .uni-card__actions[data-v-19622063] {
		font-size: 12px;
		padding: 10px;
	}
</style>