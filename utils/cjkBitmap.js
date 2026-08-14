// utils/cjkBitmap.js
// 把文本（含中文）渲染成 ZPL ^GFA 位图指令。
// 用 Android Bitmap + Canvas + Paint 反射渲染，二值化后输出十六进制位图。
// 不依赖打印机里的中文字体，Android 系统自带的 Noto Sans CJK 即可渲染中文。
//
// 超采样（superSample）：在 ss 倍分辨率渲染再用 Android createScaledBitmap 降采样，
// 双线性插值让抗锯齿边缘正确量化为黑白，小字号下笔画更圆润、细笔画不丢失。
//
// 性能优化（默认配置）：
//   - 超采样默认关闭（ss=1），仅在调用方明确要求清晰度时开启
//   - 诊断日志默认关闭，仅在 _DEBUG=true 时输出
//   - 文本宽度用估算公式，不调 measureText 反射
//
// 反射模式完全照搬 zebraPrinter.js：
//   - plus.android.importClass 导入类
//   - new Class(args) 创建对象
//   - inv(obj, method, ...args) 调用实例方法
//   - Cls.staticMethod(args) 调用静态方法（直接 . 调用，不是 inv）
//   - Cls.field 直接访问静态字段（ARGB_8888 等名字不和 JS 原型方法冲突）
//   - 颜色用 Java int 常量，不依赖 Color.BLACK/WHITE 静态字段反射
//   - ⚠️ 不能用 Cls.valueOf('NAME')！Class 代理是 JS function，
//     JS Function.prototype.valueOf 会拦截这个调用返回 Class 本身
//   - ⚠️ plus.android.getAttribute 拿不到静态字段（返回 null），只能用直接字段访问

const inv = (obj, method, ...args) => plus.android.invoke(obj, method, ...args)

// Android 颜色 int 常量（直接用数值，避免反射访问 Color.BLACK/WHITE 不稳定）
// Color.BLACK = 0xFF000000 = -16777216
// Color.WHITE = 0xFFFFFFFF = -1
const COLOR_BLACK = -16777216
const COLOR_WHITE = -1

// plus.android.invoke 返回 int 时可能不是 JS number（字符串 / Java Integer 对象）
// 统一转成 number，否则 typeof 检查会挡掉所有像素
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

function assertAndroid() {
	if (typeof plus === 'undefined') {
		throw new Error('cjkBitmap 需要在 App 中运行')
	}
	if (!plus.os || plus.os.name.toLowerCase() !== 'android') {
		throw new Error('cjkBitmap 仅支持 Android')
	}
}

// 懒加载 Android 绘图类
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

// 性能优化：诊断日志默认关闭，仅保留 error 级。
// 如需排查问题，调用方 setDebug(true) 即可输出全量日志。
export let _DEBUG = false
export function setDebug(on) { _DEBUG = !!on }
const dbg = (...args) => { if (_DEBUG) console.log('[cjkBitmap]', ...args) }
const dbgErr = (...args) => console.error('[cjkBitmap]', ...args)

// ⚠️ 反射下获取 Bitmap.Config 枚举实例的难点：
// 1. C.BitmapConfig.valueOf('ARGB_8888') 不行——valueOf 是 JS Function.prototype 方法，
//    会被拦截返回 Class 代理本身（function 类型）。
// 2. plus.android.getAttribute(C.BitmapConfig, 'ARGB_8888') 也不行——返回 null
//    （getAttribute 似乎是为实例属性设计的，不是静态字段）。
// 3. 正确方式：直接字段访问 C.BitmapConfig.ARGB_8888。
//    ARGB_8888 不是 JS 原型方法名，不会被拦截。
let _argbConfig = null
function getArgbConfig() {
	if (_argbConfig && typeof _argbConfig !== 'function') return _argbConfig
	const C = classes()

	// 方式 1：直接字段访问（最可靠）
	try {
		const v = C.BitmapConfig.ARGB_8888
		if (v != null && typeof v !== 'function') { _argbConfig = v; return v }
	} catch (e) {}

	// 方式 2：getAttribute with Class 代理
	try {
		const v = plus.android.getAttribute(C.BitmapConfig, 'ARGB_8888')
		if (v != null && typeof v !== 'function') { _argbConfig = v; return v }
	} catch (e) {}

	// 方式 3：getAttribute with 字符串类名
	try {
		const v = plus.android.getAttribute('android.graphics.Bitmap$Config', 'ARGB_8888')
		if (v != null && typeof v !== 'function') { _argbConfig = v; return v }
	} catch (e) {}

	// 方式 4：invoke valueOf（兜底）
	try {
		const v = plus.android.invoke(C.BitmapConfig, 'valueOf', 'ARGB_8888')
		if (v != null && typeof v !== 'function') { _argbConfig = v; return v }
	} catch (e) {}

	// 方式 5：RGB_565 降级
	try {
		const v = C.BitmapConfig.RGB_565
		if (v != null && typeof v !== 'function') { _argbConfig = v; return v }
	} catch (e) {}

	// 方式 6：ALPHA_8 最简格式
	try {
		const v = C.BitmapConfig.ALPHA_8
		if (v != null && typeof v !== 'function') { _argbConfig = v; return v }
	} catch (e) {}

	dbgErr('所有获取 Config 的方式都失败！')
	_argbConfig = null
	return null
}

