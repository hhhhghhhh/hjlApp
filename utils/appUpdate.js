// utils/appUpdate.js
// 从后端下载 snApp.apk 并安装。
//
// 设计前提（与后端 PdaAppUpdateController 配套）：
//   1. 不做版本比较 —— 服务器上 jar 同目录的 snApp.apk 就是唯一标准版本，
//      换版本只需替换该文件，前端无需改动、无需重新打包。
//   2. 安装用 force:true —— 不校验版本号直接覆盖安装，服务器上的包是什么就装什么。
//
// 后端接口：GET /imes/api/pda/app/downloadSnApp（Shiro 已放行，无需 token）

const APK_NAME = 'snApp.apk'

// 与 utils/request.js 保持一致的基址拼法
function buildUrl() {
	const host = uni.getStorageSync('pdaHost')
	const port = uni.getStorageSync('pdaPort')
	if (!host || !port) throw new Error('未配置服务器地址，请先登录')

	// t= 时间戳防缓存：保证运维替换 APK 后立刻能拉到新包
	let url = 'http://' + host + ':' + port + '/imes/api/pda/app/downloadSnApp?t=' + Date.now()

	// ⚠️ 关键：plus.downloader 不支持自定义 header，但后端的两个拦截器都支持从 URL 参数读取：
	//   - TenantRequestHandler.preHandle()：header 拿不到 tenantId 时读 request.getParameter("tenantId")
	//   - JwtFilter：header 拿不到 Authorization 时读 request.getParameter("Authorization")
	// 少了租户 ID，TenantRequestHandler 会 sendRedirect("/403.html")，
	// 下载器跟着重定向后拿到的是 403 页面 —— 表现就是 status=200 但文件 0 字节。
	const tenantId = uni.getStorageSync('factoryId') || uni.getStorageSync('tenantId')
	if (tenantId) url += '&tenantId=' + encodeURIComponent(tenantId)
	const token = uni.getStorageSync('token')
	if (token) url += '&Authorization=' + encodeURIComponent(token)

	console.log('[appUpdate] 带租户ID: ' + (tenantId ? '是' : '否（可能被拦截）'))
	return url
}

function fmtSize(bytes) {
	if (bytes === 0) return '0 字节'
	if (!bytes) return '未知大小'
	const mb = bytes / 1024 / 1024
	return mb >= 1 ? mb.toFixed(1) + 'MB' : Math.round(bytes / 1024) + 'KB'
}

function errText(e) {
	if (e == null) return '未知错误'
	if (typeof e === 'string') return e
	if (e.message) return e.message
	if (e.errMsg) return e.errMsg
	if (e.code != null) return 'code=' + e.code
	try {
		const s = JSON.stringify(e)
		return s === '{}' ? String(e) : s
	} catch (_) {
		return String(e)
	}
}

// 并发锁：连点「更新应用」会启动两次下载写同一个文件，导致文件损坏
let _downloading = false

/**
 * 下载 snApp.apk 到 _downloads/snApp.apk，返回可传给 plus.runtime.install 的路径。
 *
 * 用 plus.downloader 原生流式下载，直接落盘：
 *   - 不经过 JS 字节拼装、不碰 5+ FileWriter，是 5+ 处理大文件（15MB+）最稳的路径。
 *   - 之前卡死的根因是 writeAsBinary 要拼 1579 万字符的二进制串，FileWriter 直接卡死；
 *     而 plus.downloader 走独立原生下载服务，毫无压力。
 *   - 之前 plus.downloader 写 0 字节的唯一原因是 URL 缺租户参数被 302 到 403 页面，
 *     现在 tenantId/Authorization 已作为 URL 参数带上，可正常拿到真实 APK。
 */
