// utils/adapters/lpapiAdapter.js
// 道臻 dothan-lpapi-ble 标签打印适配器（DT-7330 / GL30 / IB-PTM7330 等道臻系列）。
//
// 协议：dothan-lpapi-ble（Canvas 绘制 + uni BLE 下发）。道佟官方 LPAPI 封装。
// 连接方式：该 SDK 自行管理 BLE（openAdapter / openPrinter），不走 printerConnection。
// 绘制方式（与官方示例一致）：
//   startJob({context, width, height, orientation, isPreview})
//     -> drawText / draw1DBarcode / draw2DQRCode / drawRectangle / drawLine
//     -> commitJob({ gapType, printDarkness, printSpeed })
//   绘制基于页面隐藏 canvas（canvas-id 见 lpapi-uniplugin.CANVAS_ID，必须 type="2d"），所见即所得。
//
// 安装：见 utils/lpapi-uniplugin.js。该插件是 uni_modules JS 插件，标准基座即可运行。

import { PrinterAdapter, DEFAULT_LABEL, PROTOCOLS } from '../printerAdapter.js'
import lpapiPlugin, { emitCanvasSize } from '../lpapi-uniplugin.js'
import { renderTemplateToLpapi } from '../lpapiTemplate.js'

// 关于两条"看似报错"的日志（实测控制台已确认）：
//  1) "当前绘制环境不支持函数：getImageData" —— 良性告警，不是 bug。
//     dothan-lpapi-ble 的 commitJob 先尝试 context.getImageData（uni 的 2d canvas 没有提供），
//     拿不到就自动回退到 uni.canvasGetImageData（日志随后会出现 "uni.canvasGetImageData Response.success"），
//     取像素正常，打印不受影响。SDK 内部日志无法消除，无需处理。
//  2) "createBLEConnection:fail no device errCode 10002" —— 这才是真问题（打印机没连上）。
//     已通过 connect() 的蓝牙预检 + 重试 + isPrinterOpened() 校验解决；连不上时直接抛清晰中文错误，
//     不再"以为连上了实则出纸空白"。

const TAG = '[LpapiAdapter]'
const CANVAS_ID = 'lpapi-canvas'

// 全局水平偏移微调量（mm）：一次设置、所有 LPAPI 打印入口通用（模板打印/测试页/文本/校准），
// 避免"每个模板都要单独填一次水平偏移"。正=右移、负=左移，用于纠正打印头固定机械偏差。
// 模板 page.offsetXMm 仍有最高优先级（向后兼容、个别模板特调时用）。
const OFFSET_DELTA_KEY = 'lpapi_offset_delta'
function loadOffsetDelta() {
	const n = Number(uni.getStorageSync(OFFSET_DELTA_KEY))
	return isNaN(n) ? 0 : n
}
function saveOffsetDelta(v) {
	uni.setStorageSync(OFFSET_DELTA_KEY, v)
}

// 全局垂直偏移微调量（mm）：与水平偏移对称，一次设置所有 LPAPI 打印入口通用。
// 正=下移（y 增大）、负=上移；0/空=不微调。垂直方向无打印机对齐基线（标签垂直起点由纸张类型定），
// 故纯为手动 delta，叠加在标签默认贴顶位置之上，用于纠正打印头上下机械偏差。
const OFFSET_DELTA_Y_KEY = 'lpapi_offset_delta_y'
function loadOffsetDeltaY() {
	const n = Number(uni.getStorageSync(OFFSET_DELTA_Y_KEY))
	return isNaN(n) ? 0 : n
}
function saveOffsetDeltaY(v) {
	uni.setStorageSync(OFFSET_DELTA_Y_KEY, v)
}

// 从加载层取 LPAPI 单例（插件未导入时抛清晰错误）。
function loadLpapi() {
	const api = lpapiPlugin.getLPAPI ? lpapiPlugin.getLPAPI() : null
	if (!api) {
		throw new Error('dothan-lpapi-ble 插件未安装：请先在 DCloud 插件市场导入 dothan-lpapi-ble（uni_modules JS 插件，标准基座即可）。')
	}
	return api
}

