<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 工单选择 ════ -->
		<view class="card">
			<view class="sel" @click="handleShowMoSelector">
				<text class="sel-text" :class="{ ph: !formData.moNumber }">{{ formData.moNumber || '选择工单' }}</text>
				<uni-icons type="arrowdown" size="16" color="var(--t-sub)"></uni-icons>
			</view>

			<view class="info-grid" v-if="formData.moNumber">
				<view class="info-row">
					<view class="info-item"><text class="info-l">产品料号</text><text class="info-v">{{ formData.cbItemCode || '--' }}</text></view>
					<view class="info-item"><text class="info-l">投入量</text><text class="info-v">{{ formData.inputQty || '--' }}</text></view>
				</view>
				<view class="info-row">
					<view class="info-item"><text class="info-l">产品名称</text><text class="info-v">{{ formData.itemName || '--' }}</text></view>
					<view class="info-item"><text class="info-l">产出量</text><text class="info-v">{{ formData.outputQty || '--' }}</text></view>
				</view>
				<view class="info-row">
					<view class="info-item"><text class="info-l">产品规格</text><text class="info-v">{{ formData.itemSpec || '--' }}</text></view>
					<view class="info-item"><text class="info-l">产品版本</text><text class="info-v">{{ formData.modelVer || '--' }}</text></view>
				</view>
			</view>
		</view>

		<!-- ════ 工序 ════ -->
		<view class="card" v-if="formData.moNumber">
			<view class="sel" @click="handleShowProcessSelector">
				<text class="sel-text" :class="{ ph: !formData.groupName }">{{ formData.groupName || '选择工序' }}</text>
				<uni-icons type="arrowdown" size="16" color="var(--t-sub)"></uni-icons>
			</view>
			<view class="tip-box" :class="tipType" v-if="showTip"><text>{{ tipMessage }}</text></view>
		</view>

		<!-- ════ 报工区域 ════ -->
		<view class="card" v-if="formData.groupName">
			<view class="f-row">
				<text class="f-l required">工作中心</text>
				<view class="sel sel-sm" @click="handleShowWorkCenterSelector">
					<text class="sel-text" :class="{ ph: !formData.workStation, auto: isAutoSelectedWorkCenter }">{{ workCenterDisplayText }}</text>
					<uni-icons type="arrowdown" size="16" color="var(--t-sub)"></uni-icons>
				</view>
			</view>

			<view class="f-row">
				<text class="f-l required">良品数量</text>
				<input v-model="formData.okQty" type="number" placeholder="请输入良品数量" class="f-input" @input="handleNumberInput" />
			</view>

			<view class="f-row">
				<text class="f-l">不良数量</text>
				<input v-model="formData.ngQty" type="number" placeholder="请输入不良数量" class="f-input" @input="handleNumberInput" />
			</view>

			<view class="f-row">
				<text class="f-l">报工批次</text>
				<text class="f-batch">{{ formData.proSn || '--' }}</text>
			</view>

			<view class="f-row">
				<text class="f-l">人员</text>
				<view class="sel sel-sm" @click="handleShowPeopleSelector">
					<text class="sel-text" :class="{ ph: !formData.reportUserName }">{{ formData.reportUserName || '点击选择人员' }}</text>
					<uni-icons type="arrowdown" size="16" color="var(--t-sub)"></uni-icons>
				</view>
			</view>

			<view class="f-row">
				<text class="f-l">工时(min)</text>
				<input v-model="formData.workTimes" type="number" placeholder="请输入工时" class="f-input" />
			</view>
		</view>

		<!-- ════ 底部按钮 ════ -->
		<view class="bottom-bar" v-if="formData.groupName">
			<view class="bb-btns">
				<view class="bb-reset" @click="handleResetPage">初始化</view>
				<view class="bb-submit" :class="{ disabled: !canSubmit || isSubmitting }"
					:style="submitStyle" @click="handleSubmitReport">
					<text v-if="!isSubmitting">报工保存</text>
					<text v-else>报工中…</text>
				</view>
			</view>
		</view>

		<!-- 选择器组件 -->
		<mo-selector ref="moSelector" v-model="formData.moId" @select="handleSelectMo" @error="showTipMessage" @warning="showTipMessage" />
		<process-selector ref="processSelector" v-model="formData.groupId" :mo-id="formData.moId" @select="handleSelectProcess" @error="showTipMessage" @warning="showTipMessage" />
		<work-center-selector ref="workCenterSelector" v-model="formData.workStationId" :mo-id="formData.moId" :group-id="formData.groupId" :auto-select="true" @select="handleSelectWorkCenter" @auto-select="handleAutoSelectWorkCenter" @error="showTipMessage" @warning="handleWorkCenterWarning" />
		<people-selector ref="peopleSelector" v-model="formData.reportUser" @change="handlePeopleChange" @error="showTipMessage" @info="showTipMessage" />

		<view class="init-tip" v-if="!formData.moId"><text>请先选择工单</text></view>
	</view>
