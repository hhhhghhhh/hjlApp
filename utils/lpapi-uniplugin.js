// utils/lpapi-uniplugin.js
// 道臻(DothanTech) dothan-lpapi-ble 标签打印 SDK 的加载层（ESM 静态导入版）。
//
// 插件市场 ID: dothan-lpapi-ble（作者：上海道臻），这是一套基于 Canvas 绘图 + uni BLE 的
// 标签打印 JS SDK，支持德佟/道臻系列（DT-7330、译维 GL30、IB-PTM7330 等）。
//
// 重要：它是 uni_modules JS 插件（不是云端原生插件），因此【不需要自定义调试基座】，
//       标准基座即可运行；也不需要把 appid 换成真实 appid 去绑定云端插件。
//
// 为什么用 import 而不是 require？
//   uni-app 运行时不会解析 require('@/uni_modules/...') / require('../uni_modules/...') 这种
//   字面量路径（会报 Cannot find module）。官方示例用的是静态 import：
//     import { LPAPIFactory } from '../../uni_modules/dothan-lpapi-ble/js_sdk'
//   构建器在编译期就会把插件打进包里，运行时直接可用。本文件采用同样方式。
//
// 该 SDK 通过页面里一个隐藏的 <canvas type="2d">（canvas-id = CANVAS_ID）绘制标签内容（所见即所得），
// 再把画布转成打印机指令经 BLE 下发。调用前，打印页必须已渲染该 canvas 组件。
//
// 与官方示例一致的关键流程：
//   openAdapter({force:true}) -> createDrawContext({canvasId}) -> setDrawContext(ctx)
//   -> startDiscovery / openPrinter({name,deviceId,tryTimes})
//   -> startJob({context,width,height,orientation,isPreview}) -> drawXxx -> commitJob({gapType,printDarkness,printSpeed})

// 静态导入插件（相对路径从本文件 src/utils/ 指向 src/uni_modules）。
import { LPAPIFactory } from '../uni_modules/dothan-lpapi-ble/js_sdk'

const CANVAS_ID = 'lpapi-canvas'

// App-plus 的 JS 引擎（部分 Android webview）里 TextEncoder/TextDecoder 不一定存在，
// 而 dothan-lpapi-ble 在编码二维码/中文文本时依赖 new TextEncoder()。缺失时 SDK 会回退到
// encodeUtf8，但补齐这个全局垫片可消除 "DzTextEncoder.encode: TextEncoder is not defined" 告警，
// 并确保二维码/中文走标准 UTF-8 编码，避免乱码。
function polyfillTextEncoder() {
	if (typeof globalThis.TextEncoder !== 'undefined') return
	globalThis.TextEncoder = class {
		encode(str) {
			const out = []
			for (let i = 0; i < str.length; i++) {
				let cp = str.charCodeAt(i)
				if (cp < 0x80) out.push(cp)
				else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
				else if (cp >= 0xd800 && cp < 0xdc00) {
					const c2 = str.charCodeAt(++i)
					cp = 0x10000 + ((cp & 0x3ff) << 10) + (c2 & 0x3ff)
					out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
				} else out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
			}
			return new Uint8Array(out)
		}
	}
	if (typeof globalThis.TextDecoder !== 'undefined') return
	globalThis.TextDecoder = class {
		decode(bytes) {
			let s = ''
			const a = bytes && bytes.length ? bytes : []
			for (let i = 0; i < a.length; i++) {
				const b = a[i]
				if (b < 0x80) s += String.fromCharCode(b)
				else if (b < 0xe0) s += String.fromCharCode(((b & 0x1f) << 6) | (a[++i] & 0x3f))
				else if (b < 0xf0) s += String.fromCharCode(((b & 0xf) << 12) | ((a[++i] & 0x3f) << 6) | (a[++i] & 0x3f))
				else {
					let cp = ((b & 0x7) << 18) | ((a[++i] & 0x3f) << 12) | ((a[++i] & 0x3f) << 6) | (a[++i] & 0x3f)
					cp -= 0x10000
					s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
				}
			}
			return s
		}
	}
}
polyfillTextEncoder()

let instance = null
// 每个页面/组件用自己的 canvas-id，各自持有一份绘制上下文（keyed by canvasId）。
// currentCanvasId 记录"当前正在打印/可见的页"，ensureDrawContext 据此取正确的上下文。
//
// 为什么不能全局只存一份上下文（早期实现）：
//   navigateTo 会让多个打印页同时各自带一张隐藏 canvas；若全局共用一份，上下文会绑到
//   旧页的 canvas 节点，而 commitJob 里的 uni.canvasGetImageData({canvasId}) 按字符串 id
//   取像素时，在两张同 id canvas 中取到了"当前页那张空的" -> 出纸空白。模板打印、关键件打印
//   在已 navigateTo 进来的情况下就触发了这个问题，而单独的"打印测试"(printSetting 单页)不受影响。
let contexts = {}
let currentCanvasId = null

