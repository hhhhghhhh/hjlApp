# 打印功能分析报告：ZPL 与 IB-PTM7330（LPAPI）

> 适用范围：hjlApp（uni-app v3，Android PDA 蓝牙打印）多指令集打印架构
> 生成日期：2026-08-16
> 关注点：ZPL（Zebra 系列）与 IB-PTM7330（当前打印机，走 LPAPI 路径）两条打印链路的功能、用法、dpi 自动匹配、以及过去控制台报错的根因与修复。

> **修订（2026-08-16 二次清理）**：已移除全部 CPCL 指令路径——`utils/cpclTemplate.js` 删除，打印设置页去掉 CPCL 测试/切换/发送按钮与方法，兼容 shim 与适配器同步移除 `sendCpcl`/`printCpclTest`/`buildCpclTestLabel`。**App 现仅支持 ZPL**（Zebra）与 LPAPI（IB-PTM7330）。中文渲染统一走 `E:HANS.TTF` 原生渲染（连接后自动检测 HANS/HANT/NOTOMRJ），不再使用 `E:GB18030.FNT`（本机无此文件）。

> **修订（2026-08-17 纸张类型 / 校准 / DPI）**：明确「打印出来比标签长」的根因与处理——间隙纸/黑标纸的走纸长度由打印机传感器量出，ZPL `^LL` 对其无效，换纸或改尺寸后必须点「写入打印机并校准」发 `~JC` 让传感器重测；只有连续纸才按 `^LL` 定长走纸。DPI 不再由模板设置，连接后由打印机真实分辨率自动匹配，杜绝「203 机器被当 300 填」导致的约 1.5 倍放大。LPAPI 路径同样保留「写入打印机并校准」按钮，但其含义不同（见 §10）。

> **修订（2026-08-17 二次：LPAPI 标签偏左 + 回归修复）**：「偏左/印到标签外」根因是 LPAPI 把 job 画布贴在打印头最左端下发，而标签（50mm）居中贴在更宽（打印头≈81mm）介质上，故内容整体左偏约 15mm。修复：LPAPI 打印/校准/测试时画布铺满打印头宽度并右移 `offsetX=(printableMm−标签宽)/2`（实测 15.64mm），设计页新增「水平偏移 (mm)」可手动微调（见 §11.5）。**回归修复**：上一轮补调用时漏了 `printableMmOf`/`computeOffsetX` 函数定义，导致一打印就 `ReferenceError` 崩溃（连接日志看不出）；已补上并以 Node ESM 桩测试验证四个入口均正常返回。

---

## 1. 整体架构（多指令集）

打印功能采用「连接层 / 适配器 / 管理器」三层解耦，核心是**中性模板模型**与**按打印机自动匹配 dpi**：

```
CSPrintService 解析 .Lab
   └─ pdaTemplate / detail  ──► labTemplate.toZplTemplate()  ──► 中性模板(全毫米, 无 dpi)
                                                        │
                              printerManager.printTemplate(tpl, data)
                                  │
              ┌───────────────────┼────────────────────┐
         ZebraAdapter          LpapiAdapter        Ibptm7330Adapter(备选/手动)
         (ZPL)                (dothan-lpapi-ble)   (ESC/POS 位图)
              │                     │                     │
        buildZpl             renderTemplateToLpapi  Android Canvas→位图
        mm→dots(按实际dpi)     直接下发 mm            硬件固定 300dpi
```

- **连接层** `printerConnection.js`：与具体指令集无关，只负责经典蓝牙 SPP（UUID 00001101）收发。
- **适配器** `utils/adapters/*.js`：封装各自的指令与生命周期。
- **管理器** `printerManager.js`：统一入口 `printTemplate(tpl, data)`，自动选协议、透传字体/连接状态。
- **协议选择**：打印设置页只展示 **LPAPI / ZPL** 两种。按名称自动识别：
  - `ZEBRA/ZQ/ZD/ZT/…` → **ZPL**（zebraAdapter）
  - `IB-PTM/PTM7330/DT7330/德佟/DOTHAN/LPAPI` → **LPAPI**（lpapiAdapter）
  - （手动选 `IBPTM7330` 协议则落到 ibptm7330Adapter 的 ESC/POS 位图路径，属备选/旧链路）