</template>

<script>
	import MoSelector from '@/components/mes/batchReport/MoSelector.vue';
	import ProcessSelector from '@/components/mes/batchReport/ProcessSelector.vue';
	import WorkCenterSelector from '@/components/mes/batchReport/WorkCenterSelector.vue';
	import PeopleSelector from '@/components/mes/batchReport/PeopleSelector.vue';
	import { saveBatchReport } from "@/api/mesApi.js";
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		mixins: [settingsMixin],
		components: { MoSelector, ProcessSelector, WorkCenterSelector, PeopleSelector },

		computed: {
			workCenterDisplayText() {
				if (this.formData.workStation) return this.formData.workStation;
				if (this.workCenterList.length === 0) return '当前工序无工作中心';
				if (this.workCenterList.length === 1) return '唯一工作中心: ' + ((this.workCenterList[0] && this.workCenterList[0].areaName) || '');
				return '点击选择工作中心';
			},
			submitStyle() { return this.isSubmitting ? {} : { background: this.themePrimary }; }
		},

		data() {
			return {
				formData: {
					moId: "", moNumber: "", cbItemCode: "", itemName: "", itemSpec: "",
					modelVer: "", inputQty: "", outputQty: "", groupId: "", groupName: "",
					coGroupType_dictText: "", techGroupId: "", workStationId: "", workStation: "",
					okQty: "", ngQty: "", proSn: "", reportUser: "", reportUserName: "", workTimes: ""
				},
				workCenterList: [], isAutoSelectedWorkCenter: false,
				canSubmit: false, isSubmitting: false,
				showTip: false, tipMessage: "", tipType: "info", tipTimeout: null
			}
		},

		watch: {
			'formData.okQty'(newVal) { this.checkSubmit(); },
			'formData.workStationId'(newVal) { this.checkSubmit(); }
		},

		mounted() { this.generateBatchNumber(); },
		onUnload() { if (this.backPressListener) this.backPressListener.remove(); },

		methods: {
			generateBatchNumber() {
				const n = new Date(), p = x => String(x).padStart(2, '0');
				this.formData.proSn = `${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
			},
			checkSubmit() { this.canSubmit = !!this.formData.okQty && !!this.formData.workStationId; },
			handleNumberInput(e) {
				if (e.detail.value && parseFloat(e.detail.value) < 0) { this.formData.okQty = ''; this.formData.ngQty = ''; this.showTipMessage('请输入非负数', 'error'); }
				this.checkSubmit();
			},
			showTipMessage(message, type = "info") { this.tipMessage = message; this.tipType = type; this.showTip = true; },
			handleShowMoSelector() { this.$refs.moSelector.open(); },
			handleShowProcessSelector() {
				if (!this.formData.moId) { this.showTipMessage("请先选择工单", "error"); return; }
				this.$refs.processSelector.open();
			},
			handleShowWorkCenterSelector() {
				if (!this.formData.groupId) { this.showTipMessage("请先选择工序", "error"); return; }
				this.$refs.workCenterSelector.open();
			},
			handleShowPeopleSelector() { this.$refs.peopleSelector.open(); },
			handleSelectMo(item) {
				this.formData.moNumber = item.moNumber; this.formData.cbItemCode = item.cbItemCode;
				this.formData.itemName = item.itemName; this.formData.itemSpec = item.itemSpec;
				this.formData.modelVer = item.modelVer; this.formData.inputQty = item.inputQty || "";
				this.formData.outputQty = item.outputQty || "";
				this.formData.groupId = ""; this.formData.groupName = ""; this.formData.techGroupId = "";
				this.formData.workStationId = ""; this.formData.workStation = ""; this.formData.okQty = "";
				this.formData.ngQty = ""; this.formData.reportUser = ""; this.formData.reportUserName = "";
				this.workCenterList = []; this.isAutoSelectedWorkCenter = false;
				this.showTipMessage(`已选择工单: ${item.moNumber}`, "success");
			},
			handleSelectProcess(item) {
				this.formData.groupName = item.groupName; this.formData.techGroupId = item.techGroupId;
				this.formData.okQty = ""; this.formData.ngQty = ""; this.formData.workStationId = "";
				this.formData.workStation = ""; this.workCenterList = []; this.isAutoSelectedWorkCenter = false;
				this.showTipMessage(`已选择工序: ${item.groupName}`, "success"); this.checkSubmit();
			},
			handleSelectWorkCenter(item) { this.formData.workStation = item.areaName; this.isAutoSelectedWorkCenter = false; this.workCenterList = [item]; this.showTipMessage(`已选择: ${item.areaName}`, "success"); this.checkSubmit(); },
			handleAutoSelectWorkCenter(item) { this.formData.workStation = item.areaName; this.formData.workStationId = item.id; this.isAutoSelectedWorkCenter = true; this.workCenterList = [item]; this.showTipMessage(`已自动选择: ${item.areaName}`, "success"); this.checkSubmit(); },
			handleWorkCenterWarning(message) { this.showTipMessage(message, "warning"); this.workCenterList = []; this.isAutoSelectedWorkCenter = false; },
			handlePeopleChange(peopleList) { this.formData.reportUserName = peopleList.map(p => p.realname || p.nickname || p.username).join(","); },
			async handleSubmitReport() {
				if (this.isSubmitting) return;

				// --- 统一验证，收集所有错误信息 ---
				const errors = [];
				if (!this.formData.workStationId) errors.push("请选择工作中心");
				if (!this.formData.okQty || parseFloat(this.formData.okQty) <= 0) errors.push("良品数量必须大于0");
				// 可根据业务需要添加更多验证，如人员、工时等
				// if (!this.formData.reportUser) errors.push("请选择人员");
				// if (!this.formData.workTimes || parseFloat(this.formData.workTimes) <= 0) errors.push("工时不能为空");

				if (errors.length > 0) {
					this.showTipMessage(errors.join("；"), "error");
					return;
				}

				this.isSubmitting = true;
				this.showTipMessage("正在提交...", "info");
				try {
					const sd = { ...this.formData, okQty: parseFloat(this.formData.okQty) || 0, ngQty: parseFloat(this.formData.ngQty) || 0, workTimes: parseFloat(this.formData.workTimes) || 0 };
					const res = await saveBatchReport(sd);
					if (res?.data?.code === 200) {
						this.showTipMessage(res.data.message || "报工保存成功", "success");
						if (res.data.result?.outputQty !== undefined) this.formData.outputQty = res.data.result.outputQty;
						if (res.data.result?.inputQty !== undefined) this.formData.inputQty = res.data.result.inputQty;
						if (this.$refs.processSelector) this.$refs.processSelector.loadProcessList();
						this.resetFormAfterSubmit();
					} else {
						this.showTipMessage(res?.data?.message || "报工失败", "error");
					}
				} catch (e) {
					this.showTipMessage(e?.data?.message || e?.message || "网络错误", "error");
				} finally {
					this.isSubmitting = false;
				}
			},
			resetFormAfterSubmit() {
				const { moId, moNumber, cbItemCode, itemName, itemSpec, modelVer, inputQty, outputQty } = this.formData;
				const n = new Date(), p = x => String(x).padStart(2, '0');
				this.formData = { moId, moNumber, cbItemCode, itemName, itemSpec, modelVer, inputQty, outputQty, groupId: "", groupName: "", techGroupId: "", workStationId: "", workStation: "", okQty: "", ngQty: "", proSn: `${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`, reportUser: "", reportUserName: "", workTimes: "" };
				this.workCenterList = []; this.isAutoSelectedWorkCenter = false; this.canSubmit = false;
			},
			handleResetPage() { uni.showModal({ title: '确认初始化', content: '确定要重置页面吗？', success: (res) => { if (res.confirm) this.resetPageState(); } }); },
			resetPageState() {
				const n = new Date(), p = x => String(x).padStart(2, '0');
				this.formData = { moId: "", moNumber: "", cbItemCode: "", itemName: "", itemSpec: "", modelVer: "", inputQty: "", outputQty: "", groupId: "", groupName: "", techGroupId: "", workStationId: "", workStation: "", okQty: "", ngQty: "", proSn: `${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`, reportUser: "", reportUserName: "", workTimes: "" };
				this.workCenterList = []; this.isAutoSelectedWorkCenter = false; this.canSubmit = false; this.showTipMessage("页面已初始化", "info");
			}
		}
	}
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$bg: #f0f2f5; $card: #fff; $text: #1a1a2e; $sub: #6b7280; $hint: #9ca3af; $line: #e5e7eb;

.page { --t-sub: #999; @include p-page; background: $bg; padding: 20rpx 24rpx 140rpx; }
.card { @include p-card; padding: 28rpx 24rpx; margin-bottom: 16rpx; }

.sel, .sel-sm { display: flex; align-items: center; padding: 24rpx; background: #f7f8fa; border-radius: 10rpx; border: 1rpx solid $line; transition: all .2s; &:active { background: #eef1f6; } }
.sel-text { flex: 1; font-size: 28rpx; color: $text; font-weight: 500; margin-right: 12rpx; &.ph { color: $hint; font-weight: 400; } &.auto { color: #1677ff; } }
.sel-sm { padding: 20rpx; }

.info-grid { margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid $line; transition: border .25s; }
.info-row { display: flex; gap: 12rpx; margin-bottom: 10rpx; }
.info-item { flex: 1; display: flex; justify-content: space-between; align-items: center; padding: 14rpx 18rpx; background: #f7f8fa; border-radius: 10rpx; }
.info-l { font-size: 24rpx; color: $sub; flex-shrink: 0; }
.info-v { font-size: 24rpx; color: $text; font-weight: 500; text-align: right; }

.tip-box { margin-top: 16rpx; padding: 20rpx; border-radius: 8rpx; font-size: 24rpx; text-align: center; font-weight: 500; background: rgba(22,119,255,.08); color: #1677ff; &.success { background: rgba(82,196,26,.1); color: #52c41a; } &.error { background: rgba(255,77,79,.1); color: #ff4d4f; } &.warning { background: rgba(250,173,20,.1); color: #fa8c16; } }

.f-row { display: flex; align-items: center; margin-bottom: 20rpx; }
.f-l { width: 160rpx; font-size: 26rpx; color: $text; font-weight: 500; text-align: right; padding-right: 16rpx; flex-shrink: 0; &.required::after { content: "*"; color: #ff4d4f; margin-left: 4rpx; } }
.f-input { flex: 1; padding: 20rpx; background: #f7f8fa; border-radius: 8rpx; font-size: 26rpx; border: 1rpx solid $line; &:focus { border-color: #1677ff; background: $card; } }
.f-batch { flex: 1; font-size: 26rpx; color: #1677ff; font-weight: 500; font-family: 'Courier New', monospace; }

.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; background: $card; padding: 20rpx 24rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); box-shadow: 0 -2rpx 12rpx rgba(0,0,0,.05); transition: background .25s; }
.bb-btns { display: flex; gap: 20rpx; }
.bb-reset, .bb-submit { flex: 1; border-radius: 10rpx; font-size: 30rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; font-weight: 600; transition: all .2s; }
.bb-reset { background: #f4f5f7; color: $sub; &:active { background: $line; } }
.bb-submit { background: #1677ff; color: #fff; &:active:not(.disabled) { opacity: .85; } &.disabled { background: #d0d0d0; } }
.init-tip { display: flex; align-items: center; justify-content: center; height: 50vh; color: $hint; font-size: 28rpx; }

/* ═════════════════ 尺寸 / 深色 ═════════════════ */
.size-small {
	&.page { padding: 14rpx 16rpx 120rpx; }
	.card { padding: 20rpx 16rpx; }
	.sel { padding: 18rpx; }
	.sel-text { font-size: 24rpx; }
	.info-item { padding: 10rpx 14rpx; }
	.info-l, .info-v { font-size: 20rpx; }
	.f-l { width: 130rpx; font-size: 22rpx; }
	.f-input { padding: 16rpx; font-size: 22rpx; }
	.bb-reset, .bb-submit { height: 72rpx; font-size: 26rpx; }
}

.size-large {
	&.page { padding: 28rpx 32rpx 160rpx; }
	.card { padding: 36rpx 32rpx; }
	.sel { padding: 32rpx; }
	.sel-text { font-size: 32rpx; }
	.f-l { width: 190rpx; font-size: 30rpx; }
	.f-input { padding: 26rpx; font-size: 30rpx; }
	.bb-reset, .bb-submit { height: 104rpx; font-size: 34rpx; }
}

.theme-dark {
	&.page { background: #0f0f1a; }
	.card { background: #1a1a2e; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.sel, .sel-sm { background: #1e1e36; border-color: #2a2a45; }
	.sel-text { color: #e0e0e0; }
	.info-grid { border-top-color: #2a2a45; }
	.info-item { background: #1e1e36; }
	.info-v { color: #e0e0e0; }
	.f-l { color: #e0e0e0; }
	.f-input { background: #1e1e36; border-color: #2a2a45; color: #e0e0e0; &:focus { background: #1e1e36; } }
	.tip-box { background: rgba(22,119,255,.06); }
	.bottom-bar { background: #1a1a2e; }
	.bb-reset { background: #1e1e36; color: #888; }
	.init-tip { color: #666; }
}
</style>