---
categories:
- database
date: "2011-12-08T00:00:00Z"
title: Oracle 11gR1 默认设置调整
---

## 默认没有设置LOCAL_LISTENER参数

客户端登录会报错，ORA-12545: 因目标主机或对象不存在, 连接失败。有两种解决方法，一是改服务端配置（更好），二是改客户端。

### 设置 LOCAL_LISTENER
参考 MOS Notes ID 364855.1。

在两个实例上分别执行：

    SQL> alter system set LOCAL_LISTENER="(address=(protocol=tcp)(port=1521)(host=<your_vip_node1>)) scope=both sid='INSTANCE_NAME1';
    SQL> alter system set LOCAL_LISTENER="(address=(protocol=tcp)(port=1521)(host=<your_vip_node2>)) scope=both sid='INSTANCE_NAME2';

注意your_vip_node1使用ip，如果使用主机名，还是需要在客户端修改hosts文件。

### 修改客户端hosts文件

添加类似:

    172.25.198.224 racnode1-vip
    172.25.198.225 racnode2-vip

## 默认使用ADR管理日志和跟踪文件

ADR(Automatic Diagnostic Repository)是自动诊断信息库，11g新特性，用来统一管理Oracle相关的所有日志和跟踪文件。

由于监听相关的日志现在也由ADR统一管理了，导致alert log里会大量出现`TNS-12535: TNS:operation timed out`的报错信息。 11g之前，这类报错是写在sqlnet.log里的。

如果不想看到alert log里报错太多，可以将监听相关的日志改为11g前的记录方式：

1. 修改sqlnet.ora，添加： DIAG_ADR_ENABLED = OFF
2. 修改listener.ora，添加： DIAG_ADR_ENABLED_<listenername> = OFF
3. 重启或reload监听。

这个其实不需要改，只需忽略TNS类的报错就是。改了，监听相关的故障就不能通过adrci工具来诊断了。

## 默认密码策略

默认一个用户10次登录失败，会锁定用户。如果某用户不停使用错误密码登录数据
库，会导致用户被锁定，使得业务受影响。应修改此策略为不限制。

    SQL> alter profile default FAILED_LOGIN_ATTEMPTS unlimited;

默认一个用户密码如果超过180天不更改，也会锁定用户。如果你的DB密码不能经
常修改的话，此策略也应修改。

    SQL> alter profile default PASSWORD_LIFE_TIME unlimited;

## 默认审计设置

在Oracle 11g中，审计功能（AUDIT_TRAIL）是默认开启的。审计数据记录在数据
库中的SYS.AUD$表上。11g以前的版本中，审计默认是关闭的。

如果你发现AUD$这个表比较大了，检查下是哪种审计占的空间：

    SQL> select action_name,count(*) from dba_audit_trail group by action_name;

一般是LOGON和LOGOFF类型的审计最多。取消此类审计：

    SQL> noaudit session whenever successful;

一般来说，如果空间不是占的特别多，此类审计还是保留为好。可以取消对一些
登录特别频繁的用户的审计，比如DBSNMP用户：

    SQL> noaudit session by dbsnmp;

## 默认维护窗口

默认的维护窗口平时是22:00开始，持续4小时，周末6:00开始，持续20小时。

根据需要进行修改，比如7x24的系统，可以将维护窗口修改为每天0:00开始，持续4小时，周末也一样。

## 参考

- Client Connection to RAC Intermittently Fails-ORA-12545 TNS: Host or
  Object Does not Exist (Doc ID 364855.1)
- Fatal NI Connect Error 12170, 'TNS-12535: TNS:operation timed out'
  Reported in 11g Alert Log (Doc ID 1286376.1)
- Using and Disabling the Automatic Diagnostic Repository (ADR) with
  Oracle Net for 11g (Doc ID 454927.1)
- Huge/Large/Excessive Number Of Audit Records Are Being Generated In
  The Database (Doc ID 1171314.1)
