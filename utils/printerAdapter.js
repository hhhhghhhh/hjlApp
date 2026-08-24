// utils/printerAdapter.js
// 打印机指令集适配器基类与工厂。
//
// 设计原则：指令集与打印机型号解耦，按打印机 MAC 记忆。
//   - 用户可手动选择指令集（页面只展示 LPAPI / ZPL 两种），也可由"已知机型默认映射"自动选定；
//   - 选定后 App 按该打印机的 MAC 记忆，下次再点它就自动套用。
// 实际支持的指令集：LPAPI、ZPL（ZebraAdapter），以及保留在代码里的 ESC/POS/TPCL/PDF
// （ibptm7330Adapter 承载，作为不可见后备能力，不在设置页出现）。
// 新增指令集时：继承 PrinterAdapter 实现具体适配器，并在 FACTORY 中注册。

import conn from './printerConnection.js'

export const PROTOCOLS = {
	ZEBRA: 'zebra',
	IBPTM7330: 'ibptm7330', // 内部：BLE 标签机适配器承载 esc/tpcl/pdf 三种指令集
	LPAPI: 'lpapi',
	ESC: 'esc',
	TPCL: 'tpcl',
	PDF: 'pdf'
}

// 设置页可见的指令集选项（中性标签，不含厂商名）。用户按打印机选择并记忆。
export const PROTOCOL_OPTIONS = [
	{ value: PROTOCOLS.LPAPI, label: 'LPAPI 指令集' },
	{ value: PROTOCOLS.ZEBRA, label: 'ZPL 指令集' }
]

// 已知机型 → 指令集 的默认映射（仅用于"首次连接、无 MAC 记忆"时自动预选，不强制路由）。
// IB-PTM7330 / DT-270 / PTM230X 系列走 LPAPI；Zebra 走 ZPL。
const KNOWN_PROTOCOL_BY_NAME = [
	{ re: /ZEBRA|ZQ|ZD|ZT|QLN|IMZ|ZR|RW|MZ/i, proto: PROTOCOLS.ZEBRA },
	{ re: /IB-PTM|PTM7330|IBPTM|PTM|PTM230X|DT7330|DT-?270|DETONG|德佟|DOTHAN|LPAPI/i, proto: PROTOCOLS.LPAPI }
]

// 默认标签尺寸 50x30mm @ 300dpi，供 IB-PTM7330 等以位图方式打印的机型使用。
// 注：厂家《IB-PTM7330 基本参数》表明确标注"打印密度 300dpi"，以参数表为准。
export const DEFAULT_LABEL = {
	widthMm: 50,
	heightMm: 30,
	dpi: 300 // 300 dpi（厂家参数表）
}

// 已知机型 → 指令集 默认映射。仅在"该 MAC 尚无记忆"时用于首次自动预选，
// 用户随后可手动改；记忆一旦写入就优先于这个映射。
export function detectProtocolByName(name) {
	const n = String(name || '').toUpperCase()
	for (const item of KNOWN_PROTOCOL_BY_NAME) {
		if (item.re.test(n)) return item.proto
	}
	return null
}

// 通用适配器接口
export class PrinterAdapter {
	constructor(protocol) {
		this.protocol = protocol
		this.name = '未知打印机'
		this.connectionType = 'spp' // 默认经典蓝牙 SPP；BLE 适配器覆写为 'ble'
	}

	// ----- 蓝牙连接（默认直接复用 printerConnection） -----
	async connect(address, name) {
		const cur = await conn.connect(address, name, this.connectionType)
		this.name = cur.name || name || ''
		// 基类默认连接即验证通过；ZebraAdapter 等会覆写做实际状态查询
		cur.verified = true
		return cur
	}

	disconnect() {
		conn.disconnect()
	}

	isConnected() {
		return conn.isConnected()
	}

	getCurrentPrinter() {
		return conn.getCurrentPrinter()
	}

	// ----- 必须由子类实现 ----- 
	// 返回 Promise<{ ok: boolean, message?: string }>
	async getStatus() { throw new Error('子类必须实现 getStatus') }

	// 打印测试页
	async printTest() { throw new Error('子类必须实现 printTest') }

	// 根据模板 + 数据打印标签
	async printTemplate(tpl, data = {}) { throw new Error('子类必须实现 printTemplate') }

	// 打印一段纯文本（简单场景）
	async printText(text, opts = {}) { throw new Error('子类必须实现 printText') }

	// 查询字体（如支持）
	async queryFonts() { return { ok: false, message: '该机型不支持字体查询' } }

	// 清除缓存
	async clearBuffer() { /* 默认空实现 */ }

	// 介质校准
	async calibrate() { /* 默认空实现 */ }

	// 中文字体相关（ESC/POS 机型通常不需要，通过 Android Canvas 渲染位图）
	hasCjkFont() { return false }
	hasTtfFont() { return false }
	getCjkFontPath() { return '' }

	// 是否支持模板中各元素
	supportsElement(type) {
		const supported = {
			[PROTOCOLS.ZEBRA]: ['text', 'qrcode', 'barcode', 'line', 'box'],
			[PROTOCOLS.IBPTM7330]: ['text', 'qrcode', 'barcode', 'line', 'box'],
			[PROTOCOLS.ESC]: ['text', 'qrcode', 'barcode', 'line', 'box'],
			[PROTOCOLS.TPCL]: ['text', 'qrcode', 'barcode', 'line', 'box'],
			[PROTOCOLS.PDF]: ['text', 'qrcode', 'barcode', 'line', 'box']
		}
		return (supported[this.protocol] || []).includes(type)
	}
}

// 工厂：按协议创建适配器
const FACTORY = {
	[PROTOCOLS.ZEBRA]: () => import('./adapters/zebraAdapter.js').then((m) => m.default || m.ZebraAdapter),
	[PROTOCOLS.LPAPI]: () => import('./adapters/lpapiAdapter.js').then((m) => m.default || m.LpapiAdapter),
	[PROTOCOLS.ESC]: () => import('./adapters/ibptm7330Adapter.js').then((m) => m.default || m.Ibptm7330Adapter),
	[PROTOCOLS.TPCL]: () => import('./adapters/ibptm7330Adapter.js').then((m) => m.default || m.Ibptm7330Adapter),
	[PROTOCOLS.PDF]: () => import('./adapters/ibptm7330Adapter.js').then((m) => m.default || m.Ibptm7330Adapter),
	// 兼容旧 'ibptm7330' 字符串
	[PROTOCOLS.IBPTM7330]: () => import('./adapters/ibptm7330Adapter.js').then((m) => m.default || m.Ibptm7330Adapter)
}

export async function createAdapter(protocol) {
	const p = protocol || PROTOCOLS.ZEBRA
	const loader = FACTORY[p]
	if (!loader) throw new Error('不支持的打印协议: ' + p)
	const AdapterClass = await loader()
	return new AdapterClass()
}

export default { PROTOCOLS, PROTOCOL_OPTIONS, DEFAULT_LABEL, detectProtocolByName, PrinterAdapter, createAdapter }
