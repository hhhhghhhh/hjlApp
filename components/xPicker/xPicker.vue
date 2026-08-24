<template>
  <view class="xPicker">
    <!-- 原有的 picker 模式 -->
    <picker
      v-if="!usePopup"
      @change="bindPickerChange"
      :value="index"
      :range="options"
      range-key="text"
    >
      <view class="picker-view">
        {{
          options.length > index && index != -1 ? options[index].text : title
        }}
      </view>
    </picker>
    
    <!-- 弹窗模式触发器 -->
    <view v-else class="popup-picker" @click="showPopup = true">
      <view class="picker-view">
        {{
          options.length > index && index != -1 ? options[index].text : title
        }}
        <text class="arrow">▼</text>
      </view>
    </view>

    <!-- 全屏搜索选择弹窗 -->
    <uni-popup ref="popup" type="center" background-color="#fff">
      <view class="fullscreen-popup">
        <!-- 头部搜索栏 -->
        <view class="popup-header">
          <view class="search-box">
            <!-- <text class="search-icon">🔍</text> -->
            <input
              
              v-model="searchKeyword"
              placeholder="搜索..."
              placeholder-class="placeholder-style"
              @input="handleSearch"
            />
            <text v-if="searchKeyword" class="clear-icon" @click="clearSearch">×</text>
          </view>
          <text class="popup-close" @click="showPopup = false">取消</text>
        </view>

        <!-- 列表区域 -->
        <scroll-view class="list-scroll" scroll-y>
          <view class="list-container">
            <view
              v-for="(item, idx) in filteredOptions"
              :key="idx"
              class="list-item"
              :class="{ 'list-item-selected': isSelected(item) }"
              @click="handleItemSelect(item)"
            >
              <text class="item-text">{{ item.text }}</text>
              <text v-if="isSelected(item)" class="selected-icon">✓</text>
            </view>
            
            <!-- 空状态 -->
            <view v-if="filteredOptions.length === 0" class="empty-state">
              <text class="empty-text">暂无数据</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: "请选择",
    },
    value: {
      type: [String, Number],
      default: "",
    },
    options: {
      type: Array,
      default: () => [],
    },
    keyName: {
      type: String,
      default: "label",
    },
    // 新增：是否使用弹窗模式
    usePopup: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      index: -1,
      showPopup: false,
      searchKeyword: "",
      filteredOptions: []
    };
  },
  computed: {
    showName() {
      let name = "";
      this.options &&
        this.options.forEach((item) => {
          if (item.value == this.value) {
            name = item.text;
          }
        });
      return name;
    },
  },

  mounted() {
    this.haveChange();
    this.filteredOptions = [...this.options];
  },
  watch: {
    value: {
      handler(newval, oldval) {
        this.haveChange();
      },
      deep: true,
      immediate: true,
    },
    options: {
      handler(newval, oldval) {
        this.haveChange();
        this.filteredOptions = [...this.options];
      },
      deep: true,
      immediate: true,
    },
    showPopup(val) {
      if (val) {
        this.$refs.popup.open();
        this.searchKeyword = "";
        this.filteredOptions = [...this.options];
        // 确保弹窗在最上层
        this.$nextTick(() => {
          const popupElement = this.$refs.popup.$el;
          if (popupElement) {
            //popupElement.style.zIndex = '9999';
          }
        });
      } else {
        this.$refs.popup.close();
      }
    }
  },
  methods: {
    haveChange() {
      var index = -1;
      this.options.forEach((item, i) => {
        if (item.value == this.value) {
          index = i;
        }
      });
      this.index = index;
    },
    
    bindPickerChange(e) {
      this.handleChange(e.detail.value);
    },
    
    // 搜索处理
    handleSearch() {
      if (!this.searchKeyword.trim()) {
        this.filteredOptions = [...this.options];
        return;
      }
      
      const keyword = this.searchKeyword.toLowerCase();
      this.filteredOptions = this.options.filter(item => 
        item.text && item.text.toLowerCase().includes(keyword)
      );
    },
    
    // 清空搜索
    clearSearch() {
      this.searchKeyword = "";
      this.filteredOptions = [...this.options];
    },
    
    // 判断是否选中
    isSelected(item) {
      return item.value === this.value;
    },
    
    // 选择列表项
    handleItemSelect(item) {
      this.handleChangeByItem(item);
      this.showPopup = false;
    },
    
    handleChange(selectedIndex) {
      if (this.options.length && this.options.length > selectedIndex) {
        this.index = selectedIndex;
        this.$emit("input", this.options[this.index].value);
        this.$emit(
          "change",
          this.options[this.index].value,
          this.options[this.index]
        );
      } else {
        this.$emit("input", null);
        this.$emit("change", null, null);
        this.index = -1;
      }
    },
    
    handleChangeByItem(item) {
      const selectedIndex = this.options.findIndex(option => option.value === item.value);
      this.index = selectedIndex;
      this.$emit("input", item.value);
      this.$emit("change", item.value, item);
    }
  },
};
</script>

<style lang="scss" scoped>
.xPicker {
  height: 35px;
  line-height: 35px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0 20rpx;
  position: relative;
  
}

.picker-view {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.arrow {
  color: var(--color-text-hint);
  font-size: 12px;
}

/* 全屏弹窗样式 */
.fullscreen-popup {
  width: 100vw;
  height: 100vh;
  background: var(--color-bg-card);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999999 !important;
}

.popup-header {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-bg-card);
  flex-shrink: 0;
  height: 100rpx;
  box-sizing: border-box;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg-page);
  border-radius: 20rpx;
  padding: 20rpx 30rpx;
  margin-right: 20rpx;
  height: 80rpx;
}

.search-icon {
  font-size: var(--font-xl);
  color: var(--color-text-hint);
  margin-right: 20rpx;
  line-height: 1;
}

.search-input {
  flex: 1;
  font-size: var(--font-xl);
  color: var(--color-text);
  height: 40rpx;
  line-height: 40rpx;
  background: transparent;
}

.placeholder-style {
  color: var(--color-text-hint);
  font-size: var(--font-xl);
}

.clear-icon {
  font-size: var(--font-xl);
  color: var(--color-text-hint);
  padding: 10rpx;
  margin-left: 10rpx;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
}

.popup-close {
  font-size: var(--font-xl);
  color: var(--color-text-secondary);
  padding: 15rpx 0;
  white-space: nowrap;
}

/* 列表区域 */
.list-scroll {
  flex: 1;
  height: calc(100vh - 100rpx);
  background: var(--color-bg-card);
}

.list-container {
  padding: 0;
  background: var(--color-bg-card);
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-bg-card);
  min-height: 100rpx;
  box-sizing: border-box;
}

.list-item:active {
  background: #f8f8f8;
}

.list-item-selected {
  background: #f0f8ff;
}

.item-text {
  font-size: var(--font-xl);
  color: var(--color-text);
  flex: 1;
}

.selected-icon {
  font-size: var(--font-xl);
  color: #2979ff;
  font-weight: bold;
  margin-left: 20rpx;
}

/* 空状态 */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300rpx;
  background: var(--color-bg-card);
}

.empty-text {
  font-size: var(--font-xl);
  color: var(--color-text-hint);
}

/* 强制弹窗在最上层 */


::v-deep .uni-popup__wrapper.uni-popup__wrapper--center {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

::v-deep .uni-popup__wrapper.uni-popup__wrapper--center .uni-popup {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  border-radius: 0 !important;
}
</style>