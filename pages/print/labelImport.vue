<template>
	<view class="container">
		<view class="card">
			<text class="card-title">从 CodeSoft 导入</text>
			<view class="hint">
				在电脑上用 CSPrintService 解析 .Lab 文件生成二维码，然后点下面的输入框、按 PDA 侧边的实体扫码键扫进来。
				离线码很密，摄像头基本读不动，用实体扫码头。
			</view>
			<!-- maxlength 不写就是 140，扫码头按键注入到第 141 字就被组件丢掉了 -->
			<textarea class="paste" v-model="pasted" maxlength="-1" :focus="scanFocus" @input="onScanInput"
				@focus="scanFocus = true" @blur="scanFocus = false"
				placeholder="点这里聚焦后按实体扫码键；也可以直接粘贴内容" />
			<view class="count-row">
				<text class="count">已收到 {{ pasted.length }} 字</text>
				<text class="count tip" v-if="scanning">扫码接收中...</text>
			</view>
			<view class="btn-row">
				<button size="mini" type="primary" @click="readyScan">准备扫码</button>
				<button size="mini" @click="parsePasted">解析内容</button>
				<button size="mini" @click="clear">清空</button>
			</view>
			<view class="hint">
				扫完会自动解析。若一直收不满，把 PDA「扫码设置」里的输出方式改成「键盘模式」；
				元素太多装不进离线码时，在电脑上改用「回连二维码」，那种码很稀疏，摄像头也能扫。
			</view>
			<view class="btn-row">
				<button size="mini" @click="scan">用摄像头扫（回连码用）</button>
			</view>
		</view>

		<view class="card" v-if="online">
			<text class="card-title">回连二维码</text>
			<view class="row">
				<text class="label">服务地址</text>
				<text class="value">{{ online.ws }}</text>
			</view>
			<view class="row">
				<text class="label">标签文件</text>
				<text class="value">{{ online.labelFile || '（未指定）' }}</text>
			</view>
			<view class="btn-row">
				<button size="mini" type="primary" @click="fetchOnline">连接并取最新解析结果</button>
			</view>
			<view class="hint">
				PDA 要和跑 CodeSoft 的那台电脑在同一网段，且电脑上的 CSPrintService 正在运行。
			</view>
		</view>

		<view class="card" v-if="error">
			<text class="card-title err">解析失败</text>
			<view class="hint err-text">{{ error }}</view>
		</view>

		<template v-if="tpl">
			<view class="card">
				<text class="card-title">模板信息</text>
				<view class="row">
					<text class="label">模板名称</text>
					<input class="ipt wide" v-model="tpl.name" />
				</view>
				<view class="row">
					<text class="label">标签尺寸</text>
					<text class="value">{{ sizeInfo }}</text>
				</view>
				<view class="row">
					<text class="label">打印机 DPI</text>
					<text class="value">{{ tpl.page.dpi }} dpi</text>
				</view>
				<view class="row">
					<text class="label">纸张类型</text>
					<text class="value">{{ mediaLabel }}</text>
				</view>
				<view class="row">
					<text class="label">元素数量</text>
					<text class="value">{{ tpl.elements.length }} 个（{{ elementSummary }}）</text>
				</view>
				<view class="row">
					<text class="label">来源文件</text>
					<text class="value">{{ tpl.source.labFile || '-' }}</text>
				</view>
			</view>

			<view class="card">
				<text class="card-title">需要的变量</text>
				<view v-if="usedVars.length === 0" class="empty">这个模板没有用到变量，每张标签内容都一样</view>
				<view class="row" v-for="key in usedVars" :key="key">
					<text class="label">{{ key }}</text>
					<text class="value" :class="{ warn: computedSet.indexOf(key) !== -1 }">
						{{ computedSet.indexOf(key) !== -1 ? 'CodeSoft 自己算的，会印成空白' : '打印时按同名字段自动填入' }}
					</text>
				</view>
				<view class="hint">
					变量只按名字自动匹配 MES 记录里的同名字段。名字对不上就会印成空白，
					可以保存后到「标签模板」页把占位符改成实际字段名。
				</view>
			</view>

			<view class="card" v-if="warnings.length > 0">
				<text class="card-title warn">转换提示（{{ warnings.length }}）</text>
				<view class="warn-item" v-for="(w, i) in warnings" :key="i">{{ i + 1 }}. {{ w }}</view>
			</view>

			<view class="card">
				<text class="card-title">ZPL 预览</text>
				<textarea class="zpl-preview" :value="zplPreview" maxlength="-1" disabled />
			</view>

			<view class="card">
				<text class="card-title">保存后必做</text>
				<view class="hint">
					新模板的尺寸和之前的不一样时，必须点一次「写入打印机并校准」，
					否则打印机还按上一次量到的长度走纸，标签会印得偏长或跨张。
				</view>
				<view class="btn-row">
					<button size="mini" @click="applyMedia">写入打印机并校准</button>
					<button size="mini" @click="testPrint">测试打印</button>
				</view>
			</view>
		</template>

		<view class="footer" v-if="tpl">
			<button type="default" @click="clear">放弃</button>
			<button type="primary" @click="save">保存为模板</button>
		</view>
	</view>
