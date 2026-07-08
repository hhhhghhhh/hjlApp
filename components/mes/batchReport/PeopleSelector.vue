<!-- components/selectors/PeopleSelector.vue -->
<template>
	<!-- 人员选择弹窗 -->
	<uni-popup ref="peoplePopup" type="bottom">
		<view class="popup-container">
			<view class="popup-header">
				<view class="search-box">
					<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
					<input v-model="searchText" placeholder="搜索人员..." class="search-input" @input="handleSearch" />
					<view v-if="searchText" class="clear-btn" @click="handleClearSearch">
						<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
					</view>
				</view>
				<view class="close-btn" @click="handleClose">
					<text>取消</text>
				</view>
			</view>

			<scroll-view class="cmd-scroll" scroll-y>
				<view v-for="(item, index) in filteredList" :key="index" class="cmd-item multi-select"
					@click="handleTogglePeople(item)">
					<view class="cmd-content">
						<text class="cmd-name">{{ item.realname || item.nickname || item.username || '--' }}</text>
						<text class="cmd-desc">
							<text v-if="item.username">账号：{{ item.username }}</text>
							<text v-if="item.departName"> | 部门：{{ item.departName }}</text>
						</text>
					</view>
					<view class="check-icon" v-if="isPeopleSelected(item)">
						<uni-icons type="checkmarkempty" size="16" color="#1677ff"></uni-icons>
					</view>
				</view>

				<view v-if="loading && !list.length" class="loading-tip">
					<text>加载中...</text>
				</view>

				<view v-if="!loading && list.length === 0" class="empty-tip">
					<text>暂无人员</text>
				</view>

				<view v-if="filteredList.length === 0 && list.length > 0" class="empty-tip">
					<text>未找到匹配的人员</text>
				</view>
			</scroll-view>

			<!-- 已选人员 -->
			<view class="selected-people" v-if="selectedPeople.length > 0">
				<view class="selected-header">
					<text class="selected-title">已选择 {{ selectedPeople.length }} 人</text>
					<view class="clear-all-btn" @click="handleClearAllPeople">
						<text>清空</text>
					</view>
				</view>
				<scroll-view class="selected-scroll" scroll-x>
					<view class="selected-tags">
						<view v-for="(item, index) in selectedPeople" :key="index" class="people-tag">
							<text>{{ item.realname || item.nickname || item.username || '--' }}</text>
							<view class="remove-btn" @click="handleRemovePeople(item)">
								<uni-icons type="closeempty" size="12" color="#fff"></uni-icons>
							</view>
						</view>
					</view>
				</scroll-view>
			</view>
		</view>
	</uni-popup>
</template>

