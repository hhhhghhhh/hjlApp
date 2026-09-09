# hjlApp 项目长期记忆

## 项目概况
- uni-app v3 蓝牙打印 PDA 应用，目标平台 Android
- 核心功能：标签模板设计 + 蓝牙打印 + CodeSoft 标签导入
- 打印机适配以 Zebra ZPL 为主，已扩展多指令集架构（Zebra + IB-PTM7330）

## 打印机适配
- **ZR668**：Zebra 便携机，203dpi，ZPL2 模式
  - **自带 HANS.TTF（19MB，简体中文）**，之前误以为没有中文字体是因为只查了 `*.FNT` 没查 `*.TTF`
  - NOTOMRJ.TTF 下载实际未成功（`~DY` 参数格式 bug），测试打印出中文是打印机自动回退到 HANS.TTF
  - 中文渲染：优先 `^A@ E:HANS.TTF`（自动检测），后备位图渲染 `^GFA`
- **ZD410**：Zebra 桌面机（历史上曾内置 GB18030.FNT；本 App 现已统一走 HANS.TTF，不再依赖 GB18030）
- **IB-PTM7330**：ESC/POS 位图指令集，硬件固定 300dpi，50x30mm 标签
  - 无内置中文字体，所有内容（含中文）通过 Android Canvas 渲染为位图后按行下发
  - 关键命令：`1B 40` 初始化、`1F 27 01 n 88` 设宽度(mm)、`1F 2A` 打印行、`1F 2B` 压缩前导空白、`1F 2E` 重复行、`0C` 走纸
  - **DPI 铁律**：位图分辨率必须 = 硬件 300dpi（`this.dpi`），**绝不能用模板的 `page.dpi`(默认 203)**。模板 203 只给 ZPL 点指令和 LPAPI 点值→mm 换算用，对位图机无效。`printTemplate`/`printTextLines`/`setLabelSize` 现均已忽略任何外部 dpi、固定用 `this.dpi`(300)。
- **PTM230X**（道臻 dothan-lpapi-ble SDK，LPAPI 协议，当前主力蓝牙机型）：300dpi，打印头实测 `printerWidth=576点≈48.8mm`；`softwareFlags=0xd0` 派生 `printerAlignment=0=右对齐`。偏移/对齐全部以连接 `getPrinterInfo()` 读到为准（见下方"LPAPI 偏移基准铁律"）。

## 多指令集架构
- 连接层(printerConnection)与指令集无关，各适配器(Adapter)封装具体指令
- 新增机型只需在 adapters/ 目录实现适配器 + 在 printerAdapter.js 工厂注册
- 业务页面统一用 `printerManager` 的 `printTemplate(tpl, data)`，自动选协议 + 传字体状态
- `zebraPrinter.js` 已改为兼容 shim，旧 import 透明转发到新架构

## 技术约定
- 5+ App Android 反射模式：`plus.android.importClass` / `inv(obj, method)` / 直接字段访问
- JS Function.prototype.valueOf 会拦截 Class 代理上的 valueOf 调用，必须用直接字段访问
- `typeof null === 'object'`，判断类型时先排除 null
- 蓝牙通信走经典蓝牙 SPP（UUID 00001101）
- ZPL 中文用 `^CI28` (UTF-8) 编码

## 关键文件
- `utils/printerConnection.js` — 通用蓝牙 SPP 连接层（与指令集无关）
- `utils/printerAdapter.js` — 适配器基类与工厂（多指令集架构核心）
- `utils/printerManager.js` — 多协议统一入口（对外 API）
- `utils/adapters/zebraAdapter.js` — Zebra ZPL 适配器
- `utils/adapters/ibptm7330Adapter.js` — IB-PTM7330 ESC/POS 位图适配器
- `utils/zebraPrinter.js` — 兼容 shim（透明转发到 printerManager）
- `utils/zplTemplate.js` — ZPL 模板生成 + CJK 渲染策略（支持 opts.font 传字体状态）
- `utils/labTemplate.js` — CSPrintService 解析结果 → 中性模板（`toZplTemplate` 兼容 pdaTemplate 与 detail 双格式；`decodePayload` 解离线码 gzip+base64 / 回连码 JSON）
- `utils/cjkBitmap.js` — ZPL 位图渲染（Android Canvas + Paint 反射）
- `tools/download_font_v3.py` — Zebra CISDF 字体剥离 + 裁剪 + 下载工具

