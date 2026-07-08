<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<swiper class="swiper" :current="swiperIndex" @change="onSwiper" :duration="250" :style="{ height: swiperH + 'px' }">
			<!-- doc tab -->
			<swiper-item>
				<view class="tab-page">
					<view class="filter-row">
						<scroll-view scroll-x class="filter-scroll">
							<view class="filter-tag" :class="{ on: activeFilter === 'all' }" :style="activeFilter === 'all' ? fOn : {}" @click="changeFilter('all')">全部</view>
							<view class="filter-tag" :class="{ on: activeFilter === '1' }" :style="activeFilter === '1' ? fOn : {}" @click="changeFilter('1')">入库</view>
							<view class="filter-tag" :class="{ on: activeFilter === '2' }" :style="activeFilter === '2' ? fOn : {}" @click="changeFilter('2')">出库</view>
							<view class="filter-tag" :class="{ on: activeFilter === '4' }" :style="activeFilter === '4' ? fOn : {}" @click="changeFilter('4')">调拨</view>
							<view class="filter-tag" :class="{ on: activeFilter === '3' }" :style="activeFilter === '3' ? fOn : {}" @click="changeFilter('3')">其他</view>
						</scroll-view>
					</view>
					<scroll-view scroll-y class="page-scroll">
						<view class="grid">
							<view class="g-row" v-for="(row, ri) in chunkArray(filteredDocList, 3)" :key="ri">
								<view class="g-item" v-for="item in row" :key="item.id" @click="clickGrid(item)">
									<view class="g-card">
										<view class="g-icon" :style="{ background: themeAccent }">
											<view :class="getIconClass(item)" :style="{ color: themePrimary }"></view>
										</view>
										<text class="g-text">{{ getDisplayName(item.typeName) }}</text>
									</view>
								</view>
								<view class="g-item empty" v-for="e in 3 - row.length" :key="'e'+e" />
							</view>
						</view>
						<view class="empty-state" v-if="filteredDocList.length === 0 && !loading">
							<text>暂无{{ getFilterText() }}单据</text>
						</view>
					</scroll-view>
				</view>
			</swiper-item>

			<!-- command tab -->
			<swiper-item>
				<view class="tab-page">
					<scroll-view scroll-y class="page-scroll">
						<view class="cmd-list">
							<view class="cmd-item" v-for="item in filteredCommandList" :key="item.id" @click="goToCommandWork(item.cmdCode)">
								<view class="cmd-icon" style="background: linear-gradient(135deg, #722ed1, #9254de);">
									<view class="iconfont icon-zhiling"></view>
								</view>
								<view class="cmd-body">
									<text class="cmd-title">{{ item.cmdName }}</text>
									<text class="cmd-desc" v-if="item.commandDesc">{{ item.commandDesc }}</text>
								</view>
								<uni-icons type="right" size="16" color="#ccc"></uni-icons>
							</view>
						</view>
						<view class="empty-state" v-if="filteredCommandList.length === 0 && !commandLoading">
							<text>暂无通用指令</text>
						</view>
					</scroll-view>
				</view>
			</swiper-item>

			<!-- inventory tab -->
			<swiper-item>
				<view class="tab-page">
					<scroll-view scroll-y class="page-scroll">
						<view class="cmd-list">
							<view class="cmd-item" @click="goToRealTimeInventory()">
								<view class="cmd-icon" style="background: linear-gradient(135deg, #36cfc9, #5cdbd3);">
									<view class="iconfont icon-shishikucuntongji"></view>
								</view>
								<view class="cmd-body">
									<text class="cmd-title">实时库存</text>
								</view>
								<uni-icons type="right" size="16" color="#ccc"></uni-icons>
							</view>
						</view>
					</scroll-view>
				</view>
			</swiper-item>
		</swiper>

		<!-- bottom tab bar (fixed) -->
		<view class="tab-bar">
			<view class="tab-item" :class="{ on: activeTab === 'doc' }" @click="switchTab('doc')">
				<text>单据作业</text>
				<view class="tab-line" v-if="activeTab === 'doc'" :style="{ background: themePrimary }"></view>
			</view>
			<view class="tab-item" :class="{ on: activeTab === 'command' }" @click="switchTab('command')">
				<text>指令作业</text>
				<view class="tab-line" v-if="activeTab === 'command'" :style="{ background: themePrimary }"></view>
			</view>
			<view class="tab-item" :class="{ on: activeTab === 'inventory' }" @click="switchTab('inventory')">
				<text>库存作业</text>
				<view class="tab-line" v-if="activeTab === 'inventory'" :style="{ background: themePrimary }"></view>
			</view>
		</view>
	</view>
