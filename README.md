# auto_deploy 简易自动化部署服务

一个通过页面按钮完成一键部署的demo，可选择链接的后端环境地址。

部署服务前端只有一个简单的html，后端使用 koa，通过 pm2 启动。

服务功能实现通过 child_process 执行命令，使用 taskkill 杀死进程，部署的目标项目使用 http-server 启动。
