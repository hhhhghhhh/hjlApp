<template>
	<view class="container">
		<view class="card">
			<view class="row">
				<text class="label">模板</text>
				<picker :range="templateNames" :value="templateIndex" @change="onTemplateChange">
					<text class="picker">{{ tpl.name }} ▾</text>
				</picker>
			</view>
			<view class="row">
				<text class="label">模板名称</text>
				<input class="ipt" v-model="tpl.name" placeholder="模板名称" />
			</view>
			<view class="btn-row">
				<button size="mini" @click="addTemplate">新建</button>
				<button size="mini" @click="copyTemplate">复制</button>
				<button size="mini" type="warn" @click="removeTemplate">删除</button>
			</view>
		</view>

		<view class="card">
			<text class="card-title">标签与页面设置</text>
			<view class="row">
				<text class="label">标签宽度 (mm)</text>
				<input class="ipt" type="digit" v-model="tpl.page.widthMm" />
			</view>
			<view class="row">
				<text class="label">标签高度 (mm)</text>
				<input class="ipt" type="digit" v-model="tpl.page.heightMm" />
			</view>
			<view class="row">
				<text class="label">纸张类型</text>
				<picker :range="mediaLabels" :value="mediaIndex" @change="onMediaChange">
					<text class="picker">{{ mediaLabel }} ▾</text>
				</picker>
			</view>
			<view class="row">
				<text class="label">打印机 DPI</text>
				<picker :range="dpiOptions" :value="dpiIndex" @change="onDpiChange">
					<text class="picker">{{ tpl.page.dpi }} dpi ▾</text>
				</picker>
			</view>
			<view class="row">
				<text class="label">换算结果</text>
				<text class="value">{{ dotsInfo }}</text>
			</view>
			<view class="btn-row">
				<button size="mini" type="primary" @click="applyMedia">写入打印机并校准</button>
			</view>
			<view class="hint">
				打印出来比标签长，几乎都是纸张类型/长度没生效：间隙纸和黑标纸的长度是打印机用传感器量出来的，ZPL 的 ^LL 会被忽略，换纸或改尺寸后必须点上面的按钮校准一次；只有连续纸才按 ^LL 定长走纸。另外 DPI 填错也会让实际尺寸成比例放大，203dpi 的机器填成 300 会长约 1.5 倍。
			</view>
		</view>

		<view class="card">
			<text class="card-title">打印参数</text>
			<view class="row">
				<text class="label">浓度 (0-30)</text>
				<input class="ipt" type="number" v-model="tpl.print.darkness" />
			</view>
			<view class="row">
				<text class="label">速度 (1-14)</text>
				<input class="ipt" type="number" v-model="tpl.print.speed" />
			</view>
			<view class="row">
				<text class="label">份数</text>
				<input class="ipt" type="number" v-model="tpl.print.copies" />
			</view>
			<view class="row">
				<text class="label">出纸方式</text>
				<picker :range="printModeLabels" :value="printModeIndex" @change="onPrintModeChange">
					<text class="picker">{{ printModeLabel }} ▾</text>
				</picker>
			</view>
			<view class="row">
				<text class="label">整体旋转 180°</text>
				<switch :checked="tpl.print.invert180" @change="e => tpl.print.invert180 = e.detail.value" />
			</view>
			<view class="row">
				<text class="label">中文字体文件</text>
				<input class="ipt" v-model="tpl.cjkFont" placeholder="E:GB18030.FNT" />
			</view>
			<view class="hint">中文打不出来时改这里，可在「蓝牙打印」页点「查询打印机字体」看实际有哪些 .FNT。</view>
		</view>

		<view class="card">
			<text class="card-title">标签元素</text>
			<view class="btn-row">
				<button size="mini" v-for="t in elementTypes" :key="t.value" @click="addElement(t.value)">
					+ {{ t.label }}
				</button>
			</view>

			<view v-if="tpl.elements.length === 0" class="empty">还没有元素，点上面按钮添加</view>

			<view class="element" v-for="(el, idx) in tpl.elements" :key="idx">
				<view class="element-head">
					<text class="element-title">{{ idx + 1 }}. {{ typeLabel(el.type) }}</text>
					<view class="element-ops">
						<text class="op" @click="moveElement(idx, -1)">上移</text>
						<text class="op" @click="moveElement(idx, 1)">下移</text>
						<text class="op del" @click="removeElement(idx)">删除</text>
					</view>
				</view>

				<view class="row">
					<text class="label">X (mm)</text>
					<input class="ipt" type="digit" v-model="el.x" />
				</view>
				<view class="row">
					<text class="label">Y (mm)</text>
					<input class="ipt" type="digit" v-model="el.y" />
				</view>

				<template v-if="el.type === 'text'">
					<view class="row">
						<text class="label">内容</text>
						<input class="ipt wide" v-model="el.text" :placeholder="varHint" />
					</view>
					<view class="row">
						<text class="label">字高 (点)</text>
						<input class="ipt" type="number" v-model="el.fontH" />
					</view>
					<view class="row">
						<text class="label">字宽 (点)</text>
						<input class="ipt" type="number" v-model="el.fontW" />
					</view>
				</template>

				<template v-if="el.type === 'qrcode'">
					<view class="row">
						<text class="label">内容</text>
						<input class="ipt wide" v-model="el.data" :placeholder="varHint" />
					</view>
					<view class="row">
						<text class="label">放大倍数 (1-10)</text>
						<input class="ipt" type="number" v-model="el.magnification" />
					</view>
					<view class="row">
						<text class="label">纠错等级</text>
						<picker :range="qrEcc" :value="qrEcc.indexOf(el.ecc)" @change="e => el.ecc = qrEcc[e.detail.value]">
							<text class="picker">{{ el.ecc }} ▾</text>
						</picker>
					</view>
				</template>

				<template v-if="el.type === 'barcode'">
					<view class="row">
						<text class="label">内容</text>
						<input class="ipt wide" v-model="el.data" :placeholder="varHint" />
					</view>
					<view class="row">
						<text class="label">码制</text>
						<picker :range="barcodeLabels" :value="barcodeIndex(el)" @change="e => el.codeType = barcodeTypes[e.detail.value].value">
							<text class="picker">{{ barcodeLabel(el) }} ▾</text>
						</picker>
					</view>
					<view class="row">
						<text class="label">条码高度 (mm)</text>
						<input class="ipt" type="digit" v-model="el.heightMm" />
					</view>
					<view class="row">
						<text class="label">窄条宽度 (点)</text>
						<input class="ipt" type="number" v-model="el.moduleWidth" />
					</view>
					<view class="row">
						<text class="label">显示可读字符</text>
						<switch :checked="el.showText" @change="e => el.showText = e.detail.value" />
					</view>
				</template>

				<template v-if="el.type === 'line' || el.type === 'box'">
					<view class="row">
						<text class="label">宽度 (mm)</text>
						<input class="ipt" type="digit" v-model="el.width" />
					</view>
					<view class="row" v-if="el.type === 'box'">
						<text class="label">高度 (mm)</text>
						<input class="ipt" type="digit" v-model="el.height" />
					</view>
					<view class="row">
						<text class="label">线粗 (点)</text>
						<input class="ipt" type="number" v-model="el.thickness" />
					</view>
				</template>

				<view class="row" v-if="el.type === 'text' || el.type === 'qrcode' || el.type === 'barcode'">
					<text class="label">旋转</text>
					<picker :range="rotationLabels" :value="rotationIndex(el)" @change="e => el.rotation = rotations[e.detail.value].value">
						<text class="picker">{{ rotationLabel(el) }} ▾</text>
					</picker>
				</view>
			</view>
		</view>

		<view class="card">
			<text class="card-title">变量测试值</text>
			<view class="hint">元素内容里写 {{ varExample }} 这样的占位符，打印时由业务数据填入。下面填的值只用于本页预览和试打。</view>
			<view class="row" v-for="key in variableKeys" :key="key">
				<text class="label">{{ key }}</text>
				<input class="ipt wide" v-model="previewData[key]" />
			</view>
			<view v-if="variableKeys.length === 0" class="empty">当前模板没有使用变量</view>
		</view>

		<view class="card">
			<text class="card-title">ZPL 预览</text>
			<textarea class="zpl-preview" :value="zplPreview" maxlength="-1" disabled />
		</view>

		<view class="footer">
			<button type="default" @click="save">保存模板</button>
			<button type="primary" @click="print">打印测试</button>
		</view>
	</view>
