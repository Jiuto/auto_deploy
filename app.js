// 部署
const child_process = require('child_process');
const fs = require('fs');
const koa = require('koa');
const mount = require('koa-mount');
const taskkill = require('taskkill');

const app = new koa();
const reloadKoa = new koa();


// 这些参数均可从前端配置
const protocol = "https"; // git clone 命令的协议
const projectUrl = "github.com/Jiuto/ding_yapi.git"; // git clone 命令的项目地址
const projectDir = __dirname + '/ding_yapi'; // 目标项目名
const staticDir = __dirname + '/static/dist'; // 存放打包文件的路径
const buildStaticDir = __dirname + '/ding_yapi/client/dist'; // 目标项目打包后的文件路径

const git_username='username'; // git 用户名
const git_password='password'; // git 密码

// 目标项目启动的进程
var subprocess = null;


// 删除文件
function deleteFolder(path) {
    var files = [];
    if (fs.existsSync(path)) { // 目录存在
        if (fs.statSync(path).isDirectory()) { // 文件夹
            files = fs.readdirSync(path); // 返回所有文件名数组
            files.forEach(function (file, index) {
                var curPath = path + "/" + file;
                if (fs.statSync(curPath).isDirectory()) { // 文件夹
                    deleteFolder(curPath);
                } else { // 文件
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        } else { // 文件
            fs.unlinkSync(path); // 删除文件
        }
    }
}

// 拷贝文件
function copyFolder(from, to) {
    var files = [];
    if (fs.existsSync(to)) { // 目录存在
        files = fs.readdirSync(from);
        files.forEach(function (file, index) {
            var targetPath = from + "/" + file;
            var toPath = to + '/' + file;
            if (fs.statSync(targetPath).isDirectory()) { // 文件夹
                copyFolder(targetPath, toPath);
            } else { // 文件
                fs.copyFileSync(targetPath, toPath); // 拷贝文件
            }
        });
    } else { // 目录不存在
        fs.mkdirSync(to); // 创建文件
        copyFolder(from, to);
    }
}

function reloadCode(cmdStr){
    return new Promise(function(resolve, reject) {
        try {
            child_process.execSync(cmdStr); // 克隆项目
            process.chdir(projectDir) // 进入子目录
            child_process.execSync(`npm install`); // 安装依赖
            child_process.execSync(`npm run build`); // 打包项目
            process.chdir(__dirname) // 返回根目录
            deleteFolder(staticDir) // 删除原静态文件
            copyFolder(buildStaticDir, staticDir) // 拷贝文件
            resolve({
                code: 200,
                msg: 'load code successful'
            })
        } catch (e) {
            reject({
                code: 500,
                msg: 'load failed, error message:\n' + e
            })
        }
    })
}

function changeProxy(cmdStr){
    var result2 = {
        code: 200,
        msg: ''
    };
    return new Promise(function(resolve, reject) {
        // 项目已启动，则杀死进程
        if(subprocess) {
            (async () => {
                await taskkill(subprocess.pid);
            })();
        }
        subprocess = child_process.exec(cmdStr); // 启动 http-server
        subprocess.on('error', (err) => {
            result2.code = 500;
            result2.msg += 'http-server failed, error message:\n' + err;
            reject(result2)
        });
        result2.code = 200;
        result2.msg += 'set proxy successful';
        resolve(result2)
    })
}

app.use(
    mount('/favivon.ico', function(ctx){
        ctx.status = 200;
    })
)

app.use(
    mount('/reload', reloadKoa)
)

reloadKoa.use(
    async function(ctx, next){
        // 解析入参
        const query = ctx.query;
        const branch = decodeURI(query.branch);
        const proxy = decodeURI(query.proxy);

        // 声明两个变量用于存放拉取代码和更新环境两个功能的执行结果
        var rtn1 = {},
            rtn2 = {};

        // 是否重新克隆项目
        if(branch){
            // 删除上一次拉取的项目
            deleteFolder(projectDir);
            // 构建克隆命令
            let cmdStr = `git clone -b ` + branch + ` ` + protocol + `://` + git_username + `:` + git_password + `@` + projectUrl;
            // 调用执行克隆命令的方法
            rtn1 = await reloadCode(cmdStr);  
        }


        // 是否切换代理
        if(proxy){
            // 构建启动项目命令，将目标项目部署在8002端口
            let cmdStr = `http-server .\\static\\dist -p 8002 --proxy ` + proxy;
            // 调用执行启动项目命令的方法
            rtn2 = await changeProxy(cmdStr);
        }

        // 整合返回结果
        var rtn = {
            code: rtn1.code === 200 || rtn2.code === 200 ? 200 : 500,
            msg: rtn1.msg 
                        ? rtn2.msg
                            ? rtn1.msg + ' and ' + rtn2.msg
                            : rtn1.msg
                        : rtn2.msg
                            ? rtn2.msg
                            : 'parameter can nott be empty'
        }

        // 响应
        ctx.status = rtn.code;
        ctx.body = rtn.msg;
    }
)

app.use( 
    mount('/', function(ctx) {
        ctx.body = fs.readFileSync(__dirname + '/statichtml/index.html', 'utf-8');
    })
)

app.listen(8003);
