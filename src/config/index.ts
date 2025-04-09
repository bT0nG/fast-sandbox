import path from 'path';

// 服务器配置
export const SERVER_CONFIG = {
    PORT: process.env.PORT || 3000,
    BODY_LIMIT: '10mb'
};

// 文件系统配置
export const FS_CONFIG = {
    TEMP_DIR: path.join(__dirname, '../../temp'),
    CLEANUP_TEMP_FILES: false // 是否在测试完成后清理临时文件
};

// 沙箱配置
export const SANDBOX_CONFIG = {
    TIMEOUT: 20000, // 测试执行超时时间(毫秒)
    NODE_MODULES_PATH: path.join(__dirname, '../../node_modules'),
    MEMORY_LIMIT: 100 * 1024 * 1024, // QuickJS内存限制（100MB）
    PACKAGE_INSTALL_TIMEOUT: 60000, // npm包安装超时时间（60秒）
    // TypeScript配置JSON - 简化版本
    TS_CONFIG_JSON: {
        compilerOptions: {
            target: "es2020",
            module: "commonjs",
            esModuleInterop: true,
            skipLibCheck: true
        }
    }
};

// TypeScript 编译配置
export const TS_CONFIG = {
    COMPILER_OPTIONS: '--esModuleInterop --skipLibCheck'
};

// Jest 测试配置
export const JEST_CONFIG = {
    DEFAULT_CONFIG: `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
        module: "commonjs"
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: ['/node_modules/(?!(lodash|moment)/)']
};`
}; 