// 确保已创建绘制上下文（页面渲染的隐藏 canvas）。
// 2d canvas 在 onLoad 时可能还没 ready，这里重试若干次（每次等 150ms），
// 与官方示例在 openAdapter().then 里再 createDrawContext 的时序对齐。
async function ensureDrawContext() {
	let ctx = lpapiPlugin.getDrawContext ? lpapiPlugin.getDrawContext() : null
	for (let i = 0; i < 8 && !ctx; i++) {
		// 用当前激活的 canvas-id 重新建上下文（页面 onLoad 时 canvas 节点可能还没 ready，
		// 这里兜底重建；initDrawContext 内部已按 id 回落，调用方无需传参）。
		const id = lpapiPlugin.getActiveCanvasId ? lpapiPlugin.getActiveCanvasId() : CANVAS_ID
		ctx = lpapiPlugin.initDrawContext ? lpapiPlugin.initDrawContext(id) : null
		if (!ctx && i < 7) await delay(150)
	}
	if (!ctx) {
		throw new Error('LPAPI 绘制上下文创建失败：请确认打印页已渲染隐藏 canvas（需 type="2d"，且 canvas-id 唯一）。')
	}
	return ctx
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)) }

// commitJob 参数严格按官方示例：gapType / printDarkness / printSpeed
//   gapType:     2=不干胶(标签纸，靠传感器量间隙) / 255=随打印机自身设置
//   printDarkness: 6~15（越大越浓）
//   printSpeed:  1~5（3=正常）
// gapType 跟随模板纸张类型：连续纸没有间隙，打印机按 startJob 传入的 height 定长走纸，
// 用 255（跟随打印机设置）更稳；间隙/黑标纸用 2，让打印机走传感器量到的间隙。
function gapTypeForMedia(mediaType) {
	return mediaType === 'continuous' ? 255 : 2
}

function buildCommitOpts(opts) {
	const o = opts || {}
	return {
		gapType: o.gapType !== undefined
			? o.gapType
			: (o.mediaType !== undefined ? gapTypeForMedia(o.mediaType) : 2),
		printDarkness: o.printDarkness !== undefined ? o.printDarkness : 10,
		printSpeed: o.printSpeed !== undefined ? o.printSpeed : 3,
		// 二值化模式：2=COLOR_MODE_BLACK_WHITE。务必显式设置！否则 SDK 把 canvas 灰阶原样下发，
		// 打印发虚/灰蒙蒙（"完全不清晰"）。与 startJob 的 colorMode 双重保险。
		colorMode: o.colorMode !== undefined ? o.colorMode : 2,
		// 二值化阈值（0~255，SDK 默认 150）：亮度高于此值判白、低于判黑。150 是 SDK 默认值，
		// 显式写出避免依赖隐式默认。偏细/偏淡的字体可调低(如 128)让笔画更粗，太脏可调高(如 180)。
		threshold: o.threshold !== undefined ? o.threshold : 150,
		// 份数：SDK 内部读 jobOptions.printCopies / copies，>1 时循环打印。默认 1。
		printCopies: o.printCopies !== undefined ? o.printCopies : 1
	}
}

// 打印头可打印宽度（mm）：printerWidth(点) / dpi * 25.4。
// 道臻 DT7330/IB-PTM7330 实测 printerWidth=960 点 @300dpi ≈ 81.3mm（比 50mm 标签宽，标签居中贴介质）。
function printableMmOf(printerWidth, dpi) {
	const w = Number(printerWidth) || 0
	const d = Number(dpi) || 0
	if (!w || !d) return 0
	return w / d * 25.4
}

// 内容整体右移量（mm）：把窄于打印头的标签居中到【打印头可打印区】上，补偿 LPAPI 把
// job 画布贴在打印头最左端下发导致的左偏。
//   - 自动居中：offset = (打印头宽 - 标签宽)/2，随模板/纸宽自动重算。
//   - tpl.page.offsetXMm / 全局偏移微调 是【delta】（正=右移、负=左移），叠加在自动居中上，
//     用于纠正打印头的固定机械偏差。换不同尺寸纸时自动居中随尺寸重算、delta 固定不变。
	// 关键（实测结论）：偏移基准是【打印头宽 printerWidth 实测值】，不是介质宽 paperWidth，也绝不写死旧机 81.3mm。
	//   本机 PTM230X 实测 48.8mm；若用介质宽(paperWidth)算会明显偏右。对齐方式(printerAlignment)以蓝牙连接读到为准
	//   （PTM230X 读到 0=右对齐），故本机 offset=(printableMm - labelW)，与日志 offsetX≈28.77 一致。
