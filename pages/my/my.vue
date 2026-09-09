<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 用户信息 ════ -->
		<view class="user-card">
		<image class="avatar" :src="avatar || defaultAvatar" mode="aspectFill" @error="avatar = defaultAvatar" />
			<view class="user-body">
				<text class="user-name">{{ realname || '未设置' }}</text>
				<text class="user-meta">{{ username }}<text v-if="factoryName"> · {{ factoryName }}</text></text>
			</view>
			<text class="ver-tag" v-if="version" :style="chipStyle">v{{ version }}</text>
		</view>

		<!-- ════ 外观 ════ -->
		<view class="block">
			<view class="block-head">
				<view class="block-dot" :style="dotStyle"></view>
				<text>外观</text>
			</view>
			<view class="card">
				<view class="row">
					<text class="row-label">显示大小</text>
					<view class="sz-group">
						<view class="sz-btn" :class="{ on: appSettings.displaySize === 'small' }" :style="appSettings.displaySize === 'small' ? szOn : {}" @click="setSize('small')">小</view>
						<view class="sz-btn" :class="{ on: appSettings.displaySize === 'medium' }" :style="appSettings.displaySize === 'medium' ? szOn : {}" @click="setSize('medium')">中</view>
						<view class="sz-btn" :class="{ on: appSettings.displaySize === 'large' }" :style="appSettings.displaySize === 'large' ? szOn : {}" @click="setSize('large')">大</view>
					</view>
				</view>
				<view class="sep"></view>

				<view class="row">
					<text class="row-label">主题色</text>
					<view class="clr-group">
						<view v-for="c in colorOpts" :key="c.value"
							class="clr-dot"
							:class="{ on: appSettings.themeColor === c.value }"
							:style="clrStyle(c)"
							@click="setTheme(c.value)">
							<text v-if="appSettings.themeColor === c.value" class="clr-check">&#10003;</text>
						</view>
					</view>
				</view>
				<view class="sep"></view>

				<view class="row">
					<text class="row-label">深色模式</text>
					<switch :checked="appSettings.darkMode === 'dark'" :color="themePrimary" @change="toggleDark" />
				</view>
			</view>
		</view>

		<!-- ════ 行为 ════ -->
		<!-- <view class="block">
			<view class="block-head">
				<view class="block-dot" :style="dotStyle"></view>
				<text>行为</text>
			</view>
			<view class="card">
				<view class="row">
					<view class="row-l">
						<text class="row-label">震动反馈</text>
						<text class="row-hint">操作反馈与扫码确认</text>
					</view>
					<switch :checked="appSettings.vibration" :color="themePrimary" @change="toggleVib" />
				</view>
				<view class="sep"></view>
				<view class="row">
					<view class="row-l">
						<text class="row-label">声音提示</text>
						<text class="row-hint">成功 / 异常提示音</text>
					</view>
					<switch :checked="appSettings.sound" :color="themePrimary" @change="toggleSnd" />
				</view>
			</view>
		</view> -->

		<!-- ════ 关于 ════ -->
		<view class="block">
			<view class="block-head">
				<view class="block-dot" :style="dotStyle"></view>
				<text>关于</text>
			</view>
			<view class="card">
				<view class="row">
					<text class="row-label">当前版本</text>
					<text class="row-hint">v{{ version || '-' }}</text>
				</view>
				<view class="sep"></view>
				<view class="row arrow" @click="handleUpdateApp">
					<view class="row-l">
						<text class="row-label">更新应用</text>
						<text class="row-hint">从服务器下载并安装最新版本</text>
					</view>
					<text class="arrow-icon">›</text>
				</view>
			</view>
		</view>

		<!-- ════ 数据 ════ -->
		<view class="block">
			<view class="block-head">
				<view class="block-dot" :style="dotStyle"></view>
				<text>数据</text>
			</view>
			<view class="card">
				<!-- <view class="row arrow" @click="handleClearCache">
					<view class="row-l">
						<text class="row-label">清除缓存</text>
						<text class="row-hint">搜索记录、扫描历史、临时文件</text>
					</view>
					<text class="arrow-icon">›</text>
				</view> -->
				<!-- <view class="sep"></view> -->
				<view class="row arrow" @click="handleResetSettings">
					<view class="row-l">
						<text class="row-label">重置设置</text>
						<text class="row-hint">所有偏好恢复出厂默认值</text>
					</view>
					<text class="arrow-icon">›</text>
				</view>
			</view>
		</view>

		<!-- ════ 退出 ════ -->
		<view class="logout" @click="handleLogout"><text>退出登录</text></view>
		<view class="safe-bottom"></view>

		<!-- ════ 更新进度遮罩 ════ -->
		<view v-if="updating" class="upd-mask">
			<view class="upd-box">
				<text class="upd-title">更新应用</text>
				<view class="upd-bar">
					<view class="upd-fill" :class="{ indeterminate: updateProgress < 0 }"
						:style="{ width: updateProgress < 0 ? '40%' : updateProgress + '%' }"></view>
				</view>
				<text class="upd-text">{{ updateText }}</text>
			</view>
		</view>
	</view>
