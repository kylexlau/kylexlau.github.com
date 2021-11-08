---
categories:
- sysadmin
date: "2012-02-20T00:00:00Z"
title: 两个监控HP硬件的Nagios插件
---

主要是两个Ngios插件的使用，都是用Perl写的。check_hpasm 是大牛德国人 [Gerhard Lausser](https://github.com/lausser) 写的。[check_hp_bladechassis](http://folk.uio.no/trondham/software/) 似乎是挪威人写的。

## HP 服务器硬件状态监控 (check_hpasm)

可以使用两种模式，check_nrpe方式和SNMP方式。两种方式都依赖HP的ProLiant Support Pack(PSP)软件包。

check_nrpe方式需要修改NRPE和sudo配置：

    # vi /usr/local/nagios/etc/nrpe.cfg
	添加一行：
	command[check_hpasm]=/usr/local/nagios/libexec/check_hpasm
	载入新的配置：
	service xinetd reload

	# visudo
	注释一行：
    # Defaults    requiretty
	添加一行：
	nagios ALL=NOPASSWD:/sbin/hpasmcli,/usr/local/nagios/libexec/check_hpasm

SNMP方式，需要修改SNMP配置，允许监控服务器访问服务器的SNMP信息。Nagios服务端的配置，可以这样写：

	define command {
		command_name check_hpasm_snmp
		command_line $USER1$/check_hpasm -H $HOSTADDRESS$ -C public
	}

	define servicegroup {
		servicegroup_name hp_hardware
		alias             HP Proliant Server Hardware Health
	}

	define service {
		use           generic-service
		name          hpasm-service
		check_period  24x7
		check_interval 10
		retry_interval 1
		max_check_attempts 1
		notification_options w,c,u
		register       0
	}

	# SNMP
	define service {
		use           hpasm-service
		servicegroups hp_hardware
		host_name     host1,host2,...
		service_description HP Hardware Health
		check_command  check_hpasm_snmp
	}

    # check_nrpe
	define service {
		use           hpasm-service
		servicegroups hp_hardware
		host_name     host1,host2,...
		service_description HP Hardware Health
		check_command check_nrpe!check_hpasm
	}

## HP 刀箱硬件状态监控 (check_hp_bladechassis)

通过SNMP监控。

首先需要在刀箱配置里启用SNMP，然后在Nagios服务端配置：

	define command {
		command_name check_hp_bladechassis
		command_line $USER1$/check_hp_bladechassis -H $HOSTADDRESS$
	}

	define service {
		use           hpasm-service
		servicegroups hp_hardware
		host_name     host1,host2,...
		service_description HP Blade Encloure Hardware Health
		check_command check_nrpe!check_hpasm
	}
