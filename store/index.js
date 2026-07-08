import Vue from "vue"
import Vuex from "vuex"

import returnGoods from '@/store/modules/returnGoods.js'
Vue.use(Vuex)
export default new Vuex.Store({
	modules:{
		returnGoods
	},
	// 全局属性变量
	state: { // 定义属性变量
		// num: 0,
		// price: 10,
		// name: "苹果",
		 
	},
	// 全局同步方法，method[this.$store.commit("add")]
	mutations: {
		// add(state) {
		// 	state.num++;
		// },
		// down(state) {
		// 	state.num--;
		// }
	}
})