function computeOffsetX(printerWidth, dpi, labelWmm, tpl, paperWidthMm, alignment) {
	const labelW = Number(labelWmm) || 0
	if (labelW <= 0) return 0
	// 居中基准 = 打印头可打印宽度（不再用介质宽 paperWidthMm，见上注释）。
	const printableMm = printableMmOf(printerWidth, dpi)
	// 按打印机对齐方式(printerAlignment)决定内容在打印头画布上的水平落点：
	//   0=R0 右对齐：标签贴打印头最右端 → offset = printableMm - labelW（内容整体右移贴右）；
	//   4=L4 左对齐：标签贴最左端 → offset = 0；
	//   2=C2 居中：offset = (printableMm - labelW)/2（部分机型用，本机 PTM230X 走右对齐分支）。
	const a = Number(alignment)
	let off = 0
	if (printableMm > 0) {
		if (a === 0) off = printableMm - labelW
		else if (a === 4) off = 0
		else off = (printableMm - labelW) / 2
	}
	// 微调量 delta：优先模板 page.offsetXMm（个别模板特调），否则用全局偏移微调（打印设置页设一次，
	// 所有 LPAPI 打印通用）。这样换模板/换纸都不用重填，测试页、文本打印也能吃到同一微调值。
	let delta = NaN
	if (tpl && tpl.page && tpl.page.offsetXMm !== undefined && tpl.page.offsetXMm !== null && String(tpl.page.offsetXMm).trim() !== '') {
		delta = Number(tpl.page.offsetXMm)
	} else {
		delta = loadOffsetDelta()
	}
	if (isFinite(delta)) off += delta
	return off > 0 ? off : 0
}

// 内容整体下移量（mm）：垂直方向无打印机对齐基线（标签垂直起点由纸张类型定），
// 故偏移纯为手动 delta：优先模板 page.offsetYMm（个别模板特调），否则用全局垂直偏移微调。
// 正=下移、负=上移。与水平对称为同一套叠加模式（computeOffsetX 叠加在 alignment 自动基线上，
// 这里直接叠加在默认贴顶的 0 基线上）。
function computeOffsetY(tpl) {
	let delta = NaN
	if (tpl && tpl.page && tpl.page.offsetYMm !== undefined && tpl.page.offsetYMm !== null && String(tpl.page.offsetYMm).trim() !== '') {
		delta = Number(tpl.page.offsetYMm)
	} else {
		delta = loadOffsetDeltaY()
	}
	return isFinite(delta) ? delta : 0
}

// commitJob 返回的 ret 内含 UniContext（context 自引用，循环结构），绝不能 JSON.stringify，
// 统一抽成安全纯对象返回给上层，避免任何调用方序列化时抛 "Converting circular structure to JSON"。
function safeRet(ret) {
	return {
		statusCode: ret && ret.statusCode,
		errMsg: ret && ret.errMsg,
		previewData: (ret && ret.previewData) || []
	}
}

// commitJob 状态码：0=OK，非 0 一律视为失败（如 3=连接断开）。失败时抛出明确错误，
// 避免"出纸空白却只提示指令已发出"的误导（与官方示例 statusCode===0 才判成功一致）。
function throwIfPrintFailed(ret, action) {
	const sc = ret && ret.statusCode
	if (sc === undefined || sc === 0) return
	throw new Error((action || '打印') + '失败：' + (ret && ret.errMsg ? ret.errMsg : ('状态码 ' + sc)))
}

export class LpapiAdapter extends PrinterAdapter {
	constructor() {
		super(PROTOCOLS.LPAPI)
		this.connectionType = 'lpapi'
		// 道臻系列实测 300dpi（控制台日志 printerDPI:300）。模板里字号/线宽等以"点"存储，
		// 渲染时按设计 dpi 还原成 mm（与打印机无关）——但若点值缺省没记录设计 dpi，则回落到
		// 打印机实际 dpi（300），而不是写死的 203。故这里默认 300，连接后还会用 getPrinterInfo 校正。
		this.printerDpi = 300
		// 打印头实测可打印宽度（点）。本机【PTM230X】实测 printerWidth=576 点 @300dpi ≈ 48.8mm
		// （不是旧机型 IB-PTM7330 的 960 点/81.3mm）。具体值以蓝牙连接 getPrinterInfo().printerWidth
		// 读到的为准（见 _refreshMediaInfo），下方 960 仅为「未读到时的兜底」，非真实值。
		// LPAPI 把整张 job 画布贴在打印头最左端（x=0）下发，故需按打印机对齐方式(printerAlignment)
		// 把内容整体右移 offsetX（见 computeOffsetX）补偿到正确位置（PTM230X 为右对齐）。
		this.printerWidth = 960
		this.paperWidth = 0
		// 打印机对齐方式：0=R0 右对齐 / 2=C2 居中 / 4=L4 左对齐（由 softwareFlags 派生，见 _refreshMediaInfo）。
		// 本机【PTM230X】实测 softwareFlags=0xd0 → 派生为 0=右对齐(R0)，连接后覆盖下方默认值。
		// 一切以蓝牙连接时读到的为准；未连接时默认 2=居中仅作兜底。
		this.printerAlignment = 2
		this.label = { widthMm: DEFAULT_LABEL.widthMm, heightMm: DEFAULT_LABEL.heightMm }
		this.name = ''
		this.printerName = ''
	}

