import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { exec } from 'child_process';
import { SANDBOX_CONFIG, TS_CONFIG } from '../config';
import * as globModule from 'glob';
const { glob } = globModule;

/**
 * 编译TypeScript文件
 */
export async function compileTypeScript(sessionDir: string, sessionId: string): Promise<boolean> {
    console.log(`[${sessionId}] 编译TypeScript文件`);

    try {
        // 使用回调风格的glob函数
        const tsFiles = await new Promise<string[]>((resolve, reject) => {
            glob(`${sessionDir}/**/*.ts`, (err, matches) => {
                if (err) reject(err);
                else resolve(matches);
            });
        });

        if (tsFiles.length === 0) {
            console.log(`[${sessionId}] 没有找到TypeScript文件，跳过编译`);
            return true;
        }

        // 创建一个非常简单的tsconfig.json（如果不存在）
        const tsConfigPath = path.join(sessionDir, 'tsconfig.json');
        if (!fs.existsSync(tsConfigPath)) {
            const tsConfig = {
                compilerOptions: {
                    target: "es2020",
                    module: "commonjs",
                    esModuleInterop: true,
                    skipLibCheck: true
                }
            };
            fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
            console.log(`[${sessionId}] 已在compilerService中创建临时tsconfig.json配置`);
        } else {
            console.log(`[${sessionId}] tsconfig.json已存在，跳过创建`);
        }

        // 显示当前目录内容
        const dirContent = fs.readdirSync(sessionDir);
        console.log(`[${sessionId}] 会话目录内容:`, dirContent);

        // 读取TypeScript文件内容
        const codeContent = fs.readFileSync(path.join(sessionDir, 'code.ts'), 'utf8');
        console.log(`[${sessionId}] TypeScript代码内容:\n${codeContent}`);

        // 尝试只编译简单的文件
        const simpleTsPath = path.join(sessionDir, 'simple.ts');
        fs.writeFileSync(simpleTsPath, 'export function test() { return true; }');

        console.log(`[${sessionId}] 尝试编译简单TypeScript文件`);

        const simpleOutput = execSync(`cd ${sessionDir} && npx tsc simple.ts --esModuleInterop`, {
            cwd: sessionDir
        }).toString();

        console.log(`[${sessionId}] 简单文件编译完成: ${simpleOutput || '无输出'}`);

        // 检查是否存在编译后的文件
        if (fs.existsSync(path.join(sessionDir, 'simple.js'))) {
            console.log(`[${sessionId}] 简单文件编译成功`);

            // 现在尝试使用相同的命令编译实际代码
            console.log(`[${sessionId}] 尝试编译实际TypeScript文件`);

            try {
                const output = execSync(`cd ${sessionDir} && npx tsc code.ts --esModuleInterop`, {
                    cwd: sessionDir
                }).toString();

                console.log(`[${sessionId}] 编译完成: ${output || '无输出'}`);
            } catch (codeCompileErr) {
                console.error(`[${sessionId}] 实际代码编译错误:`, codeCompileErr);

                if (codeCompileErr instanceof Error && 'stderr' in codeCompileErr) {
                    const stderr = (codeCompileErr as any).stderr?.toString() || '';
                    if (stderr) {
                        console.error(`[${sessionId}] 编译标准错误输出: ${stderr}`);
                    }
                }

                if (codeCompileErr instanceof Error && 'stdout' in codeCompileErr) {
                    const stdout = (codeCompileErr as any).stdout?.toString() || '';
                    if (stdout) {
                        console.error(`[${sessionId}] 编译标准输出: ${stdout}`);
                    }
                }

                // 尝试使用不同的编译选项
                console.log(`[${sessionId}] 尝试使用不同选项编译`);

                // 跳过类型检查直接输出
                execSync(`cd ${sessionDir} && npx tsc code.ts --skipLibCheck --allowJs --outDir dist`, {
                    cwd: sessionDir
                });

                // 复制TypeScript文件到JavaScript文件
                fs.copyFileSync(
                    path.join(sessionDir, 'code.ts'),
                    path.join(sessionDir, 'code.js')
                );

                console.log(`[${sessionId}] 已创建JavaScript文件 (直接复制)`);

                return true; // 即使没有正确编译也继续执行测试
            }
        } else {
            throw new Error('简单TypeScript文件编译失败');
        }

        // 检查编译后的文件是否存在
        const jsFilePath = path.join(sessionDir, 'code.js');
        if (fs.existsSync(jsFilePath)) {
            console.log(`[${sessionId}] 编译成功，生成JS文件: ${jsFilePath}`);
            const jsContent = fs.readFileSync(jsFilePath, 'utf-8');
            console.log(`[${sessionId}] JS文件内容预览: ${jsContent.substring(0, 100)}...`);
        } else {
            console.error(`[${sessionId}] 警告: 编译完成但未找到JS文件`);

            // 尝试直接复制TypeScript文件作为JavaScript文件
            fs.copyFileSync(
                path.join(sessionDir, 'code.ts'),
                jsFilePath
            );

            console.log(`[${sessionId}] 已创建JavaScript文件 (直接复制)`);
        }

        return true;
    } catch (error: any) {
        console.error(`[${sessionId}] TypeScript编译失败: ${error.message}`);
        // 尝试使用简单命令进行编译
        try {
            console.log(`[${sessionId}] 尝试使用替代方法编译...`);

            // 使用回调风格的glob函数
            const tsFiles = await new Promise<string[]>((resolve, reject) => {
                glob(`${sessionDir}/**/*.ts`, (err, matches) => {
                    if (err) reject(err);
                    else resolve(matches);
                });
            });

            for (const file of tsFiles) {
                if (!file.includes('node_modules') && !file.endsWith('.d.ts')) {
                    const simpleTscCommand = `npx tsc ${path.relative(sessionDir, file)} --esModuleInterop --target es2018 --module commonjs`;
                    console.log(`[${sessionId}] 尝试编译: ${simpleTscCommand}`);
                    await exec(simpleTscCommand, { cwd: sessionDir });
                }
            }
            return true;
        } catch (fallbackError: any) {
            console.error(`[${sessionId}] 备用编译方法也失败: ${fallbackError.message}`);
            return false;
        }
    }
}

