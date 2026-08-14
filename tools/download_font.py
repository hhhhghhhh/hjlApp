#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZR668 字体下载工具
1. 通过 COM5 或 win32print 查询打印机内存
2. 下载 TTF 字体到 E: 盘
3. 测试打印中文
"""
import sys
import time
import struct

PRINTER_NAME = "ZDesigner ZR668 Plus (ZPL)2"
FONT_PATH = r"C:\Users\26281\Downloads\NOTOMRJ.TTF"
FONT_NAME = "NOTOMRJ"
COM_PORT = "COM5"
BAUD = 115200

def try_com_query():
    """通过 COM 端口查询打印机内存"""
    import serial
    try:
        ser = serial.Serial(COM_PORT, BAUD, timeout=3)
        time.sleep(0.3)
        # 清空缓冲区
        ser.reset_input_buffer()
        ser.reset_output_buffer()

        # 查询 E: 盘目录 + 可用空间
        cmd = b"~HD\r\n"
        ser.write(cmd)
        time.sleep(2)

        resp = b""
        while ser.in_waiting > 0:
            resp += ser.read(ser.in_waiting)

        ser.close()
        return resp.decode('ascii', errors='replace')
    except Exception as e:
        return f"COM_ERROR: {e}"

def try_win32print_query():
    """通过 win32print 发送查询并尝试读取"""
    import win32print
    import win32gui
    try:
        handle = win32print.OpenPrinter(PRINTER_NAME)
        win32print.StartDocPrinter(handle, 1, ("Memory Query", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            # ~HD = directory listing of E: drive
            win32print.WritePrinter(handle, b"~HD\r\n")
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
        win32print.ClosePrinter(handle)

        # 尝试读取响应（部分驱动支持）
        time.sleep(2)
        return "Query sent via win32print (response not readable via API)"
    except Exception as e:
        return f"WIN32_ERROR: {e}"

def download_font_win32print(font_path, font_name):
    """通过 win32print 下载字体到打印机 E: 盘"""
    import win32print

    with open(font_path, 'rb') as f:
        font_data = f.read()

    filesize = len(font_data)
    print(f"Font size: {filesize} bytes ({filesize/1024/1024:.2f} MB)")

    # 先删除可能已存在的同名文件
    delete_cmd = f"^XA^IDE:{font_name}.TTF^XZ\r\n".encode('ascii')

    # ~DY 命令头：下载二进制数据到 E: 盘
    # 格式: ~DY<drive>:<filename>,<ext>,<format>,<datatype>,<totalbytes>,<width>,<height>
    header = f"~DYE:{font_name}.TTF,TTF,B,B,{filesize},0,0\n".encode('ascii')

    # 合并：先删旧文件，再发下载头+二进制数据
    combined = delete_cmd + header + font_data

    print(f"Total data to send: {len(combined)} bytes ({len(combined)/1024/1024:.2f} MB)")
    print("Sending to printer... (this may take 10-30 seconds)")

    handle = win32print.OpenPrinter(PRINTER_NAME)
    try:
        win32print.StartDocPrinter(handle, 1, ("Font Download", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)

            # 分块发送（每块 64KB）避免一次发 18MB 出问题
            chunk_size = 65536
            offset = 0
            total = len(combined)
            while offset < total:
                end = min(offset + chunk_size, total)
                chunk = combined[offset:end]
                win32print.WritePrinter(handle, chunk)
                offset = end
                # 进度
                pct = offset * 100 // total
                print(f"\r  Progress: {pct}% ({offset}/{total})", end="", flush=True)

            print()  # 换行
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)

    print("Font download sent.")
    return True

def download_font_com(font_path, font_name):
    """通过 COM 端口下载字体"""
    import serial

    with open(font_path, 'rb') as f:
        font_data = f.read()

    filesize = len(font_data)
    print(f"Font size: {filesize} bytes ({filesize/1024/1024:.2f} MB)")

    ser = serial.Serial(COM_PORT, BAUD, timeout=5)
    time.sleep(0.3)
    ser.reset_input_buffer()
    ser.reset_output_buffer()

    # 先删旧文件
    delete_cmd = f"^XA^IDE:{font_name}.TTF^XZ\r\n".encode('ascii')
    ser.write(delete_cmd)
    time.sleep(0.5)
    if ser.in_waiting:
        ser.read(ser.in_waiting)

    # ~DY 头
    header = f"~DYE:{font_name}.TTF,TTF,B,B,{filesize},0,0\n".encode('ascii')
    print(f"Sending header: {header.decode('ascii').strip()}")

    # 先发头
    ser.write(header)
    time.sleep(0.1)

    # 分块发二进制数据
    chunk_size = 4096
    offset = 0
    while offset < filesize:
        end = min(offset + chunk_size, filesize)
        chunk = font_data[offset:end]
        ser.write(chunk)
        ser.flush()
        offset = end
        pct = offset * 100 // filesize
        print(f"\r  Progress: {pct}% ({offset}/{filesize})", end="", flush=True)

    print()
    time.sleep(1)

    # 读取可能的错误响应
    resp = b""
    while ser.in_waiting > 0:
        resp += ser.read(ser.in_waiting)

    ser.close()

    if resp:
        print(f"Printer response: {resp.decode('ascii', errors='replace')}")
    else:
        print("No error response from printer (likely OK)")

    print("Font download sent.")
    return True

def test_print(font_name):
    """测试打印中文"""
    import win32print

    # 测试 ZPL：使用下载的 TTF 字体打印中文
    zpl = (
        "^XA"
        "^CI28"                                    # UTF-8 编码
        f"^A@N,40,40,E:{font_name}.TTF\r\n"         # 使用下载的 TTF 字体
        "^FO50,50^FD中文打印测试^FS\r\n"
        f"^A@N,25,25,E:{font_name}.TTF\r\n"         # 小字
        "^FO50,120^FD直流模块(TY)标签^FS\r\n"
        "^A@N,20,20,E:NOTOMRJ.TTF\r\n"
        "^FO50,180^FDABCDEFGHIJKLMNOPQRSTUVWXYZ^FS\r\n"
        "^XZ\r\n"
    ).encode('utf-8')

    handle = win32print.OpenPrinter(PRINTER_NAME)
    try:
        win32print.StartDocPrinter(handle, 1, ("Font Test", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            win32print.WritePrinter(handle, zpl)
            win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)

    print("Test print sent. Check the printer output.")

def verify_font_com(font_name):
    """通过 COM 验证字体是否已存在"""
    import serial
    try:
        ser = serial.Serial(COM_PORT, BAUD, timeout=3)
        time.sleep(0.3)
        ser.reset_input_buffer()

        # 查询 E: 盘文件列表
        cmd = f"^XA^HWE:*.*^XZ\r\n".encode('ascii')
        ser.write(cmd)
        time.sleep(2)

        resp = b""
        while ser.in_waiting > 0:
            resp += ser.read(ser.in_waiting)

        ser.close()
        result = resp.decode('ascii', errors='replace')
        if font_name.upper() in result.upper():
            print(f"✓ Font '{font_name}.TTF' found on E: drive!")
            print(f"  Directory listing:\n{result}")
            return True
        else:
            print(f"✗ Font '{font_name}.TTF' NOT found on E: drive")
            print(f"  Directory listing:\n{result}")
            return False
    except Exception as e:
        print(f"COM verify error: {e}")
        return None

if __name__ == "__main__":
    print("=" * 60)
    print("  ZR668 TTF Font Download Tool")
    print("=" * 60)

    # Step 1: 查询打印机内存
    print("\n[1/4] Querying printer memory via COM5...")
    resp = try_com_query()
    print(f"  COM5 response: {resp[:500] if resp else '(empty)'}")

    # Step 2: 验证当前字体列表
    print("\n[2/4] Checking existing fonts on E: drive via COM5...")
    verify_font_com(FONT_NAME)

    # Step 3: 下载字体
    print(f"\n[3/4] Downloading font: {FONT_PATH}")
    print(f"  Target: E:{FONT_NAME}.TTF")

    # 尝试 win32print 方式（USB002，更快）
    try:
        download_font_win32print(FONT_PATH, FONT_NAME)
    except Exception as e:
        print(f"  win32print failed: {e}")
        print("  Trying COM5 fallback...")
        download_font_com(FONT_PATH, FONT_NAME)

    # 等待打印机写入 Flash
    print("\n  Waiting for Flash write to complete (5s)...")
    time.sleep(5)

    # Step 4: 验证 + 测试
    print("\n[4/4] Verifying font and test printing...")
    verify_font_com(FONT_NAME)
    test_print(FONT_NAME)

    print("\n" + "=" * 60)
    print("  Done! Check printer output for Chinese text.")
    print("=" * 60)
