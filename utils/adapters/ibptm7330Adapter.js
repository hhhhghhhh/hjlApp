// utils/adapters/ibptm7330Adapter.js
// IB-PTM7330 便携式热转印打印机适配器。
// 协议：TPCL / ESC/POS 兼容指令集（厂家《位图方式打印命令说明文档》）。
// 连接方式：BLE GATT（非经典蓝牙 SPP）
//
// 3 种测试，明确区分"位图方式"与"标准指令流"：
//   1) PDF 位图    —— 厂家自定义 1F 2A / 1F 2B / 1F 2E（文档《位图方式打印命令说明》主推）
//   2) TPCL       —— 东芝 TSPL 2 标准指令流：TEXT/BARCODE/QRCODE/PRINT（非位图）
//   3) ESC/POS    —— Epson 标准指令流：文本/条码/二维码/走纸（非位图）
// 注：ESC/POS 与 TPCL 是行业/厂商标准指令集；位图方式只走 PDF 文档那套 1F2A 命令。
// 中文文本因打印机无内置中文字库，统一走位图（PDF 1F2A）下发。
//
// 关键指令（十六进制，来自 PDF）：
//   1B 40          初始化打印参数
//   1F 27 01 n 88  设置打印宽度（n = 标签宽度毫米数；按参数表 300dpi）
//   1B 4A n        走 N 个空行
//   1F 2A nL nH …  打印 N 点的一行（N = nL + nH*256，数据字节数 = (N+7)/8）
//   1F 2B m n …    打印有前导空白的一行（压缩格式）
//   1F 2E n        重复上一行 n+1 次
//   0C             定位到下一张标签边界
//
// BLE 参数（BLE Scanner 扫描获取）：
//   Service UUID:  0000FF00-0000-1000-8000-00805F9B34FB
//   Write Char:    0000FF02-0000-1000-8000-00805F9B34FB
//   Notify Char:   0000FF01-0000-1000-8000-00805F9B34FB
//
// 中文处理：IB-PTM7330 没有内置中文字体，所有内容（含中文）通过 Android Canvas
// 预先渲染成黑白位图，再按行下发。
// 位图分辨率：按厂家参数表 = 300 DPI。

import conn from '../printerConnection.js'
import { PrinterAdapter, DEFAULT_LABEL } from '../printerAdapter.js'

const inv = (obj, method, ...args) => plus.android.invoke(obj, method, ...args)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Android 颜色常量
const COLOR_BLACK = -16777216
const COLOR_WHITE = -1

// 日志前缀
const TAG = '[Ibptm7330]'

export class Ibptm7330Adapter extends PrinterAdapter {
	constructor() {
		super('ibptm7330')
		this.connectionType = 'ble' // 使用 BLE GATT 连接
		this.label = { ...DEFAULT_LABEL }
		// 位图分辨率：默认 300 DPI（厂家参数表"打印密度 300dpi"）。
		this.dpi = 300
	}

	// ---------- 配置 ----------
	// IB-PTM7330 硬件固定 300dpi，dpi 不可被外部改写（避免误传模板的 203 把位图算错）。
	setLabelSize(widthMm, heightMm) {
		this.label = {
			widthMm: widthMm || DEFAULT_LABEL.widthMm,
			heightMm: heightMm || DEFAULT_LABEL.heightMm
		}
	}

	// ---------- 状态 ----------
	async getStatus() {
		return {
			ok: this.isConnected(),
			message: this.isConnected() ? '蓝牙已连接(BLE)' : '未连接'
		}
	}

	// ============================================================
	// 4 种位图测试方法
	// ============================================================
	async printTest() {
		// 默认 = PDF 位图（最可靠）
		return this.printTestPdf()
	}

	async printTestPdf() {
		conn.ensureConnected()
		return this._renderAndTest('PDF 1F2A', (rows, w, h, wm) => packPdf(rows, w, h, wm), 'PDF')
	}