</template>

<script>
	import printer from '@/utils/zebraPrinter.js'
	import {
		buildZpl,
		defaultTemplate,
		loadTemplates,
		saveTemplates,
		newElement,
		labelDots,
		buildApplyMediaCommand,
		DPI_OPTIONS,
		ROTATIONS,
		BARCODE_TYPES,
		QR_ECC,
		ELEMENT_TYPES,
		MEDIA_TYPES,
		PRINT_MODES
	} from '@/utils/zplTemplate.js'

	export default {
		data() {
			return {
				varHint: '固定文字或 {{变量名}} 占位符',
				varExample: '{{sn}}',
				templates: [],
				templateIndex: 0,
				tpl: defaultTemplate(),
				previewData: {},
				dpiOptions: DPI_OPTIONS,
				rotations: ROTATIONS,
				barcodeTypes: BARCODE_TYPES,
				qrEcc: QR_ECC,
				elementTypes: ELEMENT_TYPES
			}
		},
		computed: {
			templateNames() {
				return this.templates.map((t) => t.name || '未命名')
			},
			dpiIndex() {
				const i = DPI_OPTIONS.indexOf(Number(this.tpl.page.dpi))
				return i === -1 ? 0 : i
			},
			mediaLabels() {
				return MEDIA_TYPES.map((m) => m.label)
			},
			mediaIndex() {
				const i = MEDIA_TYPES.findIndex((m) => m.value === this.tpl.page.mediaType)
				return i === -1 ? 0 : i
			},
			mediaLabel() {
				return MEDIA_TYPES[this.mediaIndex].label
			},
			printModeLabels() {
				return PRINT_MODES.map((m) => m.label)
			},
			printModeIndex() {
				const i = PRINT_MODES.findIndex((m) => m.value === this.tpl.print.mode)
				return i === -1 ? 0 : i
			},
			printModeLabel() {
				return PRINT_MODES[this.printModeIndex].label
			},
			dotsInfo() {
				const d = labelDots(this.tpl)
				return d.widthDots + ' × ' + d.heightDots + ' 点'
			},
			rotationLabels() {
				return ROTATIONS.map((r) => r.label)
			},
			barcodeLabels() {
				return BARCODE_TYPES.map((b) => b.label)
			},
			variableKeys() {
				const keys = []
				this.tpl.elements.forEach((el) => {
					const src = (el.text || '') + ' ' + (el.data || '')
					const matched = src.match(/\{\{\s*\w+\s*\}\}/g) || []
					matched.forEach((m) => {
						const key = m.replace(/[{}\s]/g, '')
						if (keys.indexOf(key) === -1) keys.push(key)
					})
				})
				return keys
			},
			zplPreview() {
				try {
					return buildZpl(this.tpl, this.previewData)
				} catch (e) {
					return '生成失败: ' + e.message
				}
			}
		},
		watch: {
			variableKeys(keys) {
				keys.forEach((key) => {
					if (this.previewData[key] === undefined) {
						this.$set(this.previewData, key, 'TEST' + key.toUpperCase())
					}
				})
			}
		},
		onLoad() {
			this.templates = loadTemplates()
			this.selectTemplate(0)
		},
		methods: {
			toast(title) {
				uni.showToast({ title, icon: 'none', duration: 2500 })
			},

			clone(obj) {
				return JSON.parse(JSON.stringify(obj))
			},

			selectTemplate(index) {
				this.templateIndex = index
				this.tpl = this.clone(this.templates[index])
				// 补齐旧模板缺的字段，避免界面显示和生成的 ZPL 不一致
				if (!this.tpl.page.mediaType) {
					this.$set(this.tpl.page, 'mediaType', Number(this.tpl.page.gapMm || 0) > 0 ? 'gap' : 'continuous')
				}
				if (!this.tpl.print.mode) this.$set(this.tpl.print, 'mode', 'T')
				this.previewData = {}
				this.variableKeys.forEach((key) => {
					this.$set(this.previewData, key, 'TEST' + key.toUpperCase())
				})
			},

			onTemplateChange(e) {
				this.selectTemplate(Number(e.detail.value))
			},

			onDpiChange(e) {
				this.tpl.page.dpi = DPI_OPTIONS[Number(e.detail.value)]
			},

			onMediaChange(e) {
				this.$set(this.tpl.page, 'mediaType', MEDIA_TYPES[Number(e.detail.value)].value)
			},

			onPrintModeChange(e) {
				this.$set(this.tpl.print, 'mode', PRINT_MODES[Number(e.detail.value)].value)
			},

			async applyMedia() {
				uni.showLoading({ title: '写入中...', mask: true })
				try {
					await printer.printWithSaved(buildApplyMediaCommand(this.tpl))
					uni.hideLoading()
					const continuous = this.tpl.page.mediaType === 'continuous'
					this.toast(continuous ? '定长已写入打印机' : '已发送校准，打印机会走 2-3 张标签测量长度')
				} catch (e) {
					uni.hideLoading()
					this.toast(e.message)
				}
			},

			typeLabel(type) {
				const found = ELEMENT_TYPES.find((t) => t.value === type)
				return found ? found.label : type
			},

			rotationIndex(el) {
				const i = ROTATIONS.findIndex((r) => r.value === (el.rotation || 'N'))
				return i === -1 ? 0 : i
			},

			rotationLabel(el) {
				return ROTATIONS[this.rotationIndex(el)].label
			},

			barcodeIndex(el) {
				const i = BARCODE_TYPES.findIndex((b) => b.value === el.codeType)
				return i === -1 ? 0 : i
			},

			barcodeLabel(el) {
				return BARCODE_TYPES[this.barcodeIndex(el)].label
			},

			addElement(type) {
				this.tpl.elements.push(newElement(type))
			},

			removeElement(idx) {
				this.tpl.elements.splice(idx, 1)
			},

			moveElement(idx, delta) {
				const target = idx + delta
				if (target < 0 || target >= this.tpl.elements.length) return
				const list = this.tpl.elements
				list.splice(target, 0, list.splice(idx, 1)[0])
			},

			addTemplate() {
				const tpl = defaultTemplate()
				tpl.name = '新标签 ' + (this.templates.length + 1)
				this.templates.push(tpl)
				saveTemplates(this.templates)
				this.selectTemplate(this.templates.length - 1)
			},

			copyTemplate() {
				const tpl = this.clone(this.tpl)
				tpl.id = 'tpl_' + Date.now()
				tpl.name = this.tpl.name + ' 副本'
				this.templates.push(tpl)
				saveTemplates(this.templates)
				this.selectTemplate(this.templates.length - 1)
			},

			removeTemplate() {
				if (this.templates.length <= 1) return this.toast('至少保留一个模板')
				uni.showModal({
					title: '删除模板',
					content: '确定删除「' + this.tpl.name + '」？',
					success: (res) => {
						if (!res.confirm) return
						this.templates.splice(this.templateIndex, 1)
						saveTemplates(this.templates)
						this.selectTemplate(0)
						this.toast('已删除')
					}
				})
			},

			save() {
				this.templates.splice(this.templateIndex, 1, this.clone(this.tpl))
				saveTemplates(this.templates)
				this.toast('模板 id: ' + this.tpl.id + '，已保存')
			},

			async print() {
				uni.showLoading({ title: '打印中...', mask: true })
				try {
					await printer.printWithSaved(buildZpl(this.tpl, this.previewData))
					uni.hideLoading()
					this.toast('已发送到打印机')
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

	.picker {
		font-size: 27rpx;
		color: #576b95;
	}

	.value {
		font-size: 27rpx;
		color: #333;
	}

	.hint {
		font-size: 23rpx;
		color: #999;
		line-height: 1.6;
		margin-top: 12rpx;
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

	.element {
		border: 1rpx solid #e6e6e6;
		border-radius: 10rpx;
		padding: 16rpx;
		margin-top: 20rpx;
	}

	.element-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8rpx;
	}

	.element-title {
		font-size: 28rpx;
		font-weight: bold;
		color: #E8833A;
	}

	.element-ops {
		display: flex;
		gap: 20rpx;
	}

	.op {
		font-size: 25rpx;
		color: #576b95;
	}

	.op.del {
		color: #fa5151;
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
