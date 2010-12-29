---
layout: post
title: Github Page 绑定域名
---

# {{ page.title }}

## CNAME

创建一个CNAME文件，内容是你的域名，如：

<code>
xlau.org
</code>

然后把此文件添加到github仓库，上传到github。github服务器会设置
`xlau.org`为你的主域名，然后将`www.xlau.org`和`kylexlau.github.org`重定
向到`xlau.org`。

## DNS

登陆你的域名管理界面。创建一条A记录，指向`207.97.227.245`这个IP地址。

如果是用子域名，如`kyle.xlau.org`。只需要创建一条CNAME记录，指向
`kylexlau.github.org`。

## 我用子域名

我以`kyle.xlau.org`为我的博客域名，指向github page。

`xlau.org`仍然指向我的免费的Amazon EC2。等EC2收费了，我会再买个VPS玩。

