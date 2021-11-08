---
categories:
- database
date: "2016-01-29T00:00:00Z"
title: Grant statement and library cache lock
---

## What is library cache lock?

From Troubleshooting Library Cache: Lock, Pin and Load Lock (Doc ID 444560.1):

>This event controls the concurrency between clients of the library
>cache. It acquires a lock on the object handle so that either:
>
>One client can prevent other clients from accessing the same object.
>
>The client can maintain a dependency for a long time (for example,
>so that no other client can change the object).
>
>This lock is also obtained to locate an object in the library cache.
>
>Library cache lock will be obtained on database objects referenced
>during parsing or compiling of SQL or PL/SQL statements (table, view,
>procedure, function, package, package body, trigger, index, cluster,
>synonym). The lock will be released at the end of the parse or
>compilation.
>
>Cursors (SQL and PL/SQL areas), pipes and any other transient objects
>do not use this lock. Library cache lock is not deadlock sensitive and
>the operation is synchronous.

## Why grant statment cause library cache lock?

Because the grant statement need to change the `LAST_DDL_TIME` of a
object, it must hold a exclusive lock for this object.  When you
execute the grant statment, you request a exclusive lock on that
object, but when there are long-running querys on that object holds a
share lock, you must wait that query be done to get the exclusive
lock.  Other session can not get a share lock on the object because
you have request to get a exclusive lock.  That's my guess why grant
statment can cause many library cache lock waits.  And we did some
tests to prove it.

From a blog post:

>I can definitely say that when you grant privileges on an object in a
>production database in the middle of a busy day, you could have
>problems.
>
>Today, an application installer was installing some packages in a new
>schema.  He was granting select/insert/update/delete on several tables
>in the data schema. We started seeing a large number of “library cache
>lock” wait events for users in another schema that were accessing the
>tables on which select privileges were being granted to the new
>schema.
>
>It turns out that this operation will actually stamp the
>`LAST_DDL_TIME` column of `DBA_OBJECTS`.  It doesn’t invalidate the
>object in the STATUS column of `DBA_OBJECTS`, but there is a latch
>that existing sessions request as a result of this “invalidation”.

From MOS note Troubleshooting Library Cache: Lock, Pin and Load Lock
(Doc ID 444560.1):

>Be very careful with altering, granting or revoking privileges on
>database objects that frequently used stored PL/SQL is dependent
>on. In fact, resolving this issue mostly depends on application
>project and system maintenance practices. Application developers
>should also consider that some project decisions have negative impact
>to the application scalability and performance.

## Howt to solve it?

You can check `v$session_blocker` to find the blocking and blocked
sessions and find the sqls they're executing.

A systemstate dump during problem time can be very helpful for post
analysis.

And the best solution is just don't do DDLs during system busy
periods.

From 'library cache lock' Waits- Causes and Solutions (Doc ID
1952395.1):

>Do not perform DDL operations during busy periods.
>
>DDL will often cause library cache objects to be invalidated and this
>could cascade to many different dependent objects like
>cursors. Invalidations have a large impact on the library cache,
>shared pool, row cache, and CPU since they will likely require many
>hard parses to occur at the same time.
>
>Simply schedule DDL during maintenance or low activity periods.

## Reference

- 'library cache lock' Waits- Causes and Solutions (Doc ID 1952395.1)
- Troubleshooting Library Cache: Lock, Pin and Load Lock (Doc ID 444560.1)	
- [Library cache lock during grant/revoke](http://appcrawler.com/wordpress/2009/10/12/library-cache-lock-during-grantrevoke/)