</template>

<script>
import appSettings from '@/common/appSettings.js';
import settingsMixin from '@/common/settingsMixin.js';
import { downloadApk, canRequestInstall, openInstallSetting, installApk } from '@/utils/appUpdate.js';

export default {
	mixins: [settingsMixin],

		data() {
			return {
				factoryName: '',
				avatar: '',
				realname: '',
				username: '',
			version: '',
			defaultAvatar: '/static/my_s.png',
			// 更新进度遮罩
			updating: false,
			updateProgress: 0,
			updateText: ''
			};
		},

	computed: {
		colorOpts() { return appSettings.getThemeColorOptions(); },

		// 内联快捷样式（主题响应）
		szOn()     { return { background: this.themePrimary, color: '#fff' }; },
		dotStyle() { return { background: this.themePrimary }; },
		chipStyle(){ return { background: this.themePrimary + '18', color: this.themePrimary }; }
	},

		onLoad() {
			this.initUserInfo();
			this.getAppVersion();
		},

		onShow() {
			// 通知自定义 TabBar 高亮当前项
			uni.$emit('customTabSelect', 1);
		},

	methods: {
		// ── 设置变更 ────
		setSize(s)   { if (this.appSettings.displaySize !== s) { appSettings.set('displaySize', s); this.vib(); } },
		setTheme(c)  { if (this.appSettings.themeColor  !== c) { appSettings.set('themeColor',  c); this.vib(); } },
		toggleDark(e){ appSettings.set('darkMode', e.detail.value ? 'dark' : 'light'); this.vib(); },
		toggleVib(e) { appSettings.set('vibration', e.detail.value); },
		toggleSnd(e) { appSettings.set('sound', e.detail.value); },

		clrStyle(c) {
			return {
				background: c.color,
				boxShadow: this.appSettings.themeColor === c.value ? `0 0 0 4rpx ${c.color}33` : '0 0 0 3rpx transparent'
			};
		},

		vib() {
			// #ifdef APP-PLUS
			if (this.appSettings.vibration) plus.device.vibrate(15);
			// #endif
		},

		// ── 数据操作 ────
		handleClearCache() {
			uni.showModal({
				title: '清除缓存',
				content: '将清除搜索记录、扫描历史等临时数据，不影响账号和设置。',
				confirmColor: this.themePrimary,
				success: (res) => {
					if (res.confirm) {
						['scan_history', 'search_keywords', 'recent_inputs'].forEach(k => { try { uni.removeStorageSync(k); } catch (e) {} });
						uni.showToast({ title: '已清除', icon: 'success', duration: 1200 });
					}
				}
			});
		},

		handleResetSettings() {
			uni.showModal({
				title: '重置设置',
				content: '将所有偏好恢复为默认值，确定继续？',
				confirmColor: this.themePrimary,
				success: (res) => {
					if (res.confirm) {
						appSettings.resetAll();
						uni.showToast({ title: '已重置', icon: 'success', duration: 1200 });
					}
				}
			});
		},

		// ── 用户信息 ────
		initUserInfo() {
			try {
				['factoryName', 'username', 'realname', 'avatar'].forEach(k => {
					const v = uni.getStorageSync(k);
					this[k] = v ? String(v) : '';
				});
			} catch (e) { /* skip */ }
		},

		getAppVersion() {
			// #ifdef APP-PLUS
			try { plus.runtime.getProperty(plus.runtime.appid, inf => { this.version = String(inf.version || ''); }); } catch (e) {}
			// #endif
			// #ifdef H5
			this.version = 'H5';
			// #endif
		},

		handleUpdateApp() {
			// #ifndef APP-PLUS
			uni.showToast({ title: '仅 App 端支持更新', icon: 'none' });
			return;
			// #endif
			uni.showModal({
				title: '更新应用',
				content: '将从服务器下载 snApp.apk 并安装，是否继续？',
				success: (r) => { if (r.confirm) this.doUpdateApp(); }
			});
		},

		async doUpdateApp() {
			try {
				this.updating = true
				this.updateProgress = 0
				this.updateText = '准备下载...'
				const file = await downloadApk((p) => {
					this.updateProgress = p.progress
					this.updateText = p.text
				})
				this.updateText = '下载完成，正在安装...'
				this.updateProgress = 100

				// Android 8+ 未授权「安装未知应用」时引导去设置页
				//（该权限是特殊权限，运行时弹窗申请无效，只能由用户手动开启）
				if (!canRequestInstall()) {
					this.updating = false
					uni.showModal({
						title: '需要授权',
						content: '请先允许「安装未知应用」权限，然后重新点击更新。',
						confirmText: '去设置',
						success: (r) => { if (r.confirm) openInstallSetting(); }
					})
					return
				}
				await installApk(file)
				this.updating = false
			} catch (e) {
				this.updating = false
				uni.showModal({
					title: '更新失败',
					content: (e && e.message) || String(e),
					showCancel: false
				})
			}
		},

		handleLogout() {
			uni.showModal({
				title: '确认退出',
				content: '确定要退出登录吗？',
				confirmColor: '#ef4444',
				success: (res) => { if (res.confirm) this.doLogout(); }
			});
		},

		async doLogout() {
			uni.showLoading({ title: '退出中...', mask: true });
			['token', 'factoryId', 'factoryName', 'userId', 'username', 'realname', 'avatar', 'dbVer'].forEach(k => { try { uni.removeStorageSync(k); } catch (e) {} });
			await new Promise(r => setTimeout(r, 400));
			uni.hideLoading();
			uni.redirectTo({ url: '../login/login' });
		}
	}
};
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

