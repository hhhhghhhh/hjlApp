// utils/adapters/zebraAdapter.js
// Zebra 打印机适配器：仅支持 ZPL 语言。
// 中文走 E:HANS.TTF 原生渲染（连接后自动检测 HANS/HANT/NOTOMRJ），无 TTF 字体时降级位图 ^GFA。
// 通过 printerConnection 收发数据，并通过通用 PrinterAdapter 接口暴露能力。

import conn from '../printerConnection.js'
import { PrinterAdapter } from '../printerAdapter.js'
import { buildZpl, buildTextLabel, buildApplyMediaCommand } from '../zplTemplate.js'

const CJK_TTF_NAMES = ['HANS', 'HANT', 'NOTOMRJ']

export class ZebraAdapter extends PrinterAdapter {
	constructor() {
		super('zebra')
		this._hasCjkFont = null
		this._hasTtfFont = null
		this._ttfFontName = ''
		// 默认 203dpi（ZR668 便携机）。连接后通过 device.dpi 查询实际分辨率，
		// 实现"按打印机自动匹配 dpi"——ZPL 字号/线宽等由 zplTemplate 按该 dpi 折算成点。
		this.printerDpi = 203
	}

	// ---------- 连接 ----------
	async connect(address, name) {
		const cur = await super.connect(address, name)
		// 验证连接：发 ~HS 看打印机是否响应
		cur.verified = await this._verifyConnection()
		// 连接成功后查询实际 dpi（按打印机自动匹配，而非写死），再异步检测中文字体
		await this._queryDpi().catch(() => {})
		this.checkCjkFont().catch(() => {})
		return cur
	}

	// 发 ~HS 验证连接是否真的通
	async _verifyConnection() {
		try {
			conn.readAvailable()
			this.sendZpl('~HS')
			const raw = await conn.readResponse(1500)
			return !!raw && raw.length > 0
		} catch (e) {
			return false
		}
	}

	// 查询打印机实际 dpi（Link-OS 支持 ! U1 getvar "device.dpi"），用于自动匹配分辨率。
	// ZR668 = 203，ZT/ZD 系列可能为 300/600。查询失败保持默认 203。
	async _queryDpi() {
		try {
			conn.ensureConnected()
			conn.readAvailable()
			this.sendZpl('! U1 getvar "device.dpi"')
			const raw = await conn.readResponse(1500)
			const m = raw && raw.match(/(\d{2,3})/)
			if (m) {
				const d = parseInt(m[1], 10)
				if ([203, 300, 600].indexOf(d) !== -1) {
					this.printerDpi = d
					console.log('[ZebraAdapter] 打印机实际 dpi:', this.printerDpi)
					return
				}
			}
			console.log('[ZebraAdapter] 未识别 dpi，沿用默认 203:', raw)
		} catch (e) {
			console.log('[ZebraAdapter] 读取 dpi 失败，沿用默认 203:', e.message)
		}
	}

	// ---------- 发送辅助 ----------
	sendZpl(zpl) {
		conn.sendRaw(zpl, 'UTF-8')
	}

	// ---------- 状态 ----------
	async getStatus() {
		try {
			conn.ensureConnected()
			conn.readAvailable() // 清残留
			this.sendZpl('~HS')
			const raw = await conn.readResponse(2000)
			if (!raw) return { ok: false, message: '打印机无响应' }
			const status = parseHostStatus(raw)
			if (!status.parsed) return { ok: false, raw, message: '状态解析失败' }
			return {
				ok: status.isReadyToPrint,
				message: statusMessage(status),
				raw: status
			}
		} catch (e) {
			return { ok: false, message: e.message }
		}
	}

	// ---------- 测试打印 ----------
	async printTest() {
		conn.ensureConnected()
		this.sendZpl(buildZplTestLabel())
	}

	// ---------- 模板打印 ----------
	async printTemplate(tpl, data = {}) {
		conn.ensureConnected()
		const fontOpts = {
			hasTtfFont: this.hasTtfFont(),
			ttfFontPath: this.getCjkFontPath(),
			hasCjkFont: this.hasCjkFont()
		}
		this.sendZpl(buildZpl(tpl, data, { font: fontOpts, dpi: this.printerDpi }))
	}

	// 写入页面尺寸 / 介质校准（ZPL 协议）：连续纸写 ^LL 定长，间隙/黑标纸发 ~JC 让传感器重测。
	async applyMedia(tpl) {
		conn.ensureConnected()
		this.sendZpl(buildApplyMediaCommand(tpl))
	}

	// ---------- 纯文本打印 ----------
	async printText(text, opts = {}) {
		conn.ensureConnected()
		const fontOpts = {
			hasTtfFont: this.hasTtfFont(),
			ttfFontPath: this.getCjkFontPath(),
			hasCjkFont: this.hasCjkFont()
		}
		this.sendZpl(buildTextLabel(text, opts.cjkFont, fontOpts))
	}

	// ---------- 维护 ----------
	async clearBuffer() {
		conn.ensureConnected()
		conn.readAvailable()
		conn.sendRaw('~JX', 'UTF-8')
		await conn.sleep(150)
		conn.sendRaw('~JA', 'UTF-8')
		await conn.sleep(300)
		conn.sendRaw('~PS', 'UTF-8')
		await conn.sleep(100)
		conn.readAvailable()
	}

	async calibrate() {
		conn.ensureConnected()
		conn.sendRaw('~JC', 'UTF-8')
	}

