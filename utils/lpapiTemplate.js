// utils/lpapiTemplate.js
// 把"中性模板模型"（与打印机无关的 text/qrcode/barcode/box/line，单位 mm）渲染成
// 道臻 LPAPI 的绘制调用（drawText / draw1DBarcode / draw2DQRCode / drawRectangle / drawLine）。
// 与 zplTemplate.buildZpl 的元素处理一一对应（anchor 基点换算、变量填充），输出走 LPAPI draw API。
//
// 设计：本函数只负责"在已开启的绘制上下文上 draw"，不调用 startJob / commitJob，
// 这两个生命周期由 lpapiAdapter 统一管理（含隐藏 canvas 的上下文创建与等待）。
//
// 旋转：中性模型的 rotation（N/R/I/B，与 ZPL 约定一致）在渲染层映射成 SDK 的 orientation 角度（0/90/180/270）。
// drawText / draw1DBarcode / draw2DQRCode / drawRectangle / drawLine 都接受 per-element orientation，
// 因此单元素旋转逐元素生效。整张标签旋转仍由 startJob 的 orientation 控制（二者叠加）。

import { ANCHORS, QR_ECC } from './zplTemplate.js'

const ANCHOR_TOP_LEFT = ANCHORS[0]

function anchorOf(el) {
	return ANCHORS.find((a) => a.value === el.anchor) || ANCHOR_TOP_LEFT
}

function num(v, d) {
	const n = Number(v)
	return isFinite(n) ? n : d
}

// 中性模型 rotation（N/R/I/B，与 ZPL 约定一致）映射到 LPAPI 的 orientation 角度（0/90/180/270）
const ROT_DEG = { N: 0, R: 90, I: 180, B: 270 }
function rotDeg(el) { return ROT_DEG[el.rotation] || 0 }

// 变量填充：{{var}} -> data[var]
function fillVars(text, data) {
	return String(text == null ? '' : text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
		const v = data[key]
		return v == null ? '' : String(v)
	})
}

// 一维码类型映射（与 dothan-lpapi-ble SDK 枚举一致：CODE128=28, CODE39=24, EAN13=22）
const BARCODE_TYPE = { code128: 28, code39: 24, ean13: 22 }

// 二维码容量/可扫尺寸自适应：短数据用模板框，长数据自动放大到"能稳扫的最小尺寸"。
// 依据：实测关键件 SN(37字节, ecc=Q) 在 5.33mm 框内被压到 ~1.5 打印点/模块(含静默区) → 扫不出；
// 而批次号短数据在 5.33mm(约 2.17 点/模块)可扫。故以"安全点/模块=2.15"为基准推算最小尺寸
// （对齐批次号实测可扫密度 2.17，略留裕度；关键件 37字节会放大到约 7.5mm，同批次号可扫密度）。
// 字节模式各版本最大数据字节数（索引=版本号，[0]占位）。
const QR_CAP_BYTES = {
	L: [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
	M: [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
	Q: [0, 11, 20, 32, 46, 60, 74, 86, 108, 130, 154],
	H: [0, 7, 14, 24, 34, 44, 58, 64, 84, 98, 119]
}
// 算出承载 byteLen 字节所需的最小 QR 版本（1..10）
function qrMinVersion(byteLen, eccChar) {
	const tbl = QR_CAP_BYTES[eccChar] || QR_CAP_BYTES.M
	for (let v = 1; v < tbl.length; v++) if (tbl[v] >= byteLen) return v
	return tbl.length - 1 // 超出表上限，按最大版本（仍可能装不下，交给 SDK 兜底报错）
}
// UTF-8 字节长度（uni-app 运行环境无 Node Buffer，手动计；QR 字节模式按 UTF-8 编码）
function utf8Len(s) {
	let n = 0
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i)
		if (c < 0x80) n += 1
		else if (c < 0x800) n += 2
		else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++ } // 代理对算 4 字节
		else n += 3
	}
	return n
}
// 能稳扫的最小边长(mm)：版本模块数(17+4v) + 8 静默区(每侧4)，乘以安全点距(2.15 点 @ dpi)。
function qrMinScannableMm(byteLen, eccChar, dpi) {
	const v = qrMinVersion(byteLen, eccChar)
	const modules = (17 + 4 * v) + 8
	const safePitchMm = (2.15 * 25.4) / dpi
	return modules * safePitchMm
}
// 同 topLeft，但把元素钳制在标签范围内（用于二维码放大后防止越界被裁）。
function topLeftClamped(el, boxW, boxH, labelW, labelH) {
	const a = anchorOf(el)
	let x = el.x - boxW * a.fx
	let y = el.y - boxH * a.fy
	const lw = num(labelW, Infinity), lh = num(labelH, Infinity)
	if (isFinite(lw)) {
		if (x < 0) x = 0
		if (x + boxW > lw) x = Math.max(0, lw - boxW)
	}
	if (isFinite(lh)) {
		if (y < 0) y = 0
		if (y + boxH > lh) y = Math.max(0, lh - boxH)
	}
	return { x, y }
}

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

