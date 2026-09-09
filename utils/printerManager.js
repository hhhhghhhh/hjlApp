// utils/printerManager.js
// 多指令集打印机的统一入口。
//
// 使用方式：
//   import printer from '@/utils/printerManager.js'
//   await printer.connect('AABBCCDDEEFF', 'IB-PTM7330', 'ibptm7330')
//   await printer.printTest()
//
// 设计原则：
//   - 连接时按协议创建对应 Adapter
//   - Adapter 封装具体指令集（ZPL/ESC-POS）
//   - 本模块保持单例，页面间共享连接

import conn from './printerConnection.js'
import { createAdapter, PROTOCOLS, PROTOCOL_OPTIONS, detectProtocolByName } from './printerAdapter.js'

const PROTOCOL_KEY = 'printer_protocol'

// 按打印机（MAC 地址）记忆其指令集，与机型解耦。
const protoKeyForAddress = (addr) => 'printer_protocol_' + String(addr || '').toUpperCase()
function loadProtocolForAddress(addr) {
	const v = uni.getStorageSync(protoKeyForAddress(addr))
	return v || ''
}
function saveProtocolForAddress(addr, proto) {
	if (!addr) return
	uni.setStorageSync(protoKeyForAddress(addr), proto)
}

let adapter = null
let protocol = null

// 根据协议名创建并缓存 Adapter
async function ensureAdapter(proto) {
	if (adapter && protocol === proto) return adapter
	adapter = await createAdapter(proto)
	protocol = proto
	return adapter
}

function loadProtocol() {
	return uni.getStorageSync(PROTOCOL_KEY) || PROTOCOLS.ZEBRA
}

function saveProtocol(proto) {
	uni.setStorageSync(PROTOCOL_KEY, proto)
}