	// TPCL（东芝 TSPL）：标准指令流（文本/条码/二维码），不是位图
	async printTestTpcl() {
		conn.ensureConnected()
		console.log(TAG, 'TPCL start (TSPL 标准指令流: 文本/条码/二维码, 非位图)')
		const cmds = buildTpclLabel(this.label)
		await sendChunks(cmds, 'TPCL')
		console.log(TAG, 'TPCL DONE')
	}

	// ESC/POS（Epson 标准）：标准指令流（文本/条码/二维码/走纸），不是位图
	async printTestEsc() {
		conn.ensureConnected()
		console.log(TAG, 'ESC/POS start (ESC/POS 标准指令流: 文本/条码/二维码, 非位图)')
		const cmds = buildEscPosLabel(this.label)
		await sendChunks(cmds, 'ESC')
		console.log(TAG, 'ESC DONE')
	}

	// 渲染测试标签位图 -> 读像素 -> 二值化 -> 打包 -> 发送
	async _renderAndTest(mode, packer, tag) {
		const widthMm = this.label.widthMm
		const heightMm = this.label.heightMm
		const dpi = this.dpi
		console.log(TAG, tag, 'start, label:', widthMm + 'x' + heightMm + 'mm', 'dpi:', dpi, 'mode:', mode)

		const t0 = Date.now()
		const built = buildTestLabelBitmap({ widthMm, heightMm, dpi, mode })
		const { bitmap, width, height } = built
		try {
			const rows = readBitmapPixels(bitmap, width, height)
			if (rows.length === 0) throw new Error('位图为空')
			console.log(TAG, tag, 'pixels->rows done, rows:', rows.length, 'bytesPerRow:', rows[0].length, 'black-check ok')

			const cmds = packer(rows, width, height, widthMm, heightMm)
			console.log(TAG, tag, 'packed cmds:', cmds.length)
			await sendChunks(cmds, tag)
			console.log(TAG, tag, 'DONE in', Date.now() - t0, 'ms')
		} finally {
			try { inv(bitmap, 'recycle') } catch (e) {}
		}
	}

	// ---------- 模板打印（占位，后续按模板元素完善） ----------
	async printTemplate(tpl, data = {}) {
		conn.ensureConnected()
		const widthMm = (tpl.page && tpl.page.widthMm) || this.label.widthMm
		const heightMm = (tpl.page && tpl.page.heightMm) || this.label.heightMm
		// IB-PTM7330 是固定 300dpi 的位图打印机：整张标签渲染成像素位图按行下发，
		// 位图分辨率必须 = 打印机硬件 dpi（this.dpi=300），不能用模板里不可靠的 dpi(203)。
		// 模板的 page.dpi 只供 ZPL 点指令与 LPAPI 点值换算使用，对位图机无效。
		const lines = [
			'IB-PTM7330 模板打印测试',
			'模板: ' + (tpl.name || '未命名'),
			'数据: ' + JSON.stringify(data).slice(0, 80)
		]
		await this.printTextLines(lines, { widthMm, heightMm })
	}

	// ---------- 纯文本打印（走 PDF 位图方法） ----------
	async printText(text, opts = {}) {
		conn.ensureConnected()
		await this.printTextLines(String(text).split(/\r?\n/), opts)
	}

	async printTextLines(lines, opts = {}) {
		conn.ensureConnected()
		const widthMm = opts.widthMm || this.label.widthMm
		const heightMm = opts.heightMm || this.label.heightMm
		// 固定分辨率位图机：位图始终按硬件 dpi(300) 栅格化，忽略任何外部传入的 dpi（如模板的 203）
		const dpi = this.dpi
		const fontHeightMm = opts.fontHeightMm || 3.5
		console.log(TAG, 'printTextLines:', lines.length, 'lines', widthMm + 'x' + heightMm + 'mm', 'dpi:', dpi)

		const t0 = Date.now()
		const rendered = renderTextLines(lines, {
			widthMm,
			heightMm,
			dpi,
			fontHeightMm,
			paddingMm: opts.paddingMm || 2
		})
		console.log(TAG, 'renderTextLines done in', Date.now() - t0, 'ms, cmds:', rendered ? rendered.length : 0)

		if (!rendered || rendered.length === 0) {
			throw new Error('位图渲染失败：无数据')
		}

		for (let i = 0; i < rendered.length; i++) {
			if (i % 50 === 0 || i === rendered.length - 1) {
				console.log(TAG, 'sending chunk', i + 1, '/', rendered.length)
			}
			await conn.sendBytes(rendered[i])
			await sleep(10)
		}
		console.log(TAG, 'printTextLines send done')
	}

