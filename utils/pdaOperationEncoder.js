/**
 * Pda出入库操作二维码编码、解码器
 * @version 1.0.0
 * @author youyong
 */

import md5 from 'js-md5';

/**
 * pda操作日志转二维码值
 * 
 * @param {Object} pdaOperation
 */
export function qrEncode(pdaOperation) {
	if (!pdaOperation) {
		throw new Error('操作日志格式错误或缺失')
	}

	let a = pdaOperation.id || '';
	let b = pdaOperation.codeFlag || '';
	let c = pdaOperation.inventoryCode || '';
	let d = pdaOperation.materialCode || '';
	let e = pdaOperation.warehouseBinCode || '';
	let f = pdaOperation.quantity || '';
	let g = pdaOperation.status || '';
	let h = pdaOperation.createBy || '';
	let i = pdaOperation.createTime || '';
	let j = pdaOperation.updateBy || '';
	let k = pdaOperation.updateTime || '';
	
	let abcdefghijh = `${a},${b},${c},${d},${e},${f},${g},${h},${i},${j},${k}`;
	let signature = md5(abcdefghijh); // 签名
	return `${signature},${abcdefghijh}`;
}

/**
 * 操作日志数组转二维码值
 * 
 * @param {Object} pdaOperations
 */
export function qrEncodes(pdaOperations) {
	if (!pdaOperations || !(pdaOperations instanceof Array)) {
		throw new Error('操作日志应是JSON对象数组');
	}
	
	debugger
	let abcdefghijhArr = '';
	pdaOperations.forEach(o => {
		abcdefghijhArr += qrEncode(o) + '\r\n';
	})

	return abcdefghijhArr;
}

/**
 * 二维码值转pda操作日志JSON对象
 * @param {Object} qr 二维码值
 */
export function qrDecode(qr) {
	if (!qr) return "";
	
	let abcdefghijhArr = qr.split(",")
	if (abcdefghijhArr.length != 12) {
		return {
			msg: '数据格式错误或缺失'
		}
	}

	let pdaSignature = abcdefghijhArr[0]; // pda签名
	let index = qr.indexOf(",");
	let abcdefghijh = qr.substring(index + 1);
	let signature = md5(abcdefghijh);
	if (pdaSignature !== signature) {
		return {
			msg: '数据签名错误'
		}
	}

	abcdefghijh = qr.substring(index + 1).split(",");

	return {
		id: abcdefghijh[0] || '',
		codeFlag: abcdefghijh[1] || '',
		inventoryCode: abcdefghijh[2] || '',
		materialCode: abcdefghijh[3] || '',
		warehouseBinCode: abcdefghijh[4] || '',
		quantity: abcdefghijh[5] || '',
		status: abcdefghijh[6] || '',
		createBy: abcdefghijh[7] || '',
		createTime: abcdefghijh[8] || '',
		updateBy: abcdefghijh[9] || '',
		updateTime: abcdefghijh[10] || ''
	}
}

/**
 * 二维码值转pda操作日志JSON对象数组
 * @param {Object} qrArrStr 二维码值字符串
 */
export function qrDecodes(qrArrStr) {
	if (!qrArrStr || !(qrArrStr instanceof String)) {
		throw new Error('二维码值应是字符串');
	}

	let abcdefghijhArr = qrArrStr.split(/[(\r\n)\r\n]+/);
	abcdefghijhArr.forEach((item, index) => {
		if (!item) {
			abcdefghijhArr.splice(index, 1); //删除空项
		}
	})

	let pdaOperations = [];
	abcdefghijhArr.forEach(p => {
		pdaOperations.push(qrDecode(p));
	})

	return abcdefghijhArr;
}

/**
 * 解析操作指令为文本
 * @param {Object} codeFlag
 */
export function parseCodeFlagToText(codeFlag) {
	if (codeFlag == 0) {
		return '入库';
	} else if (codeFlag == 1) {
		return '取消入库';
	} else if (codeFlag == 2) {
		return '出库';
	} else if (codeFlag == 3) {
		return '取消出库';
	} else if (codeFlag == 4) {
		return '余料退回';
	} else if (codeFlag == 5) {
		return '部分出库';
	}

	return '未知操作';
}

/**
 * 解析同步状态为文本
 * @param {Object} status
 */
export function parseStatusToText(status) {
	if (status == 0) {
		return '未同步';
	} else if (status == 1) {
		return '已同步'
	}

	return '未知状态'
}

/**
 * 生成新的id
 */
export function genNewId() {
	let factoryId = uni.getStorageSync("factoryId");
	let timestamp = new Date().valueOf();
	let randomRange = '0123456789';
	let random = '';
	for (let i = 0; i < 3; i++) {
		random += randomRange.charAt(Math.floor(Math.random() * randomRange.length));
	};

	return `${factoryId}-${timestamp}-${random}`;
}
