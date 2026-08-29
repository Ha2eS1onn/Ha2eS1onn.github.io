<script setup lang="ts">
interface Project {
  name: string
  desc: string
  repo: string
  site: string
  tags: string[]
}

const projects: Project[] = [
  {
    name: '个人博客',
    desc: '基于 Valaxy 的静态博客，部署在 GitHub Pages。',
    repo: 'https://github.com/ha2es1onn/ha2es1onn.github.io',
    site: 'https://kasho.fun',
    tags: ['Vue', 'Valaxy'],
  },
  {
    name: '星辞-starlit',
    desc: '3D 星图网站，使用 Three.js 构建交互式星空可视化。',
    repo: 'https://github.com/ha2es1onn/starlit',
    site: 'https://starlit.kasho.fun',
    tags: ['TypeScript', 'JavaScript', 'Three.js'],
  },
  {
    name: '米家设备管理',
    desc: 'MIJA Web Manager，一个用于管理米家智能设备的 Web 控制台。',
    repo: 'https://github.com/Ha2eS1onn/mijia-web-manager',
    site: 'https://github.com/Ha2eS1onn/mijia-web-manager',
    tags: ['React', 'Node.js', 'IoT'],
  },
  {
    name: '侨木志',
    desc: '校园树木记录站，收集校园内的树木信息。',
    repo: 'https://github.com/Ha2eS1onn/campus-tree-map',
    site: 'https://tree.kasho.fun/',
    tags: ['HTML', 'Leaflet', 'GIS'],
  }
]
</script>

<template>
  <div class="project-grid">
    <div v-for="p in projects" :key="p.name" class="project-card">
      <!-- 上半部分：自适应撑开 -->
      <div class="project-body">
        <h3 class="project-name">{{ p.name }}</h3>
        <p class="project-desc">{{ p.desc }}</p>
        <div class="project-tags">
          <span v-for="tag in p.tags" :key="tag" class="project-tag">
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- 下半部分：始终固定在底部 -->
      <div class="project-actions">
        <a :href="p.repo" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">
          <span class="i-ri-github-line" />
          仓库
        </a>
        <a :href="p.site" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          <span class="i-ri-external-link-line" />
          站点
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.project-card {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid var(--va-c-divider);
  background: var(--va-c-bg-soft);
  transition: all 0.3s ease;
}

.project-card:hover {
  border-color: var(--va-c-primary);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.project-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.project-name {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--va-c-primary);
}

.project-desc {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--va-c-text);
  opacity: 0.75;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: calc(0.9rem * 1.6 * 2);
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: auto;
  min-height: 1.6rem;
}

.project-tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--va-c-primary);
  color: white;
  opacity: 0.85;
  white-space: nowrap;
}

.project-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--va-c-divider);
}

/* ========== 修复后的按钮样式 ========== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.45rem 0;
  border-radius: 0.45rem;
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  /* 去掉纯色背景，用透明/主题背景 */
  background: transparent;
  color: var(--va-c-text);
  border: 1px solid var(--va-c-divider);
}

.btn:hover {
  border-color: var(--va-c-primary);
  color: var(--va-c-primary);  /* 文字变主题色 */
  /* 背景保持透明，不要设成 var(--va-c-primary)！ */
  background: transparent;
}
</style>