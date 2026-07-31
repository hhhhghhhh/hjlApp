<template>
	<view class="page">
		<!-- 筛选 + 工具条吸顶，列表用页面级滚动，底栏 fixed 贴底（同 docOpt.vue） -->
		<view class="top-bar">
			<!-- ===== 筛选区，查询后自动折起，给列表留屏幕 ===== -->
			<view class="filter-card">
				<view class="filter-head" @click="filterOpen = !filterOpen">
					<text class="filter-title">筛选条件</text>
					<text class="filter-sum">{{ filterSummary }}</text>
					<text class="filter-toggle">{{ filterOpen ? '收起' : '展开' }}</text>
				</view>

				<view class="filter-body" v-if="filterOpen">
					<view class="frow" v-for="f in config.filters" :key="f.key">
						<text class="flabel">{{ f.label }}</text>
						<input v-if="f.type === 'input'" class="fipt" v-model="form[f.key]"
							:placeholder="'输入' + f.label" confirm-type="search" @confirm="queryNormal" />
						<picker v-else :range="dictLabels(f)" :value="dictIndex(f)" @change="onDictChange(f, $event)">
							<text class="fpicker">{{ dictText(f) }} ▾</text>
						</picker>
					</view>

					<view class="frow" v-if="config.docFilter">
						<text class="flabel">{{ config.docFilter.label }}</text>
						<text class="fpicker" @click="openDoc">{{ doc ? doc.docNo : '选择' + config.docFilter.title }} ▾</text>
					</view>

					<view class="fbtns">
						<button size="mini" type="primary" @click="queryNormal">查询</button>
						<button size="mini" @click="queryAll">查询全部</button>
						<button size="mini" @click="reset">重置</button>
					</view>
					<text class="fhint">「查询全部」一次最多取 {{ ALL_LIMIT }} 条，方便全选后批量打印。</text>
				</view>
			</view>

			<view class="chip-row" v-if="doc">
				<text class="chip">{{ config.docFilter.title }}：{{ doc.docNo }}</text>
				<text class="chip-x" @click="clearDoc">清除</text>
			</view>

			<!-- ===== 选择工具条 ===== -->
			<view class="toolbar">
				<text class="count">已选 <text class="count-n">{{ selected.length }}</text> / 已加载 {{ list.length }}<text
						v-if="total > list.length">（共 {{ total }}）</text></text>
				<view class="tool-ops">
					<text class="op" @click="selectAll">全选</text>
					<text class="op" @click="clearSel">清空</text>
				</view>
			</view>
		</view>

		<!-- ===== 列表，滚动交给页面，触底由所在页面的 onReachBottom 转发 ===== -->
		<view class="list">
			<view v-for="item in list" :key="rowKey(item)" class="item" :class="{ on: isSel(item) }"
				@click="toggle(item)">
				<view class="check">
					<uni-icons :type="isSel(item) ? 'checkbox-filled' : 'circle'" size="22"
						:color="isSel(item) ? '#1677ff' : '#c8c8c8'"></uni-icons>
				</view>
				<view class="body">
					<view class="line1">
						<text class="sn">{{ item[config.snKey] || '(无SN)' }}</text>
						<text v-if="printBadge" class="badge" :class="'tone-' + badgeTone(printBadge, item)">
							{{ badgeText(printBadge, item) }}
						</text>
					</view>
					<view class="line2">
						<text class="name">{{ item[config.nameKey] || '' }}</text>
						<!-- 展开要和选中分开，不然点详情会顺手勾上一条 -->
						<text class="more" @click.stop="toggleExpand(item)">{{ isExp(item) ? '收起 ▴' : '详情 ▾' }}</text>
					</view>
					<view class="detail" v-if="isExp(item)">
						<view class="badges" v-if="otherBadges.length > 0">
							<text class="badge" v-for="b in otherBadges" :key="b.key" :class="'tone-' + badgeTone(b, item)">
								{{ badgeText(b, item) }}
							</text>
						</view>
						<text class="field" v-for="f in visibleFields(item)" :key="f.key">{{ f.label }}：{{ item[f.key] }}</text>
					</view>
				</view>
			</view>

			<view v-if="loading" class="tip">加载中...</view>
			<view v-if="!loading && list.length === 0" class="tip">没有数据，换个条件试试</view>
			<view v-if="!loading && !hasMore && list.length > 0" class="tip">没有更多了</view>
			<!-- 给 fixed 底栏留位置，否则最后一条被压住点不到 -->
			<view class="bottom-spacer"></view>
		</view>

		<view class="bottom">
			<button class="bt" type="primary" :disabled="selected.length === 0" @click="openPrint(false)">
				打印（{{ selected.length }}）
			</button>
			<button class="bt" v-if="config.lotPrint" :disabled="selected.length === 0" @click="openPrint(true)">
				按批次打印（{{ lotGroups.length }}）
			</button>
		</view>

		<!-- ===== 打印弹窗 ===== -->
		<uni-popup ref="printPopup" type="bottom" :mask-click="printState !== 'running'">
			<view class="pp">
				<view class="pp-head">
					<text class="pp-title">{{ printTitle }}</text>
					<text class="pp-close" v-if="printState !== 'running'" @click="closePrint">关闭</text>
				</view>

				<!-- 打印前 -->
				<view v-if="printState === 'idle'" class="pp-body">
					<view class="frow">
						<text class="flabel">标签模板</text>
						<picker :range="templateNames" :value="templateIndex" @change="onTemplateChange">
							<text class="fpicker">{{ templateNames[templateIndex] || '无模板' }} ▾</text>
						</picker>
					</view>
					<view class="frow">
						<text class="flabel">每条份数</text>
						<input class="fipt" type="number" v-model="copies" />
					</view>
					<view class="frow">
						<text class="flabel">默认打印机</text>
						<text class="fvalue">{{ printerName }}</text>
					</view>
					<view v-if="lotMode" class="lot-box">
						<text class="lot-title">由 {{ lotSourceCount }} 条记录归并成 {{ lotRows.length }} 个批次SN</text>
						<view class="lot-row" v-for="(g, i) in lotRows" :key="i">
							<text class="lot-code">{{ g.itemLotSn || '(无批次SN)' }}</text>
							<text class="lot-n">{{ g.count }} 条</text>
						</view>
					</view>
					<view class="pp-hint" v-if="missingVars.length > 0">
						模板需要的 {{ missingVars.join('、') }} 在记录里找不到同名字段，这些位置会印成空白。
					</view>
					<view class="pp-hint" v-if="lotMode">
						批次标签不带 SN，模板里的 {{ config.snKey }} 会留空。这种打印不回写 SN 的打印状态。
					</view>
					<view class="pp-hint">
						共 {{ jobs.length }} 张标签，每张 {{ copies }} 份，合计 {{ jobs.length * (Number(copies) || 1) }} 张。
					</view>
					<button class="pp-go" type="primary" @click="startPrint">开始打印</button>
				</view>

				<!-- 打印中 -->
				<view v-else-if="printState === 'running'" class="pp-body">
					<text class="pp-progress">正在打印 {{ done }} / {{ jobs.length }}</text>
					<text class="pp-current">{{ currentSn }}</text>
					<view class="pp-hint">蓝牙是发出即返回，进度只代表指令已送到打印机。</view>
					<button class="pp-go" @click="cancelPrint">停止</button>
				</view>

				<!-- 打印后 -->
				<view v-else class="pp-body">
					<text class="pp-result">指令已发出 {{ okList.length }} 条，失败 {{ failList.length }} 条{{ canceled ? '（已手动停止）' : '' }}</text>
					<view class="pp-hint">纸有没有真的出来只能看打印机，缺纸或卡纸时打印机不会回报给 App。</view>
					<view class="fail-item" v-for="(f, i) in failList" :key="i">
						{{ f.sn }} — {{ f.message }}
					</view>
					<text class="pp-hint" v-if="writebackMsg">{{ writebackMsg }}</text>
					<button class="pp-go" v-if="failList.length > 0" type="primary" @click="retryFailed">只重打失败项</button>
					<button class="pp-go" v-else @click="closePrint">完成</button>
				</view>
			</view>
		</uni-popup>

		<docSelectPopup v-if="config.docFilter" ref="docPopup" :title="config.docFilter.title"
			:api="config.docFilter.api" :date-field="config.docFilter.dateField"
			:date-label="config.docFilter.dateLabel" :selected-id="doc ? doc.id : ''" @select="onDocSelect" />
	</view>