</template>

<script>
	import printer from '@/utils/zebraPrinter.js'
	import { decodePayload, fetchViaWs, toZplTemplate, templateVariables } from '@/utils/labTemplate.js'
	import {
		buildZpl,
		buildApplyMediaCommand,
		labelDots,
		loadTemplates,
		saveTemplates,
		MEDIA_TYPES,
		ELEMENT_TYPES
	} from '@/utils/zplTemplate.js'

	export default {
		data() {
			return {
				pasted: '',
				scanFocus: false,
				scanning: false,
				online: null,
				error: '',
				tpl: null,
				warnings: []
			}
		},
		beforeDestroy() {
			if (this.autoTimer) clearTimeout(this.autoTimer)
		},
		computed: {
			sizeInfo() {
				const d = labelDots(this.tpl)
				return this.tpl.page.widthMm + ' × ' + this.tpl.page.heightMm + ' mm（' +
					d.widthDots + ' × ' + d.heightDots + ' 点）'
			},
			mediaLabel() {
				const m = MEDIA_TYPES.find((x) => x.value === this.tpl.page.mediaType)
				return m ? m.label : this.tpl.page.mediaType
			},
			elementSummary() {
				const count = {}
				this.tpl.elements.forEach((el) => {
					count[el.type] = (count[el.type] || 0) + 1
				})
				return Object.keys(count).map((k) => {
					const t = ELEMENT_TYPES.find((x) => x.value === k)
					return (t ? t.label : k) + ' ' + count[k]
				}).join('、')
			},
			usedVars() {
				return templateVariables(this.tpl)
			},
			computedSet() {
				return (this.tpl.source && this.tpl.source.computedVariables) || []
			},
			// 没有真实业务数据，用变量名本身当样例值，方便核对排版
			sampleData() {
				const data = {}
				this.usedVars.forEach((k) => {
					data[k] = this.computedSet.indexOf(k) === -1 ? k.toUpperCase() : ''
				})
				return data
			},
			zplPreview() {
				try {
					return buildZpl(this.tpl, this.sampleData)
				} catch (e) {
					return '生成失败: ' + e.message
				}
			}
		},
		methods: {
			toast(title) {
				uni.showToast({ title, icon: 'none', duration: 3000 })
			},

			clear() {
				if (this.autoTimer) clearTimeout(this.autoTimer)
				this.autoTimer = null
				this.scanning = false
				this.pasted = ''
				this.online = null
				this.error = ''
				this.tpl = null
				this.warnings = []
			},

			readyScan() {
				this.scanFocus = true
				this.toast('已聚焦，请按实体扫码键')
			},

			// 扫码头是逐字符注入的，中途每个字都解析一次只会刷一串错误，等它停下来再解析
			onScanInput() {
				this.scanning = true
				if (this.autoTimer) clearTimeout(this.autoTimer)
				this.autoTimer = setTimeout(() => {
					this.autoTimer = null
					this.scanning = false
					if (this.pasted.trim().length >= 40) this.handleRaw(this.pasted)
				}, 600)
			},

			scan() {
				uni.scanCode({
					scanType: ['qrCode'],
					success: (res) => this.handleRaw(res.result),
					fail: () => this.toast('没有扫到内容')
				})
			},

			parsePasted() {
				if (!this.pasted.trim()) return this.toast('还没有内容，先扫码或粘贴')
				this.handleRaw(this.pasted)
			},

			handleRaw(raw) {
				this.error = ''
				this.online = null
				this.tpl = null
				this.warnings = []
				let decoded
				try {
					decoded = decodePayload(raw)
				} catch (e) {
					this.error = e.message
					return
				}
				// 解析成了就把软键盘收掉，不然预览全被挡住
				this.scanFocus = false
				uni.hideKeyboard()
				if (decoded.kind === 'online') {
					this.online = decoded
					return
				}
				this.applyResult(decoded.result)
			},

			async fetchOnline() {
				uni.showLoading({ title: '连接中...', mask: true })
				try {
					const result = await fetchViaWs(this.online.ws, this.online.labelFile)
					uni.hideLoading()
					this.applyResult(result)
				} catch (e) {
					uni.hideLoading()
					this.error = e.message
				}
			},

			// result 是 CSPrintService 的 LabParseResult，它自己的 warnings 也要一起显示
			applyResult(result) {
				try {
					const out = toZplTemplate(result.pdaTemplate)
					this.tpl = out.template
					const fromCs = (result.warnings || []).map((w) => 'CodeSoft：' + w)
					this.warnings = fromCs.concat(out.warnings)
					this.online = null
					this.error = ''
				} catch (e) {
					this.error = e.message
				}
			},

			save() {
				const name = String(this.tpl.name || '').trim()
				if (!name) return this.toast('模板名称不能为空')
				this.tpl.name = name

				const list = loadTemplates()
				const same = list.findIndex((t) => t.name === name)
				if (same === -1) return this.doSave(list, -1)

				uni.showModal({
					title: '已有同名模板',
					content: '「' + name + '」已存在，覆盖它还是另存一个新的？',
					confirmText: '覆盖',
					cancelText: '另存新的',
					success: (res) => this.doSave(list, res.confirm ? same : -1)
				})
			},

			doSave(list, replaceAt) {
				const tpl = JSON.parse(JSON.stringify(this.tpl))
				if (replaceAt === -1) {
					tpl.id = 'tpl_' + Date.now()
					list.push(tpl)
				} else {
					// 覆盖时保留原 id，业务页面记住的模板选择才不会失效
					tpl.id = list[replaceAt].id
					list.splice(replaceAt, 1, tpl)
				}
				saveTemplates(list)
				this.tpl = tpl
				this.toast('已保存，模板 id: ' + tpl.id)
			},

			async applyMedia() {
				uni.showLoading({ title: '写入中...', mask: true })
				try {
					await printer.printWithSaved(buildApplyMediaCommand(this.tpl))
					uni.hideLoading()
					this.toast(this.tpl.page.mediaType === 'continuous'
						? '定长已写入打印机'
						: '已发送校准，打印机会走 2-3 张标签测量长度')
				} catch (e) {
					uni.hideLoading()
					this.toast(e.message)
				}
			},

			async testPrint() {
				uni.showLoading({ title: '发送中...', mask: true })
				try {
					await printer.printWithSaved(buildZpl(this.tpl, this.sampleData))
					uni.hideLoading()
					// 蓝牙写完即返回，纸有没有出来只能看打印机
					this.toast('指令已发出，请看打印机是否出纸')
				} catch (e) {
					uni.hideLoading()
					this.toast(e.message)
				}
			}
		}
	}
