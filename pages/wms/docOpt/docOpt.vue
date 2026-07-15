<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 固定顶部搜索栏 ════ -->
		<view class="top-bar">
			<view class="search-bar">
				<view class="search-head" @click="isCollapsed = !isCollapsed">
					<text class="sh-title">{{ typeName }}搜索</text>
					<uni-icons :type="isCollapsed ? 'arrowdown' : 'arrowup'" size="16" :color="themePrimary"></uni-icons>
				</view>

				<view class="search-body" v-show="!isCollapsed">
					<view class="s-grid">
						<view class="s-item"><input v-model="searchParams.docNo" class="s-input" placeholder="单据号" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.docNo" @click.stop="searchParams.docNo = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						<view class="s-item"><CommonSelector type="supplier" placeholder="供应商" :apiUrl="apiUrls.supplier" :value="searchParams.supplierId" @input="handleSupplierChange" /></view>
						<view class="s-item"><CommonSelector type="warehouse" placeholder="仓库" :apiUrl="apiUrls.warehouse" :value="searchParams.whId" @input="handleWarehouseChange" /></view>
						<view class="s-item"><CommonSelector type="itemCode" placeholder="物料" :apiUrl="apiUrls.itemCode" :value="searchParams.itemCodeId" @input="handleItemCodeChange" /></view>
						<view class="s-item"><CommonSelector type="customer" placeholder="客户" :apiUrl="apiUrls.customer" :value="searchParams.custId" @input="handleCustomerChange" /></view>

						<view v-if="showAreaSnInput" class="s-item"><input v-model="searchParams.areaSn" class="s-input" placeholder="车间" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.areaSn" @click.stop="searchParams.areaSn = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>

						<template v-if="searchParams.docType === 'DJ02'">
							<view class="s-item"><input v-model="searchParams.purchaseDept" class="s-input" placeholder="采购部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.purchaseDept" @click.stop="searchParams.purchaseDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
							<view class="s-item"><input v-model="searchParams.receiveDept" class="s-input" placeholder="收料部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.receiveDept" @click.stop="searchParams.receiveDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						</template>
						<template v-if="searchParams.docType === 'DJ04'">
							<view class="s-item"><input v-model="searchParams.stockDept" class="s-input" placeholder="库存部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.stockDept" @click.stop="searchParams.stockDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						</template>
						<template v-if="showDeptInput">
							<view class="s-item"><input v-model="searchParams.dept" class="s-input" placeholder="部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.dept" @click.stop="searchParams.dept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						</template>
						<template v-if="searchParams.docType === 'DJ13'">
							<view class="s-item"><input v-model="searchParams.returnDept" class="s-input" placeholder="退料部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.returnDept" @click.stop="searchParams.returnDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
							<view class="s-item"><input v-model="searchParams.purchaseDept" class="s-input" placeholder="采购部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.purchaseDept" @click.stop="searchParams.purchaseDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						</template>
						<template v-if="searchParams.docType === 'DJ12'">
							<view class="s-item"><input v-model="searchParams.deliveryDept" class="s-input" placeholder="发货部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.deliveryDept" @click.stop="searchParams.deliveryDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						</template>
						<template v-if="searchParams.docType === 'DJ14'">
							<view class="s-item"><input v-model="searchParams.pickDept" class="s-input" placeholder="领料部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.pickDept" @click.stop="searchParams.pickDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						</template>
						<template v-if="searchParams.docType === 'DJ15'">
							<view class="s-item"><input v-model="searchParams.inDept" class="s-input" placeholder="调入部门" placeholder-class="ph" /><view class="s-clr" v-if="searchParams.inDept" @click.stop="searchParams.inDept = ''"><uni-icons type="clear" size="14" color="#999"></uni-icons></view></view>
						</template>
					</view>
					<view class="s-actions">
						<view class="sa-reset" @click="handleReset">重置</view>
						<view class="sa-search" :class="{ loading: loading }" :style="{ background: loading ? '#93c5fd' : themePrimary }" @click="handleSearch">查询</view>
					</view>
				</view>
			</view>
		</view>

		<!-- ════ 内容区（改为普通 view，实现页面级滚动）════ -->
		<view class="content">
			<view v-if="loading" class="load-wrap"><uni-load-more status="loading" /></view>

			<view v-else-if="docNoList.length > 0">
				<view class="list-head">
					<text class="lh-title">{{ typeName }}列表</text>
					<text class="lh-count">共 {{ docNoList.length }} 条</text>
				</view>

				<view class="list">
					<view class="d-card" v-for="(item, idx) in docNoList" :key="idx" @click="showDetail(item)">
						<view class="dc-head">
							<text class="dc-no">{{ item.docNo }}</text>
							<view class="dc-tag" :class="tagClass(item)">{{ item.invDocStatus_dictText || item.docStatus_dictText }}</view>
						</view>
						<view class="dc-body">
							<view class="dc-row" v-if="item.docType_dictText"><text class="dc-l">单据类型</text><text class="dc-v">{{ item.docType_dictText }}</text></view>
							<view class="dc-row" v-if="item.supplierId_dictText"><text class="dc-l">供应商</text><text class="dc-v">{{ item.supplierId_dictText }}</text></view>
							<view class="dc-row" v-if="item.custId_dictText"><text class="dc-l">客户</text><text class="dc-v">{{ item.custId_dictText }}</text></view>
							<view class="dc-row" v-if="item.whId_dictText"><text class="dc-l">仓库</text><text class="dc-v">{{ item.whId_dictText }}</text></view>
							<view class="dc-row" v-if="item.areaSn"><text class="dc-l">车间</text><text class="dc-v">{{ item.areaSn }}</text></view>
							<view class="dc-row"><text class="dc-l">开单时间</text><text class="dc-v dc-time">{{ formatTime(item.createTime) }}</text></view>
							<view class="dc-row" v-if="item.creator"><text class="dc-l">创建人</text><text class="dc-v">{{ item.creator }}</text></view>
						</view>
					</view>
				</view>

				<view v-if="loadingMore" class="load-more"><uni-load-more status="loading" /></view>
				<view v-if="noMore && docNoList.length" class="load-more"><text class="nm-text">没有更多了</text></view>
			</view>

			<view v-else class="empty">
				<text>暂无单据数据</text>
				<text class="empty-sub" v-if="hasSearchParams">请尝试其他搜索条件</text>
			</view>
			
			<!-- 底部安全区 -->
			<view class="safe-bottom"></view>
		</view>

		<!-- ════ 回顶 ════ -->
		<view class="go-top" v-if="showBackTop" @click="goTop" :style="{ background: themePrimary }">
			<uni-icons type="arrowup" size="18" color="#fff"></uni-icons>
		</view>

		<!-- ════ 底部返回 ════ -->
		<view class="bottom-bar">
			<view class="bb-btn" @click="back()">返回</view>
		</view>
	</view>
