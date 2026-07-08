// src/api/mesApi.js
import {
	request
} from "@/utils/request.js";

/**
 * 获取工作中心列表（分页）
 */
export function getWorkCenterList(data) {
  return request({
    url: "/mes/wipTrackingLot/queryAreaPage",
    method: "GET",
    data: data,
  });
}

/**
 * 获取工单列表（分页）
 */
export function getMoList(data) {
  return request({
    url: "/mes/wipTrackingLot/queryPmMoBasePage",
    method: "GET",
    data: data,
  });
}

/**
 * SN报工保存
 */
export function savePassSn(data) {
  return request({
    url: "/api/pda/pdaProduction/passSaveSnAct",
    method: "get",
    data: data,
  });
}

// 在线工单列表
export function getOnlineMoList(data) {
  return request({
    url: "/mes/pmMoOnline/listByPage",
    method: "GET",
    data: data,
  });
}

// 工序列表
export function getProcessList(data) {
  return request({
    url: "/mes/wipTrackingLot/getGroupInfo",
    method: "GET",
    data: data,
  });
}

// 人员列表
export function getUserList(data) {
  return request({
    url: "/sys/user/listByProd",
    method: "GET",
    data: data,
  });
}


// 批次报工工作中心列表
export function batchGetWorkCenterList(data) {
  return request({
    url: "/mes/wipTrackingLot/getWork",
    method: "GET",
    data: data,
  });
}

// 保存批次报工
export function saveBatchReport(data) {
  return request({
    url: "/api/pda/pdaProduction/doInsertTrackingLot",
    method: "GET",
    data: data,
  });
}
