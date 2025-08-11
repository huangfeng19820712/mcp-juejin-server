#!/usr/bin/env node

/**
 * 掘金发布测试运行器
 * 用于快速测试掘金文章发布功能
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
    log(`\n${'='.repeat(50)}`, 'cyan');
    log(` ${message}`, 'bright');
    log(`${'='.repeat(50)}`, 'cyan');
}

function logStep(message) {
    log(`\n▶ ${message}`, 'blue');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️ ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️ ${message}`, 'cyan');
}

async function checkPrerequisites() {
    logHeader('检查前置条件');
    
    // 检查 Node.js 版本
    try {
        const nodeVersion = process.version;
        logInfo(`Node.js 版本: ${nodeVersion}`);
        if (parseInt(process.version.slice(1).split('.')[0]) < 16) {
            logError('需要 Node.js 16 或更高版本');
            return false;
        }
        logSuccess('Node.js 版本检查通过');
    } catch (error) {
        logError(`Node.js 版本检查失败: ${error.message}`);
        return false;
    }
    
    // 检查依赖是否安装
    try {
        const packageJsonPath = path.join(__dirname, '../package.json');
        if (!await fs.pathExists(packageJsonPath)) {
            logError('找不到 package.json 文件');
            return false;
        }
        logSuccess('package.json 文件存在');
        
        const nodeModulesPath = path.join(__dirname, '../node_modules');
        if (!await fs.pathExists(nodeModulesPath)) {
            logWarning('node_modules 目录不存在，正在安装依赖...');
            execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            logSuccess('依赖安装完成');
        } else {
            logSuccess('依赖已安装');
        }
    } catch (error) {
        logError(`依赖检查失败: ${error.message}`);
        return false;
    }
    
    // 检查 Playwright 是否安装
    try {
        execSync('npx playwright --version', { stdio: 'pipe' });
        logSuccess('Playwright 已安装');
    } catch (error) {
        logWarning('Playwright 未安装，正在安装...');
        execSync('npx playwright install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
        logSuccess('Playwright 安装完成');
    }
    
    // 检查测试文件
    const testFiles = [
        'juejin-publisher.spec.ts',
        'fixtures/test-article.md',
        'fixtures/test-article-with-images.md'
    ];
    
    for (const file of testFiles) {
        const filePath = path.join(__dirname, file);
        if (await fs.pathExists(filePath)) {
            logSuccess(`测试文件存在: ${file}`);
        } else {
            logError(`测试文件不存在: ${file}`);
            return false;
        }
    }
    
    return true;
}

async function checkLoginState() {
    logHeader('检查登录状态');
    
    const statePath = path.join(__dirname, '../juejin-storage-state.json');
    if (await fs.pathExists(statePath)) {
        try {
            const state = await fs.readJSON(statePath);
            logSuccess('找到已保存的登录状态');
            logInfo(`状态文件大小: ${JSON.stringify(state).length} 字符`);
            return true;
        } catch (error) {
            logError(`登录状态文件损坏: ${error.message}`);
            return false;
        }
    } else {
        logWarning('未找到登录状态文件');
        logInfo('需要先运行登录流程');
        return false;
    }
}

function runTest(testName, options = {}) {
    logHeader(`运行测试: ${testName}`);
    
    const baseCommand = 'npx playwright test tests/juejin-publisher.spec.ts';
    const grepOption = `--grep "${testName}"`;
    
    let command = `${baseCommand} ${grepOption}`;
    
    if (options.headed) {
        command += ' --headed';
        logInfo('使用有头模式运行（显示浏览器界面）');
    }
    
    if (options.debug) {
        command += ' --debug';
        logInfo('使用调试模式运行（慢速执行）');
    }
    
    if (options.workers) {
        command += ` --workers ${options.workers}`;
        logInfo(`使用 ${options.workers} 个工作进程`);
    }
    
    logStep(`执行命令: ${command}`);
    
    try {
        execSync(command, { 
            stdio: 'inherit', 
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, FORCE_COLOR: '1' }
        });
        logSuccess(`测试 ${testName} 执行完成`);
        return true;
    } catch (error) {
        logError(`测试 ${testName} 执行失败: ${error.message}`);
        return false;
    }
}

async function main() {
    logHeader('掘金发布测试运行器');
    logInfo('开始检查环境和运行测试...');
    
    // 检查前置条件
    if (!(await checkPrerequisites())) {
        logError('前置条件检查失败，退出');
        process.exit(1);
    }
    
    // 检查登录状态
    const hasLoginState = await checkLoginState();
    if (!hasLoginState) {
        logWarning('建议先运行登录流程获取登录状态');
        logInfo('可以运行: npm run login 或手动登录掘金');
    }
    
    // 解析命令行参数
    const args = process.argv.slice(2);
    const options = {
        headed: args.includes('--headed') || args.includes('-h'),
        debug: args.includes('--debug') || args.includes('-d'),
        workers: args.find(arg => arg.startsWith('--workers='))?.split('=')[1] || '1'
    };
    
    // 运行测试
    const testResults = [];
    
    // 运行纯文本发布测试
    logStep('开始运行纯文本发布测试...');
    const textTestResult = runTest('发布纯文本文章', options);
    testResults.push({ name: '纯文本发布', result: textTestResult });
    
    // 运行图片上传测试
    logStep('开始运行图片上传测试...');
    const imageTestResult = runTest('发布包含本地图片的文章', options);
    testResults.push({ name: '图片上传发布', result: imageTestResult });
    
    // 显示测试结果摘要
    logHeader('测试结果摘要');
    let successCount = 0;
    let totalCount = testResults.length;
    
    for (const test of testResults) {
        if (test.result) {
            logSuccess(`${test.name}: 通过`);
            successCount++;
        } else {
            logError(`${test.name}: 失败`);
        }
    }
    
    logInfo(`\n总计: ${successCount}/${totalCount} 个测试通过`);
    
    if (successCount === totalCount) {
        logSuccess('🎉 所有测试都通过了！');
        process.exit(0);
    } else {
        logError('❌ 部分测试失败，请检查错误信息');
        process.exit(1);
    }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
    logError('未处理的 Promise 拒绝:');
    logError(`原因: ${reason}`);
    logError(`Promise: ${promise}`);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    logError('未捕获的异常:');
    logError(`错误: ${error.message}`);
    logError(`堆栈: ${error.stack}`);
    process.exit(1);
});

// 运行主函数
if (require.main === module) {
    main().catch(error => {
        logError(`主函数执行失败: ${error.message}`);
        logError(`堆栈: ${error.stack}`);
        process.exit(1);
    });
}

module.exports = {
    checkPrerequisites,
    checkLoginState,
    runTest
};


