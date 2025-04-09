import {
    createSessionDir,
    writeCodeFiles,
    writeConfigFiles,
    createNodeModulesSymlink,
    cleanupSession
} from '../utils/fileUtils';
import { compileTypeScript } from './compilerService';
import { runJestTests } from './testService';
import { validateTypeScriptSyntax } from './compilerService';
import { installPackages } from './packageService';
import { SANDBOX_CONFIG, JEST_CONFIG } from '../config';
import path from 'path';
import fs from 'fs';

// 测试结果类型
interface TestResult {
    success: boolean;
    message: string;
    result?: string;
    error?: string;
}

// 测试请求类型
interface TestRunRequest {
    tsCode: string;
    testCode: string;
    packages?: string[];  // 要安装的npm包列表
    tsConfig?: Record<string, any>;  // 自定义的TypeScript配置
}

/**
 * 运行TypeScript测试
 */
export async function runTypeScriptTest(
    request: TestRunRequest
): Promise<TestResult> {
    // 解构请求数据
    const { tsCode, testCode, packages = [], tsConfig } = request;

    // 创建会话目录
    const { sessionDir, sessionId } = createSessionDir();

    try {
        // 写入代码文件
        writeCodeFiles(sessionDir, tsCode, testCode);
        console.log(`[${sessionId}] 写入代码文件完成`);

        // 写入配置文件
        writeConfigFiles(sessionDir, JEST_CONFIG.DEFAULT_CONFIG);
        console.log(`[${sessionId}] 写入配置文件完成`);

        // 确保创建了tsconfig.json文件
        const tsConfigPath = path.join(sessionDir, 'tsconfig.json');
        if (!fs.existsSync(tsConfigPath)) {
            const tsConfigContent = JSON.stringify(SANDBOX_CONFIG.TS_CONFIG_JSON, null, 2);
            fs.writeFileSync(tsConfigPath, tsConfigContent);
            console.log(`[${sessionId}] 创建tsconfig.json文件: ${tsConfigPath}`);

            // 验证文件是否已创建
            if (fs.existsSync(tsConfigPath)) {
                console.log(`[${sessionId}] 验证tsconfig.json文件已成功创建`);
                const content = fs.readFileSync(tsConfigPath, 'utf-8');
                console.log(`[${sessionId}] tsconfig.json内容: ${content}`);
            } else {
                console.error(`[${sessionId}] 警告: tsconfig.json创建失败!`);
            }
        }

        // 显示目录内容以便调试
        const dirContent = fs.readdirSync(sessionDir);
        console.log(`[${sessionId}] 会话目录内容:`, dirContent);

        // 链接node_modules
        createNodeModulesSymlink(sessionDir, SANDBOX_CONFIG.NODE_MODULES_PATH);
        console.log(`[${sessionId}] 链接node_modules目录完成`);

        // 如果请求中包含要安装的包，则安装它们
        if (packages && packages.length > 0) {
            console.log(`[${sessionId}] 尝试安装请求的npm包: ${packages.join(', ')}`);
            const installSuccess = installPackages(sessionDir, packages, sessionId);
            if (!installSuccess) {
                return {
                    success: false,
                    message: 'npm包安装失败',
                    error: '无法安装请求的依赖包，请检查包名是否正确'
                };
            }
        }

        // 编译TypeScript
        try {
            compileTypeScript(sessionDir, sessionId);
            console.log(`[${sessionId}] TypeScript编译完成`);
        } catch (compileError) {
            console.error(`[${sessionId}] 编译错误:`, compileError);
            return {
                success: false,
                message: 'TypeScript编译失败',
                error: compileError instanceof Error ? compileError.message : String(compileError)
            };
        }

        // 运行Jest测试
        try {
            const testResult = runJestTests(sessionDir, sessionId);
            console.log(`[${sessionId}] Jest测试完成，结果长度: ${testResult.length}`);

            // 确保结果非空
            const resultOutput = testResult.trim() || "测试执行成功，但没有输出内容";

            return {
                success: true,
                message: '测试成功完成',
                result: resultOutput
            };
        } catch (testError) {
            console.error(`[${sessionId}] 测试执行错误:`, testError);

            // 检查是否是Jest测试失败
            if (testError instanceof Error && 'stdout' in testError) {
                const errorOutput = (testError as any).stdout?.toString() || '';
                return {
                    success: false,
                    message: 'Jest测试失败',
                    error: errorOutput || testError.message
                };
            }

            return {
                success: false,
                message: '测试执行失败',
                error: testError instanceof Error ? testError.message : String(testError)
            };
        }
    } catch (error: unknown) {
        let errorMessage = '测试失败';

        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
            const execError = error as { stderr?: Buffer; stdout?: Buffer };
            if (execError.stderr) {
                errorMessage = execError.stderr.toString();
            } else if (execError.stdout) {
                errorMessage = execError.stdout.toString();
            }
        }

        console.error(`[${sessionId}] 测试失败: ${errorMessage}`);

        return {
            success: false,
            message: '测试失败',
            error: errorMessage
        };
    } finally {
        // 清理会话资源
        cleanupSession(sessionDir);
    }
} 