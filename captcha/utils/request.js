const BASE_URL = "http://192.168.3.100:8080";

export function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "Content-Type": "application/json"
      },
      success: res => resolve(res.data),
      fail: err => reject(err)
    });
  });
}