> 当前 IB-PTM7330 通过名称自动识别为 **LPAPI 指令集**，走 `lpapiAdapter`（dothan-lpapi-ble 原生插件）。本文档以此为主路径描述；ESC/POS 位图路径作为备选一并说明。

---

## 2. 中性模板模型（两条链路共用）

元素类型：`text / qrcode / barcode / line / box`。
**坐标 (x,y)、尺寸 (width/height)、字号 (fontH/fontW)、线宽 (thickness)、二维码模块 (moduleWidthMm) 一律以毫米存储，模板本身不再记录任何 dpi。**

| 字段 | 含义 | 单位 |
|------|------|------|
| `page.widthMm / page.heightMm` | 标签尺寸 | mm |
| `page.mediaType` | gap/mark/continuous | — |
| `el.x / el.y` | 元素基点坐标 | mm |
| `el.fontH / el.fontW` | 字号 | mm（由 pt×25.4/72 折算） |
| `el.moduleWidth(Mm)` | 一维/二维码模块宽 | mm |
| `el.thickness` | 线/框线宽 | mm |
| `el.anchor` | 基点（九宫格） | — |

`CSPrintService` 两种格式都能导入：
- `pdaTemplate`（精简 PDA 视图）与 `detail`（LabDetail 全量）双格式并存时**优先 detail**（信息最全）；
- `detail` 解析会**剥离页边距/排版字段**（pageWidthMm/marginLeftMm/columns/rows…），避免实际打印与设计稿偏移；
- 离线码 = gzip+base64 紧凑 JSON；回连码 = 明文 JSON（PDA 自己连回 CSPrintService 取最新结果）。

---

## 3. ZPL 路径（Zebra 系列：ZR668 / ZT / ZD 等）

### 3.1 适用机型与协议
- **ZR668**（便携机，203dpi）：**仅 ZPL**，中文走 `^A@ E:HANS.TTF` 原生渲染（出厂内置 HANS.TTF），无该字体时降级 Android Canvas 位图 `^GFA`；不再使用 CPCL / `GB18030.FNT`。
- **ZT/ZD 等**：默认 **ZPL**（`^A@ E:HANS.TTF` 原生中文最佳）。

### 3.2 dpi 自动匹配（核心改动）
- 模板**不再存 dpi**。打印时由 `ZebraAdapter` 在连接后查询真实分辨率：
  `! U1 getvar "device.dpi"` → 识别 203/300/600；查不到则用 **203 兜底**（ZR668 常见值）。
- `ZebraAdapter.printTemplate` 把实际 dpi 传给 `buildZpl(tpl, data, { font, dpi: this.printerDpi })`。
- `buildZpl` 内部用 `toDots(mm) = mm * DOTS_PER_MM[dpi]` 把毫米统一折算成点：
  - 203dpi → 8 点/mm；300dpi → 11.811 点/mm；600dpi → 23.622 点/mm。
- **效果**：同一份毫米模板，在 203 与 300 打印机上自动生成不同点值指令，物理尺寸一致，不再写死 203。

> 例：4mm 高文本 → 203dpi 为 `^A0N,32,32`；300dpi 为 `^A0N,47,47`。

### 3.3 中文渲染策略（按优先级）
1. **TTF 原生**（最快最清晰，本机唯一中文路径）：`^A@N,h,w,E:HANS.TTF`（连接后检测 HANS/HANT/NOTOMRJ）。**不再依赖 `GB18030.FNT`**。
2. **位图渲染**（无 HANS.TTF 字体时兜底）：Android Canvas + Paint 反射渲染成 `^GFA` 二值位图。

### 3.4 连接与校验
- 走 `printerConnection`（经典蓝牙 SPP）。
- 连接后发 `~HS` 校验是否真有响应；中文字体检测（`^HW` / `~HD`）异步进行，不阻塞。
- 状态查询 `getStatus` 解析 Host Status（`~HS`）给出缺纸/开盖/碳带等中文提示。

