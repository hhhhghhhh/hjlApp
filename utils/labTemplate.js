// utils/labTemplate.js
// 把 CSPrintService 解析 CodeSoft .Lab 得到的 pdaTemplate 转成本机的 zplTemplate 结构。
//
// 数据契约（对方 LabModels.cs 的 PdaTemplate / PdaElement）：
//   位置和尺寸都是毫米，旋转是十进制角度，字号是 pt，占位符是 {{varName}}。
//   xMm/yMm 是「定位基点」的坐标，基点是元素框九宫格里的哪一点由 anchor 字段说明，
//   没有 anchor 就是左上角。换算成 ^FO 要的左上角是在 zplTemplate.js 生成指令时做的，
//   那时候才知道条码这次实际有多宽 —— 所以这里要把 anchor 和设计框宽高一起带下去。
// 二维码有两种：
//   离线码 = gzip + base64 的紧凑 JSON，上限 2331 字节；
//   回连码 = 明文 JSON {ws, cmd:"ParseLab", labelFile, view}，由 PDA 自己连回去取最新结果。

// pako 3.x 是纯 ESM，只导出命名成员（ungzip/inflate/...），没有 default 导出。
// 用命名空间导入，避免 `import pako from 'pako'` 在 ESM 构建下拿到 undefined 而 pako.ungzip 报错。
import * as pako from 'pako'
import { ANCHORS, MEDIA_TYPES, QR_ECC } from './zplTemplate.js'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// CodeSoft 的条码类型比模板引擎支持的多，这里只列能对上的，其余在转换时降级成 Code 128
const SYMBOLOGY = {
	code128: 'code128',
	ean128: 'code128',
	gs1128: 'code128',
	'gs1-128': 'code128',
	uccean128: 'code128',
	code39: 'code39',
	code39full: 'code39',
	ean13: 'ean13'
}

// CS 靠 is2D 决定 type，读不到时会当成一维条码传过来。
// 这些码降级成 Code 128 会得到一个数据对但又宽又长的条码，压到别的元素上，不如直接跳过。
const TWO_D = ['datamatrix', 'pdf417', 'micropdf417', 'aztec', 'maxicode', 'qrcode', 'microqr']

const SKIP_REASON = {
	barcode2d: 'DataMatrix / PDF417 这类二维码模板引擎还不支持',
	ellipse: '椭圆多数便携条码机画不出来',
	image: '图片要先转成点阵，模板引擎暂不支持'
}

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// App-plus 的 JS 引擎不保证有 atob，自己解
function base64ToBytes(b64) {
	const s = String(b64).replace(/\s/g, '').replace(/=+$/, '')
	const out = new Uint8Array(Math.floor((s.length * 3) / 4))
	let acc = 0
	let bits = 0
	let p = 0
	for (let i = 0; i < s.length; i++) {
		const v = B64.indexOf(s.charAt(i))
		if (v < 0) throw new Error('第 ' + (i + 1) + ' 个字符 "' + s.charAt(i) + '" 不是合法的 base64 字符')
		acc = (acc << 6) | v
		bits += 6
		if (bits >= 8) {
			bits -= 8
			out[p++] = (acc >> bits) & 0xff
			acc &= (1 << bits) - 1
		}
	}
	return out.subarray(0, p)
}

// pako 3 起 {to:'string'} 不再生效（会静默返回字节），TextDecoder 在 App-plus 里也不保证有，所以自己解 UTF-8
function bytesToString(bytes) {
	let out = ''
	const buf = []
	for (let i = 0; i < bytes.length; ) {
		const b = bytes[i]
		let cp
		if (b < 0x80) {
			cp = b
			i += 1
		} else if (b < 0xe0) {
			cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)
			i += 2
		} else if (b < 0xf0) {
			cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
			i += 3
		} else {
			cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f)
			i += 4
		}
		if (cp > 0xffff) {
			cp -= 0x10000
			buf.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
		} else {
			buf.push(cp)
		}
		// 一次 apply 传太多参数会爆栈，分批拼
		if (buf.length >= 4096) {
			out += String.fromCharCode.apply(null, buf)
			buf.length = 0
		}
	}
	return out + String.fromCharCode.apply(null, buf)
}