</template>

<script>
	import printer from '@/utils/zebraPrinter.js'
	import { getDictItems } from '@/api/printApi.js'
	import { buildZpl, loadTemplates } from '@/utils/zplTemplate.js'
	import { templateVariables } from '@/utils/labTemplate.js'
	import docSelectPopup from './docSelectPopup.vue'

	export default {
		components: { docSelectPopup },
		props: {
			config: {
				type: Object,
				required: true
			}
		},
		data() {
			return {
				ALL_LIMIT: 1000,
				filterOpen: true,
				form: {},
				doc: null,
				dicts: {},

				list: [],
				selected: [],
				expanded: [],
				allMode: false,
				loading: false,
				hasMore: true,
				current: 1,
				size: 20,
				pages: 0,
				total: 0,

				lotMode: false,
				lotRows: [],

				templates: [],
				templateIndex: 0,
				copies: 1,

				printState: 'idle',
				jobs: [],
				done: 0,
				currentSn: '',
				okList: [],
				failList: [],
				canceled: false,
				writebackMsg: ''
			}
		},
		computed: {
			templateNames() {
				return this.templates.map((t) => t.name || '未命名')
			},
			currentTemplate() {
				return this.templates[this.templateIndex] || null
			},
			printerName() {
				const saved = printer.loadPrinter()
				return saved && saved.name ? saved.name : '未设置，请先到「蓝牙打印」页设为默认'
			},
			printTitle() {
				if (this.printState === 'running') return '打印中'
				if (this.printState === 'done') return '打印结果'
				return this.lotMode ? '按批次打印' : '打印设置'
			},
			printBadge() {
				const badges = this.config.badges || []
				return badges.find((b) => b.key === 'barcodeStatus') || badges[0] || null
			},
			otherBadges() {
				const p = this.printBadge
				return (this.config.badges || []).filter((b) => b !== p)
			},
			// 选中的记录按 itemLotSn 去重，每个唯一的 itemLotSn 只出一张标签
			lotGroups() {
				if (!this.config.lotPrint) return []
				const seen = {}
				const out = []
				this.selected.forEach((r) => {
					const lotSn = r.itemLotSn
					if (lotSn === undefined || lotSn === null || lotSn === '') return
					if (seen[lotSn]) {
						seen[lotSn].count++
						return
					}
					// 批次标签不该带某一条的 SN，清掉避免印出一个任意 SN
					const g = {
						itemLotSn: lotSn,
						count: 1,
						record: { ...r, [this.config.snKey]: '' }
					}
					seen[lotSn] = g
					out.push(g)
				})
				return out
			},
			lotSourceCount() {
				return this.lotRows.reduce((n, g) => n + g.count, 0)
			},
			missingVars() {
				const sample = this.jobs[0]
				if (!this.currentTemplate || !sample) return []
				return templateVariables(this.currentTemplate).filter((k) => sample[k] === undefined || sample[k] === null)
			},
			filterSummary() {
				const parts = []
				;(this.config.filters || []).forEach((f) => {
					const v = this.form[f.key]
					if (v === undefined || v === null || v === '') return
					parts.push(f.type === 'input' ? v : this.dictText(f))
				})
				if (this.doc) parts.push(this.doc.docNo)
				return parts.length === 0 ? '未设置' : parts.join(' / ')
			}
		},
		created() {
			this.templates = loadTemplates()
			this.restoreTemplate()
			this.loadDicts()
			this.query()
		},
		methods: {
			toast(title) {
				uni.showToast({ title, icon: 'none', duration: 3000 })
			},

			tplKey() {
				return 'sn_print_tpl_' + this.config.snKey + (this.lotMode ? '_lot' : '')
			},

			restoreTemplate() {
				const lastId = uni.getStorageSync(this.tplKey())
				const i = this.templates.findIndex((t) => t.id === lastId)
				this.templateIndex = i === -1 ? 0 : i
			},

			rowKey(item) {
				return item.id || item[this.config.snKey]
			},

			// ---------- 字典 ----------
			async loadDicts() {
				const codes = (this.config.filters || [])
					.filter((f) => f.type === 'dict' && f.dictCode)
					.map((f) => f.dictCode)
				for (const code of codes) {
					try {
						const res = await getDictItems(code)
						const body = res && res.data ? res.data : {}
						const items = Array.isArray(body.result) ? body.result : (Array.isArray(body) ? body : [])
						this.$set(this.dicts, code, items)
					} catch (e) {
						console.error('加载字典失败 ' + code, e)
					}
				}
			},

			dictOptions(f) {
				return [{ label: '全部', value: '' }].concat(this.dicts[f.dictCode] || [])
			},

			dictLabels(f) {
				return this.dictOptions(f).map((o) => o.label)
			},

			dictIndex(f) {
				const cur = this.form[f.key] === undefined ? '' : String(this.form[f.key])
				const i = this.dictOptions(f).findIndex((o) => String(o.value) === cur)
				return i === -1 ? 0 : i
			},

			dictText(f) {
				const opts = this.dictOptions(f)
				return (opts[this.dictIndex(f)] || opts[0]).label
			},

			onDictChange(f, e) {
				const opt = this.dictOptions(f)[Number(e.detail.value)]
				this.$set(this.form, f.key, opt ? opt.value : '')
			},

			visibleFields(item) {
				return (this.config.cardFields || []).filter((f) => {
					if (f.key === this.config.nameKey) return false
					const v = item[f.key]
					return v !== undefined && v !== null && v !== ''
				})
			},

			isExp(item) {
				return this.expanded.indexOf(this.rowKey(item)) !== -1
			},

			toggleExpand(item) {
				const k = this.rowKey(item)
				const i = this.expanded.indexOf(k)
				if (i === -1) this.expanded.push(k)
				else this.expanded.splice(i, 1)
			},

			badgeText(b, item) {
				const v = item[b.key]
				return (b.map && b.map[v]) || (v === undefined || v === null || v === '' ? '-' : v)
			},

			badgeTone(b, item) {
				return (b.tone && b.tone[item[b.key]]) || 'grey'
			},

			openDoc() {
				this.$refs.docPopup.open()
			},

			onDocSelect(row) {
				this.doc = row
				this.query()
			},

			clearDoc() {
				this.doc = null
				this.query()
			},

			query() {
				this.list = []
				this.selected = []
				this.expanded = []
				this.current = 1
				this.pages = 0
				this.total = 0
				this.size = this.allMode ? this.ALL_LIMIT : 20
				this.hasMore = true
				this.filterOpen = false
				this.loadMore()
			},

			queryNormal() {
				this.allMode = false
				this.query()
			},

			queryAll() {
				this.allMode = true
				this.query()
			},

			reset() {
				this.form = {}
				this.doc = null
				this.allMode = false
				this.query()
				this.filterOpen = true
			},

			async loadMore() {
				if (this.loading || !this.hasMore) return
				this.loading = true
				try {
					const params = { pageNo: this.current, pageSize: this.size }
					Object.keys(this.form).forEach((k) => {
						const v = this.form[k]
						if (v !== undefined && v !== null && v !== '') params[k] = v
					})
					if (this.doc && this.config.docFilter) params[this.config.docFilter.paramKey] = this.doc.docNo

					const res = await this.config.listApi(params)
					if (res && res.data && res.data.code === 200) {
						const result = res.data.result || {}
						this.list = this.list.concat(result.records || [])
						this.pages = result.pages || 0
						this.total = result.total || this.list.length
						this.current = (result.current || 1) + 1
						this.hasMore = (result.current || 1) < this.pages
						if (this.allMode) {
							this.hasMore = false
							if (this.total > this.list.length) {
								this.toast('共 ' + this.total + ' 条，超出上限，只取了前 ' + this.list.length + ' 条')
							}
						}
					} else {
						this.hasMore = false
						this.toast((res && res.data && res.data.message) || '查询失败')
					}
				} catch (e) {
					this.hasMore = false
					console.error('查询失败', e)
				} finally {
					this.loading = false
				}
			},

			isSel(item) {
				return this.selected.indexOf(item) !== -1
			},

			toggle(item) {
				const i = this.selected.indexOf(item)
				if (i === -1) this.selected.push(item)
				else this.selected.splice(i, 1)
			},

			selectAll() {
				this.selected = this.list.slice()
			},

			clearSel() {
				this.selected = []
			},

			openPrint(lotMode) {
				if (this.templates.length === 0) return this.toast('还没有标签模板，先去「模板导入」扫码导入')
				if (lotMode && this.lotGroups.length === 0) {
					return this.toast('选中的记录里没有批次SN（itemLotSn），无法按批次打印')
				}
				this.lotMode = !!lotMode
				this.restoreTemplate()
				this.printState = 'idle'
				this.lotRows = lotMode ? this.lotGroups.slice() : []
				this.jobs = lotMode ? this.lotRows.map((g) => g.record) : this.selected.slice()
				this.$refs.printPopup.open()
			},

			closePrint() {
				this.$refs.printPopup.close()
				this.printState = 'idle'
			},

			onTemplateChange(e) {
				this.templateIndex = Number(e.detail.value)
				uni.setStorageSync(this.tplKey(), this.currentTemplate.id)
			},

			async preflight() {
				if (!printer.isConnected()) {
					const saved = printer.loadPrinter()
					if (!saved || !saved.address) {
						throw new Error('未设置默认打印机，请先到「蓝牙打印」页面连接并设为默认')
					}
					await printer.connect(saved.address, saved.name)
				}
				let st
				try {
					st = await printer.getStatus()
				} catch (e) {
					console.warn('状态查询失败，继续打印:', e.message)
					return
				}
				if (!st.parsed) return
				if (st.isPaperOut) throw new Error('打印机缺纸，装好纸再打')
				if (st.isHeadOpen) throw new Error('打印机上盖没合上')
				if (st.isPaused) throw new Error('打印机处于暂停状态，请到「蓝牙打印」页点「清除打印机缓存」')
			},

			async startPrint() {
				const tpl = this.currentTemplate
				if (!tpl) return this.toast('先选一个标签模板')
				if (this.jobs.length === 0) return this.toast('没有要打印的记录')

				uni.showLoading({ title: '检查打印机...', mask: true })
				try {
					await this.preflight()
					uni.hideLoading()
				} catch (e) {
					uni.hideLoading()
					return this.toast(e.message)
				}

				uni.setStorageSync(this.tplKey(), tpl.id)
				const copies = Math.max(1, Number(this.copies) || 1)
				const job = { ...tpl, print: { ...tpl.print, copies } }

				this.printState = 'running'
				this.done = 0
				this.okList = []
				this.failList = []
				this.canceled = false
				this.writebackMsg = ''

				for (const record of this.jobs) {
					if (this.canceled) break
					this.currentSn = record[this.config.snKey] || ''
					try {
						await printer.printWithSaved(buildZpl(job, record))
						this.okList.push(record)
					} catch (e) {
						this.failList.push({ record, sn: this.currentSn, message: e.message })
					}
					this.done++
					await new Promise((r) => setTimeout(r, 300))
				}

				this.printState = 'done'
				this.currentSn = ''
				await this.writeback()
			},

			cancelPrint() {
				this.canceled = true
			},

			async writeback() {
				if (this.lotMode) {
					this.writebackMsg = '按批次打印，未回写 SN 打印状态'
					return
				}
				if (this.okList.length === 0) {
					this.writebackMsg = '没有成功的记录，未回写打印状态'
					return
				}
				const printedIds = this.okList.map((r) => r.id || r[this.config.snKey])
				try {
					const res = await this.config.updatePrintedApi({ printedIds })
					if (res && res.data && res.data.code === 200) {
						this.writebackMsg = '已回写 ' + printedIds.length + ' 条打印状态'
						this.selected = []
						this.query()
					} else {
						this.writebackMsg = '打印状态回写失败：' + ((res && res.data && res.data.message) || '未知错误')
					}
				} catch (e) {
					this.writebackMsg = '打印状态回写失败，请手动刷新列表'
				}
			},

			retryFailed() {
				const recs = this.failList.map((f) => f.record)
				this.jobs = recs
				if (this.lotMode) this.lotRows = this.lotRows.filter((g) => recs.indexOf(g.record) !== -1)
				this.printState = 'idle'
			}
		}
	}
