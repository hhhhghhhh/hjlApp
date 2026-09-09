# 打印模板能力缺口分析（LPAPI / itemLotSn.Lab）

> 目标：对照你的模板（`itemLotSn.Lab`）、`CSPrintService` 解析服务产出的字段、`hjlApp` 解析层（`utils/labTemplate.js`）+ 渲染层（`utils/lpapiTemplate.js`）的现状，以及 LPAPI SDK 的真实能力，逐项列出**哪些模板能力还没接进打印链路**，并给出"最终版本"该打包哪些功能的建议。

---

## 1. 模板能力清单（数据源头：CSPrintService）

`CSPrintService` 产出两种视图：`detail`（忠实全量）和 `pdaTemplate`（PDA 精简视图）。**重要差异**：`pdaTemplate` 是 `PdaTemplateMapper.MapText` 手工挑选字段生成的，很多字型/颜色字段它压根没输出；只有 `detail` 才带全 `LabObject.font` 全字段。下面以 `detail` 为"能力上界"，并标注 `pdaTemplate` 是否也带。

### 1.1 文本对象（Text）可用字段
| 字段 | 含义 | detail 有 | pdaTemplate 有 |
|---|---|---|---|
| `font.name` | 字体名（宋体/黑体…） | ✅ | ✅（但 App 故意不传，走 system-ui 兜底） |
| `font.sizePt` | 字号 pt | ✅ | ✅ |
| `font.bold` | 粗体 | ✅ | ✅ |
| `font.italic` | 斜体 | ✅ | ✅ |
| `font.underline` | 下划线 | ✅ | ❌（Mapper 没输出） |
| `font.strikeThrough` | 删除线 | ✅ | ❌ |
| `foreColor` / `backColor` | 文字/背景色（int 颜色值） | ✅ | ❌ |
| `alignment` / `alignmentName` | 水平对齐 left/center/right | ✅ | ✅ |
| `wordWrap` | 自动换行 | ✅ | ❌ |
| `fitToFrame` | 缩放适应框 | ✅ | ❌ |

### 1.2 一维码 / 二维码（Barcode / QR）可用字段
| 字段 | 含义 | detail 有 | pdaTemplate 有 |
|---|---|---|---|
| `symbology` / `symbologyName` | 码制（QRCode/Code128…） | ✅ | ✅ |
| `is2D` | 是否二维码 | ✅ | ✅（派生 type） |
| `narrowBarWidthMm` | 一维码窄条宽 | ✅ | ✅ |
| `barHeightMm` | 净条高 | ✅ | ✅ |
| `ratio` | 宽窄条比 | ✅ | ✅（仅 pdaTemplate，App 未用） |
| `hrPosition` / `hrPositionName` | 供人识读文本位置（none/above…） | ✅ | ✅（→ showText/textPosition） |
| `moduleXMm` / `moduleYMm` | 二维码模块尺寸 | ✅ | ✅（仅 moduleX，Y 未用） |
| `ecc` | 二维码纠错级 | ✅ | ✅ |

### 1.3 图形（Line / Rectangle）
| 字段 | 含义 | detail 有 | pdaTemplate 有 |
|---|---|---|---|
| `lineWidthMm` / `thicknessMm` | 线宽 | ✅ | ✅ |
| `foreColor` / `backColor` | 颜色 | ✅ | ❌ |

### 1.4 页面 / 标签（Label）
`widthMm/heightMm/pageWidthMm/pageHeightMm/marginLeftMm/marginTopMm/horizontalGapMm/verticalGapMm/columns/rows/portrait/stockName/stockType/mediaType`。

> `columns/rows` = 一张纸上排多列多行（标签矩阵）。当前 App **只渲染单张标签**（1×1），矩阵排版未实现。

---

## 2. 当前 App 实现状态

### 2.1 解析层 `utils/labTemplate.js`
- 文本：取了 `sizePt`(→mm)、`align`、宽高、旋转、anchor、内容；**`bold/italic` 在 `normalizeDetailObject`(475-476) 已读出，但 `convertElement` 文本分支(272-277) 没写进中性模型 → 半路丢失**；`underline/strikeThrough/color/wordWrap/fitToFrame` 从未读取。
- 一维码：`showText`、`subtype`、`moduleWidthMm`、`barHeightMm` 已解析。
- 二维码：`ecc`、`moduleWidthMm`、宽高已解析。
- 线/框：`thicknessMm`(detail) / `thicknessMm`(pdaTemplate) 已解析。
- `mediaType`：已处理（unknown→按 gap 兜底）。
- `columns/rows`：已剥离，未实现矩阵。

