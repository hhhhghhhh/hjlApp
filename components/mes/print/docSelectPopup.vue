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

			<!-- 时间快捷筛选：今天 / 近三天 / 本周 / 本月。后端按 planOutstockDate 的 from~to 过滤。 -->
			<view class="range-bar">
				<view v-for="r in ranges" :key="r.key" class="range-chip"
					:class="{ active: rangeKey === r.key }" @click="pickRange(r.key)">
					<text>{{ r.label }}</text>
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
						<uni-icons type="checkmarkempty" size="16" color="var(--color-primary)"></uni-icons>
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
			pages: 0,
			// 时间快捷段：'' 表示不限。选中后按 from/to（yyyy-MM-dd）传给后端。
			rangeKey: '',
			ranges: [
				{ key: 'today', label: '今天' },
				{ key: '3d', label: '近三天' },
				{ key: 'week', label: '本周' },
				{ key: 'month', label: '本月' }
			]
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

		// yyyy-MM-dd（本地时区，避免 toISOString 的 UTC 偏移串天）
		fmtDate(d) {
			const y = d.getFullYear()
			const m = String(d.getMonth() + 1).padStart(2, '0')
			const day = String(d.getDate()).padStart(2, '0')
			return y + '-' + m + '-' + day
		},

		// 快捷段 -> { from, to }。本周按周一为一周之始；本月为当月 1 号至今天。
		rangeDates(key) {
			const now = new Date()
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
			if (key === 'today') return { from: this.fmtDate(today), to: this.fmtDate(today) }
			if (key === '3d') {
				const s = new Date(today)
				s.setDate(s.getDate() - 2) // 含今天共 3 天
				return { from: this.fmtDate(s), to: this.fmtDate(today) }
			}
			if (key === 'week') {
				const dow = (today.getDay() + 6) % 7 // 周一=0
				const s = new Date(today)
				s.setDate(s.getDate() - dow)
				return { from: this.fmtDate(s), to: this.fmtDate(today) }
			}
			if (key === 'month') {
				const s = new Date(today.getFullYear(), today.getMonth(), 1)
				return { from: this.fmtDate(s), to: this.fmtDate(today) }
			}
			return { from: '', to: '' }
		},

		// 再点一次当前段 = 取消时间筛选
		pickRange(key) {
			this.rangeKey = (this.rangeKey === key) ? '' : key
			this.reload()
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
				// 时间快捷段：后端按 planOutstockDate >= from(00:00:00) 且 <= to(23:59:59) 过滤
				const rg = this.rangeKey ? this.rangeDates(this.rangeKey) : null
				if (rg && rg.from) params.from = rg.from
				if (rg && rg.to) params.to = rg.to

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
		background: var(--color-bg-card);
		border-radius: 20rpx 20rpx 0 0;
		max-height: 80vh;
	}

	.popup-header {
		display: flex;
		align-items: center;
		padding: 24rpx;
		border-bottom: 1rpx solid var(--color-border);
		background: var(--color-bg-card);
	}

	.search-box {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 16rpx 20rpx;
		background: var(--color-bg-card);
		border-radius: 8rpx;
		margin-right: 20rpx;
		border: 1rpx solid var(--color-border);
	}

	.search-input {
		flex: 1;
		font-size: var(--font-lg);
		margin: 0 16rpx;
		color: var(--color-text);
	}

	.clear-btn {
		padding: 6rpx;
		background: var(--color-bg-page);
		border-radius: 50%;
	}

	.close-btn {
		padding: 12rpx 0;
		font-size: var(--font-lg);
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.range-bar {
		display: flex;
		align-items: center;
		gap: 16rpx;
		padding: 16rpx 24rpx;
		border-bottom: 1rpx solid var(--color-border);
		background: var(--color-bg-card);
	}

	.range-chip {
		flex: 1;
		text-align: center;
		padding: 12rpx 0;
		font-size: var(--font-sm);
		color: var(--color-text-secondary);
		background: var(--color-bg-page);
		border-radius: 8rpx;
		border: 1rpx solid var(--color-border);

		&.active {
			color: var(--color-primary);
			border-color: var(--color-primary);
			background: rgba(22, 119, 255, 0.08);
			font-weight: 500;
		}
	}

	.doc-scroll {
		max-height: 62vh;
	}

	.doc-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 24rpx;
		border-bottom: 1rpx solid var(--color-border);

		&:active {
			background: var(--color-bg-card);
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
		font-size: var(--font-lg);
		color: var(--color-text);
		font-weight: 500;
		margin-bottom: 8rpx;
	}

	.doc-desc {
		font-size: var(--font-sm);
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
		font-size: var(--font-md);
	}
</style>
