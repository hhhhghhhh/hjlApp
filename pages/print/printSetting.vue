<template>
	<view class="container" :class="[sizeClass, darkClass, themeClass]">
		<!-- dothan-lpapi-ble 需要页面里有一个隐藏 canvas 用于绘制标签（所见即所得）。
		     官方示例要求 type="2d"，否则 createDrawContext 拿不到 2d 绘制上下文。 -->
		<canvas type="2d" canvas-id="lpapi-canvas-setting" id="lpapi-canvas-setting"
			:style="{ width: lpapiCanvasW + 'px', height: lpapiCanvasH + 'px' }"
			style="position: fixed; left: -999999rpx; top: -999999rpx;"></canvas>
		<view class="card">
			<view class="row">
				<text class="label">蓝牙状态</text>
				<text :class="['value', btEnabled ? 'ok' : 'warn']">{{ btEnabled ? '已开启' : '未开启' }}</text>
			</view>
			<view class="row">
				<text class="label">当前打印机</text>
				<text :class="['value', connected && verified ? 'ok' : 'warn']">{{ connectedText }}</text>
			</view>
			<view class="btn-row">
				<button size="mini" @click="openSettings">系统蓝牙设置</button>
				<button size="mini" @click="refresh">刷新设备</button>
				<button size="mini" v-if="!btEnabled" type="primary" @click="turnOnBluetooth">开启蓝牙</button>
			</view>
			<view class="tip-inline warn" v-if="permError">{{ permError }}</view>
		</view>

		<view class="card">
			<text class="card-title">指令集（按打印机记忆）</text>
			<view class="btn-row">
				<button
					size="mini"
					v-for="p in protocolOptions"
					:key="p.value"
					:type="protocol === p.value ? 'primary' : 'default'"
					@click="setProtocol(p.value)">
					{{ p.label }}
				</button>
			</view>
		<view class="tip-inline">
			连接前请选择这台打印机使用的指令集。选定后 App 会记住该打印机对应的指令集，下次再点它就自动套用。LPAPI 指令集由 App 内置打印组件自行管理蓝牙连接；ZPL 指令集走标准蓝牙串口。如不确定，点设备时会按机型自动判断。
		</view>
		</view>

		<view class="tip">
			连接前先让打印机进入蓝牙配对/可连接模式（多数机型是长按蓝牙键或走纸键到指示灯闪烁），否则会连接失败，或者连上了却对指令没反应。
		</view>
		<view class="tip">
			打印机需先在「系统蓝牙设置」中完成配对，配对后回到本页刷新即可看到；也可以用下面的「按地址连接」跳过列表。
		</view>

		<view class="card">
			<text class="card-title">已配对设备</text>
			<view v-if="devices.length === 0" class="empty">暂无已配对设备</view>
			<view v-for="dev in devices" :key="dev.address"
				:class="['device-item', dev.address === connectedAddress ? 'active' : '']"
				@click="connectDevice(dev)">
				<view class="device-info">
					<text class="device-name">{{ dev.name }}<text v-if="dev.maybePrinter" class="badge">打印机</text></text>
					<text class="device-addr">{{ dev.address }}</text>
					<text class="device-proto" v-if="protocolLabelForAddress(dev.address)">指令集：{{ protocolLabelForAddress(dev.address) }}</text>
				</view>
				<text class="device-state">{{ dev.address === connectedAddress ? '已连接' : '点击连接' }}</text>
			</view>
		</view>

		<view class="card" v-if="protocol !== 'lpapi'">
			<text class="card-title">按地址连接</text>
			<view class="addr-row">
				<input class="addr-input" v-model="manualAddress" placeholder="12 位十六进制，如 AABBCCDDEEFF" />
				<button size="mini" @click="scanAddress">扫码</button>
			</view>
			<text class="addr-preview" v-if="manualNormalized">将连接 {{ manualNormalized }}</text>
			<text class="addr-preview bad" v-else-if="manualAddress">地址不完整，需要 12 位十六进制</text>
			<view class="btn-row">
				<button size="mini" type="primary" @click="connectManual">连接此地址</button>
				<button size="mini" v-if="manualAddress" @click="manualAddress = ''">清空</button>
			</view>
			<view class="tip-inline">打印机机身或电池仓下方的条码通常就是它的蓝牙地址，扫它即可，大小写和有没有冒号都不影响。</view>
			<view class="tip-inline">设备没出现在上面的已配对列表里也能连；首次连接时系统会弹配对框，确认一次就行。</view>
		</view>

		<view class="card" v-if="connected">
			<text class="card-title">打印测试</text>
			<view class="btn-row" v-if="protocol === 'zebra'">
			<button size="mini" type="primary" @click="testZpl">ZPL 测试</button>
			<button size="mini" @click="queryStatus">查询状态</button>
			</view>
			<view class="btn-row" v-if="protocol === 'zebra'">
			<button size="mini" @click="queryLang">查询语言</button>
			<button size="mini" @click="switchToZpl">切换到 ZPL</button>
			</view>
			<view class="btn-row" v-if="false">
				<button size="mini" type="primary" @click="testIbptm7330Pdf">PDF位图(1F2A)</button>
				<button size="mini" @click="testIbptm7330Tpcl">TPCL标准指令</button>
				<button size="mini" @click="testIbptm7330Esc">ESC/POS标准指令</button>
			</view>
			<view class="btn-row" v-if="false">
				<button size="mini" @click="testIbptm7330Text">中文文本测试(位图)</button>
			</view>
			<view class="tip-inline" v-if="false">
				三种测试：PDF位图（厂家 1F 2A 位图方式，最可靠）、TPCL（东芝 TSPL 标准指令流：文本/条码/二维码）、ESC/POS（Epson 标准指令流：文本/条码/二维码/走纸）。中文无内置字库，走位图下发。哪种能正常出纸就在业务里用哪种。
			</view>
			<view class="btn-row" v-if="protocol === 'lpapi'">
				<button size="mini" type="primary" @click="testLpapi">LPAPI 综合测试</button>
				<button size="mini" @click="testLpapiText">LPAPI 中文文本</button>
			</view>
			<view class="tip-inline warn" v-if="protocol === 'lpapi'">
				LPAPI 走 App 内置打印组件（Canvas + 蓝牙，uni_modules JS 插件）：① 已在项目中导入对应打印插件；② 标准基座即可运行，无需自定义基座；③ 本页已含隐藏 canvas 供其绘制。若提示"未加载插件"，说明还没装对应 SDK。
			</view>
			<view class="row" v-if="protocol === 'lpapi'">
				<text class="label">水平偏移微调 (mm)</text>
				<input class="ipt" type="digit" v-model="offsetDelta" @blur="saveOffsetDelta" placeholder="0=自动居中" />
			</view>
			<view class="tip-inline" v-if="protocol === 'lpapi'">
				全局微调量：0=自动居中；实测整体偏右就填负值（如 -1.5），偏左填正值。设一次对所有 LPAPI 打印（含测试页、模板打印）生效，换模板/换纸无需重调。
			</view>
			<text class="hint" v-if="printerLang && protocol === 'zebra'">当前语言：{{ printerLang }}</text>
			<textarea class="zpl-input" v-model="customZpl" maxlength="-1" placeholder="可粘贴 ZPL 指令；若只填纯文字会自动包装成一张标签" v-if="protocol === 'zebra'" />
			<view class="btn-row" v-if="protocol === 'zebra'">
			<button size="mini" @click="sendCustom('zpl')">发送 ZPL</button>
			</view>
			<view class="btn-row">
				<button size="mini" @click="setDefault">设为默认打印机</button>
				<button size="mini" type="warn" @click="doDisconnect">断开连接</button>
			</view>
		</view>

		<view class="card" v-if="connected">
			<text class="card-title">打印机维护</text>
			<view class="btn-row">
				<button size="mini" type="warn" @click="clearBuffer">清除打印缓存</button>
				<button size="mini" @click="calibrate">介质校准</button>
			</view>
			<view class="btn-row" v-if="protocol === 'zebra'">
				<button size="mini" @click="queryFonts">查询FNT字体</button>
				<button size="mini" @click="queryTtfFonts">查询TTF字体</button>
				<button size="mini" @click="checkAllFonts">检测中文字体</button>
			</view>
			<text class="hint" v-if="cjkFontStatus">{{ cjkFontStatus }}</text>
			<text class="hint" v-if="ttfFontStatus">{{ ttfFontStatus }}</text>
			<view class="btn-row" style="margin-top: 12rpx;" v-if="protocol === 'zebra'">
				<button size="mini" :type="forceTtf ? 'primary' : 'default'" @click="toggleForceTtf">
					{{ forceTtf ? '✓ 已强制TTF字体' : '强制TTF字体' }}
				</button>
			</view>
			<view class="tip-inline" v-if="forceTtf && protocol === 'zebra'">
				已开启强制 TTF 字体：中文将直接走 ^A@ 原生渲染，跳过蓝牙字体检测。
				适用于已通过 USB 灌入字体但蓝牙查询不到的情况。
			</view>
			<view class="tip-inline">
				清除打印缓存会取消打印机里所有排队和正在打印的任务，卡纸或误发大批量任务时用。
			</view>
		</view>

		<view class="card" v-if="connected && protocol === 'zebra'">
			<text class="card-title">中文渲染方式</text>
			<view class="tip-inline ok" v-if="printerHasTtfFont">
				当前使用 TTF 中文字体，原生渲染，速度快、清晰度高。位图渲染设置仅在 TTF 字体不可用时生效。
			</view>
			<view v-if="!printerHasTtfFont">
				<view class="btn-row">
					<button size="mini" :type="bitmapQuality === 'speed' ? 'primary' : 'default'" @click="setBitmapQuality('speed')">性能优先</button>
					<button size="mini" :type="bitmapQuality === 'clear' ? 'primary' : 'default'" @click="setBitmapQuality('clear')">清晰优先</button>
				</view>
				<view class="tip-inline">
					性能优先：关闭超采样，打印最快，小字号中文可能有锯齿/断笔。
					清晰优先：2x 超采样，小字号更清晰，但每次打印会慢 3-5 倍。
					仅对没有中文字体的打印机走位图渲染时生效。
				</view>
			</view>
		</view>

		<view class="card">
			<text class="card-title">标签模板</text>
			<view class="btn-row">
				<button size="mini" type="primary" @click="goTemplate">编辑标签模板</button>
				<button size="mini" @click="goImport">从 CodeSoft 导入</button>
			</view>
			<view class="tip-inline">在模板页可设置标签尺寸、页面参数，并添加文本、二维码、一维条码等元素。</view>
			<view class="tip-inline">电脑上已用 CodeSoft 画好的 .Lab 标签，先在 CSPrintService 里解析成二维码，再用「从 CodeSoft 导入」扫码，不用在 PDA 上重画。</view>
		</view>

		<view class="card" v-if="statusText">
			<text class="card-title">打印机状态</text>
			<text class="status-text">{{ statusText }}</text>
		</view>
	</view>
