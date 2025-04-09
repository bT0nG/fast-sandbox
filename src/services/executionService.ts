import { getQuickJS } from 'quickjs-emscripten';
import { SANDBOX_CONFIG } from '../config';

/**
 * 在沙箱中通过QuickJS执行代码
 * QuickJS提供了比VM2更安全的沙箱环境
 */
export async function executeInSandbox(code: string, options: {
    memory?: number;
    timeout?: number;
    context?: Record<string, unknown>;
} = {}): Promise<{
    result: unknown;
    error?: string;
    executionTime: number;
}> {
    console.log('在QuickJS沙箱中执行代码');

    const startTime = Date.now();
    let result: unknown = null;
    let error: string | undefined = undefined;

    try {
        // 初始化QuickJS
        const quickjs = await getQuickJS();
        const vm = quickjs.newRuntime();

        // 设置内存限制
        const memoryLimit = options.memory || SANDBOX_CONFIG.MEMORY_LIMIT;
        vm.setMemoryLimit(memoryLimit);

        // 设置超时
        const timeout = options.timeout || SANDBOX_CONFIG.TIMEOUT;
        vm.setInterruptHandler(() => {
            return (Date.now() - startTime) > timeout;
        });

        // 执行代码
        const context = vm.newContext();
        const evalResult = context.evalCode(code);

        if (evalResult.error) {
            // 处理执行错误
            error = String(context.dump(evalResult.error));
            evalResult.error.dispose();
        } else {
            // 获取执行结果
            result = context.dump(evalResult.value);
            evalResult.value.dispose();
        }

        // 清理资源
        context.dispose();
        vm.dispose();
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    const executionTime = Date.now() - startTime;

    return {
        result,
        error,
        executionTime
    };
} 