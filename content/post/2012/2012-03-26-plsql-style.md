---
categories:
- database
date: "2012-03-26T00:00:00Z"
title: PL/SQL 代码规范
---

来自 *Oracle PL/SQL by Examples 4th Edition* 附录一中的 PL/SQL 代码格式指南。

## 大小写

- 关键字(BEGIN,END)，数据类型(NUMBER VARCHAR2)，内置函数(TO_CHAR,SUBSTR)，用户自定义存储过程、函数和包，这些对象名称使用大写。
- 变量名、表名、列名，使用小写。

## 空格

- 等于号和比较操作符两边加空格。
- 结构关键字（BEGIN and END, IF and END, LOOP and END LOOP)左边对齐。
- 结构内的语句缩进3个空格。
- 代码段之间留空行。

## 命名规范

为防止名字冲突，最好采用以下命名规范：

- 变量：`v_variable_name`
- 常量：`con_constant_name`
- 参数：`i_in_parameter_name`, `o_out_parameter_name` and `io_in_out_parameter_name`.
- 游标：`c_cursor_name` or `name_cur`
- 引用游标：`rc_reference_cursor_name`
- 记录：`r_record_name` or `name_rec`
- 遍历游标：`FOR r_stud IN c_stud LOOP` or `FOR stud_rec IN stud_cur LOOP`
- 用户定义类型：`type_name` or `name_type`
- PL/SQL表（类似数组）：`t_table` or `name_tab`
- 用户定义异常：`e_exception_name`

包、存储过程和函数的命名实例：

- 描述包中存储过程和函数的作用：`student_admin`
- 描述存储过程所执行的操作：`remove_student`
- 描述函数返回变量：`student_enroll_count`

## 注释

使用`--`，不要用`/*...*/`。

## 其他建议

为代码段写注释，解释此段代码的目的，并列出一些基本信息，比如作者名、创建时间、修改时间、版本和版本描述。
