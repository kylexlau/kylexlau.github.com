+++
title = "MongoDB 维护脚本"
date  = "2018-09-26T21:53:27+08:00"
draft = true
+++

MongoDB的官方语言是JavaScript。很多MongoDB的维护脚本都可以用js语言来写。

下面这几个脚本其实就是几个简单的循环，有时候能用它们更方便地做一些db维护相关的操作。

## 批量杀慢查询

    (function (sec) {db.currentOp()['inprog'].forEach(function (query) { 
      if (query.op !== 'getmore') { return; } 
      if (query.secs_running < sec) { return; }  
      print(['Killing query:', query.opid, 'which was running:', query.secs_running, 'sec.'].join(' '));
      db.killOp(query.opid);
    })})(2);
    
## 批量统计集合行数

    use admin
    db.runCommand( { listDatabases: 1 } ).databases.forEach(function (dbs) {
      db = db.getSiblingDB(dbs.name);
      cnt = db.CollectionName.count();
      print([db + ': ' + cnt].join(' '));	
    });

## 批量开启profiling

    use admin
    db.runCommand( { listDatabases: 1 } ).databases.forEach(function (dbs) {
      db = db.getSiblingDB(dbs.name);
      db.setProfilingLevel(1);
      pf = db.getProfilingLevel();
      print([db + ': ' + pf].join(' '));	
    });