// 绘制收集器：与 LPAPI 实例同形（同名 draw* 方法），但不真正绘制，只把 opts 收进 page 数组。
// 用途——把"逐条 startJob + draw + commitJob"的逐个任务模式，改成"一次任务多页"的合批模式：
//   var page = createDrawCollector()        // 一页 = 一个 DrawItem 数组
//   renderTemplateToLpapi(page, tpl, rec1)  // 渲染算法完全复用，只是 draw 变成收集
//   renderTemplateToLpapi(page, tpl, rec2)
//   -> drawJob({ jobPages: [page1, page2, ...] })
//
// 为什么用"同形代理"而不是改渲染器：渲染器里 drawText/draw2DQRCode/... 的调用点、以及
// 框尺寸换算、anchor 基点、QR 可扫尺寸自适应等算法，全部原样保留、零漂移。
// itemType 与 SDK 的 DrawItem.type 取值一致（SDK 内部即按 type 分发）。
const DRAW_TYPES = {
	drawText: 'text',
	draw2DQRCode: '2DQRCode',
	drawQRCode: '2DQRCode',
	draw1DBarcode: 'barcode',
	drawBarcode: 'barcode',
	drawRectangle: 'rectangle',
	drawRect: 'rectangle',
	drawLine: 'line'
}
export function createDrawCollector() {
	const page = []
	Object.keys(DRAW_TYPES).forEach((fn) => {
		page[fn] = function (o) {
			page.push(Object.assign({ type: DRAW_TYPES[fn] }, o || {}))
		}
	})
	// 兼容渲染器里的能力探测（typeof lpapi.draw1DBarcode === 'function' 等）与
	// splitText（文本换行行数按框宽实算，需真实 SDK 行为）。splitText 由调用方在
	// 渲染前从真实 lpapi 实例上挂到收集器上（见 lpapiAdapter.printTemplateBatch）。
	return page
}

