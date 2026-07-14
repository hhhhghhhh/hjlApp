<template>
	<view class="page" :class="[sizeClass, darkClass, themeClass]">
		<!-- ════ 最近任务 ════ -->
		<view class="card tasks">
			<view class="tasks-head">
				<text class="tasks-title">最近任务</text>
				<text class="tasks-all" @click="viewAllTasks">查看全部 ›</text>
			</view>

			<view v-if="loading" class="tasks-loading"><text>加载中…</text></view>

			<view v-else-if="recentTasks.length > 0" class="tasks-list">
				<view v-for="task in recentTasks" :key="task.id" class="t-item" @click="viewTaskDetail(task)">
					<view class="t-body">
						<text class="t-type">{{ task.docType_dictText || getTaskTypeText(task.docTypeFlag) }}</text>
						<text class="t-no">{{ task.docNo }}</text>
						<text class="t-time">{{ formatTime(task.createTime) }}</text>
					</view>
					<view class="t-tag" :class="'tag-' + getDisplayStatus(task)">
						<text>{{ getStatusText(task) }}</text>
					</view>
				</view>
			</view>

			<view v-else class="tasks-empty"><text>暂无任务</text></view>
		</view>

		<!-- ════ 快捷入口 ════ -->
		<view class="entries">
			<view class="card entry" @click="goToWMS">
				<view class="entry-icon" :style="{ background: themeAccent }">
					<uni-icons type="home" size="28" :color="themePrimary"></uni-icons>
				</view>
				<view class="entry-body">
					<text class="entry-title">WMS 作业中心</text>
					<!-- <text class="entry-desc">入库 · 出库 · 调拨 · 盘点</text> -->
				</view>
				<text class="entry-arrow">›</text>
			</view>

			<!-- <view class="card entry" @click="goToMES">
				<view class="entry-icon" :style="{ background: themeAccent }">
					<uni-icons type="compose" size="28" :color="themePrimary"></uni-icons>
				</view>
				<view class="entry-body">
					<text class="entry-title">MES 作业中心</text>
					<text class="entry-desc">个体报工 · 批次报工</text>
				</view>
				<text class="entry-arrow">›</text>
			</view> -->
		</view>
	</view>
</template>

<script>
import { getAllDocList } from '@/api/wmsApi.js';
import settingsMixin from '@/common/settingsMixin.js';

export default {
	mixins: [settingsMixin],

	data() {
		return {
			recentTasks: [],
			allTasks: [],
			loading: false
		};
	},

	onLoad() { this.loadData(); },
	onShow() { this.loadData(); },
	onPullDownRefresh() { this.loadData().then(() => uni.stopPullDownRefresh()); },
	onNavigationBarButtonTap() { uni.$toPath('/pages/wms/scanOpt/scanOpt'); },

	methods: {
		async loadData() {
			this.loading = true;
			try {
				const allowed = (uni.getStorageSync('pdaPermissions') || []).map(p => p.component);
				const res = await getAllDocList();
				if (!res?.data?.success) return;

				let docs = [];
				Object.entries(res.data.result).forEach(([key, list]) => {
					if (list?.length) docs.push(...list.map(doc => ({ ...doc, docTypeFlag: this.docFlag(key), snType: key })));
				});
				docs.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
				if (allowed.length) docs = docs.filter(d => allowed.includes(d.docType));
				this.allTasks = docs;
				this.recentTasks = docs.slice(0, 3);
			} catch (e) { /* skip */ } finally { this.loading = false; }
		},

		docFlag(key) { return { '2': 'receive', '3': 'outstock', '4': 'allot', '5': 'inventory' }[key] || 'unknown'; },

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

		viewAllTasks() { if (this.allTasks.length) uni.navigateTo({ url: '/pages/index/allTasks?tasks=' + encodeURIComponent(JSON.stringify(this.allTasks)) }); },
		goToWMS() { uni.navigateTo({ url: '/pages/wms/index/index' }); },
		goToMES() { uni.navigateTo({ url: '/pages/mes/index/index' }); }
	}
};
</script>

<style lang="scss" scoped>
@import '@/common/page-theme-mixins.scss';

$bg: #f0f2f5; $text: #1a1a2e; $sub: #6b7280; $hint: #9ca3af; $line: #e5e7eb;

.page { @include p-page; background: $bg; padding: 20rpx 24rpx; display: flex; flex-direction: column; gap: 20rpx; }

