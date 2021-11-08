---
categories:
- translation
date: "2012-07-05T00:00:00Z"
published: true
title: Oracle 11g Data Guard 物理备库快速配置指南（下）
---

## 第二部分

### 作者介绍

作者 Jed Walker 是科罗拉多 Centennial Comcast 媒体中心的数据操作经理(Manager of Databse Operation)。他从1997年开始做 Oracle 数据库相关工作，是9i, 10g和11g的OCP。

### 简介

本文的第一部分讲解了如何配置一个基本的 Data Guard 环境。在第二部分里，我将介绍主备切换、故障转移(数据库和客户端）等其他主题。

### 回顾

在本文第一部分中，我们配置了一个物理备库。在这第二部分中，我将介绍主备切换(Switchover)，故障转移(Failover)，客户端故障转移(Client Failover)，使用闪回数据库重建库，活动数据卫士(Active Data Guard)，还讨论了一点备份。

### 故障转移配置

现在你已经配好了一个物理备库，你可能想试试主备切换(switchover)，甚至故障转移(failover)，但你先得确定客户端会跟着切换和转移。我们需要配置数据库和客户端来支持这些功能。要确定你的客户端能连接到正确的数据库，你要在数据库里配置一个支持故障转移的服务，并配置客户端的 TNS，让它知道如何在一个 Data Guard 集群里找到主库。

首先，创建一个支持故障转移的服务。我们要创建此服务，确定它在主库上启动，并确定它只在主库上启动。创建服务使用如下 SQL：

	begin
		DBMS_SERVICE.CREATE_SERVICE (
			service_name => 'JED_RW',
			network_name => 'JED_RW',
			aq_ha_notifications => TRUE,
			failover_method => 'BASIC',
			failover_type => 'SELECT',
			failover_retries => 30,
			failover_delay => 5);
	end; /

此服务在数据库出现故障时会发送通知给客户端，允许查询语句在故障转移发生后继续运行。我使用命名 `SID_RW` 显示这时一个可读写的数据库（主库）。

下一步是确定新创建的服务永远只在主库运行。我们创建一个存储过程来实现此目的，如果当前数据库是主库它就启动此服务，如果是备库就停止。

	create or replace procedure cmc_taf_service_proc
	is
		v_role VARCHAR(30);
	begin
		select DATABASE_ROLE into v_role from V$DATABASE;
		if v_role = 'PRIMARY' then
			DBMS_SERVICE.START_SERVICE('JED_RW');
		else
			DBMS_SERVICE.STOP_SERVICE('JED_RW');
		end if;
	end;
	/

然后创建两个触发器，让数据库在启动和角色转换时运行此存储过程。我参考的文档，只提到建立一个触发器（角色转换时）。如果只创建一个，当你重启你的数据库时，它不会重启故障转移服务。所以我创建两个：

	create or replace TRIGGER cmc_taf_service_trg_startup
	after startup on database
	begin
		cmc_taf_service_proc;
	end;
	/

	create or replace TRIGGER cmc_taf_manage_trg_rolechange
	after db_role_change on database
	begin
		cmc_taf_service_proc;
	end;
	/

现在我们执行一次存储过程，确定服务正在运行，并归档当前日志，让以上更改同步到备库。

	SQL> exec cmc_taf_service_proc;
	SQL> alter system archive log current;

我们现在有了一个叫 `JED_RW` 的服务，可以让客户端连接。

	SQL> show parameter service_names

	NAME             TYPE        VALUE
	---------------- ----------- ------------
	service_names    string      JED_RW

有这个服务名存在还不够，你必须配置客户端的 TNS 名去连接它。客户端的 TNS 名应该类似如下：

	JED_RW =
	  (DESCRIPTION =
		(ADDRESS_LIST=
			(ADDRESS = (PROTOCOL = TCP)(HOST = dev-db1)(PORT = 1521))
			(ADDRESS = (PROTOCOL = TCP)(HOST = dev-db2)(PORT = 1521))
		)
		(CONNECT_DATA = (SERVICE_NAME = JED_RW)
			(FAILOVER_MODE=(TYPE=SELECT)(METHOD=BASIC)(RETRIES=30)(DELAY=5))
		)
  	  )

这个 TNS 名里包含 Data Guard 配置里的两个主机，使用 `JED_RW` 服务名确定连接到主库。

如果你想连接特定的数据库，不管它是主是备，可以使用标准的 TNS 名，如下：

	JED =
	  (DESCRIPTION_LIST=
	    (DESCRIPTION =
	      (ADDRESS = (PROTOCOL = TCP)(HOST = dev-db1)(PORT = 1521))
	      (CONNECT_DATA = (SERVICE_NAME = JED))
	    )
	  )

当你的客户端使用新 TNS 名后，它们能在主备切换和故障转移操作后找到主库。如果客户端在运行一个查询，并且没有 `DML` 是在一个交易中，那在发生切换操作后，只要主备转换和故障转移在超过最大重试次数前完成，这个查询会继续工作，只是会有延迟。你应该多做几次切换实验，以确定 `RETRIES` 和 `DELAY` 参数如何设置合适。如果有一个正在进行中的交易，当客户端连接到新的主库后，查询将报错（`ORA-25403: transaction must roll back），并回滚。

### 进行主备切换(Switchover)

现在你准备好做一次主备切换了，做之前先做些检查。首先在主库确认没有日志缺口：

	SQL> select STATUS, GAP_STATUS from V$ARCHIVE_DEST_STATUS where DEST_ID = 2;

应该返回 `VALID` 和 `NO GAP`。

查询`v$tempfile`视图确认备库的临时文件和主库一样。

删除 `LOG_ARCHIVE_DEST_N` 参数中的所有延迟应用重做日志设置，你要确认所有变化都在备库应用，才能确保无数据丢失。确认所有重做日志都已在备库应用，查询备库：

	SQL> select NAME, VALUE, DATUM_TIME from V$DATAGUARD_STATS;

不应该返回 `transport lag` 或 `apply lag`, `finish time` 应该为0.

检查完这些先决条件后，确认主库可以进行角色切换，查询主库：

	SQL> select SWITCHOVER_STATUS from V$DATABASE;

如果返回 `TO STANDBY` 或 `SESSIONS ACTIVE`，那么主库就可以进行切换。切换主库为备库命令为：

	SQL> alter database commit to switchover to physical standby with session shutdown;
	SQL> shutdown immediate;
	SQL> startup mount;

然后查询备库是否可以切换为主库，查询备库：

	SQL> select SWITCHOVER_STATUS from V$DATABASE;

如果返回 `TO PRIMARY` 或 `SESSIONS ACTIVE`，就可以切换。如果返回 `SWITCHOVER LATENT` 或 `SWITCHOVER PENDING`，就要去检查告警日志，看有什么问题，一般是需要应用一些日志。如果是需要应用日志的话，在备库执行如下命令：

	SQL> recover standby database using backup controlfile;

在应用日志前应该是 `SWITCHOVER PENDING` 状态，完成应用后，会变成 `TO PRIMARY` 或 `SESSIONS ACTIVE`状态。

现在可以切换备库为主库了：

	SQL> alter database commit to switchover to primary with session shutdown;
	SQL> alter database open;

完成主备切换后，在备库上启用日志应用：

	SQL> alter database recover managed standby database using current logfile
disconnect from session;

### 进行故障转移(Failover)

故障转移，一般用在主库发生故障后需要恢复服务的情况下。故障转移将备库转换为主库，但不把原主库（有故障，无法正常工作）切换为备库。当故障转移发生后，你必须重建主库，或者使用闪回数据库功能将主库回退到故障发生前，然后转换其为备库并启用日志应用。

我将故障转移分为三类：优雅、几乎优雅和标准。分类标准是主库故障的严重程度。故障转移不会是优雅的，但是你对故障的应对可以是优雅的。注意这些分类不是 Oracle 的官方分类，我个人创造这些分类用来代表故障转移的三个不同阶段。

#### 优雅的故障转移

如果当前备库是处于最大保护（maximum protection）模式，要进行故障转移，必须先修改为最大性能（maximum performance）模式。修改方法：

	SQL> alter database set standby database to maximize performance;

如果你还能将主库启动到挂载（mount）状态，你可以试着将刷新未传输的日志到备库。如果你能刷新，故障转移可能不会丢失任何数据。在本文中，我们上一节主备切换主库到了 `JED2`，我们现在故障转移回 `JED`：

	SQL> startup mount
	SQL> alter system flush redo to 'JED';

如果以上命令正常，日志已经传输到备库，我们需要在备库上应用它们。在下一节里，我们要确认所有重做日志是否都传输到了备库。

#### 几乎优雅的故障转移

为了尽可能少的丢失数据，你应该尝试将所有归档日志应用。你应该将主库上的所有归档日志复制到备库。可能有一些归档日志已经在备库存在，但这样你能有尽可能多的归档日志。然后你要解决备库中的任何日志缺口。

首先，复制所有主库的归档到备库，并在数据库中注册它们：

	SQL> alter database register physical logfile '&logfile_path_name';

检查是否有日志缺口：

	SQL> select THREAD#, LOW_SEQUENCE#, HIGH_SEQUENCE# from V$ARCHIVE_GAP;

如果有缺口存在，而主库上还有此日志文件，复制过来并注册。

#### 标准故障转移

在备库停止日志应用：

	SQL> ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;

结束应用任何日志：

	SQL> ALTER DATABASE RECOVER MANAGED STANDBY DATABASE FINISH;

如果以上命令有任何报错，检查相关告警日志和跟踪信息。一旦你执行了这个命令，备库就必须转换为主库，要不就得重建。

检查备库是否能转换为主库，执行：

	SQL> select SWITCHOVER_STATUS from V$DATABASE;

查询应该要返回 `TO PRIMARY` 或 `SESSIONS ACTIVE`，不然你可能还没有应用完所有日志。确认你执行了 `RECOVER...FINISH`命令。

转换备库为主库：

	SQL> alter database commit to switchover to primary with session shutdown;
	SQL> alter database open;

如果你有不止一个备库，你需要在其他备库上重启日志应用。下一步是重建原主库。如果配置了闪回数据库，重建会比较容易。

### 使用闪回数据库重建库

现在你已经进行了故障转移，原主库需要重建为备库。使用闪回数据库重建原主库，首先需要获得原备库转换为主库时的 `SCN`。查询现主库：

	SQL> SELECT to_char(STANDBY_BECAME_PRIMARY_SCN) from V$DATABASE;

有了这个 `SCN`，你就可以使用闪回数据库功能将原主库回退到故障转移发生的时间点。在原主库上执行：

	SQL> SHUTDOWN IMMEDIATE;
	SQL> STARTUP MOUNT;
	SQL> FLASHBACK DATABASE TO SCN &standby_became_primary_scn;

如果没有开始闪回日志，最后一条命令会报错 `ORA-38726: Flashback database logging is not on.`，无法进行闪回。你就需要重新从新主库复制数据，重建原主库为备库。

如果命令成功执行，原主库就可以使用新主库的日志进行恢复。将原主库转换成物理备库，并启动日志应用进程：

	SQL> ALTER DATABASE CONVERT TO PHYSICAL STANDBY;
	SQL> SHUTDOWN IMMEDIATE;
	SQL> STARTUP MOUNT;
	SQL> ALTER DATABASE RECOVER MANAGED STANDBY DATABASE USING CURRENT LOGFILE DISCONNECT FROM SESSION;

然后就可以在新主库切换一次日志，查看新备库的日志应用是否正常，具体命令在本文第一部分。

### 客户端故障转移

我很喜欢的一个功能是，当主备切换或故障转移发生后，客户端能够自动重连。在你的系统里，做下述实验，看结果如何。`JED` 是主库，`JED2` 是备库。客户端使用支持故障转移的 `JED_RW` 服务名。

首先，用 SYSTEM 用户和 `JED_RW` 服务名在 `SQL*Plus` 里登录主库：

	SQL> connect system@jed_rw
	SQL> select db_unique_name from v$database;

查询应该返回主库名 `JED`。然后做一次主备切换，在将备库转换为主库 `alter database commit to switchover to primary with session shutdown;` 这一步时，主备库均处于 `MOUNT` 状态。然后执行查询：

	SQL> select db_unique_name from v$database;

这时查询应该挂住，这是因为客户端正在尝试寻找主库，但当前又没有可用的主库。然后继续完成主备切换。

当主备切换完成后，客户端应该会重连并重新执行查询，查询完成后成功返回结果 `JED2`，因为现在主库已经切换为 `JED2`，不再是 `JED`。另一个很酷的测试方法是，执行一个执行时间非常长的查询，当查询结果返回，屏幕一直滚动时开始主备切换。你应该会看到屏幕暂停滚动一段时间，当切换完成后，又会继续滚动。

### 活动数据卫士(Active Data Guard)

警告！活动数据卫士功能需要单独的授权。虽然打开此功能很容易，如果没有授权，你不应该使用它。

活动数据卫士是 11g 的新功能，它允许你的物理备库在应用日志时处于只读打开状态。这明显是一个很有用的功能。能够允许主库有一个物理备库作为备份，并能在保持备库数据更新的同时读取备库，这是一个很好的功能。Oracle 也知道，所以这个功能需要单独买授权。

开启活动数据卫士功能十分容易。你只需要打开在你的数据库后再启动日志应用：

	SQL> STARTUP MOUNT
	SQL> ALTER DATABASE OPEN;
	SQL> ALTER DATABASE RECOVER MANAGED STANDBY DATABASE USING CURRENT LOGFILE DISCONNECT;

之后你就可以登录备库，并执行查询。你可以执行如下查询确认：

	SQL> SELECT name status, database_role, open_mode logins, log_mode FROM v$instance, v$database;

在开启活动数据卫士功能后，查询应该返回 `PHYSICAL STANDBY`，`READ ONLY WITH APPLY` 和 `ARCHIVELOG`。

当你开启活动数据卫士功能后，你需要允许用户根据需要连接到正确的数据库。我创建第二个服务叫 `SID_RO`，并让它只在备库启动。这个名字显示你连接的是一个只读（Read Only）数据库，而不是读写数据库。这个服务名的创建跟 `SID_RW` 类似：

	begin
		DBMS_SERVICE.CREATE_SERVICE (
			service_name => 'JED_RO',
			network_name => 'JED_RO',
			aq_ha_notifications => TRUE,
			failover_method => 'BASIC',
			failover_type => 'SELECT',
			failover_retries => 30,
			failover_delay => 5);
	end;
	/

修改原启动服务的存储过程：

	create or replace procedure cmc_taf_service_proc
	is
	  v_role VARCHAR(30);
	begin
	  select DATABASE_ROLE into v_role from V$DATABASE;
	  if v_role = 'PRIMARY' then
	    begin
	      DBMS_SERVICE.STOP_SERVICE('JED_RO');
	    exception
	      when others then null;
	    end;
	    DBMS_SERVICE.START_SERVICE('JED_RW');
	  else
	    begin
	      DBMS_SERVICE.STOP_SERVICE('JED_RW');
	    exception
	      when others then null;
	    end;
	    DBMS_SERVICE.START_SERVICE('JED_RO');
	  end if;
	end;
	/

现在你有了一个活动数据卫士的配置，你的客户端能连接到合适的数据库实例，并可以在出现主备切换和故障转移时自动重连。

### 备份

最后，如果不讨论下备份，那对 `Data Guard` 的介绍还不算完整。`Data Guard` 实质上就是也是备份，但这不意味着你就不需要 `RMAN` 备份了。你已经花时间去启用了强制记录日志，那你也应该做点备份。

有了 `Data Guard`，你的 `RMAN` 备份在主库或者备库都可以执行。但既然你已经配置了物理备库，你应该减轻点主库的负载。基本上，能在主库执行的标准的备份命令或脚本，也能在备库执行，但也有几个值得注意地方。这些 Oracle 官方文档都有，我只提几个关键的事情：

* 你应该使用恢复目录（Recovery Catalog）。这是因为主库需要知道备库已经存在了哪些备份文件。你不需要在恢复目录中注册备库，恢复目录能认出它是备库。

* 你不能备份备库的控制文件，所以不要在主库关掉所有的备份，至少需要在主库备份控制文件和参数文件。

备份和恢复可以写一整篇文章，我只是讲下我是如何配置备份的，让你能从这里开始，修改并形成自己的策略。测试下，确认你能从你当前实现的备份设置中恢复。在运行备份前，你需要配置一些基本的东西。

确认开启控制文件和 `spfile` 自动备份：

	RMAN> CONFIGURE CONTROLFILE AUTOBACKUP ON;

根据你的需要设置备份文件保留策略：

	RMAN> CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 3 DAYS;

如果一个文件已经有备份，并且检查点 `SCN` 相同，就不备份：

	RMAN> CONFIGURE BACKUP OPTIMIZATION ON;

只在主库的归档日志已经在备库应用（或者配置为已经传输到备份）后才删除：

	RMAN> CONFIGURE ARCHIVELOG DELETION POLICY TO APPLIED ON ALL STANDBY;

允许 `RMAN` 在主备间重新同步：

	RMAN> CONFIGURE DB_UNIQUE_NAME P10AC CONNECT IDENTIFIER ‘JED’;
	RMAN> CONFIGURE DB_UNIQUE_NAME P11AC CONNECT IDENTIFIER 'JED2';

在主库我仍然备份归档日志。首先，在主备库都备份归档提供了冗余。其次，当发生需要恢复的事件（比如数据文件下线等）后，我在主库已经有归档了。我需要删除过期的归档，以清理磁盘空间。在 `Data Guard` 环境下，不能使用标准的在单机删除归档的命令，两者有一点小区别。因为我们必须使用恢复目录，我创建了一个全局脚本（global script）：

	create global script dg_primary_arch
	{
		backup archivelog all;
		delete noprompt archivelog all completed before 'sysdate-.5';
		delete noprompt backup of archivelog all completed before 'sysdate-2';
	}

在备库我运行标准的全库和归档备份，并删除过期的备份集。在 `Data Guard` 环境下，将备份归档包含在备份全库的命令里，会经常导致报错 `RMAN-08137: WARNING: archived log not deleted, needed for standby or upstream capture process`。为避免此报错，你应该将备份归档放在单独的命令里。我还是创建一个全局脚本：

	create global script dg_standby_full
	{
		backup database plus archivelog;
		delete noprompt archivelog all completed before 'sysdate-1';
		delete noprompt obsolete;
	}

另外一个有用的技巧是，如果可能，使用共享文件系统进行备份。这样你在两台服务器上都可以访问备份文件。这样，当你需要恢复时，你不需要从另一台服务器上复制文件了。但如果使用共享文件系统的话，你的归档备份虽然有两份，却都放在一个文件系统里，如果硬盘出现故障，两份备份都会丢失。

### 总结

Oracle 11g 的 `Data Guard` 是一个很好的功能，配置起来相对容易，提供了在主库异常时故障转移的功能。它也能将主备的备份操作转移到备库执行，减轻主备负载。另外，`Data Guard Broker` 是一个宣称能简化管理的工具，但介绍这个工具就得需要另外一篇文章了。