// 可能拿到 LabParseResult 本身、WS 回包的 {success,message,result}，或整层 {command,payload}
function pickResult(obj) {
	if (!obj || typeof obj !== 'object') return null
	if (obj.pdaTemplate || obj.detail) return obj
	if (obj.result && typeof obj.result === 'object' && (obj.result.pdaTemplate || obj.result.detail)) {
		return obj.result
	}
	if (typeof obj.payload === 'string') {
		try {
			return pickResult(JSON.parse(obj.payload))
		} catch (e) {
			return null
		}
	}
	return null
}

function fromObject(obj) {
	if (!obj || typeof obj !== 'object') throw new Error('内容不是一个 JSON 对象')
	if (obj.cmd === 'ParseLab') {
		if (!obj.ws) throw new Error('这是回连二维码，但里面没有 ws 地址')
		return {
			kind: 'online',
			ws: obj.ws,
			labelFile: obj.labelFile || '',
			view: obj.view || 'pdaTemplate'
		}
	}
	const result = pickResult(obj)
	if (!result) {
		throw new Error('内容里找不到解析结果，请先在 CSPrintService 里解析模板再生成二维码')
	}
	return { kind: 'result', result }
}

/**
 * 识别扫码或粘贴进来的内容。返回 {kind:'online',...} 或 {kind:'result', result}
 */
export function decodePayload(raw) {
	const text = String(raw == null ? '' : raw).trim()
	if (!text) throw new Error('内容为空')

	if (text.charAt(0) === '{') {
		let obj
		try {
			obj = JSON.parse(text)
		} catch (e) {
			throw new Error('内容像 JSON 但解析失败：' + (e.message || e))
		}
		return fromObject(obj)
	}

	let json
	try {
		json = bytesToString(pako.ungzip(base64ToBytes(text)))
	} catch (e) {
		// 输入框不写 maxlength 就是 140，扫码头按键模式下的离线码正好死在这里
		const cut = text.length === 140 ? '（长度刚好 140，几乎肯定是被输入框截断了，请改用「扫码导入」按钮）' : ''
		throw new Error('内容既不是 JSON，也不是离线码的 gzip+base64' + cut + '：' + (e.message || e))
	}
	try {
		return fromObject(JSON.parse(json))
	} catch (e) {
		if (e.message && e.message.indexOf('JSON') === 0) throw e
		throw new Error('解压成功但内容不是合法 JSON：' + (e.message || e))
	}
}

/**
 * 回连码走这里：连上 CSPrintService 发 ParseLab 取最新解析结果。
 * 回包是双层的，外层 {command, payload}，payload 本身又是一段 JSON 字符串。
 */
export function fetchViaWs(ws, labelFile, timeout = 8000) {
	return new Promise((resolve, reject) => {
		let settled = false
		const task = uni.connectSocket({ url: ws, complete: () => {} })

		const finish = (err, data) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			try {
				task.close()
			} catch (e) {
				// 已经断了就不用管
			}
			err ? reject(err) : resolve(data)
		}

		const timer = setTimeout(() => {
			finish(new Error('连接 ' + ws + ' 超时。PDA 要和跑 CodeSoft 的那台电脑在同一网段，且 CSPrintService 正在运行'))
		}, timeout)

		task.onOpen(() => {
			task.send({
				data: JSON.stringify({
					command: 'ParseLab',
					payload: JSON.stringify({ labelFile, view: 'pdaTemplate' })
				})
			})
		})

		task.onError((e) => finish(new Error('连不上 ' + ws + (e && e.errMsg ? '：' + e.errMsg : ''))))
		task.onClose(() => finish(new Error('服务端关闭了连接，没有收到解析结果')))

		task.onMessage((res) => {
			let env
			try {
				env = JSON.parse(res.data)
			} catch (e) {
				return
			}
			if (!env || env.command !== 'ParseLabReply') return

			let inner
			try {
				inner = typeof env.payload === 'string' ? JSON.parse(env.payload) : env.payload
			} catch (e) {
				return finish(new Error('回包 payload 不是合法 JSON'))
			}
			if (!inner) return finish(new Error('回包是空的'))
			if (inner.success === false) return finish(new Error(inner.message || '服务端解析失败'))
			if (!inner.result) return finish(new Error('回包里没有 result'))
			finish(null, inner.result)
		})
	})
}

