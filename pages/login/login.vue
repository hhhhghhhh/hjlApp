<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 头部品牌区 ════ -->
		<view class="brand">
			<!-- <view class="brand-icon">
				<text class="brand-text">W</text>
			</view> -->
			<text class="brand-name">条码系统</text>
			<text class="brand-ver" v-if="version">v{{ version }}</text>
		</view>

		<!-- ════ 登录卡片 ════ -->
		<view class="card">
			<text class="card-title">账户登录</text>

			<view class="err-banner" v-if="loginError">
				<text class="err-text">{{ loginError }}</text>
			</view>

			<!-- 用户名 -->
			<view class="field">
				<view class="field-icon">
					<uni-icons type="person" size="18" :color="themePrimary"></uni-icons>
				</view>
				<input v-model="form.username" class="field-input" placeholder="用户名" placeholder-class="ph" :disabled="loading" />
			</view>

			<!-- 密码 -->
			<view class="field">
				<view class="field-icon">
					<uni-icons type="locked" size="18" :color="themePrimary"></uni-icons>
				</view>
				<input v-model="form.password" class="field-input" :type="showPwd ? 'text' : 'password'" placeholder="密码" placeholder-class="ph" :disabled="loading" @confirm="handleLogin" />
				<view class="field-suffix" @click="showPwd = !showPwd">
					<uni-icons :type="showPwd ? 'eye' : 'eye-slash'" size="18" color="var(--t-hint)"></uni-icons>
				</view>
			</view>

			<!-- 记住密码 -->
			<view class="opt-row">
				<view class="opt-remember" @click="remember = !remember">
					<view class="chk" :class="{ on: remember }" :style="remember ? { background: themePrimary, borderColor: themePrimary } : {}">
						<text v-if="remember" class="chk-mark">&#10003;</text>
					</view>
					<text class="opt-text">记住密码</text>
				</view>
			</view>

			<!-- 登录按钮 -->
			<view class="btn-login" :class="{ loading }" :style="{ background: loading ? '#93c5fd' : themePrimary }" @click="handleLogin">
				<text v-if="!loading">登 录</text>
				<text v-else>验证中…</text>
			</view>

			<!-- 服务器配置入口 -->
			<view class="srv-entry" @click="openServerConfig">
				<uni-icons type="gear" size="14" color="var(--t-hint)"></uni-icons>
				<text class="srv-text">{{ currentServer }}</text>
				<text class="srv-arrow">›</text>
			</view>
		</view>

		<text class="footer-hint">PDA 终端专用</text>

		<!-- ════ 服务器配置弹窗 ════ -->
		<uni-popup ref="srvPopup" type="center">
			<view class="popup-card">
				<text class="popup-title">服务器配置</text>
				<view class="popup-field">
					<text class="popup-label">地址</text>
					<input v-model="tempHost" class="popup-input" placeholder="IP 地址" placeholder-class="ph2" />
				</view>
				<view class="popup-field">
					<text class="popup-label">端口</text>
					<input v-model="tempPort" class="popup-input" type="number" placeholder="端口号" placeholder-class="ph2" />
				</view>
				<view class="popup-err" v-if="srvError"><text>{{ srvError }}</text></view>
				<view class="popup-actions">
					<view class="pa-btn ghost" @click="resetServer">重置</view>
					<view class="pa-btn ghost" @click="closeServerConfig">取消</view>
					<view class="pa-btn primary" :style="{ background: themePrimary }" @click="saveServer">保存</view>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
import settingsMixin from '@/common/settingsMixin.js';

