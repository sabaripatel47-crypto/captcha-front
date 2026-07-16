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
          <!-- 已拖动区域(蓝色背景),40是按钮的宽度(这样可以实现蓝色拖尾刚好覆盖按钮) -->
          <view class="slider-progress" :style="{ width: sliderX + THUMB_WIDTH + 'px' }"></view>
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

<script setup lang="ts">
import { ref, watch, nextTick, getCurrentInstance } from 'vue';
import { getCaptcha, verifyCaptcha } from '@/api/captcha.js';

// 定义Props类型
interface Props {
  visible?: boolean;
  onSuccess?: Function | null;
  onClose?: Function | null;
}
//接收父组件的参数
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  onSuccess: null,
  onClose: null,
});

// 定义Emits
const emit = defineEmits<{
  (e: 'success', data: any): void;
  (e: 'close'): void;
}>();

// 获取当前组件实例(用于uni.createSelectorQuery和uni.createCanvasContext)
const instance = getCurrentInstance();

// 响应式数据
const canvasWidth = ref(340); //控制上方图片的宽度
const canvasHeight = ref(180);
const captchaId = ref('');
const imageBase64 = ref('');
const imageLoaded = ref(false);
const loading = ref(true);
const tip = ref(''); //后端返回的提示文本
const sliderX = ref(0);
const startX = ref(0);
const isDragging = ref(false);
const track = ref<Array<{ x: number; t: number }>>([]);
const trackStartTime = ref(0);
const message = ref('');
const messageType = ref('');
const THUMB_WIDTH = 40;
const maxSliderX = ref(0);

// 监听visible变化
watch(
  () => props.visible,
  (val) => {
    //组件打开,重置数据并且获取验证码内容
    if (val) {
      reset();
      fetchCaptcha();
    }
  }
);

// mounted -> onMounted
// 注意：在<script setup>中，顶层代码即在setup阶段执行，但DOM操作需在onMounted或nextTick中
import { onMounted } from 'vue';
onMounted(() => {
  nextTick(() => {
    initCanvas();
  });
});

//重置所有数据
const reset = () => {
  sliderX.value = 0;
  track.value = [];
  message.value = '';
  messageType.value = '';
  loading.value = true;
  imageLoaded.value = false;
  isDragging.value = false;
  captchaId.value = '';
  imageBase64.value = '';
  tip.value = '';
  clearCanvas();
};

//初始化canvas(计算出画布的宽高)
const initCanvas = () => {
  //当前组件实例(instance)用于查询对应的元素
  const query = uni.createSelectorQuery().in(instance);
  // 通过 uni.createSelectorQuery() 查询页面上 .captcha-canvas 这个 CSS 类的元素，获取它的宽高尺寸
  // boundingClientRect:获取元素相对于可视界面的坐标和尺寸信息
  query
    .select('.captcha-canvas')
    .boundingClientRect((rect: any) => {
      if (rect) {
        canvasWidth.value = rect.width;
        canvasHeight.value = rect.height;
      }
    })
    .exec(); //执行createSelectorQuery查询
};

// 清除所有的canvas
const clearCanvas = () => {
  //根据canvasid来获取对应canvas
  const ctx = uni.createCanvasContext('captchaCanvas', instance);
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value); //清除canvas内容
  ctx.draw(); //绘制canvas

  //根据canvasid来获取对应canvas
  const ctx2 = uni.createCanvasContext('captchaOverlayCanvas', instance);
  ctx2.clearRect(0, 0, canvasWidth.value, canvasHeight.value); //清除canvas内容
  ctx2.draw(); //绘制canvas
};

//获取验证密码内容
const fetchCaptcha = async () => {
  try {
    loading.value = true;
    message.value = '';
    const res: any = await getCaptcha();
    if (res.code === 200 && res.data) {
      captchaId.value = res.data.captchaId; //验证码id
      imageBase64.value = res.data.imageBase64; //验证码图片base64
      tip.value = res.data.tip || '拖动滑块直到出现对应图案'; //后端返回的提示文本，拿不到时用默认文案兜底
      await loadImage(imageBase64.value);
    } else {
      showMessage('获取验证码失败: ' + (res.message || '未知错误'), 'error');
    }
  } catch (e) {
    showMessage('网络错误，请重试', 'error');
  } finally {
    loading.value = false;
  }
};