/* ═════════════════════════════════════════
   my.vue — 个人中心 / 设置
   混入 settingsMixin + page-theme-mixins
   ═════════════════════════════════════════ */

$bg: var(--color-bg-page);
$text: var(--color-text);
$sub: var(--color-text-secondary);
$hint: var(--color-text-hint);
$line: var(--color-border);

.page {
	@include p-page;
	background: $bg;
	padding: 20rpx 24rpx;
}

/* ── 用户卡片 ──── */
.user-card {
	display: flex; align-items: center;
	padding: 32rpx 28rpx; margin-bottom: 20rpx;
	@include p-card;
}
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: #e8edf2; flex-shrink: 0; }
.user-body { flex: 1; margin-left: 24rpx; min-width: 0; }
.user-name { display: block; font-size: var(--font-xl); font-weight: 700; color: $text; line-height: 1.3; transition: color .25s; }
.user-meta { display: block; font-size: var(--font-sm); color: $sub; margin-top: 4rpx; transition: color .25s; }
.ver-tag   { flex-shrink: 0; font-size: var(--font-xs); padding: 6rpx 16rpx; border-radius: 20rpx; font-weight: 600; transition: background .25s, color .25s; }

/* ── 分区 ──── */
.block { margin-bottom: 20rpx; }
.block-head { display: flex; align-items: center; gap: 12rpx; padding: 0 4rpx 16rpx; font-size: var(--font-sm); font-weight: 600; color: $sub; letter-spacing: 2rpx; transition: color .25s; }
.block-dot  { width: 10rpx; height: 10rpx; border-radius: 50%; transition: background .25s; }
.card       { @include p-card; overflow: hidden; }

/* ── 行 ──── */
.row       { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 28rpx; min-height: 88rpx; box-sizing: border-box; }
.row.arrow:active { background: var(--color-bg-card); }
.row-l     { flex: 1; min-width: 0; margin-right: 20rpx; }
.row-label { display: block; font-size: var(--font-lg); font-weight: 500; color: $text; line-height: 1.4; transition: color .25s; }
.row-hint  { display: block; font-size: var(--font-xs); color: $hint; margin-top: 2rpx; transition: color .25s; }
.arrow-icon{ font-size: var(--font-xl); color: $hint; font-weight: 300; flex-shrink: 0; transition: color .25s; }
.sep       { @include p-sep; margin: 0 28rpx; }

/* ── 大小按钮 ──── */
.sz-group { display: flex; gap: 6rpx; flex-shrink: 0; }
.sz-btn   { min-width: 64rpx; height: 52rpx; padding: 0 16rpx; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: var(--font-sm); font-weight: 500; color: $sub; background: var(--color-bg-page); transition: all .15s; }

