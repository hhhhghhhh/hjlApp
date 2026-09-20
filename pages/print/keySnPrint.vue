<template>
	<snPrintList ref="listRef" :config="config" :initDocNo="initDocNo" />
</template>

<script>
	import snPrintList from '@/components/mes/print/snPrintList.vue'
	import { getKeySnList, updateKeySnPrinted, getPickDocList, getOtherOutDocList } from '@/api/printApi.js'

	export default {
		components: { snPrintList },
		onLoad(options) {
			if (options.docNo) {
				this.initDocNo = decodeURIComponent(options.docNo);
			}
		},
		onReachBottom() {
			this.$refs.listRef.onReachBottom()
		},
		data() {
			return {
				initDocNo: '',
				config: {
					snKey: 'keySn',
					nameKey: 'itemName',
					listApi: getKeySnList,
					updatePrintedApi: updateKeySnPrinted,
					// 启用批次打印（按 itemLotSn 去重）
					lotPrint: true,
					filters: [
						{ key: 'keySn', label: '关键件', type: 'input' },
						{ key: 'barcodeStatus', label: '打印状态', type: 'dict', dictCode: 'BARCODE_PRINT_STATUS' }
					],
					// 单据搜索：生产领料单(DJ11) 与 其他出库单(DJ14) 两个入口并排。
					// 后端 /mes/keySn/list 的 pickDoc 只按单号查 WmsOutstockDetail，不区分单据类型，
					// 故两者都用 paramKey='pickDoc'；选中哪个就按哪个单号筛选。
					docFilters: [
						{
							title: '生产领料单',
							label: '按生产领料查询',
							paramKey: 'pickDoc',
							api: getPickDocList,
							dateField: 'planOutstockDate',
							dateLabel: '计划出库'
						},
						{
							title: '其他出库单',
							label: '按其他出库查询',
							paramKey: 'pickDoc',
							api: getOtherOutDocList,
							dateField: 'planOutstockDate',
							dateLabel: '计划出库'
						}
					],
					cardFields: [
						{ key: 'itemName', label: '名称' },
						{ key: 'itemCode', label: '料号' },
						{ key: 'itemSpec', label: '规格' },
						{ key: 'itemLot', label: '批次' },
						{ key: 'itemLotSn', label: '批次SN' },
						{ key: 'productionOrderNo', label: '生产订单' },
						{ key: 'createTime', label: '入库日期' }
					],
					badges: [
						{
							key: 'barcodeStatus',
							map: { 0: '未打印', 1: '已打印', 2: '已补打' },
							tone: { 0: 'grey', 1: 'green', 2: 'orange' }
						},
						{ key: 'bindStatus', map: { 0: '未绑定', 1: '已绑定' }, tone: { 0: 'grey', 1: 'green' } },
						{ key: 'sendStatus', map: { 0: '未寄出', 1: '已寄出' }, tone: { 0: 'grey', 1: 'green' } },
						{ key: 'pickStatus', map: { 0: '未领料', 1: '已领料' }, tone: { 0: 'grey', 1: 'green' } }
					]
				}
			}
		}
	}
</script>