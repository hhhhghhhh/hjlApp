<template>
	<!-- 工作中心选择弹窗 -->
	<uni-popup ref="workCenterPopup" type="bottom">
		<view class="popup-container">
			<view class="popup-header">
				<view class="search-box">
					<!-- <uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
					<input v-model="searchText" placeholder="搜索工作中心..." class="search-input" @input="handleSearch" />
					<view v-if="searchText" class="clear-btn" @click="handleClearSearch">
						<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
					</view> -->
				</view>
				<view class="close-btn" @click="handleClose">
					<text>取消</text>
				</view>
			</view>

			<scroll-view class="cmd-scroll" scroll-y @scrolltolower="handleScrollToLower">
				<view v-for="(item, index) in list" :key="index" class="cmd-item"
					:class="{selected: selectedValue === item.id}" @click="handleSelectItem(item)">
					<view class="cmd-content">
						<text class="cmd-name">{{ item.areaName }}</text>
						<text class="cmd-desc">
							<text v-if="item.xtName">线别：{{ item.xtName }}</text>
						</text>
					</view>
					<view class="check-icon" v-if="selectedValue === item.id">
						<uni-icons type="checkmarkempty" size="16" color="var(--color-primary)"></uni-icons>
					</view>
				</view>

				<view v-if="loading" class="loading-tip">
					<text>加载中...</text>
				</view>

				<view v-if="!loading && list.length === 0" class="empty-tip">
					<text>暂无工作中心</text>
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
		batchGetWorkCenterList
	} from "@/api/mesApi.js";

	export default {
		name: 'WorkCenterSelector',
		props: {
			// 选中的工作中心ID
			value: {
				type: [String, Number],
				default: ''
			},
			// 工单ID
			moId: {
				type: [String, Number],
				required: true
			},
			// 工序ID
			groupId: {
				type: [String, Number],
				required: true
			},
			// 是否自动选择（当只有一个工作中心时）
			autoSelect: {
				type: Boolean,
				default: true
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
				},
				isAutoSelecting: false // 防止重复自动选择
			}
		},
		computed: {
			selectedValue() {
				return this.value;
			}
		},
		watch: {
			// 监听工单和工序变化，重新加载工作中心
			moId: {
				immediate: true,
				handler(newVal) {
					if (newVal && this.groupId) {
						this.handleLoadList(true);
					}
				}
			},
			groupId: {
				immediate: true,
				handler(newVal) {
					if (newVal && this.moId) {
						this.handleLoadList(true);
					}
				}
			}
		},
		methods: {
			// 打开弹窗
			open() {
				this.$refs.workCenterPopup.open();
				this.handleLoadList(true);
			},

			// 关闭弹窗
			close() {
				this.$refs.workCenterPopup.close();
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
				if (!this.moId || !this.groupId) return;
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
						pageSize: this.pagination.size,
						moId: this.moId,
						groupId: this.groupId
					};

					if (this.searchText) {
						data.areaName = this.searchText;
					}

					const response = await batchGetWorkCenterList(data);

					if (response && response.data && response.data.code === 200) {
						const result = response.data.result;
						const areaList = result?.areaList || [];

						if (reset) {
							this.list = areaList;
						} else {
							this.list = [...this.list, ...areaList];
						}

						if (areaList.length > 0) {
							this.pagination.current++;
						}

						// 简单判断是否有更多
						this.hasMore = areaList.length >= this.pagination.size;

						// 如果列表只有一个工作中心且autoSelect为true，自动选择
						if (this.autoSelect && !this.isAutoSelecting && this.list.length === 1 && !this.selectedValue) {
							this.isAutoSelecting = true;
							setTimeout(() => {
								this.handleAutoSelect(this.list[0]);
							}, 100);
						}

						if (this.list.length === 0) {
							this.$emit('warning', "当前工序无工作中心");
						}
					}
				} catch (error) {
					console.error("获取工作中心失败:", error);
					this.$emit('error', "获取工作中心失败");
				} finally {
					this.loading = false;
				}
			},

			// 自动选择工作中心
			handleAutoSelect(item) {
				if (this.isAutoSelecting) {
					this.$emit('input', item.id);
					this.$emit('select', item);
					this.$emit('auto-select', item); // 新增事件，通知父组件是自动选择的
					this.isAutoSelecting = false;
				}
			},

			// 选择工作中心
			handleSelectItem(item) {
				this.$emit('input', item.id);
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
		//background: var(--color-bg-card);
		//border-radius: 8rpx;
		margin-right: 20rpx;
		//border: 1rpx solid var(--color-border);
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