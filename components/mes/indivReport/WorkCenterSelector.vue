<template>
	<view>
		<!-- 工作中心选择器 -->
		<view class="search-selector" @click="handleShowSelector">
			<text class="selector-text" :class="{placeholder: !selectedValue}">
				{{ selectedValue || '选择工作中心' }}
			</text>
			<uni-icons type="arrowdown" size="16" color="#9c9c9c"></uni-icons>
		</view>

		<!-- 工作中心选择弹窗 -->
		<uni-popup ref="popup" type="bottom">
			<view class="popup-container">
				<view class="popup-header">
					<view class="search-box">
						<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
						<input v-model="search" placeholder="搜索工作中心..." class="search-input"
							@input="handleSearch" />
						<view v-if="search" class="clear-btn" @click="handleClearSearch">
							<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
						</view>
					</view>
					<view class="close-btn" @click="closeSelector">
						<text>取消</text>
					</view>
				</view>

				<scroll-view class="cmd-scroll" scroll-y @scrolltolower="handleScrollToLower">
					<view v-for="(item, index) in list" :key="index" class="cmd-item"
						:class="{selected: selectedId === item.id}" @click="handleSelect(item)">
						<view class="cmd-content">
							<text class="cmd-name">{{ item.areaName }}</text>
							<text class="cmd-desc">
								<text v-if="item.xtName">线别：{{ item.xtName }}</text>
								<text v-if="item.groupName"> | 工序：{{ item.groupName }}</text>
							</text>
						</view>
						<view class="check-icon" v-if="selectedId === item.id">
							<uni-icons type="checkmarkempty" size="16" color="#1677ff"></uni-icons>
						</view>
					</view>

					<!-- 加载更多 -->
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
	</view>
</template>

<script>
import { getWorkCenterList } from "@/api/mesApi.js";

export default {
	props: {
		selectedValue: {
			type: String,
			default: ""
		}
	},
	
	data() {
		return {
			// 列表数据
			list: [],
			loading: false,
			hasMore: true,
			
			// 搜索相关
			search: "",
			searchTimer: null,
			
			// 分页相关
			pagination: {
				current: 1,
				size: 20,
				total: 0,
				pages: 0
			},
			
			// 选中的ID
			selectedId: ""
		}
	},
	
	methods: {
		/**
		 * 显示选择器
		 */
		handleShowSelector() {
			this.$refs.popup.open();
			this.loadList(true);
		},
		
		/**
		 * 关闭选择器
		 */
		closeSelector() {
			this.$refs.popup.close();
			this.search = "";
		},
		
		/**
		 * 搜索
		 */
		handleSearch() {
			clearTimeout(this.searchTimer);
			
			this.searchTimer = setTimeout(() => {
				this.loadList(true);
			}, 500);
		},
		
		/**
		 * 清空搜索
		 */
		handleClearSearch() {
			this.search = '';
			this.loadList(true);
		},
		
		/**
		 * 滚动到底部
		 */
		handleScrollToLower() {
			this.loadList();
		},
		
		/**
		 * 重置分页
		 */
		resetPagination() {
			this.pagination = {
				current: 1,
				size: 20,
				total: 0,
				pages: 0
			};
			this.hasMore = true;
		},
		
		/**
		 * 加载列表
		 */
		async loadList(reset = false) {
			if (this.loading) return;
			
			if (reset) {
				this.resetPagination();
				this.list = [];
			}
			
			if (!this.hasMore && !reset) return;
			
			this.loading = true;
			
			try {
				const params = {
					pageNo: this.pagination.current,
					pageSize: this.pagination.size
				};
				
				if (this.search) {
					params.areaName = this.search;
				}
				
				const response = await getWorkCenterList(params);
				
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
				}
			} catch (error) {
				console.error("获取工作中心失败:", error);
			} finally {
				this.loading = false;
			}
		},
		
		/**
		 * 选择工作中心
		 */
		handleSelect(item) {
			this.selectedId = item.id;
			this.$emit('select', item);
			this.closeSelector();
		}
	}
}
</script>

<style lang="scss" scoped>
.search-selector {
	display: flex;
	align-items: center;
	padding: 24rpx;
	background: #f8f9fa;
	border-radius: 8rpx;
	margin-bottom: 20rpx;
	border: 1rpx solid #e8e8e8;
	transition: all 0.3s;
	
	&:active {
		background: #f0f7ff;
		border-color: #1677ff;
	}
}

.selector-text {
	flex: 1;
	font-size: 28rpx;
	color: #333;
	margin: 0 12rpx;
	font-weight: 500;
	
	&.placeholder {
		color: #9c9c9c;
		font-weight: normal;
	}
}

.popup-container {
	background: #fff;
	border-radius: 20rpx 20rpx 0 0;
	max-height: 80vh;
}

.popup-header {
	display: flex;
	align-items: center;
	padding: 24rpx;
	border-bottom: 1rpx solid #f0f0f0;
	background: #fafafa;
}

.search-box {
	flex: 1;
	display: flex;
	align-items: center;
	padding: 16rpx 20rpx;
	background: #fff;
	border-radius: 8rpx;
	margin-right: 20rpx;
	border: 1rpx solid #e8e8e8;
}

.search-input {
	flex: 1;
	font-size: 28rpx;
	margin: 0 16rpx;
	color: #333;
}

.clear-btn {
	padding: 6rpx;
	background: #f5f5f5;
	border-radius: 50%;
}

.close-btn {
	padding: 12rpx 0;
	font-size: 30rpx;
	color: #666;
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
	border-bottom: 1rpx solid #f5f5f5;
	transition: all 0.3s;
	
	&:active {
		background: #fafafa;
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
	font-size: 30rpx;
	color: #333;
	margin-bottom: 8rpx;
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.cmd-desc {
	font-size: 24rpx;
	color: #9c9c9c;
	display: block;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.check-icon {
	padding-left: 20rpx;
}

.loading-tip,
.empty-tip,
.end-tip {
	padding: 60rpx 0;
	text-align: center;
	color: #9c9c9c;
	font-size: 26rpx;
}
</style>