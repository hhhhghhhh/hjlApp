// utils/cpclTemplate.js
// 标签模板 -> CPCL 指令。接受和 zplTemplate 一样的 tpl 结构。
//
// 用途：ZR668 等斑马便携机在 CPCL(line_print) 模式下内置 GB18030 中文字库，
// 不需要往 E: 盘下载 .FNT 字体文件就能打中文。
// ZPL 模式下中文走 ^A@ E:GB18030.FNT，便携机出厂没这个文件，中文会空白。
//
// 注意：打印机必须先切到 CPCL 模式（! U1 setvar "device.languages" "line_print"），
// 否则 CPCL 指令会被当未知指令忽略。

import { ANCHORS, DPI_OPTIONS, QR_ECC, mmToDots } from './zplTemplate.js'

const num = (v, fallback) => {
	const n = Number(v)
	return isNaN(n) ? fallback : n
}

// CPCL 内置点阵字体（斑马便携机常见值）。
// h = 字高(dot)，w = ASCII 字宽(dot)，中文全角字宽 = 字高。
// 不同机型可能略有差异，这里取斑马 CPCL 编程手册的常用值。
const CPCL_FONTS = [
	{ id: 0, h: 8,  w: 5  },
	{ id: 1, h: 10, w: 6  },
	{ id: 2, h: 16, w: 10 },
	{ id: 3, h: 20, w: 12 },
	{ id: 4, h: 24, w: 15 },
	{ id: 5, h: 32, w: 20 },
	{ id: 6, h: 44, w: 28 },
	{ id: 7, h: 60, w: 40 }
]

function hasCjk(text) {
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) >= 0x2e80) return true
	}
	return false
}

function templateDpi(tpl) {
	const dpi = num((tpl.page || {}).dpi, 203)
	return DPI_OPTIONS.indexOf(dpi) === -1 ? 203 : dpi
}

// 选最接近目标高度的 base font，并算 SETMAG 放大倍数。
// SETMAG 只能放大不能缩小，所以选 <= 目标高度的最大 base font。
function pickFont(targetH) {
	let best = CPCL_FONTS[0]
	for (let i = 1; i < CPCL_FONTS.length; i++) {
		if (CPCL_FONTS[i].h <= targetH) best = CPCL_FONTS[i]
	}
	let mag = Math.round(targetH / best.h)
	mag = Math.max(1, Math.min(10, mag))
	return {
		font: best,
		mag,
		actualH: best.h * mag,
		actualAscW: best.w * mag,
		actualCjkW: best.h * mag
	}
}

function anchorOf(el) {
	return ANCHORS.find((a) => a.value === el.anchor) || ANCHORS[0]
}

// 基点坐标 -> 左上角坐标，跟 zplTemplate.js 的 place() 逻辑一致
function anchorToTopLeft(el, boxW, boxH, toDots) {
	const a = anchorOf(el)
	const rot = el.rotation || 'N'
	const quarter = rot === 'R' || rot === 'B'
	const w = quarter ? boxH : boxW
	const h = quarter ? boxW : boxH
	return {
		x: Math.max(0, Math.round(toDots(el.x) - w * a.fx)),
		y: Math.max(0, Math.round(toDots(el.y) - h * a.fy))
	}
}

function fillVars(text, data) {
	return String(text == null ? '' : text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
		const v = data[key]
		return v == null ? '' : String(v)
	})
}

function charWidth(ch, fi) {
	return ch.charCodeAt(0) >= 0x2e80 ? fi.actualCjkW : fi.actualAscW
}

function textWidth(text, fi) {
	let w = 0
	for (let i = 0; i < text.length; i++) w += charWidth(text[i], fi)
	return w
}

// 按最大宽度断行：中文每字可断，英文长词可能在中间断
function wrapText(text, fi, maxWidthDots) {
	if (maxWidthDots <= 0) return [text]
	const lines = []
	const paragraphs = String(text).split(/\r?\n/)
	for (const para of paragraphs) {
		if (!para) { lines.push(''); continue }
		let line = ''
		for (let i = 0; i < para.length; i++) {
			const test = line + para[i]
			if (textWidth(test, fi) > maxWidthDots && line) {
				lines.push(line)
				line = para[i]
			} else {
				line = test
			}
		}
		if (line) lines.push(line)
	}
	return lines.length ? lines : ['']
}

function renderText(el, data, tpl, toDots) {
	const text = fillVars(el.text, data)
	if (!text) return []
	const h = num(el.fontH, 30)
	const fi = pickFont(h)
	const frameW = num(el.width, 0)
	const page = tpl.page || {}
	const maxWidthDots = frameW > 0 ? toDots(el.width) : toDots(page.widthMm || 60)

	const lines = wrapText(text, fi, maxWidthDots)
	const align = el.align || 'left'

	// anchor 还原：用文本框实际宽高
	const realW = frameW > 0 ? maxWidthDots : Math.max(...lines.map((l) => textWidth(l, fi)))
	const realH = fi.actualH * lines.length
	const tl = anchorToTopLeft(el, realW, realH, toDots)

	const cmds = [`SETMAG ${fi.mag} ${fi.mag}`]
	for (let i = 0; i < lines.length; i++) {
		const lineW = textWidth(lines[i], fi)
		let x = tl.x
		if (align === 'center') x = tl.x + Math.round((maxWidthDots - lineW) / 2)
		else if (align === 'right') x = tl.x + Math.round(maxWidthDots - lineW)
		x = Math.max(0, x)
		const y = tl.y + i * fi.actualH
		// CPCL TEXT: TEXT <font> <mag> <x> <y> <data>
		// mag 传 0，放大全靠 SETMAG，避免叠加
		cmds.push(`TEXT ${fi.font.id} 0 ${x} ${y} ${lines[i]}`)
	}
	cmds.push('SETMAG 1 1') // 重置，避免影响后续元素
	return cmds
}

