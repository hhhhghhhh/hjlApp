#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZR668 字体下载 v3 — 剥离 CISDF 头 + 裁剪 + 下载
1. 从 CISDF 文件中提取纯 TTF 数据
2. 用 fonttools 裁剪为 GB2312 常用字 + ASCII
3. 下载到打印机 E: 盘
4. 测试打印
"""
import os
import sys
import time
import struct
import win32print

PRINTER = "ZDesigner ZR668 Plus (ZPL)2"
CISDF_PATH = r"C:\Users\26281\Downloads\NOTOMRJ.TTF"
RAW_TTF_PATH = r"C:\Users\26281\Downloads\NOTOMRJ_RAW.TTF"
SUBSET_PATH = r"C:\Users\26281\Downloads\NOTOMRJ_SUBSET.TTF"
FONT_NAME = "NOTOMRJ"  # 不带扩展名

def parse_cisdf(filepath):
    """从 CISDF 文件提取纯 TTF 二进制数据"""
    with open(filepath, 'rb') as f:
        data = f.read()

    # CISDF header format:
    # ! CISDFCRC16\r\n
    # <format>\r\n
    # <filename>\r\n
    # <filesize_hex>\r\n
    # <crc16>\r\n
    # <raw TTF data...>

    # 找 TrueType magic: 00 01 00 00
    tt_magic = b'\x00\x01\x00\x00'
    pos = data.find(tt_magic)
    if pos < 0:
        # 也可能 OTTO (OpenType)
        pos = data.find(b'OTTO')
    if pos < 0:
        print("ERROR: Cannot find TrueType magic bytes in file!")
        print(f"First 100 bytes hex: {' '.join(f'{b:02x}' for b in data[:100])}")
        return None

    print(f"CISDF header size: {pos} bytes")
    print(f"TTF data size: {len(data) - pos} bytes ({(len(data)-pos)/1024/1024:.2f} MB)")

    # 解析 CISDF header 文本
    header_text = data[:pos].decode('ascii', errors='replace')
    print(f"CISDF header:\n{header_text}")

    ttf_data = data[pos:]
    return ttf_data

def extract_ttf():
    """提取纯 TTF"""
    print("=== Step 1: Extract raw TTF from CISDF ===")
    ttf_data = parse_cisdf(CISDF_PATH)
    if ttf_data is None:
        return None

    with open(RAW_TTF_PATH, 'wb') as f:
        f.write(ttf_data)

    size = os.path.getsize(RAW_TTF_PATH)
    print(f"Saved raw TTF: {RAW_TTF_PATH} ({size/1024/1024:.2f} MB)")

    # 验证 TTF 有效性
    try:
        from fontTools.ttLib import TTFont
        font = TTFont(RAW_TTF_PATH)
        num_glyphs = font['maxp'].numGlyphs
        print(f"TTF valid! Glyphs: {num_glyphs}")
        # 检查是否有 CJK cmap
        for table in font['cmap'].tables:
            if hasattr(table, 'getBestCmap'):
                cmap = table.getBestCmap()
                if cmap:
                    cjk_count = sum(1 for cp in cmap if cp > 0x4E00)
                    print(f"  CJK characters in cmap: {cjk_count}")
        font.close()
        return RAW_TTF_PATH
    except Exception as e:
        print(f"TTF validation error: {e}")
        return None

def subset_ttf(input_path, output_path):
    """裁剪字体"""
    print(f"\n=== Step 2: Subset font ===")
    from fontTools.subset import Subsetter, Options
    from fontTools.ttLib import TTFont

    font = TTFont(input_path)

    # 收集需要的字符
    chars = set()

    # ASCII 可见字符
    for c in range(0x20, 0x7F):
        chars.add(chr(c))

    # GB2312 全部字符
    print("  Collecting GB2312 characters...")
    for high in range(0xA1, 0xFF):
        for low in range(0xA1, 0xFF):
            try:
                ch = bytes([high, low]).decode('gb2312')
                chars.add(ch)
            except:
                pass

    # 常用扩展字符
    extras = "①②③④⑤⑥⑦⑧⑨⑩°±×÷√∞≠≈≤≥←→↑↓€£¥¢§¶•…—–·「」『』【】〈〉《》□■○●△▽◇◆"
    for c in extras:
        chars.add(c)

    print(f"  Total unique characters: {len(chars)}")

    options = Options()
    options.layout_features = []  # 去掉不需要的排版特性
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.recalc_bounds = True
    options.recalc_timestamp = True

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=[ord(c) for c in chars])
    subsetter.subset(font)

    font.save(output_path)
    font.close()

    size = os.path.getsize(output_path)
    print(f"  Subset saved: {output_path} ({size/1024/1024:.2f} MB)")
    return output_path

def send_zpl(data, label="ZPL"):
    if isinstance(data, str):
        data = data.encode('utf-8')
    handle = win32print.OpenPrinter(PRINTER)
    try:
        win32print.StartDocPrinter(handle, 1, (label, None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            win32print.WritePrinter(handle, data)
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)

def delete_old_fonts():
    print("\n=== Step 3: Delete old font files ===")
    for name in [f"E:{FONT_NAME}.TTF", f"E:{FONT_NAME}.TTF.TTF", f"E:{FONT_NAME}"]:
        send_zpl(f"^XA^ID{name}^XZ\r\n".encode('ascii'), f"Del {name}")
        print(f"  Deleted: {name}")
    time.sleep(1)

def download_font(font_path, font_name):
    print(f"\n=== Step 4: Download font ===")
    with open(font_path, 'rb') as f:
        font_data = f.read()

    filesize = len(font_data)
    print(f"Font: {font_path}")
    print(f"Size: {filesize} bytes ({filesize/1024/1024:.2f} MB)")

    header = f"~DYE:{font_name},TTF,B,B,{filesize},0,0\n".encode('ascii')
    print(f"~DY header: {header.decode('ascii').strip()}")

    combined = header + font_data
    print(f"Sending {len(combined)} bytes...")

    handle = win32print.OpenPrinter(PRINTER)
    try:
        win32print.StartDocPrinter(handle, 1, ("FontDL", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            chunk_size = 65536
            offset = 0
            total = len(combined)
            while offset < total:
                end = min(offset + chunk_size, total)
                win32print.WritePrinter(handle, combined[offset:end])
                offset = end
                pct = offset * 100 // total
                print(f"\r  {pct}% ({offset}/{total})", end="", flush=True)
            print()
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)
    print("Download complete.")

def test_print(font_name):
    print(f"\n=== Step 5: Test print ===")
    zpl = (
        "^XA"
        "^CI28"
        # 内置字体打 ASCII 确认连通
        "^A0N,30,30^FO30,30^FDBuilt-in: Hello 1234^FS\r\n"
        # 下载的 TTF 字体打中文
        f"^A@N,40,40,E:{font_name}.TTF^FO30,80^FD中文打印测试^FS\r\n"
        f"^A@N,25,25,E:{font_name}.TTF^FO30,140^FD直流模块(TY)标签^FS\r\n"
        f"^A@N,20,20,E:{font_name}.TTF^FO30,190^FD0123456789ABCDEF^FS\r\n"
        "^XZ\r\n"
    )
    send_zpl(zpl.encode('utf-8'), "TestPrint")
    print("Test print sent! Check printer output.")

if __name__ == "__main__":
    print("=" * 60)
    print("  ZR668 Font Download v3 (strip CISDF + subset)")
    print("=" * 60)

    # Step 1: 提取纯 TTF
    raw_path = extract_ttf()
    if not raw_path:
        print("FAILED: Cannot extract TTF from CISDF file")
        sys.exit(1)

    # Step 2: 裁剪
    subset_ok = False
    try:
        subset_ttf(raw_path, SUBSET_PATH)
        subset_size = os.path.getsize(SUBSET_PATH)
        print(f"\nSubset result: {subset_size/1024/1024:.2f} MB")
        subset_ok = True
    except Exception as e:
        print(f"\nSubset failed: {e}")
        print("Will try full TTF instead.")

    # Step 3: 删旧文件
    delete_old_fonts()

    # Step 4: 下载（优先裁剪版）
    if subset_ok and os.path.exists(SUBSET_PATH):
        download_font(SUBSET_PATH, FONT_NAME)
    else:
        download_font(raw_path, FONT_NAME)

    print("\nWaiting 8s for Flash write...")
    time.sleep(8)

    # Step 5: 测试打印
    test_print(FONT_NAME)

    print("\n" + "=" * 60)
    print("  DONE! Check the printed label.")
    print("  - Chinese text visible = SUCCESS")
    print("  - Only ASCII or blank = font not working")
    print("=" * 60)
