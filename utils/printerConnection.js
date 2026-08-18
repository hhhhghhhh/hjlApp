// utils/printerConnection.js
// 蓝牙连接层（经典蓝牙 SPP + BLE GATT），与具体打印机指令集无关。
// 供 ZebraAdapter（SPP）、Ibptm7330Adapter（BLE）等指令集适配器复用。
//
// 设计原则：
//   - 本模块只负责「连上蓝牙 + 收发字节」
//   - SPP 走 BluetoothSocket（RFCOMM），BLE 走 uni.* BLE API（GATT write）
//   - 指令解析、模板渲染、字体检测由各 Adapter 自己实现
//   - sendBytes 对 SPP 同步返回、对 BLE 返回 Promise；调用方统一 await 即可

const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB'
const STORAGE_KEY = 'zebra_printer' // 历史 key，保持默认打印机持久化兼容

// ---- BLE 常量（IB-PTM7330）----
// 从 DeepSeek 对话 + BLE Scanner 扫描结果获取
const BLE_SERVICE_UUID = '0000FF00-0000-1000-8000-00805F9B34FB'
const BLE_WRITE_CHAR_UUID = '0000FF02-0000-1000-8000-00805F9B34FB'
const BLE_NOTIFY_CHAR_UUID = '0000FF01-0000-1000-8000-00805F9B34FB'

// ---- SPP 状态 ----
let adapter = null
let socket = null
let outStream = null
let inStream = null

// ---- BLE 状态 ----
let bleConnected = false
let bleDeviceId = null
let bleWriteChunkSize = 20 // 默认 MTU payload

// ---- 共享状态 ----
let current = null