## CJK 渲染策略（本机已弃用 GB18030.FNT）
- 统一走 TTF：`^A@ E:HANS.TTF`（自动检测 HANS/HANT/NOTOMRJ）。**不再使用 `E:GB18030.FNT`**（本机 Zebra 无此文件）。
- 兜底：无 HANS.TTF 时降级 Android Canvas 位图 `^GFA`。
- 模板 `cjkFont` 默认值、`getCjkFontPath()` 兜底、所有降级路径均已改为 `E:HANS.TTF`。

## LPAPI (dothan-lpapi-ble) 打印关键约束
- **每个 LPAPI 打印页/组件必须自带隐藏 canvas，且 canvas-id 必须全局唯一**：
  `<canvas type="2d" canvas-id="lpapi-canvas-label" id="lpapi-canvas-label" :style="{width:lpapiCanvasW+'px',height:lpapiCanvasH+'px'}" style="position:fixed;left:-999999rpx;top:-999999rpx"></canvas>`。
  各页唯一 id：printSetting=`lpapi-canvas-setting`、labelTemplate=`lpapi-canvas-label`、labelImport=`lpapi-canvas-import`、snPrintList 组件=`lpapi-canvas-sn`。
  并在 `onLoad` 调 `initDrawContext(<本页id>)`；页面还要在 `onShow` 调 `setActiveCanvas(<本页id>)`（组件在打印前调），保证 navigateBack 回来后"当前画布"切回本页。
  缺 canvas → `createDrawContext` 失败、打印无反应。
- **startJob 后只需同步 `:style`（CSS 显示尺寸），绝不能直接改 canvas 节点的 `width/height` 位图属性**（官方 `updateCanvas` 只改 `:style`）。SDK 在 `startJob` 内部已把页面 canvas 节点位图设成任务像素（`this.Canvas.width = 像素`）；若我们再 `node.width = w` 会把 SDK 的位图清空 → 出纸空白。像素 = `round(mm × printerDPI/25.4)`，优先用 `job.canvas.width/height`（SDK 返回），兜底才自己算。本仓库用 `lpapiPlugin.onCanvasSize/emitCanvasSize` 事件总线在适配器 `_startJob` 后通知页面把 `lpapiCanvasW/H` 改成任务像素、等 ~120ms，仅此而已。
- **DPI**：该打印机实测 `printerDPI=300`，不要写死 203。适配器构造默认 300，`connect` 后用 `getPrinterInfo().printerDPI` 校正；模板点值→mm 回落用 `designDpi = tpl.page.dpi || printerDpi || 300`。
- 涉及文件：`utils/lpapi-uniplugin.js`（事件总线）、`utils/adapters/lpapiAdapter.js`（`_startJob`/`_resizeCanvas`/`connect`）、`utils/lpapiTemplate.js`（点值→mm）、`pages/print/{printSetting,labelTemplate,labelImport}.vue`、`components/mes/print/snPrintList.vue`。

## CSPrintService 集成约定
- 服务输出两种格式，本机都要兼容：`pdaTemplate`（精简 PDA 视图）/ `detail`（LabDetail 全量）。`toZplTemplate` 双格式并存时**优先 detail**（用户明确 detail 信息最全）。
- `detail` 解析必须**剥离页边距/排版字段**（pageWidthMm/marginLeftMm/marginTopMm/columns/rows/portrait/stockName…），否则实际打印与设计稿偏移。
- `detail.LabObject` 字段名与 pdaTemplate 不同，映射易错点：线宽是 `lineWidthMm`（非 pdaTemplate 的 `thicknessMm`）；`printable===false` 要跳过；computed 变量 = 非 Free(5)/Form(6) 的全部（Counter/TableLookup/Date/Formula/DataBase）；QR 放大倍率按 `moduleXMm×203/25.4` 折算。
- 字段映射以 `CSPrintService\CSPrintService\LabModels.cs` + `PdaTemplateMapper.cs` + `LabEnums.cs` 为准，改映射前先读源码别猜。
- **线/矩形映射铁律**（`convertElement`）：横线(`width>0 && height<=0`)必须映射成中性模型 `line`，矩形映射成 `box`。否则 LPAPI 渲染器 `renderBox` 因 `h<=0` 直接 skip → 横线在 IB-PTM7330 丢失（ZPL `^GB w,0` 恰好能画，掩盖了该不一致）。竖线(`height>0 && width<=0`)降级为极窄 box。

