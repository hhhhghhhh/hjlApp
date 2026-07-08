<template>
  <view class="list">
    <slot name="left"></slot>
    <view class="list-body">
      <slot name="default"></slot>
    </view>
    <slot name="right"></slot>
  </view>
</template>
<style lang="scss" scoped>
.list {
  border: 1px solid rgb(233, 233, 233);
  padding: 8px 5px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;

  .list-body {
    font-size: 15px;
    font-weight: 400;
    padding: 0 5px;
    flex: 1;
  }
}
</style>