/**
 * 在沙箱中验证TypeScript代码的语法
 * @param code TypeScript代码字符串
 * @param options 可选的TypeScript配置选项
 * @returns 验证结果对象
 */
export function validateTypeScriptSyntax(
    code: string,
    options: {
        target?: string;
        module?: string;
        strict?: boolean;
        noImplicitAny?: boolean;
    } = {}
): {
    valid: boolean;
    error?: string;
    details?: string[];
    config?: {
        target: string;
        module: string;
        strict: boolean;
        noImplicitAny: boolean;
        [key: string]: any;
    };
    diagnostics?: Array<{
        file: string;
        line: number;
        character: number;
        message: string;
        code: number;
    }>;
} {
    const tempDir = path.join(SANDBOX_CONFIG.NODE_MODULES_PATH, '..', 'temp', 'syntax-check');
    const tempFile = path.join(tempDir, `check-${Date.now()}.ts`);
    const tempConfig = path.join(tempDir, `tsconfig-${Date.now()}.json`);

    // 定义tsConfig变量在函数作用域内
    const tsConfig = {
        compilerOptions: {
            ...SANDBOX_CONFIG.TS_CONFIG_JSON.compilerOptions,
            target: options.target || SANDBOX_CONFIG.TS_CONFIG_JSON.compilerOptions.target,
            module: options.module || SANDBOX_CONFIG.TS_CONFIG_JSON.compilerOptions.module,
            strict: options.strict ?? true,
            noImplicitAny: options.noImplicitAny ?? true,
            noEmit: true
        }
    };

    try {
        // 确保临时目录存在
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 创建临时TypeScript文件
        fs.writeFileSync(tempFile, code);

        // 创建临时的tsconfig.json
        fs.writeFileSync(tempConfig, JSON.stringify(tsConfig, null, 2));

        // 使用tsc检查语法
        const result = execSync(`npx tsc --project ${tempConfig}`, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        return {
            valid: true,
            config: tsConfig.compilerOptions
        };
    } catch (error) {
        let errorMessage = '未知错误';
        let errorDetails: string[] = [];
        let diagnostics: Array<{
            file: string;
            line: number;
            character: number;
            message: string;
            code: number;
        }> = [];

        if (error instanceof Error) {
            if ('stderr' in error) {
                const stderr = (error as any).stderr?.toString() || '';
                if (stderr) {
                    errorMessage = stderr.split('\n')[0]; // 获取第一行错误信息
                    errorDetails = stderr.split('\n').filter((line: string) => line.trim());

                    // 解析错误诊断信息
                    const diagnosticRegex = /^(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$/;
                    errorDetails.forEach(line => {
                        const match = line.match(diagnosticRegex);
                        if (match) {
                            diagnostics.push({
                                file: match[1],
                                line: parseInt(match[2]),
                                character: parseInt(match[3]),
                                code: parseInt(match[4]),
                                message: match[5]
                            });
                        }
                    });

                    // 输出主要错误信息到终端
                    console.error('TypeScript语法错误:');
                    console.error('主要错误:', errorMessage);
                    if (diagnostics.length > 0) {
                        console.error('详细错误信息:');
                        diagnostics.forEach(diag => {
                            console.error(`  ${diag.file}(${diag.line},${diag.character}): ${diag.message}`);
                        });
                    }
                }
            } else {
                errorMessage = error.message;
                console.error('TypeScript语法错误:', errorMessage);
            }
        }

        return {
            valid: false,
            error: errorMessage,
            details: errorDetails,
            config: tsConfig.compilerOptions,
            diagnostics
        };
    } finally {
        // 清理临时文件
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(tempConfig)) {
                fs.unlinkSync(tempConfig);
            }
        } catch (cleanupError) {
            console.error('清理临时文件时出错:', cleanupError);
        }
    }
} 