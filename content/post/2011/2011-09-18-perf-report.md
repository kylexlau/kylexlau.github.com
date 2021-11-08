---
categories:
- database
date: "2011-09-18T00:00:00Z"
title: Oracle's performance-tuning reports
---

## Introduction

* Automatic Workload Repository (AWR)
* Automatic Database Diagnostic Monitor (ADDM)
* Active Session History (ASH)
* Statspack

AWR, ADDM and ASH need additional license.  Statspack is free.

You can also run AWR, ADDM, and ASH reports from Enterprise Manager,
which you may find more intuitive than manually running the scripts
from SQL*Plus.

Oracle maintains a massive collection of dynamic performance views
that track and accumulate metrics of database performance.  For Oracle
11g, there're over 400 dynamic performance views:

```sql
SQL> select count(*) from dictionary where table_name like 'V$%';
```

The Oracle performance utilities rely on periodic snapshots gathered
from these internal performance views.  Two of the most useful views
with regard to performance statistics are the V$SYSSTAT and V$SESSTAT
view.

## Using AWR

Oracle will automatically take a snapshot of your database once an
hour and populate the underlying AWR tables that store the statistics.
By default, seven days of statistics are retained.

```sql
SQL> @?/rdbms/admin/awrrpt
```

Generate an AWR report for a specific SQL statement:

```sql
SQL> @?/rdbms/admin/awrsqrpt
```

## Using ADDM

ADDM report provides useful suggestions on which SQL statements are
candidates for tuning.  It analyzes data in the AWR tables to identify
potential bottlenecks and high resource-consuming SQL queries.

```sql
SQL> @?/rdbms/admin/addmrpt
```

## Using ASH

ASH report allows you to focus on short-lived SQL statements that have
been recently run and may have only executed for a brief amount of
time.

The AWR and ADDM output shows top-consuming SQL in terms of total
database time.  If the SQL performance problem is transient and
short-lived, use ASH.

```sql
SQL> @?/rdbms/admin/ashrpt
```

## Using Statspack

Help you identify poorly performing SQL statements.

Install Statspack, it creates a PERFSTAT user that owns the Statspack
repository.

```sql
SQL> @?/rdbms/admin/spcreate
```

Enable the automatic gathering of Statspack statistics:

```sql
SQL> @?/rdbms/admin/spauto
```

After some snapshots have been gathered, you can run the following
script as the PERFSTAT user to create a Statspack report:

```sql
SQL> @?/rdbms/admin/spreport
```

The Statspack historical performance statistical data is stored in the
STAT$SQL_SUMMARY table and the STATS$SNAPSHOT table contains a record
for each Statspack snapshot.
