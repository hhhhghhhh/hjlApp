<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 出入库 ════ -->
		<view class="card">
			<view class="card-header">
				<text class="card-title">出入库</text>
			</view>
			<view class="func-grid">
				<!-- 采购入库 - 直接跳转 docOpt -->
				<view class="func-item" @click="goToDocOpt('purchaseReceipt')">
					<view class="func-icon" style="background: #4A90D9;">
						<uni-icons type="download" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">采购入库</text>
				</view>
				<!-- 销售出货 - 直接跳转 docOpt -->
				<view class="func-item" @click="goToDocOpt('salesShipment')">
					<view class="func-icon" style="background: #7B6CD9;">
						<uni-icons type="shop" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">销售出货</text>
				</view>
				<!-- 生产领料 - 直接跳转 docOpt -->
				<view class="func-item" @click="goToDocOpt('prodMaterial')">
					<view class="func-icon" style="background: #E8833A;">
						<uni-icons type="compose" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">生产领料</text>
				</view>
				<!-- 完工入库 - 直接跳转 docOpt -->
				<view class="func-item" @click="goToDocOpt('prodComplete')">
					<view class="func-icon" style="background: #3BA37F;">
						<uni-icons type="upload" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">完工入库</text>
				</view>
			</view>
		</view>

		<!-- ════ 绑定管理 ════ -->
		<view class="card">
			<view class="card-header">
				<text class="card-title">绑定管理</text>
			</view>
			<view class="func-grid">
				<view class="func-item" @click="goToOptModule('packageBind')">
					<view class="func-icon" style="background: #3BA37F;">
						<uni-icons type="checkbox" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">包装绑定</text>
				</view>
				<view class="func-item" @click="goToOptModule('packageUnbind')">
					<view class="func-icon" style="background: #D9726A;">
						<uni-icons type="closeempty" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">包装解绑</text>
				</view>
				<view class="func-item" @click="goToOptModule('keyPartUnbind')">
					<view class="func-icon" style="background: #E8833A;">
						<uni-icons type="closeempty" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">关键件解绑</text>
				</view>
			</view>
		</view>

		<!-- ════ 查询管理 ════ -->
		<view class="card">
			<view class="card-header">
				<text class="card-title">查询管理</text>
			</view>
			<view class="func-grid">
				<view class="func-item" @click="goToOptModule('snQuery')">
					<view class="func-icon" style="background: #50B7E0;">
						<uni-icons type="search" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">产品SN查询</text>
				</view>
				<view class="func-item" @click="goToOptModule('keyPartQuery')">
					<view class="func-icon" style="background: #4A90D9;">
						<uni-icons type="search" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">关键件查询</text>
				</view>
			</view>
		</view>

		<!-- ════ 维修管理 ════ -->
		<view class="card">
			<view class="card-header">
				<text class="card-title">维修管理</text>
			</view>
			<view class="func-grid">
				<view class="func-item" @click="goToOptModule('productRepair')">
					<view class="func-icon" style="background: #D9726A;">
						<uni-icons type="gear" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">产品维修</text>
				</view>
				<view class="func-item" @click="goToOptModule('partReplace')">
					<view class="func-icon" style="background: #7B6CD9;">
						<uni-icons type="refresh" size="32" color="#fff"></uni-icons>
					</view>
					<text class="func-name">配件更换</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		mixins: [settingsMixin],

		data() {
			return {
				docTypeMap: {
					purchaseReceipt: {
						typeSn: 'DJ02',
						operateType: '1',
						typeName: '采购入库单'
					},
					salesShipment: {
						typeSn: 'DJ12',
						operateType: '2',
						typeName: '销售出货单'
					},
					prodMaterial: {
						typeSn: 'DJ11',
						operateType: '2',
						typeName: '生产领料单'
					},
					prodComplete: {
						typeSn: 'DJ05',
						operateType: '1',
						typeName: '完工入库单'
					}
				}
			};
		},
		onNavigationBarButtonTap() {
			uni.$toPath('/pages/wms/scanOpt/scanOpt');
		},
		methods: {
			// 四个核心模块：直接跳转 docOpt
			goToDocOpt(module) {
				const config = this.docTypeMap[module];
				if (config) {
					uni.navigateTo({
						url: `/pages/wms/docOpt/docOpt?docType=${config.typeSn}&operateType=${config.operateType}&typeName=${encodeURIComponent(config.typeName)}`
					});
				}
			},

			// 其他模块：跳转 optMdule 页面通过组件展示
			goToOptModule(module) {
				const titles = {
					packageBind: '包装绑定',
					packageUnbind: '包装解绑',
					keyPartUnbind: '关键件解绑',
					snQuery: '产品 SN 查询',
					keyPartQuery: '关键件查询',
					productRepair: '产品维修',
					partReplace: '配件更换'
				};
				uni.navigateTo({
					url: `/pages/optMdule/index/index?module=${module}&title=${encodeURIComponent(titles[module] || module)}`
				});
			}
		}
	};
