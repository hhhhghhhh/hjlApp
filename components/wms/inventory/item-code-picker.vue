<!-- components/item-code-picker.vue -->
<template>
	<view class="item-code-picker">
		<!-- 选择器触发区域 -->
		<view class="picker-trigger" @click="handleTriggerClick">
			<text class="trigger-text" :class="{ placeholder: !displayText }">
				{{ displayText || '选择物料编码' }}
			</text>
			<view class="trigger-icons">
				<view v-if="displayText" class="clear-icon-wrapper" @click.stop="handleClear">
					<uni-icons type="clear" size="16" color="#9c9c9c"></uni-icons>
				</view>
				<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
			</view>
		</view>

		<!-- 物料编码选择器弹窗 -->
		<uni-popup ref="popup" type="bottom" @maskClick="showPopup = false">
			<view class="popup-container">
				<!-- 弹窗头部 -->
				<view class="popup-header">
					<text class="popup-title">选择物料编码</text>
					<view class="close-btn" @click="showPopup = false">
						<text>取消</text>
					</view>
				</view>
				
				<!-- 搜索条件区域 -->
				<view class="search-conditions">
					<view class="search-row">
						<view class="search-input-item">
							<view class="input-wrapper">
								<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
								<input 
									v-model="searchForm.itemCode" 
									class="search-input" 
									placeholder="物料编码"
									@input="onSearchInput"
									placeholder-style="color: #999; font-size: 24rpx;"
									confirm-type="search"
								/>
								<view class="clear-btn" v-if="searchForm.itemCode" @click="clearItemCode">
									<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
								</view>
							</view>
						</view>
						
						<view class="search-input-item">
							<view class="input-wrapper">
								<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
								<input 
									v-model="searchForm.itemName" 
									class="search-input" 
									placeholder="物料名称"
									@input="onSearchInput"
									placeholder-style="color: #999; font-size: 24rpx;"
									confirm-type="search"
								/>
								<view class="clear-btn" v-if="searchForm.itemName" @click="clearItemName">
									<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
								</view>
							</view>
						</view>
					</view>
				</view>

				<!-- 选项列表 -->
				<scroll-view class="options-scroll" scroll-y :style="{ height: '60vh' }">
					<view 
						v-for="(item, index) in itemCodeList" 
						:key="item.id" 
						class="material-item"
						:class="{ selected: isSelected(item) }"
						@click="handleSelect(item)"
					>
						<view class="material-header">
							<text class="material-code">{{ item.itemCode }}</text>
							<text v-if="item.status" class="material-status" :class="getStatusClass(item.status)">
								{{ getStatusText(item.status) }}
							</text>
						</view>
						
						<view class="material-info">
							<text class="material-name">{{ item.itemName }}</text>
							<view class="check-icon" v-if="isSelected(item)">
								<uni-icons type="checkmarkempty" size="16" color="#1677ff"></uni-icons>
							</view>
						</view>
						
						<view class="material-spec" v-if="item.itemSpec">
							<text class="material-spec-text">{{ item.itemSpec }}</text>
						</view>
						
						<view class="material-footer" v-if="item.itemUnit || item.itemType">
							<text class="material-unit" v-if="item.itemUnit">单位：{{ item.itemUnit }}</text>
							<text class="material-type" v-if="item.itemType">类型：{{ item.itemType }}</text>
						</view>
					</view>

					<!-- 空状态 -->
					<view v-if="itemCodeList.length === 0 && !loading" class="empty-state">
						<image src="/static/empty.png" class="empty-image" mode="aspectFit"></image>
						<text class="empty-text">暂无物料数据</text>
					</view>
					
					<!-- 加载更多 -->
					<view v-if="loading" class="load-more">
						<uni-load-more status="loading" content="正在加载..."></uni-load-more>
					</view>
					
					<view v-if="noMore && itemCodeList.length > 0" class="load-more">
						<text class="no-more-text">没有更多了</text>
					</view>
				</scroll-view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
