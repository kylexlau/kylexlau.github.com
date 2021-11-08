---
categories:
- database
date: "2011-12-10T00:00:00Z"
title: Oracle RAC 共享密码文件
---

## 问题

RAC环境下，如果各节点都有自己的密码文件，修改SYS密码需要在每个实例下执行修改命令。

环境1：

* OS: AIX 6.1
* Oracle Version: 10.2.0.4 RAC
* Oracle Storage: RAW

环境2：

* OS: RHEL 5.5
* Oracle Version: 11.1.0.6 RAC
* Oracle Storage: OCFS + ASM

## 解决

使用符号链接，将各节点的密码文件指向共享存储上的一个文件。

### 裸设备

用dd将密码文件复制到共享裸设备。注意，AIX系统下必须指定4k的偏移。

    shell$ cd $ORACLE_HOME/dbs
    shell$ dd if=orapwdSID of=/dev/rdb_pwdfile bs=4k seek=1

建立符号链接，在所有节点执行。

    shell$ cd $ORACLE_HOME/dbs
    shell$ ln -s /dev/rdb_pwdfile orapwdSID

### OCFS

复制密码文件到OCFS共享文件系统下。

    shell$ cp $ORACLE_HOME/dbs/orapwdSID /share_config/orapwd

建立符号链接，在所有节点执行。

    shell$ cd $ORACLE_HOME/dbs
    shell$ ln -s /share_config/orapwd orapwdSID