	// ---------- 维护 ----------
	async clearBuffer() {
		if (!this.isConnected()) return
		await conn.sendBytes([0x1B, 0x40])
		await sleep(100)
	}

	async calibrate() {
		if (!this.isConnected()) return
		await conn.sendBytes([0x0C])
		await sleep(300)
	}

	// ---------- 字体查询 ----------
	async queryFonts() {
		return { ok: false, message: 'IB-PTM7330 走位图，无内置字体查询' }
	}

	// ESC/POS 位图渲染依赖 Android Canvas，永远"有"中文渲染能力
	hasCjkFont() { return true }
	hasTtfFont() { return false }
}

export default Ibptm7330Adapter

// ============================================================
// 共享：位图渲染 + 像素读取 + 二值化
// ============================================================

function mmToDots(mm, dpi) {
	return Math.round(mm * dpi / 25.4)
}

function assertAndroid() {
	if (typeof plus === 'undefined') throw new Error('需要在 App 中运行')
	if (!plus.os || plus.os.name.toLowerCase() !== 'android') throw new Error('仅支持 Android')
}

let _cls = null
function classes() {
	if (_cls) return _cls
	_cls = {
		Bitmap: plus.android.importClass('android.graphics.Bitmap'),
		BitmapConfig: plus.android.importClass('android.graphics.Bitmap$Config'),
		Canvas: plus.android.importClass('android.graphics.Canvas'),
		Paint: plus.android.importClass('android.graphics.Paint'),
		PaintAlign: plus.android.importClass('android.graphics.Paint$Align')
	}
	return _cls
}

function getArgbConfig() {
	const C = classes()
	try {
		const v = C.BitmapConfig.ARGB_8888
		if (v != null && typeof v !== 'function') return v
	} catch (e) {}
	try {
		const v = C.BitmapConfig.RGB_565
		if (v != null && typeof v !== 'function') return v
	} catch (e) {}
	return null
}

function getPaintAlign(align) {
	const C = classes()
	const name = align === 'center' ? 'CENTER' : (align === 'right' ? 'RIGHT' : 'LEFT')
	try {
		const v = C.PaintAlign[name]
		if (v != null && typeof v !== 'function') return v
	} catch (e) {}
	return null
}

function createPaint(fontHeightDots, bold, antiAlias) {
	const C = classes()
	const paint = new C.Paint()
	inv(paint, 'setAntiAlias', !!antiAlias)
	inv(paint, 'setColor', COLOR_BLACK)
	inv(paint, 'setTextSize', fontHeightDots)
	if (bold) {
		try { inv(paint, 'setFakeBoldText', true) } catch (e) {}
	}
	return paint
}

function toNum(v) {
	if (typeof v === 'number') return v
	if (typeof v === 'string') {
		const n = parseInt(v, 10)
		return isNaN(n) ? NaN : n
	}
	if (v != null && typeof v === 'object') {
		try { return inv(v, 'intValue') } catch (e) {}
		try { return Number(v) } catch (e) {}
	}
	return NaN
}

