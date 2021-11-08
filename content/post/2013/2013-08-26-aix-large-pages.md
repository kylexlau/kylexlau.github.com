---
categories:
- database
date: "2013-08-26T00:00:00Z"
title: Oracle 数据库在 AIX 平台上启用大内存页
---

## 修改用户属性

    # 官方文档只要求如下两个，但有些文档说 CAP_NUMA_ATTACH 也需要
    chuser capabilities=CAP_BYPASS_RAC_VMM,CAP_PROPAGATE oracle

    # 如果是 RAC 环境，还需要修改root用户
    chuser capabilities=CAP_BYPASS_RAC_VMM,CAP_PROPAGATE root

## 修改 VMM 参数

    # 执行下述命令前先关闭数据库，不然内存大内存页分配不出来。一般系统不需重启。
    # num_of_large_pages = INT((total_SGA_size-1)/16MB)+1
    vmo -p -o lgpg_regions=num_of_large_pages -o lgpg_size=16777216

    # AIX 6.1 下默认为0，尽可能不对计算内存换页
    vmo -p -o lru_file_repage=0

IBM 对`lru_file_repage`参数的官方解释：

> lru_file_repage – when the number of permanent memory pages (numperm) falls between minperm and maxperm (or the number of client memory pages falls between minperm and maxclient), this setting indicates whether repaging rates are considered when deciding to evict permanent memory pages or computational memory pages. Setting this to 0 tells AIX to ignore repaging rates and favor evicting permament memory pages, keeping more computational memory in RAM. The AIX 5L default is 1/true (consider the repaging rate), The AIX 6.1 default is 0/false (now a restricted setting).

## 修改 Oracle 参数

    alter system set lock_sga=ture scope=spfile sid='*';

如果是版本为10.2.0.4的数据库，还需要打一个小补丁，补丁号是7226548。

## 参考文档

具体查询 Oracle 官方支持网站：

- How to enable Large Page Feature on AIX-Based Systems (Doc ID
  372157.1)
- Bug 7226548 - AIX: 10.2.0.4 does not use large pages (Doc ID
  7226548.8)
- SGA Not Pinned In The AIX Large Pages When Instance Is Started With
  Srvctl (Doc ID 369424.1)