</script>

<style lang="scss" scoped>
	@import '@/common/page-theme-mixins.scss';

	$bg: #f0f2f5;
	$text: #1a1a2e;
	$line: #e5e7eb;

	.page {
		@include p-page;
		background: $bg;
		padding: 20rpx 24rpx;
		display: flex;
		flex-direction: column;
		gap: 20rpx;
	}

	.card {
		@include p-card;
		overflow: hidden;
		padding: 28rpx 24rpx;
	}

	.card-header {
		display: flex;
		align-items: center;
		margin-bottom: 18rpx;
	}

	.card-title {
		font-size: 28rpx;
		font-weight: 600;
		color: $text;
		padding-left: 16rpx;
		border-left: 5rpx solid #4A90D9;
		letter-spacing: 0.5rpx;
	}

	.func-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16rpx;
	}

	.func-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 22rpx 8rpx;
		border-radius: 14rpx;
		background: #f7f8fa;
		border: 1rpx solid $line;
		transition: all .2s;
		min-height: 130rpx;

		&:active {
			transform: scale(.96);
			background: #eef1f6;
		}
	}

	.func-icon {
		width: 70rpx;
		height: 70rpx;
		border-radius: 15rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-bottom: 8rpx;
		box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, .08);
	}

	.func-name {
		font-size: 24rpx;
		font-weight: 500;
		color: $text;
		text-align: center;
		line-height: 1.2;
	}

	/* ═════════════════ 尺寸 / 深色 ═════════════════ */
	.size-small {
		&.page {
			padding: 14rpx 16rpx;
			gap: 14rpx;
		}

		.card {
			padding: 18rpx 16rpx;
		}

		.card-header {
			margin-bottom: 12rpx;
		}

		.card-title {
			font-size: 22rpx;
			padding-left: 12rpx;
			border-left-width: 3rpx;
		}

		.func-grid {
			gap: 10rpx;
		}

		.func-item {
			padding: 14rpx 4rpx;
			min-height: 90rpx;
			border-radius: 10rpx;
		}

		.func-icon {
			width: 60rpx;
			height: 60rpx;
			border-radius: 10rpx;
			margin-bottom: 4rpx;
		}

		.func-name {
			font-size: 18rpx;
		}
	}

	.size-large {
		&.page {
			padding: 28rpx 32rpx;
			gap: 28rpx;
		}

		.card {
			padding: 36rpx 32rpx;
		}

		.card-header {
			margin-bottom: 24rpx;
		}

		.card-title {
			font-size: 34rpx;
			padding-left: 20rpx;
			border-left-width: 6rpx;
		}

		.func-grid {
			gap: 20rpx;
		}

		.func-item {
			padding: 28rpx 12rpx;
			min-height: 160rpx;
			border-radius: 16rpx;
		}

		.func-icon {
			width: 72rpx;
			height: 72rpx;
			border-radius: 18rpx;
			margin-bottom: 10rpx;
		}

		.func-name {
			font-size: 28rpx;
		}
	}

	.theme-dark {
		&.page {
			background: #0f0f1a;
		}

		.card {
			background: #1a1a2e;
			box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, .25);
		}

		.card-title {
			color: #e0e0e0;
			border-left-color: #4A90D9;
		}

		.func-item {
			background: #1e1e36;
			border-color: #2a2a45;

			&:active {
				background: #252540;
			}
		}

		.func-name {
			color: #e0e0e0;
		}
	}
</style>