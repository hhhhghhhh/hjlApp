import Vue from 'vue'
import App from './App'
import {   generateParams } from "./utils/utils.js";

import {
	request
} from 'utils/request.js'
Vue.prototype.$request = request

import store from "./store/index.js"
Vue.prototype.$store = store;

import utils from "utils/utils.js"
Vue.prototype.$utils = utils;

Vue.config.productionTip = false

uni.$toPath = async function (path, query = {}) {
  if (!path) {
    console.log("没有指定路径");
    return;
  }
  const isToken = uni.getStorageSync("token");
  if (isToken) {
    var url = generateParams(query) ? path + "?" + generateParams(query) : path;
    console.log(url);
    uni.navigateTo({
      url: url,
    });
  } else {
    uni.reLaunch({
      url: "/pages/login/login",
    });
  }
};


App.mpType = 'app'

const app = new Vue({
	...App
})
app.$mount()
