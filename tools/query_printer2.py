#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Query ZR668 via the same printer handle for write+read."""
import win32print
import ctypes
from ctypes import wintypes
import time

PRINTER = "ZDesigner ZR668 Plus (ZPL)2"

winspool = ctypes.WinDLL("winspool.drv")
winspool.ReadPrinter.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
winspool.ReadPrinter.restype = wintypes.BOOL

def send_and_read(cmd, wait=4, label="query"):
    """Send command and attempt to read response using the same handle."""
    handle = win32print.OpenPrinter(PRINTER)
    raw_handle = int(handle)  # PyHANDLE -> int

    win32print.StartDocPrinter(handle, 1, (label, None, "RAW"))
    try:
        win32print.StartPagePrinter(handle)
        win32print.WritePrinter(handle, cmd)
        
        # Wait for printer to process
        time.sleep(wait)
        
        # Read response using ctypes with the SAME handle
        buf = ctypes.create_string_buffer(16384)
        bytesRead = wintypes.DWORD(0)
        full_resp = b""
        
        for attempt in range(15):
            ok = winspool.ReadPrinter(raw_handle, buf, 16384, ctypes.byref(bytesRead))
            if ok and bytesRead.value > 0:
                full_resp += buf.raw[:bytesRead.value]
            elif not ok:
                err = ctypes.GetLastError()
                if err != 0:
                    print(f"  ReadPrinter err={err} (attempt {attempt+1})")
                break
            else:
                time.sleep(0.3)
        
        win32print.EndPagePrinter(handle)
    finally:
        win32print.EndDocPrinter(handle)
    win32print.ClosePrinter(handle)
    return full_resp

# Test 1: ~HD - E: drive directory listing
print("=== ~HD: E: drive directory ===")
resp = send_and_read(b"~HD\r\n", wait=4, label="DirListing")
if resp:
    print(resp.decode("ascii", errors="replace"))
else:
    print("(no response)")

# Test 2: SGD - free memory
print("\n=== SGD: memory.free_space ===")
resp = send_and_read(b'!U1 getvar "memory.free_space"\r\n', wait=3, label="FreeMem")
if resp:
    print(resp.decode("ascii", errors="replace"))
else:
    print("(no response)")

# Test 3: SGD - firmware/app name
print("\n=== SGD: appl.name ===")
resp = send_and_read(b'!U1 getvar "appl.name"\r\n', wait=3, label="Firmware")
if resp:
    print(resp.decode("ascii", errors="replace"))
else:
    print("(no response)")

# Test 4: SGD - zpl_mode
print("\n=== SGD: zpl.zpl_mode ===")
resp = send_and_read(b'!U1 getvar "zpl.zpl_mode"\r\n', wait=3, label="ZplMode")
if resp:
    print(resp.decode("ascii", errors="replace"))
else:
    print("(no response)")