</template>

<script>
	import { getDocListRuku, getDocListCuku, getDocListQita, getDocListPandian, getDocListDiaobo } from "@/api/wmsApi.js";
	import CommonSelector from '@/components/CommonSelector.vue';
	import settingsMixin from '@/common/settingsMixin.js';

	const AREA_SN_TYPES = ['DJ19','DJ03','DJ11','DJ05','DJ10','DJ33'];
	const DEPT_TYPES = ['DJ06','DJ21','DJ32'];
	// 载具条码模式对应的单据类型（采购入库、完工入库）
	const CONTAINER_DOC_TYPES = ['DJ02', 'DJ05'];

	export default {
		mixins: [settingsMixin],
		components: { CommonSelector },

		data() {
			return {
				apiUrls: {
					warehouse: '/wms/wmsArea/getAllCkList',
					itemCode: '/mes/coItem/getTabPageList',
					customer: '/mes/coCustomer/queryOpenTabList',
					supplier: '/mes/coSupplier/queryOpenTabList'
				},
				docNoList: [], 
				loading: false, 
				loadingMore: false,
				pageNo: 1, 
				pageSize: 20, 
				noMore: false,
				isCollapsed: true,
				searchParams: {
					docType: "", docNo: "", supplierId: "", whId: "", itemCodeId: "", custId: "",
					areaSn: "", purchaseDept: "", receiveDept: "", stockDept: "", dept: "",
					returnDept: "", deliveryDept: "", pickDept: "", inDept: ""
				},
				typeName: "", 
				operateType: "",
				// 从主页面传递的条码类型
				codeType: "normal",
				showBackTop: false
			}
		},

		computed: {
			hasSearchParams() { 
				return Object.values(this.searchParams).some(v => v !== "" && v !== null && v !== undefined); 
			},
			showAreaSnInput() { 
				return AREA_SN_TYPES.includes(this.searchParams.docType); 
			},
			showDeptInput() { 
				return DEPT_TYPES.includes(this.searchParams.docType); 
			}
		},

		onLoad(options) {
			if (options.docType) this.searchParams.docType = options.docType;
			if (options.typeName) { 
				this.typeName = decodeURIComponent(options.typeName); 
				uni.setNavigationBarTitle({ title: this.typeName }); 
			}
			if (options.operateType) this.operateType = options.operateType;
			// 接收条码类型参数
			if (options.codeType) {
				this.codeType = options.codeType;
			} else {
				// 如果没有传递，根据单据类型自动判断
				this.codeType = CONTAINER_DOC_TYPES.includes(this.searchParams.docType) ? 'container' : 'normal';
			}
			
			this.queryDocList();
		},
		
		// 页面滚动监听（替代 scroll-view 的 @scroll）
		onPageScroll(e) {
			this.showBackTop = e.scrollTop > 300;
		},

		methods: {
			// 回顶方法（与 allTasks 保持一致）
			goTop() {
				uni.pageScrollTo({
					scrollTop: 0,
					duration: 300
				});
			},

			handleSupplierChange(v) { 
				this.searchParams.supplierId = v ? v.id : ''; 
			},
			handleWarehouseChange(v) { 
				this.searchParams.whId = v ? v.id : ''; 
			},
			handleItemCodeChange(v) { 
				this.searchParams.itemCodeId = v ? v.id : ''; 
			},
			handleCustomerChange(v) { 
				this.searchParams.custId = v ? v.id : ''; 
			},

			handleReset() {
				const keys = ['docNo','supplierId','whId','itemCodeId','custId','areaSn',
					'purchaseDept','receiveDept','stockDept','dept','returnDept','deliveryDept','pickDept','inDept'];
				keys.forEach(k => { this.searchParams[k] = ''; });
			},

			handleSearch() { 
				this.queryDocList(); 
			},

			tagClass(item) {
				const s = item.invDocStatus || item.docStatus;
				if (s == 1) return 't-pending';
				if (s == 2) return 't-active';
				return 't-done';
			},

			async queryDocList() {
				if (this.loading) return;
				this.loading = true; 
				this.pageNo = 1; 
				this.noMore = false;
				
				// 回顶
				this.goTop();
				
				try {
					const params = {};
					Object.entries(this.searchParams).forEach(([k, v]) => { 
						if (v !== '') params[k] = v; 
					});
					params.pageNo = this.pageNo; 
					params.pageSize = this.pageSize;

					let result = [];
					const fnMap = { '1': getDocListRuku, '2': getDocListCuku, '4': getDocListDiaobo };
					if (fnMap[this.operateType]) {
						result = (await fnMap[this.operateType](params)).data.result || [];
					} else if (this.operateType === '3') {
						const fn = this.typeName.includes('盘点') ? getDocListPandian : getDocListQita;
						result = (await fn(params)).data.result || [];
					}
					this.docNoList = result.map(v => ({...v, snType: this.getSnType()}));
					if (result.length < this.pageSize) this.noMore = true;
				} catch (e) { 
					console.error('查询失败:', e);
					this.docNoList = []; 
					uni.showToast({ title: '查询失败', icon: 'none' });
				} finally { 
					this.loading = false; 
				}
			},

			// 加载更多（使用页面滚动到底部触发，需要添加 onReachBottom）
			async loadMore() {
				if (this.loadingMore || this.noMore || this.loading) return;
				this.loadingMore = true; 
				this.pageNo++;
				try {
					const params = {};
					Object.entries(this.searchParams).forEach(([k, v]) => { 
						if (v !== '') params[k] = v; 
					});
					params.pageNo = this.pageNo; 
					params.pageSize = this.pageSize;

					let result = [];
					const fnMap = { '1': getDocListRuku, '2': getDocListCuku, '4': getDocListDiaobo };
					if (fnMap[this.operateType]) {
						result = (await fnMap[this.operateType](params)).data.result || [];
					} else if (this.operateType === '3') {
						const fn = this.typeName.includes('盘点') ? getDocListPandian : getDocListQita;
						result = (await fn(params)).data.result || [];
					}
					this.docNoList.push(...result.map(v => ({...v, snType: this.getSnType()})));
					if (result.length < this.pageSize) this.noMore = true;
				} catch (e) {
					console.error('加载更多失败:', e);
				} finally { 
					this.loadingMore = false; 
				}
			},

			getSnType() {
				if (this.operateType === '1') return '2';
				if (this.operateType === '2') return '3';
				if (this.operateType === '3') return this.typeName.includes('盘点') ? '5' : '2';
				if (this.operateType === '4') return '4';
				return '2';
			},

			formatTime(time) {
				if (!time) return '';
				try {
					const d = new Date(time);
					if (isNaN(d.getTime())) return String(time).substring(0, 10);
					const p = n => String(n).padStart(2, '0');
					return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
				} catch (e) { 
					return String(time).substring(0, 10); 
				}
			},

			showDetail(item) {
				// 确定条码类型：如果当前页面已有 codeType 则使用，否则根据单据类型判断
				let codeType = this.codeType;
				if (!codeType || codeType === '') {
					codeType = CONTAINER_DOC_TYPES.includes(item.docType) ? 'container' : 'normal';
				}
				
				uni.navigateTo({ 
					url: `/pages/wms/docOpt/docCommand?docData=${encodeURIComponent(JSON.stringify(item))}&typeName=${encodeURIComponent(this.typeName)}&codeType=${codeType}` 
				});
			},

			back() { 
				uni.navigateBack(); 
			}
		},
		
		// 页面触底加载更多
		onReachBottom() {
			this.loadMore();
		}
	}
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$bg: #f0f2f5; $card: #fff; $text: #1a1a2e; $sub: #6b7280; $hint: #9ca3af; $line: #e5e7eb;