try {
	// 官方示例：LPAPIFactory.getInstance({ showLog }) —— 顶层初始化。
	// canvasId 在 createDrawContext 时再传，但这里一并带上也与 alignPrint 示例一致（可选）。
	instance = LPAPIFactory.getInstance({ showLog: 4, canvasId: CANVAS_ID })
	console.log('[lpapi-uniplugin] LPAPIFactory instance created')
} catch (e) {
	console.error('[lpapi-uniplugin] getInstance failed:', e && e.message)
}

function getLPAPI() {
	return instance
}

// 根据页面的隐藏 canvas 创建绘制上下文。按 canvasId 各自持有一份（不再全局共用一份），
// 并把该 id 记为"当前激活画布"。与官方示例一致：同一页面只创建一次（存进 contexts map），
// 之后 setDrawContext 复用同一上下文；不同页面用各自唯一 id，互不串台。
function initDrawContext(canvasId) {
	canvasId = canvasId || currentCanvasId || CANVAS_ID
	currentCanvasId = canvasId
	if (!instance) {
		console.error('[lpapi-uniplugin] initDrawContext: LPAPI 未初始化（插件未导入？）')
		return null
	}
	try {
		const ctx = instance.createDrawContext({ canvasId })
		instance.setDrawContext(ctx)
		contexts[canvasId] = ctx
		console.log('[lpapi-uniplugin] draw context ready, canvasId:', canvasId)
		return ctx
	} catch (e) {
		console.error('[lpapi-uniplugin] createDrawContext failed:', e && e.message)
		return null
	}
}

// 标记"当前正在打印的画布 id"。打印页在 onLoad/onShow 调一次即可，确保 ensureDrawContext
// 在任一打印入口都能取到本页自己的上下文（处理 navigateBack 后旧页上下文仍在的情况）。
function setActiveCanvas(canvasId) {
	if (canvasId) currentCanvasId = canvasId
	return currentCanvasId
}

function getActiveCanvasId() {
	return currentCanvasId || CANVAS_ID
}

function getDrawContext() {
	return currentCanvasId ? (contexts[currentCanvasId] || null) : null
}

function isReady() {
	return !!instance
}

// ---------------------------------------------------------------------------
// Canvas 尺寸同步（跨层事件总线）
// ---------------------------------------------------------------------------
// 道臻 LPAPI 的 startJob 在内部按"标签 mm × 打印机 dpi"算出任务的位图像素尺寸，
// 并把该尺寸写进返回的 job.canvas.width / job.canvas.height。打印前必须把这个尺寸
// 同步到页面隐藏 <canvas> 的 :style（CSS 像素）——这正是官方示例在 startJob 之后
// 调用的 updateCanvas 这一步。若不同步，绘制会落在错误尺寸的缓冲上，导致出纸空白/偏移。
//
// 适配器在 utils 层、打印页在 pages 层，适配器无法直接改 Vue 的响应式 data，因此用
// 一个轻量事件总线：适配器 startJob 后 emitCanvasSize(w,h)，各打印页 onCanvasSize 监听
// 并把 {lpapiCanvasW, lpapiCanvasH} 改成本地响应式数据（绑定到 canvas 的 :style）。
let canvasSizeListeners = []
function onCanvasSize(fn) {
	if (typeof fn !== 'function') return () => {}
	canvasSizeListeners.push(fn)
	return function off() {
		canvasSizeListeners = canvasSizeListeners.filter((x) => x !== fn)
	}
}
function emitCanvasSize(w, h) {
	for (const fn of canvasSizeListeners.slice()) {
		try { fn(w, h) } catch (e) { /* 忽略单个监听器的异常，避免影响打印主流程 */ }
	}
}

export {
	CANVAS_ID,
	getLPAPI,
	initDrawContext,
	setActiveCanvas,
	getActiveCanvasId,
	getDrawContext,
	isReady,
	onCanvasSize,
	emitCanvasSize
}
export default {
	CANVAS_ID,
	getLPAPI,
	initDrawContext,
	setActiveCanvas,
	getActiveCanvasId,
	getDrawContext,
	isReady,
	onCanvasSize,
	emitCanvasSize
}
