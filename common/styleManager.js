// /common/styleManager.js - 全局样式管理
const STORAGE_KEY = 'app_style_size';

const STYLE_CONFIG = {
	sizeMap: {
		'small': {
			name: '小',
			baseFontSize: 22,
			titleFontSize: 24,
			padding: 12,
			buttonHeight: 64,
			cardPadding: 16,
			borderRadius: 8,
			paramItemPadding: 12,
			inputPadding: 12,
			messagePadding: 10,
			iconSize: 18,
			starSize: 12,
			cmdButtonHeight: 80,
			cmdButtonFontSize: 26
		},
		'medium': {
			name: '中',
			baseFontSize: 26,
			titleFontSize: 28,
			padding: 20,
			buttonHeight: 80,
			cardPadding: 20,
			borderRadius: 12,
			paramItemPadding: 16,
			inputPadding: 20,
			messagePadding: 12,
			iconSize: 22,
			starSize: 14,
			cmdButtonHeight: 100,
			cmdButtonFontSize: 28
		},
		'large': {
			name: '大',
			baseFontSize: 30,
			titleFontSize: 32,
			padding: 28,
			buttonHeight: 96,
			cardPadding: 28,
			borderRadius: 16,
			paramItemPadding: 20,
			inputPadding: 26,
			messagePadding: 16,
			iconSize: 26,
			starSize: 16,
			cmdButtonHeight: 120,
			cmdButtonFontSize: 32
		}
	},
	defaultSize: 'medium'
};

// 获取当前样式大小
function getCurrentSize() {
	try {
		const saved = uni.getStorageSync(STORAGE_KEY);
		if (saved && STYLE_CONFIG.sizeMap[saved]) {
			return saved;
		}
	} catch (e) {
		console.error('获取样式配置失败:', e);
	}
	return STYLE_CONFIG.defaultSize;
}

// 设置样式大小
function setStyleSize(size) {
	if (!STYLE_CONFIG.sizeMap[size]) return false;
	try {
		uni.setStorageSync(STORAGE_KEY, size);
		// 同步更新 body class，驱动 CSS 变量切换
		applyBodyClass(size);
		// 发送全局事件
		uni.$emit('styleSizeChanged', { size });
		return true;
	} catch (e) {
		console.error('保存样式配置失败:', e);
		return false;
	}
}

// 同步 body class 到当前 size
function applyBodyClass(size) {
	try {
		const bodyClass = `size-${size}`;
		// #ifdef H5
		document.body.className = document.body.className
			.replace(/size-(small|medium|large)/g, '')
			.trim();
		document.body.classList.add(bodyClass);
		// #endif
		// #ifndef H5
		// 小程序端通过页面级 class 驱动
		uni.$emit('bodyClassChange', bodyClass);
		// #endif
	} catch (e) {
		// 静默失败
	}
}

// 获取样式配置
function getStyleConfig(size = null) {
	const currentSize = size || getCurrentSize();
	return STYLE_CONFIG.sizeMap[currentSize] || STYLE_CONFIG.sizeMap[STYLE_CONFIG.defaultSize];
}

// 获取样式类名
function getStyleClass() {
	return `size-${getCurrentSize()}`;
}

// 页面混入 - 用于所有页面自动应用样式
const styleMixin = {
	data() {
		return {
			currentSize: 'medium',
			sizeClass: ''
		}
	},
	onLoad() {
		this.loadStyleConfig();
		// 监听样式变化事件
		uni.$on('styleSizeChanged', this.onStyleSizeChanged);
	},
	onUnload() {
		// 移除事件监听
		uni.$off('styleSizeChanged', this.onStyleSizeChanged);
	},
	onShow() {
		// 每次显示时重新加载样式
		this.loadStyleConfig();
	},
	methods: {
		loadStyleConfig() {
			try {
				const savedSize = uni.getStorageSync(STORAGE_KEY);
				if (savedSize && STYLE_CONFIG.sizeMap[savedSize]) {
					this.currentSize = savedSize;
				} else {
					this.currentSize = STYLE_CONFIG.defaultSize;
				}
				this.sizeClass = `size-${this.currentSize}`;
				applyBodyClass(this.currentSize);
			} catch (error) {
				console.error('加载样式配置失败:', error);
				this.currentSize = STYLE_CONFIG.defaultSize;
				this.sizeClass = `size-${STYLE_CONFIG.defaultSize}`;
			}
		},
		onStyleSizeChanged(data) {
			this.currentSize = data.size;
			this.sizeClass = `size-${data.size}`;
			this.$forceUpdate();
		}
	}
};

export default {
	STORAGE_KEY,
	STYLE_CONFIG,
	getCurrentSize,
	setStyleSize,
	getStyleConfig,
	getStyleClass,
	applyBodyClass,
	styleMixin
};