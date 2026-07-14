<!-- KeyPartUnbind.vue 关键件解绑组件 -->
<template>
	<view class="key-part-unbind" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 顶部信息 ════ -->
		<view class="header-card">
			<view class="header-title">
				<text class="title">关键件解绑</text>
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
				</view>
			</view>

			<!-- ════ 关键件SN输入（加入待解绑） ════ -->
			<view class="input-card key-sn-input">
				<view class="input-row">
					<view class="input-left">
						<text class="input-label">关键件SN</text>
					</view>
					<view class="input-right">
						<input class="input-value-input" v-model="currentKeySn" placeholder="请输入或扫码关键件SN，回车加入待解绑"
							:focus="keySnInputFocus" @confirm="onKeySnInputConfirm" @focus="onKeySnFocus" />
						<uni-icons type="scan" size="22" color="#4A90D9" @click="scanKeySn"></uni-icons>
						<view v-if="currentKeySn" class="clear-btn" @click="clearCurrentKeySn">
							<uni-icons type="clear" size="16" color="#999"></uni-icons>
						</view>
					</view>
				</view>
			</view>
			<!-- ════ 消息提示 ════ -->
			<view class="message-box" :class="[messageInfo.type, messageInfo.show ? 'show' : '']">
				<text>{{ messageInfo.content }}</text>
			</view>

			<!-- ════ 标签页：待解绑 / 已绑定 ════ -->
			<view class="tabs-container">
				<view class="tabs-header">
					<view class="tab-item" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
						<text>待解绑（{{ pendingList.length }}）</text>
					</view>
					<view class="tab-item" :class="{ active: activeTab === 'bound' }" @click="activeTab = 'bound'">
						<text>已绑定（{{ boundList.length }}）</text>
					</view>
				</view>

				<!-- 待解绑列表 -->
				<view v-show="activeTab === 'pending'" class="tab-content">
					<view v-if="pendingList.length === 0" class="empty-state">
						<uni-icons type="checkbox" size="48" color="#ccc"></uni-icons>
						<text>暂无待解绑关键件</text>
					</view>
					<view v-else class="item-list">
						<view class="list-item" v-for="(item, index) in pendingList" :key="index">
							<view class="item-index">{{ index + 1 }}</view>
							<view class="item-info">
								<view class="item-row">
									<text class="item-label">物料编码</text>
									<text class="item-value">{{ item.itemCode || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">物料名称</text>
									<text class="item-value">{{ item.itemName || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">规格型号</text>
									<text class="item-value">{{ item.itemSpec || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">供应商</text>
									<text class="item-value">{{ item.supplierName || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">关键件SN</text>
									<text class="item-value sn">{{ item.keySn || '--' }}</text>
								</view>
							</view>
							<view class="item-remove" @click="removePending(index)">
								<uni-icons type="close" size="20" color="#D9726A"></uni-icons>
							</view>
						</view>
					</view>
				</view>

				<!-- 已绑定列表（可点击加入待解绑） -->
				<view v-show="activeTab === 'bound'" class="tab-content">
					<view v-if="boundList.length === 0" class="empty-state">
						<uni-icons type="checkbox" size="48" color="#ccc"></uni-icons>
						<text>该产品暂无绑定关键件</text>
					</view>
					<view v-else class="item-list">
						<view class="list-item bound-item-clickable" v-for="(item, index) in boundList" :key="index"
							@click="addToPendingFromBound(item, index)">
							<view class="item-index">{{ index + 1 }}</view>
							<view class="item-info">
								<view class="item-row">
									<text class="item-label">物料编码</text>
									<text class="item-value">{{ item.itemCode || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">物料名称</text>
									<text class="item-value">{{ item.itemName || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">规格型号</text>
									<text class="item-value">{{ item.itemSpec || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">供应商</text>
									<text class="item-value">{{ item.supplierName || '--' }}</text>
								</view>
								<view class="item-row">
									<text class="item-label">关键件SN</text>
									<text class="item-value sn">{{ item.keySn || '--' }}</text>
								</view>
							</view>
							<view class="item-add-hint">
								<uni-icons type="plusempty" size="20" color="#4A90D9"></uni-icons>
							</view>
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
			<view class="submit-btn" @click="handleUnbind">
				<text>确认解绑</text>
			</view>
		</view>
	</view>
</template>

<script>
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		name: 'KeyPartUnbind',

		mixins: [settingsMixin],

		data() {
			return {
				activeTab: 'pending',
				currentSn: '',
				currentKeySn: '',
				productInfo: null,
				// 已绑定列表（从接口获取的真实数据）
				boundList: [],
				// 待解绑列表（用户选择的数据）
				pendingList: [],
				loading: false,
				inputFocus: false,
				keySnInputFocus: false,
				isSubmitting: false,
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

			focusKeySnInput() {
				this.keySnInputFocus = false;
				this.$nextTick(() => {
					setTimeout(() => {
						this.keySnInputFocus = true;
					}, 100);
				});
			},

			onInputFocus() {},
			onKeySnFocus() {},

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

			scanKeySn() {
				uni.scanCode({
					success: (res) => {
						const code = res.result;
						this.currentKeySn = code;
						this.handleKeySn(code);
					},
					fail: () => {
						this.showMessage('扫码失败', 'error');
						this.focusKeySnInput();
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

			onKeySnInputConfirm() {
				const code = this.currentKeySn.trim();
				if (code) {
					this.handleKeySn(code);
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
				this.boundList = [];
				this.pendingList = [];

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
						this.boundList = data.keySnList || [];
						this.showMessage('查询成功', 'success');
						this.focusKeySnInput();
					} else {
						this.showMessage(res.data?.message || '查询失败', 'error');
					}
				} catch (error) {
					this.loading = false;
					this.showMessage('查询失败，请检查网络', 'error');
					console.error('doQuery error:', error);
				}
			},

			// ==================== 处理关键件SN ====================
			handleKeySn(sn) {
				if (!sn) {
					this.showMessage('请输入关键件SN', 'warning');
					return;
				}

				// 检查是否已在待解绑列表
				if (this.pendingList.some(item => item.keySn === sn)) {
					this.showMessage('该关键件已在待解绑列表中', 'warning');
					this.clearCurrentKeySn();
					this.focusKeySnInput();
					return;
				}

				// 从已绑定列表中查找
				const boundItem = this.boundList.find(item => item.keySn === sn);
				if (!boundItem) {
					this.showMessage(`关键件SN[${sn}]不在该产品绑定列表中`, 'warning');
					this.clearCurrentKeySn();
					this.focusKeySnInput();
					return;
				}

				// 加入待解绑列表（复制数据，不影响已绑定列表）
				this.pendingList.push({
					keySn: boundItem.keySn,
					itemCode: boundItem.itemCode,
					itemName: boundItem.itemName,
					itemSpec: boundItem.itemSpec,
					supplierName: boundItem.supplierName,
					id: boundItem.id
				});

				this.clearCurrentKeySn();
				this.showMessage(`已加入待解绑（${this.pendingList.length}）`, 'success');
				this.focusKeySnInput();
			},

			// ==================== 从已绑定列表点击加入待解绑 ====================
			addToPendingFromBound(item, index) {
				if (this.pendingList.some(p => p.keySn === item.keySn)) {
					this.showMessage('该关键件已在待解绑列表中', 'warning');
					return;
				}

				this.pendingList.push({
					keySn: item.keySn,
					itemCode: item.itemCode,
					itemName: item.itemName,
					itemSpec: item.itemSpec,
					supplierName: item.supplierName,
					id: item.id
				});

				this.showMessage(`已加入待解绑（${this.pendingList.length}）`, 'success');
			},

			// ==================== 待解绑列表操作 ====================
			removePending(index) {
				this.pendingList.splice(index, 1);
				this.showMessage('已移除', 'info');
				this.focusKeySnInput();
			},

			clearCurrentSn() {
				this.currentSn = '';
			},

			clearCurrentKeySn() {
				this.currentKeySn = '';
			},

			// ==================== 重置 ====================
			handleReset() {
				uni.showModal({
					title: '提示',
					content: '确定要重置所有数据吗？',
					success: (res) => {
						if (res.confirm) {
							this.currentSn = '';
							this.currentKeySn = '';
							this.productInfo = null;
							this.boundList = [];
							this.pendingList = [];
							this.showMessage('已重置', 'success');
							setTimeout(() => {
								this.focusInput();
							}, 300);
						}
					}
				});
			},

			// ==================== 提交解绑 ====================
			async doUnbind() {
				if (this.isSubmitting) return;

				this.isSubmitting = true;
				uni.showLoading({
					title: '解绑中...'
				});

				try {
					const keySnList = this.pendingList.map(item => item.keySn);
					const requestData = {
						productSn: this.productInfo.productSn,
						keySnList: keySnList
					};

					const res = await this.$request({
						url: '/api/pda/pdaProductSn/unBinding',
						method: 'GET',
						data: requestData
					});

					uni.hideLoading();
					this.isSubmitting = false;

					if (res.data && res.data.code === 200) {
						this.showMessage(`成功解绑 ${this.pendingList.length} 个关键件`, 'success');
						// 清空待解绑列表
						this.pendingList = [];
						// 重新加载已绑定列表（刷新真实数据）
						await this.doQuery(this.currentSn);
						this.focusKeySnInput();
						return true;
					} else {
						this.showMessage(res.data?.message || '解绑失败', 'error');
						return false;
					}
				} catch (error) {
					uni.hideLoading();
					this.isSubmitting = false;
					this.showMessage('解绑失败，请检查网络', 'error');
					console.error('doUnbind error:', error);
					return false;
				}
			},

			handleUnbind() {
				if (!this.productInfo) {
					this.showMessage('请先查询产品SN', 'warning');
					this.focusInput();
					return;
				}
				if (this.pendingList.length === 0) {
					this.showMessage('请至少添加一个关键件到待解绑列表', 'warning');
					this.focusKeySnInput();
					return;
				}

				uni.showModal({
					title: '确认解绑',
					content: `产品 ${this.productInfo.productSn}，待解绑 ${this.pendingList.length} 个关键件`,
					success: async (res) => {
						if (res.confirm) {
							await this.doUnbind();
						}
					}
				});
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

	.key-part-unbind {
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

	.key-sn-input {
		margin-bottom: 16rpx;
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

	/* 标签页 */
	.tabs-container {
		background: #fff;
		border-radius: 16rpx;
		overflow: hidden;
		margin-bottom: 16rpx;
	}

	.tabs-header {
		display: flex;
		border-bottom: 1rpx solid $border;
	}

	.tab-item {
		flex: 1;
		text-align: center;
		padding: 20rpx 0;
		font-size: 26rpx;
		color: $sub;
		position: relative;

		&.active {
			color: $primary;
			font-weight: 600;

			&::after {
				content: '';
				position: absolute;
				bottom: 0;
				left: 50%;
				transform: translateX(-50%);
				width: 48rpx;
				height: 4rpx;
				background: $primary;
				border-radius: 4rpx;
			}
		}
	}

	.tab-content {
		padding: 16rpx;
		min-height: 200rpx;
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

	.item-list {
		display: flex;
		flex-direction: column;
		gap: 12rpx;
	}

	.list-item {
		display: flex;
		align-items: stretch;
		background: $bg;
		border-radius: 12rpx;
		padding: 16rpx;
		border: 1rpx solid $border;
		position: relative;
	}

	.bound-item-clickable {
		&:active {
			opacity: 0.7;
			background: rgba(74, 144, 217, .08);
		}
	}

	.item-index {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48rpx;
		height: 48rpx;
		background: $primary;
		color: #fff;
		border-radius: 50%;
		font-size: 22rpx;
		font-weight: 600;
		flex-shrink: 0;
		margin-top: 4rpx;
	}

	.item-info {
		flex: 1;
		margin-left: 16rpx;
	}

	.item-row {
		display: flex;
		gap: 16rpx;
		font-size: 22rpx;
		padding: 2rpx 0;
	}

	.item-label {
		color: $hint;
		min-width: 80rpx;
	}

	.item-value {
		color: $text;

		&.sn {
			color: $primary;
			font-weight: 500;
		}
	}

	.item-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8rpx;
		flex-shrink: 0;

		&:active {
			opacity: 0.6;
		}
	}

	.item-add-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8rpx;
		flex-shrink: 0;
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

	/* 底部提交 */
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
		.tabs-container,
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

		.tabs-header {
			border-bottom-color: #2a2a45;
		}

		.tab-item {
			color: #888;

			&.active {
				color: #7cadff;
			}
		}

		.list-item {
			background: #1e1e36;
			border-color: #2a2a45;
		}

		.item-value {
			color: #e0e0e0;

			&.sn {
				color: #7cadff;
			}
		}

		.empty-state {
			color: #666;
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