function elementLabel(el) {
	const content = String(el.text || el.data || '').slice(0, 14)
	return el.type + (content ? ' "' + content + '"' : '')
}

function degToRotation(deg) {
	const d = (((Math.round(Number(deg) || 0) % 360) + 360) % 360)
	const snapped = (Math.round(d / 90) * 90) % 360
	return { rotation: { 0: 'N', 90: 'R', 180: 'I', 270: 'B' }[snapped], snapped, exact: d === snapped }
}

// 服务端只在基点不是左上角时才给 anchor，认不出的值按左上角处理
function anchorOf(el, label, warn) {
	if (!el.anchor) return null
	if (ANCHORS.some((a) => a.value === el.anchor)) {
		return el.anchor === 'topLeft' ? null : el.anchor
	}
	warn(label + ' 的定位基点 "' + el.anchor + '" 认不出来，已按左上角处理，位置可能偏移')
	return null
}

function convertElement(el, warn) {
	const label = elementLabel(el)
	const rot = degToRotation(el.rotation)
	if (!rot.exact) {
		warn(label + ' 旋转 ' + el.rotation + '° 不是 90° 的整数倍，已按 ' + rot.snapped + '° 处理')
	}
	const x = round2(el.xMm)
	const y = round2(el.yMm)
	const anchor = anchorOf(el, label, warn)
	const withAnchor = (out) => {
		if (anchor) out.anchor = anchor
		return out
	}
	// 设计框：基点换算要用它反推左上角。文本还兼作 ^FB 的行宽
	const frameW = Number(el.widthMm) > 0 ? round2(el.widthMm) : 0
	const frameH = Number(el.heightMm) > 0 ? round2(el.heightMm) : 0

	if (el.type === 'text') {
		// 字号统一转成毫米存入中性模型（与打印机 dpi 无关，渲染时再按实际 dpi 折算成点）
		const mm = Number(el.fontHeightMm) || (Number(el.fontSizePt) ? (Number(el.fontSizePt) * 25.4) / 72 : 0)
		if (!mm) warn(label + ' 读不到字号，已按 3mm 高处理')
		const h = Math.max(0.5, round2(mm || 3))
		const out = { type: 'text', x, y, fontH: h, fontW: h, rotation: rot.rotation, text: el.text || '' }
		// ^FB 需要知道行宽才能居中/右对齐
		if ((el.align === 'center' || el.align === 'right') && frameW > 0) out.align = el.align
		if (frameW > 0) out.width = frameW
		if (frameH > 0) out.height = frameH
		return withAnchor(out)
	}

	if (el.type === 'qrcode') {
		// 二维码模块尺寸（毫米）存入中性模型：ZPL 渲染时按打印机 dpi 折算成放大倍数，
		// LPAPI 直接用 width/height 框定尺寸。不再存写死的 magnification。
		const modMm = Number(el.moduleWidthMm) > 0 ? el.moduleWidthMm : 0.51
		const out = {
			type: 'qrcode',
			x,
			y,
			rotation: rot.rotation,
			moduleWidthMm: modMm,
			ecc: QR_ECC.indexOf(el.ec) === -1 ? 'M' : el.ec,
			data: el.data || ''
		}
		if (frameW > 0) out.width = frameW
		if (frameH > 0) out.height = frameH
		return withAnchor(out)
	}

	if (el.type === 'barcode') {
		const subtype = String(el.subtype || '').toLowerCase()
		const codeType = SYMBOLOGY[subtype]
		if (!codeType && TWO_D.indexOf(subtype) !== -1) {
			warn('已跳过 ' + label + '：' + subtype + ' 是二维码，模板引擎只支持 QR')
			return null
		}
		if (!codeType) {
			warn('条码 ' + label + ' 的类型是 ' + (el.subtype || '未知') + '，模板引擎不支持，已降级成 Code 128，请核对能不能扫出来')
		}
		// 新版服务端把净条高单列在 barHeightMm，heightMm 是含可读字符的整框；
		// 老版本只有 heightMm 且它就是条高 —— PDA 是装好的 APK，两边版本一定会错开
		const hasFrame = Number(el.barHeightMm) > 0
		const out = {
			type: 'barcode',
			x,
			y,
			rotation: rot.rotation,
			codeType: codeType || 'code128',
			heightMm: round2(hasFrame ? el.barHeightMm : el.heightMm) || 10,
			moduleWidth: Number(el.moduleWidthMm) > 0 ? el.moduleWidthMm : 0.2,
			showText: el.showText !== false,
			textAbove: el.textPosition === 'above',
			data: el.data || ''
		}
		// 只有拿得到净条高时 heightMm 才是整框；否则不给 height，让渲染时按条高 + 字符行估
		if (hasFrame && frameH > 0) out.height = frameH
		return withAnchor(out)
	}

	// CodeSoft 的线和矩形都用 ^GB 画：高为 0 是横线，宽为 0 是竖线。
	// pdaTemplate 用 'rectangle'，detail 归一化后用 'rect'/'line'，三种写法都要接住。
	// 关键：横线(height≈0)必须映射成中性模型的 'line'，否则 LPAPI 渲染器按 box 处理会因
	// h<=0 直接跳过（ZPL 的 ^GB w,0 能画，LPAPI 的 drawRectangle 画不了）→ 横线在 LPAPI 下丢失。
	if (el.type === 'line' || el.type === 'rect' || el.type === 'rectangle') {
		const w = round2(el.widthMm)
		const h = round2(el.heightMm)
		const thickness = Number(el.thicknessMm) > 0 ? el.thicknessMm : 0.3
		// 横线：宽>0 且高=0（或缺失）
		if (w > 0 && h <= 0) {
			return withAnchor({ type: 'line', x, y, width: w, thickness })
		}
		// 竖线：高>0 且宽=0 → 降级为极窄矩形（ZPL/LPAPI 都没有原生竖线，用窄框近似）
		if (h > 0 && w <= 0) {
			return withAnchor({ type: 'box', x, y, width: Math.max(thickness, 0.3), height: h, thickness })
		}
		return withAnchor({ type: 'box', x, y, width: w, height: h, thickness })
	}

	warn('已跳过 ' + label + '：' + (SKIP_REASON[el.type] || '类型 ' + el.type + ' 无法转换'))
	return null
}

