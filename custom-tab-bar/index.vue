<template>
	<view class="tab-bar">
		<view v-for="(t, i) in tabs" :key="t.path"
			class="tab-item" :class="{ active: selected === i }"
			@click="onClick(t)">
			<uni-icons :type="t.icon" :size="22" :color="selected === i ? themePrimary : '#999999'" />
			<text class="tab-text" :style="{ color: selected === i ? themePrimary : '#999999' }">{{ t.text }}</text>
		</view>
	</view>
</template>

<script>
import appSettings from '@/common/appSettings.js';

export default {
	data() {
		return {
			selected: 0,
			themeColor: appSettings.getAll().themeColor,
			tabs: [
				{ path: '/pages/index/index', text: '工作台', icon: 'home' },
				{ path: '/pages/my/my', text: '我的', icon: 'person' }
			]
		};
	},
	computed: {
		themePrimary() {
			const c = appSettings.THEME_COLORS[this.themeColor];
			return c ? c.primary : '#1677ff';
		}
	},
	onLoad() {
		uni.$on('customTabSelect', this.onSelect);
		uni.$on('appSettingsChanged', this.onSettingsChanged);
		this.updateFromRoute();
	},
	onShow() {
		this.updateFromRoute();
	},
	onUnload() {
		uni.$off('customTabSelect', this.onSelect);
		uni.$off('appSettingsChanged', this.onSettingsChanged);
	},
	methods: {
		onSelect(i) {
			this.selected = i;
		},
		onSettingsChanged() {
			this.themeColor = appSettings.getAll().themeColor;
		},
		updateFromRoute() {
			try {
				const pages = getCurrentPages();
				if (pages && pages.length) {
					const route = pages[pages.length - 1].route;
					const idx = this.tabs.findIndex(t => t.path === '/' + route || t.path === route);
					if (idx >= 0) this.selected = idx;
				}
			} catch (e) { /* 忽略 */ }
		},
		onClick(t) {
			const idx = this.tabs.indexOf(t);
			this.selected = idx;
			uni.switchTab({ url: t.path });
		}
	}
};
</script>

<style>
.tab-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 100rpx;
	display: flex;
	background: var(--color-bg-card);
	border-top: 1rpx solid var(--color-border);
	box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.04);
	padding-bottom: env(safe-area-inset-bottom);
	z-index: 999;
}

.tab-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4rpx;
}

.tab-text {
	font-size: 22rpx;
}
</style>
