# hjlApp 项目长期记忆

## 项目概况
- uni-app v3 蓝牙打印 PDA，目标 Android。核心：标签模板设计 + 蓝牙打印 + CodeSoft 标签导入。
- 打印机适配：Zebra ZPL（ZR668/ZD410）+ IB-PTM7330 / PTM230X（LPAPI，道臻 dothan-lpapi-ble）。

## 打印机适配
- **ZR668**：Zebra 便携机，203dpi，ZPL2。自带 `E:HANS.TTF`（19MB 简中）。中文 `^A@ E:HANS.TTF` 自动检测，后备 `^GFA` 位图。
- **ZD410**：Zebra 桌面机，统一走 HANS.TTF（已弃用 GB18030.FNT）。
- **IB-PTM7330**：ESC/POS 位图，硬件固定 300dpi，50×30mm。无中文字体，全部 Canvas 渲染位图下行。**DPI 铁律**：位图分辨率必须=硬件 300dpi，绝不用模板 `page.dpi`(默认203)。
- **PTM230X**：LPAPI 协议，300dpi，`printerWidth=576点≈48.8mm`，`softwareFlags=0xd0`→`printerAlignment=0`(右对齐)。偏移/对齐全部以蓝牙 `getPrinterInfo()` 读到为准。

## 多指令集架构
- `printerConnection.js`（与指令集无关的蓝牙 SPP 连接层）+ `adapters/` 封装具体指令 + `printerAdapter.js` 工厂。业务统一走 `printerManager.printTemplate(tpl,data)`。`zebraPrinter.js` 已是转发 shim。
- 新增机型 = `adapters/` 实现适配器 + 工厂注册。

## 关键文件
- `utils/printerConnection.js`、`printerAdapter.js`、`printerManager.js`
- `utils/adapters/{zebraAdapter,ibptm7330Adapter,lpapiAdapter}.js`
- `utils/zebraPrinter.js`(shim)、`zplTemplate.js`、`labTemplate.js`、`cjkBitmap.js`、`lpapiTemplate.js`、`lpapi-uniplugin.js`(事件总线)

## 模板与解析关键约束
- **内置模板**：`labTemplate.js` 的 `builtinTemplates()` 统一产出（批次/关键件/产品/包装4张），走 `convertDetail` 与 CodeSoft 导入页同构；`loadTemplates()` 启动自动补缺失 id 进 storage。未知 `mediaType` 按 gap(间隙纸) 兜底。
- **CJK**：统一 `^A@ E:HANS.TTF`，弃 GB18030。
- **LPAPI**：每页必须有全局唯一隐藏 canvas + `onLoad initDrawContext` + `onShow setActiveCanvas`；`startJob` 后只同步 `:style` 显示尺寸，绝不直接改 canvas 节点 `width/height`（会清空 SDK 位图→出纸空白）。
- **detail 解析**：剥离页边距/排版字段(pageWidthMm/margin*/columns/rows/portrait/stockName)；优先 detail；computed 变量=非 Free(5)/Form(6) 全部(Counter/TableLookup/Date/Formula/DataBase)；线→`line`、矩形→`box`（防 IB-PTM7330 横线丢失）；QR 放大 `moduleXMm×203/25.4`。字段映射以 CSPrintService 的 LabModels.cs / PdaTemplateMapper.cs / LabEnums.cs 为准。

## 纸张类型与校准（高频坑）
- 间隙/黑标纸：走纸长度由传感器量出，ZPL `^LL` 只限可打印区；换纸/改尺寸必须点「写入并校准」发 `~JC`。连续纸：`^LL` 定长直接生效。
- LPAPI 标签偏移根因：job 画布贴打印头最左(x=0)下发，标签窄于打印头且按 `printerAlignment` 贴装更宽介质 → 给元素 x 右移 `offsetX`。基准=`printerWidth` 实测值，非 `paperWidth`，不写死旧机值。`offset = computeOffsetX(printerWidth,dpi,labelW,alignment) + delta`，delta 默认0。

