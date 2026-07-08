<template name="page-foot">
	<view class="page-share-title">
		<text>{{name}}</text>
	</view>
</template>

<script>
	export default {
		name: "page-foot",
		props: {
			name: {
				type: String,
				default: ""
			}
		},
		methods: {
		}
	}
</script>
<style>
	.page-share-title {
		text-align: center;
		font-size: 30rpx;
		color: #BEBEBE;
		padding: 20rpx 0;
	}

	.submit {
		border-bottom: 1rpx solid #BEBEBE;
	}
</style>
