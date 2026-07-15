<!-- ProductRepair.vue 产品维修组件 -->
<template>
	<view class="product-repair" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 顶部信息 ════ -->
		<view class="header-card">
			<view class="header-title">
				<text class="title">产品维修</text>
				<view class="header-actions">
					<view class="action-btn" @click="handleReset">
						<uni-icons type="refresh" size="20" color="#D9726A"></uni-icons>
						<text>重置</text>
					</view>
				</view>
			</view>
		</view>

		<!-- ════ 产品SN输入 ════ -->
		<view class="input-card">
			<view class="input-row">
				<view class="input-left">
					<text class="input-label">产品SN</text>
				</view>
				<view class="input-right">
					<input class="input-value-input" v-model="currentSn" placeholder="请输入或扫码产品SN" :focus="inputFocus"
						@confirm="onInputConfirm" @focus="onInputFocus" />
					<uni-icons type="scan" size="22" color="#4A90D9" @click="scanSn"></uni-icons>
					<view v-if="currentSn" class="clear-btn" @click="clearCurrentSn">
						<uni-icons type="clear" size="16" color="#999"></uni-icons>
					</view>
				</view>
			</view>
		</view>



		<!-- ════ 查询结果 ════ -->
		<view v-if="productInfo" class="result-container">
			<!-- 产品信息卡片 -->
			<view class="info-card">
				<view class="card-title">产品信息</view>
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
						<text class="info-label">出货日期</text>
						<text class="info-value">{{ formatDate(productInfo.deliverTime) || '--' }}</text>
					</view>
				</view>
			</view>

			<!-- ════ 消息提示 ════ -->
			<view class="message-box" :class="[messageInfo.type, messageInfo.show ? 'show' : '']">
				<text>{{ messageInfo.content }}</text>
			</view>
			<!-- ════ 维修表单 ════ -->
			<view class="form-card">
				<view class="card-title">维修记录</view>

				<view class="form-item">
					<text class="form-label"><text class="required-star">*</text>故障描述</text>
					<textarea class="form-textarea" v-model="repairForm.description" placeholder="请输入故障描述"
						maxlength="500" />
					<text class="char-count">{{ repairForm.description.length }}/500</text>
				</view>

				<view class="form-item">
					<text class="form-label"><text class="required-star">*</text>维修内容</text>
					<textarea class="form-textarea" v-model="repairForm.content" placeholder="请输入维修内容"
						maxlength="500" />
					<text class="char-count">{{ repairForm.content.length }}/500</text>
				</view>

				<view class="form-item">
					<text class="form-label"><text class="required-star">*</text>维修结果</text>
					<view class="result-options">
						<view class="result-option" :class="{ active: repairForm.result === '已修复' }"
							@click="repairForm.result = '已修复'">
							<text>已修复</text>
						</view>
						<view class="result-option" :class="{ active: repairForm.result === '无法修复' }"
							@click="repairForm.result = '无法修复'">
							<text>无法修复</text>
						</view>
						<view class="result-option" :class="{ active: repairForm.result === '待返厂' }"
							@click="repairForm.result = '待返厂'">
							<text>待返厂</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<!-- 空状态 -->
		<view v-else-if="!loading && !productInfo" class="empty-result">
			<uni-icons type="search" size="64" color="#ccc"></uni-icons>
			<text>请输入或扫码产品SN查询</text>
		</view>

		<!-- 加载中 -->
		<view v-if="loading" class="loading-state">
			<uni-load-more status="loading" :content="'查询中...'"></uni-load-more>
		</view>

		<!-- ════ 底部提交（固定） ════ -->
		<view class="bottom-bar">
			<view class="submit-btn" @click="handleRepair">
				<text>确认维修</text>
			</view>
		</view>
	</view>
</template>

