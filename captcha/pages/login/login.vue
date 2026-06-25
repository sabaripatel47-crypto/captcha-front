<template>
  <view class="login-page">
    <view class="login-card">
        <!-- 顶部区域 -->
      <view class="login-header">
        <text class="login-title">用户登录</text>
      </view>
      <!-- 下方登录区域 -->
      <view class="login-form">
        <!-- 用户名输入框 -->
        <view class="form-item">
          <text class="form-label">用户名</text>
          <input
            class="form-input"
            v-model="form.username"
            placeholder="请输入用户名"
            placeholder-class="input-placeholder"
          />
        </view>

        <!-- 密码输入框 -->
        <view class="form-item">
          <text class="form-label">密码</text>
          <input
            class="form-input"
            v-model="form.password"
            placeholder="请输入密码"
            placeholder-class="input-placeholder"
          />
        </view>

        <button class="login-btn" @click="handleLogin" :disabled="logging">
          <text v-if="logging">验证中...</text>
          <text v-else>登录</text>
        </button>
      </view>
    </view>
    <!-- 验证码组件 -->
    <CaptchaSlider
      :visible="captchaVisible"
      @success="onCaptchaSuccess"
      @close="onCaptchaClose"
    />
  </view>
</template>

<script>
import CaptchaSlider from "@/components/CaptchaSlider/CaptchaSlider.vue";
import { login } from "@/api/user.js";

export default {
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
      if (this.logging) return;//防抖
      //用户名不能为空
      if (!this.form.username.trim()) {
        uni.showToast({ title: "请输入用户名", icon: "none" });
        return;
      }
      //密码不能为空
      if (!this.form.password) {
        uni.showToast({ title: "请输入密码", icon: "none" });
        return;
      }
      //验证码为空的时候打开验证码校验组件
      if (!this.verifyToken) {
        this.captchaVisible = true;
        return;
      }
    },

    // 发起登录请求
    async doLogin() {
      this.logging = true;

      try {
        //调用登录接口
        const res = await login({
          username: this.form.username,
          password: this.form.password,
          verifyToken: this.verifyToken
        });

        if (res.code === 200 && res.data) {
          //存储token和用户名到本地
          uni.setStorageSync("token", res.data.token);
          uni.setStorageSync("username", res.data.username);
          uni.showToast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            uni.navigateBack();//返回上一页(登录之前的那一页)
          }, 1000);
        } else {
          uni.showToast({ title: res.message || "登录失败", icon: "none" });
          if(res.message && res.message.includes("验证码")) {
            this.verifyToken = "";//清空token
            this.captchaVisible = true;//打开验证码组件
          }
        }
      } catch (e) {
        uni.showToast({ title: "网络错误", icon: "none" });
      } finally {
        this.logging = false;
      }
    },
    // 验证码验证成功
    onCaptchaSuccess(token) {
      this.verifyToken = token;//赋值新的token
      this.captchaVisible = false;//关闭验证码组件
      this.doLogin();//调用登录接口
    },
    //验证码组件关闭
    onCaptchaClose() {
      this.captchaVisible = false;
    }
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 380px;
  padding: 30px 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-title {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #333;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  position: relative;
}

.form-label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  color: #333;
  box-sizing: border-box;
  background: #fafafa;
  outline: none;
}

.form-input:focus {
  border-color: #667eea;
  background: #fff;
}

.input-placeholder {
  color: #bbb;
}


.login-btn {
  width: 100%;
  height: 46px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 23px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

.login-btn[disabled] {
  opacity: 0.7;
}


</style>