	// ---------- 字体查询 ----------
	async queryFonts() {
		try {
			const fonts = await this.listPrinterFonts()
			return { ok: true, fonts }
		} catch (e) {
			return { ok: false, message: e.message }
		}
	}

	async queryTtfFonts() {
		try {
			const fonts = await this.listTtfFonts()
			return { ok: true, fonts }
		} catch (e) {
			return { ok: false, message: e.message }
		}
	}

	async listPrinterFonts() {
		conn.ensureConnected()
		conn.readAvailable()
		this.sendZpl('^XA^HWE:*.FNT^XZ')
		const raw = await conn.readResponse(3000)
		if (!raw) throw new Error('打印机无响应')
		return raw
			.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
			.split(/[\r\n]+/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0)
	}

	async listTtfFonts() {
		conn.ensureConnected()
		conn.readAvailable()
		this.sendZpl('^XA^HWE:*.TTF^XZ')
		const raw = await conn.readResponse(3000)
		if (!raw) throw new Error('打印机无响应')
		return raw
			.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
			.split(/[\r\n]+/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0)
	}

	async listAllFiles() {
		conn.ensureConnected()
		conn.readAvailable()
		this.sendZpl('~HD')
		const raw = await conn.readResponse(3000)
		if (!raw) throw new Error('打印机无响应')
		return raw
			.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
			.split(/[\r\n]+/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0)
	}

	// ---------- 中文字体检测 ----------
	async checkCjkFont() {
		try {
			const fonts = await this.listPrinterFonts()
			const all = fonts.join('\n')
			this._hasCjkFont = /GB18030|SIMSUN|SIMGU|SIMKAI|FANGSONG|SIMLI/i.test(all)
			console.log('[ZebraAdapter] CJK font check:', this._hasCjkFont, 'fonts:', fonts.length)
		} catch (e) {
			this._hasCjkFont = null
			console.warn('[ZebraAdapter] CJK font check failed:', e.message)
		}
		await this.checkTtfFont()
		return this._hasCjkFont
	}

	async checkTtfFont() {
		try {
			const fonts = await this.listTtfFonts()
			const all = fonts.join('\n')
			console.log('[ZebraAdapter] TTF list raw:', JSON.stringify(fonts))
			let matched = ''
			for (const name of CJK_TTF_NAMES) {
				if (new RegExp(name, 'i').test(all)) {
					matched = name
					break
				}
			}
			this._hasTtfFont = !!matched
			this._ttfFontName = matched
			console.log('[ZebraAdapter] TTF font check (^HW):', this._hasTtfFont, 'matched:', matched || 'none')

			if (!this._hasTtfFont) {
				console.log('[ZebraAdapter] ^HW 未匹配，尝试 ~HD 全盘列表...')
				const allFiles = await this.listAllFiles()
				const allText = allFiles.join('\n')
				for (const name of CJK_TTF_NAMES) {
					if (new RegExp(name, 'i').test(allText)) {
						matched = name
						break
					}
				}
				this._hasTtfFont = !!matched
				this._ttfFontName = matched
				console.log('[ZebraAdapter] TTF font check (~HD):', this._hasTtfFont, 'matched:', matched || 'none')
			}
		} catch (e) {
			this._hasTtfFont = null
			this._ttfFontName = ''
			console.warn('[ZebraAdapter] TTF font check failed:', e.message)
		}
		return this._hasTtfFont
	}

	hasCjkFont() {
		return this._hasCjkFont === true
	}

	hasTtfFont() {
		if (uni.getStorageSync('force_ttf_font')) return true
		return this._hasTtfFont === true
	}

	getCjkFontPath() {
		if (this.hasTtfFont()) return 'E:' + (this._ttfFontName || 'HANS') + '.TTF'
		// 无 TTF 时不再依赖 GB18030.FNT（本机无此文件），由位图渲染兜底
		return 'E:HANS.TTF'
	}

	setForceTtf(on) {
		uni.setStorageSync('force_ttf_font', on === true)
		this._hasTtfFont = on === true
	}

	getForceTtf() {
		return uni.getStorageSync('force_ttf_font') === true
	}

	// ---------- 语言切换 ----------
	async queryLanguage() {
		conn.ensureConnected()
		conn.readAvailable()
		this.sendZpl('! U1 getvar "device.languages"')
		const raw = await conn.readResponse(1500)
		return raw.replace(/["\r\n\s]/g, '').trim()
	}

	async setLanguage(lang) {
		conn.ensureConnected()
		if (lang !== 'zpl' && lang !== 'line_print') {
			throw new Error('不支持的语言: ' + lang + '，仅支持 zpl / line_print')
		}
		const pnp = lang === 'line_print' ? 'cpcl' : 'zpl'
		const cmds = [
			'! U1 setvar "device.languages" "' + lang + '"',
			'! U1 setvar "device.pnp_option" "' + pnp + '"',
			'! U1 do "device.reset" ""'
		]
		conn.sendRaw(cmds.join('\r\n'), 'UTF-8')
	}
}

// ---------- 私有辅助 ----------

function parseHostStatus(raw) {
	const lines = raw
		.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
		.split(/[\r\n]+/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
	if (lines.length < 2) return { raw, parsed: false }

	const flag = (v) => v === '1'
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

function statusMessage(status) {
	if (status.isHeadOpen) return '打印头打开'
	if (status.isPaperOut) return '缺纸/碳带'
	if (status.isPaused) return '打印机暂停'
	if (status.isRibbonOut) return '碳带耗尽'
	return '就绪'
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

export default ZebraAdapter
