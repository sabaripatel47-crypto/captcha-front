<template>
  <view class="captcha-container" v-if="visible">
    <view class="captcha-box">
      <!-- 头部：标题 + 提示文案 + 关闭按钮 -->
      <view class="captcha-header">
        <text class="captcha-title">安全验证</text>
        <text class="captcha-tip">{{ tip || '拖动滑块直到出现对应图案' }}</text>
        <!-- 关闭弹窗 -->
        <view class="captcha-close" @click="handleClose">
          <text class="close-icon">×</text>
        </view>
      </view>
      <!-- 验证码图片区域：底图 + 遮罩 + 加载态 + 刷新按钮 -->
      <view class="captcha-body">
        <!-- 底图 canvas -->
        <canvas
          class="captcha-canvas"
          canvas-id="captchaCanvas"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        ></canvas>
        <!-- 上方遮罩 canvas(覆盖在底图上方,通过 clearRect 露出正确位置) -->
        <canvas
          class="captcha-canvas-overlay"
          canvas-id="captchaOverlayCanvas"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        ></canvas>
        <!-- 加载中遮罩 -->
        <view class="captcha-loading" v-if="loading">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>
        <!-- 图片区域的刷新按钮 -->
        <view class="captcha-refresh" v-if="!loading && imageLoaded" @click="refresh">
          <text class="refresh-icon">↻</text>
        </view>
      </view>
      <!-- 下方滑块区域：进度条 + 拖动按钮 + 提示文案 -->
      <view class="slider-container">
        <view class="slider-track">
          <!-- 已拖动区域(蓝色背景),THUMB_WIDTH=40 是按钮宽度,这样蓝色拖尾刚好覆盖按钮 -->
          <view class="slider-progress" :style="{ width: sliderX + THUMB_WIDTH + 'px' }"></view>
          <!-- 拖动按钮 -->
          <view
            class="slider-thumb"
            :style="{ left: sliderX + 'px' }"
            @touchstart="onThumbTouchStart"
            @touchmove.prevent="onThumbTouchMove"
            @touchend="onThumbTouchEnd"
            @mousedown="onThumbMouseDown"
          >
            <text class="thumb-icon">→</text>
          </view>
        </view>
        <text class="slider-hint">拖动滑块完成验证</text>
      </view>
      <!-- 底部验证成功/失败后的提示 -->
      <view class="captcha-message" :class="messageType" v-if="message">
        <text>{{ message }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getCaptcha, verifyCaptcha } from '@/api/captcha.js';

