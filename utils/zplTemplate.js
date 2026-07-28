// utils/zplTemplate.js
// 标签模板 -> ZPL 指令。坐标与尺寸统一用毫米，内部按 DPI 换算成点(dot)。
// 字号(fontH/fontW)与二维码放大倍数沿用 ZPL 原生单位。

import printer from './zebraPrinter.js'

const TEMPLATE_KEY = 'zebra_templates'

const DOTS_PER_MM = { 203: 8, 300: 11.811, 600: 23.622 }

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

// 标签的点数尺寸，写入打印机长度或排版核对时用
export function labelDots(tpl) {
	const dpi = templateDpi(tpl)
	const page = tpl.page || {}
	return {
		dpi,
		widthDots: mmToDots(page.widthMm, dpi),
		heightDots: mmToDots(page.heightMm, dpi)
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

function renderElement(el, data, tpl, toDots) {
	const x = toDots(el.x)
	const y = toDots(el.y)
	const rot = el.rotation || 'N'

	if (el.type === 'text') {
		const text = fillVars(el.text, data)
		if (!text) return ''
		const h = num(el.fontH, 30)
		const w = num(el.fontW, h)
		// 中文必须走 ^A@ 指定 CJK 字体文件，内置 ^A0 字体没有汉字
		const font = hasCjk(text)
			? `^A@${rot},${h},${w},${tpl.cjkFont || 'E:GB18030.FNT'}`
			: `^A0${rot},${h},${w}`
		return `^FO${x},${y}${font}^FH^FD${escapeText(text)}^FS`
	}

	if (el.type === 'qrcode') {
		const value = sanitizeCode(fillVars(el.data, data))
		if (!value) return ''
		const ecc = QR_ECC.indexOf(el.ecc) === -1 ? 'M' : el.ecc
		return `^FO${x},${y}^BQ${rot},2,${num(el.magnification, 5)}^FD${ecc}A,${value}^FS`
	}

	if (el.type === 'barcode') {
		const value = sanitizeCode(fillVars(el.data, data))
		if (!value) return ''
		const h = toDots(el.heightMm)
		const mw = num(el.moduleWidth, 2)
		const show = el.showText === false ? 'N' : 'Y'
		const by = `^BY${mw},3,${h}`
		if (el.codeType === 'code39') return `^FO${x},${y}${by}^B3${rot},N,${h},${show},N^FD${value}^FS`
		if (el.codeType === 'ean13') return `^FO${x},${y}${by}^BE${rot},${h},${show},N^FD${value}^FS`
		return `^FO${x},${y}${by}^BC${rot},${h},${show},N,N^FD${value}^FS`
	}

	if (el.type === 'line') {
		return `^FO${x},${y}^GB${toDots(el.width)},0,${num(el.thickness, 2)},B,0^FS`
	}

	if (el.type === 'box') {
		return `^FO${x},${y}^GB${toDots(el.width)},${toDots(el.height)},${num(el.thickness, 2)},B,0^FS`
	}

	return ''
}

export function buildZpl(tpl, data = {}) {
	const page = tpl.page || {}
	const print = tpl.print || {}
	const dpi = templateDpi(tpl)
	const toDots = (mm) => mmToDots(mm, dpi)
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
		const zpl = renderElement(el, data, tpl, toDots)
		if (zpl) lines.push(zpl)
	})

	lines.push('^PQ' + Math.max(1, num(print.copies, 1)) + ',0,0,N')
	lines.push('^XZ')
	return lines.join('\n')
}

// 把标签长度写进打印机并用 ^JUS 存到非易失内存。
// 连续纸走定长(^MNN + ^LL)；间隙纸/黑标纸改用 ~JC 校准让传感器重新量。
export function buildApplyMediaCommand(tpl) {
	const { heightDots } = labelDots(tpl)
	const mediaType = mediaTypeOf(tpl)
	if (mediaType === 'continuous') {
		return '^XA^MNN^LL' + heightDots + '^JUS^XZ'
	}
	const media = MEDIA_TYPES.find((m) => m.value === mediaType) || MEDIA_TYPES[0]
	return '^XA' + media.zpl + '^JUS^XZ\n~JC'
}

// 把一段纯文本包成可打印的标签，用于自定义输入框里直接敲文字的场景
export function buildTextLabel(text, cjkFont) {
	const body = hasCjk(text)
		? `^A@N,40,40,${cjkFont || 'E:GB18030.FNT'}`
		: '^A0N,40,40'
	return ['^XA', '^CI28', `^FO30,30${body}^FH^FD${escapeText(text)}^FS`, '^XZ'].join('\n')
}

export function newElement(type) {
	const base = {
		text: { type: 'text', x: 3, y: 3, fontH: 30, fontW: 30, rotation: 'N', text: '文本内容' },
		qrcode: { type: 'qrcode', x: 3, y: 14, rotation: 'N', magnification: 5, ecc: 'M', data: '{{sn}}' },
		barcode: {
			type: 'barcode', x: 25, y: 14, rotation: 'N', codeType: 'code128',
			heightMm: 10, moduleWidth: 2, showText: true, data: '{{sn}}'
		},
		line: { type: 'line', x: 3, y: 12, width: 60, thickness: 2 },
		box: { type: 'box', x: 2, y: 2, width: 66, height: 36, thickness: 2 }
	}[type]
	return JSON.parse(JSON.stringify(base))
}

export function defaultTemplate() {
	return {
		id: 'tpl_' + Date.now(),
		name: '默认标签',
		page: { widthMm: 70, heightMm: 40, dpi: 203, mediaType: 'gap' },
		print: { darkness: 15, speed: 4, copies: 1, invert180: false, mode: 'T' },
		cjkFont: 'E:GB18030.FNT',
		elements: [
			{ type: 'text', x: 3, y: 3, fontH: 32, fontW: 32, rotation: 'N', text: '{{name}}' },
			{ type: 'text', x: 3, y: 9, fontH: 24, fontW: 24, rotation: 'N', text: 'SN: {{sn}}' },
			{ type: 'qrcode', x: 3, y: 15, rotation: 'N', magnification: 5, ecc: 'M', data: '{{sn}}' },
			{
				type: 'barcode', x: 28, y: 16, rotation: 'N', codeType: 'code128',
				heightMm: 12, moduleWidth: 2, showText: true, data: '{{sn}}'
			}
		]
	}
}

export function loadTemplates() {
	const list = uni.getStorageSync(TEMPLATE_KEY)
	return Array.isArray(list) && list.length > 0 ? list : [defaultTemplate()]
}

export function saveTemplates(list) {
	uni.setStorageSync(TEMPLATE_KEY, list)
}

export function findTemplate(id) {
	return loadTemplates().find((t) => t.id === id) || null
}

// 业务页面入口：按模板 id 填充数据并打印，自动连接默认打印机
// 例: printTemplate('tpl_1730000000000', { name: '前门总成', sn: 'HJL20260728001' })
export async function printTemplate(templateId, data = {}) {
	const tpl = findTemplate(templateId)
	if (!tpl) throw new Error('模板不存在: ' + templateId)
	await printer.printWithSaved(buildZpl(tpl, data))
}
