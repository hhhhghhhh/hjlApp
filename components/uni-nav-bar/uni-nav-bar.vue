<template>
	<view class="uni-nav-bar" :style="navBarStyle">
		<view class="uni-nav-bar__content" :style="contentStyle">
			<view class="uni-nav-bar__header">
				<view class="uni-nav-bar__header-btns" v-if="leftIcon.length">
					<view @click="onClickLeft" class="uni-nav-bar__content">
						<uni-icons :type="leftIcon" size="24" color="#000"></uni-icons>
					</view>
				</view>
				<view class="uni-nav-bar__header-container">
					<view class="uni-nav-bar__header-container-inner">
						<text class="uni-nav-bar__header-text">{{ title }}</text>
					</view>
				</view>
				<view class="uni-nav-bar__header-btns" v-if="$slots.right || rightText.length">
					<view @click="onClickRight" class="uni-nav-bar__content">
						<slot name="right">
							<text class="uni-nav-bar__header-text">{{ rightText }}</text>
						</slot>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'UniNavBar',
		props: {
			title: {
				type: String,
				default: ''
			},
			leftIcon: {
				type: String,
				default: ''
			},
			rightText: {
				type: String,
				default: ''
			},
			backgroundColor: {
				type: String,
				default: '#ffffff'
			},
			border: {
				type: Boolean,
				default: true
			}
		},
		computed: {
			navBarStyle() {
				return {
					backgroundColor: this.backgroundColor
				}
			},
			contentStyle() {
				return {
					borderBottom: this.border ? '1px solid #f0f0f0' : 'none'
				}
			}
		},
		methods: {
			onClickLeft() {
				this.$emit('clickLeft')
			},
			onClickRight() {
				this.$emit('clickRight')
			}
		}
	}
</script>

<style scoped>
	.uni-nav-bar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 999;
	}
	
	.uni-nav-bar__content {
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.uni-nav-bar__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 100%;
		padding: 0 15px;
		box-sizing: border-box;
	}
	
	.uni-nav-bar__header-btns {
		width: 60px;
		display: flex;
		align-items: center;
	}
	
	.uni-nav-bar__header-btns:first-child {
		justify-content: flex-start;
	}
	
	.uni-nav-bar__header-btns:last-child {
		justify-content: flex-end;
	}
	
	.uni-nav-bar__header-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.uni-nav-bar__header-container-inner {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.uni-nav-bar__header-text {
		font-size: 17px;
		font-weight: 600;
		color: #000;
	}
</style>