### 3.5 使用入口
打印设置页选「ZPL 指令集」→ 连接 Zebra 打印机 → 导入 CodeSoft 模板或新建 → 打印/测试/校准（`applyMedia` 写 `^LL` / `~JC`）。

---

## 4. IB-PTM7330 路径（当前打印机，LPAPI）

### 4.1 协议与渲染方式
- 协议：**dothan-lpapi-ble**（道臻官方 LPAPI 原生插件，标准基座即可运行，导入 `uni_modules` 即可）。
- 模型：**Canvas 绘制 + uni BLE 下发**。生命周期由适配器统一管理：
  `openAdapter → openPrinter → startJob({context,width,height,orientation}) → draw* → commitJob({gapType,printDarkness,printSpeed})`。
- 绘制基于**页面隐藏 canvas**（必须 `type="2d"`，`canvas-id` 全局唯一，各打印页独立 id；`onLoad` 建上下文、`onShow` 切回当前 canvas）。

### 4.2 纯毫米渲染
- 中性模板的毫米坐标**直接下发**给 LPAPI 的 `drawText / draw1DBarcode / draw2DQRCode / drawRectangle / drawLine`，**不做任何点值折算**。
- 打印机真实 dpi 由 SDK 在 `startJob` 时从 `getPrinterInfo().printerDPI` 取得（**实测 300**），决定 bitmap 分辨率——与模板 mm 坐标解耦，物理尺寸天然正确。

### 4.3 中文处理
- LPAPI 由 SDK 内部字体/位图完成，**所见即所得**，无需像 ZPL 那样单独处理 TTF/位图/内置字库三策略。

### 4.4 关键坑（已规避）
- **startJob 后只能同步 canvas 的 `:style`（CSS 显示尺寸）**，绝不能直接改 `node.width/height` 位图属性——SDK 已在 `startJob` 内部把节点位图设成任务像素，再改会清空缓冲导致**出纸空白**。
- 像素尺寸优先用 `job.canvas.width/height`（SDK 返回），兜底才自己算。

### 4.5 连接稳定性加固（针对历史报错 `errCode 10002`）
`LpapiAdapter.connect` 三段式：
1. **蓝牙预检**：`openAdapter` 校验蓝牙已开/已授权，未开直接给清晰中文引导（避免盲目建连报 10002）。
2. **带重试打开打印机**：`openPrinter` 失败时**重置适配器**再试（最多 3 次），缓解偶发断连。
3. **二次确认**：`commitJob` 后用 `isPrinterOpened()` 兜底，未真正连上即抛明确错误，杜绝「连上了却出纸空白」的静默失败。

### 4.6 备选路径：ESC/POS 位图（ibptm7330Adapter）
手动选 `IBPTM7330` 协议时走此链路：硬件固定 **300dpi**，所有内容（含中文）经 Android Canvas 渲染为位图后按行下发（1B 40 初始化、1F 27 设宽、1F 2A 打印行等）。能力上与 LPAPI 等效，但 LPAPI 是道臻官方推荐、当前默认路径。

---

## 5. 两条链路对比

| 维度 | ZPL（Zebra） | IB-PTM7330（LPAPI，当前） |
|------|--------------|---------------------------|
| 适配对象 | ZR668 / ZT / ZD 等 Zebra | IB-PTM7330 / DT-7330 / 德佟系列 |
| 协议 | ZPL 文本指令 | dothan-lpapi-ble Canvas 绘制 |
| 连接 | 经典蓝牙 SPP（printerConnection） | SDK 自管 BLE（openAdapter/openPrinter） |
| dpi 来源 | 查询 `device.dpi`，默认 203 | SDK `getPrinterInfo().printerDPI`，实测 300 |
| 模板→指令 | mm→dots（按实际 dpi 折算） | 直接下发 mm（SDK 管分辨率） |
| 中文方案 | TTF(HANS.TTF) > 位图^GFA（无内置字库依赖） | SDK 内部字体/位图（所见即所得） |
| 旋转 | 单元素 `^FW`/`^FR` 支持 | 仅整张标签 `orientation`（单元素 rotation 不生效） |
| 介质校准 | 连续纸 `^LL` 定长；间隙/黑标纸 `^MN` + `^LL`(限可打印区) + `~JC` 传感器校准 | 每次 startJob 按 width/height 下发；`commitJob.gapType` 跟随 `mediaType`（连续 255 / 间隙黑标 2）；「校准」= 打印一张当前尺寸参考标签让传感器重学 |
| 连接方式稳定性 | `~HS` 校验 | 蓝牙预检+重置重试+isPrinterOpened 校验 |

