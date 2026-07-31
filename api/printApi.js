// api/printApi.js
// 三个 SN 打印页用到的接口，和 web 端 cc-admin-web 打的是同一套后端。
// 注意 request() 会把 header 整体替换成 {Authorization, Tenantid}，
// 所以这里不要传自定义 header，POST 靠 uni.request 默认的 application/json。
import { request } from '@/utils/request.js'

// ---------- SN 列表 ----------

// 关键件。可用参数：keySn、barcodeStatus、pickDoc（生产领料单号）
export function getKeySnList(data) {
	return request({ url: '/mes/keySn/list', method: 'GET', data })
}

// 包装SN。可用参数：packageSn、packageStatus、barcodeStatus、shipmentStatus
export function getPackageSnList(data) {
	return request({ url: '/mes/packageSn/list', method: 'GET', data })
}

// 产品SN。可用参数：productSn、barcodeStatus、receiveDoc（完工入库单号）
export function getProductSnList(data) {
	return request({ url: '/mes/productSn/list', method: 'GET', data })
}

// ---------- 打印后回写状态 ----------
// data = { printedIds: [...] }，只放真的印出来的那几条

export function updateKeySnPrinted(data) {
	return request({ url: '/mes/keySn/updateBarcodeStatusAfterPrint', method: 'POST', data })
}

export function updatePackageSnPrinted(data) {
	return request({ url: '/mes/packageSn/updateBarcodeStatusAfterPrint', method: 'POST', data })
}

export function updateProductSnPrinted(data) {
	return request({ url: '/mes/productSn/updateBarcodeStatusAfterPrint', method: 'POST', data })
}

// ---------- 单据（按单号筛选 SN 用） ----------

// 生产领料单，docType 固定 DJ11
export function getPickDocList(data) {
	return request({ url: '/wms/wmsOutstockDoc/list', method: 'GET', data: { docType: 'DJ11', ...data } })
}

// 完工入库单，docType 固定 DJ05
export function getReceiveDocList(data) {
	return request({ url: '/wms/wmsReceiveDoc/list', method: 'GET', data: { docType: 'DJ05', ...data } })
}

// ---------- 字典 ----------
// BARCODE_PRINT_STATUS / PACKAGE_STATUS / SHIPMENT_STATUS / DOC_STATUS
export function getDictItems(dictCode) {
	return request({ url: '/sys/dictItem/selectItemsByDictCode', method: 'GET', data: { dictCode } })
}
