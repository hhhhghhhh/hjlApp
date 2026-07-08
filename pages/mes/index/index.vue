<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 报工模块 ════ -->
		<view class="block">
			<view class="block-head">
				<view class="block-dot" :style="dot"></view>
				<text>报工</text>
			</view>
			<view class="grid">
				<view class="g-item" @click="goToIndividualReport">
					<view class="g-card">
						<view class="g-icon" :style="{ background: themeAccent }">
							<view class="iconfont icon-indivReport" :style="{ color: themePrimary }"></view>
						</view>
						<text class="g-text">个体报工</text>
					</view>
				</view>
				<view class="g-item" @click="goToBatchReport">
					<view class="g-card">
						<view class="g-icon" :style="{ background: themeAccent }">
							<view class="iconfont icon-batchReport" :style="{ color: themePrimary }"></view>
						</view>
						<text class="g-text">批次报工</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import settingsMixin from '@/common/settingsMixin.js';
import { scanResult } from '@/utils/scanUtil.js';

export default {
	mixins: [settingsMixin],

	computed: { dot() { return { background: this.themePrimary }; } },

	onNavigationBarButtonTap() { scanResult(); },

	methods: {
		goToIndividualReport() { uni.$toPath('/pages/mes/report/indivReport'); },
		goToBatchReport() { uni.$toPath('/pages/mes/report/batchReport'); }
	}
};
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$bg: #f0f2f5; $text: #1a1a2e; $sub: #6b7280; $hint: #9ca3af;

.page { @include p-page; background: $bg; padding: 20rpx 24rpx; }

.block { margin-bottom: 20rpx; }
.block-head { display: flex; align-items: center; gap: 12rpx; padding: 0 4rpx 16rpx; font-size: 24rpx; font-weight: 600; color: $sub; letter-spacing: 2rpx; transition: color .25s; }
.block-dot { width: 10rpx; height: 10rpx; border-radius: 50%; transition: background .25s; }

/* ── 双宫格 ──── */
.grid { display: flex; gap: 16rpx; }
.g-item { flex: 1; }
.g-card { @include p-card; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48rpx 16rpx; gap: 20rpx; min-height: 240rpx; &:active { opacity: .88; transform: scale(.98); } }
.g-icon { width: 88rpx; height: 88rpx; border-radius: 22rpx; display: flex; align-items: center; justify-content: center; transition: background .25s;
	.iconfont { font-size: 48rpx; transition: color .25s; }
}
.g-text { font-size: 28rpx; font-weight: 600; color: $text; transition: color .25s; }

/* ═════════════════ 尺寸 / 深色 ═════════════════ */
.size-small {
	&.page { padding: 14rpx 16rpx; }
	.block-head { font-size: 20rpx; }
	.block-dot { width: 8rpx; height: 8rpx; }
	.grid { gap: 12rpx; }
	.g-card { padding: 36rpx 12rpx; min-height: 190rpx; }
	.g-icon { width: 68rpx; height: 68rpx; .iconfont { font-size: 38rpx; } }
	.g-text { font-size: 24rpx; }
}

.size-large {
	&.page { padding: 28rpx 32rpx; }
	.block-head { font-size: 28rpx; }
	.block-dot { width: 12rpx; height: 12rpx; }
	.grid { gap: 22rpx; }
	.g-card { padding: 60rpx 20rpx; min-height: 300rpx; }
	.g-icon { width: 108rpx; height: 108rpx; .iconfont { font-size: 56rpx; } }
	.g-text { font-size: 32rpx; }
}

.theme-dark {
	&.page { background: #0f0f1a; }
	.block-head { color: #888; }
	.g-card { background: #1a1a2e; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.g-text { color: #e0e0e0; }
}
</style>