import { request } from "@/utils/request";

// 测试接口
export function login(params) {
  return request({
    url: "/hello",
    method: "get",
    data: params
  });
}