// 对外统一 API
export default {
	// 协议选项，供设置页下拉
	PROTOCOLS,
	protocolOptions: PROTOCOL_OPTIONS,
	// 已知机型 → 指令集 的默认映射（无 MAC 记忆时首次连接用）
	detectProtocolByName,

	// 蓝牙连接层直接方法（与 zebraPrinter.js 兼容）
	assertAndroid: conn.assertAndroid,
	requestPermissions: conn.requestPermissions,
	isBluetoothEnabled: conn.isBluetoothEnabled,
	enableBluetooth: conn.enableBluetooth,
	openBluetoothSettings: conn.openBluetoothSettings,
	normalizeAddress: conn.normalizeAddress,
	getPairedDevices: conn.getPairedDevices,
	loadPrinter: conn.loadPrinter,
	savePrinter: conn.savePrinter,
	clearPrinter() {
		uni.removeStorageSync(PROTOCOL_KEY)
		conn.savePrinter(null)
	},

	// 连接。proto 即"指令集"，由用户在设置页选择（按打印机记忆）。
	// 不传时：优先用这台打印机记住的指令集，否则用全局上一次选择；不再按蓝牙名强匹配。
	async connect(address, name, proto) {
		let p = proto
		if (!p) {
			p = loadProtocolForAddress(address) || loadProtocol()
		}
		const inst = await ensureAdapter(p)
		const cur = await inst.connect(address, name)
		saveProtocol(p)                     // 全局：上一次手动选择的指令集
		saveProtocolForAddress(address, p)  // 按打印机记忆
		// 把本台打印机记为默认，便于业务页自动回连
		conn.savePrinter({ address: cur.address || name || address, name: cur.name || name || address })
		return cur
	},

	disconnect() {
		if (protocol === PROTOCOLS.LPAPI && adapter) {
			try { adapter.disconnect() } catch (e) { console.log('[printerManager] lpapi disconnect ignored:', e.message) }
		} else {
			conn.disconnect()
		}
		adapter = null
		protocol = null
	},

	isConnected() {
		if (protocol === PROTOCOLS.LPAPI && adapter) {
			return adapter.isConnected()
		}
		return conn.isConnected()
	},

	getCurrentPrinter() {
		if (protocol === PROTOCOLS.LPAPI && adapter) {
			return { address: adapter.printerName, name: adapter.printerName, verified: adapter.isConnected(), lpapi: true }
		}
		return conn.getCurrentPrinter()
	},

	getProtocol() {
		return protocol || loadProtocol()
	},

	setProtocol(proto) {
		saveProtocol(proto)
	},

	// 按打印机（MAC 地址）读写记住的指令集
	getProtocolForAddress(addr) {
		return loadProtocolForAddress(addr)
	},

	saveProtocolForAddress(addr, proto) {
		saveProtocolForAddress(addr, proto)
	},

	// 兼容：直接发送原始指令（Zebra 专用）
	sendRaw(text, charset) {
		conn.ensureConnected()
		conn.sendRaw(text, charset)
	},

	sendZpl(zpl) {
		this.sendRaw(zpl, 'UTF-8')
	},

	// 代理到当前 Adapter
	async getStatus() {
		await this._ensureConnected()
		return adapter.getStatus()
	},

	async printTest() {
		await this._ensureConnected()
		return adapter.printTest()
	},

	// IB-PTM7330 三种测试：PDF位图 / TPCL标准指令 / ESC/POS标准指令
	// 这些是 ibptm7330Adapter 专属方法，ZebraAdapter/LpapiAdapter 未实现；加守卫避免误调时
	// "undefined is not a function" 崩溃，改为抛清晰错误。
	async printTestPdf() {
		await this._ensureConnected()
		if (!adapter || typeof adapter.printTestPdf !== 'function') throw new Error('当前协议不支持 PDF 位图测试（仅 IB-PTM7330 的 ESC/POS 适配器支持）')
		return adapter.printTestPdf()
	},

	async printTestTpcl() {
		await this._ensureConnected()
		if (!adapter || typeof adapter.printTestTpcl !== 'function') throw new Error('当前协议不支持 TPCL 测试（仅 IB-PTM7330 的 ESC/POS 适配器支持）')
		return adapter.printTestTpcl()
	},

	async printTestEsc() {
		await this._ensureConnected()
		if (!adapter || typeof adapter.printTestEsc !== 'function') throw new Error('当前协议不支持 ESC/POS 测试（仅 IB-PTM7330 的 ESC/POS 适配器支持）')
		return adapter.printTestEsc()
	},

	async printTestLpapi(widthMm, heightMm) {
		await this._ensureConnected()
		if (!adapter || typeof adapter.printTestLpapi !== 'function') throw new Error('当前协议不支持 LPAPI 测试（请选择 LPAPI 指令集）')
		return adapter.printTestLpapi(widthMm, heightMm)
	},

	async printTemplate(tpl, data) {
		await this._ensureConnected()
		return adapter.printTemplate(tpl, data)
	},

	// 写入页面尺寸 / 介质校准：按当前协议分派。
	// ZPL：发送 ^LL/^JU（连续纸定长 / 间隙纸 ~JC 校准）。
	// LPAPI：打印一张按模板尺寸的校准标签（LPAPI 无独立校准指令，尺寸在每次 startJob 时传入）。
	async applyMedia(tpl) {
		await this._ensureConnected()
		return adapter.applyMedia(tpl)
	},

	async printText(text, opts) {
		await this._ensureConnected()
		return adapter.printText(text, opts)
	},

	// 内部：未连接时自动连默认打印机
	async _ensureConnected() {
		// LPAPI 自己管理连接
		if (protocol === PROTOCOLS.LPAPI && adapter && adapter.isConnected()) return
		if (conn.isConnected() && adapter) return
		const saved = conn.loadPrinter()
		if (!saved || !saved.address) {
			throw new Error('未设置默认打印机，请先到「蓝牙打印」页面连接并设为默认')
		}
		// 用这台打印机记住的指令集自动回连（不再按蓝牙名强制推断）
		const p = loadProtocolForAddress(saved.address) || this.getProtocol()
		await this.connect(saved.address, saved.name, p)
		// connect 返回 {verified} 但不抛错：若实际没连上（如手机关机/不在范围，errCode 10002），
		// 继续打印会让 SDK 对断开的打印机提交任务，返回 statusCode:3 且出纸空白。
		// 这里连完再确认一次，未连上就明确报错，避免"以为打出去了其实没打"的静默失败。
		const ok = adapter && typeof adapter.isConnected === 'function' && adapter.isConnected()
		if (!ok) {
			throw new Error('打印机连接失败：请确认打印机已开机、电量充足且在 PDA 蓝牙范围内，然后重试')
		}
	},

	// 业务页面入口：未连接时自动用 saved 打印机连接，然后发送 ZPL/指令。
	// 兼容旧 zebraPrinter.js 的 printWithSaved。
	async printWithSaved(zpl) {
		await this._ensureConnected()
		this.sendRaw(zpl, 'UTF-8')
	},

	async clearBuffer() {
		if (!adapter) return
		return adapter.clearBuffer()
	},

	async calibrate() {
		if (!adapter) return
		return adapter.calibrate()
	},

	async queryFonts() {
		if (!adapter) throw new Error('未连接打印机')
		return adapter.queryFonts()
	},

	async listPrinterFonts() {
		const res = await this.queryFonts()
		if (!res.ok) throw new Error(res.message)
		return res.fonts || []
	},

	async listTtfFonts() {
		if (!adapter || typeof adapter.queryTtfFonts !== 'function') throw new Error('当前协议不支持 TTF 字体查询')
		const res = await adapter.queryTtfFonts()
		if (!res.ok) throw new Error(res.message)
		return res.fonts || []
	},

	async checkCjkFont() {
		if (!adapter || typeof adapter.checkCjkFont !== 'function') {
			console.log('[printerManager] 当前协议不支持中文字体检测')
			return null
		}
		return adapter.checkCjkFont()
	},

	// 字体检测（Zebra 专用；ESC/POS 机型恒为 true）
	hasCjkFont() {
		return adapter ? adapter.hasCjkFont() : false
	},

	hasTtfFont() {
		return adapter ? adapter.hasTtfFont() : false
	},

	getCjkFontPath() {
		return adapter ? adapter.getCjkFontPath() : 'E:HANS.TTF'
	},

	// 当前连接打印机的真实分辨率（dpi）。模板本身不再记录 dpi，一律以连接打印机的实际值为准：
	// Zebra 适配器连接后查询 device.dpi（默认 203），LPAPI 适配器取 getPrinterInfo().printerDPI（实测 300），
	// IB-PTM7330 固定 300。未连接时为 null。
	getPrinterDpi() {
		if (!adapter) return null
		if (typeof adapter.printerDpi === 'number') return adapter.printerDpi
		if (typeof adapter.dpi === 'number') return adapter.dpi
		return null
	},

	// 强制 TTF（Zebra 专用）
	setForceTtf(on) {
		uni.setStorageSync('force_ttf_font', on === true)
		if (adapter && typeof adapter.setForceTtf === 'function') {
			adapter.setForceTtf(on)
		}
	},

	getForceTtf() {
		return uni.getStorageSync('force_ttf_font') === true
	},

	// LPAPI 全局水平偏移微调量（mm）：一次设置，所有 LPAPI 打印入口通用（模板/测试页/文本/校准）。
	// 正=右移、负=左移；0/空=不额外微调（落点由打印机自身对齐方式决定：右对齐/居中/左对齐，见 getPrinterAlignment）。
	// 注意：这是叠加在 printerAlignment 自动基线之上的【delta】，与对齐无关，方向恒为"正=右移"。
	getOffsetDelta() {
		const n = Number(uni.getStorageSync('lpapi_offset_delta'))
		return isNaN(n) ? 0 : n
	},

	setOffsetDelta(v) {
		uni.setStorageSync('lpapi_offset_delta', v)
	},

	// LPAPI 全局垂直偏移微调量（mm）：与水平对称，一次设置所有 LPAPI 打印入口通用。
	// 正=下移、负=上移；0/空=不微调。叠加在标签默认贴顶位置之上，用于纠正打印头上下机械偏差。
	getOffsetDeltaY() {
		const n = Number(uni.getStorageSync('lpapi_offset_delta_y'))
		return isNaN(n) ? 0 : n
	},

	setOffsetDeltaY(v) {
		uni.setStorageSync('lpapi_offset_delta_y', v)
	},

	// 当前连接 LPAPI 打印机的对齐方式（0=R0 右对齐 / 2=C2 居中 / 4=L4 左对齐）。
	// 由适配器连接时从 getPrinterInfo().softwareFlags 派生（见 lpapiAdapter._refreshMediaInfo）。
	// 未连 LPAPI / 未连接 / 非 LPAPI 协议返回 null。供打印页把"水平偏移"提示自适应成对应用方式。
	getPrinterAlignment() {
		if (protocol !== PROTOCOLS.LPAPI || !adapter) return null
		if (typeof adapter.printerAlignment === 'number') return adapter.printerAlignment
		return null
	},

	// Zebra 专用：打印测试（保持兼容）
	async printZplTest() {
		if (!adapter || typeof adapter.printTest !== 'function') throw new Error('当前协议不支持 ZPL 测试')
		return adapter.printTest()
	},

	// Zebra 专用：语言查询/切换（保持兼容）
	async queryLanguage() {
		if (!adapter || typeof adapter.queryLanguage !== 'function') {
			throw new Error('当前协议不支持语言查询')
		}
		return adapter.queryLanguage()
	},

	async setLanguage(lang) {
		if (!adapter || typeof adapter.setLanguage !== 'function') {
			throw new Error('当前协议不支持语言切换')
		}
		return adapter.setLanguage(lang)
	}
}