## 纸张类型与校准（走纸规则 · 高频坑）
- **「打印出来比标签长/跨张」几乎都是纸张类型或长度没生效**，根因分两类：
  1. **间隙纸/黑标纸**：走纸长度由打印机**传感器**量出，ZPL `^LL` 只限可打印区、**对走纸无效**；换纸或改尺寸后必须点「写入打印机并校准」发 `~JC` 让传感器重测，否则按旧长度走纸。
  2. **连续纸**：无间隙，按 `^LL` 定长走纸，`^LL` 直接生效，无需校准。
- **DPI 填错会成比例放大**：203dpi 机器被当 300dpi → 长约 1.48 倍。本 App 已移除模板 DPI 设置，改由连接打印机真实分辨率自动匹配（Zebra 查 `device.dpi` 默认 203；LPAPI/IB-PTM7330 实测 300），用户无从手动填错。
- **`buildApplyMediaCommand`**（zplTemplate）：连续纸=`^XA^MNN^LL{dots}^JUS^XZ`；间隙/黑标纸=`^XA^{MNY|MNM}^LL{dots}^JUS^XZ` + `~JC`（补 `^LL` 限可打印区，避免 NVRAM 残留旧 `^LL` 裁切）。
- **LPAPI 无持久化介质指令**，尺寸每次 `startJob` 随任务下发；`commitJob.gapType` 跟随 `mediaType`（连续 255 / 间隙黑标 2）。LPAPI 的「写入打印机并校准」= 打印一张当前尺寸参考标签让传感器重学。两模板页提示已按协议动态文案区分。
- **LPAPI 标签偏移 ≠ 舍弃页边距**：根因是 **LPAPI 把整张 job 画布贴在打印头最左端(x=0)下发**，而标签宽窄于打印头、且按打印机对齐方式(`printerAlignment`)贴装在更宽介质上。修复：`lpapiAdapter` 连接时读 `getPrinterInfo()` 的 `printerWidth`/`softwareFlags`(派生成 `printerAlignment`)，`startJob` 画布宽度铺满 `printableMm=printerWidth/(dpi/25.4)`，并给所有绘制元素 x 右移 `offsetX` 补偿。越界检测仍按标签坐标系，不受 offset 影响。**全部以蓝牙连接读到的为准，绝不写死旧机型值**。
- **LPAPI 水平偏移语义（alignment 决定基准 + delta 微调）**：`computeOffsetX(printerWidth, dpi, labelW, alignment)` 按 `printerAlignment` 给基础偏移——`0=右对齐 → (printableMm - labelW)`、`2=居中 → (printableMm - labelW)/2`、`4=左对齐 → 0`；再叠加 `delta`（正=右移/负=左移）。delta = 模板 `page.offsetXMm`（优先，特调）> 全局 `lpapi_offset_delta`（打印设置页设一次，所有 LPAPI 打印含测试页通用）。换不同尺寸纸时基础偏移随尺寸重算、delta 固定。
- **LPAPI 偏移基准铁律（务必牢记，已按 PTM230X 实测更正）**：基准是**蓝牙连接读到的 `printerWidth` 实测值**，**不是介质宽 `paperWidth`，也绝不写死旧机 IB-PTM7330 的 960点/81.3mm**。**本机 PTM230X 实测 `printerWidth=576点@300dpi≈48.8mm`**；`softwareFlags=0xd0` 派生 `printerAlignment=0=右对齐` → 基础偏移 `(48.8-标签宽)`，日志 `offsetX≈28.77`（20mm 标签）。对齐方式也**以读到的 `printerAlignment` 为准**（非硬编码居中）。`paperWidth` 单位 mm、`printerWidth` 单位点，别混。最终公式：`offset = computeOffsetX(printerWidth,dpi,labelW,alignment) + delta`，delta 默认 0。

## 依赖坑
- **pako 3.x 是纯 ESM，无 default 导出**：`import pako from 'pako'` 在 ESM 构建下 pako=undefined → `pako.ungzip` 运行时报错。一律用 `import * as pako from 'pako'`（命名空间导入），`pako.ungzip` 在 Node/Vite/webpack 下都可用。

