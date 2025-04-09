import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { SANDBOX_CONFIG } from '../config';

/**
 * 在沙箱环境中安装npm包
 */
export function installPackages(
    sessionDir: string,
    packageNames: string[],
    sessionId: string
): boolean {
    if (!packageNames || packageNames.length === 0) {
        console.log(`[${sessionId}] 没有指定要安装的包`);
        return true;
    }

    console.log(`[${sessionId}] 在沙箱中安装以下npm包: ${packageNames.join(', ')}`);

    try {
        // 确保存在package.json
        const packageJsonPath = path.join(sessionDir, 'package.json');
        let packageJson: {
            name: string;
            version: string;
            description: string;
            dependencies: Record<string, string>;
        } = {
            name: "ts-test-sandbox",
            version: "1.0.0",
            description: "动态TypeScript沙箱",
            dependencies: {}
        };

        if (fs.existsSync(packageJsonPath)) {
            packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            packageJson.dependencies = packageJson.dependencies || {};
        }

        // 更新package.json添加新的依赖
        for (const pkg of packageNames) {
            // 简单的包名验证，避免命令注入
            if (/^[a-zA-Z0-9@\/-_.]+$/.test(pkg)) {
                const baseName = pkg.split('@')[0];
                const version = pkg.includes('@') ? pkg.split('@').slice(1).join('@') : 'latest';
                packageJson.dependencies[baseName] = version;
            } else {
                console.error(`[${sessionId}] 非法的包名: ${pkg}`);
                return false;
            }
        }

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

        // 在运行前先检查是否已经安装了npm
        try {
            execSync('npm --version', { cwd: sessionDir });
        } catch (npmErr) {
            console.error(`[${sessionId}] npm未正确安装，将使用主进程的npm:`, npmErr);
        }

        // 使用npm install安装包，添加--legacy-peer-deps可能解决peer dependency问题
        console.log(`[${sessionId}] 执行npm install`);
        const npmResult = execSync('npm install --legacy-peer-deps --no-fund --no-audit --loglevel=error', {
            cwd: sessionDir,
            timeout: SANDBOX_CONFIG.PACKAGE_INSTALL_TIMEOUT
        }).toString();

        console.log(`[${sessionId}] npm安装输出: ${npmResult}`);

        // 验证包是否正确安装
        for (const pkg of packageNames) {
            const baseName = pkg.split('@')[0];
            const modulePath = path.join(sessionDir, 'node_modules', baseName);

            if (!fs.existsSync(modulePath)) {
                console.warn(`[${sessionId}] 警告: 包 ${baseName} 可能未正确安装`);

                // 尝试通过软链接方式从主项目复制模块
                const projectModulePath = path.join(SANDBOX_CONFIG.NODE_MODULES_PATH, baseName);
                if (fs.existsSync(projectModulePath)) {
                    console.log(`[${sessionId}] 找到项目中的模块 ${baseName}，创建软链接`);
                    fs.symlinkSync(
                        projectModulePath,
                        modulePath,
                        'dir'
                    );
                }
            } else {
                console.log(`[${sessionId}] 包 ${baseName} 安装成功`);
            }
        }

        console.log(`[${sessionId}] 包安装过程完成`);
        return true;
    } catch (error) {
        console.error(`[${sessionId}] 包安装失败:`, error);

        // 检查node_modules是否存在，不存在则创建软链接
        const nodeModulesPath = path.join(sessionDir, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            try {
                console.log(`[${sessionId}] 尝试通过软链接方式使用主项目的node_modules`);
                fs.symlinkSync(
                    SANDBOX_CONFIG.NODE_MODULES_PATH,
                    nodeModulesPath,
                    'dir'
                );
                return true;
            } catch (linkError) {
                console.error(`[${sessionId}] 创建软链接失败:`, linkError);
                return false;
            }
        }

        return false;
    }
} 