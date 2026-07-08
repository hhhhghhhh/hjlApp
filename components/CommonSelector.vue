<template>
	<div class="common-selector" :class="wrapperClass">
		<!-- 选择框 -->
		<view class="selector-box" :class="{ 
      disabled: disabled || (requireParent && !parentValue),
      'full-width': fullWidth 
    }" @click="handleClick">
			<view class="selector-content">
				<text class="selector-label" v-if="showLabel">{{ label }}</text>
				<view class="selector-value-container" :class="containerClass">
					<view class="value-text-wrapper">
						<text class="selector-value" :class="{ placeholder: !selectedValue }">
							{{ selectedValue }}
						</text>
						<text v-if="showSelectedCode && selectedItem && getItemCode(selectedItem)"
							class="selector-code">
							{{ getItemCode(selectedItem) }}
						</text>
					</view>
				</view>
				<!-- 图标区域 -->
				<view class="selector-icons">
					<!-- 清除按钮 -->
					<view v-if="showClear && selectedItem && !disabled" class="clear-icon-wrapper"
						@click.stop="handleClear">
						<uni-icons type="clear" size="16" color="#999"></uni-icons>
					</view>
					<!-- 下拉箭头 -->
					<uni-icons :type="iconType" size="12" :color="disabled ? '#ccc' : '#999'"></uni-icons>
				</view>
			</view>
		</view>

		<!-- 选择器弹窗 -->
		<uni-popup ref="selectorPopup" type="bottom" :safe-area="false" @maskClick="closePopup">
			<view class="selector-popup">
				<view class="popup-header">
					<text class="popup-title">{{ popupTitle }}</text>
					<uni-icons type="close" size="20" color="#999" @click="closePopup"></uni-icons>
				</view>

				<!-- 搜索区域 -->
				<view class="popup-search" v-if="showSearch">
					<!-- 物料编码搜索框 -->
					<view v-if="type === 'itemCode'" class="search-grid">
						<view class="search-input-item">
							<view class="search-box">
								<uni-icons type="search" size="18" color="#999"></uni-icons>
								<input v-model="searchCode" class="search-input" placeholder="物料编码" @input="searchData"
									placeholder-class="placeholder-style" />
								<view class="search-clear" v-if="searchCode" @click="clearSearchCode">
									<uni-icons type="clear" size="16" color="#999"></uni-icons>
								</view>
							</view>
						</view>
						<view class="search-input-item">
							<view class="search-box">
								<uni-icons type="search" size="18" color="#999"></uni-icons>
								<input v-model="searchName" class="search-input" placeholder="物料名称" @input="searchData"
									placeholder-class="placeholder-style" />
								<view class="search-clear" v-if="searchName" @click="clearSearchName">
									<uni-icons type="clear" size="16" color="#999"></uni-icons>
								</view>
							</view>
						</view>
					</view>

					<!-- 客户搜索框 -->
					<view v-else-if="type === 'customer'" class="search-grid">
						<view class="search-input-item">
							<view class="search-box">
								<uni-icons type="search" size="18" color="#999"></uni-icons>
								<input v-model="searchCode" class="search-input" placeholder="客户编码" @input="searchData"
									placeholder-class="placeholder-style" />
								<view class="search-clear" v-if="searchCode" @click="clearSearchCode">
									<uni-icons type="clear" size="16" color="#999"></uni-icons>
								</view>
							</view>
						</view>
						<view class="search-input-item">
							<view class="search-box">
								<uni-icons type="search" size="18" color="#999"></uni-icons>
								<input v-model="searchName" class="search-input" placeholder="客户名称" @input="searchData"
									placeholder-class="placeholder-style" />
								<view class="search-clear" v-if="searchName" @click="clearSearchName">
									<uni-icons type="clear" size="16" color="#999"></uni-icons>
								</view>
							</view>
						</view>
					</view>

					<!-- 供应商搜索框 -->
					<view v-else-if="type === 'supplier'" class="search-grid">
						<view class="search-input-item">
							<view class="search-box">
								<uni-icons type="search" size="18" color="#999"></uni-icons>
								<input v-model="searchCode" class="search-input" placeholder="供应商编码" @input="searchData"
									placeholder-class="placeholder-style" />
								<view class="search-clear" v-if="searchCode" @click="clearSearchCode">
									<uni-icons type="clear" size="16" color="#999"></uni-icons>
								</view>
							</view>
						</view>
						<view class="search-input-item">
							<view class="search-box">
								<uni-icons type="search" size="18" color="#999"></uni-icons>
								<input v-model="searchName" class="search-input" placeholder="供应商名称" @input="searchData"
									placeholder-class="placeholder-style" />
								<view class="search-clear" v-if="searchName" @click="clearSearchName">
									<uni-icons type="clear" size="16" color="#999"></uni-icons>
								</view>
							</view>
						</view>
					</view>

					<!-- 其他类型使用单个搜索框 -->
					<view v-else class="search-single">
						<view class="search-box">
							<uni-icons type="search" size="18" color="#999"></uni-icons>
							<input v-model="searchKeyword" class="search-input" :placeholder="searchPlaceholder"
								@input="searchData" placeholder-class="placeholder-style" />
							<view class="search-clear" v-if="searchKeyword" @click="clearSearch">
								<uni-icons type="clear" size="16" color="#999"></uni-icons>
							</view>
						</view>
					</view>
				</view>

				<!-- 列表区域 -->
				<scroll-view class="popup-content" scroll-y="true" @scrolltolower="loadMore">
					<view v-for="(item, index) in filteredList" :key="item.id || index" class="popup-item"
						:class="{ active: isItemActive(item) }" @click="selectItem(item)">
						<view class="item-content" :class="{ 'inline-display': listDisplayInline }">
							<text class="item-name">{{ getItemDisplay(item) }}</text>
							<text class="item-code" v-if="getItemCode(item)">{{ getItemCode(item) }}</text>
						</view>
						<uni-icons v-if="isItemActive(item)" type="check" size="16" color="#1677ff"></uni-icons>
					</view>

					<!-- 空状态 -->
					<view v-if="filteredList.length === 0 && !loading" class="popup-empty">
						<text class="empty-text">暂无数据</text>
					</view>

					<!-- 加载更多 -->
					<view v-if="loading" class="load-more">
						<uni-load-more status="loading" content="正在加载..."></uni-load-more>
					</view>

					<view v-if="noMore && filteredList.length > 0" class="load-more">
						<text class="no-more-text">没有更多了</text>
					</view>
				</scroll-view>
			</view>
		</uni-popup>
	</div>
