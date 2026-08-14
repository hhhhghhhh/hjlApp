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
			// 连接成功后异步检测中文字体，不阻塞连接流程
			checkCjkFont().catch(() => {})
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
		'! 0 203 203 300 1',
		'ENCODING GB18030',
		'TEXT 4 0 30 30 CPCL Test OK',
		'TEXT 4 0 30 60 中文测试',
		'TEXT 4 0 30 90 直流模块',
		'BARCODE 128 30 130 2 6 60 2 0 1234567890',
		'BARCODE QR 30 210 M 2 U 6',
		'MA,https://zebra.com',
		'ENDQR',
		'TEXT 7 0 30 280 ' + new Date().toLocaleString(),
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

// 查询打印机当前编程语言（ZPL / line_print(CPCL) / epl 等）
// 斑马便携机是双模式，ZPL 和 CPCL 互斥，切换要重启
async function queryLanguage() {
	ensureConnected()
	readAvailable() // 清残留
	// SGD 查询指令，回复格式: "zpl" 或 "line_print" 等（带引号和换行）
	sendRaw('! U1 getvar "device.languages"', 'UTF-8')
	const raw = await readResponse(1500)
	return raw.replace(/["\r\n\s]/g, '').trim()
}

// 切换打印机编程语言。切换后打印机会自动重启，蓝牙连接会断开，需重新连接。
// lang: 'zpl' 或 'line_print'（CPCL 模式）
async function setLanguage(lang) {
	ensureConnected()
	if (lang !== 'zpl' && lang !== 'line_print') {
		throw new Error('不支持的语言: ' + lang + '，仅支持 zpl / line_print')
	}
	const pnp = lang === 'line_print' ? 'cpcl' : 'zpl'
	const cmds = [
		'! U1 setvar "device.languages" "' + lang + '"',
		'! U1 setvar "device.pnp_option" "' + pnp + '"',
		'! U1 do "device.reset" ""'
	]
	// 发送后打印机会重启，连接会断，不用读回复
	sendRaw(cmds.join('\r\n'), 'UTF-8')
}

// 默认打印机，供其他页面直接调用
function savePrinter(printer) {
	uni.setStorageSync(STORAGE_KEY, printer)
}

// 中文字体检测结果缓存：null=未检测, true=有, false=无
// zplTemplate.js 读这个判断中文走 ^A@ 还是位图
let _hasCjkFont = null
// TTF 中文字体检测结果
let _hasTtfFont = null
// 检测到的 TTF 字体文件名（不含扩展名）
// Zebra 打印机自带 HANS.TTF（简体中文）、HANT.TTF（繁体）；也可能是用户上传的 NOTOMRJ.TTF
let _ttfFontName = ''
// 已知中文字体名列表（优先级从高到低）
const CJK_TTF_NAMES = ['HANS', 'HANT', 'NOTOMRJ']

// 异步检测打印机是否有中文字体（连接后自动调用）
// 同时检测 .FNT 位图字体和 .TTF TrueType 字体
async function checkCjkFont() {
	try {
		const fonts = await listPrinterFonts()
		const all = fonts.join('\n')
		_hasCjkFont = /GB18030|SIMSUN|SIMGU|SIMKAI|FANGSONG|SIMLI/i.test(all)
		console.log('[zebraPrinter] CJK font check:', _hasCjkFont, 'fonts:', fonts.length)
	} catch (e) {
		_hasCjkFont = null
		console.warn('[zebraPrinter] CJK font check failed:', e.message)
	}
	// 同时检测 TTF 字体
	await checkTtfFont()
	return _hasCjkFont
}

// 检测 TTF 中文字体是否存在
// Zebra 打印机自带 HANS.TTF（简体中文），也可能有用户上传的 NOTOMRJ.TTF
async function checkTtfFont() {
	try {
		const fonts = await listTtfFonts()
		const all = fonts.join('\n')
		console.log('[zebraPrinter] TTF list raw:', JSON.stringify(fonts))

		// 优先级匹配：HANS > HANT > NOTOMRJ
		_ttfFontName = ''
		for (const name of CJK_TTF_NAMES) {
			if (new RegExp(name, 'i').test(all)) {
				_ttfFontName = name
				break
			}
		}
		_hasTtfFont = _ttfFontName !== ''
		console.log('[zebraPrinter] TTF font check:', _hasTtfFont, 'matched:', _ttfFontName, 'files:', fonts.length)
	} catch (e) {
		_hasTtfFont = null
		_ttfFontName = ''
		console.warn('[zebraPrinter] TTF font check failed:', e.message)
	}
	return _hasTtfFont
}

// 列出 E: 盘上的 TTF 字体文件
async function listTtfFonts() {
	ensureConnected()
	readAvailable()
	sendZpl('^XA^HWE:*.TTF^XZ')
	const raw = await readResponse(3000)
	if (!raw) throw new Error('打印机无响应')
	return raw
		.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
		.split(/[\r\n]+/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
}

// ~HD 列出打印机上所有文件（全盘），用于 ^HW 通配符查不到时的兜底
async function listAllFiles() {
	ensureConnected()
	readAvailable()
	sendZpl('~HD\r\n')
	const raw = await readResponse(5000)
	if (!raw) throw new Error('打印机无响应（~HD）')
	return raw
		.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
		.split(/[\r\n]+/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
}

// 同步读取缓存：true=有中文字体，false/null=无或未检测（走位图）
function hasCjkFont() {
	return _hasCjkFont === true
}

// 同步读取缓存：true=有 TTF 中文字体
// 优先检查手动强制开关，其次看自动检测结果
function hasTtfFont() {
	if (uni.getStorageSync('force_ttf_font')) return true
	return _hasTtfFont === true
}

// 手动设置/取消强制 TTF 字体
function setForceTtf(on) {
	uni.setStorageSync('force_ttf_font', on)
	_hasTtfFont = on === true
}
function getForceTtf() {
	return uni.getStorageSync('force_ttf_font') === true
}

// 获取最佳 CJK 字体路径
// 优先使用自动检测到的 TTF 字体名，其次回退 HANS（最常见），最后 GB18030.FNT
function getCjkFontPath() {
	if (hasTtfFont()) {
		// 自动检测到的字体名优先，否则用 HANS（Zebra 自带简体中文字体）
		const name = _ttfFontName || 'HANS'
		return 'E:' + name + '.TTF'
	}
	return 'E:GB18030.FNT'
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
	hasCjkFont,
	checkCjkFont,
	hasTtfFont,
	checkTtfFont,
	setForceTtf,
	getForceTtf,
	getCjkFontPath,
	listTtfFonts,
	buildZplTestLabel,
	buildCpclTestLabel,
	printZplTest,
	printCpclTest,
	queryLanguage,
	setLanguage,
	savePrinter,
	loadPrinter,
	clearPrinter,
	printWithSaved
}