// 读整张位图像素并二值化为"每字节 MSB 在前（最左点 = 最高位）"的行数组。
// 返回 rows: Uint8Array[]，每个元素是一行的位图字节。
//
// 性能：逐像素 getPixel 会跨 JSBridge 约 21 万次（591x354@300dpi），单次调用
// 约 1.4ms，整张要 5 分钟，体验上就是"位图渲染中"卡死。
// 这里优先用 copyPixelsToBuffer 一次性取出全部像素到 Java 字节数组，再 Base64
// 编码成字符串一次性传回 JS，最后纯 JS 二值化（毫秒级，零 JSBridge 循环）。
// 任何一步失败都回退到逐像素 getPixel（慢但一定可用）。
function readBitmapPixels(bitmap, width, height) {
	try {
		return readBitmapPixelsFast(bitmap, width, height)
	} catch (e) {
		console.warn(TAG, 'readBitmapPixels 快速通道失败，回退逐像素 getPixel:', e.message)
		return readBitmapPixelsSlow(bitmap, width, height)
	}
}

// 快速通道：copyPixelsToBuffer -> Base64 -> JS 解码 -> 纯 JS 二值化
function readBitmapPixelsFast(bitmap, width, height) {
	const bytesPerRow = Math.ceil(width / 8)
	const t1 = Date.now()

	// 1) 一次性把整张位图拷进 Java 堆字节缓冲区（1 次 JSBridge）
	const buf = plus.android.invoke('java.nio.ByteBuffer', 'allocate', width * height * 4)
	inv(bitmap, 'copyPixelsToBuffer', buf)
	const ba = inv(buf, 'array') // Java byte[]
	if (!ba) throw new Error('copyPixelsToBuffer/array 返回空')

	// 2) Base64 编码（1 次 JSBridge），整块字节一次性传回 JS 字符串
	const b64 = plus.android.invoke('android.util.Base64', 'encodeToString', ba, 2) // NO_WRAP
	if (typeof b64 !== 'string' || b64.length === 0) {
		throw new Error('Base64 编码返回空（5+ runtime 静态调用限制）')
	}

	// 3) JS 侧把 Base64 解码成 Uint8Array（纯 JS，无 JSBridge）
	const bytes = base64ToU8(b64)
	const expected = width * height * 4
	if (bytes.length !== expected) {
		throw new Error('字节数不符: ' + bytes.length + ' != ' + expected)
	}

	// 4) 纯 JS 二值化。copyPixelsToBuffer 对 ARGB_8888 的字节顺序是 R,G,B,A。
	//    不透明(alpha>127) 且红通道偏低判为黑点。
	const rows = new Array(height)
	let blackCount = 0
	for (let y = 0; y < height; y++) {
		const row = new Uint8Array(bytesPerRow)
		const rowBase = y * width * 4
		for (let x = 0; x < width; x++) {
			const p = rowBase + x * 4
			const a = bytes[p + 3]
			const r = bytes[p]
			if (a > 127 && r < 128) {
				row[x >> 3] |= (0x80 >> (x & 7))
				blackCount++
			}
		}
		rows[y] = row
	}
	console.log(TAG, 'readBitmapPixels FAST done in', Date.now() - t1, 'ms, black=' + blackCount)
	return rows
}

// 兜底：逐像素 getPixel（慢，但一定可用；逻辑与历史版本一致）
function readBitmapPixelsSlow(bitmap, width, height) {
	const bytesPerRow = Math.ceil(width / 8)
	const rows = []
	const t1 = Date.now()
	let blackCount = 0
	let whiteCount = 0
	let failCount = 0
	for (let y = 0; y < height; y++) {
		const row = new Uint8Array(bytesPerRow)
		for (let x = 0; x < width; x++) {
			let raw
			try {
				raw = inv(bitmap, 'getPixel', x, y)
			} catch (e) {
				failCount++
				whiteCount++
				continue
			}
			const pixel = toNum(raw)
			if (isNaN(pixel)) {
				failCount++
				whiteCount++
				continue
			}
			// 不透明且红通道偏低判为黑点（与 cjkBitmap 一致）
			const alpha = (pixel >>> 24) & 0xFF
			const r = (pixel >> 16) & 0xFF
			if (alpha > 127 && r < 128) {
				row[Math.floor(x / 8)] |= (0x80 >> (x % 8))
				blackCount++
			} else {
				whiteCount++
			}
		}
		rows.push(row)
		if (y % 40 === 0 || y === height - 1) {
			console.log(TAG, 'readBitmapPixels row', y + 1, '/', height)
		}
	}
	if (failCount > width * height * 0.5) {
		throw new Error('getPixel 大量失败: ' + failCount + '/' + (width * height))
	}
	console.log(TAG, 'readBitmapPixels SLOW done in', Date.now() - t1, 'ms, black=' + blackCount, 'white=' + whiteCount, 'fail=' + failCount)
	return rows
}

