<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- 顶部固定区域 -->
		<view class="top-bar">
			<!-- 搜索区域 -->
			<view class="searchSection">
				<view class="searchBox">
					<view class="searchInputWrapper">
						<uni-icons class="searchIcon" type="search" :size="iconSize" color="#999"></uni-icons>
						<input class="searchInput" v-model="inputValue" placeholder="请输入SN/单号或扫码查询"
							placeholderStyle="color: #999;" @confirm="handleSearch" :disabled="loading" />
						<view class="inputRight" v-if="inputValue">
							<uni-icons class="clearIcon" type="clear" :size="iconSize-2" color="#999"
								@click="clearInput"></uni-icons>
						</view>
					</view>
					<view class="scanBtn" @tap="handleScan">
						<uni-icons type="scan" :size="iconSize+6" :color="themePrimary"></uni-icons>
					</view>
				</view>

				<!-- 扫描历史 -->
				<view class="scanHistory" v-if="scanHistory.length > 0">
					<view class="historyTitle">
						<text class="titleText">扫描历史</text>
						<text class="clearHistory" @tap="clearHistory">清空</text>
					</view>
					<scroll-view class="historyScroll" scrollX="true">
						<view class="historyList">
							<view class="historyItem" v-for="(item, index) in scanHistory" :key="index"
								@tap="selectHistory(item)">
								<text class="historyText">{{ formatHistoryText(item) }}</text>
							</view>
						</view>
					</scroll-view>
				</view>
			</view>

			<!-- 类型标签页 -->
			<view class="typeNav" v-if="availableTypes.length > 0">
				<scroll-view class="typeScroll" scrollX="true">
					<view class="typeList">
						<view class="typeItem" v-for="(item, idx) in availableTypes" :key="item.value"
							:class="activeType === item.value ? 'type-item-active' : ''" @tap="switchType(item.value)">
							<text class="typeName">{{ item.label }}</text>
							<view class="typeBadge" v-if="getDataList(item.value).length > 1">
								{{ getDataList(item.value).length }}
							</view>
						</view>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 内容区域 -->
		<scroll-view class="content" scrollY="true" :show-scrollbar="false">
			<!-- 待用SN列表 -->
			<view class="contentSection" v-if="activeType === '0' && dataList0.length > 0">
				<view v-for="(item, idx) in dataList0" :key="idx" class="dataCard">
					<view class="cardHeader">
						<text class="cardTitle">待用SN</text>
						<text class="cardStatus"
							:class="getStatusClass(item.status)">{{ item.status_dictText || '--' }}</text>
					</view>
					<view class="snOperations" v-if="item.itemSn">
						<view class="operationBtns">
							<view class="operationBtn btnBlue" @click.stop="handlePullInDoc(item)">
								<text class="btnText">入库</text>
							</view>
						</view>
					</view>
					<view class="infoList">
						<view class="infoRow">
							<text class="infoLabel">物料SN</text>
							<text class="infoValue longText">{{ item.itemSn || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">关联单号</text>
							<view class="infoValueWrapper">
								<text class="infoValue longText">{{ item.docNo || '无' }}</text>
							</view>
						</view>
						<view class="infoRow">
							<text class="infoLabel">条码类型</text>
							<text class="infoValue">{{ item.snType_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">物料编码</text>
							<text class="infoValue longText">{{ item.itemCode || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">物料名称</text>
							<text class="infoValue longText">{{ item.itemName || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">规格型号</text>
							<text class="infoValue longText">{{ item.itemSpec || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">仓库</text>
							<text class="infoValue longText">{{ item.areaName || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">单据类型</text>
							<text class="infoValue">{{ item.docType_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">单位</text>
							<text class="infoValue">{{ item.unitName || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">供应商</text>
							<text class="infoValue">{{ item.supplierId_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">创建时间</text>
							<text class="infoValue">{{ formatDateTime(item.createTime) }}</text>
						</view>
					</view>
					<view class="sectionFooter">
						<text class="footerText">创建人: {{ item.createBy || '--' }}</text>
					</view>
				</view>
			</view>

			<!-- 库存SN列表 -->
			<view class="contentSection" v-if="activeType === '1' && dataList1.length > 0">
				<view v-for="(item, idx) in dataList1" :key="idx" class="dataCard">
					<view class="cardHeader">
						<text class="cardTitle">库存SN</text>
						<text class="cardStatus"
							:class="getStatusClass(item.status)">{{ item.status_dictText || '--' }}</text>
					</view>
					<view class="snOperations" v-if="item.itemSn">
						<view class="operationBtns">
							<view class="operationBtn btnPurple" @click.stop="goToLocationBinding(item)">
								<text class="btnText">库位关联</text>
							</view>
							<view class="operationBtn btnOrange" @click.stop="goToBarcodeSplit(item)">
								<text class="btnText">条码拆分</text>
							</view>
							<view class="operationBtn btnBlue" @click.stop="handleOutstock(item)">
								<text class="btnText">出库</text>
							</view>
						</view>
					</view>
					<view class="infoList">
						<view class="infoRow">
							<text class="infoLabel">物料SN</text>
							<text class="infoValue longText">{{ item.itemSn || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">物料编码</text>
							<text class="infoValue longText">{{ item.itemCode || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">物料名称</text>
							<text class="infoValue longText">{{ item.itemName || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">规格型号</text>
							<text class="infoValue longText">{{ item.itemSpec || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">库存数量</text>
							<text class="infoValue accentText">{{ item.itemQty || 0 }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">单位</text>
							<text class="infoValue longText">{{ item.baseUnitName || '--' }}</text>
						</view>
						<view v-if="!(item.baseUnitName === item.storeUnitName)" class="infoRow">
							<text class="infoLabel">库存单位</text>
							<text class="infoValue longText">{{ item.storeUnitName || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">仓库</text>
							<text class="infoValue">{{ item.whId_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">库区</text>
							<text class="infoValue">{{ item.districtId_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">库位</text>
							<text class="infoValue">{{ item.storageId_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">入库时间</text>
							<text class="infoValue">{{ formatDate(item.instockTime) }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">生产批次</text>
							<text class="infoValue">{{ item.itemLot || '--' }}</text>
						</view>
					</view>
					<view class="sectionFooter">
						<text class="footerText">创建人: {{ item.createBy || '--' }}</text>
					</view>
				</view>
			</view>

			<!-- 入库单列表 -->
			<view class="contentSection" v-if="activeType === '2' && dataList2.length > 0">
				<view v-for="(item, idx) in dataList2" :key="idx" class="dataCard">
					<view class="cardHeader">
						<text class="cardTitle">入库单</text>
						<text class="cardStatus"
							:class="getDocStatusClass(item.docStatus)">{{ item.docStatus_dictText || '--' }}</text>
					</view>
					<view class="infoList">
						<view class="infoRow clickableRow" @tap="goToDocCommand(item, '2')">
							<text class="infoLabel">单据编号</text>
							<view class="infoValueWrapper">
								<text class="infoValue linkText longText">{{ item.docNo || '--' }}</text>
								<text class="linkIcon">→</text>
							</view>
						</view>
						<view class="infoRow">
							<text class="infoLabel">单据类型</text>
							<text class="infoValue">{{ item.docType_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">计划入库日期</text>
							<text class="infoValue">{{ formatDate(item.planReceiveDate) || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">实际入库日期</text>
							<text class="infoValue">{{ formatDate(item.receiveDate) || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">来源单据</text>
							<text class="infoValue">{{ item.sourceDoc || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">创建时间</text>
							<text class="infoValue">{{ formatDateTime(item.createTime) }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">客户</text>
							<text class="infoValue">{{ item.custId_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">供应商</text>
							<text class="infoValue">{{ item.supplierId_dictText || '--' }}</text>
						</view>
					</view>
					<view class="sectionFooter">
						<text class="footerText">创建人: {{ item.createBy || '--' }}</text>
					</view>
				</view>
			</view>

			<!-- 出库单列表 -->
			<view class="contentSection" v-if="activeType === '3' && dataList3.length > 0">
				<view v-for="(item, idx) in dataList3" :key="idx" class="dataCard">
					<view class="cardHeader">
						<text class="cardTitle">出库单</text>
						<text class="cardStatus"
							:class="getDocStatusClass(item.docStatus)">{{ item.docStatus_dictText || '--' }}</text>
					</view>
					<view class="infoList">
						<view class="infoRow clickableRow" @tap="goToDocCommand(item, '3')">
							<text class="infoLabel">单据编号</text>
							<view class="infoValueWrapper">
								<text class="infoValue linkText longText">{{ item.docNo || '--' }}</text>
								<text class="linkIcon">→</text>
							</view>
						</view>
						<view class="infoRow">
							<text class="infoLabel">单据类型</text>
							<text class="infoValue">{{ item.docType_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">计划出库日期</text>
							<text class="infoValue">{{ formatDate(item.planOutstockDate) || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">实际出库日期</text>
							<text class="infoValue">{{ formatDate(item.outstockDate) || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">来源单据</text>
							<text class="infoValue">{{ item.sourceDoc || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">创建时间</text>
							<text class="infoValue">{{ formatDateTime(item.createTime) }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">客户</text>
							<text class="infoValue">{{ item.custId_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">供应商</text>
							<text class="infoValue">{{ item.supplierId_dictText || '--' }}</text>
						</view>
					</view>
					<view class="sectionFooter">
						<text class="footerText">创建人: {{ item.createBy || '--' }}</text>
					</view>
				</view>
			</view>

			<!-- 调拨单列表 -->
			<view class="contentSection" v-if="activeType === '4' && dataList4.length > 0">
				<view v-for="(item, idx) in dataList4" :key="idx" class="dataCard">
					<view class="cardHeader">
						<text class="cardTitle">调拨单</text>
						<text class="cardStatus"
							:class="getDocStatusClass(item.docStatus)">{{ item.docStatus_dictText || '--' }}</text>
					</view>
					<view class="infoList">
						<view class="infoRow clickableRow" @tap="goToDocCommand(item, '4')">
							<text class="infoLabel">单据编号</text>
							<view class="infoValueWrapper">
								<text class="infoValue linkText longText">{{ item.docNo || '--' }}</text>
								<text class="linkIcon">→</text>
							</view>
						</view>
						<view class="infoRow">
							<text class="infoLabel">计划调拨日期</text>
							<text class="infoValue">{{ formatDate(item.planAllotDate) || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">调入组织</text>
							<text class="infoValue">{{ item.dataAuthIn_dictText || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">来源单据</text>
							<text class="infoValue">{{ item.sourceDoc || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">创建时间</text>
							<text class="infoValue">{{ formatDateTime(item.createTime) }}</text>
						</view>
					</view>
					<view class="sectionFooter">
						<text class="footerText">创建人: {{ item.createBy || '--' }}</text>
					</view>
				</view>
			</view>

			<!-- 盘点单列表 -->
			<view class="contentSection" v-if="activeType === '5' && dataList5.length > 0">
				<view v-for="(item, idx) in dataList5" :key="idx" class="dataCard">
					<view class="cardHeader">
						<text class="cardTitle">盘点单</text>
						<text class="cardStatus"
							:class="getInvStatusClass(item.invDocStatus)">{{ item.invDocStatus_dictText || '--' }}</text>
					</view>
					<view class="infoList">
						<view class="infoRow clickableRow" @tap="goToDocCommand(item, '5')">
							<text class="infoLabel">单据编号</text>
							<view class="infoValueWrapper">
								<text class="infoValue linkText longText">{{ item.docNo || '--' }}</text>
								<text class="linkIcon">→</text>
							</view>
						</view>
						<view class="infoRow">
							<text class="infoLabel">来源单据</text>
							<text class="infoValue">{{ item.sourceDoc || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">盘点日期</text>
							<text class="infoValue">{{ formatDate(item.invDate) || '--' }}</text>
						</view>
						<view class="infoRow">
							<text class="infoLabel">创建时间</text>
							<text class="infoValue">{{ formatDateTime(item.createTime) }}</text>
						</view>
					</view>
					<view class="sectionFooter">
						<text class="footerText">创建人: {{ item.createBy || '--' }}</text>
					</view>
				</view>
			</view>

			<!-- 空状态 -->
			<view class="emptyState" v-if="!loading && availableTypes.length === 0">
				<view class="emptyIcon">📦</view>
				<text class="emptyTitle">暂无数据</text>
				<text class="emptyDesc">请输入SN或单号进行查询</text>
			</view>

			<view class="safeArea"></view>
		</scroll-view>

		<!-- 底部操作按钮 -->
		<view class="bottom-bar" v-if="hasData">
			<view class="action-buttons">
				<view class="btn-reset" @tap="handleClearResult">
					<text class="btnText">清除结果</text>
				</view>
				<view class="btn-submit" :style="{ background: themePrimary }" @tap="handleRefresh"
					:class="{ disabled: loading }">
					<text class="btnText">{{ loading ? '查询中...' : '刷新数据' }}</text>
				</view>
			</view>
		</view>

		<!-- 加载状态 -->
		<view class="loadingMask" v-if="loading">
			<view class="loadingContent">
				<view class="loadingSpinner" :style="{ borderTopColor: themePrimary }"></view>
				<text class="loadingText">查询中...</text>
			</view>
		</view>

		<!-- 出库单选择弹窗 -->
		<view class="docModal" v-if="showOutDocModal" @tap="closeOutDocModal">
			<view class="modalContent" :class="[sizeClass, darkClass]" @tap.stop>
				<view class="modalHeader">
					<text class="modalTitle">选择出库单</text>
					<view class="closeBtn" @tap="closeOutDocModal">
						<uni-icons type="close" :size="iconSize" color="#999"></uni-icons>
					</view>
				</view>

				<view class="modalBody">
					<view class="currentSn">
						<text class="snLabel">当前物料SN:</text>
						<text class="snValue" :style="{ color: themePrimary }">{{ currentOutstockSn }}</text>
					</view>

					<scroll-view class="docList" scrollY="true" v-if="outDocList.length > 0">
						<view class="docItem" v-for="(doc, index) in outDocList" :key="doc.id"
							@tap="selectOutDoc(doc,currentOutstockSn)">
							<view class="docHeader">
								<text class="docNo">{{ doc.docNo }}</text>
								<text class="docStatus" :class="getDocStatusClass(doc.docStatus)">
									{{ doc.docStatus_dictText || '--' }}
								</text>
							</view>
							<view class="docInfo">
								<text class="docType">{{ doc.docType_dictText || '--' }}</text>
								<text class="docDate">计划: {{ formatDate(doc.planOutstockDate) || '--' }}</text>
							</view>
						</view>
					</scroll-view>

					<view class="emptyDoc" v-else>
						<text class="emptyText">暂无待出库单据</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 入库单选择弹窗（待用SN拉单用） -->
		<view class="docModal" v-if="showInDocModal" @tap="closeInDocModal">
			<view class="modalContent" :class="[sizeClass, darkClass]" @tap.stop>
				<view class="modalHeader">
					<text class="modalTitle">选择入库单据</text>
					<view class="closeBtn" @tap="closeInDocModal">
						<uni-icons type="close" :size="iconSize" color="#999"></uni-icons>
					</view>
				</view>

				<view class="modalBody">
					<view class="currentSn">
						<text class="snLabel">当前物料SN:</text>
						<text class="snValue" :style="{ color: themePrimary }">{{ currentInDocSn }}</text>
					</view>

					<scroll-view class="docList" scrollY="true" v-if="inDocList.length > 0">
						<view class="docItem" v-for="(doc, index) in inDocList" :key="doc.id"
							@tap="selectInDoc(doc,currentInDocSn)">
							<view class="docHeader">
								<text class="docNo">{{ doc.docNo }}</text>
								<text class="docStatus" :class="getDocStatusClass(doc.docStatus)">
									{{ doc.docStatus_dictText || '--' }}
								</text>
							</view>
							<view class="docInfo">
								<text class="docType">{{ doc.docType_dictText || '--' }}</text>
								<text class="docDate">计划: {{ formatDate(doc.planReceiveDate) || '--' }}</text>
							</view>
							<view class="docExtra" v-if="doc.supplierId_dictText || doc.custId_dictText">
								<text
									class="extraText">{{ doc.supplierId_dictText || doc.custId_dictText || '--' }}</text>
							</view>
						</view>
					</scroll-view>

					<view class="emptyDoc" v-else>
						<text class="emptyText">暂无待入库单据</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		queryDocAndStockInfo,
		getAllOutDocBySn,
		getAllReceiveDocBySn
	} from '@/api/wmsApi.js';
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		mixins: [settingsMixin],
		data() {
			return {
				inputValue: '',
				scanHistory: [],
				loading: false,
				activeType: '0',
				dataList0: [],
				dataList1: [],
				dataList2: [],
				dataList3: [],
				dataList4: [],
				dataList5: [],
				currentScanData: '',
				showOutDocModal: false,
				outDocList: [],
				currentOutstockSn: '',
				currentOutstockItem: null,
				showInDocModal: false,
				inDocList: [],
				currentInDocSn: '',
				currentInDocItem: null,
				iconSize: 22,
				scrollViewHeight: '0px'
			}
		},

		onLoad() {
			// 刷新主题设置
			this._refreshAll();
			this.loadScanHistory();
		},

		onShow() {
			// 刷新主题设置
			this._refreshAll();
			this.calculateScrollHeight();
		},

		watch: {
			'appSettings.displaySize': {
				handler(newVal) {
					this.updateIconSizes(newVal);
					this.$nextTick(() => {
						this.calculateScrollHeight();
					});
				},
				immediate: true
			}
		},

		computed: {
			availableTypes() {
				const types = [];
				if (this.dataList0.length > 0) types.push({ value: '0', label: '待用SN' });
				if (this.dataList1.length > 0) types.push({ value: '1', label: '库存SN' });
				if (this.dataList2.length > 0) types.push({ value: '2', label: '入库单' });
				if (this.dataList3.length > 0) types.push({ value: '3', label: '出库单' });
				if (this.dataList4.length > 0) types.push({ value: '4', label: '调拨单' });
				if (this.dataList5.length > 0) types.push({ value: '5', label: '盘点单' });
				return types;
			},

			hasData() {
				return this.availableTypes.length > 0;
			}
		},

		methods: {
			updateIconSizes(size) {
				const sizeMap = { small: 18, medium: 22, large: 26 };
				this.iconSize = sizeMap[size] || 22;
			},

			getDataList(type) {
				const map = {
					'0': this.dataList0,
					'1': this.dataList1,
					'2': this.dataList2,
					'3': this.dataList3,
					'4': this.dataList4,
					'5': this.dataList5
				};
				return map[type] || [];
			},

			formatDate(dateStr) {
				if (!dateStr) return '--';
				return dateStr.split(' ')[0];
			},

			formatDateTime(dateStr) {
				if (!dateStr) return '--';
				return dateStr;
			},

			formatHistoryText(text) {
				if (text.length > 15) return text.substring(0, 12) + '...';
				return text;
			},

			calculateScrollHeight() {
				const systemInfo = uni.getSystemInfoSync();
				const windowHeight = systemInfo.windowHeight;
				let otherHeight = 120;
				if (this.scanHistory.length > 0) otherHeight += 80;
				if (this.availableTypes.length > 0) otherHeight += 80;
				if (this.hasData) otherHeight += 100;
				const height = windowHeight - otherHeight;
				this.scrollViewHeight = height > 200 ? height + 'px' : '200px';
			},

			loadScanHistory() {
				try {
					const history = uni.getStorageSync('scanHistory') || [];
					this.scanHistory = history;
				} catch (e) {
					this.scanHistory = [];
				}
			},

			saveToHistory(scanData) {
				if (!scanData) return;
				const index = this.scanHistory.indexOf(scanData);
				if (index !== -1) this.scanHistory.splice(index, 1);
				this.scanHistory.unshift(scanData);
				if (this.scanHistory.length > 10) this.scanHistory = this.scanHistory.slice(0, 10);
				try {
					uni.setStorageSync('scanHistory', this.scanHistory);
				} catch (e) {}
			},

			clearHistory() {
				uni.showModal({
					title: '提示',
					content: '确定要清空所有历史记录吗？',
					success: (res) => {
						if (res.confirm) {
							this.scanHistory = [];
							uni.removeStorageSync('scanHistory');
							this.calculateScrollHeight();
						}
					}
				});
			},

			selectHistory(scanData) {
				this.inputValue = scanData;
				this.handleSearch();
			},

			clearInput() {
				this.inputValue = '';
			},

			handleScan() {
				uni.scanCode({
					success: (res) => {
						if (res.result) {
							this.inputValue = res.result;
							this.handleSearch();
						}
					},
					fail: () => {
						uni.showToast({
							title: '扫码失败',
							icon: 'none'
						});
					}
				});
			},

			async handleSearch() {
				const scanData = this.inputValue.trim();
				if (!scanData) {
					uni.showToast({
						title: '请输入查询内容',
						icon: 'none'
					});
					return;
				}

				this.saveToHistory(scanData);
				this.currentScanData = scanData;
				this.loading = true;

				try {
					const response = await queryDocAndStockInfo(scanData);
					if (response.data && response.data.success) {
						const result = response.data.result || {};
						this.dataList0 = result['0'] ? (Array.isArray(result['0']) ? result['0'] : [result['0']]) : [];
						this.dataList1 = result['1'] ? (Array.isArray(result['1']) ? result['1'] : [result['1']]) : [];
						this.dataList2 = result['2'] ? (Array.isArray(result['2']) ? result['2'] : [result['2']]) : [];
						this.dataList3 = result['3'] ? (Array.isArray(result['3']) ? result['3'] : [result['3']]) : [];
						this.dataList4 = result['4'] ? (Array.isArray(result['4']) ? result['4'] : [result['4']]) : [];
						this.dataList5 = result['5'] ? (Array.isArray(result['5']) ? result['5'] : [result['5']]) : [];

						if (this.availableTypes.length > 0) {
							this.activeType = this.availableTypes[0].value;
						}
					} else {
						this.clearData();
						uni.showToast({
							title: response.data.message || '未找到相关信息',
							icon: 'none'
						});
					}
				} catch (error) {
					console.error('查询失败:', error);
					this.clearData();
					uni.showToast({
						title: '查询失败，请稍后重试',
						icon: 'none'
					});
				} finally {
					this.loading = false;
					this.calculateScrollHeight();
				}
			},

			clearData() {
				this.dataList0 = [];
				this.dataList1 = [];
				this.dataList2 = [];
				this.dataList3 = [];
				this.dataList4 = [];
				this.dataList5 = [];
			},

			handleClearResult() {
				this.clearData();
				this.inputValue = '';
				this.currentScanData = '';
				this.activeType = '0';
				this.calculateScrollHeight();
			},

			handleRefresh() {
				if (this.currentScanData) {
					this.inputValue = this.currentScanData;
					this.handleSearch();
				}
			},

			switchType(type) {
				this.activeType = type;
			},

			getStatusClass(status) {
				if (status === '0') return 'statusIdle';
				if (status === '1') return 'statusShelf';
				return '';
			},

			getDocStatusClass(status) {
				if (status === '1') return 'statusOpen';
				if (status === '2') return 'statusProgress';
				if (status === '3') return 'statusDone';
				return '';
			},

			getInvStatusClass(status) {
				if (status === '1') return 'statusOpen';
				if (status === '2') return 'statusProgress';
				if (status === '3') return 'statusDone';
				return '';
			},

			goToDocCommand(docData, type, sn) {
				if (!docData) return;
				const typeName = this.getTypeLabel(type);
				docData = { ...docData, snType: type };
				const docDataStr = encodeURIComponent(JSON.stringify(docData));
				if (!sn) {
					uni.navigateTo({
						url: `/pages/wms/docOpt/docCommand?docData=${docDataStr}&typeName=${encodeURIComponent(typeName)}`,
						fail: () => {
							uni.showToast({ title: '跳转失败', icon: 'none' });
						}
					});
				} else {
					uni.navigateTo({
						url: `/pages/wms/docOpt/docCommand?sn=${sn}&docData=${docDataStr}&typeName=${encodeURIComponent(typeName)}`,
						fail: () => {
							uni.showToast({ title: '跳转失败', icon: 'none' });
						}
					});
				}
			},

			getTypeLabel(type) {
				const map = { '2': '入库单', '3': '出库单', '4': '调拨单', '5': '盘点单' };
				return map[type] || '单据';
			},

			async handlePullInDoc(item) {
				if (!item || !item.itemSn) {
					uni.showToast({ title: '物料SN不能为空', icon: 'none' });
					return;
				}

				this.currentInDocSn = item.itemSn;
				this.currentInDocItem = item;

				uni.showLoading({ title: '加载中...' });

				try {
					const response = await getAllReceiveDocBySn(item.itemSn);
					if (response.data && response.data.success) {
						const result = response.data.result || {};
						let inDocs = result['2'] || result.inDocList || result.list || result.records || [];
						if (!Array.isArray(inDocs)) inDocs = [];

						if (inDocs.length === 0) {
							uni.showToast({ title: '暂无可用入库单据', icon: 'none' });
							this.closeInDocModal();
							return;
						}

						if (inDocs.length === 1) {
							const singleDoc = inDocs[0];
							singleDoc.snType = "2";
							const docDataStr = encodeURIComponent(JSON.stringify(singleDoc));
							uni.navigateTo({
								url: `/pages/wms/docOpt/docCommand?sn=${encodeURIComponent(item.itemSn)}&docData=${docDataStr}&typeName=${encodeURIComponent('入库单')}`,
								fail: () => { uni.showToast({ title: '跳转失败', icon: 'none' }); }
							});
							this.closeInDocModal();
						} else {
							this.inDocList = inDocs;
							this.showInDocModal = true;
						}
					} else {
						uni.showToast({ title: response.data.message || '获取入库单失败', icon: 'none' });
					}
				} catch (error) {
					console.error('获取入库单失败:', error);
					uni.showToast({ title: '获取入库单失败', icon: 'none' });
				} finally {
					uni.hideLoading();
				}
			},

			closeInDocModal() {
				this.showInDocModal = false;
				this.inDocList = [];
				this.currentInDocSn = '';
				this.currentInDocItem = null;
			},

			selectInDoc(docData, sn) {
				if (!docData) return;
				this.closeInDocModal();
				docData = { ...docData, snType: "2" };
				const docDataStr = encodeURIComponent(JSON.stringify(docData));
				uni.navigateTo({
					url: `/pages/wms/docOpt/docCommand?sn=${sn}&docData=${docDataStr}&typeName=${encodeURIComponent('入库单')}`,
					fail: () => { uni.showToast({ title: '跳转失败', icon: 'none' }); }
				});
			},

			goToLocationBinding(materialData) {
				if (!materialData || !materialData.itemSn) {
					uni.showToast({ title: '物料SN不能为空', icon: 'none' });
					return;
				}
				const params = {
					sn: materialData.itemSn,
					materialCode: materialData.itemCode || '',
					materialName: materialData.itemName || '',
					materialSpec: materialData.itemSpec || '',
					lotNo: materialData.itemLot || '',
					quantity: materialData.itemQty || 0,
					warehouse: materialData.whId_dictText || '',
					status: materialData.status_dictText || ''
				};
				const paramsStr = encodeURIComponent(JSON.stringify(params));
				uni.navigateTo({
					url: `/pages/wms/commandOpt/commandOpt?commandCode=WMSKN004&sn=${encodeURIComponent(materialData.itemSn)}&materialData=${paramsStr}`,
					fail: () => { uni.showToast({ title: '跳转失败', icon: 'none' }); }
				});
			},

			goToBarcodeSplit(materialData) {
				if (!materialData || !materialData.itemSn) {
					uni.showToast({ title: '物料SN不能为空', icon: 'none' });
					return;
				}
				const params = {
					sn: materialData.itemSn,
					materialCode: materialData.itemCode || '',
					materialName: materialData.itemName || '',
					materialSpec: materialData.itemSpec || '',
					lotNo: materialData.itemLot || '',
					quantity: materialData.itemQty || 0,
					warehouse: materialData.whId_dictText || '',
					status: materialData.status_dictText || ''
				};
				const paramsStr = encodeURIComponent(JSON.stringify(params));
				uni.navigateTo({
					url: `/pages/wms/commandOpt/commandOpt?commandCode=TMCF001&sn=${encodeURIComponent(materialData.itemSn)}&materialData=${paramsStr}`,
					fail: () => { uni.showToast({ title: '跳转失败', icon: 'none' }); }
				});
			},

			async handleOutstock(materialData) {
				if (!materialData || !materialData.itemSn) {
					uni.showToast({ title: '物料SN不能为空', icon: 'none' });
					return;
				}

				this.currentOutstockSn = materialData.itemSn;
				this.currentOutstockItem = materialData;

				uni.showLoading({ title: '加载中...' });

				try {
					const response = await getAllOutDocBySn(materialData.itemSn);
					if (response.data && response.data.success) {
						const result = response.data.result || {};
						let outDocs = result['3'] || result.outDocList || result.list || result.records || [];
						if (!Array.isArray(outDocs)) outDocs = [];

						if (outDocs.length === 0) {
							uni.showToast({ title: '暂无可用出库单据', icon: 'none' });
							this.closeOutDocModal();
							return;
						}

						if (outDocs.length === 1) {
							const singleDoc = outDocs[0];
							singleDoc.snType = "3";
							const docDataStr = encodeURIComponent(JSON.stringify(singleDoc));
							uni.navigateTo({
								url: `/pages/wms/docOpt/docCommand?sn=${encodeURIComponent(materialData.itemSn)}&docData=${docDataStr}&typeName=${encodeURIComponent('出库单')}`,
								fail: () => { uni.showToast({ title: '跳转失败', icon: 'none' }); }
							});
							this.closeOutDocModal();
						} else {
							this.outDocList = outDocs;
							this.showOutDocModal = true;
						}
					} else {
						uni.showToast({ title: response.data.message || '获取出库单失败', icon: 'none' });
					}
				} catch (error) {
					console.error('获取出库单失败:', error);
					uni.showToast({ title: '获取出库单失败', icon: 'none' });
				} finally {
					uni.hideLoading();
				}
			},

			closeOutDocModal() {
				this.showOutDocModal = false;
				this.outDocList = [];
				this.currentOutstockSn = '';
				this.currentOutstockItem = null;
			},

			selectOutDoc(docData, sn) {
				if (!docData) return;
				this.closeOutDocModal();
				docData = { ...docData, snType: "3" };
				const docDataStr = encodeURIComponent(JSON.stringify(docData));
				uni.navigateTo({
					url: `/pages/wms/docOpt/docCommand?sn=${sn}&docData=${docDataStr}&typeName=${encodeURIComponent('出库单')}`,
					fail: () => { uni.showToast({ title: '跳转失败', icon: 'none' }); }
				});
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
		padding-bottom: 0;
		box-shadow: 0 1rpx 8rpx rgba(0, 0, 0, .03);
		transition: background .25s;
	}

	.searchSection {
		padding: 24rpx 32rpx;
		transition: all 0.25s;
	}

	.searchBox {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.searchInputWrapper {
		flex: 1;
		display: flex;
		align-items: center;
		background: #f4f5f7;
		border-radius: 12rpx;
		padding: 0 24rpx;
		border: 1rpx solid #e5e7eb;
		transition: all 0.25s;
	}

	.searchInput {
		flex: 1;
		height: 80rpx;
		font-size: 28rpx;
		color: #333;
		transition: all 0.25s;
	}

	.inputRight {
		display: flex;
		align-items: center;
	}

	.scanBtn {
		width: 80rpx;
		height: 80rpx;
		background: rgba(22, 119, 255, 0.1);
		border-radius: 12rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.25s;
	}

	.scanHistory {
		margin-top: 24rpx;
	}

	.historyTitle {
		display: flex;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.titleText {
		font-size: 24rpx;
		color: #666;
		transition: all 0.25s;
	}

	.clearHistory {
		font-size: 24rpx;
		color: #1677ff;
		transition: all 0.25s;
	}

	.historyScroll {
		white-space: nowrap;
	}

	.historyList {
		display: inline-flex;
		gap: 16rpx;
	}

	.historyItem {
		padding: 12rpx 24rpx;
		background: #f4f5f7;
		border-radius: 12rpx;
		border: 1rpx solid #e5e7eb;
		transition: all 0.25s;
	}

	.historyText {
		font-size: 26rpx;
		color: #666;
		transition: all 0.25s;
	}

	.typeNav {
		background: #fff;
		padding: 0 32rpx;
		border-top: 1rpx solid #f0f0f0;
		transition: all 0.25s;
	}

	.typeScroll {
		white-space: nowrap;
	}

	.typeList {
		display: inline-flex;
		padding: 24rpx 0;
		gap: 32rpx;
	}

	.typeItem {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 16rpx 0;
		position: relative;
		font-size: 28rpx;
		color: #666;
		transition: all 0.25s;
	}

	.typeItem.type-item-active {
		color: #1677ff;
		font-weight: 600;
	}

	.typeItem.type-item-active::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 4rpx;
		background: #1677ff;
	}

	.typeBadge {
		background: #e5e7eb;
		color: #666;
		font-size: 20rpx;
		padding: 4rpx 12rpx;
		border-radius: 20rpx;
		transition: all 0.25s;
	}

	.typeItem.type-item-active .typeBadge {
		background: rgba(22, 119, 255, 0.15);
		color: #1677ff;
	}

	/* 内容区域 */
	.content {
		flex: 1;
		overflow: hidden;
		padding: 0;
	}

	.contentSection {
		padding: 24rpx 32rpx;
	}

	.dataCard {
		background: #fff;
		border-radius: 20rpx;
		margin-bottom: 24rpx;
		overflow: hidden;
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, .03);
		transition: all 0.25s;
	}

	.cardHeader {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24rpx 32rpx;
		background: #fafcff;
		border-bottom: 1rpx solid #f0f2f5;
		transition: all 0.25s;
	}

	.cardTitle {
		font-size: 30rpx;
		font-weight: 600;
		color: #333;
		transition: all 0.25s;
	}

	.cardStatus {
		font-size: 24rpx;
		padding: 8rpx 20rpx;
		border-radius: 30rpx;
		background: #f4f5f7;
		color: #666;
		transition: all 0.25s;
	}

	.cardStatus.statusIdle {
		background: rgba(22, 119, 255, 0.1);
		color: #1677ff;
	}

	.cardStatus.statusShelf {
		background: rgba(250, 140, 22, 0.1);
		color: #fa8c16;
	}

	.cardStatus.statusOpen {
		background: rgba(250, 140, 22, 0.1);
		color: #fa8c16;
	}

	.cardStatus.statusProgress {
		background: rgba(22, 119, 255, 0.1);
		color: #1677ff;
	}

	.cardStatus.statusDone {
		background: rgba(82, 196, 26, 0.1);
		color: #52c41a;
	}

	.snOperations {
		padding: 20rpx 32rpx;
		background: #fafcff;
		border-bottom: 1rpx solid #f0f2f5;
		transition: all 0.25s;
	}

	.operationBtns {
		display: flex;
		gap: 20rpx;
	}

	.operationBtn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 64rpx;
		border-radius: 12rpx;
		transition: all 0.2s;

		&:active {
			transform: scale(.97);
			opacity: .9;
		}
	}

	.btnPurple {
		background: #8b5cf6;
	}

	.btnOrange {
		background: #f97316;
	}

	.btnBlue {
		background: #1677ff;
	}

	.btnGreen {
		background: #52c41a;
	}

	.operationBtn .btnText {
		color: #fff;
		font-size: 26rpx;
		font-weight: 500;
		transition: all 0.25s;
	}

	.infoList {
		padding: 0 32rpx;
	}

	.infoRow {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 24rpx 0;
		border-bottom: 1rpx solid #f8fafc;
		transition: all 0.25s;
	}

	.infoRow:last-child {
		border-bottom: none;
	}

	.clickableRow:active {
		background: #f8fafc;
	}

	.infoLabel {
		flex-shrink: 0;
		font-size: 26rpx;
		color: #666;
		width: 160rpx;
		transition: all 0.25s;
	}

	.infoValueWrapper {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		position: relative;
	}

	.infoValue {
		font-size: 28rpx;
		color: #333;
		text-align: right;
		word-break: break-all;
		transition: all 0.25s;
	}

	.longText {
		white-space: normal;
		word-break: break-all;
	}

	.accentText {
		color: #1677ff;
		font-weight: 600;
	}

	.linkText {
		color: #1677ff;
		padding-right: 36rpx;
	}

	.linkIcon {
		position: absolute;
		right: 0;
		color: #1677ff;
		font-size: 24rpx;
	}

	.sectionFooter {
		padding: 24rpx 32rpx;
		background: #fafcff;
		border-top: 1rpx solid #f0f2f5;
		transition: all 0.25s;
	}

	.footerText {
		font-size: 24rpx;
		color: #999;
		transition: all 0.25s;
	}

	.emptyState {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 120rpx 32rpx;
	}

	.emptyIcon {
		font-size: 80rpx;
		margin-bottom: 24rpx;
		opacity: 0.5;
	}

	.emptyTitle {
		font-size: 32rpx;
		color: #666;
		margin-bottom: 16rpx;
		transition: all 0.25s;
	}

	.emptyDesc {
		font-size: 26rpx;
		color: #999;
		transition: all 0.25s;
	}

	.safeArea {
		height: 140rpx;
	}

	/* 底部按钮区域 */
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
		gap: 16rpx;
	}

	.btn-reset,
	.btn-submit {
		flex: 1;
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
		background: #f4f5f7;
		color: #666;
	}

	.btn-submit {
		background: #1677ff;
		color: #fff;

		&.disabled {
			opacity: .5;
			transform: none;
		}
	}

	/* 加载遮罩 */
	.loadingMask {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
	}

	.loadingSpinner {
		width: 80rpx;
		height: 80rpx;
		border: 4rpx solid #e2e8f0;
		border-top: 4rpx solid #1677ff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 24rpx;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}

		100% {
			transform: rotate(360deg);
		}
	}

	/* 弹窗 */
	.docModal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modalContent {
		background: #fff;
		border-radius: 24rpx;
		width: 85%;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		transition: all 0.25s;
	}

	.modalHeader {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 32rpx;
		border-bottom: 1rpx solid #f0f0f0;
		transition: all 0.25s;
	}

	.modalTitle {
		font-size: 32rpx;
		font-weight: 600;
		color: #333;
		transition: all 0.25s;
	}

	.closeBtn {
		width: 48rpx;
		height: 48rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modalBody {
		padding: 24rpx 32rpx;
	}

	.currentSn {
		background: #f4f5f7;
		padding: 20rpx 24rpx;
		border-radius: 12rpx;
		margin-bottom: 24rpx;
		transition: all 0.25s;
	}

	.snLabel {
		font-size: 26rpx;
		color: #666;
		margin-right: 16rpx;
		transition: all 0.25s;
	}

	.snValue {
		font-size: 28rpx;
		font-weight: 500;
		transition: all 0.25s;
	}

	.docList {
		max-height: 50vh;
	}

	.docItem {
		background: #f4f5f7;
		border-radius: 16rpx;
		padding: 24rpx;
		margin-bottom: 16rpx;
		border: 2rpx solid transparent;
		transition: all 0.25s;

		&:active {
			background: #eff6ff;
			border-color: #1677ff;
		}
	}

	.docHeader {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16rpx;
	}

	.docNo {
		font-size: 30rpx;
		font-weight: 600;
		color: #333;
		flex: 1;
		word-break: break-all;
		transition: all 0.25s;
	}

	.docStatus {
		font-size: 22rpx;
		padding: 6rpx 16rpx;
		border-radius: 24rpx;
		margin-left: 16rpx;
		flex-shrink: 0;
		transition: all 0.25s;
	}

	.docInfo {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8rpx;
	}

	.docType {
		font-size: 26rpx;
		color: #666;
		transition: all 0.25s;
	}

	.docDate {
		font-size: 24rpx;
		color: #999;
		transition: all 0.25s;
	}

	.docExtra {
		margin-top: 8rpx;
	}

	.extraText {
		font-size: 24rpx;
		color: #666;
		transition: all 0.25s;
	}

	.emptyDoc {
		text-align: center;
		padding: 80rpx 0;
	}

	.emptyText {
		font-size: 28rpx;
		color: #999;
		transition: all 0.25s;
	}

	/* ===== 小号样式 ===== */
	.size-small {
		.searchSection {
			padding: 16rpx 24rpx;
		}

		.searchInput {
			height: 64rpx;
			font-size: 24rpx;
		}

		.scanBtn {
			width: 64rpx;
			height: 64rpx;
		}

		.titleText,
		.clearHistory {
			font-size: 22rpx;
		}

		.historyItem {
			padding: 8rpx 18rpx;
		}

		.historyText {
			font-size: 22rpx;
		}

		.typeItem {
			font-size: 24rpx;
			padding: 12rpx 0;
		}

		.cardHeader {
			padding: 18rpx 24rpx;
		}

		.cardTitle {
			font-size: 26rpx;
		}

		.cardStatus {
			font-size: 20rpx;
			padding: 6rpx 16rpx;
		}

		.operationBtn {
			height: 52rpx;
		}

		.operationBtn .btnText {
			font-size: 22rpx;
		}

		.infoLabel {
			font-size: 22rpx;
			width: 130rpx;
		}

		.infoValue {
			font-size: 24rpx;
		}

		.footerText {
			font-size: 20rpx;
		}

		.btn-reset,
		.btn-submit {
			padding: 16rpx 0;
			font-size: 24rpx;
		}

		.modalTitle {
			font-size: 28rpx;
		}

		.docNo {
			font-size: 26rpx;
		}
	}

	/* ===== 大号样式 ===== */
	.size-large {
		.searchSection {
			padding: 32rpx 40rpx;
		}

		.searchInput {
			height: 96rpx;
			font-size: 32rpx;
		}

		.scanBtn {
			width: 96rpx;
			height: 96rpx;
		}

		.titleText,
		.clearHistory {
			font-size: 28rpx;
		}

		.historyItem {
			padding: 16rpx 32rpx;
		}

		.historyText {
			font-size: 30rpx;
		}

		.typeItem {
			font-size: 32rpx;
			padding: 20rpx 0;
		}

		.cardHeader {
			padding: 30rpx 40rpx;
		}

		.cardTitle {
			font-size: 34rpx;
		}

		.cardStatus {
			font-size: 26rpx;
			padding: 10rpx 24rpx;
		}

		.operationBtn {
			height: 76rpx;
		}

		.operationBtn .btnText {
			font-size: 30rpx;
		}

		.infoLabel {
			font-size: 30rpx;
			width: 200rpx;
		}

		.infoValue {
			font-size: 32rpx;
		}

		.footerText {
			font-size: 28rpx;
		}

		.btn-reset,
		.btn-submit {
			padding: 28rpx 0;
			font-size: 32rpx;
		}

		.modalTitle {
			font-size: 36rpx;
		}

		.docNo {
			font-size: 34rpx;
		}
	}

	/* ===== 深色模式 ===== */
	.theme-dark {
		&.page {
			background: #0f0f1a;
		}

		.top-bar,
		.typeNav,
		.dataCard,
		.modalContent,
		.bottom-bar {
			background: #1a1a2e;
		}

		.searchInputWrapper {
			background: #1e1e36;
			border-color: #2a2a45;
		}

		.searchInput {
			color: #e0e0e0;
		}

		.scanBtn {
			background: rgba(60, 126, 255, 0.15);
		}

		.titleText,
		.historyText,
		.typeItem,
		.footerText,
		.emptyTitle,
		.snLabel,
		.docType,
		.extraText {
			color: #888;
		}

		.clearHistory {
			color: #7cadff;
		}

		.historyItem {
			background: #1e1e36;
			border-color: #2a2a45;
		}

		.typeItem.type-item-active {
			color: #7cadff;
		}

		.typeItem.type-item-active::after {
			background: #7cadff;
		}

		.typeBadge {
			background: #2a2a45;
			color: #888;
		}

		.typeItem.type-item-active .typeBadge {
			background: rgba(60, 126, 255, 0.15);
			color: #7cadff;
		}

		.cardHeader {
			background: #1e1e36;
			border-bottom-color: #2a2a45;
		}

		.cardTitle {
			color: #e0e0e0;
		}

		.cardStatus {
			background: #2a2a45;
			color: #888;
		}

		.cardStatus.statusIdle {
			background: rgba(60, 126, 255, 0.15);
			color: #7cadff;
		}

		.cardStatus.statusShelf,
		.cardStatus.statusOpen {
			background: rgba(250, 140, 22, 0.15);
			color: #ffa76e;
		}

		.cardStatus.statusDone {
			background: rgba(82, 196, 26, 0.15);
			color: #81c784;
		}

		.snOperations {
			background: #1e1e36;
			border-bottom-color: #2a2a45;
		}

		.infoRow {
			border-bottom-color: #2a2a45;
		}

		.infoLabel {
			color: #888;
		}

		.infoValue {
			color: #ccc;
		}

		.accentText,
		.linkText,
		.linkIcon {
			color: #7cadff;
		}

		.sectionFooter {
			background: #1e1e36;
			border-top-color: #2a2a45;
		}

		.btn-reset {
			background: #1e1e36;
			color: #888;
		}

		.modalHeader {
			border-bottom-color: #2a2a45;
		}

		.modalTitle {
			color: #e0e0e0;
		}

		.currentSn {
			background: #1e1e36;
		}

		.snLabel {
			color: #888;
		}

		.docItem {
			background: #1e1e36;

			&:active {
				background: #252545;
				border-color: #7cadff;
			}
		}

		.docNo {
			color: #e0e0e0;
		}

		.emptyText {
			color: #666;
		}
	}
</style>