<template>
  <view class="search-selector" :class="[sizeClass, darkClass]">
    <!-- 选择器触发区域 -->
    <view class="selector-trigger" :class="{ disabled: disabled }" @click="handleTriggerClick">
      <text class="trigger-text" :class="{ placeholder: !displayText, disabled: disabled }">
        {{ displayText || placeholder }}
      </text>
      <view class="trigger-icons">
        <view v-if="displayText && clearable && !disabled" class="clear-icon-wrapper" @click.stop="handleClear">
          <uni-icons type="clear" size="16" color="#9c9c9c"></uni-icons>
        </view>
        <uni-icons type="arrowdown" size="16" :color="disabled ? '#bfbfbf' : '#9c9c9c'"></uni-icons>
      </view>
    </view>

    <!-- 搜索选择弹窗 -->
    <uni-popup ref="popup" type="bottom" @maskClick="showPopup = false">
      <view class="popup-container" :class="[sizeClass, darkClass]">
        <!-- 弹窗头部 -->
        <view class="popup-header">
          <text class="popup-title">{{ popupTitle }}</text>
          <view class="header-actions">
            <view v-if="isSearchable" class="search-box" :class="{ disabled: disabled }">
              <uni-icons type="search" size="16" :color="disabled ? '#d9d9d9' : '#9c9c9c'"></uni-icons>
              <input v-model="searchKeyword" :placeholder="searchPlaceholder" 
                     class="search-input" :disabled="disabled" @input="handleSearch" />
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
        <scroll-view class="options-scroll" scroll-y :style="{ maxHeight: scrollHeight }">
          <!-- 选项列表 -->
          <view v-for="(item, index) in filteredOptions" 
                :key="getItemKey(item, index)" 
                class="option-item" 
                :class="{ 
                  selected: isSelected(item), 
                  disabled: isItemDisabled(item) 
                }" 
                @click="!isItemDisabled(item) && handleSelect(item)">
            <view class="option-content">
              <text class="option-name" :class="{ disabled: isItemDisabled(item) }">
                {{ getItemText(item) }}
              </text>
              <text v-if="getItemDesc(item)" 
                    class="option-desc" 
                    :class="{ disabled: isItemDisabled(item) }">
                {{ getItemDesc(item) }}
              </text>
            </view>
            <view class="check-icon" v-if="isSelected(item)">
              <uni-icons type="checkmarkempty" size="16" :color="themePrimary"></uni-icons>
            </view>
            <view class="disabled-icon" v-if="isItemDisabled(item)">
              <uni-icons type="minus" size="16" color="#bfbfbf"></uni-icons>
            </view>
          </view>

          <!-- 空状态 -->
          <view v-if="filteredOptions.length === 0" class="empty-state">
            <uni-icons type="search" size="48" color="#ccc"></uni-icons>
            <text class="empty-text">未找到相关选项</text>
          </view>
        </scroll-view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import settingsMixin from '@/common/settingsMixin.js';