function renderQrcode(el, data, tpl, toDots) {
	// CPCL 不允许 ^ ~ 等控制字符出现在数据里
	const value = fillVars(el.data, data).replace(/[\^~\r\n]/g, '')
	if (!value) return []
	const ecc = QR_ECC.indexOf(el.ecc) === -1 ? 'M' : el.ecc
	// U 参数是模块放大倍数（1-32），跟 ZPL 的 magnification 对应
	const mag = Math.max(1, Math.min(32, num(el.magnification, 5)))

	// QR 是正方形。设计框宽或估算（version1 = 21 模块）
	const boxW = num(el.width, 0) > 0 ? toDots(el.width) : 21 * mag
	const tl = anchorToTopLeft(el, boxW, boxW, toDots)

	// CPCL QR 格式：
	//   BARCODE QR x y M 2 U mag
	//   MA,data
	//   ENDQR
	// M = 手动版本控制，2 = 版本自动，U = 大小倍数
	// MA = alphanumeric/auto 模式。中文 QR 要用 MM,B 模式 + GB18030 字节数，
	// 但 QR 数据通常是 SN/URL（ASCII），先用 MA。
	const cmds = [
		`BARCODE QR ${tl.x} ${tl.y} ${ecc} 2 U ${mag}`,
		`MA,${value}`,
		'ENDQR'
	]
	return cmds
}

function renderBarcode(el, data, tpl, toDots) {
	const value = fillVars(el.data, data).replace(/[\^~\r\n]/g, '')
	if (!value) return []
	const h = toDots(num(el.heightMm, 10))
	const narrow = Math.max(1, num(el.moduleWidth, 2))
	const wide = narrow * 3
	const ratio = 3
	const rot = 0 // CPCL rotation: 0/90/180/270

	// 估算条码宽度用于 anchor 还原
	const boxW = value.length * 11 * narrow + 35
	const tl = anchorToTopLeft(el, boxW, h, toDots)

	const type = el.codeType === 'code39' ? '39'
		: el.codeType === 'ean13' ? 'EAN13'
		: '128'
	// CPCL BARCODE: BARCODE <type> <x> <y> <narrow> <wide> <height> <ratio> <rot> <data>
	return [`BARCODE ${type} ${tl.x} ${tl.y} ${narrow} ${wide} ${h} ${ratio} ${rot} ${value}`]
}

function renderLine(el, tpl, toDots) {
	const thickness = Math.max(1, num(el.thickness, 2))
	const w = toDots(el.width)
	const tl = anchorToTopLeft(el, w, thickness, toDots)
	// CPCL LINE: LINE x0 y0 x1 y1 width
	return [`LINE ${tl.x} ${tl.y} ${tl.x + w} ${tl.y} ${thickness}`]
}

function renderBox(el, tpl, toDots) {
	const thickness = Math.max(1, num(el.thickness, 2))
	const w = toDots(el.width)
	const h = toDots(el.height)
	const tl = anchorToTopLeft(el, w, h, toDots)
	// CPCL BOX: BOX x0 y0 x1 y1 width
	return [`BOX ${tl.x} ${tl.y} ${tl.x + w} ${tl.y + h} ${thickness}`]
}

/**
 * 把模板编译成 CPCL 指令字符串。
 * tpl 结构跟 zplTemplate.buildZpl 接受的一样（labTemplate.toZplTemplate 的输出）。
 */
export function buildCpcl(tpl, data = {}) {
	const page = tpl.page || {}
	const print = tpl.print || {}
	const dpi = templateDpi(tpl)
	const toDots = (mm) => mmToDots(mm, dpi)

	const heightDots = toDots(page.heightMm)
	const copies = Math.max(1, num(print.copies, 1))

	const lines = []
	// CPCL 头：! <x-offset> <x-res> <y-res> <label-height> <qty>
	// x-res/y-res 用实际 DPI；便携机 203dpi 写 203
	lines.push(`! 0 ${dpi} ${dpi} ${heightDots} ${copies}`)

	// 中文走 GB18030。sendCpcl 也用 GB18030 编码字节流。
	// 不认这条指令的打印机会忽略它，不影响 ASCII 打印
	lines.push('ENCODING GB18030')

	const elements = tpl.elements || []
	for (const el of elements) {
		let cmds = []
		if (el.type === 'text') cmds = renderText(el, data, tpl, toDots)
		else if (el.type === 'qrcode') cmds = renderQrcode(el, data, tpl, toDots)
		else if (el.type === 'barcode') cmds = renderBarcode(el, data, tpl, toDots)
		else if (el.type === 'line') cmds = renderLine(el, tpl, toDots)
		else if (el.type === 'box') cmds = renderBox(el, tpl, toDots)
		lines.push(...cmds)
	}

	lines.push('FORM')
	lines.push('PRINT')
	return lines.join('\n')
}

/**
 * CPCL 测试标签：含中文、ASCII、条码、QR，用于验证 CPCL 模式是否正常
 */
export function buildCpclTestLabel() {
	return [
		'! 0 203 203 300 1',
		'ENCODING GB18030',
		'TEXT 4 0 30 30 CPCL Test',
		'TEXT 4 0 30 60 中文测试',
		'TEXT 4 0 30 90 直流模块',
		'BARCODE 128 30 130 2 6 60 2 0 1234567890',
		'BARCODE QR 30 210 M 2 U 6',
		'MA,https://zebra.com',
		'ENDQR',
		'FORM',
		'PRINT'
	].join('\n')
}
