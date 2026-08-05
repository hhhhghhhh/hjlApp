<template>
	<snPrintList ref="listRef" :config="config" :initDocNo="initDocNo" />
</template>

<script>
	import snPrintList from '@/components/mes/print/snPrintList.vue'
	import { getProductSnList, updateProductSnPrinted, getReceiveDocList } from '@/api/printApi.js'

	export default {
		components: { snPrintList },
		onLoad(options) {
			if (options.docNo) {
				this.initDocNo = decodeURIComponent(options.docNo);
			}
		},
		// 列表交给页面滚动，触底只有页面收得到，转发给组件
		onReachBottom() {
			this.$refs.listRef.loadMore()
		},
		data() {
			return {
				initDocNo: '',
				config: {
					snKey: 'productSn',
					nameKey: 'itemName',
					listApi: getProductSnList,
					updatePrintedApi: updateProductSnPrinted,
					lotPrint: false,
					filters: [
						{ key: 'productSn', label: '产品SN', type: 'input' },
						{ key: 'barcodeStatus', label: '打印状态', type: 'dict', dictCode: 'BARCODE_PRINT_STATUS' }
					],
					docFilter: {
						title: '完工入库单',
						label: '按完工入库查询',
						paramKey: 'receiveDoc',
						api: getReceiveDocList,
						dateField: 'planReceiveDate',
						dateLabel: '计划入库'
					},
					cardFields: [
						{ key: 'itemName', label: '产品名称' },
						{ key: 'itemCode', label: '料号' },
						{ key: 'itemSpec', label: '产品规格' },
						{ key: 'itemLot', label: '批次' },
						{ key: 'productionOrderNo', label: '生产单号' },
						{ key: 'operator', label: '操作人' },
						{ key: 'completionDate', label: '完工日期' }
					],
					badges: [
						{
							key: 'barcodeStatus',
							map: { 0: '未打印', 1: '已打印', 2: '已补打' },
							tone: { 0: 'grey', 1: 'green', 2: 'orange' }
						}
					]
				}
			}
		}
	}
</script>