	setLabelSize(widthMm, heightMm) {
		this.label = {
			widthMm: widthMm || DEFAULT_LABEL.widthMm,
			heightMm: heightMm || DEFAULT_LABEL.heightMm
		}
	}

	// LPAPI 用 SDK 自行管理 BLE（openAdapter -> openPrinter），连接即按 MAC（deviceId）/蓝牙名打开打印机。
	// 连接稳定性加固（针对实测日志里反复出现的 createBLEConnection:fail no device errCode 10002）：
	//  ① 连前先确保蓝牙适配器已就绪，未开/未授权直接给清晰提示，避免盲目建连报 10002；
	//  ② openPrinter 失败时带"重置适配器"重试（清掉上次残留的 BLE 连接状态），缓解偶发断连；
	//  ③ 连完后用 isPrinterOpened() 二次确认，未真正连上即抛明确错误，杜绝"连上了却出纸空白"的静默失败。
	async connect(address, name) {
		const lpapi = loadLpapi()
		this.name = name || address || 'LPAPI'
		this.printerName = this.name

		// ① 确保蓝牙适配器已开启（蓝牙未开 / 权限被拒时 openAdapter 会返回非 0，直接给出引导）
		let adapterOk = false
		try {
			const ar = await lpapi.openAdapter({ force: true })
			adapterOk = ar && ar.statusCode === 0
		} catch (e) {
			console.warn(TAG, 'openAdapter 失败:', e.message)
		}
		if (!adapterOk) {
			throw new Error('蓝牙适配器未就绪：请先在系统设置中打开手机蓝牙，并授予本应用"蓝牙/附近设备"权限，然后重试连接。')
		}

		// ② 带重试地打开打印机（相邻失败重置适配器再试，缓解 10002 偶发断连）
		let res = null
		const MAX = 3
		for (let attempt = 1; attempt <= MAX; attempt++) {
			try {
				if (attempt > 1) {
					// 重置适配器清掉上次残留的 BLE 连接状态，再重新初始化
					try { await lpapi.closeAdapter() } catch (e) { /* 忽略关闭异常 */ }
					await lpapi.openAdapter({ force: true })
				}
				res = await lpapi.openPrinter({ name: this.name, deviceId: address, tryTimes: 5 })
				if (res && res.statusCode === 0) break
				console.warn(TAG, 'openPrinter 第', attempt, '次未成功，statusCode:', res && res.statusCode)
			} catch (e) {
				console.warn(TAG, 'openPrinter 第', attempt, '次异常:', e.message)
			}
			await delay(500) // 等 BLE 状态回落再重试
		}

		const ok = res && res.statusCode === 0
		if (!ok) {
			throw new Error('打印机连接失败（未发现设备 / errCode 10002）：请确认打印机已开机、处于蓝牙配对/可连接模式（指示灯闪烁），且在 PDA 蓝牙范围内，然后重试。')
		}

		// ③ 二次确认：openPrinter 返回成功但 BLE 未必真正建立，用 isPrinterOpened 兜底
		let reallyOpen = ok
		try { reallyOpen = lpapi.isPrinterOpened ? lpapi.isPrinterOpened() : true } catch (e) { reallyOpen = false }
		if (!reallyOpen) {
			throw new Error('打印机连接未真正建立（状态查询无响应）：可能蓝牙通道不稳，请重试连接。')
		}

		// 读取打印机真实分辨率/打印头宽/介质宽（换纸后也会重读，见 _refreshMediaInfo）。
		await this._refreshMediaInfo()
		return { address: this.name, name: this.name, verified: true, lpapi: true }
	}