/**
 * pdaTemplate / detail -> 本机中性模板结构。返回 {template, warnings}
 * 同时兼容 CSPrintService 输出的两种格式：
 *   - pdaTemplate：CodeSoft 的精简派生视图（字段名已贴近本机元素模型）
 *   - detail：LabDetail 全量解析结果（含 label 页信息、variables、objects）
 * 两者都可能是 LabParseResult 的顶层字段；也兼容直接传入 pdaTemplate 对象。
 *
 * rawInput 是扫码/粘贴进来的原始二维码串（离线码 gzip+base64 或回连码 JSON），
 * 一并存进 template.source，便于追溯与按需重解析。
 */
export function toZplTemplate(input, rawInput) {
	if (!input || typeof input !== 'object') {
		throw new Error('解析结果不是合法对象')
	}
	// 整个 LabParseResult（含 pdaTemplate / detail 任一顶层字段）
	if (input.detail || input.pdaTemplate) {
		const r = input
		const csWarns = Array.isArray(r.warnings) ? r.warnings.slice() : []
		// 优先用 detail（用户明确：detail 信息最全，是 .Lab 的忠实反映）；
		// 仅当没有 detail 时才用 pdaTemplate（服务端为 PDA 整理的精简视图）。
		if (r.detail) return convertDetail(r.detail, rawInput, csWarns)
		if (r.pdaTemplate) return convertPdaTemplate(r.pdaTemplate, rawInput, csWarns)
	}
	// 直接传进来的 pdaTemplate 对象（离线码解码路径 / 旧调用）
	return convertPdaTemplate(input, rawInput, [])
}

