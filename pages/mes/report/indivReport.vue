<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- 表单区域 -->
		<view class="card form-card">
			<work-center-selector ref="workCenterSelector" :selected-value="formData.workCenterName"
				@select="handleSelectWorkCenter" />
			<mo-selector ref="moSelector" :selected-value="formData.moNumber" :disabled="!formData.xtId"
				:xt-id="formData.xtId" :group-id="formData.groupId" @select="handleSelectMo" />
			<view class="info-grid" v-if="formData.moNumber">
				<view class="info-row">
					<view class="info-item left">
						<text class="info-label">线别：</text>
						<text class="info-value">{{ formData.xtName || '--' }}</text>
					</view>
					<view class="info-item right">
						<text class="info-label">产品料号：</text>
						<text class="info-value">{{ formData.modelCode || '--' }}</text>
					</view>
				</view>
				<view class="info-row">
					<view class="info-item left">
						<text class="info-label">工序：</text>
						<text class="info-value">{{ formData.groupName || '--' }}</text>
					</view>
					<view class="info-item right">
						<text class="info-label">产品名称：</text>
						<text class="info-value">{{ formData.modelName || '--' }}</text>
					</view>
				</view>
				<view class="info-row">
					<view class="info-item left">
						<text class="info-label">工序过站数：</text>
						<text class="info-value highlight">{{ formData.passQty !== undefined && formData.passQty !== null ? formData.passQty : '--' }}</text>
					</view>
					<view class="info-item right">
						<text class="info-label">产品规格：</text>
						<text class="info-value">{{ formData.modelSpec || '--' }}</text>
					</view>
				</view>
				<view class="info-row">
					<view style="width: 50%;"></view>
					<view class="info-item right">
						<text class="info-label">产品版本：</text>
						<text class="info-value">{{ formData.modelVer || '--' }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 扫描区域 -->
		<view class="card scan-card" v-if="formData.moNumber && formData.groupId">
			<view class="scan-input-wrapper">
				<input 
					ref="snInput" 
					v-model="formData.proSn" 
					:placeholder="getScanPlaceholder()" 
					:focus="snInputFocus"
					confirm-type="完成" 
					@confirm="handleScanConfirm" 
					class="scan-input" 
					@focus="handleInputFocus"
					@blur="handleInputBlur" 
				/>
				<view class="scan-btn" @click.stop="handleScanClick">
					<uni-icons type="scan" size="18" :color="themePrimary"></uni-icons>
				</view>
			</view>

			<!-- 自动提交勾选项 -->
			<view class="auto-submit-wrapper" v-if="formData.moNumber">
				<label class="auto-submit-label" @click="toggleAutoSubmit">
					<view class="checkbox" :class="{ checked: autoSubmitEnabled }"
						:style="{ borderColor: autoSubmitEnabled ? themePrimary : '#d9d9d9', backgroundColor: autoSubmitEnabled ? themePrimary : '#fff' }">
						<text v-if="autoSubmitEnabled" class="checkbox-icon">✓</text>
					</view>
					<text class="auto-submit-text">自动提交（输入SN后回车报工）</text>
				</label>
			</view>

			<!-- 上一条SN记录 -->
			<view class="last-sn" v-if="lastSnRecord">
				<view class="last-sn-content">
					<text class="last-label">上一条SN：</text>
					<text class="last-value">{{ lastSnRecord.sn }}</text>
					<view class="last-sn-fill-btn" @click.stop="fillLastSn">
						填入
					</view>
				</view>
			</view>

			<view class="tip-box" :class="getTipBoxClass()">
				<text>{{ formData.tip || '等待扫描...' }}</text>
			</view>
		</view>

		<!-- 底部按钮始终显示 -->
		<view class="bottom-bar" v-if="formData.moNumber">
			<view class="bottom-btns">
				<view class="btn-reset" @click="handleResetPage">初始化</view>
				<view class="btn-submit" :class="{ disabled: !canSubmit || isSubmitting }"
					:style="submitStyle" @click="handleSubmitPass">
					<text v-if="!isSubmitting">报工保存</text>
					<text v-else>报工中…</text>
				</view>
			</view>
		</view>

		<!-- 初始提示 -->
		<view class="init-tip" v-if="!formData.workCenterId">
			<text>请先选择工作中心</text>
		</view>
	</view>
</template>

<script>
import WorkCenterSelector from '@/components/mes/indivReport/WorkCenterSelector.vue'
import MoSelector from '@/components/mes/indivReport/MoSelector.vue'
import { savePassSn } from "@/api/mesApi.js";
import settingsMixin from '@/common/settingsMixin.js';

export default {
	mixins: [settingsMixin],
	components: { WorkCenterSelector, MoSelector },

	computed: {
		submitStyle() {
			return this.isSubmitting ? {} : { background: this.themePrimary };
		}
	},

	data() {
		return {
			formData: {
				workCenterId: "", workCenterName: "",
				moId: "", moNumber: "",
				xtId: "", xtName: "",
				groupId: "", groupName: "",
				workStationId: "",
				modelCode: "", modelName: "", modelVer: "", modelSpec: "",
				passQty: "", proSn: "", tip: ""
			},
			lastSnRecord: null,
			snInputFocus: false,
			inputReady: false,
			canSubmit: false,
			isSubmitting: false,
			tipType: "info",
			isScanning: false,
			tipTimeout: null,
			autoSubmitEnabled: false  // 自动提交开关
		}
	},

	watch: {
		'formData.proSn': function(newVal) {
			this.canSubmit = !!newVal && newVal.trim().length > 0;
		}
	},

	mounted() {
		this.initPage();
		this.listenBackPress();
	},

	onUnload() {
		if (this.backPressListener) this.backPressListener.remove();
		if (this.tipTimeout) clearTimeout(this.tipTimeout);
	},

	methods: {
		initPage() {
			this.loadLastSn();
		},

		listenBackPress() {
			// #ifdef APP-PLUS
			this.backPressListener = plus.key.addEventListener('backbutton', () => { this.handleBackPress(); });
			// #endif
		},

		handleBackPress() {
			const wcp = this.$refs.workCenterSelector && this.$refs.workCenterSelector.$refs && this.$refs.workCenterSelector.$refs.popup;
			const mop = this.$refs.moSelector && this.$refs.moSelector.$refs && this.$refs.moSelector.$refs.popup;
			if (wcp && wcp.isShow) { this.$refs.workCenterSelector.closeSelector(); return true; }
			if (mop && mop.isShow) { this.$refs.moSelector.closeSelector(); return true; }
			return false;
		},

		getTipBoxClass() { return this.tipType; },

		getScanPlaceholder() {
			return this.formData.moNumber ? "扫描产品SN，回车或点击保存" : "请先选择工单";
		},

		setLastSnRecord(sn, status, message) {
			this.lastSnRecord = { sn: sn, status: status, message: message, timestamp: Date.now() };
			this.saveLastSn();
		},

		saveLastSn() {
			try { uni.setStorageSync('lastSnRecord', this.lastSnRecord); } catch (e) {}
		},

		loadLastSn() {
			try {
				const ls = uni.getStorageSync('lastSnRecord');
				if (ls && ls.timestamp && (Date.now() - ls.timestamp) < 86400000) {
					this.lastSnRecord = ls;
				} else {
					uni.removeStorageSync('lastSnRecord');
				}
			} catch (e) {}
		},

		setTipMessage(message, type) {
			type = type || 'info';
			this.formData.tip = message;
			this.tipType = type;
			if (this.tipTimeout) clearTimeout(this.tipTimeout);
			if (type !== 'error') {
				this.tipTimeout = setTimeout(() => {
					if (this.formData.tip === message) this.formData.tip = "";
				}, 3000);
			}
		},

		// 点击填入上一条SN
		fillLastSn() {
			if (this.lastSnRecord && this.lastSnRecord.sn) {
				this.formData.proSn = this.lastSnRecord.sn;
				this.setTipMessage("已填入上一条SN", "info");
				this.focusSnInput();
			}
		},

		handleSelectWorkCenter(item) {
			this.formData.workCenterId = item.id;
			this.formData.workCenterName = item.areaName;
			this.formData.xtId = item.xtId;
			this.formData.xtName = item.xtName;
			this.formData.groupId = item.groupId;
			this.formData.groupName = item.groupName;
			this.formData.workStationId = (item.workStationId !== undefined && item.workStationId !== null) ? item.workStationId : item.id;
			this.setTipMessage("已选择工作中心: " + this.formData.workCenterName, "success");
			this.clearMoData();
		},

		handleSelectMo(item) {
			this.formData.moId = item.id;
			this.formData.moNumber = item.moNumber;
			this.formData.modelCode = item.modelCode;
			this.formData.modelName = item.modelName;
			this.formData.modelVer = item.modelVer;
			this.formData.modelSpec = item.modelSpec;
			this.formData.passQty = (item.passQty !== undefined && item.passQty !== null) ? item.passQty : "";
			this.setTipMessage("已选择工单: " + item.moNumber, "success");
			setTimeout(() => {
				this.focusSnInput();
			}, 300);
		},

		clearMoData() {
			this.formData.moId = "";
			this.formData.moNumber = "";
			this.formData.modelCode = "";
			this.formData.modelName = "";
			this.formData.modelVer = "";
			this.formData.modelSpec = "";
			this.formData.passQty = "";
			this.formData.proSn = "";
			this.formData.tip = "";
			this.tipType = "info";
			this.canSubmit = false;
		},

		focusSnInput() {
			this.$nextTick(() => {
				this.snInputFocus = false;
				setTimeout(() => {
					this.snInputFocus = true;
					this.inputReady = true;
				}, 100);
			});
		},

		// 切换自动提交开关
		toggleAutoSubmit() {
			if (this.isSubmitting) {
				this.setTipMessage("正在提交中，请稍后再试", "error");
				return;
			}
			this.autoSubmitEnabled = !this.autoSubmitEnabled;
			if (this.autoSubmitEnabled) {
				this.setTipMessage("已开启自动提交，输入SN后自动报工", "success");
			} else {
				this.setTipMessage("已关闭自动提交", "info");
			}
		},

		handleScanClick() {
			// #ifdef APP-PLUS
			if (this.isScanning) return;
			this.isScanning = true;
			setTimeout(() => {
				uni.scanCode({
					scanType: ['qrCode', 'barCode', 'datamatrix'],
					onlyFromCamera: false,
					sound: 'default',
					success: (res) => {
						const r = (res.result || '').trim();
						if (r) {
							this.formData.proSn = r;
							setTimeout(() => { this.handleScanConfirm(); }, 200);
						} else {
							this.setTipMessage("扫描失败，请重试", "error");
						}
					},
					fail: (err) => {
						if (err.errMsg === 'scanCode:cancel') {
							this.setTipMessage("已取消扫码", "info");
						} else {
							this.setTipMessage("扫码失败", "error");
						}
						this.focusSnInput();
					},
					complete: () => { this.isScanning = false; }
				});
			}, 300);
			// #endif
			// #ifndef APP-PLUS
			this.setTipMessage("Web端请手动输入SN或使用扫码枪", "info");
			this.focusSnInput();
			// #endif
		},

		handleScanConfirm() {
			const sn = (this.formData.proSn || "").trim();
			if (!sn) {
				this.setTipMessage("请输入产品SN", "error");
				this.focusSnInput();
				return;
			}
			if (!this.formData.moNumber) {
				this.setTipMessage("请先选择工单", "error");
				return;
			}
			if (!this.formData.groupId) {
				this.setTipMessage("没有对应工序，请重新选择工作中心", "error");
				return;
			}
			// 开启自动提交才自动调用提交
			if (this.autoSubmitEnabled) {
				this.handleSubmitPass();
			} else {
				this.setTipMessage("SN已填入，请点击「报工保存」", "info");
			}
		},

		handleInputFocus() { this.inputReady = true; },
		handleInputBlur() { this.inputReady = false; },

		async handleSubmitPass() {
			if (this.isSubmitting) return;
			if (!this.formData.proSn || !this.formData.proSn.trim()) {
				this.setTipMessage("请输入产品SN", "error");
				this.focusSnInput();
				return;
			}
			if (!this.formData.moNumber) {
				this.setTipMessage("请先选择工单", "error");
				return;
			}
			if (!this.formData.groupId) {
				this.setTipMessage("没有对应工序，请重新选择工作中心", "error");
				return;
			}

			this.isSubmitting = true;
			this.setTipMessage("正在报工...", "info");
			const sn = this.formData.proSn;

			try {
				const res = await savePassSn({
					proSn: sn,
					groupId: this.formData.groupId,
					groupName: this.formData.groupName,
					moId: this.formData.moId,
					workStationId: this.formData.workStationId
				});
				if (res && res.data && res.data.code === 200) {
					const msg = res.data.message || "报工保存成功";
					this.setTipMessage(msg, "success");
					let newQty;
					if (res.data.result && res.data.result.passQty != null) {
						newQty = String(res.data.result.passQty);
					} else {
						const current = Number(this.formData.passQty) || 0;
						newQty = String(current + 1);
					}
					this.formData.passQty = newQty;
					this.setLastSnRecord(sn, 'success', msg);
				} else {
					const msg2 = (res && res.data && res.data.message) || "报工失败";
					this.setTipMessage(msg2, "error");
					this.setLastSnRecord(sn, 'error', msg2);
				}
			} catch (e) {
				const msg3 = (e && e.data && e.data.message) || (e && e.message) || "网络错误";
				this.setTipMessage(msg3, "error");
				this.setLastSnRecord(sn, 'error', msg3);
			} finally {
				this.isSubmitting = false;
				// 无论成功失败都清空输入框并重新聚焦
				this.formData.proSn = "";
				this.canSubmit = false;
				this.focusSnInput();
			}
		},

		handleResetPage() {
			uni.showModal({
				title: '确认初始化',
				content: '确定要重置页面到初始状态吗？',
				success: (res) => {
					if (res.confirm) this.resetPageState();
				}
			});
		},

		resetPageState() {
			this.formData = {
				workCenterId: "", workCenterName: "",
				moId: "", moNumber: "",
				xtId: "", xtName: "",
				groupId: "", groupName: "",
				workStationId: "",
				modelCode: "", modelName: "", modelVer: "", modelSpec: "",
				passQty: "", proSn: "", tip: ""
			};
			this.tipType = "info";
			this.canSubmit = false;
			this.autoSubmitEnabled = false;
			this.setTipMessage("页面已初始化", "info");
			if (this.$refs.workCenterSelector && typeof this.$refs.workCenterSelector.reset === 'function') {
				this.$refs.workCenterSelector.reset();
			}
			if (this.$refs.moSelector && typeof this.$refs.moSelector.reset === 'function') {
				this.$refs.moSelector.reset();
			}
		}
	}
}
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$bg: #f0f2f5;
$card: #fff;
$text: #1a1a2e;
$sub: #6b7280;
$hint: #9ca3af;
$line: #e5e7eb;

.page {
	@include p-page;
	background: $bg;
	padding: 20rpx 24rpx 140rpx;
}

.card {
	@include p-card;
	padding: 28rpx;
	margin-bottom: 16rpx;
}

.info-grid {
	margin-top: 28rpx;
	padding-top: 28rpx;
	border-top: 2rpx solid $line;
	transition: border .25s;
}

.info-row {
	display: flex;
	margin-bottom: 10rpx;
	gap: 12rpx;
}

.info-item {
	flex: 1;
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 14rpx 18rpx;
	background: #f7f8fa;
	border-radius: 10rpx;
	transition: background .25s, border .25s;
}

.info-label {
	font-size: 24rpx;
	color: $sub;
	flex-shrink: 0;
}

.info-value {
	font-size: 24rpx;
	color: $text;
	font-weight: 500;
	text-align: right;
	flex: 1;
	margin-left: 16rpx;
	word-break: break-all;

	&.highlight {
		color: #1677ff;
		font-weight: 700;
		font-size: 28rpx;
	}
}

/* 扫描输入区域 */
.scan-input-wrapper {
	position: relative;
	margin-bottom: 24rpx;
}

.scan-input {
	padding: 26rpx 100rpx 26rpx 24rpx;
	background: #f7f8fa;
	border-radius: 10rpx;
	font-size: 30rpx;
	border: 2rpx solid $line;
	font-family: 'Courier New', Courier, monospace, sans-serif;
	color: #1a1a2e;
	caret-color: #1677ff;
	-webkit-text-fill-color: #1a1a2e;
	transition: border .2s, background .2s;

	&:focus {
		border-color: #1677ff;
		background: $card;
	}
}

.scan-btn {
	position: absolute;
	right: 16rpx;
	top: 50%;
	transform: translateY(-50%);
	padding: 12rpx;
	background: rgba(22,119,255,.1);
	border-radius: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;

	&:active {
		opacity: .7;
	}
}

/* 自动提交勾选项 */
.auto-submit-wrapper {
	margin-top: 20rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid $line;
}

.auto-submit-label {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	cursor: pointer;
}

.checkbox {
	width: 36rpx;
	height: 36rpx;
	border: 2rpx solid #d9d9d9;
	border-radius: 6rpx;
	margin-right: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.3s ease;
	background-color: #fff;

	&.checked {
		background-color: #1677ff;
		border-color: #1677ff;
	}

	.checkbox-icon {
		color: #fff;
		font-size: 24rpx;
		font-weight: bold;
	}
}

.auto-submit-text {
	font-size: 26rpx;
	color: #666;
}

.last-sn {
	display: flex;
	align-items: center;
	padding: 16rpx 20rpx;
	background: #f7f8fa;
	border-radius: 8rpx;
	margin-bottom: 16rpx;
}

.last-sn-content {
	display: flex;
	align-items: center;
	flex: 1;
}

.last-label {
	font-size: 22rpx;
	color: $hint;
}

.last-value {
	font-size: 26rpx;
	color: $text;
	font-weight: 600;
	font-family: 'Courier New', Courier, monospace, sans-serif;
	margin-left: 8rpx;
	flex: 1;
}

.last-sn-fill-btn {
	margin-left: 20rpx;
	padding: 8rpx 20rpx;
	background: rgba(22, 119, 255, 0.1);
	color: #1677ff;
	border-radius: 6rpx;
	font-size: 22rpx;
	font-weight: 500;

	&:active {
		opacity: 0.7;
	}
}

.tip-box {
	padding: 24rpx;
	border-radius: 10rpx;
	font-size: 26rpx;
	text-align: center;
	font-weight: 500;
	transition: all .3s;
	background: #f7f8fa;
	color: $hint;

	&.success {
		background: rgba(82,196,26,.1);
		color: #52c41a;
	}

	&.error {
		background: rgba(255,77,79,.1);
		color: #ff4d4f;
	}

	&.info {
		background: rgba(22,119,255,.1);
		color: #1677ff;
	}
}

.bottom-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	background: $card;
	padding: 20rpx 24rpx;
	padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	box-shadow: 0 -2rpx 12rpx rgba(0,0,0,.05);
	transition: background .25s;
}