</template>

<script>
	import printer from '@/utils/printerManager.js'
	import lpapiPlugin from '@/utils/lpapi-uniplugin.js'
	import { buildTextLabel, getBitmapQuality, setBitmapQuality as setBitmapQualityFn } from '@/utils/zplTemplate.js'

	import settingsMixin from '@/common/settingsMixin.js'
export default {
	mixins: [settingsMixin],
		data() {
			return {
				btEnabled: false,
				devices: [],
				connectedAddress: '',
				connectedName: '',
				customZpl: '',
				statusText: '',
				manualAddress: '',
				permError: '',
				verified: false,
				printerLang: '',
				cjkFontStatus: '',
				ttfFontStatus: '',
				bitmapQuality: 'speed',
			forceTtf: false,
			printerHasTtfFont: false,
			lpapiCanvasW: 590,
			lpapiCanvasH: 354,
			protocol: printer.getProtocol(),
			offsetDelta: printer.getOffsetDelta(),
				protocolOptions: printer.protocolOptions
			}
		},
		computed: {
			connected() {
				return !!this.connectedAddress
			},
			connectedText() {
				if (!this.connected) return '未连接'
				return this.connectedName + (this.verified ? '' : '（无响应）')
			},
			manualNormalized() {
				return printer.normalizeAddress(this.manualAddress)
			},
			// 三种 BLE 标签机指令集（PDF 位图 / ESC / TPCL）共用 ibptm7330Adapter，
			// 测试按钮统一展示，方便同一台机器对比哪种能出纸。
			isBleLabelProto() {
				return ['esc', 'tpcl', 'pdf'].includes(this.protocol)
			}
		},
		onLoad() {
			// 用默认打印机预填，省得在小键盘上重新敲一遍地址
			const saved = printer.loadPrinter()
			if (saved && saved.address) this.manualAddress = saved.address
			// 若存在 dothan-lpapi-ble 插件，提前创建隐藏 canvas 的绘制上下文（官方示例在 onLoad 中调用）
			try {
				if (lpapiPlugin && lpapiPlugin.isReady && lpapiPlugin.isReady() && lpapiPlugin.initDrawContext) {
					lpapiPlugin.initDrawContext('lpapi-canvas-setting')
				}
				if (lpapiPlugin && lpapiPlugin.onCanvasSize) {
					this._offCanvasSize = lpapiPlugin.onCanvasSize((w, h) => {
						// 只同步 :style 显示尺寸（官方示例 updateCanvas）。绝不直接改 canvas 节点
						// 位图：SDK 已在 startJob 内把节点位图设成任务像素，直接改 node.width 会清空
						// SDK 的位图导致出纸空白。
						this.lpapiCanvasW = w
						this.lpapiCanvasH = h
					})
				}
			} catch (e) {
				console.log('[printSetting] lpapi initDrawContext skipped:', e.message)
			}
		},
		onShow() {
			// 切回本页画布，避免从其它打印页 navigateBack 后上下文错位
			try {
				if (lpapiPlugin && lpapiPlugin.setActiveCanvas) lpapiPlugin.setActiveCanvas('lpapi-canvas-setting')
			} catch (e) {}
			this.refresh()
			this.bitmapQuality = getBitmapQuality()
			this.forceTtf = printer.getForceTtf()
			this.printerHasTtfFont = printer.hasTtfFont()
			this.protocol = printer.getProtocol()
		},
		onUnload() {
			// 页面退出时保留连接，供业务页面复用；如需释放可调用 printer.disconnect()
			if (this._offCanvasSize) {
				this._offCanvasSize()
				this._offCanvasSize = null
			}
		},
		methods: {
			toast(title) {
				uni.showToast({ title, icon: 'none', duration: 2500 })
			},

		setBitmapQuality(mode) {
			setBitmapQualityFn(mode)
			this.bitmapQuality = mode
			this.toast(mode === 'clear' ? '已切换到清晰优先（打印会变慢）' : '已切换到性能优先')
		},

		setProtocol(proto) {
			this.protocol = proto
			printer.setProtocol(proto)
			this.toast('已选择协议: ' + (this.protocolOptions.find((p) => p.value === proto) || {}).label)
		},

		protocolLabelForAddress(addr) {
			const p = printer.getProtocolForAddress(addr)
			if (!p) return ''
			const o = this.protocolOptions.find((x) => x.value === p)
			return o ? o.label : p
		},

	syncConnection() {
		const cur = printer.getCurrentPrinter()
		this.connectedAddress = cur ? cur.address : ''
		this.connectedName = cur ? cur.name || cur.address : ''
		this.verified = !!(cur && cur.verified)
		this.printerHasTtfFont = printer.hasTtfFont()
		// LPAPI 已连接但 standard bluetooth currentPrinter 为空，需要额外检查
		if (!this.connectedAddress && printer.getProtocol() === 'lpapi' && printer.isConnected()) {
			this.connectedAddress = 'LPAPI'
			this.connectedName = cur && cur.name ? cur.name : 'LPAPI 已连接'
			this.verified = true
		}
	},

			async refresh() {
				// Android 12+ 没先拿到 BLUETOOTH_CONNECT 的话，getBondedDevices 直接抛 SecurityException，
				// 列表会空着，看起来就像「系统里配好对了，App 里却找不到设备」
				this.permError = ''
				try {
					await printer.requestPermissions()
				} catch (e) {
					this.permError = e.message
				}
				this.btEnabled = printer.isBluetoothEnabled()
				this.syncConnection()
				if (!this.btEnabled) {
					this.devices = []
					return
				}
				try {
					this.devices = printer.getPairedDevices()
				} catch (e) {
					this.devices = []
					if (!this.permError) this.toast(e.message)
				}
			},

			scanAddress() {
				uni.scanCode({
					success: (res) => {
						const addr = printer.normalizeAddress(res.result)
						if (!addr) return this.toast('扫到的内容里没有蓝牙地址：' + res.result)
						this.manualAddress = addr
						this.connectManual()
					},
					fail: () => this.toast('已取消扫码')
				})
			},

		connectManual() {
			if (this.protocol === 'lpapi') return this.toast('LPAPI 协议不能通过 MAC 地址连接，请从上方已配对列表中选择打印机')
			const addr = this.manualNormalized
			if (!addr) return this.toast('请输入 12 位十六进制蓝牙地址，如 AABBCCDDEEFF')
			this.manualAddress = addr
			this.connectDevice({ address: addr, name: '' })
		},

			turnOnBluetooth() {
				try {
					printer.enableBluetooth()
				} catch (e) {
					this.toast(e.message)
				}
			},

			openSettings() {
				try {
					printer.openBluetoothSettings()
				} catch (e) {
					this.toast(e.message)
				}
			},

	async connectDevice(dev) {
		if (dev.address === this.connectedAddress) return this.toast('已连接该打印机')
		// 套用这台打印机记住的指令集（优先于机型自动判断）
		const stored = printer.getProtocolForAddress(dev.address)
		if (stored) {
			if (stored !== this.protocol) {
				this.protocol = stored
				this.toast('已套用该打印机记住的指令集：' + (this.protocolOptions.find((p) => p.value === stored) || {}).label)
			}
		} else {
			// 无记忆时按机型自动判断（如 IB-PTM 系列→LPAPI，Zebra→ZPL）
			const guessed = printer.detectProtocolByName(dev.name)
			if (guessed && guessed !== this.protocol) {
				this.protocol = guessed
				printer.setProtocol(guessed)
				this.toast('已按机型自动选择指令集：' + (this.protocolOptions.find((p) => p.value === guessed) || {}).label)
			}
		}
		// 把当前指令集记到这台打印机上（用户显式选择即意图，无论本次是否连成功都记住）
		printer.saveProtocolForAddress(dev.address, this.protocol)
		console.log('[printSetting] connectDevice:', dev.address, dev.name, 'protocol:', this.protocol)
		uni.showLoading({ title: this.protocol === 'lpapi' ? 'LPAPI 连接中...' : '连接中，最长约 20 秒...', mask: true })
		try {
			const cur = await printer.connect(dev.address, dev.name, this.protocol)
			console.log('[printSetting] connect result:', JSON.stringify(cur))
			this.syncConnection()
					uni.hideLoading()
					if (cur.verified) {
						this.toast('连接成功，打印机已响应')
					} else {
						uni.showModal({
							title: '连接未确认',
							content: '蓝牙通道已打开，但打印机没有回应状态查询，这时候打印可能不出纸。请确认打印机已开机并处于蓝牙配对/可连接模式，然后重新连接。',
							showCancel: false
						})
					}
			} catch (e) {
				uni.hideLoading()
				console.error('[printSetting] connect error:', e.message)
				this.syncConnection()
				this.toast(e.message)
			}
			},

			doDisconnect() {
				printer.disconnect()
				this.statusText = ''
				this.syncConnection()
				this.toast('已断开')
			},

			async testZpl() {
				try {
					await printer.printZplTest()
					this.toast('ZPL 指令已发送')
				} catch (e) {
					this.toast(e.message)
				}
			},

		async testIbptm7330Pdf() {
			console.log('[printSetting] testIbptm7330Pdf start, protocol:', this.protocol)
			uni.showLoading({ title: 'PDF位图渲染中...', mask: true })
			try {
				await printer.printTestPdf()
				uni.hideLoading()
				console.log('[printSetting] testIbptm7330Pdf success')
				this.toast('PDF位图测试已发送')
			} catch (e) {
				uni.hideLoading()
				console.error('[printSetting] testIbptm7330Pdf error:', e.message)
				this.toast(e.message)
			}
		},

		async testIbptm7330Tpcl() {
			console.log('[printSetting] testIbptm7330Tpcl start, protocol:', this.protocol)
			uni.showLoading({ title: '发送TPCL指令中...', mask: true })
			try {
				await printer.printTestTpcl()
				uni.hideLoading()
				console.log('[printSetting] testIbptm7330Tpcl success')
				this.toast('TPCL标准指令已发送')
			} catch (e) {
				uni.hideLoading()
				console.error('[printSetting] testIbptm7330Tpcl error:', e.message)
				this.toast(e.message)
			}
		},

		async testIbptm7330Esc() {
			console.log('[printSetting] testIbptm7330Esc start, protocol:', this.protocol)
			uni.showLoading({ title: '发送ESC/POS指令中...', mask: true })
			try {
				await printer.printTestEsc()
				uni.hideLoading()
				console.log('[printSetting] testIbptm7330Esc success')
				this.toast('ESC/POS标准指令已发送')
			} catch (e) {
				uni.hideLoading()
				console.error('[printSetting] testIbptm7330Esc error:', e.message)
				this.toast(e.message)
			}
		},

		async testIbptm7330Text() {
			console.log('[printSetting] testIbptm7330Text start, protocol:', this.protocol)
			uni.showLoading({ title: '位图渲染中...', mask: true })
			try {
				await printer.printText('直流模块(TY)\nSN: 7330-' + Date.now().toString().slice(-6) + '\n' + new Date().toLocaleString())
				uni.hideLoading()
				console.log('[printSetting] testIbptm7330Text success')
				this.toast('中文文本测试已发送')
			} catch (e) {
				uni.hideLoading()
				console.error('[printSetting] testIbptm7330Text error:', e.message)
				this.toast(e.message)
			}
		},

		async testLpapi() {
			console.log('[printSetting] testLpapi start, protocol:', this.protocol)
			uni.showLoading({ title: 'LPAPI 打印中...', mask: true })
			try {
				await printer.printTestLpapi()
				uni.hideLoading()
				console.log('[printSetting] testLpapi success')
				this.toast('LPAPI 综合测试已提交')
			} catch (e) {
				uni.hideLoading()
				console.error('[printSetting] testLpapi error:', e.message)
				this.toast(e.message)
			}
		},

		saveOffsetDelta() {
			const n = Number(this.offsetDelta)
			printer.setOffsetDelta(isNaN(n) ? 0 : n)
			this.toast('水平偏移微调已保存：' + (isNaN(n) ? 0 : n) + ' mm（对所有 LPAPI 打印生效）')
		},

		async testLpapiText() {
			console.log('[printSetting] testLpapiText start, protocol:', this.protocol)
			uni.showLoading({ title: 'LPAPI 打印中...', mask: true })
			try {
				await printer.printText('直流模块(TY)\nSN: 7330-' + Date.now().toString().slice(-6) + '\n' + new Date().toLocaleString())
				uni.hideLoading()
				console.log('[printSetting] testLpapiText success')
				this.toast('LPAPI 中文文本已提交')
			} catch (e) {
				uni.hideLoading()
				console.error('[printSetting] testLpapiText error:', e.message)
				this.toast(e.message)
			}
		},

		async queryLang() {
			uni.showLoading({ title: '查询中...', mask: true })
			try {
				const lang = await printer.queryLanguage()
				this.printerLang = lang || '（无回复）'
				uni.hideLoading()
				this.toast('当前语言: ' + (lang || '无回复'))
			} catch (e) {
				uni.hideLoading()
				this.toast(e.message)
			}
		},

		switchToZpl() {
			uni.showModal({
				title: '切换到 ZPL 模式',
				content: '切换后打印机会重启，蓝牙连接会断开。重启完成后请重新连接打印机。',
				success: (res) => {
					if (!res.confirm) return
					uni.showLoading({ title: '切换中...', mask: true })
					printer.setLanguage('zpl').then(() => {
						uni.hideLoading()
						this.printerLang = 'zpl（切换中，等待重启）'
						this.toast('指令已发送，打印机重启中，请等待后重新连接')
					}).catch((e) => {
						uni.hideLoading()
						this.toast('切换失败: ' + e.message)
					})
				}
			})
		},

			sendCustom(lang) {
				const text = this.customZpl.trim()
				if (!text) return this.toast('请先输入指令')
				try {
					// 纯文字不是合法 ZPL，打印机会直接丢弃，这里自动包成一张标签
					const isZpl = text.indexOf('^XA') !== -1 || text.charAt(0) === '~'
					const fontOpts = {
						hasTtfFont: printer.hasTtfFont(),
						ttfFontPath: printer.getCjkFontPath(),
						hasCjkFont: printer.hasCjkFont()
					}
					printer.sendZpl(isZpl ? text : buildTextLabel(text, '', fontOpts))
					this.toast(isZpl ? '已发送' : '输入不是 ZPL 指令，已自动包装成标签打印')
				} catch (e) {
					this.toast(e.message)
				}
			},

			async clearBuffer() {
				uni.showLoading({ title: '清除中...', mask: true })
				try {
					await printer.clearBuffer()
					uni.hideLoading()
					this.toast('已清除打印机缓存')
				} catch (e) {
					uni.hideLoading()
					this.toast(e.message)
				}
			},

			async calibrate() {
				try {
					await printer.calibrate()
					this.toast('已发送校准指令，打印机会走纸测量')
				} catch (e) {
					this.toast(e.message)
				}
			},

		async queryFonts() {
			uni.showLoading({ title: '查询中...', mask: true })
			try {
				const fonts = await printer.listPrinterFonts()
				uni.hideLoading()
				this.statusText = '打印机字体文件:\n' + fonts.join('\n')
			} catch (e) {
				uni.hideLoading()
				this.toast(e.message)
			}
		},
	async checkAllFonts() {
		uni.showLoading({ title: '检测中...', mask: true })
		try {
		await printer.checkCjkFont()
		const hasTtf = printer.hasTtfFont()
			this.printerHasTtfFont = hasTtf
			uni.hideLoading()
			this.cjkFontStatus = hasTtf
				? '中文字体已就绪：检测到 HANS.TTF 等 TTF → 原生渲染'
				: '未检测到中文 TTF 字体 → 中文走位图渲染'
			this.ttfFontStatus = hasTtf
				? 'TTF 中文字体：有（HANS.TTF 等）→ 中文走 ^A@ 原生渲染'
				: 'TTF 字体：无 → 中文走位图渲染'
		} catch (e) {
			uni.hideLoading()
			this.cjkFontStatus = '检测失败：' + e.message
		}
	},

	toggleForceTtf() {
		const newVal = !this.forceTtf
		printer.setForceTtf(newVal)
		this.forceTtf = newVal
		this.printerHasTtfFont = printer.hasTtfFont()
		this.toast(newVal ? '已开启强制 TTF 字体' : '已关闭强制 TTF 字体')
	},

	async queryTtfFonts() {
		uni.showLoading({ title: '查询中...', mask: true })
		try {
			const fonts = await printer.listTtfFonts()
			uni.hideLoading()
			this.statusText = 'TTF 字体文件:\n' + (fonts.length ? fonts.join('\n') : '（无 TTF 文件）')
		} catch (e) {
			uni.hideLoading()
			this.toast(e.message)
		}
	},

			goTemplate() {
				uni.navigateTo({ url: '/pages/print/labelTemplate' })
			},

			goImport() {
				uni.navigateTo({ url: '/pages/print/labelImport' })
			},

			async queryStatus() {
				uni.showLoading({ title: '查询中...', mask: true })
				try {
					const s = await printer.getStatus()
					uni.hideLoading()
					if (this.protocol !== 'zebra' && !s.raw) {
						// ESC/POS 等非 Zebra 协议，getStatus 只返回连接状态
						this.statusText = s.message || '（无详细状态）'
						return
					}
					const st = s.raw || {}
					if (!st.parsed) {
						this.statusText = '未能解析状态回复：' + (s.message || s.raw || '')
						return
					}
					this.statusText = [
						'可打印: ' + (st.isReadyToPrint ? '是' : '否'),
						'缺纸: ' + (st.isPaperOut ? '是' : '否'),
						'暂停: ' + (st.isPaused ? '是' : '否'),
						'打印头打开: ' + (st.isHeadOpen ? '是' : '否'),
						'碳带用尽: ' + (st.isRibbonOut ? '是' : '否'),
						'缓冲区满: ' + (st.isReceiveBufferFull ? '是' : '否'),
						'标签长度(点): ' + st.labelLengthInDots
					].join('\n')
				} catch (e) {
					uni.hideLoading()
					this.statusText = ''
					this.toast(e.message)
				}
			},

			setDefault() {
				const cur = printer.getCurrentPrinter()
				if (!cur) return this.toast('请先连接打印机')
				// verified 只对本次连接有意义，别存进去下次误读
				printer.savePrinter({ address: cur.address, name: cur.name })
				// 同时把当前指令集记到这台打印机上
				if (cur.address) printer.saveProtocolForAddress(cur.address, this.protocol)
				this.toast('已设为默认打印机')
			}
		}
	}