//加载base64图片绘制到canvas底图
const loadImage = (base64: string): Promise<void> => {
  return new Promise((resolve) => {
    const ctx = uni.createCanvasContext('captchaCanvas', instance); //获取底图
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value); //清除canvas内容
    ctx.drawImage(base64, 0, 0, canvasWidth.value, canvasHeight.value); //绘制base64图片
    // false:不保留之前的绘制内容,第二个参数:绘制完成后的回调(用于生成遮罩)
    ctx.draw(false, () => {
      imageLoaded.value = true;
      drawOverlay(0); //生成底图的遮罩
      resolve();
    });

    setTimeout(() => {
      if (!imageLoaded.value) {
        //如果图片加载失败,显示错误信息
        showMessage('图片加载失败', 'error');
        loading.value = false;
        resolve();
      }
    }, 5000);
  });
};

// 生成底图的遮罩(默认offsetX为0)
const drawOverlay = (offsetX: number) => {
  const ctx = uni.createCanvasContext('captchaOverlayCanvas', instance); //获取遮罩
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value); //清除遮罩内容
  ctx.setFillStyle('rgba(0, 0, 0, 1)'); //全遮罩改为1,半透明为0.6(方便查看遮罩下的底图)
  ctx.fillRect(offsetX, 0, canvasWidth.value - offsetX, canvasHeight.value); //绘制遮罩
  ctx.draw(); //开始绘画
};

// 开始拖动(小程序)
const onThumbTouchStart = (e: any) => {
  e.stopPropagation(); //防止冒泡
  startDrag(e.touches[0].clientX); //传入用户手指按下时的X坐标,开始拖动逻辑
};

// 拖动过程中一直触发(小程序)
const onThumbTouchMove = (e: any) => {
  e.stopPropagation();
  moveDrag(e.touches[0].clientX);
};

//拖动结束(手指松开)(小程序)
const onThumbTouchEnd = (e: any) => {
  e.stopPropagation();
  endDrag();
};

// H5 鼠标事件
const onThumbMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  startDrag(e.clientX);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// 拖动过程中一直触发(H5)
const onMouseMove = (e: MouseEvent) => {
  moveDrag(e.clientX);
};

// 拖动结束(手指松开)(H5)
const onMouseUp = (e: MouseEvent) => {
  //移除监听
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  endDrag();
};

// 开始拖动
//clientX:开始拖动时候的位置(每次不一样,跟你拖动按钮的落点有关,在最左边,距离就小,在最右边,距离就大)
const startDrag = (clientX: number) => {
  console.log('开始拖动的时候位置', clientX);
  if (loading.value || !imageLoaded.value) return;
  isDragging.value = true;
  startX.value = clientX; //存储用户开始滑动的坐标
  trackStartTime.value = Date.now(); //存储开始拖动的时间戳(用于后续记录每个节点和开始时间的间距)
  track.value = []; //清空拖动轨迹
  message.value = ''; //清空提示信息
};

// 拖动过程中一直触发
const moveDrag = (clientX: number) => {
  console.log('拖动过程中位置', clientX, '开始的距离', startX.value);
  if (!isDragging.value) return;
  let diff = clientX - startX.value; //当前距离减去开始的距离
  console.log('计算用户手指移动的距离', diff);
  const minX = 0;
  const maxX = canvasWidth.value - THUMB_WIDTH;
  console.log('最大宽度', canvasWidth.value);
  if (diff < minX) diff = minX; //修正距离(防止用户一直左滑变为负数)
  if (diff > maxX) diff = maxX; //修正距离(防止用户一直右滑数值很大)
  sliderX.value = Math.round(diff);
  recordTrack(sliderX.value);
  drawOverlay(sliderX.value + THUMB_WIDTH); //开始滑动的时候让遮罩从按钮有边界开始滑,从而实现按钮到右边界的时候遮罩完全消失
};

