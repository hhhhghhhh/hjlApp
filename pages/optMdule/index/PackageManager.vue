<!-- PackageManager.vue 共用组件 -->
<template>
	<view class="package-manager" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 顶部信息 ════ -->
		<view class="header-card">
			<view class="header-title">
				<text class="title">{{ modeText }}</text>
				<view class="header-actions">
					<view class="action-btn" @click="handleReset">
						<uni-icons type="refresh" size="20" color="#D9726A"></uni-icons>
						<text>重置</text>
					</view>
				</view>
			</view>
		</view>

		<!-- ════ 包装信息 ════ -->
		<view class="info-card">
			<view class="info-row">
				<text class="input-left">包装SN</text>
				<view class="info-value-wrapper">
					<input 
						class="info-input" 
						v-model="packageInfo.packageSn" 
						:placeholder="packagePlaceholder"
						:focus="packageInputFocus"
						@confirm="onPackageInputConfirm"
						@focus="onPackageFocus"
					/>
					<uni-icons type="scan" size="22" color="#4A90D9" @click="scanPackage"></uni-icons>
					<view v-if="packageInfo.packageSn" class="clear-btn" @click="clearPackageSn">
						<uni-icons type="clear" size="16" color="#999"></uni-icons>
					</view>
				</view>
			</view>

			<view class="info-divider"></view>

			<view class="info-stats">
				<view class="stat-item">
					<text class="stat-label">每箱数量</text>
					<text class="stat-value">{{ packageInfo.quantityPerBox || '--' }}</text>
				</view>
				<view class="stat-item">
					<text class="stat-label">已包装</text>
					<text class="stat-value highlight">{{ packagedList.length }}</text>
				</view>
				<view class="stat-item">
					<text class="stat-label">{{ isBindMode ? '待包装' : '待解绑' }}</text>
					<text class="stat-value">{{ pendingList.length }}</text>
				</view>
				<view v-if="isBindMode" class="stat-item">
					<text class="stat-label">剩余数量</text>
					<text class="stat-value" :class="{ warning: remainingQty < 0 }">
						{{ remainingQty >= 0 ? remainingQty : '已超量' }}
					</text>
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
					<input 
						class="input-value-input" 
						v-model="currentProductSn" 
						:placeholder="productPlaceholder"
						:focus="productInputFocus"
						@confirm="onProductInputConfirm"
						@focus="onProductFocus"
					/>
					<uni-icons type="scan" size="22" color="#4A90D9" @click="scanProduct"></uni-icons>
					<view v-if="currentProductSn" class="clear-btn" @click="clearCurrentProduct">
						<uni-icons type="clear" size="16" color="#999"></uni-icons>
					</view>
				</view>
			</view>

			<!-- 自动提交勾选项（仅绑定模式） -->
			<view v-if="isBindMode" class="auto-submit-row">
				<view class="auto-submit-checkbox" @click="toggleAutoSubmit">
					<uni-icons 
						:type="autoSubmit ? 'checkbox-filled' : 'circle'" 
						size="20" 
						:color="autoSubmit ? '#4A90D9' : '#ccc'"
					></uni-icons>
					<text class="auto-submit-label">装满自动提交</text>
				</view>
				<text class="auto-submit-hint" v-if="autoSubmit && remainingQty === 0">已满，将自动提交</text>
				<text class="auto-submit-hint" v-else-if="autoSubmit">剩余 {{ remainingQty }} 个满箱</text>
			</view>
		</view>
		<!-- ════ 消息提示 ════ -->
		<view class="message-box" :class="[messageInfo.type, messageInfo.show ? 'show' : '']">
			<text>{{ messageInfo.content }}</text>
		</view>

		<!-- ════ 标签页：待处理 / 已包装 ════ -->
		<view class="tabs-container">
			<view class="tabs-header">
				<view 
					class="tab-item" 
					:class="{ active: activeTab === 'pending' }"
					@click="activeTab = 'pending'"
				>
					<text>{{ isBindMode ? '待包装' : '待解绑' }}（{{ pendingList.length }}）</text>
				</view>
				<view 
					class="tab-item" 
					:class="{ active: activeTab === 'packaged' }"
					@click="activeTab = 'packaged'"
				>
					<text>已包装（{{ packagedList.length }}）</text>
				</view>
			</view>

			<!-- 待处理列表 -->
			<view v-show="activeTab === 'pending'" class="tab-content">
				<view v-if="pendingList.length === 0" class="empty-state">
					<uni-icons type="checkbox" size="48" color="#ccc"></uni-icons>
					<text>暂无{{ isBindMode ? '待包装' : '待解绑' }}产品</text>
				</view>
				<view v-else class="item-list">
					<view 
						class="list-item" 
						v-for="(item, index) in pendingList" 
						:key="index"
					>
						<view class="item-index">{{ index + 1 }}</view>
						<view class="item-info">
							<view class="item-row">
								<text class="item-label">产品编码</text>
								<text class="item-value">{{ item.itemCode || '--' }}</text>
							</view>
							<view class="item-row">
								<text class="item-label">产品名称</text>
								<text class="item-value">{{ item.itemName || '--' }}</text>
							</view>
							<view class="item-row">
								<text class="item-label">产品型号</text>
								<text class="item-value">{{ item.itemSpec || '--' }}</text>
							</view>
							<view class="item-row">
								<text class="item-label">产品SN</text>
								<text class="item-value sn">{{ item.productSn }}</text>
							</view>
						</view>
						<view class="item-remove" @click="removePending(index)">
							<uni-icons type="close" size="20" color="#D9726A"></uni-icons>
						</view>
					</view>
				</view>
			</view>

			<!-- 已包装列表（真实数据源，只读展示） -->
			<view v-show="activeTab === 'packaged'" class="tab-content">
				<view v-if="packagedList.length === 0" class="empty-state">
					<uni-icons type="checkbox" size="48" color="#ccc"></uni-icons>
					<text>暂无已包装产品</text>
				</view>
				<view v-else class="item-list">
					<view 
						class="list-item packaged-item-clickable" 
						v-for="(item, index) in packagedList" 
						:key="index"
						@click="addToPendingFromPackaged(item, index)"
					>
						<view class="item-index">{{ index + 1 }}</view>
						<view class="item-info">
							<view class="item-row">
								<text class="item-label">产品编码</text>
								<text class="item-value">{{ item.itemCode || '--' }}</text>
							</view>
							<view class="item-row">
								<text class="item-label">产品名称</text>
								<text class="item-value">{{ item.itemName || '--' }}</text>
							</view>
							<view class="item-row">
								<text class="item-label">产品型号</text>
								<text class="item-value">{{ item.itemSpec || '--' }}</text>
							</view>
							<view class="item-row">
								<text class="item-label">产品SN</text>
								<text class="item-value sn">{{ item.productSn }}</text>
							</view>
						</view>
						<view class="item-add-hint" v-if="!isBindMode">
							<uni-icons type="plusempty" size="20" color="#4A90D9"></uni-icons>
						</view>
					</view>
				</view>
			</view>
		</view>

		<!-- ════ 底部提交 ════ -->
		<view class="bottom-bar">
			<view class="submit-btn" @click="handleSubmit">
				<text>{{ isBindMode ? '确认绑定' : '确认解绑' }}</text>
			</view>
		</view>
	</view>