</script>

<style scoped>
	.container {
		padding: 20rpx;
		background: var(--color-bg-page);
		min-height: 100vh;
	}

	.card {
		background: var(--color-bg-card);
		border-radius: 12rpx;
		padding: 24rpx;
		margin-bottom: 20rpx;
	}

	.card-title {
		font-size: var(--font-lg);
		font-weight: bold;
		color: var(--color-text);
		display: block;
		margin-bottom: 16rpx;
	}

	.hint {
		font-size: var(--font-sm);
		color: #888;
		display: block;
		margin: 8rpx 0;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12rpx 0;
	}

	.label {
		font-size: var(--font-lg);
		color: var(--color-text-secondary);
	}

	.ipt {
		flex: 1;
		margin-left: 20rpx;
		padding: 8rpx 16rpx;
		font-size: var(--font-lg);
		border: 1rpx solid var(--color-border);
		border-radius: 8rpx;
		background: var(--color-bg-card);
	}

	.value {
		font-size: var(--font-lg);
	}

	.ok {
		color: #07c160;
	}

	.warn {
		color: #fa5151;
	}

	.btn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 16rpx;
		margin-top: 16rpx;
	}

	.tip {
		font-size: var(--font-sm);
		color: var(--color-text-hint);
		padding: 0 12rpx 20rpx;
		line-height: 1.6;
	}

	.tip-inline {
		font-size: 23rpx;
		color: var(--color-text-hint);
		line-height: 1.6;
		margin-top: 14rpx;
	}

	.tip-inline.ok {
		color: #07c160;
	}

	.empty {
		font-size: var(--font-md);
		color: var(--color-text-hint);
		text-align: center;
		padding: 30rpx 0;
	}

	.device-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24rpx 16rpx;
		border-bottom: 1rpx solid #eee;
	}

	.device-item.active {
		background: #f0fff5;
	}

	.device-info {
		display: flex;
		flex-direction: column;
	}

	.device-name {
		font-size: var(--font-lg);
		color: var(--color-text);
	}

	.badge {
		font-size: var(--font-xs);
		color: #fff;
		background: #E8833A;
		border-radius: 6rpx;
		padding: 2rpx 10rpx;
		margin-left: 12rpx;
	}

	.device-addr {
		font-size: var(--font-sm);
		color: var(--color-text-hint);
		margin-top: 6rpx;
	}

	.device-state {
		font-size: var(--font-md);
		color: #576b95;
	}

	.addr-row {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.addr-input {
		flex: 1;
		height: 72rpx;
		border: 1rpx solid #ddd;
		border-radius: 8rpx;
		padding: 0 16rpx;
		font-size: var(--font-lg);
		box-sizing: border-box;
	}

	.addr-preview {
		display: block;
		font-size: var(--font-sm);
		color: #07c160;
		margin-top: 12rpx;
	}

	.addr-preview.bad {
		color: #fa5151;
	}

	.zpl-input {
		width: 100%;
		height: 200rpx;
		border: 1rpx solid #ddd;
		border-radius: 8rpx;
		padding: 16rpx;
		font-size: var(--font-sm);
		box-sizing: border-box;
		margin-top: 16rpx;
	}

	.status-text {
		font-size: var(--font-md);
		color: var(--color-text);
		line-height: 1.8;
		white-space: pre-wrap;
	}
</style>