</template>

<script>
	export default {
		name: 'CommonSelector',
		props: {
			// 基础配置
			type: {
				type: String,
				required: true,
				default: 'warehouse'
			},
			label: {
				type: String,
				default: ''
			},
			placeholder: {
				type: String,
				default: '请选择'
			},
			showLabel: {
				type: Boolean,
				default: true
			},

			// 值绑定
			value: {
				type: [String, Number, Object],
				default: null
			},
			parentValue: {
				type: [String, Number],
				default: null
			},

			// 状态控制
			disabled: {
				type: Boolean,
				default: false
			},
			requireParent: {
				type: Boolean,
				default: false
			},

			// 数据源配置
			dataSource: {
				type: Array,
				default: () => []
			},
			apiUrl: {
				type: String,
				default: ''
			},
			apiParams: {
				type: Object,
				default: () => ({})
			},

			// 显示配置
			displayField: {
				type: String,
				default: 'name'
			},
			codeField: {
				type: String,
				default: 'code'
			},
			descField: {
				type: String,
				default: 'desc'
			},
			valueField: {
				type: String,
				default: 'id'
			},

			// 搜索配置
			showSearch: {
				type: Boolean,
				default: true
			},
			searchPlaceholder: {
				type: String,
				default: '搜索...'
			},
			searchFields: {
				type: Array,
				default: () => ['name', 'code']
			},

			// 分页配置
			pageSize: {
				type: Number,
				default: 20
			},

			// 图标配置
			iconType: {
				type: String,
				default: 'arrowdown'
			},

			// 清除按钮配置
			showClear: {
				type: Boolean,
				default: true
			},
			clearIconType: {
				type: String,
				default: 'clear'
			},
			clearIconColor: {
				type: String,
				default: '#999'
			},

			// 新增：宽度控制配置
			fullWidth: {
				type: Boolean,
				default: true
			},

			// 显示选中项的编码
			showSelectedCode: {
				type: Boolean,
				default: false
			},

			// 编码显示位置
			codePosition: {
				type: String,
				default: 'right', // 'right' | 'bottom'
				validator: (value) => ['right', 'bottom'].includes(value)
			},

			// 列表显示方式
			listDisplayInline: {
				type: Boolean,
				default: false
			},

			// 外部容器类名
			wrapperClass: {
				type: String,
				default: ''
			}
		},

		data() {
			return {
				// 弹窗相关
				isPopupOpen: false,
				popupTitle: '',
				searchKeyword: '',
				searchCode: '',
				searchName: '',

				// 数据相关
				list: [],
				filteredList: [],
				loading: false,
				pageNo: 1,
				noMore: false,

				// 选中项
				selectedItem: null,

				// 缓存相关
				dataCache: new Map(),
				cachedParams: null,

				// 搜索模式标记
				isSearching: false,

				// 定时器
				searchTimer: null
			}
		},

		computed: {
			// 选中的显示值
			selectedValue() {
				if (this.selectedItem) {
					return this.getItemDisplay(this.selectedItem);
				}
				return this.placeholder;
			},

			// 是否显示双搜索框
			showDoubleSearch() {
				return this.showSearch && (this.type === 'itemCode' || this.type === 'customer' || this.type ===
					'supplier');
			},

			// 容器类名
			containerClass() {
				const classes = {};
				if (this.showSelectedCode && this.codePosition === 'bottom') {
					classes['code-bottom'] = true;
				}
				return classes;
			}
		},

		watch: {
			value: {
				immediate: true,
				handler(newVal) {
					this.findSelectedItem(newVal);
				}
			},

			parentValue: {
				handler(newVal) {
					if (this.requireParent && !newVal) {
						this.clearSelection();
					} else if (newVal && (this.type === 'district' || this.type === 'storage')) {
						// 父级值变化时，清除缓存并重新加载
						this.clearCache();
						this.loadData();
					}
				}
			},

			dataSource: {
				immediate: true,
				handler(newVal) {
					if (newVal && newVal.length > 0) {
						this.list = newVal;
						this.filteredList = newVal;
						this.findSelectedItem(this.value);
					}
				}
			}
		},

		mounted() {
			this.initPopupTitle();
		},

		methods: {
			// 初始化弹窗标题
			initPopupTitle() {
				const titleMap = {
					warehouse: '选择仓库',
					district: '选择库区',
					storage: '选择库位',
					itemCode: '选择物料编码',
					customer: '选择客户',
					supplier: '选择供应商',
					status: '选择库存状态'
				};
				this.popupTitle = titleMap[this.type] || '选择';
			},

			// 点击选择框
			handleClick() {
				if (this.disabled) return;
				if (this.requireParent && !this.parentValue) {
					this.$emit('needParent');
					return;
				}

				this.openPopup();
			},

			// 点击清除按钮
			handleClear(e) {
				e.stopPropagation(); // 阻止事件冒泡
				if (this.disabled) return;

				// 清除选中项
				this.selectedItem = null;

				// 触发事件，传递null值
				this.$emit('input', null);
				this.$emit('change', null);
				this.$emit('clear'); // 新增clear事件

				// 清除搜索条件
				this.searchKeyword = '';
				this.searchCode = '';
				this.searchName = '';

				// 重置列表显示
				if (this.list.length > 0) {
					this.filteredList = [...this.list];
				}

				// 清除缓存
				this.clearCache();
			},

			// 打开弹窗
			async openPopup() {
				if (this.isPopupOpen) return;

				this.isPopupOpen = true;
				this.searchKeyword = ''; // 重置搜索关键词
				this.searchCode = '';
				this.searchName = '';
				this.isSearching = false;

				// 检查是否有缓存数据可用
				const cacheKey = this.buildCacheKey();
				const hasCache = this.dataCache.has(cacheKey);

				// 如果已经有缓存数据且参数没变化，直接使用缓存
				if (hasCache && this.areParamsSame(this.cachedParams, this.getCurrentParams())) {
					this.list = [...this.dataCache.get(cacheKey)];
					this.filteredList = [...this.list];
					this.findSelectedItem(this.value);
				} else {
					// 否则重新加载数据
					await this.loadData(true);
				}

				setTimeout(() => {
					if (this.$refs.selectorPopup) {
						this.$refs.selectorPopup.open();
					}
				}, 100);
			},

			// 关闭弹窗
			closePopup() {
				if (this.$refs.selectorPopup) {
					this.$refs.selectorPopup.close();
				}
				this.isPopupOpen = false;
				this.isSearching = false;
			},

			// 构建缓存key
			buildCacheKey() {
				const keyParts = [
					this.type,
					this.parentValue || '',
					this.searchKeyword || '',
					this.searchCode || '',
					this.searchName || '',
					JSON.stringify(this.apiParams)
				];
				return keyParts.join('|');
			},

			// 获取当前参数
			getCurrentParams() {
				return {
					type: this.type,
					parentValue: this.parentValue,
					searchKeyword: this.searchKeyword,
					searchCode: this.searchCode,
					searchName: this.searchName,
					apiParams: this.apiParams,
					isSearching: this.isSearching
				};
			},

			// 比较参数是否相同
			areParamsSame(oldParams, newParams) {
				if (!oldParams || !newParams) return false;
				return (
					oldParams.type === newParams.type &&
					oldParams.parentValue === newParams.parentValue &&
					oldParams.searchKeyword === newParams.searchKeyword &&
					oldParams.searchCode === newParams.searchCode &&
					oldParams.searchName === newParams.searchName &&
					oldParams.isSearching === newParams.isSearching &&
					JSON.stringify(oldParams.apiParams) === JSON.stringify(newParams.apiParams)
				);
			},

			// 清空搜索
			clearSearch() {
				this.searchKeyword = '';
				this.isSearching = false;
				this.searchData();
			},

			// 清空编码搜索
			clearSearchCode() {
				this.searchCode = '';
				this.searchData();
			},

			// 清空名称搜索
			clearSearchName() {
				this.searchName = '';
				this.searchData();
			},

			// 加载数据
			async loadData(resetPage = true) {
				if (this.loading) return;

				this.loading = true;

				if (resetPage) {
					this.pageNo = 1;
					this.noMore = false;
				}

				try {
					let data = [];

					// 如果有数据源，直接使用（适用于status等静态数据）
					if (this.dataSource && this.dataSource.length > 0) {
						data = this.dataSource;
						this.list = data;
						this.filteredList = [...data];
						this.findSelectedItem(this.value);
						return;
					}

					// 如果有API接口，调用接口获取数据
					if (this.apiUrl) {
						// 构建请求参数
						let params = {
							...this.apiParams,
							pageNo: this.pageNo,
							pageSize: this.pageSize
						};

						// 根据类型添加特定参数
						if ((this.type === 'district' || this.type === 'storage') && this.parentValue) {
							params.id = this.parentValue;
						}

						// 处理搜索条件（根据类型配置不同的搜索字段）
						if (this.showSearch) {
							// 标记当前是搜索状态
							this.isSearching = false;

							// 根据类型设置不同的搜索参数
							switch (this.type) {
								case 'itemCode':
									// 物料编码：编码/名称搜索
									if (this.searchCode) {
										params.itemCode = this.searchCode;
										this.isSearching = true;
									}
									if (this.searchName) {
										params.itemName = this.searchName;
										this.isSearching = true;
									}
									break;
								case 'customer':
									// 客户：编码/名称搜索
									if (this.searchCode) {
										params.custCode = this.searchCode;
										this.isSearching = true;
									}
									if (this.searchName) {
										params.customer = this.searchName;
										this.isSearching = true;
									}
									break;
								case 'supplier':
									// 供应商：编码/名称搜索
									if (this.searchCode) {
										params.supplierCode = this.searchCode;
										this.isSearching = true;
									}
									if (this.searchName) {
										params.supplierName = this.searchName;
										this.isSearching = true;
									}
									break;
								default:
									// 其他类型使用单个搜索框
									if (this.searchKeyword) {
										params.keyWord = this.searchKeyword;
										this.isSearching = true;
									}
							}
						}

						// 如果任何搜索条件存在，标记为搜索状态
						if (this.searchKeyword || this.searchCode || this.searchName) {
							this.isSearching = true;
						}

						const response = await this.$request({
							url: this.apiUrl,
							method: "GET",
							data: params,
						});

						if (response.data && response.data.success) {
							const result = response.data.result;
							data = result.records || result || [];

							// 格式化数据
							data = data.map(item => this.formatItem(item));

							if (this.pageNo === 1) {
								this.list = data;
								// 缓存第一页数据
								this.dataCache.set(this.buildCacheKey(), [...data]);
							} else {
								this.list = [...this.list, ...data];
								// 更新缓存
								const cacheKey = this.buildCacheKey();
								const cached = this.dataCache.get(cacheKey) || [];
								this.dataCache.set(cacheKey, [...cached, ...data]);
							}

							this.filteredList = [...this.list];
							this.cachedParams = this.getCurrentParams();
							this.findSelectedItem(this.value);

							if (data.length < this.pageSize) {
								this.noMore = true;
							}
						}
					}

				} catch (error) {
					console.error(`加载${this.type}数据失败:`, error);
				} finally {
					this.loading = false;
				}
			},

			// 格式化数据项
			formatItem(item) {
				switch (this.type) {
					case 'warehouse':
					case 'district':
					case 'storage':
						return {
							...item,
							name: item.areaName || item.name || '',
								code: item.areaSn || item.code || '',
								desc: item.areaDesc || item.desc || ''
						};
					case 'itemCode':
						return {
							...item,
							name: item.itemName || item.name || '',
								code: item.itemCode || item.code || '',
								desc: item.itemSpec || item.desc || ''
						};
					case 'customer':
						return {
							...item,
							name: item.customer || item.name || '',
								code: item.custCode || item.code || '',
								desc: item.custAbbreviation || item.desc || ''
						};
					case 'supplier':
						return {
							...item,
							name: item.supplierName || item.name || '',
								code: item.supplierCode || item.code || '',
								desc: item.supplierShortname || item.desc || ''
						};
					case 'status':
						return {
							...item,
							name: item.name || '',
								code: item.code || '',
								desc: item.desc || ''
						};
					default:
						return item;
				}
			},

			// 搜索数据
			searchData() {
				clearTimeout(this.searchTimer);

				this.searchTimer = setTimeout(async () => {
					// 检查是否有搜索条件
					const hasSearchCondition = this.searchKeyword || this.searchCode || this.searchName;

					if (!hasSearchCondition) {
						// 清空搜索时，重置为初始数据
						this.isSearching = false;
						await this.loadData(true);
						return;
					}

					// 对于有API接口的类型，调用接口进行搜索
					if (this.apiUrl && this.showSearch) {
						// 调用接口搜索
						await this.loadData(true);
					} else {
						// 对于静态数据，进行本地筛选
						const keyword = this.searchKeyword.toLowerCase();
						this.filteredList = this.list.filter(item => {
							return this.searchFields.some(field => {
								const fieldValue = item[field];
								return fieldValue && fieldValue.toString().toLowerCase()
									.indexOf(
										keyword) !== -1;
							});
						});
					}
				}, 500); // 增加防抖时间，避免频繁请求
			},

			// 加载更多
			async loadMore() {
				if (this.loading || this.noMore || !this.apiUrl) return;

				this.pageNo++;
				await this.loadData(false);
			},

			// 获取项目显示文本
			getItemDisplay(item) {
				if (!item) return '';
				return item.name || item[this.displayField] || '';
			},

			// 获取项目编码
			getItemCode(item) {
				if (!item) return '';
				return item.code || item[this.codeField] || '';
			},

			// 获取项目描述
			getItemDesc(item) {
				if (!item) return '';
				return item.desc || item[this.descField] || '';
			},

			// 查找选中的项目
			findSelectedItem(value) {
				if (!value) {
					this.selectedItem = null;
					return;
				}

				// 如果是对象，直接设置
				if (typeof value === 'object') {
					this.selectedItem = value;
					return;
				}

				// 如果是值，在列表中查找
				const found = this.list.find(item => {
					const itemId = item.id || item[this.valueField];
					return itemId === value;
				});

				this.selectedItem = found || null;
			},

			// 检查项目是否激活
			isItemActive(item) {
				if (!this.selectedItem) return false;

				const itemId = item.id || item[this.valueField];
				const selectedId = this.selectedItem.id || this.selectedItem[this.valueField];

				return itemId === selectedId;
			},

			// 选择项目
			selectItem(item) {
				this.selectedItem = item;

				// 根据类型返回不同的值格式
				let value;
				switch (this.type) {
					case 'warehouse':
					case 'district':
					case 'storage':
						value = {
							id: item.id,
							name: item.areaName || item.name,
							code: item.areaSn || item.code
						};
						break;
					case 'itemCode':
						value = {
							id: item.id,
							name: item.itemName || item.name,
							code: item.itemCode || item.code
						};
						break;
					case 'customer':
						value = {
							id: item.id,
							name: item.customer || item.name,
							code: item.custCode || item.code
						};
						break;
					case 'supplier':
						value = {
							id: item.id,
							name: item.supplierName || item.name,
							code: item.supplierCode || item.code
						};
						break;
					case 'status':
						value = {
							id: item.id,
							name: item.name,
							code: item.code
						};
						break;
					default:
						value = item;
				}

				this.$emit('input', value);
				this.$emit('change', value);
				this.closePopup();
			},

			// 清空选择
			clearSelection() {
				this.selectedItem = null;
				this.$emit('input', null);
				this.$emit('change', null);
			},

			// 清空缓存
			clearCache() {
				this.dataCache.clear();
				this.cachedParams = null;
				this.list = [];
				this.filteredList = [];
				this.selectedItem = null;
				this.searchKeyword = '';
				this.searchCode = '';
				this.searchName = '';
				this.isSearching = false;
			}
		}
	}
