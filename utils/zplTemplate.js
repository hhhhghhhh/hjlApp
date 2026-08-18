// utils/zplTemplate.js
// 标签模板 -> ZPL 指令。坐标与尺寸统一用毫米，内部按打印机实际 DPI 换算成点(dot)。
// 中性模型的字号(fontH/fontW)/二维码模块(moduleWidthMm)/线宽(thickness) 均以毫米存储，
// 与打印机无关；本模块在"打印时"再按 opts.dpi（Zebra 适配器传入的实际 dpi）折算成点，
// 实现"按打印机自动匹配 dpi"——模板本身不再记录任何 dpi。
//
// 为了适配多指令集架构，本模块不再直接读取 zebraPrinter.js 的字体状态，
// 而是通过 opts 传入；未传入时默认从 storage 读取 force_ttf_font 作为降级。

import { renderTextToGfa, isBitmapSupported } from './cjkBitmap.js'

const TEMPLATE_KEY = 'zebra_templates'
const BITMAP_QUALITY_KEY = 'zebra_bitmap_quality'

const DOTS_PER_MM = { 203: 8, 300: 11.811, 600: 23.622 }

// 位图清晰度模式：
//   'speed'  = 性能优先（默认），ss=1 全关超采样
//   'clear'  = 清晰优先，ss=2 全局超采样，小字号更清晰但慢 4 倍
export function getBitmapQuality() {
	const v = uni.getStorageSync(BITMAP_QUALITY_KEY)
	return v === 'clear' ? 'clear' : 'speed'
}
export function setBitmapQuality(mode) {
	uni.setStorageSync(BITMAP_QUALITY_KEY, mode === 'clear' ? 'clear' : 'speed')
}

// ASCII/拉丁字符码位都低于 0x2E80，超过即认为需要 CJK 字体
function hasCjk(text) {
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) >= 0x2e80) return true
	}
	return false
}

export const DPI_OPTIONS = [203, 300, 600]
export const ROTATIONS = [
	{ value: 'N', label: '0°' },
	{ value: 'R', label: '90°' },
	{ value: 'I', label: '180°' },
	{ value: 'B', label: '270°' }
]
export const BARCODE_TYPES = [
	{ value: 'code128', label: 'Code 128' },
	{ value: 'code39', label: 'Code 39' },
	{ value: 'ean13', label: 'EAN-13' }
]
export const QR_ECC = ['L', 'M', 'Q', 'H']

// 纸张类型决定打印机怎么判断一张标签的长度
// gap/mark: 靠传感器测量，^LL 被忽略，换纸或换尺寸后必须校准
// continuous: 没有间隙，完全按 ^LL 定长走纸
export const MEDIA_TYPES = [
	{ value: 'gap', label: '间隙纸（标签之间有空隙）', zpl: '^MNY' },
	{ value: 'mark', label: '黑标纸（背面有黑色定位条）', zpl: '^MNM' },
	{ value: 'continuous', label: '连续纸（无间隙，按长度走纸）', zpl: '^MNN' }
]

export const PRINT_MODES = [
	{ value: 'T', label: '撕纸' },
	{ value: 'P', label: '剥离' },
	{ value: 'C', label: '切刀' }
]

export const ELEMENT_TYPES = [
	{ value: 'text', label: '文本' },
	{ value: 'qrcode', label: '二维码' },
	{ value: 'barcode', label: '一维条码' },
	{ value: 'line', label: '横线' },
	{ value: 'box', label: '矩形框' }
]

// x/y 是元素框上「基点」那一点的坐标，不一定是左上角 —— CodeSoft 模板里基点可以是
// 九宫格里任意一点。导入时原样保留基点坐标，到生成 ZPL 时才按当次实际内容换算出
// ^FO 需要的左上角：这样数据变长（SN 加长把条码撑宽）时元素仍绕基点居中，
// 而不是拿设计稿的框宽一味往右长。
export const ANCHORS = [
	{ value: 'topLeft', label: '左上角', fx: 0, fy: 0 },
	{ value: 'topCenter', label: '上边中点', fx: 0.5, fy: 0 },
	{ value: 'topRight', label: '右上角', fx: 1, fy: 0 },
	{ value: 'centerLeft', label: '左边中点', fx: 0, fy: 0.5 },
	{ value: 'center', label: '正中', fx: 0.5, fy: 0.5 },
	{ value: 'centerRight', label: '右边中点', fx: 1, fy: 0.5 },
	{ value: 'bottomLeft', label: '左下角', fx: 0, fy: 1 },
	{ value: 'bottomCenter', label: '下边中点', fx: 0.5, fy: 1 },
	{ value: 'bottomRight', label: '右下角', fx: 1, fy: 1 }
]