	// 读取/刷新打印机介质信息：dpi、打印头宽（点）、物理介质宽（mm）。
	// 换不同宽度的纸后 paperWidth 会变，而它决定水平偏移 = (介质宽 - 标签宽)/2，
	// 所以「写入打印机并校准」入口会先调本方法重读，避免还用连接时的旧纸宽。
	async _refreshMediaInfo() {
		const lpapi = loadLpapi()
		try {
			const info = lpapi.getPrinterInfo && lpapi.getPrinterInfo()
			if (info && info.printerDPI) {
				this.printerDpi = Number(info.printerDPI) || 300
				console.log(TAG, '打印机实际 dpi:', this.printerDpi)
			}
			// 打印头可打印宽度（点）：标签比它窄且居中时使用，用来把 job 内容向右补偿居中。
			if (info && info.printerWidth) {
				this.printerWidth = Number(info.printerWidth) || 960  // 实测为准；960 仅兜底
				console.log(TAG, '打印机可打印宽度(点):', this.printerWidth)
			}
		// 物理介质宽（mm，SDK 返回的 paperWidth/pagerWidth 单位已是 mm，如 90 表示 90mm 底纸）。
		// 标签通常比介质窄且居中贴 → 正确水平偏移 = (介质宽 - 标签宽)/2。
		if (info && info.paperWidth) {
			this.paperWidth = Number(info.paperWidth) || 0
			console.log(TAG, '打印机物理介质宽(mm):', this.paperWidth)
		}
		// 对齐方式：0=R0 右对齐 / 2=C2 居中 / 4=L4 左对齐。决定内容在打印头画布上的水平落点
		// （见 computeOffsetX）。本机 PTM230X 实测 softwareFlags=0xd0 → 0=右对齐(R0)，以读到的为准。
		// 注意：getPrinterInfo() 返回的对象里【没有 printerAlignment 字段】，对齐方式藏在硬件
		// softwareFlags 寄存器里，SDK 内部用 (softwareFlags & 0x600) >> 8 计算（与下方一致）。
		// 故从 softwareFlags 派生，而不是直接读 printerAlignment（那样永远是 undefined → 走默认居中）。
		if (info && info.softwareFlags !== undefined && info.softwareFlags !== null) {
			const sf = Number(info.softwareFlags) || 0
			this.printerAlignment = (sf & 1536) >> 8   // 1536 = 0x600 = PRTA 两位掩码
			console.log(TAG, '打印机对齐方式(printerAlignment):', this.printerAlignment,
				this.printerAlignment === 0 ? '(R0 右对齐)' : this.printerAlignment === 4 ? '(L4 左对齐)' : '(C2 居中)',
				' [softwareFlags=0x' + sf.toString(16) + ']')
		}
		} catch (e) {
			console.log(TAG, '读取打印机介质信息失败，沿用上次值:', e.message)
		}
	}

	disconnect() {
		try { const lpapi = loadLpapi(); if (lpapi.closePrinter) lpapi.closePrinter() } catch (e) { console.log(TAG, 'closePrinter ignored', e.message) }
		try { const lpapi = loadLpapi(); if (lpapi.closeAdapter) lpapi.closeAdapter() } catch (e) { console.log(TAG, 'closeAdapter ignored', e.message) }
	}

	isConnected() {
		try { const lpapi = loadLpapi(); return lpapi.isPrinterOpened ? !!lpapi.isPrinterOpened() : false } catch (e) { return false }
	}

	async getStatus() {
		const ok = this.isConnected()
		let info = this.name || ''
		try { const lpapi = loadLpapi(); const p = lpapi.getPrinterInfo && lpapi.getPrinterInfo(); if (p && p.name) info = p.name } catch (e) {}
		return { ok, message: ok ? ('LPAPI 已连接: ' + info) : 'LPAPI 未连接', info }
	}

	async printTest() { return this.printTestLpapi() }

	// startJob 需要 context（来自页面隐藏 canvas 的绘制上下文），尺寸用 mm。
	// 不传 dpi：SDK 在打印机已连接时会从 getPrinterInfo().printerDPI 取真实分辨率（实测 300），
	// 由 SDK 统一负责位图尺寸，避免我们自己传入的值与 SDK 内部不一致。
	// 关键：startJob 之后必须把页面隐藏 canvas 的 :style 同步成任务像素尺寸（官方示例 updateCanvas 做法）。
	// 注意——绝不直接改 canvas 节点的 width/height 位图属性：SDK 在 startJob 内部已把页面 canvas
	// 节点位图设成任务像素尺寸，若我们再 node.width=w 会把 SDK 准备绘制/已绘制的位图清空，导致出纸空白。
	async _startJob(opts) {
		const lpapi = loadLpapi()
		const ctx = await ensureDrawContext()
		// 默认用模板/默认标签尺寸；传入 widthMm 时（如 LPAPI 需要铺满打印头宽度）以传入为准。
		const wMm = (opts && opts.widthMm != null) ? opts.widthMm : this.label.widthMm
		const hMm = (opts && opts.heightMm != null) ? opts.heightMm : this.label.heightMm
		const job = lpapi.startJob({
			context: ctx,
			width: wMm,
			height: hMm,
			orientation: (opts && opts.orientation) || 0,
			isPreview: false,
			// 关键：强制黑/白二值化（2=COLOR_MODE_BLACK_WHITE）。
			// SDK 的 imageProcess 在 colorMode 未设置(0)时走 `void 0` 分支，把 canvas 的
			// 抗锯齿灰阶像素【原样】发给打印机，导致打印出来发虚/灰蒙蒙（"完全不清晰"）。
			// 设成 2 后 SDK 会用 threshold 把位图二值化为纯黑/白，文字/条码立刻变锐利。
			colorMode: 2
		})
		// startJob 之后把页面隐藏 canvas 的 :style 同步成"任务像素尺寸"（官方 updateCanvas）。
		// 像素尺寸优先用 SDK 返回的 job.canvas（SDK 已据此把页面节点位图设好）；拿不到则按
		// 标签尺寸 + 打印机实测 dpi 自己算（仅用于 :style 显示尺寸，不改变节点位图）。
		let pxW = 0, pxH = 0
		if (job && job.canvas && job.canvas.width) {
			pxW = job.canvas.width
			pxH = job.canvas.height
		} else {
			pxW = Math.round(wMm * this.printerDpi / 25.4)
			pxH = Math.round(hMm * this.printerDpi / 25.4)
		}
		console.log(TAG, '_startJob 页面canvas像素: ', pxW + ' x ' + pxH, ' (jobW_mm=' + wMm.toFixed(1) + ')')
		await this._resizeCanvas(pxW, pxH)
		return job
	}