export default {
	mixins: [settingsMixin],

	data() {
		return {
			form:     { username: '', password: '' },
			remember: false,
			showPwd:  false,
			loading:  false,
			version:  '',

			pdaHost: '127.0.0.1',
			pdaPort: '8081',
			tempHost: '',
			tempPort: '',
			defaultHost: '127.0.0.1',
			defaultPort: '8081',

			loginError: '',
			srvError: ''
		};
	},

	computed: {
		currentServer() {
			return `${this.pdaHost}:${this.pdaPort}`;
		}
	},

	onLoad() {
		this._loadServer();
		this._loadCredentials();
		this._getVersion();
	},

	methods: {
		_loadCredentials() {
			if (uni.getStorageSync('rememberPassword') === true) {
				this.remember = true;
				this.form.username = uni.getStorageSync('savedUsername') || '';
				this.form.password = uni.getStorageSync('savedPassword') || '';
			}
		},

		_loadServer() {
			const h = uni.getStorageSync('pdaHost');
			const p = uni.getStorageSync('pdaPort');
			if (h) this.pdaHost = h;
			if (p) this.pdaPort = p;
		},

		_getVersion() {
			// #ifdef APP-PLUS
			try { plus.runtime.getProperty(plus.runtime.appid, inf => { this.version = String(inf.version || ''); }); } catch (e) {}
			// #endif
			// #ifdef H5
			this.version = 'H5';
			// #endif
		},

		// ── 登录 ────

		handleLogin() {
			if (this.loading) return;
			const u = this.form.username.trim();
			if (!u) { this.loginError = '请输入用户名'; return; }
			if (!this.form.password) { this.loginError = '请输入密码'; return; }
			this.loginError = '';
			this.doLogin(u, this.form.password);
		},

		async doLogin(username, password) {
			this.loading = true;

			uni.setStorageSync('pdaHost', this.pdaHost);
			uni.setStorageSync('pdaPort', this.pdaPort);

			if (this.remember) {
				uni.setStorageSync('savedUsername', username);
				uni.setStorageSync('savedPassword', password);
				uni.setStorageSync('rememberPassword', true);
			} else {
				['savedUsername', 'savedPassword', 'rememberPassword'].forEach(k => { try { uni.removeStorageSync(k); } catch (e) {} });
			}

			try {
				const loginRes = await this.$request({
					url: '/sys/login',
					method: 'POST',
					data: { username, password }
				});

				const result = loginRes.data?.result;
				if (!result?.token) {
					this.loginError = loginRes.data?.message || '登录失败，请检查账号密码';
					return;
				}

				const token = result.token;
				const user  = result.userInfo || {};

				uni.setStorageSync('token', token);
				uni.setStorageSync('factoryId', user.factoryId || '');
				uni.setStorageSync('factoryName', user.factoryName || '');
				uni.setStorageSync('userId', user.id || '');
				uni.setStorageSync('username', user.username || '');
				uni.setStorageSync('realname', user.realname || '');
				if (user.avatar) uni.setStorageSync('avatar', user.avatar);

				// 权限（失败不阻塞）
				try {
					const permRes = await this.$request({
						url: '/sys/permission/getUserPermissionByToken',
						method: 'GET',
						data: { token }
					});
					const menu = permRes.data?.result?.menu;
					if (menu) {
						const pda = menu.find(m => m.meta?.title === 'pda权限');
						uni.setStorageSync('pdaPermissions', pda?.children || []);
					}
				} catch (e) { /* 权限可选 */ }

				uni.switchTab({ url: '../index/index' });

			} catch (err) {
				console.error('登录异常:', err);
				if (err.message?.includes('timeout') || err.message?.includes('超时')) {
					this.loginError = '连接超时，请检查服务器地址和网络';
				} else {
					this.loginError = `无法连接 ${this.pdaHost}:${this.pdaPort}`;
				}
			} finally {
				this.loading = false;
			}
		},

		// ── 服务器配置 ────

		openServerConfig() {
			this.tempHost = this.pdaHost;
			this.tempPort = this.pdaPort;
			this.srvError = '';
			this.$refs.srvPopup.open();
		},

		closeServerConfig() {
			this.$refs.srvPopup.close();
		},

		resetServer() {
			this.tempHost = this.defaultHost;
			this.tempPort = this.defaultPort;
			this.srvError = '';
		},

		saveServer() {
			const h = (this.tempHost || '').trim();
			const p = (this.tempPort || '').trim();
			if (!h) { this.srvError = '请输入服务器地址'; return; }
			if (!p) { this.srvError = '请输入端口号'; return; }
			const n = parseInt(p);
			if (isNaN(n) || n < 1 || n > 65535) { this.srvError = '端口号范围 1-65535'; return; }

			this.pdaHost = h;
			this.pdaPort = p;
			uni.setStorageSync('pdaHost', h);
			uni.setStorageSync('pdaPort', p);
			uni.showToast({ title: '服务器已更新', icon: 'success' });
			this.closeServerConfig();
		}
	}
};
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

/* ═════════════════════════════════════════
   login.vue — 工业 PDA 登录
   混入 settingsMixin + page-theme-mixins
   ═════════════════════════════════════════ */

$bg:    #e8ecf1;
$card:  #ffffff;
$text:  #1a1a2e;
$sub:   #8c8c9c;
$hint:  #b0b0bb;
$line:  #ebedf0;

/* ── 自定义属性（fallback） ──── */
.page {
	--t-hint: #999;
	@include p-page;
	background: $bg;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 48rpx 40rpx;
}

/* ── 品牌区 ──── */
.brand {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 48rpx;
}

.brand-icon {
	width: 96rpx; height: 96rpx; border-radius: 24rpx;
	@include p-card;
	display: flex; align-items: center; justify-content: center;
	margin-bottom: 24rpx;
}