.page { @include p-page; background: $bg; min-height: 100vh; }

/* ════ 固定顶部搜索栏 ════ */
.top-bar { 
	position: sticky; 
	top: 0; 
	z-index: 10; 
	background: $card; 
	padding-top: calc(0rpx + env(safe-area-inset-top));
	box-shadow: 0 1rpx 8rpx rgba(0,0,0,.03); 
	transition: background .25s;
}

.search-bar { background: $card; width: 100%; transition: background .25s; }
.search-head { display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 20rpx; }
.sh-title { font-size: 26rpx; font-weight: 600; color: $sub; transition: color .25s; }
.search-body { padding: 0 24rpx 20rpx; }
.s-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; }

.s-item { min-width: 0; overflow: hidden; position: relative; }
.s-input { width: 100%; height: 72rpx; background: #f4f5f7; border-radius: 10rpx; border: 1rpx solid $line; padding: 0 50rpx 0 18rpx; font-size: 24rpx; color: $text; box-sizing: border-box; outline: none; -webkit-appearance: none; &:focus { border-color: #1677ff; } }
.ph { color: $hint; font-size: 24rpx; }
.s-clr { position: absolute; right: 8rpx; top: 50%; transform: translateY(-50%); padding: 6rpx; border-radius: 50%; background: rgba(0,0,0,.04); z-index: 2; }
.s-actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
.sa-reset, .sa-search { flex: 1; height: 72rpx; border-radius: 10rpx; display: flex; align-items: center; justify-content: center; font-size: 26rpx; font-weight: 600; }
.sa-reset { background: #f4f5f7; color: $sub; &:active { background: $line; } }
.sa-search { color: #fff; &:active:not(.loading) { opacity: .85; } &.loading { opacity: .7; } }

/* ════ 内容区 ════ */
.content { width: 100%; padding: 20rpx 24rpx; padding-bottom: 120rpx; box-sizing: border-box; }

.load-wrap { padding: 80rpx 0; }
.list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.lh-title { font-size: 28rpx; font-weight: 700; color: $text; transition: color .25s; }
.lh-count { font-size: 22rpx; color: $hint; }
.list { display: flex; flex-direction: column; gap: 16rpx; width: 100%; }

.d-card { @include p-card; padding: 28rpx; width: 100%; box-sizing: border-box; overflow: hidden; &:active { opacity: .95; } }
.dc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.dc-no { font-size: 26rpx; font-weight: 700; color: $text; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12rpx; transition: color .25s; }
.dc-tag { padding: 6rpx 16rpx; border-radius: 16rpx; font-size: 20rpx; font-weight: 500; flex-shrink: 0; white-space: nowrap;
	&.t-pending { background: #fff3e0; color: #e65100; }
	&.t-active { background: #e3f2fd; color: #1565c0; }
	&.t-done { background: #e8f5e9; color: #2e7d32; }
}
.dc-body { display: flex; flex-direction: column; gap: 10rpx; }
.dc-row { display: flex; }
.dc-l { width: 140rpx; font-size: 24rpx; color: $sub; flex-shrink: 0; }
.dc-v { flex: 1; font-size: 24rpx; color: $text; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .25s; }
.dc-time { color: $hint; font-size: 22rpx; }

.load-more { padding: 32rpx 0; text-align: center; }
.nm-text { font-size: 24rpx; color: $hint; }
.empty { text-align: center; padding: 100rpx 0; font-size: 28rpx; color: $hint; }
.empty-sub { display: block; font-size: 22rpx; margin-top: 8rpx; }

.safe-bottom { height: 20rpx; }

.go-top { position: fixed; right: 30rpx; bottom: 140rpx; width: 72rpx; height: 72rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4rpx 16rpx rgba(0,0,0,.15); z-index: 20; transition: background .25s; }

.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; background: $card; padding: 20rpx 24rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); box-shadow: 0 -2rpx 12rpx rgba(0,0,0,.04); z-index: 10; transition: background .25s; }
.bb-btn { background: #f4f5f7; color: $sub; text-align: center; height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; &:active { background: $line; } }

/* ═════════════════ 尺寸适配 ═════════════════ */
.size-small {
	.top-bar { padding-top: calc(0rpx + env(safe-area-inset-top)); }
	.search-head { padding: 14rpx; }
	.sh-title { font-size: 22rpx; }
	.s-grid { gap: 10rpx; }
	.s-input { height: 60rpx; font-size: 20rpx; }
	.ph { font-size: 20rpx; }
	.sa-reset, .sa-search { height: 60rpx; font-size: 22rpx; }
	.content { padding: 14rpx 16rpx; padding-bottom: 100rpx; }
	.d-card { padding: 20rpx; }
	.dc-no { font-size: 22rpx; }
	.dc-l, .dc-v { font-size: 20rpx; }
	.bb-btn { height: 66rpx; line-height: 66rpx; font-size: 24rpx; }
	.go-top { width: 56rpx; height: 56rpx; bottom: 120rpx; }
}

.size-large {
	.top-bar { padding-top: calc(0rpx + env(safe-area-inset-top)); }
	.search-head { padding: 28rpx; }
	.sh-title { font-size: 30rpx; }
	.s-grid { gap: 20rpx; }
	.s-input { height: 84rpx; font-size: 28rpx; }
	.ph { font-size: 28rpx; }
	.sa-reset, .sa-search { height: 84rpx; font-size: 30rpx; }
	.content { padding: 28rpx 32rpx; padding-bottom: 140rpx; }
	.d-card { padding: 36rpx; }
	.dc-no { font-size: 30rpx; }
	.dc-l, .dc-v { font-size: 28rpx; }
	.bb-btn { height: 96rpx; line-height: 96rpx; font-size: 32rpx; }
	.go-top { width: 88rpx; height: 88rpx; bottom: 160rpx; }
}

/* ═════════════════ 深色主题 ═════════════════ */
.theme-dark {
	&.page { background: #0f0f1a; }
	.top-bar, .search-bar { background: #1a1a2e; }
	.sh-title { color: #888; }
	.s-input { background: #1e1e36; border-color: #2a2a45; color: #e0e0e0; }
	.ph { color: #555; }
	.s-clr { background: rgba(255,255,255,.06); }
	.sa-reset { background: #1e1e36; color: #888; }
	.d-card { background: #1a1a2e; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.dc-no { color: #e0e0e0; }
	.dc-v { color: #e0e0e0; }
	.dc-tag.t-pending { background: rgba(230,81,0,.15); color: #ffa76e; }
	.dc-tag.t-active { background: rgba(21,101,192,.15); color: #7cadff; }
	.dc-tag.t-done { background: rgba(46,125,50,.15); color: #81c784; }
	.bottom-bar { background: #1a1a2e; }
	.bb-btn { background: #1e1e36; color: #888; }
}
</style>