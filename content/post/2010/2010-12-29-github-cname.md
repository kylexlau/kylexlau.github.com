---
date: "2010-12-29T00:00:00Z"
title: Github Page 绑定域名
---

## CNAME

创建一个CNAME文件，内容是你的域名，如：

<code>
xlau.org
</code>

然后把此文件添加到Github仓库，上传到Github。Github服务器会设置`xlau.org`为你的主域名，然后将`www.xlau.org`和`kylexlau.github.com`重定向到`xlau.org`。

## DNS

登陆你的域名管理界面。创建一条A记录，指向`207.97.227.245`这个IP地址。

如果是用子域名，如`kyle.xlau.org`。只需要创建一条CNAME记录，指向`kyle.xlau.org`。

## 子域名

我以`kyle.xlau.org`为我的博客域名，指向Github Page。

我需要做的设置：

 * 创建CNAME文件，内容为`kyle.xlau.org`。
 * 登陆域名管理，创建CNAME记录，`kyle -> kylexlau.github.com`。

Github虽然很好，可毕竟是免费的，还是有不少限制的。写到这里，特意去看了下Github对免费用户究竟有什么限制。发现除了300M的空间限制（还是所谓软限制），没有其他限制。所以用它来作为博客平台，真是再理想不过了。

但是我还是将`xlau.org`和`www.xlau.org`指向免费的Amazon EC2，毕竟这个要强大多了。等明年EC2收费了，我也许要再买个VPS玩玩。
