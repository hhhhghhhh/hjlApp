// wmsApi.js

import {
	request
} from "@/utils/request.js";

/**
 * 获取单据类型列表
 */
export function getDocTypeList() {
	return request({
		url: "/wms/wmsDocType/getList",
		method: "GET",
		data: {},
	});
}

// 获取所有单据列表
export function getAllDocList() {
	return request({
		url: "/api/pda/pdaStockInfo/getAllDoc",
		method: "GET"
	});
}

/**
 * 根据docType，docNo获取单据类型详情 入库
 */
export function getDocListRuku(data) {
	return request({
		url: "/api/pda/pdaReceiveDoc/getListByDocNo",
		method: "GET",
		data: data,
	});
}

/**
 * 根据docType，docNo获取单据类型详情 出库
 */
export function getDocListCuku(data) {
	return request({
		url: "/api/pda/pdaOutDoc/getListByDocNo",
		method: "GET",
		data: data,
	});
}

/**
 * 根据docType，docNo获取单据类型详情 盘点 */
export function getDocListPandian(data) {
	return request({
		url: "/api/pda/pdaInventoryDoc/getListByDocNo",
		method: "GET",
		data: data,
	});
}

/**
 * 根据docType，docNo获取单据类型详情 其他 */
export function getDocListQita(data) {
	return request({
		url: "/api/pda/pdaReceiveDoc/getListByDocNo",
		method: "GET",
		data: data,
	});
}

/**
 * 根据docType，docNo获取单据类型详情 调拨
 */
export function getDocListDiaobo(data) {
	return request({
		url: "/api/pda/pdaAllotDoc/getListByDocNo",
		method: "GET",
		data: data,
	});
}

// 获取指令列表
export function getCmdListByDocType(data) {
	return request({
		url: '/wms/wmsDocCommand/list',
		method: 'GET',
		data
	})
}

// 获取指令参数
export function getCmdParams(cmdCode) {
	return request({
		url: '/wms/cmdParam/getListBycmdCode',
		method: 'GET',
		data: {
			cmdCode
		}
	})
}

// 获取指令详情
export function getCmdByCmdCode(cmdCode) {
	return request({
		url: '/wms/cmd/getCmdByCmdCode',
		method: 'GET',
		data: {
			cmdCode
		}
	})
}

// 执行指令
export function executeCmd(url, data) {
	return request({
		url: url,
		method: 'GET',
		data
	})
}

/**
 * SN查单据和库存信息
 */
export function queryDocAndStockInfo(sn) {
	return request({
		url: "/api/pda/pdaStockInfo/queryDocAndStockInfo",
		method: "GET",
		data: {
			sn: sn
		},
	});
}

/**
 * 根据SN获取所有出库单据
 */
export function getAllOutDocBySn(sn) {
	return request({
		url: "/api/pda/pdaStockInfo/getAllOutDocBySn",
		method: "GET",
		data: {
			sn: sn
		},
	});
}

/**
 * 根据SN获取所有入库单据
 */
export function getAllReceiveDocBySn(sn) {
	return request({
		url: "/api/pda/pdaStockInfo/getAllReceiveDocBySn",
		method: "GET",
		data: {
			sn: sn
		},
	});
}

// 根据单据ID和类型查询单据明细
export function queryDetailByDocId(data) {
	return request({
		url: "/api/pda/pdaStockInfo/queryDetailByDocId",
		method: "GET",
		data
	});
}

// 根据单据单据明细
export function getDocDetailByDocNo(data) {
	return request({
		url: "/api/pda/pdaReceiveDoc/getDocDetailByDocNo",
		method: "GET",
		data
	});
}

/**
 * 根据SN获取采购入库单据详情
 */
export function getDocDetailBySn(data) {
	return request({
		url: "/api/pda/pdaReceiveDoc/getDocDetailBySn",
		method: "GET",
		data: data,
	});
}

// 获取实时库存列表
export function getRealTimeInventory(params) {
	return request({
		url: "/api/pda/pdaStockInfo/getRealTimeInventory",
		method: "GET",
		data: params
	});
}

/**
 * 物料信息-通过id查询
 */
export function queryCoItemById(data) {
	return request({
		url: "/mes/coItem/queryById",
		method: "GET",
		data: data,
	});
}

// 删除SN
export function deleteSn(data) {
	return request({
		url: '/api/pda/pdaStockInfo/deleteSn',
		method: 'GET',
		data: data
	});
}

// 修改SN信息
export function updateSn(data) {
	return request({
		url: '/api/pda/pdaStockInfo/updateSn',
		method: 'GET',
		data: data
	});
}


// 根据物料编码获取单位列表
export function getUnitListByItemCode(params) {
	return request({
		url: "/api/pda/pdaStockInfo/getUnitListByItemCode",
		method: "GET",
		data: params,
	});
}

// 删除入库单物料清单
export function deleteReceiveItem(id) {
    return request({
        url: `/wms/wmsReceiveItem/delete?id=${id}`,
        method: 'DELETE',
    });
}

// 删除出库单物料清单
export function deleteOutstockItem(id) {
    return request({
        url: `/wms/wmsOutstockItem/delete?id=${id}`,
        method: 'DELETE',
    });
}

// 删除调拨单物料清单
export function deleteAllotItem(id) {
    return request({
        url: `/wms/wmsAllotItem/delete?id=${id}`,
        method: 'DELETE',
    });
}

/**
 * 库位关联验证
 * @param {Object} data - 包含 glSn 参数的对象
 * @returns {Promise} - 返回验证结果
 */
export function validStorageBind(data) {
	return request({
		url: "/api/pda/pdaStockInfo/validStorageBind",
		method: "GET",
		data: data,
	});
}

/**
 * 验证数量
 * @param {Object} data - 包含 docNo, sn, num, itemSeq, unitId, docType 参数的对象
 * @returns {Promise} - 返回验证结果
 */
export function validateNum(data) {
	return request({
		url: "/api/pda/pdaStockInfo/validateNum",
		method: "GET",
		data: data,
	});
}

export function validateFifo(data) {
	return request({
		url: "/api/pda/pdaStockInfo/validateFifo",
		method: "GET",
		data: data,
	});
}