// Base64 字符串 -> Uint8Array。优先用 atob（环境内置，最快）；不可用再回退。
function base64ToU8(b64) {
	let bin
	if (typeof atob === 'function') {
		try { bin = atob(b64) } catch (e) { bin = null }
	}
	if (typeof bin === 'string') {
		const out = new Uint8Array(bin.length)
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xFF
		return out
	}
	// 回退：用 Android Base64.decode 拿到 Java byte[] 再逐字节读（本应不走到）
	const ba = plus.android.invoke('android.util.Base64', 'decode', b64, 0)
	const len = plus.android.invoke(ba, 'length')
	const out = new Uint8Array(len)
	for (let i = 0; i < len; i++) out[i] = plus.android.getAttribute(ba, i) & 0xFF
	return out
}

// 渲染一张测试标签到位图，返回 { bitmap, width, height }
function buildTestLabelBitmap({ widthMm, heightMm, dpi, mode }) {
	const width = mmToDots(widthMm, dpi)
	const height = mmToDots(heightMm, dpi)
	console.log(TAG, 'buildTestLabelBitmap:', widthMm + 'x' + heightMm + 'mm', 'dpi:', dpi, '->', width + 'x' + height, 'px', 'mode:', mode)
	assertAndroid()

	const C = classes()
	const config = getArgbConfig()
	if (!config) throw new Error('无法获取 Bitmap.Config')
	let bitmap, canvas
	try {
		bitmap = C.Bitmap.createBitmap(width, height, config)
		canvas = new C.Canvas()
		inv(canvas, 'setBitmap', bitmap)
	} catch (e) {
		throw new Error('createBitmap 失败: ' + e.message)
	}

	// 白色背景
	const paintWhite = new C.Paint()
	inv(paintWhite, 'setColor', COLOR_WHITE)
	inv(canvas, 'drawRect', 0, 0, width, height, paintWhite)

	const paintBlack = new C.Paint()
	inv(paintBlack, 'setColor', COLOR_BLACK)
	inv(paintBlack, 'setAntiAlias', true)

	// 边框
	const pad = mmToDots(2, dpi)
	inv(canvas, 'drawRect', pad, pad, width - pad, height - pad, paintBlack)
	const thick = Math.max(2, mmToDots(0.5, dpi))
	inv(paintWhite, 'setColor', COLOR_WHITE)
	inv(canvas, 'drawRect', pad + thick, pad + thick, width - pad - thick, height - pad - thick, paintWhite)
	inv(paintBlack, 'setColor', COLOR_BLACK)

	// 标题（居中）
	const titlePaint = createPaint(mmToDots(4, dpi), true, true)
	const titleAlign = getPaintAlign('center')
	if (titleAlign) inv(titlePaint, 'setTextAlign', titleAlign)
	inv(canvas, 'drawText', 'IB-PTM7330 测试', width / 2, pad + mmToDots(6, dpi), titlePaint)

	// 模式名（居中，重点：标明这是哪种位图方法）
	const modePaint = createPaint(mmToDots(3, dpi), true, true)
	const modeAlign = getPaintAlign('center')
	if (modeAlign) inv(modePaint, 'setTextAlign', modeAlign)
	inv(canvas, 'drawText', mode || '', width / 2, pad + mmToDots(11, dpi), modePaint)

	// 分辨率/尺寸信息（左对齐，便于核对实际打印尺寸）
	const infoPaint = createPaint(mmToDots(2.4, dpi), false, true)
	const infoAlign = getPaintAlign('left')
	if (infoAlign) inv(infoPaint, 'setTextAlign', infoAlign)
	const infoY = pad + mmToDots(16, dpi)
	const dotsPerMm = (width / widthMm).toFixed(1)
	inv(canvas, 'drawText', '分辨率 ' + dpi + 'dpi (' + dotsPerMm + '点/mm)', pad + mmToDots(2, dpi), infoY, infoPaint)
	inv(canvas, 'drawText', '位图 ' + width + 'x' + height + ' px', pad + mmToDots(2, dpi), infoY + mmToDots(4, dpi), infoPaint)

	// 中文行
	const textPaint = createPaint(mmToDots(3, dpi), true, true)
	const textAlign = getPaintAlign('left')
	if (textAlign) inv(textPaint, 'setTextAlign', textAlign)
	const lineY = pad + mmToDots(23, dpi)
	inv(canvas, 'drawText', '中文测试：直流模块(TY)', pad + mmToDots(2, dpi), lineY, textPaint)
	inv(canvas, 'drawText', 'SN: 7330-' + Date.now().toString().slice(-6), pad + mmToDots(2, dpi), lineY + mmToDots(4, dpi), textPaint)
	inv(canvas, 'drawText', new Date().toLocaleString(), pad + mmToDots(2, dpi), lineY + mmToDots(8, dpi), textPaint)

	// 底部横条（模拟条码区域）
	const barY = height - pad - mmToDots(6, dpi)
	inv(canvas, 'drawRect', pad + mmToDots(2, dpi), barY, width - pad - mmToDots(2, dpi), barY + mmToDots(4, dpi), paintBlack)
	const barTextPaint = createPaint(mmToDots(2.5, dpi), false, true)
	const barTextAlign = getPaintAlign('center')
	if (barTextAlign) inv(barTextPaint, 'setTextAlign', barTextAlign)
	inv(paintWhite, 'setColor', COLOR_WHITE)
	inv(canvas, 'drawText', '1234567890', width / 2, barY + mmToDots(3, dpi), barTextPaint)
	inv(paintBlack, 'setColor', COLOR_BLACK)

	return { bitmap, width, height }
}

