<!-- components/UnifiedSelector.vue
  统一选择器 —— 替代 CommonSelector / SearchSelector / xPicker
  纯配置驱动，新增类型只需在 common/selectorConfig.js 加一条配置即可

  Props 速查：
    type         选择器类型（决定搜索框、字段映射、标题等）
    value        v-model 绑定值
    parentValue  级联父级值（district/storage 依赖上级时使用）
    apiUrl       数据接口 URL
    apiParams    附加请求参数
    dataSource   静态数据源（有值时跳过 API 请求）
    disabled     禁用
    placeholder  占位文字（不传则取 config 默认值）
    requireParent  要求先选父级
    pageSize     每页条数（默认 20）
    showCode     触发器上是否显示编码
    codePosition 编码位置 'right' | 'bottom'
    listInline   列表项 name 和 code 是否同行显示
-->
<template>
  <view class="us-root" :class="{ 'us--full': fullWidth }">
    <!-- ════ 触发器 ════ -->
    <view
      class="us-trigger"
      :class="{
        'us-trigger--disabled': disabled || parentMissing,
        'us-trigger--code-bottom': showCode && codePosition === 'bottom'
      }"
      @click="openPopup"
    >
      <text v-if="label" class="us-trigger__label">{{ label }}</text>

      <view class="us-trigger__body">
        <!-- 单行：name + code 同行 -->
        <template v-if="!(showCode && codePosition === 'bottom')">
          <text class="us-trigger__value" :class="{ 'us-trigger__value--placeholder': !selectedItem }">
            {{ displayText }}
          </text>
          <text v-if="showCode && displayCode" class="us-trigger__code">{{ displayCode }}</text>
        </template>
        <!-- code 在下行 -->
        <template v-else>
          <view class="us-trigger__stack">
            <text class="us-trigger__value" :class="{ 'us-trigger__value--placeholder': !selectedItem }">
              {{ displayText }}
            </text>
            <text v-if="showCode && displayCode" class="us-trigger__code us-trigger__code--block">
              {{ displayCode }}
            </text>
          </view>
        </template>
      </view>

      <!-- 右侧图标 -->
      <view class="us-trigger__icons">
        <view
          v-if="selectedItem && !disabled"
          class="us-trigger__clear"
          @click.stop="clearSelection"
        >
          <uni-icons type="clear" size="16" color="var(--color-text-hint)" />
        </view>
        <uni-icons
          type="arrowdown"
          size="12"
          :color="disabled ? 'var(--color-text-disabled)' : 'var(--color-text-hint)'"
        />
      </view>
    </view>

    <!-- ════ 底部弹窗 ════ -->
    <uni-popup
      ref="popupRef"
      type="bottom"
      :safe-area="false"
      @maskClick="closePopup"
    >
      <view class="us-popup">
        <!-- Header -->
        <view class="us-popup__header">
          <text class="us-popup__title">{{ selectorConfig.title }}</text>
          <uni-icons type="close" size="20" color="var(--color-text-hint)" @click="closePopup" />
        </view>

        <!-- 搜索区 -->
        <view v-if="selectorConfig.searchConfig" class="us-popup__search">
          <!-- 双字段搜索（物料/客户/供应商） -->
          <view v-if="selectorConfig.searchConfig.mode === 'dual'" class="us-search--dual">
            <view
              v-for="f in selectorConfig.searchConfig.fields"
              :key="f.field"
              class="us-search__item"
            >
              <view class="us-search__box">
                <uni-icons type="search" size="18" color="var(--color-text-hint)" />
                <input
                  :value="searchState[f.field] || ''"
                  class="us-search__input"
                  :placeholder="f.placeholder"
                  placeholder-class="us-search__placeholder"
                  @input="e => onSearchInput(f.field, e.detail.value)"
                />
                <view
                  v-if="searchState[f.field]"
                  class="us-search__clear"
                  @click.stop="onSearchInput(f.field, '')"
                >
                  <uni-icons type="clear" size="16" color="var(--color-text-hint)" />
                </view>
              </view>
            </view>
          </view>

          <!-- 单字段搜索 -->
          <view v-else class="us-search__box">
            <uni-icons type="search" size="18" color="var(--color-text-hint)" />
            <input
              :value="searchState[selectorConfig.searchConfig.fields[0].field] || ''"
              class="us-search__input"
              :placeholder="selectorConfig.searchConfig.fields[0].placeholder"
              placeholder-class="us-search__placeholder"
              @input="e => onSearchInput(selectorConfig.searchConfig.fields[0].field, e.detail.value)"
            />
            <view
              v-if="searchState[selectorConfig.searchConfig.fields[0].field]"
              class="us-search__clear"
              @click.stop="clearSearch"
            >
              <uni-icons type="clear" size="16" color="var(--color-text-hint)" />
            </view>
          </view>
        </view>

        <!-- 列表 -->
        <scroll-view
          class="us-popup__list"
          scroll-y
          @scrolltolower="loadMore"
        >
          <view
            v-for="(item, idx) in filteredList"
            :key="item.id || idx"
            class="us-item"
            :class="{
              'us-item--active': isItemActive(item),
              'us-item--inline': listInline
            }"
            @click="selectItem(item)"
          >
            <view class="us-item__content" :class="{ 'us-item__content--inline': listInline }">
              <text class="us-item__name">{{ item.name }}</text>
              <text v-if="item.code" class="us-item__code">{{ item.code }}</text>
            </view>
            <uni-icons
              v-if="isItemActive(item)"
              type="check"
              size="16"
              color="var(--color-primary)"
            />
          </view>

          <!-- 空态 -->
          <view v-if="filteredList.length === 0 && !loading" class="us-empty">
            <text class="us-empty__text">暂无数据</text>
          </view>

          <!-- 加载态 -->
          <view v-if="loading" class="us-loadmore">
            <uni-load-more status="loading" content="加载中..." />
          </view>

          <!-- 到底了 -->
          <view v-if="noMore && filteredList.length > 0" class="us-loadmore">
            <text class="us-loadmore__text">没有更多了</text>
          </view>
        </scroll-view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import { createSelectorMixin } from '@/common/useSelector.js'