</template>

<script>
	import { getDocTypeList } from "@/api/wmsApi.js";
	import settingsMixin from '@/common/settingsMixin.js';

	export default {
		mixins: [settingsMixin],

		data() {
			return {
				swiperH: 500,
				activeTab: 'doc', swiperIndex: 0,
				docTypeList: [], loading: false, activeFilter: 'all',
				allCmdOptions: [], commandLoading: false,
				tabMap: { doc: 0, command: 1, inventory: 2 }
			}
		},

		computed: {
			filteredDocList() {
				return this.activeFilter === 'all' ? this.docTypeList : this.docTypeList.filter(d => d.operateType === this.activeFilter);
			},
			filteredCommandList() {
				return this.allCmdOptions.filter(c => c.cmdCategroy === '通用');
			},
			fOn() { return { background: this.themePrimary, color: '#fff' }; }
		},

		onLoad() { this.getDocList(); this.getAllCommands(); },
		onShow() { this.getDocList(); this.getAllCommands(); },
		onReady() {
			const info = uni.getSystemInfoSync();
			this.$nextTick(() => {
				uni.createSelectorQuery().in(this).select('.tab-bar').boundingClientRect(data => {
					if (data) this.swiperH = info.windowHeight - data.height;
				}).exec();
			});
		},

		methods: {
			switchTab(t) { this.activeTab = t; this.swiperIndex = this.tabMap[t]; },
			onSwiper(e) {
				const i = e.detail.current; this.swiperIndex = i;
				this.activeTab = Object.keys(this.tabMap).find(k => this.tabMap[k] === i) || 'doc';
			},

			chunkArray(arr, size) {
				const r = [];
				for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
				return r;
			},
			getDisplayName(n) { return n || ''; },
			getIconClass(item) {
				const t = item.operateType;
				if (t === '1') return 'iconfont icon-ruku';
				if (t === '2') return 'iconfont icon-chuku';
				if (t === '4' || (item.typeName || '').includes('调拨')) return 'iconfont icon-diaobo';
				if ((item.typeName || '').includes('盘点')) return 'iconfont icon-pandian';
				return 'iconfont icon-other';
			},

			changeFilter(t) { this.activeFilter = t; },
			getFilterText() {
				return { 'all': '', '1': '入库', '2': '出库', '3': '其他', '4': '调拨' }[this.activeFilter] || '';
			},

			async getDocList() {
				this.loading = true;
				try {
					const allowed = (uni.getStorageSync("pdaPermissions") || []).map(p => p.component);
					const res = await getDocTypeList();
					this.docTypeList = (res.data.result || []).filter(d => d.isPdaDisplay === "Y" && allowed.includes(d.typeSn));
				} catch (e) { this.docTypeList = []; }
				finally { this.loading = false; }
			},

			getAllCommands() {
				this.commandLoading = true;
				this.$request({ url: "/wms/cmd/getListByCmdCategroy", method: "GET", data: {} })
					.then(res => { this.allCmdOptions = res.data.result || []; })
					.catch(() => { this.allCmdOptions = []; })
					.finally(() => { this.commandLoading = false; });
			},

			clickGrid(item) {
				uni.$toPath(`/pages/wms/docOpt/docOpt?docType=${item.typeSn}&operateType=${item.operateType}&typeName=${encodeURIComponent(item.typeName)}`);
			},
			goToCommandWork(code) { uni.$toPath('/pages/wms/commandOpt/commandOpt?commandCode=' + code); },
			goToRealTimeInventory() { uni.$toPath('/pages/wms/realTimeInventory/realTimeInventory'); }
		}
	}
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$bg: #f0f2f5; $card: #fff; $text: #1a1a2e; $sub: #6b7280; $hint: #9ca3af;

.page { @include p-page; background: $bg; min-height: 100vh; padding-bottom: 100rpx; }

.swiper { width: 100%; }
.tab-page { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }

