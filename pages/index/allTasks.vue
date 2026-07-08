<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 固定搜索 ════ -->
		<view class="top-bar">
			<view class="search-box">
				<uni-icons type="search" size="18" :color="themePrimary"></uni-icons>
				<input v-model="filterText" class="search-input" placeholder="搜索任务" placeholder-class="ph" @input="onFilter" />
				<view class="search-clear" v-if="filterText" @click="clearFilter">
					<uni-icons type="clear" size="16" color="#999"></uni-icons>
				</view>
			</view>
		</view>

		<!-- ════ 内容 ════ -->
		<view class="content">
			<view class="list-head" v-if="filteredTasks.length">
				<text class="head-title">任务列表</text>
				<text class="head-count">共 {{ filteredTasks.length }} 条</text>
			</view>

			<view v-if="loading" class="loading"><uni-load-more status="loading" /></view>

			<view v-else-if="filteredTasks.length" class="list">
				<view v-for="task in filteredTasks" :key="task.id" class="t-card" @click="viewTaskDetail(task)">
					<view class="tc-head">
						<text class="tc-type">{{ task.docType_dictText || getTaskTypeText(task.docTypeFlag) }}</text>
						<view class="tc-tag" :class="'t-' + getDisplayStatus(task)">{{ getStatusText(task) }}</view>
					</view>
					<view class="tc-row"><text class="tc-l">单据号</text><text class="tc-v">{{ task.docNo }}</text></view>
					<view class="tc-row"><text class="tc-l">创建时间</text><text class="tc-v tc-time">{{ formatTime(task.createTime) }}</text></view>
					<view class="tc-arrow"><uni-icons type="right" size="14" color="#ccc"></uni-icons></view>
				</view>
			</view>

			<view v-else class="empty">
				<text>{{ filterText ? '未找到相关任务' : '暂无任务' }}</text>
			</view>
		</view>

		<!-- ════ 回顶 ════ -->
		<view class="go-top" v-if="showGoTop" @click="scrollToTop" :style="{ background: themePrimary }">
			<uni-icons type="arrowup" size="18" color="#fff"></uni-icons>
		</view>

		<!-- ════ 底部按钮 ════ -->
		<view class="bottom-bar">
			<view class="btn-back" @click="goBack">返回</view>
		</view>
	</view>
</template>

<script>
import settingsMixin from '@/common/settingsMixin.js';

export default {
	mixins: [settingsMixin],

	data() {
		return {
			allTasks: [],
			filteredTasks: [],
			filterText: '',
			loading: false,
			showGoTop: false
		};
	},

	onLoad(options) {
		if (options.tasks) {
			this.allTasks = JSON.parse(decodeURIComponent(options.tasks));
			this.filteredTasks = [...this.allTasks];
		}
	},

	onPageScroll(e) { this.showGoTop = e.scrollTop > 300; },

	methods: {
		goBack() { uni.navigateBack(); },

		onFilter() {
			const kw = this.filterText.toLowerCase().trim();
			this.filteredTasks = kw ? this.allTasks.filter(t =>
				(t.docType_dictText || '').toLowerCase().includes(kw) ||
				(t.docNo || '').toLowerCase().includes(kw)
			) : [...this.allTasks];
		},

		clearFilter() { this.filterText = ''; this.filteredTasks = [...this.allTasks]; },

		getDisplayStatus(task) {
			const s = task.docStatus || task.invDocStatus;
			if (task.docTypeFlag !== 'inventory') return s;
			return { '1': '1', '2': '2', '3': '3', '6': '3', '7': '2', '8': '3', '9': '3' }[s] || '1';
		},

		getStatusText(task) { return { '1': '待处理', '2': '处理中', '3': '已完成' }[this.getDisplayStatus(task)] || '--'; },
		getTaskTypeText(f) { return { receive: '入库', outstock: '出库', allot: '调拨', inventory: '盘点' }[f] || '未知'; },

		formatTime(time) {
			if (!time) return '';
			try {
				const d = new Date(time);
				if (isNaN(d.getTime())) return String(time).substring(0, 10);
				const now = new Date(), diff = now - d;
				if (diff < 0) return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
				const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
				if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
				const y = new Date(now); y.setDate(y.getDate()-1);
				if (d.toDateString() === y.toDateString()) return `昨天 ${hm}`;
				const days = Math.floor(diff/86400000);
				if (days < 7) return `${days}天前`;
				return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
			} catch (e) { return String(time).substring(0, 10); }
		},

		viewTaskDetail(task) {
			const m = { receive: '入库单', outstock: '出库单', allot: '调拨单', inventory: '盘点单' };
			const tn = m[task.docTypeFlag];
			if (!tn) { uni.showToast({ title: '未知单据类型', icon: 'none' }); return; }
			uni.navigateTo({ url: `/pages/wms/docOpt/docCommand?docData=${encodeURIComponent(JSON.stringify(task))}&typeName=${encodeURIComponent(tn)}` });
		},

		scrollToTop() { uni.pageScrollTo({ scrollTop: 0, duration: 300 }); }
	}
};
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$bg: #f0f2f5; $card: #fff; $text: #1a1a2e; $sub: #6b7280; $hint: #9ca3af; $line: #e5e7eb;