/* ── 颜色圆点 ──── */
.clr-group { display: flex; gap: 18rpx; flex-shrink: 0; }
.clr-dot   { width: 42rpx; height: 42rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: transform .15s, box-shadow .15s; &:active { transform: scale(.88); } }
.clr-check { font-size: var(--font-xs); color: #fff; font-weight: 700; }

/* ── 退出 ──── */
.logout { margin-top: 12rpx; padding: 28rpx; border-radius: 16rpx; text-align: center; font-size: var(--font-lg); font-weight: 600; color: #ef4444; @include p-card; &:active { background: #fef2f2; } }
.safe-bottom { height: 60rpx; }

/* ── 更新进度遮罩 ──── */
.upd-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.upd-box { width: 76%; max-width: 520rpx; background: #fff; border-radius: 16rpx; padding: 40rpx 36rpx; box-shadow: 0 8rpx 30rpx rgba(0,0,0,.2); }
.upd-title { display: block; font-size: 32rpx; font-weight: 600; color: #1f2937; text-align: center; margin-bottom: 24rpx; }
.upd-bar { height: 16rpx; background: #eef2f7; border-radius: 999rpx; overflow: hidden; }
.upd-fill { height: 100%; background: #3b82f6; border-radius: 999rpx; transition: width .2s ease; }
.upd-fill.indeterminate { animation: upd-slide 1.1s infinite ease-in-out; }
@keyframes upd-slide { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
.upd-text { display: block; margin-top: 18rpx; font-size: 24rpx; color: #6b7280; text-align: center; }

/* ═══════════════════════ 尺寸 / 深色 ═══════════════════════ */

.size-small {
	&.page { padding: 14rpx 16rpx; }
	.user-card { padding: 22rpx 20rpx; margin-bottom: 14rpx; border-radius: 12rpx; }
	.avatar { width: 72rpx; height: 72rpx; }
	.user-body { margin-left: 18rpx; }
	.user-name { font-size: var(--font-lg); }
	.user-meta { font-size: var(--font-xs); }
	.ver-tag { font-size: 18rpx; padding: 4rpx 12rpx; }
	.block { margin-bottom: 14rpx; }
	.block-head { font-size: var(--font-xs); padding-bottom: 12rpx; gap: 8rpx; }
	.block-dot { width: 8rpx; height: 8rpx; }
	.card { border-radius: 12rpx; }
	.row { padding: 20rpx 20rpx; min-height: 72rpx; }
	.row-label { font-size: var(--font-sm); }
	.row-hint { font-size: 18rpx; }
	.row-l { margin-right: 14rpx; }
	.sep { margin: 0 20rpx; }
	.arrow-icon { font-size: var(--font-lg); }
	.sz-btn { min-width: 54rpx; height: 42rpx; font-size: var(--font-xs); padding: 0 12rpx; }
	.sz-group { gap: 4rpx; }
	.clr-dot { width: 34rpx; height: 34rpx; }
	.clr-group { gap: 14rpx; }
	.clr-check { font-size: 18rpx; }
	.logout { padding: 22rpx; font-size: var(--font-sm); border-radius: 12rpx; }
	.safe-bottom { height: 48rpx; }
}

.size-large {
	&.page { padding: 28rpx 32rpx; }
	.user-card { padding: 44rpx 36rpx; margin-bottom: 28rpx; border-radius: 20rpx; }
	.avatar { width: 120rpx; height: 120rpx; }
	.user-body { margin-left: 32rpx; }
	.user-name { font-size: var(--font-xl); }
	.user-meta { font-size: var(--font-lg); }
	.ver-tag { font-size: var(--font-sm); padding: 8rpx 20rpx; }
	.block { margin-bottom: 28rpx; }
	.block-head { font-size: var(--font-lg); padding-bottom: 20rpx; gap: 16rpx; }
	.block-dot { width: 12rpx; height: 12rpx; }
	.card { border-radius: 20rpx; }
	.row { padding: 36rpx 36rpx; min-height: 104rpx; }
	.row-label { font-size: var(--font-xl); }
	.row-hint { font-size: var(--font-md); }
	.row-l { margin-right: 28rpx; }
	.sep { margin: 0 36rpx; }
	.arrow-icon { font-size: 44rpx; }
	.sz-btn { min-width: 76rpx; height: 62rpx; font-size: var(--font-lg); padding: 0 20rpx; }
	.sz-group { gap: 10rpx; }
	.clr-dot { width: 50rpx; height: 50rpx; }
	.clr-group { gap: 22rpx; }
	.clr-check { font-size: var(--font-md); }
	.logout { padding: 36rpx; font-size: var(--font-xl); border-radius: 20rpx; margin-top: 18rpx; }
	.safe-bottom { height: 72rpx; }
}

.theme-dark {
	&.page { background: #0f0f1a; }
	.user-card { background: var(--color-bg-card); box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.user-name { color: #e0e0e0; }
	.user-meta { color: #888; }
	.block-head { color: #888; }
	.card { background: var(--color-bg-card); box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.row-label { color: #e0e0e0; }
	.row-hint, .arrow-icon { color: var(--color-text-secondary); }
	.sep { background: #2a2a45; }
	.row.arrow:active { background: #22223a; }
	.sz-btn { background: #252540; color: #888; }
	.logout { background: var(--color-bg-card); box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); &:active { background: #2a1a2e; } }
	.upd-mask { background: rgba(0,0,0,.6); }
	.upd-box { background: #1c1c2e; box-shadow: 0 8rpx 30rpx rgba(0,0,0,.5); }
	.upd-title { color: #e0e0e0; }
	.upd-bar { background: #303050; }
	.upd-text { color: #999; }
}
</style>