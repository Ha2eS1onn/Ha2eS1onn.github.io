import { defineSiteConfig } from 'valaxy'

export default defineSiteConfig({
  url: 'https://kasho.fun',
  lang: 'zh-CN',
  title: '桦凇的小站',
  author: {
    avatar: 'https://cdn.jsdelivr.net/gh/Ha2eS1onn/image@main/images/2026/08/25/1787637241823_rf8td___.jpg',
    name: '桦凇',
    status: {
      emoji: '🫠',
      message: '该干点啥呢',
    }
  },
  favicon: 'https://cdn.jsdelivr.net/gh/Ha2eS1onn/image@main/images/2026/08/26/1787754243620_ens7t___.png',
  description: '亻尔     女 子    口 牙',
  subtitle: "Thanks for your visit!",


  // 社交媒体链接
  social: [
    {
      name: 'QQ',
      link: 'https://cdn.jsdelivr.net/gh/Ha2eS1onn/image@main/images/2026/05/24/1779610131552_7bpfa_QQ.png',
      icon: 'i-ri-qq-line',
      color: '#12B7F5',
    },
    {
      name: 'GitHub',
      link: 'https://github.com/Ha2eS1onn',
      icon: 'i-ri-github-line',
      color: '#6e5494',
    },
    {
      name: '哔哩哔哩',
      link: 'https://space.bilibili.com/1925086310',
      icon: 'i-ri-bilibili-line',
      color: '#FF8EB3',
    },
    {
      name: '微信',
      link: 'https://cdn.jsdelivr.net/gh/Ha2eS1onn/image@main/images/2026/05/24/1779610231969_44bf7___.jpg',
      icon: 'i-ri-wechat-2-line',
      color: '#1AAD19',
    },
    {
      name: 'Twitter',
      link: 'https://x.com/hua_song114514',
      icon: 'i-ri-twitter-x-fill',
      color: 'black',
    },
    {
      name: 'E-Mail',
      link: 'mailto:l14758426983@yeah.net',
      icon: 'i-ri-mail-line',
      color: '#8E71C1',
    },
  ],

  //搜索
  search: {
    enable: false,
  },

  //赞助
  sponsor: {
    enable: true,
    title: '我很可爱，请给我钱！',
    methods: [
      {
        name: '支付宝',
        url: 'https://raw.githubusercontent.com/Ha2eS1onn/image/refs/heads/main/images/2026/05/24/1779610312719_6v2y4____.jpg',
        color: '#00A3EE',
        icon: 'i-ri-alipay-line',
      },
      {
        name: '微信支付',
        url: 'https://raw.githubusercontent.com/Ha2eS1onn/image/refs/heads/main/images/2026/05/24/1779610226169_gb3cq___.png',
        color: '#2DC100',
        icon: 'i-ri-wechat-pay-line',
      },
    ],
  },
})
