<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- 顶部固定区域 - 选择指令后显示 -->
		<view class="top-bar" v-if="formData.cmdOpt && currentCmdInfo">
			<view class="form-container">
				<!-- 第一行：指令选择和条码类型 -->
				<view class="first-row">
					<view class="cmd-selector">
						<search-selector v-model="formData.cmdOpt" :options="cmdOptOption" placeholder="选择指令"
							popup-title="选择指令" search-placeholder="搜索指令..." :config="{
								valueKey: 'value',
								textKey: 'text',
								descKey: 'commandDesc'
							}" :clearable="false" @change="onCmdChange" @clear="onCmdClear" />
					</view>

					<!-- <view class="code-type-compact" v-if="isInboundCommand">
						<view class="code-type-btn" :class="{ active: codeType === 'normal' }"
							@click="switchCodeType('normal')">
							<text>普通条码</text>
						</view>
						<view class="code-type-btn" :class="{ active: codeType === 'container' }"
							@click="switchCodeType('container')">
							<text>载具条码</text>
						</view>
					</view> -->
				</view>

				<!-- 第三行：明细选择框（载具条码模式） -->
				<view class="third-row" v-if="codeType === 'container' && isInboundCommand">
					<view class="detail-selector-wrapper">
						<search-selector v-model="selectedDetailId" :options="detailOptions" placeholder="选择分录"
							popup-title="选择明细" search-placeholder="搜索明细..." :config="{
								valueKey: 'id',
								textKey: 'displayText',
								descKey: 'detailInfo'
							}" :clearable="true" @change="onDetailChange" @clear="onDetailClear"
							:disabled="isLoadingDetail || loadDetailError || detailList.length === 0" />

						<view class="detail-status" v-if="codeType === 'container'">
							<view v-if="isLoadingDetail" class="loading-status">
								<uni-load-more status="loading" content="加载中..." :showIcon="true"
									:iconSize="16"></uni-load-more>
							</view>
							<view v-else-if="loadDetailError" class="error-status">
								<text class="error-text">加载失败</text>
								<button class="retry-btn" @click="loadDocDetail">重试</button>
							</view>
							<view v-else-if="detailList.length === 0" class="empty-status">
								<text class="empty-text">暂无明细</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 第四行：扫描输入 -->
				<view class="fourth-row" v-if="codeType === 'normal' || (codeType === 'container' && selectedDetailId)">
					<view class="scan-input-wrapper">
						<input v-if="isAPP()" ref="scanInput" v-model="formData.inventoryCode"
							:placeholder="getPlaceholderData()" :focus="inventoryCodeFocus" confirm-type="完成"
							@confirm="onInputConfirm" class="scan-input" @focus="onInputFocus" @blur="onInputBlur"
							:disabled="!canInput" :type="getInputType()" />
						<input v-else ref="scanInput" v-model="formData.inventoryCode"
							:placeholder="getPlaceholderData()" :focus="inventoryCodeFocus" confirm-type="完成"
							@confirm="onInputConfirm" class="scan-input" @focus="onInputFocus" @blur="onInputBlur"
							:disabled="!canInput" />
						<view class="scan-btn" @click="handleScan" v-if="canInput">
							<uni-icons type="scan" :size="iconSize" :color="themePrimary"></uni-icons>
						</view>
					</view>
				</view>
			</view>

			<!-- 消息提示（不自动消失） -->
			<view class="message-box" :class="[messageInfo.type, messageInfo.show ? 'show' : '']">
				<text>{{ messageInfo.content }}</text>
			</view>
		</view>

		<!-- 顶部占位 - 未选择指令时 -->
		<view class="top-placeholder" v-else></view>

		<!-- 中间内容区域 -->
		<view class="content" :class="{ 'no-cmd': !formData.cmdOpt || !currentCmdInfo }">
			<!-- 未选择指令时显示指令按钮列表 - 垂直居中 -->
			<view class="cmd-buttons-container" v-if="!formData.cmdOpt || !currentCmdInfo">
				<view class="cmd-buttons-list">
					<view v-for="(cmd, index) in cmdOptOption" :key="index" class="cmd-button-item"
						:style="{ background: themePrimary }" @click="selectCmdFromButton(cmd)">
						<text class="cmd-name">{{ cmd.text }}</text>
					</view>
				</view>
				<view class="cmd-empty-tip" v-if="cmdOptOption.length === 0">
					<text>暂无可用指令</text>
				</view>
			</view>

			<!-- 参数列表 -->
			<view class="params-container" v-else-if="cmdList.length > 0">
				<scroll-view class="params-scroll" scroll-y :show-scrollbar="false">
					<view class="params-list">
						<view v-for="(item, index) in cmdList" :key="index" class="param-item"
							:class="{filled: isParamFilled(item), current: isCurrentParam(item), fixed: item.fixed, clickable: canClickParam(item)}"
							@click="onParamItemClick(item)" v-if="item.isDisplay=='Y'">
							<!-- isPushErp参数 -->
							<view v-if="item.paramName === 'isPushErp'" class="isPushErp-param-content">
								<view class="param-left">
									<view class="param-info">
										<text class="param-name">{{ item.displayName }}</text>
									</view>
								</view>
								<view class="isPushErp-value-wrapper" @click.stop="toggleIsPushErp(item)">
									<view class="isPushErp-checkbox" :class="{checked: item.value === 'Y'}">
										<uni-icons :type="item.value === 'Y' ? 'checkbox-filled' : 'circle'"
											:size="starSize"
											:color="item.value === 'Y' ? themePrimary : '#ccc'"></uni-icons>
									</view>
									<text class="isPushErp-text">{{ item.value === 'Y' ? '是' : '否' }}</text>
								</view>
							</view>

							<!-- unit参数 -->
							<view v-else-if="item.paramName === 'unit'" class="unit-param-content">
								<view class="param-left">
									<view v-if="item.isEdit !== 'N'" class="fixed-btn" :class="{active: item.fixed}"
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
									<view class="unit-select-wrapper">
										<text class="param-value" :class="{empty: !item.value}">
											{{ getParamDisplayValue(item) }}
										</text>
										<view class="unit-select-btn" @click.stop="openUnitSelector(item)">
											<uni-icons type="more-filled" :size="iconSize"
												:color="themePrimary"></uni-icons>
										</view>
									</view>
									<view v-if="item.value && item.isEdit !== 'N'" class="cancel-btn"
										@click.stop="cancelParam(item)">
										<uni-icons type="clear" :size="clearIconSize" color="#9c9c9c"></uni-icons>
									</view>
								</view>
							</view>

							<!-- 普通参数 -->
							<view v-else-if="item.paramName !== 'num'" class="param-content">
								<view class="param-left">
									<view
										v-if="item.isEdit !== 'N' && item.paramName !== 'sn' && item.paramName !== 'docNo' && item.paramName !== 'docType' && item.paramName !== 'isPushErp'"
										class="fixed-btn" :class="{active: item.fixed}"
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
										{{ getParamDisplayValue(item) }}
									</text>
									<view
										v-if="item.value && item.isEdit !== 'N' && item.paramName !== 'sn' && item.paramName !== 'docNo' && item.paramName !== 'docType' && item.paramName !== 'isPushErp'"
										class="cancel-btn" @click.stop="cancelParam(item)">
										<uni-icons type="clear" :size="clearIconSize" color="#9c9c9c"></uni-icons>
									</view>
								</view>
							</view>

							<!-- num参数 -->
							<view v-else class="num-param-simple">
								<view class="param-left">
									<view
										v-if="item.isEdit !== 'N' && item.paramName !== 'docNo' && item.paramName !== 'docType'"
										class="fixed-btn" :class="{active: item.fixed}"
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
										{{ getParamDisplayValue(item) }}
									</text>
									<view v-if="item.value && item.isEdit !== 'N'" class="cancel-btn"
										@click.stop="cancelNumParam(item)">
										<uni-icons type="clear" :size="clearIconSize" color="#9c9c9c"></uni-icons>
									</view>
								</view>
							</view>
						</view>
					</view>
				</scroll-view>
			</view>

			<view class="initial-tip" v-else-if="formData.cmdOpt && cmdList.length === 0">
				<text>正在加载参数...</text>
			</view>
		</view>

		<!-- 底部固定按钮区域 -->
		<view class="bottom-bar">
			<view class="action-buttons">
				<view class="btn-detail" @click="showDocDetail">
					<text>详情</text>
				</view>
				<view class="btn-reset" v-if="formData.cmdOpt" @click="resetPage">
					<text>重新输入</text>
				</view>
				<view class="btn-submit" v-if="showSubmitButton" :style="{ background: themePrimary }"
					:class="{ disabled: isSubmitting || !canSubmit }" @click="submitData">
					<text v-if="!isSubmitting">提交</text>
					<text v-else>提交中...</text>
				</view>
			</view>
		</view>

		<!-- 单据详情组件 -->
		<doc-detail-popup ref="docDetailPopup" :doc-data="docData" @load-success="onDetailLoadSuccess"
			@load-error="onDetailLoadError" @close="onDetailClose" />

		<!-- SN选择弹窗 -->
		<uni-popup ref="snSelectPopup" type="bottom" :safe-area="false">
			<view class="sn-select-popup" :class="[sizeClass]">
				<view class="popup-header">
					<text class="popup-title">请选择SN信息(该sn对应多条明细)</text>
					<uni-icons type="closeempty" :size="iconSize" color="#666" @click="closeSnSelectPopup"></uni-icons>
				</view>
				<scroll-view class="sn-list" scroll-y>
					<view v-for="(item, index) in snSelectList" :key="index" class="sn-item"
						@click="selectSnItem(item)">
						<view class="sn-header">
							<view class="sn-value">
								<text class="sn-label">SN:</text>
								<text class="sn-text">{{ item.sn || '未知' }}</text>
							</view>
						</view>
						<view class="sn-fields">
							<view v-for="(field, idx) in item.selectItem" :key="idx" class="field-item">
								<text class="field-label">{{ field.fieldLabel }}:</text>
								<text class="field-value">{{ field.fieldValue }}</text>
							</view>
						</view>
					</view>
				</scroll-view>
				<view class="popup-footer">
					<button class="cancel-btn" @click="closeSnSelectPopup">取消</button>
				</view>
			</view>
		</uni-popup>

		<!-- 单位选择弹窗 -->
		<uni-popup ref="unitSelectPopup" type="bottom" :safe-area="false">
			<view class="unit-select-popup" :class="[sizeClass]">
				<view class="popup-header">
					<text class="popup-title">请选择单位</text>
					<uni-icons type="closeempty" :size="iconSize" color="#666"
						@click="closeUnitSelectPopup"></uni-icons>
				</view>
				<scroll-view class="unit-list" scroll-y>
					<view v-for="(unit, index) in unitSelectList" :key="unit.id" class="unit-item"
						@click="selectUnit(unit)">
						<view class="unit-info">
							<text class="unit-name">{{ unit.name }}</text>
							<text class="unit-code">{{ unit.code }}</text>
						</view>
					</view>
				</scroll-view>
				<view class="popup-footer">
					<button class="cancel-btn" @click="closeUnitSelectPopup">取消</button>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
	import {
		getDocDetailBySn,
		getCmdListByDocType,
		getCmdParams,
		getCmdByCmdCode,
		executeCmd,
		getUnitListByItemCode,
		getDocDetailByDocNo,
		validateNum,
		validateFifo
	} from "@/api/wmsApi.js";

	import DocDetailPopup from '@/components/doc-detail-popup.vue';
	import SearchSelector from '@/components/SearchSelector.vue';
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		components: {
			DocDetailPopup,
			SearchSelector
		},
		mixins: [settingsMixin],
		data() {
			return {
				docData: {},
				cmdList: [],
				cmdOptOption: [],
				inventoryCodeFocus: false,
				formData: {
					cmdOpt: "",
					inventoryCode: "",
				},
				isScanning: false,
				messageInfo: {
					show: false,
					content: "",
					type: "info"
				},
				messageTimer: null,
				selectedCmdName: "",
				isSubmitting: false,
				showSubmitButton: false,
				inputReady: false,
				isLoading: false,
				forceNextParam: null,
				snFilled: false,
				autoFillItemLot: false,
				currentSnValue: null,

				codeType: "normal", // 默认普通条码模式
				selectedDetailId: null,
				selectedDetailItem: null,
				detailList: [],
				isLoadingDetail: false,
				loadDetailError: false,

				originalCmdList: [],
				currentCmdInfo: null,

				snSelectList: [],
				tempSnValue: null,
				tempCurrentItem: null,

				unitSelectList: [],
				currentUnitParam: null,

				itemSn: null,
				snAutoFilled: false,

				iconSize: 22,
				starSize: 14,
				clearIconSize: 10,

				snResultNum: null,
				autoFillNumFromSn: false
			}
		},
		computed: {
			isInboundCommand() {
				return this.currentCmdInfo && this.currentCmdInfo.cmdCategroy === "入库";
			},

			detailOptions() {
				return this.detailList.map((item, index) => ({
					...item,
					id: item.itemSeq || index.toString(),
					displayText: `${item.itemSeq || ''} ${item.itemCode || ''}`,
					detailInfo: `${item.itemName || ''} ${item.qtyUnit || ''}`
				}));
			},

			canSubmit() {
				if (this.cmdList.length === 0) return false;
				const requiredFields = this.cmdList.filter(item => item.isRequire === 'Y');
				return requiredFields.every(item => item.value && item.value.trim() !== '');
			},

			canInput() {
				if (!this.formData.cmdOpt) return false;
				const nextParam = this.getNextParam();
				if (!nextParam) return false;
				return nextParam.isEdit !== 'N';
			}
		},
		watch: {
			'appSettings.displaySize': {
				handler(newVal) {
					this.updateIconSizes(newVal);
				},
				immediate: true
			},
			cmdList: {
				deep: true,
				handler(newList, oldList) {
					this.checkAllParamsFilled();
					if (oldList && oldList.length > 0 && newList.length === 0) {
						this.formData.inventoryCode = '';
						this.forceNextParam = null;
						this.snFilled = false;
						this.autoFillItemLot = false;
						this.currentSnValue = null;
						this.selectedDetailId = null;
						this.selectedDetailItem = null;
						this.snResultNum = null;
						this.autoFillNumFromSn = false;
					}
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
					} else {
						this.inputReady = false;
						this.formData.inventoryCode = '';
						this.currentSnValue = null;
						this.selectedDetailId = null;
						this.selectedDetailItem = null;
						this.detailList = [];
						this.originalCmdList = [];
						this.currentCmdInfo = null;
						this.snAutoFilled = false;
						this.snResultNum = null;
						this.autoFillNumFromSn = false;
					}
				}
			},
			codeType: {
				handler(newVal) {
					this.clearAllDataOnCodeTypeSwitch();
					if (newVal === 'container') {
						this.loadDocDetail();
					}
					setTimeout(() => {
						this.focusScanInput();
					}, 100);
				}
			},
			selectedDetailId: {
				handler(newVal) {
					if (newVal) {
						const selectedItem = this.detailList.find(item =>
							(item.itemSeq || item.id) === newVal
						);
						if (selectedItem) {
							this.selectedDetailItem = selectedItem;
							this.fillParamsFromDetail(selectedItem);
							this.showMessage(`已选择明细: ${selectedItem.itemCode} - ${selectedItem.itemName}`, 'success');
						}
					} else {
						this.selectedDetailItem = null;
						this.clearDetailParams();
					}
				}
			},
			'forceNextParam': {
				handler(newVal) {
					this.autoFillItemLot = false;
				}
			}
		},
		onLoad(options) {
			// 接收从主页面传递的 codeType 参数
			if (options.codeType) {
				this.codeType = options.codeType;
			}
			
			if (options.docData) {
				try {
					this.docData = JSON.parse(decodeURIComponent(options.docData));
					console.log('接收到的单据数据:', this.docData);
				} catch (e) {
					console.error('解析单据数据失败:', e);
					uni.showToast({
						title: '数据解析失败',
						icon: 'error'
					});
				}
				if (options.sn) {
					this.itemSn = decodeURIComponent(options.sn);
				}
			}
			if (this.docData.docNo) {
				uni.setNavigationBarTitle({
					title: decodeURIComponent(this.docData.docNo)
				});
			}
			this.initDict();
		},
		methods: {
			// ==================== 通用重置方法 ====================
			resetParamState(options = {}) {
				const {
					keepFixed = true, keepDocInfo = false, clearDetail = false
				} = options;

				this.formData.inventoryCode = '';
				this.snFilled = false;
				this.autoFillItemLot = false;
				this.currentSnValue = null;
				this.forceNextParam = null;
				this.showSubmitButton = false;
				this.snAutoFilled = false;
				this.snResultNum = null;
				this.autoFillNumFromSn = false;

				this.cmdList.forEach(item => {
					if (keepDocInfo && (item.paramName === 'docNo' || item.paramName === 'docType')) {
						return;
					}
					if (keepFixed && item.fixed) {
						return;
					}
					item.value = '';
				});

				const pushErp = this.cmdList.find(item => item.paramName === 'isPushErp');
				if (pushErp && !pushErp.fixed) {
					pushErp.value = 'N';
				}

				if (clearDetail) {
					this.selectedDetailId = null;
					this.selectedDetailItem = null;
				}
			},

			triggerHaptic() {
				// #ifdef APP-PLUS
				if (this.appSettings && this.appSettings.vibration) {
					plus.device.vibrate(15);
				}
				// #endif
			},

			updateIconSizes(size) {
				const sizeMap = {
					small: 18,
					medium: 22,
					large: 26
				};
				this.iconSize = sizeMap[size] || 22;
				this.starSize = (sizeMap[size] || 22) - 8;
				this.clearIconSize = (sizeMap[size] || 22) - 12;
			},

			goBack() {
				uni.navigateBack();
			},

			isParamFilled(item) {
				if (item.paramName === 'docNo' || item.paramName === 'docType' || item.paramName === 'isPushErp') {
					return true;
				}
				return item.value && item.value.trim() !== '';
			},

			fillParamsFromDetail(detailItem) {
				this.clearDetailParams();
				if (!this.cmdList || this.cmdList.length === 0) return;

				let assignedParams = [];

				this.cmdList.forEach(param => {
					if (param.paramName === 'docNo' || param.paramName === 'docType' || param.paramName ===
						'isPushErp') {
						return;
					}
					if (param.value && param.value.trim() !== '') return;
					if (detailItem.hasOwnProperty(param.paramName) && detailItem[param.paramName] !== null &&
						detailItem[param.paramName] !== undefined && detailItem[param.paramName] !== '') {
						param.value = detailItem[param.paramName].toString().trim();
						assignedParams.push(param.displayName);
					}
				});

				if (assignedParams.length > 0) {
					this.showMessage(`已自动填充：${assignedParams.join('、')}`, 'success');
				} else {
					this.showMessage('未找到可填充的参数信息', 'info');
				}
				this.$nextTick(() => this.checkAllParamsFilled());
			},

			clearDetailParams() {
				if (!this.cmdList || this.cmdList.length === 0) return;
				this.cmdList.forEach(param => {
					if (param.paramName === 'docNo' || param.paramName === 'docType' || param.paramName ===
						'isPushErp') return;
					if (param.fixed) return;
					if (param.value && param.value.trim() !== '') param.value = "";
				});
				this.$nextTick(() => this.checkAllParamsFilled());
			},

			clearAllDataOnCodeTypeSwitch() {
				this.resetParamState({
					keepFixed: true,
					keepDocInfo: false,
					clearDetail: true
				});
				this.showMessage(`已切换为${this.codeType === 'normal' ? '普通条码' : '载具条码'}模式`, 'info');
			},

			switchCodeType(type) {
				if (!this.isInboundCommand) {
					this.showMessage('只有入库指令支持切换条码类型', 'warning');
					return;
				}
				this.codeType = type;
			},

			onDetailChange(value, item) {
				console.log('明细选择变化:', value, item);
			},

			onDetailClear() {
				this.selectedDetailId = null;
				this.selectedDetailItem = null;
				this.clearDetailParams();
				this.showMessage('已清空明细选择', 'info');
			},

			showDocDetail() {
				this.$refs.docDetailPopup.open();
			},

			onDetailLoadSuccess(data) {
				console.log('详情加载成功:', data);
			},

			onDetailLoadError(error) {
				console.error('详情加载失败:', error);
			},

			onDetailClose() {
				console.log('详情弹窗关闭');
			},

			onInputFocus() {
				this.inputReady = true;
				const nextParam = this.getNextParam();
				if (nextParam && nextParam.paramName === 'itemLot' && !this.autoFillItemLot) {
					this.formData.inventoryCode = this.getCurrentDate();
					this.autoFillItemLot = true;
					this.showMessage('已自动填充当前日期，可修改或直接确认', 'info');
				}
				if (nextParam && nextParam.paramName === 'num' && this.snResultNum && !this.autoFillNumFromSn) {
					this.formData.inventoryCode = this.snResultNum;
					this.autoFillNumFromSn = true;
					this.showMessage(`下一个参数是数量，已自动填充: ${this.snResultNum}，按回车验证`, 'info');
				}
			},

			onInputBlur() {
				console.log('输入框失去焦点');
			},

			initDict() {
				if (this.docData && this.docData.docNo) {
					this.getCmdListByDocNo();
				} else {
					this.showMessage('缺少单据信息', 'error');
				}
			},

			selectCmdFromButton(cmd) {
				this.formData.cmdOpt = cmd.value;
				this.selectedCmdName = cmd.text;
				this.currentCmdInfo = cmd;
				this.cmdOptChange();
			},

			resetPage() {
				uni.showModal({
					title: '确认重新输入',
					content: '确定要重新输入吗？所有已输入的参数将被清空。',
					success: (res) => {
						if (res.confirm) this.resetToReinputState();
					}
				});
			},

			resetToReinputState() {
				this.resetParamState({
					keepFixed: true,
					keepDocInfo: false,
					clearDetail: true
				});
				this.itemSn = null;

				if (this.codeType === 'normal' && this.formData.cmdOpt) this.cmdOptChange();
				if (this.codeType === 'container' && this.isInboundCommand) {
					this.loadDocDetail();
				}

				this.showMessage('已重置，可以重新输入', 'success');
				setTimeout(() => this.focusScanInput(), 300);
			},

			async getCmdListByDocNo() {
				try {
					const response = await getCmdListByDocType({
						typeSn: this.docData.docType,
						pageNo: 1,
						pageSize: -1,
					});
					if (response.data && response.data.result.records) {
						this.cmdOptOption = response.data.result.records.map(item => ({
							...item,
							text: item.commandName,
							value: item.commandSn,
							commandDesc: item.commandDesc,
							cmdCategroy: item.cmdCategroy
						}));
					} else {
						this.cmdOptOption = [];
					}
				} catch (err) {
					console.log("获取指令列表失败:", err);
					this.showMessage('获取指令列表失败', 'error');
				}
			},

			checkAllParamsFilled() {
				if (this.cmdList.length === 0) {
					this.showSubmitButton = false;
					return;
				}
				const requiredFields = this.cmdList.filter(item => item.isRequire === 'Y');
				const allRequiredFilled = requiredFields.every(item => item.value && item.value.trim() !== '');
				this.showSubmitButton = allRequiredFilled;
				if (allRequiredFilled) this.showMessage('必填参数已填写完成，可以提交', 'info');
			},

			onCmdChange(value, item) {
				this.selectedCmdName = item ? item.text : "";
				this.currentCmdInfo = item;
				this.cmdOptChange();
				setTimeout(() => this.focusScanInput(), 100);
			},

			onCmdClear() {
				this.selectedCmdName = "";
				this.currentCmdInfo = null;
				this.cmdList = [];
				this.showSubmitButton = false;
				this.forceNextParam = null;
				this.snFilled = false;
				this.autoFillItemLot = false;
				this.currentSnValue = null;
				this.selectedDetailId = null;
				this.selectedDetailItem = null;
				this.detailList = [];
				this.originalCmdList = [];
				this.formData.inventoryCode = '';
				this.snAutoFilled = false;
				this.snResultNum = null;
				this.autoFillNumFromSn = false;
				this.showMessage('已清空指令选择', 'info');
			},

			showMessage(content, type = "info") {
				if (this.messageTimer) {
					clearTimeout(this.messageTimer);
				}
				this.messageInfo = {
					show: true,
					content,
					type
				};
			},

			async cmdOptChange() {
				try {
					const response = await getCmdParams(this.formData.cmdOpt);
					const rawParams = response.data.result || [];
					this.originalCmdList = rawParams.map((item) => {
						if (item.paramName === "docNo") return {
							...item,
							value: this.docData.docNo,
							fixed: true
						};
						if (item.paramName === "docType") return {
							...item,
							value: this.docData.docType || '',
							fixed: true
						};
						if (item.paramName === "isPushErp") return {
							...item,
							value: "N",
							fixed: false
						};
						return {
							...item,
							value: "",
							fixed: false
						};
					});
					this.cmdList = JSON.parse(JSON.stringify(this.originalCmdList));
					if (this.codeType === 'container' && this.isInboundCommand && this.selectedDetailItem) {
						this.fillParamsFromDetail(this.selectedDetailItem);
					}
					this.formData.inventoryCode = '';
					this.showSubmitButton = false;
					this.forceNextParam = null;
					this.snFilled = false;
					this.autoFillItemLot = false;
					this.currentSnValue = null;
					this.snAutoFilled = false;
					this.snResultNum = null;
					this.autoFillNumFromSn = false;
					this.showMessage(`已选择: ${this.selectedCmdName}`, 'success');
					this.$nextTick(() => this.autoFillSnIfNeeded());
				} catch (err) {
					console.log("获取指令参数失败:", err);
					this.showMessage('获取指令参数失败', 'error');
				}
			},

			autoFillSnIfNeeded() {
				if (this.itemSn && !this.snAutoFilled) {
					const snParam = this.cmdList.find(item => item.paramName === 'sn' || item.paramName === 'glSn');
					if (snParam) {
						this.snAutoFilled = true;
						this.formData.inventoryCode = this.itemSn;
						setTimeout(() => this.onInputConfirm(), 1);
					}
				}
			},

			toggleIsPushErp(item) {
				if (item.paramName === 'isPushErp') {
					item.value = item.value === 'Y' ? 'N' : 'Y';
					this.showMessage(`自动提交ERP已${item.value === 'Y' ? '开启' : '关闭'}`, 'success');
				}
			},

			isCurrentParam(item) {
				if (item.paramName === "docNo" || item.paramName === "docType" || item.paramName === "isPushErp")
					return false;
				if (item.value && item.value.trim() !== "") return false;
				const nextParam = this.getNextParam();
				return nextParam && nextParam.paramName === item.paramName;
			},

			canClickParam(item) {
				if (item.paramName === 'docNo' || item.paramName === 'docType' || item.paramName === 'isPushErp')
					return false;
				if (item.paramName === 'unit') return false;
				if (item.paramName === 'num') return item.isEdit !== 'N';
				if (item.isEdit === 'N') return false;
				if (item.value && item.value.trim() !== "") return false;
				if (!this.snFilled) return item.paramName === 'sn';
				return true;
			},

			onNumParamClick(numParam) {
				if (numParam.value && numParam.value.trim() !== '') {
					uni.showModal({
						title: '修改数量',
						content: `当前数量为: ${numParam.value}，是否重新输入？`,
						confirmText: '重新输入',
						success: (res) => {
							if (res.confirm) {
								numParam.value = '';
								this.forceNextParam = 'num';
								this.formData.inventoryCode = '';
								this.showMessage('请重新输入数量', 'info');
								this.focusScanInput();
							}
						}
					});
				} else {
					this.forceNextParam = 'num';
					this.formData.inventoryCode = '';
					this.showMessage('下一个将输入: 数量', 'info');
					this.focusScanInput();
				}
			},

			onParamItemClick(item) {
				if (!this.canClickParam(item)) return;
				if (item.paramName === 'num') {
					this.onNumParamClick(item);
					return;
				}
				this.forceNextParam = item.paramName;
				if (item.paramName === 'itemLot') this.autoFillItemLot = true;
				this.formData.inventoryCode = '';
				this.showMessage(`下一个将输入: ${item.displayName}`, 'info');
				this.focusScanInput();
			},

			getNextParam() {
				if (this.forceNextParam) {
					const forceParam = this.cmdList.find(item => item.paramName === this.forceNextParam);
					if (forceParam && forceParam.paramName !== 'isPushErp') {
						if (forceParam.isEdit !== 'N') {
							if (!forceParam.value || forceParam.value.trim() === "") return forceParam;
						}
						this.forceNextParam = null;
					}
				}
				const snItem = this.cmdList.find(item =>
					item.paramName === 'sn' && item.isEdit !== 'N' && (!item.value || item.value.trim() === "")
				);
				if (snItem) return snItem;
				return this.cmdList.find(param => {
					if (param.paramName === 'docNo' || param.paramName === 'docType' || param.paramName ===
						'isPushErp' || param.isEdit === 'N') return false;
					return !param.value || param.value.trim() === "";
				});
			},

			toggleFixedParam(item) {
				if (item.paramName === 'docNo' || item.paramName === 'docType' || item.paramName === 'isPushErp' || item
					.isEdit === 'N') return;
				item.fixed = !item.fixed;
				this.showMessage(`${item.displayName} ${item.fixed ? '已固定' : '已取消固定'}`, 'success');
			},

			cancelParam(item) {
				if (item.paramName === 'docNo' || item.paramName === 'docType' || item.paramName === 'isPushErp' || item
					.isEdit === 'N') return;
				if (item.paramName === 'sn' && this.codeType === 'normal') {
					this.resetToReinputState();
					return;
				}
				item.value = "";
				this.showMessage(`已取消 ${item.displayName}`, 'info');
				if (item.paramName === 'sn') {
					this.snFilled = false;
					this.currentSnValue = null;
					this.forceNextParam = 'sn';
					this.snResultNum = null;
					this.autoFillNumFromSn = false;
					this.showMessage('SN已清除，下一个将输入SN', 'info');
					setTimeout(() => this.focusScanInput(), 100);
				} else {
					this.formData.inventoryCode = '';
					this.$nextTick(() => {
						this.checkAllParamsFilled();
						this.focusScanInput();
					});
				}
			},

			cancelNumParam(item) {
				if (item.paramName !== 'num' || item.isEdit === 'N') return;
				item.value = "";
				this.showMessage(`已取消 ${item.displayName}`, 'info');
				this.formData.inventoryCode = '';
				this.$nextTick(() => {
					this.checkAllParamsFilled();
					this.focusScanInput();
				});
			},

			handleScan() {
				if (this.isScanning || !this.formData.cmdOpt || !this.canInput) return;
				if (this.codeType === 'container' && this.isInboundCommand && !this.selectedDetailId) {
					this.showMessage('请先选择明细', 'warning');
					return;
				}
				this.isScanning = true;
				uni.scanCode({
					onlyFromCamera: false,
					scanType: ['qrCode', 'barCode', 'ean13', 'ean8'],
					success: (res) => {
						this.formData.inventoryCode = res.result.trim();
						this.onScanSuccess(res.result.trim());
					},
					fail: (err) => {
						if (err.errMsg !== 'scanCode:fail cancel') this.showMessage('扫码失败', 'error');
						this.focusScanInput();
					},
					complete: () => {
						this.isScanning = false;
					}
				});
			},

			checkAndCalculateNum() {
				const boxesParam = this.cmdList.find(item => item.paramName === 'boxes');
				const boxSpecParam = this.cmdList.find(item => item.paramName === 'boxSpec');
				const numParam = this.cmdList.find(item => item.paramName === 'num');
				if (boxesParam && boxSpecParam && numParam) {
					const boxesValue = boxesParam.value ? boxesParam.value.trim() : '';
					const boxSpecValue = boxSpecParam.value ? boxSpecParam.value.trim() : '';
					if (boxesValue !== '' && boxSpecValue !== '') {
						const boxes = parseFloat(boxesValue);
						const boxSpec = parseFloat(boxSpecValue);
						if (!isNaN(boxes) && !isNaN(boxSpec)) {
							this.validateNumWithConfirm((boxes * boxSpec).toString(), numParam, true);
							return true;
						}
					}
				}
				return false;
			},

			_getNumValidationContext() {
				const docNo = this.docData.docNo;
				const docType = this.docData.docType;
				const sn = this.currentSnValue || '';
				let itemSeq = null;
				if (this.codeType === 'container' && this.isInboundCommand && this.selectedDetailItem) {
					itemSeq = this.selectedDetailItem.itemSeq;
				} else {
					const itemSeqParam = this.cmdList.find(item => item.paramName === 'itemSeq');
					if (itemSeqParam && itemSeqParam.value) itemSeq = itemSeqParam.value;
				}
				let unitId = '';
				const unitParam = this.cmdList.find(item => item.paramName === 'unitId');
				if (unitParam && unitParam.value) {
					unitId = unitParam.value;
				} else {
					const unitNameParam = this.cmdList.find(item => item.paramName === 'unit');
					if (unitNameParam && unitNameParam.value && this.unitSelectList.length > 0) {
						const selectedUnit = this.unitSelectList.find(unit => unit.name === unitNameParam.value);
						if (selectedUnit) unitId = selectedUnit.id;
					}
				}
				return {
					docNo,
					docType,
					sn,
					itemSeq,
					unitId
				};
			},

			_applyNumAfterValidation(numValue, numParam, calcFromBoxes) {
				numParam.value = numValue;
				this.showMessage(`${numParam.displayName} ${calcFromBoxes ? '计算' : '输入'}成功`, 'success');
				this.afterNumFilled(numParam);
			},

			_handleNumValidationError(error, numParam, calcFromBoxes) {
				console.error('数量验证异常:', error);
				uni.showModal({
					title: '数量验证异常',
					content: '网络连接异常，请检查网络后重试',
					confirmText: '确定',
					showCancel: false,
					success: () => {
						if (!calcFromBoxes) this.formData.inventoryCode = '';
						this.focusScanInput();
					}
				});
			},

			validateNumWithConfirm(numValue, numParam, calcFromBoxes = false) {
				const {
					docNo,
					docType,
					sn,
					itemSeq,
					unitId
				} = this._getNumValidationContext();

				if (!itemSeq) {
					this._applyNumAfterValidation(numValue, numParam, calcFromBoxes);
					return;
				}

				this.showMessage('正在验证数量...', 'info');

				validateNum({
					docNo,
					sn,
					num: parseFloat(numValue),
					itemSeq: parseInt(itemSeq),
					unitId,
					docType
				}).then(response => {
					if (response.data && response.data.code === 200) {
						const result = response.data.result;
						if (result && result.NG) {
							const actionText = calcFromBoxes ? '计算' : '填入';
							uni.showModal({
								title: '数量验证',
								content: result.NG + '\n\n是否仍然' + actionText + '该数量？',
								confirmText: '确认' + actionText,
								success: (modalRes) => {
									if (modalRes.confirm) {
										this._applyNumAfterValidation(numValue, numParam,
											calcFromBoxes);
									} else {
										numParam.value = '';
										if (!calcFromBoxes) this.formData.inventoryCode = '';
										this.focusScanInput();
									}
								}
							});
							return;
						}
						this._applyNumAfterValidation(numValue, numParam, calcFromBoxes);
					} else {
						const errorMsg = response.data?.message || '验证服务异常';
						uni.showModal({
							title: '数量验证失败',
							content: errorMsg,
							confirmText: '确定',
							showCancel: false,
							success: () => {
								if (!calcFromBoxes) this.formData.inventoryCode = '';
								this.focusScanInput();
							}
						});
					}
				}).catch(error => {
					this._handleNumValidationError(error, numParam, calcFromBoxes);
				});
			},

			afterNumFilled(numParam) {
				this.$nextTick(() => {
					const boxesParam = this.cmdList.find(item => item.paramName === 'boxes');
					const boxSpecParam = this.cmdList.find(item => item.paramName === 'boxSpec');
					const currentNumParam = this.cmdList.find(item => item.paramName === 'num');
					if (!(boxesParam && boxSpecParam && currentNumParam && currentNumParam.value)) {
						this.checkAndCalculateNum();
					}
					this.checkAllParamsFilled();
				});
				const currentForceParam = this.forceNextParam;
				this.forceNextParam = null;
				this.autoFillItemLot = false;
				this.autoFillNumFromSn = false;
				if (currentForceParam !== numParam.paramName) this.forceNextParam = currentForceParam;
				this.formData.inventoryCode = '';
				this.focusScanInput();
			},

			onScanSuccess(scanResult) {
				if (!this.formData.cmdOpt) return;

				this.triggerHaptic();

				scanResult = scanResult.trim();
				const targetItem = this.getNextParam();
				if (!targetItem) {
					this.showMessage('所有参数已填写完成', 'info');
					this.formData.inventoryCode = "";
					return;
				}
				if (targetItem.isEdit === 'N') {
					this.showMessage(`${targetItem.displayName} 为只读参数，不能手动输入`, 'warning');
					this.formData.inventoryCode = "";
					this.focusScanInput();
					return;
				}
				if (!this.checkAndConvertType(scanResult, targetItem.paramType)) {
					this.formData.inventoryCode = "";
					this.focusScanInput();
					return;
				}
				if (targetItem.paramName === 'sn') {
					if (this.codeType === 'normal' || !this.isInboundCommand) {
						this.tempSnValue = scanResult;
						this.tempCurrentItem = targetItem;
						this.getDocDetailBySnWithFifo(scanResult, targetItem);
					} else {
						targetItem.value = scanResult;
						this.snFilled = true;
						this.currentSnValue = scanResult;
						this.showMessage(`${targetItem.displayName} 输入成功`, 'success');
					}
				} else if (targetItem.paramName === 'num') {
					this.validateNumWithConfirm(scanResult, targetItem, false);
					return;
				} else {
					targetItem.value = scanResult;
					this.showMessage(`${targetItem.displayName} 输入成功`, 'success');
					if (targetItem.paramName === 'boxes' || targetItem.paramName === 'boxSpec') {
						this.$nextTick(() => setTimeout(() => this.checkAndCalculateNum(), 100));
					}
				}
				const currentForceParam = this.forceNextParam;
				this.forceNextParam = null;
				this.autoFillItemLot = false;
				if (currentForceParam !== targetItem.paramName) this.forceNextParam = currentForceParam;
				this.formData.inventoryCode = '';
				this.focusScanInput();
			},

			async validateFifo(snValue) {
				try {
					const response = await validateFifo({
						sn: snValue.trim(),
						docNo: this.docData.docNo,
						docType: this.docData.docType
					});

					if (response.data && response.data.code === 200) {
						const result = response.data.result;
						if (result && result.NG) {
							return new Promise((resolve) => {
								uni.showModal({
									title: '先进先出验证',
									content: result.NG,
									confirmText: '确认出库',
									cancelText: '取消',
									success: (modalRes) => {
										if (modalRes.confirm) {
											resolve(true);
										} else {
											resolve(false);
										}
									}
								});
							});
						}
						return true;
					} else {
						const errorMsg = response.data?.message || '先进先出验证失败';
						this.showMessage(errorMsg, 'error');
						return false;
					}
				} catch (error) {
					console.error('先进先出验证失败:', error);
					this.showMessage('先进先出验证失败，请检查网络连接', 'error');
					return false;
				}
			},

			async getDocDetailBySnWithFifo(snValue, currentItem) {
				const isOutboundCommand = this.currentCmdInfo && this.currentCmdInfo.cmdCategroy === "出库";

				if (isOutboundCommand) {
					this.showMessage('正在验证先进先出...', 'info');
					const isValid = await this.validateFifo(snValue);

					if (!isValid) {
						this.formData.inventoryCode = '';
						this.focusScanInput();
						return;
					}
					await this.doGetDocDetailBySn(snValue, currentItem);
				} else {
					await this.doGetDocDetailBySn(snValue, currentItem);
				}
			},

			async doGetDocDetailBySn(snValue, currentItem) {
				if (this.isLoading || (this.codeType === 'container' && this.isInboundCommand)) return;
				this.isLoading = true;
				this.showMessage('正在查询SN信息...', 'info');
				try {
					const response = await getDocDetailBySn({
						sn: snValue.trim(),
						docType: this.docData.docType,
						docNo: this.docData.docNo
					});
					if (response.data && response.data.code === 200) {
						const result = response.data.result;
						if (Array.isArray(result)) {
							this.snSelectList = result;
							this.tempSnValue = snValue;
							this.tempCurrentItem = currentItem;
							this.openSnSelectPopup();
						} else {
							this.processSingleSnResult(result, snValue, currentItem);
						}
					} else {
						this.showMessage(`查询SN信息失败: ${response.data?.message || '未知错误'}`, 'error');
					}
				} catch (error) {
					console.error('查询SN信息失败:', error);
					this.showMessage('查询SN信息失败，请检查网络连接', 'error');
				} finally {
					this.isLoading = false;
				}
			},

			async getDocDetailBySn(snValue, currentItem) {
				await this.getDocDetailBySnWithFifo(snValue, currentItem);
			},

			processSingleSnResult(result, snValue, currentItem) {
				const isRescanSn = this.currentSnValue && this.currentSnValue !== snValue.trim();
				this.currentSnValue = snValue.trim();
				this.snResultNum = (result.num !== undefined && result.num !== null && result.num !== '') ? result.num
					.toString().trim() : null;
				this.autoFillNumFromSn = false;
				currentItem.value = snValue.trim();
				this.snFilled = true;
				let assignedParams = [];
				this.cmdList.forEach(param => {
					if (param.paramName === 'docNo' || param.paramName === currentItem.paramName || param
						.paramName === 'docType' || param.paramName === 'isPushErp') return;
					if (param.paramName === 'num') return;
					if (isRescanSn && !param.fixed && param.isEdit !== 'N') param.value = "";
					if (param.value && param.value.trim() !== '') return;
					if (param.paramName === 'itemName' && result.itemName) {
						param.value = result.itemName.toString().trim();
						assignedParams.push(param.displayName);
						return;
					}
					if (result.hasOwnProperty(param.paramName) && result[param.paramName] !== null && result[param
							.paramName] !== undefined && result[param.paramName] !== '') {
						param.value = result[param.paramName].toString().trim();
						assignedParams.push(param.displayName);
					}
				});
				let successMessage = `${currentItem.displayName} 输入成功`;
				if (assignedParams.length > 0) successMessage += `，并自动填充了：${assignedParams.join('、')}`;
				if (this.snResultNum) successMessage += `，检测到数量值: ${this.snResultNum}`;
				this.showMessage(successMessage, 'success');
				const nextParam = this.getNextParam();
				if (nextParam && nextParam.paramName === 'itemLot') {
					this.forceNextParam = 'itemLot';
					this.autoFillItemLot = true;
					this.formData.inventoryCode = this.getCurrentDate();
					this.showMessage('下一个参数是生产批次，已自动填充当前日期', 'info');
				} else if (nextParam && nextParam.paramName === 'num' && this.snResultNum) {
					this.autoFillNumFromSn = true;
					this.forceNextParam = 'num';
					this.formData.inventoryCode = this.snResultNum;
					this.showMessage(`下一个参数是数量，已自动填充: ${this.snResultNum}，按回车验证`, 'info');
				}
			},

			openSnSelectPopup() {
				this.$refs.snSelectPopup.open();
			},

			closeSnSelectPopup() {
				this.$refs.snSelectPopup.close();
				this.snSelectList = [];
				this.tempSnValue = null;
				this.tempCurrentItem = null;
				this.focusScanInput();
			},

			selectSnItem(selectedItem) {
				this.processSingleSnResult(selectedItem, this.tempSnValue, this.tempCurrentItem);
				this.closeSnSelectPopup();
			},

			checkAndConvertType(value, paramType) {
				if (!value) return false;
				value = value.trim();
				switch (paramType) {
					case "String":
						return true;
					case "Integer":
						if (/^-?\d+$/.test(value)) return true;
						this.showMessage(`值 "${value}" 不符合 Integer 类型`, 'error');
						return false;
					case "BigDecimal":
						if (/^-?\d+(\.\d+)?$/.test(value)) return true;
						this.showMessage(`值 "${value}" 不符合 BigDecimal 类型`, 'error');
						return false;
					case "Date":
						return this.convertToSpecificDateFormat(value);
					default:
						this.showMessage(`不支持的参数类型: ${paramType}`, 'error');
						return false;
				}
			},

			convertToSpecificDateFormat(input) {
				input = input.trim();
				const regex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
				const match = input.match(regex);
				if (!match) {
					this.showMessage(`值 "${input}" 格式应为：YYYY-MM-DD HH:mm:ss`, 'error');
					return false;
				}
				const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
				return month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate() && hour >= 0 &&
					hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
			},

			validateItemLotFormat(value) {
				if (!value || value.trim() === '') return false;
				const trimmedValue = value.trim();
				if (!/^\d{8}$/.test(trimmedValue)) return false;
				const year = trimmedValue.substring(0, 4);
				const month = trimmedValue.substring(4, 6);
				const day = trimmedValue.substring(6, 8);
				if (month < 1 || month > 12) return false;
				const date = new Date(year, month - 1, day);
				return date.getFullYear() == year && (date.getMonth() + 1) == month && date.getDate() == day;
			},

			async openUnitSelector(unitParam) {
				const itemCodeParam = this.cmdList.find(item => item.paramName === 'itemCode');
				if (!itemCodeParam || !itemCodeParam.value || itemCodeParam.value.trim() === '') {
					this.showMessage('请先填写物料编码(itemCode)', 'info');
					return;
				}
				const itemCode = itemCodeParam.value.trim();
				this.currentUnitParam = unitParam;
				this.showMessage('正在加载单位列表...', 'info');
				try {
					const response = await getUnitListByItemCode({
						itemCode
					});
					if (response.data && response.data.code === 200 && response.data.result) {
						const result = response.data.result;
						this.unitSelectList = Array.isArray(result) ? result : (result.records && Array.isArray(result
							.records) ? result.records : []);
						if (this.unitSelectList.length === 0) {
							this.showMessage('无更多的单位选择', 'info');
							return;
						}
						this.$refs.unitSelectPopup.open();
					} else {
						this.showMessage(`获取单位列表失败: ${response.data?.message || '未知错误'}`, 'error');
					}
				} catch (error) {
					console.error('获取单位列表失败:', error);
					this.showMessage('获取单位列表失败，请检查网络连接', 'error');
				}
			},

			selectUnit(unit) {
				if (this.currentUnitParam) {
					this.currentUnitParam.value = unit.name;
					this.showMessage(`已选择单位: ${unit.name}`, 'success');
					const unitIdParam = this.cmdList.find(item => item.paramName === 'unitId');
					if (unitIdParam) unitIdParam.value = unit.id;
					this.closeUnitSelectPopup();
					this.$nextTick(() => this.checkAllParamsFilled());
				}
			},

			closeUnitSelectPopup() {
				this.$refs.unitSelectPopup.close();
				this.unitSelectList = [];
				this.currentUnitParam = null;
			},

			async submitData() {
				if (this.isSubmitting) return;
				if (!this.canSubmit) {
					this.showMessage('请先填写所有必填字段', 'error');
					return;
				}
				const itemLotParam = this.cmdList.find(item => item.paramName === 'itemLot');
				if (itemLotParam && itemLotParam.value && itemLotParam.value.trim() !== '') {
					if (!this.validateItemLotFormat(itemLotParam.value)) {
						this.showMessage('生产批次格式错误，应为 yyyyMMdd 格式（如：20231225）', 'error');
						this.$nextTick(() => {
							this.forceNextParam = 'itemLot';
							this.focusScanInput();
						});
						return;
					}
				}
				this.isSubmitting = true;
				this.showMessage('正在提交...', 'info');
				const params = {};
				this.cmdList.forEach(item => {
					if (item.isRequire === 'Y') params[item.paramName] = item.value ? item.value.trim() : '';
				});
				try {
					const cmdResponse = await getCmdByCmdCode(this.formData.cmdOpt);
					const result = await executeCmd(cmdResponse.data.result.cmdDesc, {
						...params,
						docNo: this.docData.docNo
					});
					const message = result.data?.message || result.data?.msg || (result.data?.result && typeof result
						.data.result === 'string' ? result.data.result : '指令执行成功');
					if (result.data.code == '500') {
						this.showMessage(message, 'error');
					} else {
						this.triggerHaptic();
						this.showMessage(message, 'success');

						this.resetParamState({
							keepFixed: true,
							keepDocInfo: true,
							clearDetail: true
						});

						if (this.codeType === 'container' && this.isInboundCommand) {
							this.loadDocDetail();
						}
						setTimeout(() => this.focusScanInput(), 500);
					}
				} catch (err) {
					console.log("提交失败:", err);
					this.showMessage('指令执行失败', 'error');
				} finally {
					this.isSubmitting = false;
				}
			},

			onInputConfirm() {
				if (!this.inputReady) {
					setTimeout(() => this.onInputConfirm(), 300);
					return;
				}
				if (this.formData.inventoryCode && this.formData.inventoryCode.trim()) {
					const inputValue = this.formData.inventoryCode.trim();
					const nextParam = this.getNextParam();
					if (nextParam && nextParam.paramName === 'num') {
						this.validateNumWithConfirm(inputValue, nextParam, false);
					} else {
						this.onScanSuccess(inputValue);
					}
				} else {
					this.showMessage('请输入有效内容', 'error');
					this.focusScanInput();
				}
			},

			getPlaceholderData() {
				const nextParam = this.getNextParam();
				if (nextParam) {
					let placeholder = `扫描${nextParam.displayName}`;
					if (nextParam.paramName === 'itemLot') placeholder += '（格式：yyyyMMdd）';
					else if (nextParam.paramName === 'sn') placeholder += '(SN)';
					else if (nextParam.paramName === 'num') {
						const unitParam = this.cmdList.find(item => item.paramName === 'unit');
						const unitValue = unitParam && unitParam.value ? unitParam.value : '';
						placeholder = unitValue ? `扫描数量（单位：${unitValue}）` : '扫描数量（单位）';
					}
					if (nextParam.isEdit === 'N') placeholder += ' [只读]';
					return placeholder;
				}
				return "所有参数已完成";
			},

			getParamDisplayValue(item) {
				return (item.value && item.value.trim() !== '') ? item.value : (item.isRequire === 'Y' ? '待输入' : '');
			},

			getCurrentDate() {
				const now = new Date();
				return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
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

			isAPP() {
				// #ifdef APP-PLUS
				return true;
				// #endif
				// #ifdef APP
				return true;
				// #endif
				// #ifndef APP-PLUS
				return false;
				// #endif
			},

			getInputType() {
				// #ifdef APP-PLUS
				const nextParam = this.getNextParam();
				if (nextParam && (nextParam.paramType === 'Integer' || nextParam.paramType === 'BigDecimal'))
					return 'number';
				return 'text';
				// #endif
				// #ifdef APP
				const nextParam2 = this.getNextParam();
				if (nextParam2 && (nextParam2.paramType === 'Integer' || nextParam2.paramType === 'BigDecimal'))
					return 'number';
				return 'text';
				// #endif
				// #ifndef APP-PLUS
				return 'text';
				// #endif
			},

			async loadDocDetail() {
				if (!this.docData.docNo) {
					this.showMessage('单据号不存在', 'error');
					return;
				}
				if (this.isLoadingDetail) return;
				this.isLoadingDetail = true;
				this.loadDetailError = false;
				try {
					const response = await getDocDetailByDocNo({
						docNo: this.docData.docNo
					});
					if (response.data && response.data.code === 200) {
						const result = response.data.result;
						if (Array.isArray(result) && result.length > 0) {
							this.detailList = result;
							this.showMessage(`加载了${result.length}条明细`, 'success');
						} else {
							this.detailList = [];
							this.showMessage('暂无明细数据', 'warning');
						}
					} else {
						this.detailList = [];
						this.showMessage('加载明细失败', 'error');
					}
				} catch (error) {
					console.error('加载明细失败:', error);
					this.loadDetailError = true;
					this.detailList = [];
					this.showMessage('加载明细失败', 'error');
				} finally {
					this.isLoadingDetail = false;
				}
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

	.top-placeholder {
		flex-shrink: 0;
		height: 20rpx;
	}

	.form-container {
		background: #fff;
		border-radius: 12rpx;
		margin-bottom: 12rpx;
	}

	.first-row {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-bottom: 12rpx;

		.cmd-selector {
			flex: 1;
		}
	}

	.code-type-compact {
		display: flex;
		background: #f4f5f7;
		border-radius: 8rpx;
		padding: 4rpx;

		.code-type-btn {
			padding: 10rpx 20rpx;
			border-radius: 6rpx;
			font-size: 24rpx;
			color: #666;
			transition: all .2s;

			&.active {
				background: #fff;
				color: #1677ff;
				box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, .08);
			}
		}
	}

	.third-row {
		margin-bottom: 12rpx;
	}

	.fourth-row {
		margin-top: 8rpx;
	}

	.scan-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;

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
	}

	/* 消息提示（不自动消失） */
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

		&.warning {
			background: rgba(255, 165, 0, .1);
			color: #e65100;
		}
	}

	/* 内容区域 */
	.content {
		flex: 1;
		overflow: hidden;
		padding: 20rpx 24rpx;
		display: flex;
		flex-direction: column;

		&.no-cmd {
			justify-content: center;
		}
	}

	/* 未选择指令时的按钮列表 - 垂直居中 */
	.cmd-buttons-container {
		width: 100%;
	}

	.cmd-buttons-list {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.cmd-button-item {
		background: #1677ff;
		border-radius: 12rpx;
		padding: 32rpx 20rpx;
		text-align: center;
		transition: all .2s;

		&:active {
			transform: scale(.98);
			opacity: .9;
		}
	}

	.cmd-name {
		font-size: 30rpx;
		font-weight: 500;
		color: #fff;
	}

	.cmd-empty-tip {
		text-align: center;
		padding: 60rpx 0;
		color: #999;
		font-size: 28rpx;
	}

	/* 参数列表 */
	.params-container {
		background: #fff;
		border-radius: 16rpx;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
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
		border-bottom: 1rpx solid #f0f0f0;

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

	.param-content,
	.num-param-simple,
	.unit-param-content,
	.isPushErp-param-content {
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

	.unit-select-wrapper {
		display: flex;
		align-items: center;
		gap: 8rpx;
		background: #f4f5f7;
		padding: 8rpx 12rpx;
		border-radius: 8rpx;
	}

	.isPushErp-value-wrapper {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 8rpx 16rpx;
		background: #f4f5f7;
		border-radius: 8rpx;
	}

	.initial-tip {
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
		justify-content: center;

		.btn-detail {
			flex: 0.8;
			background: #f4f5f7;
			color: #666;
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
		}

		.btn-reset {
			flex: 1;
			background: #f4f5f7;
			color: #666;
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
		}

		.btn-submit {
			flex: 1.2;
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
	}

	/* 弹窗样式 */
	.sn-select-popup,
	.unit-select-popup {
		background: #fff;
		border-top-left-radius: 24rpx;
		border-top-right-radius: 24rpx;
		padding: 24rpx;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 20rpx;
		border-bottom: 1r solid #f0f0f0;
		margin-bottom: 20rpx;

		.popup-title {
			font-size: 30rpx;
			font-weight: 500;
			color: #333;
		}
	}

	.sn-list,
	.unit-list {
		flex: 1;
		max-height: 60vh;
	}

	.sn-item,
	.unit-item {
		background: #f8f9fa;
		border-radius: 12rpx;
		padding: 20rpx;
		margin-bottom: 16rpx;

		&:active {
			background: #e8e8e8;
		}
	}

	.popup-footer {
		padding-top: 20rpx;
		border-top: 1r solid #f0f0f0;
		margin-top: 20rpx;

		.cancel-btn {
			width: 100%;
			background: #f5f5f5;
			color: #666;
			border-radius: 8rpx;
			padding: 20rpx 0;
			font-size: 28rpx;
		}
	}

	/* ===== 小号样式 ===== */
	.size-small {
		.top-bar {
			padding: 14rpx 16rpx;
		}

		.first-row .code-type-btn {
			padding: 6rpx 14rpx;
			font-size: 20rpx;
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
			padding: 14rpx 16rpx;
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

		.cmd-button-item {
			padding: 22rpx 20rpx;
		}

		.cmd-name {
			font-size: 26rpx;
		}

		.action-buttons {

			.btn-detail,
			.btn-reset,
			.btn-submit {
				padding: 16rpx 0;
				font-size: 24rpx;
			}
		}
	}

	/* ===== 大号样式 ===== */
	.size-large {
		.top-bar {
			padding: 28rpx 32rpx;
		}

		.first-row .code-type-btn {
			padding: 14rpx 28rpx;
			font-size: 28rpx;
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
			padding: 28rpx 32rpx;
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

		.cmd-button-item {
			padding: 42rpx 20rpx;
		}

		.cmd-name {
			font-size: 34rpx;
		}

		.action-buttons {

			.btn-detail,
			.btn-reset,
			.btn-submit {
				padding: 28rpx 0;
				font-size: 32rpx;
			}
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
		.bottom-bar,
		.sn-select-popup,
		.unit-select-popup {
			background: #1a1a2e;
		}

		.code-type-compact {
			background: #1e1e36;
		}

		.code-type-btn {
			color: #888;

			&.active {
				background: #2a2a45;
				color: #7cadff;
			}
		}

		.scan-input {
			background: #1e1e36;
			color: #e0e0e0;

			&[disabled] {
				background: #252545;
				color: #666;
			}
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

		.unit-select-wrapper,
		.isPushErp-value-wrapper {
			background: #1e1e36;
		}

		.action-buttons {

			.btn-detail,
			.btn-reset {
				background: #1e1e36;
				color: #888;
			}
		}

		.sn-item,
		.unit-item {
			background: #1e1e36;
		}

		.popup-header {
			border-bottom-color: #2a2a45;

			.popup-title {
				color: #e0e0e0;
			}
		}

		.popup-footer {
			border-top-color: #2a2a45;

			.cancel-btn {
				background: #1e1e36;
				color: #888;
			}
		}
	}
</style>