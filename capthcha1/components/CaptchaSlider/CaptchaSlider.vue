<template>
  <view class="captcha-container" v-if="visible">
    <view class="captcha-box">
      <view class="captcha-header">
        <text class="captcha-title">安全验证</text>
        <text class="captcha-tip">{{ tip || '拖动滑块直到出现对应图案' }}</text>
        <view class="captcha-close" @click="handleClose">
          <text class="close-icon">×</text>
        </view>
      </view>
      <view class="captcha-body">
        <canvas
          class="captcha-canvas"
          canvas-id="captchaCanvas"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        ></canvas>
        <canvas
          class="captcha-canvas-overlay"
          canvas-id="captchaOverlayCanvas"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        ></canvas>

        <view class="captcha-loading" v-if="loading">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>
        <view class="captcha-refresh" v-if="!loading && imageLoaded" @click="refresh">
          <text class="refresh-icon">↻</text>
        </view>
      </view>
      <view class="slider-container">
        <view class="slider-track">
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
      <view class="captcha-message" :class="messageType" v-if="message">
        <text>{{ message }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import { getCaptcha, verifyCaptcha } from '@/api/captcha.js';

type MessageType = 'info' | 'success' | 'error' | '';

interface TrackPoint {
  x: number;
  t: number;
}

interface CaptchaResponse {
  code: number;
  message?: string;
  data?: {
    captchaId: string;
    imageBase64: string;
    tip?: string;
  };
}

interface VerifyResponse {
  code: number;
  message?: string;
  data?: unknown;
}

const THUMB_WIDTH = 40;

const props = defineProps<{
  visible: boolean;
  onSuccess?: ((data: unknown) => void) | null;
  onClose?: (() => void) | null;
}>();

const emit = defineEmits<{
  (e: 'success', data: unknown): void;
  (e: 'close'): void;
}>();

const canvasWidth = ref(340);
const canvasHeight = ref(180);
const captchaId = ref('');
const imageBase64 = ref('');
const imageLoaded = ref(false);
const loading = ref(true);
const tip = ref('');
const sliderX = ref(0);
const startX = ref(0);
const isDragging = ref(false);

const track = ref<TrackPoint[]>([]);
const trackStartTime = ref(0);

const message = ref('');
const messageType = ref<MessageType>('');

const maxSliderX = ref(0);

const onMouseMove = (e: MouseEvent): void => {
  moveDrag(e.clientX);
};
const onMouseUp = (_e: MouseEvent): void => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  endDrag();
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      reset();
      fetchCaptcha();
    }
  }
);

onMounted(() => {
  nextTick(() => {
    initCanvas();
  });
});

function reset(): void {
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
}

function initCanvas(): void {
  const query = uni.createSelectorQuery();
  query
    .select('.captcha-canvas')
    .boundingClientRect((rect) => {
      if (rect) {
        canvasWidth.value = rect.width;
        canvasHeight.value = rect.height;
      }
    })
    .exec();
}

function clearCanvas(): void {
  const ctx = uni.createCanvasContext('captchaCanvas');
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  ctx.draw();

  const ctx2 = uni.createCanvasContext('captchaOverlayCanvas');
  ctx2.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  ctx2.draw();
}

async function fetchCaptcha(): Promise<void> {
  try {
    loading.value = true;
    message.value = '';

    const res = (await getCaptcha()) as CaptchaResponse;

    if (res.code === 200 && res.data) {
      captchaId.value = res.data.captchaId;
      imageBase64.value = res.data.imageBase64;
      tip.value = res.data.tip || '拖动滑块直到出现对应图案';
      await loadImage(res.data.imageBase64);
    } else {
      showMessage('获取验证码失败: ' + (res.message || '未知错误'), 'error');
    }
  } catch {
    showMessage('网络错误，请重试', 'error');
  } finally {
    loading.value = false;
  }
}

function loadImage(base64: string): Promise<void> {
  return new Promise((resolve) => {
    const ctx = uni.createCanvasContext('captchaCanvas');

    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
    ctx.drawImage(base64, 0, 0, canvasWidth.value, canvasHeight.value);
    ctx.draw(false, () => {
      imageLoaded.value = true;
      drawOverlay(0);
      resolve();
    });

    setTimeout(() => {
      if (!imageLoaded.value) {
        showMessage('图片加载失败', 'error');
        loading.value = false;
        resolve();
      }
    }, 5000);
  });
}

function drawOverlay(offsetX: number): void {
  const ctx = uni.createCanvasContext('captchaOverlayCanvas');
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  ctx.setFillStyle('rgba(0, 0, 0, 1)');
  ctx.fillRect(offsetX, 0, canvasWidth.value - offsetX, canvasHeight.value);
  ctx.draw();
}

function onThumbTouchStart(e: TouchEvent): void {
  e.stopPropagation();
  startDrag(e.touches[0].clientX);
}

function onThumbTouchMove(e: TouchEvent): void {
  e.stopPropagation();
  moveDrag(e.touches[0].clientX);
}

function onThumbTouchEnd(e: TouchEvent): void {
  e.stopPropagation();
  endDrag();
}

function onThumbMouseDown(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  startDrag(e.clientX);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function startDrag(clientX: number): void {
  if (loading.value || !imageLoaded.value) return;

  isDragging.value = true;
  startX.value = clientX;
  trackStartTime.value = Date.now();
  track.value = [];
  message.value = '';
}

function moveDrag(clientX: number): void {
  if (!isDragging.value) return;

  let diff = clientX - startX.value;
  const minX = 0;
  const maxX = canvasWidth.value - THUMB_WIDTH;

  if (diff < minX) diff = minX;
  if (diff > maxX) diff = maxX;

  sliderX.value = Math.round(diff);
  recordTrack(sliderX.value);
  drawOverlay(sliderX.value + THUMB_WIDTH);
}

function recordTrack(x: number): void {
  track.value.push({
    x,
    t: Date.now() - trackStartTime.value,
  });
}

function endDrag(): void {
  if (!isDragging.value) return;
  isDragging.value = false;
  verify();
}

async function verify(): Promise<void> {
  try {
    showMessage('验证中...', 'info');
    const res = (await verifyCaptcha({
      captchaId: captchaId.value,
      offsetX: sliderX.value,
      track: track.value,
    })) as VerifyResponse;

    if (res.code === 200 && res.data) {
      showMessage('验证成功!', 'success');
      setTimeout(() => {
        emit('success', res.data);
        handleClose();
      }, 800);
    } else {
      showMessage(res.message || '验证失败', 'error');
      setTimeout(() => {
        sliderX.value = 0;
        track.value = [];
        drawOverlay(0);
        fetchCaptcha();
      }, 1500);
    }
  } catch {
    showMessage('验证请求失败', 'error');
  }
}

function refresh(): void {
  reset();
  fetchCaptcha();
}

function handleClose(): void {
  emit('close');
  reset();
}

function showMessage(text: string, type: MessageType): void {
  message.value = text;
  messageType.value = type;
}
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

.captcha-message.info { color: #007aff; }
.captcha-message.success { color: #4cd964; }
.captcha-message.error { color: #dd524d; }
</style>