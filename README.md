# TypeScript测试沙箱

这个项目提供了一个API服务，允许用户通过HTTP请求提交TypeScript代码和Jest测试代码，服务器会在安全的沙箱环境中编译执行并反馈测试结果。

## 功能特点

- 接收TypeScript源代码和Jest测试代码
- 在安全的沙箱环境中编译执行
- 返回测试结果及详细的错误信息（如果有）
- 支持完整的Jest测试语法
- 可以直接执行JavaScript代码
- 支持自定义依赖包安装
- 支持自定义TypeScript配置
- 避免测试污染，每个请求都在独立的沙箱中运行

## 安装与配置

1. 克隆仓库
   ```
   git clone https://github.com/your-username/fast-sandbox.git
   cd fast-sandbox
   ```

2. 安装依赖
   ```
   npm install
   ```

3. 启动服务器
   ```
   npm run dev
   ```

服务器默认在端口3000上运行。

## API使用说明

### 运行测试 - POST /run-test

请求体：
```json
{
  "tsCode": "你的TypeScript代码",
  "testCode": "你的Jest测试代码",
  "packages": ["可选的npm包列表"],
  "tsConfig": "可选的TypeScript配置"
}
```

返回内容：
```json
{
  "success": true,
  "message": "测试成功完成",
  "result": "测试详细输出"
}
```

或者错误：
```json
{
  "success": false,
  "message": "测试失败",
  "error": "错误详细信息"
}
```

### 执行代码 - POST /execute

请求体：
```json
{
  "code": "要执行的JavaScript代码",
  "options": {
    // 可选配置
  }
}
```

返回内容：
```json
{
  "success": true,
  "message": "代码执行成功",
  "result": "执行结果",
  "executionTime": "执行时间(ms)"
}
```

## 注意事项

1. 提交的代码应该是自包含的，不依赖外部模块（除非在packages中指定）
2. 测试代码应该导入源代码：`import { ... } from './code'`
3. 每个请求的执行时间有限制，超复杂的测试可能会超时
4. 为了安全考虑，沙箱环境限制了某些操作（如文件系统访问）

## 项目结构

```
fast-sandbox/
├── src/                   # 源代码
│   ├── server.ts          # 主服务器代码
│   ├── routes/            # API路由
│   │   └── test.ts        # 测试相关路由
│   ├── services/          # 服务层
│   │   ├── testRunner.ts  # 测试运行器
│   │   ├── compilerService.ts # TS编译服务
│   │   ├── executionService.ts # 代码执行服务
│   │   ├── sandboxService.ts # 沙箱服务
│   │   └── packageService.ts # 包管理服务
│   ├── utils/             # 工具函数
│   └── config/            # 配置文件
├── temp/                  # 临时文件目录
├── tsconfig.json          # TypeScript配置
├── jest.config.js         # Jest配置
├── package.json           # 项目配置
└── README.md              # 项目说明
```

## 开发与调试

运行本地开发服务器：
```
npm run dev
```

编译TypeScript：
```
npm run build
```

运行测试：
```
npm test
``` 

## 示例

我将为您展示如何测试沙箱服务的简单和复杂curl请求。我们将分别测试`/execute`和`/run-test`这两个端点。

## 测试 `/execute` 端点

### 简单请求 - 基本算术运算

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "const a = 10; const b = 20; a + b;"
  }'
```

### 复杂请求 - 使用循环、数组和对象，并设置内存和超时限制

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "const result = { numbers: [], sum: 0 }; for(let i=0; i<100; i++) { result.numbers.push(i); result.sum += i; } const filtered = result.numbers.filter(n => n % 2 === 0); result.evenCount = filtered.length; result;",
    "options": {
      "memory": 50000000,
      "timeout": 5000
    }
  }'
```

## 测试 `/run-test` 端点

### 简单请求 - 基本的TypeScript函数和测试

```bash
curl -X POST http://localhost:3000/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "tsCode": "export function sum(a: number, b: number): number { return a + b; }",
    "testCode": "import { sum } from \"./code\"; test(\"sum should add two numbers\", () => { expect(sum(1, 2)).toBe(3); });"
  }'
```

### 复杂请求 - 使用外部包和复杂的测试用例

```bash
curl -X POST http://localhost:3000/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "tsCode": "import _ from \"lodash\"; export function chunk<T>(array: T[], size: number): T[][] { return _.chunk(array, size); } export function capitalize(str: string): string { return _.capitalize(str); }",
    "testCode": "import { chunk, capitalize } from \"./code\"; describe(\"Lodash functions\", () => { test(\"chunk should split array\", () => { expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]); }); test(\"capitalize should format string\", () => { expect(capitalize(\"hello world\")).toBe(\"Hello world\"); }); });",
    "packages": ["lodash"]
  }'
```

### 带有TypeScript类的复杂请求

```bash
curl -X POST http://localhost:3000/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "tsCode": "export class Calculator { private value: number = 0; constructor(initialValue: number = 0) { this.value = initialValue; } add(n: number): Calculator { this.value += n; return this; } subtract(n: number): Calculator { this.value -= n; return this; } multiply(n: number): Calculator { this.value *= n; return this; } getValue(): number { return this.value; } }",
    "testCode": "import { Calculator } from \"./code\"; describe(\"Calculator class\", () => { test(\"should perform chained operations\", () => { const calc = new Calculator(10); expect(calc.add(5).subtract(3).multiply(2).getValue()).toBe(24); }); test(\"should handle initial value\", () => { const calc = new Calculator(100); expect(calc.getValue()).toBe(100); }); });"
  }'
```

### 测试异步代码的复杂请求

```bash
curl -X POST http://localhost:3000/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "tsCode": "export async function fetchData(shouldSucceed: boolean): Promise<string> { return new Promise((resolve, reject) => { setTimeout(() => { if (shouldSucceed) { resolve(\"data\"); } else { reject(new Error(\"Failed to fetch data\")); } }, 100); }); }",
    "testCode": "import { fetchData } from \"./code\"; describe(\"Async functions\", () => { test(\"should resolve with data\", async () => { const data = await fetchData(true); expect(data).toBe(\"data\"); }); test(\"should reject with error\", async () => { await expect(fetchData(false)).rejects.toThrow(\"Failed to fetch data\"); }); });"
  }'
```

这些curl请求覆盖了从简单到复杂的各种情况，可以测试您的沙箱服务的各个功能。您可以根据需要修改这些示例，测试其他特定场景。