/**
 * pdaTemplate -> 本机中性模板结构。
 * csWarnings 是 CSPrintService 在 result.warnings 里给的转换提示，一并带出。
 */
function convertPdaTemplate(pdaTemplate, rawInput, csWarnings) {
	if (!pdaTemplate) {
		throw new Error('这份解析结果里没有 pdaTemplate。请在 CSPrintService 把格式切成 pdaTemplate 再生成二维码')
	}
	const warnings = (csWarnings || []).slice()
	const warn = (m) => warnings.push(m)

	let mediaType = pdaTemplate.mediaType
	if (MEDIA_TYPES.findIndex((m) => m.value === mediaType) === -1) {
		warn('.Lab 里没有明确记录纸张类型（读到 ' + (pdaTemplate.mediaType || '空') + '），已按间隙纸处理。实际是黑标纸或连续纸的话要到模板页改掉，否则标签长度会不对')
		mediaType = 'gap'
	}

	const elements = []
	const source = pdaTemplate.elements || []
	source.forEach((el) => {
		const out = convertElement(el, warn)
		if (out) elements.push(out)
	})

	if (elements.length === 0) warn('转换后一个元素都不剩，这个模板印出来是空白的')
	if (source.some((e) => Number(e.rotation))) {
		warn('模板里有旋转元素。CodeSoft 和 ZPL 对旋转方向的定义可能相反，第一次打印请核对方向')
	}

	const computed = pdaTemplate.computedVariables || []
	if (computed.length > 0) {
		warn('这些变量是 CodeSoft 自己算出来的（' + computed.map((v) => v.name + '/' + v.dataSource).join('、') + '），PDA 取不到值，会印成空白')
	}

	return {
		warnings,
		template: {
			id: 'tpl_' + Date.now(),
			name: pdaTemplate.name || 'CodeSoft 模板',
			page: {
				widthMm: round2(pdaTemplate.widthMm),
				heightMm: round2(pdaTemplate.heightMm),
				mediaType
			},
			// CodeSoft 不记录打印浓度/速度/走纸模式，沿用本机默认值
			print: { darkness: 15, speed: 4, copies: 1, invert180: false, mode: 'T' },
			cjkFont: 'E:HANS.TTF',
			source: {
				from: 'codesoft',
				labFile: pdaTemplate.name || '',
				importedAt: new Date().toLocaleString(),
				variables: (pdaTemplate.variables || []).slice(),
				computedVariables: computed.map((v) => v.name),
				// 原始数据：离线码/回连码的原始串 + 解码后的 pdaTemplate，按需可追溯/重解析
				rawQr: rawInput || '',
				raw: pdaTemplate
			},
			elements
		}
	}
}

// detail.objects 的定位基点名（anchorPointName）是帕斯卡命名，转成中性模型的 anchor 值
const ANCHOR_DETAIL_MAP = {
	TopLeft: 'topLeft', TopCenter: 'topCenter', TopRight: 'topRight',
	CenterLeft: 'centerLeft', Center: 'center', CenterRight: 'centerRight',
	BottomLeft: 'bottomLeft', BottomCenter: 'bottomCenter', BottomRight: 'bottomRight'
}

