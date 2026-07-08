export function generateParams(obj) {
  var keys = Object.keys(obj);
  keys.sort();

  var vals = [];
  keys.forEach((key) => {
    vals.push(`${key}=${obj[key]}`);
  });

  return vals.join("&");
}

// 扫码
export function scanCode(onlyFromCamera = false) {
  return new Promise((resolve, reject) => {
    uni.scanCode({
      onlyFromCamera: onlyFromCamera,
      scanType: ["qrCode", "barCode"],
      success: function (res) {
        console.log("条码类型：" + res.scanType);
        console.log("条码内容：" + res.result);
        resolve(res.result);
      },
    });
  });
}