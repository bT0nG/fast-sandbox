import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { SANDBOX_CONFIG } from '../config';

/**
 * 执行Jest测试
 */
export function runJestTests(sessionDir: string, sessionId: string): string {
    console.log(`[${sessionId}] 运行Jest测试`);

    // 检查测试文件是否存在
    const testFilePath = path.join(sessionDir, 'code.test.ts');
    if (fs.existsSync(testFilePath)) {
        const testContent = fs.readFileSync(testFilePath, 'utf-8');
        console.log(`[${sessionId}] 测试文件内容预览: ${testContent}...`);
    }

    try {
        // 创建Jest配置覆盖文件，确保输出详细信息
        const jestOverride = {
            verbose: true,
            testEnvironment: "node",
            preset: 'ts-jest',
            reporters: ["default"],
            transform: {
                "^.+\\.tsx?$": ["ts-jest", {
                    tsconfig: path.join(sessionDir, 'tsconfig.json')
                }]
            },
            // 增加解析模块的配置
            moduleDirectories: ["node_modules", path.join(sessionDir, "node_modules")],
            // 使用工作目录的node_modules作为备选
            modulePaths: [
                path.join(sessionDir, "node_modules"),
                SANDBOX_CONFIG.NODE_MODULES_PATH
            ],
            // 转换任何已安装的npm模块
            transformIgnorePatterns: [
                "/node_modules/(?!(lodash|moment)/)"
            ]
        };

        fs.writeFileSync(
            path.join(sessionDir, 'jest.config.override.json'),
            JSON.stringify(jestOverride, null, 2)
        );

        // 为ts-jest创建特定配置
        const tsJestConfig = {
            isolatedModules: true,
            esModuleInterop: true,
            allowJs: true
        };

        fs.writeFileSync(
            path.join(sessionDir, 'ts-jest.config.json'),
            JSON.stringify(tsJestConfig, null, 2)
        );

        // 重定向输出到文件，以确保捕获所有测试结果
        const outputFile = path.join(sessionDir, 'test-results.txt');

        // 检查依赖的模块是否存在，必要时创建符号链接
        const requiredModules = ['ts-jest', 'jest', 'lodash', 'moment'];
        for (const mod of requiredModules) {
            const modulePath = path.join(sessionDir, 'node_modules', mod);
            const projectModulePath = path.join(SANDBOX_CONFIG.NODE_MODULES_PATH, mod);

            if (!fs.existsSync(modulePath) && fs.existsSync(projectModulePath)) {
                console.log(`[${sessionId}] 创建模块 ${mod} 的软链接`);
                try {
                    fs.symlinkSync(projectModulePath, modulePath, 'dir');
                } catch (err) {
                    console.error(`[${sessionId}] 创建 ${mod} 软链接失败:`, err);
                }
            }
        }

        // 设置环境变量以帮助Jest查找依赖项
        const env = {
            ...process.env,
            NODE_PATH: SANDBOX_CONFIG.NODE_MODULES_PATH
        };

        // 执行Jest测试并将输出重定向到文件
        console.log(`[${sessionId}] 执行Jest测试...`);
        const jestCommand = `npx jest --no-watchman --no-cache --verbose --config jest.config.override.json > ${outputFile} 2>&1`;
        console.log(`[${sessionId}] 执行命令: ${jestCommand}`);

        execSync(jestCommand, {
            cwd: sessionDir,
            timeout: SANDBOX_CONFIG.TIMEOUT,
            env
        });

        // 读取测试结果
        let testResult = '';
        if (fs.existsSync(outputFile)) {
            testResult = fs.readFileSync(outputFile, 'utf-8');
        } else {
            console.error(`[${sessionId}] 警告: 测试结果文件不存在!`);
            testResult = "测试执行完成，但无法读取结果文件";
        }

        return testResult;
    } catch (error) {
        console.error(`[${sessionId}] Jest运行出错:`, error);

        // 尝试读取错误输出文件
        const outputFile = path.join(sessionDir, 'test-results.txt');
        if (fs.existsSync(outputFile)) {
            const errorOutput = fs.readFileSync(outputFile, 'utf-8');
            console.log(`[${sessionId}] 测试错误输出: ${errorOutput}`);
            return errorOutput;
        }

        if (error instanceof Error && 'stdout' in error) {
            const errorOutput = (error as any).stdout?.toString() || '';
            console.log(`[${sessionId}] Jest错误输出: ${errorOutput}`);
            return errorOutput; // 返回Jest错误输出
        }

        return `测试执行期间发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
} 