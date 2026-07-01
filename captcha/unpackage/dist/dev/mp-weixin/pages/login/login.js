"use strict";
const common_vendor = require("../../common/vendor.js");
const api_user = require("../../api/user.js");
const CaptchaSlider = () => "../../components/CaptchaSlider/CaptchaSlider.js";
const _sfc_main = {
  components: {
    CaptchaSlider
  },
  data() {
    return {
      form: {
        username: "",
        password: ""
      },
      verifyToken: "",
      showPassword: false,
      logging: false,
      captchaVisible: false
    };
  },
  methods: {
    // 登录按钮
    async handleLogin() {
      if (this.logging)
        return;
      common_vendor.index.__f__("log", "at pages/login/login.vue:81", "执行登录操作", this.verifyToken);
      if (!this.verifyToken) {
        this.captchaVisible = true;
        return;
      }
    },
    // 发起登录请求
    async doLogin() {
      this.logging = true;
      try {
        const res = await api_user.login({
          username: this.form.username,
          password: this.form.password,
          verifyToken: this.verifyToken
        });
        common_vendor.index.__f__("log", "at pages/login/login.vue:100", "登录结果", res);
        if (res.code === 200 && res.data) {
          common_vendor.index.setStorageSync("token", res.data.token);
          common_vendor.index.setStorageSync("username", res.data.username);
          common_vendor.index.showToast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            common_vendor.index.navigateBack();
          }, 1e3);
        } else {
          common_vendor.index.__f__("log", "at pages/login/login.vue:110", "登录失败", res);
          common_vendor.index.showToast({ title: res.message || "登录失败", icon: "none" });
          if (res.message) {
            this.logging = false;
            this.verifyToken = "";
            this.captchaVisible = false;
          }
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "网络错误", icon: "none" });
      } finally {
        this.logging = false;
      }
    },
    // 验证码验证成功
    onCaptchaSuccess(token) {
      this.verifyToken = token;
      this.captchaVisible = false;
      this.doLogin();
    },
    //验证码组件关闭
    onCaptchaClose() {
      this.captchaVisible = false;
    }
  }
};
if (!Array) {
  const _easycom_CaptchaSlider2 = common_vendor.resolveComponent("CaptchaSlider");
  _easycom_CaptchaSlider2();
}
const _easycom_CaptchaSlider = () => "../../components/CaptchaSlider/CaptchaSlider.js";
if (!Math) {
  _easycom_CaptchaSlider();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.form.username,
    b: common_vendor.o(($event) => $data.form.username = $event.detail.value, "83"),
    c: $data.form.password,
    d: common_vendor.o(($event) => $data.form.password = $event.detail.value, "bf"),
    e: $data.logging
  }, $data.logging ? {} : {}, {
    f: common_vendor.o((...args) => $options.handleLogin && $options.handleLogin(...args), "f9"),
    g: $data.logging,
    h: common_vendor.o($options.onCaptchaSuccess, "0b"),
    i: common_vendor.o($options.onCaptchaClose, "4a"),
    j: common_vendor.p({
      visible: $data.captchaVisible
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-e4e4508d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/login/login.js.map
