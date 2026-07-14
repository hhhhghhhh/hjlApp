<!-- KeyPartQuery.vue 关键件查询组件 -->
<template>
	<view class="key-part-query" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 顶部信息 ════ -->
		<view class="header-card">
			<view class="header-title">
				<text class="title">关键件查询</text>
				<view class="header-actions">
					<view class="action-btn" @click="handleReset">
						<uni-icons type="refresh" size="20" color="#D9726A"></uni-icons>
						<text>重置</text>
					</view>
				</view>
			</view>
		</view>

		<!-- ════ 关键件SN输入 ════ -->
		<view class="input-card">
			<view class="input-row">
				<view class="input-left">
					<text class="input-label">关键件SN</text>
				</view>
				<view class="input-right">
					<input 
						class="input-value-input" 
						v-model="currentSn" 
						placeholder="请输入或扫码关键件SN"
						:focus="inputFocus"
						@confirm="onInputConfirm"
						@focus="onInputFocus"
					/>
					<uni-icons type="scan" size="22" color="#4A90D9" @click="scanSn"></uni-icons>
					<view v-if="currentSn" class="clear-btn" @click="clearCurrentSn">
						<uni-icons type="clear" size="16" color="#999"></uni-icons>
					</view>
				</view>
			</view>
		</view>

		<!-- ════ 消息提示 ════ -->
		<view class="message-box" :class="[messageInfo.type, messageInfo.show ? 'show' : '']">
			<text>{{ messageInfo.content }}</text>
		</view>

		<!-- ════ 查询结果 ════ -->
		<view v-if="keySnInfo" class="result-container">
			<!-- 关键件信息卡片 -->
			<view class="info-card">
				<view class="card-title">关键件信息</view>
				<view class="info-grid">
					<view class="info-item">
						<text class="info-label">物料编码</text>
						<text class="info-value">{{ keySnInfo.itemCode || '--' }}</text>
					</view>
					<view class="info-item">
						<text class="info-label">物料名称</text>
						<text class="info-value">{{ keySnInfo.itemName || '--' }}</text>
					</view>
					<view class="info-item">
						<text class="info-label">规格型号</text>
						<text class="info-value">{{ keySnInfo.itemSpec || '--' }}</text>
					</view>
					<view class="info-item">
						<text class="info-label">供应商</text>
						<text class="info-value">{{ keySnInfo.supplierName || '--' }}</text>
					</view>
					<view class="info-item">
						<text class="info-label">关键件SN</text>
						<text class="info-value sn">{{ keySnInfo.keySn || '--' }}</text>
					</view>
					<view class="info-item" v-if="keySnInfo.isReplaced === 'Y'">
						<text class="info-label">更换标记</text>
						<text class="info-value tag-replaced">已更换</text>
					</view>
				</view>
			</view>

			<!-- 绑定的产品列表 -->
			<view class="list-card" v-if="productInfo">
				<view class="card-title">
					<text>绑定的产品</text>
				</view>

				<view class="product-detail">
					<view class="info-grid">
						<view class="info-item">
							<text class="info-label">产品SN</text>
							<text class="info-value">{{ productInfo.productSn || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">产品编码</text>
							<text class="info-value">{{ productInfo.itemCode || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">产品名称</text>
							<text class="info-value">{{ productInfo.itemName || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">规格型号</text>
							<text class="info-value">{{ productInfo.itemSpec || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">生产订单</text>
							<text class="info-value">{{ productInfo.productionOrderNo || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">销售订单</text>
							<text class="info-value">{{ productInfo.salesOrderNo || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">客户</text>
							<text class="info-value">{{ productInfo.custName || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">绑定时间</text>
							<text class="info-value">{{ formatDate(productInfo.bindTime) || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">出货人员</text>
							<text class="info-value">{{ productInfo.deliverBy || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">出货日期</text>
							<text class="info-value">{{ formatDate(productInfo.deliverTime) || '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">保修期</text>
							<text class="info-value">{{ productInfo.period ? productInfo.period + '年' : '--' }}</text>
						</view>
						<view class="info-item">
							<text class="info-label">保修期到</text>
							<text class="info-value">{{ formatDate(productInfo.periodTo) || '--' }}</text>
						</view>
					</view>
				</view>
			</view>

			<!-- 未绑定产品 -->
			<view class="list-card" v-else>
				<view class="card-title">
					<text>绑定的产品</text>
				</view>
				<view class="empty-state">
					<uni-icons type="checkbox" size="48" color="#ccc"></uni-icons>
					<text>该关键件暂未绑定产品</text>
				</view>
			</view>
		</view>

		<!-- 空状态 -->
		<view v-else-if="!loading && !keySnInfo" class="empty-result">
			<uni-icons type="search" size="64" color="#ccc"></uni-icons>
			<text>请输入或扫码关键件SN查询</text>
		</view>

		<!-- 加载中 -->
		<view v-if="loading" class="loading-state">
			<uni-load-more status="loading" :content="'查询中...'"></uni-load-more>
		</view>
	</view>
</template>

<script>
import settingsMixin from '@/common/settingsMixin.js';

export default {
	name: 'KeyPartQuery',
	
	mixins: [settingsMixin],

	data() {
		return {
			currentSn: '',
			keySnInfo: null,
			productInfo: null,
			loading: false,
			inputFocus: false,
			messageInfo: {
				show: false,
				content: '',
				type: 'info'
			},
			messageTimer: null
		};
	},

	mounted() {
		setTimeout(() => {
			this.focusInput();
		}, 500);
	},

	methods: {
		// ==================== 聚焦控制 ====================
		focusInput() {
			this.inputFocus = false;
			this.$nextTick(() => {
				setTimeout(() => {
					this.inputFocus = true;
				}, 100);
			});
		},

		onInputFocus() {},

		// ==================== 消息提示 ====================
		showMessage(content, type = 'info') {
			if (this.messageTimer) {
				clearTimeout(this.messageTimer);
			}
			this.messageInfo = {
				show: true,
				content,
				type
			};
		},

		// ==================== 扫码功能 ====================
		scanSn() {
			uni.scanCode({
				success: (res) => {
					const code = res.result;
					this.currentSn = code;
					this.doQuery(code);
				},
				fail: () => {
					this.showMessage('扫码失败', 'error');
					this.focusInput();
				}
			});
		},

		// ==================== 输入确认 ====================
		onInputConfirm() {
			const code = this.currentSn.trim();
			if (code) {
				this.doQuery(code);
			}
		},

		// ==================== 查询 ====================
		async doQuery(sn) {
			if (!sn) {
				this.showMessage('请输入关键件SN', 'warning');
				return;
			}

			this.loading = true;
			this.keySnInfo = null;
			this.productInfo = null;

			try {
				const res = await this.$request({
					url: '/api/pda/pdaProductSn/getKeyInfoBySn',
					method: 'GET',
					data: { keySn: sn }
				});

				this.loading = false;

				if (res.data && res.data.code === 200) {
					const data = res.data.result;
					this.keySnInfo = data.keySn || {};
					this.productInfo = data.productSn || null;
					this.showMessage('查询成功', 'success');
					this.focusInput();
				} else {
					this.showMessage(res.data?.message || '查询失败', 'error');
				}
			} catch (error) {
				this.loading = false;
				this.showMessage('查询失败，请检查网络', 'error');
				console.error('doQuery error:', error);
			}
		},

		// ==================== 重置 ====================
		handleReset() {
			this.currentSn = '';
			this.keySnInfo = null;
			this.productInfo = null;
			this.showMessage('已重置', 'info');
			setTimeout(() => {
				this.focusInput();
			}, 300);
		},

		clearCurrentSn() {
			this.currentSn = '';
			this.focusInput();
		},

		// ==================== 工具方法 ====================
		formatDate(dateStr) {
			if (!dateStr) return '';
			try {
				const date = new Date(dateStr);
				if (isNaN(date.getTime())) return dateStr;
				return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
			} catch (e) {
				return dateStr;
			}
		}
	}
};
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$primary: #4A90D9;
$danger: #D9726A;
$success: #3BA37F;
$warning: #E8833A;
$text: #1a1a2e;
$sub: #6b7280;
$hint: #9ca3af;
$bg: #f7f8fa;
$border: #e5e7eb;

.key-part-query {
	padding: 16rpx 0 40rpx;
}

/* 消息提示 */
.message-box {
	padding: 12rpx 20rpx;
	border-radius: 8rpx;
	font-size: 24rpx;
	text-align: center;
	opacity: 0;
	transform: translateY(-8rpx);
	transition: opacity .25s ease, transform .2s ease;
	margin-bottom: 16rpx;

	&.show {
		opacity: 1;
		transform: translateY(0);
	}
	&.success {
		background: rgba(82, 196, 26, .1);
		color: #2e7d32;
	}
	&.error {
		background: rgba(255, 77, 79, .1);
		color: #c62828;
	}
	&.info {
		background: rgba(22, 119, 255, .1);
		color: #1565c0;
	}
	&.warning {
		background: rgba(255, 165, 0, .1);
		color: #e65100;
	}
}

/* 头部卡片 */
.header-card {
	background: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 16rpx;
}

.header-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.title {
	font-size: 32rpx;
	font-weight: 700;
	color: $text;
}

.header-actions {
	display: flex;
	gap: 20rpx;
}

.action-btn {
	display: flex;
	align-items: center;
	gap: 6rpx;
	font-size: 24rpx;
	color: $sub;
	padding: 8rpx 16rpx;
	background: $bg;
	border-radius: 8rpx;
	&:active {
		opacity: 0.7;
	}
}

/* 输入卡片 */
.input-card {
	background: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 16rpx;
}

.input-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12rpx 0;
	border-bottom: 1rpx solid $border;
}

.input-left {
	display: flex;
	padding-right: 8px;
	align-items: baseline;
	gap: 16rpx;
}

.input-label {
	font-size: 26rpx;
	font-weight: 600;
	color: $text;
}

.input-right {
	display: flex;
	align-items: center;
	gap: 10rpx;
	flex: 1;
	justify-content: flex-end;
}

.input-value-input {
	flex: 1;
	text-align: left;
	font-size: 24rpx;
	color: $text;
	border: none;
	border-bottom: 1rpx solid transparent;
	background: transparent;
	padding: 8rpx 0;
	transition: border-color .25s ease;

	&:focus {
		border-bottom-color: $primary;
	}

	&::placeholder {
		color: $hint;
		font-size: 22rpx;
	}
}

.clear-btn {
	padding: 4rpx 6rpx;
	border-radius: 4rpx;
	background: rgba(0, 0, 0, .05);
	flex-shrink: 0;
}

/* 结果容器 */
.result-container {
	margin-top: 8rpx;
}

/* 信息卡片 */
.info-card {
	background: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 16rpx;
}

.card-title {
	font-size: 28rpx;
	font-weight: 600;
	color: $text;
	margin-bottom: 16rpx;
	padding-bottom: 12rpx;
	border-bottom: 1rpx solid $border;
}

.info-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12rpx 20rpx;
}

.info-item {
	display: flex;
	flex-direction: column;
	gap: 2rpx;
}

.info-label {
	font-size: 22rpx;
	color: $hint;
}

.info-value {
	font-size: 24rpx;
	font-weight: 500;
	color: $text;
	&.sn {
		color: $primary;
		font-weight: 600;
	}
}

.tag-replaced {
	display: inline-block;
	background: rgba(217, 114, 106, .15);
	color: $danger;
	font-size: 20rpx;
	padding: 2rpx 16rpx;
	border-radius: 20rpx;
	font-weight: 500;
}

/* 列表卡片 */
.list-card {
	background: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 16rpx;
}

.product-detail {
	margin-top: 4rpx;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40rpx 0;
	gap: 16rpx;
	color: $hint;
	font-size: 24rpx;
}

/* 空状态 */
.empty-result {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 80rpx 0;
	gap: 20rpx;
	color: $hint;
	font-size: 28rpx;
}

.loading-state {
	padding: 80rpx 0;
	display: flex;
	justify-content: center;
}

/* 深色主题 */
.theme-dark {
	.header-card,
	.input-card,
	.info-card,
	.list-card {
		background: #1a1a2e;
	}

	.title {
		color: #e0e0e0;
	}

	.action-btn {
		background: #1e1e36;
		color: #888;
	}

	.input-label {
		color: #e0e0e0;
	}

	.input-value-input {
		color: #e0e0e0;

		&:focus {
			border-bottom-color: #7cadff;
		}

		&::placeholder {
			color: #666;
		}
	}

	.input-row {
		border-color: #2a2a45;
	}

	.card-title {
		color: #e0e0e0;
		border-bottom-color: #2a2a45;
	}

	.info-value {
		color: #e0e0e0;
		&.sn {
			color: #7cadff;
		}
	}

	.tag-replaced {
		background: rgba(217, 114, 106, .2);
		color: #ef9a9a;
	}

	.empty-state {
		color: #666;
	}

	.empty-result {
		color: #666;
	}

	.message-box {
		&.success {
			background: rgba(82, 196, 26, .15);
			color: #81c784;
		}
		&.error {
			background: rgba(255, 77, 79, .15);
			color: #ef9a9a;
		}
		&.info {
			background: rgba(22, 119, 255, .15);
			color: #7cadff;
		}
		&.warning {
			background: rgba(255, 165, 0, .15);
			color: #ffb74d;
		}
	}
}
</style>