export default {
  name: 'UnifiedSelector',

  mixins: [createSelectorMixin()],

  props: {
    label:      { type: String, default: '' },
    fullWidth:  { type: Boolean, default: true },
    showCode:   { type: Boolean, default: false },
    codePosition:{ type: String, default: 'right' },
    listInline: { type: Boolean, default: false }
  },

  watch: {
    popupVisible(val) {
      if (val) {
        this.$refs.popupRef?.open()
      } else {
        this.$refs.popupRef?.close()
      }
    }
  },

  methods: {
    isItemActive(item) {
      if (!this.selectedItem) return false
      return (item.id || item[this.selectorConfig.valueField]) ===
             (this.selectedItem.id || this.selectedItem[this.selectorConfig.valueField])
    }
  }
}
</script>

<style lang="scss" scoped>
// 引用的变量来自 common/theme.scss → uni.scss
// CSS 自定义属性在运行时由 styleManager.js 切换

.us-root {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

// ── 触发器 ────
.us-trigger {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: var(--selector-height);
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
  border: 1rpx solid var(--color-border);
  padding: 0 var(--spacing-md);
  box-sizing: border-box;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

  &:active:not(.us-trigger--disabled) {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2rpx var(--color-primary-bg);
  }

  &--disabled {
    opacity: 0.5;
    background: var(--color-bg-hover);
  }

  &--code-bottom {
    height: auto;
    min-height: var(--selector-height);
    padding-top: 12rpx;
    padding-bottom: 12rpx;
  }
}

.us-trigger__label {
  font-size: var(--font-md);
  color: var(--color-text);
  flex-shrink: 0;
  max-width: 80rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8rpx;
}

.us-trigger__body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.us-trigger__stack {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
}

.us-trigger__value {
  font-size: var(--font-md);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;

  &--placeholder { color: var(--color-text-hint); }
}

.us-trigger__code {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
  margin-left: 8rpx;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120rpx;

  &--block {
    margin-left: 0;
    margin-top: 2rpx;
    max-width: 100%;
  }
}

.us-trigger__icons {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.us-trigger__clear {
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-hover);
  transition: background var(--transition-fast);

  &:active { background: #e0e0e0; }
}

// ── 弹窗 ────
.us-popup {
  background: var(--color-bg);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.us-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx var(--spacing-lg);
  border-bottom: 1rpx solid var(--color-border);
  flex-shrink: 0;
}

.us-popup__title {
  font-size: var(--font-xl);
  font-weight: 600;
  color: var(--color-text);
}

// ── 搜索 ────
.us-popup__search {
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-md);
  flex-shrink: 0;
}

.us-search--dual {
  display: flex;
  gap: var(--spacing-sm);
}

.us-search__item {
  flex: 1;
  min-width: 0;
}

.us-search__box {
  display: flex;
  align-items: center;
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
  padding: 16rpx 20rpx;
  border: 1rpx solid var(--color-border);
  transition: border-color var(--transition-fast);

  &:focus-within {
    border-color: var(--color-primary);
  }
}

.us-search__input {
  flex: 1;
  font-size: var(--font-md);
  color: var(--color-text);
  margin: 0 var(--spacing-sm);
  min-width: 0;
}

.us-search__placeholder { color: var(--color-text-hint); font-size: var(--font-md); }

.us-search__clear {
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-hover);
  flex-shrink: 0;
}

// ── 列表 ────
.us-popup__list {
  flex: 1;
  padding: 0 var(--spacing-lg);
  height: 50vh;
}

.us-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) 0;
  border-bottom: 1rpx solid var(--color-divider);
  min-height: 80rpx;
  box-sizing: border-box;
  transition: background var(--transition-fast);
  overflow: hidden;

  &:active {
    background: var(--color-bg-hover);
  }

  &--active {
    background: var(--color-primary-bg);
    border-radius: var(--radius-sm);
    padding: 20rpx;
    margin: 0 -20rpx;
  }

  &--inline {
    .us-item__content {
      flex-direction: row;
      align-items: center;
      gap: 8rpx;
    }
  }
}

.us-item__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;

  &--inline {
    flex-direction: row;
    align-items: center;
    gap: 8rpx;
  }
}

.us-item__name {
  font-size: var(--font-md);
  color: var(--color-text);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  width: 100%;

  .us-item--active & { color: var(--color-primary); }
}

.us-item__code {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  width: 100%;

  .us-item__content--inline & { margin-top: 0; flex-shrink: 0; max-width: 120rpx; }
}

// ── 空态 / 加载 ────
.us-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx 0;
}

.us-empty__text {
  font-size: var(--font-md);
  color: var(--color-text-hint);
}

.us-loadmore {
  padding: var(--spacing-lg) 0;
  text-align: center;
}

.us-loadmore__text {
  font-size: var(--font-sm);
  color: var(--color-text-hint);
}
</style>