.filter-row { flex-shrink: 0; padding: 20rpx 24rpx; background: $card; border-bottom: 1rpx solid #e5e7eb; transition: background .25s; }
.filter-scroll { white-space: nowrap; display: flex; }
.filter-tag { display: inline-flex; align-items: center; justify-content: center; padding: 12rpx 28rpx; margin-right: 12rpx; border-radius: 20rpx; background: #f3f4f6; font-size: 26rpx; color: $sub; transition: all .15s; flex-shrink: 0;
	&.on { font-weight: 600; }
}

.page-scroll { flex: 1; width: 100%; overflow: hidden; padding: 20rpx 24rpx; box-sizing: border-box; }

.grid { display: flex; flex-direction: column; gap: 16rpx; width: 100%; }
.g-row { display: flex; gap: 16rpx; width: 100%; }
.g-item { flex: 1; min-width: 0; overflow: hidden; }
.g-card { @include p-card; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36rpx 8rpx; min-height: 200rpx; gap: 18rpx; width: 100%; box-sizing: border-box; &:active { opacity: .88; transform: scale(.98); } }
.g-icon { width: 72rpx; height: 72rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .25s;
	.iconfont { font-size: 40rpx; transition: color .25s; }
}
.g-text { font-size: 26rpx; font-weight: 600; color: $text; text-align: center; transition: color .25s; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-item.empty { visibility: hidden; }

.cmd-list { display: flex; flex-direction: column; gap: 16rpx; width: 100%; }
.cmd-item { @include p-card; display: flex; align-items: center; padding: 28rpx; width: 100%; box-sizing: border-box; overflow: hidden; &:active { opacity: .88; } }
.cmd-icon { width: 72rpx; height: 72rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; flex-shrink: 0; .iconfont { font-size: 36rpx; color: #fff; } }
.cmd-body { flex: 1; min-width: 0; overflow: hidden; }
.cmd-title { display: block; font-size: 28rpx; font-weight: 600; color: $text; margin-bottom: 4rpx; transition: color .25s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd-desc { display: block; font-size: 22rpx; color: $hint; transition: color .25s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-state { text-align: center; padding: 80rpx 0; color: $hint; font-size: 26rpx; }

.tab-bar {
	position: fixed; bottom: 0; left: 0; right: 0;
	display: flex; align-items: center; justify-content: space-around;
	height: 100rpx; background: $card;
	box-shadow: 0 -2rpx 12rpx rgba(0,0,0,.04); z-index: 100;
	transition: background .25s;
	padding-bottom: env(safe-area-inset-bottom);
}
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; position: relative; font-size: 28rpx; color: $sub; transition: color .2s; min-width: 0;
	&.on { color: $text; font-weight: 600; }
}
.tab-line { position: absolute; bottom: 0; width: 48rpx; height: 6rpx; border-radius: 3rpx; transition: background .25s; }

.size-small {
	.tab-bar { height: 80rpx; }
	.tab-item { font-size: 24rpx; }
	.filter-row { padding: 14rpx 16rpx; }
	.filter-tag { padding: 8rpx 20rpx; font-size: 22rpx; }
	.page-scroll { padding: 14rpx 16rpx; }
	.g-card { padding: 28rpx 6rpx; min-height: 160rpx; }
	.g-icon { width: 56rpx; height: 56rpx; .iconfont { font-size: 32rpx; } }
	.g-text { font-size: 22rpx; }
	.cmd-item { padding: 22rpx; }
	.cmd-icon { width: 56rpx; height: 56rpx; .iconfont { font-size: 28rpx; } }
	.cmd-title { font-size: 24rpx; }
}

.size-large {
	.tab-bar { height: 120rpx; }
	.tab-item { font-size: 32rpx; }
	.filter-row { padding: 28rpx 32rpx; }
	.filter-tag { padding: 16rpx 36rpx; font-size: 30rpx; }
	.page-scroll { padding: 28rpx 32rpx; }
	.g-card { padding: 48rpx 12rpx; min-height: 250rpx; }
	.g-icon { width: 88rpx; height: 88rpx; .iconfont { font-size: 48rpx; } }
	.g-text { font-size: 30rpx; }
	.cmd-item { padding: 36rpx; }
	.cmd-icon { width: 88rpx; height: 88rpx; .iconfont { font-size: 44rpx; } }
	.cmd-title { font-size: 32rpx; }
}

.theme-dark {
	&.page { background: #0f0f1a; }
	.tab-bar { background: #1a1a2e; }
	.tab-item { color: #888; &.on { color: #e0e0e0; } }
	.filter-row { background: #1a1a2e; border-color: #2a2a45; }
	.filter-tag { background: #1e1e36; color: #888; }
	.g-card, .cmd-item { background: #1a1a2e; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.g-text, .cmd-title { color: #e0e0e0; }
	.cmd-desc { color: #666; }
}
</style>