const ANCHOR_TOP_LEFT = ANCHORS[0]

function anchorOf(el) {
	return ANCHORS.find((a) => a.value === el.anchor) || ANCHOR_TOP_LEFT
}

// 以下常量都是估算值，只在模板没给出设计框宽高时才会走到
const HRI_LINE_DOTS = 12 // 条码下方可读字符行：ZPL 默认用内置 A 字体（9 点高），加行距按 12 点算
const QR_VERSION1_MODULES = 21 // QR 版本 1 的边长模块数
const QR_MODULES_PER_VERSION = 4 // 每升一个版本边长加 4 个模块
const PROPORTIONAL_CHAR_RATIO = 0.6 // ^A0 是比例字体，平均字宽约为标称字宽的 0.6 倍
const CODE39_UNITS_PER_CHAR = 16 // 每字符 6 窄条 + 3 宽条 + 1 窄间隙，宽窄比固定 3 => 7 + 3×3
const CODE128_MODULES_PER_CHAR = 11
const CODE128_FIXED_MODULES = 35 // 起始 11 + 校验 11 + 终止 13
const EAN13_MODULES = 95

// ^A0 的实际字宽拿不到（比例字体），只能估。^A@ 的 CJK 字模是方的，ASCII 约半宽。
function textInkDots(text, fontW, cjk) {
	if (!cjk) return Math.round(text.length * fontW * PROPORTIONAL_CHAR_RATIO)
	let dots = 0
	for (let i = 0; i < text.length; i++) {
		dots += text.charCodeAt(i) >= 0x2e80 ? fontW : fontW / 2
	}
	return Math.round(dots)
}

// QR 版本 1~10 在各纠错等级下能装的数据码字数。版本 10 的字节模式已能装 213 字节，
// 标签上的 SN 远用不到更大的版本，所以表只到 10。
const QR_DATA_CODEWORDS = {
	L: [19, 34, 55, 80, 108, 136, 156, 194, 232, 274],
	M: [16, 28, 44, 64, 86, 108, 124, 154, 182, 216],
	Q: [13, 22, 34, 48, 62, 76, 88, 110, 132, 154],
	H: [9, 16, 26, 36, 46, 60, 66, 86, 100, 122]
}

// QR「字符模式」的字符集就这些，出现别的符号（比如 #）整串就得退到字节模式，位数翻近一倍
const QR_ALNUM = /^[0-9A-Z $%*+\-./:]+$/

// ^CI28 下数据是按 UTF-8 发给打印机的，字节模式按 UTF-8 长度算
function utf8Length(text) {
	let n = 0
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i)
		if (c < 0x80) n += 1
		else if (c < 0x800) n += 2
		else if (c >= 0xd800 && c < 0xdc00) {
			n += 4
			i++ // 代理对，一个码点占两个 charCode
		} else n += 3
	}
	return n
}

// 编码这段数据要占多少位：模式指示符 4 位 + 字符计数指示符 + 数据位。
// 计数指示符的宽度跟版本有关，版本 10 起变宽，所以要按版本分别算。
function qrDataBits(value, version) {
	if (/^\d+$/.test(value)) {
		const rest = value.length % 3
		return 4 + (version < 10 ? 10 : 12) + Math.floor(value.length / 3) * 10 +
			(rest === 0 ? 0 : rest === 1 ? 4 : 7)
	}
	if (QR_ALNUM.test(value)) {
		return 4 + (version < 10 ? 9 : 11) + Math.floor(value.length / 2) * 11 +
			(value.length % 2 ? 6 : 0)
	}
	return 4 + (version < 10 ? 8 : 16) + utf8Length(value) * 8
}