export default {
  name: 'SearchSelector',
  mixins: [settingsMixin],
  props: {
    // 值相关
    value: {
      type: [String, Number],
      default: ''
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
        textKey: 'text',
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
    // 禁用配置
    disabled: {
      type: Boolean,
      default: false
    },
    disabledKey: {
      type: String,
      default: 'disabled'
    },
    disableSearch: {
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
      filteredOptions: []
    }
  },
  computed: {
    // 主题色
    themePrimary() {
      // 如果父组件传入了 themePrimary，使用父组件的，否则从 settingsMixin 获取
      return this.$parent?.themePrimary || this.$options?.mixins?.[0]?.computed?.themePrimary?.call(this) || '#1677ff';
    },
    
    // 显示文本
    displayText() {
      const selectedItem = this.getSelectedItem()
      return selectedItem ? this.getItemText(selectedItem) : ''
    },
    
    // 判断是否启用搜索
    isSearchable() {
      return this.searchable && !this.disableSearch && !this.disabled
    }
  },
  watch: {
    options: {
      handler() {
        this.filterOptions()
      },
      immediate: true
    },
    
    showPopup(val) {
      if (val) {
        this.$refs.popup.open()
        this.filterOptions()
        this.$emit('open')
      } else {
        this.$refs.popup.close()
        this.searchKeyword = ''
        this.$emit('close')
      }
    },
    
    searchKeyword() {
      this.filterOptions()
    },
    
    disabled(val) {
      if (val && this.showPopup) {
        this.showPopup = false
      }
    }
  },
  methods: {
    // 获取选项键值
    getItemKey(item, index) {
      return item[this.config.valueKey] || index
    },
    
    getItemText(item) {
      return item[this.config.textKey] || item.label || item.name || String(item)
    },
    
    getItemDesc(item) {
      return item[this.config.descKey] || item.description
    },
    
    // 判断选项是否禁用
    isItemDisabled(item) {
      // 如果整个组件禁用，则所有选项都禁用
      if (this.disabled) return true
      
      // 检查单个选项的禁用状态
      if (this.disabledKey && item[this.disabledKey] !== undefined) {
        return Boolean(item[this.disabledKey])
      }
      
      return false
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
      if (this.disabled) return
      
      this.$nextTick(() => {
        this.filterOptions()
      })
    },
    
    clearSearch() {
      if (this.disabled) return
      this.searchKeyword = ''
    },
    
    // 选择处理
    isSelected(item) {
      const itemValue = item[this.config.valueKey]
      return this.value === itemValue
    },
    
    handleSelect(item) {
      if (this.disabled || this.isItemDisabled(item)) return
      
      const itemValue = item[this.config.valueKey]
      this.$emit('input', itemValue)
      this.$emit('change', itemValue, item)
      this.showPopup = false
    },
    
    // 触发点击
    handleTriggerClick() {
      if (this.disabled) return
      this.showPopup = true
    },
    
    // 清空选择
    handleClear() {
      if (this.disabled) return
      
      // 使用 $nextTick 确保在下一个事件循环中执行，避免事件冲突
      this.$nextTick(() => {
        this.$emit('input', '')
        this.$emit('change', '', null)
        this.$emit('clear')
      })
    },
    
    // 获取选中项
    getSelectedItem() {
      if (!this.value) return null
      return this.options.find(item => item[this.config.valueKey] === this.value)
    },
    
    // 外部方法
    open() {
      if (this.disabled) return
      this.showPopup = true
    },
    
    close() {
      this.showPopup = false
    },
    
    clear() {
      if (this.disabled) return
      this.handleClear()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

.search-selector {
  width: 100%;
}

.selector-trigger {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  background: #f4f5f7;
  border-radius: 8rpx;
  border: 1rpx solid #e5e7eb;
  transition: all 0.2s ease;
  
  &:active:not(.disabled) {
    background: #e8e9ec;
  }
  
  &.disabled {
    background: #fafafa;
    border-color: #f0f0f0;
    cursor: not-allowed;
  }
}

.trigger-text {
  flex: 1;
  font-size: 24rpx;
  color: #333;
  margin: 0 12rpx;

  &.placeholder {
    color: #9c9c9c;
  }
  
  &.disabled {
    color: #8c8c8c;
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
    
    &:active {
      opacity: 0.7;
    }
  }
}

.popup-container {
  background: #fff;
  border-radius: 20rpx 20rpx 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  transition: background 0.25s ease;
}

.popup-header {
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  
  .popup-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 16rpx;
    transition: color 0.25s ease;
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
      background: #f4f5f7;
      border-radius: 8rpx;
      transition: all 0.2s ease;
      
      &:active:not(.disabled) {
        background: #e8e9ec;
      }
      
      &.disabled {
        background: #fafafa;
        cursor: not-allowed;
        
        .uni-icons {
          color: #d9d9d9;
        }
      }
      
      .search-input {
        flex: 1;
        font-size: 28rpx;
        margin: 0 16rpx;
        background: transparent;
        outline: none;
        color: #333;
        
        &:disabled {
          color: #8c8c8c;
          cursor: not-allowed;
        }
        
        &::placeholder {
          color: #9c9c9c;
        }
      }
      
      .clear-btn {
        padding: 4rpx;
        
        &:active {
          opacity: 0.7;
        }
      }
    }
    
    .close-btn {
      padding: 16rpx 0;
      font-size: 28rpx;
      color: #666;
      
      &:active {
        opacity: 0.7;
      }
    }
  }
}

.options-scroll {
  flex: 1;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
  transition: all 0.2s ease;
  position: relative;
  
  &:active:not(.disabled) {
    background: #f9f9f9;
  }
  
  &.selected {
    background: rgba(22, 119, 255, 0.02);
  }
  
  &.disabled {
    cursor: not-allowed;
    background-color: #fafafa;
    
    .option-name,
    .option-desc {
      color: #bfbfbf !important;
    }
  }
  
  .option-content {
    flex: 1;
    min-width: 0;
  }
  
  .option-name {
    display: block;
    font-size: 28rpx;
    color: #333;
    margin-bottom: 4rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.25s ease;
    
    &.disabled {
      color: #8c8c8c;
    }
  }
  
  .option-desc {
    display: block;
    font-size: 24rpx;
    color: #9c9c9c;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.25s ease;
    
    &.disabled {
      color: #bfbfbf;
    }
  }
  
  .check-icon {
    margin-left: 16rpx;
    flex-shrink: 0;
  }
  
  .disabled-icon {
    color: #bfbfbf;
    margin-left: 16rpx;
    flex-shrink: 0;
  }
}

.empty-state {
  padding: 120rpx 0;
  text-align: center;
  
  .empty-text {
    display: block;
    margin-top: 16rpx;
    font-size: 28rpx;
    color: #9c9c9c;
  }
}

/* ===== 小号样式 ===== */
.size-small {
  .selector-trigger {
    padding: 10rpx 14rpx;
    
    .trigger-text {
      font-size: 20rpx;
    }
  }
  
  .popup-header {
    padding: 16rpx;
    
    .popup-title {
      font-size: 28rpx;
      margin-bottom: 12rpx;
    }
    
    .header-actions {
      .search-box {
        padding: 10rpx 14rpx;
        
        .search-input {
          font-size: 24rpx;
        }
      }
      
      .close-btn {
        font-size: 24rpx;
        padding: 10rpx 0;
      }
    }
  }
  
  .option-item {
    padding: 16rpx;
    
    .option-name {
      font-size: 24rpx;
    }
    
    .option-desc {
      font-size: 20rpx;
    }
  }
  
  .empty-state {
    padding: 80rpx 0;
    
    .empty-text {
      font-size: 24rpx;
    }
  }
}

/* ===== 大号样式 ===== */
.size-large {
  .selector-trigger {
    padding: 22rpx 28rpx;
    
    .trigger-text {
      font-size: 28rpx;
    }
  }
  
  .popup-header {
    padding: 32rpx;
    
    .popup-title {
      font-size: 36rpx;
      margin-bottom: 20rpx;
    }
    
    .header-actions {
      .search-box {
        padding: 22rpx 28rpx;
        
        .search-input {
          font-size: 32rpx;
        }
      }
      
      .close-btn {
        font-size: 32rpx;
        padding: 22rpx 0;
      }
    }
  }
  
  .option-item {
    padding: 32rpx;
    
    .option-name {
      font-size: 32rpx;
    }
    
    .option-desc {
      font-size: 28rpx;
    }
  }
  
  .empty-state {
    padding: 160rpx 0;
    
    .empty-text {
      font-size: 32rpx;
    }
  }
}

/* ===== 深色模式 ===== */
.theme-dark {
  .selector-trigger {
    background: #1e1e36;
    border-color: #2a2a45;
    
    &:active:not(.disabled) {
      background: #252545;
    }
    
    &.disabled {
      background: #1a1a2e;
      border-color: #2a2a45;
    }
  }
  
  .trigger-text {
    color: #e0e0e0;
    
    &.placeholder {
      color: #666;
    }
    
    &.disabled {
      color: #555;
    }
  }
  
  .popup-container {
    background: #1a1a2e;
  }
  
  .popup-header {
    border-bottom-color: #2a2a45;
    
    .popup-title {
      color: #e0e0e0;
    }
    
    .header-actions {
      .search-box {
        background: #1e1e36;
        
        &:active:not(.disabled) {
          background: #252545;
        }
        
        &.disabled {
          background: #1a1a2e;
        }
        
        .search-input {
          color: #e0e0e0;
          
          &:disabled {
            color: #555;
          }
          
          &::placeholder {
            color: #666;
          }
        }
      }
      
      .close-btn {
        color: #888;
      }
    }
  }
  
  .option-item {
    border-bottom-color: #2a2a45;
    
    &:active:not(.disabled) {
      background: #1e1e36;
    }
    
    &.selected {
      background: rgba(22, 119, 255, 0.05);
    }
    
    &.disabled {
      background-color: #1a1a2e;
    }
    
    .option-name {
      color: #e0e0e0;
      
      &.disabled {
        color: #555;
      }
    }
    
    .option-desc {
      color: #888;
      
      &.disabled {
        color: #555;
      }
    }
  }
  
  .empty-state {
    .empty-text {
      color: #666;
    }
  }
}
</style>