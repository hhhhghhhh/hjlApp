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
- **LPAPI 标签偏左/印到标签外 ≠ 舍弃页边距**：根因是**打印头可打印宽度(≈81mm@960点)远大于标签(如50mm)，且标签居中贴在更宽介质上**，而 LPAPI 把 job 画布贴在打印头最左端(x=0)下发。修复：`lpapiAdapter` 连接时读 `getPrinterInfo().printerWidth`，`startJob` 画布宽度铺满 `printableMm=printerWidth/(dpi/25.4)`，并给所有绘制元素 x 右移 `offsetX` 作居中补偿。越界检测仍按标签坐标系，不受 offset 影响。
- **LPAPI 水平偏移语义（delta 微调，非绝对覆盖）**：`offsetX = (打印头宽 printableMm - 标签宽 widthMm)/2 + delta`。delta = 模板 `page.offsetXMm`（优先，特调）> 全局 `lpapi_offset_delta`（打印设置页设一次，所有 LPAPI 打印含测试页通用）。正=右移/负=左移，留空=0。这样换不同尺寸标签纸时自动居中随尺寸重算、delta 固定，无需每次重调。
- **LPAPI 偏移基准铁律（务必牢记，踩了三次坑）**：居中基准是【**打印头宽 `printerWidth`**（960点@300dpi≈81.3mm）】，**不是介质宽 `paperWidth`**。`paperWidth` 实测=90mm，比打印头宽 8.7mm（打印头居中装在介质上、两侧各约 4.35mm 机械死区）。正确偏移 = `(printerWidth_mm - 标签宽)/2` = `(81.3-50)/2 ≈ 15.65mm`。**用介质宽算 `(90-50)/2=20` 会偏右约 4.4mm**。且 `paperWidth` 单位是 mm、`printerWidth` 单位是点，别再混。最终公式：`offset = (printerWidth/dpi*25.4 - 标签宽)/2 + delta`，delta 默认 0 即可。

## 依赖坑
- **pako 3.x 是纯 ESM，无 default 导出**：`import pako from 'pako'` 在 ESM 构建下 pako=undefined → `pako.ungzip` 运行时报错。一律用 `import * as pako from 'pako'`（命名空间导入），`pako.ungzip` 在 Node/Vite/webpack 下都可用。
