<template>
  <view class="page">
    <view class="card">
      <text class="title">滑动验证码演示</text>
      <text class="desc">点击下方按钮触发安全验证</text>

      <button class="primary-btn" @click="handleOpen">触发验证码</button>

      <view v-if="result" class="result" :class="resultType">
        <text>{{ result }}</text>
      </view>
    </view>

    <CaptchaSlider
      :visible="captchaVisible"
      @update:visible="(v: boolean) => (captchaVisible = v)"
      @success="handleSuccess"
      @close="handleClose"
    />
  </view>
</template>

<script setup lang="ts">
import CaptchaSlider from '@/components/CaptchaSlider/CaptchaSlider.vue';
import { ref } from 'vue';
//验证码组件显示
const captchaVisible = ref(false);
//验证码提示内容
const result = ref('');
//验证码提示内容类型(成功/失败)
const resultType = ref('');
// 打开验证码组件
const handleOpen = () => {
  result.value = '';
  resultType.value = '';
  captchaVisible.value = true;
};
// 验证码验证成功
const handleSuccess = (data: any) => {
  result.value = '验证成功！';
  resultType.value = 'success';
  console.log('verify success', data);
};
//关闭验证码组件
const handleClose = () => {
  captchaVisible.value = false;
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  box-sizing: border-box;
}

.card {
  width: 100%;
  max-width: 640rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 60rpx 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title {
  font-size: 40rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16rpx;
}

.desc {
  font-size: 28rpx;
  color: #888;
  margin-bottom: 56rpx;
}

.primary-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #4f8cff, #2b6cf6);
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 44rpx;
  border: none;
  box-shadow: 0 6rpx 16rpx rgba(43, 108, 246, 0.3);
}

.primary-btn::after {
  border: none;
}

.result {
  margin-top: 40rpx;
  padding: 24rpx 32rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}

.result.success {
  background: #e8f7ee;
  color: #2ea44f;
}

.result.fail {
  background: #fdecec;
  color: #d93025;
}
</style>