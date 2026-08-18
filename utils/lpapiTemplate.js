// utils/lpapiTemplate.js
// 把"中性模板模型"（与打印机无关的 text/qrcode/barcode/box/line，单位 mm）渲染成
// 道臻 LPAPI 的绘制调用（drawText / draw1DBarcode / draw2DQRCode / drawRectangle / drawLine）。
// 与 zplTemplate.buildZpl 的元素处理一一对应（anchor 基点换算、变量填充），输出走 LPAPI draw API。
//
// 设计：本函数只负责"在已开启的绘制上下文上 draw"，不调用 startJob / commitJob，
// 这两个生命周期由 lpapiAdapter 统一管理（含隐藏 canvas 的上下文创建与等待）。
//
// 限制：LPAPI draw 模式下，整张标签的旋转由 startJob 的 orientation 控制，
// 单个元素的 rotation 字段不在本渲染器逐元素生效（drawText/draw2DQRCode 不接受旋转参数），
// 元素均按正立绘制。需要旋转整张标签时请在调用方 startJob 设置 orientation。

import { ANCHORS } from './zplTemplate.js'

const ANCHOR_TOP_LEFT = ANCHORS[0]

function anchorOf(el) {
	return ANCHORS.find((a) => a.value === el.anchor) || ANCHOR_TOP_LEFT
}

function num(v, d) {
	const n = Number(v)
	return isFinite(n) ? n : d
}

// 变量填充：{{var}} -> data[var]
function fillVars(text, data) {
	return String(text == null ? '' : text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
		const v = data[key]
		return v == null ? '' : String(v)
	})
}

// 一维码类型映射（与 dothan-lpapi-ble SDK 枚举一致：CODE128=28, CODE39=24, EAN13=22）
const BARCODE_TYPE = { code128: 28, code39: 24, ean13: 22 }

// 中性模型里字号(fontH/fontW)/线宽(thickness)/模块宽(moduleWidth) 一律以毫米存储，
// 与打印机无关。本渲染器直接把毫米坐标下发给 LPAPI 绘制，不做任何"点 -> 毫米"折算。
// 打印机实际 dpi 由 lpapiAdapter 在 startJob 时交给 SDK（决定 bitmap 分辨率），
// 不影响这里的 mm 坐标与物理尺寸。

// 计算元素左上角坐标（mm）。boxW/boxH 为该元素本次实际占的框（mm）。
// 基点不是左上角时，按 fx/fy 把框回退到左上角；结果钳到 0 避免越界。
function topLeft(el, boxW, boxH) {
	const a = anchorOf(el)
	const x = Math.max(0, el.x - boxW * a.fx)
	const y = Math.max(0, el.y - boxH * a.fy)
	return { x, y }
}

// 主渲染函数：假设调用方已完成 startJob（已建立绘制上下文 ctx），本函数只负责 draw。
// lpapi: LPAPI 实例；tpl: 中性模板；data: 变量表。
// opts.offsetXMm: 整张内容向右补偿的毫米数（打印头比标签宽时把窄标签居中到介质上）。
// 返回 report: { drawn, skipped[], offLabel[] }，便于上层在 UI 提示"哪些元素没印出来 / 越界"。
export function renderTemplateToLpapi(lpapi, tpl, data = {}, _printerDpi, opts = {}) {
	// 中性模型元素是毫米坐标，直接下发，无需 dpi 折算（_printerDpi 仅保留兼容入参，不再使用）。
	const elements = (tpl && tpl.elements) || []
	const labelW = num((tpl && tpl.page && tpl.page.widthMm) || 50, 50)
	const labelH = num((tpl && tpl.page && tpl.page.heightMm) || 30, 30)
	// 水平补偿：只对实际下发坐标生效，不改变元素在"标签坐标系"里的逻辑位置（越界检测仍按标签坐标系）。
	const ox = num(opts.offsetXMm, 0)
	const report = { drawn: 0, skipped: [], offLabel: [] }
	for (let i = 0; i < elements.length; i++) {
		const el = elements[i]
		const box = renderOne(lpapi, el, i, data, tpl, report, ox)
		if (!box) continue // 空值/不支持类型，已在 renderOne 内记入 skipped
		// 越界检测：元素框超出标签范围会被打印机裁掉（印不出或印到下一格），给出明确告警
		const off = box.x < -0.01 || box.y < -0.01 ||
			box.x + box.w > labelW + 0.01 || box.y + box.h > labelH + 0.01
		if (off) {
			const where = `(${round1(box.x)},${round1(box.y)}) ${round1(box.w)}x${round1(box.h)}mm`
			const tip = `标签为 ${labelW}x${labelH}mm，该元素超出范围会被裁掉`
			report.offLabel.push(`#${i} ${el.type}@${where} — ${tip}`)
			console.warn('[lpapiTemplate] 元素越界被裁:', '#' + i, el.type, where, '标签', labelW + 'x' + labelH + 'mm')
		}
		report.drawn++
	}
	return report
}

function round1(v) { return Math.round(Number(v) * 10) / 10 }

