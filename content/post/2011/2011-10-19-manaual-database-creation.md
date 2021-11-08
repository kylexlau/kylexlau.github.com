---
categories:
- database
date: "2011-10-19T00:00:00Z"
title: Oracle 手工建库(10g RAC)
---

## 简介

最权威的参考文档是MOS的文档 [Doc ID 240052.1] [mos1] 和 [Doc ID 137288.1] [mos2] 。

大致做法是，先写一个pfile文件，用pfile启动Oracle实例，然后执行create database语句，创建数据库。建好数据库后，用Oracle提供的脚本导入数据字典和一些官方PL/SQL包。

主要的导入脚本是：

* CATALOG.SQL： 创建数据字典和动态性能视图。
* CATPROC.SQL： 创建官方PL/SQL包。
* CATCLUST.SQL： 创建RAC相关视图。

在pfile里指定control file文件的位置，指定undo表空间的名字。block大小也在pfile里指定。pfile里指定的一些dump相关目录要先创建好。

在创建数据库的语句里，需要指定system表空间使用的数据文件大小和路径，指定undo表空间的名字和数据文件大小和路径，至少指定两组重做日志的大小和文件路径，10g的库还要指定sysaux表空间使用的数据文件大小和路径。数据库的字符集也需要在创建数据库时指定。默认表空间和默认temp表空间，以及sys和system用户密码也可以在建库语句里指定。

建库语句里，还需要指定一些数据库的限制，比如数据文件最大数量、实例最大数量、重做日志文件最大数量、每组重做日志文件的成员最大数量等。

如果是RAC库，再加一个线程2的两组重做日志，并启用此线程的重做日志。

## 详细步骤

### 创建目录

```bash
mkdir -p /u01/app/oracle/admin/dcs/{adump,bdump,cdump,dpdump,hdump,pfile,udump}
```

### 启动数据库

pfile的内容，可以随便找一个当前库的修改下就行。

### 建库语句

```sql
CREATE DATABASE test
CONTROLFILE REUSE
MAXINSTANCES 32
MAXLOGHISTORY 100
MAXLOGFILES 64
MAXLOGMEMBERS 5
MAXDATAFILES 1024
DATAFILE '/dev/rdb_system01' SIZE 2046M REUSE
SYSAUX DATAFILE '/dev/rdb_sysaux01'SIZE 4094M REUSE
TEMPORARY TABLESPACE TEMP TEMPFILE '/dev/rdb_temp01' SIZE 8190M REUSE
DEFAULT TABLESPACE USERS DATAFILE '/dev/rdb_users01' SIZE 8190M REUSE;
UNDO TABLESPACE UNDOTBS1 DATAFILE '/dev/rdb_undo11' SIZE 8190M REUSE
CHARACTER SET ZHS16GBK
LOGFILE GROUP 1 ('/dev/rdb_redo111','/dev/rdb_redo112') SIZE 255M REUSE,
GROUP 2 ('/dev/rdb_redo121','/dev/rdb_redo122') SIZE 255M REUSE;
```

### 执行创建对象的脚本

```sql
conn sys/change_on_install
@?/rdbms/admin/catalog.sql;  -- 数据字典，必选
@?/rdbms/admin/catproc.sql; --时间特别长, 必选
@?/rdbms/admin/catblock.sql; -- 如果想从一些视图中看到lock的信息运行
@?/rdbms/admin/catclust.sql; -- 10g 有关rac的数据字典脚本

connect system/manager
@?/sqlplus/admin/pupbld.sql;
@?/sqlplus/admin/help/hlpbld.sql helpus.sql;

-- 重新编译下所有无效对象
@?/rdbms/admin/utlrp.sql;
```

### 创建实例2的重做日志和undo表空间

```sql
ALTER DATABASE ADD LOGFILE
THREAD 2 GROUP 3 ('/dev/rdb_redo231','/dev/rdb_redo232') SIZE 255M REUSE,
GROUP 4 ('/dev/rdb_redo241','/dev/rdb_redo242') SIZE 255M REUSE;

ALTER DATABASE ENABLE PUBLIC THREAD 2;

CREATE UNDO TABLESPACE "UNDOTBS2" DATAFILE '/dev/rdb_undo21' SIZE 8190M REUSE;
```

### 创建密码文件

```bash
orapwd file='/tmp/rdb_pwdfile' password=change_on_instal
dd if='/tmp/rdb_pwdfile' of='/dev/rdb_pwdfile' bs=4k
ln -s /dev/rdb_pwdfile $ORACLE_HOME/dbs/orapwdcs1
ln -s /dev/rdb_pwdfile $ORACLE_HOME/dbs/orapwdcs2
```

### 注册到CRS

```bash
srvctl add database -d test -o $ORACLE_HOME -p /dev/rdb_spfile
srvctl add instance -d test -i test1 -n testdb1
srvctl add instance -d test -i test2 -n testdb2
```

## 总结

手工建库不难，我觉得比起DBCA建库它还要更加可靠。手工建库虽然稍微复杂点，但可以让你更深入的理解Oracle的运行机制，对DBCA这个工具也会有更深入的理解。比如，我现在就认识到，DBCA其实只是这些命令行的一个图形界面的包装，实际调用的还是跟手工执行的命令一样的脚本。

[mos1]: https://supporthtml.oracle.com/ep/faces/secure/km/DocumentDisplay.jspx?id=240052.1
[mos2]: https://supporthtml.oracle.com/ep/faces/secure/km/DocumentDisplay.jspx?id=137288.1