	// 把页面隐藏 canvas 的 :style（CSS 显示尺寸）同步成任务像素尺寸，与官方示例 updateCanvas 完全一致。
	// 只改 :style，绝不碰 node.width/height 位图——位图尺寸完全交给 SDK 在 startJob 内部管理，
	// 这样绘制落点与 commitJob 读取的位图始终是同一个、正确尺寸的缓冲，不会再出纸空白。
	async _resizeCanvas(w, h) {
		emitCanvasSize(w, h)
		// 等 :style 生效后再 draw（官方示例等 100ms，这里 120ms）
		await delay(120)
	}

	async printTestLpapi(widthMm, heightMm) {
		const lpapi = loadLpapi()
		// 允许调用方传入测试标签尺寸（打印设置页可填宽高）；缺省回落到默认标签（50x30）。
		const w = Number(widthMm) > 0 ? Number(widthMm) : this.label.widthMm
		const h = Number(heightMm) > 0 ? Number(heightMm) : this.label.heightMm
		// 测试页同样铺满打印头宽度，并按当前打印机对齐方式(printerAlignment)自适应落点，便于核对偏移。
		const printableMm = printableMmOf(this.printerWidth, this.printerDpi)
		const offsetX = computeOffsetX(this.printerWidth, this.printerDpi, w, null, this.paperWidth, this.printerAlignment)
		const offsetY = loadOffsetDeltaY() // 全局垂直微调：正=下移、负=上移
		const jobW = printableMm > 0 ? Math.max(printableMm, w) : w
		console.log(TAG, 'printTestLpapi', w + 'x' + h + 'mm, jobW:', jobW.toFixed(1), 'offsetX:', offsetX.toFixed(2), 'offsetY:', offsetY.toFixed(2), 'alignment:', this.printerAlignment)
		await this._startJob({ widthMm: jobW, heightMm: h })
		const ox = offsetX
		// 外框：始终贴合标签边界，便于核对落点是否正确（不随尺寸溢出）
		lpapi.drawRectangle({ x: 1 + ox, y: 1 + offsetY, width: Math.max(1, w - 2), height: Math.max(1, h - 2), lineWidth: 0.3 })
		// 二维码：右上角，尺寸随标签收敛（小标签也能放下）；便于扫码核对
		const qsz = Math.min(10, w - 3, h - 3)
		if (qsz >= 4) lpapi.draw2DQRCode({ text: 'DT7330', x: ox + w - qsz - 1, y: 1 + offsetY, width: qsz })
		// 标题：标注本次测试尺寸，便于回看
		lpapi.drawText({ text: 'LPAPI ' + w + 'x' + h + 'mm', x: 2 + ox, y: 2 + offsetY, width: Math.max(4, w - qsz - 4), height: 4, fontHeight: Math.min(4, h * 0.5) })
		// 第二行中文（仅当标签够高，避免小标签溢出）
		if (h >= 11) lpapi.drawText({ text: '中文：直流模块(TY)', x: 2 + ox, y: 7 + offsetY, width: Math.max(4, w - 4), height: 4, fontHeight: 3 })
		// 一维码（Code128=28；仅当标签够高，避免负高度）
		const drawBarcode = lpapi.draw1DBarcode || lpapi.drawBarcode
		if (drawBarcode && h >= 18) {
			drawBarcode.call(lpapi, { text: '1234567890', x: 2 + ox, y: 12 + offsetY, width: Math.max(4, w - 14), height: Math.min(8, h - 14), textHeight: 3, barcodeType: 28 })
		}
		const ret = safeRet(await lpapi.commitJob(buildCommitOpts()))
		// 注意：commitJob 返回的 ret 内含 UniContext（context 自引用，循环结构），
		// 切勿 JSON.stringify(ret)，否则抛 "Converting circular structure to JSON"。
		console.log(TAG, 'printTestLpapi commit ret statusCode:', ret && ret.statusCode, 'errMsg:', ret && ret.errMsg)
		throwIfPrintFailed(ret, '打印测试')
		return ret
	}