<script>
	import {
		getUserList
	} from "@/api/mesApi.js";

	export default {
		name: 'PeopleSelector',
		props: {
			// 选中的人员ID（多个用逗号分隔）
			value: {
				type: String,
				default: ''
			}
		},
		data() {
			return {
				list: [],
				searchText: "",
				selectedPeople: [],
				loading: false,
				searchTimer: null
			}
		},
		computed: {
			// 过滤后的人员列表（前端搜索）
			filteredList() {
				if (!this.searchText) {
					return this.list;
				}

				const search = this.searchText.toLowerCase().trim();
				return this.list.filter(person => {
					// 多字段搜索：姓名、用户名、部门
					const realname = person.realname ? person.realname.toLowerCase() : '';
					const username = person.username ? person.username.toLowerCase() : '';
					const nickname = person.nickname ? person.nickname.toLowerCase() : '';
					const departName = person.departName ? person.departName.toLowerCase() : '';

					return (
						realname.includes(search) ||
						username.includes(search) ||
						nickname.includes(search) ||
						departName.includes(search)
					);
				});
			}
		},
		watch: {
			// 监听value变化，更新selectedPeople
			value: {
				immediate: true,
				handler(newVal) {
					this.updateSelectedPeopleFromValue(newVal);
				}
			}
		},
		methods: {
			// 打开弹窗
			open() {
				this.$refs.peoplePopup.open();
				// 如果还没有加载过人员数据，则加载一次
				if (this.list.length === 0) {
					this.handleLoadPeopleList();
				}
			},

			// 关闭弹窗
			close() {
				this.$refs.peoplePopup.close();
			},

			// 搜索
			handleSearch() {
				// 前端实时搜索，不需要调用接口
				// 使用防抖优化性能
				clearTimeout(this.searchTimer);
				this.searchTimer = setTimeout(() => {
					// 搜索逻辑在 computed 的 filteredList 中实现
				}, 300);
			},

			// 清空搜索
			handleClearSearch() {
				this.searchText = '';
			},

			// 加载人员列表（一次性加载全部）
			async handleLoadPeopleList() {
				if (this.loading) return;

				this.loading = true;

				try {
					// 调用接口获取全部人员数据
					const response = await getUserList();
					console.log("人员API响应:", response);

					if (response && response.data) {
						let records = response.data.result.records;

						// 存储全部人员数据
						this.list = records;
					}
				} catch (error) {
					console.error("获取人员列表失败:", error);
					this.$emit('error', "获取人员列表失败");
				} finally {
					this.loading = false;
				}
			},

			// 切换人员选择
			handleTogglePeople(item) {
				const index = this.selectedPeople.findIndex(p => p.id === item.id);

				if (index === -1) {
					this.selectedPeople.push(item);
				} else {
					this.selectedPeople.splice(index, 1);
				}

				this.updateSelectedPeopleToValue();
			},

			// 移除已选人员
			handleRemovePeople(item) {
				const index = this.selectedPeople.findIndex(p => p.id === item.id);
				if (index !== -1) {
					this.selectedPeople.splice(index, 1);
					this.updateSelectedPeopleToValue();
				}
			},

			// 清空所有已选人员
			handleClearAllPeople() {
				uni.showModal({
					title: '确认清空',
					content: `确定要清空已选择的 ${this.selectedPeople.length} 名人员吗？`,
					success: (res) => {
						if (res.confirm) {
							this.selectedPeople = [];
							this.updateSelectedPeopleToValue();
							this.$emit('info', '已清空所有人员');
						}
					}
				});
			},

			// 检查人员是否已选择
			isPeopleSelected(item) {
				return this.selectedPeople.some(p => p.id === item.id);
			},

			// 从value更新selectedPeople
			updateSelectedPeopleFromValue(value) {
				if (!value) {
					this.selectedPeople = [];
					return;
				}

				// 将逗号分隔的ID字符串转换为数组
				const ids = value.split(',');
				// 从list中找到对应的人员对象
				this.selectedPeople = this.list.filter(person => ids.includes(person.id.toString()));
			},

			// 将selectedPeople更新到value
			updateSelectedPeopleToValue() {
				if (this.selectedPeople.length === 0) {
					this.$emit('input', '');
					this.$emit('change', []);
					return;
				}

				const ids = this.selectedPeople.map(item => item.id).join(",");
				this.$emit('input', ids);
				this.$emit('change', this.selectedPeople);
			},

			// 关闭
			handleClose() {
				this.close();
				this.searchText = ""; // 关闭时清空搜索条件
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

		&.multi-select {
			cursor: pointer;
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
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.loading-tip,
	.empty-tip {
		padding: 60rpx 0;
		text-align: center;
		color: #9c9c9c;
		font-size: 26rpx;
	}

	.selected-people {
		padding: 20rpx;
		border-top: 1rpx solid #f0f0f0;
		background: #fafafa;
	}

	.selected-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16rpx;
	}

	.selected-title {
		font-size: 26rpx;
		color: #666;
		font-weight: 500;
	}

	.clear-all-btn {
		padding: 8rpx 20rpx;
		background: #ff4d4f;
		color: #fff;
		border-radius: 6rpx;
		font-size: 24rpx;
		transition: all 0.3s;
		
		&:active {
			background: #d9363e;
			opacity: 0.8;
		}
	}

	.selected-scroll {
		white-space: nowrap;
	}

	.selected-tags {
		display: inline-flex;
		flex-wrap: nowrap;
		gap: 12rpx;
	}

	.people-tag {
		display: inline-flex;
		align-items: center;
		padding: 12rpx 20rpx;
		background: #1677ff;
		color: #fff;
		border-radius: 20rpx;
		font-size: 24rpx;
		white-space: nowrap;
	}

	.remove-btn {
		margin-left: 8rpx;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		width: 24rpx;
		height: 24rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>