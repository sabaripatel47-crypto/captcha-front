import { request } from "@/utils/request";
//获取验证码
export function getCaptcha() {
  return request({
    url: "/api/captcha/get",
    method: "get"
  });
}
//校验验证码
export function verifyCaptcha(data) {
  return request({
    url: "/api/captcha/verify",
    method: "post",
    data
  });
}
