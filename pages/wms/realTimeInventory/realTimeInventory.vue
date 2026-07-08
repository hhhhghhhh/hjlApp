<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- 固定顶部搜索区域 -->
		<view class="top-bar" :class="{ collapsed: isCollapsed }">
			<view class="search-header" @click="toggleCollapse">
				<text class="search-title">库存搜索</text>
				<uni-icons :type="isCollapsed ? 'arrowdown' : 'arrowup'" size="16" color="#666"></uni-icons>
			</view>

			<view class="search-content" v-show="!isCollapsed">
				<view class="search-grid">
					<CommonSelector ref="warehouseSelector" type="warehouse" placeholder="仓库"
						:apiUrl="apiUrls.warehouse" :value="searchParams.whId" @input="handleWarehouseChange"
						:showSearch="true" searchPlaceholder="搜索仓库" :searchFields="['areaName', 'areaSn']"
						class="search-item" />
					<CommonSelector ref="districtSelector" type="district" placeholder="库区" :apiUrl="apiUrls.district"
						:value="searchParams.districtId" @input="handleDistrictChange" :showSearch="true"
						searchPlaceholder="搜索库区" :searchFields="['areaName', 'areaSn']" class="search-item" />
					<CommonSelector ref="storageSelector" type="storage" placeholder="库位" :apiUrl="apiUrls.storage"
						:value="searchParams.storageId" @input="handleStorageChange" :showSearch="true"
						searchPlaceholder="搜索库位" :searchFields="['areaName', 'areaSn']" class="search-item" />
					<CommonSelector ref="itemCodeSelector" type="itemCode" placeholder="物料编码" :apiUrl="apiUrls.itemCode"
						:value="searchParams.itemCodeId" @input="handleItemCodeChange" :showSearch="true"
						searchPlaceholder="搜索物料编码/名称" :searchFields="['itemCode', 'itemName']" iconType="search"
						class="search-item" />
					<view class="search-item input-item">
						<view class="input-wrapper">
							<input v-model="searchParams.itemSn" class="input-field" placeholder="物料SN"
								placeholder-style="color: #999;" />
							<view class="clear-icon" v-if="searchParams.itemSn" @click.stop="searchParams.itemSn = ''">
								<uni-icons type="clear" size="16" color="#999"></uni-icons>
							</view>
						</view>
					</view>
					<CommonSelector ref="statusSelector" type="status" placeholder="库存状态" :dataSource="statusOptions"
						:value="searchParams.status" @input="handleStatusChange" :showSearch="false"
						class="search-item" />
					<CommonSelector ref="customerSelector" type="customer" placeholder="客户" :apiUrl="apiUrls.customer"
						:value="searchParams.custId" @input="handleCustomerChange" :showSearch="true"
						searchPlaceholder="搜索客户编号/名称" :searchFields="['custCode', 'customer']" class="search-item" />
					<CommonSelector ref="supplierSelector" type="supplier" placeholder="供应商" :apiUrl="apiUrls.supplier"
						:value="searchParams.supplierId" @input="handleSupplierChange" :showSearch="true"
						searchPlaceholder="搜索供应商编号/名称" :searchFields="['supplierCode', 'supplierName']"
						class="search-item" />
				</view>
				<view class="action-row">
					<button class="reset-btn" type="default" @click="handleReset">重置</button>
					<button class="search-btn" type="primary" @click="handleSearch" :loading="loading"
						:style="{ background: themePrimary }">查询</button>
				</view>
			</view>
		</view>

		<!-- Tab切换 -->
		<view class="tabs-fixed">
			<view class="tabs">
				<view class="tab-item" :class="{ active: currentTab === 'summary' }" 
					:style="{ color: currentTab === 'summary' ? themePrimary : '' }"
					@click="switchTab('summary')">
					<text>汇总信息</text>
					<view v-if="currentTab === 'summary'" class="tab-underline" :style="{ background: themePrimary }"></view>
				</view>
				<view class="tab-item" :class="{ active: currentTab === 'detail' }"
					:style="{ color: currentTab === 'detail' ? themePrimary : '' }"
					@click="switchTab('detail')">
					<text>明细信息</text>
					<view v-if="currentTab === 'detail'" class="tab-underline" :style="{ background: themePrimary }"></view>
				</view>
			</view>
		</view>

		<!-- 中间内容区域 - 可滚动 -->
		<scroll-view class="content" scroll-y :show-scrollbar="false">
			<!-- 汇总信息 -->
			<view v-if="currentTab === 'summary'" class="summary-section">
				<!-- 汇总方式区域 -->
				<view class="group-selection" id="groupSelection">
					<text class="section-title">汇总方式</text>
					<view class="group-options">
						<view v-for="option in groupOptions" :key="option.value" class="group-option-item"
							:class="{ active: selectedGroups.includes(option.value) }"
							@click="toggleGroupOption(option.value)">
							<text class="option-text">{{ option.label }}</text>
							<uni-icons v-if="selectedGroups.includes(option.value)" type="check" size="16"
								:color="themePrimary"></uni-icons>
						</view>
					</view>
				</view>

				<view v-if="loading" class="loading-container">
					<uni-load-more status="loading" content="正在加载..."></uni-load-more>
				</view>

				<view v-else-if="summaryList.length > 0" class="summary-table-wrapper">
					<!-- 分页栏 -->
					<view class="pagination-bar" id="summaryPaginationBar" :class="[darkClass]">
						<view class="page-size-selector">
							<text :class="[darkClass]">每页显示：</text>
							<picker @change="onSummaryPageSizeChange" :value="summaryPageSizeIndex"
								:range="pageSizeOptions">
								<view class="picker-view" :class="[darkClass]">
									{{ summaryPageSize }}条
									<uni-icons type="arrowdown" :size="iconSize" :color="darkClass ? '#888' : '#666'"></uni-icons>
								</view>
							</picker>
						</view>
						<view class="page-controller">
							<view class="page-btn" :class="[{ disabled: summaryPageNo <= 1 }, darkClass]" @click="onSummaryPrevPage">
								<uni-icons type="arrowleft" :size="iconSize" :color="darkClass ? '#888' : '#666'"></uni-icons>
							</view>
							<text class="page-info" :class="[darkClass]">{{ summaryPageNo }} / {{ summaryTotalPages }}</text>
							<view class="page-btn" :class="[{ disabled: summaryPageNo >= summaryTotalPages }, darkClass]" @click="onSummaryNextPage">
								<uni-icons type="arrowright" :size="iconSize" :color="darkClass ? '#888' : '#666'"></uni-icons>
							</view>
						</view>
					</view>

					<!-- 表格区域 - 横向+纵向滚动 -->
					<scroll-view class="table-scroll" scroll-y="true" scroll-x="true" :show-scrollbar="true"
						:style="{ height: summaryScrollHeight + 'px' }">
						<view class="summary-table">
							<view class="table-header">
								<view class="table-row">
									<view class="table-cell col-index">序号</view>
									<view v-if="selectedGroups.includes('wh_id')" class="table-cell col-wh">仓库</view>
									<view v-if="selectedGroups.includes('item_lot')" class="table-cell col-lot">批次号</view>
									<view v-if="selectedGroups.includes('supplier_id')" class="table-cell col-supplier">供应商</view>
									<view v-if="selectedGroups.includes('cust_id')" class="table-cell col-cust">客户</view>
									<view v-if="selectedGroups.includes('status')" class="table-cell col-status">库存状态</view>
									<view class="table-cell col-name">物料名称</view>
									<view class="table-cell col-spec">规格型号</view>
									<view class="table-cell col-qty" @click="toggleUnitDisplay">
										库存数量
										<text class="unit-suffix" v-if="unitDisplayType === 'base'">(基本单位)</text>
										<text class="unit-suffix" v-else>(库存单位)</text>
									</view>
									<view class="table-cell col-code">物料编码</view>
								</view>
							</view>
							<view class="table-body">
								<view class="table-row" v-for="(item, index) in summaryList" :key="index"
									@click="showSummaryDetail(item)">
									<view class="table-cell col-index">
										{{ (summaryPageNo - 1) * summaryPageSize + index + 1 }}
									</view>
									<view v-if="selectedGroups.includes('wh_id')" class="table-cell col-wh">
										<view class="cell-text" :data-content="item.whId_dictText || '-'"
											@click.stop="showFullText($event)">
											{{ item.whId_dictText || '-' }}
										</view>
									</view>
									<view v-if="selectedGroups.includes('item_lot')" class="table-cell col-lot">
										<view class="cell-text" :data-content="item.itemLot || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemLot || '-' }}
										</view>
									</view>
									<view v-if="selectedGroups.includes('supplier_id')" class="table-cell col-supplier">
										<view class="cell-text" :data-content="item.supplierId_dictText || '-'"
											@click.stop="showFullText($event)">
											{{ item.supplierId_dictText || '-' }}
										</view>
									</view>
									<view v-if="selectedGroups.includes('cust_id')" class="table-cell col-cust">
										<view class="cell-text" :data-content="item.custId_dictText || '-'"
											@click.stop="showFullText($event)">
											{{ item.custId_dictText || '-' }}
										</view>
									</view>
									<view v-if="selectedGroups.includes('status')" class="table-cell col-status">
										<view class="status-tag" :class="getStatusClass(item.status)">
											{{ item.status_dictText || '-' }}
										</view>
									</view>
									<view class="table-cell col-name">
										<view class="cell-text" :data-content="item.itemName || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemName || '-' }}
										</view>
									</view>
									<view class="table-cell col-spec">
										<view class="cell-text" :data-content="item.itemSpec || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemSpec || '-' }}
										</view>
									</view>
									<view class="table-cell col-qty highlight">
										<view class="qty-display">
											<template v-if="unitDisplayType === 'base'">
												<text class="qty-value">{{ item.itemQty || 0 }}</text>
												<text class="qty-unit">{{ item.baseUnitName || '' }}</text>
											</template>
											<template v-else>
												<text class="qty-value">{{ formatStoreQty(item) }}</text>
												<text class="qty-unit">{{ item.storeUnitName || '' }}</text>
											</template>
										</view>
									</view>
									<view class="table-cell col-code">
										<view class="cell-text" :data-content="item.itemCode || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemCode || '-' }}
										</view>
									</view>
								</view>
							</view>
						</view>
					</scroll-view>
				</view>
				<view v-else class="empty-container">
					<image src="/static/empty.png" class="empty-image" mode="aspectFit"></image>
					<text class="empty-text">暂无汇总数据</text>
				</view>
			</view>

			<!-- 明细信息 -->
			<view v-else-if="currentTab === 'detail'" class="detail-section">
				<!-- 汇总查询来源标签 -->
				<view v-if="currentSummaryDetailParams && Object.keys(currentSummaryDetailParams).length > 0"
					class="summary-source-tag" id="sourceTag">
					<view class="source-content">
						<text class="source-label">汇总查询：</text>
						<text class="source-value">{{ getSummarySourceText() }}</text>
					</view>
					<view class="source-close" @click="clearSummarySource">
						<uni-icons type="close" size="16" color="#999"></uni-icons>
					</view>
				</view>

				<view v-if="loading" class="loading-container">
					<uni-load-more status="loading" content="正在加载..."></uni-load-more>
				</view>

				<view v-else-if="detailList.length > 0" class="detail-table-wrapper">
					<!-- 分页栏 -->
					<view class="pagination-bar" id="detailPaginationBar" :class="[darkClass]">
						<view class="page-size-selector">
							<text :class="[darkClass]">每页显示：</text>
							<picker @change="onDetailPageSizeChange" :value="detailPageSizeIndex"
								:range="pageSizeOptions">
								<view class="picker-view" :class="[darkClass]">
									{{ detailPageSize }}条
									<uni-icons type="arrowdown" :size="iconSize" :color="darkClass ? '#888' : '#666'"></uni-icons>
								</view>
							</picker>
						</view>
						<view class="page-controller">
							<view class="page-btn" :class="[{ disabled: detailPageNo <= 1 }, darkClass]" @click="onDetailPrevPage">
								<uni-icons type="arrowleft" :size="iconSize" :color="darkClass ? '#888' : '#666'"></uni-icons>
							</view>
							<text class="page-info" :class="[darkClass]">{{ detailPageNo }} / {{ detailTotalPages }}</text>
							<view class="page-btn" :class="[{ disabled: detailPageNo >= detailTotalPages }, darkClass]" @click="onDetailNextPage">
								<uni-icons type="arrowright" :size="iconSize" :color="darkClass ? '#888' : '#666'"></uni-icons>
							</view>
						</view>
					</view>

					<!-- 表格区域 - 横向+纵向滚动 -->
					<scroll-view class="table-scroll" scroll-y="true" scroll-x="true" :show-scrollbar="true"
						:style="{ height: detailScrollHeight + 'px' }">
						<view class="detail-table">
							<view class="table-header">
								<view class="table-row">
									<view class="table-cell col-index">序号</view>
									<view class="table-cell col-status">状态</view>
									<view class="table-cell col-name">物料名称</view>
									<view class="table-cell col-spec">规格型号</view>
									<view class="table-cell col-lot">批次号</view>
									<view class="table-cell col-location">仓库位置</view>
									<view class="table-cell col-qty" @click="toggleUnitDisplay">
										数量
										<text class="unit-suffix" v-if="unitDisplayType === 'base'">(基本单位)</text>
										<text class="unit-suffix" v-else>(库存单位)</text>
									</view>
									<view class="table-cell col-production">距生产日期</view>
									<view class="table-cell col-expiry">保质期剩余</view>
									<view class="table-cell col-code">物料编码</view>
									<view class="table-cell col-sn">物料SN</view>
								</view>
							</view>
							<view class="table-body">
								<view class="table-row" v-for="(item, index) in detailList" :key="item.id">
									<view class="table-cell col-index">
										{{ (detailPageNo - 1) * detailPageSize + index + 1 }}
									</view>
									<view class="table-cell col-status">
										<view class="status-tag" :class="getStatusClass(item.status)">
											{{ item.status_dictText || '-' }}
										</view>
									</view>
									<view class="table-cell col-name">
										<view class="cell-text" :data-content="item.itemName || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemName || '-' }}
										</view>
									</view>
									<view class="table-cell col-spec">
										<view class="cell-text" :data-content="item.itemSpec || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemSpec || '-' }}
										</view>
									</view>
									<view class="table-cell col-lot">
										<view class="cell-text" :data-content="item.itemLot || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemLot || '-' }}
										</view>
									</view>
									<view class="table-cell col-location">
										<view class="cell-text" :data-content="getFullLocation(item)"
											@click.stop="showFullText($event)">
											{{ getFullLocation(item) }}
										</view>
									</view>
									<view class="table-cell col-qty highlight">
										<view class="qty-display">
											<template v-if="unitDisplayType === 'base'">
												<text class="qty-value">{{ item.itemQty || 0 }}</text>
												<text class="qty-unit">{{ item.baseUnitName || '' }}</text>
											</template>
											<template v-else>
												<text class="qty-value">{{ formatStoreQty(item) }}</text>
												<text class="qty-unit">{{ item.storeUnitName || '' }}</text>
											</template>
										</view>
									</view>
									<view class="table-cell col-production"
										:class="{'warning-text': getDaysFromProduction(item) <= 0}">
										{{ getDaysFromProduction(item) }}天
									</view>
									<view class="table-cell col-expiry" :class="{
										'warning-text': getRemainingShelfLife(item) <= 0 && getRemainingShelfLife(item) !== null,
										'expired-text': getRemainingShelfLife(item) <= 0
									}">
										{{ getRemainingShelfLifeText(item) }}
									</view>
									<view class="table-cell col-code">
										<view class="cell-text" :data-content="item.itemCode || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemCode || '-' }}
										</view>
									</view>
									<view class="table-cell col-sn">
										<view class="cell-text" :data-content="item.itemSn || '-'"
											@click.stop="showFullText($event)">
											{{ item.itemSn || '-' }}
										</view>
									</view>
								</view>
							</view>
						</view>
					</scroll-view>
				</view>
				<view v-else class="empty-container">
					<image src="/static/empty.png" class="empty-image" mode="aspectFit"></image>
					<text class="empty-text">暂无库存数据</text>
				</view>
			</view>
		</scroll-view>

		<!-- 完整内容弹窗 -->
		<uni-popup ref="fullTextPopup" type="center" :mask-click="true">
			<view class="full-text-modal" :class="[sizeClass, darkClass]">
				<view class="modal-header">
					<text class="modal-title">完整内容</text>
					<view class="modal-close" @click="closeFullTextModal">
						<uni-icons type="closeempty" size="20" color="#999"></uni-icons>
					</view>
				</view>
				<scroll-view class="modal-content" scroll-y>
					<text class="full-text">{{ fullTextContent }}</text>
				</scroll-view>
				<view class="modal-footer">
					<button class="copy-btn" :style="{ color: themePrimary }" @click="copyFullText">复制内容</button>
					<button class="close-btn" @click="closeFullTextModal">关闭</button>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
	import CommonSelector from '@/components/CommonSelector.vue';
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		name: 'InventoryQuery',
		components: {
			CommonSelector
		},
		mixins: [settingsMixin],
		data() {
			return {
				apiUrls: {
					warehouse: '/wms/wmsArea/getAllCkList',
					district: '/wms/wmsArea/getAllKQList',
					storage: '/wms/wmsArea/getAllKWList',
					itemCode: '/mes/coItem/getTabPageList',
					customer: '/mes/coCustomer/queryOpenTabList',
					supplier: '/mes/coSupplier/queryOpenTabList'
				},
				currentTab: 'summary',
				groupOptions: [
					{ label: '仓库', value: 'wh_id' },
					{ label: '批次号', value: 'item_lot' },
					{ label: '供应商', value: 'supplier_id' },
					{ label: '客户', value: 'cust_id' },
					{ label: '库存状态', value: 'status' }
				],
				selectedGroups: [],
				isCollapsed: true,
				searchParams: {
					whId: '',
					districtId: '',
					storageId: '',
					status: '',
					itemCodeId: '',
					itemName: '',
					itemSn: '',
					custId: '',
					supplierId: ''
				},
				statusOptions: [
					{ id: '', name: '全部状态' },
					{ id: '1', name: '待入库' }, { id: '2', name: '在库' },
					{ id: '3', name: '待出库' }, { id: '4', name: '调拨出库' },
					{ id: '6', name: '静态盘点' }, { id: '7', name: '动态盘点' },
					{ id: '8', name: '待盘点' }, { id: '9', name: '领料锁定' },
					{ id: '10', name: '待报废' }, { id: '11', name: '已报废' },
					{ id: '12', name: '已盘点' }, { id: '13', name: '待检' },
					{ id: '14', name: '已出库' }
				],
				summaryList: [],
				loadingSummary: false,
				summaryPageNo: 1,
				summaryPageSize: 20,
				summaryTotal: 0,
				noMoreSummary: false,
				detailList: [],
				loadingDetail: false,
				detailPageNo: 1,
				detailPageSize: 20,
				detailTotal: 0,
				noMoreDetail: false,
				pageSizeOptions: ['10条', '20条', '50条', '100条'],
				pageSizeValues: [10, 20, 50, 100],
				currentSummaryDetailParams: null,
				currentSummarySourceText: '',
				iconSize: 22,
				fullTextContent: '',
				unitDisplayType: 'store',
				summaryScrollHeight: 300,
				detailScrollHeight: 300
			}
		},
		computed: {
			loading() {
				return this.currentTab === 'summary' ? this.loadingSummary : this.loadingDetail;
			},
			summaryTotalPages() {
				return Math.ceil(this.summaryTotal / this.summaryPageSize) || 1;
			},
			summaryPageSizeIndex() {
				const index = this.pageSizeValues.findIndex(v => v === this.summaryPageSize);
				return index !== -1 ? index : 1;
			},
			detailTotalPages() {
				return Math.ceil(this.detailTotal / this.detailPageSize) || 1;
			},
			detailPageSizeIndex() {
				const index = this.pageSizeValues.findIndex(v => v === this.detailPageSize);
				return index !== -1 ? index : 1;
			}
		},
		watch: {
			'appSettings.displaySize': {
				handler() {
					this.$nextTick(() => {
						this.calcScrollHeights();
					});
				},
				immediate: true
			},
			currentTab() {
				this.$nextTick(() => {
					this.calcScrollHeights();
				});
			},
			summaryList: {
				handler() {
					this.$nextTick(() => {
						this.calcScrollHeights();
					});
				},
				deep: true
			},
			detailList: {
				handler() {
					this.$nextTick(() => {
						this.calcScrollHeights();
					});
				},
				deep: true
			}
		},
		onLoad() {
			this.querySummary();
			this.$nextTick(() => {
				this.calcScrollHeights();
			});
			uni.onWindowResize(() => {
				this.calcScrollHeights();
			});
		},
		onUnload() {
			
		},
		methods: {
			updateIconSizes(size) {
				const sizeMap = { small: 18, medium: 22, large: 26 };
				this.iconSize = sizeMap[size] || 22;
			},

			calcScrollHeights() {
				this.$nextTick(() => {
					const query = uni.createSelectorQuery().in(this);
					const systemInfo = uni.getSystemInfoSync();
					const windowHeight = systemInfo.windowHeight;
					const statusBarHeight = systemInfo.statusBarHeight || 0;
					
					query.select('.top-bar').boundingClientRect();
					query.select('.tabs-fixed').boundingClientRect();
					
					if (this.currentTab === 'summary') {
						query.select('#groupSelection').boundingClientRect();
						query.select('#summaryPaginationBar').boundingClientRect();
						
						query.exec((res) => {
							const topBarHeight = res[0]?.height || 80;
							const tabsHeight = res[1]?.height || 80;
							const groupHeight = res[2]?.height || 120;
							const paginationHeight = res[3]?.height || 60;
							
							const fixedHeight = topBarHeight + tabsHeight + groupHeight + paginationHeight + 40;
							this.summaryScrollHeight = windowHeight - statusBarHeight - fixedHeight;
							
							if (this.summaryScrollHeight < 300) {
								this.summaryScrollHeight = 300;
							}
						});
					} else {
						query.select('#sourceTag').boundingClientRect();
						query.select('#detailPaginationBar').boundingClientRect();
						
						query.exec((res) => {
							const topBarHeight = res[0]?.height || 80;
							const tabsHeight = res[1]?.height || 80;
							const sourceTagHeight = res[2]?.height || 0;
							const paginationHeight = res[3]?.height || 60;
							
							const fixedHeight = topBarHeight + tabsHeight + sourceTagHeight + paginationHeight + 40;
							this.detailScrollHeight = windowHeight - statusBarHeight - fixedHeight;
							
							if (this.detailScrollHeight < 300) {
								this.detailScrollHeight = 300;
							}
						});
					}
				});
			},

			toggleUnitDisplay() {
				this.unitDisplayType = this.unitDisplayType === 'base' ? 'store' : 'base';
				uni.showToast({
					title: `已切换至${this.unitDisplayType === 'store' ? '库存单位' : '基本单位'}`,
					icon: 'success',
					duration: 1000
				});
			},

			formatStoreQtyNumber(item) {
				if (!item.storeUrnum || !item.storeUrnom || item.storeUrnum === 0) {
					return item.itemQty || 0;
				}
				const qty = (item.itemQty / item.storeUrnum) * item.storeUrnom;
				return parseFloat(qty.toFixed(2));
			},

			formatStoreQty(item) {
				const qty = this.formatStoreQtyNumber(item);
				if (Number.isInteger(qty)) return qty.toString();
				return qty.toFixed(2);
			},

			getSummarySourceText() {
				return this.currentSummarySourceText || '';
			},
			
			clearSummarySource() {
				this.currentSummaryDetailParams = null;
				this.currentSummarySourceText = '';
				this.detailPageNo = 1;
				this.queryDetail();
				this.$nextTick(() => this.calcScrollHeights());
			},
			
			parseProductionDate(itemLot) {
				if (!itemLot || itemLot.length < 8) return null;
				try {
					const year = parseInt(itemLot.substring(0, 4));
					const month = parseInt(itemLot.substring(4, 6)) - 1;
					const day = parseInt(itemLot.substring(6, 8));
					const date = new Date(year, month, day);
					return isNaN(date.getTime()) ? null : date;
				} catch (error) {
					return null;
				}
			},
			
			getDaysFromProduction(item) {
				const productionDate = this.parseProductionDate(item.itemLot);
				if (!productionDate) return '--';
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const timeDiff = today.getTime() - productionDate.getTime();
				return Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
			},
			
			convertShelfLifeToDays(expPerioderp, expUnit) {
				if (!expPerioderp || expPerioderp <= 0) return 0;
				const period = parseInt(expPerioderp);
				if (isNaN(period)) return 0;
				switch (expUnit) {
					case 'D': return period;
					case 'M': return period * 30;
					case 'Y': return period * 365;
					default: return period;
				}
			},
			
			getRemainingShelfLife(item) {
				if (!item.expPeriod || !item.expUnit) return null;
				const productionDate = this.parseProductionDate(item.itemLot);
				if (!productionDate) return null;
				const totalShelfLifeDays = this.convertShelfLifeToDays(item.expPeriod, item.expUnit);
				if (totalShelfLifeDays <= 0) return null;
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const timeDiff = today.getTime() - productionDate.getTime();
				const daysPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) - 1;
				const remaining = totalShelfLifeDays - daysPassed;
				return remaining <= 0 ? 0 : remaining;
			},
			
			getRemainingShelfLifeText(item) {
				const remainingDays = this.getRemainingShelfLife(item);
				if (remainingDays === null) return '--';
				if (remainingDays <= 0) return '已过期';
				return `${remainingDays}天`;
			},
			
			getFullLocation(item) {
				let location = '';
				if (item.whId_dictText) location += item.whId_dictText;
				if (item.districtId_dictText) location += ' / ' + item.districtId_dictText;
				if (item.storageId_dictText) location += ' / ' + item.storageId_dictText;
				return location || '-';
			},
			
			showFullText(event) {
				const content = event.currentTarget?.dataset?.content;
				if (content && content !== '-') {
					this.fullTextContent = content;
					this.$refs.fullTextPopup.open();
				}
			},
			
			closeFullTextModal() {
				this.$refs.fullTextPopup.close();
				this.fullTextContent = '';
			},
			
			copyFullText() {
				uni.setClipboardData({
					data: this.fullTextContent,
					success: () => {
						uni.showToast({ title: '复制成功', icon: 'success' });
					}
				});
			},
			
			toggleCollapse() {
				this.isCollapsed = !this.isCollapsed;
				this.$nextTick(() => this.calcScrollHeights());
			},
			
			switchTab(tab) {
				if (this.currentTab === tab) return;
				this.currentTab = tab;
				if (tab === 'summary') {
					this.querySummary();
				} else {
					this.queryDetail();
				}
				this.$nextTick(() => this.calcScrollHeights());
			},
			
			toggleGroupOption(value) {
				const index = this.selectedGroups.indexOf(value);
				if (index > -1) {
					this.selectedGroups.splice(index, 1);
				} else {
					this.selectedGroups.push(value);
				}
				if (this.currentTab === 'summary') {
					this.summaryPageNo = 1;
					this.querySummary();
				}
			},
			
			handleWarehouseChange(value) {
				this.searchParams.whId = value ? value.id : '';
				this.searchParams.districtId = '';
				this.searchParams.storageId = '';
				if (this.$refs.districtSelector) this.$refs.districtSelector.clearCache();
				if (this.$refs.storageSelector) this.$refs.storageSelector.clearCache();
			},
			
			handleDistrictChange(value) {
				this.searchParams.districtId = value ? value.id : '';
				this.searchParams.storageId = '';
				if (this.$refs.storageSelector) this.$refs.storageSelector.clearCache();
			},
			
			handleStorageChange(value) {
				this.searchParams.storageId = value ? value.id : '';
			},
			
			handleItemCodeChange(value) {
				this.searchParams.itemCodeId = value ? value.id : '';
			},
			
			handleStatusChange(value) {
				this.searchParams.status = value ? value.id : '';
			},
			
			handleCustomerChange(value) {
				this.searchParams.custId = value ? value.id : '';
			},
			
			handleSupplierChange(value) {
				this.searchParams.supplierId = value ? value.id : '';
			},
			
			async querySummary() {
				if (this.loadingSummary) return;
				uni.showLoading({ title: '加载中...' });
				this.loadingSummary = true;
				try {
					const params = {
						...this.searchParams,
						sumWay: this.selectedGroups.join(','),
						pageNo: this.summaryPageNo,
						pageSize: this.summaryPageSize
					};
					Object.keys(params).forEach(key => {
						if (params[key] === '') delete params[key];
					});
					const response = await this.$request({
						url: "/wms/wmsStockInfo/realTimelist",
						method: "GET",
						data: params
					});
					if (response.data && response.data.success) {
						const result = response.data.result;
						this.summaryList = result.records || [];
						this.summaryTotal = result.total || 0;
					} else {
						this.summaryList = [];
						this.summaryTotal = 0;
					}
				} catch (error) {
					console.error('查询汇总信息失败:', error);
					this.summaryList = [];
					this.summaryTotal = 0;
				} finally {
					this.loadingSummary = false;
					uni.hideLoading();
					this.$nextTick(() => this.calcScrollHeights());
				}
			},
			
			async queryDetail() {
				if (this.loadingDetail) return;
				uni.showLoading({ title: '加载中...' });
				this.loadingDetail = true;
				try {
					let params = {
						pageNo: this.detailPageNo,
						pageSize: this.detailPageSize
					};
					if (this.currentSummaryDetailParams && Object.keys(this.currentSummaryDetailParams).length > 0) {
						Object.assign(params, this.currentSummaryDetailParams);
					} else {
						Object.assign(params, this.searchParams);
					}
					Object.keys(params).forEach(key => {
						if (params[key] === '') delete params[key];
					});
					const response = await this.$request({
						url: "/wms/wmsStockInfo/realTimeDetailList",
						method: "GET",
						data: params
					});
					if (response.data && response.data.success) {
						const result = response.data.result;
						this.detailList = result.records || [];
						this.detailTotal = result.total || 0;
					} else {
						this.detailList = [];
						this.detailTotal = 0;
					}
				} catch (error) {
					console.error('查询明细信息失败:', error);
					this.detailList = [];
					this.detailTotal = 0;
				} finally {
					this.loadingDetail = false;
					uni.hideLoading();
					this.$nextTick(() => this.calcScrollHeights());
				}
			},
			
			async handleSearch() {
				this.currentSummaryDetailParams = null;
				this.currentSummarySourceText = '';
				if (this.currentTab === 'summary') {
					this.summaryPageNo = 1;
					await this.querySummary();
				} else {
					this.detailPageNo = 1;
					await this.queryDetail();
				}
				this.toggleCollapse();
			},
			
			onSummaryPageSizeChange(e) {
				const newSize = this.pageSizeValues[e.detail.value];
				if (newSize !== this.summaryPageSize) {
					this.summaryPageSize = newSize;
					this.summaryPageNo = 1;
					this.querySummary();
				}
			},
			
			onSummaryPrevPage() {
				if (this.summaryPageNo > 1) {
					this.summaryPageNo--;
					this.querySummary();
				}
			},
			
			onSummaryNextPage() {
				if (this.summaryPageNo < this.summaryTotalPages) {
					this.summaryPageNo++;
					this.querySummary();
				}
			},
			
			onDetailPageSizeChange(e) {
				const newSize = this.pageSizeValues[e.detail.value];
				if (newSize !== this.detailPageSize) {
					this.detailPageSize = newSize;
					this.detailPageNo = 1;
					this.queryDetail();
				}
			},
			
			onDetailPrevPage() {
				if (this.detailPageNo > 1) {
					this.detailPageNo--;
					this.queryDetail();
				}
			},
			
			onDetailNextPage() {
				if (this.detailPageNo < this.detailTotalPages) {
					this.detailPageNo++;
					this.queryDetail();
				}
			},
			
			showSummaryDetail(item) {
				this.currentSummaryDetailParams = {};
				const conditions = [];
				if (item.itemCodeId) {
					this.currentSummaryDetailParams.itemCodeId = item.itemCodeId;
					conditions.push(`物料: ${item.itemCode}`);
				}
				if (this.selectedGroups.includes('wh_id') && item.whId) {
					this.currentSummaryDetailParams.whId = item.whId;
					conditions.push(`仓库: ${item.whId_dictText}`);
				}
				if (this.selectedGroups.includes('item_lot') && item.itemLot) {
					this.currentSummaryDetailParams.itemLot = item.itemLot;
					conditions.push(`批次: ${item.itemLot}`);
				}
				if (this.selectedGroups.includes('supplier_id') && item.supplierId) {
					this.currentSummaryDetailParams.supplierId = item.supplierId;
					conditions.push(`供应商: ${item.supplierId_dictText}`);
				}
				if (this.selectedGroups.includes('cust_id') && item.custId) {
					this.currentSummaryDetailParams.custId = item.custId;
					conditions.push(`客户: ${item.custId_dictText}`);
				}
				if (this.selectedGroups.includes('status') && item.status) {
					this.currentSummaryDetailParams.status = item.status;
					conditions.push(`状态: ${item.status_dictText}`);
				}
				this.currentSummarySourceText = conditions.join(' | ');
				this.detailPageNo = 1;
				this.switchTab('detail');
				uni.showToast({
					title: '已跳转到对应明细',
					icon: 'success',
					duration: 1500
				});
			},
			
			handleReset() {
				this.searchParams = {
					whId: '',
					districtId: '',
					storageId: '',
					status: '',
					itemCodeId: '',
					itemName: '',
					itemSn: '',
					custId: '',
					supplierId: ''
				};
				this.currentSummaryDetailParams = null;
				this.currentSummarySourceText = '';
				this.unitDisplayType = 'store';
				this.clearAllSelectorsCache();
				if (this.currentTab === 'summary') {
					this.summaryPageNo = 1;
					this.querySummary();
				} else {
					this.detailPageNo = 1;
					this.queryDetail();
				}
			},
			
			clearAllSelectorsCache() {
				const selectorRefs = ['warehouseSelector', 'districtSelector', 'storageSelector', 'itemCodeSelector',
					'customerSelector', 'supplierSelector', 'statusSelector'];
				selectorRefs.forEach(ref => {
					if (this.$refs[ref] && typeof this.$refs[ref].clearCache === 'function') {
						this.$refs[ref].clearCache();
					}
				});
			},
			
			getStatusClass(status) {
				switch (String(status)) {
					case '1': return 'status-waiting';
					case '2': return 'status-normal';
					case '3': return 'status-waiting';
					case '4': return 'status-transfer';
					case '6': case '7': return 'status-counting';
					case '8': return 'status-waiting';
					case '9': return 'status-locked';
					case '10': return 'status-waiting';
					case '11': return 'status-scrap';
					case '12': return 'status-counted';
					case '13': return 'status-waiting';
					case '14': return 'status-out';
					default: return 'status-default';
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
		z-index: 100;
		background: #fff;
		border-bottom: 1rpx solid #f0f0f0;
		transition: all 0.25s;

		.search-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 24rpx;
			background: #fff;

			.search-title {
				font-size: 28rpx;
				color: #333;
				font-weight: 500;
			}
		}
	}

	.search-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16rpx;
		padding: 20rpx 24rpx 0;

		.search-item {
			margin: 0;
		}

		.input-item .input-wrapper {
			position: relative;
			width: 100%;

			.input-field {
				width: 100%;
				height: 80rpx;
				padding: 0 60rpx 0 24rpx;
				background: #f4f5f7;
				border-radius: 12rpx;
				border: 1rpx solid #e5e7eb;
				font-size: 26rpx;
				color: #333;
				box-sizing: border-box;
				line-height: 80rpx;
				transition: all 0.25s;
			}

			.clear-icon {
				position: absolute;
				right: 20rpx;
				top: 50%;
				transform: translateY(-50%);
				padding: 6rpx;
				border-radius: 50%;
				background: #f0f0f0;
				display: flex;
				align-items: center;
				justify-content: center;
			}
		}
	}

	.action-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20rpx 24rpx 24rpx;
		background: #fff;

		.reset-btn, .search-btn {
			flex: 1;
			height: 80rpx;
			border-radius: 12rpx;
			font-size: 28rpx;
			line-height: 80rpx;
		}

		.reset-btn {
			background: #f4f5f7;
			color: #666;
			border: 1rpx solid #e5e7eb;
			margin-right: 16rpx;
			&:active { background: #e8e9ec; }
		}

		.search-btn {
			color: #fff;
			border: none;
			&:active { opacity: 0.85; }
		}
	}

	/* Tab切换区域 */
	.tabs-fixed {
		position: sticky;
		top: 0;
		z-index: 99;
		background: #fff;
		border-bottom: 1rpx solid #f0f0f0;

		.tabs {
			display: flex;
			background: #fff;

			.tab-item {
				flex: 1;
				text-align: center;
				padding: 24rpx 0;
				font-size: 28rpx;
				color: #666;
				position: relative;

				&.active {
					font-weight: 500;
				}
			}
		}

		.tab-underline {
			position: absolute;
			bottom: 0;
			left: 50%;
			transform: translateX(-50%);
			width: 60rpx;
			height: 4rpx;
			border-radius: 2rpx;
		}
	}

	/* 内容区域 */
	.content {
		flex: 1;
		overflow: hidden;
		
	}

	/* 汇总方式区域 */
	.group-selection {
		background: #fff;
		padding: 20rpx 24rpx;
		margin: 16rpx 0;
		border-radius: 16rpx;

		.section-title {
			display: block;
			font-size: 28rpx;
			color: #333;
			font-weight: 500;
			margin-bottom: 20rpx;
		}

		.group-options {
			display: flex;
			flex-wrap: wrap;
			gap: 16rpx;

			.group-option-item {
				padding: 12rpx 24rpx;
				background: #f4f5f7;
				border: 1rpx solid #e5e7eb;
				border-radius: 32rpx;
				display: flex;
				align-items: center;
				gap: 8rpx;

				.option-text {
					font-size: 24rpx;
					color: #666;
				}

				&.active {
					background: rgba(22, 119, 255, 0.1);
					border-color: #1677ff;
					.option-text { color: #1677ff; }
				}
			}
		}
	}

	/* 汇总查询来源标签 */
	.summary-source-tag {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 20rpx;
		margin: 16rpx 0;
		background: rgba(22, 119, 255, 0.08);
		border: 1rpx solid rgba(22, 119, 255, 0.2);
		border-radius: 12rpx;

		.source-content {
			flex: 1;
			display: flex;
			align-items: center;
			min-width: 0;

			.source-label {
				font-size: 24rpx;
				color: #1677ff;
				font-weight: 500;
				flex-shrink: 0;
			}

			.source-value {
				font-size: 24rpx;
				color: #1677ff;
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		}

		.source-close {
			padding: 8rpx;
			margin-left: 16rpx;
			border-radius: 50%;
			background: rgba(0, 0, 0, 0.04);
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		}
	}

	/* 分页栏 */
	.pagination-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16rpx 0;
		background: #fff;
		flex-shrink: 0;

		.page-size-selector {
			display: flex;
			align-items: center;
			gap: 12rpx;
			font-size: 24rpx;
			color: #666;

			.picker-view {
				display: flex;
				align-items: center;
				gap: 8rpx;
				padding: 8rpx 16rpx;
				background: #f4f5f7;
				border-radius: 8rpx;
				font-size: 24rpx;
				color: #333;
				transition: all 0.25s;
			}
		}

		.page-controller {
			display: flex;
			align-items: center;
			gap: 16rpx;

			.page-btn {
				width: 56rpx;
				height: 56rpx;
				display: flex;
				align-items: center;
				justify-content: center;
				background: #f4f5f7;
				border-radius: 8rpx;
				transition: all 0.25s;

				&.disabled { opacity: 0.4; }
				&:active:not(.disabled) { background: #e8e9ec; }
			}

			.page-info {
				font-size: 24rpx;
				color: #666;
				min-width: 100rpx;
				text-align: center;
			}
		}
	}

	/* 表格区域 - 支持横向滚动 */
	.summary-section, .detail-section {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.summary-table-wrapper, .detail-table-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.summary-table, .detail-table {
		min-width: 100%;
		width: max-content;
		background: #fff;
		border-radius: 16rpx;
		overflow: hidden;

		.table-header {
			position: sticky;
			top: 0;
			z-index: 10;
			background: #f4f5f7;
			border-bottom: 1rpx solid #e5e7eb;

			.table-row {
				display: flex;
				background: #f4f5f7;
			}

			.table-cell {
				font-weight: 600;
				color: #333;
				font-size: 24rpx;
				padding: 20rpx 12rpx;
				white-space: nowrap;
				text-align: center;
				flex-shrink: 0;

				.unit-suffix {
					font-size: 20rpx;
					font-weight: normal;
					margin-left: 4rpx;
				}
			}
		}

		.table-body {
			.table-row {
				display: flex;
				border-bottom: 1rpx solid #f0f0f0;
				cursor: pointer;
				transition: background 0.2s;

				&:hover { background: #fafafa; }
				&:active { background: #f5f5f5; }
			}

			.table-cell {
				font-size: 22rpx;
				color: #666;
				padding: 16rpx 12rpx;
				white-space: nowrap;
				text-align: center;
				flex-shrink: 0;

				&.highlight { font-weight: 500; }
				&.warning-text { color: #ff6b6b; font-weight: 500; }
				&.expired-text { color: #f5222d; font-weight: 600; }

				.cell-text {
					max-width: 200rpx;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					cursor: pointer;
					&:hover { text-decoration: underline; }
				}
			}
		}
	}

	/* 数量显示样式 */
	.qty-display {
		display: inline-flex;
		align-items: center;
		gap: 4rpx;

		.qty-value { font-size: 22rpx; font-weight: 500; }
		.qty-unit { font-size: 20rpx; color: #999; }
	}

	/* 状态标签 */
	.status-tag {
		display: inline-block;
		padding: 4rpx 12rpx;
		border-radius: 16rpx;
		font-size: 20rpx;
		font-weight: 500;
		white-space: nowrap;
	}
	.status-normal { background: rgba(82, 196, 26, 0.1); color: #52c41a; }
	.status-waiting { background: rgba(250, 173, 20, 0.1); color: #faad14; }
	.status-locked { background: rgba(245, 34, 45, 0.1); color: #f5222d; }
	.status-scrap { background: rgba(136, 136, 136, 0.1); color: #666; }
	.status-counting { background: rgba(114, 46, 209, 0.1); color: #722ed1; }
	.status-counted { background: rgba(22, 119, 255, 0.1); color: #1677ff; }
	.status-transfer { background: rgba(13, 199, 179, 0.1); color: #0dc7b3; }
	.status-out { background: rgba(64, 169, 255, 0.1); color: #40a9ff; }
	.status-default { background: rgba(136, 136, 136, 0.1); color: #666; }

	/* 加载和空状态 */
	.loading-container, .empty-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 120rpx 0;
	}
	.empty-container { flex-direction: column; .empty-image { width: 180rpx; height: 180rpx; margin-bottom: 24rpx; opacity: 0.6; } .empty-text { font-size: 26rpx; color: #999; } }

	/* 完整内容弹窗 */
	.full-text-modal {
		width: 560rpx;
		background: #fff;
		border-radius: 24rpx;
		overflow: hidden;

		.modal-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 32rpx 32rpx 24rpx;
			border-bottom: 1rpx solid #f0f0f0;
			.modal-title { font-size: 32rpx; font-weight: 500; color: #333; }
			.modal-close { padding: 8rpx; }
		}
		.modal-content { padding: 32rpx; max-height: 400rpx; .full-text { font-size: 28rpx; color: #333; line-height: 1.5; word-break: break-all; } }
		.modal-footer {
			display: flex;
			border-top: 1rpx solid #f0f0f0;
			button { flex: 1; height: 96rpx; line-height: 96rpx; font-size: 32rpx; border-radius: 0; background: #fff; &::after { border: none; } }
			.copy-btn { border-right: 1rpx solid #f0f0f0; }
			.close-btn { color: #666; }
		}
	}

	/* ===== 列宽定义 ===== */
	.summary-table {
		.col-index { width: 80rpx; min-width: 80rpx; }
		.col-wh { width: 160rpx; min-width: 160rpx; }
		.col-lot { width: 160rpx; min-width: 160rpx; }
		.col-supplier { width: 180rpx; min-width: 180rpx; }
		.col-cust { width: 180rpx; min-width: 180rpx; }
		.col-status { width: 100rpx; min-width: 100rpx; }
		.col-name { width: 200rpx; min-width: 200rpx; .cell-text { max-width: 180rpx; } }
		.col-spec { width: 180rpx; min-width: 180rpx; .cell-text { max-width: 160rpx; } }
		.col-qty { width: 160rpx; min-width: 160rpx; cursor: pointer; }
		.col-code { width: 180rpx; min-width: 180rpx; .cell-text { max-width: 160rpx; } }
	}
	.detail-table {
		.col-index { width: 80rpx; min-width: 80rpx; }
		.col-status { width: 100rpx; min-width: 100rpx; }
		.col-name { width: 200rpx; min-width: 200rpx; .cell-text { max-width: 180rpx; } }
		.col-spec { width: 180rpx; min-width: 180rpx; .cell-text { max-width: 160rpx; } }
		.col-lot { width: 160rpx; min-width: 160rpx; .cell-text { max-width: 140rpx; } }
		.col-location { width: 240rpx; min-width: 240rpx; .cell-text { max-width: 220rpx; } }
		.col-qty { width: 160rpx; min-width: 160rpx; cursor: pointer; }
		.col-production { width: 120rpx; min-width: 120rpx; }
		.col-expiry { width: 120rpx; min-width: 120rpx; }
		.col-code { width: 180rpx; min-width: 180rpx; .cell-text { max-width: 160rpx; } }
		.col-sn { width: 200rpx; min-width: 200rpx; .cell-text { max-width: 180rpx; } }
	}

	/* ===== 小号样式 ===== */
	.size-small {
		.search-header { padding: 16rpx 20rpx; .search-title { font-size: 24rpx; } }
		.input-field { height: 64rpx; font-size: 22rpx; line-height: 64rpx; }
		.reset-btn, .search-btn { height: 64rpx; font-size: 24rpx; line-height: 64rpx; }
		.tab-item { padding: 16rpx 0; font-size: 24rpx; }
		.group-selection { padding: 14rpx 18rpx; .section-title { font-size: 24rpx; } }
		.group-option-item { padding: 8rpx 18rpx; .option-text { font-size: 20rpx; } }
		.table-header .table-cell { font-size: 20rpx; padding: 14rpx 8rpx; }
		.table-body .table-cell { font-size: 18rpx; padding: 12rpx 8rpx; .cell-text { max-width: 140rpx; } }
		.status-tag { padding: 2rpx 8rpx; font-size: 16rpx; }
		.qty-display .qty-value { font-size: 18rpx; }
		.pagination-bar { padding: 12rpx 0; }
		.page-btn { width: 48rpx; height: 48rpx; }
		.full-text-modal { width: 480rpx; .modal-content .full-text { font-size: 24rpx; } }
	}

	/* ===== 大号样式 ===== */
	.size-large {
		.search-header { padding: 32rpx 28rpx; .search-title { font-size: 32rpx; } }
		.input-field { height: 96rpx; font-size: 30rpx; line-height: 96rpx; }
		.reset-btn, .search-btn { height: 96rpx; font-size: 32rpx; line-height: 96rpx; }
		.tab-item { padding: 32rpx 0; font-size: 32rpx; }
		.group-selection { padding: 28rpx 32rpx; .section-title { font-size: 32rpx; } }
		.group-option-item { padding: 16rpx 32rpx; .option-text { font-size: 28rpx; } }
		.table-header .table-cell { font-size: 28rpx; padding: 26rpx 16rpx; }
		.table-body .table-cell { font-size: 26rpx; padding: 20rpx 16rpx; .cell-text { max-width: 260rpx; } }
		.status-tag { padding: 6rpx 16rpx; font-size: 24rpx; }
		.qty-display .qty-value { font-size: 26rpx; }
		.pagination-bar { padding: 20rpx 0; }
		.page-btn { width: 64rpx; height: 64rpx; }
		.full-text-modal { width: 640rpx; }
	}

	/* ===== 深色模式 ===== */
	.theme-dark {
		&.page { background: #0f0f1a; }
		
		.top-bar, .search-header, .action-row, .tabs-fixed, .tabs,
		.group-selection, .summary-table, .detail-table, .full-text-modal,
		.pagination-bar, .summary-table-wrapper, .detail-table-wrapper {
			background: #1a1a2e;
		}

		.top-bar, .tabs-fixed, .modal-header, .modal-footer,
		.summary-table .table-header, .detail-table .table-header {
			border-bottom-color: #2a2a45;
		}

		.search-header .search-title, .section-title, .modal-title, .full-text,
		.page-info, .page-size-selector > text, .pagination-bar .page-size-selector > text,
		.table-header .table-cell {
			color: #e0e0e0 !important;
		}

		.input-field {
			background: #1e1e36;
			border-color: #2a2a45;
			color: #e0e0e0;
		}

		.reset-btn {
			background: #1e1e36;
			border-color: #2a2a45;
			color: #888;
			&:active { background: #252545; }
		}

		.tab-item { color: #888; }

		.group-option-item {
			background: #1e1e36;
			border-color: #2a2a45;
			.option-text { color: #888; }
			&.active {
				background: rgba(60, 126, 255, 0.15);
				border-color: #3c7eff;
				.option-text { color: #7cadff; }
			}
		}

		.summary-source-tag {
			background: rgba(60, 126, 255, 0.1);
			border-color: rgba(60, 126, 255, 0.2);
			.source-label, .source-value { color: #7cadff; }
		}

		.picker-view, .page-btn {
			background: #1e1e36;
			color: #e0e0e0;
		}
		
		.picker-view .uni-icons, .page-btn .uni-icons {
			color: #888 !important;
		}

		.summary-table, .detail-table {
			.table-header {
				background: #1e1e36;
				.table-cell { background: #1e1e36; color: #e0e0e0; border-bottom-color: #2a2a45; }
			}
			.table-body {
				.table-row { border-bottom-color: #2a2a45; }
				.table-cell { color: #ccc; }
			}
		}

		.status-normal { background: rgba(82, 196, 26, 0.15); color: #81c784; }
		.status-waiting { background: rgba(250, 173, 20, 0.15); color: #ffc53d; }
		.status-locked { background: rgba(245, 34, 45, 0.15); color: #ff6b6b; }
		.status-scrap { background: rgba(136, 136, 136, 0.15); color: #aaa; }
		.status-counting { background: rgba(114, 46, 209, 0.15); color: #b37feb; }
		.status-counted { background: rgba(60, 126, 255, 0.15); color: #7cadff; }
		.status-transfer { background: rgba(13, 199, 179, 0.15); color: #5cdbd3; }
		.status-out { background: rgba(64, 169, 255, 0.15); color: #80bfff; }
		.status-default { background: rgba(136, 136, 136, 0.15); color: #aaa; }

		.empty-text { color: #666; }
		.modal-header, .modal-footer { border-top-color: #2a2a45; }
		.modal-close .uni-icons, .close-btn { color: #888; }
		.copy-btn { border-right-color: #2a2a45; color: #7cadff !important; }
	}
</style>