// Paint.Align 枚举获取（同理绕开 Function.prototype.valueOf 冲突）
// 直接字段访问最可靠：C.PaintAlign.CENTER
let _alignCache = {}
function getPaintAlign(align) {
	const key = align || 'left'
	if (_alignCache[key] && typeof _alignCache[key] !== 'function') return _alignCache[key]
	const C = classes()
	const name = key === 'center' ? 'CENTER' : (key === 'right' ? 'RIGHT' : 'LEFT')
	try {
		const v = C.PaintAlign[name]
		if (v != null && typeof v !== 'function') { _alignCache[key] = v; return v }
	} catch (e) {}
	try {
		const v = plus.android.getAttribute(C.PaintAlign, name)
		if (v != null && typeof v !== 'function') { _alignCache[key] = v; return v }
	} catch (e) {}
	_alignCache[key] = null
	return null
}

// 创建 Paint 对象
// antiAlias：超采样模式下开启抗锯齿，让边缘像素有灰度信息，降采样后更清晰
function createPaint(fontHeightDots, bold, antiAlias) {
	const C = classes()
	const paint = new C.Paint()
	inv(paint, 'setAntiAlias', !!antiAlias)
	inv(paint, 'setColor', COLOR_BLACK)
	inv(paint, 'setTextSize', fontHeightDots)
	if (bold) {
		try { inv(paint, 'setFakeBoldText', true) } catch (e) {}
	}
	try { inv(paint, 'setSubpixelText', true) } catch (e) {}
	return paint
}

// 纯估算文本宽度，避免每个 token 调 measureText 反射（性能瓶颈）
// 中文字约 1.0×字号宽，全角符号约 1.0×字号宽，ASCII 约 0.55×字号宽
function estimateTextWidth(text, fontHeightDots) {
	if (!text) return 0
	let w = 0
	for (const ch of String(text)) {
		const code = ch.charCodeAt(0)
		if (code >= 0x4e00 && code <= 0x9fff || // CJK 统一汉字
			code >= 0x3000 && code <= 0x303f || // CJK 符号
			code >= 0xff00 && code <= 0xffef) { // 全角字符
			w += fontHeightDots
		} else if (code < 0x80) {
			w += fontHeightDots * 0.55
		} else {
			w += fontHeightDots * 0.8
		}
	}
	return w
}

// 仅在 _DEBUG 模式下用真实测量，否则用估算（性能优化）
function measureTextSafe(paint, text, fontHeightDots) {
	if (!_DEBUG) return estimateTextWidth(text, fontHeightDots)
	try {
		const w = inv(paint, 'measureText', text)
		const n = typeof w === 'number' ? w : parseFloat(w)
		if (!isNaN(n) && n > 0) return n
	} catch (e) {}
	return estimateTextWidth(text, fontHeightDots)
}

