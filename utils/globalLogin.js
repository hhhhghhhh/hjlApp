export default function globalLogin() {
	const isToken = uni.getStorageSync("token");
	if (!isToken) {
		uni.clearStorageSync();
		uni.navigateTo({
			url: "/pages/login/login"
		})
	}
}