.bottom-btns {
	display: flex;
	gap: 20rpx;
}

.btn-reset,
.btn-submit {
	flex: 1;
	border-radius: 10rpx;
	font-size: 30rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	transition: all .2s;
}

.btn-reset {
	background: #f4f5f7;
	color: $sub;

	&:active {
		background: $line;
	}
}

.btn-submit {
	background: #1677ff;
	color: #fff;

	&:active:not(.disabled) {
		opacity: .85;
	}

	&.disabled {
		background: #d0d0d0;
		color: #fff;
	}
}

.init-tip {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 50vh;
	color: $hint;
	font-size: 28rpx;
}

/* 尺寸样式 */
.size-small {
	&.page { padding: 14rpx 16rpx 120rpx; }
	.card { padding: 20rpx; margin-bottom: 12rpx; }
	.info-item { padding: 10rpx 14rpx; }
	.info-label, .info-value { font-size: 20rpx; }
	.info-value.highlight { font-size: 24rpx; }
	.scan-input { padding: 20rpx 90rpx 20rpx 20rpx; font-size: 26rpx; }
	.tip-box { padding: 18rpx; font-size: 22rpx; }
	.btn-reset, .btn-submit { height: 72rpx; font-size: 26rpx; }
	.bottom-bar { padding: 16rpx 20rpx; }
}