// 纯文本行渲染为 PDF 位图命令（被 printTextLines 复用）
function renderTextLines(lines, opts = {}) {
	assertAndroid()
	const {
		widthMm = 50,
		heightMm = 30,
		dpi = 300,
		fontHeightMm = 3.5,
		paddingMm = 2,
		bold = true
	} = opts

	const width = mmToDots(widthMm, dpi)
	const height = mmToDots(heightMm, dpi)
	const padding = mmToDots(paddingMm, dpi)
	const fontHeightDots = mmToDots(fontHeightMm, dpi)
	const lineHeight = Math.round(fontHeightDots * 1.25)

	console.log(TAG, 'renderTextLines:', width + 'x' + height, 'px, fontH:', fontHeightDots, 'lineH:', lineHeight)

	if (width <= 0 || height <= 0) {
		console.error(TAG, '标签尺寸非法', width, height)
		return []
	}

	const C = classes()
	const config = getArgbConfig()
	if (!config) {
		console.error(TAG, '无法获取 Bitmap.Config')
		return []
	}

	let bitmap, canvas
	try {
		bitmap = C.Bitmap.createBitmap(width, height, config)
	} catch (e) {
		console.error(TAG, 'createBitmap failed:', e.message)
		return []
	}
	try {
		canvas = new C.Canvas()
		inv(canvas, 'setBitmap', bitmap)
	} catch (e) {
		console.error(TAG, 'Canvas failed:', e.message)
		try { inv(bitmap, 'recycle') } catch (e2) {}
		return []
	}

	const paintWhite = new C.Paint()
	inv(paintWhite, 'setColor', COLOR_WHITE)
	inv(canvas, 'drawRect', 0, 0, width, height, paintWhite)

	const paint = createPaint(fontHeightDots, bold, true)
	const paintAlign = getPaintAlign('left')
	if (paintAlign) {
		try { inv(paint, 'setTextAlign', paintAlign) } catch (e) {}
	}

	let y = padding + Math.round(fontHeightDots * 0.8)
	for (const line of lines) {
		if (y > height - padding) break
		try {
			inv(canvas, 'drawText', String(line), padding, y, paint)
		} catch (e) {
			console.error(TAG, 'drawText failed:', e.message)
		}
		y += lineHeight
	}

	const cmds = bitmapToEscPos(bitmap, width, height, dpi)
	try { inv(bitmap, 'recycle') } catch (e) {}
	return cmds
}

