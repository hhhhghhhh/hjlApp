<template>
	<view class="container" :class="[sizeClass, darkClass, themeClass]">
		<!-- dothan-lpapi-ble 需要页面里有一个隐藏 canvas 用于绘制标签（所见即所得）。
		     官方示例要求 type="2d"，否则 createDrawContext 拿不到 2d 绘制上下文。LPAPI 打印（打印测试 / 写入打印机并校准）必须它。 -->
		<canvas type="2d" canvas-id="lpapi-canvas-label" id="lpapi-canvas-label"
			:style="{ width: lpapiCanvasW + 'px', height: lpapiCanvasH + 'px' }"
			style="position: fixed; left: -999999rpx; top: -999999rpx;"></canvas>
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
			<button size="mini" type="primary" @click="overwriteBuiltin">覆盖默认模板</button>
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
			<view class="row" v-if="isLpapi">
				<text class="label">水平偏移微调 (mm)</text>
				<input class="ipt" type="digit" v-model="tpl.page.offsetXMm" :placeholder="offsetHintBase" />
			</view>
			<view class="hint" v-if="isLpapi">微调量，{{ offsetHintBase }}。实测整体偏右就填负值（如 -1.5）、偏左填正值；换不同尺寸纸时自动偏移基准会随尺寸重算、微调量保持不变，无需每次重调。</view>
			<view class="row" v-if="isLpapi">
				<text class="label">垂直偏移微调 (mm)</text>
				<input class="ipt" type="digit" v-model="tpl.page.offsetYMm" placeholder="0=不微调" />
			</view>
			<view class="hint" v-if="isLpapi">个别模板特调：整体偏下填负值（内容上移）、偏上填正值（内容下移）；与全局「垂直偏移微调」（打印设置页）叠加——本模板不填时用全局值。</view>
			<view class="row">
				<text class="label">纸张类型</text>
				<picker :range="mediaLabels" :value="mediaIndex" @change="onMediaChange">
					<text class="picker">{{ mediaLabel }} ▾</text>
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
				{{ mediaHint }}
			</view>
		</view>

		<view class="card">
			<text class="card-title">打印参数</text>
			<view class="row">
				<text class="label">份数</text>
				<view class="stepper">
					<view class="step-btn" @click="changeCopies(-1)">−</view>
					<input class="ipt stepper-num" type="number" v-model="tpl.print.copies"
						:selection-start="copiesSelStart" :selection-end="copiesSelEnd"
						@focus="onCopiesFocus" @blur="onCopiesBlur" @confirm="onCopiesConfirm" />
					<view class="step-btn" @click="changeCopies(1)">+</view>
				</view>
			</view>
			<view v-if="isLpapi" class="hint">LPAPI（道臻）打印浓度、速度、走纸方式由打印组件在打印时自动设置——间隙纸/黑标纸由传感器定位、连续纸按标签高度定长；中文走位图渲染、无需字体文件。这里只需设置份数。</view>
			<view v-else>
				<view class="row">
					<text class="label">浓度 (0-30)</text>
					<input class="ipt" type="number" v-model="tpl.print.darkness" />
				</view>
				<view class="row">
					<text class="label">速度 (1-14)</text>
					<input class="ipt" type="number" v-model="tpl.print.speed" />
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
					<input class="ipt" v-model="tpl.cjkFont" placeholder="E:HANS.TTF" />
				</view>
				<view class="hint">中文走 HANS.TTF 原生渲染；若打不出中文，可在「蓝牙打印」页点「查询打印机字体」看实际有哪些 .TTF，或确认位图渲染兜底已开启。</view>
			</view>
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
				<view class="row">
					<text class="label">定位基点</text>
					<picker :range="anchorLabels" :value="anchorIndex(el)" @change="e => setAnchor(el, e)">
						<text class="picker">{{ anchorLabel(el) }} ▾</text>
					</picker>
				</view>
				<template v-if="showFrame(el)">
					<view class="row" v-if="el.type !== 'barcode'">
						<text class="label">框宽 (mm)</text>
						<input class="ipt" type="digit" :value="el.width" @input="e => setFrame(el, 'width', e)" />
					</view>
					<view class="row">
						<text class="label">框高 (mm)</text>
						<input class="ipt" type="digit" :value="el.height" @input="e => setFrame(el, 'height', e)" />
					</view>
				</template>

			<template v-if="el.type === 'text'">
				<view class="row">
					<text class="label">框宽 (mm)</text>
					<input class="ipt" type="digit" :value="el.width" @input="e => setFrame(el, 'width', e)" />
				</view>
				<view class="row">
					<text class="label">框高/字号 (mm)</text>
					<input class="ipt" type="digit" :value="el.height" @input="e => setFrame(el, 'height', e)" />
				</view>
				<view class="hint">「框高」即字体大小（只填这一个高度）；「框宽」控制自动换行宽度。</view>
				<view class="row">
					<text class="label">内容</text>
					<input class="ipt wide" v-model="el.text" :placeholder="varHint" />
				</view>
				<view class="row">
					<text class="label">粗体</text>
					<switch :checked="el.bold" @change="e => el.bold = e.detail.value" />
				</view>
				<view class="row">
					<text class="label">斜体</text>
					<switch :checked="el.italic" @change="e => el.italic = e.detail.value" />
				</view>
				<view class="row">
					<text class="label">垂直对齐</text>
					<picker :range="valignLabels" :value="valignIndex(el)" @change="e => setValign(el, e)">
						<text class="picker">{{ valignLabel(el) }} ▾</text>
					</picker>
				</view>
				<view class="row">
					<text class="label">字符间距 (mm)</text>
					<input class="ipt" type="digit" v-model="el.charSpace" />
				</view>
				<view class="row">
					<text class="label">行间距 (mm)</text>
					<input class="ipt" type="digit" v-model="el.lineSpace" />
				</view>
				<view class="row">
					<text class="label">自动换行</text>
					<switch :checked="el.wordWrap !== false" @change="e => el.wordWrap = e.detail.value" />
				</view>
			</template>

				<template v-if="el.type === 'qrcode'">
					<view class="row">
						<text class="label">内容</text>
						<input class="ipt wide" v-model="el.data" :placeholder="varHint" />
					</view>
					<view class="row">
						<text class="label">模块尺寸 (mm)</text>
						<input class="ipt" type="digit" v-model="el.moduleWidthMm" />
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
						<text class="label">窄条宽度 (mm)</text>
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
						<text class="label">线粗 (mm)</text>
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

			<view class="hint" v-if="tpl.elements.length > 0">
				定位基点决定 X/Y 说的是元素框上哪一点。默认左上角；选「正中」后元素会绕这个点居中，内容变长（比如 SN 位数变多把条码撑宽）时向两边同时扩，不会一味往右长。条码的宽度按当次数据算出来，所以只用填框高。
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
			<text class="card-title">标签预览</text>
			<textarea class="zpl-preview" :value="zplPreview" maxlength="-1" disabled />
		</view>

		<view class="footer">
			<button type="default" @click="save">保存模板</button>
			<button type="primary" @click="print">打印测试</button>
		</view>
	</view>