---

## 6. dpi 自动匹配机制（总结）

```
模板(毫米, 无 dpi)
   │
   ├─ ZPL 链路：ZebraAdapter 连机查询 device.dpi
   │     └─ buildZpl 用该 dpi 把 mm 折算成点（DOTS_PER_MM[dpi]）
   │         · 203 → 8/m · 300 → 11.811/m · 600 → 23.622/m
   │
   └─ LPAPI 链路：模板 mm 直发；SDK startJob 用 getPrinterInfo().printerDPI(300) 定 bitmap
```
旧模板（点值 + `page.dpi`）在 `loadTemplates()` 时由 `migrateTemplate()` 一次性折算成毫米并删除 `page.dpi`，已存数据不会失真。

---

## 7. 历史控制台问题复盘（对应「新建 文本文档.txt」）

| 日志 | 性质 | 结论 / 处理 |
|------|------|------|
| `createBLEConnection:fail no device errCode 10002` ×多次 | **真问题** | 打印机根本没连上，导致后续全空。已用 LpapiAdapter.connect 三段式加固（预检/重试/二次确认）解决。 |
| `当前绘制环境不支持函数：getImageData` | **良性告警** | LPAPI 的 `commitJob` 先试 `context.getImageData`（uni 2d canvas 无此 API），自动回退 `uni.canvasGetImageData`（日志随后 `Response.success`），取像素正常，**不是 bug、无需处理**。 |
| `DzTextEncoder.encode: TextEncoder is not defined` | **良性** | 已在 `lpapi-uniplugin.js` 增加 `polyfillTextEncoder()` 兜底。 |
| 绘制坐标 `drawQRCode(x:19.665,y:3.665,w:10.67)` 等 | 正常 | 坐标计算正确，证明渲染层没问题，空白纯属连接未建立。 |

**结论**：之前「出纸空白」的根因是 **BLE 没连上（10002）**，不是渲染或 dpi。现在连接失败时直接抛清晰中文错误，不会再「以为连上了却白打」。

---

## 8. App 内使用指引

1. **打印设置页**：选指令集（LPAPI 默认适配 IB-PTM7330 / ZPL 适配 Zebra）→ 点「连接」配对打印机 → 状态显示「已连接」。
2. **导入模板**：扫码或粘贴 CSPrintService 生成的二维码（离线码 / 回连码）→ 自动解析为中性模板（pdaTemplate 或 detail，优先 detail）→ 可预览/编辑。
3. **打印**：
   - 标签模板页 / SN 打印列表页：填写变量（SN 等）→ 点打印。
   - 各打印页需含**唯一隐藏 canvas** 并正确初始化（LPAPI 必需）。
4. **测试/校准**：设置页提供测试打印、介质校准、连接状态查询等。

---

## 9. 已知限制与后续建议

1. **LPAPI 单元素旋转不生效**：整张标签旋转用 `startJob(orientation)`，单元素 `rotation` 字段在 draw API 不生效（已在代码注释标注）。
2. **detail 剥离页边距**：依赖 CSPrintService 字段名，若对方改字段需同步 `labTemplate.normalizeDetailObject`。
3. **computed 变量印空白**：CodeSoft 自算变量 PDA 取不到值，导入时已告警。
4. **二维码仅 QR + 部分一维码**：DataMatrix/PDF417 等不支持（导入告警跳过）。
5. **位图渲染慢**：ZPL 无 TTF 时走 Android Canvas 位图（`^GFA`），大标签稍慢但通用。
6. **建议**：LPAPI 连接稳定性已加固，建议真机复测「首次连接 / 中途断连重连 / 关机再开」三场景；Zebra 203/300 双机型各打一张验证 dpi 折算。

