package com.zebra.plugin;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.zebra.sdk.comm.BluetoothConnection;
import com.zebra.sdk.comm.Connection;
import com.zebra.sdk.comm.ConnectionException;
import com.zebra.sdk.comm.TcpConnection;
import com.zebra.sdk.device.ZebraIllegalArgumentException;
import com.zebra.sdk.graphics.ZebraImageFactory;
import com.zebra.sdk.graphics.ZebraImageI;
import com.zebra.sdk.printer.PrinterStatus;
import com.zebra.sdk.printer.ZebraPrinter;
import com.zebra.sdk.printer.ZebraPrinterFactory;
import com.zebra.sdk.printer.ZebraPrinterLanguageUnknownException;
import com.zebra.sdk.printer.discovery.BluetoothDiscoverer;
import com.zebra.sdk.printer.discovery.DiscoveredPrinter;
import com.zebra.sdk.printer.discovery.DiscoveryHandler;
import com.zebra.sdk.printer.discovery.NetworkDiscoverer;
import com.zebra.sdk.printer.discovery.NfcDiscoverer;
import com.zebra.sdk.media.MagCardReader;
import com.zebra.sdk.media.SmartCardReader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.bridge.UniJSCallback;
import io.dcloud.feature.uniapp.common.UniModule;

public class ZebraPrinterModule extends UniModule {

    private static final String TAG = "ZebraPrinterModule";
    private static final int REQ_PERMISSIONS = 1001;
    private static final int REQ_ENABLE_BT = 1002;

    private ZebraPrinter printer;
    private Connection connection;
    private BluetoothAdapter bluetoothAdapter;
    private boolean isDiscoveryRunning = false;
    private BroadcastReceiver btStateReceiver;
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    // 存储权限请求的回调
    private UniJSCallback permissionCallback;

    // 设备发现回调
    private UniJSCallback discoveryCallback;

    // 磁卡/智能卡 读取回调
    private UniJSCallback magCardCallback;
    private UniJSCallback smartCardCallback;

    // 状态查询回调
    private UniJSCallback statusCallback;

    // 文件发送进度回调
    private UniJSCallback fileProgressCallback;

