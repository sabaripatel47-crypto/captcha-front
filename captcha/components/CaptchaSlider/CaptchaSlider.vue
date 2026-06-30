<template>
  <view class="captcha-container" v-if="visible">
    <view class="captcha-box">
      <view class="captcha-header">
        <text class="captcha-title">安全验证</text>
        <text class="captcha-tip">{{ tip || '拖动滑块直到出现对应图案' }}</text>
        <!-- 关闭弹窗 -->
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
        ></canvas>

        <view class="captcha-loading" v-if="loading">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>
        <!-- 图区域的刷新按钮 -->
        <view class="captcha-refresh" v-if="!loading && imageLoaded" @click="refresh">
          <text class="refresh-icon">↻</text>
        </view>
      </view>
	<!-- 下方滚动容器 -->
      <view class="slider-container">
        <view class="slider-track">
          <!-- 已拖动区域(蓝色背景),40是按钮的宽度 -->
          <view class="slider-progress" :style="{ width: sliderX+40 + 'px' }"></view>
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
      <!-- 底部验证码验证成功/失败后的提示 -->
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
      canvasWidth: 340,//控制上方图片的宽度
      canvasHeight: 180,
      captchaId: "",
      imageBase64: "",
      imageLoaded: false,
      loading: true,
      tip: "",//后端返回的提示文本
      sliderX: 0,
      startX: 0,
      isDragging: false,

      track: [],
      trackStartTime: 0,

      message: "",
      messageType: "",

      maxSliderX: 0,
    };
  },
  watch: {
    visible(val) {
      //组件打开,重置数据并且获取验证码内容
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
    //重置所有数据
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
      this.tip = "";
      this.clearCanvas();
    },
    //初始化canvas(计算出画布的宽高)
    initCanvas() {
      const query = uni.createSelectorQuery().in(this);//当前组件实例(this)用于查询对应的元素
      // 通过 uni.createSelectorQuery() 查询页面上 .captcha-canvas 这个 CSS 类的元素，获取它的宽高尺寸
      // boundingClientRect:获取元素相对于可视界面的坐标和尺寸信息
      query.select('.captcha-canvas').boundingClientRect(rect => {
        if (rect) {
          this.canvasWidth = rect.width;
          this.canvasHeight = rect.height;
        }
      }).exec();//执行createSelectorQuery查询
    },
    // 清除所有的canvas
    clearCanvas() {
      const ctx = uni.createCanvasContext('captchaCanvas', this);//根据canvasid来获取对应canvas
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);//清除canvas内容
      ctx.draw();//绘制canvas

      const ctx2 = uni.createCanvasContext('captchaOverlayCanvas', this);//根据canvasid来获取对应canvas
      ctx2.clearRect(0, 0, this.canvasWidth, this.canvasHeight);//清除canvas内容
      ctx2.draw();//绘制canvas
    },
    //获取验证密码内容
    async fetchCaptcha() {
      try {
        this.loading = true;
        this.message = "";

        const res = await getCaptcha();

        if (res.code === 200 && res.data) {
          this.captchaId = res.data.captchaId;//验证码id
          this.imageBase64 = res.data.imageBase64;//验证码图片base64
          this.tip = res.data.tip || "拖动滑块直到出现对应图案";//后端返回的提示文本，拿不到时用默认文案兜底
          await this.loadImage(this.imageBase64);
        } else {
          this.showMessage("获取验证码失败: " + (res.message || "未知错误"), "error");
        }
      } catch (e) {
        this.showMessage("网络错误，请重试", "error");
      } finally {
        this.loading = false;
      }
    },
    //加载base64图片绘制到canvas底图
    loadImage(base64) {
      return new Promise((resolve) => {
        const ctx = uni.createCanvasContext('captchaCanvas', this);//获取底图

        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);//清除canvas内容

        ctx.drawImage(base64, 0, 0, this.canvasWidth, this.canvasHeight);//绘制base64图片
        // false:不保留之前的绘制内容,第二个参数:绘制完成后的回调(用于生成遮罩)
        ctx.draw(false, () => {
          this.imageLoaded = true;
          this.drawOverlay(0);//生成底图的遮罩
          resolve();
        });

        setTimeout(() => {
          if (!this.imageLoaded) {//如果图片加载失败,显示错误信息
            this.showMessage("图片加载失败", "error");
            this.loading = false;
            resolve();
          }
        }, 5000);
      });
    },
	// 生成底图的遮罩(默认offsetX为0)
    drawOverlay(offsetX) {
      const ctx = uni.createCanvasContext('captchaOverlayCanvas', this);//获取遮罩
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);//清除遮罩内容

      ctx.setFillStyle('rgba(0, 0, 0, 1)');//全遮罩改为1,半透明为0.6(方便查看遮罩下的底图)
      ctx.fillRect(offsetX, 0, this.canvasWidth - offsetX, this.canvasHeight);//绘制遮罩

      ctx.draw();//开始绘画
    },
    // 开始拖动(小程序)
    onThumbTouchStart(e) {
      e.stopPropagation();//防止冒泡
      this.startDrag(e.touches[0].clientX);//传入用户手指按下时的X坐标,开始拖动逻辑
    },
    // 拖动过程中一直触发(小程序)
    onThumbTouchMove(e) {
      e.stopPropagation();
      this.moveDrag(e.touches[0].clientX);
    },
    //拖动结束(手指松开)(小程序)
    onThumbTouchEnd(e) {
      e.stopPropagation();
      this.endDrag();
    },
    // H5 鼠标事件
    onThumbMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();
      this.startDrag(e.clientX);
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    },
    // 拖动过程中一直触发(H5)
    onMouseMove(e) {
      this.moveDrag(e.clientX);
    },
    // 拖动结束(手指松开)(H5)
    onMouseUp(e) {
      // 移除监听
      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('mouseup', this.onMouseUp);
      this.endDrag();
    },
    // 开始拖动
    //clientX:开始拖动时候的位置(每次不一样,跟你拖动按钮的落点有关,在最左边,距离就小,在最右边,距离就大)
    startDrag(clientX) {
      console.log("开始拖动的时候位置",clientX)
      if (this.loading || !this.imageLoaded) return;

      this.isDragging = true;
      this.startX = clientX;//存储用户开始滑动的坐标
      this.trackStartTime = Date.now();//存储开始拖动的时间戳(用于后续记录每个节点和开始时间的间距)
      this.track = [];//清空拖动轨迹
      this.message = "";//清空提示信息
    },
    // 拖动过程中一直触发
    moveDrag(clientX) {
      console.log("拖动过程中位置",clientX,"开始的距离",this.startX)
      if (!this.isDragging) return;

      let diff = clientX - this.startX;//当前距离减去开始的距离
      console.log("计算用户手指移动的距离",diff)
      const minX = 0;
      const maxX = this.canvasWidth-40;//计算最大边界(40是按钮的宽度,此时最大边界是按钮滑到最右边的距离,如果不减40,会导致按钮超出容器)
      console.log("最大宽度",this.canvasWidth)

      if (diff < minX) diff = minX;//修正距离(防止用户一直左滑变为负数)
      if (diff > maxX) diff = maxX;//修正距离(防止用户一直右滑数值很大)

      this.sliderX = Math.round(diff);

      this.recordTrack(this.sliderX);

      this.drawOverlay(this.sliderX+40);//实时更新遮罩的位置(40:让遮罩额外向右移动40的距离,从而实现遮罩完全滑动到最右边)
    },
    // 记录拖动轨迹(用于判断是否为机器人操作)
    recordTrack(x) {
      const now = Date.now();
      this.track.push({
        x: x,
        t: now - this.trackStartTime
      });
    },
    // 拖动结束(手指松开)
    endDrag() {
      if (!this.isDragging) return;
      this.isDragging = false;

      this.verify();
    },
    // 滑块松开,执行验证码校验
    async verify() {
      try {
        this.showMessage("验证中...", "info");
        console.log("轨迹数组",this.track)
        const res = await verifyCaptcha({
          captchaId: this.captchaId,
          offsetX: this.sliderX,//当前滑块j距离开始的位置
          track: this.track
        });

        if (res.code === 200 && res.data) {
          this.showMessage("验证成功!", "success");
          setTimeout(() => {
            this.$emit("success", res.data);
            this.handleClose();
          }, 800);
        } else {//验证失败清空相关内容,重新绘制
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
      }
    },
    // 刷新图片
    refresh() {
      this.reset();
      this.fetchCaptcha();
    },
    // 关闭弹窗
    handleClose() {
      this.$emit("close");
      this.reset();
    },
    // 显示提示信息
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
/* 底图图片样式 */
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