---

## 10. 纸张类型、走纸规则与校准（本次重点）

「打印出来比标签长 / 跨张」几乎都源于**纸张类型或长度没生效**。两种协议的处理方式不同，下面分别说明，并解释为什么换纸/改尺寸后必须「校准」。

### 11.1 关键认知：三种纸张的走纸规则

| 纸张类型 | 长度由谁决定 | ZPL 走纸指令 | 换纸/改尺寸后是否要校准 |
|----------|--------------|--------------|------------------------|
| 间隙纸（gap，`^MNY`） | 打印机**传感器量间隙** | `^LL` 被忽略 | **必须** `~JC` 校准一次 |
| 黑标纸（mark，`^MNM`） | 打印机**传感器量黑标** | `^LL` 被忽略 | **必须** `~JC` 校准一次 |
| 连续纸（continuous，`^MNN`） | 按 `^LL` 定长走纸 | `^LL` 生效 | 改 `^LL` 即生效，无需校准 |

- **间隙/黑标纸**：标签之间有空隙（或背面有黑条），打印机靠光电传感器定位一张的起点/终点。ZPL 里的 `^LL`（标签长度）对这些介质**不起走纸作用**——它只决定可打印区的上限。所以即使模板写了正确的 `^LL`，只要打印机传感器里记录的间隙长度还是上一张纸的，它就会按旧长度走纸，结果就是「印得比标签长 / 跨到下一格」。
- **唯一修正办法**：换纸或改尺寸后，点一次「写入打印机并校准」（ZPL 发 `~JC`），让打印机重新走 2~3 张纸、用传感器量出当前的真实间隙/黑标长度。
- **连续纸**没有间隙，打印机只能按 `^LL` 给的长度定长走纸，因此 `^LL` 直接生效，改 `^LL` 即可，无需校准。

### 11.2 ZPL 路径的实现（`buildApplyMediaCommand`）

```js
// 连续纸：写介质类型 + 定长 + 保存
'^XA^MNN^LL' + heightDots + '^JUS^XZ'
// 间隙/黑标纸：写介质类型 + 限可打印区 ^LL + 保存 + 触发传感器校准
'^XA' + media.zpl + '^LL' + heightDots + '^JUS^XZ + '\n~JC'
```

- 连续纸只写 `^LL`（`^JUS` 存进 NVRAM），不含 `~JC`。
- 间隙/黑标纸**额外补一次 `^LL=标签高度`**：因为 `^LL` 虽不影响走纸，但决定可打印区上限；若 NVRAM 残留旧 `^LL` 比实际标签长，内容会被裁到下一格之外。补写后保证可打印区与传感器量到的长度一致，再发 `~JC` 让传感器重测。
- 实际打印（`buildZpl`）也会在格式里带 `^MN*` 与 `^LL`，但**校准（`~JC`）只在校准按钮触发**，不会每次打印自动跑——避免每次出纸都走一遍校准拖慢速度。

### 11.3 LPAPI 路径的实现（与 ZPL 本质不同）

LPAPI（dothan-lpapi-ble）**没有 ZPL 那种「把介质参数持久化写进打印机」的指令**，`startJob` 时传入的 `width/height`（mm）就是本次任务的真实尺寸，每次打印都随任务下发，因此不存在「`^LL` 残留」问题。

- 「写入打印机并校准」在 LPAPI 下 = **打印一张当前尺寸的校准标签**（边框 + 尺寸文字），让打印机走纸并测量间隙、确认尺寸/对齐。换纸后也建议连点两三次，让传感器重新学习。
- `commitJob` 的 `gapType` 现**跟随模板 `mediaType`**：连续纸 → `255`（跟随打印机自身设置，无间隙可量，按 `startJob` 传入的 height 定长走纸）；间隙/黑标纸 → `2`（让打印机走传感器量到的间隙）。
- DPI 由 SDK `getPrinterInfo().printerDPI`（实测 **300**）自动匹配，模板只存毫米，无需也不会手动填 DPI。

