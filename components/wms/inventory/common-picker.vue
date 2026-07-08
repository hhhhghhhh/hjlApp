<!-- components/common-picker.vue -->
<template>
	<view class="common-picker">
		<!-- 选择器触发区域 -->
		<view class="picker-trigger" @click="handleTriggerClick" :class="{ disabled }">
			<text class="trigger-text" :class="{ placeholder: !displayText }">
				{{ displayText || placeholder }}
			</text>
			<view class="trigger-icons">
				<view v-if="displayText && clearable" class="clear-icon-wrapper" @click.stop="handleClear">
					<uni-icons type="clear" size="16" color="#9c9c9c"></uni-icons>
				</view>
				<uni-icons type="arrowdown" size="16" color="#9c9c9c"></uni-icons>
			</view>
		</view>

		<!-- 选择器弹窗 -->
		<uni-popup ref="popup" type="bottom" @maskClick="showPopup = false">
			<view class="popup-container">
				<!-- 弹窗头部 -->
				<view class="popup-header">
					<text class="popup-title">{{ popupTitle }}</text>
					<view class="header-actions">
						<view v-if="searchable" class="search-box">
							<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
							<input v-model="searchKeyword" :placeholder="searchPlaceholder" 
									 class="search-input" @input="handleSearch" />
							<view v-if="searchKeyword" class="clear-btn" @click="clearSearch">
								<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
							</view>
						</view>
						<view class="close-btn" @click="showPopup = false">
							<text>取消</text>
						</view>
					</view>
				</view>

				<!-- 选项列表 -->
				<scroll-view class="options-scroll" scroll-y :style="{ height: scrollHeight }">
					<view 
						v-for="(item, index) in filteredOptions" 
						:key="getItemKey(item, index)" 
						class="option-item" 
						:class="{ selected: isSelected(item) }" 
						@click="handleSelect(item)"
					>
						<view class="option-content">
							<text class="option-name">{{ getItemText(item) }}</text>
							<text v-if="getItemDesc(item)" class="option-desc">{{ getItemDesc(item) }}</text>
						</view>
						<view class="check-icon" v-if="isSelected(item)">
							<uni-icons type="checkmarkempty" size="16" color="#1677ff"></uni-icons>
						</view>
					</view>

					<!-- 空状态 -->
					<view v-if="filteredOptions.length === 0" class="empty-state">
						<uni-icons type="search" size="48" color="#ccc"></uni-icons>
						<text class="empty-text">未找到相关选项</text>
					</view>
					
					<!-- 加载更多 -->
					<view v-if="loading" class="load-more">
						<uni-load-more status="loading" content="正在加载..."></uni-load-more>
					</view>
					
					<view v-if="noMore && filteredOptions.length > 0" class="load-more">
						<text class="no-more-text">没有更多了</text>
					</view>
				</scroll-view>
				
				<!-- 操作按钮（多选模式） -->
				<view class="popup-footer" v-if="multiple && showFooter">
					<button class="footer-btn cancel-btn" @click="showPopup = false">取消</button>
					<button class="footer-btn confirm-btn" @click="handleConfirm" :disabled="!hasSelected">确定</button>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
