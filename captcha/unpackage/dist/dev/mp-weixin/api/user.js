"use strict";
const utils_request = require("../utils/request.js");
function login(data) {
  return utils_request.request({
    url: "/api/user/login",
    method: "post",
    data
  });
}
exports.login = login;
//# sourceMappingURL=../../.sourcemap/mp-weixin/api/user.js.map