### 2.2 渲染层 `utils/lpapiTemplate.js`
- 文本 `drawText`：**未传 `fontStyle`（粗/斜）、未传 `orientation`（逐元素旋转）、未传 `verticalAlignment`、未传 `lineSpace/charSpace`（写死 1.172 系数）**。
- 一维码 `renderBarcode`：**忽略 `showText`**，强制 `textHeight = max(2, barHmm*0.3)` 永远画供人识读文本。
- 二维码 `renderQrcode`：`ecc` 已用，`moduleYMm` 未用（LPAPI 按框尺寸画，Y 不影响）。
- 线/框：线宽已用。
- 文件顶部注释（9-11 行）称"单元素 rotation 不生效"——但 **SDK 的 `drawText/draw1DBarcode/draw2DQRCode/drawRectangle/drawLine` 公开参数表里都含 `orientation`**，该注释已过时，逐元素旋转是潜在可补能力（需真机验证）。

### 2.3 SDK 真实能力（来自 `dothan-lpapi-ble/readme.md`）
- `drawText` 参数：text / x / y / width / height / **fontName** / fontHeight / **fontStyle(0常规/1粗/2斜/3粗斜)** / autoReturn / **charSpace** / **lineSpace** / regionRightBorders / onlyMeasureText / **orientation(逐元素 0/90/180/270)** / horizontalAlignment / **verticalAlignment**。
- `draw1DBarcode` 参数：含 **textHeight（0=不显示供人识读文本）** / textBarSpace / orientation / horizontalAlignment / verticalAlignment / fontStyle / fontName。
- `draw2DQRCode` 参数：eccLevel / orientation / horizontalAlignment / verticalAlignment。
- **无** 任何 `underline` / `strikeThrough` / `color` / `foreColor` / `backColor` 参数。

---

## 3. 缺口对照矩阵（核心）

状态图例：✅=已打通  ⚠️=已解析未渲染  ❌=SDK/视图不支持  ➕=建议补

| 能力 | detail 有 | pdaTemplate 有 | App 解析 | LPAPI 渲染 | SDK 支持 | 当前状态 | 建议 |
|---|:--:|:--:|:--:|:--:|:--:|---|---|
| 粗体 bold | ✅ | ✅ | ⚠️读出未写模型 | ❌ | ✅ | **半路丢** | ➕ 补 |
| 斜体 italic | ✅ | ✅ | ⚠️同上 | ❌ | ✅ | **半路丢** | ➕ 补 |
| 下划线 underline | ✅ | ❌ | ❌ | ❌ | ❌ | 印不出 | 放弃 |
| 删除线 strikeThrough | ✅ | ❌ | ❌ | ❌ | ❌ | 印不出 | 放弃 |
| 文字颜色 fore/backColor | ✅ | ❌ | ❌ | ❌ | ❌ | 单色机无意义 | 放弃 |
| 水平对齐 align | ✅ | ✅ | ✅ | ✅ | ✅ | 已打通 | — |
| 垂直对齐 verticalAlignment | ✅(anchor派生) | ❌ | ❌ | ❌ | ✅ | 未渲染 | 可选补 |
| 自动换行 wordWrap | ✅ | ❌ | ❌ | 已由 autoReturn+撑高框覆盖 | — | 设计已覆盖 | 放弃 |
| fitToFrame 缩放 | ✅ | ❌ | ❌ | 已由撑高框近似 | — | 设计已覆盖 | 放弃 |
| 一维码供人识读文本 showText | ✅ | ✅ | ✅ | ⚠️忽略(永远画) | ✅(textHeight=0) | **可关未关** | ➕ 补 |
| 一维码文本位置 above/below | ✅ | ✅ | ⚠️读出未用 | ❌ | 部分(verticalAlign) | 低优先 | 可选 |
| 元素级旋转 rotation | ✅ | ✅ | ✅(存模型) | ❌(仅整标签) | ✅(orientation) | **注释过时,可补** | ➕ 验证后补 |
| 二维码 ecc | ✅ | ✅ | ✅ | ✅ | ✅ | 已打通 | — |
| 二维码 moduleY | ✅ | 部分 | ❌ | N/A(LPAPI按框画) | — | 无关 | 放弃 |
| 线宽 thickness | ✅ | ✅ | ✅ | ✅ | ✅ | 已打通 | — |
| 多列多行矩阵 columns/rows | ✅ | ✅ | 剥离 | ❌ | — | 未实现 | 单独任务 |
| 图片 image | ✅ | ⚠️占位 | 跳过 | 跳过 | ✅(drawImage) | 未实现 | 单独任务 |

---

## 4. 按可行性分组

