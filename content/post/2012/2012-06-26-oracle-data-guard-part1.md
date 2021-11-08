---
categories:
- translation
date: "2012-06-26T00:00:00Z"
published: true
title: Oracle 11g Data Guard 物理备库快速配置指南（上）
---

## 缘起

最近做了10g和11ｇ的物理备库配置实验，发现 Data Guard 其实很容易，但是缺少好文档。我是参考官方文档做的实验，觉得它写的不是很清楚的。

Google 出来两个pdf文档，读了觉得比官方文档强很多。翻译下，也许会对某些朋友有用。翻译的同时我也好更熟悉下这两个文档。好久没翻译过英文了，可以顺便练练手。

原文档下载地址（墙外）：

* [Configure Dataguard 11gR2 Physical Standby Part 1](http://tinky2jed.files.wordpress.com/2011/03/configure-dataguard-11gr2-physical-standby-part-i.pdf)
* [Configure Dataguard 11gR2 Physical Standby Part 2](http://tinky2jed.files.wordpress.com/2011/05/configure-dataguard-11gr2-physical-standby-part-ii1.pdf)

## 第一部分
### 简介

Data Guard 是 Oracle 数据库的一个功能，能够提供数据库的冗余。冗余是通过创建一个备用（物理复制）数据库实现，备库最好是在不同的地理位置或者在不同的磁盘上。备库通过应用主库上的变化来保持数据同步。备库可以使用重做日志应用(物理备库)或SQL应用同步(逻辑备库)。

本文旨在说明 Data Guard 的配置并不复杂，不需要特殊的技能或者培训才能学会搭建。它将快速展示给读者搭建一个物理备库的过程。我的目标是，即使你第一次接触 Data Guard，刚考虑要使用它或担心它会不会很难配置，本文将帮助你快速搭建起一个正常运行起来的物理备库。

### 为什么使用 Data Guard

每种 Oracle 高可用性工具都有其目的。使用 Data Guard 的理由有：

* 整个数据库的冗余
* 故障时的快速恢复
* 故障后客户端能自动重连
* 在备库运行备份
* 较好的故障平均修复时间
* 并不复杂

### 系统环境

在写完本文后，我使用 DBCA 创建了一个新数据库 `JED`，然后重新运行了文中的配置步骤，确认其对一个基本的 Oracle 11g 数据库适用。主库叫 `JED`，运行在一台叫 `dev-db1`的服务器上。备库叫 `JED2`，运行在一台叫 `dev-db2` 的服务器上。

### 不需要提的基本前提

有一些任何生产库都应该有的基本的设置。其中一个就是归档模式。对于生产库，这应该是一个明显的必须配置。如果你的生产库没有适用归档模式，你要么需要马上开始读点书，要么你得有一个非常非常好的理由。我不大确定谁真能找出一个理由，但任何准则都有例外。

如何修改你的数据库为归档模式：

	SQL> shutdown immediate
    SQL> startup mount
	SQL> alter database archivelog;
	SQL> alter database open;
	SQL> archive log list;

### 主库准备

首先，备库要成为主库的完全相同的复制，它必须接收来自主库的重做日志。Oracle 数据库中，一个用户可以用指定某操作不产生日志(比如使用 `NOLOGGING` 语句）。对于备库来说，这是个问题。你必须确认用户无法指示数据库不产生重做日志，这需要启用数据库的强制日志功能。启用方法如下：

	SQL> alter database force logging;
	SQL> select name, force_logging from v$database;

你应该看到 `force_logging` 列为 `YES`。

其次，你要确认当主库添加或删除数据文件时，这些文件也会在备库添加或删除。启用此功能的方法如下：

	SQL> alter system set standby_file_management = 'AUTO';

再次，我们要确认书库有备用日志文件(Standby Log Files)。备库使用备用日志文件来来保存从主库接收到的重做日志。主库上也建立备用日志文件有两个原因，一是主库可能转换成备库，备库需要备用日志，二是如果主库建了备用日志，备库会自动建。备用日志应该跟在线日志一样大，组数应该至少跟在线日志一样多，或者更多。我喜欢给备用日志一个跟在线日志不同范围的编号，比如在线日志组是1到6，备用日志就是11到16。创建备用日志的方法如下：

	SQL> alter database add standby logfile group 11 ('/oradata/JED/g11m01.sdo','/oradata/JED/g11m02.sdo') size 50M;

如果你不是使用 `SSL` 做重做日志传输验证(一般来说不会)，那么你需要使用密码文件做验证。你必须创建密码文件，并且设置参数 `REMOTE_LOGIN_PASSWORDFILE` 为 `EXCLUSIVE` 或 `SHARED`。一般数据库默认就有密码文件，并且此参数默认为 `EXECUSIVE`。先检查下这两项，如果不是默认，设置方法如下：

	SQL> alter system set remote_login_passwordfile=exclusive scope=spfile;
	OS> orapwd password=<sys 用户密码>

最后，检查数据库的 `db_unique_name` 参数是否设置。如果没有，使用 `alter system` 进行设置：

	SQL> show paramter db_unique_name;
	SQL> alter system set db_unique_name=some_name scope=spfile;

### 闪回数据库

我强烈建议开启数据库闪回功能。闪回允许你将数据库还原到以前的某一时间点。当发生故障转移时，这个功能非常有用，它能让你将老的主库闪回到故障前，然后将其转换为备库。如果没有启用闪回功能，你就必须重建备库，意味着要再复制一次数据文件。除了这个好处，闪回还能在某些情况下让你避免从备份恢复数据。

启用闪回功能，必须先配置快速恢复区(Flash/Fast Recovery Area). 方法如下：

	SQL> alter system set db_recovery_file_dest='&快速恢复区目录或ASM磁盘组名';
	SQL> alter system set db_recovery_file_dest_size=400G;

配置好快速恢复区后，就可以启用闪回日志功能：

	SQL> alter database flashback on;
	SQL> select flashback_on from v$database;

`FLASHBACK_ON` 这列的值应该是 `YES`。如果你碰到 `ORA-01153` 报错，那一定是在备库进行此操作。你需要先取消重做日志应用，启用闪回日志，然后重新启用日志应用。

在主库启用闪回日志，不会同步备库也启用。你必须手动在主库和备库上均启用闪回日志。如果不启用闪回日志，当出现故障转移时，你将需要完全重新开始创建一个备库。

### SQL*NET 配置

在创建备库前，要确认两台服务器的数据库之间能通信，如果我们要用 RMAN 的 `duplicate from active database` 命令创建备库的话。我们需要配置监听和 TNS 名。你可以手动配置，也可以使用网络配置工具(netca)。我更喜欢手动配置，因为我比较老派，并且这些配置文件又不复杂，

首先需要配置主备库的监听。虽然数据库会自动注册监听，但如果要使用 RMAN 的 `duplicate` 命令创建备库，备库必须首先处于 `NOMOUNT` 状态。在 `NOMOUNT` 状态下，数据库实例不会自动注册监听，你必须配置静态监听。另外必须要注意的一点是，`NOMOUNT` 状态下的数据库必须使用专用模式(`dedicated server`)连接。

两台服务器上的 TNS 名字文件必须配置好，让主备库能用 `LOG_ARCHIVE_DEST_N` 和 `FAL_SERVER` 参数（稍后会介绍这些参数）中的服务名(Service Names）找到对方。具体配置应类似下例。

主库(dev-db1)的监听配置：

	SID_LIST_LISTENER=
		(SID_LIST =
			(SID_DESC =
				(GLOBAL_DBNAME = JED)
				(ORACLE_HOME = /oracle/product/11.2.0)
				(SID_NAME = JED)
			)
		)

备库(dev-db2)的的监听配置：

	SID_LIST_LISTENER=
		(SID_LIST =
			(SID_DESC =
				(GLOBAL_DBNAME = JED2)
				(ORACLE_HOME = /oracle/product/11.2.0)
				(SID_NAME = JED2)
			)
		)

主库的 TNS 名字文件配置：

	JED2 =
	  (DESCRIPTION =
	    (ADDRESS = (PROTOCOL = TCP)(HOST = dev-db2)(PORT = 1521))
	    (CONNECT_DATA =
	      (SERVER = DEDICATED)
	      (SERVICE_NAME = JED2)
	    )
	  )

备库的 TNS 名字文件配置：

	JED =
	  (DESCRIPTION =
	    (ADDRESS = (PROTOCOL = TCP)(HOST = dev-db1)(PORT = 1521))
	    (CONNECT_DATA =
	      (SERVER = DEDICATED)
	      (SERVICE_NAME = JED)
	    )
	  )

### 重做日志传输配置

现在主备库之间依旧可以互相通信了，下一步是配置归档位置和重做日志传输。我们将先在主库上进行配置，然后等备库创建好后，修改备库的配置。

配置归档位置：

	SQL> alter system set log_archive_dest_1 = 'location=use_db_recovery_file_dest valid_for=(all_logfiles, all_roles) db_unique_name=JED';

这个命令指定快速恢复区作为归档位置，此归档位置用于在所有数据库角色下归档所有的日志文件。官方文档里说使用 `valid_for=(online_logfiles, all_roles)`，这将导致备库无法归档备用日志文件，因为它们不是在线日志。但如果使用 `all_logfiles` 选项，主备库将都能归档在线以及备用日志。如果你想在备库进行备份，并同时备份归档日志的话，必须使用 `all_logfiles`。

然后配置重做日志传输到备库：

	SQL> alter system set log_archive_dest_2 = 'service=JED2 async valid_for=(online_logfile,primary_role) db_unique_name=JED2';

这条语句说，如果这是主库，就使用服务名 `JED2` 传输在线日志，目标库名叫 `JED2`。

要注意`STANDBY_ARCHIVE_DEST` 参数不需要，已经被官方弃用。当调试时，不少人好心建议我设置此参数，但设置此参数后启动数据库，只会报 `ORA-32004: obsolete or deprecated parameter(s) specified for RDBMS instance` 错。

另一个要设置的参数是 `FAL_SERVER`。这个参数指定当日志传输出现问题时，备库到哪里去找缺少的归档日志。它用在备库接收的到的重做日志间有缺口的时候。这种情况会发生在日志传输出现中断时，比如你需要对备库进行维护操作。在备库维护期间，没有日志传输过来，这时缺口就出现了。设置了这个参数，备库就会主动去寻找那些缺少的日志，并要求主库进行传输。

	SQL> alter system set fal_server = 'JED2';

注意 `FAL_CLIENT` 参数在11g里已经弃用。

然后我们要让主库知道 Data Guard 配置里的另外一个库的名字：

	SQL> alter system set log_archive_config = 'dg_config=(JED,JED2)';

这一步做完后，我们就可以准备好备库的环境，并开始创建备库了。

### 备库环境准备

现在开始准备备库环境。有很多种方法来执行这些步骤。我这里写的是我觉得最适合我的方法。你应该实验多种方法，看哪种比较适合你。

首先，我们要为备库创建密码文件和参数文件(spfile)。密码文件可以直接复制过去，只需要改下名字就行。比如，主库上的密码文件是 `$ORACLE_HOME/dbs/orapwJED`。我们把它复制到备库服务器的相同位置，用备库的 `SID` 取代主库，修改其名字为 `orapwJED2`。

为了创建备库 `spfile`，先创建一个启动参数文件(`pfile`)：

	SQL> create pfile from spfile;

我想介绍一个看起来挺不错新功能，使用 `RMAN` 创建备库 `SPFILE`。我不使用这个功能的理由是：

1. 反正我也需要复制密码文件到备库服务器，所以它并没有节省我复制文件的时间。
2. 要使用这个功能，你仍然需要使用 `parameter_value_convert` 参数做很多替换工作，还有使用 `SPFILE` 语句和多个 `SET` 语句以确保一切正确。

我发现复制 `pfile` 过去更容易(你甚至可以直接粘贴复制)，只要改下名字，然后改几个里面的参数就行。这很容易，你也可以在手动修改和调试的过程中学到很多。我发现手动改比用 `RMAN` 的 `SPFILE`创建功能更快。

创建好了主库的 `pfile` 后，将其复制到备库服务器的相同位置，使用备库的 `SID` 修改其名字。你需要对 `pfile` 做如下修改：

* 根据你备库的配置和文件位置，你可能需要修改 `AUDIT_FILE_DEST`，`CONTROL_FILES` 和 `DISPATCHERS` 参数（也许还有其他需要修改的参数）。
* `LOG_ARCHIVE_DEST_1` 参数中的 `db_unique_name` 修改为备库的相应唯一名（这里是 `JED2`）。
* `LOG_ARCHIVE_DEST_2` 参数，修改为主库对应的服务名和数据库唯一名（这里是 `JED`）。
* `FAL_SERVER` 参数修改指向主库的服务名。
* 增加如下参数：
  * `db_unique_name=JED2`
  * `db_file_name_convert` 和 `log_file_name_convert`。如果主备库的数据文件、日志文件位置不同，需要设置这两个参数。

然后在备库服务器上创建所需目录结构和修改相关文件。至少需要修改如下创建目录和文件：

* `$ORACLE_BASE/admin/$ORACLE_SID`
* `$ORACLE_BASE/admin/$ORACLE_SID/adump`（`audit_file_dest`配置的目录）
* 数据文件目录
* 控制文件目录
* 日志文件目录
* 快速恢复区目录
* 将备库信息加到 `/etc/oratab` 文件

现在可以准备启动备库实例来创建数据库了。在启动过程中创建一个 `spfile`。

	SQL> startup nomount pfile=initJED2.ora
	SQL> create spfile from pfile;
	SQL> shutdown
	SQL> startup nomount
	SQL> show parameter spfile
	SQL> exit

`show parameter spfile` 显示 `spfile` 的位置，这时备库处于 `NOMOUNT` 状态。

### 备库创建

就像之前的步骤一样，创建数据库这一步也可以有多种方法。在11g中，我将使用 `RMAN` 的复制功能，因为它很容易。在上一步里，我们复制了密码文件和参数文件到备库服务器，修改好了参数文件，并创建了 `spfile`。这让使用 `RMAN` 复制功能更加容易，当然，你也可以跳过手工复制密码和参数文件这步，让 `RMAN` 使用 `SPFILE`，`PARAMETER_VALUE_CONVERT` 和 `SET`等命令帮你自动完成。

使用 `RMAN` 创建备库的命令非常简单。它指示 `RMAN` 直接复制当前活动的数据库（主库）到辅助数据库（备库）。这样你就不需要现将主库的备份复制到备库服务器上，再还原数据库。在今天的存储技术下，我们有更快更简单的方式复制数据库，但为了展示11g的这个新功能，并且这个功能又很简单，我喜欢尽可能使用它。

	RMAN> connect target sys@JED
	RMAN> connect catalog <catalogowner>@<catalogdb>
	RMAN> connect auxiliary sys@JED2
	RMAN> duplicate target database for standby from active database;

在 `11.2.0.2.0` 版本后，你可以直接使用 `connect target` 连接辅助数据库，但如果不指定用户名和密码，在复制到备库时将报 `invalid username/password` 错。

当复制命令在执行时，我喜欢 `tail` 备库的告警日志文件，观察复制进行到了哪一步和查看是否有报错。注意，针对在线和备用日志文件报 `ORA-27037: unable to obtain file status` 错是正常的。

你也可以并行复制以提高性能。需要分派主库和备库多个通道后，再执行复制命令：

	run
	{
		allocate channel chan1 type disk;
		allocate channel chan2 type disk;
		allocate channel chan3 type disk;
		allocate channel chan4 type disk;
		allocate auxiliary channel aux1 type disk;
		allocate auxiliary channel aux2 type disk;
		allocate auxiliary channel aux3 type disk;
		allocate auxiliary channel aux4 type disk;
		duplicate target database for standby from active database;
	}

如果一切正常，你将看到 `RMAN` 报出类似如下信息：

	Finished Duplicate Db at 07-MAY-10

当备库复制完成后，我喜欢在备库启用闪回日志：

	SQL> alter database flashback on;

### 启动重做日志应用

启动或者停止重做日志应用非常容易。启动日志应用：

	SQL> ALTER DATABASE RECOVER MANAGED STANDBY DATABASE USING CURRENT LOGFILE
DISCONNECT FROM SESSION;

这个命令指示备库开始使用备用日志文件进行恢复。它也告诉备库命令完成后回到命令行界面。如果你想停止恢复：

	SQL> ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;

### 确认日志应用正常

你要确认重做日志正在应用到备库。首先我们要确认主备库里的归档目的地配置都是有效的：

	SQL> select DEST_ID, STATUS, DESTINATION, ERROR from V$ARCHIVE_DEST where DEST_ID<=2;

目的地状态应该显示为 `VALID`。

然后确认重做日志是否真的被应用了，在主库执行：

	SQL> select SEQUENCE#, FIRST_TIME, NEXT_TIME, APPLIED, ARCHIVED from V$ARCHIVED_LOG where name = 'JED2' order by FIRST_TIME;

如果归档和日志应用均正常，`APPLIED` 和 `ARCHIVED` 列都应该是 `YES`。很多教程里都让这个查询以 `SEQUENCE#` 列排序，但我不推荐。如果以 `SEQUENCE#` 列排序，当你做了一次故障转移后，序列号会再从1开始，这时使用这个查询，你将不能在结果最后看到最新的记录。我曾经很奇怪为什么查不到新记录，其实是因为新记录不是出现在最后，我没看到。所以，这个查询都是以 `FIRST_TIME` 列排序。

如果你发现日志没有被应用，那可能是重做日志有了缺口，这种情况下备库无法进行日志应用。但如果你的 `FAL_SERVER` 参数设置正确，这应该不会有问题。你可以在主库上检查是否有重做日志缺口：

	SQL> select STATUS, GAP_STATUS from V$ARCHIVE_DEST_STATUS where DEST_ID = 2;

如果一切正常，应该返回 `VALID` 和 `NO GAP`。如果你想测试下 `FAL_SERVER` 这个参数是怎么工作的。可以先把备库关掉，然后在主库切换几次日志，等一会，启动备库，再切换一次日志。这样缺口很快就会出现。如果 `FAL_SERVER` 设置正常，缺少的重做日志会被传输过来并应用。

`V$DATAGUARD_STATUS` 视图对查找错误和了解发生了什么非常有用。可以在主备库上执行以下查询查看数据库状态：

	SQL> select * from V$DATAGUARD_STATUS order by TIMESTAMP;

有时候你手工想确认下数据真的同步了。一个更让人信服的方法是，直接查询备库，看新数据是否存在。你可以将备库打开为只读状态，首先取消日志应用，再执行如下命令：

	SQL> ALTER DATABASE OPEN READ ONLY;

这时你可以查询变化了的数据是否同步过来。11g已经支持活动备库，可以让数据库在只读状态下打开，同时启动日志应用。

### 总结

现在你有一个配置好的 `Data Guard`，也就有了一个冗余的数据库。我不想留下主备转换、故障转移、重建库等不讲，这些主题将放到本文的第二部分。

我希望本文能帮助你更容易和更快速地创建你的 `Data Guard` 环境。




