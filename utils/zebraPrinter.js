// utils/zebraPrinter.js
// 斑马打印机蓝牙(经典蓝牙 SPP)打印，纯 JS 实现，通过 plus.android 反射调用系统蓝牙 API。
// 不依赖任何原生插件，HBuilderX 标准基座即可运行。
//
// 打印机需先在「系统设置 - 蓝牙」中完成配对，本模块读取已配对设备列表。

const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB'
const STORAGE_KEY = 'zebra_printer'

let adapter = null
let socket = null
let outStream = null
let inStream = null
let current = null

const inv = (obj, method, ...args) => plus.android.invoke(obj, method, ...args)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function assertAndroid() {
	if (typeof plus === 'undefined') {
		throw new Error('请在 App 中运行，H5/小程序不支持经典蓝牙打印')
	}
	if (plus.os.name.toLowerCase() !== 'android') {
		throw new Error('当前仅支持 Android')
	}
}

function getAdapter() {
	assertAndroid()
	if (adapter) return adapter
	const BluetoothAdapter = plus.android.importClass('android.bluetooth.BluetoothAdapter')
	adapter = BluetoothAdapter.getDefaultAdapter()
	if (!adapter) throw new Error('本机不支持蓝牙')
	return adapter
}

// Android 12(API 31) 起连接已配对设备需要运行时授予 BLUETOOTH_CONNECT
function runtimePermissions() {
	const major = parseInt(plus.os.version, 10) || 0
	return major >= 12 ? ['android.permission.BLUETOOTH_CONNECT'] : []
}

function requestPermissions() {
	assertAndroid()
	const perms = runtimePermissions()
	if (perms.length === 0) return Promise.resolve()
	return new Promise((resolve, reject) => {
		plus.android.requestPermissions(
			perms,
			(res) => {
				if (res.deniedAlways && res.deniedAlways.length > 0) {
					reject(new Error('蓝牙权限已被永久拒绝，请到系统「应用权限」中手动开启「附近的设备」'))
				} else if (res.deniedPresent && res.deniedPresent.length > 0) {
					reject(new Error('未授予蓝牙权限，无法连接打印机'))
				} else {
					resolve()
				}
			},
			(err) => reject(new Error('权限请求失败: ' + (err && err.message)))
		)
	})
}

function isBluetoothEnabled() {
	try {
		return inv(getAdapter(), 'isEnabled')
	} catch (e) {
		return false
	}
}

function startActivityByAction(action) {
	const Intent = plus.android.importClass('android.content.Intent')
	const intent = new Intent(action)
	inv(plus.android.runtimeMainActivity(), 'startActivity', intent)
}

// 弹出系统「开启蓝牙」授权框
function enableBluetooth() {
	assertAndroid()
	startActivityByAction('android.bluetooth.adapter.action.REQUEST_ENABLE')
}

// 打开系统蓝牙设置页，用于配对新打印机
function openBluetoothSettings() {
	assertAndroid()
	startActivityByAction('android.settings.BLUETOOTH_SETTINGS')
}

// 打印机机身/电池仓下方贴的条码通常就是它的蓝牙 MAC，扫出来是不带分隔符的 12 位十六进制。
// Android 的 getRemoteDevice 只认「大写 + 冒号」这一种写法，别的形式会直接抛 IllegalArgumentException，
// 所以所有入口都先过这里归一化。扫码内容可能夹在一段更长的文本里，因此按模式提取而不是简单剔字符。
function normalizeAddress(raw) {
	const text = String(raw || '').toUpperCase()
	const hit = text.match(/([0-9A-F]{2}[:-]){5}[0-9A-F]{2}/) || text.match(/\b[0-9A-F]{12}\b/)
	if (!hit) return ''
	return hit[0].replace(/[^0-9A-F]/g, '').match(/.{2}/g).join(':')
}

const BOND_STATE = { 10: 'none', 11: 'bonding', 12: 'bonded' }

const PRINTER_NAME_HINT = /(zebra|^zq|^zd|^zt|^qln|^imz|^zr|^rw|^mz|printer)/i

// 读取系统已配对设备，疑似打印机的排在前面
function getPairedDevices() {
	const ad = getAdapter()
	if (!inv(ad, 'isEnabled')) throw new Error('蓝牙未开启')
	const bonded = inv(ad, 'getBondedDevices')
	const iterator = inv(bonded, 'iterator')
	const list = []
	while (inv(iterator, 'hasNext')) {
		const device = inv(iterator, 'next')
		const name = inv(device, 'getName') || ''
		list.push({
			name: name || '未命名设备',
			address: inv(device, 'getAddress'),
			maybePrinter: PRINTER_NAME_HINT.test(name)
		})
	}
	return list.sort((a, b) => Number(b.maybePrinter) - Number(a.maybePrinter))
}

