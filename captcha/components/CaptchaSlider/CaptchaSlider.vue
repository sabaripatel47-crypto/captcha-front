<template>
  <view class="captcha-container" v-if="visible">
    <view class="captcha-box">
      <view class="captcha-header">
        <text class="captcha-title">安全验证</text>
        <text class="captcha-tip">拖动滑块完成拼图</text>
        <view class="captcha-close" @click="handleClose">
          <text class="close-icon">×</text>
        </view>
      </view>
	<!-- 验证码区域部分 -->
      <view class="captcha-body">
		  <!-- 底图图片 -->
        <canvas
          class="captcha-canvas"
          canvas-id="captchaCanvas"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        ></canvas>
		<!-- 图片上方的遮罩 -->
        <canvas
          class="captcha-canvas-overlay"
          canvas-id="captchaOverlayCanvas"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        ></canvas>

        <view class="captcha-loading" v-if="loading">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>

        <view class="captcha-refresh" v-if="!loading && imageLoaded" @click="refresh">
          <text class="refresh-icon">↻</text>
        </view>
      </view>
	<!-- 下方滚动容器 -->
      <view class="slider-container">
        <view class="slider-track">
          <view class="slider-progress" :style="{ width: sliderX + 40 + 'px' }"></view>
          <view
            class="slider-thumb"
            :style="{ left: sliderX + 'px' }"
            @touchstart="onThumbTouchStart"
            @touchmove.prevent="onThumbTouchMove"
            @touchend="onThumbTouchEnd"
          >
            <text class="thumb-icon">→</text>
          </view>
        </view>
        <text class="slider-hint">拖动滑块完成验证</text>
      </view>

      <view class="captcha-message" :class="messageType" v-if="message">
        <text>{{ message }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getCaptcha, verifyCaptcha } from "@/api/captcha.js";