// 把 LabDetail 的一个 object 归一成 convertElement 期望的元素字段形状（与 pdaTemplate.elements 对齐），
// 之后直接复用 convertElement，避免两套解析逻辑。返回 null 表示类型不支持、需跳过。
function normalizeDetailObject(obj) {
	const typeName = String(obj.typeName || '').trim().toLowerCase()
	const is2D = obj.is2D === true
	let type = null
	if (typeName === 'text') type = 'text'
	else if (typeName === 'barcode') type = is2D ? 'qrcode' : 'barcode'
	else if (typeName === 'qrcode') type = 'qrcode'
	else if (typeName === 'line') type = 'line'
	else if (typeName === 'rectangle' || typeName === 'box' || typeName === 'roundrect') type = 'rect'
	if (!type) return null

	const out = {
		type,
		xMm: obj.xMm,
		yMm: obj.yMm,
		widthMm: obj.widthMm,
		heightMm: obj.heightMm,
		rotation: obj.rotationDeg != null ? obj.rotationDeg : 0
	}
	const anchor = ANCHOR_DETAIL_MAP[obj.anchorPointName]
	if (anchor) out.anchor = anchor

	if (type === 'text') {
		out.text = obj.template != null ? obj.template : (obj.raw != null ? obj.raw : '')
		if (obj.font) {
			out.fontSizePt = obj.font.sizePt
			out.bold = !!obj.font.bold
			out.italic = !!obj.font.italic
		}
		if (obj.alignmentName) out.align = obj.alignmentName.toLowerCase()
	} else if (type === 'qrcode') {
		out.data = obj.template != null ? obj.template : ''
		out.ec = obj.ecc || 'M'
		// 模块尺寸（毫米）存入中性模型，渲染时再按打印机 dpi 折算；
		// ZPL 用它算放大倍数，LPAPI 直接用 width/height 框定尺寸。
		const modMm = Number(obj.moduleXMm) > 0 ? obj.moduleXMm : 0.51
		out.moduleWidthMm = modMm
		out.width = obj.widthMm
		out.height = obj.heightMm
	} else if (type === 'barcode') {
		out.data = obj.template != null ? obj.template : ''
		out.subtype = String(obj.symbologyName || '').toLowerCase() || 'code128'
		out.moduleWidthMm = obj.narrowBarWidthMm || 0.2
		out.barHeightMm = obj.barHeightMm || obj.heightMm || 10
		out.showText = obj.hrPosition !== 0 && obj.hrPositionName !== 'none'
	} else if (type === 'line' || type === 'rect') {
		// 注意：detail 的线宽字段是 lineWidthMm（LabObject），不是 pdaTemplate 的 thicknessMm。
		// 若错读 thicknessMm 会恒为 undefined，永远回落到 0.3mm，丢掉真实线宽。
		out.thicknessMm = Number(obj.lineWidthMm) > 0 ? obj.lineWidthMm : 0.3
	}
	return out
}

/**
 * detail(LabDetail 全量) -> 本机中性模板结构。
 * 与 convertPdaTemplate 的区别：detail 含大量"页面/纸张排版"设置，这些设置若原样带入模板，
 * 会让实际打印尺寸/对齐与模板设计稿不一致（典型就是用户说的"页边距信息导致打印偏移"）。
 * 因此只保留关键页信息（实际可打印区域 widthMm/heightMm + mediaType），其余全部剥离：
 *   pageWidthMm / pageHeightMm / marginLeftMm / marginTopMm / horizontalGapMm / verticalGapMm /
 *   columns / rows / portrait / stockName / stockType
 * detail 没有单独的设计 dpi 字段；templatePrinter.dpiX(600) 是 Windows 那台 PDF 打印机的分辨率，
 * 与 PDA 打印机无关。物理尺寸是 mm，中性模型全部以毫米存储，渲染时由对应适配器
 * 按打印机真实 dpi 折算（ZPL 折算成点，LPAPI 直接以 mm 绘制）——模板本身不再记录任何 dpi。
 */
