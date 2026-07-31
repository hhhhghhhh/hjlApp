<template>
	<uni-popup ref="popup" type="bottom">
		<view class="popup-container">
			<view class="popup-header">
				<view class="search-box">
					<uni-icons type="search" size="16" color="#9c9c9c"></uni-icons>
					<input v-model="search" :placeholder="'搜索' + title" class="search-input" @input="handleSearch" />
					<view v-if="search" class="clear-btn" @click="handleClearSearch">
						<uni-icons type="clear" size="14" color="#9c9c9c"></uni-icons>
					</view>
				</view>
				<view class="close-btn" @click="close">
					<text>取消</text>
				</view>
			</view>

			<scroll-view class="doc-scroll" scroll-y @scrolltolower="loadList">
				<view v-for="(item, index) in list" :key="item.id || index" class="doc-item"
					:class="{ selected: selectedId === item.id }" @click="handleSelect(item)">
					<view class="doc-content">
						<text class="doc-no">{{ item.docNo }}</text>
						<text class="doc-desc">
							<text v-if="item.createBy">开单：{{ item.createBy }}</text>
							<text v-if="item[dateField]"> | {{ dateLabel }}：{{ item[dateField] }}</text>
						</text>
						<text class="doc-desc" v-if="item.memo">备注：{{ item.memo }}</text>
					</view>
					<view class="check-icon" v-if="selectedId === item.id">
						<uni-icons type="checkmarkempty" size="16" color="#1677ff"></uni-icons>
					</view>
				</view>

				<view v-if="loading" class="tip">加载中...</view>
				<view v-if="!loading && list.length === 0" class="tip">没有符合条件的{{ title }}</view>
				<view v-if="!loading && !hasMore && list.length > 0" class="tip">没有更多了</view>
			</scroll-view>
		</view>
	</uni-popup>
</template>

<script>
	export default {
		props: {
			title: {
				type: String,
				default: '单据'
			},
			// 取列表的接口函数，由使用方从 printApi.js 传进来
			api: {
				type: Function,
				required: true
			},
			// 只列已审核/已下发的单据
			docStatus: {
				type: String,
				default: '3'
			},
			// 列表里展示哪个日期字段
			dateField: {
				type: String,
				default: 'createTime'
			},
			dateLabel: {
				type: String,
				default: '日期'
			},
			selectedId: {
				type: String,
				default: ''
			}
		},

		data() {
			return {
				list: [],
				loading: false,
				hasMore: true,
				search: '',
				searchTimer: null,
				current: 1,
				size: 20,
				pages: 0
			}
		},

		methods: {
			open() {
				this.$refs.popup.open()
				this.reload()
			},

			close() {
				this.$refs.popup.close()
			},

			handleSearch() {
				clearTimeout(this.searchTimer)
				this.searchTimer = setTimeout(() => this.reload(), 500)
			},

			handleClearSearch() {
				this.search = ''
				this.reload()
			},

			reload() {
				this.list = []
				this.current = 1
				this.pages = 0
				this.hasMore = true
				this.loadList()
			},

			async loadList() {
				if (this.loading || !this.hasMore) return
				this.loading = true
				try {
					const params = {
						pageNo: this.current,
						pageSize: this.size,
						docStatus: this.docStatus
					}
					if (this.search) params.docNo = this.search

					const res = await this.api(params)
					if (res && res.data && res.data.code === 200) {
						const result = res.data.result || {}
						this.list = this.list.concat(result.records || [])
						this.pages = result.pages || 0
						this.current = (result.current || 1) + 1
						this.hasMore = (result.current || 1) < this.pages
					} else {
						this.hasMore = false
					}
				} catch (e) {
					console.error('获取' + this.title + '失败:', e)
					this.hasMore = false
				} finally {
					this.loading = false
				}
			},

			handleSelect(item) {
				this.$emit('select', item)
				this.close()
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

	.doc-scroll {
		max-height: 62vh;
	}

	.doc-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 24rpx;
		border-bottom: 1rpx solid #f5f5f5;

		&:active {
			background: #fafafa;
		}

		&.selected {
			background: rgba(22, 119, 255, 0.04);
		}
	}

	.doc-content {
		flex: 1;
		min-width: 0;
	}

	.doc-no {
		display: block;
		font-size: 30rpx;
		color: #333;
		font-weight: 500;
		margin-bottom: 8rpx;
	}

	.doc-desc {
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

	.tip {
		padding: 60rpx 0;
		text-align: center;
		color: #9c9c9c;
		font-size: 26rpx;
	}
</style>
