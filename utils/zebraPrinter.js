// utils/zebraPrinter.js
// 向后兼容 shim —— 透明转发到 printerManager.js + printerConnection.js。
//
// 本模块原来包含蓝牙连接 + ZPL 发送 + 字体检测等全部逻辑，
// 现已拆分为：
//   - printerConnection.js  — 蓝牙 SPP 连接层
//   - printerManager.js     — 多指令集统一入口
//   - adapters/zebraAdapter.js  — Zebra ZPL 适配器
//
// 旧代码 `import printer from '@/utils/zebraPrinter.js'` 无需改动，
// 所有方法调用会透传到新架构，共享同一份蓝牙连接状态。

import printerManager from './printerManager.js'
import conn from './printerConnection.js'

export default {
	// 蓝牙基础（透传到 printerConnection）
	requestPermissions: conn.requestPermissions,
	isBluetoothEnabled: conn.isBluetoothEnabled,
	enableBluetooth: conn.enableBluetooth,
	openBluetoothSettings: conn.openBluetoothSettings,
	getPairedDevices: conn.getPairedDevices,
	normalizeAddress: conn.normalizeAddress,

	// 连接管理
	connect: (address, name) => printerManager.connect(address, name),
	disconnect: printerManager.disconnect,
	isConnected: printerManager.isConnected,
	getCurrentPrinter: printerManager.getCurrentPrinter,

	// 发送指令
	sendRaw: printerManager.sendRaw,
	sendZpl: printerManager.sendZpl,

	// 状态与维护
	getStatus: printerManager.getStatus,
	clearBuffer: printerManager.clearBuffer,
	calibrate: printerManager.calibrate,

	// 字体查询
	listPrinterFonts: printerManager.listPrinterFonts,
	listTtfFonts: printerManager.listTtfFonts,
	hasCjkFont: printerManager.hasCjkFont,
	checkCjkFont: printerManager.checkCjkFont,
	hasTtfFont: printerManager.hasTtfFont,
	checkTtfFont: () => printerManager.checkCjkFont(),
	setForceTtf: printerManager.setForceTtf,
	getForceTtf: printerManager.getForceTtf,
	getCjkFontPath: printerManager.getCjkFontPath,

	// 测试打印
	printZplTest: printerManager.printZplTest,
	buildZplTestLabel: () => '', // 已移至 ZebraAdapter 内部

	// 语言
	queryLanguage: printerManager.queryLanguage,
	setLanguage: printerManager.setLanguage,

	// 持久化
	savePrinter: conn.savePrinter,
	loadPrinter: conn.loadPrinter,
	clearPrinter: printerManager.clearPrinter,

	// 业务页面入口：自动连默认打印机并发送
	printWithSaved: printerManager.printWithSaved
}