> 结论：**LPAPI 同样需要「写入打印机并校准」按钮和提示**，只是含义从「写 NVRAM + 发校准指令」变成「打印一张参考标签让传感器重学」。两个模板页（标签模板 / 从 CodeSoft 导入）的提示已按协议分别给出对应说明。

### 11.4 DPI 填错会成比例放大（已通过自动匹配根除）

- 203dpi 的机器若被当成 300dpi，毫米折算的点数会多约 `300/203 ≈ 1.48` 倍，整张标签被等比放大、印出来比实际标签长约 1.5 倍——表现和「纸张类型没生效」很像，但根因不同。
- 本 App 已**移除模板里的 DPI 设置**，打印时由连接打印机真实分辨率自动匹配（Zebra 查 `device.dpi` 默认 203；LPAPI/IB-PTM7330 实测 300），**用户无从手动填错**，故该问题在架构上已杜绝。设计页「换算结果」显示的是当前连接打印机的真实 dpi，未连接时提示「将按打印机真实分辨率自动匹配」。

### 11.5 LPAPI 标签「偏左 / 印到标签外」= 打印头比标签宽、内容未居中（2026-08-17 修复）

现象：IB-PTM7330 用 LPAPI 打的标签整体偏左，最左侧一部分内容印在了标签外的留白里。

根因（与"舍弃页边距"无关）：道臻 DT7330/IB-PTM7330 的**打印头可打印宽度远大于标签**。实测 `getPrinterInfo()` 返回 `printerWidth = 960`（点）@ `printerDPI = 300` ≈ **81mm**，而标签本身往往只有 50mm。LPAPI 把整张 job 画布贴在打印头的**最左端（x=0）**下发，但 50mm 标签是**居中**贴在更宽的介质上的（左右各约 15mm 留白）。于是 50mm 内容被画在打印头 0–50mm 处，相对物理标签向左偏了约 15mm，左端内容落到标签外的留白里。

> 注意：这**不是**之前从 `detail` 解析里剥离的 `marginLeftMm/marginTopMm`（那是标签内部的排版留白，元素坐标相对标签左上角，剥离是正确的）。此处的偏移是**打印机硬件的"打印头原点 → 物理标签位置"偏移**，属于另一种量。

修复（`utils/adapters/lpapiAdapter.js` + `utils/lpapiTemplate.js`）：
1. 连接时读取 `getPrinterInfo().printerWidth`（点），换算出打印头可打印宽度 `printableMm = printerWidth / (dpi/25.4)`（约 81mm）。
2. 打印/校准时，`startJob` 的画布宽度不再只传标签宽度，而是铺满整个打印头可打印宽度（取 `max(printableMm, 标签宽)`）；同时把所有绘制元素的 x 统一右移 `offsetX = (printableMm - 标签宽) / 2`（约 15.6mm）作居中补偿。
3. 越界检测仍按"标签坐标系"判断（offset 只作用于实际下发坐标，不改元素的逻辑位置），所以"元素超出标签会被裁"的告警依然准确。
4. 居中值可由模板 `page.offsetXMm` 覆盖：留空 = 自动居中；填入数值（正=向右、负=向左）可手动微调，应对不同介质导槽位置。设计页新增「水平偏移 (mm)」输入框。

验证建议：打完第一张若仍差几毫米，看控制台 `printTemplate ... offsetX(mm): 15.62 jobW(mm): 81.3` 的日志，再到设计页「水平偏移」里填微调值（例如实测还偏左 3mm 就填 `18.6`）。

> **实测复盘（同日二次）**：把 `offsetX≈15.6mm` 部署后真机打出来**与未加偏移时完全相同（仍偏左）**。日志确认偏移已下发（`drawText x:16.64`、`offsetX(mm):15.64`），但打印结果无变化——这推翻了"标签居中、右移 15.6mm 即居中"的假设。最合理的解释是：**打印机按它测得/配置的标签宽度（50mm）裁切位图**，加在 81.3mm 画布上的右移被裁掉，所以看不出变化。换言之，标签相对打印头的真实水平位置**无法靠猜确定**，必须实测。
>
> 因此新增**「标尺对齐校准」**：点「写入打印机并校准」会打一张满宽（打印头宽）的纸，上面同时画出 3 个候选标签框（标注 `OFS=0` / `OFS=(居中位)` / `OFS=(右对齐位)`）+ 每 5mm 一根满宽刻度。用户打一张，看哪个框正好套住物理标签边缘，该框标注的偏移值就是要填进「水平偏移」的数。连接时也已读取真实 `paperWidth`（物理纸宽，点）并尝试用它算居中偏移，但仍以实测校准为准。
>
> 同时 `_startJob` 新增一行页面 canvas 实际像素宽日志（`_startJob 页面canvas像素: W x H`），下一步真机日志可确认画布到底是不是 960px（81.3mm），以判断是"画布没铺满"还是"打印机裁切"。

