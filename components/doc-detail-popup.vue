<template>
	<uni-popup ref="popup" type="bottom" background-color="#fff" @change="onPopupChange">
		<view class="detail-container" :class="[sizeClass, darkClass, themeClass]">
			<!-- 标签页 -->
			<view class="tabs-container">
				<view class="tabs">
					<view class="tab-item" :class="{ active: activeTab === 'main' }"
						:style="{ color: activeTab === 'main' ? themePrimary : '' }" @click="activeTab = 'main'">
						<text>单据信息</text>
						<view v-if="activeTab === 'main'" class="tab-underline" :style="{ background: themePrimary }"></view>
					</view>
					<view class="tab-item" :class="{ active: activeTab === 'item' }"
						:style="{ color: activeTab === 'item' ? themePrimary : '' }" @click="switchToItemTab">
						<text>物料清单</text>
						<view v-if="activeTab === 'item'" class="tab-underline" :style="{ background: themePrimary }"></view>
					</view>
					<view class="tab-item" :class="{ active: activeTab === 'sn' }"
						:style="{ color: activeTab === 'sn' ? themePrimary : '' }" @click="switchToSnTab">
						<text>SN清单</text>
						<view v-if="activeTab === 'sn'" class="tab-underline" :style="{ background: themePrimary }"></view>
					</view>
				</view>
			</view>

			<!-- 加载状态 -->
			<view class="loading-container" v-if="loading">
				<uni-load-more status="loading" content="加载中..."></uni-load-more>
			</view>

			<!-- 错误状态 -->
			<view class="error-container" v-else-if="loadError">
				<uni-icons type="info" size="64" color="#ff4d4f"></uni-icons>
				<text class="error-text">加载失败</text>
				<button class="retry-btn" :style="{ background: themePrimary }" @click="loadDetailData">重试</button>
			</view>

			<!-- 内容区域 -->
			<view class="detail-content" v-else>
				<!-- 主表信息 -->
				<scroll-view class="tab-panel" scroll-y v-show="activeTab === 'main'">
					<view class="info-card">
						<view class="info-list">
							<view class="info-item">
								<text class="info-label">单据编号：</text>
								<text class="info-value">{{ docObject.docNo || '-' }}</text>
							</view>

							<view v-if="docData.snType !== '5'" class="info-item">
								<text class="info-label">单据状态：</text>
								<text class="info-value">{{ docObject.docStatus_dictText || '-' }}</text>
							</view>

							<!-- 盘点单 -->
							<view v-if="docData.snType == '5'" class="info-item">
								<text class="info-label">单据状态：</text>
								<text
									class="info-value">{{ docObject.invDocStatus_dictText ||docObject.invDocStatusName|| '-' }}</text>
							</view>
							<view v-if="docData.snType == '5'" class="info-item">
								<text class="info-label">盘点日期：</text>
								<text class="info-value">{{ docObject.invDate || '-' }}</text>
							</view>

							<!-- 调拨单 -->
							<view v-if="docData.snType == '4'" class="info-item">
								<text class="info-label">调入组织：</text>
								<text class="info-value">{{ docObject.dataAuthIn_dictText || '-' }}</text>
							</view>
							<view v-if="docData.snType == '4'" class="info-item">
								<text class="info-label">计划调拨时间：</text>
								<text class="info-value">{{ docObject.planAllotDate || '-' }}</text>
							</view>
							<view v-if="docData.snType == '4'" class="info-item">
								<text class="info-label">实际调拨时间：</text>
								<text class="info-value">{{ docObject.allotDate || '-' }}</text>
							</view>

							<!-- 入库单 -->
							<view v-if="docData.snType == '2'" class="info-item">
								<text class="info-label">计划入库时间：</text>
								<text class="info-value">{{ docObject.planReceiveDate || '-' }}</text>
							</view>
							<view v-if="docData.snType == '2'" class="info-item">
								<text class="info-label">实际入库时间：</text>
								<text class="info-value">{{ docObject.receiveDate || '-' }}</text>
							</view>

							<!-- 出库单 -->
							<view v-if="docData.snType == '3'" class="info-item">
								<text class="info-label">计划出库时间：</text>
								<text class="info-value">{{ docObject.planOutstockDate || '-' }}</text>
							</view>
							<view v-if="docData.snType == '3'" class="info-item">
								<text class="info-label">实际出库时间：</text>
								<text class="info-value">{{ docObject.outstockDate || '-' }}</text>
							</view>

							<!-- 通用字段 -->
							<view class="info-item">
								<text class="info-label">供应商：</text>
								<text class="info-value">{{ docObject.supplierId_dictText || '-' }}</text>
							</view>
							<view class="info-item">
								<text class="info-label">客户：</text>
								<text class="info-value">{{ docObject.custId_dictText || '-' }}</text>
							</view>
							<view class="info-item">
								<text class="info-label">开单人：</text>
								<text class="info-value">{{ docObject.createBy || '-' }}</text>
							</view>
							<view class="info-item">
								<text class="info-label">开单时间：</text>
								<text class="info-value">{{ docObject.createTime || '-' }}</text>
							</view>
						</view>
					</view>
				</scroll-view>

				<!-- 物料清单 - 独立滚动表格 -->
				<view class="tab-panel item-tab-panel" v-show="activeTab === 'item'">
					<view class="table-wrapper">
						<!-- 分页控制栏 -->
						<view class="pagination-bar">
							<view class="page-size-selector">
								<text>每页显示：</text>
								<picker @change="onItemPageSizeChange" :value="itemPageSizeIndex"
									:range="pageSizeOptions">
									<view class="picker-view">
										{{ itemPageSize }}条
										<uni-icons type="arrowdown" :size="iconSize" color="#666"></uni-icons>
									</view>
								</picker>
							</view>
							<view class="page-controller">
								<view class="page-btn" :class="{ disabled: itemPageNo <= 1 }" @click="onItemPrevPage">
									<uni-icons type="arrowleft" :size="iconSize" color="#666"></uni-icons>
								</view>
								<text class="page-info">{{ itemPageNo }} / {{ itemTotalPages }}</text>
								<view class="page-btn" :class="{ disabled: itemPageNo >= itemTotalPages }"
									@click="onItemNextPage">
									<uni-icons type="arrowright" :size="iconSize" color="#666"></uni-icons>
								</view>
							</view>
						</view>

						<!-- 表格容器 - 独立滚动区域 -->
						<scroll-view class="table-scroll" scroll-y="true" scroll-x="true" :show-scrollbar="true"
							:style="{ height: tableScrollHeight + 'px' }">
							<view class="table-container">
								<view class="table-header">
									<view class="table-row">
										<view class="table-cell col-index">分录行</view>
										<view class="table-cell col-name">物料名称</view>
										<view class="table-cell col-unit">单位</view>
										<view class="table-cell col-plan">计划数</view>
										<view class="table-cell col-receive-issue">{{ receiveIssueColumnName }}</view>
										<view class="table-cell col-warehouse">仓库</view>
										<view class="table-cell col-status">状态</view>
										<view class="table-cell col-action"
											v-if="showSubItemActions && docData.snType != '5'">操作</view>
									</view>
								</view>
								<view class="table-body" v-if="itemList.length > 0">
									<view class="table-row" v-for="(item, index) in itemList" :key="item.id || index"
										@click="onSubItemClick(item)">
										<view class="table-cell col-index">
											{{ (itemPageNo - 1) * itemPageSize + index + 1 }}
										</view>
										<view class="table-cell col-name">{{ item.itemName || '-' }}</view>
										<view class="table-cell col-unit">{{ getUnit(item) || '-' }}</view>
										<view class="table-cell col-plan">{{ getPlanQty(item) || '-' }}</view>
										<view class="table-cell col-receive-issue">
											{{ getReceiveOrIssueQty(item) }}
										</view>
										<view class="table-cell col-warehouse">{{ getWarehouseName(item) || '-' }}
										</view>
										<view class="table-cell col-status">
											{{ item.status_dictText|| item.itemStatus_dictText || item.itemStatusName||'-' }}
										</view>
										<view class="table-cell col-action"
											v-if="showSubItemActions && docData.snType != '5'">
											<view class="delete-btn"
												:class="{ 'delete-disabled': !canDeleteSubItem(item) }"
												@click.stop="onSubItemDeleteClick(item)">
												<text>删除</text>
											</view>
										</view>
									</view>
								</view>
								<view class="empty-tip" v-else>
									<uni-icons type="info" :size="iconSize * 2" color="#ccc"></uni-icons>
									<text class="empty-text">暂无物料明细数据</text>
								</view>
							</view>
						</scroll-view>
					</view>
				</view>

				<!-- SN清单 - 支持下拉刷新和上拉加载 -->
				<scroll-view class="tab-panel" scroll-y :refresher-enabled="true" :refresher-triggered="snRefreshing"
					@refresherrefresh="onSnRefresh" @scrolltolower="onSnLoadMore" :show-scrollbar="false"
					v-show="activeTab === 'sn'">
					<view class="sub-table-container">
						<view class="sub-table-header">
							<text class="total-count">共 {{ snTotal }} 条SN明细</text>
						</view>

						<view class="sub-table-list" v-if="snList.length > 0">
							<view class="sub-table-item" v-for="(item, index) in snList" :key="item.id || index"
								@click="onSnItemClick(item)">
								<view class="item-header">
									<text class="item-index">#{{ index + 1 }}</text>
									<view class="item-status" :class="getSnStatusClass(item.itemStatus)">
										{{ item.itemStatus_dictText || item.invStatusName || '-' }}
									</view>
								</view>

								<view class="item-content">
									<!-- SN清单核心字段：物料SN优先展示 -->
									<view class="item-row highlight-row">
										<text class="field-label">物料SN：</text>
										<text class="field-value highlight-value">{{ item.itemSn || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">物料编码：</text>
										<text class="field-value">{{ item.itemCode ||item.stockItemCode|| '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">物料名称：</text>
										<text class="field-value">{{ item.itemName ||item.stockItemName|| '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">规格型号：</text>
										<text class="field-value">{{ item.itemSpec ||item.stockItemSpec|| '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">生产批次：</text>
										<text class="field-value">{{ item.itemLot || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">仓库：</text>
										<text class="field-value">{{ item.whId_dictText ||item.whName|| '-' }}</text>
									</view>
									<view class="item-row">
										<text class="field-label">库区：</text>
										<text
											class="field-value">{{ item.districtId_dictText ||item.districtName|| '-' }}</text>
									</view>
									<view class="item-row">
										<text class="field-label">库位：</text>
										<text
											class="field-value">{{ item.storageId_dictText ||item.storageName|| '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">数量：</text>
										<text class="field-value">{{ item.itemQty || '-' }}</text>
									</view>
									<view class="item-row">
										<text class="field-label">单位：</text>
										<text class="field-value">{{ item.erpUnitName || '-' }}</text>
									</view>

									<view v-if="docData.snType != '5'" class="item-row">
										<text class="field-label">交接人：</text>
										<text class="field-value">{{ item.handoverEmp || '-' }}</text>
									</view>

									<view v-if="docData.snType != '5'" class="item-row">
										<text class="field-label">交接时间：</text>
										<text class="field-value">{{ item.handoverTime || '-' }}</text>
									</view>

									<view v-if="docData.snType === '5'" class="item-row">
										<text class="field-label">盘点数量：</text>
										<text class="field-value">{{ item.invQty }}</text>
									</view>
								</view>

								<!-- 操作按钮 -->
								<view class="item-actions" v-if="showSnItemActions">
									<!-- 入库单SN修改按钮 - 可修改状态 -->
									<view class="action-btn edit-btn" @click.stop="onSnEditClick(item)"
										v-if="canEditSn(item)">
										<text>修改</text>
									</view>
									<!-- 入库单SN删除按钮 -->
									<view class="action-btn delete-btn" @click.stop="onSnDeleteClick(item)"
										v-if="canDeleteSn(item)">
										<text>删除</text>
									</view>
								</view>
							</view>
						</view>

						<view class="empty-tip" v-else>
							<uni-icons type="info" :size="iconSize * 2" color="#ccc"></uni-icons>
							<text class="empty-text">暂无SN明细数据</text>
						</view>

						<!-- 加载更多状态 -->
						<view v-if="snLoadingMore" class="load-more">
							<uni-load-more status="loading" content="加载中..."></uni-load-more>
						</view>
						<view v-if="snNoMore && snList.length > 0" class="load-more">
							<text class="no-more-text">没有更多了</text>
						</view>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 修改SN弹窗 -->
		<uni-popup ref="editPopup" type="center" background-color="#fff" :mask-click="false">
			<view class="edit-modal" :class="[sizeClass]">
				<view class="modal-header">
					<text class="modal-title">修改SN信息</text>
					<view class="modal-close" @click="closeEditModal">
						<uni-icons type="closeempty" :size="iconSize" color="#999"></uni-icons>
					</view>
				</view>
				<view class="modal-content">
					<view class="form-item">
						<text class="form-label">物料SN：</text>
						<text class="form-value">{{ editForm.itemSn }}</text>
					</view>
					<view class="form-item">
						<text class="form-label">物料名称：</text>
						<text class="form-value">{{ editForm.itemName }}</text>
					</view>
					<view class="form-item">
						<text class="form-label">数量：</text>
						<input class="form-input" type="number" v-model="editForm.num" placeholder="请输入数量" />
					</view>
					<view v-if="docData.snType === '2'" class="form-item">
						<text class="form-label">批次号：</text>
						<input class="form-input" v-model="editForm.itemLot" placeholder="请输入批次号" />
					</view>
				</view>
				<view class="modal-footer">
					<button class="cancel-btn" @click="closeEditModal">取消</button>
					<button class="confirm-btn" :style="{ color: themePrimary }" @click="submitEdit" :disabled="editLoading">确定</button>
				</view>
			</view>
		</uni-popup>
	</uni-popup>
</template>

<script>
	import {
		queryDetailByDocId,
		deleteSn,
		updateSn,
		deleteReceiveItem,
		deleteOutstockItem,
		deleteAllotItem
	} from "@/api/wmsApi.js";
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		name: "DocDetailPopup",
		mixins: [settingsMixin],
		props: {
			docData: {
				type: Object,
				default: () => ({})
			},
			invStatusMap: {
				type: Object,
				default: () => ({
					'1': '待盘点',
					'2': '盘点中',
					'3': '已盘点'
				})
			},
			snStatusMap: {
				type: Object,
				default: () => ({
					'0': '正常',
					'1': '已出库',
					'2': '已入库',
					'3': '已盘点',
					'4': '异常'
				})
			},
			showSubItemActions: {
				type: Boolean,
				default: true
			},
			showSnItemActions: {
				type: Boolean,
				default: true
			},
			apiFunction: {
				type: Function,
				default: null
			}
		},
		data() {
			return {
				activeTab: 'main',
				loading: false,
				loadError: false,
				itemList: [],
				snList: [],
				deleteLoading: false,
				subItemDeleteLoading: false,
				docObject: {},
				itemPageNo: 1,
				itemPageSize: 10,
				itemTotal: 0,
				pageSizeOptions: ['10条', '20条', '50条', '100条'],
				pageSizeValues: [10, 20, 50, 100],

				snPageNo: 1,
				snPageSize: 10,
				snTotal: 0,
				snRefreshing: false,
				snLoadingMore: false,
				snNoMore: false,
				snInitialLoaded: false,

				editForm: {
					id: '',
					itemSn: '',
					itemName: '',
					num: '',
					itemLot: ''
				},
				editLoading: false,

				// 动态图标大小
				iconSize: 22,
				// 表格滚动区域高度
				tableScrollHeight: 400
			};
		},
		computed: {
			receiveIssueColumnName() {
				const snType = this.docData?.snType;
				if (snType === '2') {
					return '收料数';
				} else if (snType === '3') {
					return '发料数';
				} else if (snType === '4') {
					return '调拨数';
				} else if (snType === '5') {
					return '盘点数';
				} else {
					return '数量';
				}
			},
			itemTotalPages() {
				return Math.ceil(this.itemTotal / this.itemPageSize) || 1;
			},
			itemPageSizeIndex() {
				const index = this.pageSizeValues.findIndex(v => v === this.itemPageSize);
				return index !== -1 ? index : 0;
			}
		},
		watch: {
			'appSettings.displaySize': {
				handler(newVal) {
					this.updateIconSizes(newVal);
				},
				immediate: true
			},
			activeTab: {
				handler(newVal) {
					if (newVal === 'item') {
						this.$nextTick(() => {
							this.calculateTableHeight();
						});
					}
				}
			}
		},
		mounted() {
			this.calculateTableHeight();
			// 监听窗口大小变化
			uni.onWindowResize(() => {
				this.calculateTableHeight();
			});
		},
		beforeDestroy() {
			
		},
		methods: {
			updateIconSizes(size) {
				const sizeMap = { small: 18, medium: 22, large: 26 };
				this.iconSize = sizeMap[size] || 22;
			},

			calculateTableHeight() {
				this.$nextTick(() => {
					const query = uni.createSelectorQuery().in(this);
					query.select('.detail-container').boundingClientRect();
					query.select('.tabs-container').boundingClientRect();
					query.select('.pagination-bar').boundingClientRect();
					query.exec((res) => {
						const containerHeight = res[0]?.height || 600;
						const tabsHeight = res[1]?.height || 100;
						const paginationHeight = res[2]?.height || 80;
						// 计算可用高度，减去一些边距
						const availableHeight = containerHeight - tabsHeight - paginationHeight - 40;
						this.tableScrollHeight = Math.max(availableHeight, 300);
					});
				});
			},

			async open() {
				if (!this.docData || !this.docData.id) {
					console.error('单据数据或单据ID不能为空');
					this.$emit('error', new Error('单据数据或单据ID不能为空'));
					return;
				}

				this.activeTab = 'main';
				this.resetPagination();
				this.snInitialLoaded = false;

				this.$refs.popup.open();
				await this.loadDetailData();

				// 弹窗打开后重新计算高度
				setTimeout(() => {
					this.calculateTableHeight();
				}, 300);
			},

			close() {
				this.loadError = false;
				this.resetPagination();
				this.snInitialLoaded = false;
				this.$refs.popup.close();
				this.$emit('close');
			},

			resetPagination() {
				this.itemPageNo = 1;
				this.itemPageSize = 10;
				this.itemTotal = 0;
				this.itemList = [];
				this.snPageNo = 1;
				this.snPageSize = 10;
				this.snTotal = 0;
				this.snList = [];
				this.snNoMore = false;
				this.snRefreshing = false;
				this.snLoadingMore = false;
			},

			onPopupChange(e) {
				if (!e.show) {
					this.loadError = false;
					this.resetPagination();
					this.snInitialLoaded = false;
					this.$emit('close');
				}
			},

			switchToItemTab() {
				this.activeTab = 'item';
				if (this.itemList.length === 0 && this.itemTotal === 0) {
					this.loadItemData();
				} else {
					this.$nextTick(() => {
						this.calculateTableHeight();
					});
				}
			},

			switchToSnTab() {
				this.activeTab = 'sn';
				if (!this.snInitialLoaded) {
					this.loadSnData(true);
					this.snInitialLoaded = true;
				}
			},

			async loadItemData() {
				this.loading = true;
				try {
					const apiFunc = this.apiFunction || queryDetailByDocId;
					const params = {
						id: this.docData.id,
						snType: this.docData.snType,
						itemPageNo: this.itemPageNo,
						itemPageSize: this.itemPageSize
					};

					const response = await apiFunc(params);
					const result = this.parseResponse(response);
					if (result.itemList) {
						this.docObject = result.docObject
					} else {
						this.docObject = {};
					}
					if (result && result.itemList) {
						const itemData = result.itemList;
						this.itemList = Array.isArray(itemData.records) ? itemData.records : [];
						this.itemTotal = itemData.total || 0;

						this.$emit('item-load-success', {
							itemList: this.itemList,
							itemTotal: this.itemTotal
						});
					} else {
						this.itemList = [];
						this.itemTotal = 0;
					}
				} catch (error) {
					console.error('加载物料清单失败:', error);
					this.$emit('load-error', error);
					uni.showToast({
						title: '加载物料清单失败',
						icon: 'none'
					});
				} finally {
					this.loading = false;
					this.$nextTick(() => {
						this.calculateTableHeight();
					});
				}
			},

			async loadSnData(isRefresh = false) {
				if (isRefresh) {
					this.snRefreshing = true;
					this.snPageNo = 1;
					this.snNoMore = false;
				} else {
					if (this.snLoadingMore || this.snNoMore) return;
					this.snLoadingMore = true;
					this.snPageNo++;
				}

				try {
					const apiFunc = this.apiFunction || queryDetailByDocId;
					const params = {
						id: this.docData.id,
						snType: this.docData.snType,
						snPageNo: isRefresh ? 1 : this.snPageNo,
						snPageSize: this.snPageSize
					};

					const response = await apiFunc(params);
					const result = this.parseResponse(response);
					if (result.itemList) {
						this.docObject = result.docObject
					} else {
						this.docObject = {};
					}
					if (result && result.snList) {
						const snData = result.snList;
						const newList = Array.isArray(snData.records) ? snData.records : [];
						const total = snData.total || 0;

						if (isRefresh) {
							this.snList = newList;
							this.snTotal = total;
							this.snPageNo = 1;
						} else {
							this.snList = [...this.snList, ...newList];
							this.snTotal = total;
						}

						this.snNoMore = this.snList.length >= total;

						this.$emit('sn-load-success', {
							snList: this.snList,
							snTotal: this.snTotal,
							isRefresh: isRefresh
						});
					} else {
						if (isRefresh) {
							this.snList = [];
							this.snTotal = 0;
						}
						this.snNoMore = true;
					}
				} catch (error) {
					console.error('加载SN清单失败:', error);
					uni.showToast({
						title: '加载SN清单失败',
						icon: 'none'
					});
					if (!isRefresh && this.snPageNo > 1) {
						this.snPageNo--;
					}
				} finally {
					if (isRefresh) {
						this.snRefreshing = false;
					} else {
						this.snLoadingMore = false;
					}
				}
			},

			async onSnRefresh() {
				await this.loadSnData(true);
			},

			async onSnLoadMore() {
				if (this.snNoMore || this.snLoadingMore) {
					return;
				}
				await this.loadSnData(false);
			},

			parseResponse(response) {
				if (response && response.data && response.data.result) {
					return response.data.result;
				}
				if (response && response.data) {
					return response.data;
				}
				return response;
			},

			async loadDetailData() {
				this.loading = true;
				this.loadError = false;

				try {
					const apiFunc = this.apiFunction || queryDetailByDocId;
					const params = {
						id: this.docData.id,
						snType: this.docData.snType,
						itemPageNo: this.itemPageNo,
						itemPageSize: this.itemPageSize,
						snPageNo: 1,
						snPageSize: this.snPageSize
					};

					const response = await apiFunc(params);
					const result = this.parseResponse(response);

					if (result) {
						if (result.itemList) {
							this.docObject = result.docObject
						} else {
							this.docObject = {};
						}

						if (result.itemList) {
							this.itemList = Array.isArray(result.itemList.records) ? result.itemList.records : [];
							this.itemTotal = result.itemList.total || 0;
						} else {
							this.itemList = [];
							this.itemTotal = 0;
						}

						if (result.snList) {
							this.snList = Array.isArray(result.snList.records) ? result.snList.records : [];
							this.snTotal = result.snList.total || 0;
							this.snPageNo = 1;
						} else {
							this.snList = [];
							this.snTotal = 0;
						}

						this.snNoMore = this.snList.length >= this.snTotal;
						this.snInitialLoaded = this.snList.length > 0;

						this.$emit('load-success', {
							itemList: this.itemList,
							snList: this.snList,
							itemTotal: this.itemTotal,
							snTotal: this.snTotal
						});
					} else {
						this.itemList = [];
						this.snList = [];
						this.itemTotal = 0;
						this.snTotal = 0;
						this.snNoMore = true;
						this.snInitialLoaded = false;
					}
				} catch (error) {
					console.error('加载单据详情数据失败:', error);
					this.loadError = true;
					this.$emit('load-error', error);
				} finally {
					this.loading = false;
				}
			},

			onItemPageSizeChange(e) {
				const newSize = this.pageSizeValues[e.detail.value];
				if (newSize !== this.itemPageSize) {
					this.itemPageSize = newSize;
					this.itemPageNo = 1;
					this.loadItemData();
				}
			},

			onItemPrevPage() {
				if (this.itemPageNo > 1) {
					this.itemPageNo--;
					this.loadItemData();
				}
			},

			onItemNextPage() {
				if (this.itemPageNo < this.itemTotalPages) {
					this.itemPageNo++;
					this.loadItemData();
				}
			},

			getUnit(item) {
				return item.unitName || item.itemUnit || item.unit || '-';
			},

			getPlanQty(item) {
				return item.planQty || item.stockQty || '-';
			},

			getReceiveOrIssueQty(item) {
				const snType = this.docData?.snType;
				if (snType === '2') {
					return item.receiveQty || item.actualQty;
				} else if (snType === '3') {
					return item.outQty || item.issueQty || item.actualQty;
				} else if (snType === '4') {
					return item.receiveQty;
				} else if (snType === '5') {
					return item.invQty;
				} else {
					return item.receiveQty || item.outQty || item.planQty;
				}
			},

			getWarehouseName(item) {
				const snType = this.docData?.snType;
				if (snType === '4') {
					return item.outWhId_dictText || item.outWhName || item.whId_dictText || '-';
				} else {
					return item.whId_dictText || item.whName || item.areaName || '-';
				}
			},

			getSubItemDeleteApi() {
				const snType = this.docData?.snType;
				switch (snType) {
					case '2':
						return deleteReceiveItem;
					case '3':
						return deleteOutstockItem;
					case '4':
						return deleteAllotItem;
					default:
						return null;
				}
			},

			canDeleteSubItem(item) {
				if (!item.id) {
					return false;
				}
				if (this.docData?.snType === '5') {
					return false;
				}
				return true;
			},

			onSubItemDeleteClick(item) {
				if (!item.id) {
					uni.showToast({
						title: '分录ID不存在',
						icon: 'none'
					});
					return;
				}

				if (!this.canDeleteSubItem(item)) {
					uni.showToast({
						title: "不能删除",
						icon: 'none',
						duration: 2000
					});
					return;
				}

				uni.showModal({
					title: '确认删除',
					content: `确定要删除物料 "${item.itemName || item.itemCode}" 吗？\n删除后相关数据将无法恢复！`,
					confirmColor: '#ff4d4f',
					success: async (res) => {
						if (res.confirm) {
							await this.deleteSubItem(item);
						}
					}
				});
			},

			async deleteSubItem(item) {
				if (this.subItemDeleteLoading) return;
				this.subItemDeleteLoading = true;

				const deleteApi = this.getSubItemDeleteApi();
				if (!deleteApi) {
					uni.showToast({
						title: '当前单据类型不支持删除物料',
						icon: 'none'
					});
					this.subItemDeleteLoading = false;
					return;
				}

				try {
					const response = await deleteApi(item.id);
					const resData = response?.data || response;
					const isSuccess = resData &&
						(resData.success === true || (resData.success === undefined && resData.code === 200));

					if (isSuccess) {
						await this.refreshAfterDelete();
						this.$emit('sub-item-delete-success', item);
						uni.showToast({
							title: resData.message || '删除成功',
							icon: 'success',
							duration: 3000
						});
					} else {
						uni.showToast({
							title: resData?.message || resData?.msg || '删除失败',
							icon: 'none',
							duration: 3000
						});
					}
				} catch (error) {
					console.error('删除物料清单失败:', error);
					let errorMsg = '删除失败';

					if (error.response && error.response.data) {
						const resData = error.response.data;
						errorMsg = resData.message || resData.msg || resData.error || errorMsg;
					} else if (error.data) {
						errorMsg = error.data.message || error.data.msg || errorMsg;
					} else if (error.message) {
						errorMsg = error.message;
					}

					uni.showToast({
						title: errorMsg,
						icon: 'none',
						duration: 3000
					});
				} finally {
					this.subItemDeleteLoading = false;
				}
			},

			async refreshAfterDelete() {
				const currentTab = this.activeTab;
				this.itemPageNo = 1;
				this.snPageNo = 1;
				await this.loadDetailData();
				if (currentTab === 'sn' && this.snInitialLoaded) {
					await this.loadSnData(true);
				}
			},

			canEditSn(item) {
				return true;
			},

			canDeleteSn(item) {
				return true;
			},

			onSnEditClick(item) {
				this.editForm = {
					id: item.id || '',
					itemSn: item.itemSn || '',
					itemName: item.itemName || item.stockItemName || '',
					num: this.docData.snType === "5" ? item.invQty : item.itemQty || '',
					itemLot: item.itemLot || ''
				};
				this.$refs.editPopup.open();
			},

			closeEditModal() {
				this.$refs.editPopup.close();
				this.editForm = {
					id: '',
					itemSn: '',
					itemName: '',
					num: '',
					itemLot: ''
				};
			},

			async submitEdit() {
				if (!this.editForm.num) {
					uni.showToast({
						title: '请输入数量',
						icon: 'none'
					});
					return;
				}

				const num = parseFloat(this.editForm.num);

				if (isNaN(num) || num < 0) {
					uni.showToast({
						title: '请输入有效的数量',
						icon: 'none'
					});
					return;
				}

				if (this.docData.snType != "5" && num <= 0) {
					uni.showToast({
						title: '数量必须大于0',
						icon: 'none'
					});
					return;
				}

				if (!this.editForm.itemLot && this.docData.snType === "2") {
					uni.showToast({
						title: '请输入批次号',
						icon: 'none'
					});
					return;
				}

				if (this.editLoading) return;
				this.editLoading = true;

				try {
					const response = await updateSn({
						id: this.editForm.id,
						sn: this.editForm.itemSn,
						num: num,
						itemLot: this.editForm.itemLot,
						snType: this.docData.snType
					});

					const resData = response?.data || response;
					const isSuccess = resData &&
						(resData.success === true || (resData.success === undefined && resData.code === 200));

					if (isSuccess) {
						uni.showToast({
							title: '修改成功',
							icon: 'success'
						});

						await this.refreshAfterDelete();
						this.closeEditModal();
						this.$emit('sn-update-success', {
							id: this.editForm.id,
							sn: this.editForm.itemSn,
							num: num,
							itemLot: this.editForm.itemLot
						});
					} else {
						uni.showToast({
							title: resData?.message || resData?.msg || '修改失败',
							icon: 'none',
							duration: 3000
						});
					}
				} catch (error) {
					console.error('修改SN失败:', error);
					let errorMsg = '修改失败';

					if (error.response && error.response.data) {
						const resData = error.response.data;
						errorMsg = resData.message || resData.msg || resData.error || errorMsg;
					} else if (error.data) {
						errorMsg = error.data.message || error.data.msg || errorMsg;
					} else if (error.message) {
						errorMsg = error.message;
					}

					uni.showToast({
						title: errorMsg,
						icon: 'none',
						duration: 3000
					});
				} finally {
					this.editLoading = false;
				}
			},

			async onSnDeleteClick(item) {
				if (!item.id) {
					uni.showToast({
						title: 'SN ID不存在',
						icon: 'none'
					});
					return;
				}

				uni.showModal({
					title: '确认删除',
					content: `确定要删除SN码 "${item.itemSn}" 吗？`,
					confirmColor: '#ff4d4f',
					success: async (res) => {
						if (res.confirm) {
							await this.deleteSn(item);
						}
					}
				});
			},

			async deleteSn(item) {
				if (this.deleteLoading) return;
				this.deleteLoading = true;

				try {
					const response = await deleteSn({
						id: item.id,
						sn: item.itemSn,
						snType: this.docData.snType
					});

					const resData = response?.data || response;
					const isSuccess = resData &&
						(resData.success === true || (resData.success === undefined && resData.code === 200));

					if (isSuccess) {
						uni.showToast({
							title: '删除成功',
							icon: 'success'
						});

						await this.refreshAfterDelete();
						this.$emit('sn-delete-success', item);
					} else {
						uni.showToast({
							title: resData?.message || resData?.msg || '删除失败',
							icon: 'none',
							duration: 3000
						});
					}
				} catch (error) {
					console.error('删除SN失败:', error);
					let errorMsg = '删除失败';

					if (error.response && error.response.data) {
						const resData = error.response.data;
						errorMsg = resData.message || resData.msg || resData.error || errorMsg;
					} else if (error.data) {
						errorMsg = error.data.message || error.data.msg || errorMsg;
					} else if (error.message) {
						errorMsg = error.message;
					}

					uni.showToast({
						title: errorMsg,
						icon: 'none',
						duration: 3000
					});
				} finally {
					this.deleteLoading = false;
				}
			},

			getInvStatusText(invStatus) {
				return this.invStatusMap[invStatus] || (invStatus || '-');
			},

			getSnStatusText(status) {
				return this.snStatusMap[status] || (status || '-');
			},

			getSnStatusClass(status) {
				const statusMap = {
					'0': 'status-normal',
					'1': 'status-out',
					'2': 'status-in',
					'3': 'status-inv',
					'4': 'status-error'
				};
				return statusMap[status] || 'status-default';
			},

			onSubItemClick(item) {
				this.$emit('sub-item-click', item);
			},

			onSnItemClick(item) {
				this.$emit('sn-item-click', item);
			},

			onActionClick(action, item) {
				this.$emit('sub-item-action', {
					action,
					item
				});
			},

			onSnActionClick(action, item) {
				this.$emit('sn-item-action', {
					action,
					item
				});
			}
		}
	};
</script>

<style lang="scss" scoped>
	@import '@/common/page-theme-mixins.scss';

	.detail-container {
		height: 80vh;
		background: #fff;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
		transition: all 0.3s ease;
	}

	.tabs-container {
		border-bottom: 1rpx solid #f0f0f0;
		flex-shrink: 0;
		width: 100%;
	}

	.tabs {
		display: flex;
		padding: 0 32rpx;
		width: 100%;
		box-sizing: border-box;
	}

	.tab-item {
		flex: 1;
		text-align: center;
		padding: 24rpx 0;
		font-size: 28rpx;
		color: #666;
		position: relative;
		transition: all 0.3s ease;

		&.active {
			font-weight: 500;
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

	.loading-container,
	.error-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.error-container {
		flex-direction: column;
		padding: 80rpx 0;

		.error-text {
			font-size: 28rpx;
			color: #ff4d4f;
			margin: 24rpx 0;
		}

		.retry-btn {
			color: #fff;
			border: none;
			border-radius: 8rpx;
			padding: 16rpx 32rpx;
			font-size: 26rpx;

			&:active {
				opacity: 0.8;
			}
		}
	}

	.detail-content {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		width: 100%;
	}

	.tab-panel {
		flex: 1;
		padding: 32rpx;
		overflow: auto;
		width: 100%;
		box-sizing: border-box;
	}

	// 物料清单标签页独立样式
	.item-tab-panel {
		flex: 1;
		overflow: hidden;
		padding: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.info-card {
		background: #f8f9fa;
		border-radius: 12rpx;
		padding: 24rpx;
		width: 100%;
		box-sizing: border-box;
		transition: all 0.3s ease;
	}

	.info-list {
		width: 100%;

		.info-item {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			padding: 16rpx 0;
			width: 100%;
			box-sizing: border-box;

			&:not(:last-child) {
				border-bottom: 1rpx solid #f0f0f0;
			}

			.info-label {
				font-size: 26rpx;
				color: #666;
				flex-shrink: 0;
				width: 200rpx;
				transition: all 0.3s ease;
			}

			.info-value {
				flex: 1;
				font-size: 26rpx;
				color: #333;
				text-align: right;
				word-break: break-all;
				word-wrap: break-word;
				padding-left: 20rpx;
				transition: all 0.3s ease;
			}
		}
	}

	.table-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		overflow: hidden;
	}

	.pagination-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20rpx 32rpx;
		margin-bottom: 0;
		border-bottom: 1rpx solid #f0f0f0;
		flex-shrink: 0;
		width: 100%;
		box-sizing: border-box;
		background: #fff;

		.page-size-selector {
			display: flex;
			align-items: center;
			gap: 12rpx;
			font-size: 26rpx;
			color: #666;

			.picker-view {
				display: flex;
				align-items: center;
				gap: 8rpx;
				padding: 8rpx 16rpx;
				background: #f5f5f5;
				border-radius: 8rpx;
				font-size: 24rpx;
				color: #333;
				transition: all 0.3s ease;
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
				background: #f5f5f5;
				border-radius: 8rpx;
				transition: all 0.3s ease;

				&.disabled {
					opacity: 0.4;
				}

				&:active:not(.disabled) {
					background: #e0e0e0;
				}
			}

			.page-info {
				font-size: 26rpx;
				color: #666;
				min-width: 100rpx;
				text-align: center;
			}
		}
	}

	.table-scroll {
		flex: 1;
		width: 100%;
		min-height: 0;
	}

	.table-container {
		display: inline-block;
		min-width: 100%;
		background: #fff;
		border-radius: 12rpx;

		.table-header {
			background: #f5f5f5;
			border-radius: 12rpx 12rpx 0 0;
			position: sticky;
			top: 0;
			z-index: 10;

			.table-row {
				display: flex;
				background: #fafafa;
				border-bottom: 1rpx solid #e8e8e8;
			}

			.table-cell {
				font-weight: 600;
				color: #333;
				font-size: 26rpx;
				padding: 24rpx 16rpx;
				background: #f5f5f5;
				white-space: normal;
				word-break: break-word;
				transition: all 0.3s ease;
			}
		}

		.table-body {
			.table-row {
				display: flex;
				border-bottom: 1rpx solid #f0f0f0;
				cursor: pointer;
				transition: background 0.2s;

				&:hover {
					background: #fafafa;
				}

				&:active {
					background: #f5f5f5;
				}
			}

			.table-cell {
				font-size: 24rpx;
				color: #666;
				padding: 20rpx 16rpx;
				word-break: break-word;
				white-space: normal;
				transition: all 0.3s ease;
			}
		}

		.table-cell {
			flex-shrink: 0;
		}

		.col-index {
			width: 90rpx;
			min-width: 90rpx;
			text-align: center;
		}

		.col-name {
			width: 200rpx;
			min-width: 200rpx;
			text-align: center;
		}

		.col-unit {
			width: 100rpx;
			min-width: 80rpx;
			text-align: center;
		}

		.col-plan {
			width: 120rpx;
			min-width: 80rpx;
			text-align: center;
		}

		.col-receive-issue {
			width: 120rpx;
			min-width: 80rpx;
			text-align: center;
		}

		.col-warehouse {
			width: 200rpx;
			min-width: 140rpx;
			text-align: center;
		}

		.col-status {
			width: 100rpx;
			min-width: 80rpx;
			text-align: center;
		}

		.col-action {
			width: 120rpx;
			min-width: 80rpx;
			text-align: center;
		}
	}

	.delete-btn {
		display: inline-block;
		padding: 8rpx 20rpx;
		background: #fff;
		color: #ff4d4f !important;
		border: 1rpx solid #ff4d4f;
		border-radius: 8rpx;
		font-size: 24rpx;
		text-align: center;
		cursor: pointer;
		transition: all 0.3s ease;

		&:active {
			background: #fff1f0;
		}

		&.delete-disabled {
			color: #ccc !important;
			border-color: #ccc;
			opacity: 0.6;
			pointer-events: none;
		}
	}

	.sub-table-container {
		width: 100%;
		box-sizing: border-box;

		.sub-table-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 24rpx;
			flex-wrap: wrap;
			gap: 16rpx;

			.total-count {
				font-size: 26rpx;
				color: #666;
				transition: all 0.3s ease;
			}
		}
	}

	.sub-table-item {
		background: #f8f9fa;
		border-radius: 12rpx;
		padding: 24rpx;
		margin-bottom: 20rpx;
		width: 100%;
		box-sizing: border-box;
		transition: all 0.3s ease;

		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 16rpx;
			padding-bottom: 16rpx;
			border-bottom: 1rpx solid #e8e8e8;

			.item-index {
				font-size: 26rpx;
				font-weight: 500;
				transition: all 0.3s ease;
			}

			.item-status {
				font-size: 22rpx;
				padding: 4rpx 12rpx;
				border-radius: 4rpx;
				transition: all 0.3s ease;
			}

			.status-normal {
				background: #e6f7e6;
				color: #52c41a;
			}

			.status-out {
				background: #fff0e6;
				color: #fa8c16;
			}

			.status-in {
				background: #e6f0ff;
				color: #1677ff;
			}

			.status-inv {
				background: #f0e6ff;
				color: #722ed1;
			}

			.status-error {
				background: #ffe6e6;
				color: #ff4d4f;
			}

			.status-default {
				background: #f5f5f5;
				color: #666;
			}
		}
	}

	.item-content {
		width: 100%;

		.item-row {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			padding: 8rpx 0;
			width: 100%;
			box-sizing: border-box;

			&.highlight-row {
				background: #fff9e6;
				margin: -4rpx -8rpx;
				padding: 12rpx 8rpx;
				border-radius: 8rpx;
			}

			.field-label {
				font-size: 24rpx;
				color: #666;
				flex-shrink: 0;
				width: 160rpx;
				transition: all 0.3s ease;
			}

			.field-value {
				flex: 1;
				font-size: 24rpx;
				color: #333;
				text-align: right;
				word-break: break-all;
				word-wrap: break-word;
				padding-left: 20rpx;
				transition: all 0.3s ease;

				&.highlight-value {
					font-weight: 500;
				}
			}
		}
	}

	.item-actions {
		display: flex;
		justify-content: flex-end;
		gap: 16rpx;
		margin-top: 16rpx;
		padding-top: 16rpx;
		border-top: 1rpx solid #e8e8e8;

		.action-btn {
			display: flex;
			align-items: center;
			gap: 4rpx;
			padding: 8rpx 16rpx;
			background: #fff;
			border-radius: 6rpx;
			font-size: 22rpx;
			transition: all 0.3s ease;

			&:active {
				background: #f5f5f5;
			}

			&.edit-btn {
				border: 1rpx solid #1677ff;

				&:active {
					background: #e6f0ff;
				}
			}

			&.delete-btn {
				color: #ff4d4f;
				border: 1rpx solid #ff4d4f;

				&:active {
					background: #fff1f0;
				}
			}
		}
	}

	.load-more {
		padding: 32rpx 0;
		text-align: center;

		.no-more-text {
			font-size: 24rpx;
			color: #999;
		}
	}

	.empty-tip {
		text-align: center;
		padding: 80rpx 0;
		color: #ccc;

		.empty-text {
			display: block;
			margin-top: 16rpx;
			font-size: 26rpx;
		}
	}

	.edit-modal {
		width: 560rpx;
		background: #fff;
		border-radius: 24rpx;
		overflow: hidden;
		transition: all 0.3s ease;

		.modal-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 32rpx 32rpx 24rpx;
			border-bottom: 1rpx solid #f0f0f0;

			.modal-title {
				font-size: 32rpx;
				font-weight: 500;
				color: #333;
				transition: all 0.3s ease;
			}

			.modal-close {
				padding: 8rpx;
			}
		}

		.modal-content {
			padding: 32rpx;

			.form-item {
				margin-bottom: 24rpx;

				.form-label {
					display: block;
					font-size: 28rpx;
					color: #666;
					margin-bottom: 12rpx;
					transition: all 0.3s ease;
				}

				.form-value {
					display: block;
					font-size: 28rpx;
					color: #333;
					padding: 16rpx 0;
					border-bottom: 1rpx solid #f0f0f0;
					transition: all 0.3s ease;
				}

				.form-input {
					width: 100%;
					padding: 16rpx 0;
					font-size: 28rpx;
					color: #333;
					border-bottom: 1rpx solid #e0e0e0;
					transition: all 0.3s ease;

					&:focus {
						border-bottom-color: #1677ff;
					}
				}
			}
		}

		.modal-footer {
			display: flex;
			border-top: 1rpx solid #f0f0f0;

			button {
				flex: 1;
				height: 96rpx;
				line-height: 96rpx;
				font-size: 32rpx;
				border-radius: 0;
				background: #fff;
				transition: all 0.3s ease;

				&::after {
					border: none;
				}
			}

			.cancel-btn {
				color: #666;
				border-right: 1rpx solid #f0f0f0;
			}

			.confirm-btn {
				&[disabled] {
					color: #ccc;
				}
			}
		}
	}

	// ========== 小号样式 ==========
	.size-small {
		.tab-item {
			padding: 16rpx 0;
			font-size: 24rpx;
		}

		.tab-panel {
			padding: 20rpx;
		}

		.item-tab-panel {
			padding: 0;
		}

		.pagination-bar {
			padding: 12rpx 20rpx;
		}

		.info-card {
			padding: 16rpx;
			border-radius: 8rpx;
		}

		.info-list .info-item {
			padding: 10rpx 0;

			.info-label,
			.info-value {
				font-size: 22rpx;
			}

			.info-label {
				width: 160rpx;
			}
		}

		.table-header .table-cell {
			font-size: 22rpx;
			padding: 16rpx 12rpx;
		}

		.table-body .table-cell {
			font-size: 20rpx;
			padding: 14rpx 12rpx;
		}

		.delete-btn {
			padding: 6rpx 14rpx;
			font-size: 20rpx;
		}

		.sub-table-item {
			padding: 16rpx;
			border-radius: 8rpx;
		}

		.item-content .item-row .field-label,
		.item-content .item-row .field-value {
			font-size: 20rpx;
		}

		.field-label {
			width: 130rpx !important;
		}

		.item-actions .action-btn {
			padding: 6rpx 12rpx;
			font-size: 20rpx;
		}

		.edit-modal {
			width: 500rpx;

			.modal-header {
				padding: 24rpx 24rpx 20rpx;

				.modal-title {
					font-size: 28rpx;
				}
			}

			.modal-content {
				padding: 24rpx;

				.form-item {
					margin-bottom: 20rpx;

					.form-label,
					.form-value,
					.form-input {
						font-size: 24rpx;
					}
				}
			}

			.modal-footer button {
				height: 80rpx;
				line-height: 80rpx;
				font-size: 28rpx;
			}
		}
	}

	// ========== 大号样式 ==========
	.size-large {
		.tab-item {
			padding: 32rpx 0;
			font-size: 32rpx;
		}

		.tab-panel {
			padding: 40rpx;
		}

		.item-tab-panel {
			padding: 0;
		}

		.pagination-bar {
			padding: 24rpx 40rpx;
		}

		.info-card {
			padding: 32rpx;
			border-radius: 16rpx;
		}

		.info-list .info-item {
			padding: 22rpx 0;

			.info-label,
			.info-value {
				font-size: 30rpx;
			}

			.info-label {
				width: 240rpx;
			}
		}

		.table-header .table-cell {
			font-size: 30rpx;
			padding: 32rpx 20rpx;
		}

		.table-body .table-cell {
			font-size: 28rpx;
			padding: 26rpx 20rpx;
		}

		.delete-btn {
			padding: 12rpx 28rpx;
			font-size: 28rpx;
		}

		.sub-table-item {
			padding: 32rpx;
			border-radius: 16rpx;
		}

		.item-content .item-row .field-label,
		.item-content .item-row .field-value {
			font-size: 28rpx;
		}

		.field-label {
			width: 200rpx !important;
		}

		.item-actions .action-btn {
			padding: 12rpx 24rpx;
			font-size: 26rpx;
		}

		.edit-modal {
			width: 640rpx;

			.modal-header {
				padding: 40rpx 40rpx 32rpx;

				.modal-title {
					font-size: 36rpx;
				}
			}

			.modal-content {
				padding: 40rpx;

				.form-item {
					margin-bottom: 32rpx;

					.form-label,
					.form-value,
					.form-input {
						font-size: 32rpx;
					}
				}
			}

			.modal-footer button {
				height: 112rpx;
				line-height: 112rpx;
				font-size: 36rpx;
			}
		}
	}

	// ========== 深色模式 ==========
	.theme-dark {
		.detail-container {
			background: #0f0f1a;
		}

		.tabs-container {
			border-bottom-color: #2a2a45;
		}

		.tab-item {
			color: #888;

			&.active {
				color: #e0e0e0;
			}
		}

		.info-card {
			background: #1a1a2e;
		}

		.info-list .info-item {
			border-bottom-color: #2a2a45;

			.info-label {
				color: #888;
			}

			.info-value {
				color: #e0e0e0;
			}
		}

		.table-container {
			background: #1a1a2e;

			.table-header .table-cell {
				background: #1e1e36;
				color: #e0e0e0;
				border-bottom-color: #2a2a45;
			}

			.table-body .table-row {
				border-bottom-color: #2a2a45;

				&:hover {
					background: #1e1e36;
				}

				&:active {
					background: #252545;
				}
			}

			.table-body .table-cell {
				color: #ccc;
			}
		}

		.sub-table-item {
			background: #1a1a2e;

			.item-header {
				border-bottom-color: #2a2a45;

				.item-index {
					color: #e0e0e0;
				}
			}

			.item-content .item-row {
				.field-label {
					color: #888;
				}

				.field-value {
					color: #e0e0e0;
				}
			}

			.item-actions {
				border-top-color: #2a2a45;
			}
		}

		.pagination-bar {
			background: #1a1a2e;
			border-bottom-color: #2a2a45;

			.page-size-selector {
				color: #888;

				.picker-view {
					background: #252545;
					color: #e0e0e0;
				}
			}

			.page-controller {
				.page-btn {
					background: #252545;
				}

				.page-info {
					color: #888;
				}
			}
		}

		.edit-modal {
			background: #1a1a2e;

			.modal-header {
				border-bottom-color: #2a2a45;

				.modal-title {
					color: #e0e0e0;
				}
			}

			.modal-content {
				.form-label {
					color: #888;
				}

				.form-value {
					color: #e0e0e0;
					border-bottom-color: #2a2a45;
				}

				.form-input {
					color: #e0e0e0;
					border-bottom-color: #2a2a45;
				}
			}

			.modal-footer {
				border-top-color: #2a2a45;

				.cancel-btn {
					color: #888;
					border-right-color: #2a2a45;
				}
			}
		}

		.empty-tip {
			color: #666;
		}

		.load-more .no-more-text {
			color: #666;
		}
	}
</style>