import { request } from "@/utils/request.js"

export function receivingFinishApi(data){
	return request({
		url:'/wms/advancedShippingNote/receivingFinish',
		method:"POST",
		data,
	})
}

export function purchaseReceiveApi(data){
	return request({
		url:'/wms/advancedShippingNoteDetail/purchaseReceive',
		method:"POST",
		data,
	})
}