</script>

<style lang="scss" scoped>
	.page {
		min-height: 100vh;
		background: #f5f5f5;
	}

	.top-bar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: #fff;
		box-shadow: 0 1rpx 8rpx rgba(0, 0, 0, .03);
	}

	.filter-card {
		background: #fff;
	}

	.filter-head {
		display: flex;
		align-items: center;
		padding: 20rpx 24rpx;
		border-bottom: 1rpx solid #f0f0f0;
	}

	.filter-title {
		font-size: 28rpx;
		color: #333;
		font-weight: 500;
		flex-shrink: 0;
	}

	.filter-sum {
		flex: 1;
		font-size: 24rpx;
		color: #9c9c9c;
		margin: 0 16rpx;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.filter-toggle {
		font-size: 26rpx;
		color: #1677ff;
		flex-shrink: 0;
	}

	.filter-body {
		padding: 8rpx 24rpx 20rpx;
	}

	.frow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14rpx 0;
		border-bottom: 1rpx solid #f5f5f5;
	}

	.flabel {
		font-size: 27rpx;
		color: #666;
		flex-shrink: 0;
		margin-right: 20rpx;
	}

	.fipt {
		font-size: 27rpx;
		color: #333;
		text-align: right;
		flex: 1;
	}

	.fpicker {
		font-size: 27rpx;
		color: #1677ff;
	}

	.fvalue {
		font-size: 26rpx;
		color: #333;
		text-align: right;
		flex: 1;
	}

	.fbtns {
		display: flex;
		gap: 20rpx;
		margin-top: 20rpx;

		button {
			flex: 1;
		}
	}

	.fhint {
		display: block;
		font-size: 22rpx;
		color: #9c9c9c;
		margin-top: 12rpx;
		line-height: 1.6;
	}

	.chip-row {
		display: flex;
		align-items: center;
		padding: 14rpx 24rpx;
		background: #eaf2ff;
	}

	.chip {
		flex: 1;
		font-size: 25rpx;
		color: #1677ff;
	}

	.chip-x {
		font-size: 25rpx;
		color: #fa5151;
		padding-left: 20rpx;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 24rpx;
		background: #fff;
		border-top: 1rpx solid #f0f0f0;
	}

	.count {
		font-size: 25rpx;
		color: #666;
	}

	.count-n {
		color: #1677ff;
		font-weight: bold;
	}

	.tool-ops {
		display: flex;
		gap: 28rpx;
	}

	.op {
		font-size: 26rpx;
		color: #1677ff;
	}

	.list {
		padding-bottom: 20rpx;
	}

	.bottom-spacer {
		height: 140rpx;
	}

	.item {
		display: flex;
		align-items: flex-start;
		padding: 22rpx 24rpx;
		margin: 16rpx 20rpx 0;
		background: #fff;
		border-radius: 12rpx;
		border: 2rpx solid transparent;

		&.on {
			border-color: #1677ff;
			background: #f7fbff;
		}
	}

	.check {
		padding: 4rpx 18rpx 0 0;
		flex-shrink: 0;
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.line1 {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.sn {
		flex: 1;
		min-width: 0;
		font-size: 34rpx;
		font-weight: bold;
		color: #333;
		word-break: break-all;
	}

	.line2 {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 8rpx;
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: 26rpx;
		color: #666;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.more {
		flex-shrink: 0;
		font-size: 25rpx;
		color: #1677ff;
		padding: 6rpx 0 6rpx 24rpx;
	}

	.detail {
		margin-top: 10rpx;
		padding-top: 12rpx;
		border-top: 1rpx solid #f0f0f0;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
		margin-bottom: 8rpx;
	}

	.badge {
		flex-shrink: 0;
		font-size: 22rpx;
		padding: 4rpx 14rpx;
		border-radius: 20rpx;
		color: #fff;

		&.tone-grey {
			background: #b0b0b0;
		}

		&.tone-green {
			background: #07c160;
		}

		&.tone-orange {
			background: #E8833A;
		}

		&.tone-blue {
			background: #1677ff;
		}

		&.tone-red {
			background: #fa5151;
		}
	}

	.field {
		display: block;
		font-size: 24rpx;
		color: #9c9c9c;
		line-height: 1.6;
		word-break: break-all;
	}

	.tip {
		padding: 50rpx 0;
		text-align: center;
		color: #9c9c9c;
		font-size: 26rpx;
	}

	.bottom {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		display: flex;
		gap: 16rpx;
		padding: 16rpx 20rpx;
		padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
		background: #fff;
		box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
	}

	.bt {
		flex: 1;
		margin: 0;
	}

	.pp {
		background: #fff;
		border-radius: 20rpx 20rpx 0 0;
		max-height: 80vh;
	}

	.pp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 24rpx;
		border-bottom: 1rpx solid #f0f0f0;
	}

	.pp-title {
		font-size: 30rpx;
		font-weight: bold;
		color: #333;
	}

	.pp-close {
		font-size: 28rpx;
		color: #666;
	}

	.pp-body {
		padding: 12rpx 24rpx 32rpx;
	}

	.pp-hint {
		display: block;
		font-size: 23rpx;
		color: #999;
		line-height: 1.6;
		margin-top: 16rpx;
	}

	.lot-box {
		margin-top: 16rpx;
		padding: 16rpx;
		background: #f7f9fc;
		border-radius: 10rpx;
		max-height: 320rpx;
		overflow-y: auto;
	}

	.lot-title {
		display: block;
		font-size: 25rpx;
		color: #333;
		font-weight: 500;
		padding-bottom: 10rpx;
	}

	.lot-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8rpx 0;
	}

	.lot-code {
		flex: 1;
		min-width: 0;
		font-size: 25rpx;
		color: #333;
		word-break: break-all;
	}

	.lot-n {
		flex-shrink: 0;
		font-size: 23rpx;
		color: #1677ff;
		padding-left: 16rpx;
	}

	.pp-progress {
		display: block;
		font-size: 32rpx;
		font-weight: bold;
		color: #1677ff;
		text-align: center;
		padding-top: 20rpx;
	}

	.pp-current {
		display: block;
		font-size: 26rpx;
		color: #666;
		text-align: center;
		padding-top: 10rpx;
		min-height: 40rpx;
	}

	.pp-result {
		display: block;
		font-size: 28rpx;
		color: #333;
		padding: 16rpx 0;
	}

	.fail-item {
		font-size: 24rpx;
		color: #fa5151;
		line-height: 1.6;
		padding: 8rpx 0;
		border-bottom: 1rpx solid #f7f0f0;
	}

	.pp-go {
		margin-top: 28rpx;
	}
</style>