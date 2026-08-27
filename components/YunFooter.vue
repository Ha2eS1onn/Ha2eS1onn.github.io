<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// ========== 站点运行时间 ==========
const startDate = new Date('2025-09-24T00:00:00') // ← 改成你的建站时间
const runningTime = ref('')

function updateRunningTime() {
  const now = new Date()
  const diff = now.getTime() - startDate.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  runningTime.value = `${days}天${hours}小时${minutes}分${seconds}秒`
}

// ========== 不蒜子脚本加载 & 刷新 ==========
function loadBusuanzi() {
  const existing = document.getElementById('busuanzi-script')
  if (existing) return

  const script = document.createElement('script')
  script.id = 'busuanzi-script'
  script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
  script.defer = true
  document.body.appendChild(script)
}

function refreshBusuanzi() {
  if (typeof window !== 'undefined' && (window as any).busuanzi) {
    (window as any).busuanzi.fetch()
  }
}

onMounted(() => {
  updateRunningTime()
  setInterval(updateRunningTime, 1000)

  // 客户端加载不蒜子脚本
  loadBusuanzi()
  // 脚本加载需要时间，延迟刷新
  setTimeout(refreshBusuanzi, 500)
})

// 路由切换时刷新统计
watch(() => route.path, () => {
  setTimeout(refreshBusuanzi, 300)
})
</script>

<template>
  <div class="yun-footer">
    <div class="copyright">
      © 2025 - 2026 桦凇
    </div>

    <div class="footer-stats">
      <span class="stat-item">
        <span class="stat-label">(=^･ω･^=) 已运行</span>
        <span class="stat-value">{{ runningTime }}</span>
      </span>

      <span class="stat-divider">·</span>

      <span id="busuanzi_container_site_pv" class="stat-item" style="display:none">
        <span class="stat-label">总访问量</span>
        <span id="busuanzi_value_site_pv" class="stat-value" />
      </span>

      <span class="stat-divider">·</span>

      <span id="busuanzi_container_site_uv" class="stat-item" style="display:none">
        <span class="stat-label">访客数</span>
        <span id="busuanzi_value_site_uv" class="stat-value" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.yun-footer {
  text-align: center;
  padding: 1rem 0;
  font-size: 0.85rem;
  color: var(--va-c-text-light);
  line-height: 2;
}
.footer-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.3rem;
}
.stat-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.stat-label {
  opacity: 0.7;
}
.stat-value {
  font-weight: 500;
  color: var(--va-c-primary);
}
.stat-divider {
  margin: 0 0.4rem;
  opacity: 0.4;
}
</style>