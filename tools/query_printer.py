#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Query ZR668 printer memory and font listing via ctypes ReadPrinter."""
import ctypes
from ctypes import wintypes
import time
import win32print

PRINTER = "ZDesigner ZR668 Plus (ZPL)2"

def query_printer(cmd_bytes, wait=3):
    """Send a command and try to read the response."""
    winspool = ctypes.WinDLL("winspool.drv")
    
    # Setup function signatures
    winspool.OpenPrinterW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(wintypes.HANDLE), ctypes.c_void_p]
    winspool.OpenPrinterW.restype = wintypes.BOOL
    winspool.ReadPrinter.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    winspool.ReadPrinter.restype = wintypes.BOOL
    winspool.ClosePrinter.argtypes = [wintypes.HANDLE]
    winspool.ClosePrinter.restype = wintypes.BOOL

    # Open printer for reading
    hRead = wintypes.HANDLE()
    if not winspool.OpenPrinterW(PRINTER, ctypes.byref(hRead), None):
        print(f"OpenPrinter failed: {ctypes.GetLastError()}")
        return None

    # Send command via win32print
    handle = win32print.OpenPrinter(PRINTER)
    win32print.StartDocPrinter(handle, 1, ("Query", None, "RAW"))
    try:
        win32print.StartPagePrinter(handle)
        win32print.WritePrinter(handle, cmd_bytes)
        time.sleep(wait)

        # Read response via ctypes
        buf = ctypes.create_string_buffer(16384)
        bytesRead = wintypes.DWORD(0)
        full_resp = b""

        for _ in range(20):
            if winspool.ReadPrinter(hRead, buf, 16384, ctypes.byref(bytesRead)):
                if bytesRead.value > 0:
                    full_resp += buf.raw[:bytesRead.value]
                else:
                    time.sleep(0.3)
            else:
                err = ctypes.GetLastError()
                print(f"ReadPrinter error: {err}")
                break

        win32print.EndPagePrinter(handle)
    finally:
        win32print.EndDocPrinter(handle)
    win32print.ClosePrinter(handle)
    winspool.ClosePrinter(hRead)

    return full_resp

print("=== Query 1: ~HD (E: drive directory) ===")
resp = query_printer(b"~HD\r\n", wait=4)
if resp:
    print(f"Response ({len(resp)} bytes):")
    print(resp.decode("ascii", errors="replace"))
else:
    print("No response")

print()
print("=== Query 2: SGD memory.free_space ===")
resp = query_printer(b'!U1 getvar "memory.free_space"\r\n', wait=3)
if resp:
    print(f"Response: {resp.decode('ascii', errors='replace')}")
else:
    print("No response")

print()
print("=== Query 3: SGD device.friendly_name ===")
resp = query_printer(b'!U1 getvar "device.friendly_name"\r\n', wait=3)
if resp:
    print(f"Response: {resp.decode('ascii', errors='replace')}")
else:
    print("No response")

print()
print("=== Query 4: SGD alldef (firmware) ===")
resp = query_printer(b'!U1 getvar "appl.name"\r\n', wait=3)
if resp:
    print(f"Response: {resp.decode('ascii', errors='replace')}")
else:
    print("No response")
