import express from 'express';
import bodyParser from 'body-parser';
import { SERVER_CONFIG } from './config';
import testRoutes from './routes/test';
import { ensureTempDirExists, cleanupAllTempFiles } from './utils/fileUtils';

// 创建Express应用
const app = express();
const PORT = SERVER_CONFIG.PORT;

// 中间件配置
app.use(bodyParser.json({ limit: SERVER_CONFIG.BODY_LIMIT }));
app.use(bodyParser.urlencoded({
    extended: true,
    limit: SERVER_CONFIG.BODY_LIMIT
}));

// 确保临时目录存在
ensureTempDirExists();

// 路由注册
app.use(testRoutes);

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 服务器实例
const server = app.listen(PORT, () => {
    console.log(`TypeScript测试沙箱服务器在端口 ${PORT} 上运行`);
});

// 进程退出处理
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    gracefulShutdown();
});

/**
 * 服务器优雅关闭函数
 */
function gracefulShutdown() {
    console.log('正在关闭服务器...');

    server.close(() => {
        console.log('HTTP服务器已关闭');

        // 清理所有临时文件
        console.log('开始清理临时文件...');
        cleanupAllTempFiles();
        console.log('服务器清理完成，正在退出...');

        process.exit(0);
    });

    // 如果10秒内没有正常关闭，强制退出
    setTimeout(() => {
        console.error('服务器关闭超时，强制退出');
        process.exit(1);
    }, 10000);
} 