// 把 Bitmap 二值化并打包成 PDF 位图命令（1F 2A 系列）。供 printTextLines 复用。
function bitmapToEscPos(bitmap, width, height, dpi) {
	const rows = readBitmapPixels(bitmap, width, height)
	if (rows.length === 0) return []
	return packPdf(rows, width, height, Math.round(width * 25.4 / (dpi || 300)))
}

// ============================================================
// 4 种"命令打包器"：输入 rows（MSB 在前的二值化行），输出 Uint8Array 数组
// ============================================================

// 1) PDF 位图：1B 40 + 1F 27 01 widthMm 88 + 行(1F 2A/1F 2B/1F 2E) + 0C
function packPdf(rows, width, height, widthMm) {
	const bytesPerRow = rows[0].length
	const cmds = []
	const t3 = Date.now()

	cmds.push(new Uint8Array([0x1B, 0x40]))
	cmds.push(new Uint8Array([0x1F, 0x27, 0x01, widthMm, 0x88]))

	let prevRow = null
	let repeat = 0
	const flushRepeat = () => {
		while (repeat > 0) {
			const n = Math.min(repeat - 1, 191)
			cmds.push(new Uint8Array([0x1F, 0x2E, n]))
			repeat -= (n + 1)
		}
	}

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		if (prevRow && rowEqual(prevRow, row)) {
			repeat++
			continue
		}
		flushRepeat()
		prevRow = row
		repeat = 0

		let leadingZeros = 0
		while (leadingZeros < row.length && row[leadingZeros] === 0) leadingZeros++

		if (leadingZeros === row.length) {
			cmds.push(buildEscRow(row, width))
			continue
		}

		let trailingZeros = 0
		while (trailingZeros < row.length - leadingZeros && row[row.length - 1 - trailingZeros] === 0) trailingZeros++

		const dataStart = leadingZeros
		const dataEnd = row.length - trailingZeros
		const data = row.slice(dataStart, dataEnd)

		if (leadingZeros === 0) {
			cmds.push(buildEscRow(data, width))
		} else {
			if (leadingZeros <= 191 && data.length <= 191) {
				const cmd = new Uint8Array(4 + data.length)
				cmd[0] = 0x1F
				cmd[1] = 0x2B
				cmd[2] = leadingZeros
				cmd[3] = data.length
				cmd.set(data, 4)
				cmds.push(cmd)
			} else {
				cmds.push(buildEscRow(row, width))
			}
		}
	}
	flushRepeat()

	cmds.push(new Uint8Array([0x0C]))
	console.log(TAG, 'packPdf done in', Date.now() - t3, 'ms, cmds:', cmds.length)
	return cmds
}

// 1F 2A nL nH data：打印一行 N 点
function buildEscRow(data, totalDots) {
	const cmd = new Uint8Array(4 + data.length)
	cmd[0] = 0x1F
	cmd[1] = 0x2A
	cmd[2] = totalDots & 0xFF
	cmd[3] = (totalDots >> 8) & 0xFF
	cmd.set(data, 4)
	return cmd
}

// 2) TPCL(TSPL)：SIZE / CLS / BITMAP X,Y,w,h,mode,hex / PRINT 1
// 字符串转字节数组（ASCII/可见字符，用于标准指令流）
function strToBytes(s) {
	const a = new Uint8Array(s.length)
	for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xFF
	return a
}

