<template>
	<snPrintList ref="listRef" :config="config" />
</template>

<script>
	import snPrintList from '@/components/mes/print/snPrintList.vue'
	import { getPackageSnList, updatePackageSnPrinted } from '@/api/printApi.js'

	export default {
		components: { snPrintList },
		// 列表交给页面滚动，触底只有页面收得到，转发给组件
		onReachBottom() {
			this.$refs.listRef.loadMore()
		},
		data() {
			return {
				config: {
					snKey: 'packageSn',
					nameKey: 'itemName',
					listApi: getPackageSnList,
					updatePrintedApi: updatePackageSnPrinted,
					lotPrint: false,
					filters: [
						{ key: 'packageSn', label: '包装SN', type: 'input' },
						{ key: 'barcodeStatus', label: '打印状态', type: 'dict', dictCode: 'BARCODE_PRINT_STATUS' },
						{ key: 'packageStatus', label: '包装状态', type: 'dict', dictCode: 'PACKAGE_STATUS' },
						{ key: 'shipmentStatus', label: '出货状态', type: 'dict', dictCode: 'SHIPMENT_STATUS' }
					],
					cardFields: [
						{ key: 'itemName', label: '产品名称' },
						{ key: 'itemCode', label: '料号' },
						{ key: 'itemLot', label: '批次' },
						{ key: 'quantityPerBox', label: '每箱数量' },
						{ key: 'packageQuantity', label: '包装数量' },
						{ key: 'packageOperator', label: '包装人员' },
						{ key: 'packageTime', label: '包装时间' },
						{ key: 'shipmentOperator', label: '出货人员' },
						{ key: 'shipmentTime', label: '出货时间' }
					],
					badges: [
						{
							key: 'barcodeStatus',
							map: { 0: '未打印', 1: '已打印', 2: '已补打' },
							tone: { 0: 'grey', 1: 'green', 2: 'orange' }
						},
						{ key: 'packageStatus', map: { 0: '未包装', 1: '已包装' }, tone: { 0: 'grey', 1: 'green' } },
						{ key: 'shipmentStatus', map: { 0: '未出货', 1: '已出货' }, tone: { 0: 'grey', 1: 'blue' } }
					]
				}
			}
		}
	}
</script>