// QR 的边长只由数据长度和纠错等级决定，设计稿的框宽是照某个样例数据定的 ——
// 数据一变长就跨到下一个版本、实际印出来更大，拿框宽换算基点就会往右下偏。
// 这里整串按单一模式估；打印机的自动模式可能拆成多段混合编码更省位，那样我们会高估一个版本，
// 高估会让元素略偏左上，比低估安全。返回 0 表示超出容量表，让调用方退回设计框。
function qrModules(value, ecc) {
	const caps = QR_DATA_CODEWORDS[ecc] || QR_DATA_CODEWORDS.M
	for (let v = 1; v <= caps.length; v++) {
		if (qrDataBits(value, v) <= caps[v - 1] * 8) {
			return QR_VERSION1_MODULES + (v - 1) * QR_MODULES_PER_VERSION
		}
	}
	return 0
}

// 条码模块数（窄条算 1 个模块），乘 ^BY 的模块宽就是实际打印宽度。
// 这是基点换算里唯一随数据变化又能算准的量，所以宁可算它也不用设计框宽。
function barcodeModules(value, codeType) {
	if (codeType === 'ean13') return EAN13_MODULES
	if (codeType === 'code39') return (value.length + 2) * CODE39_UNITS_PER_CHAR
	// code128 全数字时走 subset C，两位数字压成一个符号字符；奇数位末尾要切回 subset B
	const chars = /^\d+$/.test(value)
		? (value.length % 2 === 0 ? value.length / 2 : (value.length - 1) / 2 + 2)
		: value.length
	return chars * CODE128_MODULES_PER_CHAR + CODE128_FIXED_MODULES
}

const num = (v, fallback) => {
	const n = Number(v)
	return isNaN(n) ? fallback : n
}

export function mmToDots(mm, dpi) {
	return Math.round(num(mm, 0) * (DOTS_PER_MM[dpi] || DOTS_PER_MM[203]))
}

function templateDpi(tpl) {
	const dpi = num((tpl.page || {}).dpi, 203)
	return DPI_OPTIONS.indexOf(dpi) === -1 ? 203 : dpi
}

// 标签的点数尺寸，写入打印机长度或排版核对时用。
// dpi 优先用连接打印机的真实分辨率（由调用方传入）；模板本身不再记录 dpi，
// 故 templateDpi(tpl) 仅作为未连接时的兜底（传统 ZPL 便携机常见 203）。
export function labelDots(tpl, dpi) {
	const d = num(dpi, templateDpi(tpl))
	const page = tpl.page || {}
	return {
		dpi: d,
		widthDots: mmToDots(page.widthMm, d),
		heightDots: mmToDots(page.heightMm, d)
	}
}

function mediaTypeOf(tpl) {
	const page = tpl.page || {}
	if (page.mediaType) return page.mediaType
	// 早期模板只有 gapMm 字段，按它推断
	return num(page.gapMm, 0) > 0 ? 'gap' : 'continuous'
}

function fillVars(text, data) {
	return String(text == null ? '' : text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
		const v = data[key]
		return v == null ? '' : String(v)
	})
}