.page { @include p-page; background: $bg; padding-bottom: 120rpx; }

.top-bar { position: sticky; top: 0; z-index: 10; background: $card; padding: 20rpx 24rpx; padding-top: calc(20rpx + env(safe-area-inset-top)); box-shadow: 0 1rpx 8rpx rgba(0,0,0,.03); transition: background .25s; }
.search-box { display: flex; align-items: center; background: #f4f5f7; border-radius: 12rpx; padding: 18rpx 20rpx; border: 1rpx solid $line; transition: background .25s, border .25s; }
.search-input { flex: 1; font-size: 28rpx; color: $text; margin: 0 16rpx; background: transparent; border: none; outline: none; }
.ph { color: $hint; font-size: 28rpx; }
.search-clear { padding: 8rpx; border-radius: 50%; background: rgba(0,0,0,.05); }
.content { padding: 20rpx 24rpx; }
.list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.head-title { font-size: 30rpx; font-weight: 700; color: $text; }
.head-count { font-size: 22rpx; color: $hint; }
.loading { text-align: center; padding: 80rpx 0; }
.list { display: flex; flex-direction: column; gap: 16rpx; }

.t-card { @include p-card; padding: 28rpx; position: relative; &:active { opacity: .95; } }
.tc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.tc-type { font-size: 28rpx; font-weight: 600; color: $text; }
.tc-tag { padding: 6rpx 18rpx; border-radius: 16rpx; font-size: 20rpx; font-weight: 500;
	&.t-1 { background: #fff3e0; color: #e65100; }
	&.t-2 { background: #e3f2fd; color: #1565c0; }
	&.t-3 { background: #e8f5e9; color: #2e7d32; }
}
.tc-row { display: flex; margin-bottom: 12rpx; }
.tc-l { width: 140rpx; font-size: 24rpx; color: $sub; flex-shrink: 0; }
.tc-v { flex: 1; font-size: 24rpx; color: $text; }
.tc-time { color: $hint; font-size: 22rpx; }
.tc-arrow { position: absolute; right: 28rpx; top: 50%; transform: translateY(-50%); }
.empty { text-align: center; padding: 100rpx 0; font-size: 28rpx; color: $hint; }

.go-top { position: fixed; right: 30rpx; bottom: 140rpx; width: 72rpx; height: 72rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4rpx 16rpx rgba(0,0,0,.15); z-index: 20; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; background: $card; padding: 20rpx 24rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); box-shadow: 0 -1rpx 8rpx rgba(0,0,0,.04); transition: background .25s; }
.btn-back { background: #f4f5f7; color: $sub; text-align: center; height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; &:active { background: $line; } }

/* ═════════════════ 尺寸 / 深色 ═════════════════ */
.size-small {
	.top-bar { padding: 14rpx 16rpx; }
	.search-box { padding: 12rpx 16rpx; }
	.search-input, .ph { font-size: 24rpx; }
	.content { padding: 14rpx 16rpx; }
	.head-title { font-size: 26rpx; }
	.t-card { padding: 20rpx; }
	.tc-type { font-size: 24rpx; }
	.tc-l, .tc-v { font-size: 20rpx; }
	.btn-back { height: 66rpx; line-height: 66rpx; font-size: 24rpx; }
	.go-top { width: 56rpx; height: 56rpx; bottom: 120rpx; }
}

.size-large {
	.top-bar { padding: 28rpx 32rpx; }
	.search-box { padding: 24rpx 28rpx; }
	.search-input, .ph { font-size: 32rpx; }
	.content { padding: 28rpx 32rpx; }
	.head-title { font-size: 36rpx; }
	.t-card { padding: 36rpx; }
	.tc-type { font-size: 32rpx; }
	.tc-l, .tc-v { font-size: 28rpx; }
	.btn-back { height: 96rpx; line-height: 96rpx; font-size: 32rpx; }
	.go-top { width: 88rpx; height: 88rpx; bottom: 160rpx; }
}

.theme-dark {
	&.page { background: #0f0f1a; }
	.top-bar, .bottom-bar { background: #1a1a2e; }
	.search-box { background: #1e1e36; border-color: #2a2a45; }
	.search-input { color: #e0e0e0; }
	.ph { color: #555; }
	.head-title, .tc-type, .tc-v { color: #e0e0e0; }
	.tc-l { color: #888; }
	.t-card { background: #1a1a2e; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.tc-tag.t-1 { background: rgba(230,81,0,.15); color: #ffa76e; }
	.tc-tag.t-2 { background: rgba(21,101,192,.15); color: #7cadff; }
	.tc-tag.t-3 { background: rgba(46,125,50,.15); color: #81c784; }
	.btn-back { background: #1e1e36; color: #888; }
}
</style>