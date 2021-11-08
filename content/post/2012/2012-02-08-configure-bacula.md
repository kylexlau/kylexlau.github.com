---
categories:
- sysadmin
date: "2012-02-08T00:00:00Z"
title: 配置Bacula集中备份
---

在读*Unix and Linux System Administration Handbook*第四版，第十章主要讲备份工具Bacula。Bacula是一个网络集中备份软件，可以让你在一台中心服务器上集中管理整个网络的备份。

## 安装Bacula服务端

Bacula必须要有一个catalog数据库，可以使用MySQL, SQLite或者PostgreSQL。

首先到Bacula官网下载最新稳定版源码包。详细安装手册在源码包的docs目录里有。

简单的描述，安装过程是：

* 解压源码包
* `./configure --with-mysql`
* `make; make install`

安装完Bacula执行文件后，开始在MySQL里创建Bcaula所需的数据库和表。
Bacula自带三个数据库相关操作的脚本：

* `grant_mysql_privileges`，赋权
* `create_mysql_database`，建库
* `make_mysql_tables`，建表

## 配置Bacula服务端

默认所有配置文件安装在`/etc/bacula`下。

主要配置文件：

* `bacula-dir.conf`, Director daemon
  - Catalog 资源：定义跟catalog数据库的连接。
  - Storage 资源：配置跟存储守护进程的通信。
  - Pool 资源：定义一组存储卷（文件或者磁带等）。
  - Schedule 资源：定义备份job的时间表。
  - Client 资源：定义被备份的机器信息。
  - FileSet 资源：定义备份的文件。
  - Job 资源：定义备份job，集合其他资源。
* `bacula-sd.conf`, Storage daemon
* `bacula-fd.conf`, File daemon
* `bconsole.conf`, Management console

Bacula 启停：

* `bacula Usage: /sbin/bacula {start|stop|restart|status}`

## 安装客户端
* `./configure --enable-client-only`
* `make; make install`

默认执行文件安装在`/sbin`目录，配置文件安装在`/etc/bacula`目录。

## 常见备份配置

### 配置邮件发送
配置好邮件发送后，每次备份或者恢复操作会发出邮件通知备份管理员。

使用如下命令配置邮件发送，当然首先要配置好mutt发送邮件。

    mailcommand = "/usr/bin/mutt -s \"Bacula: %t %e of %c %l\" %r"
    operatorcommand = "/usr/bin/mutt -s \"Bacula: Intervention needed for %j\" %r"

### 包含其他配置文件
每个客户端使用一个配置文件。使用如下配置包含`clientdefs`目录下的所有配置文件。

    @|"sh -c 'for f in /etc/bacula/clientdefs/*.conf ; do echo @${f} ; done'"