// 记录拖动轨迹(用于判断是否为机器人操作)
const recordTrack = (x: number) => {
  const now = Date.now();
  track.value.push({
    x: x,
    t: now - trackStartTime.value,
  });
};

// 拖动结束(手指松开)
const endDrag = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  verify();
};

// 滑块松开,执行验证码校验
const verify = async () => {
  try {
    showMessage('验证中...', 'info');
    console.log('轨迹数组', track.value);
    const res: any = await verifyCaptcha({
      captchaId: captchaId.value,
      offsetX: sliderX.value, //当前滑块j距离开始的位置
      track: track.value,
    });
    if (res.code === 200 && res.data) {
      showMessage('验证成功!', 'success');
      setTimeout(() => {
        emit('success', res.data);
        handleClose();
      }, 800);
    } else {
      //验证失败清空相关内容,重新绘制
      showMessage(res.message || '验证失败', 'error');
      setTimeout(() => {
        sliderX.value = 0;
        track.value = [];
        drawOverlay(0);
        fetchCaptcha();
      }, 1500);
    }
  } catch (e) {
    showMessage('验证请求失败', 'error');
  }
};

// 刷新图片
const refresh = () => {
  reset();
  fetchCaptcha();
};

// 关闭弹窗
const handleClose = () => {
  emit('close');
  reset();
};

// 显示提示信息
const showMessage = (text: string, type: string) => {
  message.value = text;
  messageType.value = type;
};
</script>

<style scoped>
/* 验证码组件容器样式 */
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
/* 验证码二层容器样式 */
.captcha-box {
  background: #fff;
  border-radius: 12px;
  width: 360px;
}
/* 顶部标题样式 */
.captcha-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  position: relative;
}
/* 安全验证内容样式 */
.captcha-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}
/* 提示内容样式 */
.captcha-tip {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}
/* 关闭按钮容器样式 */
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
/* 关闭按钮样式 */
.close-icon {
  font-size: 22px;
  color: #999;
  line-height: 1;
}
/* 验证码图片容器 */
.captcha-body {
  position: relative;
  margin: 12px;
}
/* 底图图片样式 */
.captcha-canvas {
  display: block;
  border-radius: 6px;
}
/* 验证码图片遮罩样式 */
.captcha-canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 6px;
}
/* 加载中的样式 */
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
/* 加载中的动画样式(圆圈旋转) */
.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e0e0e0;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
/* 加载旋转 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
/* 加载中文本样式 */
.loading-text {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}
/* 刷新按钮容器样式 */
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
/* 刷新按钮样式 */
.refresh-icon {
  font-size: 16px;
  color: #fff;
}
/* 下方滚动容器样式 */
.slider-container {
  margin: 12px auto;
  width: 340px;
  position: relative;
  height: 40px;
}
/* 已拖动区域(蓝色背景)容器样式 */
.slider-track {
  position: relative;
  width: 340px;
  height: 40px;
  background: #f0f0f0;
  border-radius: 20px;
}
/* 已拖动区域(蓝色背景)样式 */
.slider-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #4a90e2, #67aaf5);
  border-radius: 20px;
}
/* 拖动按钮样式 */
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
/* 拖动按钮激活样式 */
.slider-thumb:active {
  cursor: grabbing;
}
/* 拖动按钮图标样式 */
.thumb-icon {
  font-size: 16px;
  color: #4a90e2;
}
/* 拖动滑块完成验证的样式 */
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
/* 验证失败/成功后的提示内容 */
.captcha-message {
  text-align: center;
  padding: 6px 12px;
  font-size: 13px;
  border-top: 1px solid #eee;
}
/* 验证中提示内容样式 */
.captcha-message.info {
  color: #007aff;
}
/* 验证成功提示内容样式 */
.captcha-message.success {
  color: #4cd964;
}
/* 验证失败提示内容样式 */
.captcha-message.error {
  color: #dd524d;
}
</style>