const inv = (obj, method, ...args) => plus.android.invoke(obj, method, ...args)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function assertAndroid() {
	if (typeof plus === 'undefined') {
		throw new Error('请在 App 中运行，H5/小程序不支持蓝牙打印')
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
// BLE 扫描还需要 BLUETOOTH_SCAN
function runtimePermissions() {
	const major = parseInt(plus.os.version, 10) || 0
	return major >= 12
		? ['android.permission.BLUETOOTH_CONNECT', 'android.permission.BLUETOOTH_SCAN']
		: []
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

function enableBluetooth() {
	assertAndroid()
	startActivityByAction('android.bluetooth.adapter.action.REQUEST_ENABLE')
}

function openBluetoothSettings() {
	assertAndroid()
	startActivityByAction('android.settings.BLUETOOTH_SETTINGS')
}

// 打印机机身/电池仓下方贴的条码通常就是它的蓝牙 MAC，扫出来是不带分隔符的 12 位十六进制。
function normalizeAddress(raw) {
	const text = String(raw || '').toUpperCase()
	const hit = text.match(/([0-9A-F]{2}[:-]){5}[0-9A-F]{2}/) || text.match(/\b[0-9A-F]{12}\b/)
	if (!hit) return ''
	return hit[0].replace(/[^0-9A-F]/g, '').match(/.{2}/g).join(':')
}

const BOND_STATE = { 10: 'none', 11: 'bonding', 12: 'bonded' }

const PRINTER_NAME_HINT = /(zebra|ib-ptm|^zq|^zd|^zt|^qln|^imz|^zr|^rw|^mz|printer)/i

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

// ============================================================
// 连接状态
// ============================================================

function isBLE() {
	return bleConnected
}

function isConnected() {
	if (bleConnected) return true
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
	// BLE 断开
	if (bleConnected) {
		disconnectBLE()
		return
	}
	// SPP 断开
	closeQuietly(outStream)
	closeQuietly(inStream)
	closeQuietly(socket)
	outStream = null
	inStream = null
	socket = null
	current = null
}

// ============================================================
// SPP 连接（经典蓝牙 RFCOMM）
// ============================================================

// 安全通道在部分手机上会被拒（尤其 Android 12+），非安全通道往往能连上，所以逐个试。
const SOCKET_FACTORY = [
	{ method: 'createRfcommSocketToServiceRecord', label: '安全通道' },
	{ method: 'createInsecureRfcommSocketToServiceRecord', label: '非安全通道' }
]

// 连接打印机（SPP 或 BLE）。type: 'spp'(默认) | 'ble'
async function connect(address, name, type) {
	if (type === 'ble') {
		return connectBLE(address, name)
	}
	return connectSPP(address, name)
}

async function connectSPP(address, name) {
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
	for (const way of SOCKET_FACTORY) {
		let sock = null
		try {
			sock = inv(device, way.method, uuid)
			inv(sock, 'connect')
			socket = sock
			outStream = inv(sock, 'getOutputStream')
			inStream = inv(sock, 'getInputStream')
			current = { address: addr, name: name || inv(device, 'getName') || '', ble: false }
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

// ============================================================
// BLE 连接（GATT，使用 uni.* BLE API）
// ============================================================

// 通用 BLE 操作 Promise 包装
function bleOp(apiName, params = {}) {
	return new Promise((resolve, reject) => {
		uni[apiName]({
			...params,
			success: (res) => resolve(res),
			fail: (err) => {
				const msg = (err && (err.errMsg || err.message)) || JSON.stringify(err)
				reject(new Error(apiName + ' 失败: ' + msg))
			}
		})
	})
}

function openBLEAdapter() {
	return bleOp('openBluetoothAdapter')
}

function createBLEConnection(deviceId) {
	return bleOp('createBLEConnection', { deviceId, timeout: 15000 })
}

function getBLEServices(deviceId) {
	return bleOp('getBLEDeviceServices', { deviceId }).then((res) => res.services || [])
}

function getBLECharacteristics(deviceId, serviceId) {
	return bleOp('getBLEDeviceCharacteristics', { deviceId, serviceId }).then(
		(res) => res.characteristics || []
	)
}

function setBLEMTU(deviceId, mtu) {
	return bleOp('setBLEMTU', { deviceId, mtu }).then((res) => res.mtu || mtu)
}

function writeBLECharacteristic(deviceId, serviceId, charId, value) {
	return bleOp('writeBLECharacteristicValue', { deviceId, serviceId, characteristicId: charId, value })
}

function closeBLEConnection(deviceId) {
	return new Promise((resolve) => {
		uni.closeBLEConnection({
			deviceId,
			success: () => resolve(),
			fail: () => resolve() // 断开失败不阻塞
		})
	})
}

// UUID 比较：uni-app 返回的 UUID 可能是大写、小写或带/不带横线
function uuidEqual(a, b) {
	return String(a || '').toUpperCase().replace(/[^0-9A-F]/g, '') ===
		String(b || '').toUpperCase().replace(/[^0-9A-F]/g, '')
}

async function connectBLE(address, name) {
	const deviceId = normalizeAddress(address)
	if (!deviceId) throw new Error('蓝牙地址不合法：' + address)

	await requestPermissions()
	disconnect() // 先断开任何现有连接

	console.log('[printerConnection] BLE connect to', deviceId, name || '')

	// 1. 初始化蓝牙适配器
	try {
		await openBLEAdapter()
		console.log('[printerConnection] BLE adapter opened')
	} catch (e) {
		throw new Error('初始化蓝牙适配器失败: ' + e.message)
	}

	// 2. 创建 BLE 连接
	try {
		await createBLEConnection(deviceId)
		console.log('[printerConnection] BLE connection created')
	} catch (e) {
		throw new Error('BLE 连接失败: ' + e.message + '。请确认打印机已开机、处于可连接状态')
	}

	// 2.1 部分机型 GATT 服务尚未就绪，直接 getBLEDeviceServices 会返回空/超时，
	//     这里等一小段让协议栈把服务表建好，大幅提升首次连接成功率。
	await sleep(400)
	console.log('[printerConnection] BLE post-connect delay done, discovering services...')

	// 3. 发现服务，找到写特征值
	let services = []
	try {
		services = await getBLEServices(deviceId)
		console.log('[printerConnection] BLE services:', services.map((s) => s.uuid).join(', '))
	} catch (e) {
		throw new Error('发现 BLE 服务失败: ' + e.message)
	}

	const service = services.find((s) => uuidEqual(s.uuid, BLE_SERVICE_UUID))
	if (!service) {
		throw new Error('未找到打印机 BLE 服务 ' + BLE_SERVICE_UUID +
			'。可用服务: ' + services.map((s) => s.uuid).join(', '))
	}

	let characteristics = []
	try {
		characteristics = await getBLECharacteristics(deviceId, BLE_SERVICE_UUID)
		console.log('[printerConnection] BLE characteristics:', characteristics.map((c) => c.uuid).join(', '))
	} catch (e) {
		throw new Error('发现 BLE 特征值失败: ' + e.message)
	}

	const writeChar = characteristics.find((c) => uuidEqual(c.uuid, BLE_WRITE_CHAR_UUID))
	if (!writeChar) {
		throw new Error('未找到写入特征值 ' + BLE_WRITE_CHAR_UUID)
	}

	// 4. 协商 MTU（增大传输包大小，提高效率）
	try {
		const mtu = await setBLEMTU(deviceId, 200)
		bleWriteChunkSize = Math.max(20, mtu - 3)
		console.log('[printerConnection] BLE MTU:', mtu, 'chunk size:', bleWriteChunkSize)
	} catch (e) {
		bleWriteChunkSize = 20
		console.log('[printerConnection] MTU 协商失败，使用默认 20 字节:', e.message)
	}

	bleConnected = true
	bleDeviceId = deviceId
	current = { address: deviceId, name: name || '', ble: true }
	console.log('[printerConnection] BLE connected:', JSON.stringify(current))
	return current
}

function disconnectBLE() {
	if (bleDeviceId) {
		closeBLEConnection(bleDeviceId)
	}
	bleConnected = false
	bleDeviceId = null
	bleWriteChunkSize = 20
	current = null
	console.log('[printerConnection] BLE disconnected')
}

// 通过 BLE 写特征值发送字节数据（自动分包）
async function sendBytesBLE(bytes) {
	if (!bleConnected || !bleDeviceId) throw new Error('BLE 未连接')

	const arr = Array.isArray(bytes) ? bytes : Array.from(bytes)
	const totalLen = arr.length
	console.log('[printerConnection] BLE send', totalLen, 'bytes, chunk', bleWriteChunkSize)

	let offset = 0
	let chunkIndex = 0
	while (offset < totalLen) {
		const chunkLen = Math.min(bleWriteChunkSize, totalLen - offset)
		const chunk = new Uint8Array(arr.slice(offset, offset + chunkLen))
		try {
			await writeBLECharacteristic(bleDeviceId, BLE_SERVICE_UUID, BLE_WRITE_CHAR_UUID, chunk.buffer)
		} catch (e) {
			console.error('[printerConnection] BLE write failed at offset', offset, ':', e.message)
			throw new Error('BLE 发送失败 (offset ' + offset + '): ' + e.message)
		}
		offset += chunkLen
		chunkIndex++
		// 每 50 个包输出一次进度
		if (chunkIndex % 50 === 0) {
			console.log('[printerConnection] BLE progress:', offset, '/', totalLen)
		}
		// 包间微延迟，防止打印机缓冲区溢出
		if (offset < totalLen) {
			await sleep(5)
		}
	}
	console.log('[printerConnection] BLE send complete, total chunks:', chunkIndex)
}

// ============================================================
// 数据发送
// ============================================================

function ensureConnected() {
	if (!isConnected()) throw new Error('打印机未连接')
}

// 通过 java.lang.String.getBytes(charset) 拿到真正的 byte[]
function toJavaBytes(text, charset) {
	const jstr = plus.android.newObject('java.lang.String', text)
	return inv(jstr, 'getBytes', charset || 'UTF-8')
}

// SPP 文本发送
function sendRaw(text, charset) {
	if (bleConnected) {
		throw new Error('BLE 连接不支持 sendRaw，请使用 sendBytes')
	}
	ensureConnected()
	try {
		inv(outStream, 'write', toJavaBytes(text, charset || 'UTF-8'))
		inv(outStream, 'flush')
	} catch (e) {
		throw new Error('发送失败: ' + (e.message || e))
	}
}

// 把 Uint8Array/number[] 编码为 ISO-8859-1 字符串（SPP 用）
function bytesToString(bytes) {
	const arr = Array.isArray(bytes) ? bytes : Array.from(bytes)
	return arr.map((b) => String.fromCharCode(b & 0xFF)).join('')
}

// 发送字节数组。
// SPP：同步写入 OutputStream，返回 undefined。
// BLE：异步写入 GATT 特征值，返回 Promise。
// 调用方统一 await conn.sendBytes(chunk) 即可兼容两种模式。
function sendBytes(bytes) {
	if (bleConnected) {
		return sendBytesBLE(bytes)
	}
	// SPP: 同步
	sendRaw(bytesToString(bytes), 'ISO-8859-1')
}

// ============================================================
// SPP 读取（BLE 暂不需要）
// ============================================================

function readAvailable() {
	if (bleConnected || !inStream) return ''
	let text = ''
	while (inv(inStream, 'available') > 0) {
		const b = inv(inStream, 'read')
		if (b < 0) break
		text += String.fromCharCode(b)
	}
	return text
}

async function readResponse(timeout) {
	if (bleConnected) return ''
	const deadline = Date.now() + (timeout || 2000)
	let text = ''
	while (Date.now() < deadline) {
		text += readAvailable()
		if (text.indexOf('\x03') !== -1) break // ETX，一段状态回复结束
		await sleep(100)
	}
	return text
}

// ============================================================
// 持久化
// ============================================================

function savePrinter(printer) {
	uni.setStorageSync(STORAGE_KEY, printer)
}

function loadPrinter() {
	return uni.getStorageSync(STORAGE_KEY) || null
}

export default {
	assertAndroid,
	getAdapter,
	runtimePermissions,
	requestPermissions,
	isBluetoothEnabled,
	enableBluetooth,
	openBluetoothSettings,
	normalizeAddress,
	getPairedDevices,
	isBLE,
	isConnected,
	getCurrentPrinter,
	connect,
	disconnect,
	ensureConnected,
	sendRaw,
	sendBytes,
	bytesToString,
	readAvailable,
	readResponse,
	savePrinter,
	loadPrinter,
	sleep
}