## 配套后端项目位置（易混淆，务必记牢）
- 父目录 `D:\newxiangmu\hjl\jzckj-hjl\`，下含 `cc-admin-api`（**后端**）、`cc-admin-app`（**uni-app 前端**）、`cc-admin-web`（web 前端）、`bigscreen`、`db`。
- ⚠️ 用户曾把 `cc-admin-app` 说成"后端代码" —— **名字带 app 的是前端**，后端是 **cc-admin-api**。
- 后端 `cc-admin-api`：Maven 多模块（JeecgBoot 风格）`auto-poi`/`base-common`/`esb-interface`/`mes-admin`(启动)/`mes-core-pda`/`mes-core-production`/`mes-screen`/`module-system`；启动类 `cc.admin.CcAdminApplication`；打包 `<finalName>iwms</finalName>` → `iwms.jar`；`server.port=8082`、`context-path=/imes/`（与前端 `request.js` 的 `http://{pdaHost}:{pdaPort}/imes` 对应）；dev DB `192.168.0.42:3306/production_hjl`。
- PDA 接口统一在 `mes-core-pda`，包 `cc.admin.modules.pda.controller`，规范：`@RestController` + `@RequestMapping("/api/pda/xxx")` + `@GetMapping` + `@RequestParam` + 返回 `Result<?>`。
- 鉴权：Shiro + JWT，规则集中在 `module-system/src/main/java/cc/admin/config/ShiroConfig.java` 的 `filterChainDefinitionMap`（`/sys/common/static/**` 与 `/sys/common/pdf/**` 放行，`/sys/common/download/**` 需登录，`/api/**` 的 anon 行是注释掉的）。新增对外接口记得评估是否要加 anon。
- 文件上传根目录 `@Value("${cc.admin.path.upload}")`，dev 值 `D://opt//upFiles`；通用下载实现在 `base-common/.../CommonController.download()`（`/sys/common/download/**`）。