.card { @include p-card; overflow: hidden; }
.tasks { padding: 28rpx; }
.tasks-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.tasks-title { font-size: 30rpx; font-weight: 700; color: $text; transition: color .25s; }
.tasks-all { font-size: 24rpx; color: $hint; transition: color .25s; }
.tasks-loading, .tasks-empty { text-align: center; padding: 48rpx 0; font-size: 24rpx; color: $hint; }
.tasks-list { display: flex; flex-direction: column; gap: 12rpx; }
.t-item { display: flex; align-items: center; padding: 20rpx; border-radius: 12rpx; background: #f7f8fa; border: 1rpx solid $line; transition: background .15s; &:active { background: #eef1f6; } }
.t-body { flex: 1; min-width: 0; }
.t-type { display: block; font-size: 26rpx; font-weight: 600; color: $text; margin-bottom: 4rpx; }
.t-no { display: block; font-size: 22rpx; color: $sub; margin-bottom: 2rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-time { display: block; font-size: 20rpx; color: $hint; }
.t-tag { padding: 6rpx 16rpx; border-radius: 16rpx; font-size: 20rpx; flex-shrink: 0; margin-left: 16rpx;
	&.tag-1 { background: #fff3e0; color: #e65100; }
	&.tag-2 { background: #e3f2fd; color: #1565c0; }
	&.tag-3 { background: #e8f5e9; color: #2e7d32; }
}

/* ── 入口区 ──── */
.entries { display: flex; flex-direction: column; gap: 16rpx; }
.entry { display: flex; align-items: center; padding: 32rpx 28rpx; &:active { opacity: .85; } }
.entry-icon { width: 72rpx; height: 72rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.entry-body { flex: 1; margin-left: 24rpx; min-width: 0; }
.entry-title { display: block; font-size: 28rpx; font-weight: 600; color: $text; margin-bottom: 4rpx; }
.entry-desc { display: block; font-size: 22rpx; color: $hint; }
.entry-arrow { font-size: 36rpx; color: $hint; font-weight: 300; flex-shrink: 0; }

/* ═════════════════ 尺寸 / 深色 ═════════════════ */
.size-small {
	&.page { padding: 14rpx 16rpx; gap: 14rpx; }
	.tasks { padding: 20rpx; }
	.tasks-head { margin-bottom: 14rpx; }
	.tasks-title { font-size: 26rpx; }
	.tasks-all { font-size: 20rpx; }
	.t-item { padding: 14rpx; border-radius: 10rpx; }
	.t-type { font-size: 22rpx; }
	.t-no { font-size: 18rpx; }
	.t-time { font-size: 18rpx; }
	.t-tag { padding: 4rpx 12rpx; font-size: 18rpx; }
	.entry { padding: 24rpx 20rpx; }
	.entry-icon { width: 56rpx; height: 56rpx; border-radius: 14rpx; }
	.entry-body { margin-left: 18rpx; }
	.entry-title { font-size: 24rpx; }
	.entry-desc { font-size: 18rpx; }
	.entry-arrow { font-size: 28rpx; }
	.entries { gap: 12rpx; }
}

.size-large {
	&.page { padding: 28rpx 32rpx; gap: 28rpx; }
	.tasks { padding: 36rpx; }
	.tasks-head { margin-bottom: 28rpx; }
	.tasks-title { font-size: 34rpx; }
	.tasks-all { font-size: 28rpx; }
	.t-item { padding: 28rpx; border-radius: 14rpx; }
	.t-type { font-size: 30rpx; }
	.t-no { font-size: 26rpx; }
	.t-time { font-size: 24rpx; }
	.t-tag { padding: 8rpx 20rpx; font-size: 24rpx; }
	.entry { padding: 44rpx 36rpx; }
	.entry-icon { width: 88rpx; height: 88rpx; border-radius: 22rpx; }
	.entry-body { margin-left: 32rpx; }
	.entry-title { font-size: 32rpx; }
	.entry-desc { font-size: 26rpx; }
	.entry-arrow { font-size: 44rpx; }
	.entries { gap: 22rpx; }
}

.theme-dark {
	&.page { background: #0f0f1a; }
	.tasks, .card { background: #1a1a2e; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.25); }
	.tasks-title, .t-type, .entry-title { color: #e0e0e0; }
	.t-no { color: #888; }
	.t-item { background: #1e1e36; border-color: #2a2a45; &:active { background: #252540; } }
	.t-tag.tag-1 { background: rgba(230,81,0,.15); color: #ffa76e; }
	.t-tag.tag-2 { background: rgba(21,101,192,.15); color: #7cadff; }
	.t-tag.tag-3 { background: rgba(46,125,50,.15); color: #81c784; }
	.entry-desc, .entry-arrow, .tasks-all { color: #666; }
}
</style>