</template>

<script>
	import printer from '@/utils/printerManager.js'
	import lpapiPlugin from '@/utils/lpapi-uniplugin.js'
	import {
		buildZpl,
		defaultTemplate,
		loadTemplates,
		saveTemplates,
		overwriteBuiltinTemplates,
		newElement,
		labelDots,
		ANCHORS,
		ROTATIONS,
		BARCODE_TYPES,
		QR_ECC,
		ELEMENT_TYPES,
		MEDIA_TYPES,
		PRINT_MODES
	} from '@/utils/zplTemplate.js'

	import settingsMixin from '@/common/settingsMixin.js'
export default {
	mixins: [settingsMixin],
		data() {
			return {
				varHint: '固定文字或 {{变量名}} 占位符',
				varExample: '{{sn}}',
				templates: [],
				templateIndex: 0,
			tpl: defaultTemplate(),
			previewData: {},
			// 隐藏 canvas 的像素尺寸；初始给默认 50x30mm@300dpi，打印前适配器会按任务尺寸 resize 成任务像素
		lpapiCanvasW: 590,
		lpapiCanvasH: 354,
			rotations: ROTATIONS,
				barcodeTypes: BARCODE_TYPES,
				qrEcc: QR_ECC,
				elementTypes: ELEMENT_TYPES,
				valignLabels: ['上', '中', '下'],
			copiesSelStart: -1,
			copiesSelEnd: -1,
			printerAlignment: printer.getPrinterAlignment()
		}
		},
		computed: {
			isLpapi() {
				return printer.getProtocol() === 'lpapi'
			},
			// 水平偏移提示的基线文案，随当前 LPAPI 打印机对齐方式自适应：
			// 0=R0 右对齐 → 贴右；4=L4 左对齐 → 贴左；2=C2 居中（默认） → 居中；未连返回 null → 兜底居中。
			offsetHintBase() {
				const a = this.printerAlignment
				if (a === 0) return '0=自动贴右（标签贴在纸右端）'
				if (a === 4) return '0=自动贴左（标签贴在纸左端）'
				if (a === 2) return '0=自动居中（标签居中在纸上）'
				return '0=按打印机对齐自动落点（右/中/左）'
			},
			templateNames() {
				return this.templates.map((t) => t.name || '未命名')
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
				// 点数尺寸随连接打印机的真实 dpi 变化（模板本身不记录 dpi）。
				// 未连接时按协议给估算值：LPAPI/道臻 300，ZPL/Zebra 203。
				const printerDpi = printer.getPrinterDpi()
				if (!printerDpi) {
					const fallback = this.isLpapi ? 300 : 203
					const d = labelDots(this.tpl, fallback)
					return d.widthDots + ' × ' + d.heightDots + ' 点（未连接，按 ' + fallback + ' 估算）'
				}
				const d = labelDots(this.tpl, printerDpi)
				return d.widthDots + ' × ' + d.heightDots + ' 点 @ ' + printerDpi + 'dpi'
			},
			mediaHint() {
				// 同一段说明按协议给出不同版本：ZPL 走 ^MN/^LL/^JUS/~JC，LPAPI 没有持久化介质指令。
				const lpapi = printer.getProtocol() === 'lpapi'
				if (lpapi) {
					return 'LPAPI（道臻）没有 ZPL 那种「把介质参数写进打印机永久保存」的指令，标签尺寸在每次打印时随任务下发，所以不会因 ^LL 残留而出错。这里的「写入打印机并校准」= 打印一张当前尺寸的校准标签，让打印机走纸并测量间隙、确认尺寸/对齐；换纸或改尺寸后也建议连点两三次，让传感器重新学习。DPI 由打印机实测（300）自动匹配，无需手动设置，也不会因填错而把标签成比例放大。'
				}
				return '打印出来比标签长，几乎都是纸张类型/长度没生效：间隙纸和黑标纸的长度是打印机用传感器量出来的，ZPL 的 ^LL 会被忽略，换纸或改尺寸后必须点上面的「写入打印机并校准」一次；只有连续纸才按 ^LL 定长走纸。DPI 已不再由模板设置，而是连接打印机后由打印机真实分辨率自动匹配（Zebra 203、道臻/IB-PTM7330 300），不会因填错而把标签成比例放大（203 机器被当成 300 会长约 1.5 倍）。'
			},
			rotationLabels() {
				return ROTATIONS.map((r) => r.label)
			},
			barcodeLabels() {
				return BARCODE_TYPES.map((b) => b.label)
			},
			anchorLabels() {
				return ANCHORS.map((a) => a.label)
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
					// LPAPI 不用 ZPL，改用中性预览（尺寸 + 元素清单），避免显示无意义的 ZPL
					if (printer.getProtocol() === 'lpapi') {
						const els = this.tpl.elements.map((el, i) =>
							(i + 1) + '. ' + this.typeLabel(el.type) + ' @(' + (el.x || 0) + ',' + (el.y || 0) + ')'
						).join('\n')
					const pd = printer.getPrinterDpi()
					return 'LPAPI 标签（按此尺寸生成位图）\n尺寸: ' + this.tpl.page.widthMm + ' x ' +
						this.tpl.page.heightMm + ' mm' + (pd ? ' @ ' + pd + 'dpi' : '') + '\n元素:\n' + els
					}
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
			// LPAPI 打印需要本页隐藏 canvas 作为绘制缓冲区。提前创建绘制上下文（官方示例在 onLoad 中调用），
			// 并订阅尺寸同步事件：适配器 startJob 后会把任务像素尺寸发过来，这里改 :style 让 canvas 真正 resize。
			try {
				if (lpapiPlugin && lpapiPlugin.isReady && lpapiPlugin.isReady() && lpapiPlugin.initDrawContext) {
					lpapiPlugin.initDrawContext('lpapi-canvas-label')
				}
			if (lpapiPlugin && lpapiPlugin.onCanvasSize) {
				this._offCanvasSize = lpapiPlugin.onCanvasSize((w, h) => {
					// 只同步 :style 显示尺寸（官方示例 updateCanvas 做法）。绝不直接改 canvas
					// 节点的 width/height 位图——SDK 已在 startJob 内把节点位图设成任务像素，
					// 直接改 node.width 会清空 SDK 的位图，导致出纸空白。
					this.lpapiCanvasW = w
					this.lpapiCanvasH = h
				})
			}
			} catch (e) {
				console.log('[labelTemplate] lpapi initDrawContext skipped:', e.message)
			}
		},
		onUnload() {
			if (this._offCanvasSize) {
				this._offCanvasSize()
				this._offCanvasSize = null
			}
		},
		onShow() {
			// 每次页面可见（含从下层 navigateBack 回来）都把"当前画布"切回本页，
			// 避免其它打印页的上下文仍占着全局 active，导致本页打印画到错的 canvas 上。
			try {
				if (lpapiPlugin && lpapiPlugin.setActiveCanvas) lpapiPlugin.setActiveCanvas('lpapi-canvas-label')
			} catch (e) {}
			// 切回本页时若已连 LPAPI，刷新对齐方式（0/2/4）供"水平偏移"提示自适应
			this.printerAlignment = printer.getPrinterAlignment()
		},
		methods: {
			toast(title) {
				uni.showToast({ title, icon: 'none', duration: 2500 })
			},

			// 份数步进：最小 1
			changeCopies(delta) {
				const cur = Math.round(Number(this.tpl.print.copies)) || 1
				this.tpl.print.copies = Math.max(1, cur + delta)
			},

			// 聚焦份数输入框时全选，方便直接输入新数字覆盖（避免手动删"1"再改）
			onCopiesFocus() {
				this.$nextTick(() => {
					this.copiesSelStart = 0
					this.copiesSelEnd = 99
				})
			},

			onCopiesBlur() {
				this.copiesSelStart = -1
				this.copiesSelEnd = -1
				this.normalizeCopies()
			},

			onCopiesConfirm() {
				this.copiesSelStart = -1
				this.copiesSelEnd = -1
				this.normalizeCopies()
			},

			// 空/非法值回落到 1
			normalizeCopies() {
				const n = Math.round(Number(this.tpl.print.copies))
				if (!isFinite(n) || n < 1) this.tpl.print.copies = 1
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

			onMediaChange(e) {
				this.$set(this.tpl.page, 'mediaType', MEDIA_TYPES[Number(e.detail.value)].value)
			},

			onPrintModeChange(e) {
				this.$set(this.tpl.print, 'mode', PRINT_MODES[Number(e.detail.value)].value)
			},

			async applyMedia() {
				uni.showLoading({ title: '写入中...', mask: true })
				try {
					await printer.applyMedia(this.tpl)
					uni.hideLoading()
					if (printer.getProtocol() === 'lpapi') {
						this.toast('已打印一张校准标签（LPAPI 按任务设定尺寸，无独立校准指令）')
					} else {
						const continuous = this.tpl.page.mediaType === 'continuous'
						this.toast(continuous ? '定长已写入打印机' : '已发送校准，打印机会走 2-3 张标签测量长度')
					}
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

			anchorIndex(el) {
				const i = ANCHORS.findIndex((a) => a.value === el.anchor)
				return i === -1 ? 0 : i
			},

			anchorLabel(el) {
				return ANCHORS[this.anchorIndex(el)].label
			},

			valignIndex(el) {
				const v = Number(el.valign) || 0
				return v === 1 ? 1 : v === 2 ? 2 : 0
			},

			valignLabel(el) {
				return this.valignLabels[this.valignIndex(el)]
			},

			setValign(el, e) {
				this.$set(el, 'valign', Number(e.detail.value))
			},

			// 旧模板和新建的元素都没有 anchor 字段，要用 $set 写进去才有响应式
			setAnchor(el, e) {
				this.$set(el, 'anchor', ANCHORS[Number(e.detail.value)].value)
			},

			setFrame(el, key, e) {
				this.$set(el, key, e.detail.value)
			},

			// 基点不是左上角时才需要参照框；文本已在自身面板始终显示框宽/框高，不重复问
			showFrame(el) {
				if (!el.anchor || el.anchor === 'topLeft') return false
				return el.type === 'qrcode' || el.type === 'barcode'
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

		overwriteBuiltin() {
			uni.showModal({
				title: '覆盖默认模板',
				content: '将用最新内置模板覆盖「默认批次号/关键件/产品模板」三张，你改过的内容会被重置；自建模板不受影响。继续？',
				success: (res) => {
					if (!res.confirm) return
					this.templates = overwriteBuiltinTemplates()
					this.selectTemplate(0)
					this.toast('已覆盖生成默认模板')
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
					await printer.printTemplate(this.tpl, this.previewData)
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
		background: var(--color-bg-page);
		min-height: 100vh;
	}

	.card {
		background: var(--color-bg-card);
		border-radius: 12rpx;
		padding: 24rpx;
		margin-bottom: 20rpx;
	}

	.card-title {
		font-size: var(--font-lg);
		font-weight: bold;
		color: var(--color-text);
		display: block;
		margin-bottom: 12rpx;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12rpx 0;
		border-bottom: 1rpx solid var(--color-bg-page);
	}

	.label {
		font-size: 27rpx;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.ipt {
		font-size: 27rpx;
		color: var(--color-text);
		text-align: right;
		width: 240rpx;
		padding: 6rpx 0;
	}

	.ipt.wide {
		width: 380rpx;
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	.step-btn {
		width: 56rpx;
		height: 56rpx;
		line-height: 52rpx;
		text-align: center;
		font-size: var(--font-xl);
		color: var(--color-text);
		border: 1rpx solid #ddd;
		border-radius: 10rpx;
		background: var(--color-bg-page);
	}

	.stepper-num {
		width: 120rpx;
		text-align: center;
		border: 1rpx solid #ddd;
		border-radius: 10rpx;
		padding: 6rpx 0;
	}

	.picker {
		font-size: 27rpx;
		color: #576b95;
	}

	.value {
		font-size: 27rpx;
		color: var(--color-text);
	}

	.hint {
		font-size: 23rpx;
		color: var(--color-text-hint);
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
		font-size: var(--font-md);
		color: var(--color-text-hint);
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
		font-size: var(--font-lg);
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
		font-size: var(--font-xs);
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
		background: var(--color-bg-card);
		box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
	}

	.footer button {
		flex: 1;
	}
</style>