---

## 11. 验证情况（本次）

通过 Node ESM 功能测试（24 条断言全过）验证：
- 中性模型全毫米存储、`page` 无 `dpi`、`magnification` 已清除；
- pdaTemplate 与 detail 双格式解析元素齐全（含矩形/二维码，修复了此前 `rectangle`/`qrcode` 类型被静默丢弃的 bug）；
- 同一毫米模板在 203/300 dpi 下 ZPL 生成不同点值（证明非写死 203）；
- LPAPI 渲染器直接下发毫米坐标与字号（无折算）。
- 修复了 `zplTemplate.renderElement` 引用未定义变量 `dpi` 导致的 `ReferenceError`（已全部改为 `toDots()`）。

**二次清理（本回合）**：删除 `utils/cpclTemplate.js`，移除设置页 CPCL 测试/切换/发送按钮及 `sendCpcl`/`printCpclTest`/`buildCpclTestLabel`，中文默认字体与所有降级路径统一为 `E:HANS.TTF`（不再使用 `GB18030.FNT`）。重新运行 Node ESM 功能测试 **22 条断言全过**（CPCL 已不可 import、ZPL 中文走 HANS.TTF 且输出无 GB18030、203/300 dpi 折算正确、LPAPI 直发毫米、pdaTemplate/detail 解析齐全、旧模板含 page.dpi 仍按 opts.dpi 渲染）。

**三次修正（模板设计页 UI）**：移除 `labelTemplate.vue` 与 `labelImport.vue` 里残留的「打印机 DPI」选择器/显示（原绑定已被删除的 `tpl.page.dpi`）。新增 `printerManager.getPrinterDpi()`，`labelDots(tpl,dpi)` 增加真实 dpi 入参；设计页「换算结果」与导入页「尺寸/点数」改由 `printer.getPrinterDpi()` 显示**当前连接打印机的真实分辨率**，未连接时提示「将按打印机真实分辨率自动匹配」。模板模型本身不保存任何 dpi。

**四次修正（纸张类型 / 校准 / DPI，2026-08-17）**：
- `utils/zplTemplate.js` 的 `buildApplyMediaCommand` 对**间隙/黑标纸**在 `^JUS` 前补写 `^LL=标签高度`（限可打印区，避免 NVRAM 残留旧 `^LL` 把内容裁到下一格），并保留 `~JC` 传感器校准；连续纸仍只写 `^MNN^LL^JUS`。
- `utils/adapters/lpapiAdapter.js` 的 `buildCommitOpts` 新增 `gapTypeForMedia`：`commitJob.gapType` 跟随模板 `mediaType`（连续纸 `255` / 间隙黑标纸 `2`），`printTemplate` 与 `_printCalibrationLabel` 均已传入 `mediaType`。
- `pages/print/labelTemplate.vue`、`pages/print/labelImport.vue` 的「写入打印机并校准」提示改为**按协议动态文案**：ZPL 说明 `^LL` 对间隙/黑标纸无效需 `~JC` 校准、DPI 自动匹配；LPAPI 说明无持久化介质指令、尺寸随任务下发、校准=打印参考标签让传感器重学。
- 通过 Node ESM 功能测试验证 `buildApplyMediaCommand`：连续纸含 `^MNN^LL^JUS` 无 `~JC`；间隙/黑标纸含 `^MNY/^MNM + ^LL + ^JUS + ~JC`。LPAPI `gapTypeForMedia` 派生（continuous→255，其余→2）经逻辑核对正确。
