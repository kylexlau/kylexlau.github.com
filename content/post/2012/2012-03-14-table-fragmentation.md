---
categories:
- database
date: "2012-03-14T00:00:00Z"
title: Oracle 数据库整理表碎片
---

## 表碎片的来源

当针对一个表的删除操作很多时，表会产生大量碎片。删除操作释放的空间不会被插入操作立即重用，甚至永远也不会被重用。

## 怎样确定是否有表碎片

	-- 收集表统计信息
    SQL> exec dbms_stats.gather_table_stats(ownname=>'SCHEMA_NAME',tabname=> 'TABLE_NAME');

    -- 确定碎片程度
	SQL> SELECT table_name, ROUND ((blocks * 8), 2) "高水位空间 k",
       ROUND ((num_rows * avg_row_len / 1024), 2) "真实使用空间 k",
       ROUND ((blocks * 10 / 100) * 8, 2) "预留空间(pctfree) k",
       ROUND ((  blocks * 8
               - (num_rows * avg_row_len / 1024)
               - blocks * 8 * 10 / 100
              ),
              2
             ) "浪费空间 k"
      FROM dba_tables
      WHERE table_name = 'TABLE_NAME';

或者使用如下[gist](https://gist.github.com/c771b0eca31bce66f785)中的脚本找出某个 Schema 中表碎片超过25%的表。使用此脚本前，先确定 Schema 中表统计信息收集完整。

	-- 查看表上次收集统计信息时间
	select table_name,last_analyzed from dba_tables where owner = 'SCHEMA_NAME'

    -- 收集整个 Schema 中对象的统计信息
	SQL> exec dbms_stats.gather_schema_stats(ownname=>'SCHEMA_NAME');

## 为什么要整理表碎片

Oracle 对数据段的管理有一个高水位(HWM, High Water Mark)的概念。高水位是数据段中使用过和未使用过的数据块的分界线。高水位以下的数据块是曾使用过的，以上的是从未被使用或初始化过的。

当 Oracle 进行全表扫描(FTS, Full table scan)的操作时，它会读高水位下的所有数据块。如果高水位下还有很多空闲空间（碎片），读取这些空闲数据块会降低操作的性能。

### 行链接和行迁移

- 行链接 Row Chaining：当插入数据量大的行的，如果一个Block不能存放一条
  记录，该记录的一部分会存储到同个Extent中的其他Block，这些block形成一
  个数据块链。
- 行迁移 Row Migration：当Update的时候导致记录长度增加了，存储的Block已
  经满了，就会发生行迁移。Oracle会迁移整行数据到一个能够存储下整行数据
  的Block中，迁移的原始指针指向新的存放行数据的Block，ROWID不变。

当数据行发生链接（chain）或迁移（migrate）时，对其访问将会造成 I/O 性能
降低，因为Oracle为获取这些数据行的数据，必须访问更多的数据块（data
block）。

### 表碎片导致的问题

- 查询响应时间(尤其是全表扫描)变慢
- 产生大量行迁移
- 浪费空间

整理表碎片对基于索引的查询不会有太大性能提升。

## 如何整理表碎片

### 10g之前

两种方法：

- 导出表，删除表，再导入表
- `alter table move`

一般选择第二种，需要重建索引。

### 10g后

从 10g 开始，提供一个 `shrink` 命令，需要表空间是基于自动段管理的。

可以分成两步操作：

    -- 整理表，不影响DML操作
    SQL> alter table TABLE_NAME shrink space compact;

	-- 重置高水位，此时不能有DML操作
    SQL> alter table TABLE_NAME shrink space;

也可以一步到位：

	-- 整理表，并重置高水位
    SQL> alter table TABLE_NAME shrink space;

### shrink 的优势：

- 不需要重建索引。
- 可以在线操作。
- 不需要空闲空间，`alter move`需要跟当前表一样大小的空闲空间。
