"use strict";
const utils_request = require("../utils/request.js");
function getCaptcha() {
  return utils_request.request({
    url: "/api/captcha/get",
    method: "get"
  });
}
function verifyCaptcha(data) {
  return utils_request.request({
    url: "/api/captcha/verify",
    method: "post",
    data
  });
}
exports.getCaptcha = getCaptcha;
exports.verifyCaptcha = verifyCaptcha;
//# sourceMappingURL=../../.sourcemap/mp-weixin/api/captcha.js.map