<script>
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		name: 'ProductRepair',

		mixins: [settingsMixin],

		data() {
			return {
				currentSn: '',
				productInfo: null,
				loading: false,
				inputFocus: false,
				isSubmitting: false,
				repairForm: {
					description: '',
					content: '',
					result: ''
				},
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

			// ==================== 查询产品信息 ====================
			async doQuery(sn) {
				if (!sn) {
					this.showMessage('请输入产品SN', 'warning');
					return;
				}

				this.loading = true;
				this.productInfo = null;
				this.repairForm = {
					description: '',
					content: '',
					result: ''
				};

				try {
					const res = await this.$request({
						url: '/api/pda/pdaProductSn/getProductInfoBySn',
						method: 'GET',
						data: {
							productSn: sn
						}
					});

					this.loading = false;

					if (res.data && res.data.code === 200) {
						const data = res.data.result;
						this.productInfo = data.productSn || {};
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
				uni.showModal({
					title: '提示',
					content: '确定要重置所有数据吗？',
					success: (res) => {
						if (res.confirm) {
							this.currentSn = '';
							this.productInfo = null;
							this.repairForm = {
								description: '',
								content: '',
								result: ''
							};
							this.showMessage('已重置', 'success');
							setTimeout(() => {
								this.focusInput();
							}, 300);
						}
					}
				});
			},

			clearCurrentSn() {
				this.currentSn = '';
				this.focusInput();
			},

			// ==================== 提交维修 ====================
			async doRepair() {
				if (this.isSubmitting) return;

				// 表单验证
				if (!this.repairForm.description.trim()) {
					this.showMessage('请输入故障描述', 'warning');
					return;
				}
				if (!this.repairForm.content.trim()) {
					this.showMessage('请输入维修内容', 'warning');
					return;
				}
				if (!this.repairForm.result) {
					this.showMessage('请选择维修结果', 'warning');
					return;
				}

				this.isSubmitting = true;
				uni.showLoading({
					title: '提交中...'
				});

				try {
					const requestData = {
						productId: this.productInfo.id,
						description: this.repairForm.description.trim(),
						content: this.repairForm.content.trim(),
						result: this.repairForm.result
					};

					const res = await this.$request({
						url: '/mes/productRepair/add',
						method: 'POST',
						data: requestData
					});

					uni.hideLoading();
					this.isSubmitting = false;

					if (res.data && res.data.code === 200) {
						this.showMessage('维修记录提交成功', 'success');
						// 清空表单
						this.repairForm = {
							description: '',
							content: '',
							result: ''
						};
						this.focusInput();
						return true;
					} else {
						this.showMessage(res.data?.message || '提交失败', 'error');
						return false;
					}
				} catch (error) {
					uni.hideLoading();
					this.isSubmitting = false;
					this.showMessage('提交失败，请检查网络', 'error');
					console.error('doRepair error:', error);
					return false;
				}
			},

			handleRepair() {
				if (!this.productInfo) {
					this.showMessage('请先查询产品SN', 'warning');
					this.focusInput();
					return;
				}

				uni.showModal({
					title: '确认维修',
					content: `确认对产品 ${this.productInfo.productSn} 进行维修记录吗？`,
					success: async (res) => {
						if (res.confirm) {
							await this.doRepair();
						}
					}
				});
			},

			// ==================== 工具方法 ====================
			formatDate(dateStr) {
				if (!dateStr) return '';
				try {
					const date = new Date(dateStr);
					if (isNaN(date.getTime())) return dateStr;
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					return `${year}-${month}-${day}`;
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

	.product-repair {
		padding: 16rpx 0 160rpx;
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
	}

	/* 表单卡片 */
	.form-card {
		background: #fff;
		border-radius: 16rpx;
		padding: 24rpx;
		margin-bottom: 16rpx;
	}

	.form-item {
		margin-bottom: 20rpx;

		&:last-child {
			margin-bottom: 0;
		}
	}

	.form-label {
		display: block;
		font-size: 26rpx;
		font-weight: 500;
		color: $text;
		margin-bottom: 10rpx;
	}

	.required-star {
		color: $danger;
		margin-right: 4rpx;
	}

	.form-textarea {
		width: 100%;
		min-height: 120rpx;
		padding: 16rpx 20rpx;
		background: $bg;
		border-radius: 12rpx;
		border: 1rpx solid $border;
		font-size: 24rpx;
		color: $text;
		box-sizing: border-box;
		transition: border-color .25s ease;

		&:focus {
			border-color: $primary;
		}
	}

	.char-count {
		display: block;
		text-align: right;
		font-size: 20rpx;
		color: $hint;
		margin-top: 6rpx;
	}

	/* 维修结果选项 */
	.result-options {
		display: flex;
		gap: 16rpx;
		flex-wrap: wrap;
	}

	.result-option {
		padding: 16rpx 32rpx;
		border-radius: 30rpx;
		background: $bg;
		border: 2rpx solid $border;
		font-size: 24rpx;
		color: $sub;
		transition: all .2s;

		&:active {
			transform: scale(.96);
		}

		&.active {
			background: rgba(74, 144, 217, .1);
			border-color: $primary;
			color: $primary;
			font-weight: 500;
		}
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

	/* 底部提交（固定） */
	.bottom-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 20rpx 24rpx;
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
		background: #fff;
		box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
		z-index: 100;
	}

	.submit-btn {
		padding: 28rpx;
		background: $primary;
		border-radius: 14rpx;
		text-align: center;

		text {
			color: #fff;
			font-size: 30rpx;
			font-weight: 600;
		}

		&:active {
			opacity: 0.8;
		}
	}

	/* 深色主题 */
	.theme-dark {

		.header-card,
		.input-card,
		.info-card,
		.form-card,
		.bottom-bar {
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
		}

		.form-label {
			color: #e0e0e0;
		}

		.form-textarea {
			background: #1e1e36;
			border-color: #2a2a45;
			color: #e0e0e0;

			&:focus {
				border-color: #7cadff;
			}
		}

		.result-option {
			background: #1e1e36;
			border-color: #2a2a45;
			color: #888;

			&.active {
				background: rgba(74, 144, 217, .15);
				border-color: #7cadff;
				color: #7cadff;
			}
		}

		.empty-result {
			color: #666;
		}

		.bottom-bar {
			box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.3);
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