function isConnected() {
	if (!socket) return false
	try {
		return inv(socket, 'isConnected')
	} catch (e) {
		return false
	}
}

function getCurrentPrinter() {
	return isConnected() ? current : null
}

function closeQuietly(obj) {
	if (!obj) return
	try {
		inv(obj, 'close')
	} catch (e) {}
}

function disconnect() {
	closeQuietly(outStream)
	closeQuietly(inStream)
	closeQuietly(socket)
	outStream = null
	inStream = null
	socket = null
	current = null
}

// 安全通道在部分手机上会被拒（尤其 Android 12+），非安全通道往往能连上，所以逐个试。
const SOCKET_FACTORIES = [
	{ method: 'createRfcommSocketToServiceRecord', label: '安全通道' },
	{ method: 'createInsecureRfcommSocketToServiceRecord', label: '非安全通道' }
]

// 连接打印机。socket.connect() 是阻塞调用，最长可能等待十几秒。
// address 接受 AABBCCDDEEFF / AA:BB:CC:DD:EE:FF 等写法；设备不在已配对列表里也能连，系统会弹配对框。
async function connect(address, name) {
	const addr = normalizeAddress(address)
	if (!addr) throw new Error('蓝牙地址不合法：' + address + '（应为 12 位十六进制，如 AABBCCDDEEFF）')

	await requestPermissions()
	disconnect()
	const ad = getAdapter()
	if (!inv(ad, 'isEnabled')) throw new Error('蓝牙未开启')

	await sleep(50) // 让调用方的 loading 先渲染出来，再进入阻塞调用
	const device = inv(ad, 'getRemoteDevice', addr)
	const UUID = plus.android.importClass('java.util.UUID')
	const uuid = UUID.fromString(SPP_UUID)

	const failures = []
	for (const way of SOCKET_FACTORIES) {
		let sock = null
		try {
			sock = inv(device, way.method, uuid)
			inv(sock, 'connect')
			socket = sock
			outStream = inv(sock, 'getOutputStream')
			inStream = inv(sock, 'getInputStream')
			current = { address: addr, name: name || inv(device, 'getName') || '' }
			current.verified = await verifyLink()
			return current
		} catch (e) {
			closeQuietly(sock)
			failures.push(way.label + ': ' + (e.message || e))
		}
	}

	disconnect()
	let bond = 'unknown'
	try {
		bond = BOND_STATE[inv(device, 'getBondState')] || 'unknown'
	} catch (e) {}
	const hint = bond === 'bonded'
		? '该设备已配对，请确认打印机已开机、未休眠，且没有被其它手机/电脑占用连接'
		: '该设备在本机尚未配对，请先在系统蓝牙设置里配对，或在系统弹出配对框时确认'
	throw new Error('连接 ' + addr + ' 失败（' + failures.join('；') + '）。' + hint)
}

function ensureConnected() {
	if (!isConnected()) throw new Error('打印机未连接')
}

// 通过 java.lang.String.getBytes(charset) 拿到真正的 byte[]，直接传 JS 数组会被识别成 int[]
function toJavaBytes(text, charset) {
	const jstr = plus.android.newObject('java.lang.String', text)
	return inv(jstr, 'getBytes', charset)
}

function sendRaw(text, charset) {
	ensureConnected()
	try {
		inv(outStream, 'write', toJavaBytes(text, charset || 'UTF-8'))
		inv(outStream, 'flush')
	} catch (e) {
		throw new Error('发送失败: ' + (e.message || e))
	}
}

// ZPL 用 UTF-8，配合指令里的 ^CI28
function sendZpl(zpl) {
	sendRaw(zpl, 'UTF-8')
}

// CPCL 中文走 GB18030
function sendCpcl(cpcl) {
	sendRaw(cpcl.replace(/\r?\n/g, '\r\n'), 'GB18030')
}

function readAvailable() {
	let text = ''
	while (inv(inStream, 'available') > 0) {
		const b = inv(inStream, 'read')
		if (b < 0) break
		text += String.fromCharCode(b)
	}
	return text
}

async function readResponse(timeout) {
	const deadline = Date.now() + (timeout || 2000)
	let text = ''
	while (Date.now() < deadline) {
		text += readAvailable()
		if (text.indexOf('\x03') !== -1) break // ETX，一段状态回复结束
		await sleep(100)
	}
	return text
}

// socket.connect() 返回成功只说明 RFCOMM 通道建起来了：打印机没进入配对/可连接模式、
// 或者链路已经半死时，连接照样"成功"，写入也不报错，于是界面误报连上了。
// 发一次 ~HS 看有没有回音，才算真的通。CPCL 机型不认 ~HS，所以这只是标记，不是硬失败。
async function verifyLink() {
	try {
		readAvailable() // 清掉残留，避免把上一次的回复当成本次响应
		sendZpl('~HS')
		return (await readResponse(1500)).length > 0
	} catch (e) {
		return false
	}
}