## 应用更新（APK）约定
- 形态：**「我的」页按钮 → 后端接口下载 `snApp.apk` → 安装**，**不做版本比较**（旧的版本检测接口 `/pda/version/getLastVersion` 是历史残留，勿再用）。
- APK 放在**部署后 `iwms.jar` 同级目录**，接口每次请求实时读盘 → **替换文件即换版本，无需重新打包/重启**。
- 目录定位用 Spring Boot 自带 `new ApplicationHome(XxxController.class).getDir()`（jar 运行→jar 同目录）。**不要用 `System.getProperty("user.dir")`**（取的是执行 java 命令时的工作目录，从别处启动 jar 会取错）。传自身 class 避免 mes-core-pda 反向依赖 mes-admin。
- 安装用 **`plus.runtime.install(filePath, { force: true })`** —— force 表示**不校验版本号、直接覆盖安装**，所以 `versionCode` 无需递增（当前保持 100），同版本重装修复也走得通。改用 force:false 才必须严格递增。
- ⚠️ 但**签名必须一致**，签名不同无论 force 与否都装不上（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`），须用同一 keystore（在 hjlApp 的 `doc/` 目录）。
- **Android 8+ 安装未知应用权限（`REQUEST_INSTALL_PACKAGES`）只能引导跳设置页授权**，运行时弹窗无效；manifest 必须声明该权限。
- 方案与代码骨架见 `docs/软件更新功能方案设计.md`。
- ⚠️ **web 端下载文件必须用 `fetch` + `response.blob()`，不能用项目里的 `this.$axios`（带 `responseType:'blob'`）**。**真因**：`boot/api/index.js` 的响应拦截器 `(r) => r.data` 直接返回 `r.data` 本身（而不是 `r`），所以 then 拿到的是 data，**`res.data` 是 undefined**；同时拦截器还会给 Blob 强行加 `headers` 字段（Blob 是 frozen，赋值会失败 / 进入 catch 后用 `{...r.data, headers}` 包装 Blob 成普通对象）。**正确做法**：用 `fetch`，自己塞 `Authorization` / `Tenantid` header，绕过项目 axios 的怪异行为。
- `ApplicationHome(Xxx.class).getDir()` 返回**该 class 所在模块**的 `target/classes`（实测为 `mes-core-pda\target\classes`，不是 `mes-admin\target`）；且 `mvn clean` 会清掉，开发环境应显式配 `cc.admin.path.apk`。
- ⚠️ **`plus.runtime.install` 靠文件扩展名判断是 APK 还是 WGT** —— 扩展名不是 `.apk` 就会被当成 WGT 解析，报「WGT/WGTU 文件格式错误」（即便 `force:true` 也一样）。
- ⚠️ **APK 要落在 `_doc/`（应用私有目录），不要用 `_downloads/`**（公共下载目录在 Android 10+ 分区存储下不可靠）。
- 🔥 **不要再用 `uni.downloadFile` 或 `plus.downloader` 下载 APK**。**两轮实测都在 HBuilderX 调试基座上失败**：① `uni.downloadFile` 指定 `filePath` → 0 字节；不指定 → 后端收不到请求；② `plus.downloader` 指定 `filename` → 0 字节；不指定 → 它**会自行用 `_downloads/<服务器 Content-Disposition 里的名字>`，**写入也是 0 字节。
- ✅ **最终可靠方案：`uni.request` 取 arraybuffer（数据层已验证稳）+ `plus.android` 原生 `java.io.FileOutputStream` 写文件（写入层兜底）**。`uni.request` 支持自定义 header（解决 TenantRequestHandler 拦截）；拿到 ArrayBuffer 后，先试 5+ `FileWriter.writeAsBinary(整包单次)`（`_doc`→`_downloads` 回退），**若都失败（调试基座常态）则回退原生 Java `FileOutputStream` 直接写 `_doc` 真实路径**（等价于"在根目录直接操作文件"，用户也倾向此方案）。实现见 `downloadApk` → `writeBufferToFile` → `writeViaFileWriter` / `writeViaJava`。**不再需要 URL 参数**（uni.request 支持 header）。
- ⚠️ **写文件必须用 `dirEntry.getFile(name, { create: true })` 创建，不能直接 `resolveLocalFileSystemURL(完整文件路径)`** —— 后者只能解析**已存在**的路径，新文件还没创建时会走失败回调，报「路径不存在」。正确顺序：
  ```js
  plus.io.resolveLocalFileSystemURL('_doc/', dir => {          // 目录（已存在）
    dir.getFile('snApp.apk', { create: true }, fileEntry => {   // 创建文件 ← 关键
      fileEntry.createWriter(w => { w.onwrite = ...; w.write(arrayBuffer) })
    })
  })
  ```
- ⚠️ **`uni.request` 的 `responseType:'arraybuffer'` 在 App 端可能返回 `Uint8Array` 而非原生 `ArrayBuffer`**（两者都有 `byteLength`，所以大小检查能过，但 `FileWriter.write()` 只认 ArrayBuffer，会抛无 message 的异常对象）。**必须归一化**：`if (buf && buf.buffer instanceof ArrayBuffer) buf = buf.buffer`，并打印 `Object.prototype.toString.call(buf)` 确认。
- ⚠️ **plus 回调的异常对象常常没有 `message`，直接字符串化就是 `[object Object]`，等于没说**。统一用 `errText(e)`：依次尝试 `message` → `errMsg` → `code` → `JSON.stringify` → `String(e)`。
- ⚠️ **`FileWriter.writeAsBinary` 一次性写整包（不要分块）** —— 分块第二次 `write()` 在调试基座上会抛异常（位置/seek 问题）。若 FileWriter 失败就走 Java 兜底，别执着于修分块；真正可靠的是原生 Java `FileOutputStream`：用 `plus.android.newObject('java.io.FileOutputStream', file)` + `plus.android.invoke(fos,'write', jsNumberArray)`（JS 数字数组会被 5+ 自动转 Java `byte[]`），512KB 一块循环写，写完 `flush/close`，再 `file.length()` 校验大小。
- 🔥 **`FileWriter.write(ArrayBuffer)` 在部分 HBuilderX 基座上不被支持，会直接抛空异常对象 `{code:null,message:""}`** —— 症状是「文件创建成功、但 33ms 内第一块就写入失败」。**必须做能力探测并回退**：
  ```js
  if (typeof writer.writeAsBinary === 'function') writer.writeAsBinary(toBinaryString(slice))
  else writer.write(slice)
  ```
  `toBinaryString` = `Uint8Array` 分块 `String.fromCharCode.apply(null, subarray(i, i+8192))` 拼接（每字符 Unicode < 256）。这是本次排障**最致命的一个坑**，排查时先打印 `typeof writer.write` / `typeof writer.writeAsBinary`。
- ⚠️ **写入目录要有回退**：某些机型 / Android 版本上 `_doc` **第一块就写不进去**。用 `plus.io.requestFileSystem()`（比 `resolveLocalFileSystemURL` 更标准）按 **PRIVATE_DOC(3) → PUBLIC_DOWNLOADS(1)** 顺序尝试，都失败才报错，并把两档的原因都带上。常量：`PUBLIC_DOCUMENTS=0`、`PUBLIC_DOWNLOADS=1`、`PRIVATE_WWW=2`、`PRIVATE_DOC=3`。
- ⚠️ **manifest.json 要声明 `WRITE_EXTERNAL_STORAGE`**（配合 `REQUEST_INSTALL_PACKAGES`、`INTERNET`），否则部分机型写外部存储会被拒。
- 📊 三个日志节点缺一不可：`收到 N 字节`（uni.request 拿到数据）→ `写入完成: 路径，N 字节`（写后校验 `fileEntry.file().size`）→ 成功。写完还要校验一次大小，确认真落盘。
- 校验：ArrayBuffer.byteLength ≥1MB、statusCode === 200。`fmtSize(0)` 必须返回「0 字节」而非空串。
- 校验（`verifyApkFile`）：文件存在 + 大小 ≥1MB，返回 `entry.fullPath`（绝对路径）给 install。`fmtSize(0)` 必须返回「0 字节」而非空串（否则提示变成「只有 ）」，毫无信息量）。
- 🔥 **403 的真凶不是 Shiro，是 `TenantRequestHandler`**（`module-system/.../mybatis/handler/TenantRequestHandler.java:99`）—— 它拿不到租户 ID 就 `sendRedirect(contextPath + "/403.html")`。下载器跟随重定向后拿到的是 403 页面，表现就是 **`status=200` 但文件 0 字节**，极具迷惑性。诊断方法：`curl -sI <url>` 看是否 `302 → /imes/403.html`。
- 💡 **后端两个拦截器都支持 URL 参数**（不只 header），这是无法带 header 场景（如 `plus.downloader`）的救命通道：
  - 租户：**`tenantId`**（`TenantConstant.PARAM_TENANT_ID_1 = "tenantId"`，也接受 `tenant_id`）
  - 认证：**`Authorization`**（`DefContants.X_ACCESS_TOKEN = "Authorization"`，见 `JwtFilter.java:57`）
  - 即 `?tenantId=xxx&Authorization=yyy` 可完全替代 header。
- 实测对比：不带 tenantId → `302 → 403.html`；带 `?tenantId=<真实租户ID>` → `200 + Content-Length: 15794864`。**后端无需改动、无需重启**。
- App 端租户 ID 存在 `uni.getStorageSync('factoryId')`（key 名是 **factoryId**，不是 tenantId）。
- ⚠️ **删除旧包必须 Promise 化并 await 完成后再下载**（`removeOldApk`）。`plus.io.resolveLocalFileSystemURL` 与 `entry.remove` **都是异步的**，初版"发起删除后立刻 `uni.downloadFile`"会踩竞态：下载正在写 `snApp.apk` 时删除回调才到，把新文件删掉。**第 1 次更新不触发（文件本不存在），第 2 次及以后必然中招**，症状正是「APK文件不存在 / WGT/WGTU 文件格式错误」。已用 node 模拟对照验证：修复前第 2 次更新失败、修复后成功。
- ⚠️ 另需**并发锁**（模块级 `_downloading`）：连点「更新应用」会启动两次下载写同一文件导致损坏，第二次直接 reject「正在下载中，请稍候」。
- `force: true` **必须保留**：官方说明「不加 force 时系统默认把包识别成 WGT 热更包」，加了才走 APK 整包流程。
- ⚠️ **uni-app 项目校验 JS 语法要用 HBuilderX 里真实的 `@babel/parser`，不能只跑 `node --check`** —— 两者严格程度不同，曾出现 node --check 通过但编译时 babel 报 `Missing semicolon` 的情况（Promise 链重构时把闭合 `}` 误写成 `)`）。校验脚本路径：`C:\Users\26281\Desktop\uniapp\HBuilderX\plugins\uniapp-cli\node_modules\@babel\parser`，用 `parser.parse(code, {sourceType:'module'})`。

## cc-admin-web 项目约定（Quasar 1.14 + Vue 2.6）
- 路径 `D:\newxiangmu\hjl\jzckj-hjl\cc-admin-web`；`quasar.conf.js` 顶部 `services` 映射后端：`local → localhost:8082`、`test → 8091`、`prod → 8081`。
- 请求基址：axios baseURL = `process.env.SERVER_URL + process.env.BASE_URL` = `/imes`（相对路径，devServer 代理 `/imes` → 后端）。组件里可用 `process.env.BASE_URL`。
- 顶部栏在 `src/layouts/index.vue` 的 `q-header > q-toolbar`（菜单按钮 → 搜索菜单 q-select → App下载 → 工厂下拉 → 用户菜单）。
- 依赖已含 `qrcode@1.5.4`（要二维码无需加库）。eslint-loader 在 quasar.conf.js 中**被注释**，lint 错误不阻断构建。
