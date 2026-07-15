<!-- PartReplace.vue 配件更换组件 -->
<template>
	<view class="part-replace" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 顶部信息 ════ -->
		<view class="header-card">
			<view class="header-title">
				<text class="title">配件更换</text>
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

			<!-- ════ 已绑定关键件列表 ════ -->
			<view class="list-card">
				<view class="card-title">
					<text>已绑定关键件</text>
					<text class="list-count">（{{ boundList.length }}）</text>
				</view>

				<view v-if="boundList.length === 0" class="empty-state">
					<uni-icons type="checkbox" size="48" color="#ccc"></uni-icons>
					<text>该产品暂无绑定关键件</text>
				</view>

				<view v-else class="item-list">
					<view class="list-item" v-for="(item, index) in boundList" :key="index" @click="selectKeySn(item)">
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
						<view class="item-select-hint">
							<uni-icons type="right" size="20" color="#ccc"></uni-icons>
						</view>
					</view>
				</view>
			</view>

			<!-- ════ 消息提示 ════ -->
			<view class="message-box" :class="[messageInfo.type, messageInfo.show ? 'show' : '']">
				<text>{{ messageInfo.content }}</text>
			</view>

			<!-- ════ 更换表单 ════ -->
			<view v-if="selectedKeySn" class="form-card">
				<view class="card-title">更换信息</view>

				<!-- 原关键件信息 -->
				<view class="form-item">
					<text class="form-label">原关键件</text>
					<view class="form-display">
						<text class="form-display-value">{{ selectedKeySn.keySn }}</text>
						<text class="form-display-desc">{{ selectedKeySn.itemCode }} -
							{{ selectedKeySn.itemName }}</text>
					</view>
				</view>

				<!-- 新关键件SN输入 -->
				<view class="form-item">
					<text class="form-label"><text class="required-star">*</text>新关键件SN</text>
					<view class="input-row">
						<view class="input-right full-width">
							<input class="input-value-input" v-model="newKeySn" placeholder="请输入或扫码新关键件SN"
								:focus="newKeySnFocus" @confirm="onNewKeySnConfirm" @focus="onNewKeySnFocus" />
							<uni-icons type="scan" size="22" color="#4A90D9" @click="scanNewKeySn"></uni-icons>
							<view v-if="newKeySn" class="clear-btn" @click="clearNewKeySn">
								<uni-icons type="clear" size="16" color="#999"></uni-icons>
							</view>
							<!-- 选择寄件列表按钮 -->
							<view class="select-btn" @click="openSendListPopup">
								<uni-icons type="list" size="20" color="#4A90D9"></uni-icons>
							</view>
						</view>
					</view>
				</view>

				<!-- 新关键件信息预览 -->
				<view v-if="newKeySnInfo" class="preview-card">
					<view class="preview-row">
						<text class="preview-label">物料编码</text>
						<text class="preview-value">{{ newKeySnInfo.itemCode || '--' }}</text>
					</view>
					<view class="preview-row">
						<text class="preview-label">物料名称</text>
						<text class="preview-value">{{ newKeySnInfo.itemName || '--' }}</text>
					</view>
					<view class="preview-row">
						<text class="preview-label">规格型号</text>
						<text class="preview-value">{{ newKeySnInfo.itemSpec || '--' }}</text>
					</view>
					<view class="preview-row">
						<text class="preview-label">供应商</text>
						<text class="preview-value">{{ newKeySnInfo.supplierName || '--' }}</text>
					</view>
					<view class="preview-row">
						<text class="preview-label">绑定状态</text>
						<text class="preview-value" :class="{ warning: newKeySnInfo.bindStatus === 1 }">
							{{ newKeySnInfo.bindStatus === 1 ? '已绑定' : '未绑定' }}
						</text>
					</view>
				</view>

				<!-- 更换原因 -->
				<view class="form-item">
					<text class="form-label"><text class="required-star">*</text>更换原因</text>
					<textarea class="form-textarea" v-model="changeReason" placeholder="请输入更换原因" maxlength="500" />
					<text class="char-count">{{ changeReason.length }}/500</text>
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
			<view class="submit-btn" :class="{ disabled: !canSubmit }" @click="handleReplace">
				<text>{{ isSubmitting ? '提交中...' : '确认更换' }}</text>
			</view>
		</view>

		<!-- ════ 寄件列表弹窗（z-index高于底部按钮） ════ -->
		<uni-popup ref="sendListPopup" type="bottom" :safe-area="false" :z-index="200">
			<view class="send-list-popup" :class="[sizeClass]">
				<view class="popup-header">
					<text class="popup-title">选择寄件SN</text>
					<uni-icons type="closeempty" size="24" color="#666" @click="closeSendListPopup"></uni-icons>
				</view>

				<!-- 搜索框 -->
				<view class="popup-search">
					<input class="search-input" v-model="searchKeySn" placeholder="搜索关键件SN" @confirm="loadSendList" />
					<view class="search-btn" @click="loadSendList">
						<uni-icons type="search" size="20" color="#fff"></uni-icons>
					</view>
				</view>

				<scroll-view class="popup-list" scroll-y>
					<view v-if="sendListLoading" class="popup-loading">
						<uni-load-more status="loading" :content="'加载中...'"></uni-load-more>
					</view>
					<view v-else-if="sendList.length === 0" class="popup-empty">
						<uni-icons type="checkbox" size="48" color="#ccc"></uni-icons>
						<text>暂无已寄出关键件</text>
					</view>
					<view v-else>
						<view class="popup-item" v-for="(item, index) in sendList" :key="index"
							@click="selectSendItem(item)">
							<view class="popup-item-info">
								<text class="popup-item-sn">{{ item.keySn }}</text>
								<text class="popup-item-desc">{{ item.itemCode }} - {{ item.itemName }}</text>
							</view>
							<view class="popup-item-tag">
								<text class="tag-send">已寄出</text>
							</view>
						</view>
						<!-- 分页加载更多 -->
						<view v-if="sendListHasMore" class="load-more" @click="loadMoreSendList">
							<text>加载更多</text>
						</view>
						<view v-else-if="sendList.length > 0" class="load-more-end">
							<text>— 已加载全部 —</text>
						</view>
					</view>
				</scroll-view>

				<!-- 弹窗底部内边距，避开底部按钮 -->
				<view class="popup-bottom-space"></view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		name: 'PartReplace',

		mixins: [settingsMixin],

		data() {
			return {
				currentSn: '',
				productInfo: null,
				boundList: [],
				selectedKeySn: null,
				newKeySn: '',
				newKeySnInfo: null,
				changeReason: '',
				loading: false,
				inputFocus: false,
				newKeySnFocus: false,
				isSubmitting: false,
				// 寄件列表
				sendList: [],
				sendListLoading: false,
				sendListHasMore: true,
				sendListPageNo: 1,
				sendListPageSize: 20,
				searchKeySn: '',
				messageInfo: {
					show: false,
					content: '',
					type: 'info'
				},
				messageTimer: null
			};
		},

		computed: {
			canSubmit() {
				return this.selectedKeySn && this.newKeySnInfo && this.changeReason.trim() && !this.isSubmitting;
			}
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

			focusNewKeySn() {
				this.newKeySnFocus = false;
				this.$nextTick(() => {
					setTimeout(() => {
						this.newKeySnFocus = true;
					}, 100);
				});
			},

			onInputFocus() {},
			onNewKeySnFocus() {},

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

			scanNewKeySn() {
				uni.scanCode({
					success: (res) => {
						const code = res.result;
						this.newKeySn = code;
						this.queryNewKeySn(code);
					},
					fail: () => {
						this.showMessage('扫码失败', 'error');
						this.focusNewKeySn();
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

			onNewKeySnConfirm() {
				const code = this.newKeySn.trim();
				if (code) {
					this.queryNewKeySn(code);
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
				this.selectedKeySn = null;
				this.newKeySn = '';
				this.newKeySnInfo = null;
				this.changeReason = '';

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

			// ==================== 选择关键件 ====================
			selectKeySn(item) {
				this.selectedKeySn = item;
				this.newKeySn = '';
				this.newKeySnInfo = null;
				this.changeReason = '';
				this.showMessage(`已选择: ${item.keySn}`, 'info');
				setTimeout(() => {
					this.focusNewKeySn();
				}, 300);
			},

			// ==================== 查询新关键件 ====================
			async queryNewKeySn(sn) {
				if (!sn) {
					this.showMessage('请输入新关键件SN', 'warning');
					return;
				}

				// 不能和原关键件相同
				if (this.selectedKeySn && this.selectedKeySn.keySn === sn) {
					this.showMessage('新关键件不能与原关键件相同', 'warning');
					this.newKeySn = '';
					this.newKeySnInfo = null;
					this.focusNewKeySn();
					return;
				}

				uni.showLoading({
					title: '查询中...'
				});

				try {
					const res = await this.$request({
						url: '/api/pda/pdaProductSn/getKeyInfoBySn',
						method: 'GET',
						data: {
							keySn: sn
						}
					});

					uni.hideLoading();

					if (res.data && res.data.code === 200) {
						const data = res.data.result;
						this.newKeySnInfo = data.keySn || {};

						if (this.newKeySnInfo.bindStatus === 1) {
							this.showMessage('该关键件已绑定，无法使用', 'warning');
							this.newKeySnInfo = null;
							this.focusNewKeySn();
							return;
						}

						if (this.selectedKeySn && this.newKeySnInfo.itemCodeId !== this.selectedKeySn.itemCodeId) {
							this.showMessage('新关键件物料必须与原关键件一致', 'warning');
							this.newKeySnInfo = null;
							this.focusNewKeySn();
							return;
						}

						this.showMessage('新关键件验证通过', 'success');
						this.focusNewKeySn();
					} else {
						this.showMessage(res.data?.message || '关键件不存在', 'error');
						this.newKeySnInfo = null;
						this.focusNewKeySn();
					}
				} catch (error) {
					uni.hideLoading();
					this.showMessage('查询失败，请检查网络', 'error');
					this.newKeySnInfo = null;
					console.error('queryNewKeySn error:', error);
				}
			},

			// ==================== 寄件列表弹窗 ====================
			openSendListPopup() {
				this.sendList = [];
				this.sendListPageNo = 1;
				this.sendListHasMore = true;
				this.searchKeySn = '';
				this.$refs.sendListPopup.open();
				this.loadSendList();
			},

			closeSendListPopup() {
				this.$refs.sendListPopup.close();
			},

			async loadSendList() {
				if (this.sendListLoading) return;

				this.sendListLoading = true;
				this.sendList = [];
				this.sendListPageNo = 1;

				try {
					const params = {
						sendStatus: '1', // 已寄出
						pageNo: this.sendListPageNo,
						pageSize: this.sendListPageSize
					};
					if (this.searchKeySn.trim()) {
						params.keySn = this.searchKeySn.trim();
					}

					const res = await this.$request({
						url: '/mes/keySn/list',
						method: 'GET',
						data: params
					});

					this.sendListLoading = false;

					if (res.data && res.data.code === 200) {
						const result = res.data.result;
						const records = result.records || [];
						this.sendList = records;
						this.sendListHasMore = records.length >= this.sendListPageSize;
					}
				} catch (error) {
					this.sendListLoading = false;
					this.showMessage('加载寄件列表失败', 'error');
					console.error('loadSendList error:', error);
				}
			},

			async loadMoreSendList() {
				if (this.sendListLoading || !this.sendListHasMore) return;

				this.sendListLoading = true;
				this.sendListPageNo++;

				try {
					const params = {
						sendStatus: '1',
						pageNo: this.sendListPageNo,
						pageSize: this.sendListPageSize
					};
					if (this.searchKeySn.trim()) {
						params.keySn = this.searchKeySn.trim();
					}

					const res = await this.$request({
						url: '/mes/keySn/list',
						method: 'GET',
						data: params
					});

					this.sendListLoading = false;

					if (res.data && res.data.code === 200) {
						const result = res.data.result;
						const records = result.records || [];
						this.sendList = this.sendList.concat(records);
						this.sendListHasMore = records.length >= this.sendListPageSize;
					}
				} catch (error) {
					this.sendListLoading = false;
					this.showMessage('加载更多失败', 'error');
					console.error('loadMoreSendList error:', error);
				}
			},

			selectSendItem(item) {
				this.newKeySn = item.keySn;
				this.closeSendListPopup();
				this.queryNewKeySn(item.keySn);
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
							this.boundList = [];
							this.selectedKeySn = null;
							this.newKeySn = '';
							this.newKeySnInfo = null;
							this.changeReason = '';
							this.sendList = [];
							this.searchKeySn = '';
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

			clearNewKeySn() {
				this.newKeySn = '';
				this.newKeySnInfo = null;
				this.focusNewKeySn();
			},

			// ==================== 提交更换 ====================
			async doReplace() {
				if (this.isSubmitting) return;

				this.isSubmitting = true;
				uni.showLoading({
					title: '提交中...'
				});

				try {
					const requestData = {
						productId: this.productInfo.id,
						productSn: this.productInfo.productSn,
						materialId: this.selectedKeySn.itemCodeId,
						oldMaterialSn: this.selectedKeySn.keySn,
						newMaterialSn: this.newKeySnInfo.keySn,
						changeReason: this.changeReason.trim()
					};

					const res = await this.$request({
						url: '/api/pda/pdaProductSn/keySnChange',
						method: 'POST',
						data: requestData
					});

					uni.hideLoading();
					this.isSubmitting = false;

					if (res.data && res.data.code === 200) {
						this.showMessage('更换成功', 'success');
						await this.doQuery(this.currentSn);
						this.selectedKeySn = null;
						this.newKeySn = '';
						this.newKeySnInfo = null;
						this.changeReason = '';
						return true;
					} else {
						this.showMessage(res.data?.message || '更换失败', 'error');
						return false;
					}
				} catch (error) {
					uni.hideLoading();
					this.isSubmitting = false;
					this.showMessage('提交失败，请检查网络', 'error');
					console.error('doReplace error:', error);
					return false;
				}
			},

			handleReplace() {
				if (!this.canSubmit) {
					if (!this.selectedKeySn) {
						this.showMessage('请选择要更换的关键件', 'warning');
					} else if (!this.newKeySnInfo) {
						this.showMessage('请扫码或输入新关键件SN', 'warning');
					} else if (!this.changeReason.trim()) {
						this.showMessage('请输入更换原因', 'warning');
					}
					return;
				}

				uni.showModal({
					title: '确认更换',
					content: `确认将关键件 ${this.selectedKeySn.keySn} 更换为 ${this.newKeySnInfo.keySn} 吗？`,
					success: async (res) => {
						if (res.confirm) {
							await this.doReplace();
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

	.part-replace {
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

	.input-right.full-width {
		flex: 1;
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

	.select-btn {
		padding: 6rpx 10rpx;
		border-radius: 6rpx;
		background: rgba(74, 144, 217, .1);
		flex-shrink: 0;

		&:active {
			opacity: 0.7;
		}
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
		display: flex;
		align-items: center;
	}

	.list-count {
		font-size: 24rpx;
		color: $hint;
		margin-left: 8rpx;
		font-weight: 400;
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

	/* 列表卡片 */
	.list-card {
		background: #fff;
		border-radius: 16rpx;
		padding: 24rpx;
		margin-bottom: 16rpx;
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

	.item-select-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8rpx;
		flex-shrink: 0;
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

	.form-display {
		background: $bg;
		border-radius: 12rpx;
		padding: 16rpx 20rpx;
		border: 1rpx solid $border;
	}

	.form-display-value {
		font-size: 26rpx;
		font-weight: 500;
		color: $text;
		display: block;
	}

	.form-display-desc {
		font-size: 22rpx;
		color: $hint;
		margin-top: 4rpx;
		display: block;
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

	/* 预览卡片 */
	.preview-card {
		margin-bottom: 20rpx;
		padding: 16rpx;
		background: rgba(74, 144, 217, .06);
		border-radius: 12rpx;
		border: 1rpx solid rgba(74, 144, 217, .2);
	}

	.preview-row {
		display: flex;
		justify-content: space-between;
		padding: 4rpx 0;
		font-size: 24rpx;
	}

	.preview-label {
		color: $hint;
	}

	.preview-value {
		color: $text;
		font-weight: 500;

		&.warning {
			color: $danger;
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

		&.disabled {
			opacity: 0.5;
		}
	}

	/* 寄件列表弹窗 */
	.send-list-popup {
		background: #fff;
		border-top-left-radius: 24rpx;
		border-top-right-radius: 24rpx;
		padding: 24rpx 24rpx 0;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 16rpx;
		border-bottom: 1rpx solid $border;
		margin-bottom: 16rpx;
		flex-shrink: 0;
	}

	.popup-title {
		font-size: 30rpx;
		font-weight: 600;
		color: $text;
	}

	.popup-search {
		display: flex;
		gap: 12rpx;
		margin-bottom: 16rpx;
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		padding: 16rpx 20rpx;
		background: $bg;
		border-radius: 10rpx;
		font-size: 24rpx;
		color: $text;
		border: 1rpx solid $border;
	}

	.search-btn {
		padding: 12rpx 24rpx;
		background: $primary;
		border-radius: 10rpx;
		display: flex;
		align-items: center;
		justify-content: center;

		&:active {
			opacity: 0.8;
		}
	}

	.popup-list {
		flex: 1;
		max-height: 50vh;
	}

	.popup-loading {
		padding: 40rpx 0;
		display: flex;
		justify-content: center;
	}

	.popup-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40rpx 0;
		gap: 16rpx;
		color: $hint;
		font-size: 24rpx;
	}

	.popup-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 20rpx;
		background: $bg;
		border-radius: 12rpx;
		border: 1rpx solid $border;
		margin-bottom: 12rpx;

		&:active {
			opacity: 0.7;
		}
	}

	.popup-item-info {
		display: flex;
		flex-direction: column;
		gap: 4rpx;
	}

	.popup-item-sn {
		font-size: 26rpx;
		font-weight: 500;
		color: $text;
	}

	.popup-item-desc {
		font-size: 22rpx;
		color: $hint;
	}

	.popup-item-tag {
		.tag-send {
			padding: 4rpx 16rpx;
			background: rgba(74, 144, 217, .12);
			color: $primary;
			border-radius: 20rpx;
			font-size: 20rpx;
		}
	}

	.load-more {
		padding: 20rpx 0;
		text-align: center;
		color: $primary;
		font-size: 24rpx;

		&:active {
			opacity: 0.7;
		}
	}

	.load-more-end {
		padding: 20rpx 0;
		text-align: center;
		color: $hint;
		font-size: 22rpx;
	}

	/* 弹窗底部内边距 - 避开底部按钮 */
	.popup-bottom-space {
		height: 140rpx;
		flex-shrink: 0;
	}

	/* 深色主题 */
	.theme-dark {

		.header-card,
		.input-card,
		.info-card,
		.list-card,
		.form-card,
		.bottom-bar,
		.send-list-popup {
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

		.list-count {
			color: #666;
		}

		.list-item {
			background: #1e1e36;
			border-color: #2a2a45;

			&:active {
				background: rgba(74, 144, 217, .1);
			}
		}

		.item-value {
			color: #e0e0e0;

			&.sn {
				color: #7cadff;
			}
		}

		.form-label {
			color: #e0e0e0;
		}

		.form-display {
			background: #1e1e36;
			border-color: #2a2a45;
		}

		.form-display-value {
			color: #e0e0e0;
		}

		.form-display-desc {
			color: #666;
		}

		.form-textarea {
			background: #1e1e36;
			border-color: #2a2a45;
			color: #e0e0e0;

			&:focus {
				border-color: #7cadff;
			}
		}

		.preview-card {
			background: rgba(74, 144, 217, .1);
			border-color: rgba(74, 144, 217, .25);
		}

		.preview-value {
			color: #e0e0e0;

			&.warning {
				color: #ef9a9a;
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

		.popup-header {
			border-bottom-color: #2a2a45;
		}

		.popup-title {
			color: #e0e0e0;
		}

		.search-input {
			background: #1e1e36;
			border-color: #2a2a45;
			color: #e0e0e0;
		}

		.popup-item {
			background: #1e1e36;
			border-color: #2a2a45;
		}

		.popup-item-sn {
			color: #e0e0e0;
		}

		.popup-item-desc {
			color: #666;
		}

		.load-more-end {
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