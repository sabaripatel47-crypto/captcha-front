"use strict";
const common_vendor = require("../common/vendor.js");
const BASE_URL = "http://192.168.3.100:8080";
function request(options) {
  return new Promise((resolve, reject) => {
    common_vendor.index.request({
      url: BASE_URL + options.url,
      //请求地址
      method: options.method || "GET",
      //请求方式(默认get)
      data: options.data || {},
      //请求传参
      header: {
        //请求头
        "Content-Type": "application/json"
        //请求头类型
      },
      success: (res) => resolve(res.data),
      //请求成功回调
      fail: (err) => reject(err)
      //请求失败回调
    });
  });
}
exports.request = request;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/request.js.map
