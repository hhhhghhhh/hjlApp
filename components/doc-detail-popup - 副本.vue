<template>
	<uni-popup ref="popup" type="bottom" background-color="#fff" @change="onPopupChange">
		<view class="detail-container">
			<!-- 标签页 -->
			<view class="tabs-container">
				<view class="tabs">
					<view class="tab-item" :class="{ active: activeTab === 'main' }" @click="activeTab = 'main'">
						<text>单据信息</text>
					</view>
					<view class="tab-item" :class="{ active: activeTab === 'item' }" @click="switchToItemTab">
						<text>物料清单</text>
					</view>
					<view class="tab-item" :class="{ active: activeTab === 'sn' }" @click="switchToSnTab">
						<text>SN清单</text>
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
				<button class="retry-btn" @click="loadDetailData">重试</button>
			</view>

			<!-- 内容区域 -->
			<view class="detail-content" v-else>
				<!-- 主表信息 -->
				<scroll-view class="tab-panel" scroll-y v-show="activeTab === 'main'">
					<view class="info-card">
						<view class="info-list">
							<view class="info-item">
								<text class="info-label">单据编号：</text>
								<text class="info-value">{{ docData.docNo || '-' }}</text>
							</view>

							<view v-if="docData.snType !== '5'" class="info-item">
								<text class="info-label">单据状态：</text>
								<text class="info-value">{{ docData.docStatus_dictText || '-' }}</text>
							</view>

							<!-- 盘点单 -->
							<view v-if="docData.snType == '5'" class="info-item">
								<text class="info-label">单据状态：</text>
								<text class="info-value">{{ docData.invDocStatus_dictText || '-' }}</text>
							</view>
							<view v-if="docData.snType == '5'" class="info-item">
								<text class="info-label">盘点日期：</text>
								<text class="info-value">{{ docData.invDate || '-' }}</text>
							</view>

							<!-- 调拨单 -->
							<view v-if="docData.snType == '4'" class="info-item">
								<text class="info-label">调入组织：</text>
								<text class="info-value">{{ docData.dataAuthIn_dictText || '-' }}</text>
							</view>
							<view v-if="docData.snType == '4'" class="info-item">
								<text class="info-label">计划调拨时间：</text>
								<text class="info-value">{{ docData.planAllotDate || '-' }}</text>
							</view>
							<view v-if="docData.snType == '4'" class="info-item">
								<text class="info-label">实际调拨时间：</text>
								<text class="info-value">{{ docData.allotDate || '-' }}</text>
							</view>

							<!-- 入库单 -->
							<view v-if="docData.snType == '2'" class="info-item">
								<text class="info-label">计划入库时间：</text>
								<text class="info-value">{{ docData.planReceiveDate || '-' }}</text>
							</view>
							<view v-if="docData.snType == '2'" class="info-item">
								<text class="info-label">实际入库时间：</text>
								<text class="info-value">{{ docData.receiveDate || '-' }}</text>
							</view>

							<!-- 出库单 -->
							<view v-if="docData.snType == '3'" class="info-item">
								<text class="info-label">计划出库时间：</text>
								<text class="info-value">{{ docData.planOutstockDate || '-' }}</text>
							</view>
							<view v-if="docData.snType == '3'" class="info-item">
								<text class="info-label">实际出库时间：</text>
								<text class="info-value">{{ docData.outstockDate || '-' }}</text>
							</view>

							<!-- 通用字段 -->
							<view class="info-item">
								<text class="info-label">供应商：</text>
								<text class="info-value">{{ docData.supplierId_dictText || '-' }}</text>
							</view>
							<view class="info-item">
								<text class="info-label">客户：</text>
								<text class="info-value">{{ docData.custId_dictText || '-' }}</text>
							</view>
							<view class="info-item">
								<text class="info-label">开单人：</text>
								<text class="info-value">{{ docData.createBy || '-' }}</text>
							</view>
							<view class="info-item">
								<text class="info-label">开单时间：</text>
								<text class="info-value">{{ docData.createTime || '-' }}</text>
							</view>
						</view>
					</view>
				</scroll-view>

				<!-- 物料清单 - 表格形式 -->
				<view class="tab-panel" v-show="activeTab === 'item'">
					<view class="table-wrapper">
						<!-- 分页控制栏 -->
						<view class="pagination-bar">
							<view class="page-size-selector">
								<text>每页显示：</text>
								<picker @change="onItemPageSizeChange" :value="itemPageSizeIndex"
									:range="pageSizeOptions">
									<view class="picker-view">
										{{ itemPageSize }}条
										<uni-icons type="arrowdown" size="14" color="#666"></uni-icons>
									</view>
								</picker>
							</view>
							<view class="page-controller">
								<view class="page-btn" :class="{ disabled: itemPageNo <= 1 }" @click="onItemPrevPage">
									<uni-icons type="arrowleft" size="16" color="#666"></uni-icons>
								</view>
								<text class="page-info">{{ itemPageNo }} / {{ itemTotalPages }}</text>
								<view class="page-btn" :class="{ disabled: itemPageNo >= itemTotalPages }"
									@click="onItemNextPage">
									<uni-icons type="arrowright" size="16" color="#666"></uni-icons>
								</view>
							</view>
						</view>

						<!-- 表格容器 - 支持横向滚动 -->
						<scroll-view class="table-scroll" scroll-x="true" scroll-y="true">
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
										<view class="table-cell col-action" v-if="showSubItemActions">操作</view>
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
											{{ item.status_dictText|| item.itemStatus_dictText || '-' }}
										</view>
										<view class="table-cell col-action" v-if="showSubItemActions">
											<view class="delete-btn"
												:class="{ 'delete-disabled': !canDeleteSubItem(item) }"
												@click.stop="onSubItemDeleteClick(item)">
												<text>删除</text>
											</view>
										</view>
									</view>
								</view>
								<view class="empty-tip" v-else>
									<uni-icons type="info" size="48" color="#ccc"></uni-icons>
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
										{{ item.itemStatus_dictText || '-' }}
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
										<text class="field-value">{{ item.itemCode || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">物料名称：</text>
										<text class="field-value">{{ item.itemName || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">规格型号：</text>
										<text class="field-value">{{ item.itemSpec || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">生产批次：</text>
										<text class="field-value">{{ item.itemLot || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">仓库：</text>
										<text class="field-value">{{ item.whId_dictText || '-' }}</text>
									</view>
									<view class="item-row">
										<text class="field-label">库区：</text>
										<text class="field-value">{{ item.districtId_dictText || '-' }}</text>
									</view>
									<view class="item-row">
										<text class="field-label">库位：</text>
										<text class="field-value">{{ item.storageId_dictText || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">数量：</text>
										<text class="field-value">{{ item.itemQty || '-' }}</text>
									</view>
									<view class="item-row">
										<text class="field-label">单位：</text>
										<text class="field-value">{{ item.erpUnitName || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">交接人：</text>
										<text class="field-value">{{ item.handoverEmp || '-' }}</text>
									</view>

									<view class="item-row">
										<text class="field-label">交接时间：</text>
										<text class="field-value">{{ item.handoverTime || '-' }}</text>
									</view>

									<view v-if="docData.snType === '5'" class="item-row">
										<text class="field-label">盘点数量：</text>
										<text class="field-value">{{ item.invQty || '-' }}</text>
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
							<uni-icons type="info" size="48" color="#ccc"></uni-icons>
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
			<view class="edit-modal">
				<view class="modal-header">
					<text class="modal-title">修改SN信息</text>
					<view class="modal-close" @click="closeEditModal">
						<uni-icons type="closeempty" size="20" color="#999"></uni-icons>
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
					<view class="form-item">
						<text class="form-label">批次号：</text>
						<input class="form-input" v-model="editForm.itemLot" placeholder="请输入批次号" />
					</view>
				</view>
				<view class="modal-footer">
					<button class="cancel-btn" @click="closeEditModal">取消</button>
					<button class="confirm-btn" @click="submitEdit" :disabled="editLoading">确定</button>
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

	export default {
		name: "DocDetailPopup",
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
				itemList: [], // 物料清单
				snList: [], // SN清单
				deleteLoading: false,
				subItemDeleteLoading: false,

				// 物料清单分页
				itemPageNo: 1,
				itemPageSize: 10,
				itemTotal: 0,
				pageSizeOptions: ['10条', '20条', '50条', '100条'],
				pageSizeValues: [10, 20, 50, 100],

				// SN清单分页
				snPageNo: 1,
				snPageSize: 10,
				snTotal: 0,
				snRefreshing: false,
				snLoadingMore: false,
				snNoMore: false,
				snInitialLoaded: false, // 标记是否已初始加载

				// 修改弹窗相关
				editPopupVisible: false,
				editForm: {
					itemSn: '',
					itemName: '',
					num: '',
					itemLot: ''
				},
				editLoading: false
			};
		},
		computed: {
			// 根据单据类型动态返回收料数/发料数的列名
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
		methods: {
			async open() {
				if (!this.docData || !this.docData.id) {
					console.error('单据数据或单据ID不能为空');
					this.$emit('error', new Error('单据数据或单据ID不能为空'));
					return;
				}

				// 重置状态
				this.activeTab = 'main';
				this.resetPagination();
				this.snInitialLoaded = false;

				this.$refs.popup.open();
				await this.loadDetailData();
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
				// 如果物料清单为空，重新加载
				if (this.itemList.length === 0 && this.itemTotal === 0) {
					this.loadItemData();
				}
			},

			switchToSnTab() {
				this.activeTab = 'sn';
				// 如果SN清单未加载过，则加载
				if (!this.snInitialLoaded) {
					this.loadSnData(true);
					this.snInitialLoaded = true;
				}
			},

			// 加载物料清单数据
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
				}
			},

			// 加载SN清单数据
			async loadSnData(isRefresh = false) {
				// 防止重复请求
				if (isRefresh) {
					this.snRefreshing = true;
					this.snPageNo = 1;
					this.snNoMore = false;
				} else {
					// 上拉加载时检查条件
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

			// SN下拉刷新
			async onSnRefresh() {
				await this.loadSnData(true);
			},

			// SN上拉加载更多
			async onSnLoadMore() {
				if (this.snNoMore || this.snLoadingMore) {
					return;
				}
				await this.loadSnData(false);
			},

			// 解析响应数据
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

			// 物料清单分页切换
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

			// 获取单位
			getUnit(item) {
				return item.unitName || item.itemUnit || item.unit || '-';
			},

			// 获取计划数量
			getPlanQty(item) {
				return item.planQty || item.stockQty || '-';
			},

			// 根据单据类型获取收料数或发料数
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

			// 获取仓库名称
			getWarehouseName(item) {
				const snType = this.docData?.snType;
				if (snType === '4') {
					return item.outWhId_dictText || item.outWhName || item.whId_dictText || '-';
				} else {
					return item.whId_dictText || item.whName || '-';
				}
			},

			// 获取物料清单删除接口
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

			// 判断是否可以删除物料清单
			canDeleteSubItem(item) {

				if (!item.id) {
					return false;
				}
				if (this.docData?.snType === '5') {
					return false;
				}



				return true;
			},

			// 物料清单删除点击
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



			// 执行物料清单删除
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
					// 直接传递 id 参数
					const response = await deleteApi(item.id);

					// 处理响应 - 兼容不同的返回格式
					const resData = response?.data || response;
					// 修复：同时判断 success 和 code
					// 只有当 success !== false 且 code === 200 时才视为成功
					const isSuccess = resData &&
						(resData.success === true || (resData.success === undefined && resData.code === 200));


					if (isSuccess) {
						// 刷新物料清单和SN清单
						await this.refreshAfterDelete();

						this.$emit('sub-item-delete-success', item);
						uni.showToast({
							title: resData.message || '删除成功',
							icon: 'success',
							duration: 3000
						});

					} else {

						// 失败时显示后端返回的错误信息
						uni.showToast({
							title: resData?.message || resData?.msg || '删除失败',
							icon: 'none',
							duration: 3000
						});
					}
				} catch (error) {
					console.error('删除物料清单失败:', error);
					let errorMsg = '删除失败';

					// 处理后端返回的业务错误（如实收数量大于0的提示）
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

			// 删除后刷新物料清单和SN清单
			async refreshAfterDelete() {
				// 保存当前选中的标签页
				const currentTab = this.activeTab;

				// 重置分页
				this.itemPageNo = 1;
				this.snPageNo = 1;

				// 重新加载数据
				await this.loadDetailData();

				// 如果当前在SN标签页且SN清单已加载标记为true，重新加载SN数据
				if (currentTab === 'sn' && this.snInitialLoaded) {
					await this.loadSnData(true);
				}
			},

			// 判断是否可以修改SN
			canEditSn(item) {
				return this.docData.snType !== '5' && item.itemStatus === '2';
			},

			// 判断是否可以删除SN
			canDeleteSn(item) {
				return this.docData.snType !== '5' && item.itemStatus === '2';
			},

			// 打开修改弹窗
			onSnEditClick(item) {
				this.editForm = {
					itemSn: item.itemSn || '',
					itemName: item.itemName || '',
					num: item.itemQty || '',
					itemLot: item.itemLot || ''
				};
				this.$refs.editPopup.open();
			},

			// 关闭修改弹窗
			closeEditModal() {
				this.$refs.editPopup.close();
				this.editForm = {
					itemSn: '',
					itemName: '',
					num: '',
					itemLot: ''
				};
			},

			// 提交修改
			async submitEdit() {
				if (!this.editForm.num) {
					uni.showToast({
						title: '请输入数量',
						icon: 'none'
					});
					return;
				}

				const num = parseFloat(this.editForm.num);
				if (isNaN(num) || num <= 0) {
					uni.showToast({
						title: '数量必须大于0',
						icon: 'none'
					});
					return;
				}

				if (!this.editForm.itemLot) {
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
						sn: this.editForm.itemSn,
						num: num,
						itemLot: this.editForm.itemLot,
						snType: this.docData.snType
					});

					if (response.data && response.data.success) {
						uni.showToast({
							title: '修改成功',
							icon: 'success'
						});

						// 刷新数据
						await this.refreshAfterDelete();

						this.closeEditModal();
						this.$emit('sn-update-success', {
							sn: this.editForm.itemSn,
							num: num,
							itemLot: this.editForm.itemLot
						});
					} else {
						uni.showToast({
							title: response.data?.message || response.data?.msg || '修改失败',
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

			// 删除SN
			async onSnDeleteClick(item) {
				if (!item.itemSn) {
					uni.showToast({
						title: 'SN编码不存在',
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

			// 执行删除操作
			async deleteSn(item) {
				if (this.deleteLoading) return;
				this.deleteLoading = true;

				try {
					const response = await deleteSn({
						sn: item.itemSn,
						snType: this.docData.snType
					});

					if (response.data && response.data.success) {
						uni.showToast({
							title: '删除成功',
							icon: 'success'
						});

						// 刷新物料清单和SN清单
						await this.refreshAfterDelete();

						this.$emit('sn-delete-success', item);
					} else {
						uni.showToast({
							title: response.data?.message || response.data?.msg || '删除失败',
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
	.detail-container {
		height: 80vh;
		background: #fff;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
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

		&.active {
			color: #1677ff;
			font-weight: 500;

			&::after {
				content: '';
				position: absolute;
				bottom: 0;
				left: 50%;
				transform: translateX(-50%);
				width: 60rpx;
				height: 4rpx;
				background: #1677ff;
				border-radius: 2rpx;
			}
		}
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
			background: #1677ff;
			color: #fff;
			border: none;
			border-radius: 8rpx;
			padding: 16rpx 32rpx;
			font-size: 26rpx;

			&:active {
				background: #0958d9;
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

	.info-card {
		background: #f8f9fa;
		border-radius: 12rpx;
		padding: 24rpx;
		width: 100%;
		box-sizing: border-box;
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
			}

			.info-value {
				flex: 1;
				font-size: 26rpx;
				color: #333;
				text-align: right;
				word-break: break-all;
				word-wrap: break-word;
				padding-left: 20rpx;
			}
		}
	}

	// 物料清单表格样式
	.table-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.pagination-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20rpx 0;
		margin-bottom: 16rpx;
		border-bottom: 1rpx solid #f0f0f0;
		flex-shrink: 0;
		width: 100%;
		box-sizing: border-box;

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
		white-space: nowrap;
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
			}
		}

		.table-cell {
			flex-shrink: 0;
		}

		// 列宽设置
		.col-index {
			width: 90rpx;
			min-width: 90rpx;
			text-align: center;
		}

		.col-name {
			width: 140rpx;
			min-width: 140rpx;
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
			width: 100rpx;
			min-width: 80rpx;
			text-align: center;
		}
	}

	// 物料清单删除按钮独立样式 - 修复样式覆盖问题
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

		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 16rpx;
			padding-bottom: 16rpx;
			border-bottom: 1rpx solid #e8e8e8;

			.item-index {
				font-size: 26rpx;
				color: #1677ff;
				font-weight: 500;
			}

			.item-status {
				font-size: 22rpx;
				padding: 4rpx 12rpx;
				border-radius: 4rpx;
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
			}

			.field-value {
				flex: 1;
				font-size: 24rpx;
				color: #333;
				text-align: right;
				word-break: break-all;
				word-wrap: break-word;
				padding-left: 20rpx;

				&.highlight-value {
					color: #1677ff;
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

			&:active {
				background: #f5f5f5;
			}

			&.edit-btn {
				color: #1677ff;
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

	// 修改弹窗样式
	.edit-modal {
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

			.modal-title {
				font-size: 32rpx;
				font-weight: 500;
				color: #333;
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
				}

				.form-value {
					display: block;
					font-size: 28rpx;
					color: #333;
					padding: 16rpx 0;
					border-bottom: 1rpx solid #f0f0f0;
				}

				.form-input {
					width: 100%;
					padding: 16rpx 0;
					font-size: 28rpx;
					color: #333;
					border-bottom: 1rpx solid #e0e0e0;

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

				&::after {
					border: none;
				}
			}

			.cancel-btn {
				color: #666;
				border-right: 1rpx solid #f0f0f0;
			}

			.confirm-btn {
				color: #1677ff;

				&[disabled] {
					color: #ccc;
				}
			}
		}
	}
</style>