.brand-text {
	font-size: 52rpx; font-weight: 800; color: $text; letter-spacing: -2rpx;
}
.brand-name {
	font-size: 36rpx; font-weight: 700; color: $text; letter-spacing: 4rpx;
}
.brand-ver {
	font-size: 22rpx; color: $sub; margin-top: 6rpx;
}

/* ── 卡片 ──── */
.card {
	width: 100%; max-width: 600rpx;
	@include p-card;
	padding: 56rpx 44rpx 44rpx;
	border-radius: 20rpx;
	box-shadow: 0 8rpx 36rpx rgba(0,0,0,.06);
}
.card-title {
	display: block; font-size: 30rpx; font-weight: 600; color: $text; margin-bottom: 36rpx;
}

/* ── 错误 ──── */
.err-banner {
	background: #fef2f2; border: 1rpx solid #fecaca; border-radius: 10rpx;
	padding: 20rpx 24rpx; margin-bottom: 28rpx;
}
.err-text { font-size: 24rpx; color: #ef4444; line-height: 1.5; }

/* ── 输入框 ──── */
.field {
	display: flex; align-items: center;
	height: 92rpx; background: #f4f5f7; border-radius: 12rpx;
	border: 1rpx solid transparent; padding: 0 20rpx; margin-bottom: 20rpx;
	transition: border-color .2s, background .2s, box-shadow .2s;
	&:focus-within { border-color: #1677ff; background: #fff; box-shadow: 0 0 0 3rpx rgba(22,119,255,.1); }
}
.field-icon   { width: 40rpx; flex-shrink: 0; display: flex; align-items: center; }
.field-input  { flex: 1; height: 100%; font-size: 28rpx; color: $text; margin: 0 12rpx; background: transparent; border: none; outline: none; -webkit-appearance: none; }
.field-suffix { padding: 8rpx; flex-shrink: 0; display: flex; align-items: center; &:active { opacity: .6; } }
.ph           { color: $hint; font-size: 28rpx; }

/* ── 记住密码 ──── */
.opt-row       { display: flex; align-items: center; margin-bottom: 32rpx; }
.opt-remember  { display: flex; align-items: center; gap: 10rpx; }
.chk           { width: 36rpx; height: 36rpx; border-radius: 6rpx; border: 2rpx solid #d0d0d0; display: flex; align-items: center; justify-content: center; transition: all .15s; }
.chk-mark      { font-size: 22rpx; color: #fff; font-weight: 700; }
.opt-text      { font-size: 26rpx; color: $sub; }

/* ── 按钮 ──── */
.btn-login {
	width: 100%; height: 92rpx; border-radius: 12rpx; display: flex; align-items: center; justify-content: center;
	font-size: 30rpx; font-weight: 600; color: #fff; transition: opacity .2s;
	&:active { opacity: .85; }
	&.loading { opacity: .7; }
}

/* ── 服务器入口 ──── */
.srv-entry  { display: flex; align-items: center; justify-content: center; gap: 10rpx; margin-top: 36rpx; padding: 16rpx; border-radius: 10rpx; &:active { background: rgba(0,0,0,.03); } }
.srv-text   { font-size: 24rpx; color: $hint; }
.srv-arrow  { font-size: 28rpx; color: $hint; font-weight: 300; }
.footer-hint { font-size: 22rpx; color: $hint; margin-top: 56rpx; }

/* ── 弹窗 ──── */
.popup-card    { width: 580rpx; max-width: 86vw; @include p-card; padding: 40rpx 36rpx 32rpx; border-radius: 20rpx; box-shadow: 0 12rpx 48rpx rgba(0,0,0,.12); }
.popup-title   { display: block; font-size: 30rpx; font-weight: 600; color: $text; text-align: center; margin-bottom: 32rpx; }
.popup-field   { margin-bottom: 24rpx; }
.popup-label   { display: block; font-size: 24rpx; font-weight: 500; color: $sub; margin-bottom: 10rpx; }
.popup-input   { width: 100%; height: 80rpx; background: #f4f5f7; border-radius: 10rpx; border: 1rpx solid $line; padding: 0 20rpx; font-size: 26rpx; color: $text; box-sizing: border-box; outline: none; -webkit-appearance: none; &:focus { border-color: #1677ff; background: #fff; } }
.ph2           { color: $hint; font-size: 26rpx; }
.popup-err     { background: #fef2f2; border-radius: 8rpx; padding: 16rpx 20rpx; margin-bottom: 20rpx; font-size: 22rpx; color: #ef4444; }
.popup-actions { display: flex; gap: 16rpx; margin-top: 8rpx; }
.pa-btn        { flex: 1; height: 72rpx; border-radius: 10rpx; display: flex; align-items: center; justify-content: center; font-size: 26rpx; font-weight: 500; &:active { opacity: .8; } &.ghost { background: #f4f5f7; color: $sub; } &.primary { color: #fff; } }

/* ═══════════════════════ 尺寸 / 深色 ═══════════════════════ */

.size-small {
	.page { padding: 32rpx 28rpx; }
	.brand { margin-bottom: 32rpx; }
	.brand-icon { width: 72rpx; height: 72rpx; border-radius: 18rpx; margin-bottom: 18rpx; }
	.brand-text { font-size: 40rpx; }
	.brand-name { font-size: 28rpx; }
	.brand-ver  { font-size: 18rpx; }
	.card { padding: 40rpx 32rpx 32rpx; border-radius: 16rpx; }
	.card-title { font-size: 26rpx; margin-bottom: 24rpx; }
	.field { height: 76rpx; margin-bottom: 14rpx; border-radius: 10rpx; }
	.field-input { font-size: 24rpx; }
	.ph { font-size: 24rpx; }
	.btn-login { height: 76rpx; font-size: 26rpx; border-radius: 10rpx; }
	.chk { width: 30rpx; height: 30rpx; }
	.opt-text { font-size: 22rpx; }
	.srv-entry { margin-top: 24rpx; }
	.srv-text { font-size: 20rpx; }
	.footer-hint { font-size: 18rpx; margin-top: 40rpx; }
	.popup-card { padding: 32rpx 28rpx 24rpx; border-radius: 16rpx; }
	.popup-title { font-size: 26rpx; margin-bottom: 24rpx; }
	.popup-input { height: 68rpx; font-size: 22rpx; }
	.pa-btn { height: 60rpx; font-size: 22rpx; }
	.err-banner { padding: 14rpx 18rpx; margin-bottom: 20rpx; border-radius: 8rpx; }
	.err-text { font-size: 20rpx; }
}

.size-large {
	.page { padding: 64rpx 56rpx; }
	.brand { margin-bottom: 64rpx; }
	.brand-icon { width: 120rpx; height: 120rpx; border-radius: 32rpx; margin-bottom: 32rpx; }
	.brand-text { font-size: 64rpx; }
	.brand-name { font-size: 44rpx; }
	.brand-ver  { font-size: 26rpx; }
	.card { padding: 72rpx 56rpx 56rpx; border-radius: 24rpx; }
	.card-title { font-size: 36rpx; margin-bottom: 48rpx; }
	.field { height: 108rpx; margin-bottom: 28rpx; border-radius: 16rpx; }
	.field-input { font-size: 32rpx; }
	.ph { font-size: 32rpx; }
	.btn-login { height: 108rpx; font-size: 36rpx; border-radius: 16rpx; }
	.chk { width: 42rpx; height: 42rpx; }
	.opt-text { font-size: 30rpx; }
	.srv-entry { margin-top: 48rpx; }
	.srv-text { font-size: 28rpx; }
	.footer-hint { font-size: 26rpx; margin-top: 72rpx; }
	.popup-card { padding: 48rpx 44rpx 40rpx; border-radius: 24rpx; }
	.popup-title { font-size: 36rpx; margin-bottom: 40rpx; }
	.popup-input { height: 96rpx; font-size: 30rpx; }
	.pa-btn { height: 84rpx; font-size: 30rpx; }
	.err-banner { padding: 24rpx 28rpx; margin-bottom: 36rpx; border-radius: 14rpx; }
	.err-text { font-size: 28rpx; }
}

.theme-dark {
	&.page { background: #0a0a14; }
	.brand-icon { background: #1a1a2e; }
	.brand-text, .brand-name { color: #e0e0e0; }
	.brand-ver { color: #666; }
	.card { background: #141428; box-shadow: 0 8rpx 36rpx rgba(0,0,0,.3); }
	.card-title { color: #e0e0e0; }
	.err-banner { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.25); }
	.field { background: #1e1e36; &:focus-within { background: #1e1e36; border-color: #1677ff; box-shadow: 0 0 0 3rpx rgba(22,119,255,.15); } }
	.field-input { color: #e0e0e0; }
	.ph { color: #555; }
	.chk { border-color: #444; }
	.opt-text { color: #888; }
	.srv-entry:active { background: rgba(255,255,255,.04); }
	.srv-text, .srv-arrow { color: #666; }
	.footer-hint { color: #444; }
	.popup-card { background: #1a1a2e; box-shadow: 0 12rpx 48rpx rgba(0,0,0,.5); }
	.popup-title { color: #e0e0e0; }
	.popup-label { color: #888; }
	.popup-input { background: #1e1e36; border-color: #2a2a45; color: #e0e0e0; &:focus { background: #1e1e36; } }
	.ph2 { color: #555; }
	.pa-btn.ghost { background: #1e1e36; color: #888; }
}
</style>