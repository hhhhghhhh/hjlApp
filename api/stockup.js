import { request } from "@/utils/request.js";

export function getPutWarehouseIds(data) {
  return request({
    url: `/wms/warehouse/getPutWarehouseIds?id=${data.id}`,
    method: "POST",
  });
}

/**
 * 根据code获取库位
 * @param {*} data
 */
export function getWarehouseBinByCodeApi(data) {
  return request({
    url: `/wms/warehouseBin/getWarehouseBinByCode`,
    method: "GET",
    data,
  });
}