// ^FH 模式下把 ZPL 控制字符转成 _XX 十六进制，避免内容里的 ^ ~ 被当成指令
function escapeText(text) {
	return String(text).replace(/[\^~\\_]/g, (c) => '_' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
}

// 条码内容本身不允许 ZPL 控制字符，直接剔除
function sanitizeCode(text) {
	return String(text).replace(/[\^~]/g, '')
}

function renderElement(el, data, tpl, toDots, fontOpts = {}) {
	const rot = el.rotation || 'N'
	const {
		hasTtfFont = uni.getStorageSync('force_ttf_font') === true,
		ttfFontPath = '',
		hasCjkFont = false
	} = fontOpts

	// 把基点坐标换算成 ^FO 要的左上角。boxW/boxH 是这次实际占的框（点）。
	const place = (boxW, boxH) => {
		const a = anchorOf(el)
		if (a === ANCHOR_TOP_LEFT) return `^FO${toDots(el.x)},${toDots(el.y)}`
		// 旋转 90/270 后元素在标签上占的宽高互换
		const quarter = rot === 'R' || rot === 'B'
		const w = quarter ? boxH : boxW
		const h = quarter ? boxW : boxH
		// ^FO 参数超范围时 ZPL 会整条忽略，元素会跑到上一个原点去，钳到 0 比忽略安全
		const x = Math.max(0, Math.round(toDots(el.x) - w * a.fx))
		const y = Math.max(0, Math.round(toDots(el.y) - h * a.fy))
		return `^FO${x},${y}`
	}

	if (el.type === 'text') {
		const text = fillVars(el.text, data)
		if (!text) return ''
		// 中性模型的 fontH/fontW 是毫米，打印时按实际 dpi 折算成 ZPL 点
		const fontHmm = num(el.fontH, 3)
		const fontWmm = num(el.fontW, fontHmm)
		const h = Math.max(1, Math.round(toDots(fontHmm)))
		const w = Math.max(1, Math.round(toDots(fontWmm)))
		const cjk = hasCjk(text)
		const frameW = num(el.width, 0)

		// CJK 文本渲染策略（按优先级）：
		// 1. 有 TTF 中文字体（HANS.TTF 等）→ ^A@ 原生渲染，速度快、清晰
		// 2. 无 TTF 但有位图渲染能力 且 打印机无 CJK 字体 → ^GFA 位图渲染
		// 3. 兜底：^A@ E:HANS.TTF（无 HANS.TTF 且无法位图时才会空白，属极端情况）
		if (cjk && hasTtfFont) {
			// TTF 字体路径：原生渲染，支持 ^FB 自动换行
			const fontPath = ttfFontPath || 'E:HANS.TTF'
			const font = `^A@${rot},${h},${w},${fontPath}`
			const block = frameW > 0
				? `^FB${toDots(el.width)},99,0,${el.align === 'center' ? 'C' : el.align === 'right' ? 'R' : 'L'}`
				: ''
			const boxW = frameW > 0 ? toDots(el.width) : textInkDots(text, w, cjk)
			const boxH = num(el.height, 0) > 0 ? toDots(el.height) : h
			return `${place(boxW, boxH)}${font}${block}^FH^FD${escapeText(text)}^FS`
		}

		if (cjk && isBitmapSupported() && !hasCjkFont) {
			const maxW = frameW > 0
				? toDots(el.width)
				: toDots((tpl.page || {}).widthMm || 60)
			// 超采样策略：默认性能优先（ss=1）
			//   speed 模式：ss=1 全关超采样
			//   clear 模式：ss=2，小字号更清晰但慢 4 倍
			//   元素级 el.superSample 优先级最高，可覆盖全局
			const globalQuality = getBitmapQuality()
			const ss = el.superSample != null
				? el.superSample
				: (globalQuality === 'clear' ? 2 : 1)
			const rendered = renderTextToGfa(text, {
				fontHeightDots: h,
				maxWidthDots: maxW,
				align: el.align || 'left',
				bold: el.bold !== undefined ? el.bold : true,
				lineHeightRatio: 1.25,
				superSample: ss
			})
			if (rendered.gfa) {
				// place 用位图实际宽高做 anchor 还原，行为跟字体方案一致
				const fo = place(rendered.widthDots, rendered.heightDots)
				return `${fo}${rendered.gfa}`
			}
			// 位图渲染失败（如尺寸为 0）则降级到 ZPL 字体路径
		}

		// ASCII 文本 或 CJK 降级：走 ZPL 原生字体路径
		// 内置 ^A0 字体没有汉字，cjk 但无位图支持（H5 预览）时会印空白
		const font = cjk
			? `^A@${rot},${h},${w},${tpl.cjkFont || 'E:HANS.TTF'}`
			: `^A0${rot},${h},${w}`
		// ^FB 支持自动换行：有框宽时让 ZPL 按行宽断行，最多 99 行
		// 第二参数原为 1（单行），改为 99 允许多行；左对齐也加 ^FB 以触发换行
		const block = frameW > 0
			? `^FB${toDots(el.width)},99,0,${el.align === 'center' ? 'C' : el.align === 'right' ? 'R' : 'L'}`
			: ''
		// 有框宽时基点换算和 ^FB 用的是同一个数，两者不会互相打架，结果精确；
		// 没有框宽只能按字宽估，误差落在文本自身宽度上
		const boxW = frameW > 0 ? toDots(el.width) : textInkDots(text, w, cjk)
		const boxH = num(el.height, 0) > 0 ? toDots(el.height) : h
		return `${place(boxW, boxH)}${font}${block}^FH^FD${escapeText(text)}^FS`
	}

	if (el.type === 'qrcode') {
		const value = sanitizeCode(fillVars(el.data, data))
		if (!value) return ''
		const ecc = QR_ECC.indexOf(el.ecc) === -1 ? 'M' : el.ecc
		// 中性模型存的是模块尺寸（毫米），按实际 dpi 折算成 ZPL 放大倍数（1~10）
		const modMm = num(el.moduleWidthMm, 0.51)
		const mag = Math.max(1, Math.min(10, Math.round(toDots(modMm))))
		const modules = qrModules(value, ecc)
		// QR 是正方形，宽高同一个数
		const box = modules > 0
			? modules * mag
			: (num(el.width, 0) > 0 ? toDots(el.width) : QR_VERSION1_MODULES * mag)
		return `${place(box, box)}^BQ${rot},2,${mag}^FD${ecc}A,${value}^FS`
	}

	if (el.type === 'barcode') {
		const value = sanitizeCode(fillVars(el.data, data))
		if (!value) return ''
		const h = toDots(el.heightMm)
		const mw = Math.max(1, Math.round(toDots(num(el.moduleWidth, 0.2))))
		const show = el.showText === false ? 'N' : 'Y'
		const above = el.textAbove ? 'Y' : 'N'
		// 宽度一律按当次数据算，不用设计框宽 —— 设计框是照某个样例 SN 定的，换个长度就不对了
		const boxW = barcodeModules(value, el.codeType) * mw
		const boxH = num(el.height, 0) > 0 ? toDots(el.height) : h + (show === 'Y' ? HRI_LINE_DOTS : 0)
		const fo = place(boxW, boxH)
		const by = `^BY${mw},3,${h}`
		if (el.codeType === 'code39') return `${fo}${by}^B3${rot},N,${h},${show},${above}^FD${value}^FS`
		if (el.codeType === 'ean13') return `${fo}${by}^BE${rot},${h},${show},${above}^FD${value}^FS`
		return `${fo}${by}^BC${rot},${h},${show},${above},N^FD${value}^FS`
	}

	if (el.type === 'line') {
		const thickness = Math.max(1, Math.round(toDots(num(el.thickness, 0.3))))
		return `${place(toDots(el.width), thickness)}^GB${toDots(el.width)},0,${thickness},B,0^FS`
	}

	if (el.type === 'box') {
		const thickness = Math.max(1, Math.round(toDots(num(el.thickness, 0.3))))
		return `${place(toDots(el.width), toDots(el.height))}^GB${toDots(el.width)},${toDots(el.height)},${thickness},B,0^FS`
	}

	return ''
}

export function buildZpl(tpl, data = {}, opts = {}) {
	const page = tpl.page || {}
	const print = tpl.print || {}
	// 打印机实际 dpi：优先用适配器传入（ZebraAdapter 按机型/查询得到），
	// 否则回落到模板记录的设计 dpi，再不行用 203 兜底（传统 ZPL 便携机常见值）。
	const dpi = num(opts.dpi, templateDpi(tpl))
	const toDots = (mm) => mmToDots(mm, dpi)
	const fontOpts = opts.font || {}
	const media = MEDIA_TYPES.find((m) => m.value === mediaTypeOf(tpl)) || MEDIA_TYPES[0]

	const lines = []
	const darkness = num(print.darkness, NaN)
	if (!isNaN(darkness)) {
		lines.push('~SD' + String(Math.min(30, Math.max(0, Math.round(darkness)))).padStart(2, '0'))
	}
	lines.push('^XA')
	lines.push('^CI28') // UTF-8
	lines.push(media.zpl) // 纸张类型必须在 ^LL 之前，^LL 只对 ^MNN 连续纸生效
	lines.push('^PW' + toDots(page.widthMm))
	lines.push('^LL' + toDots(page.heightMm))
	lines.push('^LH0,0')
	lines.push('^LT0')
	lines.push('^MM' + (PRINT_MODES.some((m) => m.value === print.mode) ? print.mode : 'T'))
	const speed = num(print.speed, NaN)
	if (!isNaN(speed)) lines.push('^PR' + Math.min(14, Math.max(1, Math.round(speed))))
	lines.push(print.invert180 ? '^POI' : '^PON')

	;(tpl.elements || []).forEach((el) => {
		const zpl = renderElement(el, data, tpl, toDots, fontOpts)
		if (zpl) lines.push(zpl)
	})

	lines.push('^PQ' + Math.max(1, num(print.copies, 1)) + ',0,0,N')
	lines.push('^XZ')
	return lines.join('\n')
}

// 把介质参数写进打印机并用 ^JUS 存到非易失内存。
// 连续纸走定长(^MNN + ^LL)；间隙纸/黑标纸改用 ~JC 校准让传感器重新量。
// 注意：间隙/黑标纸的走纸长度由传感器量出来，^LL 对"走纸"无效；但 ^LL 仍决定可打印区
// 的上限——若 NVRAM 里残留的旧 ^LL 比实际标签长，内容会被裁到下一格之外。所以这里对
// 间隙/黑标纸也显式写一次 ^LL=标签高度，保证可打印区与传感器量到的长度一致。
export function buildApplyMediaCommand(tpl) {
	const { heightDots } = labelDots(tpl)
	const mediaType = mediaTypeOf(tpl)
	if (mediaType === 'continuous') {
		return '^XA^MNN^LL' + heightDots + '^JUS^XZ'
	}
	const media = MEDIA_TYPES.find((m) => m.value === mediaType) || MEDIA_TYPES[0]
	return '^XA' + media.zpl + '^LL' + heightDots + '^JUS^XZ\n~JC'
}

// 把一段纯文本包成可打印的标签，用于自定义输入框里直接敲文字的场景
export function buildTextLabel(text, cjkFont, opts = {}) {
	const {
		hasTtfFont = uni.getStorageSync('force_ttf_font') === true,
		ttfFontPath = '',
		hasCjkFont = false
	} = opts
	// CJK 渲染策略：TTF 字体(HANS.TTF) > 位图渲染 ^GFA（不再依赖 GB18030.FNT）
	if (hasCjk(text) && hasTtfFont) {
		// 有下载的 TTF 字体，原生渲染最快最清晰
		const fontPath = ttfFontPath || 'E:HANS.TTF'
		const body = `^A@N,40,40,${fontPath}`
		return ['^XA', '^CI28', `^FO30,30${body}^FH^FD${escapeText(text)}^FS`, '^XZ'].join('\n')
	}
	// 无 TTF 字体，走位图渲染（便携机无中文字体时）
	if (hasCjk(text) && isBitmapSupported() && !hasCjkFont) {
		const ss = getBitmapQuality() === 'clear' ? 2 : 1
		const rendered = renderTextToGfa(text, {
			fontHeightDots: 40,
			maxWidthDots: 500,
			align: 'left',
			bold: true,
			lineHeightRatio: 1.25,
			superSample: ss
		})
		if (rendered.gfa) {
			return ['^XA', `^FO30,30${rendered.gfa}`, '^XZ'].join('\n')
		}
	}
	const body = hasCjk(text)
		? `^A@N,40,40,${cjkFont || 'E:HANS.TTF'}`
		: '^A0N,40,40'
	return ['^XA', '^CI28', `^FO30,30${body}^FH^FD${escapeText(text)}^FS`, '^XZ'].join('\n')
}

export function newElement(type) {
	const base = {
		text: { type: 'text', x: 3, y: 3, fontH: 4, fontW: 4, rotation: 'N', text: '文本内容' },
		qrcode: { type: 'qrcode', x: 3, y: 14, rotation: 'N', moduleWidthMm: 0.51, ecc: 'M', width: 15, height: 15, data: '{{sn}}' },
		barcode: {
			type: 'barcode', x: 25, y: 14, rotation: 'N', codeType: 'code128',
			heightMm: 10, moduleWidth: 0.25, showText: true, data: '{{sn}}'
		},
		line: { type: 'line', x: 3, y: 12, width: 60, thickness: 0.3 },
		box: { type: 'box', x: 2, y: 2, width: 66, height: 36, thickness: 0.3 }
	}[type]
	return JSON.parse(JSON.stringify(base))
}

export function defaultTemplate() {
	return {
		id: 'tpl_' + Date.now(),
		name: '默认标签',
		page: { widthMm: 70, heightMm: 40, mediaType: 'gap' },
		print: { darkness: 15, speed: 4, copies: 1, invert180: false, mode: 'T' },
		cjkFont: 'E:HANS.TTF',
		elements: [
			{ type: 'text', x: 3, y: 3, fontH: 4, fontW: 4, rotation: 'N', text: '{{name}}' },
			{ type: 'text', x: 3, y: 9, fontH: 3, fontW: 3, rotation: 'N', text: 'SN: {{sn}}' },
			{ type: 'qrcode', x: 3, y: 15, rotation: 'N', moduleWidthMm: 0.51, ecc: 'M', width: 20, height: 20, data: '{{sn}}' },
			{
				type: 'barcode', x: 28, y: 16, rotation: 'N', codeType: 'code128',
				heightMm: 12, moduleWidth: 0.25, showText: true, data: '{{sn}}'
			}
		]
	}
}

// 旧模板以"点(dot)"存储字号/线宽并带 page.dpi；新模型统一用毫米存储。
// 加载时一次性把旧模板点值折算成毫米并删除 page.dpi，保证模型一致、不再依赖写死的 203。
const r2 = (v) => Math.round(Number(v) * 100) / 100
function migrateTemplate(tpl) {
	if (!tpl || !tpl.page) return false
	const legacyDpi = num(tpl.page.dpi, 0)
	if (!legacyDpi) {
		// 无 dpi 的新模板：仅兜底把残留的 magnification 折算成 moduleWidthMm
		let touched = false
		;(tpl.elements || []).forEach((el) => {
			if (el.type === 'qrcode' && el.magnification != null && el.moduleWidthMm == null) {
				el.moduleWidthMm = r2(num(el.magnification, 5) / 8)
				delete el.magnification
				touched = true
			}
		})
		return touched
	}
	const dpm = DOTS_PER_MM[legacyDpi] || DOTS_PER_MM[203]
	;(tpl.elements || []).forEach((el) => {
		if (el.fontH != null) el.fontH = r2(el.fontH / dpm)
		if (el.fontW != null) el.fontW = r2(el.fontW / dpm)
		if (el.moduleWidth != null) el.moduleWidth = r2(el.moduleWidth / dpm)
		if (el.thickness != null) el.thickness = r2(el.thickness / dpm)
		if (el.type === 'qrcode') {
			if (el.magnification != null && el.moduleWidthMm == null) {
				el.moduleWidthMm = r2(el.magnification / dpm)
			}
			delete el.magnification
		}
	})
	delete tpl.page.dpi
	return true
}

export function loadTemplates() {
	const list = uni.getStorageSync(TEMPLATE_KEY)
	if (!Array.isArray(list) || list.length === 0) return [defaultTemplate()]
	let mutated = false
	const out = list.map((t) => { if (migrateTemplate(t)) mutated = true; return t })
	if (mutated) saveTemplates(out)
	return out
}

export function saveTemplates(list) {
	uni.setStorageSync(TEMPLATE_KEY, list)
}

export function findTemplate(id) {
	return loadTemplates().find((t) => t.id === id) || null
}

// 业务页面入口：按模板 id 填充数据并打印，自动连接默认打印机
// 例: const { printTemplate } = await import('@/utils/printerManager.js')
//     await printTemplate('tpl_1730000000000', { name: '前门总总', sn: 'HJL20260728001' })
// 注意：此函数已迁移到 printerManager.printTemplate(tpl, data)，请优先使用新 API。
// 为保持兼容保留此导出，内部转发到 printerManager。
export async function printTemplate(templateId, data = {}) {
	const tpl = findTemplate(templateId)
	if (!tpl) throw new Error('模板不存在: ' + templateId)
	// 动态导入避免循环依赖
	const { default: printerManager } = await import('./printerManager.js')
	await printerManager.printWithSaved(buildZpl(tpl, data))
}
