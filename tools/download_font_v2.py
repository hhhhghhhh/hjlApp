#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZR668 TTF 字体下载 v2 — 修正 ~DY 文件名格式 + 裁剪备份
1. 先删旧文件（NOTOMRJ.TTF 和 NOTOMRJ.TTF.TTF 都删）
2. 先试全量字体
3. 如果全量不行（内存不够），自动裁剪为 GB2312 常用字 + ASCII
"""
import sys
import os
import time
import win32print

PRINTER = "ZDesigner ZR668 Plus (ZPL)2"
FONT_PATH = r"C:\Users\26281\Downloads\NOTOMRJ.TTF"
FONT_NAME = "NOTOMRJ"  # 不带扩展名！

def send_zpl(data, label="ZPL"):
    """发送 ZPL/原始数据到打印机"""
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

def delete_font_files():
    """删除可能存在的旧字体文件"""
    names = [
        f"E:{FONT_NAME}.TTF",
        f"E:{FONT_NAME}.TTF.TTF",
        f"E:{FONT_NAME}",
    ]
    for name in names:
        zpl = f"^XA^ID{name}^XZ\r\n"
        send_zpl(zpl.encode('ascii'), f"Delete {name}")
        print(f"  Deleted: {name}")
    time.sleep(1)

def download_font(font_path, font_name):
    """下载 TTF 字体到 E: 盘"""
    with open(font_path, 'rb') as f:
        font_data = f.read()

    filesize = len(font_data)
    print(f"Font: {font_path}")
    print(f"Size: {filesize} bytes ({filesize/1024/1024:.2f} MB)")

    # ~DY 命令格式:
    # ~DY<drive>:<filename>,<extension>,<format>,<datatype>,<totalbytes>,<width>,<height>
    # 注意: filename 不带扩展名! 扩展名在单独的 extension 字段
    header = f"~DYE:{font_name},TTF,B,B,{filesize},0,0\n".encode('ascii')
    print(f"Header: {header.decode('ascii').strip()}")

    combined = header + font_data
    print(f"Sending {len(combined)} bytes...")

    handle = win32print.OpenPrinter(PRINTER)
    try:
        win32print.StartDocPrinter(handle, 1, ("FontDownload", None, "RAW"))
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

def subset_font(input_path, output_path, chars_file=None):
    """裁剪字体只保留 GB2312 常用字 + ASCII"""
    from fontTools.subset import Subsetter, Options
    from fontTools.ttLib import TTFont

    print(f"Subsetting {input_path} -> {output_path}")

    font = TTFont(input_path, fontNumber=0)

    # 收集需要的字符
    chars = set()

    # ASCII 可见字符
    for c in range(0x20, 0x7F):
        chars.add(chr(c))

    # GB2312 全部字符 (一级 + 二级汉字 + 符号)
    # GB2312 范围: 0xA1A1 - 0xFEFE
    for high in range(0xA1, 0xFF):
        for low in range(0xA1, 0xFF):
            try:
                ch = bytes([high, low]).decode('gb2312')
                chars.add(ch)
            except:
                pass

    # 常用符号
    extra = "①②③④⑤⑥⑦⑧⑨⑩°±×÷∈√∞≠≈≤≥←→↑↓↔↕€£¥¢§¶•…—–·「」『』【】〈〉《》"
    for c in extra:
        chars.add(c)

    print(f"  Total unique characters: {len(chars)}")

    options = Options()
    options.layout_features = ['kern', 'liga']  # 保留基本排版特性
    options.name_IDs = ['*']  # 保留所有 name 记录
    options.notdef_outline = True

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=[ord(c) for c in chars])

    # 可能需要设置 glyph names
    subsetter.populate(glyph_names=[])

    try:
        subsetter.subset(font)
    except Exception as e:
        print(f"  Subset warning: {e}")
        # 尝试不设 glyph_names
        font2 = TTFont(input_path, fontNumber=0)
        options2 = Options()
        options2.layout_features = []
        options2.name_IDs = ['*']
        options2.notdef_outline = True
        subsetter2 = Subsetter(options=options2)
        subsetter2.populate(unicodes=[ord(c) for c in chars])
        subsetter2.subset(font2)
        font2.save(output_path)
        print(f"  Saved (fallback): {output_path}")
        return

    font.save(output_path)
    size = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({size/1024/1024:.2f} MB)")
    return output_path

def test_print(font_name):
    """测试打印"""
    zpl = (
        "^XA"
        "^CI28"
        f"^A@N,40,40,E:{font_name}.TTF\r\n"
        "^FO30,30^FD中文打印测试^FS\r\n"
        f"^A@N,25,25,E:{font_name}.TTF\r\n"
        "^FO30,90^FD直流模块(TY)^FS\r\n"
        f"^A@N,20,20,E:{font_name}.TTF\r\n"
        "^FO30,140^FDABCDEFGHIJKLMNOPQRSTUVWXYZ^FS\r\n"
        f"^A@N,20,20,E:{font_name}.TTF\r\n"
        "^FO30,180^FD0123456789^FS\r\n"
        "^XZ\r\n"
    )
    send_zpl(zpl.encode('utf-8'), "TestPrint")
    print("Test print sent!")

def test_print_with_all_fonts():
    """测试：用内置字体打印一行 + 用下载字体打印一行"""
    zpl = (
        "^XA"
        "^CI28"
        # 先用内置字体打一行 ASCII（确认打印机能工作）
        "^A0N,30,30\r\n"
        "^FO30,30^FDBuilt-in Font Test 1234^FS\r\n"
        # 再用下载的 TTF 字体打中文
        f"^A@N,40,40,E:{FONT_NAME}.TTF\r\n"
        "^FO30,80^FD中文测试直流模块^FS\r\n"
        "^XZ\r\n"
    )
    send_zpl(zpl.encode('utf-8'), "DualTest")
    print("Dual test print sent!")

if __name__ == "__main__":
    print("=" * 60)
    print("  ZR668 Font Download v2 (fixed ~DY format)")
    print("=" * 60)

    # Step 1: 删除旧文件
    print("\n[1] Deleting old font files...")
    delete_font_files()

    # Step 2: 先试全量字体
    print(f"\n[2] Downloading full font (18MB)...")
    try:
        download_font(FONT_PATH, FONT_NAME)
        print("  Waiting 8s for Flash write...")
        time.sleep(8)
    except Exception as e:
        print(f"  Full download failed: {e}")

    # Step 3: 测试打印
    print(f"\n[3] Test print with downloaded font...")
    test_print_with_all_fonts()
    time.sleep(2)

    # Step 4: 如果全量不行，裁剪后重试
    print(f"\n[4] Preparing subset font as backup...")
    subset_path = os.path.join(os.path.dirname(FONT_PATH), "NOTOMRJ_SUBSET.TTF")
    if not os.path.exists(subset_path):
        try:
            subset_font(FONT_PATH, subset_path)
        except Exception as e:
            print(f"  Subset failed: {e}")

    if os.path.exists(subset_path):
        subset_size = os.path.getsize(subset_path)
        print(f"\n[5] Subset font ready: {subset_size/1024/1024:.2f} MB")
        print(f"    If the full font didn't work, try downloading the subset:")
        print(f"    python tools/download_font_v2.py --subset")

    print("\n" + "=" * 60)
    print("  Check the printed label:")
    print("  - If Chinese text appears: font loaded OK!")
    print("  - If only ASCII or blank: font didn't load, try subset")
    print("=" * 60)