export function downloadApk(onProgress) {
	if (_downloading) {
		return Promise.reject(new Error('正在下载中，请稍候'))
	}
	_downloading = true
	const finish = () => { _downloading = false }

	const url = buildUrl()
	const filename = '_downloads/' + APK_NAME

	return new Promise((resolve, reject) => {
		console.log('[appUpdate] 下载(plus.downloader): ' + url)

		const dtask = plus.downloader.createDownload(
			url,
			{ filename, timeout: 180, retry: 1 },
			(download, status) => {
				if (status !== 200) {
					if (status === 404) {
						reject(new Error('服务器上未找到 snApp.apk，请联系管理员上传'))
					} else {
						reject(new Error('下载失败（HTTP ' + status + '）'))
					}
					return
				}
				const fp = download.filename
				plus.io.resolveLocalFileSystemURL(fp, (entry) => {
					entry.file((f) => {
						const real = Number(f.size) || 0
						console.log('[appUpdate] 下载完成: ' + fp + '，' + real + ' 字节')
						if (real < 1024 * 1024) {
							reject(new Error('下载的文件异常（' + fmtSize(real) + '），请检查服务器上的 snApp.apk'))
							return
						}
						resolve(fp)
					}, (e) => reject(new Error('读取文件大小失败：' + errText(e))))
				}, (e) => reject(new Error('无法访问下载文件：' + errText(e))))
			}
		)

		if (onProgress) {
			let lastEmit = 0
			dtask.addEventListener('statechanged', (d) => {
				const loaded = Number(d.downloadedSize) || 0
				let total = Number(d.totalSize) || 0
				// 兜底：部分机型 / 调试基座上 totalSize 取不到，改从响应头 Content-Length 读
				if (!total && d.responseHeaders) {
					const cl = d.responseHeaders['Content-Length'] || d.responseHeaders['content-length']
					if (cl) total = parseInt(cl, 10) || 0
				}
				const now = Date.now()
				// 有下载量就回报（至少让 UI 动起来），但节流到 200ms 一次，避免刷爆
				if (loaded > 0 && now - lastEmit >= 200) {
					lastEmit = now
					if (total > 0) {
						const p = Math.min(100, Math.round((loaded / total) * 100))
						onProgress({ progress: p, text: fmtSize(loaded) + ' / ' + fmtSize(total) })
					} else {
						// 未知总大小：progress=-1，让 UI 显示「已下载 xx MB」而不是卡在 0%
						onProgress({ progress: -1, text: '已下载 ' + fmtSize(loaded) })
					}
				}
			})
		}
		dtask.start()
	})
		.then(
			(v) => { finish(); return v },
			(e) => { finish(); throw e }
		)
}

/**
 * 是否已获得「安装未知应用」权限。
 * Android 8.0(API 26)+ 才有这个概念；该权限是特殊权限，运行时弹窗申请无效，只能跳设置页。
 */
export function canRequestInstall() {
	// #ifdef APP-PLUS
	try {
		if (uni.getSystemInfoSync().platform !== 'android') return true
		const main = plus.android.runtimeMainActivity()
		const Build = plus.android.importClass('android.os.Build')
		// 反射下 SDK_INT 是直接字段，不能写成 Build.VERSION.SDK_INT()
		if (Build.VERSION.SDK_INT < 26) return true
		const pm = main.getPackageManager()
		plus.android.importClass(pm)
		return pm.canRequestPackageInstalls()
	} catch (e) {
		console.warn('[appUpdate] 安装权限检查失败，按已授权处理', e)
		return true
	}
	// #endif
	return true
}

/** 跳转到本应用的「允许安装未知应用」设置页 */
export function openInstallSetting() {
	// #ifdef APP-PLUS
	try {
		const Intent = plus.android.importClass('android.content.Intent')
		const Settings = plus.android.importClass('android.provider.Settings')
		const Uri = plus.android.importClass('android.net.Uri')
		const main = plus.android.runtimeMainActivity()
		const intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
		intent.setData(Uri.parse('package:' + main.getPackageName()))
		main.startActivityForResult(intent, 1001)
	} catch (e) {
		console.warn('[appUpdate] 跳转设置页失败', e)
	}
	// #endif
}

/**
 * 安装 APK。
 * force:true —— 不校验版本号，直接覆盖安装。服务器上放的是什么版本就装什么版本，
 * 运维不必每次发版都去改 versionCode；同版本重装修复也走得通。
 */
export function installApk(filePath) {
	return new Promise((resolve, reject) => {
		plus.runtime.install(filePath, { force: true }, () => {
			resolve()
		}, (err) => {
			reject(new Error((err && err.message) || '安装失败'))
		})
	})
}
