<template>
  <view>
    <view>接口返回结果：</view>
    <view>{{ result }}</view>

    <button @click="handleRequest">请求接口</button>
  </view>
</template>
<script>
	import { login } from "@/api/test";
	export default {
	  data() {
	    return {
	      result: ""
	    };
	  },
	
	  methods: {
	    async handleRequest() {
	      try {
	        const res = await login({
	          name: "lisi"
	        });
	
	        console.log("接口返回：", res);
	
	        // 显示到页面
	        this.result = res;
	      } catch (err) {
	        console.error("请求失败：", err);
	        this.result = "请求失败";
	      }
	    }
	  }
	};
</script>