.size-large {
	&.page { padding: 28rpx 32rpx 160rpx; }
	.card { padding: 36rpx; margin-bottom: 22rpx; }
	.info-item { padding: 18rpx 22rpx; }
	.info-label, .info-value { font-size: 28rpx; }
	.info-value.highlight { font-size: 32rpx; }
	.scan-input { padding: 32rpx 120rpx 32rpx 32rpx; font-size: 36rpx; }
	.tip-box { padding: 32rpx; font-size: 30rpx; }
	.btn-reset, .btn-submit { height: 104rpx; font-size: 34rpx; }
	.bottom-bar { padding: 28rpx 32rpx; }
}

/* 暗色主题 */
.theme-dark {
	&.page { background: #0f0f1a; }
	.card { background: #1a1a2e; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.info-grid { border-top-color: #2a2a45; }
	.info-item { background: #1e1e36; }
	.info-value { color: #e0e0e0; }
	.scan-input {
		background: #1e1e36;
		border-color: #2a2a45;
		color: #e0e0e0;
		-webkit-text-fill-color: #e0e0e0;
		&:focus { background: #1e1e36; border-color: #1677ff; }
	}
	.last-sn { background: #1e1e36; }
	.last-value { color: #e0e0e0; }
	.last-sn-fill-btn {
		background: rgba(22, 119, 255, 0.2);
		color: #4096ff;
	}
	.tip-box { background: #1e1e36; }
	.bottom-bar { background: #1a1a2e; }
	.btn-reset { background: #1e1e36; color: #888; }
	.init-tip { color: #666; }
}
</style>