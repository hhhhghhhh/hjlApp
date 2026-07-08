<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- 顶部固定区域 -->
		<view class="top-bar">
			<view class="form-container">
				<!-- 指令选择 -->
				<search-selector v-model="formData.cmdOpt" :options="filteredCmdOptions" placeholder="选择指令"
					popup-title="选择指令" search-placeholder="搜索指令..." :config="{
						valueKey: 'value',
						textKey: 'displayText',
						descKey: 'commandDesc'
					}" :clearable="false" :disabled="true" @change="onCmdChange" @clear="onCmdClear" />

				<!-- 扫描输入 -->
				<view class="scan-input-wrapper" v-if="formData.cmdOpt">
					<input ref="scanInput" v-model="formData.inventoryCode" :placeholder="getPlaceholderData()"
						:focus="inventoryCodeFocus" confirm-type="完成" @confirm="onInputConfirm" class="scan-input" />
					<view class="scan-btn" @click="handleScan">
						<uni-icons type="scan" :size="iconSize" :color="themePrimary"></uni-icons>
					</view>
				</view>

				<!-- 自动提交勾选项 -->
				<view class="auto-submit-wrapper" v-if="formData.cmdOpt && cmdList.length > 0">
					<label class="auto-submit-label" @click="toggleAutoSubmit">
						<view class="checkbox" :class="{ checked: autoSubmitEnabled }"
							:style="{ borderColor: autoSubmitEnabled ? themePrimary : '#d9d9d9', backgroundColor: autoSubmitEnabled ? themePrimary : '#fff' }">
							<text v-if="autoSubmitEnabled" class="checkbox-icon">✓</text>
						</view>
						<text class="auto-submit-text">自动提交（必填参数完成后自动提交）</text>
					</label>
				</view>
			</view>

			<!-- 消息提示 -->
			<view class="message-box" :class="[messageInfo.type, messageInfo.show ? 'show' : '']">
				<text>{{ messageInfo.content }}</text>
			</view>
		</view>

		<!-- 中间内容区域 - 参数列表 -->
		<view class="content">
			<view class="params-container" v-if="cmdList.length > 0">
				<scroll-view class="params-scroll" scroll-y :show-scrollbar="false">
					<view class="params-list">
						<view v-for="(item, index) in cmdList" :key="index" class="param-item"
							:class="{filled: item.value, current: isCurrentParam(item), fixed: item.fixed, clickable: canClickParam(item)}"
							@click="onParamClick(item)">
							<view class="param-content">
								<view class="param-left">
									<view v-if="!isSystemParam(item)" class="fixed-btn"
										@click.stop="toggleFixedParam(item)">
										<uni-icons :type="item.fixed ? 'star-filled' : 'star'" :size="starSize"
											:color="item.fixed ? '#ffa940' : '#9c9c9c'">
										</uni-icons>
									</view>
									<view class="param-info">
										<text class="param-name">
											<text v-if="item.isRequire === 'Y'" class="required-star">*</text>
											{{ item.displayName }}
										</text>
									</view>
								</view>
								<view class="param-value-wrapper">
									<text class="param-value" :class="{empty: !item.value}">
										{{ item.value || '待输入' }}
									</text>
									<view v-if="item.value" class="cancel-btn" @click.stop="cancelParam(item)">
										<uni-icons type="clear" :size="clearIconSize" color="#9c9c9c"></uni-icons>
									</view>
								</view>
							</view>
						</view>
					</view>
				</scroll-view>
			</view>

			<!-- 空状态提示 -->
			<view class="empty-tip" v-else-if="formData.cmdOpt && cmdList.length === 0">
				<text>正在加载参数...</text>
			</view>
		</view>

		<!-- 底部固定按钮区域 -->
		<view class="bottom-bar">
			<view class="action-buttons">
				<!-- 提交按钮（非自动提交模式） -->
				<view class="btn-submit" v-if="showSubmitButton && !autoSubmitEnabled" 
					:style="{ background: themePrimary }"
					:class="{ disabled: isSubmitting || !canSubmit }" @click="submitData">
					<text v-if="!isSubmitting">提交指令</text>
					<text v-else>提交中...</text>
				</view>
				<!-- 自动提交状态提示 -->
				<view class="btn-submit auto-submit-btn" v-if="showSubmitButton && autoSubmitEnabled && !isSubmitting"
					:style="{ background: '#52c41a' }">
					<text>自动提交已启用</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import SearchSelector from '@/components/SearchSelector.vue'
	import {
		validStorageBind
	} from "@/api/wmsApi.js";
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		components: {
			SearchSelector
		},
		mixins: [settingsMixin],
		data() {
			return {
				cmdData: {},
				cmdList: [],
				allCmdOptions: [],
				filteredCmdOptions: [],
				cmdCategroyOption: [{
						text: "通用",
						value: "通用",
					},
					{
						text: "入库",
						value: "入库",
					},
					{
						text: "出库",
						value: "出库",
					},
					{
						text: "库存作业",
						value: "库存作业",
					},
					{
						text: "调拨",
						value: "调拨",
					},
					{
						text: "生产",
						value: "生产",
					},
					{
						text: "品质",
						value: "品质",
					},
					{
						text: "MSD",
						value: "MSD",
					},
				],
				inventoryCodeFocus: true,
				formData: {
					cmdOpt: "",
					cmdCategroy: "",
					inventoryCode: "",
				},
				selectedCmdName: "",
				isScanning: false,
				isSubmitting: false,
				showSubmitButton: false,
				messageInfo: {
					show: false,
					content: "",
					type: "info"
				},
				messageTimer: null,
				commandCode: "",
				snFromUrl: "",
				processingScan: false,
				targetParamIndex: -1,
				inputReady: false,
				initLoading: false,
				forceNextParam: null,
				materialData: null,
				iconSize: 22,
				starSize: 14,
				clearIconSize: 10,
				autoSubmitEnabled: false,
				autoSubmitTriggered: false
			}
		},
		computed: {
			canSubmit() {
				if (this.cmdList.length === 0) return false;
				const requiredFields = this.cmdList.filter(item => item.isRequire === 'Y');
				const allRequiredFilled = requiredFields.every(item => {
					return item.value && item.value.trim() !== '';
				});
				return allRequiredFilled;
			},
			canClickParam() {
				return (item) => {
					if (item.value || this.isSystemParam(item)) {
						return false;
					}
					return true;
				}
			}
		},
		watch: {
			'appSettings.displaySize': {
				handler(newVal) {
					this.updateIconSizes(newVal);
				},
				immediate: true
			},
			'formData.cmdCategroy': {
				handler(newVal) {
					this.updateCmdOptionsByCategory();
				},
				immediate: true
			},
			cmdList: {
				deep: true,
				handler() {
					this.checkAllParamsFilled();
					this.checkAndAutoSubmit();
				}
			},
			'formData.cmdOpt': {
				handler(newVal) {
					if (newVal) {
						this.$nextTick(() => {
							setTimeout(() => {
								this.inputReady = true;
								this.focusScanInput();
							}, 400);
						});
						this.autoSubmitEnabled = false;
						this.autoSubmitTriggered = false;
					} else {
						this.inputReady = false;
					}
				}
			}
		},
		onLoad(options) {
			console.log('页面加载，参数:', options);

			if (options.commandCode) {
				this.commandCode = options.commandCode;
			}
			if (options.sn) {
				this.snFromUrl = decodeURIComponent(options.sn);
			}
			if (options.materialData) {
				try {
					this.materialData = JSON.parse(decodeURIComponent(options.materialData));
				} catch (e) {
					console.error('解析物料数据失败:', e);
				}
			}
			this.initDict();
		},
		methods: {
			updateIconSizes(size) {
				const sizeMap = { small: 18, medium: 22, large: 26 };
				this.iconSize = sizeMap[size] || 22;
				this.starSize = (sizeMap[size] || 22) - 8;
				this.clearIconSize = (sizeMap[size] || 22) - 12;
			},

			async initDict() {
				this.initLoading = true;
				try {
					await this.getAllCommands();
				} catch (error) {
					console.error('初始化失败:', error);
				} finally {
					this.initLoading = false;
				}
			},

			getAllCommands() {
				return new Promise((resolve, reject) => {
					this.$request({
							url: "/wms/cmd/getListByCmdCategroy",
							method: "GET",
							data: {},
						})
						.then((response) => {
							this.allCmdOptions = response.data.result.map(item => {
								return {
									...item,
									text: item.cmdName,
									displayText: item.cmdName,
									value: item.id,
									commandDesc: item.commandDesc
								};
							});
							this.updateCmdOptionsByCategory();
							if (this.commandCode) {
								const foundCommand = this.allCmdOptions.find(item => item.cmdCode === this
									.commandCode);
								if (foundCommand) {
									this.formData.cmdOpt = foundCommand.value;
									this.cmdOptChange().then(() => {
										this.autoFillSnFromUrl();
									});
									this.showMessage(`已自动选择: ${foundCommand.cmdName}`, 'success');
								} else {
									this.showMessage(`未找到指令: ${this.commandCode}`, 'error');
								}
							}
							resolve();
						})
						.catch((err) => {
							console.log("获取指令列表失败:", err);
							this.showMessage('获取指令列表失败', 'error');
							reject(err);
						});
				});
			},

			autoFillSnFromUrl() {
				if (this.snFromUrl && this.cmdList.length > 0) {
					const snParam = this.cmdList.find(item =>
						item.paramName.toLowerCase() === 'sn' ||
						item.displayName.toLowerCase().includes('sn')
					);
					if (snParam && !snParam.value) {
						snParam.value = this.snFromUrl.trim();
						this.showMessage(`已自动填入SN: ${this.snFromUrl}`, 'success');
					}
				}
			},

			updateCmdOptionsByCategory() {
				if (this.formData.cmdCategroy) {
					this.filteredCmdOptions = this.allCmdOptions.filter(cmd =>
						cmd.cmdCategroy === this.formData.cmdCategroy
					);
				} else {
					this.filteredCmdOptions = this.allCmdOptions;
				}
			},

			onCategoryChange(value, item) {
				this.formData.cmdOpt = "";
				this.selectedCmdName = "";
				this.cmdList = [];
				this.showSubmitButton = false;
				this.targetParamIndex = -1;
				this.forceNextParam = null;
			},

			onCategoryClear() {
				this.formData.cmdOpt = "";
				this.selectedCmdName = "";
				this.cmdList = [];
				this.showSubmitButton = false;
				this.targetParamIndex = -1;
				this.forceNextParam = null;
				this.showMessage('已清空分类选择', 'info');
			},

			onCmdChange(value, item) {
				if (item) {
					this.selectedCmdName = item.text;
					this.cmdOptChange();
				}
			},

			onCmdClear() {
				this.selectedCmdName = "";
				this.cmdList = [];
				this.showSubmitButton = false;
				this.targetParamIndex = -1;
				this.forceNextParam = null;
				this.autoSubmitEnabled = false;
				this.autoSubmitTriggered = false;
				this.showMessage('已清空指令选择', 'info');
			},

			showMessage(content, type = "info") {
				if (this.messageTimer) {
					clearTimeout(this.messageTimer);
				}
				this.messageInfo = {
					show: true,
					content: content,
					type: type
				};
			},

			cmdOptChange() {
				return new Promise((resolve, reject) => {
					if (!this.formData.cmdOpt) {
						this.cmdList = [];
						resolve();
						return;
					}
					this.$request({
							url: "/wms/cmdParam/getListByCmdId",
							method: "GET",
							data: {
								cmdId: this.formData.cmdOpt
							},
						})
						.then((response) => {
							this.cmdList = response.data.result.map((item) => {
								return {
									...item,
									value: "",
									fixed: false
								};
							});
							this.cmdData = this.allCmdOptions.find(item => item.value === this.formData
								.cmdOpt);
							this.formData.inventoryCode = '';
							this.showSubmitButton = false;
							this.targetParamIndex = -1;
							this.forceNextParam = null;
							this.autoSubmitEnabled = false;
							this.autoSubmitTriggered = false;
							this.inputReady = true;
							setTimeout(() => {
								this.focusScanInput();
							}, 300);
							if (this.cmdData) {
								this.showMessage(`已选择: ${this.cmdData.cmdName}`, 'success');
							}
							resolve();
						})
						.catch((err) => {
							console.log("获取指令参数失败:", err);
							this.showMessage('获取指令参数失败', 'error');
							reject(err);
						});
				});
			},

			checkAllParamsFilled() {
				if (this.cmdList.length === 0) {
					this.showSubmitButton = false;
					return;
				}
				const requiredFields = this.cmdList.filter(item => item.isRequire === 'Y');
				const allRequiredFilled = requiredFields.every(item => item.value && item.value.trim() !== '');
				const allFields = this.cmdList;
				const allFilled = allFields.every(item => item.value && item.value.trim() !== '');
				this.showSubmitButton = allRequiredFilled;
				if (allFilled && !this.autoSubmitTriggered) {
					this.showMessage('所有参数已填写完成', 'success');
				} else if (allRequiredFilled && !this.autoSubmitTriggered) {
					this.showMessage('必填参数已填写完成', 'info');
				}
			},

			checkAndAutoSubmit() {
				if (!this.autoSubmitEnabled || this.autoSubmitTriggered) return;
				if (this.isSubmitting) return;
				if (this.canSubmit) {
					this.autoSubmitTriggered = true;
					this.showMessage('必填参数已填写完成，自动提交中...', 'info');
					setTimeout(() => {
						this.submitData();
					}, 200);
				}
			},

			toggleAutoSubmit() {
				if (this.isSubmitting) {
					this.showMessage('正在提交中，请稍后再试', 'error');
					return;
				}
				this.autoSubmitEnabled = !this.autoSubmitEnabled;
				this.autoSubmitTriggered = false;
				if (this.autoSubmitEnabled) {
					this.showMessage('已开启自动提交，必填参数填写完成后将自动提交', 'success');
					this.$nextTick(() => {
						this.checkAndAutoSubmit();
					});
				} else {
					this.showMessage('已关闭自动提交', 'info');
				}
			},

			isCurrentParam(item) {
				if (item.value && item.value.trim() !== "") return false;
				if (this.forceNextParam) {
					return this.forceNextParam === item.paramName;
				}
				if (this.targetParamIndex !== -1) {
					return this.cmdList[this.targetParamIndex] === item;
				}
				const firstEmpty = this.cmdList.find(param => !param.value || param.value.trim() === "");
				return firstEmpty && firstEmpty.paramName === item.paramName;
			},

			onParamClick(item) {
				if (!this.canClickParam(item)) return;
				this.forceNextParam = item.paramName;
				this.showMessage(`下一个将输入: ${item.displayName}`, 'info');
				this.focusScanInput();
			},

			isSystemParam(item) {
				const systemParams = ['systemTime', 'createTime', 'updateTime'];
				return systemParams.includes(item.paramName);
			},

			toggleFixedParam(item) {
				if (this.isSystemParam(item)) return;
				item.fixed = !item.fixed;
				const action = item.fixed ? '已固定' : '已取消固定';
				this.showMessage(`${item.displayName} ${action}`, 'success');
			},

			cancelParam(item) {
				item.value = "";
				this.autoSubmitTriggered = false;
				this.showMessage(`已取消 ${item.displayName}`, 'info');
				const index = this.cmdList.findIndex(param => param.paramName === item.paramName);
				if (index === this.targetParamIndex) this.targetParamIndex = -1;
				if (this.forceNextParam === item.paramName) this.forceNextParam = null;
				this.focusScanInput();
			},

			handleScan() {
				if (this.isScanning || !this.formData.cmdOpt) return;
				this.isScanning = true;
				uni.scanCode({
					onlyFromCamera: false,
					scanType: ['qrCode', 'barCode', 'ean13', 'ean8'],
					success: (res) => {
						const scannedValue = res.result.trim();
						this.formData.inventoryCode = scannedValue;
						this.onScanSuccess(scannedValue);
					},
					fail: (err) => {
						if (err.errMsg !== 'scanCode:fail cancel') {
							this.showMessage('扫码失败', 'error');
						}
					},
					complete: () => {
						this.isScanning = false;
					}
				});
			},

			async onScanSuccess(scanResult) {
				if (!this.formData.cmdOpt) {
					this.showMessage('请先选择指令', 'error');
					return;
				}
				if (this.processingScan) return;
				this.processingScan = true;
				try {
					scanResult = scanResult.trim();
					let targetItem = null;
					if (this.forceNextParam) {
						targetItem = this.cmdList.find(item => item.paramName === this.forceNextParam);
						this.forceNextParam = null;
					} else if (this.targetParamIndex !== -1) {
						targetItem = this.cmdList[this.targetParamIndex];
						this.targetParamIndex = -1;
					} else {
						targetItem = this.cmdList.find(item => !item.value || item.value.trim() === "");
					}
					if (!targetItem) {
						this.showMessage('所有参数已填写完成', 'info');
						return;
					}
					if (targetItem.paramName === 'glSn') {
						const isValid = await this.validateGlSn(scanResult);
						if (!isValid) {
							this.clearInput();
							this.focusScanInput();
							return;
						}
					}
					if (!this.checkAndConvertType(scanResult, targetItem.paramType)) {
						this.clearInput();
						this.focusScanInput();
						return;
					}
					targetItem.value = scanResult;
					this.showMessage(`${targetItem.displayName} 输入成功`, 'success');
					this.clearInput();
					this.focusScanInput();
				} finally {
					this.processingScan = false;
				}
			},

			async validateGlSn(sn) {
				try {
					uni.showLoading({
						title: '验证中...',
						mask: true
					});
					const response = await validStorageBind({
						glSn: sn
					});
					uni.hideLoading();
					if (response.data && response.data.code === 200) {
						this.showMessage('库位关联验证通过', 'success');
						return true;
					} else {
						const errorMsg = response.data?.message || response.data?.msg || '库位关联验证失败';
						this.showMessage(errorMsg, 'error');
						return false;
					}
				} catch (error) {
					uni.hideLoading();
					let errorMsg = '库位关联验证失败';
					if (error.response && error.response.data) {
						errorMsg = error.response.data.message || error.response.data.msg || errorMsg;
					} else if (error.message) {
						errorMsg = error.message;
					}
					if (errorMsg.includes('该物料SN不在库存中')) {
						errorMsg = '该物料SN不在库存中，请检查后重新输入';
					}
					this.showMessage(errorMsg, 'error');
					return false;
				}
			},

			checkAndConvertType(value, paramType) {
				if (!value) return false;
				const trimmedValue = value.trim();
				switch (paramType) {
					case "String":
						return true;
					case "Integer":
						if (/^-?\d+$/.test(trimmedValue)) return true;
						this.showMessage(`值 "${value}" 不符合 Integer 类型`, 'error');
						return false;
					case "BigDecimal":
						if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) return true;
						this.showMessage(`值 "${value}" 不符合 BigDecimal 类型`, 'error');
						return false;
					case "Date":
						return this.convertToSpecificDateFormat(trimmedValue);
					default:
						this.showMessage(`不支持的参数类型: ${paramType}`, 'error');
						return false;
				}
			},

			convertToSpecificDateFormat(input) {
				const regex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
				const match = input.match(regex);
				if (!match) {
					this.showMessage(`值 "${input}" 格式应为：YYYY-MM-DD HH:mm:ss`, 'error');
					return false;
				}
				const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
				return month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate() &&
					hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
			},

			submitData() {
				if (this.isSubmitting) return;
				if (!this.canSubmit) {
					this.showMessage('请先填写所有必填字段', 'error');
					return;
				}
				this.isSubmitting = true;
				this.showMessage('正在执行指令...', 'info');
				const params = {};
				this.cmdList.forEach(item => {
					params[item.paramName] = item.value ? item.value.trim() : '';
				});
				this.$request({
						url: this.cmdData.cmdDesc,
						method: "GET",
						data: {
							...params
						},
					})
					.then((r) => {
						const message = r.data?.message || r.data?.msg ||
							(r.data?.result && typeof r.data.result === 'string' ? r.data.result : '指令执行成功');
						if (r.data.code == '500') {
							this.showMessage(message, 'error');
							this.autoSubmitTriggered = false;
						} else {
							this.showMessage(message, 'success');
							this.cmdList = this.cmdList.map(item => {
								if (item.fixed) return item;
								return {
									...item,
									value: ""
								};
							});
							this.showSubmitButton = false;
							this.targetParamIndex = -1;
							this.forceNextParam = null;
							this.autoSubmitTriggered = false;
							if (this.autoSubmitEnabled) {
								setTimeout(() => {
									this.checkAndAutoSubmit();
								}, 300);
							}
							setTimeout(() => {
								this.focusScanInput();
							}, 500);
						}
					})
					.catch((err) => {
						console.log("接口错误详情:", err);
						this.showMessage('指令执行失败', 'error');
						this.autoSubmitTriggered = false;
					})
					.finally(() => {
						this.isSubmitting = false;
					});
			},

			onInputConfirm() {
				if (!this.inputReady) {
					setTimeout(() => {
						this.onInputConfirm();
					}, 300);
					return;
				}
				const inputValue = this.formData.inventoryCode?.trim();
				if (inputValue) {
					this.onScanSuccess(inputValue);
				} else {
					this.showMessage('请输入有效内容', 'error');
					this.focusScanInput();
				}
			},

			getPlaceholderData() {
				let targetItem = null;
				if (this.forceNextParam) {
					targetItem = this.cmdList.find(item => item.paramName === this.forceNextParam);
				} else if (this.targetParamIndex !== -1) {
					targetItem = this.cmdList[this.targetParamIndex];
				} else {
					targetItem = this.cmdList.find(item => !item.value || item.value.trim() === "");
				}
				return targetItem ? `扫描${targetItem.displayName}` : "所有参数已完成";
			},

			focusScanInput() {
				this.$nextTick(() => {
					this.inventoryCodeFocus = false;
					setTimeout(() => {
						this.inventoryCodeFocus = true;
						this.inputReady = true;
					}, 100);
				});
			},

			clearInput() {
				this.formData.inventoryCode = '';
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import '@/common/page-theme-mixins.scss';

	.page {
		@include p-page;
		display: flex;
		flex-direction: column;
	}

	/* 顶部固定区域 */
	.top-bar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: #fff;
		padding: 20rpx 24rpx;
		padding-top: calc(20rpx + env(safe-area-inset-top));
		box-shadow: 0 1rpx 8rpx rgba(0, 0, 0, .03);
		transition: background .25s;
	}

	.form-container {
		background: #fff;
		border-radius: 12rpx;
		margin-bottom: 12rpx;
	}

	.scan-input-wrapper {
		position: relative;
		margin-top: 12rpx;
	}

	.scan-input {
		flex: 1;
		padding: 24rpx 80rpx 24rpx 24rpx;
		background: #f4f5f7;
		border-radius: 12rpx;
		font-size: 28rpx;
		transition: all .25s;

		&[disabled] {
			background: #e8e8e8;
			color: #999;
		}
	}

	.scan-btn {
		position: absolute;
		right: 16rpx;
		top: 50%;
		transform: translateY(-50%);
		padding: 12rpx;
		border-radius: 8rpx;
		background: rgba(22, 119, 255, .1);
	}

	.auto-submit-wrapper {
		margin-top: 20rpx;
		padding-top: 16rpx;
		border-top: 1rpx solid #f0f0f0;
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

	/* 消息提示 */
	.message-box {
		padding: 16rpx 20rpx;
		border-radius: 8rpx;
		font-size: 24rpx;
		text-align: center;
		opacity: 0;
		transform: translateY(-8rpx);
		transition: opacity .25s ease, transform .2s ease;

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
	}

	/* 中间内容区域 */
	.content {
		flex: 1;
		overflow: hidden;
		padding: 0 24rpx;
	}

	.params-container {
		background: #fff;
		border-radius: 16rpx;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.params-scroll {
		flex: 1;
		min-height: 0;
	}

	.params-list {
		padding: 8rpx 0;
	}

	.param-item {
		padding: 20rpx 24rpx;
		border-bottom: 1r solid #f0f0f0;

		&:last-child {
			border-bottom: none;
		}

		&.current {
			border-left: 6rpx solid #1677ff;
			background: rgba(22, 119, 255, .05);
			transition: background 0.2s ease, border-color 0.2s ease;
		}

		&.filled {
			background: rgba(82, 196, 26, .03);
		}
	}

	.param-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.param-left {
		display: flex;
		align-items: center;
		flex: 1;
		gap: 8rpx;
	}

	.fixed-btn {
		padding: 6rpx;
		border-radius: 6rpx;
	}

	.param-info {
		flex: 1;
	}

	.param-name {
		font-size: 28rpx;
		font-weight: 500;
		color: #333;

		.required-star {
			color: #ff4d4f;
			margin-right: 6rpx;
		}
	}

	.param-value-wrapper {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.param-value {
		font-size: 26rpx;
		color: #666;
		max-width: 280rpx;
		text-align: right;

		&.empty {
			color: #bbb;
		}
	}

	.cancel-btn {
		padding: 6rpx;
		border-radius: 6rpx;
		background: rgba(0, 0, 0, .05);
	}

	.empty-tip {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #999;
		font-size: 28rpx;
	}

	/* 底部固定按钮区域 */
	.bottom-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #fff;
		padding: 20rpx 24rpx;
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
		box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, .04);
		transition: background .25s;
	}

	.action-buttons {
		display: flex;
		gap: 12rpx;
	}

	.btn-submit {
		flex: 1;
		background: #1677ff;
		color: #fff;
		text-align: center;
		padding: 24rpx 0;
		border-radius: 12rpx;
		font-size: 28rpx;
		font-weight: 500;
		transition: all .2s;

		&:active {
			transform: scale(.97);
			opacity: .8;
		}

		&.disabled {
			opacity: .5;
			transform: none;
		}
	}

	.auto-submit-btn {
		background-color: #52c41a;

		&:disabled {
			background-color: #95de64;
		}
	}

	/* ===== 小号样式 ===== */
	.size-small {
		.top-bar {
			padding: 14rpx 16rpx;
		}

		.scan-input {
			padding: 16rpx 70rpx 16rpx 16rpx;
			font-size: 24rpx;
		}

		.message-box {
			padding: 10rpx 16rpx;
			font-size: 20rpx;
		}

		.content {
			padding: 0 16rpx;
		}

		.param-item {
			padding: 14rpx 18rpx;
		}

		.param-name {
			font-size: 24rpx;
		}

		.param-value {
			font-size: 22rpx;
			max-width: 220rpx;
		}

		.checkbox {
			width: 30rpx;
			height: 30rpx;

			.checkbox-icon {
				font-size: 20rpx;
			}
		}

		.auto-submit-text {
			font-size: 22rpx;
		}

		.btn-submit {
			padding: 16rpx 0;
			font-size: 24rpx;
		}
	}

	/* ===== 大号样式 ===== */
	.size-large {
		.top-bar {
			padding: 28rpx 32rpx;
		}

		.scan-input {
			padding: 32rpx 100rpx 32rpx 32rpx;
			font-size: 32rpx;
		}

		.message-box {
			padding: 22rpx 28rpx;
			font-size: 28rpx;
		}

		.content {
			padding: 0 32rpx;
		}

		.param-item {
			padding: 28rpx 32rpx;
		}

		.param-name {
			font-size: 32rpx;
		}

		.param-value {
			font-size: 30rpx;
			max-width: 360rpx;
		}

		.checkbox {
			width: 42rpx;
			height: 42rpx;

			.checkbox-icon {
				font-size: 28rpx;
			}
		}

		.auto-submit-text {
			font-size: 30rpx;
		}

		.btn-submit {
			padding: 28rpx 0;
			font-size: 32rpx;
		}
	}

	/* ===== 深色模式 ===== */
	.theme-dark {
		&.page {
			background: #0f0f1a;
		}

		.top-bar,
		.form-container,
		.params-container,
		.bottom-bar {
			background: #1a1a2e;
		}

		.scan-input {
			background: #1e1e36;
			color: #e0e0e0;

			&[disabled] {
				background: #252545;
				color: #666;
			}
		}

		.auto-submit-wrapper {
			border-top-color: #2a2a45;
		}

		.auto-submit-text {
			color: #888;
		}

		.param-item {
			border-bottom-color: #2a2a45;
		}

		.param-name {
			color: #e0e0e0;
		}

		.param-value {
			color: #aaa;

			&.empty {
				color: #555;
			}
		}

		.empty-tip {
			color: #666;
		}
	}
</style>