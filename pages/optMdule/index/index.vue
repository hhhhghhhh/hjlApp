<!-- optMdule/index/index.vue -->
<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 组件容器 ════ -->
		<view class="module-container">
			<!-- 包装绑定/解绑（共用组件） -->
			<template v-if="module === 'packageBind' || module === 'packageUnbind'">
				<PackageManager :mode="module" />
			</template>

			<!-- 产品 SN 查询 -->
			<template v-else-if="module === 'snQuery'">
				<SnQuery />
			</template>

			<!-- 关键件查询 -->
			<template v-else-if="module === 'keyPartQuery'">
				<KeyPartQuery />
			</template>

			<!-- 关键件解绑 -->
			<template v-else-if="module === 'keyPartUnbind'">
				<KeyPartUnbind />
			</template>

			<!-- 产品维修 -->
			<template v-else-if="module === 'productRepair'">
				<ProductRepair />
			</template>

			<!-- 配件更换（关键件替换） -->
			<template v-else-if="module === 'partReplace'">
				<PartReplace />
			</template>

			<!-- 配件寄出（关键件寄出） -->
			<template v-else-if="module === 'partSend'">
				<PartSend />
			</template>

			<!-- 默认占位 -->
			<template v-else>
				<view class="placeholder">
					<text>{{ pageTitle }} - 开发中</text>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
import settingsMixin from '@/common/settingsMixin.js';

// 组件
import PackageManager from './PackageManager.vue';
import SnQuery from './SnQuery.vue';
import KeyPartQuery from './KeyPartQuery.vue';
import KeyPartUnbind from './KeyPartUnbind.vue';
import ProductRepair from './ProductRepair.vue';
import PartReplace from './PartReplace.vue';
import PartSend from './PartSend.vue';

export default {
	mixins: [settingsMixin],

	components: {
		PackageManager,
		SnQuery,
		KeyPartQuery,
		KeyPartUnbind,
		ProductRepair,
		PartReplace,
		PartSend
	},

	data() {
		return {
			module: '',
			pageTitle: '作业模块'
		};
	},

	onLoad(options) {
		this.module = options.module || '';
		const titles = {
			packageBind: '包装绑定',
			packageUnbind: '包装解绑',
			snQuery: '产品SN查询',
			keyPartQuery: '关键件查询',
			keyPartUnbind: '关键件解绑',
			productRepair: '产品维修',
			partReplace: '配件更换',
			partSend: '配件寄出'
		};
		this.pageTitle = decodeURIComponent(options.title || titles[this.module] || '作业模块');
		uni.setNavigationBarTitle({ title: this.pageTitle });
	}
};
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

.page {
	@include p-page;
	background: #f0f2f5;
	min-height: 100vh;
}

.module-container {
	flex: 1;
	padding: 20rpx 24rpx;
}

.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 100rpx 0;
	color: #9ca3af;
	font-size: 28rpx;
}

/* ═════════════════ 尺寸 / 深色 ═════════════════ */
.size-small {
	.module-container {
		padding: 14rpx 16rpx;
	}
}

.size-large {
	.module-container {
		padding: 28rpx 32rpx;
	}
}

.theme-dark {
	&.page {
		background: #0f0f1a;
	}
}
</style>