    @UniJSMethod(uiThread = true)
    public void requestBluetoothPermissions(UniJSCallback callback) {
        if (mUniSDKInstance == null || mUniSDKInstance.getContext() == null) {
            callback.invoke(createErrorResult("Context is null"));
            return;
        }
        permissionCallback = callback;
        Activity activity = mUniSDKInstance.getContext() instanceof Activity ?
                (Activity) mUniSDKInstance.getContext() : null;
        if (activity == null) {
            callback.invoke(createErrorResult("Activity is null"));
            return;
        }

        List<String> needPermissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED)
            needPermissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN)
                    != PackageManager.PERMISSION_GRANTED)
                needPermissions.add(Manifest.permission.BLUETOOTH_SCAN);
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED)
                needPermissions.add(Manifest.permission.BLUETOOTH_CONNECT);
        } else {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH)
                    != PackageManager.PERMISSION_GRANTED)
                needPermissions.add(Manifest.permission.BLUETOOTH);
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_ADMIN)
                    != PackageManager.PERMISSION_GRANTED)
                needPermissions.add(Manifest.permission.BLUETOOTH_ADMIN);
        }

        if (needPermissions.isEmpty()) {
            // 已有权限，直接回调成功
            callback.invoke(createSuccessResult("Permissions already granted"));
        } else {
            String[] perms = needPermissions.toArray(new String[0]);
            ActivityCompat.requestPermissions(activity, perms, REQ_PERMISSIONS);
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_PERMISSIONS) {
            // 权限请求结果会在 onRequestPermissionsResult 里处理，此处不需要
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_PERMISSIONS && permissionCallback != null) {
            boolean allGranted = true;
            for (int res : grantResults) {
                if (res != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (allGranted) {
                permissionCallback.invoke(createSuccessResult("All permissions granted"));
            } else {
                permissionCallback.invoke(createErrorResult("Some permissions denied"));
            }
            permissionCallback = null;
        }
    }

    // 检查蓝牙是否开启
    @UniJSMethod(uiThread = false)
    public boolean isBluetoothEnabled() {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        return bluetoothAdapter != null && bluetoothAdapter.isEnabled();
    }

    // 开启蓝牙（跳转系统设置）
    @UniJSMethod(uiThread = true)
    public void enableBluetooth() {
        if (mUniSDKInstance == null) return;
        Activity activity = mUniSDKInstance.getContext() instanceof Activity ?
                (Activity) mUniSDKInstance.getContext() : null;
        if (activity != null && !isBluetoothEnabled()) {
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            activity.startActivityForResult(enableBtIntent, REQ_ENABLE_BT);
        }
    }

    // 开始发现设备（支持蓝牙、BLE、NFC、网络）
    @UniJSMethod(uiThread = true)
    public void startDiscovery(JSONObject options, UniJSCallback callback) {
        if (mUniSDKInstance == null || mUniSDKInstance.getContext() == null) {
            callback.invoke(createErrorResult("Context is null"));
            return;
        }
        Activity activity = mUniSDKInstance.getContext() instanceof Activity ?
                (Activity) mUniSDKInstance.getContext() : null;
        if (activity == null) {
            callback.invoke(createErrorResult("Activity is null"));
            return;
        }

        // 检查蓝牙和位置权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                callback.invoke(createErrorResult("Location permission not granted"));
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN) !=
                        PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) !=
                        PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(createErrorResult("Bluetooth permissions not granted"));
                    return;
                }
            }
        }

        discoveryCallback = callback;
        isDiscoveryRunning = true;

        try {
            // 默认同时进行蓝牙和网络发现
            // 蓝牙发现
            BluetoothDiscoverer.findPrinters(activity.getApplicationContext(), new DiscoveryHandler() {
                @Override
                public void foundPrinter(DiscoveredPrinter discoveredPrinter) {
                    if (!isDiscoveryRunning) return;
                    Map<String, Object> item = new HashMap<>();
                    item.put("address", discoveredPrinter.address);
                    item.put("name", discoveredPrinter.getDiscoveryDataMap().get("FRIENDLY_NAME"));
                    item.put("type", "bluetooth");
                    item.put("raw", discoveredPrinter.getDiscoveryDataMap().toString());
                    sendDiscoveryResult(item);
                }

                @Override
                public void discoveryFinished() {
                    // 蓝牙发现结束，可以继续网络发现
                }

                @Override
                public void discoveryError(String message) {
                    sendDiscoveryError("Bluetooth discovery error: " + message);
                }
            });

            // 网络发现（如果选项里允许）
            if (options != null && options.optBoolean("network", false)) {
                NetworkDiscoverer.findPrinters(new DiscoveryHandler() {
                    @Override
                    public void foundPrinter(DiscoveredPrinter discoveredPrinter) {
                        if (!isDiscoveryRunning) return;
                        Map<String, Object> item = new HashMap<>();
                        item.put("address", discoveredPrinter.address);
                        item.put("name", discoveredPrinter.getDiscoveryDataMap().get("SYSTEM_NAME"));
                        item.put("type", "network");
                        item.put("raw", discoveredPrinter.getDiscoveryDataMap().toString());
                        sendDiscoveryResult(item);
                    }

                    @Override
                    public void discoveryFinished() {
                    }

                    @Override
                    public void discoveryError(String message) {
                        sendDiscoveryError("Network discovery error: " + message);
                    }
                });
            }

            // NFC 发现（如果设备支持），这里简化，仅列出支持的示例
            // NfcDiscoverer 需要传入 Tag 对象，在 uniapp 中可通过原生插件获取 NFC tag，暂不深入

            // 启动一个定时器，10秒后自动停止发现，避免无限制
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (isDiscoveryRunning) {
                    stopDiscovery();
                    if (discoveryCallback != null) {
                        discoveryCallback.invoke(createSuccessResult("Discovery finished"));
                        discoveryCallback = null;
                    }
                }
            }, 10000);

        } catch (Exception e) {
            callback.invoke(createErrorResult("Discovery start failed: " + e.getMessage()));
        }
    }

    private void sendDiscoveryResult(Map<String, Object> item) {
        if (discoveryCallback == null || mUniSDKInstance == null) return;
        mainHandler.post(() -> {
            if (discoveryCallback != null) {
                JSONObject result = new JSONObject();
                try {
                    result.put("code", "found");
                    result.put("data", new JSONObject(item));
                    discoveryCallback.invokeAndKeepAlive(result);
                } catch (Exception ignored) {}
            }
        });
    }

    private void sendDiscoveryError(String error) {
        if (discoveryCallback == null || mUniSDKInstance == null) return;
        mainHandler.post(() -> {
            if (discoveryCallback != null) {
                discoveryCallback.invoke(createErrorResult(error));
            }
        });
    }

    @UniJSMethod(uiThread = false)
    public void stopDiscovery() {
        isDiscoveryRunning = false;
        if (discoveryCallback != null) {
            discoveryCallback.invoke(createSuccessResult("Discovery stopped"));
            discoveryCallback = null;
        }
    }

    // 连接打印机
    @UniJSMethod(uiThread = true)
    public void connect(String address, String type, UniJSCallback callback) {
        if (mUniSDKInstance == null || mUniSDKInstance.getContext() == null) {
            callback.invoke(createErrorResult("Context is null"));
            return;
        }
        Activity activity = mUniSDKInstance.getContext() instanceof Activity ?
                (Activity) mUniSDKInstance.getContext() : null;

        new Thread(() -> {
            try {
                if ("bluetooth".equals(type)) {
                    connection = new BluetoothConnection(address);
                } else if ("tcp".equals(type)) {
                    String[] parts = address.split(":");
                    String ip = parts[0];
                    int port = parts.length > 1 ? Integer.parseInt(parts[1]) : 9100;
                    connection = new TcpConnection(ip, port);
                } else {
                    // 默认蓝牙
                    connection = new BluetoothConnection(address);
                }
                connection.open();
                printer = ZebraPrinterFactory.getInstance(connection);
                // 检查打印机语言
                mainHandler.post(() -> callback.invoke(createSuccessResult("Connected")));
            } catch (ConnectionException | ZebraPrinterLanguageUnknownException e) {
                mainHandler.post(() -> callback.invoke(createErrorResult("Connection failed: " + e.getMessage())));
            }
        }).start();
    }

    @UniJSMethod(uiThread = false)
    public void disconnect() {
        try {
            if (connection != null && connection.isConnected()) {
                connection.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Disconnect error", e);
        }
        printer = null;
        connection = null;
    }

    // 发送 ZPL
    @UniJSMethod(uiThread = true)
    public void sendZpl(String zpl, UniJSCallback callback) {
        if (connection == null || !connection.isConnected()) {
            callback.invoke(createErrorResult("Printer not connected"));
            return;
        }
        new Thread(() -> {
            try {
                connection.write(zpl.getBytes());
                mainHandler.post(() -> callback.invoke(createSuccessResult("ZPL sent")));
            } catch (ConnectionException e) {
                mainHandler.post(() -> callback.invoke(createErrorResult("Write error: " + e.getMessage())));
            }
        }).start();
    }

    // 发送 CPCL
    @UniJSMethod(uiThread = true)
    public void sendCpcl(String cpcl, UniJSCallback callback) {
        sendZpl(cpcl, callback); // CPCL 本质也是字节流
    }

    // 打印图片（Base64 编码的图片或本地文件路径）
    @UniJSMethod(uiThread = true)
    public void printImage(JSONObject params, UniJSCallback callback) {
        if (connection == null || !connection.isConnected()) {
            callback.invoke(createErrorResult("Printer not connected"));
            return;
        }
        new Thread(() -> {
            try {
                String source = params.optString("source"); // "base64" or "file"
                int x = params.optInt("x", 0);
                int y = params.optInt("y", 0);
                int width = params.optInt("width", -1);
                int height = params.optInt("height", -1);

                Bitmap bitmap = null;
                if ("file".equals(source)) {
                    String path = params.optString("path");
                    bitmap = BitmapFactory.decodeFile(path);
                } else {
                    // base64
                    String base64 = params.optString("data");
                    byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
                    bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                }
                if (bitmap == null) {
                    mainHandler.post(() -> callback.invoke(createErrorResult("Invalid image")));
                    return;
                }

                // 调整大小
                if (width > 0 && height > 0) {
                    bitmap = Bitmap.createScaledBitmap(bitmap, width, height, true);
                }

                ZebraImageI zebraImage = ZebraImageFactory.getImage(bitmap);
                printer.printImage(zebraImage, x, y, bitmap.getWidth(), bitmap.getHeight(), false);
                mainHandler.post(() -> callback.invoke(createSuccessResult("Image printed")));
            } catch (Exception e) {
                mainHandler.post(() -> callback.invoke(createErrorResult("Print image error: " + e.getMessage())));
            }
        }).start();
    }

    // 获取打印机状态
    @UniJSMethod(uiThread = true)
    public void getPrinterStatus(UniJSCallback callback) {
        if (printer == null) {
            callback.invoke(createErrorResult("Printer not connected"));
            return;
        }
        statusCallback = callback;
        new Thread(() -> {
            try {
                PrinterStatus status = printer.getCurrentStatus();
                JSONObject result = new JSONObject();
                result.put("isReadyToPrint", status.isReadyToPrint);
                result.put("isHeadOpen", status.isHeadOpen);
                result.put("isPaperOut", status.isPaperOut);
                result.put("isPaused", status.isPaused);
                result.put("isReceiveBufferFull", status.isReceiveBufferFull);
                result.put("isRibbonOut", status.isRibbonOut);
                result.put("labelLengthInDots", status.labelLengthInDots);
                result.put("numberOfFormatsInReceiveBuffer", status.numberOfFormatsInReceiveBuffer);
                mainHandler.post(() -> callback.invoke(createResult("status", result)));
            } catch (ConnectionException e) {
                mainHandler.post(() -> callback.invoke(createErrorResult("Status error: " + e.getMessage())));
            }
        }).start();
    }

    // 读取磁卡数据
    @UniJSMethod(uiThread = true)
    public void readMagCard(UniJSCallback callback) {
        if (printer == null) {
            callback.invoke(createErrorResult("Printer not connected"));
            return;
        }
        magCardCallback = callback;
        new Thread(() -> {
            try {
                MagCardReader reader = MagCardReader.create(printer);
                if (reader != null) {
                    String[] tracks = reader.read(30000); // 30秒超时
                    if (tracks != null) {
                        JSONObject data = new JSONObject();
                        data.put("track1", tracks.length > 0 ? tracks[0] : "");
                        data.put("track2", tracks.length > 1 ? tracks[1] : "");
                        data.put("track3", tracks.length > 2 ? tracks[2] : "");
                        mainHandler.post(() -> callback.invoke(createResult("data", data)));
                    } else {
                        mainHandler.post(() -> callback.invoke(createErrorResult("No mag card data")));
                    }
                } else {
                    mainHandler.post(() -> callback.invoke(createErrorResult("Mag card not supported")));
                }
            } catch (Exception e) {
                mainHandler.post(() -> callback.invoke(createErrorResult("Mag read error: " + e.getMessage())));
            }
        }).start();
    }

    // 读取智能卡 (暂略，类似磁卡，但需要用 SmartCardReader)
    // 可以按需实现

    // 发送文件（固件升级、模板等）
    @UniJSMethod(uiThread = true)
    public void sendFile(String filePath, JSONObject options, UniJSCallback callback) {
        if (connection == null || !connection.isConnected()) {
            callback.invoke(createErrorResult("Printer not connected"));
            return;
        }
        fileProgressCallback = callback;
        new Thread(() -> {
            try {
                File file = new File(filePath);
                if (!file.exists()) {
                    mainHandler.post(() -> callback.invoke(createErrorResult("File not found")));
                    return;
                }
                // 使用 ZebraPrinter 的 sendFileContents
                String templateName = options != null ? options.optString("templateName", "") : "";
                InputStream is = new FileInputStream(file);
                printer.sendFileContents(is, file.length(), templateName);
                is.close();
                mainHandler.post(() -> callback.invoke(createSuccessResult("File sent")));
            } catch (Exception e) {
                mainHandler.post(() -> callback.invoke(createErrorResult("Send file error: " + e.getMessage())));
            }
        }).start();
    }

    // 保存标签模板到打印机内存
    @UniJSMethod(uiThread = true)
    public void storeFormat(String formatName, String formatData, UniJSCallback callback) {
        if (printer == null) {
            callback.invoke(createErrorResult("Printer not connected"));
            return;
        }
        new Thread(() -> {
            try {
                printer.storeFormat(formatName, formatData.getBytes(), "ZPL");
                mainHandler.post(() -> callback.invoke(createSuccessResult("Format stored")));
            } catch (Exception e) {
                mainHandler.post(() -> callback.invoke(createErrorResult("Store format error: " + e.getMessage())));
            }
        }).start();
    }

    // ---------- 辅助方法 ----------
    private JSONObject createSuccessResult(String msg) {
        JSONObject json = new JSONObject();
        try {
            json.put("code", "success");
            json.put("message", msg);
        } catch (Exception ignored) {}
        return json;
    }

    private JSONObject createErrorResult(String msg) {
        JSONObject json = new JSONObject();
        try {
            json.put("code", "error");
            json.put("message", msg);
        } catch (Exception ignored) {}
        return json;
    }

    private JSONObject createResult(String code, JSONObject data) {
        JSONObject json = new JSONObject();
        try {
            json.put("code", code);
            json.put("data", data);
        } catch (Exception ignored) {}
        return json;
    }
}