</script>

<style scoped>
	.container {
		padding: 20rpx;
		padding-bottom: 160rpx;
		background: #f5f5f5;
		min-height: 100vh;
	}

	.card {
		background: #fff;
		border-radius: 12rpx;
		padding: 24rpx;
		margin-bottom: 20rpx;
	}

	.card-title {
		font-size: 30rpx;
		font-weight: bold;
		color: #333;
		display: block;
		margin-bottom: 12rpx;
	}

	.card-title.warn {
		color: #E8833A;
	}

	.card-title.err {
		color: #fa5151;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12rpx 0;
		border-bottom: 1rpx solid #f2f2f2;
	}

	.label {
		font-size: 27rpx;
		color: #666;
		flex-shrink: 0;
		margin-right: 20rpx;
	}

	.value {
		font-size: 26rpx;
		color: #333;
		text-align: right;
		flex: 1;
		word-break: break-all;
	}

	.value.warn {
		color: #E8833A;
	}

	.ipt {
		font-size: 27rpx;
		color: #333;
		text-align: right;
		width: 240rpx;
		padding: 6rpx 0;
	}

	.ipt.wide {
		width: 380rpx;
	}

	.hint {
		font-size: 23rpx;
		color: #999;
		line-height: 1.6;
		margin-top: 12rpx;
	}

	.hint.err-text {
		color: #fa5151;
	}

	.btn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 14rpx;
		margin-top: 16rpx;
	}

	.empty {
		font-size: 26rpx;
		color: #999;
		text-align: center;
		padding: 24rpx 0;
	}

	.paste {
		width: 100%;
		height: 200rpx;
		border: 1rpx solid #ddd;
		border-radius: 8rpx;
		padding: 16rpx;
		font-size: 24rpx;
		color: #333;
		box-sizing: border-box;
		margin-top: 12rpx;
	}

	.count-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 10rpx;
	}

	.count {
		font-size: 23rpx;
		color: #999;
	}

	.count.tip {
		color: #E8833A;
	}

	.warn-item {
		font-size: 24rpx;
		color: #8a6d3b;
		line-height: 1.6;
		padding: 10rpx 0;
		border-bottom: 1rpx solid #f7f2e8;
	}

	.zpl-preview {
		width: 100%;
		height: 340rpx;
		border: 1rpx solid #ddd;
		border-radius: 8rpx;
		padding: 16rpx;
		font-size: 22rpx;
		color: #555;
		box-sizing: border-box;
	}

	.footer {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		gap: 20rpx;
		padding: 16rpx 20rpx;
		background: #fff;
		box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
	}

	.footer button {
		flex: 1;
	}
</style>