### A 组：可立即补（SDK 支持 + 数据已到位，纯透传）
1. **粗体 + 斜体**（`fontStyle`）：`labTemplate.js` `convertElement` 文本分支补 `if(el.bold)out.bold=true; if(el.italic)out.italic=true`；`lpapiTemplate.js` `renderText` 的 `drawText` 补 `fontStyle:(el.bold?1:0)|(el.italic?2:0)`。影响：你模板里 `Text1/Text3` 的 `bold:true` 终于生效。
2. **一维码供人识读文本开关**（`showText`）：`renderBarcode` 改为 `textHeight: el.showText===false ? 0 : Math.max(2, barHmm*0.3)`。影响：标了"不显示文本"的条码不再多印一行字。
3. **元素级旋转**（`orientation`）：SDK 参数已存在，把 `el.rotation`（已存中性模型）映射到 `drawText/draw1DBarcode/draw2DQRCode/drawRectangle/drawLine` 的 `orientation`。**需真机验证** SDK 是否真在 draw 模式逐元素生效（顶部旧注释说不支持，但参数表说支持）。

### B 组：可实现但需权衡（SDK 支持，但模板未携带数据，需走默认值/全局设置）
4. **垂直对齐**（`verticalAlignment`）：由 anchor 派生（top→Start / center→Center / bottom→End）。收益有限（当前已撑高框），优先级低。
5. **行距 `lineSpace` / 字距 `charSpace`**：SDK 支持，但 `CSPrintService` 不导出这两字段，无模板数据来源。若要做只能加"全局默认行距"设置（你之前已定：**保持 SDK 最小行距，不改**），故不纳入。

### C 组：SDK 不支持，印不出来（放弃）
6. **下划线 / 删除线**：`drawText` 无此参数。若强需求，只能画线 hack 模拟下划线，偏位风险高，不推荐。
7. **文字颜色 foreColor/backColor**：单色热敏/标签机下无意义，且 SDK 无 color 参数。

### D 组：设计侧已覆盖 / 不适用
8. **wordWrap / fitToFrame**：已被 `autoReturn:true` + 多行撑高框逻辑覆盖，无需单独字段。
9. **columns/rows 标签矩阵**：属于"一次印多张"的排版能力，与单标签渲染正交，建议作为独立任务（涉及 startJob 尺寸与重复下发）。
10. **图片 image**：需转点阵，当前跳过。独立任务。

---

## 5. 对你这份 `itemLotSn.Lab` 的具体影响

模板里实际用到的字型字段：
- `Text1`(itemLotSn)：`bold:true`、`italic:false`、`underline:false`、`strikeThrough:false`、`align:center`、`sizePt:3.5`、框 10×1.19mm。
- `Text3`(itemName)：`bold:true`、`italic:false`、`underline:false`、`strikeThrough:false`、`align:center`、`sizePt:6.0`、框 18×2.12mm。
- `Barcode1`(QR)：`ecc:Q`、`moduleXMm:0.25`、`is2D:true`。

**当前会丢的只有 `bold`（两个文本都标了 true）**。补 A 组①后，两行文字变粗体、笔画更实。
`underline/strikeThrough` 在你这模板里都是 false，本来就没用，不补无影响。
该模板无 一维码，②（showText 开关）对你这份无直接影响，但对将来别的模板有用。
⚠️ 仍提醒：`Text1` 是 **3.5pt（≈1.24mm 字高）、框仅 1.19mm 高**，加粗体只让笔画更实，框仍装不下单行（字比框高），建议 CodeSoft 里提到 4~5pt、框高 ≥2mm 才真正清晰——这是设计侧的事，代码只负责透传粗体。

---

## 6. "最终版本"建议打包方案

**推荐「A 组最小可用包」**（你确认后我一次性改完）：
- ✅ 粗体 + 斜体透传（bold/italic → fontStyle）
- ✅ 一维码供人识读文本开关（showText → textHeight:0）
- ⏳ 元素级旋转：先真机验证 SDK 是否支持，再决定是否并入（避免把已稳定的正向打印带偏）

**不纳入最终版**（按前述理由）：
- 下划线/删除线/文字颜色（SDK 印不出）
- 垂直对齐、行距/字距（收益低或你已定调不改）
- 标签矩阵 columns/rows、图片（独立大任务，不在本次"补字段"范围）

涉及文件（改动极小，纯透传）：
- `utils/labTemplate.js`：`convertElement` 文本分支（~272 行）补 bold/italic 输出。
- `utils/lpapiTemplate.js`：`renderText`（~139 行）补 `fontStyle`；`renderBarcode`（~176 行）补 `showText→textHeight` 逻辑；元素级旋转在 4 个 render 函数加 `orientation`（验证后）。

---

## 7. 风险与注意事项
- 所有改动都是**字段透传，不动坐标/尺寸**，不会引入偏移或越界。
- 测试打印 `printTestLpapi` 不走模板，不受影响。
- Zebra/ZPL 链路本次不碰（ZPL 无 bold/italic 属性，需另走粗体字体文件机制）。
- 只动 LPAPI 当前机型；原生打印需 HBuilder 重运行到手机，`Ctrl+F5` 仅验证 H5 解析层。
- 元素级旋转若并入，务必先真机打一张含旋转元素的标签核对方向（CodeSoft 与 LPAPI 旋转方向定义可能相反，代码注释已预警）。
