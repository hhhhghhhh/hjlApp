/* const isDev = process.env.NODE_ENV === 'development'
let BASE_URL = null
if (process.env.NODE_ENV === 'development') {
	BASE_URL = '/api';
	// #ifdef APP-PLUS
	switch (uni.getSystemInfoSync().platform) {
		case 'android':
			console.log('运行Android上')
			BASE_URL = 'http://192.168.225.64:8082/cc-admin'
			break;
		case 'ios':
			console.log('运行iOS上')
			BASE_URL = 'http://192.168.225.64:8082/cc-admin'
			break;
		default:
			console.log('运行在开发者工具上')
			break;
	}
	// #endif
} else {
	BASE_URL = 'http://218.65.96.111:8082/cc-admin'
} */

// 同时发送异步代码的次数，防止一次点击中有多次请求，用于处理
let ajaxTimes = 0;
// 封装请求方法，并向外暴露该方法
export const request = (options, uploadFile) => {
	let BASE_URL = uni.getStorageSync("serverUrl");
	
	// 解构请求头参数
	let header = {
		...options.header
	};
	// 当前请求不是登录时请求，在header中加上后端返回的token
	// 以/api/login开头的需要设置header 其他都不需要
	if (options.url.indexOf('/pda/login') === -1 ||
		options.url.indexOf('/pda/login/getInfo') !== -1 ||
		options.url.indexOf('/pda/version/getLastVersion') !== -1) {
		header = {
			Authorization: uni.getStorageSync('token'),
			factoryId: uni.getStorageSync('factoryId')
		};
	}
	ajaxTimes++;
	// 显示加载中 效果
	uni.showLoading({
		title: "加载中",
		mask: true,
	});

	return new Promise((resolve, reject) => {
		uni.request({
			url: BASE_URL + options.url,
			method: options.method || 'GET',
			data: options.data || {},
			header,
			success: (res) => { 
				if (res.statusCode == 401) {
					uni.redirectTo({
						url: "/pages/login/login"
					})
				} else if (res.statusCode == 500) {
					// uni.showToast({
					// 	title:res.data.message,
					// 	icon: "none"
					// })
					uni.showModal({
						title: '提示',
						content:res.data.message,
						showCancel:false,
						success: function (res) {
							if (res.confirm) {
								console.log('用户点击确定');
							} else if (res.cancel) {
								console.log('用户点击取消');
							}
						}
					});
				}else{
					if(res.data.code==500){
						uni.showModal({
							title: '提示',
							content:res.data.message,
							showCancel:false,
							success: function (res) {
								if (res.confirm) {
									console.log('用户点击确定');
								} else if (res.cancel) {
									console.log('用户点击取消');
								}
							}
						});
					}else{
						resolve(res)
					}					
				}
			},
			fail: (err) => {
				uni.showToast({
					title: '请求失败',
					duration: 1500,
					icon: 'none'
				})
				reject(err)
			},
			// 完成之后关闭加载效果
			complete: () => {
				ajaxTimes--;
				if (ajaxTimes === 0) {
					//  关闭正在等待的图标
					uni.hideLoading();
				}
			}
		})
	})
}