</script>

<style lang="scss" scoped>
	.common-selector {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;

		.selector-box {
			width: 100%;
			min-width: 0;
			max-width: 100%;
			height: 80rpx;
			background: #f8f9fa;
			border-radius: 8rpx;
			border: 1rpx solid #e9ecef;
			box-sizing: border-box;
			padding: 0 24rpx;
			overflow: hidden;

			&.full-width {
				width: 100%;
			}

			&:not(.full-width) {
				width: auto;
			}

			&.disabled {
				opacity: 0.5;
				background: #f0f0f0;
			}

			.selector-content {
				display: flex;
				align-items: center;
				height: 100%;
				width: 100%;
				min-width: 0;
				overflow: hidden;
				gap: 8rpx;
				position: relative;

				.selector-label {
					font-size: 26rpx;
					color: #333;
					flex-shrink: 0;
					white-space: nowrap;
					max-width: 80rpx;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.selector-value-container {
					flex: 1;
					min-width: 0;
					display: flex;
					flex-direction: row;
					align-items: center;
					overflow: hidden;

					&.code-bottom {
						flex-direction: column;
						align-items: flex-start;
						justify-content: center;

						.value-text-wrapper {
							flex-direction: column;
							align-items: flex-start;
							width: 100%;
						}
					}

					.value-text-wrapper {
						display: flex;
						align-items: center;
						min-width: 0;
						flex: 1;
						overflow: hidden;

						.selector-value {
							flex: 1;
							min-width: 0;
						}

						.selector-code {
							flex-shrink: 0;
							max-width: 120rpx;
						}
					}
				}

				.selector-value {
					font-size: 26rpx;
					color: #333;
					display: block;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					line-height: 1.4;
					min-width: 0;

					&.placeholder {
						color: #999;
					}
				}

				.selector-code {
					font-size: 22rpx;
					color: #666;
					margin-left: 8rpx;
					flex-shrink: 0;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;

					.code-bottom & {
						margin-left: 0;
						margin-top: 2rpx;
						width: 100%;
						max-width: 100%;
					}
				}

				// 图标区域样式
				.selector-icons {
					display: flex;
					align-items: center;
					gap: 8rpx;
					flex-shrink: 0;

					.clear-icon-wrapper {
						padding: 6rpx;
						border-radius: 50%;
						background: #f0f0f0;
						display: flex;
						align-items: center;
						justify-content: center;
						transition: background-color 0.2s;
					}

					.clear-icon-wrapper:active {
						background: #e0e0e0;
					}
				}
			}
		}

		.selector-popup {
			background: #fff;
			border-radius: 24rpx 24rpx 0 0;
			max-height: 90vh;

			.popup-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 28rpx 32rpx;
				border-bottom: 1rpx solid #e5e5e5;

				.popup-title {
					font-size: 32rpx;
					font-weight: 600;
					color: #333;
				}
			}

			.popup-search {
				padding: 0 32rpx 20rpx;

				.search-grid {
					display: flex;
					gap: 16rpx;
					margin-bottom: 16rpx;

					.search-input-item {
						flex: 1;
					}
				}

				.search-single {
					.search-box {
						display: flex;
						align-items: center;
						background: #f8f9fa;
						border-radius: 8rpx;
						padding: 16rpx 20rpx;
						border: 1rpx solid #e9ecef;

						.search-input {
							flex: 1;
							font-size: 26rpx;
							color: #333;
							margin: 0 16rpx;
							min-width: 0;
						}

						.placeholder-style {
							color: #999;
							font-size: 26rpx;
						}

						.search-clear {
							padding: 6rpx;
							border-radius: 50%;
							background: #f0f0f0;
							flex-shrink: 0;
						}
					}
				}

				.search-box {
					display: flex;
					align-items: center;
					background: #f8f9fa;
					border-radius: 8rpx;
					padding: 16rpx 20rpx;
					border: 1rpx solid #e9ecef;

					.search-input {
						flex: 1;
						font-size: 26rpx;
						color: #333;
						margin: 0 16rpx;
						min-width: 0;
					}

					.placeholder-style {
						color: #999;
						font-size: 26rpx;
					}

					.search-clear {
						padding: 6rpx;
						border-radius: 50%;
						background: #f0f0f0;
						flex-shrink: 0;
					}
				}
			}

			.popup-content {
				padding: 0 32rpx;
				height: 50vh;

				.popup-item {
					display: flex;
					align-items: center;
					padding: 24rpx 0;
					border-bottom: 1rpx solid #f0f0f0;
					min-height: 80rpx;
					box-sizing: border-box;
					overflow: hidden;

					.item-content {
						flex: 1;
						display: flex;
						flex-direction: column;
						min-width: 0;
						overflow: hidden;

						&.inline-display {
							flex-direction: row;
							align-items: center;
							gap: 8rpx;
						}

						.item-name {
							font-size: 26rpx;
							color: #333;
							font-weight: 500;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
							width: 100%;
							display: block;

							.inline-display & {
								flex: 1;
							}
						}

						.item-code {
							font-size: 22rpx;
							color: #666;
							margin-top: 4rpx;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
							width: 100%;
							display: block;

							.inline-display & {
								margin-top: 0;
								flex-shrink: 0;
								max-width: 120rpx;
							}
						}
					}

					&.active {
						background-color: rgba(22, 119, 255, 0.05);
						border-radius: 8rpx;
						padding: 20rpx;
						margin: 0 -20rpx;

						.item-name {
							color: #1677ff;
						}
					}
				}

				.popup-empty {
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 60rpx 0;

					.empty-text {
						font-size: 26rpx;
						color: #999;
					}
				}

				.load-more {
					padding: 32rpx 0;
					text-align: center;

					.no-more-text {
						font-size: 24rpx;
						color: #999;
					}
				}
			}
		}
	}
</style>