</template>

<script>
import settingsMixin from '@/common/settingsMixin.js';

export default {
	name: 'PackageManager',
	
	mixins: [settingsMixin],

	props: {
		mode: {
			type: String,
			default: 'packageBind' // 'packageBind' | 'packageUnbind'
		}
	},

	data() {
		return {
			activeTab: 'pending',
			autoSubmit: true,
			// 包装信息
			packageInfo: {
				packageSn: '',
				itemCode: '',
				itemName: '',
				itemSpec: '',
				productionOrderNo: '',
				quantityPerBox: null,
				packageQuantity: 0,
				packageStatus: '0'
			},
			// 当前输入的产品SN
			currentProductSn: '',
			// 待处理列表（待包装/待解绑）- 用户操作的数据集合
			pendingList: [],
			// 已包装列表 - 从接口获取的真实数据，只读
			packagedList: [],
			// 包装SN信息（从接口获取）
			packageSnInfo: null,
			scanning: false,
			packageInputFocus: false,
			productInputFocus: false,
			isSubmitting: false,
			messageInfo: {
				show: false,
				content: '',
				type: 'info'
			},
			messageTimer: null
		};
	},

	computed: {
		isBindMode() {
			return this.mode === 'packageBind';
		},
		modeText() {
			return this.isBindMode ? '包装绑定' : '包装解绑';
		},
		packagePlaceholder() {
			return '请输入或扫码包装SN';
		},
		productPlaceholder() {
			return this.isBindMode ? '请输入或扫码产品SN，回车加入待包装' : '请输入或扫码产品SN，回车加入待解绑';
		},
		remainingQty() {
			if (!this.isBindMode) return 0;
			const boxQty = this.packageInfo.quantityPerBox || 0;
			const packaged = this.packagedList.length || 0;
			const pending = this.pendingList.length || 0;
			return boxQty - packaged - pending;
		}
	},

	watch: {
		remainingQty(newVal) {
			if (this.isBindMode && this.autoSubmit && newVal === 0 && this.pendingList.length > 0 && !this.isSubmitting) {
				this.autoSubmitHandler();
			}
		}
	},

	mounted() {
		setTimeout(() => {
			this.focusPackageInput();
		}, 500);
	},

	methods: {
		// ==================== 聚焦控制 ====================
		focusPackageInput() {
			this.packageInputFocus = false;
			this.$nextTick(() => {
				setTimeout(() => {
					this.packageInputFocus = true;
				}, 100);
			});
		},

		focusProductInput() {
			this.productInputFocus = false;
			this.$nextTick(() => {
				setTimeout(() => {
					this.productInputFocus = true;
				}, 100);
			});
		},

		onPackageFocus() {},
		onProductFocus() {},

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
		scanPackage() {
			if (this.scanning) return;
			this.scanning = true;
			uni.scanCode({
				success: (res) => {
					const code = res.result;
					this.packageInfo.packageSn = code;
					this.fetchPackageInfo(code);
				},
				fail: () => {
					this.showMessage('扫码失败', 'error');
					this.focusPackageInput();
				},
				complete: () => {
					this.scanning = false;
				}
			});
		},

		scanProduct() {
			if (this.scanning) return;
			this.scanning = true;
			uni.scanCode({
				success: (res) => {
					const code = res.result;
					this.currentProductSn = code;
					this.handleProductSn(code);
				},
				fail: () => {
					this.showMessage('扫码失败', 'error');
					this.focusProductInput();
				},
				complete: () => {
					this.scanning = false;
				}
			});
		},

		// ==================== 输入确认 ====================
		onPackageInputConfirm() {
			const code = this.packageInfo.packageSn.trim();
			if (code) {
				this.fetchPackageInfo(code);
			}
		},

		onProductInputConfirm() {
			const code = this.currentProductSn.trim();
			if (code) {
				this.handleProductSn(code);
			}
		},

		// ==================== 处理产品SN（扫码/输入加入待处理） ====================
		async handleProductSn(code) {
			// 检查是否已在待处理列表
			if (this.pendingList.some(item => item.productSn === code)) {
				this.showMessage(`该产品已在${this.isBindMode ? '待包装' : '待解绑'}列表中`, 'warning');
				this.clearCurrentProduct();
				this.focusProductInput();
				return;
			}

			if (this.isBindMode) {
				// ========== 绑定模式：查询产品信息，验证后加入待包装 ==========
				if (this.remainingQty <= 0) {
					this.showMessage('已满箱，请提交或重置', 'warning');
					this.clearCurrentProduct();
					this.focusProductInput();
					return;
				}

				// 检查是否已在已包装列表
				if (this.packagedList.some(item => item.productSn === code)) {
					this.showMessage('该产品已包装', 'warning');
					this.clearCurrentProduct();
					this.focusProductInput();
					return;
				}

				uni.showLoading({ title: '查询中...' });
				try {
					const res = await this.$request({
						url: '/api/pda/pdaPackageSn/getProductSn',
						method: 'GET',
						data: { productSn: code }
					});
					uni.hideLoading();

					if (res.data && res.data.code === 200) {
						const data = res.data.result;
						if (data.packageId) {
							this.showMessage(`产品条码[${code}]已包装`, 'warning');
							this.clearCurrentProduct();
							this.focusProductInput();
							return;
						}
						if (data.stockStatus === 1) {
							this.showMessage(`产品条码[${code}]已出货，无法绑定`, 'warning');
							this.clearCurrentProduct();
							this.focusProductInput();
							return;
						}

						this.pendingList.push({
							productSn: data.productSn,
							itemCode: data.itemCode,
							itemName: data.itemName,
							itemSpec: data.itemSpec
						});

						this.clearCurrentProduct();
						this.showMessage(`已加入待包装（${this.pendingList.length}）`, 'success');
						this.focusProductInput();
					} else {
						this.showMessage(res.data?.message || '产品条码不存在', 'error');
						this.clearCurrentProduct();
						this.focusProductInput();
					}
				} catch (error) {
					uni.hideLoading();
					this.showMessage('查询失败，请检查网络', 'error');
					console.error('handleProductSn error:', error);
					this.clearCurrentProduct();
					this.focusProductInput();
				}
			} else {
				// ========== 解绑模式：从已包装列表复制数据到待解绑 ==========
				const packagedItem = this.packagedList.find(item => item.productSn === code);
				if (!packagedItem) {
					this.showMessage(`产品条码[${code}]不在该包装中`, 'warning');
					this.clearCurrentProduct();
					this.focusProductInput();
					return;
				}

				// 加入待解绑列表（复制数据，不影响已包装列表）
				this.pendingList.push({
					productSn: packagedItem.productSn,
					itemCode: packagedItem.itemCode,
					itemName: packagedItem.itemName,
					itemSpec: packagedItem.itemSpec,
					packageId: packagedItem.packageId
				});

				this.clearCurrentProduct();
				this.showMessage(`已加入待解绑（${this.pendingList.length}）`, 'success');
				this.focusProductInput();
			}
		},

		// ==================== 从已包装列表点击加入待处理 ====================
		addToPendingFromPackaged(item, index) {
			// 检查是否已在待处理列表
			if (this.pendingList.some(p => p.productSn === item.productSn)) {
				this.showMessage(`该产品已在${this.isBindMode ? '待包装' : '待解绑'}列表中`, 'warning');
				return;
			}

			if (this.isBindMode) {
				// 绑定模式：不能从已包装列表加入
				this.showMessage('该产品已包装', 'warning');
				return;
			}

			// 解绑模式：复制数据到待解绑列表
			this.pendingList.push({
				productSn: item.productSn,
				itemCode: item.itemCode,
				itemName: item.itemName,
				itemSpec: item.itemSpec,
				packageId: item.packageId
			});

			this.showMessage(`已加入待解绑（${this.pendingList.length}）`, 'success');
		},

		// ==================== 接口调用 ====================
		async fetchPackageInfo(code) {
			uni.showLoading({ title: '查询中...' });
			try {
				const res = await this.$request({
					url: '/api/pda/pdaPackageSn/getPackageSn',
					method: 'GET',
					data: { packageSn: code }
				});
				uni.hideLoading();

				if (res.data && res.data.code === 200) {
					const data = res.data.result;
					this.packageSnInfo = data;
					this.packageInfo = {
						packageSn: data.packageSn,
						itemCode: data.itemCode || '',
						itemName: data.itemName || '',
						itemSpec: data.itemSpec || '',
						productionOrderNo: data.productionOrderNo || '',
						quantityPerBox: data.quantityPerBox,
						packageQuantity: data.packageQuantity || 0,
						packageStatus: data.packageStatus || '0'
					};

					if (this.isBindMode && data.packageStatus === '2') {
						this.showMessage('该包装已装满，无法继续包装', 'warning');
					} else {
						this.showMessage('包装信息已加载', 'success');
					}

					// 加载已包装列表
					await this.fetchPackagedList(code);

					setTimeout(() => {
						this.focusProductInput();
					}, 300);
				} else {
					this.showMessage(res.data?.message || '包装条码不存在', 'error');
				}
			} catch (error) {
				uni.hideLoading();
				this.showMessage('查询失败，请检查网络', 'error');
				console.error('fetchPackageInfo error:', error);
			}
		},

		async fetchPackagedList(packageSn) {
			try {
				const res = await this.$request({
					url: '/api/pda/pdaPackageSn/getProductByPackageSn',
					method: 'GET',
					data: { packageSn: packageSn }
				});

				if (res.data && res.data.code === 200) {
					this.packagedList = res.data.result || [];
				}
			} catch (error) {
				console.error('fetchPackagedList error:', error);
			}
		},

		// ==================== 待处理列表操作 ====================
		removePending(index) {
			this.pendingList.splice(index, 1);
			this.showMessage('已移除', 'info');
			this.focusProductInput();
		},

		clearCurrentProduct() {
			this.currentProductSn = '';
		},

		clearPackageSn() {
			this.packageInfo.packageSn = '';
			this.packageSnInfo = null;
			this.packagedList = [];
			this.pendingList = [];
			this.clearCurrentProduct();
			if (this.isBindMode) this.autoSubmit = false;
			this.focusPackageInput();
		},

		// ==================== 自动提交切换（仅绑定模式） ====================
		toggleAutoSubmit() {
			if (!this.isBindMode) return;
			this.autoSubmit = !this.autoSubmit;
			this.showMessage(this.autoSubmit ? '已开启装满自动提交' : '已关闭装满自动提交', 'info');
		},

		// ==================== 自动提交处理（仅绑定模式） ====================
		async autoSubmitHandler() {
			if (!this.isBindMode) return;
			if (this.isSubmitting) return;
			if (!this.packageInfo.packageSn) return;
			if (this.pendingList.length === 0) return;

			this.showMessage('已满箱，正在自动提交...', 'info');
			await this.doSubmit();
		},

		// ==================== 重置 ====================
		handleReset() {
			uni.showModal({
				title: '提示',
				content: '确定要重置所有数据吗？',
				success: (res) => {
					if (res.confirm) {
						this.packageInfo = {
							packageSn: '',
							itemCode: '',
							itemName: '',
							itemSpec: '',
							productionOrderNo: '',
							quantityPerBox: null,
							packageQuantity: 0,
							packageStatus: '0'
						};
						this.packageSnInfo = null;
						this.packagedList = [];
						this.pendingList = [];
						this.clearCurrentProduct();
						if (this.isBindMode) this.autoSubmit = false;
						this.showMessage('已重置', 'success');
						setTimeout(() => {
							this.focusPackageInput();
						}, 300);
					}
				}
			});
		},

		// ==================== 提交 ====================
		async doSubmit() {
			if (this.isSubmitting) return;

			this.isSubmitting = true;
			uni.showLoading({ title: '提交中...' });

			try {
				const productSnList = this.pendingList.map(item => item.productSn);
				const requestData = {
					packageSn: this.packageInfo.packageSn,
					productSnList: productSnList
				};

				const url = this.isBindMode ? '/api/pda/pdaPackageSn/binding' : '/api/pda/pdaPackageSn/unBinding';
				const method = 'POST';

				const res = await this.$request({
					url: url,
					method: method,
					data: requestData
				});

				uni.hideLoading();
				this.isSubmitting = false;

				if (res.data && res.data.code === 200) {
					this.showMessage(this.isBindMode ? '绑定成功' : '解绑成功', 'success');
					// 清空待处理列表
					this.pendingList = [];
					// 重新加载已包装列表（刷新真实数据）
					await this.fetchPackagedList(this.packageInfo.packageSn);
					this.focusProductInput();
					return true;
				} else {
					this.showMessage(res.data?.message || (this.isBindMode ? '绑定失败' : '解绑失败'), 'error');
					return false;
				}
			} catch (error) {
				uni.hideLoading();
				this.isSubmitting = false;
				this.showMessage('提交失败，请检查网络', 'error');
				console.error('doSubmit error:', error);
				return false;
			}
		},

		handleSubmit() {
			if (!this.packageInfo.packageSn) {
				this.showMessage('请先扫码包装SN', 'warning');
				this.focusPackageInput();
				return;
			}
			if (this.pendingList.length === 0) {
				this.showMessage(`请至少添加一个产品到${this.isBindMode ? '待包装' : '待解绑'}列表`, 'warning');
				this.focusProductInput();
				return;
			}

			uni.showModal({
				title: '确认提交',
				content: `包装 ${this.packageInfo.packageSn}，${this.isBindMode ? '待包装' : '待解绑'} ${this.pendingList.length} 个产品`,
				success: async (res) => {
					if (res.confirm) {
						await this.doSubmit();
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

.package-manager {
	padding: 16rpx 0 160rpx;
}

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

.info-card {
	background: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 16rpx;
}

.info-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8rpx 0;
}

.info-value-wrapper {
	display: flex;
	align-items: center;
	gap: 10rpx;
	flex: 1;
	justify-content: flex-end;
}

.info-input {
	flex: 1;
	text-align: left;
	font-size: 26rpx;
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
		font-size: 24rpx;
	}
}

.clear-btn {
	padding: 4rpx 6rpx;
	border-radius: 4rpx;
	background: rgba(0, 0, 0, .05);
	flex-shrink: 0;
}

.info-divider {
	height: 1rpx;
	background: $border;
	margin: 16rpx 0;
}

.info-stats {
	display: flex;
	justify-content: space-around;
	padding: 8rpx 0;
}

.stat-item {
	text-align: center;
}

.stat-label {
	display: block;
	font-size: 22rpx;
	color: $hint;
	margin-bottom: 4rpx;
}

.stat-value {
	font-size: 32rpx;
	font-weight: 700;
	color: $text;

	&.highlight {
		color: $primary;
	}
	&.warning {
		color: $danger;
	}
}

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

.auto-submit-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-top: 12rpx;
	margin-top: 4rpx;
}

.auto-submit-checkbox {
	display: flex;
	align-items: center;
	gap: 8rpx;
	cursor: pointer;

	&:active {
		opacity: 0.7;
	}
}

.auto-submit-label {
	font-size: 24rpx;
	color: $text;
}

.auto-submit-hint {
	font-size: 22rpx;
	color: $hint;
}

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

.packaged-item-clickable {
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

.bottom-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 20rpx 24rpx;
	padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	background: #fff;
	box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
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

.theme-dark {
	.header-card,
	.info-card,
	.input-card,
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

	.info-input {
		color: #e0e0e0;

		&:focus {
			border-bottom-color: #7cadff;
		}

		&::placeholder {
			color: #666;
		}
	}

	.info-value {
		color: #e0e0e0;
	}

	.stat-value {
		color: #e0e0e0;
	}

	.auto-submit-label {
		color: #e0e0e0;
	}

	.auto-submit-hint {
		color: #666;
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

	.tabs-header {
		border-bottom-color: #2a2a45;
	}

	.tab-item {
		color: #888;
		&.active {
			color: #7cadff;
		}
	}

	.info-divider {
		background: #2a2a45;
	}

	.input-row {
		border-color: #2a2a45;
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

	.bottom-bar {
		box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.3);
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