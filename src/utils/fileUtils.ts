import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FS_CONFIG } from '../config';

/**
 * 确保临时目录存在
 */
export function ensureTempDirExists(): void {
    if (!fs.existsSync(FS_CONFIG.TEMP_DIR)) {
        fs.mkdirSync(FS_CONFIG.TEMP_DIR, { recursive: true });
    }
}

/**
 * 创建会话目录，返回目录路径和会话ID
 */
export function createSessionDir(): { sessionDir: string; sessionId: string } {
    const sessionId = uuidv4();
    const sessionDir = path.join(FS_CONFIG.TEMP_DIR, sessionId);

    // 确保临时目录存在
    if (!fs.existsSync(FS_CONFIG.TEMP_DIR)) {
        fs.mkdirSync(FS_CONFIG.TEMP_DIR, { recursive: true });
    }

    // 创建会话目录
    fs.mkdirSync(sessionDir, { recursive: true });

    // 设置会话目录环境变量
    process.env.SESSION_DIR = sessionDir;

    console.log(`[${sessionId}] 创建临时目录：${sessionDir}`);

    return { sessionDir, sessionId };
}

/**
 * 写入TypeScript和测试代码文件
 */
export function writeCodeFiles(
    sessionDir: string,
    tsCode: string,
    testCode: string
): { tsFilePath: string; testFilePath: string } {
    const tsFilePath = path.join(sessionDir, 'code.ts');
    const testFilePath = path.join(sessionDir, 'code.test.ts');

    fs.writeFileSync(tsFilePath, tsCode);
    fs.writeFileSync(testFilePath, testCode);

    return { tsFilePath, testFilePath };
}

/**
 * 写入配置文件
 */
export function writeConfigFiles(sessionDir: string, jestConfig: string): void {
    // 写入Jest配置文件
    fs.writeFileSync(path.join(sessionDir, 'jest.config.js'), jestConfig);

    // 创建package.json
    const packageJson = {
        name: "ts-test-sandbox",
        version: "1.0.0",
        description: "TypeScript测试沙箱",
        scripts: {
            test: "jest"
        },
        dependencies: {}
    };

    fs.writeFileSync(
        path.join(sessionDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
}

/**
 * 创建node_modules软链接
 */
export function createNodeModulesSymlink(
    sessionDir: string,
    nodeModulesPath: string
): void {
    // 删除可能存在的旧符号链接或目录
    const targetPath = path.join(sessionDir, 'node_modules');

    if (fs.existsSync(targetPath)) {
        try {
            const stats = fs.lstatSync(targetPath);
            if (stats.isSymbolicLink() || stats.isDirectory()) {
                if (stats.isSymbolicLink()) {
                    fs.unlinkSync(targetPath);
                } else {
                    // 如果是目录，使用递归删除
                    fs.rmSync(targetPath, { recursive: true, force: true });
                }
            }
        } catch (err) {
            console.error(`无法删除已存在的node_modules: ${err}`);
        }
    }

    try {
        // 创建符号链接
        fs.symlinkSync(nodeModulesPath, targetPath, 'dir');

        // 验证链接是否成功创建
        if (!fs.existsSync(targetPath)) {
            throw new Error(`创建的符号链接不存在: ${targetPath}`);
        }

        // 验证链接是否指向正确的路径
        const linkPath = fs.readlinkSync(targetPath);
        if (linkPath !== nodeModulesPath) {
            console.warn(`警告: 创建的符号链接指向 ${linkPath}，而不是 ${nodeModulesPath}`);
        }

        // 检查关键模块是否可访问
        const criticalModules = ['typescript', 'jest', 'ts-jest'];
        for (const mod of criticalModules) {
            const modPath = path.join(targetPath, mod);
            if (!fs.existsSync(modPath)) {
                console.warn(`警告: 无法访问关键模块 ${mod} 在 ${modPath}`);
            }
        }
    } catch (err) {
        console.error(`创建node_modules符号链接失败: ${err}`);

        // 降级方案：创建实际的目录
        try {
            fs.mkdirSync(targetPath, { recursive: true });

            // 复制关键模块
            const criticalModules = ['typescript', 'jest', 'ts-jest', 'lodash', 'moment'];
            for (const mod of criticalModules) {
                const srcPath = path.join(nodeModulesPath, mod);
                const destPath = path.join(targetPath, mod);

                if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
                    console.log(`复制关键模块 ${mod} 到临时目录`);

                    // 使用symlink而非复制以节省空间和时间
                    fs.symlinkSync(srcPath, destPath, 'dir');
                }
            }
        } catch (fallbackErr) {
            console.error(`创建node_modules目录也失败: ${fallbackErr}`);
        }
    }
}

/**
 * 清理会话资源
 */
export function cleanupSession(sessionDir: string): void {
    try {
        // 尝试删除node_modules symlink
        const nodeModulesPath = path.join(sessionDir, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            try {
                const stats = fs.lstatSync(nodeModulesPath);
                if (stats.isSymbolicLink()) {
                    fs.unlinkSync(nodeModulesPath);
                }
            } catch (err) {
                console.error(`删除symlink失败 ${err}`);
            }
        }

        // 删除整个会话目录
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`清理临时目录: ${sessionDir}`);
    } catch (error) {
        console.error(`清理临时目录失败: ${error}`);
    }
}

/**
 * 清空所有临时文件和目录
 */
export function cleanupAllTempFiles(): void {
    try {
        const tempDir = FS_CONFIG.TEMP_DIR;

        if (!fs.existsSync(tempDir)) {
            console.log(`临时目录不存在: ${tempDir}`);
            return;
        }

        console.log(`开始清理临时目录: ${tempDir}`);

        // 读取临时目录下的所有会话目录
        const sessions = fs.readdirSync(tempDir);

        for (const session of sessions) {
            const sessionPath = path.join(tempDir, session);

            // 确保是目录而不是文件
            if (fs.statSync(sessionPath).isDirectory()) {
                // 尝试删除node_modules软链接
                const nodeModulesPath = path.join(sessionPath, 'node_modules');
                if (fs.existsSync(nodeModulesPath)) {
                    try {
                        const stats = fs.lstatSync(nodeModulesPath);
                        if (stats.isSymbolicLink()) {
                            fs.unlinkSync(nodeModulesPath);
                        }
                    } catch (err) {
                        console.error(`删除会话 ${session} 的symlink失败:`, err);
                    }
                }

                // 删除整个会话目录
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`已清理会话目录: ${session}`);
            } else {
                // 如果是文件则直接删除
                fs.unlinkSync(sessionPath);
                console.log(`已删除临时文件: ${session}`);
            }
        }

        console.log(`临时目录清理完成: ${tempDir}`);
    } catch (error) {
        console.error(`清理临时目录失败:`, error);
    }
} 