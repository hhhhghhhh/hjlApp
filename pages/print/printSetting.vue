<template>
	<view class="container">
		<view class="card">
			<view class="row">
				<text class="label">蓝牙状态</text>
				<text :class="['value', btEnabled ? 'ok' : 'warn']">{{ btEnabled ? '已开启' : '未开启' }}</text>
			</view>
			<view class="row">
				<text class="label">当前打印机</text>
				<text :class="['value', connected ? 'ok' : 'warn']">{{ connected ? connectedName : '未连接' }}</text>
			</view>
			<view class="btn-row">
				<button size="mini" @click="openSettings">系统蓝牙设置</button>
				<button size="mini" @click="refresh">刷新设备</button>
				<button size="mini" v-if="!btEnabled" type="primary" @click="turnOnBluetooth">开启蓝牙</button>
			</view>
		</view>

		<view class="tip">
			打印机需先在「系统蓝牙设置」中完成配对，配对后回到本页刷新即可看到。
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
				</view>
				<text class="device-state">{{ dev.address === connectedAddress ? '已连接' : '点击连接' }}</text>
			</view>
		</view>

		<view class="card" v-if="connected">
			<text class="card-title">打印测试</text>
			<view class="btn-row">
				<button size="mini" type="primary" @click="testZpl">ZPL 测试</button>
				<button size="mini" type="primary" @click="testCpcl">CPCL 测试</button>
				<button size="mini" @click="queryStatus">查询状态</button>
			</view>
			<textarea class="zpl-input" v-model="customZpl" placeholder="可粘贴 ZPL/CPCL 指令；若只填纯文字会自动包装成一张标签" />
			<view class="btn-row">
				<button size="mini" @click="sendCustom('zpl')">发送 ZPL</button>
				<button size="mini" @click="sendCustom('cpcl')">发送 CPCL</button>
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
				<button size="mini" @click="queryFonts">查询打印机字体</button>
			</view>
			<view class="tip-inline">
				清除打印缓存会取消打印机里所有排队和正在打印的任务（ZPL ~JX / ~JA），卡纸或误发大批量任务时用。
			</view>
		</view>

		<view class="card">
			<text class="card-title">标签模板</text>
			<view class="btn-row">
				<button size="mini" type="primary" @click="goTemplate">编辑标签模板</button>
			</view>
			<view class="tip-inline">在模板页可设置标签尺寸、页面参数，并添加文本、二维码、一维条码等元素。</view>
		</view>

		<view class="card" v-if="statusText">
			<text class="card-title">打印机状态</text>
			<text class="status-text">{{ statusText }}</text>
		</view>
	</view>
</template>

<script>
	import printer from '@/utils/zebraPrinter.js'
	import { buildTextLabel } from '@/utils/zplTemplate.js'

	export default {
		data() {
			return {
				btEnabled: false,
				devices: [],
				connectedAddress: '',
				connectedName: '',
				customZpl: '',
				statusText: ''
			}
		},
		computed: {
			connected() {
				return !!this.connectedAddress
			}
		},
		onShow() {
			this.refresh()
		},
		onUnload() {
			// 页面退出时保留连接，供业务页面复用；如需释放可调用 printer.disconnect()
		},
		methods: {
			toast(title) {
				uni.showToast({ title, icon: 'none', duration: 2500 })
			},

			syncConnection() {
				const cur = printer.getCurrentPrinter()
				this.connectedAddress = cur ? cur.address : ''
				this.connectedName = cur ? cur.name || cur.address : ''
			},

			refresh() {
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
					this.toast(e.message)
				}
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
				if (dev.address === this.connectedAddress) return
				uni.showLoading({ title: '连接中...', mask: true })
				try {
					await printer.connect(dev.address, dev.name)
					this.syncConnection()
					uni.hideLoading()
					this.toast('连接成功')
				} catch (e) {
					uni.hideLoading()
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

			testZpl() {
				try {
					printer.printZplTest()
					this.toast('ZPL 指令已发送')
				} catch (e) {
					this.toast(e.message)
				}
			},

			testCpcl() {
				try {
					printer.printCpclTest()
					this.toast('CPCL 指令已发送')
				} catch (e) {
					this.toast(e.message)
				}
			},

			sendCustom(lang) {
				const text = this.customZpl.trim()
				if (!text) return this.toast('请先输入指令')
				try {
					if (lang === 'cpcl') {
						printer.sendCpcl(text)
						return this.toast('已发送')
					}
					// 纯文字不是合法 ZPL，打印机会直接丢弃，这里自动包成一张标签
					const isZpl = text.indexOf('^XA') !== -1 || text.charAt(0) === '~'
					printer.sendZpl(isZpl ? text : buildTextLabel(text))
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

			calibrate() {
				try {
					printer.calibrate()
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

			goTemplate() {
				uni.navigateTo({ url: '/pages/print/labelTemplate' })
			},

			async queryStatus() {
				uni.showLoading({ title: '查询中...', mask: true })
				try {
					const s = await printer.getStatus()
					uni.hideLoading()
					if (!s.parsed) {
						this.statusText = '未能解析 ~HS 回复，原始数据：' + s.raw
						return
					}
					this.statusText = [
						'可打印: ' + (s.isReadyToPrint ? '是' : '否'),
						'缺纸: ' + (s.isPaperOut ? '是' : '否'),
						'暂停: ' + (s.isPaused ? '是' : '否'),
						'打印头打开: ' + (s.isHeadOpen ? '是' : '否'),
						'碳带用尽: ' + (s.isRibbonOut ? '是' : '否'),
						'缓冲区满: ' + (s.isReceiveBufferFull ? '是' : '否'),
						'标签长度(点): ' + s.labelLengthInDots
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
				printer.savePrinter(cur)
				this.toast('已设为默认打印机')
			}
		}
	}
</script>

<style scoped>
	.container {
		padding: 20rpx;
		background: #f5f5f5;
		min-height: 100vh;
	}

	.card {
		background: #fff;
		border-radius: 12rpx;
		padding: 24rpx;
		margin-bottom: 20rpx;
	}

	.card-title {
		font-size: 30rpx;
		font-weight: bold;
		color: #333;
		display: block;
		margin-bottom: 16rpx;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12rpx 0;
	}

	.label {
		font-size: 28rpx;
		color: #666;
	}

	.value {
		font-size: 28rpx;
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
		font-size: 24rpx;
		color: #999;
		padding: 0 12rpx 20rpx;
		line-height: 1.6;
	}

	.tip-inline {
		font-size: 23rpx;
		color: #999;
		line-height: 1.6;
		margin-top: 14rpx;
	}

	.empty {
		font-size: 26rpx;
		color: #999;
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
		font-size: 30rpx;
		color: #333;
	}

	.badge {
		font-size: 20rpx;
		color: #fff;
		background: #E8833A;
		border-radius: 6rpx;
		padding: 2rpx 10rpx;
		margin-left: 12rpx;
	}

	.device-addr {
		font-size: 24rpx;
		color: #999;
		margin-top: 6rpx;
	}

	.device-state {
		font-size: 26rpx;
		color: #576b95;
	}

	.zpl-input {
		width: 100%;
		height: 200rpx;
		border: 1rpx solid #ddd;
		border-radius: 8rpx;
		padding: 16rpx;
		font-size: 24rpx;
		box-sizing: border-box;
		margin-top: 16rpx;
	}

	.status-text {
		font-size: 26rpx;
		color: #333;
		line-height: 1.8;
		white-space: pre-wrap;
	}
</style>