function convertDetail(detail, rawInput, csWarnings) {
	const warnings = (csWarnings || []).slice()
	const warn = (m) => warnings.push(m)
	const label = detail.label || {}

	let mediaType = label.mediaType
	if (MEDIA_TYPES.findIndex((m) => m.value === mediaType) === -1) {
		warn('detail.label 没有明确记录纸张类型（读到 ' + (label.mediaType || '空') + '），已按间隙纸处理。实际是黑标/连续纸要到模板页改')
		mediaType = 'gap'
	}
	const widthMm = round2(label.widthMm)
	const heightMm = round2(label.heightMm)
	if (!widthMm || !heightMm) warn('detail.label 没有可用的标签尺寸，模板可能打印异常')

	const elements = []
	;(detail.objects || []).forEach((obj) => {
		const tname = String(obj.typeName || '').trim().toLowerCase()
		// 与 CSPrintService PdaTemplateMapper 一致：printable===false 的对象不打印，直接跳过
		if (obj.printable === false) {
			warn('对象 ' + (obj.name || tname || obj.type) + ' 标记为不打印，已跳过')
			return
		}
		// 圆角矩形 COM 读不到圆角半径，按普通矩形输出（与 PdaTemplateMapper case 9 一致）
		if (tname === 'roundrect') {
			warn('对象 ' + (obj.name || 'roundrect') + ' 是圆角矩形，COM 读不到圆角半径，已按普通矩形输出')
		}
		const norm = normalizeDetailObject(obj)
		if (!norm) {
			warn('已跳过对象 ' + (obj.name || tname || obj.type) + '：暂不支持的类型 ' + (obj.typeName || obj.type))
			return
		}
		const out = convertElement(norm, warn)
		if (out) elements.push(out)
	})

	if (elements.length === 0) warn('转换后一个元素都不剩，这个模板印出来是空白的')
	if ((detail.objects || []).some((e) => Number(e.rotationDeg))) {
		warn('模板里有旋转元素。CodeSoft 和 LPAPI 对旋转方向的定义可能相反，第一次打印请核对方向')
	}

	// 变量：只保留关键字段 name。
	// computed = 模板自己算、PDA 取不到值的变量。只有 Free(5)/Form(6) 是用户能填的，
	// 其余（Counter/1、TableLookup/2、Date/3、Formula/4、DataBase/7）都算 computed ——
	// 与 CSPrintService PdaTemplateMapper.IsUserInput 完全一致。
	const isUserInput = (ds) => ds === 5 || ds === 6
	const variables = (detail.variables || []).map((v) => v.name)
	const computed = (detail.variables || [])
		.filter((v) => !isUserInput(v.dataSource))
		.map((v) => v.name)
	if (computed.length > 0) {
		warn('这些变量是 CodeSoft 自己算出来的（' + computed.join('、') + '），PDA 取不到值，会印成空白')
	}

	const name = String(detail.file || 'CodeSoft 模板').replace(/\.lab$/i, '')

	return {
		warnings,
		template: {
			id: 'tpl_' + Date.now(),
			name,
		page: { widthMm, heightMm, mediaType },
		print: { darkness: 15, speed: 4, copies: 1, invert180: false, mode: 'T' },
			cjkFont: 'E:HANS.TTF',
			source: {
				from: 'codesoft',
				labFile: detail.file || '',
				importedAt: new Date().toLocaleString(),
				variables,
				computedVariables: computed,
				rawQr: rawInput || '',
				raw: detail
			},
			elements
		}
	}
}

/**
 * 模板里实际用到的 {{变量}}，用于打印前核对数据里有没有这些字段
 */
export function templateVariables(tpl) {
	const found = []
	;(tpl.elements || []).forEach((el) => {
		const text = String(el.text == null ? '' : el.text) + '\n' + String(el.data == null ? '' : el.data)
		text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
			if (found.indexOf(key) === -1) found.push(key)
			return ''
		})
	})
	return found
}