// TPCL（东芝 TSPL 2）标准指令流：文本 + CODE128 条码 + 二维码（不是位图）
// 参考 TSPL 2 标准语法；若固件不在 TPCL 模式或语法有差异，可能不出纸（测试即为验证）
function buildTpclLabel(label) {
	const w = label.widthMm
	const h = label.heightMm
	const lines = [
		'SIZE ' + w + ' mm,' + h + ' mm',
		'GAP 2 mm,0 mm',
		'CLS',
		'TEXT 30,20,"4",0,1,1,"IB-PTM7330 TPCL"',
		'TEXT 30,80,"2",0,1,1,"Hello World 123456"',
		'TEXT 30,120,"2",0,1,1,"SN: 7330-503530143"',
		'BARCODE 30,160,"128",60,1,0,2,2,"1234567890"',
		'QRCODE 180,150,L,5,A,0,"IBPTM7330"',
		'PRINT 1'
	]
	const str = lines.join('\n') + '\r\n'
	console.log(TAG, 'buildTpclLabel:', str.replace(/\r?\n/g, ' | '))
	return [strToBytes(str)]
}

// ESC/POS（Epson 标准）指令流：文本 + CODE128 条码 + 二维码 + 走纸（不是位图）
function buildEscPosLabel(label) {
	const cmds = []
	const W = (s) => strToBytes(s)
	cmds.push(new Uint8Array([0x1B, 0x40]))            // ESC @ 初始化
	cmds.push(new Uint8Array([0x1B, 0x52, 0x00]))      // ESC R 0 国际字符集 USA
	cmds.push(new Uint8Array([0x1B, 0x21, 0x00]))      // ESC ! 0 正常字号
	cmds.push(W('IB-PTM7330 ESC/POS\n'))
	cmds.push(new Uint8Array([0x1B, 0x21, 0x10]))      // 倍高
	cmds.push(W('Hello World\n'))
	cmds.push(new Uint8Array([0x1B, 0x21, 0x00]))
	cmds.push(W('SN: 7330-503530143\n\n'))
	// CODE128 条码: GS k 73 len data
	const bc = '1234567890'
	cmds.push(new Uint8Array([0x1D, 0x6B, 73, bc.length, ...strToBytes(bc)]))
	cmds.push(W('\n\n'))
	// 二维码 (ESC ( k 标准序列)
	const qr = 'IBPTM7330'
	const qlen = qr.length + 3
	cmds.push(new Uint8Array([0x1B, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x31, 0x00])) // 型号1
	cmds.push(new Uint8Array([0x1B, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]))       // 模块大小6
	cmds.push(new Uint8Array([0x1B, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30]))       // 纠错L
	cmds.push(new Uint8Array([0x1B, 0x28, 0x6B, (qlen & 0xFF), ((qlen >> 8) & 0xFF), 0x31, 0x50, 0x30, ...strToBytes(qr)]))
	cmds.push(new Uint8Array([0x1B, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]))       // 打印QR
	cmds.push(W('\n\n\n'))
	cmds.push(new Uint8Array([0x0C]))                  // 走纸到下一标签
	console.log(TAG, 'buildEscPosLabel: text+barcode+QR cmds:', cmds.length)
	return cmds
}

function rowEqual(a, b) {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}

// 发命令：分包 + 每包小延迟 + 进度日志
async function sendChunks(cmds, tag) {
	console.log(TAG, tag, 'sending', cmds.length, 'chunks...')
	const t1 = Date.now()
	for (let i = 0; i < cmds.length; i++) {
		if (i % 50 === 0 || i === cmds.length - 1) {
			console.log(TAG, tag, 'send chunk', i + 1 + '/' + cmds.length, 'size:', cmds[i].length)
		}
		await conn.sendBytes(cmds[i])
		await sleep(10)
	}
	console.log(TAG, tag, 'send done in', Date.now() - t1, 'ms')
}