// 逐字符断行。中文字符逐字可断，连续 ASCII 可见字符（[\x21-\x7E]）
// 作为整体 token 处理，避免 "(TY)" 这种词被切成 "T" 和 "Y)"。
function wrapText(paint, text, maxWidthDots, fontHeightDots) {
	if (text == null) return []
	const lines = []
	const paragraphs = String(text).split(/\r?\n/)
	for (const para of paragraphs) {
		if (!para) {
			lines.push('')
			continue
		}
		let line = ''
		let i = 0
		while (i < para.length) {
			let token = para[i]
			if (/[\x21-\x7E]/.test(para[i])) {
				let j = i + 1
				while (j < para.length && /[\x21-\x7E]/.test(para[j])) j++
				token = para.substring(i, j)
				i = j
			} else {
				i++
			}
			const test = line + token
			const w = measureTextSafe(paint, test, fontHeightDots)
			if (w > maxWidthDots && line) {
				lines.push(line)
				line = token
			} else {
				line = test
			}
		}
		if (line) lines.push(line)
	}
	return lines
}

// 把一段文本渲染成 ZPL ^GFA 指令
// opts:
//   fontHeightDots   字号高度（dot）
//   maxWidthDots     框宽（dot），超出自动换行；0 表示不限制
//   align            left / center / right
//   bold             是否粗体
//   lineHeightRatio  行高倍率，默认 1.25
//   superSample      超采样倍数，默认 1（关闭）。开启会在 ss 倍分辨率渲染再降采样，
//                    提升小字号清晰度但性能下降 ss² 倍
// 返回 { gfa, widthDots, heightDots }
export function renderTextToGfa(text, opts = {}) {
	assertAndroid()
	const {
		fontHeightDots = 24,
		maxWidthDots = 200,
		align = 'left',
		bold = false,
		lineHeightRatio = 1.25,
		superSample = 1
	} = opts

	if (text == null || text === '') {
		return { gfa: '', widthDots: 0, heightDots: 0 }
	}

	// 超采样倍数限制在 1-4
	const ss = Math.max(1, Math.min(superSample, 4))

	const C = classes()
	const config = getArgbConfig()

	// 1. 用估算公式断行（不调 measureText 反射）
	const limit = maxWidthDots > 0 ? maxWidthDots : 100000
	const lines = wrapText(null, text, limit, fontHeightDots)
	if (lines.length === 0) {
		return { gfa: '', widthDots: 0, heightDots: 0 }
	}

	// 2. 计算目标位图尺寸（1x，用于最终输出和 ZPL）
	const lineHeight = Math.max(fontHeightDots, Math.round(fontHeightDots * lineHeightRatio))
	let width
	if (limit > 100000) {
		let max = 0
		for (const line of lines) {
			max = Math.max(max, estimateTextWidth(line, fontHeightDots))
		}
		width = Math.ceil(max)
	} else {
		width = maxWidthDots
	}
	const height = lineHeight * lines.length

	if (width <= 0 || height <= 0) {
		return { gfa: '', widthDots: 0, heightDots: 0 }
	}

	// 3. 计算渲染尺寸（ss 倍），在高分辨率上画文字
	const renderW = width * ss
	const renderH = height * ss
	const renderFontH = fontHeightDots * ss
	const renderLineHeight = lineHeight * ss
	const renderPaint = createPaint(renderFontH, bold, ss > 1)
	const paintAlign = getPaintAlign(align)
	if (paintAlign) {
		try { inv(renderPaint, 'setTextAlign', paintAlign) } catch (e) {}
	}

	dbg('render: target=' + width + 'x' + height +
		' render=' + renderW + 'x' + renderH + ' ss=' + ss +
		' fontH=' + fontHeightDots)

	// 4. 创建 Bitmap + Canvas
	if (config == null || typeof config === 'function') {
		dbgErr('config 无效')
		return { gfa: '', widthDots: 0, heightDots: 0, error: 'config 无效' }
	}
	let bitmap, canvas
	try {
		bitmap = C.Bitmap.createBitmap(renderW, renderH, config)
	} catch (e) {
		dbgErr('createBitmap failed:', e.message)
		return { gfa: '', widthDots: 0, heightDots: 0, error: 'createBitmap: ' + e.message }
	}
	if (bitmap == null) {
		dbgErr('createBitmap 返回 null')
		return { gfa: '', widthDots: 0, heightDots: 0, error: 'createBitmap 返回 null' }
	}
	try {
		canvas = new C.Canvas()
		inv(canvas, 'setBitmap', bitmap)
	} catch (e) {
		dbgErr('new Canvas / setBitmap failed:', e.message)
		try { inv(bitmap, 'recycle') } catch (e2) {}
		return { gfa: '', widthDots: 0, heightDots: 0, error: 'Canvas: ' + e.message }
	}

	// 5. 逐行绘制文字（在 ss 倍分辨率上画）
	for (let i = 0; i < lines.length; i++) {
		let x
		if (align === 'center') x = renderW / 2
		else if (align === 'right') x = renderW
		else x = 0
		const baseline = i * renderLineHeight + Math.round(renderFontH * 0.8)
		try {
			inv(canvas, 'drawText', lines[i], x, baseline, renderPaint)
		} catch (e) {
			dbgErr('drawText line ' + i + ' failed:', e.message)
		}
	}

	// 6. 超采样降采样：把高分辨率位图缩放到目标尺寸
	if (ss > 1) {
		let scaledBitmap = null
		try {
			scaledBitmap = C.Bitmap.createScaledBitmap(bitmap, width, height, true)
		} catch (e) {
			dbgErr('createScaledBitmap failed:', e.message)
		}
		if (scaledBitmap != null && typeof scaledBitmap !== 'function') {
			try { inv(bitmap, 'recycle') } catch (e) {}
			bitmap = scaledBitmap
		} else {
			try { inv(bitmap, 'recycle') } catch (e) {}
			return { gfa: '', widthDots: 0, heightDots: 0, error: 'createScaledBitmap 失败' }
		}
	}

	// 7. 逐像素读取并二值化 → ZPL 十六进制
	// 关键：判断 alpha 通道 + R 通道，透明判白，不透明且偏黑才判黑
	// 用 >>> 无符号右移提取 alpha，避免有符号右移的负数问题
	const bytesPerRow = Math.ceil(width / 8)
	let hex = ''
	let blackCount = 0
	let whiteCount = 0
	let getPixelFailCount = 0
	let getPixelFirstError = ''
	for (let y = 0; y < height; y++) {
		const row = new Array(bytesPerRow).fill(0)
		for (let x = 0; x < width; x++) {
			let rawPixel
			try {
				rawPixel = inv(bitmap, 'getPixel', x, y)
			} catch (e) {
				getPixelFailCount++
				if (!getPixelFirstError) getPixelFirstError = 'throw: ' + e.message
				whiteCount++
				continue
			}
			const pixel = toNum(rawPixel)
			if (isNaN(pixel)) {
				getPixelFailCount++
				if (!getPixelFirstError) getPixelFirstError = 'toNum NaN: ' + typeof rawPixel
				whiteCount++
				continue
			}
			const alpha = (pixel >>> 24) & 0xFF
			const r = (pixel >> 16) & 0xFF
			if (alpha > 127 && r < 128) {
				row[Math.floor(x / 8)] |= (0x80 >> (x % 8))
				blackCount++
			} else {
				whiteCount++
			}
		}
		for (let b = 0; b < row.length; b++) {
			hex += row[b].toString(16).padStart(2, '0').toUpperCase()
		}
	}

	dbg('bitmap', width + 'x' + height,
		'black=' + blackCount, 'white=' + whiteCount,
		'fails=' + getPixelFailCount, 'align=' + align)

	// 8. 回收 Bitmap
	try { inv(bitmap, 'recycle') } catch (e) {}

	const totalPixels = width * height
	if (blackCount === totalPixels) {
		dbgErr('全黑位图，走降级')
		return { gfa: '', widthDots: 0, heightDots: 0, error: '全黑位图' }
	}
	if (blackCount === 0) {
		dbgErr('全白位图，drawText 未生效，走降级')
		return { gfa: '', widthDots: 0, heightDots: 0, error: 'drawText 未生效' }
	}
	if (getPixelFailCount > totalPixels * 0.5) {
		dbgErr('getPixel 大量失败 ' + getPixelFailCount + '/' + totalPixels + '，firstErr=' + getPixelFirstError)
		return { gfa: '', widthDots: 0, heightDots: 0, error: 'getPixel 失败过多: ' + getPixelFirstError }
	}

	const totalBytes = bytesPerRow * height
	return {
		gfa: `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hex}`,
		widthDots: width,
		heightDots: height
	}
}

// 判断当前环境是否支持位图渲染
export function isBitmapSupported() {
	try {
		return typeof plus !== 'undefined' && plus.os && plus.os.name.toLowerCase() === 'android'
	} catch (e) {
		return false
	}
}
