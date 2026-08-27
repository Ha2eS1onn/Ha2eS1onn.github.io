import type { UserThemeConfig } from 'valaxy-theme-yun'
import { defineValaxyConfig } from 'valaxy'
import { addonWaline } from 'valaxy-addon-waline'

const safelist = [
  'i-ri-home-line',
]

export default defineValaxyConfig<UserThemeConfig>({
  siteConfig: {
    // 启用评论
    comment: {
      enable: true
    },
  },
  // 设置 valaxy-addon-waline 配置项
  addons: [
    addonWaline({
      // Waline 配置项，参考 https://waline.js.org/reference/client/props.html
      serverURL: 'https://comment.kasho.fun',
    }),
  ],
  theme: 'yun',
  themeConfig: {
     // ========== 顶部导航栏 ==========
    nav: [
      { text: '文章', link: '/posts/', icon: 'i-ri-article-line' },
      { text: '项目', link: '/projects', icon: 'i-ri-code-box-line' },  // ← 加这行
      { text: '友链', link: '/links/', icon: 'i-ri-link' },
      { text: '关于', link: '/about', icon: 'i-ri-user-line' },
    ],
    // ========== 一言 ==========
    say: {
      enable: true,
      api: '/sentences.json', // 自定义 API 链接或 public/ 下的 JSON 路径
      hitokoto: {
        enable: false,
        api: 'https://v1.hitokoto.cn/?c=l',
      },

      // ========= 美化 =========
    },
    banner: {
      enable: true,
      title: '桦凇的小站',
      cloud: {
        enable: true, // 首页下方的流动云动画
      },
    },
    fireworks: {
      enable: true,
      colors: ['#66A7DD', '#3E83E1', '#214EC2'],
    },

    // ========== 页面配置 ==========
    pages: [
      {
        name: '项目整理',
        url: '/projects/',
        icon: 'i-ri-code-box-line',
        color: 'dodgerblue',
      },
      {
        name: '友情链接',
        url: '/links/',
        icon: 'i-ri-link',
        color: 'dodgerblue',
      },
    ],

    // ========== 页脚 ==========
    footer: {
      since: 2025,
      beian: {
        enable: false,
        icp: '苏ICP备17038157号',
        police: '苏公网安备xxxxxx号',
      },
    },
  },

  unocss: { safelist },

})