export default {
  name: "CaptchaSlider",
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    onSuccess: {
      type: Function,
      default: null
    },
    onClose: {
      type: Function,
      default: null
    }
  },
  data() {
    return {
      canvasWidth: 320,
      canvasHeight: 180,
      captchaId: "",
      imageBase64: "",
      imageLoaded: false,
      loading: true,

      sliderX: 0,
      startX: 0,
      isDragging: false,

      track: [],
      trackStartTime: 0,

      message: "",
      messageType: "",

      maxSliderX: 0,
      cachedThumbX: 0
    };
  },
  watch: {
    visible(val) {
      if (val) {
        this.reset();
        this.fetchCaptcha();
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.initCanvas();
    });
  },
  methods: {
    reset() {
      this.sliderX = 0;
      this.track = [];
      this.message = "";
      this.messageType = "";
      this.loading = true;
      this.imageLoaded = false;
      this.isDragging = false;
      this.captchaId = "";
      this.imageBase64 = "";
      this.clearCanvas();
    },

    initCanvas() {
      const query = uni.createSelectorQuery().in(this);
      query.select('.captcha-canvas').boundingClientRect(rect => {
        if (rect) {
          this.canvasWidth = rect.width;
          this.canvasHeight = rect.height;
        }
      }).exec();
    },

    clearCanvas() {
      const ctx = uni.createCanvasContext('captchaCanvas', this);
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx.draw();

      const ctx2 = uni.createCanvasContext('captchaOverlayCanvas', this);
      ctx2.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx2.draw();
    },

    async fetchCaptcha() {
      try {
        this.loading = true;
        this.message = "";

        const res = await getCaptcha();

        if (res.code === 200 && res.data) {
          this.captchaId = res.data.captchaId;
          this.imageBase64 = res.data.imageBase64;
          await this.loadImage(this.imageBase64);
        } else {
          this.showMessage("获取验证码失败: " + (res.message || "未知错误"), "error");
        }
      } catch (e) {
        this.showMessage("网络错误，请重试", "error");
        console.error("fetchCaptcha error:", e);
      } finally {
        this.loading = false;
      }
    },

    loadImage(base64) {
      return new Promise((resolve) => {
        const ctx = uni.createCanvasContext('captchaCanvas', this);

        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        ctx.drawImage(base64, 0, 0, this.canvasWidth, this.canvasHeight);
        ctx.draw(false, () => {
          this.imageLoaded = true;
          this.drawOverlay(0);
          resolve();
        });

        setTimeout(() => {
          if (!this.imageLoaded) {
            this.showMessage("图片加载失败", "error");
            this.loading = false;
            resolve();
          }
        }, 5000);
      });
    },
	// 生成底图的遮罩
    drawOverlay(offsetX) {
      const ctx = uni.createCanvasContext('captchaOverlayCanvas', this);
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

      ctx.setFillStyle('rgba(0, 0, 0, 1)');//全遮罩改为1,半透明为0.6,用于查看底图上的图表
      ctx.fillRect(offsetX, 0, this.canvasWidth - offsetX, this.canvasHeight);

      ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
      ctx.fillRect(offsetX, 0, 3, this.canvasHeight);

      ctx.setStrokeStyle('rgba(255, 255, 255, 0.5)');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(offsetX, 0);
      ctx.lineTo(offsetX, this.canvasHeight);
      ctx.stroke();

      ctx.draw();
    },

    onTouchStart(e) {
      this.cachedThumbX = this.sliderX;
      this.startDrag(e.touches[0].clientX);
    },

    onTouchMove(e) {
      this.moveDrag(e.touches[0].clientX);
    },

    onTouchEnd(e) {
      this.endDrag();
    },

    onThumbTouchStart(e) {
      e.stopPropagation();
      this.cachedThumbX = this.sliderX;
      this.startDrag(e.touches[0].clientX);
    },

    onThumbTouchMove(e) {
      e.stopPropagation();
      this.moveDrag(e.touches[0].clientX);
    },

    onThumbTouchEnd(e) {
      e.stopPropagation();
      this.endDrag();
    },

    startDrag(clientX) {
      if (this.loading || !this.imageLoaded) return;

      this.isDragging = true;
      this.startX = clientX;
      this.trackStartTime = Date.now();
      this.track = [];
      this.message = "";
    },

    moveDrag(clientX) {
      if (!this.isDragging) return;

      const diff = clientX - this.startX;
      let newX = this.cachedThumbX + diff;

      const minX = 0;
      const maxX = this.canvasWidth - 40;

      if (newX < minX) newX = minX;
      if (newX > maxX) newX = maxX;

      this.sliderX = Math.round(newX);

      this.recordTrack(this.sliderX);

      this.drawOverlay(this.sliderX);
    },

    recordTrack(x) {
      const now = Date.now();
      this.track.push({
        x: x,
        t: now - this.trackStartTime
      });
    },

    endDrag() {
      if (!this.isDragging) return;
      this.isDragging = false;

      if (this.sliderX < 5) {
        this.sliderX = 0;
        this.track = [];
        this.drawOverlay(0);
        return;
      }

      this.verify();
    },

    async verify() {
      try {
        this.showMessage("验证中...", "info");

        const res = await verifyCaptcha({
          captchaId: this.captchaId,
          offsetX: this.sliderX,
          track: this.track
        });

        if (res.code === 200 && res.data) {
          this.showMessage("验证成功!", "success");
          setTimeout(() => {
            this.$emit("success", res.data);
            this.handleClose();
          }, 800);
        } else {
          this.showMessage(res.message || "验证失败", "error");
          setTimeout(() => {
            this.sliderX = 0;
            this.track = [];
            this.drawOverlay(0);
            this.fetchCaptcha();
          }, 1500);
        }
      } catch (e) {
        this.showMessage("验证请求失败", "error");
        console.error("verify error:", e);
      }
    },

    refresh() {
      this.reset();
      this.fetchCaptcha();
    },

    handleClose() {
      this.$emit("close");
      this.reset();
    },

    showMessage(text, type) {
      this.message = text;
      this.messageType = type;
    }
  }
};
</script>

<style scoped>
.captcha-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.captcha-box {
  background: #fff;
  border-radius: 12px;
  width: 360px;
  max-width: 95vw;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.captcha-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  position: relative;
}

.captcha-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.captcha-tip {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}

.captcha-close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.close-icon {
  font-size: 22px;
  color: #999;
  line-height: 1;
}

.captcha-body {
  position: relative;
  margin: 12px;
}

.captcha-canvas {
  display: block;
  border-radius: 6px;
}

.captcha-canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 6px;
}

.captcha-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e0e0e0;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}

.captcha-refresh {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-icon {
  font-size: 16px;
  color: #fff;
}

.slider-container {
  margin: 12px auto;
  width: 320px;
  position: relative;
  height: 40px;
}

.slider-track {
  position: relative;
  width: 320px;
  height: 40px;
  background: #f0f0f0;
  border-radius: 20px;
  overflow: hidden;
}

.slider-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #4a90e2, #67aaf5);
  border-radius: 20px;
}

.slider-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  touch-action: none;
  cursor: grab;
}

.slider-thumb:active {
  cursor: grabbing;
}

.thumb-icon {
  font-size: 16px;
  color: #4a90e2;
}

.slider-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  color: #aaa;
  pointer-events: none;
  z-index: 1;
}

.captcha-message {
  text-align: center;
  padding: 6px 12px;
  font-size: 13px;
  border-top: 1px solid #eee;
}

.captcha-message.info {
  color: #007aff;
}

.captcha-message.success {
  color: #4cd964;
}

.captcha-message.error {
  color: #dd524d;
}
</style>