## 应用更新（APK）约定
- 形态：「我的」页按钮 → 后端 `/api/pda/app/downloadSnApp` 拉 `snApp.apk` → `plus.runtime.install(filePath,{force:true})`，**不比较版本**。
- APK 放部署后 `iwms.jar` 同级目录，接口每次实时读盘 → 换文件即换版，无需重打包/重启。目录用 `new ApplicationHome(XxxController.class).getDir()`（jar 运行→jar 同目录；返回 class 所在模块 target/classes，mvn clean 会删，开发配 `cc.admin.path.apk`）。
- `force:true` 不校验版本号（当前 versionCode=100 即可）；但**签名须一致**（同 `doc/` keystore），否则 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`。
- Android 8+ `REQUEST_INSTALL_PACKAGES` 只能跳设置页授权，运行时弹窗无效；manifest 还需 `WRITE_EXTERNAL_STORAGE`/`INTERNET`。
- **web 端下载须用 `fetch`+`response.blob()`**，绕开项目 axios（`boot/api/index.js` 拦截器 `return r.data` 导致 `res.data` undefined 且给 Blob 加字段静默失败）。
- **可靠下载链路**：`uni.request` 取 arraybuffer（statusCode=200、`byteLength≥1MB`，header 带 Authorization/tenantId）→ `plus.android` 原生 `java.io.FileOutputStream` 写 `_doc/snApp.apk`。要点：用 `getFile(name,{create:true})` 创建；`Uint8Array` 归一化 `ArrayBuffer`；模块级并发锁防连点；删旧包须 await 完成再下载。
- **403 真凶 = `TenantRequestHandler`**（无 tenantId → 302 → `/imes/403.html`，表现 status=200 但 0 字节）。后端两拦截器均支持 URL 参数：`tenantId`(租户) / `Authorization`(认证)，可完全替代 header。App 租户存 `uni.getStorageSync('factoryId')`。

## 配套后端 cc-admin-api（JeecgBoot）
- 路径 `D:\newxiangmu\hjl\jzckj-hjl\cc-admin-api`；`mes-core-pda` 模块（`mes-admin` 启动）；`server.port=8082`、`context-path=/imes`；PDA 接口 `@RestController` + `@RequestMapping("/api/pda/xxx")`。
- 鉴权 Shiro+JWT，`ShiroConfig.filterChainDefinitionMap` 的 anon 放行须放在 `/**`(jwt) 之前。租户/认证拦截支持 URL 参数。

## cc-admin-web（Quasar 1.14 + Vue 2.6）
- 路径 `D:\newxiangmu\hjl\jzckj-hjl\cc-admin-web`；axios baseURL=`/imes`（devServer 代理）；顶部栏 `src/layouts/index.vue`（含 App下载 按钮）；依赖已含 `qrcode@1.5.4`。

## 打印合批（LPAPI 一次任务多页）
- 批量打印默认走 **合批**：`printerManager.printTemplateBatch(tpl, records, hooks)` → 有能力的适配器（LPAPI）用 `lpapiAdapter.printTemplateBatch`，否则**自动回退逐条**（Zebra 行为不变）。
- **渲染算法零漂移的关键**：`lpapiTemplate.createDrawCollector()` 返回与 LPAPI 实例**同形**的代理，draw* 调用被收集成数组（补 `type` 字段），`renderTemplateToLpapi` 算法一行不改。
- 适配器侧：逐条渲染成 `jobPages`（每页=DrawItem 数组），`_prepareCanvas` 只建上下文/同步 canvas 尺寸（**不自己 startJob**），任务生命周期交给 SDK 的 `drawJob({jobPages, jobInfo:{printCopies,colorMode:2}, onPageComplete})`。单条时直接走单条路径。
- `startJob({jsonMode:true})` 会让 SDK 的 draw* 自动 push 进内部 `mJobPage`（另一条可选路径）。
- 批次模式（标签不带 SN、每条换变量）**不走合批**，保持逐条。

## 通用依赖坑
- `pako` 3.x 纯 ESM，用 `import * as pako`（非 default）。
- uni-app JS 语法校验用 HBuilderX 真 `@babel/parser`，非 `node --check`（曾出现 node 通过但 babel 报 Missing semicolon）。
