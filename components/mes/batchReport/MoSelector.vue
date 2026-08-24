<!-- components/selectors/MoSelector.vue -->
<template>
	<!-- 工单选择弹窗 -->
	<uni-popup ref="moPopup" type="bottom">
		<view class="popup-container">
			<view class="popup-header">
				<view class="search-box">
					<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
					<input v-model="searchText" placeholder="搜索工单..." class="search-input" @input="handleSearch" />
					<view v-if="searchText" class="clear-btn" @click="handleClearSearch">
						<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
					</view>
				</view>
				<view class="close-btn" @click="handleClose">
					<text>取消</text>
				</view>
			</view>

			<scroll-view class="cmd-scroll" scroll-y @scrolltolower="handleScrollToLower">
				<view v-for="(item, index) in list" :key="index" class="cmd-item"
					:class="{selected: selectedValue === item.projectId }" @click="handleSelectItem(item)">
					<view class="cmd-content">
						<text class="cmd-name">{{ item.moNumber }}</text>
						<text class="cmd-desc">
							<text v-if="item.itemName">{{ item.itemName }}</text>
							<text v-if="item.cbItemCode"> | {{ item.cbItemCode }}</text>
						</text>
					</view>
					<view class="check-icon" v-if="selectedValue === item.projectId">
						<uni-icons type="checkmarkempty" size="16" color="var(--color-primary)"></uni-icons>
					</view>
				</view>

				<view v-if="loading" class="loading-tip">
					<text>加载中...</text>
				</view>

				<view v-if="!loading && list.length === 0" class="empty-tip">
					<text>暂无工单</text>
				</view>

				<view v-if="hasMore === false && list.length > 0" class="end-tip">
					<text>没有更多了</text>
				</view>
			</scroll-view>
		</view>
	</uni-popup>
</template>

<script>
	import {
		getOnlineMoList
	} from "@/api/mesApi.js";

	export default {
		name: 'MoSelector',
		props: {
			// 选中的工单ID
			value: {
				type: [String, Number],
				default: ''
			}
		},
		data() {
			return {
				list: [],
				searchText: "",
				loading: false,
				hasMore: true,
				searchTimer: null,
				pagination: {
					current: 1,
					size: 20,
					total: 0,
					pages: 0
				}
			}
		},
		computed: {
			selectedValue() {
				return this.value;
			}
		},
		methods: {
			// 打开弹窗
			open() {
				this.$refs.moPopup.open();
				this.handleLoadList(true);
			},

			// 关闭弹窗
			close() {
				this.$refs.moPopup.close();
			},

			// 搜索
			handleSearch() {
				clearTimeout(this.searchTimer);

				this.searchTimer = setTimeout(() => {
					this.handleLoadList(true);
				}, 500);
			},

			// 清空搜索
			handleClearSearch() {
				this.searchText = '';
				this.handleLoadList(true);
			},

			// 滚动到底部
			handleScrollToLower() {
				this.handleLoadList();
			},

			// 重置分页
			resetPagination() {
				this.pagination = {
					current: 1,
					size: 20,
					total: 0,
					pages: 0
				};
				this.hasMore = true;
			},

			// 加载列表
			async handleLoadList(reset = false) {
				if (this.loading) return;

				if (reset) {
					this.resetPagination();
					this.list = [];
				}

				if (!this.hasMore && !reset) return;

				this.loading = true;

				try {
					const data = {
						pageNo: this.pagination.current,
						pageSize: this.pagination.size
					};

					if (this.searchText) {
						data.moNumber = this.searchText;
					}

					const response = await getOnlineMoList(data);

					if (response && response.data && response.data.code === 200) {
						const result = response.data.result;
						const records = result.records || [];

						if (reset) {
							this.list = records;
						} else {
							this.list = [...this.list, ...records];
						}

						this.pagination.total = result.total || 0;
						this.pagination.pages = result.pages || 0;
						this.pagination.current = result.current || 1;
						this.pagination.size = result.size || 20;

						const hasMore = this.pagination.current < this.pagination.pages;
						this.hasMore = hasMore;

						if (records.length > 0 && hasMore) {
							this.pagination.current++;
						}
					} else {
						this.$emit('error', response?.data?.message || "获取工单失败");
					}
				} catch (error) {
					console.error("获取工单失败:", error);
					this.$emit('error', "获取工单列表失败");
				} finally {
					this.loading = false;
				}
			},

			// 选择工单
			handleSelectItem(item) {
				this.$emit('input', item.projectId);
				this.$emit('select', item);
				this.close();
			},

			// 关闭
			handleClose() {
				this.close();
				this.searchText = "";
			}
		}
	}
</script>

<style lang="scss" scoped>
	.popup-container {
		background: var(--color-bg-card);
		border-radius: 20rpx 20rpx 0 0;
		max-height: 80vh;
	}

	.popup-header {
		display: flex;
		align-items: center;
		padding: 24rpx;
		border-bottom: 1rpx solid var(--color-border);
		background: var(--color-bg-card);
	}

	.search-box {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 16rpx 20rpx;
		background: var(--color-bg-card);
		border-radius: 8rpx;
		margin-right: 20rpx;
		border: 1rpx solid var(--color-border);
	}

	.search-input {
		flex: 1;
		font-size: var(--font-lg);
		margin: 0 16rpx;
		color: var(--color-text);
	}

	.clear-btn {
		padding: 6rpx;
		background: var(--color-bg-page);
		border-radius: 50%;
	}

	.close-btn {
		padding: 12rpx 0;
		font-size: var(--font-lg);
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.cmd-scroll {
		max-height: 60vh;
	}

	.cmd-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 28rpx 24rpx;
		border-bottom: 1rpx solid var(--color-border);
		transition: all 0.3s;

		&:active {
			background: var(--color-bg-card);
		}

		&.selected {
			background: rgba(22, 119, 255, 0.04);
		}
	}

	.cmd-content {
		flex: 1;
		min-width: 0;
	}

	.cmd-name {
		display: block;
		font-size: var(--font-lg);
		color: var(--color-text);
		margin-bottom: 8rpx;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cmd-desc {
		font-size: var(--font-sm);
		color: #9c9c9c;
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.check-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.loading-tip,
	.empty-tip,
	.end-tip {
		padding: 60rpx 0;
		text-align: center;
		color: #9c9c9c;
		font-size: var(--font-md);
	}
</style>