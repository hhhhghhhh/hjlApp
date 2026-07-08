<!-- components/selectors/ProcessSelector.vue -->
<template>
	<!-- 工序选择弹窗 -->
	<uni-popup ref="processPopup" type="bottom">
		<view class="popup-container">
			<view class="popup-header">
				<view class="search-box">
					<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
					<input v-model="searchText" placeholder="搜索工序..." class="search-input" @input="handleSearch" />
					<view v-if="searchText" class="clear-btn" @click="handleClearSearch">
						<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
					</view>
				</view>
				<view class="close-btn" @click="handleClose">
					<text>取消</text>
				</view>
			</view>

			<scroll-view class="cmd-scroll" scroll-y>
				<view v-for="(item, index) in filteredList" :key="index" class="cmd-item"
					:class="{selected: selectedValue === item.groupId}" @click="handleSelectItem(item)">
					<view class="cmd-content">
						<!-- 工序信息显示区域 -->
						<view class="process-row">
							<text class="process-name">{{ item.groupName || '--' }}</text>
							<text class="process-code">{{ item.groupCode || '--' }}</text>
						</view>
						<view class="process-row">
							<text class="process-type">类型：{{ item.coGroupType_dictText || '--' }}</text>
							<view class="process-qty">
								<text class="ok-qty">良品：{{ item.okQty  || '--' }}</text>
								<text class="ng-qty">不良：{{ item.ngQty  || '--' }}</text>
							</view>
						</view>
					</view>
					<view class="check-icon" v-if="selectedValue === item.groupId">
						<uni-icons type="checkmarkempty" size="16" color="#1677ff"></uni-icons>
					</view>
				</view>

				<view v-if="filteredList.length === 0" class="empty-tip">
					<text>暂无工序</text>
				</view>
			</scroll-view>
		</view>
	</uni-popup>
</template>

<script>
	import {
		getProcessList
	} from "@/api/mesApi.js";

	export default {
		name: 'ProcessSelector',
		props: {
			// 选中的工序ID
			value: {
				type: [String, Number],
				default: ''
			},
			// 工单ID（用于加载工序）
			moId: {
				type: [String, Number],
				required: true
			}
		},
		data() {
			return {
				list: [],
				searchText: "",
				loading: false
			}
		},
		computed: {
			selectedValue() {
				return this.value;
			},
			// 过滤后的工序列表
			filteredList() {
				if (!this.searchText) {
					return this.list;
				}
				const search = this.searchText.toLowerCase();
				return this.list.filter(item =>
					(item.groupName && item.groupName.toLowerCase().includes(search)) ||
					(item.groupCode && item.groupCode.toLowerCase().includes(search)) ||
					(item.processType && item.processType.toLowerCase().includes(search)) ||
					(item.groupType && item.groupType.toLowerCase().includes(search))
				);
			}
		},
		watch: {
			// 监听工单ID变化，重新加载工序
			moId: {
				immediate: true,
				handler(newVal) {
					if (newVal) {
						this.loadProcessList();
					}
				}
			}
		},
		methods: {
			// 打开弹窗
			open() {
				this.$refs.processPopup.open();
			},

			// 关闭弹窗
			close() {
				this.$refs.processPopup.close();
			},

			// 搜索
			handleSearch() {
				// 实时过滤，不需要延迟
			},

			// 清空搜索
			handleClearSearch() {
				this.searchText = '';
			},

			// 加载工序列表
			async loadProcessList() {
				if (!this.moId) return;

				this.loading = true;

				try {
					const data = {
						moId: this.moId
					};

					const response = await getProcessList(data);

					if (response && response.data && response.data.code === 200) {
						// 处理返回的工序数据，确保包含所需字段
						const processList = response.data.result || [];

						// 映射字段以确保显示
						this.list = processList.map(item => ({
							groupId: item.groupId,
							groupName: item.groupName,
							groupCode: item.groupCode,
							coGroupType_dictText: item.coGroupType_dictText,
							okQty: item.okQty || item.passQty || item.goodQty || 0,
							ngQty: item.ngQty || item.failQty || item.defectiveQty || 0,
							techGroupId: item.techGroupId || item.id
						}));

						if (this.list.length === 0) {
							this.$emit('warning', "该工单暂无工序信息");
						}
					} else {
						this.$emit('error', response?.data?.message || "获取工序列表失败");
					}
				} catch (error) {
					console.error("获取工序列表失败:", error);
					this.$emit('error', "获取工序列表失败");
				} finally {
					this.loading = false;
				}
			},

			// 选择工序
			handleSelectItem(item) {
				this.$emit('input', item.groupId);
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

	.process-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6rpx;
	}

	.process-row:last-child {
		margin-bottom: 0;
	}

	.process-name {
		font-size: 30rpx;
		color: #333;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
	}

	.process-code {
		font-size: 24rpx;
		color: #666;
		background: #f5f5f5;
		padding: 4rpx 12rpx;
		border-radius: 4rpx;
		margin-left: 12rpx;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.process-type {
		font-size: 24rpx;
		color: #666;
		background: #f0f7ff;
		padding: 4rpx 12rpx;
		border-radius: 4rpx;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.process-qty {
		display: flex;
		align-items: center;
		gap: 16rpx;
		margin-left: 12rpx;
	}

	.ok-qty {
		font-size: 24rpx;
		color: #52c41a;
		background: rgba(82, 196, 26, 0.1);
		padding: 4rpx 12rpx;
		border-radius: 4rpx;
		white-space: nowrap;
	}

	.ng-qty {
		font-size: 24rpx;
		color: #ff4d4f;
		background: rgba(255, 77, 79, 0.1);
		padding: 4rpx 12rpx;
		border-radius: 4rpx;
		white-space: nowrap;
	}

	.check-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.empty-tip {
		padding: 60rpx 0;
		text-align: center;
		color: #9c9c9c;
		font-size: 26rpx;
	}
</style>