export default {
	name: 'ItemCodePicker',
	props: {
		// 选中的物料ID
		value: {
			type: [String, Number],
			default: ''
		},
		// 物料列表
		list: {
			type: Array,
			default: () => []
		},
		// 加载状态
		loading: {
			type: Boolean,
			default: false
		},
		// 是否没有更多数据
		noMore: {
			type: Boolean,
			default: false
		},
		// 初始搜索条件
		initialSearchForm: {
			type: Object,
			default: () => ({
				itemCode: '',
				itemName: '',
				itemSpec: ''
			})
		}
	},
	
	data() {
		return {
			showPopup: false,
			searchForm: {
				itemCode: '',
				itemName: ''
			},
			searchTimer: null
		}
	},
	
	computed: {
		// 显示文本
		displayText() {
			if (!this.value) return ''
			const selectedItem = this.getSelectedItem()
			return selectedItem ? selectedItem.itemCode : ''
		},
		
		itemCodeList() {
			return this.list
		}
	},
	
	watch: {
		initialSearchForm: {
			immediate: true,
			handler(newVal) {
				this.searchForm = { ...newVal }
			}
		},
		
		showPopup(val) {
			if (val) {
				this.$refs.popup.open()
				this.$emit('popup-change', true)
			} else {
				this.$refs.popup.close()
				this.$emit('popup-change', false)
			}
		}
	},
	
	methods: {
		// 搜索输入事件（防抖）
		onSearchInput() {
			if (this.searchTimer) {
				clearTimeout(this.searchTimer)
			}
			
			this.searchTimer = setTimeout(() => {
				this.$emit('search', { ...this.searchForm })
			}, 500)
		},
		
		// 清空物料编码
		clearItemCode() {
			this.searchForm.itemCode = ''
			this.onSearchInput()
		},
		
		// 清空物料名称
		clearItemName() {
			this.searchForm.itemName = ''
			this.onSearchInput()
		},
		
		// 检查是否选中
		isSelected(item) {
			return item.id === this.value
		},
		
		// 选择物料
		handleSelect(item) {
			this.$emit('input', item.id)
			this.$emit('select', item)
			this.showPopup = false
		},
		
		// 触发点击
		handleTriggerClick() {
			this.showPopup = true
			// 重置搜索条件
			this.searchForm = { itemCode: '', itemName: '' }
		},
		
		// 清空选择
		handleClear() {
			this.$nextTick(() => {
				this.$emit('input', '')
				this.$emit('change', '', null)
				this.$emit('clear')
			})
		},
		
		// 获取选中项
		getSelectedItem() {
			if (!this.value) return null
			return this.list.find(item => item.id === this.value)
		},
		
		// 获取状态文本
		getStatusText(status) {
			const statusMap = {
				'1': '启用',
				'0': '停用',
				'2': '待审核'
			}
			return statusMap[status] || status
		},
		
		// 获取状态样式类
		getStatusClass(status) {
			const classMap = {
				'1': 'status-active',
				'0': 'status-inactive',
				'2': 'status-pending'
			}
			return classMap[status] || 'status-default'
		},
		
		// 滚动到底部
		onScrollToLower() {
			if (!this.loading && !this.noMore) {
				this.$emit('load-more')
			}
		},
		
		// 外部方法
		open() {
			this.showPopup = true
		},
		
		close() {
			this.showPopup = false
		},
		
		clear() {
			this.handleClear()
		}
	}
}
</script>

<style lang="scss" scoped>
.item-code-picker {
	width: 100%;
}

.picker-trigger {
	display: flex;
	align-items: center;
	padding: 20rpx 24rpx;
	background: #f8f9fa;
	border-radius: 8rpx;
	border: 1rpx solid #e9ecef;
	height: 80rpx;
	box-sizing: border-box;
}

.trigger-text {
	flex: 1;
	font-size: 26rpx;
	color: #333;
	margin-right: 12rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;

	&.placeholder {
		color: #999;
	}
}

.trigger-icons {
	display: flex;
	align-items: center;
	gap: 16rpx;
	
	.clear-icon-wrapper {
		padding: 4rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}
}

.popup-container {
	background: #fff;
	border-radius: 24rpx 24rpx 0 0;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
}

.popup-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 32rpx;
	border-bottom: 1rpx solid #e5e5e5;
	
	.popup-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #333;
	}
	
	.close-btn {
		padding: 8rpx 0;
		font-size: 28rpx;
		color: #666;
	}
}

.search-conditions {
	padding: 24rpx 32rpx;
	border-bottom: 1rpx solid #f0f0f0;
	
	.search-row {
		display: flex;
		justify-content: space-between;
		gap: 16rpx;
		
		.search-input-item {
			flex: 1;
			
			.input-wrapper {
				position: relative;
				display: flex;
				align-items: center;
				padding: 16rpx 20rpx;
				background: #f8f9fa;
				border-radius: 8rpx;
				
				.search-input {
					flex: 1;
					font-size: 26rpx;
					margin: 0 16rpx;
					height: 40rpx;
					line-height: 40rpx;
				}
				
				.clear-btn {
					padding: 4rpx;
				}
			}
		}
	}
}

.options-scroll {
	flex: 1;
	padding: 0 32rpx;
}

.material-item {
	padding: 24rpx 0;
	border-bottom: 1rpx solid #f0f0f0;
	
	&.selected {
		.material-code {
			color: #1677ff;
		}
	}
	
	.material-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12rpx;
		
		.material-code {
			font-size: 28rpx;
			color: #333;
			font-weight: 600;
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			margin-right: 16rpx;
		}
		
		.material-status {
			font-size: 22rpx;
			padding: 4rpx 12rpx;
			border-radius: 12rpx;
			
			&.status-active {
				background: rgba(82, 196, 26, 0.1);
				color: #52c41a;
			}
			
			&.status-inactive {
				background: rgba(136, 136, 136, 0.1);
				color: #666;
			}
			
			&.status-pending {
				background: rgba(250, 173, 20, 0.1);
				color: #faad14;
			}
			
			&.status-default {
				background: rgba(22, 119, 255, 0.1);
				color: #1677ff;
			}
		}
	}
	
	.material-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8rpx;
		
		.material-name {
			font-size: 26rpx;
			color: #666;
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			margin-right: 16rpx;
		}
	}
	
	.material-spec {
		margin-bottom: 8rpx;
		
		.material-spec-text {
			font-size: 24rpx;
			color: #999;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
	
	.material-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 22rpx;
		color: #999;
		
		.material-unit,
		.material-type {
			font-size: 22rpx;
			color: #999;
		}
	}
}

.empty-state {
	padding: 60rpx 0;
	text-align: center;
	
	.empty-image {
		width: 120rpx;
		height: 120rpx;
		margin-bottom: 24rpx;
		opacity: 0.6;
	}
	
	.empty-text {
		display: block;
		margin-top: 16rpx;
		font-size: 26rpx;
		color: #999;
	}
}

.load-more {
	padding: 20rpx 0;
	text-align: center;
	
	.no-more-text {
		font-size: 24rpx;
		color: #999;
	}
}
</style>