import { request } from "@/utils/request";

export function getCaptcha() {
  return request({
    url: "/api/captcha/get",
    method: "get"
  });
}

export function verifyCaptcha(data) {
  return request({
    url: "/api/captcha/verify",
    method: "post",
    data
  });
}

export function checkVerifyToken(verifyToken) {
  return request({
    url: "/api/captcha/check",
    method: "post",
    data: { verifyToken }
  });
}