const flag = (v) => v === '1'

// ~HS 主机状态查询，回复 3 行逗号分隔字段
function parseHostStatus(raw) {
	const lines = raw
		.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
		.split(/[\r\n]+/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
	if (lines.length < 2) return { raw, parsed: false }

	const l1 = lines[0].split(',')
	const l2 = lines[1].split(',')
	const status = {
		raw,
		parsed: true,
		isPaperOut: flag(l1[1]),
		isPaused: flag(l1[2]),
		labelLengthInDots: parseInt(l1[3], 10) || 0,
		formatsInBuffer: parseInt(l1[4], 10) || 0,
		isReceiveBufferFull: flag(l1[5]),
		isHeadOpen: flag(l2[2]),
		isRibbonOut: flag(l2[3])
	}
	status.isReadyToPrint = !status.isPaperOut && !status.isPaused && !status.isHeadOpen
	return status
}

// 查询打印机状态。仅 ZPL 打印机支持 ~HS，CPCL 机型会返回 parsed:false
async function getStatus() {
	ensureConnected()
	readAvailable() // 清掉残留数据
	sendZpl('~HS')
	const raw = await readResponse(2000)
	if (!raw) throw new Error('打印机无响应（可能是 CPCL 机型或链路已断开）')
	return parseHostStatus(raw)
}

// 清除打印机缓存：取消半截接收的格式 -> 取消全部排队任务 -> 解除暂停
async function clearBuffer() {
	ensureConnected()
	readAvailable()
	sendRaw('~JX', 'UTF-8') // 取消正在接收但未完成的格式
	await sleep(150)
	sendRaw('~JA', 'UTF-8') // 取消缓冲区内全部格式及批量打印
	await sleep(300)
	sendRaw('~PS', 'UTF-8') // ~JA 后打印机可能停在暂停状态，恢复打印
	await sleep(100)
	readAvailable()
}

// 介质校准，换标签尺寸后走一次，让打印机重新测量纸长与间隙
function calibrate() {
	ensureConnected()
	sendRaw('~JC', 'UTF-8')
}

// 列出打印机 E: 盘上的字体文件，用来确认中文字体名（如 GB18030.FNT / SIMSUN.FNT）
async function listPrinterFonts() {
	ensureConnected()
	readAvailable()
	sendZpl('^XA^HWE:*.FNT^XZ')
	const raw = await readResponse(3000)
	if (!raw) throw new Error('打印机无响应')
	return raw
		.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
		.split(/[\r\n]+/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
}

function buildZplTestLabel() {
	return [
		'^XA',
		'^CI28',
		'^PW576',
		'^LL0400',
		'^FO30,30^A0N,36,36^FDZPL Test OK^FS',
		'^FO30,100^BY2^BCN,90,Y,N,N^FD123456789^FS',
		'^FO30,240^A0N,28,28^FD' + new Date().toLocaleString() + '^FS',
		'^XZ'
	].join('\n')
}

function buildCpclTestLabel() {
	return [
		'! 0 200 200 300 1',
		'PAGE-WIDTH 576',
		'TEXT 4 0 30 30 CPCL Test OK',
		'BARCODE 128 1 1 80 30 110 123456789',
		'TEXT 7 0 30 230 ' + new Date().toLocaleString(),
		'FORM',
		'PRINT'
	].join('\r\n')
}

function printZplTest() {
	sendZpl(buildZplTestLabel())
}

function printCpclTest() {
	sendCpcl(buildCpclTestLabel())
}

// 默认打印机，供其他页面直接调用
function savePrinter(printer) {
	uni.setStorageSync(STORAGE_KEY, printer)
}

function loadPrinter() {
	return uni.getStorageSync(STORAGE_KEY) || null
}

function clearPrinter() {
	uni.removeStorageSync(STORAGE_KEY)
}

// 业务页面的入口：优先用当前连接，否则自动连上默认打印机
async function printWithSaved(zpl) {
	if (!isConnected()) {
		const saved = loadPrinter()
		if (!saved || !saved.address) throw new Error('未设置默认打印机，请先到「蓝牙打印」页面连接并设为默认')
		await connect(saved.address, saved.name)
	}
	sendZpl(zpl)
}

export default {
	requestPermissions,
	isBluetoothEnabled,
	enableBluetooth,
	openBluetoothSettings,
	getPairedDevices,
	normalizeAddress,
	connect,
	disconnect,
	isConnected,
	getCurrentPrinter,
	sendRaw,
	sendZpl,
	sendCpcl,
	getStatus,
	clearBuffer,
	calibrate,
	listPrinterFonts,
	buildZplTestLabel,
	buildCpclTestLabel,
	printZplTest,
	printCpclTest,
	savePrinter,
	loadPrinter,
	clearPrinter,
	printWithSaved
}