export default {
	name: 'CommonPicker',
	props: {
		// 值相关
		value: {
			type: [String, Number],
			default: ''
		},
		// 多选时的值数组
		selectedValues: {
			type: Array,
			default: () => []
		},
		// 选项列表
		options: {
			type: Array,
			default: () => []
		},
		// 配置项
		config: {
			type: Object,
			default: () => ({
				valueKey: 'value',
				textKey: 'label',
				descKey: 'desc'
			})
		},
		// 显示配置
		placeholder: {
			type: String,
			default: '请选择'
		},
		popupTitle: {
			type: String,
			default: '请选择'
		},
		searchPlaceholder: {
			type: String,
			default: '搜索...'
		},
		// 功能配置
		searchable: {
			type: Boolean,
			default: true
		},
		clearable: {
			type: Boolean,
			default: true
		},
		disabled: {
			type: Boolean,
			default: false
		},
		// 多选配置
		multiple: {
			type: Boolean,
			default: false
		},
		showFooter: {
			type: Boolean,
			default: false
		},
		// 加载配置
		loading: {
			type: Boolean,
			default: false
		},
		noMore: {
			type: Boolean,
			default: false
		},
		pagination: {
			type: Boolean,
			default: false
		},
		// 样式配置
		scrollHeight: {
			type: String,
			default: '60vh'
		}
	},
	
	data() {
		return {
			showPopup: false,
			searchKeyword: '',
			filteredOptions: [],
			tempSelected: null,
			tempMultipleSelected: []
		}
	},
	
	computed: {
		// 显示文本
		displayText() {
			if (this.multiple) {
				const selectedItems = this.getSelectedItems()
				if (selectedItems.length === 0) return ''
				if (selectedItems.length === 1) return this.getItemText(selectedItems[0])
				return `已选择 ${selectedItems.length} 项`
			} else {
				const selectedItem = this.getSelectedItem()
				return selectedItem ? this.getItemText(selectedItem) : ''
			}
		},
		
		// 是否有选中项（多选模式）
		hasSelected() {
			return this.tempMultipleSelected.length > 0
		}
	},
	
	watch: {
		options: {
			handler() {
				this.filterOptions()
			},
			immediate: true
		},
		
		value: {
			handler(newVal) {
				this.tempSelected = newVal
			},
			immediate: true
		},
		
		selectedValues: {
			handler(newVal) {
				this.tempMultipleSelected = [...newVal]
			},
			immediate: true
		},
		
		showPopup(val) {
			if (val) {
				this.$refs.popup.open()
				this.filterOptions()
				this.$emit('open')
				this.$emit('popup-change', true)
				
				// 初始化临时选中值
				if (this.multiple) {
					this.tempMultipleSelected = [...this.selectedValues]
				} else {
					this.tempSelected = this.value
				}
			} else {
				this.$refs.popup.close()
				this.searchKeyword = ''
				this.$emit('close')
				this.$emit('popup-change', false)
			}
		},
		
		searchKeyword() {
			this.filterOptions()
		}
	},
	
	methods: {
		// 获取选项键值
		getItemKey(item, index) {
			return item[this.config.valueKey] || item.id || index
		},
		
		getItemText(item) {
			return item[this.config.textKey] || item.label || item.name || String(item)
		},
		
		getItemDesc(item) {
			return item[this.config.descKey] || item.description
		},
		
		// 选项筛选
		filterOptions() {
			if (!this.searchKeyword) {
				this.filteredOptions = this.options
				return
			}
			
			const keyword = this.searchKeyword.toLowerCase()
			this.filteredOptions = this.options.filter(item => {
				const text = this.getItemText(item).toLowerCase()
				const desc = this.getItemDesc(item) ? this.getItemDesc(item).toLowerCase() : ''
				return text.includes(keyword) || desc.includes(keyword)
			})
		},
		
		// 处理搜索
		handleSearch() {
			this.$nextTick(() => {
				this.filterOptions()
			})
		},
		
		clearSearch() {
			this.searchKeyword = ''
		},
		
		// 选择处理
		isSelected(item) {
			const itemValue = item[this.config.valueKey] || item.value
			
			if (this.multiple) {
				if (this.showPopup && this.showFooter) {
					// 弹窗打开时使用临时值
					return this.tempMultipleSelected.includes(itemValue)
				} else {
					return this.selectedValues.includes(itemValue)
				}
			} else {
				if (this.showPopup && this.showFooter) {
					// 弹窗打开时使用临时值
					return itemValue === this.tempSelected
				} else {
					return itemValue === this.value
				}
			}
		},
		
		handleSelect(item) {
			const itemValue = item[this.config.valueKey] || item.value
			
			if (this.multiple) {
				if (this.showFooter) {
					// 多选+底部按钮模式：切换选中状态
					const index = this.tempMultipleSelected.indexOf(itemValue)
					if (index > -1) {
						this.tempMultipleSelected.splice(index, 1)
					} else {
						this.tempMultipleSelected.push(itemValue)
					}
				} else {
					// 多选无底部按钮：立即生效
					const newSelected = [...this.selectedValues]
					const index = newSelected.indexOf(itemValue)
					if (index > -1) {
						newSelected.splice(index, 1)
					} else {
						newSelected.push(itemValue)
					}
					this.$emit('input', newSelected)
					this.$emit('select', { value: itemValue, selected: index === -1, selectedValues: newSelected })
				}
			} else {
				if (this.showFooter) {
					// 单选+底部按钮模式：临时选中
					this.tempSelected = itemValue
				} else {
					// 单选无底部按钮：立即生效并关闭弹窗
					this.$emit('input', itemValue)
					this.$emit('select', item)
					this.showPopup = false
				}
			}
		},
		
		// 确认选择（多选模式或带底部按钮的单选模式）
		handleConfirm() {
			if (this.multiple) {
				this.$emit('input', [...this.tempMultipleSelected])
				this.$emit('select', { selectedValues: [...this.tempMultipleSelected] })
			} else {
				this.$emit('input', this.tempSelected)
				const selectedItem = this.options.find(item => {
					const itemValue = item[this.config.valueKey] || item.value
					return itemValue === this.tempSelected
				})
				this.$emit('select', selectedItem || null)
			}
			this.showPopup = false
		},
		
		// 触发点击
		handleTriggerClick() {
			if (this.disabled) return
			this.showPopup = true
		},
		
		// 清空选择
		handleClear() {
			this.$nextTick(() => {
				if (this.multiple) {
					this.$emit('input', [])
					this.$emit('change', [], [])
				} else {
					this.$emit('input', '')
					this.$emit('change', '', null)
				}
				this.$emit('clear')
			})
		},
		
		// 获取选中项
		getSelectedItem() {
			if (!this.value) return null
			return this.options.find(item => {
				const itemValue = item[this.config.valueKey] || item.value
				return itemValue === this.value
			})
		},
		
		// 获取多选选中项
		getSelectedItems() {
			return this.options.filter(item => {
				const itemValue = item[this.config.valueKey] || item.value
				return this.selectedValues.includes(itemValue)
			})
		},
		
		// 滚动到底部
		onScrollToLower() {
			if (this.pagination && !this.loading && !this.noMore) {
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
.common-picker {
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
	
	&.disabled {
		opacity: 0.5;
		background: #f0f0f0;
	}
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
	padding: 28rpx 32rpx;
	border-bottom: 1rpx solid #e5e5e5;
	
	.popup-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #333;
		margin-bottom: 20rpx;
	}
	
	.header-actions {
		display: flex;
		align-items: center;
		gap: 16rpx;
		
		.search-box {
			flex: 1;
			display: flex;
			align-items: center;
			padding: 16rpx 20rpx;
			background: #f8f9fa;
			border-radius: 8rpx;
			
			.search-input {
				flex: 1;
				font-size: 28rpx;
				margin: 0 16rpx;
				height: 40rpx;
				line-height: 40rpx;
			}
			
			.clear-btn {
				padding: 4rpx;
			}
		}
		
		.close-btn {
			padding: 16rpx 0;
			font-size: 28rpx;
			color: #666;
		}
	}
}

.options-scroll {
	flex: 1;
	padding: 0 32rpx;
}

.option-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 0;
	border-bottom: 1rpx solid #f0f0f0;
	
	&.selected {
		.option-name {
			color: #1677ff;
			font-weight: 500;
		}
	}
	
	.option-content {
		flex: 1;
	}
	
	.option-name {
		display: block;
		font-size: 26rpx;
		color: #333;
		margin-bottom: 4rpx;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.option-desc {
		font-size: 24rpx;
		color: #999;
	}
}

.empty-state {
	padding: 60rpx 0;
	text-align: center;
	
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

.popup-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 32rpx;
	border-top: 1rpx solid #e5e5e5;
	
	.footer-btn {
		flex: 1;
		height: 80rpx;
		border-radius: 8rpx;
		font-size: 28rpx;
		
		&.cancel-btn {
			background: #f8f9fa;
			color: #666;
			border: 1rpx solid #e9ecef;
			margin-right: 16rpx;
			
			&:active {
				background: #e9ecef;
			}
		}
		
		&.confirm-btn {
			background: #1677ff;
			color: #fff;
			border: none;
			
			&:active {
				background: #0958d9;
			}
			
			&:disabled {
				background: #a0cfff;
				opacity: 0.6;
			}
		}
	}
}
</style>