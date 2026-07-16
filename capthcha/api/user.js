import { request } from "@/utils/request";

export function login(data) {
  return request({
    url: "/api/user/login",
    method: "post",
    data
  });
}

export function getUserInfo() {
  return request({
    url: "/api/user/info",
    method: "get"
  });
}
