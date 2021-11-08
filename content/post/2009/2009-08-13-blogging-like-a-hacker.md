---
categories:
- translation
date: "2009-08-13T00:00:00Z"
title: 像黑客一样写博客
---

2016年1月修改：Github Pages 5月1日后不再支持Textitle格式，修改格式为Markdown。

用Jekyll来重建我博客。先翻译一篇Jekyll作者的文章。

[原文地址](http://tom.preston-werner.com/2008/11/17/blogging-like-a-hacker.html) 和 [原文源代码](http://github.com/mojombo/tpw/raw/03fa4247b2f4ba620661d9025c336f167aa11ba2/_posts/2008-11-17-blogging-like-a-hacker.textile)

译文：

2000年时，我以为我将成为一个专业作家。于是我跟其他一些有抱负的诗人和作家一起，每天花几个小时在LiveJournal上练习写作。从那时起，我已经先后在三个不同的域名下写过博客。我写过的博客内容包括：web标准、印刷设计（print design）、摄影、Flash、插图（illustration）、信息架构、ColdFusion、软件包管理（package management）、PHP、CSS、广告、Ruby、Rails、Erlang。

我热爱写作。我喜欢与别人分享我的思想。将想法转变成文字，能非常有效地深化对某一话题的思考。但虽然我很喜欢写博客，我却陷入了一个循环，放弃一段，又继续开始。在这次又重新开始写博客前，我做了一些反省，试图找到造成这种恶性循环的原因是什么。

我已经知道什么是我不想要的。我厌倦了那些复杂的博客管理系统，如WordPress和Mephisto。我只想写些好文章，而不是整天修改页面模板，审核评论，升级博客系统。Posterous看起来不错，但我想控制自己博客的样式，选择自己的独立域名。基于同样的理由，其他一些提供博客服务的站点，如wordpress.com和blogger.com，均不符合我的要求。有些人直接用GitHub写博客，这很酷，但不符我的口味。

2008年10月19日，星期六，我坐在旧金山的公寓里，手拿一杯苹果汁，头脑清醒。经过一阵沉思，我有了个好注意。我不是一个专业的散文作家，我是个专业程序员。如果我以软件开发的角度看待写博客，那将会是什么样子的？

首先，所有我的作品都将保存在一个Git仓库里。这让确保我可以在我偏爱的文本编辑器和命令行下，舒服地尝试各种想法的写作，浏览已写文章。我将可以用一个简单的部署脚本或者是提交后钩子（post-commit hook）发布文章。为保持最小的复杂性，相对一个需要不断维护的动态网站，静态网站更好。我的博客必须容易自定义。我的美工（graphic design）背景让我喜欢经常调整网站的外观和布局。

在过去的几个月里，我写了Jekyll来实现这些概念。Jekyll是一个简单的，适合博客的（blog aware），静态网站生成器。输入一个模板目录（代表网站的原始形态），经过Texitile和Liquid转换，输出一个完全静态的网站。如果你在我的网站上阅读本文，你看到的就是一个用Jekyll生成的博客网站（译者的网站也是）。

想理解这究竟是如何工作的，在新窗口打开我的 [TPW](http://github.com/mojombo/tpw) Git仓库。我将参照那里的代码来解释。

首先看 [index.html](http://github.com/mojombo/tpw/tree/master/index.html). 这是网站的首页。此文件的最上面几行是一段包含文件元数据的YAML代码。这些元数据告诉Jekyll，此文件该使用什么模板，页面的标题该是什么，等等。此文件里，我指定使用default模板。模板文件都在 [_layouts](http://github.com/mojombo/tpw/tree/master/_layouts) 文件夹里。如果你打开 [default.html]http://github.com/mojombo/tpw/tree/master/_layouts/default.html) 文件，将看到主页是由index.html包裹在此模板中而生成的。

你同样将注意到这些文件里有Liquid模版引擎代码。Liquid是一种简单的，可扩展的模版语言，它令数据更容易嵌入到模版里。我希望在我的主页上显示我的文章列表。Jekyll生成一个散列表（Hash),包含关于我网站的各种数据。<code>site.posts</code>是我所有博客文章的一个按时间由近及远顺序的列表。每篇文章，又包含几个字段，如标题（title）和时间（date）。

Jekyll解析（parsing）在`_posts`目录中的文件，以获取博客文章的列表。每篇文章文件标题里包括有，最终生成静态HTML文件的发布日期和略缩名（slug，出现在URL中的名字）。打开本文的源码， [2008-11-17-blogging-like-a-hacker.textile](http://github.com/mojombo/tpw/tree/master/_posts/2008-11-17-blogging-like-a-hacker.textile). GitHub默认会转换textile文件，为了更好的理解，请打开文件的 [原始形式](http://github.com/mojombo/tpw/tree/master/_posts/2008-11-17-blogging-like-a-hacker.textile?raw=true). 文件里我指定了使用`post`模版。如果你打开 [post.html](http://github.com/mojombo/tpw/blob/03fa4247b2f4ba620661d9025c336f167aa11ba2/_layouts/post.html) 文件，会发现这里有一个嵌套模版的例子。模版里可以包含其他模版，这使你有更大的灵活性去指定页面显示。我用嵌套模版，是为了显示相关文章。

Jekyll用一种特殊的方式处理文章源文件。文件名中指定的日期用来构造生成网站的URL。比如这篇文章，最后生成的URl地址是`http://tom.preston-werner.com/2008/11/17/blogging-like-a-hacker.html`。

非下划线开头的目录中的文件，将直接复制到生成网站中的对应目录。如果一个文件不是以YAML代码段开头，Liquid解释器将略过它。二进制文件也将直接复制。

为了将你的原始网站转换到静态网页版本，只需在命令行中输入：

<pre class="terminal"><code>$ jekyll /path/to/raw/site /path/to/place/generated/site</code></pre>

Jekyll仍然是一个非常年轻的项目。我仅仅开发出我所需要的那些功能。我希望这个项目能慢慢成熟起来，支持更多的功能。如果你用Jekyll搭建了你的博客，请发邮件告诉我，在Jekyll未来的版本里你需要些什么功能。更好的方法是，在GitHub上克隆（fork）这个项目，然后修改（hack），加上你自己需要的功能。

我已经使用Jekyll超过1个月了。我爱它。非常有益的是，驱使我开发Jekyll的动力源自我自己博客的需要。我能在TextMate里编辑我的文章，它支持自动拼写检查。我能随时修改CSS和页面模版。所有东西备份在GitHub上。写这篇文章时，我感觉很轻松。系统简单到我能控制整个的转换过程。我脑海和我博客间的距离缩短了。我想它会让我成为一个更好的博客作者。

<code>--EOF--</code>