export default {
  name: 'CaptchaSlider',
  // 接收父组件参数
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  // 对外事件:success 验证成功 / close 关闭弹窗 / update:visible 配合 :visible 实现双向绑定
  emits: ['success', 'close', 'update:visible'],
  data() {
    return {
      canvasWidth: 340, // 图片区域宽度
      canvasHeight: 180, // 图片区域高度
      captchaId: '', // 当前验证码唯一标识
      imageBase64: '', // 后端返回的底图 base64
      imageLoaded: false, // 图片是否已绘制到 canvas
      loading: true, // 加载态
      tip: '', // 后端返回的提示文本(出现图案的描述)
      sliderX: 0, // 滑块当前 X 偏移
      startX: 0, // 触摸/鼠标按下时的 clientX
      isDragging: false, // 是否正在拖动
      track: [], // 拖动轨迹 {x, t},用于后端判断是否为机器人
      trackStartTime: 0, // 拖动开始时间戳,用于计算轨迹相对时间
      message: '', // 底部提示文案
      messageType: '', // 提示类型 info / success / error
      THUMB_WIDTH: 40, // 拖动按钮宽度(用于计算进度条末端位置)
      maxSliderX: 0, // 滑块最大可拖动距离(运行时计算)
    };
  },

  // 监听 visible:组件由隐藏变为显示时,重置状态并重新请求验证码
  watch: {
    visible(val) {
      if (val) {
        this.reset();
        this.fetchCaptcha();
      }
    },
  },

  // 挂载后初始化 canvas 尺寸(需要在 DOM 渲染完成后获取实际宽高)
  mounted() {
    this.$nextTick(() => {
      this.initCanvas();
    });
  },

  methods: {
    // 初始化 canvas:获取 class为.captcha-canvas 的元素的实际宽高,用于图片按容器比例绘制
    initCanvas() {
      const query = uni.createSelectorQuery().in(this);
      query
        .select('.captcha-canvas')
        .boundingClientRect((rect) => {
          if (rect) {
            this.canvasWidth = rect.width;
            this.canvasHeight = rect.height;
          }
        })
        .exec();
    },

    // 清除底图和遮罩 canvas 上的内容
    clearCanvas() {
      const ctx = uni.createCanvasContext('captchaCanvas', this);
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx.draw();

      const ctx2 = uni.createCanvasContext('captchaOverlayCanvas', this);
      ctx2.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx2.draw();
    },

    // 重置组件全部状态(切换验证码或关闭弹窗前调用)
    reset() {
      this.sliderX = 0;
      this.track = [];
      this.message = '';
      this.messageType = '';
      this.loading = true;
      this.imageLoaded = false;
      this.isDragging = false;
      this.captchaId = '';
      this.imageBase64 = '';
      this.tip = '';
      this.clearCanvas();
    },

    // 请求后端获取新的验证码(底图 + captchaId)
    async fetchCaptcha() {
      try {
        this.loading = true;
        this.message = '';
        const res = await getCaptcha();
        if (res.code === 200 && res.data) {
          this.captchaId = res.data.captchaId;
          this.imageBase64 = res.data.imageBase64;
          this.tip = res.data.tip || '拖动滑块直到出现对应图案';
          await this.loadImage(this.imageBase64);
        } else {
          this.showMessage('获取验证码失败: ' + (res.message || '未知错误'), 'error');
        }
      } catch (e) {
        this.showMessage('网络错误，请重试', 'error');
      } finally {
        this.loading = false;
      }
    },

    // 把 base64 图片绘制到底图 canvas,绘制完成后生成默认遮罩
    // false 表示不保留之前绘制的内容,第二个参数是绘制完成的回调
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

        // 兜底:5 秒后仍未触发回调,视为加载失败
        setTimeout(() => {
          if (!this.imageLoaded) {
            this.showMessage('图片加载失败', 'error');
            this.loading = false;
            resolve();
          }
        }, 5000);
      });
    },

    // 生成底图遮罩:offsetX 左侧区域露出,右侧覆盖半透明黑(实现"拖出图案"效果)
    drawOverlay(offsetX) {
      const ctx = uni.createCanvasContext('captchaOverlayCanvas', this);
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx.setFillStyle('rgba(0, 0, 0, 1)'); // 1 表示完全遮罩,改为 0.6 可以半透明看到底图
      ctx.fillRect(offsetX, 0, this.canvasWidth - offsetX, this.canvasHeight);
      ctx.draw();
    },

    // ===== 拖动事件:小程序(触屏) =====
    onThumbTouchStart(e) {
      e.stopPropagation();
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

    // ===== 拖动事件:H5(鼠标) =====
    onThumbMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();
      this.startDrag(e.clientX);
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    },
    onMouseMove(e) {
      this.moveDrag(e.clientX);
    },
    onMouseUp(e) {
      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('mouseup', this.onMouseUp);
      this.endDrag();
    },

    // 开始拖动:记录起始 clientX、起始时间、清空历史轨迹
    // clientX 是按下时的位置,每次不同,跟落点有关
    startDrag(clientX) {
      if (this.loading || !this.imageLoaded) return;
      this.isDragging = true;
      this.startX = clientX;
      this.trackStartTime = Date.now();
      this.track = [];
      this.message = '';
    },

    // 拖动过程中:计算手指移动距离 diff,修正边界,记录轨迹,刷新遮罩
    moveDrag(clientX) {
      if (!this.isDragging) return;
      let diff = clientX - this.startX; // 当前距离 - 开始距离
      const minX = 0;
      const maxX = this.canvasWidth - this.THUMB_WIDTH;
      if (diff < minX) diff = minX; // 防止左滑变负数
      if (diff > maxX) diff = maxX; // 防止右滑超出
      this.sliderX = Math.round(diff);
      this.recordTrack(this.sliderX);
      this.drawOverlay(this.sliderX + this.THUMB_WIDTH);
    },

    // 记录单点轨迹 {x, t},t 为距开始拖动的时间,用于后端分析
    recordTrack(x) {
      const now = Date.now();
      this.track.push({
        x: x,
        t: now - this.trackStartTime,
      });
    },

    // 拖动结束:触发后端校验
    endDrag() {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.verify();
    },

    // 提交校验请求:把 captchaId、最终偏移 sliderX、轨迹 track 传给后端
    async verify() {
      try {
        this.showMessage('验证中...', 'info');
        const res = await verifyCaptcha({
          captchaId: this.captchaId,
          offsetX: this.sliderX,
          track: this.track,
        });
        if (res.code === 200 && res.data) {
          this.showMessage('验证成功!', 'success');
          setTimeout(() => {
            this.$emit('success', true);
            this.handleClose();
          }, 800);
        } else {
          // 验证失败:重置滑块位置,刷新验证码让用户重试
          this.showMessage(res.message || '验证失败', 'error');
          setTimeout(() => {
            this.sliderX = 0;
            this.track = [];
            this.drawOverlay(0);
            this.fetchCaptcha();
          }, 1500);
        }
      } catch (e) {
        this.showMessage('验证请求失败', 'error');
      }
    },

    // 主动刷新:重置状态 + 重新拉取验证码
    refresh() {
      this.reset();
      this.fetchCaptcha();
    },

    // 关闭弹窗:对外通知父组件,关闭自身 visible,清空状态
    handleClose() {
      this.$emit('close');
      this.$emit('update:visible', false);
      this.reset();
    },

    // 显示底部提示
    showMessage(text, type) {
      this.message = text;
      this.messageType = type;
    },
  },
};
</script>

<style scoped>
/* ================== 验证码弹窗容器 ================== */
.captcha-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* 图片容器居中 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

/* 验证码外层卡片 */
.captcha-box {
  background: #fff;
  border-radius: 12px;
  width: 360px;
}

/* ================== 头部 ================== */
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

/* 关闭按钮 */
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

/* ================== 图片区域 ================== */
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

/* 加载中遮罩 */
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

/* 刷新按钮 */
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

/* ================== 滑块区域 ================== */
.slider-container {
  margin: 12px auto;
  width: 340px;
  position: relative;
  height: 40px;
}
.slider-track {
  position: relative;
  width: 340px;
  height: 40px;
  background: #f0f0f0;
  border-radius: 20px;
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

/* ================== 底部提示 ================== */
.captcha-message {
  text-align: center;
  padding: 6px 12px;
  font-size: 13px;
  border-top: 1px solid #eee;
}
.captcha-message.info { color: #007aff; }
.captcha-message.success { color: #4cd964; }
.captcha-message.error { color: #dd524d; }
</style>