function renderOne(lpapi, el, idx, data, tpl, report, ox) {
	if (!el || !el.type) { reportSkip('未知元素'); return null }
	let box = null
	switch (el.type) {
		case 'text': box = renderText(lpapi, el, data, tpl, report, idx, ox); break
		case 'qrcode': box = renderQrcode(lpapi, el, data, report, idx, ox); break
		case 'barcode': box = renderBarcode(lpapi, el, data, tpl, report, idx, ox); break
		case 'box': box = renderBox(lpapi, el, tpl, report, idx, ox); break
		case 'line': box = renderLine(lpapi, el, tpl, report, idx, ox); break
		default: reportSkip('不支持的类型:' + el.type); return null
	}
	return box

	function reportSkip(reason) {
		report.skipped.push('#' + idx + ' ' + (el && el.type) + ': ' + reason)
		console.warn('[lpapiTemplate] 跳过元素 #' + idx + ' (' + (el && el.type) + '):', reason)
	}
}

function renderText(lpapi, el, data, tpl, report, idx, ox) {
	const text = fillVars(el.text, data)
	if (!text) { report.skipped.push('#' + idx + ' text: 空白(变量未填充?)'); console.warn('[lpapiTemplate] 跳过文本元素：内容为空白（变量未填充？）'); return null }
	// 中性模型 fontH/fontW 已是毫米
	const fontHmm = num(el.fontH, 3)
	const frameW = num(el.width, 0)
	const frameH = num(el.height, 0)
	// 框尺寸（mm）：有显式框用显式框，否则按内容估算，便于 anchor 居中时不偏
	const w = frameW > 0 ? frameW : Math.max(6, text.length * fontHmm * 0.5)
	const h = frameH > 0 ? frameH : fontHmm
	const { x, y } = topLeft(el, w, h)
	const horiz = el.align === 'center' ? 1 : el.align === 'right' ? 2 : 0
	lpapi.drawText({
		text,
		x: x + ox, y,
		width: w,
		height: h,
		fontHeight: fontHmm,
		horizontalAlignment: horiz
	})
	return { x, y, w, h }
}

function renderQrcode(lpapi, el, data, report, idx, ox) {
	const value = fillVars(el.data, data)
	if (!value) { report.skipped.push('#' + idx + ' qrcode: 空白(变量未填充?)'); console.warn('[lpapiTemplate] 跳过二维码元素：内容为空白（变量未填充？）'); return null }
	// 无显式框宽时给一个合理默认边长（mm）。中性模型二维码的 moduleWidthMm 仅作参考，
	// LPAPI 按框尺寸绘制，故此处用固定兜底边长。
	const sizeMm = num(el.width, 0) > 0 ? el.width : 15
	const { x, y } = topLeft(el, sizeMm, sizeMm)
	lpapi.draw2DQRCode({ text: value, x: x + ox, y, width: sizeMm })
	return { x, y, w: sizeMm, h: sizeMm }
}

function renderBarcode(lpapi, el, data, tpl, report, idx, ox) {
	const value = fillVars(el.data, data)
	if (!value) { report.skipped.push('#' + idx + ' barcode: 空白(变量未填充?)'); console.warn('[lpapiTemplate] 跳过长条码元素：内容为空白（变量未填充？）'); return null }
	const draw = lpapi.draw1DBarcode || lpapi.drawBarcode
	if (!draw) { report.skipped.push('#' + idx + ' barcode: 设备不支持'); return null }
	// 中性模型 moduleWidth 已是毫米
	const barHmm = num(el.heightMm, num(el.height, 10))
	const frameW = num(el.width, 0)
	// 条码宽度按内容估算（无显式框时）：每字符约 moduleWidth 的 0.6 倍（mm）
	const moduleMm = num(el.moduleWidth, 0.2)
	const w = frameW > 0 ? frameW : Math.max(20, value.length * Math.max(moduleMm, 0.4) * 0.6)
	const h = num(el.height, 0) > 0 ? num(el.height, 0) : barHmm
	const { x, y } = topLeft(el, w, h)
	draw.call(lpapi, {
		text: value,
		x: x + ox, y,
		width: w,
		height: h,
		textHeight: Math.max(2, barHmm * 0.3),
		barcodeType: BARCODE_TYPE[el.codeType] || 28
	})
	return { x, y, w, h }
}

function renderBox(lpapi, el, tpl, report, idx, ox) {
	const w = num(el.width, 0)
	const h = num(el.height, 0)
	if (w <= 0 || h <= 0) { report.skipped.push('#' + idx + ' box: 宽或高为0'); return null }
	// 中性模型 thickness 已是毫米
	const { x, y } = topLeft(el, w, h)
	const lineW = Math.max(0.2, num(el.thickness, 0.3))
	lpapi.drawRectangle({ x: x + ox, y, width: w, height: h, lineWidth: lineW })
	return { x, y, w, h }
}

function renderLine(lpapi, el, tpl, report, idx, ox) {
	if (!lpapi.drawLine) { report.skipped.push('#' + idx + ' line: 设备不支持'); return null }
	const w = num(el.width, 0)
	if (w <= 0) { report.skipped.push('#' + idx + ' line: 宽为0'); return null }
	// 中性模型 thickness 已是毫米
	const { x, y } = topLeft(el, w, 0)
	const lineW = Math.max(0.2, num(el.thickness, 0.3))
	lpapi.drawLine({ x1: x + ox, y1: y, x2: x + w + ox, y2: y, lineWidth: lineW })
	return { x, y, w, h: 0 }
}

export default renderTemplateToLpapi
