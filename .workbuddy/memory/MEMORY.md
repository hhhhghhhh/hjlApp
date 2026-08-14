# hjlApp 项目长期记忆

## 项目概况
- uni-app v3 蓝牙打印 PDA 应用，目标平台 Android
- 核心功能：标签模板设计 + 蓝牙打印 + CodeSoft 标签导入
- 打印机适配以 Zebra ZPL 为主，正在扩展多机型支持

## 打印机适配
- **ZR668**：Zebra 便携机，203dpi，ZPL2 模式
  - **自带 HANS.TTF（19MB，简体中文）**，之前误以为没有中文字体是因为只查了 `*.FNT` 没查 `*.TTF`
  - NOTOMRJ.TTF 下载实际未成功（`~DY` 参数格式 bug），测试打印出中文是打印机自动回退到 HANS.TTF
  - 中文渲染：优先 `^A@ E:HANS.TTF`（自动检测），后备位图渲染 `^GFA`
- **ZD410**：Zebra 桌面机，有内置 GB18030.FNT
- **IB-PTM7330**：TPCL + ESC/POS 指令集，300dpi（适配方案设计中）

## 技术约定
- 5+ App Android 反射模式：`plus.android.importClass` / `inv(obj, method)` / 直接字段访问
- JS Function.prototype.valueOf 会拦截 Class 代理上的 valueOf 调用，必须用直接字段访问
- `typeof null === 'object'`，判断类型时先排除 null
- 蓝牙通信走经典蓝牙 SPP（UUID 00001101）
- ZPL 中文用 `^CI28` (UTF-8) 编码

## 关键文件
- `utils/zebraPrinter.js` — 蓝牙通信层 + 字体检测
- `utils/zplTemplate.js` — ZPL 模板生成 + CJK 渲染策略
- `utils/cjkBitmap.js` — 位图渲染（Android Canvas + Paint 反射）
- `tools/download_font_v3.py` — Zebra CISDF 字体剥离 + 裁剪 + 下载工具

## CJK 渲染优先级
1. TTF 字体 (`^A@ E:HANS.TTF` 等) — 原生渲染，快、清晰，自动检测 HANS/HANT/NOTOMRJ
2. 位图渲染 (`^GFA`) — Android Canvas 逐像素二值化，慢但通用
3. 内置字体 (`^A@ E:GB18030.FNT`) — 仅在有 CJK 字库的打印机上有效