	async printText(text, opts = {}) {
		const lpapi = loadLpapi()
		const { widthMm, heightMm } = this.label
		const lines = String(text || '').split(/\r?\n/)
		const fontH = opts.fontHeight || 4
		const printableMm = printableMmOf(this.printerWidth, this.printerDpi)
		const offsetX = computeOffsetX(this.printerWidth, this.printerDpi, widthMm, null, this.paperWidth, this.printerAlignment)
		const offsetY = loadOffsetDeltaY() // 全局垂直微调：正=下移、负=上移
		const jobW = printableMm > 0 ? Math.max(printableMm, widthMm) : widthMm
		await this._startJob({ widthMm: jobW, heightMm })
		const ox = offsetX
		for (let i = 0; i < lines.length; i++) {
			lpapi.drawText({ text: lines[i], x: 2 + ox, y: 2 + offsetY + i * (fontH + 1), width: widthMm - 4, height: fontH, fontHeight: fontH })
		}
		const ret = safeRet(await lpapi.commitJob(buildCommitOpts(opts)))
		throwIfPrintFailed(ret, '打印文本')
		return ret
	}

	// ---------- 维护类（LPAPI 协议适配） ----------
	// LPAPI 是"按任务绘图 + 一次性 commitJob"模型，任务之间没有命令缓冲队列，
	// 因此没有 Zebra 那种"清除打印机缓存"的概念。这里返回说明性结果，不报错、不误导。
	async clearBuffer() {
		return { ok: true, message: 'LPAPI 为按任务绘图模式，任务间无指令缓存队列，无需清除' }
	}

	// 介质校准：LPAPI 没有 ^LL/^JU 这类 ZPL 校准指令，标签尺寸在每次 startJob 时
	// 按 width/height 传入即生效。这里的"校准"等价于打印一张当前尺寸的校准标签，
	// 让打印机走纸并测量间隙，验证尺寸/对齐。
	async calibrate(tpl) {
		return this._printCalibrationLabel(tpl)
	}

	// 模板页"写入打印机并校准"：对 LPAPI 同样是打印一张按模板尺寸的校准标签。
	async applyMedia(tpl) {
		return this._printCalibrationLabel(tpl)
	}

	// 对齐校准标签：在整张打印头宽度的画布上，画出 3 个候选标签框（偏移 0 / 居中 / 右对齐）
	// + 满宽刻度尺，用户打一张即可肉眼读出物理标签真正落在哪个水平偏移，再把「水平偏移」填进去。
	// 注意：此函数不应用 computeOffsetX（要画的是绝对位置参照），offset 全部以画布 0 点为基准。
	async _printCalibrationLabel(tpl) {
		const lpapi = loadLpapi()
		// 换纸后先重读介质信息（纸宽变了则水平偏移跟着变），再按当前尺寸打印校准标签。
		await this._refreshMediaInfo()
		const widthMm = (tpl && tpl.page) ? tpl.page.widthMm : this.label.widthMm
		const heightMm = (tpl && tpl.page) ? tpl.page.heightMm : this.label.heightMm
		const printableMm = printableMmOf(this.printerWidth, this.printerDpi)
		// 画布铺满打印头宽度，便于把候选框摆在绝对坐标上对照物理标签。
		const jobW = printableMm > 0 ? Math.max(printableMm, widthMm) : widthMm
		this.setLabelSize(widthMm, heightMm)
		await this._startJob({ widthMm: jobW, heightMm })
		const mid = (jobW - widthMm) / 2
		const right = jobW - widthMm
		// 满宽外框 + 每 5mm 一根竖刻度（x 从 0 到 jobW），用于定位标签左/右边缘。
		lpapi.drawRectangle({ x: 1, y: 1, width: jobW - 2, height: heightMm - 2, lineWidth: 0.3 })
		for (let x = 0; x <= jobW + 0.01; x += 5) {
			const xx = Math.min(x, jobW - 0.5)
			lpapi.drawLine({ x1: xx, y1: 1, x2: xx, y2: heightMm - 1, lineWidth: 0.12 })
		}
		// 三个候选标签框（粗线），各带文字标注所用偏移。
		const drawCandidate = (ox, label) => {
			lpapi.drawRectangle({ x: 1 + ox, y: 4, width: Math.max(1, widthMm - 2), height: Math.max(1, heightMm - 8), lineWidth: 0.6 })
			lpapi.drawText({ text: label, x: 2 + ox, y: heightMm - 6, width: widthMm - 4, height: 4, fontHeight: 3 })
		}
		drawCandidate(0, 'OFS=0')
		drawCandidate(mid, 'OFS=' + mid.toFixed(1))
		drawCandidate(right, 'OFS=' + right.toFixed(1))
		lpapi.drawText({ text: '校准尺 打印头宽=' + jobW.toFixed(1) + 'mm 标签=' + widthMm + 'mm', x: 2, y: 2, width: jobW - 4, height: 3, fontHeight: 2.6 })
		// gapType 跟随模板纸张类型（连续纸 255 / 间隙黑标纸 2），让打印机按正确方式走纸
		const mediaType = (tpl && tpl.page && tpl.page.mediaType) || 'gap'
		const ret = safeRet(await lpapi.commitJob(buildCommitOpts({ mediaType })))
		throwIfPrintFailed(ret, '校准标签')
		return ret
	}

