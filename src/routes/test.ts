import { Router, Request, Response } from 'express';
import { runTypeScriptTest } from '../services/testRunner';
import { executeInSandbox } from '../services/executionService';

const router = Router();

// POST /run-test 运行TypeScript测试
router.post('/run-test', async (req: Request, res: Response) => {
    try {
        const { tsCode, testCode, packages, tsConfig } = req.body;

        if (!tsCode || !testCode) {
            return res.status(400).json({
                success: false,
                message: '请提供TypeScript代码和Jest测试代码'
            });
        }

        console.log("接收到测试请求，代码长度:", tsCode.length, "测试长度:", testCode.length);
        if (packages && packages.length > 0) {
            console.log("请求安装以下包:", packages.join(', '));
        }

        const result = await runTypeScriptTest({
            tsCode,
            testCode,
            packages,
            tsConfig
        });

        console.log("测试完成，结果:", result.success ? "成功" : "失败");
        if (result.result) {
            console.log("测试输出:", result.result.substring(0, 100) + (result.result.length > 100 ? "..." : ""));
        }

        return res.json(result);
    } catch (error: unknown) {
        console.error('路由处理错误:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: errorMessage
        });
    }
});

// 添加一个新端点，用于沙箱中直接执行代码
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const { code, options } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: '请提供要执行的JavaScript代码'
            });
        }

        console.log("接收到代码执行请求，代码长度:", code.length);

        // 使用沙箱执行代码
        const result = await executeInSandbox(code, options);

        return res.json({
            success: !result.error,
            message: result.error ? '执行出错' : '代码执行成功',
            result: result.result,
            error: result.error,
            executionTime: result.executionTime
        });
    } catch (error: unknown) {
        console.error('执行代码错误:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: errorMessage
        });
    }
});

export default router; 