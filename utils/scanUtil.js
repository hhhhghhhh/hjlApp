// utils/scanUtil.js

export function scanResult() {
    return new Promise((resolve, reject) => {
        uni.scanCode({
            scanType: ['qrCode', 'barCode'],
            success: (res) => {
                console.log('扫码成功:', res);
				//this.formData.inventoryCode = res.result;
				uni.$toPath(`/pages/wms/scanOpt/scanOpt?scanData=${res.result}`);
				
				
                resolve(res);
            },
            fail: (err) => {
                console.error('扫码失败:', err);
                reject(err);
            }
        });
    });
}