	// 模板打印：消费"中性模板模型"（与打印机无关，单位 mm），由 lpapiTemplate 渲染器
	// 把每个元素映射成 LPAPI 的 draw 调用。startJob / commitJob 的生命周期由本 Adapter 管理。
	// 这样 LPAPI 与 ZPL 共用同一套中性模板（存 CodeSoft 原始数据 + source.raw），
	// 打印时按各自渲染器按需转换，互不耦合。
	async printTemplate(tpl, data = {}) {
		const lpapi = loadLpapi()
		const widthMm = tpl && tpl.page ? tpl.page.widthMm : this.label.widthMm
		const heightMm = tpl && tpl.page ? tpl.page.heightMm : this.label.heightMm
		// LPAPI 将整张 job 画布贴在打印头最左端下发，而标签通常比打印头窄且居中贴在介质上，
		// 故 job 画布要铺满打印头可打印宽度，并把内容右移 offsetX 才能对准物理标签。
		const printableMm = printableMmOf(this.printerWidth, this.printerDpi)
		const offsetX = computeOffsetX(this.printerWidth, this.printerDpi, widthMm, tpl, this.paperWidth, this.printerAlignment)
		const offsetY = computeOffsetY(tpl)
		const jobW = printableMm > 0 ? Math.max(printableMm, widthMm) : widthMm
		console.log(TAG, 'printTemplate', widthMm + 'x' + heightMm + 'mm, printableMm:', printableMm.toFixed(1),
			'offsetX(mm):', offsetX.toFixed(2), 'jobW(mm):', jobW.toFixed(1), 'elements:', (tpl && tpl.elements ? tpl.elements.length : 0))
		this.setLabelSize(widthMm, heightMm)
		await this._startJob({ widthMm: jobW, heightMm })

		// 变量填充 + 元素映射交给统一渲染器（与 buildZpl 一一对应：anchor 基点换算、变量填充）。
		// 传入打印机实测 dpi，使模板点值缺省时按真实分辨率（300）还原 mm，而不是写死的 203。
		// offsetXMm：把内容整体右移，补偿打印头比标签宽导致的左偏。
		const report = renderTemplateToLpapi(lpapi, tpl, data, this.printerDpi, { offsetXMm: offsetX, offsetYMm: offsetY })
		if (report.skipped.length || report.offLabel.length) {
			const tip = (report.skipped.length ? `跳过 ${report.skipped.length} 个空元素; ` : '') +
				(report.offLabel.length ? `${report.offLabel.length} 个元素超出标签范围(会被裁掉)` : '')
			console.warn(TAG, 'printTemplate 诊断:', tip, report)
		}

		// gapType 跟随模板纸张类型：连续纸 255（跟随打印机），间隙/黑标纸 2（传感器量间隙）
		const mediaType = (tpl && tpl.page && tpl.page.mediaType) || 'gap'
		// 份数：模板 print.copies，通过 commitJob 的 printCopies 让 SDK 循环打印（>=1）。
		const copies = Math.max(1, Math.round(Number((tpl && tpl.print && tpl.print.copies)) || 1))
		console.log(TAG, 'printTemplate 份数:', copies, 'mediaType:', mediaType)
		const ret = safeRet(await lpapi.commitJob(buildCommitOpts({ mediaType, printCopies: copies })))
		throwIfPrintFailed(ret, '模板打印')
		ret.drawn = report.drawn
		ret.skipped = report.skipped.length
		ret.offLabel = report.offLabel.length
		return ret
	}
}

export default LpapiAdapter
