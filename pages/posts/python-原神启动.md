---
title: python-原神启动
date: 2025-09-25 04:03:19
tags:
 - Python
categories:
 - 开发
---

<pre><code>
import tkinter as tk
from tkinter import messagebox
import webbrowser
import time


a_url = 'https://ys.mihoyo.com'
b_url = 'https://ys.mihoyo.com/cloud/?utm_source=default#/'
c_url = 'https://autopatchcn.yuanshen.com/client_app/download/launcher/20250729110751_0o5cKaH6l8f6g2dd/pcbackup317/yuanshen_setup_202507212010.exe'


# 网页a
webbrowser.open(a_url)
time.sleep(2.5)


# 网页b
webbrowser.open(b_url, new=2)

#下载
webbrowser .open(c_url, new=3)
def show_popup():
    messagebox.showinfo("原神启动", "原神启动")

# 创建主窗口
root = tk.Tk()
root.withdraw()  # 隐藏主窗口

# 全屏弹窗
show_popup()
# 启动事件循环
root.mainloop()
</code></pre>

----------------------------------------------

一个无聊的恶搞程序 运行打开原神官网并下载 还有打开云原神登录界面 最后是文本弹窗 **“原神启动”**


### [下载链接](https://ha2es1onn.lanzouu.com/ituCt37hfc4j)