// 主渲染函数：假设调用方已完成 startJob（已建立绘制上下文 ctx），本函数只负责 draw。
// lpapi: LPAPI 实例【或 createDrawCollector() 产出的同形收集器】；tpl: 中性模板；data: 变量表。
// opts.offsetXMm: 整张内容向右补偿的毫米数（打印头比标签宽时把窄标签居中到介质上）。
// 返回 report: { drawn, skipped[], offLabel[] }，便于上层在 UI 提示"哪些元素没印出来 / 越界"。
export function renderTemplateToLpapi(lpapi, tpl, data = {}, _printerDpi, opts = {}) {
	// 中性模型元素是毫米坐标，直接下发，无需 dpi 折算（_printerDpi 仅保留兼容入参，不再使用）。
	const elements = (tpl && tpl.elements) || []
	const labelW = num((tpl && tpl.page && tpl.page.widthMm) || 50, 50)
	const labelH = num((tpl && tpl.page && tpl.page.heightMm) || 30, 30)
	// 水平补偿：只对实际下发坐标生效，不改变元素在"标签坐标系"里的逻辑位置（越界检测仍按标签坐标系）。
	const ox = num(opts.offsetXMm, 0)
	// 垂直补偿：与水平对称，纯手动 delta（正=下移、负=上移），由上层 computeOffsetY 算好传入。
	// 同样只对实际下发坐标生效，越界检测仍基于未偏移的标签坐标系。
	const oy = num(opts.offsetYMm, 0)
	const report = { drawn: 0, skipped: [], offLabel: [] }
	for (let i = 0; i < elements.length; i++) {
		const el = elements[i]
		const box = renderOne(lpapi, el, i, data, tpl, report, ox, oy, labelW, labelH, _printerDpi)
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

function renderOne(lpapi, el, idx, data, tpl, report, ox, oy, labelW, labelH, dpi) {
	if (!el || !el.type) { reportSkip('未知元素'); return null }
	let box = null
	switch (el.type) {
		case 'text': box = renderText(lpapi, el, data, tpl, report, idx, ox, oy); break
		case 'qrcode': box = renderQrcode(lpapi, el, data, report, idx, ox, oy, labelW, labelH, dpi); break
		case 'barcode': box = renderBarcode(lpapi, el, data, tpl, report, idx, ox, oy); break
		case 'box': box = renderBox(lpapi, el, tpl, report, idx, ox, oy); break
		case 'line': box = renderLine(lpapi, el, tpl, report, idx, ox, oy); break
		default: reportSkip('不支持的类型:' + el.type); return null
	}
	return box

	function reportSkip(reason) {
		report.skipped.push('#' + idx + ' ' + (el && el.type) + ': ' + reason)
		console.warn('[lpapiTemplate] 跳过元素 #' + idx + ' (' + (el && el.type) + '):', reason)
	}
}

function renderText(lpapi, el, data, tpl, report, idx, ox, oy) {
	const text = fillVars(el.text, data)
	if (!text) { report.skipped.push('#' + idx + ' text: 空白(变量未填充?)'); console.warn('[lpapiTemplate] 跳过文本元素：内容为空白（变量未填充？）'); return null }
	// 中性模型 fontH/fontW 已是毫米
	const frameW = num(el.width, 0)
	const frameH = num(el.height || el.heightMm, 0)
	// 只填一个高度：框高即字号（单行/多行统一以框高作为行高），字高/字宽不再单独控制
	let fontHmm = frameH > 0 ? frameH : num(el.fontH, 3)
	// 框尺寸（mm）：有显式框用显式框，否则按内容估算，便于 anchor 居中时不偏
	const w = frameW > 0 ? frameW : Math.max(6, text.length * fontHmm * 0.5)
	// 行高：显式 lineSpace(行间距 mm) 时 = 字高 + 行间距；否则沿用 SDK 单倍行距近似值（字高×1.172）
	const lineGapMm = num(el.lineSpace, 0)
	const lineHmm = lineGapMm > 0 ? fontHmm + lineGapMm : fontHmm * 1.172
	// 计算换行行数：长文本换行的根因是框太窄（按框宽自动换行）；若换行后框高放不下全部行，
	// 则把绘制框高撑到能容纳全部行，并关闭 autoShrink，避免被压成"芝麻字"。字号始终 = 框高。
	let lines = 1
	let usedSplit = false
	try {
		if (typeof lpapi.splitText === 'function' && w > 0) {
			const arr = lpapi.splitText({ text, width: w, fontHeight: fontHmm, autoReturn: true })
			if (Array.isArray(arr) && arr.length > 1) { lines = arr.length; usedSplit = true }
		}
	} catch (e) { /* splitText 不可用时退回估算 */ }
	if (!usedSplit) {
		const charsPerLine = Math.max(1, Math.floor((w * 0.9) / (fontHmm * 0.55)))
		lines = Math.max(1, Math.ceil(text.length / charsPerLine))
	}
	// 框高即绘制高度：多行文本若框高放不下全部行，把绘制框撑高（绝不压扁成芝麻字）；
	// 单行/未设框高均不约束 SDK（height:0 + autoHeight），字号严格 = fontHeight（=框高）。
	// autoShrink 始终关闭：SDK 的 autoShrink 有"只缩不放 + 最小字号地板(2mm)"缺陷，会导致"往大
	// 调可以、往小调不行"，这里由我们直接给定字号、并传 minFontHeight 压低该地板来绕开它。
	let h = frameH
	let autoShrink = false
	let constrainHeight = false
	if (lines > 1) {
		const neededH = lines * lineHmm + fontHmm * 0.15
		if (neededH > frameH) h = neededH
	}
	// 传给 SDK 的绘制框高：约束时用 h；不约束时传 0（SDK 以实际字号高度显示，字号严格由 fontHeight 决定）
	const drawH = constrainHeight ? h : 0
	const { x, y } = topLeft(el, w, drawH)
	const horiz = el.align === 'center' ? 1 : el.align === 'right' ? 2 : 0
	// fontStyle：0=常规 1=粗 2=斜 3=粗斜（LPA_FontStyle）
	const fontStyle = (el.bold ? 1 : 0) | (el.italic ? 2 : 0)
	// verticalAlignment：0=上 1=中 2=下（LPA_ItemAlignment）；未设回落 SDK 默认居上
	const valign = (el.valign === 1 || el.valign === 2) ? el.valign : 0
	// autoReturn：0=不换行 1=按字换行 2=按词换行（LPA_AutoReturnMode）；wordWrap=false 时关闭换行
	const autoReturn = el.wordWrap === false ? 0 : 1
	const opts = {
		text,
		x: x + ox, y: y + oy,
		width: w,
		height: drawH,
		fontHeight: fontHmm,
		horizontalAlignment: horiz,
		fontStyle,
		autoReturn,
		// 压低 SDK 默认最小字号(2mm)地板，让"调小"也生效；0.1mm≈1.2px@300dpi
		minFontHeight: 0.1
	}
	if (!constrainHeight) opts.autoHeight = true // 双保险：不约束时显式让 SDK 高度自适应内容
	if (valign) opts.verticalAlignment = valign
	if (num(el.charSpace, 0) > 0) opts.charSpace = num(el.charSpace, 0)
	if (lineGapMm > 0) opts.lineSpace = lineGapMm
	if (autoShrink !== undefined) opts.autoShrink = autoShrink
	const rot = rotDeg(el)
	if (rot) opts.orientation = rot
	lpapi.drawText(opts)
	return { x, y, w, h }
}

function renderQrcode(lpapi, el, data, report, idx, ox, oy, labelW, labelH, dpi) {
	const value = fillVars(el.data, data)
	if (!value) { report.skipped.push('#' + idx + ' qrcode: 空白(变量未填充?)'); console.warn('[lpapiTemplate] 跳过二维码元素：内容为空白（变量未填充？）'); return null }
	const frameMm = num(el.width, 0) > 0 ? el.width : 15
	// 自适应尺寸：短数据(可稳扫尺寸 ≤ 模板框)用模板框；长数据放大到"能稳扫的最小尺寸"，
	// 避免被压密扫不出（详见 qrMinScannableMm 注释）。
	let sizeMm = frameMm
	const byteLen = utf8Len(value)
	if (byteLen > 0) {
		const minMm = qrMinScannableMm(byteLen, String(el.ecc || 'M').toUpperCase(), num(dpi, 300))
		if (minMm > frameMm) {
			// 规则：二维码比模板框大 -> 按二维码实际大小打印；比框小 -> 按框大小打印。
			// 不卡控、不阻断，照常出纸。放大是"保扫"的正常行为，不是异常，
			// 故只记 debug 级日志（默认不刷屏），避免合批时每条都占一行。
			sizeMm = minMm
			if (typeof console !== 'undefined' && console.debug) {
				console.debug('[lpapiTemplate] 二维码按可扫尺寸放大 ' + round1(frameMm) + 'mm -> ' + round1(sizeMm) + 'mm（' + byteLen + '字节, ecc=' + (el.ecc || 'M') + '）')
			}
		}
	}
	// 放大后可能越界，钳制在标签范围内
	const { x, y } = topLeftClamped(el, sizeMm, sizeMm, labelW, labelH)
	// eccLevel：0=L 1=M 2=Q 3=H（LPA_QREccLevel，默认 M）；纠错等级由模板决定
	const eccIdx = QR_ECC.indexOf(el.ecc) === -1 ? 1 : QR_ECC.indexOf(el.ecc)
	const opts = { text: value, x: x + ox, y: y + oy, width: sizeMm, eccLevel: eccIdx }
	const rot = rotDeg(el)
	if (rot) opts.orientation = rot
	lpapi.draw2DQRCode(opts)
	return { x, y, w: sizeMm, h: sizeMm }
}

function renderBarcode(lpapi, el, data, tpl, report, idx, ox, oy) {
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
	// showText：SDK 用 textHeight 控制供人识读文本（0=不显示，>0=显示高度 mm）。
	const showText = el.showText !== false
	// barcodeType 是 SDK 真实字段名（readme 的 type 是文档别名）。
	const opts = {
		text: value,
		x: x + ox, y: y + oy,
		width: w,
		height: h,
		textHeight: showText ? Math.max(2, barHmm * 0.3) : 0,
		barcodeType: BARCODE_TYPE[el.codeType] || 28
	}
	const rot = rotDeg(el)
	if (rot) opts.orientation = rot
	draw.call(lpapi, opts)
	return { x, y, w, h }
}

function renderBox(lpapi, el, tpl, report, idx, ox, oy) {
	const w = num(el.width, 0)
	const h = num(el.height, 0)
	if (w <= 0 || h <= 0) { report.skipped.push('#' + idx + ' box: 宽或高为0'); return null }
	// 中性模型 thickness 已是毫米
	const { x, y } = topLeft(el, w, h)
	const lineW = Math.max(0.2, num(el.thickness, 0.3))
	const opts = { x: x + ox, y: y + oy, width: w, height: h, lineWidth: lineW }
	const rot = rotDeg(el)
	if (rot) opts.orientation = rot
	lpapi.drawRectangle(opts)
	return { x, y, w, h }
}

function renderLine(lpapi, el, tpl, report, idx, ox, oy) {
	if (!lpapi.drawLine) { report.skipped.push('#' + idx + ' line: 设备不支持'); return null }
	const w = num(el.width, 0)
	if (w <= 0) { report.skipped.push('#' + idx + ' line: 宽为0'); return null }
	// 中性模型 thickness 已是毫米
	const { x, y } = topLeft(el, w, 0)
	const lineW = Math.max(0.2, num(el.thickness, 0.3))
	const opts = { x1: x + ox, y1: y + oy, x2: x + w + ox, y2: y + oy, lineWidth: lineW }
	const rot = rotDeg(el)
	if (rot) opts.orientation = rot
	lpapi.drawLine(opts)
	return { x, y, w, h: 0 }
}

export default renderTemplateToLpapi
