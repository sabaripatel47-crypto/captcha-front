"use strict";
const common_vendor = require("../../common/vendor.js");
const api_captcha = require("../../api/captcha.js");
const THUMB_WIDTH = 40;
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "CaptchaSlider",
  props: {
    visible: { type: Boolean },
    onSuccess: { type: [Function, null] },
    onClose: { type: [Function, null] }
  },
  emits: ["success", "close"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const canvasWidth = common_vendor.ref(340);
    const canvasHeight = common_vendor.ref(180);
    const captchaId = common_vendor.ref("");
    const imageBase64 = common_vendor.ref("");
    const imageLoaded = common_vendor.ref(false);
    const loading = common_vendor.ref(true);
    const tip = common_vendor.ref("");
    const sliderX = common_vendor.ref(0);
    const startX = common_vendor.ref(0);
    const isDragging = common_vendor.ref(false);
    const track = common_vendor.ref([]);
    const trackStartTime = common_vendor.ref(0);
    const message = common_vendor.ref("");
    const messageType = common_vendor.ref("");
    common_vendor.ref(0);
    const onMouseMove = (e) => {
      moveDrag(e.clientX);
    };
    const onMouseUp = (_e2) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      endDrag();
    };
    common_vendor.watch(
      () => props.visible,
      (val) => {
        if (val) {
          reset();
          fetchCaptcha();
        }
      }
    );
    common_vendor.onMounted(() => {
      common_vendor.nextTick$1(() => {
        initCanvas();
      });
    });
    function reset() {
      sliderX.value = 0;
      track.value = [];
      message.value = "";
      messageType.value = "";
      loading.value = true;
      imageLoaded.value = false;
      isDragging.value = false;
      captchaId.value = "";
      imageBase64.value = "";
      tip.value = "";
      clearCanvas();
    }
    function initCanvas() {
      const query = common_vendor.index.createSelectorQuery();
      query.select(".captcha-canvas").boundingClientRect((rect) => {
        if (rect) {
          canvasWidth.value = rect.width;
          canvasHeight.value = rect.height;
        }
      }).exec();
    }
    function clearCanvas() {
      const ctx = common_vendor.index.createCanvasContext("captchaCanvas");
      ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
      ctx.draw();
      const ctx2 = common_vendor.index.createCanvasContext("captchaOverlayCanvas");
      ctx2.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
      ctx2.draw();
    }
    async function fetchCaptcha() {
      try {
        loading.value = true;
        message.value = "";
        const res = await api_captcha.getCaptcha();
        if (res.code === 200 && res.data) {
          captchaId.value = res.data.captchaId;
          imageBase64.value = res.data.imageBase64;
          tip.value = res.data.tip || "拖动滑块直到出现对应图案";
          await loadImage(res.data.imageBase64);
        } else {
          showMessage("获取验证码失败: " + (res.message || "未知错误"), "error");
        }
      } catch {
        showMessage("网络错误，请重试", "error");
      } finally {
        loading.value = false;
      }
    }
    function loadImage(base64) {
      return new Promise((resolve) => {
        const ctx = common_vendor.index.createCanvasContext("captchaCanvas");
        ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
        ctx.drawImage(base64, 0, 0, canvasWidth.value, canvasHeight.value);
        ctx.draw(false, () => {
          imageLoaded.value = true;
          drawOverlay(0);
          resolve();
        });
        setTimeout(() => {
          if (!imageLoaded.value) {
            showMessage("图片加载失败", "error");
            loading.value = false;
            resolve();
          }
        }, 5e3);
      });
    }
    function drawOverlay(offsetX) {
      const ctx = common_vendor.index.createCanvasContext("captchaOverlayCanvas");
      ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
      ctx.setFillStyle("rgba(0, 0, 0, 1)");
      ctx.fillRect(offsetX, 0, canvasWidth.value - offsetX, canvasHeight.value);
      ctx.draw();
    }
    function onThumbTouchStart(e) {
      e.stopPropagation();
      startDrag(e.touches[0].clientX);
    }
    function onThumbTouchMove(e) {
      e.stopPropagation();
      moveDrag(e.touches[0].clientX);
    }
    function onThumbTouchEnd(e) {
      e.stopPropagation();
      endDrag();
    }
    function onThumbMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.clientX);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    function startDrag(clientX) {
      if (loading.value || !imageLoaded.value)
        return;
      isDragging.value = true;
      startX.value = clientX;
      trackStartTime.value = Date.now();
      track.value = [];
      message.value = "";
    }
    function moveDrag(clientX) {
      if (!isDragging.value)
        return;
      let diff = clientX - startX.value;
      const minX = 0;
      const maxX = canvasWidth.value - THUMB_WIDTH;
      if (diff < minX)
        diff = minX;
      if (diff > maxX)
        diff = maxX;
      sliderX.value = Math.round(diff);
      recordTrack(sliderX.value);
      drawOverlay(sliderX.value + THUMB_WIDTH);
    }
    function recordTrack(x) {
      track.value.push({
        x,
        t: Date.now() - trackStartTime.value
      });
    }
    function endDrag() {
      if (!isDragging.value)
        return;
      isDragging.value = false;
      verify();
    }
    async function verify() {
      try {
        showMessage("验证中...", "info");
        const res = await api_captcha.verifyCaptcha({
          captchaId: captchaId.value,
          offsetX: sliderX.value,
          track: track.value
        });
        if (res.code === 200 && res.data) {
          showMessage("验证成功!", "success");
          setTimeout(() => {
            emit("success", res.data);
            handleClose();
          }, 800);
        } else {
          showMessage(res.message || "验证失败", "error");
          setTimeout(() => {
            sliderX.value = 0;
            track.value = [];
            drawOverlay(0);
            fetchCaptcha();
          }, 1500);
        }
      } catch {
        showMessage("验证请求失败", "error");
      }
    }
    function refresh() {
      reset();
      fetchCaptcha();
    }
    function handleClose() {
      emit("close");
      reset();
    }
    function showMessage(text, type) {
      message.value = text;
      messageType.value = type;
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: _ctx.visible
      }, _ctx.visible ? common_vendor.e({
        b: common_vendor.t(tip.value || "拖动滑块直到出现对应图案"),
        c: common_vendor.o(handleClose, "44"),
        d: canvasWidth.value + "px",
        e: canvasHeight.value + "px",
        f: canvasWidth.value + "px",
        g: canvasHeight.value + "px",
        h: loading.value
      }, loading.value ? {} : {}, {
        i: !loading.value && imageLoaded.value
      }, !loading.value && imageLoaded.value ? {
        j: common_vendor.o(refresh, "e5")
      } : {}, {
        k: sliderX.value + THUMB_WIDTH + "px",
        l: sliderX.value + "px",
        m: common_vendor.o(onThumbTouchStart, "5c"),
        n: common_vendor.o(onThumbTouchMove, "19"),
        o: common_vendor.o(onThumbTouchEnd, "b1"),
        p: common_vendor.o(onThumbMouseDown, "40"),
        q: message.value
      }, message.value ? {
        r: common_vendor.t(message.value),
        s: common_vendor.n(messageType.value)
      } : {}) : {});
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-d605ff95"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/components/CaptchaSlider/CaptchaSlider.js.map
